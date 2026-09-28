import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { shade, bandGlass } from '../home-2027/band'
import { TERMINAL, statusMeta, pct } from './redTeamModel'

/**
 * CampaignActions — the Red Teaming pillar's controls on the unified header.
 *
 * The campaign's state in the white pill the other consoles use (here it
 * reports, like the supply chain's scanner pill — there is no AIRS switch: a
 * campaign attacks the target as deployed), and New campaign, which clears the
 * view without touching a campaign that is still running in Prisma AIRS.
 */

export function CampaignActions({ t, tone, s }) {
  const reduce = useReducedMotion()
  const job = s.job
  const running = !!job && !TERMINAL.has(job.status)
  const rm = job?.runtime_metrics ?? {}
  const p = job ? Math.round(rm.attempts_total ? pct(rm.attempts_completed, rm.attempts_total) : pct(job.completed, job.total)) : 0
  const label = !s.campaignId ? 'No campaign open'
    : !job ? 'Loading campaign…'
    : running ? `Campaign running · ${p}%`
    : `Campaign ${statusMeta(job.status).label.toLowerCase()}`
  const dot = running ? t.live : !job ? t.idle : job.status === 'COMPLETED' ? t.pass : t.warn
  const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
  return (
    <>
      <span role="status" className="inline-flex flex-shrink-0 items-center gap-2 rounded-full pl-2.5 pr-3 whitespace-nowrap"
            style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 700, color: shade(tone), background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.18)' }}>
        <span className="relative flex" style={{ width: 8, height: 8 }} aria-hidden="true">
          {running && !reduce && (
            <motion.span className="absolute inset-0 rounded-full" style={{ background: dot }}
                         animate={{ scale: [1, 2.3], opacity: [0.55, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />
          )}
          <span className="relative rounded-full" style={{ width: 8, height: 8, background: dot }} />
        </span>
        {label}
      </span>
      <button type="button" onClick={s.newCampaign} disabled={!s.campaignId} title="Close this campaign and build a new one — a running campaign keeps running"
              className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 whitespace-nowrap disabled:opacity-50 ${focus}`}
              style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, ...bandGlass, transition: 'background 160ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.34)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = bandGlass.background }}>
        <Plus size={13} aria-hidden="true" /> New campaign
      </button>
    </>
  )
}
