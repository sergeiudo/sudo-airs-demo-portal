import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Data for the Telemetry console. Three sources, one server:
 *   /api/telemetry/overview  aggregates for a window and target
 *   /api/telemetry/feed      summaries, newest first, cursor-paged
 *   /api/telemetry/stream    server-sent events — every trace as it is written
 *
 * The stream replaces the classic view's 5-second poll of 100 rows plus the
 * metrics: a trace shows up the moment it is written, and nothing is fetched
 * while nothing happens.
 */

const overviewCache = new Map() // `${window}|${target}` → payload (instant repaint on return)

export function useOverview(window, target) {
  const key = `${window}|${target || ''}`
  const [state, setState] = useState(() => ({ key, data: overviewCache.get(key) ?? null, error: null }))
  const inflight = useRef(0)

  const refresh = useCallback(() => {
    const token = ++inflight.current
    const qs = new URLSearchParams({ window })
    if (target) qs.set('target', target)
    return fetch(`/api/telemetry/overview?${qs}`)
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(new Error(j.error || `HTTP ${r.status}`)))))
      .then((data) => {
        overviewCache.set(key, data)
        if (token === inflight.current) setState({ key, data, error: null })
      })
      .catch((e) => { if (token === inflight.current) setState((s) => ({ ...s, key, error: e.message })) })
  }, [key, window, target])

  useEffect(() => {
    setState({ key, data: overviewCache.get(key) ?? null, error: null })
    refresh()
    // Relative windows slide even when nothing new arrives.
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [key, refresh])

  // State is stamped with its key: the render right after a scope change must
  // not show the previous scope's numbers under the new scope's title.
  const data = state.key === key ? state.data : overviewCache.get(key) ?? null
  return { data, error: state.key === key ? state.error : null, loading: !data, refresh }
}

/**
 * The live stream. `status`: connecting · live · reconnecting · paused ·
 * unsupported. EventSource reconnects by itself; this only reports it.
 */
export function useLiveStream({ target, paused, onTrace, onDelete, onReset }) {
  const [status, setStatus] = useState(paused ? 'paused' : 'connecting')
  const handlers = useRef({ onTrace, onDelete, onReset })
  handlers.current = { onTrace, onDelete, onReset }

  useEffect(() => {
    if (paused) { setStatus('paused'); return undefined }
    if (typeof EventSource === 'undefined') { setStatus('unsupported'); return undefined }
    setStatus('connecting')
    const qs = target ? `?target=${encodeURIComponent(target)}` : ''
    const es = new EventSource(`/api/telemetry/stream${qs}`)
    let opened = false
    es.addEventListener('hello', () => {
      // A reconnect: anything written while the stream was down is fetched
      // again by the listeners' reset path, so nothing is silently missed.
      if (opened) handlers.current.onReset?.({ reconnect: true })
      opened = true
      setStatus('live')
    })
    es.addEventListener('trace', (e) => { try { handlers.current.onTrace?.(JSON.parse(e.data)) } catch { /* malformed event */ } })
    es.addEventListener('delete', (e) => { try { handlers.current.onDelete?.(JSON.parse(e.data).id) } catch { /* malformed event */ } })
    es.addEventListener('reset', () => handlers.current.onReset?.({ reconnect: false }))
    es.onerror = () => setStatus(es.readyState === EventSource.CLOSED ? 'reconnecting' : opened ? 'reconnecting' : 'connecting')
    return () => es.close()
  }, [target, paused])

  return status
}

async function fetchFeed({ limit, before, target, outcome, q, family }) {
  const qs = new URLSearchParams({ limit: String(limit) })
  if (family) qs.set('family', family)
  if (before) qs.set('before', before)
  if (target) qs.set('target', target)
  if (outcome) qs.set('outcome', outcome)
  if (q) qs.set('q', q)
  const r = await fetch(`/api/telemetry/feed?${qs}`)
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
  return j
}

const WIRE_MAX = 80

/** The live wire: the latest traces, newest first, with live arrivals prepended. */
export function useWire(target) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const fresh = useRef(new Set()) // ids that arrived live — they animate in

  const load = useCallback(() => {
    setLoading(true)
    return fetchFeed({ limit: 40, target })
      .then((j) => { setItems(j.items); setError(null) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [target])
  useEffect(() => { fresh.current.clear(); load() }, [load])

  const push = useCallback((s) => {
    fresh.current.add(s.id)
    setItems((l) => (l.some((x) => x.id === s.id) ? l : [s, ...l].slice(0, WIRE_MAX)))
  }, [])
  const remove = useCallback((id) => setItems((l) => l.filter((x) => x.id !== id)), [])

  return { items, loading, error, push, remove, reload: load, fresh: fresh.current }
}

/** The prompt log: filtered, paged by cursor, live arrivals prepended when they match. */
export function useLog({ target, outcome, q, family }) {
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(null)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [debounced, setDebounced] = useState(q)
  useEffect(() => { const id = setTimeout(() => setDebounced(q), 280); return () => clearTimeout(id) }, [q])

  const load = useCallback(() => {
    setLoading(true)
    return fetchFeed({ limit: 60, target, outcome, q: debounced, family })
      .then((j) => { setItems(j.items); setCursor(j.cursor); setMore(j.more); setError(null) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [target, outcome, debounced, family])
  useEffect(() => { load() }, [load])

  const loadMore = useCallback(() => {
    if (!cursor) return
    setLoading(true)
    fetchFeed({ limit: 60, before: cursor, target, outcome, q: debounced, family })
      .then((j) => { setItems((l) => [...l, ...j.items.filter((x) => !l.some((y) => y.id === x.id))]); setCursor(j.cursor); setMore(j.more) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [cursor, target, outcome, debounced, family])

  const offer = useCallback((s) => {
    if (debounced) return // a search result set is not live
    if (outcome && s.outcome !== outcome) return
    if (family && !s.families.includes(family)) return
    setItems((l) => (l.some((x) => x.id === s.id) ? l : [s, ...l]))
  }, [outcome, debounced, family])
  const remove = useCallback((id) => setItems((l) => l.filter((x) => x.id !== id)), [])

  return { items, more, loading, error, loadMore, reload: load, offer, remove, searching: !!debounced }
}

/** A number that eases to its new value — counters tick rather than jump. */
export function useCountUp(value, { ms = 700, reduce = false } = {}) {
  const [shown, setShown] = useState(value ?? 0)
  const from = useRef(value ?? 0)
  useEffect(() => {
    if (value == null) return undefined
    if (reduce) { setShown(value); from.current = value; return undefined }
    const a = from.current
    if (a === value) return undefined
    const t0 = performance.now()
    let raf = 0
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms)
      const e = 1 - (1 - k) ** 3
      setShown(Math.round(a + (value - a) * e))
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); from.current = value }
  }, [value, ms, reduce])
  return shown
}
