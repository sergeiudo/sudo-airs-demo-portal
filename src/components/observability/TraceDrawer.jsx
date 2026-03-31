// src/components/observability/TraceDrawer.jsx
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldX, ShieldCheck, Zap, AlertTriangle, ChevronDown } from 'lucide-react'

const SPAN_COLORS = {
  user_prompt_received: { bar: 'bg-slate-500',   text: 'text-slate-400',   label: 'User Prompt' },
  airs_input_scan:      { bar: 'bg-emerald-500',  text: 'text-emerald-400', label: 'AIRS Input Scan' },
  llm_inference:        { bar: 'bg-blue-500',     text: 'text-blue-400',    label: 'LLM Inference' },
  airs_output_scan:     { bar: 'bg-violet-500',   text: 'text-violet-400',  label: 'AIRS Output Scan' },
  response_delivered:   { bar: 'bg-teal-500',     text: 'text-teal-400',    label: 'Response Delivered' },
}

function SpanWaterfall({ spans }) {
  if (!spans?.length) return null
  const totalMs = spans.reduce((max, s) => Math.max(max, s.end_ms), 1)

  return (
    <div className="space-y-2">
      {spans.map(span => {
        const cfg    = SPAN_COLORS[span.name] ?? { bar: 'bg-slate-600', text: 'text-slate-400', label: span.name }
        const left   = totalMs > 0 ? (span.start_ms / totalMs) * 100 : 0
        const width  = totalMs > 0 ? Math.max((span.latency_ms / totalMs) * 100, span.latency_ms > 0 ? 1 : 0) : 0
        const isBlocked = span.status === 'blocked'

        return (
          <div key={span.id} className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.bar} ${isBlocked ? 'ring-1 ring-red-500' : ''}`} />
                <span className={`font-semibold ${cfg.text}`}>{cfg.label}</span>
                {isBlocked && <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-[8px] font-bold"><AlertTriangle size={7} />BLOCKED</span>}
              </div>
              <span className="font-mono text-slate-500">{span.latency_ms > 0 ? `${span.latency_ms}ms` : '—'}</span>
            </div>
            {/* Waterfall bar */}
            <div className="h-4 rounded bg-white/[0.04] relative overflow-hidden">
              {span.latency_ms > 0 && (
                <motion.div
                  className={`absolute top-0 h-full rounded ${cfg.bar} opacity-70`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              )}
            </div>
          </div>
        )
      })}
      {/* Total row */}
      <div className="flex items-center justify-between text-[10px] pt-2 border-t border-white/[0.06]">
        <span className="text-slate-600 font-semibold">Total round-trip</span>
        <span className="font-mono font-bold text-slate-300">{totalMs}ms</span>
      </div>
    </div>
  )
}

export function TraceDrawer({ traceId, onClose }) {
  const [trace, setTrace] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    if (!traceId) return
    setTrace(null)
    setShowRaw(false)
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
          className="fixed top-0 right-0 bottom-0 w-[480px] bg-slate-950 border-l border-white/10 z-50 flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08] flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-300">Trace Detail</div>
              <div className="text-[9px] font-mono text-slate-600 truncate mt-0.5">{traceId}</div>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center transition-colors">
              <X size={12} className="text-slate-400" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {loading && <div className="text-center text-slate-600 text-sm py-8">Loading trace...</div>}
            {!loading && trace && (
              <>
                {/* Verdict hero */}
                <div className={`p-4 rounded-xl border ${trace.verdict === 'BLOCKED' ? 'bg-red-500/10 border-red-500/30' : trace.verdict === 'ALLOWED' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.04] border-white/[0.08]'}`}>
                  <div className="flex items-center gap-3">
                    {trace.verdict === 'BLOCKED' ? <ShieldX size={20} className="text-red-400" /> : trace.verdict === 'ALLOWED' ? <ShieldCheck size={20} className="text-emerald-400" /> : <Zap size={20} className="text-slate-400" />}
                    <div>
                      <div className={`text-sm font-bold ${trace.verdict === 'BLOCKED' ? 'text-red-300' : trace.verdict === 'ALLOWED' ? 'text-emerald-300' : 'text-slate-300'}`}>{trace.verdict}</div>
                      <div className="text-[10px] text-slate-500">{trace.category} · {trace.backend} · {new Date(trace.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  {trace.threats_detected?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {trace.threats_detected.map(t => (
                        <span key={t} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-[9px] font-bold text-red-300 uppercase tracking-wide">
                          <AlertTriangle size={7} />{t.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prompt */}
                <div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-wider font-bold mb-2">Prompt</div>
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 leading-relaxed max-h-28 overflow-y-auto">{trace.prompt}</div>
                </div>

                {/* Span waterfall */}
                <div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-wider font-bold mb-3">Pipeline Trace</div>
                  <SpanWaterfall spans={trace.spans} />
                </div>

                {/* Attack meta */}
                {trace.attack_label && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/[0.07] border border-orange-500/20">
                    <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-orange-300">{trace.attack_label}</div>
                      <div className="text-[10px] text-orange-500/70">{trace.attack_severity} severity</div>
                    </div>
                  </div>
                )}

                {/* Raw JSON toggle */}
                <div>
                  <button
                    onClick={() => setShowRaw(v => !v)}
                    className="flex items-center gap-2 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    <motion.div animate={{ rotate: showRaw ? 180 : 0 }} transition={{ duration: 0.18 }}>
                      <ChevronDown size={12} />
                    </motion.div>
                    Raw JSON
                  </button>
                  {showRaw && (
                    <pre className="mt-2 p-3 rounded-lg bg-black/40 border border-white/[0.06] text-[9px] text-slate-500 overflow-auto max-h-48">
                      {JSON.stringify(trace, null, 2)}
                    </pre>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
