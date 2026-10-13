import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpRight, ChevronDown, ExternalLink, ListChecks } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots, bandGlass } from '../home-2027/band'
import { HOME_PILLARS } from '../home-2027/homeData'
import { Inline } from '../developer-corner/Blocks'
import { SIDE, STATUS, CLAIM_BY_ID, SOURCES } from './content'

/**
 * parts.jsx — the pieces every section of the AI-GW vs LiteLLM pillar is
 * built from: the section band, soft cards, side tags, status pills, claim
 * chips that jump to the claim check, portal links, source links.
 */

export const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

/** Coloured text that stays readable: darkened on light surfaces. */
export const inkOn = (t, tone, k = 0.3) => (t.isLight ? shade(tone, k) : tone)
export const statusTone = (t, status) => t[STATUS[status]?.key ?? 'idle']

export function Text({ t, text, size = 13.5, dim = true, style }) {
  return (
    <p style={{ fontFamily: FONT.prose, fontSize: size, lineHeight: 1.65, color: dim ? t.inkDim : t.ink, margin: 0, ...style }}>
      <Inline t={t} text={text} />
    </p>
  )
}

export function H2({ t, children, sub, right }) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1 min-w-0">
        <h2 style={{ fontFamily: FONT.display, fontSize: 18, fontWeight: 700, color: t.ink, margin: 0, letterSpacing: '-0.01em' }}>{children}</h2>
        {sub && <p style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, margin: '3px 0 0', lineHeight: 1.5 }}>{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function Card({ t, children, tone, className = '', style, pad = '14px 16px' }) {
  return (
    <div className={`rounded-2xl ${className}`}
         style={{ background: t.panel, border: `1px solid ${tone ? `${tone}40` : t.hairline}`, boxShadow: tone ? `0 8px 20px ${tone}12` : 'none', padding: pad, ...style }}>
      {children}
    </div>
  )
}

export function IconSquare({ icon: Icon, tone, t, size = 32 }) {
  return (
    <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: size, height: size, background: `${tone}17`, color: inkOn(t, tone, 0.25) }}>
      <Icon size={Math.round(size * 0.47)} aria-hidden="true" />
    </span>
  )
}

/** The headline band of a section: the group's tone, its icon as a watermark. */
export function SectionBand({ t, tone, icon: Icon, eyebrow, title, sub, children }) {
  return (
    <div className="relative overflow-hidden rounded-3xl" style={{ background: bandBg(tone), boxShadow: `0 14px 32px ${tone}2e` }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
      <Icon aria-hidden="true" strokeWidth={1.2} style={{ position: 'absolute', right: -26, bottom: -48, width: 190, height: 190, color: '#fff', opacity: 0.13, transform: 'rotate(-10deg)' }} />
      <div className="relative flex items-start gap-4 px-5 py-5">
        <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
          <Icon size={22} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div style={{ ...LBL, fontSize: 10, color: 'rgba(255,255,255,0.86)' }}>{eyebrow}</div>
          <h1 style={{ fontFamily: FONT.display, fontSize: 25, fontWeight: 700, color: '#fff', lineHeight: 1.18, margin: '4px 0 0' }}>{title}</h1>
          {sub && <p style={{ fontFamily: FONT.prose, fontSize: 13.5, color: 'rgba(255,255,255,0.92)', margin: '5px 0 0', lineHeight: 1.5, maxWidth: 680 }}>{sub}</p>}
          {children && <div className="flex flex-wrap items-center gap-2 mt-3">{children}</div>}
        </div>
      </div>
    </div>
  )
}

export function GlassPill({ icon: Icon, children, onClick, href }) {
  const body = <>{Icon && <Icon size={12} aria-hidden="true" />} {children}</>
  const cls = 'inline-flex items-center gap-1.5 rounded-full px-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white'
  const style = { height: 26, ...bandGlass, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600 }
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>{body}</a>
  if (onClick) return <button type="button" onClick={onClick} className={cls} style={style}>{body}</button>
  return <span className={cls} style={style}>{body}</span>
}

/** "AIRS AI Gateway" / "LiteLLM" — which side a line speaks for. */
export function SideTag({ t, side, small = false, short = false }) {
  const s = SIDE[side]
  return (
    <span className="inline-flex items-center gap-1.5 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: small ? 10.5 : 11, fontWeight: 700, color: inkOn(t, s.tone, 0.32) }}>
      <span className="rounded-full" style={{ width: 7, height: 7, background: s.tone }} aria-hidden="true" />
      {short ? s.short : s.label}
    </span>
  )
}

export function StatusPill({ t, status }) {
  const meta = STATUS[status]
  if (!meta) return null
  const c = statusTone(t, status)
  return (
    <span className="inline-flex items-center rounded-full px-2 flex-shrink-0" title={meta.note}
          style={{ height: 20, fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, color: inkOn(t, c, meta.key === 'warn' ? 0.45 : 0.3), background: `${c}1c` }}>
      {meta.label}
    </span>
  )
}

/** A claim's status as a button: opens the claim check at that claim. */
export function ClaimChip({ t, id, onGo }) {
  const c = CLAIM_BY_ID[id]
  if (!c) return null
  const meta = STATUS[c.status]
  const tone = statusTone(t, c.status)
  return (
    <button type="button" onClick={() => onGo(`claim:${id}`)} title={`${meta.label} — ${meta.note} Open the claim check.`}
            className={`inline-flex items-center gap-1.5 rounded-full px-2 ${focusCls}`}
            style={{ height: 22, fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: inkOn(t, tone, meta.key === 'warn' ? 0.45 : 0.3), background: `${tone}17`, border: `1px solid ${tone}38` }}>
      <ListChecks size={11} aria-hidden="true" /> {meta.label}
    </button>
  )
}

const REL = { demo: 'See it live', closest: 'Closest in this portal', related: 'Related in this portal' }

/** A jump to the pillar that demonstrates something, coloured by that pillar. */
export function PortalLink({ t, pillarId, rel = 'demo', text, onGo }) {
  const [hot, setHot] = useState(false)
  const p = HOME_PILLARS.find((x) => x.id === pillarId)
  if (!p) return null
  const Icon = p.icon
  return (
    <button type="button" onClick={() => onGo(`pillar:${pillarId}`)} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className={`w-full flex items-center gap-2.5 rounded-xl text-left ${focusCls}`}
            style={{ padding: '7px 8px', background: hot ? `${p.accent}12` : t.sunken, border: `1px solid ${hot ? `${p.accent}44` : t.hairline}`, transition: 'background 140ms, border-color 140ms' }}>
      <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 26, height: 26, background: bandBg(p.accent) }}>
        <Icon size={13} style={{ color: '#fff' }} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{REL[rel]} · {p.title}</span>
        {text && <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink, marginTop: 1, lineHeight: 1.35 }}>{text}</span>}
      </span>
      <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
            style={{ width: 24, height: 24, color: hot ? '#fff' : t.inkDim, background: hot ? shade(p.accent) : t.panel }}>
        <ArrowUpRight size={12} />
      </span>
    </button>
  )
}

const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }

export function SourceLinks({ t, ids, label = 'Sources' }) {
  const list = (ids ?? []).map((id) => SOURCES[id]).filter(Boolean)
  if (!list.length) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint }}>{label}</span>
      {list.map((s) => (
        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}
           className={`inline-flex items-center gap-1 rounded ${focusCls}`}
           style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: inkOn(t, t.live, 0.2) }}>
          {host(s.url)} <ExternalLink size={10} aria-hidden="true" />
        </a>
      ))}
    </div>
  )
}

/** A disclosure inside a card: the "go deeper" half of a row. */
export function Deeper({ t, title = 'Go deeper', tone, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 ${focusCls}`}
              style={{ height: 24, fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: inkOn(t, tone ?? t.live, 0.3), background: `${tone ?? t.live}12` }}>
        {title}
        <ChevronDown size={12} aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="pt-3 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** "Say it": the line a seller can use, set apart like a quote. */
export function SayIt({ t, tone, text, label = 'Say it' }) {
  return (
    <div className="rounded-xl" style={{ padding: '9px 12px', background: `${tone}0f`, borderLeft: `3px solid ${tone}` }}>
      <div style={{ ...LBL, fontSize: 9, color: inkOn(t, tone, 0.35), marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 600, color: t.ink, lineHeight: 1.45 }}><Inline t={t} text={text} /></div>
    </div>
  )
}

/** A small hover card for chart marks — positioned by its parent row. */
export function HoverNote({ t, show, children }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                    role="tooltip" className="absolute z-20 rounded-xl pointer-events-none"
                    style={{ right: 0, bottom: 'calc(100% + 6px)', padding: '7px 10px', minWidth: 190, background: t.isLight ? '#ffffff' : 'rgba(15,20,35,0.98)', border: `1px solid ${t.isLight ? 'rgba(0,48,135,0.14)' : 'rgba(255,255,255,0.12)'}`, boxShadow: t.isLight ? '0 8px 24px rgba(0,48,135,0.10)' : '0 8px 24px rgba(0,0,0,0.4)', fontFamily: FONT.prose, fontSize: 11.5, color: t.isLight ? '#1e293b' : '#e2e8f0', lineHeight: 1.5 }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
