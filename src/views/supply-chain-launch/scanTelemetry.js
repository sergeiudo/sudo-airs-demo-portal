import { useCallback, useEffect, useState } from 'react'
import { groupViolations } from '../model-scanning-2027/scanModel'

/**
 * scanTelemetry.js — data for the scan telemetry drawer.
 *
 * The console's record already holds the scan and its violations (the rules
 * that FAILED). /api/supply-chain/scans/:uuid/telemetry adds what the record
 * cannot know: every rule's evaluation (including the ones that passed), each
 * rule's type and configured values, the scanned file tree, the model version
 * (Hugging Face commit, licence) and the security group. Folders of the tree
 * load one level at a time, as the drawer opens them.
 *
 * Both caches are per page load and keyed by scan uuid — a scan never changes.
 */

const bundles = new Map()   // uuid → telemetry bundle
const folders = new Map()   // `${uuid}|${path}|${skip}` → folder page

async function getJSON(url) {
  const r = await fetch(url)
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(d.error || `HTTP ${r.status}`), { status: r.status, configured: d.configured })
  return d
}

export function useScanTelemetry(uuid) {
  const [state, setState] = useState(() => ({ uuid, data: bundles.get(uuid) ?? null, error: null, loading: false }))

  const load = useCallback((force = false) => {
    if (!uuid) return
    if (!force && bundles.has(uuid)) { setState({ uuid, data: bundles.get(uuid), error: null, loading: false }); return }
    setState((s) => ({ uuid, data: s.uuid === uuid ? s.data : null, error: null, loading: true }))
    getJSON(`/api/supply-chain/scans/${uuid}/telemetry${force ? '?force=1' : ''}`)
      .then((d) => { bundles.set(uuid, d); setState({ uuid, data: d, error: null, loading: false }) })
      .catch((e) => setState({ uuid, data: null, error: { message: e.message, configured: e.configured }, loading: false }))
  }, [uuid])

  useEffect(() => { load() }, [load])
  // Stamped with its uuid: the render after a switch must not show the
  // previous scan's bundle.
  const current = state.uuid === uuid ? state : { uuid, data: null, error: null, loading: true }
  return { ...current, reload: () => load(true) }
}

/** The bundle already carries the root folder — no second request for it. */
export function seedFolder(uuid, page) {
  if (uuid && page && !folders.has(`${uuid}|${page.path}|0`)) folders.set(`${uuid}|${page.path}|0`, { ...page, skip: 0 })
}

/** One folder of the scanned tree, fetched when `open` first turns true. */
export function useFolder(uuid, path, open) {
  const [pages, setPages] = useState(() => (folders.has(`${uuid}|${path}|0`) ? [folders.get(`${uuid}|${path}|0`)] : []))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPage = useCallback((skip) => {
    const key = `${uuid}|${path}|${skip}`
    if (folders.has(key)) { setPages((p) => [...p.filter((x) => x.skip !== skip), folders.get(key)]); return }
    setLoading(true)
    setError(null)
    getJSON(`/api/supply-chain/scans/${uuid}/files?path=${encodeURIComponent(path)}&skip=${skip}`)
      .then((d) => { folders.set(key, d); setPages((p) => [...p.filter((x) => x.skip !== skip), d]) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [uuid, path])

  useEffect(() => { if (open && pages.length === 0) fetchPage(0) }, [open, pages.length, fetchPage])

  const items = [...pages].sort((a, b) => a.skip - b.skip).flatMap((p) => p.items)
  const total = pages[0]?.total ?? null
  return { items, total, loading, error, more: total != null && items.length < total ? () => fetchPage(items.length) : null }
}

/**
 * Every rule the group evaluated, joined three ways by rule-instance uuid:
 * the evaluation (result, count), the rule instance (type, configured values)
 * and the grouped violations (findings, threat code, remediation). Without
 * evaluations — the endpoint failed — it falls back to the failed rules the
 * record already has, and says so through `partial`.
 */
export function mergeRules({ evaluations, rules, violations }) {
  const groups = new Map(groupViolations(violations ?? []).map((g) => [g.key, g]))
  const inst = new Map((rules ?? []).map((r) => [r.uuid, r]))
  const fromGroup = (g) => ({
    id: g.key, name: g.name, description: g.description, result: 'FAILED', state: g.state, origin: g.origin,
    count: g.items.length, type: inst.get(g.key)?.type ?? null, fields: inst.get(g.key)?.fields ?? [],
    kind: g.kind, group: g, remediation: g.remediation ?? inst.get(g.key)?.remediation ?? null,
  })
  if (!evaluations?.length) return { partial: true, list: [...groups.values()].map(fromGroup) }

  const list = evaluations.map((e) => {
    const g = groups.get(e.rule_instance_uuid)
    const i = inst.get(e.rule_instance_uuid)
    if (g) return { ...fromGroup(g), result: e.result, count: e.violation_count ?? g.items.length, state: e.rule_instance_state ?? g.state }
    return {
      id: e.rule_instance_uuid, name: e.rule_name, description: e.rule_description, result: e.result,
      state: String(e.rule_instance_state ?? 'OTHER').toUpperCase(), origin: e.rule_origin, count: e.violation_count ?? 0,
      type: i?.type ?? null, fields: i?.fields ?? [], kind: i?.type === 'ARTIFACT' ? 'threat' : 'policy',
      group: null, remediation: i?.remediation ?? null,
    }
  })
  const rank = (r) => (r.result === 'FAILED' ? 0 : 10) + (r.kind === 'threat' ? 0 : 1)
  list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  return { partial: false, list }
}

/** "Tue, 28 Sep 2026" / "09:17:41.500" / zone — the runtime drawer's header format. */
export function stamp(iso) {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return null
  return {
    date: d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    time: `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ms: d.getTime(),
  }
}

export function relative(ms) {
  const s = Math.round(ms / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

export const msBetween = (a, b) => {
  const x = Date.parse(a), y = Date.parse(b)
  return Number.isFinite(x) && Number.isFinite(y) && y >= x ? y - x : null
}

/** `archive/data.pkl` → `data.pkl`; a directory keeps its last segment. */
export const leaf = (p) => String(p ?? '').replace(/\/+$/, '').split('/').pop()
