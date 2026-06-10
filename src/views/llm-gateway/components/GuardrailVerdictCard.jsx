import React, { useState } from 'react'
import { ShieldCheck, ShieldX, ChevronRight } from 'lucide-react'

// ── hook_results parsing helpers (shared with PipelineTrace) ────────────────

// Pull the Prisma AIRS check out of one hook array; fall back to generic
// guardrail checks (e.g. Portkey default.regexMatch) when AIRS isn't attached.
export function parsePhase(hooks) {
  if (!hooks || hooks.length === 0) return null
  const checks = []
  let airs = null
  for (const h of hooks) {
    for (const c of h?.checks || []) {
      const isAirs = String(c?.id || '').includes('panw-prisma-airs') || !!c?.data?.profile_name
      checks.push({ id: c?.id || 'check', verdict: c?.verdict !== false, execMs: c?.execution_time ?? null, isAirs })
      if (isAirs && !airs) airs = { data: c?.data || null, execMs: c?.execution_time ?? h?.execution_time ?? null, verdict: c?.verdict !== false }
    }
  }
  const anyFail = hooks.some(h => h?.verdict === false)
  return { checks, airs, anyFail, execMs: airs?.execMs ?? hooks[0]?.execution_time ?? null }
}

export function parseHookResults(hookResults) {
  if (!hookResults) return null
  const input  = parsePhase(hookResults.before_request_hooks)
  const output = parsePhase(hookResults.after_request_hooks)
  if (!input && !output) return null
  return { input, output, blocked: !!(input?.anyFail || output?.anyFail) }
}

// Human-readable threat chips from an AIRS scan data object.
export function airsThreats(data) {
  const out = []
  for (const det of [data?.prompt_detected, data?.response_detected]) {
    for (const [k, v] of Object.entries(det || {})) {
      if (v === true) out.push(k.replace(/_/g, ' '))
    }
  }
  const toxicCats = data?.prompt_detection_details?.toxic_content_details?.toxic_categories
    || data?.response_detection_details?.toxic_content_details?.toxic_categories
  if (Array.isArray(toxicCats) && toxicCats.length) {
    const i = out.indexOf('toxic content')
    if (i !== -1) out[i] = `toxic content: ${toxicCats.join(', ')}`
  }
  return out
}

// ── The card ────────────────────────────────────────────────────────────────
// Structured guardrail verdict: green "scanned — passed" summary on allowed
// responses, rich red threat card on blocks. Raw JSON stays as an expandable
// detail underneath.
export function GuardrailVerdictCard({ hookResults, isLight, defaultOpen = false }) {
  const [rawOpen, setRawOpen] = useState(false)
  const parsed = parseHookResults(hookResults)
  if (!parsed) return null

  const blocked = parsed.blocked
  const airs = parsed.input?.airs || parsed.output?.airs
  const data = airs?.data
  const threats = blocked ? airsThreats(data) : []

  const accent = blocked ? '#ef4444' : '#10b981'
  const bg = blocked
    ? (isLight ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.08)')
    : (isLight ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.07)')
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  const Icon = blocked ? ShieldX : ShieldCheck

  const phaseLine = (label, phase) => {
    if (!phase) return null
    const ok = !phase.anyFail
    return (
      <span key={label} className="flex items-center gap-1">
        <span style={{ color: ok ? '#10b981' : '#ef4444', fontWeight: 700 }}>{ok ? '✓' : '✕'}</span>
        <span>{label} scan</span>
        {phase.execMs != null && <span style={{ color: textSecondary }}>· {phase.execMs}ms</span>}
      </span>
    )
  }

  // Generic (non-AIRS) checks — e.g. Portkey default regex/PII guardrails
  const genericChecks = [...(parsed.input?.checks || []), ...(parsed.output?.checks || [])].filter(c => !c.isAirs)

  return (
    <div className="rounded-lg overflow-hidden text-[11px]"
         style={{ background: bg, border: `1px solid ${accent}55` }}>
      <div className="px-3 py-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 font-bold" style={{ color: accent }}>
          <Icon size={14} />
          {airs
            ? (blocked ? 'BLOCKED BY PRISMA AIRS' : 'Prisma AIRS scanned — no threats')
            : (blocked ? 'BLOCKED BY GUARDRAIL' : 'Guardrail checks passed')}
        </div>

        <div className="flex flex-wrap items-center gap-3" style={{ color: textPrimary }}>
          {phaseLine('input', parsed.input)}
          {phaseLine('output', parsed.output)}
        </div>

        {blocked && threats.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {threats.map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: `${accent}1f`, border: `1px solid ${accent}66`, color: accent }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {airs && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: textSecondary }}>
            {data?.category && <span>category: <span style={{ color: textPrimary }}>{data.category}</span></span>}
            {data?.profile_name && <span>profile: <span className="font-mono">{data.profile_name}</span></span>}
          </div>
        )}

        {!airs && genericChecks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {genericChecks.map((c, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full font-mono"
                    style={{
                      background: isLight ? 'rgba(0,48,135,0.05)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${c.verdict ? '#10b98155' : '#ef444455'}`,
                      color: c.verdict ? '#10b981' : '#ef4444',
                    }}>
                {c.verdict ? '✓' : '✕'} {c.id}
              </span>
            ))}
          </div>
        )}

        {airs && data?.report_id && (
          <div className="font-mono text-[10px]" style={{ color: textSecondary }}>
            report {data.report_id} · scan {data.scan_id}
          </div>
        )}
      </div>

      <button onClick={() => setRawOpen(o => !o)}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold border-t"
              style={{ color: textSecondary, borderColor: `${accent}33` }}>
        <ChevronRight size={11} style={{ transform: rawOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
        raw hook_results
      </button>
      {rawOpen && (
        <pre className="px-3 pb-3 text-[10px] leading-relaxed overflow-x-auto max-h-64 overflow-y-auto"
             style={{ color: isLight ? '#1e293b' : '#c9d1d9', background: isLight ? '#f1f5f9' : '#0d1117' }}>
{JSON.stringify(hookResults, null, 2)}
        </pre>
      )}
    </div>
  )
}
