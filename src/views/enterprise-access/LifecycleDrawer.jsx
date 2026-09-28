import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, KeyRound, AlertTriangle } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { bandBg, bandDots, bandGlass } from '../home-2027/band'
import { TelemetryLook } from '../../components/api-intercept/telemetry/primitives'
import { STEPS, clock, relative } from './accessModel'
import { OverviewTab, AuthorizeTab, CallbackTab, ExchangeTab, ClaimsTab, GraphTab, MintTab, GatewayTab } from './LifecycleSteps'

/**
 * LifecycleDrawer — every artifact from this sign-in, in the telemetry
 * drawer's shape: a band header in the pillar's colour (amber when the
 * sign-in stopped part way), the steps as pills, resizable from its left
 * edge, Esc to close. Opened at a step — and, for the gateway step, at a
 * particular request — from the rail, the journey, a request card or the
 * evidence pane.
 */

const MIN_W = 560
const MAX_W = 1200
const WIDTH_KEY = 'airs.accessLifecycle.width'

export function LifecycleDrawer({ t, tone, a, open, onClose }) {
  const s = a.session ?? {}
  const [tab, setTab] = useState('overview')
  const [callId, setCallId] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY))
    return saved >= MIN_W && saved <= MAX_W ? saved : 820
  })
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)
  const body = useRef(null)

  useEffect(() => {
    if (!open) return
    setTab(open.step ?? 'overview')
    if (open.callId) setCallId(open.callId)
  }, [open?.n]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { body.current?.scrollTo(0, 0) }, [tab, callId])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => { document.removeEventListener('keydown', onKey); clearInterval(id) }
  }, [open, onClose])

  useEffect(() => {
    if (!dragging) return undefined
    const move = (e) => setWidth(Math.max(MIN_W, Math.min(Math.min(MAX_W, window.innerWidth - 80), drag.current.w + (drag.current.x - e.clientX))))
    const up = () => setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging])
  useEffect(() => { if (!dragging) localStorage.setItem(WIDTH_KEY, String(width)) }, [dragging, width])

  const failed = !!s.error && !s.signedIn
  const color = failed ? t.warn : tone
  const Icon = failed ? AlertTriangle : KeyRound
  const L = s.lifecycle ?? {}
  const firstAt = STEPS.map((st) => L[st.id]?.at).find(Boolean)
  const glassBtn = { width: 30, height: 30, color: '#fff', background: bandGlass.background, border: bandGlass.border }
  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...STEPS.map((st) => ({
      id: st.id, label: `${st.n} · ${st.title}`,
      reached: st.id === 'gateway' ? !!L.mint : !!L[st.id],
      count: st.id === 'gateway' && s.calls?.length ? s.calls.length : null,
      alert: s.error?.step === st.id,
    })),
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.aside key="access-lifecycle" role="dialog" aria-label="Token lifecycle"
                      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                      className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
                      style={{ width, background: t.ground, borderLeft: `1px solid ${t.hairline}`, boxShadow: '-18px 0 48px rgba(0,0,0,0.18)', userSelect: dragging ? 'none' : 'auto' }}>
          <div onMouseDown={(e) => { drag.current = { x: e.clientX, w: width }; setDragging(true) }}
               className="absolute top-0 bottom-0 group" style={{ left: -5, width: 10, cursor: 'col-resize', zIndex: 2 }} title="Drag to resize">
            <div className="absolute top-0 bottom-0" style={{ left: 4, width: 2, background: dragging ? tone : 'transparent', transition: 'background .15s' }} />
            <div className="absolute flex flex-col gap-[3px] opacity-60 group-hover:opacity-100" style={{ top: '50%', left: 3, transform: 'translateY(-50%)' }}>
              {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 3, height: 3, borderRadius: 3, background: dragging ? tone : t.inkFaint }} />)}
            </div>
          </div>

          <header className="flex-shrink-0" style={{ background: t.panel, borderBottom: `1px solid ${t.hairline}` }}>
            <div className="relative overflow-hidden" style={{ background: bandBg(color) }}>
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
              <Icon aria-hidden="true" strokeWidth={1.3}
                    style={{ position: 'absolute', right: 90, bottom: -46, width: 160, height: 160, color: '#fff', opacity: 0.14, transform: 'rotate(-10deg)', pointerEvents: 'none' }} />
              <div className="relative flex items-start gap-3 px-5 pt-4 pb-4">
                <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
                  <Icon size={21} style={{ color: '#fff' }} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Token lifecycle · Microsoft Entra ID → AI Gateway</div>
                  <div style={{ fontFamily: FONT.display, fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.1, marginTop: 3 }}>
                    {failed ? 'What was captured before it stopped' : 'Every artifact from this sign-in'}
                  </div>
                  <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 3 }}>
                    {s.user ? <><b>{s.user.name}</b> · <span dir="ltr" style={{ fontFamily: FONT.mono }}>{s.user.email}</span></> : s.error ? `Stopped at the ${s.error.step} step` : 'No sign-in yet'}
                  </div>
                  {firstAt && (
                    <div className="flex flex-wrap items-baseline gap-x-2 mt-1" style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>
                      <span style={{ fontWeight: 600 }}>{new Date(firstAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span style={{ fontFamily: FONT.mono }}>{clock(firstAt)}</span>
                      <span style={{ opacity: 0.8 }}>· {relative(firstAt - now)}</span>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-1.5 mt-2 rounded-full px-2.5" style={{ height: 24, ...bandGlass, fontFamily: FONT.prose, fontSize: 11 }}>
                    Real values from this session · the client secret and refresh token are never recorded
                  </div>
                </div>
                <button type="button" onClick={onClose} title="Close (Esc)" aria-label="Close" className="rounded-full grid place-items-center flex-shrink-0" style={glassBtn}>
                  <X size={14} />
                </button>
              </div>
            </div>
            <nav className="flex gap-1.5 px-4 py-2.5 overflow-x-auto" aria-label="Lifecycle steps">
              {tabs.map((x) => {
                const on = tab === x.id
                return (
                  <button key={x.id} type="button" onClick={() => setTab(x.id)} aria-pressed={on}
                          className="px-3.5 rounded-full whitespace-nowrap inline-flex items-center gap-1.5 flex-shrink-0"
                          style={{
                            height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: on ? 700 : 500,
                            color: on ? '#fff' : x.reached === false ? t.inkFaint : t.inkDim,
                            background: on ? bandBg(color) : t.sunken,
                            border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 4px 12px ${color}40` : 'none',
                          }}>
                    {x.alert && <span style={{ width: 6, height: 6, borderRadius: 6, background: on ? '#fff' : t.warn }} />}
                    {x.label}
                    {x.count != null && <span style={{ opacity: 0.7, fontFamily: FONT.mono, fontSize: 11 }}>{x.count}</span>}
                  </button>
                )
              })}
            </nav>
          </header>

          <TelemetryLook.Provider value="launch">
            <div ref={body} className="flex-1 overflow-y-auto px-5 py-4">
              {tab === 'overview' && <OverviewTab t={t} tone={tone} session={s} now={now} onStep={setTab} />}
              {tab === 'authorize' && <AuthorizeTab t={t} tone={tone} session={s} />}
              {tab === 'callback' && <CallbackTab t={t} tone={tone} session={s} />}
              {tab === 'exchange' && <ExchangeTab t={t} tone={tone} session={s} />}
              {tab === 'claims' && <ClaimsTab t={t} tone={tone} session={s} />}
              {tab === 'graph' && <GraphTab t={t} tone={tone} session={s} />}
              {tab === 'mint' && <MintTab t={t} tone={tone} session={s} config={a.config} />}
              {tab === 'gateway' && <GatewayTab t={t} tone={tone} session={s} callId={callId} onPick={setCallId} />}
            </div>
          </TelemetryLook.Provider>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
