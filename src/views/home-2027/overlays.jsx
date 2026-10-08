import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X, ArrowUpRight, Search, CornerDownLeft, Sun, Moon, FileText, Play, ChevronLeft, ChevronRight, Sparkles, Megaphone } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { deepBand } from '../runtime-launch/diagramKit'
import { hl } from '../../data/pillars'
import { shade, bandBg, bandDots, bandGlass, areaPill } from './band'
import { ago } from './homeData'

/**
 * overlays.jsx — the dialogs on the home page.
 *
 *   DetailsSheet   — a pillar's full story, from the right. Replaces the old
 *                    centred modal: the grid stays visible beside it, and Launch
 *                    is the first thing in it rather than the last.
 *   ReleaseSheet   — one Prisma AIRS release from the release wire, from the
 *                    right, with ←/→ through every release in the feed.
 *   CommandPalette — ⌘K / Ctrl+K / "/" to jump to any pillar or action. With
 *                    ten pillars, typing "moh" beats scanning a grid mid-demo.
 *
 * All trap focus, close on Escape and hand focus back to whatever opened them.
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'

function useFocusTrap(open, onClose) {
  const ref = useRef(null)
  // Held in a ref so a re-render never re-runs the trap: that would re-capture
  // the "opener" from inside the dialog and return focus nowhere on close.
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement
    const node = ref.current
    const first = node?.querySelector('[data-autofocus]') || node?.querySelector(FOCUSABLE)
    first?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return }
      if (e.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const a = items[0], z = items[items.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); opener?.focus?.() }
  }, [open])
  return ref
}

function Scrim({ onClose, t }) {
  return (
    <motion.div className="fixed inset-0 z-40" onClick={onClose}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                style={{ background: t.isLight ? 'rgba(20,20,24,0.28)' : 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }} />
  )
}

// ─── details sheet ────────────────────────────────────────────────────────────

export function DetailsSheet({ t, pillar, onClose, onLaunch }) {
  const reduce = useReducedMotion()
  const ref = useFocusTrap(!!pillar, onClose)
  return (
    <AnimatePresence>
      {pillar && (
        <>
          <Scrim t={t} onClose={onClose} />
          <motion.aside
            ref={ref} role="dialog" aria-modal="true" aria-labelledby="sheet-title"
            className="fixed top-0 right-0 bottom-0 z-50 flex flex-col overflow-y-auto"
            initial={reduce ? { opacity: 0 } : { x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: 40, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: 'min(560px, 100vw)', background: t.panel, borderLeft: `1px solid ${t.hairline}`, boxShadow: t.shadow }}
          >
            <div className="relative p-7">
              <div aria-hidden="true" className="absolute inset-x-0 top-0 h-40 pointer-events-none"
                   style={{ background: `radial-gradient(90% 100% at 20% 0%, ${pillar.legacy ? '#94a3b8' : pillar.accent}22, transparent 70%)` }} />
              <div className="relative flex items-start gap-4">
                <span className="grid place-items-center rounded-2xl flex-shrink-0"
                      style={{ width: 52, height: 52, background: `${pillar.accent}1a`, border: `1px solid ${pillar.accent}40` }}>
                  <pillar.icon size={24} style={{ color: pillar.legacy ? '#64748b' : pillar.accent }} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {pillar.run && (
                      <span style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 700, color: t.inkDim }}>STEP {String(pillar.run).padStart(2, '0')}</span>
                    )}
                    <span style={{ ...LBL, fontSize: 10, ...areaPill(pillar.legacy ? '#94a3b8' : pillar.accent) }}>{pillar.area}</span>
                    {pillar.legacy && (
                      <span style={{ ...LBL, fontSize: 9, color: '#64748b', background: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.35)', borderRadius: 999, padding: '2px 8px' }}>Legacy</span>
                    )}
                  </div>
                  <h2 id="sheet-title" style={{ fontFamily: FONT.display, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: t.ink, lineHeight: 1.1, marginTop: 6 }}>
                    {pillar.title}
                  </h2>
                </div>
                <button type="button" onClick={onClose} aria-label="Close details"
                        className="grid place-items-center rounded-full flex-shrink-0"
                        style={{ width: 36, height: 36, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
                  <X size={16} />
                </button>
              </div>

              <button type="button" data-autofocus onClick={() => onLaunch(pillar.id)}
                      className="relative mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full"
                      style={{ height: 46, fontFamily: FONT.prose, fontSize: 14, fontWeight: 700, color: t.panel, background: t.ink }}>
                Launch {pillar.title} <ArrowUpRight size={16} />
              </button>

              <p className="relative mt-6" style={{ fontFamily: FONT.prose, fontSize: 14.5, lineHeight: 1.65, color: t.inkDim }}>
                {pillar.description}
              </p>

              <h3 className="relative mt-6 mb-2.5" style={{ ...LBL, fontSize: 11, color: t.inkDim }}>What you can show</h3>
              <ul className="relative space-y-2">
                {pillar.highlights.map(hl).map(({ t: text, tag }) => (
                  <li key={text} className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl"
                      style={{ background: t.sunken, border: `1px solid ${t.hairline}` }}>
                    <span className="mt-[7px] rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: pillar.legacy ? '#94a3b8' : pillar.accent }} />
                    <span className="flex-1" style={{ fontFamily: FONT.prose, fontSize: 13.5, lineHeight: 1.5, color: t.ink }}>{text}</span>
                    {tag && (
                      <span className="flex-shrink-0 rounded-full px-2 py-0.5"
                            style={{ ...LBL, fontSize: 9, color: '#fff', background: tag === 'LEGACY' ? '#94a3b8' : pillar.accent }}>{tag}</span>
                    )}
                  </li>
                ))}
              </ul>

              {pillar.stats?.length > 0 && (
                <div className="relative mt-5 flex flex-wrap gap-2">
                  {pillar.stats.map((s) => (
                    <span key={s} className="rounded-full px-3 py-1" style={{ fontFamily: FONT.mono, fontSize: 11.5, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── release sheet ────────────────────────────────────────────────────────────

function GlassButton({ label, onClick, disabled, children, size = 34 }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
            className="grid place-items-center rounded-full flex-shrink-0 transition-opacity"
            style={{ ...bandGlass, width: size, height: size, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  )
}

export function ReleaseSheet({ t, items, index, onIndex, onClose, onLaunch, onAll, fetchedAt }) {
  const reduce = useReducedMotion()
  const open = index != null && !!items[index]
  const ref = useFocusTrap(open, onClose)
  const item = open ? items[index] : null
  const [demoHot, setDemoHot] = useState(false)

  // ←/→ browse the feed while the sheet is open.
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); onIndex(index - 1) }
      else if (e.key === 'ArrowRight' && index < items.length - 1) { e.preventDefault(); onIndex(index + 1) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, index, items.length, onIndex])

  const tone = item?.tone
  const Icon = item?.pillar?.icon ?? Sparkles
  const p = item?.pillar
  const step = p?.run ? `step ${String(p.run).padStart(2, '0')}` : null
  const fetched = fetchedAt ? ago(Date.parse(fetchedAt)) : null

  return (
    <AnimatePresence>
      {open && (
        <>
          <Scrim t={t} onClose={onClose} />
          <motion.aside
            ref={ref} role="dialog" aria-modal="true" aria-labelledby="release-title"
            className="fixed top-0 right-0 bottom-0 z-50 flex flex-col overflow-y-auto"
            initial={reduce ? { opacity: 0 } : { x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: 40, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: 'min(580px, 100vw)', background: t.panel, borderLeft: `1px solid ${t.hairline}`, boxShadow: t.shadow }}
          >
            {/* ── the band: the release's product area, in its pillar's colour ── */}
            <div className="relative flex-shrink-0 overflow-hidden" style={{ background: deepBand(tone), padding: '20px 24px 24px', transition: 'background 240ms ease' }}>
              <div aria-hidden="true" className="absolute inset-0" style={bandDots} />
              <Icon aria-hidden="true" strokeWidth={1.3}
                    style={{ position: 'absolute', right: -30, bottom: -46, width: 190, height: 190, color: '#fff', opacity: 0.13, transform: 'rotate(-10deg)' }} />

              <div className="relative flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5" style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>
                  <Megaphone size={12} aria-hidden="true" /> Prisma AIRS release · {item.month}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <GlassButton label="Previous release" size={32} onClick={() => onIndex(index - 1)} disabled={index === 0}><ChevronLeft size={15} /></GlassButton>
                  <span aria-live="polite" style={{ fontFamily: FONT.mono, fontSize: 11, color: 'rgba(255,255,255,0.9)', minWidth: 46, textAlign: 'center' }}>
                    {index + 1} / {items.length}
                  </span>
                  <GlassButton label="Next release" size={32} onClick={() => onIndex(index + 1)} disabled={index === items.length - 1}><ChevronRight size={15} /></GlassButton>
                  <span className="mx-1" style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.25)' }} aria-hidden="true" />
                  <GlassButton label="Close release" onClick={onClose}><X size={16} /></GlassButton>
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={item.key} className="relative"
                            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.16 }}>
                  <span className="grid place-items-center rounded-2xl mt-5"
                        style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
                    <Icon size={20} style={{ color: '#fff' }} aria-hidden="true" />
                  </span>
                  <h2 id="release-title" style={{ fontFamily: FONT.display, fontSize: 25, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.15, marginTop: 14, maxWidth: '92%', textWrap: 'balance' }}>
                    {item.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-3.5">
                    <span className="rounded-full px-3 py-1" style={{ ...bandGlass, fontFamily: FONT.prose, fontSize: 12 }}>{item.category}</span>
                    {item.fresh && (
                      <span className="rounded-full px-3 py-1" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: shade(tone), background: '#fff' }}>New since your last visit</span>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── the body ── */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={item.key} className="flex-1 flex flex-col p-6"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
                <div className="space-y-3">
                  {(item.paragraphs.length ? item.paragraphs : [item.summary]).filter(Boolean).map((para, i) => (
                    <p key={i} style={{ fontFamily: FONT.prose, fontSize: 14.5, lineHeight: 1.65, color: i === 0 ? t.ink : t.inkDim }}>{para}</p>
                  ))}
                </div>

                {/* Not autofocused: focus lands on the header's ‹ › instead, so the
                    sheet opens at the top and Enter / arrows keep browsing. */}
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                   className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full"
                   style={{ height: 46, fontFamily: FONT.prose, fontSize: 14, fontWeight: 700, color: t.panel, background: t.ink }}>
                  Read it on docs.paloaltonetworks.com <ArrowUpRight size={16} aria-hidden="true" />
                </a>

                {/* Mapped by product area, not by feature — the copy says so. */}
                {p ? (
                  <button type="button" onClick={() => { onClose(); onLaunch(p.id) }}
                          onMouseEnter={() => setDemoHot(true)} onMouseLeave={() => setDemoHot(false)}
                          className="mt-3 w-full flex items-center gap-3 rounded-2xl text-left"
                          style={{
                            padding: '11px 12px', background: t.panel, cursor: 'pointer',
                            border: `1px solid ${demoHot ? `${p.accent}66` : t.hairline}`,
                            boxShadow: demoHot ? `0 10px 24px ${p.accent}24` : t.shadowSm, transition: 'border-color 180ms ease, box-shadow 200ms ease',
                          }}>
                    <span className="grid place-items-center rounded-xl flex-shrink-0"
                          style={{ width: 38, height: 38, background: bandBg(p.accent), boxShadow: demoHot ? `0 5px 12px ${p.accent}55` : 'none' }}>
                      <p.icon size={17} style={{ color: '#fff' }} aria-hidden="true" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>
                        Demo the product area{step ? ` — ${step}` : ''}
                      </span>
                      <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginTop: 2, lineHeight: 1.4 }}>
                        {item.category} releases belong to {p.title}. Launch it to show the area live.
                      </span>
                    </span>
                    <span className="grid place-items-center rounded-full flex-shrink-0"
                          style={{ width: 30, height: 30, color: demoHot ? '#fff' : t.inkDim, background: demoHot ? shade(p.accent) : t.sunken, transition: 'background 160ms ease, color 160ms ease' }}>
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </span>
                  </button>
                ) : (
                  <div className="mt-3 flex items-center gap-3 rounded-2xl" style={{ padding: '11px 12px', background: t.sunken, border: `1px solid ${t.hairline}` }}>
                    <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 38, height: 38, background: `${tone}1f` }}>
                      <Sparkles size={16} style={{ color: t.inkDim }} aria-hidden="true" />
                    </span>
                    <span style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, lineHeight: 1.45 }}>
                      {item.category} isn’t one of this portal’s demos — the docs are the place for it.
                    </span>
                  </div>
                )}

                {item.tags.length > 0 && (
                  <>
                    <h3 className="mt-6 mb-2" style={{ ...LBL, fontSize: 10, color: t.inkDim }}>Filed under</h3>
                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((g) => (
                        <span key={g.join('|')} className="rounded-full px-3 py-1"
                              style={{ fontFamily: FONT.prose, fontSize: 12, color: t.ink, background: t.sunken, border: `1px solid ${t.hairline}` }}>
                          {g.join(' · ')}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                <div className="mt-auto pt-6 flex items-center gap-3 flex-wrap">
                  <button type="button" onClick={() => { onClose(); onAll() }}
                          className="inline-flex items-center gap-1.5 rounded-full"
                          style={{ height: 34, padding: '0 14px', fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, background: t.sunken, border: `1px solid ${t.hairline}` }}>
                    <FileText size={13} aria-hidden="true" /> All release notes
                  </button>
                  <span className="ml-auto" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>
                    ← → to browse{fetched ? ` · fetched ${fetched}` : ''}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── command palette ──────────────────────────────────────────────────────────

export function CommandPalette({ t, open, onClose, pillars, onLaunch, actions }) {
  const ref = useFocusTrap(open, onClose)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => { if (open) { setQ(''); setActive(0) } }, [open])

  const items = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    const hit = (hay) => terms.every((x) => hay.includes(x))
    const ps = pillars
      .map((p) => ({
        kind: 'pillar', id: p.id, p,
        hay: [p.title, p.tag, p.area, p.aka, p.summary, ...p.highlights.map((h) => hl(h).t)].join(' ').toLowerCase(),
      }))
      .filter((x) => hit(x.hay))
    const as = actions.filter((a) => hit(a.label.toLowerCase()))
    return [...ps, ...as.map((a) => ({ kind: 'action', ...a }))]
  }, [q, pillars, actions])

  useEffect(() => { setActive(0) }, [q])

  const run = (it) => { if (!it) return; onClose(); it.kind === 'pillar' ? onLaunch(it.id) : it.run() }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(items[active]) }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <Scrim t={t} onClose={onClose} />
          <div className="fixed inset-x-0 top-[14vh] z-50 flex justify-center px-4 pointer-events-none">
            <motion.div ref={ref} role="dialog" aria-modal="true" aria-label="Jump to a pillar"
                        initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ duration: 0.16 }}
                        className="w-full max-w-[640px] overflow-hidden pointer-events-auto"
                        style={{ background: t.panel, borderRadius: 22, border: `1px solid ${t.hairline}`, boxShadow: t.shadow }}>
              <div className="flex items-center gap-3 px-5" style={{ height: 58, borderBottom: `1px solid ${t.hairline}` }}>
                <Search size={17} style={{ color: t.inkDim }} aria-hidden="true" />
                <input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
                       ref={(el) => el?.style.setProperty('background-color', 'transparent', 'important')}
                       placeholder="Jump to a pillar, or type an action…" aria-label="Search pillars and actions"
                       role="combobox" aria-expanded="true" aria-controls="palette-list"
                       aria-activedescendant={items[active] ? `pal-${active}` : undefined}
                       className="flex-1 outline-none bg-transparent"
                       style={{ fontFamily: FONT.prose, fontSize: 16, color: t.ink }} />
                <kbd style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim, border: `1px solid ${t.hairline}`, borderRadius: 6, padding: '2px 6px' }}>esc</kbd>
              </div>
              <ul id="palette-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
                {items.length === 0 && (
                  <li className="px-3 py-6 text-center" style={{ fontFamily: FONT.prose, fontSize: 13, color: t.inkDim }}>Nothing matches “{q}”.</li>
                )}
                {items.map((it, i) => {
                  const on = i === active
                  const Icon = it.kind === 'pillar' ? it.p.icon : it.icon
                  return (
                    <li key={it.kind + it.id} id={`pal-${i}`} role="option" aria-selected={on}
                        onMouseEnter={() => setActive(i)} onClick={() => run(it)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                        style={{ background: on ? t.sunken : 'transparent' }}>
                      <span className="grid place-items-center rounded-lg flex-shrink-0"
                            style={{ width: 32, height: 32, background: it.kind === 'pillar' ? `${it.p.accent}1a` : t.sunken }}>
                        <Icon size={15} style={{ color: it.kind === 'pillar' ? (it.p.legacy ? '#64748b' : it.p.accent) : t.inkDim }} aria-hidden="true" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 14, fontWeight: 600, color: t.ink }}>
                          {it.kind === 'pillar' ? it.p.title : it.label}
                        </span>
                        {it.kind === 'pillar' && (
                          <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>{it.p.summary}</span>
                        )}
                      </span>
                      {it.kind === 'pillar' && it.p.run && (
                        <span style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim }}>step {it.p.run}</span>
                      )}
                      {it.kind === 'pillar' && it.p.legacy && (
                        <span style={{ ...LBL, fontSize: 9, color: '#64748b' }}>legacy</span>
                      )}
                      {on && <CornerDownLeft size={14} style={{ color: t.inkDim }} aria-hidden="true" />}
                    </li>
                  )
                })}
              </ul>
              <div className="flex items-center gap-4 px-5 py-2.5" style={{ borderTop: `1px solid ${t.hairline}`, fontFamily: FONT.mono, fontSize: 11, color: t.inkDim }}>
                <span>↑↓ move</span><span>↵ open</span><span>esc close</span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

export const PALETTE_ICONS = { Sun, Moon, FileText, Play }
