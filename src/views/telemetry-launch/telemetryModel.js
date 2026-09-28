import { Waypoints, HeartPulse, Archive, Server, ShieldX, ShieldCheck, ShieldOff } from 'lucide-react'
import { shade } from '../home-2027/band'

/**
 * telemetryModel — the vocabulary of the Telemetry console.
 *
 * Every trace arrives classified by the server (traceStore.summarize): an
 * outcome (stopped · cleared · unscanned), and for a stop the stage that
 * decided it, for an unscanned trace the gap that let it through. This file
 * names those in words an audience reads, and maps each trace to the wires it
 * travelled in the flow diagram.
 */

// Targets are identities, not states: cloud colours for the API-layer
// backends, the gateway's pink, MOH's sky, and grey for the legacy gateway
// (grey is how the portal marks superseded — colour would claim "live").
export const TARGET_META = {
  bedrock: { label: 'Bedrock', cloud: 'AWS', logo: '/logo-aws.png', tone: '#FF9900', where: 'api', how: 'Scanned by this app before and after the model' },
  vertex: { label: 'Vertex AI', cloud: 'Google Cloud', logo: '/logo-gcp.png', tone: '#4285F4', where: 'api', how: 'Scanned by this app before and after the model' },
  azure: { label: 'Azure OpenAI', cloud: 'Microsoft', logo: '/logo-azure.png', tone: '#0078D4', where: 'api', how: 'Scanned by this app before and after the model' },
  aigw: { label: 'SCM AI-GW', cloud: 'Bedrock + Vertex', icon: Waypoints, tone: '#EC4899', where: 'gateway', how: 'Guardrail inside the SCM AI Gateway' },
  'moh-aigw': { label: 'Ministry of Health', cloud: 'via the AI-GW', icon: HeartPulse, tone: '#0EA5E9', where: 'gateway', how: 'Guardrail inside the AI-GW, tool calls scanned directly' },
  portkey: { label: 'Legacy gateway', cloud: 'api.portkey.ai', icon: Archive, tone: '#94A3B8', where: 'gateway', how: 'Portkey guardrails — the three-lane comparison' },
}
export const targetMeta = (id) => TARGET_META[id] ?? { label: id || 'Unknown', cloud: '', icon: Server, tone: '#9A9AA2', where: null, how: '' }
export const TARGET_ORDER = ['bedrock', 'vertex', 'azure', 'aigw', 'moh-aigw', 'portkey']

export const WINDOWS = [
  { id: '20m', label: '20 min', long: 'the last 20 minutes' },
  { id: '1h', label: '1 hour', long: 'the last hour' },
  { id: '24h', label: '24 hours', long: 'the last 24 hours' },
  { id: '7d', label: '7 days', long: 'the last 7 days' },
  { id: 'all', label: 'All time', long: 'all time' },
]
export const windowLong = (id) => WINDOWS.find((w) => w.id === id)?.long ?? id

export const outcomeTone = (t, o) => (o === 'stopped' ? t.block : o === 'cleared' ? t.pass : t.warn)
export const OUTCOME_ICON = { stopped: ShieldX, cleared: ShieldCheck, unscanned: ShieldOff }

export const STAGE_SHORT = { input: 'at the prompt', output: 'at the response', tool: 'at a tool call', native: 'by a non-AIRS guardrail' }
export const GAP_SHORT = { off: 'AIRS was off', failopen: 'guardrail failed open' }

/** One line saying what happened to a trace — the sub-line of a feed row. */
export function outcomeLine(s) {
  if (s.outcome === 'stopped') return `Stopped ${STAGE_SHORT[s.stage] ?? ''}`.trim()
  if (s.outcome === 'unscanned') return s.gap === 'failopen' ? 'Unscanned — the guardrail failed open' : 'Unscanned — AIRS was off'
  return s.flagged ? 'Flagged, served' : 'Cleared'
}

export const FAMILY_SHORT = {
  injection: 'Injection', agent: 'Agent', dlp: 'DLP', toxic: 'Toxic', url: 'URL', code: 'Code',
  source: 'Source code', db: 'DB', ungrounded: 'Ungrounded', topic: 'Topic',
}

/**
 * The wires a trace travelled, in order — the flow diagram's packet route.
 * Keys match the wire keys TrafficFlow draws.
 */
export function routeOf(s) {
  if (s.outcome === 'unscanned') return ['skip', 'unscanned']
  if (s.outcome === 'stopped' && s.stage === 'native') return ['skip', 'native']
  if (s.outcome === 'stopped' && s.stage === 'input') return ['in', 'stopIn']
  if (s.outcome === 'stopped' && s.stage === 'tool') return ['in', 'toModel', 'stopTool']
  if (s.outcome === 'stopped') return ['in', 'toModel', 'toOut', 'stopOut']
  return ['in', 'toModel', 'toOut', 'clear']
}
/** The node a trace comes to rest at. */
export const restOf = (s) => ({ unscanned: 'unscanned', native: 'native', stopIn: 'stopIn', stopTool: 'stopTool', stopOut: 'stopOut', clear: 'clear' })[routeOf(s).at(-1)]

// ─── formatting ──────────────────────────────────────────────────────────────

export const fmtCount = (n) => (n == null ? '—' : Number(n).toLocaleString())
export const fmtPct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—')
export function fmtMs(ms) {
  if (ms == null || Number.isNaN(ms)) return '—'
  if (ms >= 10000) return `${(ms / 1000).toFixed(1)} s`
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  return `${Math.round(ms)} ms`
}

export function relTime(iso, now = Date.now()) {
  if (!iso) return '—'
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d < 45 ? `${d} d ago` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export const clockTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '')

/** "Mar 31 – Sep 28" for a window's actual span. */
export function spanLabel(a, b) {
  if (!a || !b) return ''
  const o = { month: 'short', day: 'numeric' }
  const x = new Date(a).toLocaleDateString(undefined, o)
  const y = new Date(b).toLocaleDateString(undefined, o)
  return x === y ? x : `${x} – ${y}`
}

/** The model's tail — "claude-haiku-4-5" rather than the whole routing id. */
export function modelTail(id) {
  if (!id) return ''
  const s = String(id).split('/').pop()
  return s.replace(/^(us|eu|global)\./, '').replace(/^(anthropic|amazon|meta|mistral|google|moonshotai|openai)\./, '').replace(/-v\d+:\d+$/, '').replace(/-\d{8}$/, '')
}

export const HEBREW = /[֐-׿]/
export const inkOn = (t, tone, k = 0.3) => (t.isLight ? shade(tone, k) : tone)
