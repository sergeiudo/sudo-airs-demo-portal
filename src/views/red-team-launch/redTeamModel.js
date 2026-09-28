import { useCallback, useEffect, useState } from 'react'
import { Cpu, AppWindow, Bot, Shield, HeartPulse, Megaphone, Scale } from 'lucide-react'
import { SIGNAL } from '../api-intercept-2027/tokens'

/**
 * redTeamModel.js — what the Red Teaming launch console knows about targets,
 * campaigns and reports, kept out of the components.
 *
 * Every field below was read off real responses from this tenant
 * (2026-09-28), not guessed from docs:
 *   • a campaign's `score` is PA's RISK score (0–100, lower is better) — the
 *     report summary says "an overall Risk Score of 7.7/100". The Classic view
 *     showed a "robustness = 100 − ASR" of its own instead.
 *   • the report counts ATTEMPTS (successful 245 of 3,420, ASR 7.16%); the
 *     attack list counts PROMPTS (63 with threat=true, 507 without). Each
 *     prompt is tried several times, and its own `asr` is the share that
 *     landed. The two are labelled differently everywhere.
 *   • `severity_report.stats` is an array of { severity, successful, failed },
 *     and compliance entries carry per-technique counts — not a map and not a
 *     score, which is what the Classic report read.
 */

export const TERMINAL = new Set(['COMPLETED', 'FAILED', 'ABORTED'])

// Category identity hues — deliberately none of the signal colours, which keep
// their meanings (green resisted, vermilion landed, amber fault, blue live).
export const CATEGORY = {
  SECURITY:   { label: 'Security',         hue: '#7C3AED', icon: Shield,     sub: 'Jailbreaks, injection, leaks, code execution' },
  SAFETY:     { label: 'Safety',           hue: '#0E7490', icon: HeartPulse, sub: 'Harmful, toxic and illegal content' },
  BRAND:      { label: 'Brand reputation', hue: '#C026D3', icon: Megaphone,  sub: 'Competitors, off-brand and embarrassing output' },
  COMPLIANCE: { label: 'Compliance',       hue: '#57534E', icon: Scale,      sub: 'Map results to OWASP, MITRE ATLAS, NIST, DASF' },
}
export const catMeta = (id) => CATEGORY[id] ?? { label: pretty(id), hue: '#64748B', icon: Shield, sub: '' }

// The Classic view's taxonomy — the fallback when /v1/categories does not answer.
const FALLBACK_CATEGORIES = {
  SECURITY: ['JAILBREAK', 'PROMPT_INJECTION', 'SYSTEM_PROMPT_LEAK', 'ADVERSARIAL_SUFFIX', 'EVASION', 'MULTI_TURN', 'REMOTE_CODE_EXECUTION', 'TOOL_LEAK', 'MALWARE_GENERATION', 'INDIRECT_PROMPT_INJECTION'],
  SAFETY: ['BIAS', 'CBRN', 'CYBERCRIME', 'DRUGS', 'HATE_TOXIC_ABUSE', 'NON_VIOLENT_CRIMES', 'POLITICAL', 'SELF_HARM', 'SEXUAL', 'VIOLENT_CRIMES_WEAPONS'],
  COMPLIANCE: ['OWASP', 'MITRE_ATLAS', 'NIST', 'DASF_V2'],
}

export const DEFAULT_SELECTION = { SECURITY: ['JAILBREAK', 'PROMPT_INJECTION', 'SYSTEM_PROMPT_LEAK'] }

export const TARGET_TYPE = {
  MODEL:       { label: 'Model',       icon: Cpu },
  APPLICATION: { label: 'Application', icon: AppWindow },
  AGENT:       { label: 'Agent',       icon: Bot },
}
export const targetMeta = (type) => TARGET_TYPE[type] ?? { label: pretty(type) || 'Target', icon: Cpu }

export const JOB_TYPE = {
  STATIC:  { label: 'Attack library', sub: 'Curated prompts across the categories you pick' },
  DYNAMIC: { label: 'Agent',          sub: 'An agent profiles the target and runs multi-turn attacks' },
}

export function pretty(s) {
  if (!s) return ''
  const ACR = { ai: 'AI', llm: 'LLM', owasp: 'OWASP', nist: 'NIST', cbrn: 'CBRN', dasf: 'DASF', mitre: 'MITRE', v2: 'v2', rce: 'RCE' }
  return String(s).toLowerCase().split('_').map((w) => ACR[w] ?? (w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
}

/**
 * PA's own risk classification, read from its report summary ("The agent has
 * low risk…", "The APPLICATION has LOW with an ASR…"). No thresholds are
 * invented here: without the sentence, there is no level.
 */
export function riskLevel(summary) {
  const m = String(summary ?? '').match(/\bhas\s+(?:an?\s+)?(low|medium|high|critical)\b/i)
  return m ? m[1].toLowerCase() : null
}
export const riskTone = (t, level) => (level === 'low' ? t.pass : level === 'medium' ? t.warn : level ? t.block : t.live)

export const STATUS = {
  QUEUED:    { label: 'Queued',    tone: 'live' },
  INIT:      { label: 'Starting',  tone: 'live' },
  RUNNING:   { label: 'Running',   tone: 'live' },
  COMPLETED: { label: 'Completed', tone: 'pass' },
  ABORTED:   { label: 'Aborted',   tone: 'warn' },
  FAILED:    { label: 'Failed',    tone: 'warn' },
}
export const statusMeta = (s) => STATUS[s] ?? { label: pretty(s) || 'Unknown', tone: 'idle' }

export const pct = (n, d) => (d ? (n / d) * 100 : 0)
export const fmtPct = (v) => (v == null || Number.isNaN(v) ? '—' : v === 0 ? '0%' : `${Number(v).toFixed(1)}%`)
export const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString())

/** Every sub-category result in a static report, flattened and ranked by success rate. */
export function subcategoryResults(report) {
  const out = []
  for (const key of ['security_report', 'safety_report', 'brand_report']) {
    const r = report?.[key]
    for (const s of r?.sub_categories ?? []) {
      if (!s.total) continue
      out.push({ ...s, category: r.id, asr: pct(s.successful, s.total) })
    }
  }
  return out.sort((a, b) => b.asr - a.asr || b.successful - a.successful)
}

const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
export function severityRows(report) {
  const stats = report?.severity_report?.stats
  const list = Array.isArray(stats) ? stats : stats && typeof stats === 'object'
    ? Object.entries(stats).map(([severity, v]) => ({ severity, successful: typeof v === 'number' ? v : v?.successful ?? 0, failed: v?.failed ?? 0 }))
    : []
  return SEV_ORDER.map((s) => list.find((x) => String(x.severity).toUpperCase() === s)).filter(Boolean)
    .map((x) => ({ ...x, total: (x.successful ?? 0) + (x.failed ?? 0) }))
}

export function attemptTotals(report, job) {
  const sev = report?.severity_report
  if (sev?.total_attacks != null) return { successful: sev.successful ?? 0, failed: sev.failed ?? 0, total: sev.total_attacks }
  if (report && report.total_threats != null) return { successful: report.total_threats, failed: null, total: null }
  const rm = job?.runtime_metrics
  return rm?.attempts_total ? { successful: null, failed: null, total: rm.attempts_total } : null
}

/**
 * The campaign's record in Strata Cloud Manager. `tsg_id` comes from the job,
 * the same way the supply-chain console builds its links — without it SCM
 * opens whichever tenant the browser used last.
 */
export function scmCampaignUrl(job) {
  if (!job?.uuid) return null
  const tsg = job.tsg_id ? `?tsg_id=${encodeURIComponent(job.tsg_id)}` : ''
  return `https://stratacloudmanager.paloaltonetworks.com/ai-security/red-team/scans/${job.uuid}/overview${tsg}`
}

export function relTime(iso) {
  const t = Date.parse(iso)
  if (!t) return ''
  const s = (Date.now() - t) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 14) return `${Math.floor(s / 86400)} d ago`
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtEta(sec) {
  if (sec == null) return null
  if (sec < 90) return `${Math.round(sec)} s`
  if (sec < 5400) return `${Math.round(sec / 60)} min`
  return `${(sec / 3600).toFixed(1)} h`
}

/** "SUDO AIRS Demo · Target · 3:26:43 PM" — the name the Classic view gives a campaign. */
export const campaignName = (target) => `SUDO AIRS Demo · ${target.name} · ${new Date().toLocaleTimeString()}`

async function getJSON(url) {
  const r = await fetch(url)
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(apiMessage(d) || `HTTP ${r.status}`), { status: r.status })
  return d
}

/** PA errors arrive as `detail` (string or FastAPI validation list), `error` or `message`. */
export function apiMessage(d) {
  const x = d?.detail ?? d?.error ?? d?.message
  if (!x) return null
  if (typeof x === 'string') return x
  if (Array.isArray(x)) return x.map((e) => e?.msg ?? JSON.stringify(e)).join(' · ')
  return JSON.stringify(x)
}

// ─── categories ──────────────────────────────────────────────────────────────

let categoriesCache = null
/** PA's category catalogue (display names, descriptions); the Classic taxonomy if it does not answer. */
export function useCategories() {
  const [cats, setCats] = useState(categoriesCache)
  useEffect(() => {
    if (categoriesCache) return
    let live = true
    getJSON('/api/redteam/categories')
      .then((d) => {
        const list = (Array.isArray(d) ? d : d?.data ?? []).filter((c) => c.active !== false).map((c) => ({
          id: c.id, label: c.display_name ?? catMeta(c.id).label, description: c.description ?? null,
          subs: (c.sub_categories ?? []).filter((s) => s.active !== false).map((s) => ({ id: s.id, label: s.display_name ?? pretty(s.id), description: s.description ?? null })),
        }))
        if (list.length) { categoriesCache = { list, live: true }; if (live) setCats(categoriesCache) }
        else throw new Error('empty')
      })
      .catch(() => {
        categoriesCache = { live: false, list: Object.entries(FALLBACK_CATEGORIES).map(([id, subs]) => ({ id, label: catMeta(id).label, description: null, subs: subs.map((s) => ({ id: s, label: pretty(s), description: null })) })) }
        if (live) setCats(categoriesCache)
      })
    return () => { live = false }
  }, [])
  return cats
}

// ─── campaign telemetry (report, remediations, policy, errors, goals) ───────

const telemetry = new Map()   // id → bundle (only terminal campaigns are kept)

export function useCampaignTelemetry(id, status) {
  const terminal = TERMINAL.has(status)
  const [state, setState] = useState(() => ({ id, data: telemetry.get(id) ?? null, error: null, loading: false }))

  const load = useCallback((force = false) => {
    if (!id) return
    if (!force && telemetry.has(id)) { setState({ id, data: telemetry.get(id), error: null, loading: false }); return }
    setState((s) => ({ id, data: s.id === id ? s.data : null, error: null, loading: true }))
    getJSON(`/api/redteam/scan/${id}/telemetry${force ? '?force=1' : ''}`)
      .then((d) => { if (TERMINAL.has(d.job?.status)) telemetry.set(id, d); setState({ id, data: d, error: null, loading: false }) })
      .catch((e) => setState({ id, data: null, error: e.message, loading: false }))
  }, [id])

  // Reload when the campaign finishes: a running job has no report yet.
  useEffect(() => { load() }, [load, terminal])
  const cur = state.id === id ? state : { id, data: null, error: null, loading: !!id }
  return { ...cur, reload: () => load(true) }
}

// ─── one attack with its responses ───────────────────────────────────────────

const attackDetails = new Map()
export function useAttackDetail(jobId, attackId, enabled) {
  const key = `${jobId}|${attackId}`
  const [state, setState] = useState(() => ({ key, data: attackDetails.get(key) ?? null, error: null, loading: false }))
  useEffect(() => {
    if (!enabled || !jobId || !attackId) return undefined
    if (attackDetails.has(key)) { setState({ key, data: attackDetails.get(key), error: null, loading: false }); return undefined }
    let live = true
    setState({ key, data: null, error: null, loading: true })
    getJSON(`/api/redteam/scan/${jobId}/attack/${attackId}`)
      .then((d) => { attackDetails.set(key, d); if (live) setState({ key, data: d, error: null, loading: false }) })
      .catch((e) => { if (live) setState({ key, data: null, error: e.message, loading: false }) })
    return () => { live = false }
  }, [key, enabled, jobId, attackId])
  return state.key === key ? state : { key, data: null, error: null, loading: enabled }
}

export const signalOf = (t, tone) => t[tone] ?? SIGNAL.idle
