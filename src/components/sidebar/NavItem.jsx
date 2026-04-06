import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'

// Extract raw color value from Tailwind class e.g. 'bg-red-500/10' → 'rgba(239,68,68,0.1)'
const COLOR_VALS = {
  'text-red-400':    '#f87171',
  'text-blue-400':   '#60a5fa',
  'text-orange-400': '#fb923c',
  'text-purple-400': '#c084fc',
  'text-teal-400':   '#2dd4bf',
  'text-emerald-400':'#34d399',
  'text-indigo-400': '#818cf8',
  'text-cyan-400':   '#22d3ee',
  'text-pink-400':   '#f472b6',
  'text-yellow-400': '#facc15',
  'text-sky-400':    '#38bdf8',
}
const BG_VALS = {
  'bg-red-500/10':    'rgba(239,68,68,0.10)',
  'bg-blue-500/10':   'rgba(59,130,246,0.10)',
  'bg-orange-500/10': 'rgba(249,115,22,0.10)',
  'bg-purple-500/10': 'rgba(168,85,247,0.10)',
  'bg-teal-500/10':   'rgba(20,184,166,0.10)',
  'bg-emerald-500/10':'rgba(16,185,129,0.10)',
  'bg-indigo-500/10': 'rgba(99,102,241,0.10)',
  'bg-cyan-500/10':   'rgba(6,182,212,0.10)',
  'bg-pink-500/10':   'rgba(236,72,153,0.10)',
  'bg-yellow-500/10': 'rgba(234,179,8,0.10)',
  'bg-sky-500/10':    'rgba(14,165,233,0.10)',
}
const BORDER_VALS = {
  'border-red-500/30':    'rgba(239,68,68,0.30)',
  'border-blue-500/30':   'rgba(59,130,246,0.30)',
  'border-orange-500/30': 'rgba(249,115,22,0.30)',
  'border-purple-500/30': 'rgba(168,85,247,0.30)',
  'border-teal-500/30':   'rgba(20,184,166,0.30)',
  'border-emerald-500/30':'rgba(16,185,129,0.30)',
  'border-indigo-500/30': 'rgba(99,102,241,0.30)',
  'border-cyan-500/30':   'rgba(6,182,212,0.30)',
  'border-pink-500/30':   'rgba(236,72,153,0.30)',
  'border-yellow-500/30': 'rgba(234,179,8,0.30)',
  'border-sky-500/30':    'rgba(14,165,233,0.30)',
}

export function NavItem({ icon: Icon, label, sublabel, isActive, onClick, color, collapsed }) {
  const theme = useProtectionTheme()
  const [hovered, setHovered] = useState(false)
  const c = isActive && color ? color : null

  const hoverBg     = color ? BG_VALS[color.bg]         : null
  const hoverBorder = color ? BORDER_VALS[color.border]  : null
  const hoverText   = color ? COLOR_VALS[color.text]     : null

  const activeBg     = c ? BG_VALS[c.bg]         : null
  const activeBorder = c ? BORDER_VALS[c.border]  : null

  const buttonStyle = isActive
    ? { backgroundColor: activeBg, borderColor: activeBorder, borderWidth: 1, borderStyle: 'solid' }
    : hovered && hoverBg
      ? { backgroundColor: hoverBg, borderColor: hoverBorder, borderWidth: 1, borderStyle: 'solid' }
      : { borderColor: 'transparent', borderWidth: 1, borderStyle: 'solid' }

  const iconColor = isActive
    ? (c ? COLOR_VALS[c.text] : undefined)
    : hovered && hoverText ? hoverText : undefined

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? label : undefined}
      className={`relative w-full flex items-center gap-3 rounded-lg text-left transition-all duration-200 group
        ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
      `}
      style={buttonStyle}
      whileTap={{ scale: 0.98 }}
    >
      {/* Active indicator bar — only when expanded */}
      {isActive && !collapsed && (
        <motion.span
          layoutId="nav-indicator"
          className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${c ? c.bar : theme.pulseColor}`}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      <Icon
        size={16}
        strokeWidth={isActive ? 2.5 : 2}
        className="flex-shrink-0 transition-colors duration-200"
        style={{ color: iconColor ?? (isActive ? undefined : hovered ? hoverText ?? '#94a3b8' : '#64748b') }}
      />

      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-medium transition-colors duration-200"
            style={{ color: isActive ? (iconColor ?? undefined) : hovered ? (hoverText ?? '#94a3b8') : '#94a3b8' }}
          >
            {label}
          </div>
          {sublabel && (
            <div className="text-[10px] text-slate-600 truncate">{sublabel}</div>
          )}
        </div>
      )}
    </motion.button>
  )
}
