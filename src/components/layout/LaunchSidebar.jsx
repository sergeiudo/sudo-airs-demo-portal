import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Search, Pin, PinOff, Activity, ChevronRight, Sun, Moon, FileText } from 'lucide-react'
import { MessageCircleQuestion } from 'lucide-react'
import { openAskAirs } from '../shared/askairs/askStore'
import { useAppContext } from '../../context/AppContext'
import { tokens, FONT, label as LBL } from '../../views/api-intercept-2027/tokens'
import { shade, bandBg } from '../../views/home-2027/band'
import { RUN_OF_SHOW, DEEP_DIVES, OPERATE, HOME_PILLARS, markOpened } from '../../views/home-2027/homeData'
import { CommandPalette } from '../../views/home-2027/overlays'
import { useServerStatus, ServerStatusCard } from '../shared/ServerStatus'
import { NAV_ITEMS } from './navItems'

/**
 * LaunchSidebar — the portal's pillar rail in the New design.
 *
 * Built from the home's own data (HOME_PILLARS: title, accent, icon, area,
 * run of show), so the rail and the launcher can never disagree on names,
 * colours or order: Run of show 01–05, Deep dives, Operate.
 *
 *   collapsed  a 72px rail of tinted icon squares; the open pillar is a band
 *   open       hover (with intent delay) or keyboard focus floats a 284px panel
 *              OVER the page — the Classic sidebar animated its width inside
 *              the flex row, so every hover reflowed the whole console
 *   pinned     keeps it open and docked (remembered per browser)
 *
 * What it deliberately no longer carries: the AIRS switch (the pillar header
 * or top bar owns it — one switch per state) and the SCM link (same). The
 * "All scanners operational" line was static text; the footer now shows the
 * real configuration check the home's Ready pill runs.
 *
 * Classic keeps components/layout/Sidebar.jsx.
 */

const RAIL = 72
const OPEN = 284
const PIN_KEY = 'sudo-airs.sidebar.pinned'
const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

const SECTIONS = [
  { id: 'run', title: 'Run of show', items: RUN_OF_SHOW },
  { id: 'deep', title: 'Deep dives', items: DEEP_DIVES },
  { id: 'ops', title: 'Operate', items: OPERATE },
]

const toneOf = (p) => (p.legacy ? '#94a3b8' : p.accent)
// One line under each title: the Classic sidebar's descriptions (one source),
// falling back to the home's product area.
const SUB = Object.fromEntries(NAV_ITEMS.map((n) => [n.id, n.sublabel]))

function PillarRow({ t, pillar, active, open, onLaunch }) {
  const [hot, setHot] = useState(false)
  const Icon = pillar.icon
  const tone = toneOf(pillar)
  const ink = t.isLight ? shade(tone, 0.28) : tone
  return (
    <button type="button" onClick={() => onLaunch(pillar.id)} aria-current={active ? 'page' : undefined}
            aria-label={`${pillar.title}${pillar.run ? ` — step ${pillar.run}` : ''}`}
            onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className={`relative w-full flex items-center gap-3 rounded-2xl text-left ${focusCls}`}
            style={{ height: 50, padding: '0 8px 0 10px', background: active ? `${tone}17` : hot ? t.sunken : 'transparent', transition: 'background 140ms' }}>
      {active && open && <span className="absolute rounded-full" style={{ left: 2, top: 12, bottom: 12, width: 3, background: tone }} aria-hidden="true" />}
      <span className="relative grid place-items-center rounded-xl flex-shrink-0"
            style={{
              width: 34, height: 34,
              background: active ? bandBg(tone) : `${tone}16`,
              boxShadow: active ? `0 5px 14px ${tone}55` : 'none',
              transition: 'background 160ms, box-shadow 200ms',
            }}>
        <Icon size={16} strokeWidth={active ? 2.3 : 2} style={{ color: active ? '#fff' : ink }} aria-hidden="true" />
        {pillar.run && !open && (
          <span className="absolute grid place-items-center rounded-full"
                style={{ right: -5, bottom: -4, minWidth: 16, height: 16, padding: '0 3px', fontFamily: FONT.mono, fontSize: 9, fontWeight: 700, color: active ? '#fff' : t.inkDim, background: active ? shade(tone, 0.3) : t.panel, border: `1px solid ${active ? 'transparent' : t.hairline}` }}>
            {pillar.run}
          </span>
        )}
      </span>
      <span className="flex-1 min-w-0" style={{ opacity: open ? 1 : 0, transition: 'opacity 140ms' }}>
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 13, fontWeight: active ? 700 : 600, color: active ? (t.isLight ? shade(tone, 0.4) : t.ink) : t.ink, lineHeight: 1.25 }}>{pillar.title}</span>
        <span className="block truncate" style={{ fontFamily: "Inter, Heebo, system-ui, sans-serif", fontSize: 11, color: t.inkDim, marginTop: 1 }}>{SUB[pillar.id] ?? pillar.area}</span>
      </span>
      {open && pillar.run && (
        <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 700, color: active ? ink : t.inkFaint }}>{String(pillar.run).padStart(2, '0')}</span>
      )}
      {open && pillar.legacy && (
        <span className="flex-shrink-0 rounded-full px-1.5" style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 600, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>legacy</span>
      )}
    </button>
  )
}

function FooterRow({ t, icon: Icon, tone, title, sub, open, onClick, expanded, children }) {
  const [hot, setHot] = useState(false)
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} aria-label={`${title}${sub ? ` — ${sub}` : ''}`}
            onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className={`w-full flex items-center gap-3 rounded-2xl text-left ${focusCls}`}
            style={{ height: 44, padding: '0 8px 0 10px', background: hot || expanded ? t.sunken : 'transparent' }}>
      <span className="relative grid place-items-center rounded-xl flex-shrink-0" style={{ width: 34, height: 34, background: t.sunken, border: `1px solid ${t.hairline}` }}>
        <Icon size={15} style={{ color: t.inkDim }} aria-hidden="true" />
        {tone && <span className="absolute rounded-full" style={{ top: -2, right: -2, width: 9, height: 9, background: tone, border: `2px solid ${t.panel}` }} aria-hidden="true" />}
      </span>
      <span className="flex-1 min-w-0" style={{ opacity: open ? 1 : 0, transition: 'opacity 140ms' }}>
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{title}</span>
        {sub && <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{sub}</span>}
      </span>
      {open && children}
    </button>
  )
}

export function LaunchSidebar() {
  const { state, dispatch } = useAppContext()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const pf = useServerStatus()

  const [pinned, setPinned] = useState(() => { try { return localStorage.getItem(PIN_KEY) === '1' } catch { return false } })
  const [hover, setHover] = useState(false)
  const [focusIn, setFocusIn] = useState(false)
  const [preflight, setPreflight] = useState(null)   // anchor rect while the popover is open
  const [palette, setPalette] = useState(false)
  const timer = useRef(null)
  const panelRef = useRef(null)
  const open = pinned || hover || focusIn || !!preflight

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  // Hover intent: a pointer crossing the left edge on its way somewhere should
  // not throw a panel over the page.
  const enter = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setHover(true), 110) }
  // Leaving with the pointer closes it even if a button inside kept focus
  // (a click, or focus handed back by the palette) — pointer users expect it.
  const leave = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setHover(false); setFocusIn(false)
      panelRef.current?.querySelector(':focus')?.blur()
    }, 220)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  const togglePin = () => setPinned((p) => { const n = !p; try { localStorage.setItem(PIN_KEY, n ? '1' : '0') } catch { /* private mode */ } return n })

  const launch = useCallback((id) => {
    markOpened(id)
    dispatch({ type: 'SET_VIEW', payload: id })
    if (!pinned) { setHover(false); panelRef.current?.querySelector(':focus')?.blur() }
  }, [dispatch, pinned])

  // ⌘K / Ctrl+K — the home's jump palette, from any pillar.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true) }
      if (e.key === 'Escape' && !pinned && (hover || focusIn) && !preflight) {
        setHover(false); panelRef.current?.querySelector(':focus')?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pinned, hover, focusIn, preflight])

  const readyTone = !pf.loaded ? t.idle : pf.warn ? t.warn : t.pass
  const readyLabel = !pf.loaded ? 'Checking the server…' : pf.warn ? 'Server · check setup' : 'Server · ready'

  const openPreflight = (e) => {
    if (preflight) { setPreflight(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    if (!pf.sys && !pf.sysBusy) pf.readHost()
    setPreflight({ left: (panelRef.current?.getBoundingClientRect().right ?? r.right) + 10, bottom: window.innerHeight - r.bottom })
  }
  useEffect(() => {
    if (!preflight) return undefined
    const onDown = (e) => { if (!e.target.closest?.('[data-preflight-pop]') && !panelRef.current?.contains(e.target)) setPreflight(null) }
    const onKey = (e) => { if (e.key === 'Escape') setPreflight(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [preflight])

  const actions = useMemo(() => [
    { id: 'home', label: 'Home — all pillars', icon: Shield, run: () => dispatch({ type: 'SET_VIEW', payload: 'home' }) },
    { id: 'theme', label: state.isDark ? 'Switch to light theme' : 'Switch to dark theme', icon: state.isDark ? Sun : Moon, run: () => dispatch({ type: 'TOGGLE_THEME' }) },
    { id: 'ask', label: 'Ask AIRS — answers from the Prisma AIRS docs', icon: MessageCircleQuestion, run: openAskAirs },
    { id: 'notes', label: 'Prisma AIRS release notes', icon: FileText, run: () => dispatch({ type: 'SET_VIEW', payload: 'releaseNotes' }) },
  ], [dispatch, state.isDark])

  const floating = open && !pinned

  return (
    <div className="relative flex-shrink-0 h-full z-40" style={{ width: pinned ? OPEN : RAIL, transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)' }}>
      <motion.nav ref={panelRef} aria-label="Pillars"
                  onMouseEnter={enter} onMouseLeave={leave}
                  // Keyboard focus opens it; a mouse click focuses a button too, and
                  // must not hold the panel open after the pointer leaves.
                  onFocus={(e) => { if (e.target.matches?.(':focus-visible')) setFocusIn(true) }}
                  onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusIn(false) }}
                  initial={false} animate={{ width: open ? OPEN : RAIL }} transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute left-0 top-0 bottom-0 flex flex-col overflow-hidden"
                  style={{
                    background: t.panel,
                    borderRight: `1px solid ${t.hairline}`,
                    boxShadow: floating ? (t.isLight ? '18px 0 44px rgba(18,18,22,0.14), 2px 0 8px rgba(18,18,22,0.06)' : '18px 0 44px rgba(0,0,0,0.5)') : 'none',
                    transition: 'box-shadow 200ms',
                  }}>
        {/* brand → home */}
        <div className="flex items-center gap-1 px-2.5 pt-3 pb-2 flex-shrink-0" style={{ width: OPEN }}>
          <button type="button" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })} aria-label="Home — all pillars"
                  className={`flex-1 min-w-0 flex items-center gap-3 rounded-2xl text-left ${focusCls}`} style={{ padding: '6px 8px 6px 7px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = t.sunken }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 38, height: 38, background: `${t.pass}18`, border: `1px solid ${t.pass}40` }}>
              <Shield size={18} style={{ color: t.pass }} aria-hidden="true" />
            </span>
            <span className="min-w-0 leading-none" style={{ opacity: open ? 1 : 0, transition: 'opacity 140ms' }}>
              <span className="block whitespace-nowrap" style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink }}>SUDO AIRS Demo</span>
              <span className="block whitespace-nowrap" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 4 }}>Home · all pillars</span>
            </span>
          </button>
          {open && (
            <button type="button" onClick={togglePin} aria-pressed={pinned} aria-label={pinned ? 'Unpin the sidebar' : 'Pin the sidebar open'} title={pinned ? 'Unpin' : 'Keep open'}
                    className={`grid place-items-center rounded-full flex-shrink-0 ${focusCls}`}
                    style={{ width: 30, height: 30, color: pinned ? (t.isLight ? shade(t.live, 0.2) : t.live) : t.inkDim, background: pinned ? `${t.live}17` : 'transparent' }}>
              {pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
          )}
        </div>

        {/* jump */}
        <div className="px-2.5 pb-1 flex-shrink-0" style={{ width: OPEN }}>
          <button type="button" onClick={() => setPalette(true)} aria-label="Jump to a pillar"
                  className={`w-full flex items-center gap-3 rounded-2xl text-left ${focusCls}`}
                  style={{ height: 40, padding: '0 10px 0 9px', background: open ? t.sunken : 'transparent', border: `1px solid ${open ? t.hairline : 'transparent'}`, transition: 'background 140ms' }}>
            <span className="grid place-items-center flex-shrink-0" style={{ width: 34, height: 34 }}>
              <Search size={16} style={{ color: t.inkDim }} aria-hidden="true" />
            </span>
            <span className="flex-1 truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, opacity: open ? 1 : 0, transition: 'opacity 140ms' }}>Jump to a pillar…</span>
            {open && <kbd style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkFaint, border: `1px solid ${t.hairline}`, borderRadius: 6, padding: '1px 5px' }}>{isMac ? '⌘K' : 'Ctrl K'}</kbd>}
          </button>
        </div>

        {/* pillars */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2.5 pb-2" style={{ width: OPEN }}>
          {SECTIONS.map((sec, si) => (
            <section key={sec.id} aria-label={sec.title}>
              <div className="flex items-center" style={{ height: 30, marginTop: si ? 6 : 4, paddingLeft: 12 }}>
                {open
                  ? <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>{sec.title}</span>
                  : <span className="rounded-full" style={{ width: 28, height: 1, background: t.hairline }} aria-hidden="true" />}
              </div>
              <div className="space-y-0.5">
                {sec.items.map((p) => (
                  <PillarRow key={p.id} t={t} pillar={p} open={open} active={state.activeView === p.id} onLaunch={launch} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* footer: the real readiness check */}
        <div className="px-2.5 pb-3 pt-2 flex-shrink-0" style={{ width: OPEN, borderTop: `1px solid ${t.hairline}` }}>
          <FooterRow t={t} icon={Activity} tone={readyTone} title={readyLabel} sub="Services, host, processes" open={open}
                     onClick={openPreflight} expanded={!!preflight}>
            <ChevronRight size={14} style={{ color: t.inkDim, transform: preflight ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} aria-hidden="true" />
          </FooterRow>
        </div>
      </motion.nav>

      {createPortal(
        <AnimatePresence>
          {preflight && (
            <motion.div data-preflight-pop role="dialog" aria-label="Server status"
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.15 }}
                        className="fixed z-[60]" style={{ left: preflight.left, bottom: preflight.bottom, width: 'min(560px, calc(100vw - 24px))' }}>
              <ServerStatusCard t={t} st={pf} onClose={() => setPreflight(null)} maxHeight={`calc(100vh - ${preflight.bottom + 16}px)`} />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <CommandPalette t={t} open={palette} onClose={() => setPalette(false)} pillars={HOME_PILLARS} onLaunch={launch} actions={actions} />
    </div>
  )
}
