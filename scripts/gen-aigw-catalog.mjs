#!/usr/bin/env node
/**
 * gen-aigw-catalog.mjs — writes src/views/developer-corner/guides/aigw-catalog.js,
 * the Developer Corner's catalog of every Prisma AIRS AI Gateway doc page.
 *
 *   node scripts/gen-aigw-catalog.mjs                 # refresh from the docs
 *   node scripts/gen-aigw-catalog.mjs --what <dir>    # also read <dir>/*-catalog.tsv
 *
 * Pages, titles and sections come from the official llms.txt indexes (via the
 * same corpus aigw-docs.js keeps in .cache/aigw-docs). The one-line "what it
 * is" per page comes, in order of preference, from: a TSV given with --what
 * (`path<TAB>title<TAB>what`, path after /docs/aigw), the catalog file this
 * script wrote last time (so curated lines survive a refresh), then the
 * index's own description, shortened.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ensureDocs, docsCatalog, docsStatus } from '../aigw-docs.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'src/views/developer-corner/guides/aigw-catalog.js')

// Display order and names. Keys are the first one or two segments of the index section.
const GROUPS = [
  ['Introduction', 'Start here', 'docs'], ['Docs', 'Start here', 'docs'],
  ['Product › AI Gateway', 'AI Gateway — routing, cache, reliability', 'product'],
  ['Product › MCP Gateway', 'MCP Gateway', 'product'],
  ['Product › Agent Gateway', 'Agent Gateway', 'product'],
  ['Product › Coding Agents', 'Coding agents', 'product'],
  ['Product › Policies & Profiles', 'Policies — budgets, rate limits, configs, guardrails', 'product'],
  ['Product › Security Keys', 'Security keys', 'product'],
  ['Product › Observability', 'Observability — logs, traces, OpenTelemetry', 'product'],
  ['Product › Catalogs', 'Model catalog', 'product'],
  ['Product › Administration', 'Administration — org, workspaces, access', 'product'],
  ['Self-Hosting › Self-Hosting', 'Self-hosting — hybrid deployments', 'ops'],
  ['Gateway APIs › API Reference', 'Inference API — basics', 'api'],
  ['Gateway APIs › Inference', 'Inference API — endpoints', 'api'],
  ['Admin APIs › API Reference', 'Admin API — basics', 'api'],
  ['Admin APIs › Gateway Configuration', 'Admin API — configs and guardrails', 'api'],
  ['Admin APIs › Providers and Credentials', 'Admin API — integrations, providers, secrets', 'api'],
  ['Admin APIs › MCP', 'Admin API — MCP integrations and servers', 'api'],
  ['Admin APIs › Administration', 'Admin API — keys, deployments, policies, org guardrails', 'api'],
  ['Admin APIs › Observability', 'Admin API — analytics, feedback, logs', 'api'],
  ['LLM Integrations', 'Model providers', 'integrations'],
  ['Guardrails', 'Partner guardrails', 'integrations'],
  ['Agents', 'Agent frameworks', 'integrations'],
  ['Libraries', 'Libraries and SDKs', 'integrations'],
  ['AI Apps', 'AI apps — Claude Code, Open WebUI, …', 'integrations'],
  ['MCP Clients', 'MCP clients', 'integrations'],
  ['MCP Servers', 'MCP servers', 'integrations'],
  ['Tracing Providers', 'Tracing providers', 'integrations'],
  ['Vector Databases', 'Vector databases', 'integrations'],
  ['Plugins', 'Plugins', 'integrations'],
  ['Cloud Platforms', 'Cloud platforms', 'integrations'],
  ['Changelog › Changelog', 'Changelog', 'docs'],
  ['Help Center', 'Help center', 'docs'],
]

const args = process.argv.slice(2)
const whatDir = args.includes('--what') ? args[args.indexOf('--what') + 1] : null

const what = new Map()
// 1. Last run's curated lines.
if (fs.existsSync(OUT)) {
  const prev = fs.readFileSync(OUT, 'utf8').match(/export const AIGW_CATALOG = (\{[\s\S]*\})\n/)
  if (prev) for (const g of JSON.parse(prev[1]).groups) for (const [, p, w] of g.pages) if (w) what.set(p, w)
}
// 2. Fresh TSVs win.
if (whatDir) {
  for (const f of fs.readdirSync(whatDir).filter((x) => x.endsWith('-catalog.tsv'))) {
    for (const line of fs.readFileSync(path.join(whatDir, f), 'utf8').split('\n').slice(1)) {
      const [p, , w] = line.split('\t')
      if (!p || !w) continue
      const key = p.startsWith('http') ? p.replace(/^https:\/\/(docs\.)?portkey\.ai\/docs\/aigw/, '') : p
      what.set(key.replace(/\.md$/, ''), w.trim())
    }
  }
}

await ensureDocs()
const status = docsStatus()
if (status.state !== 'ready') throw new Error(`docs corpus not ready: ${status.error ?? status.state}`)

const shorten = (s) => { const t = s.replace(/\s+/g, ' ').replace(/…$/, '').trim(); return t.length > 150 ? `${t.slice(0, 147).replace(/\s+\S*$/, '')}…` : t }
const groups = new Map(GROUPS.map(([key, title, area]) => [title, { title, area, pages: [] }]))
const other = { title: 'Other pages', area: 'docs', pages: [] }
for (const p of docsCatalog()) {
  const segs = p.section.split(' › ')
  const rel = p.url.replace(/^https:\/\/portkey\.ai\/docs\/aigw/, '').replace(/^https:\/\/portkey\.ai/, '')
  const match = GROUPS.find(([key]) => key === segs.slice(0, 2).join(' › ')) ?? GROUPS.find(([key]) => key === segs[0])
  const g = match ? groups.get(match[1]) : other
  const sub = segs.slice(match ? match[0].split(' › ').length : 0).join(' › ')
  g.pages.push([p.title, rel, what.get(rel) ?? (p.desc ? shorten(p.desc) : ''), sub])
}
const out = [...groups.values(), other].filter((g) => g.pages.length)
const total = out.reduce((n, g) => n + g.pages.length, 0)
const catalog = { source: 'https://portkey.ai/docs/aigw', generatedAt: new Date().toISOString().slice(0, 10), pages: total, groups: out }

fs.writeFileSync(OUT, `/**
 * Every Prisma AIRS AI Gateway doc page, grouped. Generated by
 * scripts/gen-aigw-catalog.mjs from the official llms.txt indexes — do not edit
 * by hand; re-run the script (it keeps the one-line descriptions).
 * pages: [title, path (under /docs/aigw unless it starts with /docs), what, subsection]
 */
export const AIGW_CATALOG = ${JSON.stringify(catalog)}
`)
const missing = out.flatMap((g) => g.pages).filter((p) => !p[2]).length
console.log(`aigw-catalog.js: ${total} pages in ${out.length} groups · ${missing} without a description · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`)
process.exit(0)
