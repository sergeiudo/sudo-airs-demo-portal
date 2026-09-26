import React, { useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { FONT } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots } from '../home-2027/band'

/**
 * diagramKit — the pieces the launch-design diagrams are built from
 * (LaunchArchitecture for the runtime console, LaunchScanArchitecture for the
 * AI Supply Chain console). See the airs-launch-design skill, recipe 13:
 * nodes are HTML cards on a CSS grid, wires are one SVG drawn from the cards'
 * measured positions, so a label never scales with the column and a wire
 * always meets its card.
 */

// The model card's band stays dark across its whole width: its text is
// centred, so the whole card has to pass the white-text contrast rule, not
// just its left end (bandBg's bright end would not).
export const deepBand = (tone) => `linear-gradient(135deg, ${shade(tone, 0.52)} 0%, ${shade(tone, 0.34)} 100%)`

// ─── geometry: where the cards actually are ─────────────────────────────────

/**
 * Measures every bound card against the root, in layout coordinates
 * (offsetLeft/Top), so an entrance animation's transform never skews a wire.
 * Re-measures on any size change of the root or a card, and once fonts load.
 */
export function useGeometry(deps) {
  const root = useRef(null)
  const nodes = useRef(new Map())
  const last = useRef('')
  const [geo, setGeo] = useState(null)
  const bind = (key) => (el) => { if (el) nodes.current.set(key, el); else nodes.current.delete(key) }

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return undefined
    let raf = 0
    const measure = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const g = { w: el.offsetWidth, h: el.offsetHeight }
        nodes.current.forEach((n, k) => {
          let x = 0
          let y = 0
          let p = n
          while (p && p !== el) { x += p.offsetLeft; y += p.offsetTop; p = p.offsetParent }
          if (p !== el) return
          const w = n.offsetWidth
          const h = n.offsetHeight
          g[k] = { x, y, w, h, r: x + w, b: y + h, cx: x + w / 2, cy: y + h / 2 }
        })
        const key = JSON.stringify(g)
        if (key !== last.current) { last.current = key; setGeo(g) }
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    nodes.current.forEach((n) => ro.observe(n))
    document.fonts?.ready?.then(measure)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  return { root, bind, geo }
}

const r1 = (n) => Math.round(n * 10) / 10
export const pt = (x, y) => `${r1(x)},${r1(y)}`

/** A cubic between two points with vertical tangents; returns the path and its midpoint. */
export function vCurve(x1, y1, x2, y2, bend) {
  const k = bend ?? Math.max(28, Math.abs(y2 - y1) * 0.55)
  const c1 = [x1, y1 + (y2 > y1 ? k : -k)]
  const c2 = [x2, y2 + (y2 > y1 ? -k : k)]
  return {
    d: `M${pt(x1, y1)} C${pt(...c1)} ${pt(...c2)} ${pt(x2, y2)}`,
    m: { x: (x1 + 3 * c1[0] + 3 * c2[0] + x2) / 8, y: (y1 + 3 * c1[1] + 3 * c2[1] + y2) / 8 },
  }
}

/** A cubic between two points with horizontal tangents — a sideways wire between cards at different heights. */
export function hCurve(x1, y1, x2, y2, bend) {
  const k = bend ?? Math.max(18, Math.abs(x2 - x1) * 0.5)
  const c1 = [x1 + k, y1]
  const c2 = [x2 - k, y2]
  return {
    d: `M${pt(x1, y1)} C${pt(...c1)} ${pt(...c2)} ${pt(x2, y2)}`,
    m: { x: (x1 + 3 * c1[0] + 3 * c2[0] + x2) / 8, y: (y1 + 3 * c1[1] + 3 * c2[1] + y2) / 8 },
  }
}

/** The block short-circuit: up out of the scan, over, and down into the client. */
export function arcBack(x1, y1, x2, y2, lift = 46) {
  const c1 = [x1, y1 - lift]
  const c2 = [x2, y2 - lift]
  return {
    d: `M${pt(x1, y1)} C${pt(...c1)} ${pt(...c2)} ${pt(x2, y2)}`,
    m: { x: (x1 + 3 * c1[0] + 3 * c2[0] + x2) / 8, y: (y1 + 3 * c1[1] + 3 * c2[1] + y2) / 8 },
  }
}

// ─── SVG pieces ──────────────────────────────────────────────────────────────

export function Markers({ id, colors }) {
  return (
    <defs>
      {Object.entries(colors).map(([k, c]) => (
        <marker key={k} id={`${id}-${k}`} viewBox="0 0 10 10" refX="8.5" refY="5"
                markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto">
          <path d="M1.5,1.5 L8.5,5 L1.5,8.5 Z" fill={c} stroke={c} strokeWidth="1" strokeLinejoin="round" />
        </marker>
      ))}
    </defs>
  )
}

export function Wire({ d, color, opacity = 0.7, dashed, marker, width = 1.6 }) {
  return (
    <path d={d} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round"
          strokeDasharray={dashed ? '5 4' : undefined} markerEnd={marker ? `url(#${marker})` : undefined} />
  )
}

/** A dot riding a wire. Invisible until its animation begins, so it never parks at the origin. */
export function Packet({ d, color, dur, delay = 0, r = 3.5 }) {
  return (
    <circle r={r} fill={color} opacity={0}>
      <animateMotion path={d} dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1"
               dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
    </circle>
  )
}

// ─── HTML pieces ─────────────────────────────────────────────────────────────

/** A label riding a wire. */
export function WirePill({ t, x, y, tone, mono, children }) {
  return (
    <div className="absolute pointer-events-none" style={{ left: x, top: y, transform: 'translate(-50%, -50%)', zIndex: 3 }}>
      <span className="inline-flex items-center rounded-full whitespace-nowrap"
            style={{
              padding: '2px 8px', background: t.panel, border: `1px solid ${tone}59`, boxShadow: t.shadowSm,
              fontFamily: mono ? FONT.mono : FONT.prose, fontSize: 10.5, fontWeight: 600,
              color: t.isLight ? shade(tone, 0.32) : tone,
            }}>
        {children}
      </span>
    </div>
  )
}

/**
 * One node. `user` is a soft card (the user's side), `scan` an enforcement
 * point (gradient icon; dashed amber when AIRS is off), `model` the cloud's
 * band with its logo on a white tile.
 */
export function Node({ t, nodeRef, kind, tone, icon: Icon, logo, title, sub, off, compact, style, delay = 0, children }) {
  const reduce = useReducedMotion()
  const model = kind === 'model'
  const box = model
    ? { background: deepBand(tone), border: '1px solid transparent', boxShadow: `0 12px 26px ${tone}40` }
    : kind === 'scan' && off
    ? { background: t.panel, border: `1.5px dashed ${t.warn}8c`, boxShadow: 'none' }
    : kind === 'scan'
    ? { background: t.panel, border: `1px solid ${tone}55`, boxShadow: `0 8px 20px ${tone}1f` }
    : { background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm }
  const size = compact ? 28 : 34
  const warnInk = t.isLight ? shade(t.warn, 0.38) : t.warn
  // framer-motion owns opacity here, so a dimmed node (MCP off) animates to its
  // dim value instead of having the entrance animation undo it.
  const { opacity: rest = 1, ...layout } = style ?? {}

  return (
    <motion.div ref={nodeRef}
                initial={reduce ? false : { opacity: 0 }} animate={{ opacity: rest }} transition={{ delay, duration: 0.3 }}
                className="relative flex flex-col items-center text-center overflow-hidden"
                style={{ zIndex: 2, minWidth: 0, borderRadius: 18, padding: compact ? '10px 6px' : '12px 10px', alignSelf: 'center', ...box, ...layout }}>
      {model && <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />}

      <span className="relative grid place-items-center rounded-xl flex-shrink-0"
            style={model
              ? { width: size, height: size, background: '#fff' }
              : kind === 'scan' && !off
              ? { width: size, height: size, background: bandBg(tone), boxShadow: `0 5px 12px ${tone}55` }
              : { width: size, height: size, background: `${off ? t.warn : tone}17`, color: off ? warnInk : tone }}>
        {logo
          ? <img src={logo} alt="" style={{ height: Math.round(size * 0.44), width: 'auto' }} />
          : <Icon size={Math.round(size * 0.46)} style={{ color: kind === 'scan' && !off ? '#fff' : undefined }} aria-hidden="true" />}
      </span>

      <span className="relative block w-full" title={typeof title === 'string' ? title : undefined}
            style={{
              fontFamily: FONT.display, fontSize: compact ? 12 : 13, fontWeight: 700, lineHeight: 1.2, marginTop: 7,
              color: model ? '#fff' : off ? warnInk : t.ink,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
        {title}
      </span>
      {sub && (
        <span className="relative block w-full"
              style={{
                fontFamily: FONT.prose, fontSize: compact ? 10.5 : 11, lineHeight: 1.35, marginTop: 2,
                color: model ? 'rgba(255,255,255,0.9)' : t.inkDim,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
          {sub}
        </span>
      )}
      {children}
    </motion.div>
  )
}


export function TrayLabel({ t, icon: Icon, tone, children, style }) {
  const ink = tone ? (t.isLight ? shade(tone, 0.3) : tone) : t.inkDim
  return (
    <div className="relative flex items-center gap-1.5 min-w-0" style={{ zIndex: 3, justifySelf: 'end', alignSelf: 'start', marginTop: 11, ...style }}>
      <Icon size={13} style={{ color: ink, flexShrink: 0 }} aria-hidden="true" />
      {React.Children.map(children, (c, i) => (typeof c === 'string'
        ? <span key={i} className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: ink }}>{c}</span>
        : c))}
    </div>
  )
}

export function MonoChip({ t, children }) {
  return (
    <span className="rounded-full px-2 flex-shrink-0 whitespace-nowrap"
          style={{ fontFamily: FONT.mono, fontSize: 10, lineHeight: '18px', color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
      {children}
    </span>
  )
}
