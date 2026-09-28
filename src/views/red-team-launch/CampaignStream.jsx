import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ShieldX, ShieldCheck, Loader2, AlertTriangle, ArrowUpRight, CheckCircle2, Circle, Radar, Goal, Clock,
} from 'lucide-react'
import { FONT, label as LBL, glass, SEVERITY } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import {
  catMeta, targetMeta, JOB_TYPE, statusMeta, TERMINAL, pct, fmtNum, fmtPct, relTime, pretty, fmtEta, useCampaignTelemetry,
} from './redTeamModel'

/**
 * CampaignStream — the centre of the Red Teaming console.
 *
 * Empty: the architecture (passed in). With a campaign: a card for the
 * campaign itself — status, overall progress, per-category progress for an
 * attack-library run, the agent's stages for an agent run, ETA, what is being
 * attacked right now, target errors — and below it the feed.
 *
 * The feed shows attack PROMPTS (the list endpoint's unit), each tried several
 * times; its own ASR is the share of those attempts that landed. An agent
 * campaign has no prompt list — its feed is the goals the agent pursued.
 * Clicking a row opens the campaign report at that attack or goal, where its
 * responses live.
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

function Bar({ t, value, tone, height = 6 }) {
  return (
    <div className="rounded-full overflow-hidden" style={{ height, background: t.railBed }}>
      <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} style={{ background: tone }} />
    </div>
  )
}

function StatusPill({ t, status }) {
  const st = statusMeta(status)
  const tone = t[st.tone] ?? t.idle
  const live = !TERMINAL.has(status)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 flex-shrink-0"
          style={{ height: 24, fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 700, color: t.isLight ? shade(tone, 0.28) : tone, background: `${tone}17` }}>
      <span className={`rounded-full ${live ? 'animate-pulse' : ''}`} style={{ width: 7, height: 7, background: tone }} aria-hidden="true" />
      {st.label}
    </span>
  )
}

// ─── the campaign card ───────────────────────────────────────────────────────

function CampaignCard({ t, tone, job, jobError }) {
  const meta = targetMeta(job.target_type ?? job.target?.target_type)
  const TIcon = meta.icon
  const rm = job.runtime_metrics ?? {}
  const done = rm.attempts_completed ?? null
  const total = rm.attempts_total ?? null
  const overall = total ? pct(done, total) : pct(job.completed, job.total)
  const running = !TERMINAL.has(job.status)
  const rows = job.progress?.kind === 'standard' ? job.progress.rows ?? [] : []
  const stages = job.progress?.kind === 'agentic' ? job.progress.stages ?? [] : []
  const failMsg = job.extra_info?.error_message
  const barTone = running ? t.live : job.status === 'COMPLETED' ? t.pass : t.warn

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden" style={glass(t, { radius: 22 })}>
      <header className="flex items-start gap-3 px-4 pt-4 pb-3">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 38, height: 38, background: bandBg(tone), boxShadow: `0 5px 12px ${tone}45` }}>
          <TIcon size={17} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>{JOB_TYPE[job.job_type]?.label ?? pretty(job.job_type)} campaign</span>
          </div>
          <div className="truncate" title={job.name} style={{ fontFamily: FONT.display, fontSize: 16, fontWeight: 700, color: t.ink, marginTop: 1 }}>{job.target?.name ?? job.name}</div>
          <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginTop: 1 }}>
            {meta.label} · {pretty(job.target?.connection_type)} · started {relTime(job.created_at)}
          </div>
        </div>
        <StatusPill t={t} status={job.status} />
      </header>

      <div className="px-4 pb-4">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 700, color: t.ink, lineHeight: 1 }}>{Math.round(overall)}%</span>
          <span style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>
            {total ? `${fmtNum(done)} of ${fmtNum(total)} attempts` : `${fmtNum(job.completed)} of ${fmtNum(job.total)} attacks`}
          </span>
          <span className="ml-auto inline-flex items-center gap-3" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
            {running && rm.eta_seconds != null && <span className="inline-flex items-center gap-1"><Clock size={11} aria-hidden="true" /> about {fmtEta(rm.eta_seconds)} left</span>}
            {rm.error_count > 0 && (
              <span title="Attempts where the target returned an error" style={{ color: t.isLight ? shade(t.warn, 0.35) : t.warn }}>
                {fmtNum(rm.error_count)} target errors{rm.error_percentage != null ? ` · ${fmtPct(rm.error_percentage)}` : ''}
              </span>
            )}
          </span>
        </div>
        <Bar t={t} value={overall} tone={barTone} height={8} />
        {running && rm.currently_attacking && (
          <p style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginTop: 8 }}>
            Attacking now: <span style={{ color: t.ink, fontWeight: 600 }}>{pretty(rm.currently_attacking)}</span>
          </p>
        )}

        {rows.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {rows.map((r) => {
              const m = catMeta(r.label)
              const Icon = m.icon
              return (
                <div key={r.label}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="grid place-items-center rounded-md flex-shrink-0" style={{ width: 20, height: 20, background: `${m.hue}17`, color: t.isLight ? shade(m.hue, 0.1) : m.hue }}>
                      <Icon size={11} aria-hidden="true" />
                    </span>
                    <span style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{m.label}</span>
                    <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{r.sub_categories?.length ?? 0} sub-categories</span>
                    <span className="ml-auto flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>{fmtNum(r.completed)} / {fmtNum(r.total)}</span>
                  </div>
                  <Bar t={t} value={pct(r.completed, r.total)} tone={r.status === 'complete' ? m.hue : t.live} />
                </div>
              )
            })}
          </div>
        )}

        {stages.length > 0 && (
          <ol className="mt-4 space-y-2">
            {stages.map((st) => {
              const complete = st.status === 'complete'
              const active = st.status === 'running' || st.status === 'in_progress'
              return (
                <li key={st.stage} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 mt-0.5" style={{ color: complete ? t.pass : active ? t.live : t.inkFaint }}>
                    {complete ? <CheckCircle2 size={15} aria-hidden="true" /> : active ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{pretty(st.stage)}</span>
                    {/* PA sends "UNKNOWN" as a sub-step label for some stages — say nothing rather than that. */}
                    {st.sub_steps?.some((x) => x.label && x.label !== 'UNKNOWN') && (
                      <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }}>
                        {st.sub_steps.filter((x) => x.label && x.label !== 'UNKNOWN').map((x) => x.label).join(' · ')}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ol>
        )}

        {(failMsg && job.status !== 'COMPLETED') || jobError ? (
          <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: `${t.warn}12`, border: `1px solid ${t.warn}40` }}>
            <div className="flex items-center gap-1.5" style={{ fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: t.ink }}>
              <AlertTriangle size={13} style={{ color: t.warn }} aria-hidden="true" /> {jobError ? 'Could not refresh the campaign' : 'The target returned errors'}
            </div>
            <p className="break-words" style={{ fontFamily: FONT.mono, fontSize: 10.5, lineHeight: 1.5, color: t.inkDim, marginTop: 4, maxHeight: 64, overflow: 'hidden' }}>
              {jobError ?? String(failMsg).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
            </p>
          </div>
        ) : null}
      </div>
    </motion.section>
  )
}

// ─── the feed ────────────────────────────────────────────────────────────────

function AttackRow({ t, a, onOpen, index }) {
  const reduce = useReducedMotion()
  const [hot, setHot] = useState(false)
  const landed = a.threat === true
  const tone = landed ? t.block : t.pass
  const ink = t.isLight ? shade(tone, 0.25) : tone
  const sev = SEVERITY[String(a.severity ?? '').toLowerCase()] ?? t.idle
  const Icon = landed ? ShieldX : ShieldCheck
  return (
    <motion.button type="button" onClick={() => onOpen(a)}
                   initial={reduce || index > 24 ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: Math.min(index * 0.02, 0.35), duration: 0.2 }}
                   onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
                   className={`w-full flex items-start gap-3 rounded-2xl text-left ${focusCls}`}
                   style={{
                     padding: '10px 10px 10px 11px', background: t.panel,
                     border: `1px solid ${hot ? `${tone}66` : landed ? `${tone}33` : t.hairline}`,
                     boxShadow: hot ? `0 8px 18px ${tone}1f` : 'none', transition: 'border-color 150ms ease, box-shadow 180ms ease',
                   }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${tone}17`, color: ink }}>
        <Icon size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 flex-wrap">
          <span style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{a.sub_category_display_name ?? pretty(a.sub_category) ?? 'Attack'}</span>
          <span className="inline-flex items-center gap-1" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }}>
            <span className="rounded-full" style={{ width: 6, height: 6, background: sev }} aria-hidden="true" />
            {String(a.severity ?? '').toUpperCase()} · {a.category_display_name ?? pretty(a.category)}{a.multi_turn ? ' · multi-turn' : ''}
          </span>
        </span>
        <span className="block truncate" dir="auto" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim, marginTop: 3 }}>{a.prompt}</span>
      </span>
      <span className="flex items-center gap-2 flex-shrink-0">
        <span className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, lineHeight: '20px', color: ink, background: `${tone}17` }}
              title={landed ? 'Share of this prompt’s attempts that landed' : 'Every attempt with this prompt was resisted'}>
          {landed ? `landed · ${fmtPct(a.asr)}` : 'resisted'}
        </span>
        <span className="grid place-items-center rounded-full" aria-hidden="true"
              style={{ width: 26, height: 26, color: hot ? '#fff' : t.inkDim, background: hot ? shade(tone) : t.sunken, transition: 'background 140ms ease, color 140ms ease' }}>
          <ArrowUpRight size={13} />
        </span>
      </span>
    </motion.button>
  )
}

function GoalRow({ t, g, onOpen, index }) {
  const reduce = useReducedMotion()
  const [hot, setHot] = useState(false)
  const tone = g.threat ? t.block : t.pass
  const ink = t.isLight ? shade(tone, 0.25) : tone
  return (
    <motion.button type="button" onClick={() => onOpen(g)}
                   initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: Math.min(index * 0.03, 0.35), duration: 0.2 }}
                   onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
                   className={`w-full flex items-start gap-3 rounded-2xl text-left ${focusCls}`}
                   style={{ padding: '10px 10px 10px 11px', background: t.panel, border: `1px solid ${hot ? `${tone}66` : g.threat ? `${tone}33` : t.hairline}`, transition: 'border-color 150ms ease' }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${tone}17`, color: ink }}>
        <Goal size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1" style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.45, color: t.ink,
                                                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {g.goal_to_show || g.goal}
      </span>
      <span className="rounded-full px-2 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, lineHeight: '20px', color: ink, background: `${tone}17` }}>
        {g.threat ? 'goal reached' : 'held'}
      </span>
    </motion.button>
  )
}

function Feed({ t, tone, s, onOpenAttack, onOpenGoal }) {
  const [filter, setFilter] = useState('all')
  const job = s.job
  const dynamic = job.job_type === 'DYNAMIC'
  const tel = useCampaignTelemetry(dynamic ? job.uuid : null, job.status)
  const { landed, resisted, totals, loaded } = s.attacks
  const list = useMemo(() => (filter === 'landed' ? landed : filter === 'resisted' ? resisted : [...landed, ...resisted]), [filter, landed, resisted])
  const running = !TERMINAL.has(job.status)

  if (dynamic) {
    const goals = tel.data?.goals?.items ?? []
    return (
      <section className="mt-4">
        <div className="flex items-center gap-2 px-1 mb-2">
          <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Goals the agent pursued</span>
          {tel.data?.report && (
            <span className="ml-auto" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>
              {tel.data.report.goals_achieved} of {tel.data.report.total_goals} reached · {fmtNum(tel.data.report.total_streams)} conversations
            </span>
          )}
        </div>
        {tel.loading && <div className="flex items-center gap-2 px-2 py-3" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}><Loader2 size={13} className="animate-spin" /> Loading goals…</div>}
        {!tel.loading && !goals.length && (
          <p className="rounded-2xl px-4 py-5 text-center" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, background: t.sunken }}>
            {running ? 'Goals appear once the agent has profiled the target and generated them.' : 'This campaign recorded no goals.'}
          </p>
        )}
        <div className="space-y-1.5">{goals.map((g, i) => <GoalRow key={g.uuid ?? i} t={t} g={g} index={i} onOpen={onOpenGoal} />)}</div>
      </section>
    )
  }

  const pills = [
    ['all', 'All', (totals?.landed ?? 0) + (totals?.resisted ?? 0)],
    ['landed', 'Landed', totals?.landed],
    ['resisted', 'Resisted', totals?.resisted],
  ]
  return (
    <section className="mt-4">
      <div className="flex items-center gap-1.5 flex-wrap px-1 mb-2">
        <span className="mr-1" style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Attack prompts</span>
        {running && (
          <span className="inline-flex items-center gap-1 mr-1" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, color: t.isLight ? shade(t.live, 0.2) : t.live }}>
            <span className="rounded-full animate-pulse" style={{ width: 6, height: 6, background: t.live }} aria-hidden="true" /> live
          </span>
        )}
        <span className="ml-auto flex gap-1.5">
          {pills.map(([id, label, n]) => {
            const on = filter === id
            const c = id === 'landed' ? t.block : id === 'resisted' ? t.pass : tone
            return (
              <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={on}
                      className={`rounded-full px-3 inline-flex items-center gap-1.5 ${focusCls}`}
                      style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? '#fff' : t.inkDim, background: on ? bandBg(c) : t.sunken, border: `1px solid ${on ? 'transparent' : t.hairline}` }}>
                {label}{n != null && <span style={{ fontFamily: FONT.mono, fontSize: 10.5, opacity: 0.8 }}>{fmtNum(n)}</span>}
              </button>
            )
          })}
        </span>
      </div>

      {!loaded ? (
        <div className="flex items-center gap-2 px-2 py-3" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>
          <Loader2 size={13} className="animate-spin" /> {running ? 'First results arrive a few seconds after launch…' : 'Loading attacks…'}
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-2xl px-4 py-5 text-center" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, background: t.sunken }}>
          {running ? 'No attacks have finished yet — the feed fills in as they do.' : filter === 'landed' ? 'No attack landed.' : 'No attacks recorded for this campaign.'}
        </p>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {list.map((a, i) => <AttackRow key={a.uuid} t={t} a={a} index={i} onOpen={onOpenAttack} />)}
          </AnimatePresence>
        </div>
      )}
      {loaded && list.length > 0 && (
        <p className="px-1 mt-2.5" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.5, color: t.inkDim }}>
          The latest 50 landed and 50 resisted prompts. Each prompt is tried several times; open one for its responses, or the full report for every attack.
        </p>
      )}
    </section>
  )
}

export function CampaignStream({ t, tone, s, empty, onOpenAttack, onOpenGoal }) {
  if (!s.campaignId) return <div className="flex-1 min-h-0 overflow-y-auto">{empty}</div>
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-5">
      {!s.job ? (
        s.jobError ? (
          <div className="rounded-2xl px-4 py-4" style={{ background: `${t.warn}12`, border: `1px solid ${t.warn}44` }}>
            <div className="flex items-center gap-2" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>
              <AlertTriangle size={15} style={{ color: t.warn }} aria-hidden="true" /> This campaign did not load
            </div>
            <p style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginTop: 4 }}>{s.jobError}</p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-16" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>
            <Radar size={15} className="animate-pulse" aria-hidden="true" /> Loading the campaign…
          </div>
        )
      ) : (
        <>
          <CampaignCard t={t} tone={tone} job={s.job} jobError={s.jobError} />
          <Feed t={t} tone={tone} s={s} onOpenAttack={onOpenAttack} onOpenGoal={onOpenGoal} />
        </>
      )}
    </div>
  )
}
