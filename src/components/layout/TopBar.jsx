import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, HelpCircle, User, ChevronRight } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'
import { PulsingDot } from '../shared/PulsingDot'

const VIEW_LABELS = {
  apiIntercept:  { label: 'API Intercept',                sublabel: 'Real-time payload interception & telemetry' },
  modelScanning: { label: 'Model Scanning',               sublabel: 'AI model vulnerability assessment' },
  redTeaming:    { label: 'Red Teaming',                  sublabel: 'Automated adversarial campaign runner' },
  claudeHooks:   { label: 'AI Code Assistant Protection', sublabel: 'Claude Code hooks integration guide' },
}

export function TopBar() {
  const { state } = useAppContext()
  const theme = useProtectionTheme()
  const view = VIEW_LABELS[state.activeView] || VIEW_LABELS.apiIntercept

  return (
    <header className="flex items-center h-14 px-6 border-b border-white/10 bg-base-900/60 backdrop-blur-md flex-shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-1">
        <span className="text-xs text-slate-500">SUDO AIRS Demo</span>
        <ChevronRight size={12} className="text-slate-700" />
        <AnimatePresence mode="wait">
          <motion.div
            key={state.activeView}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <span className={`text-sm font-semibold ${theme.primaryText} transition-colors duration-500`}>
              {view.label}
            </span>
            <span className="hidden md:block text-xs text-slate-500">·</span>
            <span className="hidden md:block text-xs text-slate-500">{view.sublabel}</span>
          </motion.div>
        </AnimatePresence>
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
        <button className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
          <HelpCircle size={14} />
        </button>
        <div className="w-7 h-7 ml-1 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 border border-white/20 flex items-center justify-center">
          <User size={12} className="text-slate-300" />
        </div>
      </div>
    </header>
  )
}
