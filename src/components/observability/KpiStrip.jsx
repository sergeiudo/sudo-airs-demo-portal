// src/components/observability/KpiStrip.jsx
import React, { useState } from 'react'
import { Activity, Clock, TrendingUp, ShieldX, Zap, Hash, Shield } from 'lucide-react'

function TooltipIcon({ text }) {
  const [pos, setPos] = useState(null)

  const TOOLTIP_W = 256 // w-64

  const handleMouseEnter = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const centeredX = r.left + r.width / 2
    // Clamp so tooltip stays inside viewport with 8px margin
    const minX = TOOLTIP_W / 2 + 8
    const maxX = window.innerWidth - TOOLTIP_W / 2 - 8
    setPos({ x: Math.min(Math.max(centeredX, minX), maxX), y: r.bottom + 8 })
  }

  return (
    <div className="relative ml-auto flex-shrink-0">
      <button
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setPos(null)}
        className="w-4 h-4 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-[9px] font-bold text-slate-500 hover:text-slate-300 hover:bg-white/[0.14] transition-colors"
      >
        ?
      </button>
      {pos && (
        <div
          className="fixed z-[9999] w-64 p-3 rounded-xl bg-slate-900 border border-white/[0.15] shadow-2xl text-[11px] text-slate-300 leading-relaxed pointer-events-none"
          style={{ left: pos.x, top: pos.y, transform: 'translateX(-50%)' }}
        >
          {text}
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, tooltip, icon: Icon, color = 'text-slate-200', bgColor = 'bg-white/[0.04]', borderColor = 'border-white/[0.08]' }) {
  return (
    <div className={`flex flex-col gap-2 p-4 rounded-2xl border ${bgColor} ${borderColor} flex-1 min-w-0`}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">
          <Icon size={14} className={color} />
        </div>
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold truncate">{label}</span>
        {tooltip && <TooltipIcon text={tooltip} />}
      </div>
      <span className={`text-3xl font-bold font-mono leading-none ${color}`}>{value ?? '—'}</span>
      {sub && <span className="text-[10px] text-slate-600">{sub}</span>}
    </div>
  )
}

export function KpiStrip({ metrics }) {
  if (!metrics) return null
  return (
    <div className="flex gap-3">
      <KpiCard
        label="Total Requests"
        value={metrics.total_requests}
        sub="all time"
        tooltip="Total number of LLM API calls captured since the server started."
        icon={Activity}
        color="text-slate-200"
      />
      <KpiCard
        label="Avg Latency"
        value={metrics.avg_total_ms ? `${metrics.avg_total_ms}ms` : '—'}
        sub="end-to-end"
        tooltip="Average end-to-end latency per request — includes AIRS input scan + LLM inference + AIRS output scan. AIRS scan is a live network call to service.api.aisecurity.paloaltonetworks.com. Measured from US infrastructure: typical 500–900ms avg (min 496ms, max 1,121ms). Production deployments with co-located AIRS endpoints are significantly faster."
        icon={Clock}
        color="text-blue-400"
        bgColor="bg-blue-500/[0.06]"
        borderColor="border-blue-500/20"
      />
      <KpiCard
        label="P95 Latency"
        value={metrics.p95_total_ms ? `${metrics.p95_total_ms}ms` : '—'}
        sub="95th percentile"
        tooltip="95th percentile latency — 95% of all requests complete faster than this. High values indicate occasional slow outliers. Useful for SLA planning."
        icon={TrendingUp}
        color="text-violet-400"
        bgColor="bg-violet-500/[0.06]"
        borderColor="border-violet-500/20"
      />
      <KpiCard
        label="Blocked"
        value={metrics.blocked_count}
        sub={`${metrics.block_rate_pct ?? 0}% block rate`}
        tooltip={`Prisma AIRS blocked ${metrics.blocked_count} request${metrics.blocked_count !== 1 ? 's' : ''} — either the prompt was malicious (input scan) or the LLM response was unsafe (output scan). ${metrics.block_rate_pct ?? 0}% of all traffic was blocked.`}
        icon={ShieldX}
        color="text-red-400"
        bgColor="bg-red-500/[0.06]"
        borderColor="border-red-500/20"
      />
      <KpiCard
        label="Detection Rate"
        value={metrics.total_requests > 0 ? `${metrics.block_rate_pct}%` : '—'}
        sub="threats caught"
        tooltip={`${metrics.block_rate_pct ?? 0}% of all requests contained a detectable threat (prompt injection, jailbreak, data leakage, etc.) and were blocked by Prisma AIRS before reaching or returning from the LLM.`}
        icon={Zap}
        color="text-emerald-400"
        bgColor="bg-emerald-500/[0.06]"
        borderColor="border-emerald-500/20"
      />
      {metrics.avg_airs_overhead_pct != null && (
        <KpiCard
          label="AIRS Overhead"
          value={`${metrics.avg_airs_overhead_pct}%`}
          sub="of total latency"
          tooltip={`On average, Prisma AIRS scanning (input + output) accounts for ${metrics.avg_airs_overhead_pct}% of total request latency. The remaining ${Math.round(100 - metrics.avg_airs_overhead_pct)}% is LLM inference time. This shows the cost of protection.`}
          icon={Zap}
          color="text-teal-400"
          bgColor="bg-teal-500/[0.06]"
          borderColor="border-teal-500/20"
        />
      )}
      {metrics.avg_tokens_per_request != null && (
        <KpiCard
          label="Avg Tokens"
          value={metrics.avg_tokens_per_request}
          sub="per request"
          tooltip="Average total tokens (input + output) consumed per LLM call. Input tokens are the prompt sent to the model; output tokens are the generated response. Higher values = higher cost per request."
          icon={Hash}
          color="text-violet-400"
          bgColor="bg-violet-500/[0.06]"
          borderColor="border-violet-500/20"
        />
      )}
      {metrics.protected_count != null && metrics.total_requests > 0 && (
        <KpiCard
          label="Protected"
          value={metrics.protected_count}
          sub={`of ${metrics.total_requests} total`}
          tooltip={`${metrics.protected_count} of ${metrics.total_requests} requests were routed through Prisma AIRS (input + output scanning enabled). The remaining ${metrics.total_requests - metrics.protected_count} were sent directly to the LLM without protection.`}
          icon={Shield}
          color="text-emerald-400"
          bgColor="bg-emerald-500/[0.06]"
          borderColor="border-emerald-500/20"
        />
      )}
    </div>
  )
}
