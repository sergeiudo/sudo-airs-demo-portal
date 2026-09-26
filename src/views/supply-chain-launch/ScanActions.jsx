import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Plus, RefreshCw } from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { shade, bandGlass } from '../home-2027/band'

/**
 * ScanActions — the AI Supply Chain pillar's controls on the unified header.
 *
 * The scanner's health (it used to be a chip in the rail) in the white pill the
 * runtime console uses for its AIRS switch — here it reports rather than
 * toggles, and a click re-checks — and a fresh session. The header band itself
 * is hatched when the scanner is down (PillarHeader `warn`).
 */

const STATE = {
  checking: { label: 'Checking scanner…', dot: 'idle' },
  live:     { label: 'Scanner live',      dot: 'pass' },
  stub:     { label: 'Scanner in stub mode', dot: 'warn' },
  offline:  { label: 'Scanner offline',   dot: 'warn' },
}

export function ScanActions({ t, tone, health, busy, onNewSession }) {
  const reduce = useReducedMotion()
  const s = STATE[health.state] ?? STATE.checking
  const dot = t[s.dot]
  const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
  return (
    <>
      <button type="button" onClick={health.recheck} title="Re-check the model scanner"
              className={`inline-flex flex-shrink-0 items-center gap-2 rounded-full pl-2.5 pr-3 whitespace-nowrap transition-transform active:scale-[0.97] ${focus}`}
              style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 700, color: shade(tone), background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.18)' }}>
        <span className="relative flex" style={{ width: 8, height: 8 }} aria-hidden="true">
          {health.state === 'live' && !reduce && (
            <motion.span className="absolute inset-0 rounded-full" style={{ background: dot }}
                         animate={{ scale: [1, 2.3], opacity: [0.55, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />
          )}
          <span className="relative rounded-full" style={{ width: 8, height: 8, background: dot }} />
        </span>
        {s.label}
        <RefreshCw size={11} className={health.state === 'checking' ? 'animate-spin' : ''} style={{ opacity: 0.6 }} aria-hidden="true" />
      </button>
      <button type="button" onClick={onNewSession} disabled={busy} title="Clear the scan history and start a fresh session"
              className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 whitespace-nowrap disabled:opacity-50 ${focus}`}
              style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, ...bandGlass, transition: 'background 160ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.34)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = bandGlass.background }}>
        <Plus size={13} aria-hidden="true" /> New session
      </button>
    </>
  )
}
