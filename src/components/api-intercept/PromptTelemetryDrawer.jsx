// PromptTelemetryDrawer — the measured telemetry for one prompt, opened from a
// record's "Telemetry" action in both the 2027 console and the legacy view.
//
// It reads /api/traces/:id and renders `trace.detail`: what the server actually
// observed on that request — a wall-clock timeline, HTTP phases, the AIRS scans
// and reports, provider and gateway metadata. The previous version showed a
// total that was a sum of parts and a "how latency is measured" panel with
// typed-in numbers; none of that survives here. Traces recorded before this
// (or by pillars that do not record detail yet) get an honest fallback.
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw, Loader2, Activity, ShieldCheck, ShieldX, AlertTriangle } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { tokens, VERDICT_META } from '../../views/api-intercept-2027/tokens'
import { bandBg, bandDots, bandGlass } from '../../views/home-2027/band'
import { FONT, LBL, CopyButton, Chip, TelemetryLook } from './telemetry/primitives'
import { OverviewTab, TimelineTab, ModelTab, NetworkTab, RawTab, LegacyView, allHttp, guardrailErrors } from './telemetry/sections'
import { SecurityTab } from './telemetry/SecurityTab'

const MIN_W = 520
const MAX_W = 1200
const WIDTH_KEY = 'airs.telemetryDrawer.width'

function verdictMetaOf(trace) {
  if (trace.verdict === 'BLOCKED') return VERDICT_META.blocked
  if (trace.verdict === 'DIRECT' || !trace.airs_enabled) return VERDICT_META.unscanned
  // A fail-open guardrail whose check errored reports ALLOWED without having
  // scanned anything — that is not a pass, and the header must not say it is.
  if (trace.detail && guardrailErrors(trace.detail).some((e) => e.hookVerdict !== false)) {
    return { ...VERDICT_META.unscanned, label: 'NOT SCANNED', note: 'the guardrail check errored and failed open' }
  }
  return VERDICT_META.passed
}

function relative(ms) {
  const s = Math.round(ms / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

function stamp(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const date = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return { date, time: `${time}.${String(d.getMilliseconds()).padStart(3, '0')}`, tz, ms: d.getTime() }
}

/**
 * `variant="band"` — the launcher design's header (RuntimeLaunch): the verdict
 * as a coloured band with the time and the trace id on it, tabs as pills in
 * the verdict colour. Classic and the Observability pillar keep the default.
 */
const BAND_TITLE = { PASSED: 'Passed', INTERCEPTED: 'Intercepted', UNSCANNED: 'Unscanned', 'NOT SCANNED': 'Not scanned' }

export function PromptTelemetryDrawer({ traceId, onClose, variant = 'classic' }) {
  const { state } = useAppContext()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const [trace, setTrace] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('overview')
  const [now, setNow] = useState(Date.now())
  const [width, setWidth] = useState(() => {
    const saved = Number(typeof localStorage !== 'undefined' && localStorage.getItem(WIDTH_KEY))
    return saved >= MIN_W && saved <= MAX_W ? saved : 720
  })
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // "2 min ago" stays true while the drawer is open.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])

  const load = useCallback(() => {
    if (!traceId) return
    setLoading(true)
    setError(null)
    fetch(`/api/traces/${traceId}`)
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(new Error(j.error || `HTTP ${r.status}`)))))
      .then((j) => { setTrace(j); setNow(Date.now()) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [traceId])

  useEffect(() => { setTrace(null); setTab('overview'); load() }, [load])

  // Resizable from the left edge — the repo default for side panels.
  useEffect(() => {
    if (!dragging) return
    const move = (e) => {
      const max = Math.min(MAX_W, window.innerWidth - 80)
      setWidth(Math.max(MIN_W, Math.min(max, drag.current.w + (drag.current.x - e.clientX))))
    }
    const up = () => setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging])
  useEffect(() => { if (!dragging) localStorage.setItem(WIDTH_KEY, String(width)) }, [dragging, width])

  const detail = trace?.detail
  const vm = trace ? verdictMetaOf(trace) : VERDICT_META.idle
  const when = trace ? stamp(detail?.timeline?.startedAt ?? trace.created_at) : null
  const spans = detail?.timeline?.spans || []

  const tabs = detail ? [
    { id: 'overview', label: 'Overview' },
    { id: 'timeline', label: 'Timeline', count: spans.filter((s) => !s.parent).length },
    { id: 'security', label: 'Security', alert: trace.verdict === 'BLOCKED' },
    { id: 'model', label: detail.gateway ? 'Model & gateway' : detail.mcp ? 'Model & MCP' : 'Model' },
    { id: 'network', label: 'Network', count: allHttp(spans).length },
    { id: 'raw', label: 'Raw' },
  ] : []

  return (
    <AnimatePresence>
      {traceId && (
        <motion.aside
          key="prompt-telemetry-drawer"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
          style={{ width, background: t.ground, borderLeft: `1px solid ${t.hairline}`, boxShadow: '-18px 0 48px rgba(0,0,0,0.18)', userSelect: dragging ? 'none' : 'auto' }}
        >
          {/* resize handle */}
          <div
            onMouseDown={(e) => { drag.current = { x: e.clientX, w: width }; setDragging(true) }}
            className="absolute top-0 bottom-0 group"
            style={{ left: -5, width: 10, cursor: 'col-resize', zIndex: 2 }}
            title="Drag to resize"
          >
            <div className="absolute top-0 bottom-0" style={{ left: 4, width: 2, background: dragging ? t.live : 'transparent', transition: 'background .15s' }} />
            <div className="absolute flex flex-col gap-[3px] opacity-60 group-hover:opacity-100" style={{ top: '50%', left: 3, transform: 'translateY(-50%)' }}>
              {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 3, height: 3, borderRadius: 3, background: dragging ? t.live : t.inkFaint }} />)}
            </div>
          </div>

          {variant === 'band' ? (
            <header className="flex-shrink-0" style={{ background: t.panel, borderBottom: `1px solid ${t.hairline}` }}>
              {(() => {
                const color = !trace ? '#64748b' : vm === VERDICT_META.blocked ? t.block : vm === VERDICT_META.passed ? t.pass : t.warn
                const Icon = !trace ? Activity : vm === VERDICT_META.blocked ? ShieldX : vm === VERDICT_META.passed ? ShieldCheck : AlertTriangle
                const glassBtn = { width: 30, height: 30, color: '#fff', background: bandGlass.background, border: bandGlass.border }
                return (
                  <div className="relative overflow-hidden" style={{ background: bandBg(color) }}>
                    <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
                    <Icon aria-hidden="true" strokeWidth={1.3}
                          style={{ position: 'absolute', right: 70, bottom: -46, width: 160, height: 160, color: '#fff', opacity: 0.14, transform: 'rotate(-10deg)', pointerEvents: 'none' }} />
                    <div className="relative flex items-start gap-3 px-5 pt-4 pb-4">
                      <span className="grid place-items-center rounded-2xl flex-shrink-0"
                            style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
                        <Icon size={21} style={{ color: '#fff' }} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap" style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>
                          <span>Prompt telemetry</span>
                          {trace && !detail && <span className="rounded-full px-2 py-0.5" style={{ ...bandGlass, fontSize: 8.5 }}>approximate · older trace</span>}
                        </div>
                        <div style={{ fontFamily: FONT.display, fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.1, marginTop: 3 }}>
                          {trace ? (BAND_TITLE[vm.label] ?? vm.label) : 'Loading trace…'}
                        </div>
                        {when && (
                          <div className="flex flex-wrap items-baseline gap-x-2 mt-1" style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>
                            <span style={{ fontWeight: 600 }}>{when.date}</span>
                            <span style={{ fontFamily: FONT.mono }}>{when.time}</span>
                            <span style={{ opacity: 0.8 }}>{when.tz} · {relative(now - when.ms)}</span>
                          </div>
                        )}
                        <div className="inline-flex items-center gap-1 mt-2 rounded-full pl-2.5 pr-1 max-w-full" style={{ height: 24, ...bandGlass }}>
                          <span className="truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>{traceId}</span>
                          <CopyButton t={{ ...t, inkFaint: 'rgba(255,255,255,0.8)', inkDim: '#fff' }} text={traceId} size={10} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button type="button" onClick={load} title="Reload" aria-label="Reload" className="rounded-full grid place-items-center" style={glassBtn}>
                          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                        </button>
                        <button type="button" onClick={onClose} title="Close (Esc)" aria-label="Close" className="rounded-full grid place-items-center" style={glassBtn}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })()}
              {tabs.length > 0 && (
                <nav className="flex gap-1.5 px-4 py-2.5 overflow-x-auto">
                  {tabs.map((x) => {
                    const on = tab === x.id
                    const color = vm === VERDICT_META.blocked ? t.block : vm === VERDICT_META.passed ? t.pass : t.warn
                    return (
                      <button key={x.id} type="button" onClick={() => setTab(x.id)}
                        className="px-3.5 rounded-full whitespace-nowrap inline-flex items-center gap-1.5"
                        style={{
                          height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: on ? 700 : 500,
                          color: on ? '#fff' : t.inkDim, background: on ? bandBg(color) : t.sunken,
                          border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 4px 12px ${color}40` : 'none',
                        }}>
                        {x.alert && <span style={{ width: 6, height: 6, borderRadius: 6, background: on ? '#fff' : t.block }} />}
                        {x.label}
                        {x.count != null && <span style={{ opacity: 0.7, fontFamily: FONT.mono, fontSize: 11 }}>{x.count}</span>}
                      </button>
                    )
                  })}
                </nav>
              )}
            </header>
          ) : (
          <header className="flex-shrink-0 px-5 pt-4 pb-3" style={{ background: t.panel, borderBottom: `1px solid ${t.hairline}` }}>
            <div className="flex items-center gap-2">
              <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Prompt telemetry</span>
              {trace && <Chip t={t} tone={vm.color} solid={trace.verdict === 'BLOCKED'}>{vm.label}</Chip>}
              {trace && !detail && <Chip t={t} tone={t.warn}>approximate · older trace</Chip>}
              <span className="flex-1" />
              <button type="button" onClick={load} title="Reload" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: t.inkDim, background: t.sunken }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              </button>
              <button type="button" onClick={onClose} title="Close (Esc)" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: t.inkDim, background: t.sunken }}>
                <X size={14} />
              </button>
            </div>
            <div className="flex items-center gap-1 mt-1.5 min-w-0">
              <span className="truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.ink }}>{traceId}</span>
              <CopyButton t={t} text={traceId} size={10} />
            </div>
            {when && (
              <div className="flex flex-wrap items-baseline gap-x-2 mt-0.5" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
                <span style={{ color: t.ink, fontWeight: 600 }}>{when.date}</span>
                <span style={{ fontFamily: FONT.mono, color: t.ink }}>{when.time}</span>
                <span style={{ color: t.inkFaint }}>{when.tz}</span>
                <span style={{ color: t.inkFaint }}>· {relative(now - when.ms)}</span>
              </div>
            )}
            {tabs.length > 0 && (
              <nav className="flex gap-1 mt-3 -mb-1 overflow-x-auto">
                {tabs.map((x) => {
                  const on = tab === x.id
                  return (
                    <button key={x.id} type="button" onClick={() => setTab(x.id)}
                      className="px-3 py-1.5 rounded-full whitespace-nowrap inline-flex items-center gap-1.5"
                      style={{ ...LBL, fontSize: 8.5, color: on ? (t.isLight ? '#fff' : t.ground) : t.inkDim, background: on ? t.ink : t.sunken }}>
                      {x.alert && <span style={{ width: 6, height: 6, borderRadius: 6, background: t.block }} />}
                      {x.label}
                      {x.count != null && <span style={{ opacity: 0.6 }}>{x.count}</span>}
                    </button>
                  )
                })}
              </nav>
            )}
          </header>
          )}

          {/* body — the band header's cards (icon squares, prose titles) come
              from TelemetryLook, so every tab switches with it */}
          <TelemetryLook.Provider value={variant === 'band' ? 'launch' : 'classic'}>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading && !trace && (
              <div className="flex items-center justify-center gap-2 py-16" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkFaint }}>
                <Loader2 size={14} className="animate-spin" /> Loading trace…
              </div>
            )}
            {error && (
              <div className="px-4 py-3" style={{ background: `${t.warn}14`, border: `1px solid ${t.warn}40`, borderRadius: 14, fontFamily: FONT.prose, fontSize: 12, color: t.ink }}>
                Could not load this trace: {error}
              </div>
            )}
            {trace && !detail && <LegacyView t={t} trace={trace} verdictMeta={vm} />}
            {trace && detail && (
              <>
                {tab === 'overview' && <OverviewTab t={t} trace={trace} detail={detail} verdictMeta={vm} />}
                {tab === 'timeline' && <TimelineTab t={t} detail={detail} />}
                {tab === 'security' && <SecurityTab t={t} detail={detail} />}
                {tab === 'model' && <ModelTab t={t} detail={detail} />}
                {tab === 'network' && <NetworkTab t={t} detail={detail} />}
                {tab === 'raw' && <RawTab t={t} trace={trace} />}
              </>
            )}
          </div>
          </TelemetryLook.Provider>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
