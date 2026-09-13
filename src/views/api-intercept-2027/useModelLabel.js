import { useEffect, useState } from 'react'

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
const inflight = new Map()

function load(backend) {
  if (cache.has(backend)) return Promise.resolve(cache.get(backend))
  if (!inflight.has(backend)) {
    const p = fetch(`/api/models/${backend}`)
      .then((r) => r.json())
      .then((d) => {
        const m = new Map((d.models ?? []).map((x) => [x.id, x.label || x.id]))
        cache.set(backend, m)
        return m
      })
      // A failed catalogue must not blank the diagram — the caller falls back
      // to the tail of the id.
      .catch(() => new Map())
      .finally(() => inflight.delete(backend))
    inflight.set(backend, p)
  }
  return inflight.get(backend)
}

export function useModelLabel(backend, model) {
  const fallback = String(model || '').split('/').pop() || 'model'
  const [label, setLabel] = useState(() => cache.get(backend)?.get(model) ?? fallback)

  useEffect(() => {
    let alive = true
    setLabel(cache.get(backend)?.get(model) ?? fallback)
    load(backend).then((m) => {
      const hit = m.get(model)
      if (alive && hit) setLabel(hit)
    })
    return () => { alive = false }
  }, [backend, model, fallback])

  return label
}
