import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, HelpCircle, ChevronRight, Sun, Moon, ArrowLeft } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'
import { PulsingDot } from '../shared/PulsingDot'
import { HelpDrawer } from './HelpDrawer'
import airsLogo from '../../../prisma-AIRS_RGB_logo_Lockup_Negative.png'

const VIEW_LABELS = {
  apiIntercept:    { label: 'API Intercept',                sublabel: 'Real-time payload interception & telemetry', text: 'text-red-400',    color: '#EF4444' },
  modelScanning:   { label: 'Model Scanning',               sublabel: 'AI model vulnerability assessment',          text: 'text-blue-400',   color: '#3B82F6' },
  redTeaming:      { label: 'Red Teaming',                  sublabel: 'Automated adversarial campaign runner',      text: 'text-orange-400', color: '#F97316' },
  claudeHooks:     { label: 'AI Code Assistant Protection', sublabel: 'Claude Code hooks integration guide',        text: 'text-purple-400', color: '#8B5CF6' },
  observability:   { label: 'LLM Telemetry',                sublabel: 'Prompt history, metrics & pipeline traces',  text: 'text-teal-400',   color: '#10B981' },
  developerCorner: { label: 'Developer Corner',             sublabel: 'Integration guide & API reference',          text: 'text-indigo-400', color: '#06B6D4' },
  mcpSecurity:     { label: 'MCP Security',                 sublabel: 'Live MCP tool protection with Prisma AIRS',  text: 'text-cyan-400',   color: '#06B6D4' },
}

export function TopBar() {
  const { state, dispatch } = useAppContext()
  const theme = useProtectionTheme()
  const [helpOpen, setHelpOpen] = useState(false)
  const view = VIEW_LABELS[state.activeView] ?? VIEW_LABELS.apiIntercept

  return (
    <header className="flex items-center h-16 px-6 border-b border-white/10 flex-shrink-0" style={{ background: '#13161f' }}>
      {/* Home + Breadcrumb */}
      <div className="flex items-center gap-3 flex-1">
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

      {/* Status pill */}
      <AnimatePresence mode="wait">
        <motion.div
          key={theme.isProtected ? 'secured' : 'vulnerable'}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.25 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-500 ${theme.primaryBg2} ${theme.primaryBorder2}`}
        >
          <PulsingDot size="xs" />
          <span className={`text-[10px] font-bold tracking-widest ${theme.primaryText} transition-colors duration-500`}>
            {theme.statusLabel}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center gap-1 ml-4">
        <button className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
          <Bell size={14} />
        </button>
        <button
          onClick={() => setHelpOpen(true)}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
          title="Demo guide"
        >
          <HelpCircle size={14} />
        </button>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
          title={state.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {state.isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </header>
  )
}
