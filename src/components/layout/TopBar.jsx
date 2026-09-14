import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, HelpCircle, ChevronRight, Sun, Moon, ArrowLeft, ExternalLink } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'
import { PulsingDot } from '../shared/PulsingDot'
import { HelpDrawer } from './HelpDrawer'
import airsLogo from '../../../prisma-AIRS_RGB_logo_Lockup_Negative.png'

const VIEW_LABELS = {
  apiIntercept:    { label: 'AIRS Runtime & AI-GW',         sublabel: 'API-layer scanning vs in-gateway guardrail · four targets', text: 'text-red-400',    color: '#EF4444' },
  modelScanning:   { label: 'Model Scanning',               sublabel: 'AI model vulnerability assessment',          text: 'text-blue-400',   color: '#3B82F6' },
  redTeaming:      { label: 'Red Teaming',                  sublabel: 'Automated adversarial campaign runner',      text: 'text-orange-400', color: '#F97316' },
  claudeHooks:     { label: 'AI Code Assistant Protection', sublabel: 'Claude Code hooks integration guide',        text: 'text-purple-400', color: '#8B5CF6' },
  observability:   { label: 'LLM Telemetry',                sublabel: 'Prompt history, metrics & pipeline traces',  text: 'text-teal-400',   color: '#10B981' },
  developerCorner: { label: 'Developer Corner',             sublabel: 'Integration guide & API reference',          text: 'text-indigo-400', color: '#06B6D4' },
  mcpSecurity:     { label: 'MCP Security',                 sublabel: 'Live MCP tool protection with Prisma AIRS',  text: 'text-cyan-400',   color: '#06B6D4' },
  ragSecurity:     { label: 'RAG Security',                 sublabel: 'Retrieval-Augmented Generation pipeline protection', text: 'text-amber-400', color: '#F59E0B' },
  llmGateway:      { label: 'AI/LLM Gateway',               sublabel: 'Portkey gateway + Prisma AIRS guardrail',           text: 'text-pink-400',   color: '#EC4899' },
  ministryHealth:  { label: 'Ministry of Health',           sublabel: 'בריאות.AI — bilingual HE/EN health assistant demo', text: 'text-sky-400',    color: '#0EA5E9' },
}

/** One utility icon inside the segmented control on the right. */
function IconButton({ isLight, onClick, title, children }) {
  const hover = isLight ? 'rgba(0,48,135,0.08)' : 'rgba(255,255,255,0.08)'
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-full transition-colors"
      style={{ color: isLight ? '#64748b' : '#94a3b8', background: 'transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = hover; e.currentTarget.style.color = isLight ? '#1e293b' : '#e2e8f0' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isLight ? '#64748b' : '#94a3b8' }}
    >
      {children}
    </button>
  )
}

export function TopBar() {
  const { state, dispatch } = useAppContext()
  const theme = useProtectionTheme()
  const [helpOpen, setHelpOpen] = useState(false)
  const view = VIEW_LABELS[state.activeView] ?? VIEW_LABELS.apiIntercept
  const isLight = !state.isDark

  /* The SCM link is navigation to a product, so it keeps PAN brand blue
     instead of the protection theme. scmUrl survives an AIRS toggle, and a
     red "SCM Console" sitting next to a red VULNERABLE pill reads as an
     error rather than as the evidence link it is. */
  const scm = isLight
    ? { bg: 'rgba(0,48,135,0.055)', border: 'rgba(0,48,135,0.18)', hover: 'rgba(0,48,135,0.10)', icon: 'rgba(0,48,135,0.10)', color: '#003087' }
    : { bg: 'rgba(56,189,248,0.10)', border: 'rgba(56,189,248,0.30)', hover: 'rgba(56,189,248,0.18)', icon: 'rgba(56,189,248,0.16)', color: '#7dd3fc' }

  const groupBg     = isLight ? 'rgba(0,48,135,0.04)' : 'rgba(255,255,255,0.04)'
  const groupBorder = isLight ? 'rgba(0,48,135,0.09)' : 'rgba(255,255,255,0.07)'

  return (
    <header className="flex items-center h-16 px-6 border-b border-white/10 flex-shrink-0" style={{ background: '#13161f' }}>
      {/* Home + Breadcrumb */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={13} /> Home
        </button>
        <div className="w-px h-4 bg-white/10 flex-shrink-0" />
        <ChevronRight size={12} className="text-slate-700" />
        <AnimatePresence mode="wait">
          <motion.div
            key={state.activeView}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 px-3 py-1 rounded-lg"
            style={view.color ? { background: `${view.color}18`, border: `1px solid ${view.color}30` } : {}}
          >
            <span className={`text-sm font-semibold ${view.text || theme.primaryText} transition-colors duration-500`}>
              {view.label}
            </span>
            <span className="hidden md:block text-xs text-slate-500">·</span>
            <span className="hidden md:block text-xs text-slate-500">{view.sublabel}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Center: logo + author */}
      <div className="flex flex-col items-center gap-1 mx-6">
        <div className={state.isDark ? '' : 'bg-slate-600 px-3 py-1 rounded-lg'}>
          <img src={airsLogo} alt="Prisma AIRS" className="h-5 opacity-90" />
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 whitespace-nowrap">
          <span className="text-[10px] font-bold text-slate-300">Sergei (SUDO) Udovenko</span>
          <span className="text-slate-600 text-[9px]">·</span>
          <span className="text-[9px] text-slate-500">Systems Engineer · Palo Alto Networks</span>
        </div>
      </div>

      {/* Right cluster: verdict · SCM deep link · utilities. flex-1 on both
          sides so the logo block is centred on the header, not on what is
          left over after the breadcrumb. */}
      <div className="flex flex-1 items-center justify-end gap-2.5">

        {/* Status pill. The AI/LLM Gateway pillar ignores the global AIRS toggle
            (its guardrail is chosen per-request in the Live Demo), so showing
            "VULNERABLE" there is misleading — show a neutral pillar badge instead. */}
        {state.activeView === 'llmGateway' ? (
          <div className="flex items-center gap-2 h-8 px-3.5 rounded-full border"
               style={{ background: 'rgba(236,72,153,0.12)', borderColor: 'rgba(236,72,153,0.4)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ec4899' }} />
            <span className="text-[10px] font-bold tracking-widest" style={{ color: '#ec4899' }}>
              GUARDRAIL PER REQUEST
            </span>
          </div>
        ) : state.activeView === 'ministryHealth' ? (
          /* Same reason as the gateway pillar: MOH owns its own AIRS switch per
             tab, so a global "VULNERABLE" pill next to an "AIRS פעיל" panel just
             contradicts itself on the projector. */
          <div className="flex items-center gap-2 h-8 px-3.5 rounded-full border"
               style={{ background: 'rgba(14,165,233,0.12)', borderColor: 'rgba(14,165,233,0.4)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#0ea5e9' }} />
            <span className="text-[10px] font-bold tracking-widest" style={{ color: '#0ea5e9' }}>
              AIRS PER SCENARIO
            </span>
          </div>
        ) : (
          /* The pill is also the control: it already names the state, so
             reading it and changing it should not be two different places.
             The sidebar toggle stays — it is the one that is visible while
             the sidebar is open. Both dispatch the same action. */
          <AnimatePresence mode="wait">
            <motion.button
              key={theme.isProtected ? 'secured' : 'vulnerable'}
              onClick={() => dispatch({ type: 'TOGGLE_PROTECTION' })}
              title={theme.isProtected
                ? 'AIRS protection is ON — click to disable'
                : 'AIRS protection is OFF — click to enable'}
              aria-pressed={theme.isProtected}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.25 }}
              className={`flex items-center gap-2 h-8 pl-3.5 pr-1.5 rounded-full border transition-all duration-500
                ${theme.primaryBg2} ${theme.primaryBorder2} ${theme.primaryHoverBg2} ${theme.primaryText}`}
            >
              <PulsingDot size="xs" />
              <span className="text-[10px] font-bold tracking-widest transition-colors duration-500">
                {theme.statusLabel}
              </span>
              {/* switch track — makes the pill legible as a control without a
                  hover, which a projector audience never sees */}
              <span className="relative flex-shrink-0 rounded-full"
                    style={{
                      width: 26, height: 14,
                      background: isLight ? 'rgba(0,48,135,0.10)' : 'rgba(255,255,255,0.14)',
                      border: `1px solid ${theme.glowColor}`,
                    }}>
                <span className="absolute rounded-full transition-all duration-300"
                      style={{
                        width: 8, height: 8, top: 2,
                        left: theme.isProtected ? 13 : 3,
                        background: 'currentColor',
                      }} />
              </span>
            </motion.button>
          </AnimatePresence>
        )}

        {/* SCM Console — same deep link the sidebar carries, but the sidebar
            only reveals it on hover, so the evidence trail is one click away
            from anywhere once a protected scan has run. */}
        <AnimatePresence>
          {state.scmUrl && (
            <motion.a
              key="scm"
              href={state.scmUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open this scan in Strata Cloud Manager"
              initial={{ opacity: 0, y: -6, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.94 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="flex items-center gap-2 h-8 pl-1.5 pr-3.5 rounded-full border transition-colors"
              style={{ background: scm.bg, borderColor: scm.border, color: scm.color }}
              onMouseEnter={(e) => { e.currentTarget.style.background = scm.hover }}
              onMouseLeave={(e) => { e.currentTarget.style.background = scm.bg }}
            >
              <span className="grid place-items-center w-5 h-5 rounded-full flex-shrink-0" style={{ background: scm.icon }}>
                <ExternalLink size={10} />
              </span>
              <span className="hidden lg:flex flex-col items-start leading-none">
                <span className="text-[10px] font-bold tracking-wide">SCM Console</span>
                <span className="text-[8px] font-medium opacity-65 mt-[3px]">Strata Cloud Manager</span>
              </span>
              <span className="lg:hidden text-[10px] font-bold tracking-wide">SCM</span>
            </motion.a>
          )}
        </AnimatePresence>

        {/* Utilities, as one segmented control rather than three loose icons */}
        <div className="flex items-center gap-0.5 p-1 rounded-full"
             style={{ background: groupBg, border: `1px solid ${groupBorder}` }}>
          <IconButton isLight={isLight} title="Notifications">
            <Bell size={14} />
          </IconButton>
          <IconButton isLight={isLight} onClick={() => setHelpOpen(true)} title="Demo guide">
            <HelpCircle size={14} />
          </IconButton>
          <IconButton
            isLight={isLight}
            onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
            title={state.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {state.isDark ? <Sun size={14} /> : <Moon size={14} />}
          </IconButton>
        </div>
      </div>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </header>
  )
}
