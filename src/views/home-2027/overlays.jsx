import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X, ArrowUpRight, Search, CornerDownLeft, Sun, Moon, FileText, Play } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { hl } from '../HomeViewV2'

/**
 * overlays.jsx — the two dialogs on the home page.
 *
 *   DetailsSheet   — a pillar's full story, from the right. Replaces the old
 *                    centred modal: the grid stays visible beside it, and Launch
 *                    is the first thing in it rather than the last.
 *   CommandPalette — ⌘K / Ctrl+K / "/" to jump to any pillar or action. With
 *                    ten pillars, typing "moh" beats scanning a grid mid-demo.
 *
 * Both trap focus, close on Escape and hand focus back to whatever opened them.
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
                    <span style={{ ...LBL, fontSize: 10.5, color: t.inkDim }}>{pillar.area}</span>
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
