import React, { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { FONT } from '../../views/api-intercept-2027/tokens'
import { useAppContext } from '../../context/AppContext'

/**
 * Tip — a tooltip that says what an icon means, in the launch design.
 *
 * An icon-only button's native `title` shows late, small and unstyled — and
 * on a projector it is usually never seen. Tip shows a title and one line of
 * explanation beside the control: on hover after a short delay, at once on
 * keyboard focus, hidden on Escape. It is portalled to <body>, because the
 * bars these icons live in clip their overflow.
 *
 * Wrap exactly one focusable element; Tip adds aria-describedby to it. The
 * element keeps its own aria-label (the name); the tip is the description.
 *
 *   <Tip title="Release notes" text="Every Prisma AIRS feature, month by month">
 *     <button aria-label="Prisma AIRS release notes">…</button>
 *   </Tip>
 *
 * `side` is a preference — the tip flips when there is no room.
 */

const GAP = 9
const MAX_W = 260

export function Tip({ title, text, kbd, side = 'bottom', delay = 280, children }) {
  const reduce = useReducedMotion()
  const { state } = useAppContext()
  const id = useId()
  const anchor = useRef(null)
  const box = useRef(null)
  const timer = useRef(0)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null) // { left, top, place, nub }

  const measure = useCallback(() => {
    const el = anchor.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const h = box.current?.offsetHeight ?? 64
    const w = Math.min(MAX_W, box.current?.offsetWidth ?? MAX_W)
    const room = { top: r.top, bottom: window.innerHeight - r.bottom }
    const place = side === 'top'
      ? (room.top >= h + GAP + 8 ? 'top' : 'bottom')
      : (room.bottom >= h + GAP + 8 ? 'bottom' : 'top')
    const cx = r.left + r.width / 2
    const left = Math.min(Math.max(cx, w / 2 + 8), window.innerWidth - w / 2 - 8)
    setPos({ left, top: place === 'bottom' ? r.bottom + GAP : r.top - GAP, place, nub: cx - left })
  }, [side])

  const show = useCallback((now) => {
    clearTimeout(timer.current)
    if (now) { setOpen(true); return }
    timer.current = setTimeout(() => setOpen(true), delay)
  }, [delay])
  const hide = useCallback(() => { clearTimeout(timer.current); setOpen(false) }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  // Measure once the box exists (its height decides whether it flips).
  useLayoutEffect(() => { if (open) measure() }, [open, measure])
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') hide() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide) }
  }, [open, hide])

  const child = React.Children.only(children)
  const trigger = cloneElement(child, {
    ref: (el) => {
      anchor.current = el
      const { ref } = child
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    'aria-describedby': open ? id : undefined,
    onMouseEnter: (e) => { child.props.onMouseEnter?.(e); show(false) },
    onMouseLeave: (e) => { child.props.onMouseLeave?.(e); hide() },
    onFocus: (e) => { child.props.onFocus?.(e); if (e.currentTarget.matches?.(':focus-visible')) show(true) },
    onBlur: (e) => { child.props.onBlur?.(e); hide() },
    onClick: (e) => { child.props.onClick?.(e); hide() },
  })

  const dark = state.isDark !== false
  const bg = dark ? '#2C2C33' : '#1C1C21'

  return (
    <>
      {trigger}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && (
            // Positioned by a plain div: framer-motion owns `transform` on the
            // animated one and would drop the centring translate.
            <div key="tip" id={id} role="tooltip" ref={box} className="fixed pointer-events-none"
                 style={{
                   zIndex: 10000, left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: 'max-content', maxWidth: MAX_W,
                   transform: `translate(-50%, ${pos?.place === 'top' ? '-100%' : '0'})`,
                 }}>
            <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, y: pos?.place === 'top' ? 4 : -4, scale: 0.98 }}
                        animate={{ opacity: pos ? 1 : 0, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}>
              <div className="relative rounded-xl px-3 py-2"
                   style={{ background: bg, border: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent', boxShadow: '0 10px 28px rgba(0,0,0,0.28)' }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>{title}</span>
                  {kbd && (
                    <kbd style={{ fontFamily: FONT.mono, fontSize: 10, color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 5, padding: '0 5px' }}>{kbd}</kbd>
                  )}
                </div>
                {text && <div style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: 'rgba(255,255,255,0.78)', marginTop: 2 }}>{text}</div>}
                <span aria-hidden="true" className="absolute"
                      style={{
                        left: `calc(50% + ${pos?.nub ?? 0}px)`, width: 10, height: 10, background: bg, marginLeft: -5,
                        transform: 'rotate(45deg)',
                        ...(pos?.place === 'top' ? { bottom: -5 } : { top: -5 }),
                        ...(dark ? (pos?.place === 'top'
                          ? { borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }
                          : { borderLeft: '1px solid rgba(255,255,255,0.1)', borderTop: '1px solid rgba(255,255,255,0.1)' }) : {}),
                      }} />
              </div>
            </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
