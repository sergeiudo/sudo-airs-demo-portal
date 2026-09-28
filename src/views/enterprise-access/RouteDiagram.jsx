import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Fingerprint, Building2, UserCog, KeyRound, Waypoints, Check, Play, Pause, RotateCcw, Anchor, Workflow,
} from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots } from '../home-2027/band'
import { useGeometry, hCurve, pt, Markers, Wire, deepBand } from '../runtime-launch/diagramKit'
import { ENTRA_BLUE } from './accessModel'

/**
 * RouteDiagram — one request, end to end: the identity sources feed the token
 * broker (this portal), which signs a credential the AI Gateway verifies
 * before it picks the model. The standalone app drew this as one SVG; here it
 * is HTML cards on a grid with wires measured from the cards (the launch
 * design's recipe 13), so the type stays readable in a narrow column.
 *
 * mode="demo"  the sign-in page: plays a standard user, an administrator and
 *              the exempt account in turn, each asking for the same model.
 * mode="live"  the signed-in console: one scenario, built from the user's own
 *              claims and the model picked in the rail. Replays on demand.
 *
 * The sequence is the standalone's, step for step: identity lights, the
 * broker signs, the gateway runs its six checks, the route lights.
 */

const GW = '#EC4899' // the AI Gateway's identity colour across the portal
const CHIPS = ['verify signature', 'read claims', 'config lock', 'match policy', 'route model', 'log identity']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function IdCard({ t, nodeRef, icon: Icon, tone, title, sub, lit, compact }) {
  return (
    <div ref={nodeRef} className="relative flex items-center gap-2.5 min-w-0"
         style={{
           zIndex: 2, padding: compact ? '8px 10px' : '9px 10px', borderRadius: 16, background: lit ? `linear-gradient(120deg, ${tone}1c, ${tone}08), ${t.panel}` : t.panel,
           border: `1px solid ${lit ? `${tone}66` : t.hairline}`, boxShadow: lit ? `0 8px 20px ${tone}24` : t.shadowSm,
           transition: 'border-color 300ms ease, box-shadow 300ms ease, background 300ms ease',
         }}>
      {/* In a narrow column the text needs the icon's room more than the card needs the icon. */}
      {!compact && (
        <span className="grid place-items-center rounded-xl flex-shrink-0"
              style={{ width: 30, height: 30, background: lit ? bandBg(tone) : `${tone}14`, color: lit ? '#fff' : tone, transition: 'background 300ms ease' }}>
          <Icon size={14} aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: compact ? 12.5 : 13, fontWeight: 700, color: lit && compact ? (t.isLight ? shade(tone, 0.2) : tone) : t.ink }}>{title}</span>
        <span className="block truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim, marginTop: 1 }} title={typeof sub === 'string' ? sub : undefined}>{sub}</span>
      </span>
    </div>
  )
}

/** Broker and gateway: soft cards that become their band once the request reaches them. */
function HubCard({ t, nodeRef, icon: Icon, tone, title, sub, hot, compact }) {
  return (
    <div ref={nodeRef} className="relative flex items-center gap-3 overflow-hidden"
         style={{
           zIndex: 2, padding: compact ? '10px 11px' : '12px 14px', borderRadius: 18,
           background: hot ? deepBand(tone) : t.panel,
           border: `1px solid ${hot ? 'transparent' : `${tone}55`}`,
           boxShadow: hot ? `0 12px 26px ${tone}40` : `0 6px 16px ${tone}14`,
           transition: 'background 320ms ease, box-shadow 320ms ease',
         }}>
      {hot && <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />}
      <span className="relative grid place-items-center rounded-xl flex-shrink-0"
            style={{ width: compact ? 28 : 34, height: compact ? 28 : 34, background: hot ? 'rgba(255,255,255,0.18)' : bandBg(tone), border: hot ? '1px solid rgba(255,255,255,0.32)' : 'none' }}>
        <Icon size={compact ? 14 : 16} style={{ color: '#fff' }} aria-hidden="true" />
      </span>
      <span className="relative min-w-0">
        <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: compact ? 13 : 14.5, fontWeight: 700, color: hot ? '#fff' : t.ink }}>{title}</span>
        <span className="block truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: hot ? 'rgba(255,255,255,0.9)' : t.inkDim, marginTop: 1 }}>{sub}</span>
      </span>
    </div>
  )
}

function Chip({ t, on, children, compact }) {
  const ink = t.isLight ? shade(GW, 0.3) : '#F9A8D4'
  return (
    <span className="flex items-center justify-center gap-1 rounded-full min-w-0"
          style={{
            height: compact ? 24 : 26, padding: compact ? '0 3px' : '0 8px', fontFamily: FONT.mono, fontSize: compact ? 9 : 10.5, whiteSpace: 'nowrap',
            color: on ? ink : t.inkDim, background: on ? `${GW}17` : t.sunken,
            border: `1px solid ${on ? `${GW}66` : t.hairline}`, transition: 'all 260ms ease',
          }}>
      {on && !compact && <Check size={10} strokeWidth={3} aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </span>
  )
}

function Eyebrow({ t, col, children }) {
  return <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, marginBottom: 8, gridColumn: col, gridRow: 1, alignSelf: 'end' }}>{children}</div>
}

export function RouteDiagram({ t, tone, config, mode = 'demo', scenarios = [], live, framed = true }) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/:/g, '')
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(mode === 'demo' && !reduce)
  const [phase, setPhase] = useState(reduce ? 99 : 0)
  const [replay, setReplay] = useState(0)
  const run = useRef(0)
  // Read at the end of a pass rather than listed as a dependency: Pause must
  // stop the loop advancing, not restart the pass that is playing.
  const playingRef = useRef(playing)
  playingRef.current = playing
  const paths = useRef({})
  const dotA = useRef(null)
  const dotB = useRef(null)
  const bindPath = (k) => (el) => { if (el) paths.current[k] = el }

  const sc = mode === 'live' ? live : scenarios[idx % Math.max(1, scenarios.length)]
  const models = config?.models ?? []

  // The rows on the targets card: every scenario's answer (or, live, the
  // answer and the pick), then a count of the rest.
  const rows = useMemo(() => {
    const ids = mode === 'live'
      ? [sc?.winner, sc?.requested, ...(config?.policy?.targets ?? []).map((x) => x.override_params?.model)]
      : [...scenarios.map((s) => s.winner), scenarios[0]?.requested]
    const uniq = [...new Set(ids.filter(Boolean))].slice(0, 3)
    return uniq.map((id) => ({ id, label: models.find((m) => m.id === id)?.label ?? id }))
  }, [mode, sc?.winner, sc?.requested, scenarios, config, models])
  const more = Math.max(0, models.length - rows.length)
  const winIdx = rows.findIndex((r) => r.id === sc?.winner)

  const { root, bind, geo } = useGeometry([rows.length, !!sc, more])
  const ready = !!geo?.broker
  // The signed-in console puts this in a ~650px column; the sign-in page gives it ~1200.
  const compact = (geo?.w ?? 1000) < 820

  const travel = useCallback((key, dot, ms, alive) => new Promise((resolve) => {
    const path = paths.current[key]
    const el = dot.current
    if (!path || !el) { resolve(); return }
    const len = path.getTotalLength()
    const t0 = performance.now()
    const step = (now) => {
      if (!alive()) { el.setAttribute('opacity', 0); resolve(); return }
      const k = Math.min(1, (now - t0) / ms)
      const p = path.getPointAtLength(len * k)
      el.setAttribute('cx', p.x)
      el.setAttribute('cy', p.y)
      el.setAttribute('opacity', 1)
      if (k < 1) requestAnimationFrame(step)
      else { el.setAttribute('opacity', 0); resolve() }
    }
    requestAnimationFrame(step)
  }), [])

  // One pass of the sequence per (scenario, replay). A new pass cancels the old one.
  useEffect(() => {
    if (!ready || !sc) return undefined
    const token = ++run.current
    const alive = () => token === run.current
    if (reduce) { setPhase(99); return () => { run.current++ } }
    let next = null
    ;(async () => {
      setPhase(0)
      await sleep(250)
      for (let i = 0; i < 3; i++) {
        if (!alive()) return
        setPhase(i + 1)
        travel(`id${i}`, dotA, 620, alive)
        await sleep(190)
      }
      await sleep(430); if (!alive()) return
      setPhase(4)
      await sleep(320); if (!alive()) return
      setPhase(5)
      await travel('hub', dotB, 380, alive); if (!alive()) return
      setPhase(6)
      for (let k = 0; k < CHIPS.length; k++) {
        await sleep(170); if (!alive()) return
        setPhase(7 + k)
      }
      await sleep(200); if (!alive()) return
      setPhase(13)
      await travel(`t${winIdx}`, dotB, 620, alive); if (!alive()) return
      setPhase(14)
      if (mode === 'demo' && playingRef.current && scenarios.length > 1) {
        next = setTimeout(() => { if (alive()) setIdx((i) => (i + 1) % scenarios.length) }, 2600)
      }
    })()
    return () => { run.current++; clearTimeout(next) }
  }, [ready, idx, replay, winIdx, sc?.key, sc?.winner, reduce]) // eslint-disable-line react-hooks/exhaustive-deps

  // Play after a pause: if the pass already finished, move on to the next person.
  useEffect(() => {
    if (!playing || mode !== 'demo' || phase < 14 || scenarios.length < 2) return undefined
    const id = setTimeout(() => setIdx((i) => (i + 1) % scenarios.length), 700)
    return () => clearTimeout(id)
  }, [playing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stop while the tab is hidden; resume where it was.
  useEffect(() => {
    if (mode !== 'demo') return undefined
    let pausedByHide = false
    const onVis = () => {
      if (document.hidden && playing) { pausedByHide = true; setPlaying(false) }
      else if (!document.hidden && pausedByHide) { pausedByHide = false; setPlaying(true) }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [mode, playing])

  if (!sc) return null
  const accentInk = t.isLight ? shade(tone, 0.25) : tone
  const lit = (p) => phase >= p

  // ── wires ──
  let wires = null
  if (geo?.broker && geo.gw) {
    const b = geo.broker
    const g = geo.gw
    const idWires = [0, 1, 2].map((i) => {
      const a = geo[`id${i}`]
      if (!a) return null
      return { key: `id${i}`, ...hCurve(a.r + 4, a.cy, b.x - 7, b.cy + (i - 1) * 9), live: lit(i + 1) }
    }).filter(Boolean)
    const hub = { key: 'hub', d: `M${pt(b.cx, b.b + 3)} L${pt(g.cx, g.y - 7)}`, live: lit(5) }
    const targets = [...rows.map((_, i) => i), ...(more ? [rows.length] : [])].map((i) => {
      const m = geo[`m${i}`]
      if (!m) return null
      return { key: `t${i}`, ...hCurve(g.r + 4, g.cy, m.x - 7, m.cy), live: lit(13) && i === winIdx }
    }).filter(Boolean)
    const tr = geo.trust
    const trust = tr ? hCurve(tr.x - 6, tr.cy, g.r + 6, g.b - 12) : null
    wires = (
      <svg aria-hidden="true" className="absolute inset-0 pointer-events-none" width={geo.w} height={geo.h} style={{ zIndex: 1, overflow: 'visible' }}>
        <Markers id={uid} colors={{ idle: t.inkFaint, route: GW, live: t.inkDim }} />
        {idWires.map((w) => (
          <path key={w.key} ref={bindPath(w.key)} d={w.d} fill="none" stroke={w.live ? t.inkDim : t.inkFaint}
                strokeOpacity={w.live ? 0.85 : 0.4} strokeWidth={1.5} strokeLinecap="round" style={{ transition: 'stroke 300ms, stroke-opacity 300ms' }} />
        ))}
        <path ref={bindPath('hub')} d={hub.d} fill="none" stroke={hub.live ? GW : t.inkFaint} strokeOpacity={hub.live ? 0.9 : 0.45}
              strokeWidth={1.6} markerEnd={`url(#${uid}-${hub.live ? 'route' : 'idle'})`} />
        {targets.map((w) => (
          <path key={w.key} ref={bindPath(w.key)} d={w.d} fill="none" stroke={w.live ? GW : t.inkFaint}
                strokeOpacity={w.live ? 0.95 : 0.35} strokeWidth={w.live ? 2 : 1.3} strokeLinecap="round"
                markerEnd={w.live ? `url(#${uid}-route)` : undefined} style={{ transition: 'stroke 300ms, stroke-opacity 300ms' }} />
        ))}
        {trust && <Wire d={trust.d} color={t.inkFaint} opacity={0.6} dashed width={1.3} />}
        <circle ref={dotA} r={4} fill={t.inkDim} opacity={0} />
        <circle ref={dotB} r={4.5} fill={GW} opacity={0} style={{ filter: `drop-shadow(0 0 5px ${GW})` }} />
      </svg>
    )
  }

  // ── the story under the diagram ──
  const r = sc.rule
  const story = r?.why === 'exempt'
    ? <>This address is exempt from routing, so the gateway forwards the request untouched to <b style={{ color: t.ink }}>{sc.winnerLabel}</b>.</>
    : r?.why === 'default'
    ? <>No rule matches, so the request falls through to the most restricted route: <b style={{ color: t.ink }}>{sc.winnerLabel}</b>.</>
    : sc.winner === sc.requested
    ? <>The signed token says <b style={{ color: t.ink }}>user_role: {r?.value}</b>, and the policy pins that role to <b style={{ color: t.ink }}>{sc.winnerLabel}</b> — which is what was asked for.</>
    : <>The signed token says <b style={{ color: t.ink }}>user_role: {r?.value}</b>, so the gateway replaces the choice and answers with <b style={{ color: accentInk }}>{sc.winnerLabel}</b>.</>

  const body = (
    <>
      <div ref={root} className="relative" style={{
        display: 'grid', alignItems: 'center',
        gridTemplateColumns: compact
          ? 'minmax(0,1fr) minmax(22px,0.14fr) minmax(0,1.3fr) minmax(22px,0.16fr) minmax(0,1.05fr)'
          : 'minmax(0,1fr) minmax(34px,0.26fr) minmax(0,1.3fr) minmax(34px,0.3fr) minmax(0,1.1fr)',
      }}>
        {wires}

        <Eyebrow t={t} col={1}>Identity</Eyebrow>
        <Eyebrow t={t} col={3}>Broker and gateway</Eyebrow>
        <Eyebrow t={t} col={5}>Targets</Eyebrow>

        {/* identity */}
        <div className="min-w-0 flex flex-col gap-2.5" style={{ gridColumn: 1, gridRow: 2 }}>
          <IdCard t={t} compact={compact} nodeRef={bind('id0')} icon={Fingerprint} tone={ENTRA_BLUE} title="Microsoft Entra" sub={sc.tenant ?? `tenant ${config?.entra?.tenantShort ?? '—'}`} lit={lit(1)} />
          <IdCard t={t} compact={compact} nodeRef={bind('id1')} icon={Building2} tone={ENTRA_BLUE} title="Microsoft Graph" sub={sc.department ? `department: ${sc.department}` : 'department'} lit={lit(2)} />
          <IdCard t={t} compact={compact} nodeRef={bind('id2')} icon={UserCog} tone={tone} title="App role" sub={mode === 'live' ? `user_role: ${sc.role}` : `${sc.who} · ${sc.role}`} lit={lit(3)} />
        </div>

        {/* broker and gateway */}
        <div className="min-w-0" style={{ gridColumn: 3, gridRow: 2 }}>
          <div className="rounded-3xl" style={{ padding: compact ? 8 : 12, border: `1.5px dashed ${tone}55`, background: `${tone}06` }}>
            <HubCard t={t} compact={compact} nodeRef={bind('broker')} icon={KeyRound} tone={tone} title="Token broker"
                     sub={`${compact ? '' : 'rs256 · '}kid ${config?.key?.kidShort ?? '—'}`} hot={lit(4)} />
            <div style={{ height: 30 }} />
            <HubCard t={t} compact={compact} nodeRef={bind('gw')} icon={Waypoints} tone={GW} title="AIRS AI Gateway"
                     sub={`org ${config?.gateway?.orgShort ?? '—'}`} hot={lit(6)} />
            <div className="grid gap-1.5 mt-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {CHIPS.map((c, k) => <Chip key={c} t={t} compact={compact} on={lit(7 + k)}>{c}</Chip>)}
            </div>
          </div>
        </div>

        {/* targets */}
        <div className="min-w-0" style={{ gridColumn: 5, gridRow: 2 }}>
          <div className="rounded-2xl" style={{ padding: '10px 6px 8px', background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm }}>
            <div className="truncate px-2 pb-1.5" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }}>models · {config?.provider}</div>
            {rows.map((m, i) => {
              const win = lit(14) && i === winIdx
              const asked = m.id === sc.requested
              return (
                <div key={m.id} ref={bind(`m${i}`)} className="flex items-center gap-2 rounded-xl"
                     style={{ padding: compact ? '6px 6px' : '7px 8px', background: win ? `${tone}17` : 'transparent', transition: 'background 300ms ease' }}>
                  <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: win ? tone : t.inkFaint }} aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate" style={{ fontFamily: FONT.prose, fontSize: compact ? 12 : 13, fontWeight: win ? 700 : 500, color: win ? accentInk : t.inkDim }}>{m.label}</span>
                  {asked && !win && !compact && <span className="rounded-full px-1.5 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 10, color: t.inkDim, background: t.sunken }}>asked</span>}
                  {win && <Check size={13} strokeWidth={3} style={{ color: accentInk, flexShrink: 0 }} aria-hidden="true" />}
                </div>
              )
            })}
            {more > 0 && (
              <div ref={bind(`m${rows.length}`)} className="px-2 py-1.5" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkFaint }}>
                and {more} more model{more === 1 ? '' : 's'}
              </div>
            )}
          </div>
          <div ref={bind('trust')} className="rounded-2xl mt-2.5" style={{ padding: '9px 12px', background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm }}>
            <div className="flex items-center gap-1.5" style={{ ...LBL, fontSize: 9, color: t.inkDim }}>
              <Anchor size={11} aria-hidden="true" /> Trust anchor
            </div>
            <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 3 }}>{compact ? 'JWKS at the gateway' : 'JWKS registered at the gateway'}</div>
            <div className="truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.ink, marginTop: 1 }}>{config?.configId ?? '—'}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4 rounded-2xl" style={{ padding: '10px 12px', background: t.sunken, border: `1px solid ${t.hairline}`, minHeight: 50 }}>
        <span className="rounded-full px-2.5 flex-shrink-0 whitespace-nowrap"
              style={{ height: 24, lineHeight: '24px', fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 700, color: '#fff', background: bandBg(tone) }}>
          {mode === 'live' ? 'You' : sc.tag}
        </span>
        <motion.p key={`${sc.key}-${sc.winner}`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                  style={{ fontFamily: FONT.prose, fontSize: 13, lineHeight: 1.5, color: t.inkDim, margin: 0 }}>
          <b style={{ color: t.ink }}>{mode === 'live' ? 'You pick' : `${sc.who} picks`}</b> {sc.requestedLabel}. {story}
        </motion.p>
      </div>
    </>
  )

  if (!framed) return body

  return (
    <section className="p-4" style={glass(t, { radius: 22 })}>
      <header className="flex items-center gap-3 flex-wrap mb-4">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 34, height: 34, background: bandBg(tone), boxShadow: `0 5px 12px ${tone}55` }}>
          <Workflow size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div className="min-w-0 mr-auto">
          <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink }}>{mode === 'live' ? 'Your route, from your own claims' : 'Watch a request'}</div>
          <div style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>
            {mode === 'live' ? 'What the gateway will do with the model picked in the rail' : 'Everyone asks for the same model. Only who they are changes the answer.'}
          </div>
        </div>
        {mode === 'demo' && scenarios.length > 1 && (
          <div role="radiogroup" aria-label="Scenario" className="flex items-center gap-1.5 flex-wrap">
            {scenarios.map((s, i) => {
              const on = i === idx
              return (
                <button key={s.key} type="button" role="radio" aria-checked={on}
                        onClick={() => { setPlaying(false); setIdx(i); setReplay((n) => n + 1) }}
                        className="rounded-full px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                        style={{
                          height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: on ? 700 : 500,
                          color: on ? '#fff' : t.inkDim, background: on ? bandBg(tone) : t.sunken,
                          border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 4px 12px ${tone}40` : 'none',
                        }}>
                  {s.tag}
                </button>
              )
            })}
          </div>
        )}
        <button type="button"
                onClick={() => (mode === 'demo' ? setPlaying((p) => !p) : setReplay((n) => n + 1))}
                className="inline-flex items-center gap-1.5 rounded-full px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, background: t.panel, border: `1px solid ${t.hairline}` }}>
          {mode === 'live' ? <><RotateCcw size={12} aria-hidden="true" /> Replay</>
            : playing ? <><Pause size={12} aria-hidden="true" /> Pause</> : <><Play size={12} aria-hidden="true" /> Play</>}
        </button>
      </header>
      {body}
    </section>
  )
}

export const GATEWAY_TONE = GW
