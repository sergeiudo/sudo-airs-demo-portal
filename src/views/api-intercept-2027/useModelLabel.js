import { useEffect, useRef, useState } from 'react'

/**
 * The picker's label for a model id.
 *
 * The diagrams and the intercept line were showing the raw routing id —
 * `anthropic.claude-haiku-4-5-20251001-v1:0`, `us.anthropic.…` — which is
 * unreadable at projector distance and does not match what the presenter just
 * selected in the dropdown two inches away. Same catalogue, same label.
 *
 * Cached per backend at module scope: the picker already fetches these lists,
 * and a diagram re-render must not become another round trip.
 */

const cache = new Map()     // backend → Map(id → label)
const lists = new Map()     // backend → the catalogue as served
const inflight = new Map()

function load(backend) {
  if (cache.has(backend)) return Promise.resolve(cache.get(backend))
  return fetchList(backend).then(({ models }) => new Map(models.map((x) => [x.id, x.label || x.id])))
}

/** The full catalogue for a backend, shared by every caller. `force` refetches. */
function fetchList(backend, force = false) {
  if (!force && lists.has(backend)) return Promise.resolve({ models: lists.get(backend), error: null })
  if (force || !inflight.has(backend)) {
    const p = fetch(`/api/models/${backend}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        const models = d.models ?? []
        // Only a good answer is cached: an error body (expired provider keys,
        // a server mid-restart) used to be stored as an empty map and pin the
        // raw ids on screen until a page reload.
        if (ok && models.length) {
          lists.set(backend, models)
          cache.set(backend, new Map(models.map((x) => [x.id, x.label || x.id])))
        }
        return { models, error: ok ? null : (d.error || 'Failed to load models') }
      })
      // A failed catalogue must not blank the diagram — the caller falls back
      // to the tail of the id.
      .catch((e) => ({ models: [], error: e.message }))
      .finally(() => inflight.delete(backend))
    inflight.set(backend, p)
  }
  return inflight.get(backend)
}

/**
 * The catalogue itself, for a picker. Same cache as the labels, so opening the
 * picker and drawing the diagram cost one request between them.
 */
export function useModelCatalog(backend) {
  // State is stamped with the backend it belongs to. Without that, the render
  // right after a target switch would hand back the previous cloud's list, and
  // a picker's self-heal would "correct" the new default to a model from it.
  const [state, setState] = useState({ for: null, models: [], loading: false, error: null })
  const [nonce, setNonce] = useState(0)
  const seen = useRef(0)

  useEffect(() => {
    let alive = true
    // Only the refresh button forces a refetch; a backend switch reads the cache.
    const force = nonce !== seen.current
    seen.current = nonce
    if (force) setState((s) => ({ ...s, loading: true, error: null }))
    fetchList(backend, force).then(({ models, error }) => {
      if (alive) setState({ for: backend, models, loading: false, error })
    })
    return () => { alive = false }
  }, [backend, nonce])

  const fresh = state.for === backend
  return {
    models: fresh ? state.models : (lists.get(backend) ?? []),
    loading: fresh ? state.loading : !lists.has(backend),
    error: fresh ? state.error : null,
    reload: () => setNonce((n) => n + 1),
  }
}

export function useModelLabel(backend, model) {
  const fallback = String(model || '').split('/').pop() || 'model'
  const [label, setLabel] = useState(() => cache.get(backend)?.get(model) ?? fallback)

  useEffect(() => {
    let alive = true
    setLabel(cache.get(backend)?.get(model) ?? fallback)
    if (!backend) return undefined  // unknown backend: no catalogue to ask
    load(backend).then((m) => {
      const hit = m.get(model)
      if (alive && hit) setLabel(hit)
    })
    return () => { alive = false }
  }, [backend, model, fallback])

  return label
}
