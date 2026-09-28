import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Globe2, Loader2, RefreshCw, X, Server, Zap, Check } from 'lucide-react'
import { FONT, label as LBL } from '../../views/api-intercept-2027/tokens'
import { shade, bandDots, bandGlass } from '../../views/home-2027/band'
import { deepBand } from '../../views/runtime-launch/diagramKit'
import { Tip } from './Tip'

/**
 * RegionsPanel — "where AIRS answers from". Lives on the home app bar and the
 * Telemetry header (RegionsButton, `variant` bar | band); both share one
 * module-cached result, so a probe in one shows in the other.
 *
 * The panel leads with the answer — the fastest region from here, and the one
 * this portal actually uses, with the gap between them — then an arc map from
 * this server to the four regions, where each dot's round trip takes as long
 * (scaled) as that region's measured warm round trip, then the regions ranked
 * fastest first. Two marks carry through all three: "in use" is filled blue,
 * "fastest" is a blue outline with a bolt.
 *
 * Measured, not estimated: four plain GETs per region, no key (each endpoint
 * answers 401), timed on the server with its connection reuse recorded. The
 * origin is named by hostname, not placed on a map — the server can be a
 * laptop on a VPN or EC2 in us-west-2, and a drawn location would be a guess.
 */

const CODE = { us: 'US', eu: 'EU', in: 'IN', sg: 'SG' }
const SHORT = { us: 'United States', eu: 'Germany (EU)', in: 'India', sg: 'Singapore' }
const ORDER = ['us', 'eu', 'in', 'sg'] // west to east, so the arcs fan out the way a map would
const W = 520
const H = 206
const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

const fmtMs = (ms) => (ms == null ? '—' : ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`)
const inkOn = (t, tone, k = 0.3) => (t.isLight ? shade(tone, k) : tone)

// ─── the shared probe ────────────────────────────────────────────────────────

let cache = null
const listeners = new Set()

function useProbe() {
  const [snap, setSnap] = useState(() => cache ?? { state: 'idle', result: null, error: null })
  useEffect(() => {
    const on = (s) => setSnap(s)
    listeners.add(on)
    return () => listeners.delete(on)
  }, [])
  const run = useCallback(async () => {
    const publish = (s) => { cache = s; listeners.forEach((l) => l(s)) }
    publish({ state: 'running', result: cache?.result ?? null, error: null })
    try {
      const r = await fetch('/api/airs-probe')
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      publish({ state: 'done', result: j, error: null })
    } catch (e) { publish({ state: 'error', result: cache?.result ?? null, error: e.message }) }
  }, [])
  return { ...snap, run }
}

function summarize(result) {
  if (!result?.regions) return null
  let activeHost = null
  try { activeHost = new URL(result.active_endpoint).host } catch { /* unset */ }
  const regions = ORDER.map((id) => result.regions.find((r) => r.id === id)).filter(Boolean).map((r) => {
    const host = new URL(r.base).host
    return { ...r, host, code: CODE[r.id] ?? r.id.toUpperCase(), name: SHORT[r.id] ?? r.label, active: host === activeHost, warm: r.warm_ms ?? r.min_ms }
  })
  const reach = regions.filter((r) => r.reachable && r.warm != null)
  const ranked = [...reach].sort((a, b) => a.warm - b.warm)
  const fastest = ranked[0] ?? null
  return { regions, ranked, unreachable: regions.filter((r) => !reach.includes(r)), fastest, active: regions.find((r) => r.active) ?? null }
}

// ─── the answer ──────────────────────────────────────────────────────────────

function AnswerTile({ t, kind, r, delta }) {
  const inUse = kind === 'use'
  return (
    <div className="relative overflow-hidden rounded-2xl px-4 py-3 min-w-0"
         style={inUse
           ? { background: deepBand(t.live), boxShadow: `0 10px 22px ${t.live}33` }
           : { background: `linear-gradient(135deg, ${t.live}17, ${t.live}06), ${t.panel}`, border: `1.5px solid ${t.live}88` }}>
      {inUse && <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />}
      <div className="relative flex items-center gap-1.5" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: inUse ? 'rgba(255,255,255,0.88)' : inkOn(t, t.live, 0.25) }}>
        {inUse ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : <Zap size={12} aria-hidden="true" />}
        {inUse ? 'This portal uses' : 'Fastest from here'}
      </div>
      <div className="relative flex items-baseline gap-2 mt-1.5 min-w-0">
        <span style={{ fontSize: 20 }} aria-hidden="true">{r.flag}</span>
        <span className="truncate" style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: inUse ? '#fff' : t.ink }}>{r.name}</span>
      </div>
      <div className="relative flex items-baseline gap-2 mt-0.5">
        <span style={{ fontFamily: FONT.display, fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, color: inUse ? '#fff' : t.ink }}>{fmtMs(r.warm)}</span>
        <span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: inUse ? 'rgba(255,255,255,0.85)' : t.inkDim }}>warm round trip</span>
      </div>
      {inUse && (
        <div className="relative mt-1" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: '#fff' }}>
          {delta > 0 ? `+${fmtMs(delta)} slower than the fastest` : 'already the fastest region'}
        </div>
      )}
      {!inUse && <div className="mt-1 truncate" title={r.host} style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>{r.host}</div>}
    </div>
  )
}

// ─── the arc map ─────────────────────────────────────────────────────────────

const node = (i) => ({ x: W * [0.12, 0.37, 0.63, 0.88][i], y: i === 0 || i === 3 ? 58 : 36 })
const ORIGIN = { x: W / 2, y: H - 34 }
const arcPath = (i) => {
  const n = node(i)
  const x1 = ORIGIN.x, y1 = ORIGIN.y - 18
  const x2 = n.x, y2 = n.y + 19
  return `M${x1},${y1} C${x1},${y1 - 66} ${x2},${y2 + 56} ${x2},${y2}`
}

function ArcMap({ t, s, running, hostname }) {
  const reduce = useReducedMotion()
  const regions = s?.regions ?? ORDER.map((id) => ({ id, code: CODE[id], reachable: true }))
  const rank = s?.ranked.map((r) => r.id) ?? []
  return (
    <div className="relative mx-auto" style={{ width: W, height: H }}>
      <svg width={W} height={H} className="absolute inset-0" aria-hidden="true" style={{ overflow: 'visible' }}>
        {regions.map((r, i) => {
          const d = arcPath(i)
          const k = rank.indexOf(r.id)
          const op = running || k < 0 ? 0.35 : 1 - k * 0.18
          // One round trip, up and back; its duration scales with the measured warm ms.
          const dur = running ? 1.6 : r.warm != null ? Math.min(6, Math.max(0.55, r.warm / 90)) : null
          return (
            <g key={r.id}>
              <path d={d} fill="none" stroke={t.live} strokeOpacity={op * 0.2} strokeWidth={7} strokeLinecap="round" />
              <path d={d} fill="none" stroke={t.live} strokeOpacity={op} strokeWidth={1.8} strokeLinecap="round" strokeDasharray={running || !r.reachable ? '4 5' : undefined} />
              {!reduce && dur && r.reachable && (
                <circle key={`${running}-${r.warm}`} r={4.5} fill={t.live} stroke={t.isLight ? '#FAFAFB' : t.raised} strokeWidth={2}>
                  <animateMotion path={d} dur={`${dur * 2}s`} repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" begin={`${i * 0.18}s`} />
                </circle>
              )}
            </g>
          )
        })}
      </svg>

      {regions.map((r, i) => {
        const n = node(i)
        const fastest = !running && s?.fastest?.id === r.id
        return (
          // Positioned by a plain div: framer-motion owns `transform` on the animated one.
          <div key={r.id} className="absolute" style={{ left: n.x, top: n.y + 18, transform: 'translate(-50%, -100%)', zIndex: 2 }}>
            <motion.div className="flex flex-col-reverse items-center" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <span className="flex items-center gap-1.5 rounded-full pl-1.5 pr-3 whitespace-nowrap"
                    style={{
                      height: 36, background: r.active ? deepBand(t.live) : fastest ? `linear-gradient(135deg, ${t.live}1c, ${t.live}08), ${t.panel}` : t.panel,
                      border: `${fastest && !r.active ? 1.5 : 1}px solid ${r.active ? 'transparent' : fastest ? `${t.live}99` : t.hairline}`,
                      boxShadow: r.active ? `0 8px 18px ${t.live}44` : t.shadowSm,
                    }}>
                <span className="grid place-items-center rounded-full" style={{ width: 25, height: 25, fontSize: 14, background: r.active ? 'rgba(255,255,255,0.18)' : t.sunken }}>{r.flag ?? '·'}</span>
                <span style={{ fontFamily: FONT.display, fontSize: 12, fontWeight: 700, color: r.active ? 'rgba(255,255,255,0.8)' : t.inkDim }}>{r.code}</span>
                <span style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: r.active ? '#fff' : t.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {running ? <Loader2 size={13} className="animate-spin" style={{ color: r.active ? '#fff' : t.live }} /> : r.reachable === false ? '—' : fmtMs(r.warm)}
                </span>
                {fastest && <Zap size={13} style={{ color: r.active ? '#fff' : t.live }} aria-label="fastest" />}
              </span>
              <span className="mb-1" style={{ minHeight: 18 }}>
                {r.active && <span className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 700, lineHeight: '18px', color: '#fff', background: t.live }}>in use</span>}
              </span>
            </motion.div>
          </div>
        )
      })}

      <div className="absolute flex items-center gap-2 rounded-2xl px-3" style={{ left: ORIGIN.x, top: ORIGIN.y, transform: 'translate(-50%, -50%)', height: 44, zIndex: 2, background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm }}>
        <span className="grid place-items-center rounded-xl" style={{ width: 28, height: 28, background: `${t.live}17`, color: t.live }}><Server size={14} aria-hidden="true" /></span>
        <span className="leading-tight">
          <span className="block" style={{ fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: t.ink }}>This portal's server</span>
          <span className="block truncate" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, maxWidth: 210 }}>{hostname || 'where Express runs'}</span>
        </span>
      </div>
    </div>
  )
}

// ─── ranked list ─────────────────────────────────────────────────────────────

function RankRow({ t, r, i, max, fastestMs }) {
  const reduce = useReducedMotion()
  const fastest = i === 0
  const extra = r.cold_ms != null && r.warm != null ? Math.max(0, r.cold_ms - r.warm) : null
  const w = (ms) => `${Math.max(1.5, (ms / max) * 100)}%`
  return (
    <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
         style={{ background: r.active ? `${t.live}12` : t.panel, border: `1px solid ${r.active ? `${t.live}55` : t.hairline}` }}>
      <span className="grid place-items-center rounded-full flex-shrink-0"
            style={{ width: 24, height: 24, fontFamily: FONT.display, fontSize: 12, fontWeight: 700, color: fastest ? '#fff' : t.inkDim, background: fastest ? t.live : t.sunken }}>
        {i + 1}
      </span>
      <span style={{ fontSize: 20 }} aria-hidden="true">{r.flag}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>{r.name}</span>
          {r.active && <span className="rounded-full px-2 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 700, lineHeight: '18px', color: '#fff', background: t.live }}>in use</span>}
          {fastest && <span className="inline-flex items-center gap-0.5 rounded-full px-2 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 700, lineHeight: '16px', color: inkOn(t, t.live, 0.25), border: `1.5px solid ${t.live}88` }}><Zap size={10} aria-hidden="true" /> fastest</span>}
        </div>
        {/* solid = warm round trip; the faint extension = what the first request adds (DNS + TCP + TLS) */}
        <div className="flex items-center rounded-full overflow-hidden mt-1.5" style={{ height: 8, background: t.sunken }}>
          <motion.span className="block h-full" style={{ background: t.live }} initial={reduce ? false : { width: 0 }} animate={{ width: w(r.warm) }} transition={{ duration: 0.6, ease: 'easeOut' }} />
          {extra != null && <motion.span className="block h-full" style={{ background: t.live, opacity: 0.28 }} initial={reduce ? false : { width: 0 }} animate={{ width: w(extra) }} transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }} />}
        </div>
        <div className="truncate mt-1" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
          first request {fmtMs(r.cold_ms)}{r.connect_ms != null ? ` · ${fmtMs(r.connect_ms)} of it opening the connection` : ''}
        </div>
      </div>
      <div className="text-right flex-shrink-0" style={{ minWidth: 78 }}>
        <div style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: t.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{fmtMs(r.warm)}</div>
        <div style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: fastest ? inkOn(t, t.live, 0.25) : t.inkDim }}>
          {fastest ? 'warm' : `+${fmtMs(r.warm - fastestMs)}`}
        </div>
      </div>
    </div>
  )
}

// ─── the panel and its pill ──────────────────────────────────────────────────

function Panel({ t, probe, anchor, onClose }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  const s = summarize(probe.result)
  const running = probe.state === 'running'

  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect()
      if (!r) return
      const width = Math.min(W + 64, window.innerWidth - 24)
      setPos({ top: r.bottom + 10, left: Math.max(12, Math.min(r.right - width, window.innerWidth - width - 12)), width })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    const onDown = (e) => { if (!ref.current?.contains(e.target) && !anchor.current?.contains(e.target)) onClose() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [onClose, anchor])

  const max = Math.max(1, ...(s?.ranked ?? []).map((r) => Math.max(r.cold_ms ?? 0, r.warm ?? 0)))
  const title = running ? 'Probing four regions…' : s?.fastest ? 'Where AIRS answers fastest' : probe.state === 'error' ? 'The probe failed' : 'Four AIRS regions'
  const sub = running ? 'Four plain requests to each endpoint, in parallel — about 3 seconds'
    : probe.state === 'error' ? probe.error
    : probe.result?.at ? `Measured at ${new Date(probe.result.at).toLocaleTimeString()} from this portal's server`
    : 'Network round trip from this portal to each endpoint'

  return createPortal(
    <motion.div ref={ref} role="dialog" aria-label="Where AIRS answers from"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: pos ? 1 : 0, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="fixed flex flex-col overflow-hidden"
                style={{
                  zIndex: 9000, top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? W + 64, maxHeight: 'calc(100vh - 90px)',
                  borderRadius: 22, background: t.isLight ? '#FAFAFB' : t.raised, border: `1px solid ${t.live}40`,
                  boxShadow: t.isLight ? '0 22px 50px rgba(18,18,22,0.18)' : '0 22px 50px rgba(0,0,0,0.6)',
                }}>
      <div className="relative flex-shrink-0 overflow-hidden" style={{ background: deepBand(t.live) }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
        <Globe2 aria-hidden="true" strokeWidth={1.2} className={running && !reduce ? 'animate-spin' : ''}
                style={{ position: 'absolute', right: -26, bottom: -44, width: 150, height: 150, color: '#fff', opacity: 0.13, animationDuration: '6s' }} />
        <div className="relative flex items-center gap-3 px-4 py-3">
          <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 42, height: 42, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
            <Globe2 size={19} style={{ color: '#fff' }} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Prisma AIRS regions</div>
            <div className="truncate" style={{ fontFamily: FONT.display, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.15, marginTop: 2 }} aria-live="polite">{title}</div>
            <div className="truncate" title={sub} style={{ fontFamily: FONT.prose, fontSize: 11.5, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>{sub}</div>
          </div>
          <button type="button" onClick={probe.run} disabled={running}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 flex-shrink-0 disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  style={{ height: 30, fontFamily: FONT.prose, fontSize: 12, fontWeight: 700, color: shade(t.live, 0.45), background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            {running ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={12} aria-hidden="true" />}
            {running ? 'Probing' : probe.result ? 'Probe again' : 'Probe'}
          </button>
          <button type="button" onClick={onClose} aria-label="Close"
                  className="grid place-items-center rounded-full flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  style={{ width: 30, height: 30, ...bandGlass }}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-4" style={{ scrollbarGutter: 'stable' }}>
        {s?.fastest && s.active && !running && (
          <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: s.active.id === s.fastest.id ? '1fr' : '1fr 1fr' }}>
            {s.active.id !== s.fastest.id && <AnswerTile t={t} kind="fastest" r={s.fastest} />}
            <AnswerTile t={t} kind="use" r={s.active} delta={s.active.warm - s.fastest.warm} />
          </div>
        )}

        <ArcMap t={t} s={s} running={running} hostname={probe.result?.origin?.hostname} />
        <p className="text-center" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
          {running ? 'Measuring…' : s ? 'Each dot’s round trip takes as long, scaled, as that region’s measured one.' : ''}
        </p>

        {s && !running && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Fastest first</span>
              <span className="inline-flex items-center gap-3" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
                <span className="inline-flex items-center gap-1"><span className="rounded-sm" style={{ width: 10, height: 6, background: t.live }} /> warm</span>
                <span className="inline-flex items-center gap-1"><span className="rounded-sm" style={{ width: 10, height: 6, background: t.live, opacity: 0.28 }} /> first-request extra</span>
              </span>
            </div>
            <div className="space-y-1.5">
              {s.ranked.map((r, i) => <RankRow key={r.id} t={t} r={r} i={i} max={max} fastestMs={s.fastest.warm} />)}
              {s.unreachable.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: t.panel, border: `1px dashed ${t.warn}8c` }}>
                  <span style={{ fontSize: 20 }} aria-hidden="true">{r.flag}</span>
                  <span className="flex-1" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>{r.name}</span>
                  <span style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: inkOn(t, t.warn, 0.4) }}>unreachable from this server</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.5, color: t.inkFaint, marginTop: 12 }}>
          Plain requests with no key — each endpoint answers 401 — so this is pure network from where the portal runs, not a scan and not
          from your browser. The first request opens a connection; the rest reuse it, as a long-running app does. Every AIRS scan from
          this portal pays the warm round trip to the region in use.
        </p>
      </div>
    </motion.div>,
    document.body,
  )
}

/**
 * The pill that opens the panel. `variant="band"` = dark glass on a pillar
 * band; `variant="bar"` = a soft pill on the home app bar. The first open
 * runs the probe; after that the pill shows the region in use and its time.
 */
export function RegionsButton({ t, variant = 'band' }) {
  const probe = useProbe()
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  const s = summarize(probe.result)
  const running = probe.state === 'running'
  const toggle = () => setOpen((o) => { if (!o && probe.state === 'idle') probe.run(); return !o })
  const close = useCallback(() => setOpen(false), [])
  const a = s?.active
  const band = variant === 'band'
  const rest = band ? bandGlass.background : t.panel
  const hover = band ? 'rgba(0,0,0,0.34)' : t.sunken

  return (
    <>
      <Tip title="Where AIRS answers from" text="Round trip from this portal's server to each Prisma AIRS region — and which one it uses">
        <button ref={anchor} type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog"
                className={`inline-flex items-center gap-1.5 rounded-full flex-shrink-0 whitespace-nowrap ${band ? 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white' : focusCls}`}
                style={band
                  ? { height: 30, padding: '0 12px 0 8px', fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, ...bandGlass, background: open ? hover : rest, transition: 'background 160ms ease' }
                  : { height: 38, padding: '0 14px 0 11px', fontFamily: FONT.prose, fontSize: 13, fontWeight: 600, color: t.ink, background: open ? hover : rest, border: `1px solid ${open ? `${t.live}66` : t.hairline}`, transition: 'background 160ms ease, border-color 160ms ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = hover }}
                onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = rest }}>
          {running
            ? <Loader2 size={14} className="animate-spin" style={{ color: band ? '#fff' : t.live }} aria-hidden="true" />
            : <Globe2 size={14} style={{ color: band ? '#fff' : t.live }} aria-hidden="true" />}
          {running ? 'Probing regions…' : a && a.warm != null
            ? <>AIRS {a.code} <span style={{ fontFamily: FONT.display, fontWeight: 700 }}>{fmtMs(a.warm)}</span></>
            : 'AIRS regions'}
        </button>
      </Tip>
      <AnimatePresence>{open && <Panel key="regions" t={t} probe={probe} anchor={anchor} onClose={close} />}</AnimatePresence>
    </>
  )
}
