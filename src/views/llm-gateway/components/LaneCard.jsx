import React from 'react'
import { ShieldOff, Shield, ShieldCheck } from 'lucide-react'
import { GuardrailVerdictCard } from './GuardrailVerdictCard'

const LANE_META = {
  'no-guardrail': { label: 'Vertex (no guardrail)',  icon: ShieldOff,   color: '#94a3b8' },
  'defaults':     { label: 'Portkey defaults',       icon: Shield,      color: '#0ea5e9' },
  'airs':         { label: 'Portkey + AIRS',         icon: ShieldCheck, color: '#ec4899' },
}

export function LaneCard({ lane, isLight }) {
  const meta = LANE_META[lane.id] || { label: lane.id, icon: Shield, color: '#94a3b8' }
  const Icon = meta.icon

  const verdict = lane.verdict || 'UNKNOWN'
  const isBlocked = verdict.startsWith('BLOCKED')
  const isUnconf = verdict === 'UNCONFIGURED'
  const isError = verdict === 'ERROR'

  // A guardrail can ALLOW the request but transform it first (e.g. PII redaction).
  // Portkey flags this with `transformed: true` on the hook. Surface it as a
  // distinct REDACTED verdict so an allowed-but-sanitised lane doesn't read as
  // "leaked" (orange) when it actually protected the data.
  const transformed = [
    ...(lane.hookResults?.before_request_hooks || []),
    ...(lane.hookResults?.after_request_hooks || []),
  ].some(h => h?.transformed === true)
  const isRedacted = verdict === 'ALLOWED' && transformed
  const isAllowed = verdict === 'ALLOWED' && !transformed

  const verdictColor =
    isBlocked  ? '#10b981' :   // BLOCKED = good (the attack was stopped)
    isRedacted ? '#0ea5e9' :   // REDACTED = data sanitised before the model saw it
    isAllowed  ? '#f97316' :   // ALLOWED = (in this demo) bad — got through untouched
    isUnconf   ? '#64748b' :
    isError    ? '#ef4444' :
                 '#94a3b8'

  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'

  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl"
         style={{
           background: isLight ? '#ffffff' : 'rgba(15,20,35,0.55)',
           border: `1px solid ${meta.color}44`,
           boxShadow: isLight ? '0 4px 12px rgba(0,48,135,0.06)' : 'none',
         }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: meta.color }}>
          <Icon size={13} />{meta.label}
        </div>
        <div className="text-[10px] font-mono opacity-70" style={{ color: textSecondary }}>
          {lane.latencyMs ? `${lane.latencyMs}ms` : '—'} · {lane.tokens || 0} tok
        </div>
      </div>

      <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: verdictColor }}>
        {isRedacted ? 'ALLOWED · REDACTED' : verdict}
      </div>

      {isUnconf && (
        <div className="text-[11px]" style={{ color: textSecondary }}>{lane.error}</div>
      )}

      {isError && (
        <div className="text-[11px]" style={{ color: '#ef4444' }}>{lane.error}</div>
      )}

      {(isAllowed || isRedacted || isBlocked) && lane.response && (
        <div className="text-[11px] leading-relaxed max-h-32 overflow-y-auto" style={{ color: textPrimary }}>
          {lane.response}
        </div>
      )}

      {lane.hookResults && (
        <GuardrailVerdictCard hookResults={lane.hookResults} isLight={isLight} />
      )}
    </div>
  )
}
