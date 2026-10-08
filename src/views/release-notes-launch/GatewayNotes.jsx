import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Plug, Wrench, Info, AlertTriangle, ExternalLink, X, ArrowUpRight, ChevronRight } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { bandDots, bandGlass, shade } from '../home-2027/band'
import { deepBand } from '../runtime-launch/diagramKit'

/**
 * The AI Gateway (Portkey Enterprise Gateway) changelog, in the launch look.
 *
 * The server parses each gateway release into sections of blocks (p, li,
 * links, table, note, code) whose text keeps inline markdown — **bold**,
 * `code`, [label](https://…). It is rendered here as React nodes, never as
 * HTML: scraped text is untrusted, and only https:// links become anchors.
 *
 * The card carries the highlights (one line per feature) and the counts; the
 * full notes — up to eleven features and thirty-odd bullets — open in a
 * drawer, so a long release never stretches the card grid.
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
const INLINE = /(\*\*.+?\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g
const linkInk = (t) => (t.isLight ? shade(t.live, 0.2) : '#9DB6FA')

function inline(text, t, kb, depth = 0) {
  return String(text).split(INLINE).filter(Boolean).map((p, i) => {
    const k = `${kb}-${i}`
    if (depth < 2 && /^\*\*.+\*\*$/.test(p)) return <strong key={k} style={{ fontWeight: 650, color: t.ink }}>{inline(p.slice(2, -2), t, k, depth + 1)}</strong>
    if (/^`[^`]+`$/.test(p)) {
      return <code key={k} dir="ltr" style={{ fontFamily: FONT.mono, fontSize: '0.86em', padding: '1px 5px', borderRadius: 5, color: t.ink, background: t.sunken, border: `1px solid ${t.hairline}`, overflowWrap: 'anywhere' }}>{p.slice(1, -1)}</code>
    }
    const link = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (link) {
      if (depth >= 2 || !/^https:\/\//.test(link[2])) return <React.Fragment key={k}>{link[1]}</React.Fragment>
      return (
        <a key={k} href={link[2]} target="_blank" rel="noopener noreferrer"
           style={{ color: linkInk(t), textDecoration: 'underline', textUnderlineOffset: 2, textDecorationThickness: 1 }}>
          {inline(link[1], t, k, depth + 1)}
        </a>
      )
    }
    return <React.Fragment key={k}>{p}</React.Fragment>
  })
}

export function NoteText({ t, text }) {
  return <>{inline(text, t, 'n')}</>
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/** "3 features", "4 provider updates", "5 fixes" — only the ones that exist. */
export function gatewayCounts(c) {
  if (!c) return []
  return [
    c.features ? plural(c.features, 'feature', 'features') : null,
    c.providers ? plural(c.providers, 'provider update', 'provider updates') : null,
    c.fixes ? plural(c.fixes, 'fix', 'fixes') : null,
  ].filter(Boolean)
}

/** The card body for a gateway release: highlights, counts, and the way into the full notes. */
export function GatewayHighlights({ t, item, onNotes }) {
  const shown = item.highlights.slice(0, 4)
  const rest = item.highlights.length - shown.length
  return (
    <div className="px-4 pt-2.5">
      {shown.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Highlights">
          {shown.map((h, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="rounded-full flex-shrink-0" aria-hidden="true" style={{ width: 6, height: 6, marginTop: 7, background: item.tone }} />
              <span style={{ fontFamily: FONT.prose, fontSize: 13, fontWeight: 500, lineHeight: 1.45, color: t.ink }}><NoteText t={t} text={h} /></span>
            </li>
          ))}
          {rest > 0 && <li style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, paddingLeft: 16 }}>+{rest} more feature{rest === 1 ? '' : 's'} in the notes</li>}
        </ul>
      ) : item.summary ? (
        <p style={{ fontFamily: FONT.prose, fontSize: 13, lineHeight: 1.6, color: t.inkDim, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.summary.split(' — ')[0]}</p>
      ) : null}
      <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
        {gatewayCounts(item.counts).map((x) => (
          <span key={x} className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: '19px', color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>{x}</span>
        ))}
        <button type="button" onClick={() => onNotes(item)} aria-haspopup="dialog"
                className={`inline-flex items-center gap-0.5 rounded-full ml-auto ${focusCls}`}
                style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: linkInk(t) }}>
          Read the full notes <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

const KIND = {
  feature:   { icon: Sparkles, title: null },
  providers: { icon: Plug,     title: 'Provider updates' },
  fixes:     { icon: Wrench,   title: 'Fixes and improvements' },
  intro:     { icon: Info,     title: 'Overview' },
}

function Block({ t, b, tone }) {
  const prose = { fontFamily: FONT.prose, fontSize: 13, lineHeight: 1.6, color: t.inkDim }
  switch (b.type) {
    case 'p':
      return <p style={prose}><NoteText t={t} text={b.text} /></p>
    case 'li':
      return (
        <div className="flex items-start gap-2.5" style={{ paddingLeft: b.depth ? 18 : 0 }}>
          <span className="flex-shrink-0 rounded-full" aria-hidden="true"
                style={{ width: 5, height: 5, marginTop: 8.5, background: b.depth ? 'transparent' : tone, border: b.depth ? `1.5px solid ${t.inkFaint}` : 'none' }} />
          <span style={prose}><NoteText t={t} text={b.text} /></span>
        </div>
      )
    case 'links':
      return (
        <div className="flex flex-wrap gap-1.5">
          {b.links.map((l) => (
            <a key={l.url + l.label} href={l.url} target="_blank" rel="noopener noreferrer"
               className={`inline-flex items-center gap-1 rounded-full px-2.5 ${focusCls}`}
               style={{ height: 26, fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: linkInk(t), background: `${t.live}10`, border: `1px solid ${t.live}2e` }}>
              {inline(l.label.replace(/`/g, ''), t, 'l', 2)} <ExternalLink size={10} aria-hidden="true" />
            </a>
          ))}
        </div>
      )
    case 'note': {
      const c = b.tone === 'warning' ? t.warn : t.live
      const Icon = b.tone === 'warning' ? AlertTriangle : Info
      return (
        <div className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: `${c}14`, border: `1px solid ${c}38` }}>
          <Icon size={14} className="flex-shrink-0" style={{ color: t.isLight ? shade(c, 0.3) : c, marginTop: 3 }} aria-hidden="true" />
          <span style={{ ...prose, color: t.ink }}><NoteText t={t} text={b.text} /></span>
        </div>
      )
    }
    case 'code':
      return (
        <pre dir="ltr" className="rounded-xl px-3 py-2.5 overflow-x-auto"
             style={{ fontFamily: FONT.mono, fontSize: 11.5, lineHeight: 1.6, color: t.ink, background: t.sunken, border: `1px solid ${t.hairline}`, margin: 0 }}>{b.text}</pre>
      )
    case 'table': {
      const [head, ...body] = b.rows
      return (
        <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${t.hairline}` }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: FONT.prose, fontSize: 12 }}>
            <thead>
              <tr style={{ background: t.sunken }}>
                {head.map((c, i) => <th key={i} style={{ textAlign: 'left', padding: '7px 10px', fontFamily: FONT.display, fontWeight: 700, color: t.ink, borderBottom: `1px solid ${t.hairline}` }}><NoteText t={t} text={c} /></th>)}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => <td key={ci} style={{ padding: '6px 10px', verticalAlign: 'top', color: ci === 0 ? t.ink : t.inkDim, borderTop: ri ? `1px solid ${t.hairline}` : 'none' }}><NoteText t={t} text={c} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    default:
      return null
  }
}

function Section({ t, s, tone }) {
  const k = KIND[s.kind] ?? KIND.feature
  const Icon = k.icon
  const items = s.blocks.filter((b) => b.type === 'li' && !b.depth).length
  const ink = t.isLight ? shade(tone, 0.3) : tone
  return (
    <section className="rounded-2xl px-3.5 py-3" style={{ background: t.panel, border: `1px solid ${t.glassEdge}`, boxShadow: t.shadowSm }}>
      <div className="flex items-center gap-2.5 mb-2">
        <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 26, height: 26, background: `${tone}17`, color: ink }} aria-hidden="true">
          <Icon size={13} />
        </span>
        <h3 className="min-w-0 flex-1" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3, color: t.ink }}>
          {k.title ?? <NoteText t={t} text={s.heading} />}
        </h3>
        {s.kind !== 'feature' && items > 0 && (
          <span className="rounded-full px-2 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, lineHeight: '19px', color: t.inkDim, background: t.sunken }}>{items}</span>
        )}
      </div>
      <div className="space-y-2">
        {s.blocks.map((b, i) => <Block key={i} t={t} b={b} tone={tone} />)}
      </div>
    </section>
  )
}

/** The full notes of one gateway release. `item` null = closed. */
export function GatewayNotesDrawer({ t, item, onClose, onDemo }) {
  const closeRef = useRef(null)
  useEffect(() => {
    if (!item) return undefined
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [item, onClose])

  const tone = item?.tone ?? t.live
  const Icon = item?.pillar?.icon ?? Sparkles
  const p = item?.pillar
  return createPortal(
    <AnimatePresence>
      {item && (
        <>
          <motion.div key="bd" className="fixed inset-0" style={{ zIndex: 60, background: 'rgba(0,0,0,0.25)' }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside key="dr" role="dialog" aria-modal="true" aria-label={`AI Gateway ${item.version} release notes`} className="fixed top-0 right-0 bottom-0 flex flex-col"
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                        style={{ zIndex: 61, width: 600, maxWidth: '100vw', background: t.ground, boxShadow: '-12px 0 40px rgba(0,0,0,0.2)' }}>
            <div className="relative flex-shrink-0 overflow-hidden" style={{ background: deepBand(tone), minHeight: 100 }}>
              <div aria-hidden="true" className="absolute inset-0" style={bandDots} />
              <Icon aria-hidden="true" strokeWidth={1.3} style={{ position: 'absolute', right: -24, bottom: -46, width: 160, height: 160, color: '#fff', opacity: 0.13, transform: 'rotate(-10deg)' }} />
              <div className="relative flex items-center gap-3 px-5 py-4">
                <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
                  <Icon size={19} style={{ color: '#fff' }} aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Enterprise Gateway changelog · {item.releaseDate}</div>
                  <div style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.15, marginTop: 2 }}>AI Gateway {item.version}</div>
                  <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 3 }}>{gatewayCounts(item.counts).join(' · ') || 'Release notes'}</div>
                </div>
                <button ref={closeRef} type="button" onClick={onClose} aria-label="Close the release notes"
                        className={`grid place-items-center rounded-full flex-shrink-0 ${focusCls}`} style={{ width: 32, height: 32, ...bandGlass }}>
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {item.sections?.length
                ? item.sections.map((s, i) => <Section key={i} t={t} s={s} tone={tone} />)
                : <p style={{ fontFamily: FONT.prose, fontSize: 13, color: t.inkDim, padding: 12 }}>No notes were published with this release.</p>}
            </div>

            <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${t.hairline}`, background: t.panel }}>
              {p && (
                <button type="button" onClick={() => { onClose(); onDemo(p.id) }}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 ${focusCls}`}
                        style={{ height: 34, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: '#fff', background: shade(tone), boxShadow: `0 4px 12px ${tone}40` }}>
                  Demo the product area · {p.title} <ArrowUpRight size={13} aria-hidden="true" />
                </button>
              )}
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                 className={`ml-auto inline-flex items-center gap-1 rounded-full px-3 ${focusCls}`}
                 style={{ height: 34, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
                In the docs <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
