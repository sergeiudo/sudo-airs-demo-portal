import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Plus, Power } from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { shade, bandGlass } from '../home-2027/band'

/**
 * SessionActions — the runtime pillar's controls on the unified header.
 *
 * The one AIRS switch (it replaces the old top bar's SECURED BY AIRS pill —
 * two switches for one state was one too many) and a fresh session. The
 * target, model and session tally stay in the console itself: on the header
 * they only repeated the target cards and the transcript.
 */
export function SessionActions({ t, tone, isProtected, onToggleProtection, onNewSession }) {
  const reduce = useReducedMotion()
  const sh = shade(tone)
  const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
  return (
    <>
      <button type="button" onClick={onToggleProtection} aria-pressed={isProtected}
              title={isProtected ? 'AIRS is inspecting — click to turn it off' : 'AIRS is off — click to turn it on'}
              className={`inline-flex flex-shrink-0 items-center gap-2 rounded-full pl-2.5 pr-3 whitespace-nowrap transition-transform active:scale-[0.97] ${focus}`}
              style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 700, color: sh, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.18)' }}>
        <span className="relative flex" style={{ width: 8, height: 8 }} aria-hidden="true">
          {isProtected && !reduce && (
            <motion.span className="absolute inset-0 rounded-full" style={{ background: t.pass }}
                         animate={{ scale: [1, 2.3], opacity: [0.55, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />
          )}
          <span className="relative rounded-full" style={{ width: 8, height: 8, background: isProtected ? t.pass : t.warn }} />
        </span>
        {isProtected ? 'AIRS inspecting' : 'AIRS off'}
        <Power size={12} style={{ opacity: 0.6 }} aria-hidden="true" />
      </button>
      <button type="button" onClick={onNewSession} title="Clear the transcript and start a fresh session"
              className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 whitespace-nowrap ${focus}`}
              style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, ...bandGlass, transition: 'background 160ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.34)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = bandGlass.background }}>
        <Plus size={13} aria-hidden="true" /> New session
      </button>
    </>
  )
}
