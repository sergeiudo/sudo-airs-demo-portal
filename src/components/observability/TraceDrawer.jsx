// src/components/observability/TraceDrawer.jsx
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ShieldX, ShieldCheck, Zap, AlertTriangle,
  ChevronDown, Clock, Cpu, Activity,
} from 'lucide-react'

// ─── Span config ──────────────────────────────────────────────────────────────
const SPAN_CFG = {
  user_prompt_received: {
    label: 'User Prompt',
    dot:   'bg-slate-400 border-slate-400',
    bar:   'bg-slate-400',
    text:  'text-slate-400',
    line:  '#94a3b8',
    detail: () => 'Message sent to protected endpoint',
  },
  airs_input_scan: {
    label: 'AIRS Input Scan',
    dot:   'bg-emerald-500 border-emerald-500',
    bar:   'bg-emerald-500',
    text:  'text-emerald-400',
    line:  '#34d399',
    detail: (span) => {
      const m = span.metadata ?? {}
      const parts = []
      if (m.action) parts.push(`action: ${m.action}`)
      if (m.category) parts.push(m.category)
      if (m.scan_id) parts.push(`scan: ${m.scan_id.slice(0, 8)}…`)
      return parts.join(' · ') || 'Prompt scanned by Prisma AIRS'
    },
  },
  llm_inference: {
    label: 'LLM Inference',
    dot:   'bg-blue-500 border-blue-500',
    bar:   'bg-blue-500',
    text:  'text-blue-400',
    line:  '#60a5fa',
    detail: (span) => {
      const m = span.metadata ?? {}
      const parts = []
      if (m.model) parts.push(m.model)
      if (m.tokens_in != null && m.tokens_out != null)
        parts.push(`${m.tokens_in} in / ${m.tokens_out} out tok`)
      if (m.finish_reason) parts.push(`stop: ${m.finish_reason}`)
      return parts.join(' · ') || 'LLM processing'
    },
  },
  airs_output_scan: {
    label: 'AIRS Output Scan',
    dot:   'bg-violet-500 border-violet-500',
    bar:   'bg-violet-500',
    text:  'text-violet-400',
    line:  '#a78bfa',
    detail: (span) => {
      const m = span.metadata ?? {}
      const parts = []
      if (m.action) parts.push(`action: ${m.action}`)
      if (m.category) parts.push(m.category)
      return parts.join(' · ') || 'Response scanned by Prisma AIRS'
    },
  },
  response_delivered: {
    label: 'Response Delivered',
    dot:   'bg-teal-500 border-teal-500',
    bar:   'bg-teal-500',
    text:  'text-teal-400',
    line:  '#14b8a6',
    detail: (span) =>
      span.status === 'blocked'
        ? 'Blocked — response suppressed'
        : 'Clean response returned to user',
  },
}

// ─── VerdictBanner ────────────────────────────────────────────────────────────
function VerdictBanner({ trace }) {
  const isBlocked = trace.verdict === 'BLOCKED'
  const isDirect  = trace.verdict === 'DIRECT'

  const styles = isBlocked
    ? { wrap: 'bg-red-500/10 border-red-500/30', icon: <ShieldX size={22} className="text-red-400" />, text: 'text-red-300', badge: 'bg-red-500/20 border-red-500/30 text-red-400' }
    : isDirect
      ? { wrap: 'bg-white/[0.04] border-white/[0.08]', icon: <Zap size={22} className="text-slate-400" />, text: 'text-slate-300', badge: 'bg-white/[0.06] border-white/[0.08] text-slate-500' }
      : { wrap: 'bg-emerald-500/10 border-emerald-500/30', icon: <ShieldCheck size={22} className="text-emerald-400" />, text: 'text-emerald-300', badge: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' }

  return (
    <div className={`p-4 rounded-2xl border ${styles.wrap}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isBlocked ? 'bg-red-500/20' : isDirect ? 'bg-white/[0.06]' : 'bg-emerald-500/20'
        }`}>
          {styles.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-base font-black tracking-wide ${styles.text}`}>{trace.verdict}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
            {trace.backend} · {trace.model ?? trace.backend} · {new Date(trace.created_at).toLocaleString()}
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${styles.badge}`}>
          {trace.category?.toUpperCase() ?? 'UNKNOWN'}
        </span>
      </div>

      {trace.threats_detected?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/[0.06]">
          {trace.threats_detected.map(t => (
            <span key={t} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-[9px] font-bold text-red-300 uppercase tracking-wide">
              <AlertTriangle size={7} />{t.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MetricsStrip ─────────────────────────────────────────────────────────────
function MetricsStrip({ trace }) {
  const airsMs = (trace.airs_input_ms ?? 0) + (trace.airs_output_ms ?? 0)
  const cards = [
    { label: 'Total Time', value: trace.total_ms, sub: 'end-to-end', color: 'text-slate-300', icon: Clock },
    { label: 'LLM Latency', value: trace.llm_ms, sub: 'inference', color: 'text-blue-400', icon: Cpu },
    ...(airsMs > 0 ? [{ label: 'AIRS Overhead', value: airsMs, sub: 'total scans', color: 'text-emerald-400', icon: Activity }] : []),
  ].filter(c => c.value != null)

  if (!cards.length) return null

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cards.length}, 1fr)` }}>
      {cards.map(({ label, value, sub, color, icon: Icon }) => (
        <div key={label} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon size={11} className={color} />
            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{label}</span>
          </div>
          <div className={`text-xl font-black font-mono leading-none ${color}`}>
            {value.toLocaleString()}
            <span className="text-xs font-normal text-slate-500 ml-1">ms</span>
          </div>
          <div className="text-[9px] text-slate-600 mt-1">{sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── TokenBar ─────────────────────────────────────────────────────────────────
function TokenBar({ trace }) {
  const { tokens_in, tokens_out, llm_ms } = trace
  if (tokens_in == null && tokens_out == null) return null

  const total   = (tokens_in ?? 0) + (tokens_out ?? 0)
  const inPct   = total > 0 ? ((tokens_in ?? 0) / total) * 100 : 0
  const outPct  = total > 0 ? ((tokens_out ?? 0) / total) * 100 : 0
  const tps     = (tokens_out && llm_ms) ? Math.round((tokens_out / llm_ms) * 1000) : null

  return (
    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Token Usage</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-bold text-slate-300">{total.toLocaleString()} total</span>
          {tps != null && (
            <span className="text-[9px] text-slate-500">{tps} tok/s</span>
          )}
        </div>
      </div>

      {/* Split bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden bg-white/[0.06] gap-px">
        <motion.div
          className="bg-blue-500/80 rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${inPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <motion.div
          className="bg-violet-500/80 rounded-r-full"
          initial={{ width: 0 }}
          animate={{ width: `${outPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
        />
      </div>

      <div className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="w-2 h-2 rounded bg-blue-500/80 inline-block" />
          {tokens_in ?? '—'} input
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="w-2 h-2 rounded bg-violet-500/80 inline-block" />
          {tokens_out ?? '—'} output
        </span>
      </div>
    </div>
  )
}

// ─── FlowNode ─────────────────────────────────────────────────────────────────
function FlowNode({ span, totalMs, isLast }) {
  const cfg = SPAN_CFG[span.name] ?? {
    label: span.name, dot: 'bg-slate-500 border-slate-500', bar: 'bg-slate-500',
    text: 'text-slate-400', line: '#94a3b8', detail: () => '',
  }
  const isBlocked = span.status === 'blocked'
  const barPct    = totalMs > 0 && span.latency_ms > 0
    ? Math.max((span.latency_ms / totalMs) * 100, 2)
    : 0
  const detail    = cfg.detail(span)

  return (
    <div className="flex gap-3">
      {/* Left: dot + line */}
      <div className="flex flex-col items-center" style={{ width: 24, flexShrink: 0 }}>
        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 z-10 ${cfg.dot} ${isBlocked ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-transparent' : ''}`} />
        {!isLast && (
          <div className="w-0.5 flex-1 mt-0.5" style={{ background: cfg.line, opacity: 0.35, minHeight: 12 }} />
        )}
      </div>

      {/* Right: content */}
      <div className="flex-1 pb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold ${cfg.text}`}>{cfg.label}</span>
            {isBlocked && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-[8px] font-bold">
                <AlertTriangle size={7} />BLOCKED
              </span>
            )}
          </div>
          {span.latency_ms > 0 && (
            <span className="text-[10px] font-mono font-bold text-slate-400">{span.latency_ms}ms</span>
          )}
        </div>

        {detail && (
          <div className="text-[10px] text-slate-500 mb-1.5 leading-relaxed">{detail}</div>
        )}

        {barPct > 0 && (
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${cfg.bar} opacity-60`}
              initial={{ width: 0 }}
              animate={{ width: `${barPct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PipelineFlow ─────────────────────────────────────────────────────────────
function PipelineFlow({ spans, traceTotalMs }) {
  if (!spans?.length) return null
  const totalMs = traceTotalMs || spans.reduce((max, s) => Math.max(max, s.end_ms), 0) || 1

  return (
    <div>
      {spans.map((span, i) => (
        <FlowNode key={span.id} span={span} totalMs={totalMs} isLast={i === spans.length - 1} />
      ))}
      <div className="flex items-center justify-between text-[10px] pt-2 mt-1 border-t border-white/[0.06]">
        <span className="text-slate-500 font-semibold">Total round-trip</span>
        <span className="font-mono font-bold text-slate-300">{totalMs}ms</span>
      </div>
    </div>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ text, variant = 'default' }) {
  if (!text) return null
  const bg = variant === 'response'
    ? 'bg-emerald-500/[0.06] border-emerald-500/20'
    : 'bg-white/[0.03] border-white/[0.06]'

  return (
    <div className={`p-3 rounded-xl border ${bg} text-xs text-slate-400 font-mono leading-relaxed`}>
      <div className="overflow-y-auto max-h-[120px] pr-1 whitespace-pre-wrap break-words">{text}</div>
    </div>
  )
}

// ─── RawJsonToggle ────────────────────────────────────────────────────────────
function RawJsonToggle({ data }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
      >
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown size={12} />
        </motion.div>
        Raw JSON
      </button>
      {open && (
        <pre className="mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[9px] text-slate-500 overflow-auto max-h-[200px]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{children}</div>
  )
}

// ─── TraceDrawer (main export) ────────────────────────────────────────────────
export function TraceDrawer({ traceId, onClose }) {
  const [trace, setTrace]     = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!traceId) return
    setTrace(null)
    setLoading(true)
    fetch(`/api/traces/${traceId}`)
      .then(r => r.json())
      .then(setTrace)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [traceId])

  return (
    <AnimatePresence>
      {traceId && (
        <motion.div
          key="drawer"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed top-0 right-0 bottom-0 w-[600px] bg-white/[0.02] border-l border-white/[0.08] z-50 flex flex-col shadow-2xl backdrop-blur-xl"
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08] flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-300">Trace Detail</div>
              <div className="text-[9px] font-mono text-slate-600 truncate mt-0.5">{traceId}</div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
            >
              <X size={12} className="text-slate-400" />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {loading && (
              <div className="flex items-center justify-center py-16 text-slate-600 text-sm">
                Loading trace…
              </div>
            )}

            {!loading && trace && (
              <>
                <VerdictBanner trace={trace} />
                <MetricsStrip trace={trace} />
                <TokenBar trace={trace} />

                <div className="space-y-3">
                  <SectionLabel>Pipeline Flow</SectionLabel>
                  <PipelineFlow spans={trace.spans} traceTotalMs={trace.total_ms} />
                </div>

                {trace.prompt && (
                  <div className="space-y-1.5">
                    <SectionLabel>Prompt</SectionLabel>
                    <MessageBubble text={trace.prompt} variant="default" />
                  </div>
                )}

                {trace.response && (
                  <div className="space-y-1.5">
                    <SectionLabel>Response</SectionLabel>
                    <MessageBubble text={trace.response} variant="response" />
                  </div>
                )}

                {trace.attack_label && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/[0.07] border border-orange-500/20">
                    <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-orange-300">{trace.attack_label}</div>
                      <div className="text-[10px] text-orange-500/70 mt-0.5">{trace.attack_severity} severity</div>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 uppercase">
                      {trace.attack_severity}
                    </span>
                  </div>
                )}

                <RawJsonToggle data={trace} />
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
