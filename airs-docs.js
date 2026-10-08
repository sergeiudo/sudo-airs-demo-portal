/**
 * airs-docs.js — the Prisma AIRS documentation, held locally so "Ask AIRS" can
 * search it and answer from it on every pillar.
 *
 * Collections (fetched and parsed by airs-docs-worker.js in a child process):
 *   aigw        AI Gateway developer docs (portkey.ai llms.txt, ~600 pages)
 *   pdf:*       the admin guides — AI Runtime Security, AI Red Teaming, AI Supply
 *               Chain Security, AI Agent Identity, AI Gateway (SCM)
 *   pandev      the Prisma AIRS API pages on pan.dev
 *   specs       the OpenAPI specs behind them (one page per endpoint and schema)
 *   releases    the release notes the server already scrapes (set in-process)
 *
 * Each page is split at its headings into passages and indexed with BM25
 * (plural folding, a title bonus, per-product boosts at query time). Every
 * collection has its own cache file in .cache/airs-docs (gitignored), its own
 * refresh interval, and keeps its last good copy when a refresh fails.
 */
import fs from 'fs'
import path from 'path'
import { fork } from 'child_process'
import { fileURLToPath } from 'url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(HERE, '.cache', 'airs-docs')
const WORKER = path.join(HERE, 'airs-docs-worker.js')
const DAY = 24 * 60 * 60 * 1000
const MAX_PASSAGE = 1800

export const COLLECTIONS = [
  { id: 'aigw', label: 'AI Gateway developer docs', product: 'gateway', ttl: DAY },
  { id: 'pdf:runtime', label: 'AI Runtime Security guide', product: 'runtime', ttl: DAY },
  { id: 'pdf:redteam', label: 'AI Red Teaming guide', product: 'redteam', ttl: DAY },
  { id: 'pdf:supply', label: 'AI Supply Chain Security guide', product: 'supply', ttl: DAY },
  { id: 'pdf:agents', label: 'AI Agent Identity guide', product: 'agents', ttl: DAY },
  { id: 'pdf:gateway', label: 'AI Gateway admin guide (SCM)', product: 'gateway', ttl: DAY },
  { id: 'pandev', label: 'pan.dev API reference', product: 'runtime', ttl: DAY },
  { id: 'specs', label: 'Prisma AIRS OpenAPI specs', product: 'runtime', ttl: DAY },
  // A community site, not official docs — indexed because it carries field-tested procedures.
  { id: 'impl', label: 'PAN implementation guides (community)', product: 'runtime', ttl: DAY },
]
const BY_ID = Object.fromEntries(COLLECTIONS.map((c) => [c.id, c]))

const S = {
  docs: new Map(),   // collection id → { builtAt, checkedAt, meta, pages }
  pages: [],         // flat: { collection, product, title, section, desc, url }
  weights: [],
  passages: [],      // { page, heading, anchor, text }
  index: null,
  progress: {},      // collection id → { done, total } while building
  errors: {},        // collection id → last refresh error
  startedAt: Date.now(),
}
let inflight = null
let urlIndex = new Map() // page url → { collection, i } for readPage

// ─── text → passages ─────────────────────────────────────────────────────────

function clean(md) {
  return String(md ?? '')
    .replace(/^> ## Documentation Index[\s\S]*?\n\n/, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<\/?(Card|CardGroup|Frame|Steps|Step|Tabs|Tab|Accordion|AccordionGroup|Note|Info|Tip|Warning|Check|Expandable|ResponseField|ParamField|CodeGroup|Columns|Update|Icon|Tooltip)\b[^>]*>/g, '')
    .replace(/\\([_*[\]()#|<>`])/g, '$1')
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const slug = (s) => s.toLowerCase().replace(/`/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')

/** Heading-sized passages; a long section splits at paragraph breaks. */
function passagesOf(pageIdx, md, startHeading, anchors) {
  const out = []
  let heading = startHeading ?? null
  let buf = []
  let fence = false
  const flush = () => {
    const text = buf.join('\n').trim()
    buf = []
    if (!text) return
    // "Related topics" / "Next steps" are link lists: they match every query and answer none.
    if (heading && /^(related( topics| resources| guides)?|next steps|see also|resources)$/i.test(heading)) return
    const parts = []
    let cur = ''
    for (const para of text.split(/\n{2,}/)) {
      if ((cur + '\n\n' + para).length > MAX_PASSAGE && cur) { parts.push(cur); cur = para } else cur = cur ? `${cur}\n\n${para}` : para
    }
    if (cur) parts.push(cur)
    for (const p of parts) out.push({ page: pageIdx, heading, anchor: anchors && heading && heading !== startHeading ? slug(heading) : null, text: p.slice(0, MAX_PASSAGE * 1.5) })
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
  // camelCase splits first: "ScanRequest" must meet "scan request".
  for (const w of String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().match(/[a-z0-9][a-z0-9_.\-/]*[a-z0-9]|[a-z0-9]/g) ?? []) {
    if (!STOP.has(w)) out.push(stem(w))
    if (/[-_./]/.test(w)) for (const p of w.split(/[-_./]+/)) if (p.length > 1 && !STOP.has(p)) out.push(stem(p))
  }
  return out
}

// Ranking weights by page kind. Deprecated Virtual Keys pages duplicate the
// Model Catalog ones; ~25 templated MCP-server pages and every other
// integration page repeat "Using configs / Fallbacks / Guardrails" sections.
function weightOf(pg) {
  if (pg.collection === 'impl') return 0.9 // official docs win a tie
  if (pg.collection !== 'aigw') return 1
  if (/\/virtual-keys(\/|$)/.test(pg.url)) return 0.6
  if (/\/docs\/aigw\/integrations\/mcp-servers\//.test(pg.url)) return 0.65
  if (/\/docs\/aigw\/integrations\//.test(pg.url) && !/\/integrations\/guardrails\//.test(pg.url)) return 0.8
  return 1
}

function rebuild() {
  const pages = []
  const passages = []
  for (const c of COLLECTIONS.map((x) => x.id).concat('releases')) {
    const doc = S.docs.get(c)
    if (!doc) continue
    for (const pg of doc.pages) {
      const i = pages.length
      pages.push({ collection: c, product: pg.product ?? BY_ID[c]?.product ?? 'runtime', title: pg.title, section: pg.section, desc: pg.desc ?? '', url: pg.url, heading: pg.heading ?? null })
      for (const p of passagesOf(i, clean(pg.md), pg.heading, c === 'aigw')) passages.push(p)
    }
  }
  const postings = new Map()
  const lens = new Array(passages.length)
  passages.forEach((p, i) => {
    const pg = pages[p.page]
    const label = `${pg.title} ${p.heading ?? ''}`
    // Title and heading count twice: a passage under "## Circuit breaker" is about circuit breakers.
    const toks = [...tokens(p.text), ...tokens(label), ...tokens(label)]
    lens[i] = toks.length
    const tf = new Map()
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1)
    for (const [t, n] of tf) { if (!postings.has(t)) postings.set(t, []); postings.get(t).push([i, n]) }
  })
  const avg = lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length)
  const idx = new Map()
  for (const c of COLLECTIONS.map((x) => x.id).concat('releases')) (S.docs.get(c)?.pages ?? []).forEach((pg, i) => idx.set(pg.url, { collection: c, i }))
  urlIndex = idx
  S.pages = pages
  S.passages = passages
  S.weights = pages.map(weightOf)
  S.index = { postings, lens, avg, n: passages.length, titles: pages.map((pg) => new Set(tokens(`${pg.title} ${pg.heading ?? ''}`))) }
}

/**
 * Top passages for a question. `boost` multiplies scores by product (the
 * pillar the reader is on); `perPage` caps passages per page so one long
 * page cannot fill the answer.
 */
// Shorthand people type → the words the docs use. Applied to queries only.
const ALIASES = [
  [/\bai[- ]?gw\b|\baigw\b/gi, 'AI Gateway'],
  [/\bvertex ?ai\b|\bvertexai\b/gi, 'Vertex AI'],
  [/\bscm\b/gi, 'Strata Cloud Manager SCM'],
  [/\bairs\b/gi, 'AIRS'],
  [/\bmcp gw\b/gi, 'MCP Gateway'],
  [/\bred[- ]?team(ing)?\b/gi, 'Red Teaming'],
  [/\bk8s\b/gi, 'Kubernetes'],
  [/\bhf\b/gi, 'Hugging Face'],
  [/\bdlp\b/gi, 'DLP data loss prevention sensitive data'],
]
export const expandQuery = (q) => ALIASES.reduce((s, [re, to]) => s.replace(re, to), String(q))

// "What's new / latest / released" wants the release notes, whatever else it names.
const WANTS_NEW = /\b(new|latest|recent(ly)?|release[ds]?|changelog|changed|added|since|this (month|week|year)|announce)/i

export function search(query, { k = 8, perPage = 2, perSection = 2, perCollection = {}, boost = {}, collectionBoost = {} } = {}) {
  if (!S.index) return []
  if (WANTS_NEW.test(query) && collectionBoost.releases == null) collectionBoost = { ...collectionBoost, releases: 2.2 }
  const { postings, lens, avg, n, titles } = S.index
  const scores = new Map()
  const idfs = new Map()
  for (const t of new Set(tokens(expandQuery(query)))) {
    const list = postings.get(t)
    if (!list) continue
    const idf = Math.log(1 + (n - list.length + 0.5) / (list.length + 0.5))
    idfs.set(t, idf)
    for (const [i, tf] of list) scores.set(i, (scores.get(i) ?? 0) + idf * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (lens[i] / avg))))
  }
  // A query word in the page's own title is the strongest signal there is.
  const titleBonus = (page) => { let b = 0; for (const [t, idf] of idfs) if (titles[page].has(t)) b += idf * 1.5; return b }
  const ranked = [...scores.entries()]
    .map(([i, sc]) => { const page = S.passages[i].page; const pg = S.pages[page]; return [i, (sc + titleBonus(page)) * S.weights[page] * (boost[pg.product] ?? 1) * (collectionBoost[pg.collection] ?? 1)] })
    .sort((a, b) => b[1] - a[1])
  const seen = new Map()
  const sections = new Map()
  const fromCollection = new Map()
  const out = []
  for (const [i, score] of ranked) {
    const p = S.passages[i]
    const pg = S.pages[p.page]
    const c = seen.get(p.page) ?? 0
    if (c >= perPage) continue
    // A PDF section spans several pages under one heading; keep the answer's sources varied.
    const sec = `${pg.collection}|${pg.title}|${p.heading ?? ''}`
    if ((sections.get(sec) ?? 0) >= perSection) continue
    // A cap per collection keeps room for the product docs when a boost
    // (portal, release notes) would otherwise fill every slot.
    if (perCollection[pg.collection] != null && (fromCollection.get(pg.collection) ?? 0) >= perCollection[pg.collection]) continue
    seen.set(p.page, c + 1)
    sections.set(sec, (sections.get(sec) ?? 0) + 1)
    fromCollection.set(pg.collection, (fromCollection.get(pg.collection) ?? 0) + 1)
    out.push({
      collection: pg.collection, collectionLabel: BY_ID[pg.collection]?.label ?? 'Release notes', product: pg.product,
      title: pg.title, section: pg.section, heading: p.heading, desc: pg.desc,
      url: p.anchor ? `${pg.url}#${p.anchor}` : pg.url, pageUrl: pg.url,
      text: p.text, score: Math.round(score * 100) / 100, deprecated: /\/virtual-keys(\/|$)/.test(pg.url),
    })
    if (out.length >= k) break
  }
  return out
}

// ─── loading and refreshing ──────────────────────────────────────────────────

function loadFromDisk(id) {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, `${id.replace(':', '-')}.json`), 'utf8'))
    if (doc?.pages?.length) { S.docs.set(id, doc); return true }
  } catch { /* not built yet */ }
  return false
}

function runWorker(ids) {
  return new Promise((resolve) => {
    const child = fork(WORKER, [CACHE_DIR, ...ids], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] })
    let stderr = ''
    child.stderr?.on('data', (d) => { stderr += d })
    child.on('message', (m) => {
      if (m.type === 'progress') S.progress[m.id] = { done: m.done, total: m.total }
      if (m.type === 'done') { delete S.progress[m.id]; delete S.errors[m.id]; loadFromDisk(m.id); console.log(`[airs-docs] ${m.id}: ${m.pages} pages${m.unchanged ? ' (unchanged)' : ''} in ${m.ms} ms`) }
      if (m.type === 'failed') { delete S.progress[m.id]; S.errors[m.id] = m.error; console.warn(`[airs-docs] ${m.id} failed: ${m.error}`) }
    })
    child.on('exit', (code) => { if (code && stderr) console.warn(`[airs-docs] worker exited ${code}: ${stderr.slice(-400)}`); resolve() })
  })
}

/** Load what is on disk; refresh stale collections in the background (or `force`). Never rejects. */
export function ensureDocs({ force = false } = {}) {
  if (!S.index) {
    let any = false
    for (const c of COLLECTIONS) any = loadFromDisk(c.id) || any
    if (any) rebuild()
  }
  if (inflight) return inflight
  const now = Date.now()
  const stale = COLLECTIONS.filter((c) => {
    if (force) return true
    const d = S.docs.get(c.id)
    return !d || now - (d.checkedAt ?? d.builtAt ?? 0) > c.ttl
  }).map((c) => c.id)
  if (!stale.length) return Promise.resolve()
  inflight = runWorker(stale).then(() => rebuild()).catch((e) => console.warn('[airs-docs]', e.message)).finally(() => { inflight = null })
  return inflight
}

/**
 * The first passages of a page found by exact title within a collection (and
 * optionally a section) — used to pull the schemas an API operation references.
 */
export function lookup(collection, title, section, max = 1) {
  if (!S.index) return []
  const i = S.pages.findIndex((pg) => pg.collection === collection && pg.title === title && (!section || pg.section === section))
  if (i < 0) return []
  const pg = S.pages[i]
  return S.passages.filter((p) => p.page === i).slice(0, max).map((p) => ({
    collection, collectionLabel: BY_ID[collection]?.label ?? collection, product: pg.product, title: pg.title, section: pg.section,
    heading: p.heading, desc: pg.desc, url: pg.url, pageUrl: pg.url, text: p.text, score: 0, deprecated: false,
  }))
}

/**
 * The full text of an indexed page, for the sidekick's read_page tool. A PDF
 * page continues into the following pages of the same section, up to max.
 */
export function readPage(url, max = 9000) {
  const at = urlIndex.get(url) ?? urlIndex.get(String(url).replace(/#(?!page=).*$/, ''))
  if (!at) return null
  const pages = S.docs.get(at.collection).pages
  const pg = pages[at.i]
  let text = clean(pg.md)
  if (at.collection.startsWith('pdf:')) {
    for (let j = at.i + 1; j < pages.length && text.length < max && pages[j].heading === pg.heading; j++) text += `\n\n${clean(pages[j].md)}`
  }
  return { collection: at.collection, label: BY_ID[at.collection]?.label ?? 'Release notes', product: pg.product ?? BY_ID[at.collection]?.product, title: pg.title, section: pg.section, heading: pg.heading ?? null, url: pg.url, text: text.slice(0, max), truncated: text.length > max }
}

/** The release notes, set in-process by server.js whenever it scrapes them. */
export function setReleasePages(pages) {
  S.docs.set('releases', { builtAt: Date.now(), pages })
  if (S.index) rebuild()
}

export function docsStatus() {
  const collections = COLLECTIONS.map((c) => {
    const d = S.docs.get(c.id)
    return { id: c.id, label: c.label, pages: d?.pages.length ?? 0, builtAt: d?.builtAt ? new Date(d.builtAt).toISOString() : null, progress: S.progress[c.id] ?? null, error: S.errors[c.id] ?? null }
  })
  const rel = S.docs.get('releases')
  if (rel) collections.push({ id: 'releases', label: 'Release notes', pages: rel.pages.length, builtAt: new Date(rel.builtAt).toISOString(), progress: null, error: null })
  const ready = !!S.index && S.passages.length > 0
  return {
    state: ready ? 'ready' : inflight ? 'building' : 'empty',
    pages: S.pages.length, passages: S.passages.length, refreshing: !!inflight,
    builtAt: collections.map((c) => c.builtAt).filter(Boolean).sort().pop() ?? null,
    collections,
  }
}

/** Pages of one collection — the AI Gateway catalog generator reads 'aigw'. */
export function docsCatalog(collection = 'aigw') {
  return (S.docs.get(collection)?.pages ?? []).map((p) => ({ title: p.title, section: p.section, desc: p.desc ?? '', url: p.url }))
}
