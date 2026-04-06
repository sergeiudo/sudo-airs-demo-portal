import React, { useState } from 'react'
import { Crosshair, ScanSearch, Swords, Terminal, Settings, Activity, ExternalLink, BarChart2, Code2, Network } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Logo } from '../sidebar/Logo'
import { ProtectionToggle } from '../sidebar/ProtectionToggle'
import { NavItem } from '../sidebar/NavItem'
import { useAppContext } from '../../context/AppContext'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'

const NAV_ITEMS = [
  {
    id: 'apiIntercept',
    label: 'API Intercept',
    sublabel: 'Live payload simulation',
    icon: Crosshair,
    color: { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    bar: 'bg-red-400' },
  },
  {
    id: 'modelScanning',
    label: 'Model Scanning',
    sublabel: 'CVE vulnerability scanner',
    icon: ScanSearch,
    color: { text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   bar: 'bg-blue-400' },
  },
  {
    id: 'redTeaming',
    label: 'Red Teaming',
    sublabel: 'Automated attack campaigns',
    icon: Swords,
    color: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', bar: 'bg-orange-400' },
  },
  {
    id: 'claudeHooks',
    label: 'AI Code Assistant Protection',
    sublabel: 'IDE security integration',
    icon: Terminal,
    color: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', bar: 'bg-purple-400' },
  },
  {
    id: 'observability',
    label: 'LLM Telemetry',
    sublabel: 'Prompt history & metrics',
    icon: BarChart2,
    color: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30', bar: 'bg-teal-400' },
  },
  {
    id: 'developerCorner',
    label: 'Developer Corner',
    sublabel: 'Integration guide & API ref',
    icon: Code2,
    color: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', bar: 'bg-indigo-400' },
  },
  {
    id: 'mcpSecurity',
    label: 'MCP Security',
    sublabel: 'Live MCP tool protection demo',
    icon: Network,
    color: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', bar: 'bg-cyan-400' },
  },
]

export function Sidebar() {
  const [expanded, setExpanded] = useState(false)
  const { state, dispatch } = useAppContext()
  const theme = useProtectionTheme()

  const setView = (id) => dispatch({ type: 'SET_VIEW', payload: id })

  return (
    <motion.aside
      animate={{ width: expanded ? 260 : 64 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className="flex flex-col flex-shrink-0 h-full border-r border-white/10 bg-base-900/80 backdrop-blur-xl overflow-hidden z-20"
    >
      {/* Logo */}
      <div className="px-3 pt-5 pb-4 flex-shrink-0">
        <Logo collapsed={!expanded} />
      </div>

      {/* Protection Toggle */}
      <ProtectionToggle collapsed={!expanded} />

      {/* SCM Console link — appears after first scan */}
      <AnimatePresence>
        {state.scmUrl && expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-3 overflow-hidden"
          >
            <a
              href={state.scmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 my-2 rounded-lg border text-xs font-semibold transition-all duration-300 ${theme.primaryBg2} ${theme.primaryBorder2} ${theme.primaryText} ${theme.primaryHoverBg2}`}
            >
              <ExternalLink size={12} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div>View in SCM Console</div>
                <div className="text-[9px] font-normal opacity-60 truncate">Strata Cloud Manager</div>
              </div>
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="flex-1 px-2 pt-4 space-y-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mb-2 px-2"
            >
              <span className="text-[9px] font-semibold tracking-[0.2em] text-slate-600 uppercase">
                Products
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            sublabel={item.sublabel}
            isActive={state.activeView === item.id}
            onClick={() => setView(item.id)}
            color={item.color}
            collapsed={!expanded}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-4 space-y-3">
        {/* System health */}
        <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${theme.primaryBorder2} ${theme.primaryBg2} transition-all duration-500 ${!expanded ? 'justify-center' : ''}`}>
          <Activity size={12} className={`${theme.primaryText} flex-shrink-0 transition-colors duration-500`} />
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0"
              >
                <div className={`text-[10px] font-semibold ${theme.primaryText} transition-colors duration-500`}>
                  System Status
                </div>
                <div className="text-[10px] text-slate-500 whitespace-nowrap">All scanners operational</div>
              </motion.div>
            )}
          </AnimatePresence>
          {expanded && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme.pulseColor} animate-pulse transition-colors duration-500`} />}
        </div>

      </div>
    </motion.aside>
  )
}
