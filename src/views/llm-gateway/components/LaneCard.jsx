import React, { useState } from 'react'
import { ShieldOff, Shield, ShieldCheck, ChevronRight } from 'lucide-react'

const LANE_META = {
  'no-guardrail': { label: 'Vertex (no guardrail)',  icon: ShieldOff,   color: '#94a3b8' },
  'defaults':     { label: 'Portkey defaults',       icon: Shield,      color: '#0ea5e9' },
  'airs':         { label: 'Portkey + AIRS',         icon: ShieldCheck, color: '#ec4899' },
}

export function LaneCard({ lane }) {
  const meta = LANE_META[lane.id] || { label: lane.id, icon: Shield, color: '#94a3b8' }
  const Icon = meta.icon
  const [open, setOpen] = useState(false)

  const verdict = lane.verdict || 'UNKNOWN'
  const isBlocked = verdict.startsWith('BLOCKED')
  const isUnconf = verdict === 'UNCONFIGURED'
  const isError = verdict === 'ERROR'
  const isAllowed = verdict === 'ALLOWED'

  const verdictColor =
    isBlocked  ? '#10b981' :   // BLOCKED = good
    isAllowed  ? '#f97316' :   // ALLOWED = (in this demo) bad
    isUnconf   ? '#64748b' :
    isError    ? '#ef4444' :
                 '#94a3b8'

  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl"
         style={{ background: 'rgba(15,20,35,0.55)', border: `1px solid ${meta.color}44` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: meta.color }}>
          <Icon size={13} />{meta.label}
        </div>
        <div className="text-[10px] font-mono opacity-70">
          {lane.latencyMs ? `${lane.latencyMs}ms` : '—'} · {lane.tokens || 0} tok
        </div>
      </div>

      <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: verdictColor }}>
        {verdict}
      </div>

      {isBlocked && lane.blockReason && (
        <div className="text-[11px] text-slate-400">
          reason: <span className="text-slate-200">{lane.blockReason?.id || lane.blockReason?.name || 'guardrail'}</span>
        </div>
      )}

      {isUnconf && (
        <div className="text-[11px] text-slate-500">{lane.error}</div>
      )}

      {isError && (
        <div className="text-[11px] text-red-400">{lane.error}</div>
      )}

      {(isAllowed || isBlocked) && lane.response && (
        <div className="text-[11px] leading-relaxed text-slate-300 max-h-32 overflow-y-auto">
          {lane.response}
        </div>
      )}

      {lane.hookResults && (
        <button onClick={() => setOpen(o => !o)}
                className="self-start flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200">
          <ChevronRight size={10} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)' }} />
          hook_results
        </button>
      )}
      {open && lane.hookResults && (
        <pre className="text-[10px] p-2 rounded overflow-x-auto" style={{ background: '#0d1117', color: '#c9d1d9' }}>
{JSON.stringify(lane.hookResults, null, 2)}
        </pre>
      )}
    </div>
  )
}
