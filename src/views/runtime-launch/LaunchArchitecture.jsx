import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  MessageSquare, Reply, ScanLine, Network, Server, Globe, Lock, Plug, Gauge, ShieldCheck, Coins,
  Syringe, FileLock2, Biohazard, Link2, Code2, Bot, Workflow,
} from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots } from '../home-2027/band'
import { TARGETS } from './LaunchLibrary'

/**
 * LaunchArchitecture — the empty session, in the launch design.
 *
 * Same story as SessionArchitecture (which the v1 console keeps): each backend
 * opens on its own enforcement architecture, wired to the live switches. What
 * changed is how it is built.
 *
 * The old diagrams were one SVG with a 1120-unit viewBox on a forced-dark
 * panel. In a ~650px centre column that scaled every label to about five
 * pixels, and the navy block sat on the light console like a hole. Here the
 * nodes are real HTML cards — fixed, readable type, theme tokens, the cloud's
 * logo, the console's icon squares — laid out on a CSS grid that follows the
 * column width. Only the wires are SVG, drawn from the cards' measured
 * positions (useGeometry), so a line always meets its card whatever the width.
 *
 * Colour follows the console's rules: blue is the user's side (client and
 * answer, like the user's bubble), green is AIRS inspecting, amber is AIRS off,
 * the cloud's colour is the model, vermilion is only the block path. The model
 * card takes its cloud's band, which is the target card picked in the left
 * rail — the eye links the two.
 *
 * Live behaviour carried over unchanged: AIRS off turns every scan into
 * "Bypassed" (dashed, amber) and removes the block arc, because with nothing
 * inspecting nothing can short-circuit; on the gateway lane the lit cloud is
 * read from the model id, never its label; MCP off dims the whole tool loop.
 */

const PINK = '#EC4899' // the SCM AI Gateway's identity colour, as on its target card

// Where each API-layer provider runs. Tone and logo come from TARGETS so the
// diagram and the target cards cannot disagree.
const WHERE = { vertex: 'GCP · sergei-playground-338006', bedrock: 'AWS · us-west-2', azure: 'Azure AI Foundry' }

// One gateway, two clouds. Which one a turn lands in is the model id's slug.
const INTEGRATIONS = [
  { slug: '@sudo-bedrock',  chip: 'AWS', cloud: 'AWS · us-west-2', logo: '/logo-aws.png', tone: '#FF9900' },
  { slug: '@sudo-vertexai', chip: 'GCP', cloud: 'GCP · global',    logo: '/logo-gcp.png', tone: '#4285F4' },
]

const DETECTORS = [
  ['injection', Syringe], ['PII / DLP', FileLock2], ['toxic', Biohazard],
  ['malicious URL', Link2], ['code', Code2], ['agent', Bot],
]

// Shown until /api/mcp/servers answers (it is config-only, so that is fast).
const FALLBACK_SERVERS = [
  { id: 'huggingface', label: 'Hugging Face', host: 'mcp-aigw.portkey.ai', brokered: true },
  { id: 'github',      label: 'GitHub',       host: 'mcp-aigw.portkey.ai', brokered: true, readOnly: true },
  { id: 'coingecko',   label: 'CoinGecko',    host: 'mcp.api.coingecko.com', brokered: false },
]

// Why the short circuit matters, in the three terms an audience weighs.
const SHORT_CIRCUIT = [
  { icon: Gauge,       title: 'Performance', text: 'No round trip to a model that was never going to be allowed to answer.' },
  { icon: ShieldCheck, title: 'Security',    text: 'The payload never reaches the model, so it cannot manipulate it.' },
  { icon: Coins,       title: 'Cost',        text: 'A blocked request consumes no provider tokens.' },
]

// Connector columns sit between the node columns and grow a little with the
// width; the fourth is wide enough to carry the "only if clean" label.
const COLS = 'minmax(0,0.9fr) minmax(30px,0.18fr) minmax(0,1.1fr) minmax(84px,0.4fr) minmax(0,1.5fr) minmax(30px,0.18fr) minmax(0,1.1fr) minmax(30px,0.18fr) minmax(0,0.9fr)'
// The tool loop has its own columns: its scan cards need more room than the
// client and answer above them, and the wires are measured, not gridded.
const LOOP_COLS = 'minmax(0,1.25fr) 30px minmax(0,3fr) 30px minmax(0,1.25fr)'

// The model card's band stays dark across its whole width: its text is
// centred, so the whole card has to pass the white-text contrast rule, not
// just its left end (bandBg's bright end would not).
const deepBand = (tone) => `linear-gradient(135deg, ${shade(tone, 0.52)} 0%, ${shade(tone, 0.34)} 100%)`

// ─── geometry: where the cards actually are ─────────────────────────────────

/**
 * Measures every bound card against the root, in layout coordinates
 * (offsetLeft/Top), so an entrance animation's transform never skews a wire.
 * Re-measures on any size change of the root or a card, and once fonts load.
 */
function useGeometry(deps) {
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
const pt = (x, y) => `${r1(x)},${r1(y)}`

/** A cubic between two points with vertical tangents; returns the path and its midpoint. */
function vCurve(x1, y1, x2, y2, bend) {
  const k = bend ?? Math.max(28, Math.abs(y2 - y1) * 0.55)
  const c1 = [x1, y1 + (y2 > y1 ? k : -k)]
  const c2 = [x2, y2 + (y2 > y1 ? -k : k)]
  return {
    d: `M${pt(x1, y1)} C${pt(...c1)} ${pt(...c2)} ${pt(x2, y2)}`,
    m: { x: (x1 + 3 * c1[0] + 3 * c2[0] + x2) / 8, y: (y1 + 3 * c1[1] + 3 * c2[1] + y2) / 8 },
  }
}

/** The block short-circuit: up out of the scan, over, and down into the client. */
function arcBack(x1, y1, x2, y2, lift = 46) {
  const c1 = [x1, y1 - lift]
  const c2 = [x2, y2 - lift]
  return {
    d: `M${pt(x1, y1)} C${pt(...c1)} ${pt(...c2)} ${pt(x2, y2)}`,
    m: { x: (x1 + 3 * c1[0] + 3 * c2[0] + x2) / 8, y: (y1 + 3 * c1[1] + 3 * c2[1] + y2) / 8 },
  }
}

// ─── SVG pieces ──────────────────────────────────────────────────────────────

function Markers({ id, colors }) {
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

function Wire({ d, color, opacity = 0.7, dashed, marker, width = 1.6 }) {
  return (
    <path d={d} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round"
          strokeDasharray={dashed ? '5 4' : undefined} markerEnd={marker ? `url(#${marker})` : undefined} />
  )
}

/** A dot riding a wire. Invisible until its animation begins, so it never parks at the origin. */
function Packet({ d, color, dur, delay = 0, r = 3.5 }) {
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
function WirePill({ t, x, y, tone, mono, children }) {
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
function Node({ t, nodeRef, kind, tone, icon: Icon, logo, title, sub, off, compact, style, delay = 0, children }) {
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

/**
 * The block label. It sits just right of the arc's rising end, at the arc's
 * height — on top of the arc it hid the very path it describes.
 */
function BlockPill({ t, x, y, width, target }) {
  const w = 216
  const left = Math.max(4, Math.min(width - w - 4, x))
  return (
    <div className="absolute pointer-events-none" style={{ left, top: y, transform: 'translateY(-50%)', zIndex: 3 }}>
      <div className="rounded-xl text-center whitespace-nowrap"
           style={{ padding: '4px 11px', background: t.panel, border: `1px solid ${t.block}66`, boxShadow: `0 6px 16px ${t.block}24` }}>
        <div style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, color: t.isLight ? shade(t.block, 0.2) : t.block }}>
          Blocked → back to the client
        </div>
        <div style={{ fontFamily: FONT.prose, fontSize: 10, color: t.inkDim }}>{target} is never called · no tokens spent</div>
      </div>
    </div>
  )
}

function TrayLabel({ t, icon: Icon, tone, children, style }) {
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

function MonoChip({ t, children }) {
  return (
    <span className="rounded-full px-2 flex-shrink-0 whitespace-nowrap"
          style={{ fontFamily: FONT.mono, fontSize: 10, lineHeight: '18px', color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
      {children}
    </span>
  )
}

// ─── the API-layer lane ──────────────────────────────────────────────────────

function ApiLayerLane({ t, backend, model, isProtected }) {
  const target = TARGETS.find((x) => x.id === backend) ?? TARGETS[1]
  const tone = target.tone
  const airs = isProtected ? t.pass : t.warn
  const off = !isProtected
  const reduce = useReducedMotion()
  const mid = useId().replace(/:/g, '')
  const { root, bind, geo } = useGeometry([backend, model, isProtected])
  const compact = !!geo && geo.w < 720
  const g = geo
  const ready = g && g.client && g.scan1 && g.model && g.scan2 && g.answer && g.svc
  const neutral = t.inkFaint

  let wires = null
  let pills = null
  if (ready) {
    const y = g.client.cy
    const row = (a, b) => `M${pt(a.r + 6, y)} L${pt(b.x - 7, y)}`
    const down1 = vCurve(g.scan1.cx, g.scan1.b + 4, g.svc.x + g.svc.w * 0.22, g.svc.y - 5)
    const down2 = vCurve(g.scan2.cx, g.scan2.b + 4, g.svc.x + g.svc.w * 0.78, g.svc.y - 5)
    const arc = arcBack(g.scan1.x + g.scan1.w * 0.36, g.scan1.y - 3, g.client.cx, g.client.y - 6)
    const through = `M${pt(g.client.r, y)} L${pt(g.answer.x, y)}`
    wires = (
      <svg aria-hidden="true" className="absolute inset-0 pointer-events-none" width={g.w} height={g.h} style={{ zIndex: 1, overflow: 'visible' }}>
        <Markers id={mid} colors={{ user: t.live, airs, tone, block: t.block, neutral }} />
        <Wire d={row(g.client, g.scan1)} color={t.live} opacity={0.55} marker={`${mid}-user`} />
        <Wire d={row(g.scan1, g.model)} color={off ? neutral : airs} opacity={off ? 0.6 : 0.8} marker={`${mid}-${off ? 'neutral' : 'airs'}`} />
        <Wire d={row(g.model, g.scan2)} color={tone} opacity={0.75} marker={`${mid}-tone`} />
        <Wire d={row(g.scan2, g.answer)} color={off ? neutral : airs} opacity={off ? 0.6 : 0.8} marker={`${mid}-${off ? 'neutral' : 'airs'}`} />
        <g opacity={off ? 0.35 : 1}>
          <Wire d={down1.d} color={off ? neutral : airs} opacity={0.55} dashed marker={`${mid}-${off ? 'neutral' : 'airs'}`} />
          <Wire d={down2.d} color={off ? neutral : airs} opacity={0.55} dashed marker={`${mid}-${off ? 'neutral' : 'airs'}`} />
        </g>
        {isProtected && <Wire d={arc.d} color={t.block} opacity={0.75} dashed width={1.8} marker={`${mid}-block`} />}
        {!reduce && (
          <g key={`${g.w}x${g.h}`}>
            <Packet d={through} color={airs} dur={4.4} r={4} />
            {isProtected && <Packet d={down1.d} color={airs} dur={2.4} r={3} />}
            {isProtected && <Packet d={down2.d} color={airs} dur={2.4} delay={1.2} r={3} />}
            {isProtected && <Packet d={arc.d} color={t.block} dur={4.8} delay={2.2} r={3} />}
          </g>
        )}
      </svg>
    )
    pills = (
      <>
        {isProtected && <WirePill t={t} x={(g.scan1.r + g.model.x) / 2} y={y} tone={t.pass}>only if clean</WirePill>}
        {isProtected && <BlockPill t={t} x={g.scan1.x + g.scan1.w * 0.36 + 14} y={arc.m.y} width={g.w} target={target.label} />}
      </>
    )
  }

  return (
    <div ref={root} className="relative" style={{ display: 'grid', gridTemplateColumns: COLS, gridTemplateRows: '58px auto 28px 64px auto', padding: '0 14px' }}>
      {/* This app orchestrates the sequence; AIRS and the provider are both
          services it calls. The tray is drawn around the app, not around the
          enforcement — the difference from the gateway lane. */}
      <div aria-hidden="true" style={{
        gridRow: '1 / 4', gridColumn: '1 / -1', margin: '0 -12px -2px', borderRadius: 22, zIndex: 0, position: 'relative',
        background: t.isLight ? 'rgba(20,20,24,0.022)' : 'rgba(255,255,255,0.025)',
        border: `1.5px dashed ${t.isLight ? 'rgba(20,20,24,0.14)' : 'rgba(255,255,255,0.13)'}`,
      }} />
      <TrayLabel t={t} icon={Workflow} style={{ gridRow: 1, gridColumn: '5 / -1' }}>This app orchestrates every call</TrayLabel>

      <Node t={t} nodeRef={bind('client')} kind="user" tone={t.live} icon={MessageSquare} compact={compact}
            title="Client" sub={compact ? 'attack library' : 'attack library · chat'} style={{ gridRow: 2, gridColumn: 1 }} />
      <Node t={t} nodeRef={bind('scan1')} kind="scan" tone={airs} icon={ScanLine} off={off} compact={compact} delay={0.05}
            title={off ? 'Bypassed' : 'Prompt scan'} sub={off ? 'nothing inspected' : 'AIRS · before the model'}
            style={{ gridRow: 2, gridColumn: 3 }} />
      <Node t={t} nodeRef={bind('model')} kind="model" tone={tone} logo={target.logo} compact={compact} delay={0.1}
            title={target.label} sub={model} style={{ gridRow: 2, gridColumn: 5 }} />
      <Node t={t} nodeRef={bind('scan2')} kind="scan" tone={airs} icon={ScanLine} off={off} compact={compact} delay={0.15}
            title={off ? 'Bypassed' : 'Response scan'} sub={off ? 'nothing inspected' : 'AIRS · before the user'}
            style={{ gridRow: 2, gridColumn: 7 }} />
      <Node t={t} nodeRef={bind('answer')} kind="user" tone={t.live} icon={Reply} compact={compact} delay={0.2}
            title="Answer" sub="to the user" style={{ gridRow: 2, gridColumn: 9 }} />

      <div className="relative text-center truncate" style={{ gridRow: 3, gridColumn: '4 / 7', zIndex: 2, alignSelf: 'center', fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim }}>
        {WHERE[backend] ?? ''} · direct SDK call, no proxy
      </div>

      {/* Both scans are the same service, called twice out of band. */}
      <div ref={bind('svc')} className="relative" style={{
        gridRow: 5, gridColumn: '3 / 8', zIndex: 2, padding: '12px 14px', borderRadius: 18,
        background: t.panel, opacity: off ? 0.75 : 1,
        border: off ? `1.5px dashed ${t.warn}77` : `1px solid ${t.pass}40`,
        boxShadow: off ? 'none' : `0 10px 24px ${t.pass}17`,
      }}>
        <div className="flex items-center gap-3">
          <span className="grid place-items-center rounded-xl flex-shrink-0"
                style={off
                  ? { width: 34, height: 34, background: `${t.warn}17`, color: t.isLight ? shade(t.warn, 0.38) : t.warn }
                  : { width: 34, height: 34, background: bandBg(t.pass), color: '#fff', boxShadow: `0 5px 12px ${t.pass}55` }}>
            <ShieldCheck size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>Prisma AIRS Runtime API</span>
            <span className="block truncate" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim, marginTop: 1 }}>service.api.aisecurity.paloaltonetworks.com</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {DETECTORS.map(([name, Icon]) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                  style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, background: t.sunken }}>
              <Icon size={11} style={{ color: off ? t.inkFaint : t.pass }} aria-hidden="true" /> {name}
            </span>
          ))}
        </div>
        <p style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, marginTop: 8 }}>
          {off ? 'AIRS is off — the payload reaches the model unread.' : 'One profile, two calls. The provider never sees the scan.'}
        </p>
      </div>

      {wires}
      {pills}
    </div>
  )
}

// ─── the SCM AI Gateway lane ─────────────────────────────────────────────────

function GatewayLane({ t, model, modelId, isProtected, mcpEnabled }) {
  const airs = isProtected ? t.pass : t.warn
  const off = !isProtected
  const reduce = useReducedMotion()
  const mid = useId().replace(/:/g, '')
  const [servers, setServers] = useState(FALLBACK_SERVERS)

  useEffect(() => {
    let alive = true
    fetch('/api/mcp/servers')
      .then((r) => r.json())
      .then((d) => { if (alive && d.servers?.length) setServers(d.servers) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Routing comes off the ID, never the label (see AigwFlowDiagram).
  const slug = /^(@[\w-]+)\//.exec(String(modelId || model || ''))?.[1]
  const active = INTEGRATIONS.find((i) => i.slug === slug) ?? INTEGRATIONS[0]
  const { root, bind, geo } = useGeometry([model, modelId, isProtected, mcpEnabled, servers.length])
  const compact = !!geo && geo.w < 720
  const g = geo
  const ready = g && g.client && g.g1 && g.llm && g.g2 && g.answer && g.s1 && g.s2 && g.svc
  const neutral = t.inkFaint
  const loopTone = t.inkDim
  const pinkInk = t.isLight ? shade(PINK, 0.3) : PINK

  let wires = null
  let pills = null
  if (ready) {
    const y = g.client.cy
    const row = (a, b) => `M${pt(a.r + 6, y)} L${pt(b.x - 7, y)}`
    const arc = arcBack(g.g1.x + g.g1.w * 0.36, g.g1.y - 3, g.client.cx, g.client.y - 6)
    const through = `M${pt(g.client.r, y)} L${pt(g.answer.x, y)}`
    const out = vCurve(g.llm.x + g.llm.w * 0.3, g.llm.b + 4, g.s1.cx, g.s1.y - 6)
    const back = vCurve(g.s2.cx, g.s2.y - 4, g.llm.x + g.llm.w * 0.7, g.llm.b + 7)
    const sy = g.s1.cy
    const across1 = `M${pt(g.s1.r + 6, sy)} L${pt(g.svc.x - 7, sy)}`
    const across2 = `M${pt(g.svc.r + 6, g.s2.cy)} L${pt(g.s2.x - 7, g.s2.cy)}`
    // one continuous path for the loop packet; it passes behind the cards
    const loop = `${out.d} L${pt(g.s1.cx, sy)} L${pt(g.s2.cx, g.s2.cy)} L${pt(g.s2.cx, g.s2.y - 4)} ${back.d.replace(/^M[^C]+/, '')}`
    wires = (
      <svg aria-hidden="true" className="absolute inset-0 pointer-events-none" width={g.w} height={g.h} style={{ zIndex: 1, overflow: 'visible' }}>
        <Markers id={mid} colors={{ user: t.live, airs, tone: active.tone, block: t.block, neutral, loop: loopTone }} />
        <Wire d={row(g.client, g.g1)} color={t.live} opacity={0.55} marker={`${mid}-user`} />
        <Wire d={row(g.g1, g.llm)} color={off ? neutral : airs} opacity={off ? 0.6 : 0.8} marker={`${mid}-${off ? 'neutral' : 'airs'}`} />
        <Wire d={row(g.llm, g.g2)} color={active.tone} opacity={0.75} marker={`${mid}-tone`} />
        <Wire d={row(g.g2, g.answer)} color={off ? neutral : airs} opacity={off ? 0.6 : 0.8} marker={`${mid}-${off ? 'neutral' : 'airs'}`} />
        <g opacity={mcpEnabled ? 1 : 0.3}>
          <Wire d={out.d} color={loopTone} opacity={0.5} marker={`${mid}-loop`} />
          <Wire d={across1} color={loopTone} opacity={0.5} marker={`${mid}-loop`} />
          <Wire d={across2} color={loopTone} opacity={0.5} marker={`${mid}-loop`} />
          <Wire d={back.d} color={loopTone} opacity={0.5} marker={`${mid}-loop`} />
        </g>
        {isProtected && <Wire d={arc.d} color={t.block} opacity={0.75} dashed width={1.8} marker={`${mid}-block`} />}
        {!reduce && (
          <g key={`${g.w}x${g.h}`}>
            <Packet d={through} color={airs} dur={4.4} r={4} />
            {mcpEnabled && <Packet d={loop} color={PINK} dur={6.5} delay={1.2} r={3.2} />}
            {isProtected && <Packet d={arc.d} color={t.block} dur={4.8} delay={2.2} r={3} />}
          </g>
        )}
      </svg>
    )
    pills = (
      <>
        {isProtected && <WirePill t={t} x={(g.g1.r + g.llm.x) / 2} y={y} tone={t.pass}>only if clean</WirePill>}
        {isProtected && <BlockPill t={t} x={g.g1.x + g.g1.w * 0.36 + 14} y={arc.m.y} width={g.w} target="The model" />}
        <div style={{ opacity: mcpEnabled ? 1 : 0.45 }}>
          <WirePill t={t} x={out.m.x} y={out.m.y} tone={t.inkDim} mono>tool_use</WirePill>
          <WirePill t={t} x={back.m.x} y={back.m.y} tone={t.inkDim}>tool result</WirePill>
        </div>
      </>
    )
  }

  const lower = { opacity: mcpEnabled ? 1 : 0.4, transition: 'opacity 200ms ease' }

  return (
    <div ref={root} className="relative" style={{ display: 'grid', gridTemplateColumns: COLS, gridTemplateRows: '58px auto 12px 72px auto auto', padding: '0 14px' }}>
      {/* The gateway envelope: everything inside is brokered by the SCM AI
          Gateway; the client, the answer and this app's tool scans are not. */}
      <div aria-hidden="true" style={{
        gridRow: '1 / 4', gridColumn: '3 / 8', margin: '0 -12px -2px', borderRadius: 22, zIndex: 0, position: 'relative',
        background: `${PINK}0a`, border: `1.5px dashed ${PINK}59`,
      }} />
      <TrayLabel t={t} icon={Network} tone={PINK} style={{ gridRow: 1, gridColumn: '5 / 8', marginRight: -2 }}>
        SCM AI Gateway
        {!compact && <MonoChip t={t}>{isProtected ? 'AIGW_CONFIG_PROTECTED' : 'AIGW_CONFIG_UNPROTECTED'}</MonoChip>}
      </TrayLabel>

      <Node t={t} nodeRef={bind('client')} kind="user" tone={t.live} icon={MessageSquare} compact={compact}
            title="Client" sub={compact ? 'attack library' : 'attack library · chat'} style={{ gridRow: 2, gridColumn: 1 }} />
      <Node t={t} nodeRef={bind('g1')} kind="scan" tone={airs} icon={ScanLine} off={off} compact={compact} delay={0.05}
            title={off ? 'No guardrail' : 'Prompt guardrail'} sub={off ? 'unprotected config' : 'AIRS · inside the gateway'}
            style={{ gridRow: 2, gridColumn: 3 }} />
      <Node t={t} nodeRef={bind('llm')} kind="model" tone={active.tone} logo={active.logo} compact={compact} delay={0.1}
            title={model} sub={active.cloud} style={{ gridRow: 2, gridColumn: 5 }}>
        {/* One gateway, two clouds: both drawn, the one this model routes to lit. */}
        <span className="relative inline-flex items-center gap-0.5 mt-2 rounded-full p-0.5"
              style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.22)' }}>
          {INTEGRATIONS.map((ig) => {
            const on = ig.slug === active.slug
            return (
              <span key={ig.slug} className="rounded-full px-2" title={ig.slug}
                    style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 700, lineHeight: '17px',
                             color: on ? shade(ig.tone, 0.32) : 'rgba(255,255,255,0.72)', background: on ? '#fff' : 'transparent' }}>
                {ig.chip}
              </span>
            )
          })}
        </span>
      </Node>
      <Node t={t} nodeRef={bind('g2')} kind="scan" tone={airs} icon={ScanLine} off={off} compact={compact} delay={0.15}
            title={off ? 'No guardrail' : 'Response guardrail'} sub={off ? 'unprotected config' : 'AIRS · before the user'}
            style={{ gridRow: 2, gridColumn: 7 }} />
      <Node t={t} nodeRef={bind('answer')} kind="user" tone={t.live} icon={Reply} compact={compact} delay={0.2}
            title="Answer" sub="to the user" style={{ gridRow: 2, gridColumn: 9 }} />

      {/* ── the MCP tool loop: this app scans each call twice ── */}
      <div style={{ gridRow: 5, gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: LOOP_COLS, alignItems: 'center' }}>
      <Node t={t} nodeRef={bind('s1')} kind="scan" tone={airs} icon={ScanLine} off={off} compact={compact} delay={0.25}
            title={off ? 'Not scanned' : 'Tool parameters'} sub={off ? 'stage 1 · AIRS off' : 'AIRS · before the call'}
            style={{ gridColumn: 1, ...lower }} />
      <div ref={bind('svc')} className="relative" style={{
        gridColumn: 3, zIndex: 2, padding: '11px 12px 6px', borderRadius: 18,
        background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm, ...lower,
      }}>
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: bandBg(PINK), boxShadow: `0 4px 10px ${PINK}45` }}>
            <Plug size={14} style={{ color: '#fff' }} aria-hidden="true" />
          </span>
          <span className="flex-1 min-w-0" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>MCP servers</span>
          {/* the manifest scan: tool descriptions checked before the model reads them */}
          <span className="rounded-full px-2 py-0.5 flex-shrink-0 whitespace-nowrap"
                style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600,
                         color: off ? (t.isLight ? shade(t.warn, 0.38) : t.warn) : (t.isLight ? shade(t.pass, 0.2) : t.pass),
                         background: `${off ? t.warn : t.pass}1a` }}>
            {off ? 'tools/list not scanned' : 'tools/list scanned'}
          </span>
        </div>
        <div className="mt-1.5">
          {servers.map((s) => {
            const tone = s.brokered ? PINK : t.warn
            return (
              <div key={s.id} className="flex items-center gap-2.5 py-1.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
                <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 24, height: 24, background: `${tone}18`, color: t.isLight ? shade(tone, 0.25) : tone }}>
                  {s.brokered ? <Server size={12} aria-hidden="true" /> : <Globe size={12} aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink }}>{s.label}</span>
                  {!compact && s.host && <span style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }}>{`  ${s.host}`}</span>}
                </span>
                {s.readOnly && (
                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 flex-shrink-0"
                        style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 600, color: t.isLight ? shade(t.pass, 0.2) : t.pass, background: `${t.pass}1a` }}>
                    <Lock size={9} aria-hidden="true" /> read-only
                  </span>
                )}
                <span className="rounded-full px-1.5 flex-shrink-0"
                      style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 600, color: s.brokered ? pinkInk : (t.isLight ? shade(t.warn, 0.38) : t.warn), background: `${tone}1a` }}>
                  {s.brokered ? 'via AI-GW' : 'direct'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <Node t={t} nodeRef={bind('s2')} kind="scan" tone={airs} icon={ScanLine} off={off} compact={compact} delay={0.3}
            title={off ? 'Not scanned' : 'Tool result'} sub={off ? 'stage 2 · AIRS off' : 'AIRS · before the model reads it'}
            style={{ gridColumn: 5, ...lower }} />
      </div>

      {!mcpEnabled && (
        <div className="relative flex items-center justify-center gap-2 mt-3" style={{ gridRow: 6, gridColumn: '1 / -1', zIndex: 2 }}>
          <Plug size={13} style={{ color: pinkInk }} aria-hidden="true" />
          <span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
            MCP tool calling is off — switch it on in the left panel to let the model reach these servers.
          </span>
        </div>
      )}

      {wires}
      {pills}
    </div>
  )
}

// ─── the card ────────────────────────────────────────────────────────────────

function ShortCircuit({ t, isProtected }) {
  const tone = isProtected ? t.block : t.inkFaint
  return (
    <div className="px-4 pt-3.5 pb-4" style={{ borderTop: `1px solid ${t.hairline}` }}>
      <div style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, marginBottom: 10,
                    color: isProtected ? (t.isLight ? shade(t.block, 0.2) : t.block) : t.inkDim }}>
        {isProtected ? 'On a block, the request stops at the scan' : 'AIRS is off, so nothing is intercepted. With protection on:'}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        {SHORT_CIRCUIT.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-2.5">
            <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${tone}14`, color: tone }}>
              <Icon size={14} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: isProtected ? t.ink : t.inkDim }}>{title}</span>
              <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>{text}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// `model` is the picker's LABEL (for display); `modelId` the routing id that
// carries the `@integration/` prefix — the gateway lane needs both.
export function LaunchArchitecture({ t, backend, model, modelId, isProtected, mcpEnabled }) {
  const isAigw = backend === 'aigw'
  const target = TARGETS.find((x) => x.id === backend) ?? TARGETS[1]
  const laneTone = isAigw ? PINK : target.tone

  return (
    <div className="w-full px-4 pt-3 pb-4 self-start">
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                      aria-label={isAigw ? 'SCM AI Gateway session architecture' : `${target.label} session architecture`}
                      className="overflow-hidden" style={glass(t, { radius: 22 })}>
        <header className="flex items-center gap-3 px-4 pt-4 pb-2">
          <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: bandBg(laneTone), boxShadow: `0 5px 12px ${laneTone}45` }}>
            <Workflow size={16} style={{ color: '#fff' }} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Session architecture</div>
            <div className="truncate" style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink, marginTop: 1 }}>
              {isAigw ? 'How a prompt travels through the SCM AI Gateway' : `How a prompt travels to ${target.label}`}
            </div>
            <div style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginTop: 1 }}>
              {isAigw
                ? 'The guardrail runs inside the gateway — one policy in front of both clouds.'
                : 'API-layer enforcement: this app asks Prisma AIRS before and after the model.'}
            </div>
          </div>
        </header>

        <div className="pt-2 pb-5">
          {isAigw
            ? <GatewayLane t={t} model={model} modelId={modelId} isProtected={isProtected} mcpEnabled={mcpEnabled} />
            : <ApiLayerLane t={t} backend={backend} model={model} isProtected={isProtected} />}
        </div>

        <ShortCircuit t={t} isProtected={isProtected} />
      </motion.section>

      <p className="px-1 mt-2.5" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkFaint }}>
        Fire a payload from the library, or type one below. This becomes the live intercept line once the session has a record.
      </p>
    </div>
  )
}
