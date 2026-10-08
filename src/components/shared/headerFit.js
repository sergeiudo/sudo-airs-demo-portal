import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'
import { FONT } from '../../views/api-intercept-2027/tokens'
import { bandGlass } from '../../views/home-2027/band'

/**
 * headerFit — how the header widgets shrink to fit, kept apart from
 * HeaderWidgets so the widgets themselves (AskAirs, RegionsPanel,
 * ServerStatus) can read it without importing the file that imports them.
 * The levels are described in HeaderWidgets.jsx.
 */

export const FitCtx = createContext(0)
/** The header's fit level, for a widget deciding what to show (0 = everything). */
export const useWidgetFit = () => useContext(FitCtx)
export const FIT_MAX = 4

const focusBar = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
const focusBand = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

/**
 * The pill's box in either variant, labelled or icon-only. Shared by every
 * widget so the five stay the same shape at every fit level.
 */
export function pillBox({ t, band, iconOnly, active, border }) {
  const size = band ? 30 : 38
  const shape = iconOnly
    ? { width: size, padding: 0, justifyContent: 'center' }
    : { padding: band ? '0 12px 0 9px' : '0 14px 0 11px' }
  return band
    ? { height: size, ...shape, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, ...bandGlass, background: active ? 'rgba(0,0,0,0.34)' : bandGlass.background, transition: 'background 160ms ease' }
    : { height: size, ...shape, fontFamily: FONT.prose, fontSize: 13, fontWeight: 600, color: t.ink, background: active ? t.sunken : t.panel, border: `1px solid ${border ?? t.hairline}`, transition: 'background 160ms ease, border-color 160ms ease' }
}
export const pillClass = (band) => `inline-flex items-center gap-1.5 rounded-full flex-shrink-0 whitespace-nowrap ${band ? focusBand : focusBar}`

/**
 * The width a header row needs at its current fit level. Every in-flow child
 * counts its `[data-fit]` parts — the element itself, or the ones inside it
 * (never nest them) — at their natural width plus `data-fit-pad`, or at
 * `data-fit-min` for a part that shrinks (a search field). A child with no
 * part (a flex-1 spacer) needs nothing. Padding and gaps are read from CSS.
 * Parts must not shrink themselves (`flex-shrink-0` or `width: max-content`),
 * or the measure reads the squeezed width and never sees the overflow.
 */
function widthNeeded(row) {
  const cs = getComputedStyle(row)
  const kids = [...row.children].filter((c) => {
    const s = getComputedStyle(c)
    return s.display !== 'none' && s.position !== 'absolute' && s.position !== 'fixed'
  })
  let need = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + (parseFloat(cs.columnGap) || 0) * Math.max(0, kids.length - 1)
  for (const c of kids) {
    for (const p of c.matches('[data-fit]') ? [c] : c.querySelectorAll('[data-fit]')) {
      need += p.dataset.fitMin ? Number(p.dataset.fitMin) : p.offsetWidth + Number(p.dataset.fitPad || 0)
    }
  }
  return need
}

/**
 * useHeaderFit — how compact a header row must be. Returns `[ref, fit]`: put
 * the ref on the flex row, mark its parts with `data-fit`, and pass `fit` to
 * HeaderWidgets (and hide the row's own extras at fit ≥ 1).
 *
 * A width change (or a change in `deps` — a pill that appears, like the SCM
 * link) starts again from 0 and steps up until the row fits; a part growing
 * in place (a pill's word changing) only ever compacts further, so the
 * measuring can never chase its own tail.
 */
export function useHeaderFit(deps = []) {
  const ref = useRef(null)
  const [fit, setFit] = useState(0)
  const [epoch, setEpoch] = useState(0)
  const [tick, setTick] = useState(0)

  useLayoutEffect(() => {
    const row = ref.current
    if (!row) return undefined
    let width = row.clientWidth
    let alive = true
    const ro = new ResizeObserver(() => {
      if (row.clientWidth !== width) { width = row.clientWidth; setEpoch((e) => e + 1) } else setTick((x) => x + 1)
    })
    ro.observe(row)
    row.querySelectorAll('[data-fit]').forEach((p) => ro.observe(p))
    // Widths measured before the web fonts arrive are the fallback font's.
    document.fonts?.ready.then(() => { if (alive) setEpoch((e) => e + 1) })
    return () => { alive = false; ro.disconnect() }
  }, [])

  const key = [epoch, ...deps].join('|')
  const seen = useRef(key)
  useLayoutEffect(() => {
    const row = ref.current
    if (!row) return
    if (seen.current !== key) {
      seen.current = key
      if (fit !== 0) { setFit(0); return }
    }
    if (fit < FIT_MAX && widthNeeded(row) > row.clientWidth + 0.5) setFit(fit + 1)
  }, [key, fit, tick])

  return [ref, fit]
}
