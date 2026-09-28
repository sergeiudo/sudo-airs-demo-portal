import React, { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Send, ScanLine, Cpu, ShieldX, ShieldCheck, ShieldOff, Wrench, EyeOff, Workflow, Play, Square, Radio } from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { bandBg, bandDots } from '../home-2027/band'
import { useGeometry, hCurve, vCurve, pt, Markers, Wire, WirePill, deepBand } from '../runtime-launch/diagramKit'
import { targetMeta, routeOf, restOf, fmtCount, fmtPct, windowLong, outcomeLine, modelTail, inkOn } from './telemetryModel'
import { useCountUp } from './useTelemetry'

/**
 * TrafficFlow — where every prompt in the window went, drawn as the path it
 * took: the prompt scan, the model, the response scan, and where each one
 * stopped. Cards are HTML on a grid; wires are measured from the cards
 * (recipe 13) and their width is the share of traffic that took them.
 *
 * It is live. Every trace the server writes arrives over the stream and rides
 * its own route as a dot — blue until AIRS has decided, then green, vermilion
 * or amber by the wire it takes — and the card it comes to rest on flashes.
 * Every dot is a real trace; "Replay" re-runs the latest ones, labelled as a
 * replay, and changes no counts.
 */

const MODEL_NEUTRAL = '#52525B'
const SPEED = 0.42 // px per ms
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function wireTone(t, key) {
  if (key === 'in') return t.live
  if (key === 'skip' || key === 'unscanned') return t.warn
  if (key.startsWith('stop')) return t.block
  return t.pass
}

function FlowNode({ t, nodeRef, kind, tone, icon: Icon, title, count, sub, pill, dim, flash, compact, reduce, style }) {
  const n = useCountUp(count, { reduce })
  const band = kind === 'model'
  const gap = kind === 'gap'
  const box = band
    ? { background: deepBand(tone), border: '1px solid transparent', boxShadow: `0 12px 26px ${tone}40` }
    : gap
    ? { background: t.panel, border: `1.5px dashed ${t.warn}8c`, boxShadow: 'none' }
    : kind === 'stop' || kind === 'pass'
    ? { background: `linear-gradient(135deg, ${tone}1f, ${tone}08), ${t.panel}`, border: `1px solid ${tone}59`, boxShadow: `0 8px 20px ${tone}1c` }
    : kind === 'scan'
    ? { background: t.panel, border: `1px solid ${tone}55`, boxShadow: `0 8px 20px ${tone}1f` }
    : { background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm }
  const ink = band ? '#fff' : t.ink
  const iconBox = band
    ? { background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }
    : gap
    ? { background: `${t.warn}17`, color: inkOn(t, t.warn, 0.38) }
    : { background: bandBg(tone), color: '#fff', boxShadow: `0 5px 12px ${tone}55` }
  return (
    <div ref={nodeRef} className="relative min-w-0 overflow-hidden"
         style={{ zIndex: 2, borderRadius: 18, padding: compact ? '9px 9px 10px' : '11px 12px 12px', opacity: dim ? 0.55 : 1, transition: 'opacity 300ms ease', ...box, ...style }}>
      {band && <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />}
      <AnimatePresence>
        {flash && (
          <motion.span key={flash} aria-hidden="true" className="absolute inset-0 pointer-events-none"
                       initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut' }}
                       style={{ borderRadius: 18, boxShadow: `inset 0 0 0 2px ${tone}, inset 0 0 26px ${tone}55` }} />
        )}
      </AnimatePresence>
      <div className="relative flex items-center gap-2 min-w-0">
        {!compact && (
          <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 28, height: 28, ...iconBox }}>
            <Icon size={14} aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 flex-1" title={title}
              style={{ fontFamily: FONT.display, fontSize: compact ? 11.5 : 12.5, fontWeight: 700, lineHeight: 1.15, color: gap ? inkOn(t, t.warn, 0.4) : ink,
                       display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {title}
        </span>
      </div>
      <div className="relative flex items-baseline gap-1.5 min-w-0" style={{ marginTop: compact ? 5 : 7 }}>
        <span style={{ fontFamily: FONT.display, fontSize: compact ? 20 : 25, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: ink }}>
          {fmtCount(n)}
        </span>
        {pill && (
          <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: band ? 'rgba(255,255,255,0.88)' : t.inkDim }}>{pill}</span>
        )}
      </div>
      {sub && (
        <div className="relative" title={typeof sub === 'string' ? sub : undefined}
             style={{ fontFamily: FONT.prose, fontSize: compact ? 10.5 : 11, lineHeight: 1.35, marginTop: 4, color: band ? 'rgba(255,255,255,0.9)' : t.inkDim,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

/** One trace riding its route: rAF along the measured paths, no React render per frame. */
function PacketDot({ t, packet, paths, onArrive, onDone }) {
  const g = useRef(null)
  const dot = useRef(null)
  const halo = useRef(null)
  useEffect(() => {
    let alive = true
    let raf = 0
    const run = async () => {
      for (const key of packet.route) {
        const path = paths.current[key]
        if (!alive) return
        if (!path) continue
        const color = wireTone(t, key)
        dot.current?.setAttribute('fill', color)
        halo.current?.setAttribute('fill', color)
        const len = path.getTotalLength()
        const dur = Math.max(260, len / SPEED)
        await new Promise((resolve) => {
          const t0 = performance.now()
          const step = (now) => {
            if (!alive) { resolve(); return }
            const k = Math.min(1, (now - t0) / dur)
            const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
            const p = path.getPointAtLength(len * e)
            g.current?.setAttribute('transform', `translate(${p.x},${p.y})`)
            g.current?.setAttribute('opacity', '1')
            if (k < 1) raf = requestAnimationFrame(step)
            else resolve()
          }
          raf = requestAnimationFrame(step)
        })
      }
      if (!alive) return
      onArrive(packet)
      g.current?.setAttribute('opacity', '0')
      await sleep(60)
      onDone(packet.pid)
    }
    run()
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <g ref={g} opacity={0}>
      <circle ref={halo} r={11} opacity={0.22} />
      <circle ref={dot} r={5} stroke={t.panel} strokeWidth={2} />
    </g>
  )
}

export const TrafficFlow = forwardRef(function TrafficFlow({ t, data, target, win, recent = [], live }, ref) {
  const reduce = useReducedMotion()
  const uid = useId().replace(/:/g, '')
  const totals = data?.totals
  const meta = target ? targetMeta(target) : null
  const modelTone = meta?.tone ?? MODEL_NEUTRAL
  const gateway = meta?.where === 'gateway'

  const paths = useRef({})
  const bindPath = (k) => (el) => { if (el) paths.current[k] = el; else delete paths.current[k] }
  const [packets, setPackets] = useState([])
  const [flash, setFlash] = useState({})
  const [last, setLast] = useState(null)
  const [replay, setReplay] = useState(null) // { i, n } while replaying
  const replayRun = useRef(0)
  const pid = useRef(0)

  const { root, bind, geo } = useGeometry([!!totals])
  const compact = (geo?.w ?? 1000) < 760

  const launch = useCallback((s, { replayed = false } = {}) => {
    if (reduce) {
      setFlash((f) => ({ ...f, [restOf(s)]: Date.now() }))
      setLast({ s, replayed })
      return
    }
    setPackets((l) => (l.length > 14 ? l : [...l, { pid: ++pid.current, route: routeOf(s), rest: restOf(s), s, replayed }]))
  }, [reduce])

  useImperativeHandle(ref, () => ({ send: (s) => launch(s) }), [launch])

  const onArrive = useCallback((p) => {
    setFlash((f) => ({ ...f, [p.rest]: Date.now() }))
    setLast({ s: p.s, replayed: p.replayed })
  }, [])
  const onDone = useCallback((id) => setPackets((l) => l.filter((p) => p.pid !== id)), [])

  const startReplay = useCallback(async () => {
    const token = ++replayRun.current
    const list = recent.slice(0, 20).reverse()
    for (let i = 0; i < list.length; i++) {
      if (token !== replayRun.current) return
      setReplay({ i: i + 1, n: list.length })
      launch(list[i], { replayed: true })
      await sleep(reduce ? 500 : 420)
    }
    await sleep(2200)
    if (token === replayRun.current) setReplay(null)
  }, [recent, launch, reduce])
  const stopReplay = useCallback(() => { replayRun.current++; setReplay(null) }, [])
  useEffect(() => () => { replayRun.current++ }, [])

  if (!totals) return null

  const st = totals.stages
  const notInspected = totals.off + totals.failopen + st.native
  const seg = {
    in: totals.inspected,
    stopIn: st.input,
    toModel: totals.inspected - st.input,
    stopTool: st.tool,
    toOut: totals.inspected - st.input - st.tool,
    stopOut: st.output,
    clear: totals.cleared,
    skip: notInspected,
    unscanned: totals.off + totals.failopen,
  }
  const width = (n) => (n > 0 ? 1.8 + 11 * Math.sqrt(n / Math.max(1, totals.traces)) : 1.2)

  // ── wires, from the measured cards ──
  const g = geo
  const wires = []
  if (g?.src && g.scan && g.model && g.out && g.clear) {
    const straight = (a, b) => `M${pt(a.r + 5, a.cy)} L${pt(b.x - 7, b.cy)}`
    const down = (a, b) => vCurve(a.cx, a.b + 4, b.cx, b.y - 7, 12).d
    wires.push(['in', hCurve(g.src.r + 5, g.src.cy, g.scan.x - 7, g.scan.cy).d])
    wires.push(['toModel', straight(g.scan, g.model)])
    wires.push(['toOut', straight(g.model, g.out)])
    wires.push(['clear', straight(g.out, g.clear)])
    if (g.stopIn) wires.push(['stopIn', down(g.scan, g.stopIn)])
    if (g.stopTool) wires.push(['stopTool', down(g.model, g.stopTool)])
    if (g.stopOut) wires.push(['stopOut', down(g.out, g.stopOut)])
    if (g.skip) wires.push(['skip', hCurve(g.src.r + 5, g.src.cy, g.skip.x - 7, g.skip.cy).d])
    if (g.skip && g.unscanned) wires.push(['unscanned', straight(g.skip, g.unscanned)])
  }
  const clean = g?.scan && g?.model ? { x: (g.scan.r + g.model.x) / 2, y: g.scan.cy - 19 } : null
  const cols = compact
    ? 'minmax(0,1fr) minmax(18px,0.16fr) minmax(0,1fr) minmax(58px,0.42fr) minmax(0,1fr) minmax(18px,0.16fr) minmax(0,1fr) minmax(18px,0.16fr) minmax(0,1fr)'
    : 'minmax(0,1fr) minmax(26px,0.22fr) minmax(0,1fr) minmax(72px,0.5fr) minmax(0,1fr) minmax(26px,0.22fr) minmax(0,1fr) minmax(26px,0.22fr) minmax(0,1fr)'

  const stopTone = t.block
  const gapParts = [
    totals.off && `${fmtCount(totals.off)} AIRS off`,
    totals.failopen && `${fmtCount(totals.failopen)} failed open`,
    st.native && `${fmtCount(st.native)} own guardrail`,
  ].filter(Boolean).join(' · ')

  const lastMeta = last ? targetMeta(last.s.target) : null
  const lastTone = last ? (last.s.outcome === 'stopped' ? t.block : last.s.outcome === 'cleared' ? t.pass : t.warn) : null

  return (
    <section aria-label="Where the traffic went" className="rounded-[22px] overflow-hidden" style={{ background: t.panel, border: `1px solid ${t.glassEdge}`, boxShadow: t.shadow }}>
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2 flex-wrap">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 34, height: 34, background: bandBg(t.live), boxShadow: `0 5px 12px ${t.live}44` }}>
          <Workflow size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>Where the traffic went</h2>
          <p className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1 }}>
            Every prompt in {windowLong(win)}{meta ? ` on ${meta.label}` : ''}, by the path it took · wire width is its share of traffic
          </p>
        </div>

        {/* The most recent arrival — the dot that just landed, named. */}
        <AnimatePresence mode="wait">
          {last && (
            <motion.div key={`${last.s.id}-${flash[restOf(last.s)] ?? 0}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="hidden lg:flex items-center gap-2 rounded-full pl-1.5 pr-3 min-w-0" role="status"
                        style={{ height: 30, maxWidth: 360, background: `${lastTone}12`, border: `1px solid ${lastTone}40` }}>
              <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, marginLeft: 6, background: lastTone }} aria-hidden="true" />
              <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: inkOn(t, lastTone, 0.3) }}>
                {last.replayed ? 'Replay · ' : ''}{outcomeLine(last.s)}
              </span>
              <span className="truncate" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }}>{lastMeta.label} · {modelTail(last.s.model)}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {replay ? (
          <button type="button" onClick={stopReplay}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  style={{ height: 30, fontFamily: FONT.prose, fontSize: 12, fontWeight: 700, color: '#fff', background: bandBg(t.live), boxShadow: `0 4px 12px ${t.live}40` }}>
            <Square size={11} fill="#fff" aria-hidden="true" /> Replaying {replay.i} of {replay.n}
          </button>
        ) : (
          <button type="button" onClick={startReplay} disabled={!recent.length}
                  title="Re-run the latest traces through the diagram. Real traces, replayed — no counts change."
                  className="inline-flex items-center gap-1.5 rounded-full px-3 flex-shrink-0 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  style={{ height: 30, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: inkOn(t, t.live, 0.25), background: `${t.live}12`, border: `1px solid ${t.live}40` }}>
            <Play size={11} aria-hidden="true" /> Replay the last {Math.min(20, recent.length) || 20}
          </button>
        )}
      </div>

      <div ref={root} className="relative px-4 pb-4 pt-2" style={{ display: 'grid', gridTemplateColumns: cols, gridTemplateRows: 'auto auto auto', rowGap: compact ? 22 : 26 }}>
        {g && (
          <svg className="absolute inset-0 pointer-events-none" width={g.w} height={g.h} style={{ zIndex: 1, overflow: 'visible' }} aria-hidden="true">
            <Markers id={uid} colors={{ live: t.live, pass: t.pass, block: t.block, warn: t.warn }} />
            {wires.map(([k, d]) => {
              const tone = wireTone(t, k)
              const mk = tone === t.live ? 'live' : tone === t.pass ? 'pass' : tone === t.block ? 'block' : 'warn'
              const n = seg[k]
              return (
                <g key={k}>
                  <Wire d={d} color={tone} opacity={n > 0 ? 0.22 : 0.12} width={width(n)} dashed={k === 'skip' || k === 'unscanned'} />
                  <path ref={bindPath(k)} d={d} fill="none" stroke={tone} strokeOpacity={n > 0 ? 0.85 : 0.3} strokeWidth={1.4}
                        strokeDasharray={k === 'skip' || k === 'unscanned' ? '5 4' : undefined} markerEnd={`url(#${uid}-${mk})`} />
                </g>
              )
            })}
            {packets.map((p) => <PacketDot key={`${p.pid}-${g.w}x${g.h}`} t={t} packet={p} paths={paths} onArrive={onArrive} onDone={onDone} />)}
          </svg>
        )}
        {clean && <WirePill t={t} x={clean.x} y={clean.y} tone={t.pass}>only if clean</WirePill>}

        {/* Row 1 — the inspected lane. The source spans all three rows. */}
        <FlowNode t={t} nodeRef={bind('src')} kind="source" tone={t.live} icon={Send} title="Prompts" count={totals.traces}
                  sub={`traced in ${windowLong(win)}`} flash={null} compact={compact} reduce={reduce}
                  style={{ gridColumn: 1, gridRow: '1 / span 3', alignSelf: 'center' }} />
        <FlowNode t={t} nodeRef={bind('scan')} kind="scan" tone={t.pass} icon={ScanLine} title={gateway ? 'Input guardrail' : 'Prompt scan'} count={totals.inspected}
                  pill={totals.traces ? fmtPct(totals.inspected, totals.traces) : null} sub="inspected by Prisma AIRS" compact={compact} reduce={reduce}
                  dim={!totals.inspected} style={{ gridColumn: 3, gridRow: 1, alignSelf: 'center' }} />
        <FlowNode t={t} nodeRef={bind('model')} kind="model" tone={modelTone} icon={Cpu} title={meta ? `Model · ${meta.label}` : 'Model'} count={seg.toModel}
                  sub="called only once the prompt is clean" compact={compact} reduce={reduce}
                  style={{ gridColumn: 5, gridRow: 1, alignSelf: 'center' }} />
        <FlowNode t={t} nodeRef={bind('out')} kind="scan" tone={t.pass} icon={ScanLine} title={gateway ? 'Output guardrail' : 'Response scan'} count={seg.toOut}
                  sub="the answer, before anyone reads it" compact={compact} reduce={reduce}
                  dim={!seg.toOut} style={{ gridColumn: 7, gridRow: 1, alignSelf: 'center' }} />
        <FlowNode t={t} nodeRef={bind('clear')} kind="pass" tone={t.pass} icon={ShieldCheck} title="Answered" count={totals.cleared}
                  pill={totals.flagged ? `${totals.flagged} flagged` : null} sub="cleared both scans" flash={flash.clear} compact={compact} reduce={reduce}
                  dim={!totals.cleared} style={{ gridColumn: 9, gridRow: 1, alignSelf: 'center' }} />

        {/* Row 2 — where AIRS stopped it. */}
        <FlowNode t={t} nodeRef={bind('stopIn')} kind="stop" tone={stopTone} icon={ShieldX} title="Stopped at the prompt" count={st.input}
                  pill={st.input ? fmtPct(st.input, totals.inspected) : null} sub="the model was never called" flash={flash.stopIn} compact={compact} reduce={reduce}
                  dim={!st.input} style={{ gridColumn: 3, gridRow: 2 }} />
        <FlowNode t={t} nodeRef={bind('stopTool')} kind="stop" tone={stopTone} icon={Wrench} title="Stopped at a tool" count={st.tool}
                  sub="a tool call or its result — agents and MCP" flash={flash.stopTool} compact={compact} reduce={reduce}
                  dim={!st.tool} style={{ gridColumn: 5, gridRow: 2 }} />
        <FlowNode t={t} nodeRef={bind('stopOut')} kind="stop" tone={stopTone} icon={ShieldX} title="Stopped at the response" count={st.output}
                  sub="the answer was withheld" flash={flash.stopOut} compact={compact} reduce={reduce}
                  dim={!st.output} style={{ gridColumn: 7, gridRow: 2 }} />

        {/* Row 3 — the lane nothing inspected. */}
        <FlowNode t={t} nodeRef={bind('skip')} kind="gap" tone={t.warn} icon={EyeOff} title="Not inspected" count={notInspected}
                  pill={notInspected ? fmtPct(notInspected, totals.traces) : null} sub={gapParts || 'AIRS off, or a guardrail that failed open'}
                  flash={flash.native} compact={compact} reduce={reduce}
                  dim={!notInspected} style={{ gridColumn: 3, gridRow: 3 }} />
        <FlowNode t={t} nodeRef={bind('unscanned')} kind="gap" tone={t.warn} icon={ShieldOff} title="Answered unscanned" count={seg.unscanned}
                  sub="nothing checked in either direction" flash={flash.unscanned} compact={compact} reduce={reduce}
                  dim={!seg.unscanned} style={{ gridColumn: 9, gridRow: 3 }} />
      </div>

      <footer className="flex items-center gap-2 px-4 py-2.5 flex-wrap" style={{ borderTop: `1px solid ${t.hairline}`, background: t.isLight ? '#FAFAFB' : 'rgba(255,255,255,0.015)' }}>
        <Radio size={12} style={{ color: live ? t.pass : t.inkFaint }} aria-hidden="true" />
        <span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
          {live
            ? 'Live — each dot is a real trace, the moment the portal writes it. Fire a prompt in any pillar and watch it land here.'
            : 'The live stream is paused — counts refresh every minute; dots resume when it reconnects.'}
        </span>
        {totals.traces > 0 && totals.measured < totals.traces && (
          <span className="ml-auto" title="Traces recorded before per-scan telemetry existed are placed from their summary columns."
                style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint }}>
            {fmtPct(totals.measured, totals.traces)} placed from recorded scans · the rest from summary fields
          </span>
        )}
      </footer>
    </section>
  )
})
