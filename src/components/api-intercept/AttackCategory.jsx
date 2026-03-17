import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Zap, AlertTriangle, Scissors, Database, Terminal } from 'lucide-react'
import { StatusBadge } from '../shared/StatusBadge'

const ICON_MAP = {
  Syringe: Zap,
  Terminal: Terminal,
  Scissors: Scissors,
  Database: Database,
  AlertTriangle: AlertTriangle,
}

const COLOR_CLASSES = {
  red: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  orange: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  pink: { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
}

export function AttackCategory({ category, onSelectAttack, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const Icon = ICON_MAP[category.icon] || Zap
  const colors = COLOR_CLASSES[category.color] || COLOR_CLASSES.red

  return (
    <div className={`rounded-lg border ${isOpen ? colors.border : 'border-white/10'} overflow-hidden transition-colors duration-200`}>
      {/* Category header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-200 ${
          isOpen ? colors.bg : 'hover:bg-white/5'
        }`}
      >
        <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${colors.bg}`}>
          <Icon size={12} className={colors.text} />
        </div>
        <span className={`flex-1 text-xs font-semibold ${isOpen ? colors.text : 'text-slate-400'} transition-colors`}>
          {category.label}
        </span>
        <span className="text-[10px] text-slate-600 mr-1">{category.attacks.length}</span>
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={12} className="text-slate-500" />
        </motion.span>
      </button>

      {/* Attacks list */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-1 bg-black/20">
              {category.attacks.map((attack, i) => (
                <motion.button
                  key={attack.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onSelectAttack(attack)}
                  className="w-full flex items-start gap-2 p-2 rounded-lg text-left hover:bg-white/5 border border-transparent hover:border-white/10 transition-all duration-150 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors truncate">
                      {attack.label}
                    </div>
                    <div className="text-[10px] text-slate-600 truncate">{attack.technique}</div>
                  </div>
                  <StatusBadge status={attack.severity} className="flex-shrink-0 mt-0.5" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
