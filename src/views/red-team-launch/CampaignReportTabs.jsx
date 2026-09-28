import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldX, ShieldCheck, ChevronDown, Loader2, ExternalLink, ScrollText, Settings2, ServerCrash, Crosshair, Gauge,
  ListChecks, Goal, MessagesSquare, Scale, Wrench, X, ArrowUpRight, BookOpen, Flag, Link2,
} from 'lucide-react'
import { FONT, label as LBL, SEVERITY } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { Card, KV, Stat, IconSquare, IdValue, Note, Empty } from '../../components/api-intercept/telemetry/primitives'
import { Markdown } from '../api-intercept-2027/Markdown'
import { CodeBlock } from '../supply-chain-launch/ScanTelemetryTabs'
import { stamp, relative } from '../supply-chain-launch/scanTelemetry'
import {
  TERMINAL, catMeta, targetMeta, JOB_TYPE, riskLevel, riskTone, fmtPct, fmtNum, pct, pretty,
  subcategoryResults, severityRows, attemptTotals, useAttackDetail, apiMessage,
} from './redTeamModel'

/**
 * CampaignReportTabs — the body of the campaign report drawer, built on the
 * runtime drawer's primitives in their launch look.
 *
 *   Overview     the numbers, PA's executive summary, how the campaign was set
 *                up, and the target's own errors
 *   Categories   every sub-category tested, ranked by how often it landed
 *   Compliance   the same results mapped to OWASP (and any other framework)
 *   Attacks      every attack prompt, filterable; each opens onto its replies —
 *                every attempt the target answered, with its own verdict
 *   Goals        (agent campaigns) the goals the agent pursued
 *   Remediation  the runtime profile AIRS recommends from the findings, and
 *                the remediations
 *   Raw          every payload the drawer is built from
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
const inkOf = (t, tone, k = 0.28) => (t.isLight ? shade(tone, k) : tone)
const stripHtml = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

function Pill({ t, tone, children, mono, title }) {
  return (
    <span title={title} className="inline-flex items-center gap-1 rounded-full px-2 whitespace-nowrap"
          style={{ fontFamily: mono ? FONT.mono : FONT.prose, fontSize: mono ? 10.5 : 11, fontWeight: 600, lineHeight: '19px', color: tone ? inkOf(t, tone) : t.inkDim, background: tone ? `${tone}17` : t.sunken }}>
      {children}
    </span>
  )
}

function Bar({ t, value, tone, height = 6 }) {
  return (
    <div className="rounded-full overflow-hidden" style={{ height, background: t.railBed }}>
      <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, value))}%` }} transition={{ duration: 0.6 }}
                  style={{ background: tone, minWidth: value > 0 ? 3 : 0 }} />
    </div>
  )
}

function When({ t, iso, now }) {
  const s = stamp(iso)
  if (!s) return <span style={{ color: t.inkFaint }}>—</span>
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span style={{ fontWeight: 600 }}>{s.date}</span>
      <span style={{ fontFamily: FONT.mono, fontSize: 11 }}>{s.time}</span>
      <span style={{ color: t.inkDim, fontSize: 11.5 }}>{relative(now - s.ms)}</span>
    </span>
  )
}

const fmtDur = (ms) => {
  if (ms == null || ms < 0) return null
  const m = Math.round(ms / 60000)
  if (m < 90) return `${m} min`
  return `${(m / 60).toFixed(1)} h`
}

// ─── Overview ────────────────────────────────────────────────────────────────

export function OverviewTab({ t, job, tel, now }) {
  const report = tel?.report
  const dynamic = job.job_type === 'DYNAMIC'
  const level = riskLevel(report?.report_summary ?? job.report_stats?.report_summary)
  const rTone = riskTone(t, level)
  const totals = attemptTotals(report, job)
  const errs = tel?.errors
  const rm = job.runtime_metrics ?? {}
  const meta = job.job_metadata ?? {}
  const tg = job.target ?? {}
  const done = TERMINAL.has(job.status)
  const cats = meta.categories ? Object.entries(meta.categories) : []

  return (
    <div className="space-y-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Stat t={t} label="Risk score" icon={Gauge} value={report?.score != null ? Number(report.score).toFixed(1) : job.score != null ? Number(job.score).toFixed(1) : '—'}
              sub={level ? `${level} risk · out of 100` : 'out of 100 · lower is better'} tone={report || job.score != null ? rTone : undefined} />
        <Stat t={t} label="Attack success" icon={Crosshair} value={fmtPct(report?.asr ?? job.asr)} sub="of attempts landed"
              tone={(report?.asr ?? job.asr) ? t.block : (report?.asr ?? job.asr) === 0 ? t.pass : undefined} />
        {dynamic && report ? (
          <>
            <Stat t={t} label="Goals reached" icon={Goal} value={`${report.goals_achieved} of ${report.total_goals}`} sub={`${fmtNum(report.total_threats)} threats`} tone={report.goals_achieved ? t.block : t.pass} />
            <Stat t={t} label="Conversations" icon={MessagesSquare} value={fmtNum(report.total_streams)} sub="multi-turn streams" />
          </>
        ) : (
          <>
            <Stat t={t} label="Attempts" icon={ListChecks} value={fmtNum(totals?.total ?? rm.attempts_total)}
                  sub={totals?.successful != null ? `${fmtNum(totals.successful)} landed` : `${fmtNum(rm.attempts_completed)} completed`} />
            <Stat t={t} label="Target errors" icon={ServerCrash} value={fmtNum(errs?.total ?? rm.error_count ?? 0)}
                  sub={rm.error_percentage != null ? `${fmtPct(rm.error_percentage)} of attempts` : 'timeouts, 5xx'} tone={(errs?.total ?? rm.error_count) ? t.warn : undefined} />
          </>
        )}
      </div>

      {report?.report_summary ? (
        <Card t={t} title="Executive summary" icon={ScrollText} tone={rTone}
              right={<span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>written by Prisma AIRS</span>}>
          <div style={{ fontFamily: FONT.prose, fontSize: 13, lineHeight: 1.6, color: t.ink }}>
            <Markdown text={report.report_summary} t={t} />
          </div>
        </Card>
      ) : (
        <Note t={t}>{done ? 'No report was generated for this campaign — only a completed campaign has one.' : 'The report is written when the campaign completes.'}</Note>
      )}

      <Card t={t} title="How the campaign was set up" icon={Settings2}>
        <KV t={t} k="Campaign">{job.name}</KV>
        <KV t={t} k="Type">{JOB_TYPE[job.job_type]?.label ?? pretty(job.job_type)}{JOB_TYPE[job.job_type] ? ` — ${JOB_TYPE[job.job_type].sub.toLowerCase()}` : ''}</KV>
        <KV t={t} k="Target">
          <span>{tg.name ?? '—'}</span>
          <span style={{ color: t.inkDim }}> · {[targetMeta(job.target_type ?? tg.target_type).label, pretty(tg.connection_type), tg.response_mode ? pretty(tg.response_mode) : null].filter(Boolean).join(' · ')}</span>
        </KV>
        {cats.length > 0 && (
          <KV t={t} k="Categories" top>
            <span className="flex flex-wrap gap-1">
              {cats.map(([c, subs]) => {
                const m = catMeta(c)
                return <span key={c} className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, lineHeight: '19px', color: inkOf(t, m.hue, 0.1), background: `${m.hue}17` }}>{m.label} · {subs.length}</span>
              })}
            </span>
          </KV>
        )}
        {meta.language?.name && <KV t={t} k="Language">{meta.language.name}</KV>}
        <KV t={t} k="Rate limit">{meta.rate_limit_enabled ? `${meta.rate_limit} requests` : 'off'}</KV>
        <KV t={t} k="Content filter">{meta.content_filter_enabled ? 'on' : 'off'}</KV>
        <KV t={t} k="Started"><When t={t} iso={job.created_at} now={now} /></KV>
        {done && <KV t={t} k="Last update" hint="updated_at on the campaign record"><When t={t} iso={job.updated_at} now={now} /></KV>}
        {done && fmtDur(Date.parse(job.updated_at) - Date.parse(job.created_at)) && (
          <KV t={t} k="Ran for" hint="created_at → updated_at">{fmtDur(Date.parse(job.updated_at) - Date.parse(job.created_at))}</KV>
        )}
        {job.counted_towards_quota != null && <KV t={t} k="Quota">{job.counted_towards_quota ? 'counted toward the tenant’s quota' : 'not counted'}</KV>}
        <KV t={t} k="Campaign id"><IdValue t={t} value={job.uuid} /></KV>
        <KV t={t} k="Target id"><IdValue t={t} value={job.target_id ?? tg.uuid} /></KV>
      </Card>

      {errs?.items?.length > 0 && (
        <Card t={t} title={`Target errors · ${fmtNum(errs.total)}`} icon={ServerCrash} tone={t.warn}>
          <p style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.inkDim, marginBottom: 8 }}>
            Attempts where the target itself answered with an error. Showing the first {errs.items.length}.
          </p>
          <div className="space-y-2">
            {errs.items.slice(0, 8).map((e, i) => (
              <div key={e.attack_id ?? i} className="rounded-xl px-3 py-2" style={{ background: t.sunken }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Pill t={t} tone={t.warn}>{pretty(e.error_type)}</Pill>
                  <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>from {pretty(e.error_source)}</span>
                </div>
                <p className="break-words" style={{ fontFamily: FONT.mono, fontSize: 10.5, lineHeight: 1.5, color: t.ink, marginTop: 4 }}>{stripHtml(e.error_message).slice(0, 280)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Categories ──────────────────────────────────────────────────────────────

function SubRow({ t, s, onOpen }) {
  const [hot, setHot] = useState(false)
  const tone = s.successful ? t.block : t.pass
  return (
    <button type="button" onClick={() => onOpen(s)} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className={`w-full text-left rounded-xl ${focusCls}`} style={{ padding: '8px 10px', background: hot ? t.sunken : 'transparent', transition: 'background 140ms ease' }}>
      <div className="flex items-baseline gap-2">
        <span style={{ fontFamily: FONT.prose, fontSize: 13, fontWeight: 600, color: t.ink }}>{s.display_name}</span>
        {s.description && <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>{s.description}</span>}
        <span className="ml-auto flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, color: inkOf(t, tone, 0.25) }}>{fmtPct(s.asr)}</span>
        <ArrowUpRight size={12} style={{ color: hot ? t.ink : t.inkFaint, flexShrink: 0 }} aria-hidden="true" />
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex-1"><Bar t={t} value={s.asr} tone={tone} /></div>
        <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, minWidth: 104, textAlign: 'right' }}>{fmtNum(s.successful)} of {fmtNum(s.total)} landed</span>
      </div>
    </button>
  )
}

export function CategoriesTab({ t, tel, onSub }) {
  const report = tel?.report
  const groups = ['security_report', 'safety_report', 'brand_report'].map((k) => report?.[k]).filter((r) => r?.sub_categories?.some((s) => s.total))
  if (!groups.length) return <Empty t={t}>No category results — only a completed attack-library campaign has them.</Empty>
  const ranked = subcategoryResults(report)
  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const m = catMeta(g.id)
        const subs = ranked.filter((s) => s.category === g.id)
        const succ = subs.reduce((a, s) => a + s.successful, 0)
        const tot = subs.reduce((a, s) => a + s.total, 0)
        return (
          <Card key={g.id} t={t} title={g.display_name ?? m.label} icon={m.icon} tone={m.hue}
                right={<span style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim }}>{fmtNum(succ)} of {fmtNum(tot)} · {fmtPct(pct(succ, tot))}</span>}>
            {g.description && <p style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginBottom: 6 }}>{g.description}</p>}
            <div className="-mx-2.5">{subs.map((s) => <SubRow key={s.id} t={t} s={s} onOpen={onSub} />)}</div>
          </Card>
        )
      })}
      <Note t={t}>Counts are attack attempts. Click a sub-category for its attack prompts and the target’s replies.</Note>
    </div>
  )
}

// ─── Compliance ──────────────────────────────────────────────────────────────

export function ComplianceTab({ t, tel }) {
  const frameworks = (tel?.report?.compliance_report ?? []).filter((f) => f.techniques?.some((x) => x.total))
  if (!frameworks.length) return <Empty t={t}>No compliance mapping — add a framework under Compliance when you build the campaign.</Empty>
  return (
    <div className="space-y-3">
      {frameworks.map((f) => {
        const tech = [...f.techniques].filter((x) => x.total).sort((a, b) => pct(b.successful, b.total) - pct(a.successful, a.total))
        return (
          <Card key={f.id} t={t} title={f.display_name ?? f.id} icon={Scale} tone={catMeta('COMPLIANCE').hue}
                right={f.link ? <a href={f.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.live }}>framework <ExternalLink size={11} /></a> : null}>
            {f.description && <p style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginBottom: 6 }}>{f.description}</p>}
            <div className="space-y-2.5">
              {tech.map((x) => {
                const v = pct(x.successful, x.total)
                const tone = x.successful ? t.block : t.pass
                return (
                  <div key={x.id}>
                    <div className="flex items-center gap-2 mb-1">
                      <Pill t={t} mono>{x.display_name ?? x.id}</Pill>
                      <span className="flex-1 min-w-0 truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{x.description}</span>
                      <span style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, color: inkOf(t, tone, 0.25) }}>{fmtPct(v)}</span>
                      {x.link && <a href={x.link} target="_blank" rel="noreferrer" aria-label={`${x.id} reference`} style={{ color: t.inkDim }}><ExternalLink size={12} /></a>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><Bar t={t} value={v} tone={tone} /></div>
                      <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, minWidth: 110, textAlign: 'right' }}>{fmtNum(x.successful)} of {fmtNum(x.total)} landed</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Attacks ─────────────────────────────────────────────────────────────────

function useAttackList(jobId, { threat, sub }) {
  const [state, setState] = useState({ items: [], total: null, loading: false, error: null })
  const key = `${jobId}|${threat}|${sub}`
  const cur = useRef(key)
  const load = useCallback((skip) => {
    const params = new URLSearchParams({ limit: '50', skip: String(skip) })
    if (threat != null) params.set('threat', String(threat))
    if (sub) params.set('sub_category', sub)
    setState((s) => ({ ...s, loading: true, error: null }))
    fetch(`/api/redteam/scan/${jobId}/attacks?${params}`)
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(apiMessage(d) || `HTTP ${r.status}`); return d })
      .then((d) => { if (cur.current !== key) return; setState((s) => ({ items: skip ? [...s.items, ...(d.data ?? [])] : d.data ?? [], total: d.pagination?.total_items ?? null, loading: false, error: null })) })
      .catch((e) => { if (cur.current === key) setState((s) => ({ ...s, loading: false, error: e.message })) })
  }, [jobId, threat, sub, key])
  useEffect(() => { cur.current = key; setState({ items: [], total: null, loading: true, error: null }); load(0) }, [key, load])
  return { ...state, more: state.total != null && state.items.length < state.total ? () => load(state.items.length) : null }
}

function Frameworks({ t, list }) {
  if (!list?.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.inkDim, marginRight: 2 }}>Maps to</span>
      {list.flatMap((f) => (f.techniques?.length ? f.techniques : [f])).slice(0, 10).map((x, i) => (
        <span key={`${x.id}-${i}`} title={x.description ?? undefined} className="rounded-full px-2"
              style={{ fontFamily: FONT.mono, fontSize: 10.5, lineHeight: '19px', color: t.ink, background: t.sunken }}>{x.display_name ?? x.id}</span>
      ))}
    </div>
  )
}

function Reply({ t, o, i }) {
  const [all, setAll] = useState(false)
  const landed = o.threat === true
  const tone = landed ? t.block : o.error ? t.warn : t.pass
  const text = o.output ?? ''
  const long = text.length > 520
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: t.panel, border: `1px solid ${landed ? `${tone}40` : t.hairline}` }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 700, color: t.ink }}>Reply {i + 1}</span>
        <Pill t={t} tone={tone}>{o.error ? 'target error' : landed ? 'landed' : 'resisted'}</Pill>
        {o.threat_details?.threat_override != null && <Pill t={t} title={`overridden by ${o.threat_details.overridden_by ?? 'a reviewer'}`}>verdict overridden</Pill>}
      </div>
      {o.error ? (
        <p className="break-words" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>{stripHtml(o.error_message).slice(0, 300)}</p>
      ) : (
        <p dir="auto" className="whitespace-pre-wrap break-words" style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.ink, maxHeight: all ? 'none' : 150, overflow: 'hidden' }}>{text || '—'}</p>
      )}
      {long && !o.error && (
        <button type="button" onClick={() => setAll((a) => !a)} style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.live, marginTop: 4 }}>
          {all ? 'Show less' : `Show all ${fmtNum(text.length)} characters`}
        </button>
      )}
      {o.judge_reasoning && (
        <p style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.5, color: t.inkDim, marginTop: 6 }}><span style={{ fontWeight: 600 }}>Judge: </span>{o.judge_reasoning}</p>
      )}
    </div>
  )
}

function AttackDetail({ t, jobId, a }) {
  const d = useAttackDetail(jobId, a.uuid, true)
  const outs = d.data?.outputs ?? []
  const landed = outs.filter((o) => o.threat === true).length
  return (
    <div className="px-3 pb-3 pt-2.5 space-y-3" style={{ borderTop: `1px solid ${t.hairline}` }}>
      <div>
        <div style={{ fontFamily: FONT.display, fontSize: 12, fontWeight: 700, color: t.ink, marginBottom: 5 }}>Attack prompt</div>
        <pre dir="auto" className="whitespace-pre-wrap break-words rounded-xl px-3 py-2.5" style={{ background: t.codeBg, fontFamily: FONT.mono, fontSize: 11, lineHeight: 1.55, color: t.ink, maxHeight: 220, overflow: 'auto' }}>{a.prompt}</pre>
      </div>
      {d.loading && <div className="flex items-center gap-2" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}><Loader2 size={13} className="animate-spin" /> Loading the target’s replies…</div>}
      {d.error && <p className="rounded-xl px-3 py-2" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.ink, background: `${t.warn}14` }}>The replies did not load: {d.error}</p>}
      {outs.length > 0 && (
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span style={{ fontFamily: FONT.display, fontSize: 12, fontWeight: 700, color: t.ink }}>The target’s replies · {outs.length}</span>
            <span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>{landed} landed — one per attempt with this prompt</span>
          </div>
          <div className="space-y-2">{outs.map((o, i) => <Reply key={o.uuid ?? i} t={t} o={o} i={i} />)}</div>
        </div>
      )}
      <Frameworks t={t} list={d.data?.compliance_frameworks} />
      <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
        <span className="inline-flex items-center gap-1">attack <IdValue t={t} value={a.uuid} truncate={13} /></span>
        {a.prompt_id && <span className="inline-flex items-center gap-1">prompt <IdValue t={t} value={a.prompt_id} truncate={13} /></span>}
        {a.attack_modality && <span>{pretty(a.attack_modality)} · {pretty(a.attack_type)}</span>}
      </div>
    </div>
  )
}

function AttackItem({ t, jobId, a, open, onToggle, pinned }) {
  const landed = a.threat === true
  const tone = landed ? t.block : t.pass
  const sev = SEVERITY[String(a.severity ?? '').toLowerCase()] ?? t.idle
  const Icon = landed ? ShieldX : ShieldCheck
  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: t.panel, border: `1px solid ${open || pinned ? `${tone}66` : landed ? `${tone}30` : t.hairline}`, boxShadow: open ? `0 10px 24px ${tone}1a` : 'none' }}>
      <button type="button" onClick={onToggle} aria-expanded={open} className={`w-full flex items-start gap-3 text-left ${focusCls}`} style={{ padding: '10px 12px' }}>
        <IconSquare t={t} icon={Icon} tone={tone} size={30} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: FONT.prose, fontSize: 13, fontWeight: 600, color: t.ink }}>{a.sub_category_display_name ?? pretty(a.sub_category)}</span>
            <span className="inline-flex items-center gap-1" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }}>
              <span className="rounded-full" style={{ width: 6, height: 6, background: sev }} aria-hidden="true" />
              {String(a.severity ?? '').toUpperCase()} · {a.category_display_name ?? pretty(a.category)}{a.multi_turn ? ' · multi-turn' : ''}
            </span>
            {pinned && <Pill t={t} tone={t.live}>from the feed</Pill>}
          </span>
          {!open && <span className="block truncate" dir="auto" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim, marginTop: 3 }}>{a.prompt}</span>}
        </span>
        <Pill t={t} tone={tone}>{landed ? `landed · ${fmtPct(a.asr)}` : 'resisted'}</Pill>
        <ChevronDown size={14} className="flex-shrink-0" style={{ color: t.inkDim, marginTop: 4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <AttackDetail t={t} jobId={jobId} a={a} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export function AttacksTab({ t, job, focus, onClearSub }) {
  const [outcome, setOutcome] = useState(focus?.attack ? 'all' : focus?.sub ? 'landed' : 'all')
  const [openIds, setOpenIds] = useState(() => new Set(focus?.attack ? [focus.attack.uuid] : []))
  const threat = outcome === 'landed' ? true : outcome === 'resisted' ? false : null
  const list = useAttackList(job.uuid, { threat, sub: focus?.sub ?? null })
  const toggle = (id) => setOpenIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const pinned = focus?.attack
  const items = pinned ? list.items.filter((a) => a.uuid !== pinned.uuid) : list.items

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {[['all', 'All'], ['landed', 'Landed'], ['resisted', 'Resisted']].map(([id, label]) => {
          const on = outcome === id
          const c = id === 'landed' ? t.block : id === 'resisted' ? t.pass : t.ink
          return (
            <button key={id} type="button" onClick={() => setOutcome(id)} aria-pressed={on} className={`rounded-full px-3 ${focusCls}`}
                    style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? '#fff' : t.inkDim, background: on ? (id === 'all' ? t.ink : bandBg(c)) : t.sunken, border: `1px solid ${on ? 'transparent' : t.hairline}` }}>
              {label}
            </button>
          )
        })}
        {focus?.sub && (
          <span className="inline-flex items-center gap-1 rounded-full pl-2.5 pr-1" style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink, background: `${t.live}17`, border: `1px solid ${t.live}40` }}>
            {focus.subLabel ?? pretty(focus.sub)}
            <button type="button" onClick={onClearSub} aria-label="Show every sub-category" className="grid place-items-center rounded-full" style={{ width: 20, height: 20, color: t.inkDim }}><X size={12} /></button>
          </span>
        )}
        <span className="ml-auto" style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim }}>{list.total != null ? `${fmtNum(list.total)} prompts` : ''}</span>
      </div>

      {pinned && <AttackItem t={t} jobId={job.uuid} a={pinned} pinned open={openIds.has(pinned.uuid)} onToggle={() => toggle(pinned.uuid)} />}
      {list.error && <p className="rounded-xl px-3 py-2" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.ink, background: `${t.warn}14` }}>The attacks did not load: {list.error}</p>}
      {items.map((a) => <AttackItem key={a.uuid} t={t} jobId={job.uuid} a={a} open={openIds.has(a.uuid)} onToggle={() => toggle(a.uuid)} />)}
      {list.loading && <div className="flex items-center gap-2 px-2 py-2" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}><Loader2 size={13} className="animate-spin" /> Loading attacks…</div>}
      {!list.loading && !list.error && !list.items.length && !pinned && <Empty t={t}>No attacks match.</Empty>}
      {list.more && !list.loading && (
        <button type="button" onClick={list.more} className="w-full rounded-full" style={{ height: 34, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, background: t.sunken, border: `1px solid ${t.hairline}` }}>
          Load {Math.min(50, list.total - list.items.length)} more of {fmtNum(list.total - list.items.length)}
        </button>
      )}
    </div>
  )
}

// ─── Goals (agent campaigns) ─────────────────────────────────────────────────

function Reference({ t, title, text }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <div className="rounded-xl" style={{ background: t.sunken }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-2 px-3 py-2 text-left">
        <span className="flex-1" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink }}>{title}</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>{fmtNum(text.length)} chars</span>
        <ChevronDown size={13} style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none' }} aria-hidden="true" />
      </button>
      {open && <p dir="auto" className="whitespace-pre-wrap break-words px-3 pb-3" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.55, color: t.inkDim, maxHeight: 320, overflow: 'auto' }}>{text}</p>}
    </div>
  )
}

export function GoalsTab({ t, tel, focus }) {
  const goals = tel?.goals?.items ?? []
  const [openIds, setOpenIds] = useState(() => new Set(focus?.goal ? [focus.goal.uuid] : []))
  const toggle = (id) => setOpenIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  if (!goals.length) return <Empty t={t}>No goals recorded — goals exist once an agent campaign completes.</Empty>
  const sorted = [...goals].sort((a, b) => Number(!!b.threat) - Number(!!a.threat))
  return (
    <div className="space-y-2.5">
      <Note t={t}>
        Each goal carries two reference answers that Prisma AIRS generated with it — what a jailbroken and a safe reply would look like — for the judge to compare against.
        They are not the target’s replies; the target’s conversations are in the campaign in Strata Cloud Manager.
      </Note>
      {sorted.map((g) => {
        const tone = g.threat ? t.block : t.pass
        const open = openIds.has(g.uuid)
        return (
          <section key={g.uuid} className="rounded-2xl overflow-hidden" style={{ background: t.panel, border: `1px solid ${open ? `${tone}66` : g.threat ? `${tone}33` : t.hairline}` }}>
            <button type="button" onClick={() => toggle(g.uuid)} aria-expanded={open} className={`w-full flex items-start gap-3 text-left ${focusCls}`} style={{ padding: '10px 12px' }}>
              <IconSquare t={t} icon={Goal} tone={tone} size={30} />
              <span className="flex-1 min-w-0" style={{ fontFamily: FONT.prose, fontSize: 13, lineHeight: 1.45, color: t.ink }}>{g.goal_to_show || g.goal}</span>
              <Pill t={t} tone={tone}>{g.threat ? 'goal reached' : 'held'}</Pill>
              <ChevronDown size={14} className="flex-shrink-0" style={{ color: t.inkDim, marginTop: 4, transform: open ? 'rotate(180deg)' : 'none' }} aria-hidden="true" />
            </button>
            {open && (
              <div className="px-3 pb-3 pt-2 space-y-2" style={{ borderTop: `1px solid ${t.hairline}` }}>
                <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
                  {g.goal_type && <span>type {pretty(g.goal_type)}</span>}
                  {g.goal_metadata?.source && <span>{pretty(g.goal_metadata.source)}</span>}
                  {g.custom_goal != null && <span>{g.custom_goal ? 'custom goal' : 'generated goal'}</span>}
                </div>
                <Reference t={t} title="Reference: a jailbroken reply" text={g.jailbroken_response} />
                <Reference t={t} title="Reference: a safe reply" text={g.safe_response} />
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

// ─── Remediation ─────────────────────────────────────────────────────────────

function ConfigPills({ t, config }) {
  const pills = []
  for (const [k, v] of Object.entries(config ?? {})) {
    if (Array.isArray(v)) {
      if (v.length) pills.push(<span key={k} className="inline-flex flex-wrap items-center gap-1"><span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>{pretty(k)}:</span>{v.map((x) => <Pill key={x} t={t}>{x}</Pill>)}</span>)
    } else if (typeof v === 'boolean') {
      if (v) pills.push(<Pill key={k} t={t} tone={t.live}>{pretty(k).toLowerCase()}</Pill>)
    } else if (v != null) {
      const act = String(v).toUpperCase()
      const tone = act === 'BLOCK' ? t.block : act === 'ALERT' ? t.warn : undefined
      pills.push(<Pill key={k} t={t} tone={tone}>{k === 'action' ? String(v).toLowerCase() : `${pretty(k).toLowerCase()} · ${String(v).toLowerCase()}`}</Pill>)
    }
  }
  return <span className="flex flex-wrap items-center gap-1.5">{pills}</span>
}

const LEVEL_TONE = (t, v) => (String(v).toLowerCase() === 'high' ? t.pass : String(v).toLowerCase() === 'medium' ? t.warn : undefined)

export function RemediationTab({ t, tel, onLaunchRuntime }) {
  const policy = tel?.policy ?? []
  const rems = tel?.remediations ?? []
  if (!policy.length && !rems.length) return <Empty t={t}>No remediation — it is generated when a campaign completes.</Empty>
  return (
    <div className="space-y-3">
      {policy.length > 0 && (
        <Card t={t} title="Recommended runtime security profile" icon={ShieldCheck} tone={t.pass}
              right={<span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>{policy.length} policies</span>}>
          <p style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.inkDim, marginBottom: 10 }}>
            Built by Prisma AIRS from what landed in this campaign. Create it as an AI security profile and put AIRS Runtime in front of the target — the
            enforcement step 01 of this portal demonstrates.
          </p>
          <div className="space-y-1.5">
            {policy.map((p) => (
              <div key={p.policy_id} className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{ background: t.sunken }}>
                <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 26, height: 26, background: `${t.pass}17`, color: inkOf(t, t.pass, 0.2) }}>
                  <ShieldCheck size={13} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block" style={{ fontFamily: FONT.prose, fontSize: 13, fontWeight: 600, color: t.ink }}>{p.display_name ?? pretty(p.policy_id)}</span>
                  <span className="block mt-1"><ConfigPills t={t} config={p.config} /></span>
                </span>
              </div>
            ))}
          </div>
          {onLaunchRuntime && (
            <button type="button" onClick={onLaunchRuntime} className={`mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-full ${focusCls}`}
                    style={{ height: 38, fontFamily: FONT.prose, fontSize: 13, fontWeight: 700, color: '#fff', background: bandBg(t.pass), boxShadow: `0 6px 16px ${t.pass}40` }}>
              Show it in AIRS Runtime & AI-GW · step 01 <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          )}
        </Card>
      )}
      {rems.length > 0 && (
        <Card t={t} title={`Remediations · ${rems.length}`} icon={Wrench}>
          <div className="space-y-2">
            {rems.map((r, i) => (
              <div key={r.remediation ?? i} className="rounded-xl px-3 py-2.5" style={{ background: t.sunken }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{r.remediation}</span>
                  {r.priority_level && <Pill t={t} tone={String(r.priority_level).toLowerCase() === 'high' ? t.block : undefined}>priority · {String(r.priority_level).toLowerCase()}</Pill>}
                  {r.effectiveness_level && <Pill t={t} tone={LEVEL_TONE(t, r.effectiveness_level)}>effectiveness · {String(r.effectiveness_level).toLowerCase()}</Pill>}
                  {r.ease_of_implementation_level && <Pill t={t}>ease · {String(r.ease_of_implementation_level).toLowerCase()}</Pill>}
                </div>
                {r.description && <p style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.inkDim, marginTop: 4 }}>{r.description}</p>}
                {r.resource_links?.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 mt-1.5">
                    {r.resource_links.map((l) => (
                      <a key={l} href={l} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.live }}>
                        <BookOpen size={11} aria-hidden="true" /> {l.replace(/^https?:\/\/(www\.)?/, '').slice(0, 38)}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Raw ─────────────────────────────────────────────────────────────────────

export function RawTab({ t, job, tel }) {
  return (
    <div className="space-y-2.5">
      <CodeBlock t={t} title="Campaign" sub="GET /v1/scan/{id}" value={tel?.job ?? job} defaultOpen />
      <CodeBlock t={t} title="Report" sub={`GET /v1/report/${tel?.kind ?? 'static'}/{id}/report`} value={tel?.report} />
      <CodeBlock t={t} title="Runtime security profile" sub="…/runtime-policy-config" value={tel?.policy} />
      <CodeBlock t={t} title="Remediations" sub="…/remediation" value={tel?.remediations} />
      <CodeBlock t={t} title="Goals" sub="GET /v1/report/dynamic/{id}/list-goals" value={tel?.goals} />
      <CodeBlock t={t} title="Target errors" sub="GET /v1/error-log/job/{id}" value={tel?.errors} />
      {tel?.endpointErrors && Object.keys(tel.endpointErrors).length > 0 && <CodeBlock t={t} title="Endpoint errors" value={tel.endpointErrors} defaultOpen />}
    </div>
  )
}
