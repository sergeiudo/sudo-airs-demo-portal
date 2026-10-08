/**
 * aigw-docs.js — the Prisma AIRS AI Gateway developer docs, held locally so the
 * Developer Corner can search them and answer questions from them.
 *
 * Source: the official llms.txt indexes on portkey.ai (the Prisma AIRS doc set
 * — product docs, integrations, self-hosting, the inference and admin API
 * references, changelog, help center; ~615 pages). Every page is fetched as
 * markdown (`<page>.md`), split at its headings into passages, and indexed with
 * BM25 — plain keyword ranking, no embeddings, no dependency.
 *
 * Kept on disk in .cache/aigw-docs/corpus.json (gitignored) and re-read once a
 * day in the background; a refresh that fails keeps the last good copy. The
 * first build after a fresh checkout takes about a minute and runs in the
 * background — until then search reports `building`.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

export const DOCS_ORIGIN = 'https://portkey.ai'
const INDEXES = [
  `${DOCS_ORIGIN}/docs/_llms/prisma-airs/docs.md`,
  `${DOCS_ORIGIN}/docs/_llms/prisma-airs/integrations.md`,
  `${DOCS_ORIGIN}/docs/_llms/prisma-airs.md`,
]
const TTL_MS = 24 * 60 * 60 * 1000
const CONCURRENCY = 8
const MAX_PASSAGE = 1800

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(HERE, '.cache', 'aigw-docs')
const CACHE_FILE = path.join(CACHE_DIR, 'corpus.json')

const S = {
  pages: [],          // { url, path, title, section, desc }
  weights: [],        // ranking weight per page (weightOf)
  passages: [],       // { page, heading, anchor, text }
  index: null,        // BM25 postings
  builtAt: 0,
  state: 'empty',     // empty | building | ready
  progress: null,     // { done, total } while building
  error: null,
}
let inflight = null

// ─── fetching ────────────────────────────────────────────────────────────────

async function get(url, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'sudo-airs-demo-portal (docs index)' }, signal: AbortSignal.timeout(20000) })
      if (r.ok) return r.text()
      if (r.status < 500 && r.status !== 429) throw new Error(`HTTP ${r.status}`)
      last = new Error(`HTTP ${r.status}`)
    } catch (e) { last = e }
    await new Promise((res) => setTimeout(res, 500 * (i + 1) ** 2))
  }
  throw last
}

/** `- [Title](https://docs.portkey.ai/docs/aigw/x.md): description` rows, with the heading they sit under. */
export function parseIndex(md) {
  const rows = []
  const trail = []
  for (const line of md.split('\n')) {
    const h = line.match(/^(#{2,5})\s+(.*)$/)
    if (h) { trail[h[1].length - 2] = h[2].trim(); trail.length = h[1].length - 1; continue }
    const m = line.match(/^- \[([^\]]+)\]\((https:\/\/(?:docs\.)?portkey\.ai\/docs\/([^)]+?))(?:\.md)?\)(?::\s*(.*))?$/)
    if (!m || m[3].startsWith('_llms/')) continue
    rows.push({
      title: m[1].trim(),
      path: `/docs/${m[3].replace(/\.md$/, '')}`,
      section: trail.filter(Boolean).filter((s) => !/^(Prisma AIRS|Docs|Integrations)$/.test(s)).join(' › ') || 'Docs',
      desc: (m[4] || '').trim(),
    })
  }
  return rows
}

/** Strip the llms preamble and MDX chrome; keep prose, lists, tables and code. */
function clean(md) {
  return md
    .replace(/^> ## Documentation Index[\s\S]*?\n\n/, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<\/?(Card|CardGroup|Frame|Steps|Step|Tabs|Tab|Accordion|AccordionGroup|Note|Info|Tip|Warning|Check|Expandable|ResponseField|ParamField|CodeGroup|Columns|Update|Icon|Tooltip)\b[^>]*>/g, '')
    .replace(/\\([_*[\]()#|<>`])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Ranking weights by page kind. The deprecated Virtual Keys pages duplicate the
// Model Catalog ones, and ~25 templated MCP-server integration pages would
// otherwise crowd the product pages out of any MCP question.
function weightOf(p) {
  if (/\/virtual-keys(\/|$)/.test(p)) return 0.6
  if (/^\/docs\/aigw\/integrations\/mcp-servers\//.test(p)) return 0.65
  // Every integration page repeats "Using configs", "Fallbacks", "Guardrails"…
  // sections; a product page on the same topic should win a general question.
  if (/^\/docs\/aigw\/integrations\//.test(p) && !/^\/docs\/aigw\/integrations\/guardrails\//.test(p)) return 0.8
  return 1
}

const slug = (s) => s.toLowerCase().replace(/`/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')

/** Heading-sized passages; a long section splits at paragraph breaks. */
function passagesOf(pageIdx, md) {
  const out = []
  let heading = null
  let buf = []
  let fence = false
  const flush = () => {
    const text = buf.join('\n').trim()
    buf = []
    if (!text) return
    const parts = []
    let cur = ''
    for (const para of text.split(/\n{2,}/)) {
      if ((cur + '\n\n' + para).length > MAX_PASSAGE && cur) { parts.push(cur); cur = para } else cur = cur ? `${cur}\n\n${para}` : para
    }
    if (cur) parts.push(cur)
    // "Related topics" / "Next steps" are link lists: they match every query and answer none.
    if (heading && /^(related( topics| resources| guides)?|next steps|see also|resources)$/i.test(heading)) return
    for (const p of parts) out.push({ page: pageIdx, heading, anchor: heading ? slug(heading) : null, text: p.slice(0, MAX_PASSAGE * 1.5) })
  }
  for (const line of md.split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence
    const h = !fence && line.match(/^#{1,3}\s+(.*)$/)
    if (h) { flush(); heading = h[1].replace(/`/g, '').trim(); continue }
    buf.push(line)
  }
  flush()
  return out
}

// ─── BM25 ────────────────────────────────────────────────────────────────────

const STOP = new Set('a an and are as at be by can do does for from has have how i if in into is it its of on or that the their then there these this to was what when where which who why will with you your'.split(' '))
// Plurals only — "fallback" must find the page titled "Fallbacks"; anything
// stronger (routing → rout) starts merging words that mean different things.
const stem = (w) => (w.length > 4 && /[a-z]$/.test(w)
  ? w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.endsWith('sses') ? w.slice(0, -2) : /[^su]s$/.test(w) ? w.slice(0, -1) : w
  : w)
export function tokens(s) {
  const out = []
  for (const w of String(s).toLowerCase().match(/[a-z0-9][a-z0-9_.\-/]*[a-z0-9]|[a-z0-9]/g) ?? []) {
    if (!STOP.has(w)) out.push(stem(w))
    if (/[-_./]/.test(w)) for (const p of w.split(/[-_./]+/)) if (p.length > 1 && !STOP.has(p)) out.push(stem(p))
  }
  return out
}

function buildIndex(passages, pages) {
  const postings = new Map() // term → [[passageIdx, tf], …]
  const lens = new Array(passages.length)
  passages.forEach((p, i) => {
    const pg = pages[p.page]
    // Title and heading count twice: a passage under "## Circuit breaker" is about circuit breakers.
    const toks = [...tokens(p.text), ...tokens(`${pg.title} ${p.heading ?? ''}`), ...tokens(`${pg.title} ${p.heading ?? ''}`)]
    lens[i] = toks.length
    const tf = new Map()
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1)
    for (const [t, n] of tf) { if (!postings.has(t)) postings.set(t, []); postings.get(t).push([i, n]) }
  })
  const avg = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length)
  const titles = pages.map((pg) => new Set(tokens(pg.title)))
  return { postings, lens, avg, n: passages.length, titles }
}

export function search(query, { k = 8, perPage = 2 } = {}) {
  if (!S.index) return []
  const { postings, lens, avg, n, titles } = S.index
  const scores = new Map()
  const idfs = new Map()
  for (const t of new Set(tokens(query))) {
    const list = postings.get(t)
    if (!list) continue
    const idf = Math.log(1 + (n - list.length + 0.5) / (list.length + 0.5))
    idfs.set(t, idf)
    for (const [i, tf] of list) {
      const s = idf * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (lens[i] / avg)))
      scores.set(i, (scores.get(i) ?? 0) + s)
    }
  }
  // A query word in the page's own title is the strongest signal there is:
  // "fallback" belongs to the page called Fallbacks before any page that mentions it.
  const titleBonus = (page) => { let b = 0; for (const [t, idf] of idfs) if (titles[page].has(t)) b += idf * 1.5; return b }
  const ranked = [...scores.entries()]
    .map(([i, sc]) => { const pg = S.passages[i].page; return [i, (sc + titleBonus(pg)) * S.weights[pg]] })
    .sort((a, b) => b[1] - a[1])
  const perPageSeen = new Map()
  const out = []
  for (const [i, score] of ranked) {
    const p = S.passages[i]
    const seen = perPageSeen.get(p.page) ?? 0
    if (seen >= perPage) continue
    perPageSeen.set(p.page, seen + 1)
    const pg = S.pages[p.page]
    out.push({
      title: pg.title, section: pg.section, desc: pg.desc, heading: p.heading,
      url: `${DOCS_ORIGIN}${pg.path}${p.anchor ? `#${p.anchor}` : ''}`, pageUrl: `${DOCS_ORIGIN}${pg.path}`,
      text: p.text, score: Math.round(score * 100) / 100, deprecated: /\/virtual-keys(\/|$)/.test(pg.path),
    })
    if (out.length >= k) break
  }
  return out
}

// ─── building and loading ────────────────────────────────────────────────────

function adopt({ pages, builtAt }) {
  const passages = []
  // clean() again: it is idempotent, and a cache written by an older build gets today's rules.
  pages.forEach((pg, i) => { for (const p of passagesOf(i, clean(pg.md))) passages.push(p) })
  S.pages = pages.map(({ md, ...meta }) => meta)
  S.weights = S.pages.map((pg) => weightOf(pg.path))
  S.passages = passages
  S.index = buildIndex(passages, S.pages)
  S.builtAt = builtAt
  S.state = 'ready'
}

async function build() {
  const rows = []
  const seen = new Set()
  for (const idx of INDEXES) {
    for (const r of parseIndex(await get(idx))) if (!seen.has(r.path)) { seen.add(r.path); rows.push(r) }
  }
  if (rows.length < 100) throw new Error(`only ${rows.length} pages in the indexes — the index format changed`)
  S.progress = { done: 0, total: rows.length }
  const pages = new Array(rows.length)
  let next = 0
  let failed = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < rows.length) {
      const i = next++
      try { pages[i] = { ...rows[i], md: clean(await get(`${DOCS_ORIGIN}${rows[i].path}.md`)) } } catch { failed++; pages[i] = null }
      S.progress.done++
    }
  }))
  const ok = pages.filter(Boolean)
  // A build that lost most pages is an outage, not a smaller doc set.
  if (ok.length < rows.length * 0.9) throw new Error(`${failed} of ${rows.length} pages did not answer`)
  const corpus = { builtAt: Date.now(), source: DOCS_ORIGIN, pages: ok }
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(CACHE_FILE, JSON.stringify(corpus))
  return corpus
}

/** Load from disk if present, and refresh in the background when stale (or `force`). Never rejects. */
export function ensureDocs({ force = false } = {}) {
  if (S.state === 'empty' && fs.existsSync(CACHE_FILE)) {
    try { adopt(JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))) } catch (e) { S.error = `cache unreadable: ${e.message}` }
  }
  const stale = !S.builtAt || Date.now() - S.builtAt > TTL_MS
  if ((stale || force) && !inflight) {
    if (S.state !== 'ready') S.state = 'building'
    inflight = build()
      .then((corpus) => { adopt(corpus); S.error = null; console.log(`[aigw-docs] ${S.pages.length} pages, ${S.passages.length} passages indexed`) })
      .catch((e) => { S.error = String(e?.message || e); if (S.state !== 'ready') S.state = 'empty'; console.warn(`[aigw-docs] refresh failed: ${S.error}`) })
      .finally(() => { inflight = null; S.progress = null })
  }
  return inflight ?? Promise.resolve()
}

export function docsStatus() {
  return {
    state: S.state, pages: S.pages.length, passages: S.passages.length,
    builtAt: S.builtAt ? new Date(S.builtAt).toISOString() : null,
    refreshing: !!inflight, progress: S.progress, error: S.error, source: DOCS_ORIGIN,
  }
}

export function docsCatalog() {
  return S.pages.map((p) => ({ title: p.title, section: p.section, desc: p.desc, url: `${DOCS_ORIGIN}${p.path}` }))
}
