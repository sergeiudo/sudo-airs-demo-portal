/**
 * Shared building blocks for the Prompt Telemetry drawer. Styled on the 2027
 * console's tokens (soft surfaces, one accent) so the drawer reads as part of
 * the console it opens from, in both themes.
 */
import React, { createContext, useContext, useState } from 'react'
import {
  Copy, Check, Info, Clock, MapPin, Fingerprint, ArrowLeftRight, Cpu, Waypoints, ShieldCheck, Wrench, Braces,
  AlertTriangle, Coins, Circle, Server, CalendarClock, Globe, Plug, Hourglass, ScanLine,
} from 'lucide-react'
import { FONT, label as LBL } from '../../../views/api-intercept-2027/tokens'

export { FONT, LBL }

/**
 * The drawer's look. 'classic' is the 2027 console's; 'launch' is the launcher
 * design (soft icon squares, prose titles) used by the redesigned runtime
 * console. A context rather than a prop, so every tab picks it up without
 * threading it through each section.
 */
export const TelemetryLook = createContext('classic')
const useLaunch = () => useContext(TelemetryLook) === 'launch'

// Card / stat titles → an icon, for the launch look. First match wins.
const TITLE_ICONS = [
  [/guardrail check errored|native guardrail/i, AlertTriangle],
  [/manifest|· parameters$|· result$/i, Wrench],
  [/^(prompt|input|response) · /i, ScanLine],
  [/^(timeline|waterfall|measured steps|total)/i, Clock],
  [/^this server/i, Server],
  [/^started/i, CalendarClock],
  [/^http requests/i, Globe],
  [/^new connections/i, Plug],
  [/^waiting on remote/i, Hourglass],
  [/^airs scans/i, ShieldCheck],
  [/^where it ran/i, MapPin],
  [/^identifiers/i, Fingerprint],
  [/^(exchange|requests)/i, ArrowLeftRight],
  [/^(model|provider)/i, Cpu],
  [/gateway/i, Waypoints],
  [/^(security|prisma airs)/i, ShieldCheck],
  [/^(mcp|agent)/i, Wrench],
  [/^raw/i, Braces],
  [/^how these numbers/i, Info],
  [/^server total/i, Clock],
  [/^tokens/i, Coins],
]
const iconFor = (title) => (typeof title === 'string' && TITLE_ICONS.find(([re]) => re.test(title))?.[1]) || Circle

function IconSquare({ t, icon: Icon, tone, size = 30 }) {
  const c = tone || t.live
  return (
    <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: size, height: size, background: `${c}14`, color: c }}>
      <Icon size={Math.round(size * 0.47)} aria-hidden="true" />
    </span>
  )
}

export const fmtMs = (ms) => {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms >= 10000) return `${(ms / 1000).toFixed(1)} s`
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  return `${Math.round(ms)} ms`
}
export const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString())
export const pct = (a, b) => (a != null && b ? `${Math.round((a / b) * 100)}%` : '—')

/** Model/compute colour — charcoal disappears on the dark panel, so it adapts. */
export const modelColor = (t) => (t.isLight ? t.model : '#C9C9D1')

export function CopyButton({ t, text, size = 11 }) {
  const [done, setDone] = useState(false)
  if (!text) return null
  return (
    <button
      type="button"
      title="Copy"
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(String(text)).then(() => { setDone(true); setTimeout(() => setDone(false), 1400) })
      }}
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{ color: done ? t.pass : t.inkFaint, width: size + 6, height: size + 6, borderRadius: 6 }}
    >
      {done ? <Check size={size} /> : <Copy size={size} />}
    </button>
  )
}

/** A value with a copy affordance — ids, hashes, request ids. */
export function IdValue({ t, value, truncate = 0 }) {
  if (value == null || value === '') return <span style={{ color: t.inkFaint }}>—</span>
  const s = String(value)
  const shown = truncate && s.length > truncate ? `${s.slice(0, truncate)}…` : s
  return (
    <span className="inline-flex items-center gap-0.5 min-w-0 max-w-full">
      <span className="truncate" title={s} dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.ink }}>{shown}</span>
      <CopyButton t={t} text={s} size={10} />
    </span>
  )
}

export function Card({ t, title, right, children, tone, pad = true, className = '' }) {
  const launch = useLaunch()
  if (launch) {
    return (
      <section className={className}
               style={{ background: t.panel, border: `1px solid ${tone ? `${tone}40` : t.glassEdge}`, borderRadius: 20, boxShadow: t.shadowSm, overflow: 'hidden' }}>
        {(title || right) && (
          <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5">
            {title && <IconSquare t={t} icon={iconFor(title)} tone={tone} />}
            {title && <span className="min-w-0 truncate" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>{title}</span>}
            <span className="flex-1" />
            {right}
          </header>
        )}
        <div className={pad ? 'px-4 pb-4' : ''}>{children}</div>
      </section>
    )
  }
  return (
    <section
      className={className}
      style={{
        background: t.panel,
        border: `1px solid ${tone ? `${tone}40` : t.glassEdge}`,
        borderRadius: 18,
        boxShadow: t.shadowSm,
        overflow: 'hidden',
      }}
    >
      {(title || right) && (
        <header className="flex items-center gap-2 px-4 pt-3 pb-2">
          {title && <span style={{ ...LBL, fontSize: 9, color: tone || t.inkDim }}>{title}</span>}
          <span className="flex-1" />
          {right}
        </header>
      )}
      <div className={pad ? 'px-4 pb-3.5' : ''}>{children}</div>
    </section>
  )
}

/** Label / value line. */
export function KV({ t, k, children, top, hint }) {
  if (useLaunch()) {
    return (
      <div className="flex gap-3 py-[7px]" style={{ alignItems: top ? 'flex-start' : 'baseline', borderTop: `1px solid ${t.hairline}` }}>
        <span className="flex-shrink-0" title={hint} style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 500, color: t.inkDim, width: 118, paddingTop: top ? 1 : 0 }}>{k}</span>
        <div className="flex-1 min-w-0" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink }}>{children}</div>
      </div>
    )
  }
  return (
    <div className="flex gap-3 py-[5px]" style={{ alignItems: top ? 'flex-start' : 'baseline', borderTop: `1px solid ${t.hairline}` }}>
      <span className="flex-shrink-0" title={hint} style={{ ...LBL, fontSize: 8, color: t.inkFaint, width: 112, paddingTop: top ? 2 : 0 }}>{k}</span>
      <div className="flex-1 min-w-0" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.ink }}>{children}</div>
    </div>
  )
}

export function Chip({ t, children, tone, solid, title }) {
  const c = tone || t.inkDim
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full whitespace-nowrap"
      style={{
        ...LBL, fontSize: 8, letterSpacing: '0.08em',
        color: solid ? '#fff' : c,
        background: solid ? c : `${c}16`,
        border: `1px solid ${solid ? c : `${c}38`}`,
      }}
    >
      {children}
    </span>
  )
}

/** Big numeral tile. */
export function Stat({ t, label, value, sub, tone }) {
  if (useLaunch()) {
    return (
      <div className="px-3.5 py-3 min-w-0" style={{ background: t.panel, border: `1px solid ${t.glassEdge}`, borderRadius: 18, boxShadow: t.shadowSm }}>
        <div className="flex items-center gap-2">
          <IconSquare t={t} icon={iconFor(label)} tone={tone && tone !== t.ink ? tone : undefined} size={26} />
          <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.inkDim }}>{label}</span>
        </div>
        <div className="truncate" style={{ fontFamily: FONT.display, fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', color: tone || t.ink, lineHeight: 1.1, marginTop: 8 }}>{value}</div>
        {sub && <div className="truncate" title={typeof sub === 'string' ? sub : undefined} style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 3 }}>{sub}</div>}
      </div>
    )
  }
  return (
    <div className="px-3 py-2.5 min-w-0" style={{ background: t.sunken, borderRadius: 14 }}>
      <div style={{ ...LBL, fontSize: 7.5, color: t.inkFaint }}>{label}</div>
      <div className="truncate" style={{ fontFamily: FONT.display, fontSize: 19, fontWeight: 700, color: tone || t.ink, lineHeight: 1.15, marginTop: 3 }}>{value}</div>
      {sub && <div className="truncate" title={typeof sub === 'string' ? sub : undefined} style={{ fontFamily: FONT.prose, fontSize: 10, color: t.inkDim, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export { IconSquare, useLaunch }

/** An honest footnote — what a number is and is not. */
export function Note({ t, children }) {
  return (
    <div className="flex gap-2 px-3 py-2 mt-2" style={{ background: t.sunken, borderRadius: 12 }}>
      <Info size={12} style={{ color: t.inkFaint, flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: 1.5, color: t.inkDim }}>{children}</div>
    </div>
  )
}

export function Empty({ t, children }) {
  return <p style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint, padding: '6px 0' }}>{children}</p>
}
