/**
 * competitive-routes.js — live evidence for the AI-GW vs LiteLLM pillar (/api/competitive).
 *
 *   GET /litellm/record   LiteLLM's public security and release record, next to
 *                         the AIRS AI Gateway core's, read from OSV.dev, PyPI and
 *                         npm (public, keyless). Cached for six hours; ?refresh=1
 *                         re-reads, at most once a minute.
 *
 * A competitive brief goes stale the day it is printed: the one this pillar is
 * built on counted 27 LiteLLM CVEs on 2026-08-28, and OSV listed 39 six weeks
 * later. So the numbers on screen are read from the source, not typed in.
 * Read-only; no user input reaches a URL.
 */
import express from 'express'

const router = express.Router()

const TTL = 6 * 3600e3
const MIN_REFRESH = 60e3
const INCIDENT = '2026-03-24T10:39:00Z'          // the first malicious release, per the brief
const MALICIOUS = ['1.82.7', '1.82.8']
let cache = null      // { at, data }
let inflight = null

async function getJson(url, init = {}) {
  const r = await fetch(url, {
    ...init,
    headers: { 'User-Agent': 'sudo-airs-demo-portal (competitive record)', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(25000),
  })
  if (!r.ok) throw new Error(`${new URL(url).hostname} answered HTTP ${r.status}`)
  return r.json()
}

async function osvQuery(ecosystem, name) {
  const vulns = []
  let page
  for (let i = 0; i < 10; i++) {
    const d = await getJson('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package: { name, ecosystem }, ...(page ? { page_token: page } : {}) }),
    })
    vulns.push(...(d.vulns ?? []))
    page = d.next_page_token
    if (!page) break
  }
  return vulns
}

/**
 * OSV holds one record per database (GHSA, PYSEC, MAL…) for the same flaw,
 * linked through aliases. Merge them, so a CVE is counted once — the way the
 * brief counted — and keep the advisories that never got a CVE (the malware
 * releases among them) in a list of their own.
 */
function ledger(vulns) {
  const parent = new Map()
  const find = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x }
  const add = (x) => { if (!parent.has(x)) parent.set(x, x) }
  const union = (a, b) => { add(a); add(b); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra) }
  for (const v of vulns) { add(v.id); for (const a of v.aliases ?? []) union(v.id, a) }

  const groups = new Map()
  for (const v of vulns) {
    const root = find(v.id)
    const g = groups.get(root) ?? { ids: new Set(), records: [] }
    g.ids.add(v.id)
    for (const a of v.aliases ?? []) g.ids.add(a)
    g.records.push(v)
    groups.set(root, g)
  }

  return [...groups.values()].map((g) => {
    const ids = [...g.ids]
    const ghsa = g.records.find((r) => r.id.startsWith('GHSA-'))
    const lead = ghsa ?? g.records[0]
    const severity = (g.records.map((r) => r.database_specific?.severity).find(Boolean) ?? null)
    const published = g.records.map((r) => r.published).filter(Boolean).sort()[0] ?? null
    const summary = lead.summary || g.records.map((r) => r.summary).find(Boolean) || ''
    const fixed = lead.affected?.flatMap((a) => a.ranges ?? []).flatMap((r) => r.events ?? []).map((e) => e.fixed).filter(Boolean)[0] ?? null
    return {
      id: lead.id,
      cve: ids.filter((i) => i.startsWith('CVE-')).sort()[0] ?? null,
      ids: ids.sort(),
      severity: severity ? severity.toLowerCase() : null,
      published: published ? published.slice(0, 10) : null,
      summary: summary.replace(/\s+/g, ' ').trim().slice(0, 200),
      malware: g.records.some((r) => r.id.startsWith('MAL-')) || /malware|malicious/i.test(summary),
      withdrawn: g.records.every((r) => r.withdrawn),
      fixed,
      url: `https://osv.dev/vulnerability/${lead.id}`,
    }
  }).filter((x) => !x.withdrawn).sort((a, b) => String(b.published).localeCompare(String(a.published)))
}

function tally(items) {
  const cves = items.filter((x) => x.cve)
  const bySeverity = {}
  const byYear = {}
  for (const x of cves) {
    bySeverity[x.severity ?? 'unrated'] = (bySeverity[x.severity ?? 'unrated'] ?? 0) + 1
    const y = x.published?.slice(0, 4) ?? 'unknown'
    byYear[y] = (byYear[y] ?? 0) + 1
  }
  return { cves: cves.length, bySeverity, byYear, other: items.length - cves.length }
}

async function pypiRecord() {
  const d = await getJson('https://pypi.org/pypi/litellm/json')
  const releases = Object.entries(d.releases ?? {})
    .map(([v, files]) => ({ v, at: files?.length ? files.map((f) => f.upload_time_iso_8601).sort()[0] : null, yanked: files?.length ? files.every((f) => f.yanked) : false }))
    .filter((r) => r.at)
    .sort((a, b) => a.at.localeCompare(b.at))
  const now = Date.now()
  const within = (days) => releases.filter((r) => now - Date.parse(r.at) < days * 86400e3)
  const after = releases.find((r) => r.at > INCIDENT)
  return {
    latest: d.info?.version ?? null,
    license: d.info?.license_expression || d.info?.license || null,
    versions: releases.length,
    last30: within(30).length,
    releaseDays90: new Set(within(90).map((r) => r.at.slice(0, 10))).size,
    lastRelease: releases.at(-1) ?? null,
    malicious: MALICIOUS.map((v) => {
      const files = d.releases?.[v]
      return { version: v, state: files == null ? 'removed' : files.length === 0 ? 'no files' : files.every((f) => f.yanked) ? 'yanked' : 'present' }
    }),
    firstAfterIncident: after ? { version: after.v, at: after.at.slice(0, 10) } : null,
    url: 'https://pypi.org/project/litellm/#history',
  }
}

async function npmRecord() {
  const d = await getJson('https://registry.npmjs.org/@portkey-ai%2fgateway')
  const latest = d['dist-tags']?.latest
  const v = d.versions?.[latest] ?? {}
  const deps = Object.keys(v.dependencies ?? {}).sort()
  return {
    package: '@portkey-ai/gateway',
    latest,
    published: d.time?.[latest]?.slice(0, 10) ?? null,
    license: v.license ?? null,
    dependencies: deps,
    usesHono: deps.includes('hono'),
    url: 'https://www.npmjs.com/package/@portkey-ai/gateway',
  }
}

async function build() {
  const started = Date.now()
  const errors = {}
  const settle = async (key, fn) => { try { return await fn() } catch (e) { errors[key] = String(e?.message || e).slice(0, 160); return null } }
  const [litellmVulns, gatewayVulns, pypi, npm] = await Promise.all([
    settle('osvLitellm', () => osvQuery('PyPI', 'litellm')),
    settle('osvGateway', () => osvQuery('npm', '@portkey-ai/gateway')),
    settle('pypi', pypiRecord),
    settle('npm', npmRecord),
  ])
  const litellm = litellmVulns ? ledger(litellmVulns) : null
  const gateway = gatewayVulns ? ledger(gatewayVulns) : null
  return {
    fetchedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    litellm: litellm && { items: litellm, ...tally(litellm), osvRecords: litellmVulns.length, url: 'https://osv.dev/list?ecosystem=PyPI&q=litellm' },
    gateway: gateway && { items: gateway, ...tally(gateway), osvRecords: gatewayVulns.length, url: 'https://osv.dev/list?ecosystem=npm&q=%40portkey-ai%2Fgateway' },
    pypi,
    npm,
    errors,
  }
}

router.get('/litellm/record', async (req, res) => {
  const age = cache ? Date.now() - cache.at : Infinity
  const wantRefresh = req.query.refresh === '1' && age > MIN_REFRESH
  if (cache && age < TTL && !wantRefresh) return res.json({ ...cache.data, cached: true })
  try {
    inflight ??= build().finally(() => { inflight = null })
    const data = await inflight
    // A total failure keeps the last good record rather than replacing it.
    const anyData = data.litellm || data.pypi || data.npm || data.gateway
    if (anyData) cache = { at: Date.now(), data }
    res.json(anyData ? { ...data, cached: false } : { ...(cache?.data ?? {}), errors: data.errors, cached: !!cache, stale: !!cache })
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e).slice(0, 200) })
  }
})

export default router
