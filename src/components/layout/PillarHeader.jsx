import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ExternalLink, HelpCircle, Sun, Moon } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { DesignSwitch } from '../shared/DesignSwitch'
import { HelpDrawer } from './HelpDrawer'
import { FONT, label as LBL } from '../../views/api-intercept-2027/tokens'
import { bandBg, bandDots, bandGlass } from '../../views/home-2027/band'
import { HOME_PILLARS } from '../../views/home-2027/homeData'
import airsLogo from '../../../prisma-AIRS_RGB_logo_Lockup_Negative.png'

/**
 * PillarHeader — the pillar's one header: the portal top bar merged into the
 * pillar band, in a single row.
 *
 *   left   Home, the pillar's icon, step · product area, title
 *   middle the Prisma AIRS lockup with the author credit under it (the old
 *          top bar's arrangement)
 *   right  the pillar's own controls (`actions`), then the portal's: the SCM
 *          deep link once a scan has run, Classic | New, the demo guide and
 *          the theme toggle
 *
 * `actions` is pillar-specific because the status control differs per pillar
 * (a global AIRS switch on the runtime console; per-request guardrails on the
 * gateway, per-scenario on MOH, none on model scanning). `warn` hatches the
 * band — used for "AIRS off", so the state reads from the back of the room.
 *
 * Built for every pillar; a view opts in by rendering it and asking
 * MainLayout to drop the TopBar (App.jsx, `unifiedHeader`).
 */

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

function ChromeIcon({ label, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
            className={`grid place-items-center rounded-full transition-colors ${focus}`}
            style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.88)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
      {children}
    </button>
  )
}

export function PillarHeader({ pillarId, warn = false, actions }) {
  const { state, dispatch } = useAppContext()
  const [helpOpen, setHelpOpen] = useState(false)
  const pillar = HOME_PILLARS.find((p) => p.id === pillarId)
  if (!pillar) return null
  const Icon = pillar.icon
  const tone = pillar.legacy ? '#94a3b8' : pillar.accent

  return (
    <>
    <header className="relative flex-shrink-0 overflow-hidden mx-3 mt-3 flex items-center gap-3 px-3"
            style={{ height: 60, borderRadius: 20, background: bandBg(tone), boxShadow: `0 12px 30px ${tone}30, 0 3px 10px rgba(18,18,22,0.06)` }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(circle at 88% 0%, rgba(255,255,255,0.22), transparent 55%)' }} />
      <AnimatePresence>
        {warn && (
          <motion.div key="hatch" aria-hidden="true" className="absolute inset-0 pointer-events-none"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.16) 0 10px, transparent 10px 22px)' }} />
        )}
      </AnimatePresence>
      <Icon aria-hidden="true" strokeWidth={1.3}
            style={{ position: 'absolute', right: 300, top: -46, width: 150, height: 150, color: '#fff', opacity: 0.1, transform: 'rotate(-10deg)', pointerEvents: 'none' }} />

      {/* ── left: where you are ── */}
      <div className="relative flex items-center gap-3 flex-shrink-0 min-w-0">
        <button type="button" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 flex-shrink-0 ${focus}`}
                style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, ...bandGlass }}>
          <ArrowLeft size={13} aria-hidden="true" /> Home
        </button>
        <span className="grid place-items-center rounded-xl flex-shrink-0"
              style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
          <Icon size={17} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div className="min-w-0 leading-none">
          <div className="whitespace-nowrap" style={{ ...LBL, fontSize: 9, color: 'rgba(255,255,255,0.8)' }}>
            {pillar.run ? `Step ${String(pillar.run).padStart(2, '0')} · ` : ''}{pillar.area}
          </div>
          <h1 className="whitespace-nowrap" style={{ fontFamily: FONT.display, fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em', color: '#fff', marginTop: 4 }}>
            {pillar.title}
          </h1>
        </div>
      </div>

      {/* ── middle: the brand and the author ── */}
      <div className="relative flex-1 min-w-0 hidden lg:flex flex-col items-center justify-center gap-1">
        <img src={airsLogo} alt="Prisma AIRS" style={{ height: 17 }} />
        <span className="whitespace-nowrap" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: 'rgba(255,255,255,0.9)' }}>
          <span style={{ fontWeight: 700 }}>Sergei (SUDO) Udovenko</span>
          <span className="hidden 2xl:inline" style={{ opacity: 0.75 }}> · Systems Engineer · Palo Alto Networks</span>
        </span>
      </div>
      <div className="flex-1 lg:hidden" />

      {/* ── right: the pillar's controls, then the portal's ── */}
      <div className="relative flex items-center gap-2 flex-shrink-0">
        {actions}
        {actions && <span aria-hidden="true" style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.25)', margin: '0 2px' }} />}
        <AnimatePresence>
          {state.scmUrl && (
            <motion.a key="scm" href={state.scmUrl} target="_blank" rel="noopener noreferrer"
                      title="Open this scan in Strata Cloud Manager"
                      initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
                      transition={{ duration: 0.2 }}
                      className={`inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-3 flex-shrink-0 ${focus}`}
                      style={{ height: 30, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.34)' }}>
              <span className="grid place-items-center rounded-full" style={{ width: 20, height: 20, background: 'rgba(255,255,255,0.22)' }}>
                <ExternalLink size={11} aria-hidden="true" />
              </span>
              SCM Console
            </motion.a>
          )}
        </AnimatePresence>
        <DesignSwitch compact onBand />
        <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ background: bandGlass.background, border: bandGlass.border }}>
          <ChromeIcon label="Demo guide" onClick={() => setHelpOpen(true)}><HelpCircle size={14} /></ChromeIcon>
          <ChromeIcon label={state.isDark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => dispatch({ type: 'TOGGLE_THEME' })}>
            {state.isDark ? <Sun size={14} /> : <Moon size={14} />}
          </ChromeIcon>
        </div>
      </div>
    </header>
    {/* Outside the header: its overflow clip must never reach the drawer. */}
    <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
