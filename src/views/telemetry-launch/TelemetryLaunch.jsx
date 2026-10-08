import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { LayoutDashboard, ScrollText, Loader2, Pause, Play } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { tokens, FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { Handle } from '../api-intercept-2027/PaneHandle'
import { PillarHeader } from '../../components/layout/PillarHeader'
import { PromptTelemetryDrawer } from '../../components/api-intercept/PromptTelemetryDrawer'
import { useOverview, useLiveStream, useWire, useLog } from './useTelemetry'
import { TrafficFlow } from './TrafficFlow'
import { Hero, Caught, Coverage, EnforcementPoints } from './Overview'
import { TrafficChart, CostOfProtection } from './Charts'
import { LiveWire } from './LiveWire'
import { PromptLog } from './PromptLog'
import { WINDOWS, TARGET_ORDER, targetMeta, inkOn } from './telemetryModel'

/**
 * TelemetryLaunch — LLM Telemetry in the launch design.
 *
 * The classic view was a dashboard of charts polled every five seconds. This
 * one answers a presenter's question first — what did AIRS just do, and
 * where — and is live: the server pushes every trace the moment it is
 * written, the flow diagram runs it along the path it took, and the wire on
 * the right lists it. Every number is computed from the trace store with the
 * window applied (the classic KPIs ignored it), and blocks are placed at the
 * stage that actually decided them.
 *
 * Classic (ObservabilityView) is untouched and stays behind the Design switch.
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
const WINDOW_KEY = 'sudo-airs.telemetry.window'
const TARGET_KEY = 'sudo-airs.telemetry.target'
const read = (k, ok, d) => { try { const v = localStorage.getItem(k); return v != null && ok(v) ? v : d } catch { return d } }

/** The header's one control: the stream's state, which is also its pause switch. */
function LiveActions({ t, tone, status, paused, onToggle }) {
  const reduce = useReducedMotion()
  const live = status === 'live'
  const dot = live ? t.pass : paused ? t.idle : t.warn
  const label = paused ? 'Paused' : live ? 'Live' : status === 'unsupported' ? 'No stream' : 'Connecting'
  return (
    <button type="button" onClick={onToggle} aria-pressed={!paused}
            title={paused ? 'Resume the live stream' : 'Pause the live stream — counts still refresh every minute'}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-full pl-2.5 pr-3 whitespace-nowrap transition-transform active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 700, color: shade(tone), background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.18)' }}>
      <span className="relative flex" style={{ width: 8, height: 8 }} aria-hidden="true">
        {live && !reduce && (
          <motion.span className="absolute inset-0 rounded-full" style={{ background: dot }}
                       animate={{ scale: [1, 2.3], opacity: [0.55, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />
        )}
        <span className="relative rounded-full" style={{ width: 8, height: 8, background: dot }} />
      </span>
      {label}
      {paused ? <Play size={11} style={{ opacity: 0.6 }} aria-hidden="true" /> : <Pause size={11} style={{ opacity: 0.6 }} aria-hidden="true" />}
    </button>
  )
}

function Pill({ t, on, tone, onClick, children, title, role = 'radio' }) {
  return (
    <button type="button" role={role} aria-checked={role === 'radio' ? on : undefined} aria-pressed={role === 'radio' ? undefined : on}
            onClick={onClick} title={title}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 flex-shrink-0 whitespace-nowrap ${focusCls}`}
            style={{
              height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: on ? 700 : 500,
              color: on ? '#fff' : t.inkDim, background: on ? bandBg(tone) : t.panel,
              border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 4px 12px ${tone}40` : 'none',
              transition: 'background 160ms ease, color 160ms ease',
            }}>
      {children}
    </button>
  )
}

export function TelemetryLaunch() {
  const { state, dispatch } = useAppContext()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const tone = '#22C55E' // the pillar's accent (HOME_PILLARS observability)

  const [tab, setTab] = useState('overview')
  const [win, setWin] = useState(() => read(WINDOW_KEY, (v) => WINDOWS.some((w) => w.id === v), '24h'))
  const [target, setTarget] = useState(() => read(TARGET_KEY, (v) => v === '' || TARGET_ORDER.includes(v), ''))
  useEffect(() => { try { localStorage.setItem(WINDOW_KEY, win); localStorage.setItem(TARGET_KEY, target) } catch { /* private mode */ } }, [win, target])

  const [paused, setPaused] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [logFilter, setLogFilter] = useState({ outcome: '', family: '', q: '' })
  const [arrived, setArrived] = useState(0)
  const [rightW, setRightW] = useState(372)
  const [dragR, setDragR] = useState(false)

  const overview = useOverview(win, target)
  const wire = useWire(target)
  const log = useLog({ target, ...logFilter })
  const flow = useRef(null)
  // A tab opens at its top — the log's filters, not the overview's scroll depth.
  const scroller = useRef(null)
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }) }, [tab])

  // Counts refresh a beat after a burst settles — after the dots have landed,
  // so a counter never ticks before the packet that explains it arrives.
  const refreshTimer = useRef(0)
  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => overview.refresh(), 2200)
  }, [overview.refresh]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(refreshTimer.current), [])

  const status = useLiveStream({
    target,
    paused,
    onTrace: (s) => {
      wire.push(s)
      log.offer(s)
      flow.current?.send(s)
      setArrived((n) => n + 1)
      scheduleRefresh()
    },
    onDelete: (id) => { wire.remove(id); log.remove(id); scheduleRefresh() },
    onReset: () => { wire.reload(); log.reload(); overview.refresh() },
  })
  useEffect(() => { setArrived(0) }, [target])

  // A trace picked in another pillar ("Open in LLM Telemetry") opens here.
  useEffect(() => {
    if (state.selectedTraceId) {
      setOpenId(state.selectedTraceId)
      dispatch({ type: 'SET_SELECTED_TRACE', payload: null })
    }
  }, [state.selectedTraceId, dispatch])

  const openLog = useCallback((f) => {
    setLogFilter({ outcome: f.outcome ?? '', family: f.family ?? '', q: f.q ?? '' })
    setTab('log')
  }, [])

  const deleteOne = useCallback(async (id) => {
    await fetch(`/api/traces/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (openId === id) setOpenId(null)
    wire.remove(id); log.remove(id); scheduleRefresh()
  }, [openId, wire, log, scheduleRefresh])
  const clearAll = useCallback(async () => {
    await fetch('/api/traces', { method: 'DELETE' })
    setOpenId(null)
    wire.reload(); log.reload(); overview.refresh()
  }, [wire, log, overview])

  const data = overview.data
  const presentTargets = TARGET_ORDER

  return (
    <div className="relative flex flex-col h-full overflow-hidden"
         style={{ background: t.ground, cursor: dragR ? 'col-resize' : 'default', userSelect: dragR ? 'none' : 'auto' }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
        backgroundSize: '44px 44px',
      }} />

      <PillarHeader pillarId="observability"
                    actions={(
                      <>
                        <LiveActions t={t} tone={tone} status={status} paused={paused} onToggle={() => setPaused((p) => !p)} />
                      </>
                    )} />

      <div className="relative flex-1 min-h-0 flex">
        <div ref={scroller} className="relative flex-1 min-w-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
          {/* Scope — one row of pills above everything they scope. */}
          <div className="sticky top-0 z-20 px-4 pt-3 pb-2.5 mb-1" style={{ background: t.ground, boxShadow: `0 10px 14px -12px ${t.isLight ? 'rgba(18,18,22,0.28)' : 'rgba(0,0,0,0.7)'}` }}>
            <div className="flex items-center gap-2 flex-wrap">
              <div role="tablist" aria-label="View" className="flex items-center gap-1 rounded-full p-1" style={{ background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm }}>
                {[['overview', 'Overview', LayoutDashboard], ['log', 'Prompt log', ScrollText]].map(([id, label, Icon]) => {
                  const on = tab === id
                  return (
                    <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setTab(id)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 ${focusCls}`}
                            style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: on ? 700 : 500, color: on ? '#fff' : t.inkDim,
                                     background: on ? bandBg(tone) : 'transparent', boxShadow: on ? `0 4px 12px ${tone}40` : 'none' }}>
                      <Icon size={13} aria-hidden="true" /> {label}
                    </button>
                  )
                })}
              </div>
              {tab === 'overview' && (
                <div role="radiogroup" aria-label="Time window" className="flex items-center gap-1.5 ml-auto flex-wrap">
                  {WINDOWS.map((w) => <Pill key={w.id} t={t} on={win === w.id} tone={t.live} onClick={() => setWin(w.id)}>{w.label}</Pill>)}
                </div>
              )}
            </div>
            <div role="radiogroup" aria-label="Target" className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              <span className="flex-shrink-0 mr-1" style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Target</span>
              <Pill t={t} on={!target} tone={t.live} onClick={() => setTarget('')}>Every target</Pill>
              {presentTargets.map((id) => {
                const m = targetMeta(id)
                const on = target === id
                return (
                  <Pill key={id} t={t} on={on} tone={m.tone} onClick={() => setTarget(on ? '' : id)} title={m.how}>
                    <span className="rounded-full" style={{ width: 7, height: 7, background: on ? '#fff' : m.tone }} aria-hidden="true" />
                    {m.label}
                  </Pill>
                )
              })}
            </div>
          </div>

          <div className="px-4 pb-6">
            {tab === 'overview' ? (
              !data ? (
                <div className="flex items-center gap-2 py-16 justify-center" style={{ fontFamily: FONT.prose, fontSize: 13, color: overview.error ? inkOn(t, t.warn, 0.4) : t.inkDim }}>
                  {overview.error ? `Could not load telemetry: ${overview.error}` : <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Reading the trace store…</>}
                </div>
              ) : (
                <div className="space-y-3">
                  <Hero t={t} data={data} win={win} target={target} onWindow={setWin} />
                  <TrafficFlow ref={flow} t={t} data={data} target={target} win={win} recent={wire.items} live={status === 'live'} />
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
                    <Caught t={t} data={data} onOpenLog={openLog} />
                    <Coverage t={t} data={data} onOpenLog={openLog} />
                  </div>
                  <EnforcementPoints t={t} data={data} target={target} onScope={setTarget} />
                  <TrafficChart t={t} data={data} />
                  <CostOfProtection t={t} data={data} />
                </div>
              )
            ) : (
              <PromptLog t={t} log={log} filter={logFilter} setFilter={setLogFilter} target={target}
                         onOpen={setOpenId} openId={openId} onDelete={deleteOne} onClearAll={clearAll} />
            )}
          </div>
        </div>

        <Handle t={t} side="right" dragging={dragR} onDrag={{ width: rightW, setWidth: setRightW, setDragging: setDragR }} />
        <div className="relative flex-shrink-0 overflow-hidden py-3 pr-3" style={{ width: rightW }}>
          <LiveWire t={t} wire={wire} status={status} arrived={arrived} onOpen={setOpenId} openId={openId}
                    onGoRuntime={() => dispatch({ type: 'SET_VIEW', payload: 'apiIntercept' })} />
        </div>
      </div>

      <PromptTelemetryDrawer traceId={openId} onClose={() => setOpenId(null)} variant="band" />
    </div>
  )
}
