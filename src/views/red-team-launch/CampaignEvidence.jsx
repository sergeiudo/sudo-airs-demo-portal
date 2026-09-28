import React, { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Swords, ShieldCheck, ShieldAlert, AlertTriangle, Loader2, ExternalLink, ArrowUpRight, Activity, Crosshair, BarChart3,
  Flame, Goal, Radar, FileBarChart, ServerCrash,
} from 'lucide-react'
import { FONT, label as LBL, glass, SEVERITY } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots } from '../home-2027/band'
import { Block, EvidenceLook, ctaWash } from '../api-intercept-2027/EvidencePane'
import {
  TERMINAL, catMeta, targetMeta, JOB_TYPE, statusMeta, riskLevel, riskTone, fmtPct, fmtNum, pct, pretty,
  subcategoryResults, severityRows, attemptTotals, scmCampaignUrl, useCampaignTelemetry,
} from './redTeamModel'

/**
 * CampaignEvidence — the Red Teaming console's right pane: the campaign's
 * verdict and its weak spots at a glance. Everything deeper lives in the
 * campaign report drawer, opened from the card under the SCM link, from a
 * weak category (at its attacks) or from the runtime-profile row.
 *
 * The verdict is Prisma AIRS' own: the risk level is read from its report
 * summary and the score is its risk score (lower is better). Nothing here
 * invents a threshold.
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

// ─── empty ───────────────────────────────────────────────────────────────────

export function CampaignEvidenceEmpty({ t, tone }) {
  const reduce = useReducedMotion()
  const rows = [
    { icon: Radar, title: 'Verdict', text: 'Prisma AIRS’ own risk level and risk score for the campaign.' },
    { icon: Crosshair, title: 'Attack success', text: 'How many attempts landed, and how bad they were by severity.' },
    { icon: Flame, title: 'Weakest categories', text: 'The sub-categories where the target gave in most often.' },
    { icon: ShieldCheck, title: 'Red team to runtime', text: 'The AIRS runtime profile recommended from what landed.' },
    { icon: Activity, title: 'Full campaign report', text: 'Executive summary, OWASP mapping, every attack with its replies, and fixes.' },
  ]
  return (
    <div className="flex flex-col h-full overflow-hidden" style={glass(t, { radius: 22 })}>
      <div className="relative flex-shrink-0 overflow-hidden" style={{ height: 96, background: bandBg(tone) }}>
        <div aria-hidden="true" className="absolute inset-0" style={bandDots} />
        <Swords aria-hidden="true" strokeWidth={1.3} style={{ position: 'absolute', right: -24, bottom: -40, width: 150, height: 150, color: '#fff', opacity: 0.15, transform: 'rotate(-10deg)' }} />
        <div className="relative h-full flex items-center gap-3 px-4">
          <motion.span className="grid place-items-center rounded-2xl flex-shrink-0"
                       animate={reduce ? undefined : { scale: [1, 1.06, 1] }} transition={{ duration: 2.4, repeat: Infinity }}
                       style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
            <Swords size={20} style={{ color: '#fff' }} aria-hidden="true" />
          </motion.span>
          <div className="min-w-0">
            <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Evidence</div>
            <div style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 2 }}>Standing by</div>
            <div style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 1 }}>No campaign open</div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, marginBottom: 10 }}>What lands here for each campaign</div>
        <ul className="space-y-3">
          {rows.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: `${t.live}14`, color: t.live }}>
                <Icon size={15} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{title}</span>
                <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 pt-3" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.inkDim, borderTop: `1px solid ${t.hairline}` }}>
          Launch a campaign, or open one from History to walk through a finished report.
        </p>
      </div>
    </div>
  )
}

// ─── verdict ─────────────────────────────────────────────────────────────────

/** "The agent has low risk with an overall Risk Score of 7.7/100." — PA's words, first sentence of its Summary. */
export function summaryLine(summary) {
  const s = String(summary ?? '')
  const m = s.match(/###\s*Summary\s*\n+([^\n]+)/i)
  return (m ? m[1] : '').trim() || null
}

export function campaignVerdict(t, job, report) {
  const st = job?.status
  if (!job) return { tone: t.live, title: 'Loading', where: 'campaign', why: 'Fetching the campaign…', icon: Loader2, spin: true }
  if (!TERMINAL.has(st)) {
    const rm = job.runtime_metrics ?? {}
    const p = rm.attempts_total ? pct(rm.attempts_completed, rm.attempts_total) : pct(job.completed, job.total)
    return { tone: t.live, title: statusMeta(st).label, where: `${JOB_TYPE[job.job_type]?.label ?? 'campaign'} in progress`, why: `${Math.round(p)}% · results fill in as attacks finish`, icon: Radar, pulse: true }
  }
  if (st === 'COMPLETED') {
    const level = riskLevel(report?.report_summary ?? job.report_stats?.report_summary)
    const tone = riskTone(t, level)
    const score = report?.score ?? job.score
    const asr = report?.asr ?? job.asr
    return {
      tone, level,
      title: level ? `${level.charAt(0).toUpperCase()}${level.slice(1)} risk` : 'Completed',
      where: 'Prisma AIRS risk score',
      why: [score != null ? `Risk score ${Number(score).toFixed(1)} / 100` : null, asr != null ? `ASR ${fmtPct(asr)}` : null].filter(Boolean).join(' · ') || 'Report ready',
      icon: level === 'low' ? ShieldCheck : ShieldAlert,
    }
  }
  const msg = job.extra_info?.error_message
  return {
    tone: t.warn, title: statusMeta(st).label, where: st === 'ABORTED' ? 'stopped before the end' : 'the campaign did not finish',
    why: st === 'ABORTED' ? `${fmtNum(job.completed)} of ${fmtNum(job.total)} attacks ran` : (msg ? String(msg).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 90) : 'No report'),
    icon: AlertTriangle,
  }
}

function BandVerdict({ t, v, id }) {
  const Icon = v.icon
  return (
    <div className="relative flex-shrink-0 overflow-hidden" style={{ minHeight: 100, background: bandBg(v.tone) }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
      <Icon aria-hidden="true" strokeWidth={1.3} style={{ position: 'absolute', right: -24, bottom: -40, width: 150, height: 150, color: '#fff', opacity: 0.15, transform: 'rotate(-10deg)' }} />
      <div className="relative flex items-center gap-3 px-4 py-4">
        <motion.span key={`${id}-${v.title}`} className="grid place-items-center rounded-2xl flex-shrink-0"
                     initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                     style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
          <Icon size={21} className={v.spin ? 'animate-spin' : v.pulse ? 'animate-pulse' : ''} style={{ color: '#fff' }} aria-hidden="true" />
        </motion.span>
        <div className="min-w-0">
          <div className="truncate" style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Verdict · {v.where}</div>
          <div style={{ fontFamily: FONT.display, fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.1, marginTop: 3 }}>{v.title}</div>
          <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 2 }}>{v.why}</div>
        </div>
      </div>
    </div>
  )
}

function CtaCard({ t, href, onClick, icon: Icon, title, sub, wash }) {
  const [hot, setHot] = useState(false)
  const tone = t.live
  const Tag = href ? 'a' : 'button'
  return (
    <Tag {...(href ? { href, target: '_blank', rel: 'noreferrer' } : { type: 'button', onClick })}
         onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
         className={`w-full flex items-center gap-3 rounded-2xl text-left mt-2 ${focusCls}`}
         style={{
           padding: '10px 10px 10px 11px', background: wash ? ctaWash(t, tone, hot) : t.panel,
           border: `1px solid ${hot ? `${tone}88` : wash ? `${tone}55` : `${tone}40`}`,
           boxShadow: hot ? `0 10px 24px ${tone}2e` : `0 6px 16px ${tone}17`, transition: 'border-color 160ms ease, box-shadow 200ms ease',
         }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: bandBg(tone), boxShadow: `0 5px 12px ${tone}55` }}>
        <Icon size={16} style={{ color: '#fff' }} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{title}</span>
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1 }}>{sub}</span>
      </span>
      <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
            style={{ width: 28, height: 28, color: hot ? '#fff' : tone, background: hot ? shade(tone) : wash ? t.panel : `${tone}14`, transition: 'background 140ms ease, color 140ms ease' }}>
        <ArrowUpRight size={14} />
      </span>
    </Tag>
  )
}

// ─── sections ────────────────────────────────────────────────────────────────

function TargetRow({ t, job }) {
  const meta = targetMeta(job.target_type ?? job.target?.target_type)
  const Icon = meta.icon
  const tg = job.target ?? {}
  return (
    <div className="flex items-start gap-3 px-4 py-3" style={{ borderTop: `1px solid ${t.hairline}` }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: `${t.live}14`, color: t.live }}>
        <Icon size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate" title={tg.name} style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{tg.name ?? job.name}</div>
        <div style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>
          {[meta.label, pretty(tg.connection_type), tg.api_endpoint_type ? `${pretty(tg.api_endpoint_type)} endpoint` : null, JOB_TYPE[job.job_type]?.label].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
  )
}

function Numeral({ t, value, label, tone }) {
  return (
    <div>
      <div style={{ fontFamily: FONT.display, fontSize: 24, fontWeight: 700, color: tone ?? t.ink, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 3 }}>{label}</div>
    </div>
  )
}

function MiniBar({ t, value, tone }) {
  return (
    <div className="rounded-full overflow-hidden" style={{ height: 5, background: t.railBed }}>
      <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, value)}%` }} transition={{ duration: 0.6 }} style={{ background: tone }} />
    </div>
  )
}

function WeakRow({ t, s, onOpen }) {
  const [hot, setHot] = useState(false)
  const m = catMeta(s.category)
  const tone = s.successful ? t.block : t.pass
  return (
    <button type="button" onClick={() => onOpen(s)} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className={`w-full text-left rounded-xl ${focusCls}`} style={{ padding: '7px 8px', background: hot ? t.sunken : 'transparent', transition: 'background 140ms ease' }}
            title={`${s.description ?? s.display_name} — open its attacks`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, background: m.hue }} aria-hidden="true" />
        <span className="flex-1 min-w-0 truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{s.display_name}</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.isLight ? shade(tone, 0.25) : tone, fontWeight: 600 }}>{fmtPct(s.asr)}</span>
        <ArrowUpRight size={12} style={{ color: hot ? t.ink : t.inkFaint }} aria-hidden="true" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1"><MiniBar t={t} value={s.asr} tone={tone} /></div>
        <span style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim }}>{fmtNum(s.successful)} of {fmtNum(s.total)} · {m.label}</span>
      </div>
    </button>
  )
}

function RuntimeRow({ t, policy, onOpen }) {
  const [hot, setHot] = useState(false)
  const tone = t.pass
  return (
    <div className="px-4 py-3" style={{ borderTop: `1px solid ${t.hairline}` }}>
      <button type="button" onClick={onOpen} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
              className={`w-full flex items-start gap-3 rounded-2xl text-left ${focusCls}`}
              style={{ padding: '10px 10px 10px 11px', background: t.panel, border: `1px solid ${hot ? `${tone}77` : `${tone}40`}`, boxShadow: hot ? `0 10px 22px ${tone}24` : 'none', transition: 'border-color 160ms ease, box-shadow 200ms ease' }}>
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 34, height: 34, background: bandBg(tone), boxShadow: `0 5px 12px ${tone}45` }}>
          <ShieldCheck size={16} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>From red team to runtime</span>
          <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>
            AIRS recommends a runtime profile of {policy.length} polic{policy.length === 1 ? 'y' : 'ies'} from these findings:{' '}
            {policy.slice(0, 3).map((p) => p.display_name).join(', ')}{policy.length > 3 ? '…' : ''}
          </span>
        </span>
        <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
              style={{ width: 26, height: 26, marginTop: 4, color: hot ? '#fff' : tone, background: hot ? shade(tone) : `${tone}14` }}>
          <ArrowUpRight size={13} />
        </span>
      </button>
    </div>
  )
}

// ─── the pane ────────────────────────────────────────────────────────────────

export function CampaignEvidence({ t, tone, s, onOpenReport }) {
  const job = s.job
  const tel = useCampaignTelemetry(job?.uuid ?? null, job?.status)
  if (!s.campaignId) return <CampaignEvidenceEmpty t={t} tone={tone} />

  const report = tel.data?.report ?? null
  const v = campaignVerdict(t, job, report)
  const dynamic = job?.job_type === 'DYNAMIC'
  const totals = attemptTotals(report, job)
  const sev = severityRows(report)
  const weak = subcategoryResults(report).slice(0, 5)
  const policy = tel.data?.policy ?? []
  const errs = tel.data?.errors
  const scm = scmCampaignUrl(job)
  const line = summaryLine(report?.report_summary)
  const note = !job ? null
    : job.status === 'COMPLETED' ? (line ?? 'The campaign finished — the full report is one click away.')
    : TERMINAL.has(job.status) ? (job.status === 'ABORTED' ? 'Aborted before the end — the attacks that ran are in the feed.' : 'The campaign failed before it could produce a report.')
    : 'Running in Prisma AIRS. The verdict and report appear here when it completes; the feed fills in meanwhile.'

  return (
    <EvidenceLook.Provider value="band">
      <div className="h-full flex flex-col overflow-hidden" style={glass(t, { radius: 22 })}>
        <BandVerdict t={t} v={v} id={s.campaignId} />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 pt-3 pb-3">
            {note && <p style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.5, color: t.inkDim }}>{note}</p>}
            {/* A verdict built on a few replies is still a verdict — but say so. Measured: an agent
                campaign reported "low risk" with 95% of its attempts ending in a target error. */}
            {job?.status === 'COMPLETED' && job.runtime_metrics?.error_percentage >= 50 && (
              <p className="mt-2 rounded-xl px-3 py-2" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.ink, background: `${t.warn}14`, border: `1px solid ${t.warn}40` }}>
                <span style={{ fontWeight: 700 }}>Read with care: </span>
                {fmtPct(job.runtime_metrics.error_percentage)} of attempts ended in a target error, so this verdict rests on the {fmtPct(100 - job.runtime_metrics.error_percentage)} that got a reply.
              </p>
            )}
            {scm && <CtaCard t={t} href={scm} icon={ExternalLink} title="Open in Strata Cloud Manager" sub="The campaign · attacks · report" />}
            {job && <CtaCard t={t} wash onClick={() => onOpenReport({ tab: 'overview' })} icon={FileBarChart} title="Open full campaign report"
                             sub={dynamic ? 'Summary · goals · runtime profile · raw' : 'Summary · categories · OWASP · every attack · fixes'} />}
          </div>

          {job && <TargetRow t={t} job={job} />}

          {tel.loading && job?.status === 'COMPLETED' && !report && (
            <div className="flex items-center gap-2 px-4 py-3" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, borderTop: `1px solid ${t.hairline}` }}>
              <Loader2 size={13} className="animate-spin" /> Loading the report…
            </div>
          )}
          {tel.error && (
            <p className="mx-4 my-3 rounded-xl px-3 py-2" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.ink, background: `${t.warn}14` }}>The report did not load: {tel.error}</p>
          )}

          {totals?.total != null && totals.successful != null && (
            <Block t={t} title="Attack attempts" icon={Crosshair} accent={totals.successful ? t.block : t.pass}
                   sub={`${fmtPct(report?.asr ?? job?.asr)} landed · each prompt tried several times`} count={fmtNum(totals.total)}>
              <div className="flex items-end gap-5 mb-2">
                <Numeral t={t} value={fmtNum(totals.successful)} label="landed" tone={totals.successful ? t.block : t.inkFaint} />
                <Numeral t={t} value={fmtNum(totals.failed)} label="resisted" tone={t.pass} />
                <Numeral t={t} value={fmtNum(totals.total)} label="attempts" />
              </div>
              <div className="flex rounded-full overflow-hidden" style={{ height: 8, background: t.railBed }}>
                <motion.span initial={{ width: 0 }} animate={{ width: `${pct(totals.successful, totals.total)}%` }} transition={{ duration: 0.6 }} style={{ background: t.block, minWidth: totals.successful ? 3 : 0 }} />
                <motion.span initial={{ width: 0 }} animate={{ width: `${pct(totals.failed, totals.total)}%` }} transition={{ duration: 0.6, delay: 0.1 }} style={{ background: t.pass, opacity: 0.75 }} />
              </div>
            </Block>
          )}

          {dynamic && report && (
            <Block t={t} title="Agent goals" icon={Goal} accent={report.goals_achieved ? t.block : t.pass}
                   sub={`${report.goals_achieved} of ${report.total_goals} reached · ${fmtNum(report.total_streams)} conversations`} count={`${report.goals_achieved} of ${report.total_goals}`}>
              <div className="flex items-end gap-5">
                <Numeral t={t} value={report.goals_achieved} label="goals reached" tone={report.goals_achieved ? t.block : t.inkFaint} />
                <Numeral t={t} value={fmtNum(report.total_streams)} label="conversations" />
                <Numeral t={t} value={fmtNum(report.total_threats)} label="threats" tone={report.total_threats ? t.block : undefined} />
              </div>
            </Block>
          )}

          {sev.length > 0 && (
            <Block t={t} title="By severity" icon={BarChart3} accent={t.block} sub="attempts that landed, per severity" defaultOpen={false}
                   count={`${fmtNum(sev.reduce((a, x) => a + (x.successful ?? 0), 0))} landed`}>
              <div className="space-y-2.5">
                {sev.map((x) => {
                  const c = SEVERITY[String(x.severity).toLowerCase()] ?? t.idle
                  return (
                    <div key={x.severity}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="rounded-full" style={{ width: 7, height: 7, background: c }} aria-hidden="true" />
                        <span style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink }}>{pretty(x.severity)}</span>
                        <span className="ml-auto" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{fmtNum(x.successful)} of {fmtNum(x.total)} · {fmtPct(pct(x.successful, x.total))}</span>
                      </div>
                      <MiniBar t={t} value={pct(x.successful, x.total)} tone={c} />
                    </div>
                  )
                })}
              </div>
            </Block>
          )}

          {weak.length > 0 && (
            <Block t={t} title="Weakest categories" icon={Flame} accent={weak[0].successful ? t.block : t.pass}
                   sub={`${weak[0].display_name} gave in most · ${fmtPct(weak[0].asr)}`} count={`top ${weak.length}`}>
              <div className="-mx-1 space-y-0.5">
                {weak.map((x) => <WeakRow key={`${x.category}-${x.id}`} t={t} s={x} onOpen={(sub) => onOpenReport({ tab: 'attacks', sub: sub.id, subLabel: sub.display_name })} />)}
              </div>
            </Block>
          )}

          {policy.length > 0 && <RuntimeRow t={t} policy={policy} onOpen={() => onOpenReport({ tab: 'remediation' })} />}

          {errs?.total > 0 && (
            <div className="flex items-start gap-3 px-4 py-3" style={{ borderTop: `1px solid ${t.hairline}` }}>
              <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: `${t.warn}17`, color: t.isLight ? shade(t.warn, 0.38) : t.warn }}>
                <ServerCrash size={15} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{fmtNum(errs.total)} target errors</div>
                <div style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>
                  Attempts where the target itself returned an error — a timeout or a 5xx. The messages are in the report.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </EvidenceLook.Provider>
  )
}
