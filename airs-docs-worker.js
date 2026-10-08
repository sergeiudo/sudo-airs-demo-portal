/**
 * airs-docs-worker.js — fetches and parses the Prisma AIRS documentation for
 * airs-docs.js, in a child process (fork), so a 74 MB PDF or 800 page fetches
 * never stall the Express process that serves every pillar.
 *
 * Usage (from airs-docs.js): fork(this file, [cacheDir, ...collectionIds]).
 * Each collection is written to <cacheDir>/<id>.json as
 *   { id, builtAt, meta, pages: [{ title, section, heading?, url, desc?, md }] }
 * and a collection that fails keeps its previous file. Progress and results go
 * back over IPC: { type: 'progress' | 'done' | 'failed', id, … }.
 *
 * Sources
 *   aigw      AI Gateway developer docs — the official llms.txt indexes, every page as .md
 *   pdf:*     the Prisma AIRS admin guides on docs.paloaltonetworks.com — one PDF each,
 *             re-downloaded only when Last-Modified changes; one page per PDF page,
 *             titled from the PDF's bookmark outline, cited as …pdf#page=N
 *   pandev    the Prisma AIRS API pages on pan.dev (sitemap → HTML → text) — prose pages
 *             read well; endpoint pages render their schemas in the browser, so…
 *   impl      the Palo Alto Networks Implementation Guides (jollymahn.github.io, a
 *             community site — not official docs): the AIRS, AI Gateway, integration,
 *             Model Security, Red Teaming, lab and requirements pages, from its repo
 *   specs     …the same APIs' OpenAPI specs (pan.dev's GitHub repo), split by
 *             indentation into one page per endpoint and per schema — no YAML parser
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { htmlToMd, titleOf } from './airs-text.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const [cacheDir, ...ids] = process.argv.slice(2)
const say = (m) => process.send?.(m)

export const PDFS = {
  'pdf:runtime': { file: 'prisma-airs-ai-runtime-security.pdf', label: 'AI Runtime Security guide', product: 'runtime' },
  'pdf:redteam': { file: 'ai-red-teaming.pdf', label: 'AI Red Teaming guide', product: 'redteam' },
  'pdf:supply': { file: 'ai-supply-chain-security.pdf', label: 'AI Supply Chain Security guide', product: 'supply' },
  'pdf:agents': { file: 'ai-agent-identity.pdf', label: 'AI Agent Identity guide', product: 'agents' },
  'pdf:gateway': { file: 'ai-gateway.pdf', label: 'AI Gateway admin guide (SCM)', product: 'gateway' },
}
const PDF_BASE = 'https://docs.paloaltonetworks.com/content/dam/techdocs/en_US/pdf/prisma-airs'
const DOCS_ORIGIN = 'https://portkey.ai'
const AIGW_INDEXES = [
  `${DOCS_ORIGIN}/docs/_llms/prisma-airs/docs.md`,
  `${DOCS_ORIGIN}/docs/_llms/prisma-airs/integrations.md`,
  `${DOCS_ORIGIN}/docs/_llms/prisma-airs.md`,
]
const PANDEV_PRODUCTS = [
  [/^https:\/\/pan\.dev\/prisma-airs-redteam\//, 'redteam', 'AI Red Teaming API'],
  [/^https:\/\/pan\.dev\/prisma-airs-model-security\//, 'supply', 'AI Model Security API'],
  [/^https:\/\/pan\.dev\/prisma-airs\//, 'runtime', 'AI Runtime API'],
  [/^https:\/\/pan\.dev\/airs\//, 'runtime', 'pan.dev · Prisma AIRS'],
]

// ─── fetching ────────────────────────────────────────────────────────────────

async function get(url, { tries = 3, headers = {}, binary = false } = {}) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'sudo-airs-demo-portal (docs helper index)', ...headers }, signal: AbortSignal.timeout(binary ? 120000 : 25000) })
      if (r.status === 304) return { status: 304 }
      if (r.ok) return { status: 200, body: binary ? new Uint8Array(await r.arrayBuffer()) : await r.text(), lastModified: r.headers.get('last-modified') }
      if (r.status < 500 && r.status !== 429) throw new Error(`HTTP ${r.status}`)
      last = new Error(`HTTP ${r.status}`)
    } catch (e) { last = e }
    await new Promise((res) => setTimeout(res, 600 * (i + 1) ** 2))
  }
  throw last
}

async function pool(items, n, fn) {
  let next = 0
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; await fn(items[i], i) } }))
}

const readPrev = (id) => { try { return JSON.parse(fs.readFileSync(path.join(cacheDir, `${id.replace(':', '-')}.json`), 'utf8')) } catch { return null } }
const write = (id, data) => {
  fs.mkdirSync(cacheDir, { recursive: true })
  const file = path.join(cacheDir, `${id.replace(':', '-')}.json`)
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data))
  fs.renameSync(`${file}.tmp`, file)
}

// ─── AI Gateway docs (llms.txt) ──────────────────────────────────────────────

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

async function buildAigw(id) {
  const rows = []
  const seen = new Set()
  for (const idx of AIGW_INDEXES) for (const r of parseIndex((await get(idx)).body)) if (!seen.has(r.path)) { seen.add(r.path); rows.push(r) }
  if (rows.length < 100) throw new Error(`only ${rows.length} pages in the indexes — the format changed`)
  const pages = new Array(rows.length)
  let done = 0
  let failed = 0
  await pool(rows, 8, async (r, i) => {
    try { pages[i] = { title: r.title, section: r.section, desc: r.desc, url: `${DOCS_ORIGIN}${r.path}`, md: (await get(`${DOCS_ORIGIN}${r.path}.md`)).body } } catch { failed++ }
    if (++done % 50 === 0) say({ type: 'progress', id, done, total: rows.length })
  })
  const ok = pages.filter(Boolean)
  if (ok.length < rows.length * 0.9) throw new Error(`${failed} of ${rows.length} pages did not answer`)
  return { pages: ok, meta: { source: DOCS_ORIGIN } }
}

// ─── the admin-guide PDFs ────────────────────────────────────────────────────

async function buildPdf(id) {
  const spec = PDFS[id]
  const url = `${PDF_BASE}/${spec.file}`
  const prev = readPrev(id)
  const res = await get(url, { binary: true, headers: prev?.meta?.lastModified ? { 'If-Modified-Since': prev.meta.lastModified } : {} })
  if (res.status === 304 && prev) return { unchanged: true, pages: prev.pages, meta: prev.meta }

  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(res.body)
  const { totalPages, text } = await extractText(pdf, { mergePages: false })

  // The bookmark outline → (page, depth, title), so each page knows its section.
  const marks = []
  const walk = async (items, depth) => {
    for (const it of items ?? []) {
      try {
        const dest = typeof it.dest === 'string' ? await pdf.getDestination(it.dest) : it.dest
        if (dest?.[0]) marks.push({ page: (await pdf.getPageIndex(dest[0])) + 1, depth, title: String(it.title).trim() })
      } catch { /* unresolvable bookmark */ }
      await walk(it.items, depth + 1)
    }
  }
  await walk(await pdf.getOutline(), 0)
  marks.sort((a, b) => a.page - b.page || a.depth - b.depth)

  const footer = new RegExp(`^.*\\b\\d+\\s*©\\s*\\d{4}\\s+Palo Alto Networks,? Inc\\.?\\s*$`, 'gm')
  const pages = []
  const trail = []
  let m = 0
  for (let p = 1; p <= totalPages; p++) {
    while (m < marks.length && marks[m].page <= p) { const k = marks[m]; trail[k.depth] = k.title; trail.length = k.depth + 1; m++ }
    const md = String(text[p - 1] ?? '').replace(footer, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (md.length < 80) continue // title pages, blank pages, the table of contents' tail
    const path = trail.slice(1).filter(Boolean) // trail[0] is the guide's own title
    pages.push({ title: spec.label, section: path.slice(0, -1).join(' › ') || spec.label, heading: path[path.length - 1] ?? spec.label, url: `${url}#page=${p}`, md, page: p })
  }
  if (pages.length < 10) throw new Error(`only ${pages.length} pages of text — not a guide PDF?`)
  return { pages, meta: { url, lastModified: res.lastModified, totalPages, sections: marks.length } }
}

// ─── pan.dev ─────────────────────────────────────────────────────────────────

async function buildPandev(id) {
  const xml = (await get('https://pan.dev/sitemap.xml')).body
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => PANDEV_PRODUCTS.some(([re]) => re.test(u)))
  if (urls.length < 50) throw new Error(`only ${urls.length} Prisma AIRS pages in the pan.dev sitemap`)
  const pages = []
  let done = 0
  await pool(urls, 6, async (u) => {
    try {
      const html = (await get(u)).body
      const title = titleOf(html) || u
      const [, product, label] = PANDEV_PRODUCTS.find(([re]) => re.test(u))
      const md = htmlToMd(html)
      if (md.length > 60) pages.push({ title, section: label, url: u, md, product })
    } catch { /* one page down is not a failed build */ }
    if (++done % 40 === 0) say({ type: 'progress', id, done, total: urls.length })
  })
  if (pages.length < urls.length * 0.8) throw new Error(`${urls.length - pages.length} of ${urls.length} pan.dev pages did not answer`)
  return { pages, meta: { source: 'https://pan.dev' } }
}

// ─── the OpenAPI specs behind pan.dev ────────────────────────────────────────

const SPEC_BASE = 'https://raw.githubusercontent.com/PaloAltoNetworks/pan.dev/master/openapi-specs'
const SPEC_VIEW = 'https://github.com/PaloAltoNetworks/pan.dev/blob/master/openapi-specs'
const SPECS = [
  ['prisma-airs/scan/scan-service_latest.yaml', 'runtime', 'AI Runtime API — scan'],
  ['prisma-airs/management/mgmt-service_latest.yaml', 'runtime', 'AI Runtime API — management'],
  ['prisma-airs-redteam/data-plane/dp-openapi.yaml', 'redteam', 'AI Red Teaming API — data plane'],
  ['prisma-airs-redteam/management/mp-openapi.yaml', 'redteam', 'AI Red Teaming API — management'],
  ['prisma-airs-redteam/network-broker/AIRS-Red-Teaming-Network-Broker.yaml', 'redteam', 'AI Red Teaming API — network broker'],
  ['prisma-airs-model-security/dataplane/data-plane.yml', 'supply', 'AI Model Security API — data plane'],
  ['prisma-airs-model-security/management/mgmt-plane.yml', 'supply', 'AI Model Security API — management'],
]

/** Lines under `key:` at `indent`, each child block (by its own indent) with its raw YAML. */
function yamlChildren(lines, start, indent) {
  const out = []
  let cur = null
  for (let i = start; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim() || l.trim().startsWith('#')) { if (cur) cur.body.push(l); continue }
    const ind = l.match(/^ */)[0].length
    if (ind < indent) break
    if (ind === indent && /^\s*['"]?[^\s'"][^:]*['"]?:\s*(\S.*)?$/.test(l)) {
      cur = { key: l.trim().replace(/:\s*.*$/, '').replace(/^['"]|['"]$/g, ''), line: i, body: [l] }
      out.push(cur)
    } else if (cur) cur.body.push(l)
  }
  return out
}

async function buildSpecs(id) {
  const pages = []
  for (const [file, product, label] of SPECS) {
    const text = (await get(`${SPEC_BASE}/${file}`)).body
    const lines = text.split('\n')
    const top = yamlChildren(lines, 0, 0)
    const dedent = (body) => { const n = Math.min(...body.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length)); return body.map((l) => l.slice(n)).join('\n').trim() }
    const paths = top.find((t) => t.key === 'paths')
    for (const p of paths ? yamlChildren(lines, paths.line + 1, 2) : []) {
      for (const m of yamlChildren(lines, p.line + 1, 4).filter((x) => /^(get|post|put|patch|delete)$/.test(x.key))) {
        const summary = m.body.find((l) => /^\s*summary:/.test(l))?.replace(/^\s*summary:\s*/, '').replace(/^['"]|['"]$/g, '') ?? ''
        pages.push({ title: `${m.key.toUpperCase()} ${p.key}${summary ? ` — ${summary}` : ''}`, section: label, heading: `${m.key.toUpperCase()} ${p.key}`, url: `${SPEC_VIEW}/${file}#L${m.line + 1}`, md: '```yaml\n' + dedent(m.body) + '\n```', product })
      }
    }
    const comps = top.find((t) => t.key === 'components')
    const schemas = comps ? yamlChildren(lines, comps.line + 1, 2).find((c) => c.key === 'schemas') : null
    for (const sc of schemas ? yamlChildren(lines, schemas.line + 1, 4) : []) {
      pages.push({ title: `Schema ${sc.key}`, section: label, heading: `Schema ${sc.key}`, url: `${SPEC_VIEW}/${file}#L${sc.line + 1}`, md: '```yaml\n' + dedent(sc.body) + '\n```', product })
    }
  }
  if (pages.length < 50) throw new Error(`only ${pages.length} operations and schemas parsed — the specs moved?`)
  return { pages, meta: { source: SPEC_VIEW } }
}

// ─── the community implementation guides ────────────────────────────────────

const IMPL_REPO = 'jollymahn/pan-implementation-guides'
const IMPL_SITE = 'https://jollymahn.github.io/pan-implementation-guides'
const IMPL_PRODUCT = [
  // The trd/ pages are left out on purpose: they carry a "Palo Alto Networks
  // Professional Services — Confidential" footer, public URL or not.
  [/^guides\/ai-gateway\//, 'gateway', 'AI Gateway'],
  [/^guides\/airs-model\/|^labs\/airs-mlops\//, 'supply', 'AI Model Security'],
  [/^guides\/airs-red\//, 'redteam', 'AI Red Teaming'],
  [/^guides\/airs-integrations\//, 'runtime', 'AIRS integrations'],
  [/^guides\/airs(-planner)?\//, 'runtime', 'Prisma AIRS platform'],
]

async function buildImpl(id) {
  const tree = JSON.parse((await get(`https://api.github.com/repos/${IMPL_REPO}/git/trees/main?recursive=1`)).body)
  const files = (tree.tree ?? []).map((x) => x.path).filter((p) => /\.(md|html)$/.test(p) && !/\/(es|pt)\//.test(p) && IMPL_PRODUCT.some(([re]) => re.test(p)) && !/SOURCES\.md$|diagrams\//.test(p))
  // A page published from markdown has both files; read the markdown.
  const md = new Set(files.filter((p) => p.endsWith('.md')).map((p) => p.slice(0, -3)))
  const pick = files.filter((p) => !(p.endsWith('.html') && md.has(p.slice(0, -5))))
  if (pick.length < 15) throw new Error(`only ${pick.length} AIRS pages in ${IMPL_REPO} — the layout changed`)
  const pages = []
  await pool(pick, 6, async (p) => {
    try {
      const raw = (await get(`https://raw.githubusercontent.com/${IMPL_REPO}/main/${p}`)).body
      const [, product, label] = IMPL_PRODUCT.find(([re]) => re.test(p))
      const text = p.endsWith('.md') ? raw.replace(/^---[\s\S]*?---\n/, '') : htmlToMd(raw)
      const title = (p.endsWith('.md') ? raw.match(/^#\s+(.+)$/m)?.[1] : titleOf(raw)) || p.split('/').pop().replace(/\.(md|html)$/, '')
      if (text.length > 200) pages.push({ title: title.trim(), section: `Implementation guides › ${label}`, url: `${IMPL_SITE}/${p.replace(/\.md$/, '.html')}`, md: text, product })
    } catch { /* one page down is not a failed build */ }
  })
  if (pages.length < pick.length * 0.8) throw new Error(`${pick.length - pages.length} of ${pick.length} pages did not answer`)
  return { pages, meta: { source: `${IMPL_SITE}/`, repo: IMPL_REPO } }
}

// ─── run ─────────────────────────────────────────────────────────────────────

const BUILDERS = { aigw: buildAigw, pandev: buildPandev, specs: buildSpecs, impl: buildImpl }
for (const id of ids) {
  const t0 = Date.now()
  try {
    const build = BUILDERS[id] ?? (PDFS[id] ? buildPdf : null)
    if (!build) throw new Error(`unknown collection ${id}`)
    const { pages, meta, unchanged } = await build(id)
    if (!unchanged) write(id, { id, builtAt: Date.now(), meta, pages })
    else write(id, { ...readPrev(id), checkedAt: Date.now() })
    say({ type: 'done', id, pages: pages.length, unchanged: !!unchanged, ms: Date.now() - t0 })
  } catch (e) {
    say({ type: 'failed', id, error: String(e?.message || e), ms: Date.now() - t0 })
  }
}
process.exit(0)
