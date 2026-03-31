// src/components/observability/TraceTable.jsx
import React from 'react'
import { ShieldX, ShieldCheck, Zap, AlertTriangle, ShieldOff } from 'lucide-react'

function VerdictBadge({ verdict }) {
  if (verdict === 'BLOCKED') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/20 border border-red-500/30 text-red-400">
      <ShieldX size={8} /> BLOCKED
    </span>
  )
  if (verdict === 'ALLOWED') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
      <ShieldCheck size={8} /> ALLOWED
    </span>
  )
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/[0.06] border border-white/[0.08] text-slate-500">
      <Zap size={8} /> DIRECT
    </span>
  )
}

function CategoryBadge({ category }) {
  if (!category) return <span className="text-slate-700 text-[9px]">—</span>
  const styles = {
    malicious:    'bg-red-500/20 border-red-500/30 text-red-400',
    jailbreak:    'bg-orange-500/20 border-orange-500/30 text-orange-400',
    data_leakage: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
    benign:       'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
  }
  const cls = styles[category] ?? 'bg-white/[0.06] border-white/[0.08] text-slate-500'
  return (
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide ${cls}`}>
      {category.replace(/_/g, ' ')}
    </span>
  )
}

export function TraceTable({ traces, selectedId, onSelect }) {
  if (!traces.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
        <AlertTriangle size={20} className="text-slate-700" />
      </div>
      <p className="text-sm text-slate-600">No traces match the current filters</p>
    </div>
  )

  const SEVERITY_COLORS = {
    critical: 'bg-red-600/20 text-red-400 border-red-600/30',
    high:     'bg-red-500/20 text-red-300 border-red-500/30',
    medium:   'bg-orange-500/20 text-orange-300 border-orange-500/30',
    low:      'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  }

  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_90px_100px_90px_70px_70px_90px] gap-3 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
        {['Prompt', 'Category', 'Verdict', 'Protection', 'Total', 'LLM', 'Time'].map(h => (
          <span key={h} className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{h}</span>
        ))}
      </div>
      {/* Rows */}
      {traces.map(trace => (
        <button
          key={trace.id}
          onClick={() => onSelect(trace.id)}
          className={`w-full grid grid-cols-[1fr_90px_100px_90px_70px_70px_90px] gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 text-left transition-all duration-100 hover:bg-teal-500/[0.06] hover:border-l-2 hover:border-l-teal-500/40 ${selectedId === trace.id ? 'bg-teal-500/[0.10] border-l-2 border-l-teal-500/60' : ''}`}
        >
          <span className="text-xs text-slate-400 truncate pr-2 flex items-center gap-1">
            {trace.attack_severity && (
              <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full border uppercase mr-1 flex-shrink-0 ${SEVERITY_COLORS[trace.attack_severity] ?? 'bg-white/[0.06] text-slate-400 border-white/[0.08]'}`}>
                {trace.attack_severity}
              </span>
            )}
            {trace.attack_label
              ? <><span className="text-orange-400 font-semibold mr-1.5">[{trace.attack_label}]</span>{trace.prompt?.slice(0, 60)}{trace.prompt?.length > 60 ? '…' : ''}</>
              : <>{trace.prompt?.slice(0, 80) ?? '—'}{trace.prompt?.length > 80 ? '…' : ''}</>}
          </span>
          <span><CategoryBadge category={trace.category} /></span>
          <span><VerdictBadge verdict={trace.verdict} /></span>
          <span className="flex items-center">
            {trace.airs_enabled
              ? <ShieldCheck size={12} className="text-emerald-400" />
              : <ShieldOff size={12} className="text-red-400" />
            }
          </span>
          <span className="text-[10px] font-mono text-slate-400">{trace.total_ms != null ? `${trace.total_ms}ms` : '—'}</span>
          <span className="text-[10px] font-mono text-blue-400">{trace.llm_ms != null ? `${trace.llm_ms}ms` : '—'}</span>
          <span className="text-[9px] text-slate-600">{new Date(trace.created_at).toLocaleTimeString()}</span>
        </button>
      ))}
    </div>
  )
}
