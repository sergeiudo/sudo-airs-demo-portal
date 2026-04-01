import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, Activity, Cpu, Hash,
  Zap, ArrowDownToLine, ArrowUpFromLine,
  AlertTriangle, CheckCircle2, ShieldX, ShieldCheck,
  Layers, FileCode, Clock, History, Copy,
} from 'lucide-react'
import { CodeBlock } from '../shared/CodeBlock'
import { SDK_SNIPPETS } from '../../data/mockData'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'
import { useAppContext } from '../../context/AppContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n, unit = '') {
  if (n == null) return '—'
  return `${n.toLocaleString()}${unit}`
}

// ─── Collapsible section ──────────────────────────────────────────────────────
function Section({ title, icon: Icon, iconColor = 'text-slate-500', children, defaultOpen = true, badge, badgeColor = 'bg-white/10 text-slate-400' }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors group"
      >
        <div className={`w-5 h-5 rounded-md flex items-center justify-center bg-white/[0.06] flex-shrink-0`}>
          <Icon size={11} className={iconColor} />
        </div>
        <span className="flex-1 text-[11px] font-bold text-slate-300 tracking-wide">{title}</span>
        {badge != null && (
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
        )}
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown size={11} className="text-slate-700 group-hover:text-slate-500 transition-colors" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'text-slate-200', icon: Icon, wide = false }) {
  return (
    <div className={`flex flex-col gap-1 p-3 rounded-xl bg-black/30 border border-white/[0.08] hover:border-white/[0.14] transition-colors ${wide ? 'col-span-2' : ''}`}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={10} className="text-slate-600" />}
        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <span className={`text-base font-bold font-mono leading-none ${color}`}>{value ?? '—'}</span>
      {sub && <span className="text-[9px] text-slate-600">{sub}</span>}
    </div>
  )
}

// ─── Token bar ────────────────────────────────────────────────────────────────
function TokenBar({ tokensIn, tokensOut }) {
  const total = (tokensIn ?? 0) + (tokensOut ?? 0)
  if (!total) return null
  const inPct  = total ? ((tokensIn  ?? 0) / total) * 100 : 0
  const outPct = total ? ((tokensOut ?? 0) / total) * 100 : 0

  return (
    <div className="space-y-1.5">
      <div className="flex h-3 rounded-full overflow-hidden bg-white/5 gap-px">
        <motion.div
          className="bg-blue-500/70 flex items-center justify-center"
          initial={{ width: 0 }}
          animate={{ width: `${inPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {inPct > 15 && <span className="text-[8px] text-blue-200 font-bold">{tokensIn}</span>}
        </motion.div>
        <motion.div
          className="bg-violet-500/70 flex items-center justify-center"
          initial={{ width: 0 }}
          animate={{ width: `${outPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        >
          {outPct > 15 && <span className="text-[8px] text-violet-200 font-bold">{tokensOut}</span>}
        </motion.div>
      </div>
      <div className="flex items-center gap-3 text-[9px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500/70 inline-block" />Input {tokensIn ?? '—'} tok</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500/70 inline-block" />Output {tokensOut ?? '—'} tok</span>
        <span className="ml-auto font-mono font-semibold text-slate-400">{total} total</span>
      </div>
    </div>
  )
}

// ─── Timing waterfall ─────────────────────────────────────────────────────────
function TimingWaterfall({ timing }) {
  const total = timing?.total_ms || 1
  const segments = [
    { key: 'airs_input_scan_ms',  label: 'AIRS Input Scan',   color: 'bg-emerald-500', textColor: 'text-emerald-400' },
    { key: 'llm_ms',              label: 'LLM Inference',      color: 'bg-blue-500',    textColor: 'text-blue-400' },
    { key: 'airs_output_scan_ms', label: 'AIRS Output Scan',   color: 'bg-violet-500',  textColor: 'text-violet-400' },
  ].filter(s => timing?.[s.key] != null && timing[s.key] > 0)

  if (!segments.length) {
    const llm = timing?.llm_ms
    if (!llm) return null
    return (
      <div className="space-y-2">
        <div className="flex h-4 rounded-lg overflow-hidden bg-white/5">
          <motion.div className="bg-blue-500/70 rounded-lg" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 0.6 }} />
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-blue-400 font-mono">{llm}ms LLM</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* Stacked bar */}
      <div className="flex h-4 rounded-lg overflow-hidden bg-white/5 gap-px">
        {segments.map(s => (
          <motion.div
            key={s.key}
            className={`${s.color} opacity-80 flex items-center justify-center`}
            initial={{ width: 0 }}
            animate={{ width: `${(timing[s.key] / total) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            {(timing[s.key] / total) > 0.15 && (
              <span className="text-[8px] text-white font-bold">{timing[s.key]}ms</span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Per-phase rows */}
      <div className="space-y-1.5">
        {segments.map(s => {
          const pct = Math.round((timing[s.key] / total) * 100)
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.color}`} />
              <span className="text-[10px] text-slate-500 flex-1">{s.label}</span>
              <span className={`text-[10px] font-mono font-bold ${s.textColor}`}>{timing[s.key]}ms</span>
              <span className="text-[9px] text-slate-700 w-7 text-right">{pct}%</span>
            </div>
          )
        })}
        <div className="flex items-center gap-2 pt-1 border-t border-white/8">
          <Clock size={9} className="text-slate-600 flex-shrink-0" />
          <span className="text-[10px] text-slate-500 flex-1">Total round-trip</span>
          <span className="text-[10px] font-mono font-bold text-slate-200">{total}ms</span>
        </div>
      </div>
    </div>
  )
}

// ─── Detection flag grid ──────────────────────────────────────────────────────
function DetectionGrid({ detected, label }) {
  if (!detected || !Object.keys(detected).length) return null
  const entries = Object.entries(detected)
  const triggered = entries.filter(([, v]) => v)
  const allClear = triggered.length === 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">{label}</span>
        {allClear
          ? <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400"><CheckCircle2 size={9} />All clear</span>
          : <span className="flex items-center gap-1 text-[9px] font-bold text-red-400"><AlertTriangle size={9} />{triggered.length} triggered</span>
        }
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {entries.map(([key, val]) => (
          <div
            key={key}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[10px] font-semibold transition-colors ${
              val
                ? 'border-red-500/50 bg-red-500/15 text-red-300 shadow-sm shadow-red-500/10'
                : 'border-white/[0.06] bg-white/[0.02] text-slate-700'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${val ? 'bg-red-400' : 'bg-slate-800'}`} />
            <span className="truncate">{key.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── IDs card ─────────────────────────────────────────────────────────────────
function IdsCard({ scan }) {
  if (!scan) return null
  const fields = [
    { label: 'scan_id',    value: scan.scan_id },
    { label: 'report_id',  value: scan.report_id },
    { label: 'tr_id',      value: scan.tr_id },
    { label: 'profile_id', value: scan.profile_id },
  ].filter(f => f.value)

  return (
    <div className="rounded-xl bg-black/30 border border-white/8 overflow-hidden">
      {fields.map(({ label, value }, i) => (
        <div key={label} className={`flex gap-2 px-3 py-2 ${i < fields.length - 1 ? 'border-b border-white/6' : ''}`}>
          <span className="text-[9px] text-slate-600 w-16 flex-shrink-0 pt-0.5">{label}</span>
          <span className="text-[9px] font-mono text-slate-400 break-all leading-relaxed">{value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Scan result block ────────────────────────────────────────────────────────
function ScanBlock({ scan, type }) {
  if (!scan) return <p className="text-[10px] text-slate-700 py-2">No {type} scan performed</p>

  const detected = type === 'input' ? scan.prompt_detected : scan.response_detected
  const details  = type === 'input' ? scan.prompt_detection_details : scan.response_detection_details
  const masked   = type === 'input' ? scan.prompt_masked_data : scan.response_masked_data
  const procMs   = scan.completed_at && scan.created_at
    ? new Date(scan.completed_at) - new Date(scan.created_at)
    : scan.latency_ms

  return (
    <div className="space-y-3">
      {/* Mini verdict grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'Category', value: scan.category, accent: scan.category === 'malicious' },
          { label: 'Action',   value: scan.action,   accent: scan.action === 'block' },
        ].map(({ label, value, accent }) => (
          <div key={label} className={`text-center p-2.5 rounded-xl border ${
            accent ? 'bg-red-500/10 border-red-500/30' :
            (value === 'allow' || value === 'benign') ? 'bg-emerald-500/10 border-emerald-500/30' :
            'bg-white/[0.04] border-white/[0.08]'
          }`}>
            <div className={`text-xs font-bold font-mono ${accent ? 'text-red-400' : value === 'allow' || value === 'benign' ? 'text-emerald-400' : 'text-slate-300'}`}>
              {value}
            </div>
            <div className="text-[8px] text-slate-600 mt-0.5 uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-2 gap-1.5 text-[9px]">
        {[['Created', scan.created_at], ['Completed', scan.completed_at]].filter(([, v]) => v).map(([label, value]) => (
          <div key={label} className="p-2 rounded-lg bg-white/[0.03] border border-white/6">
            <div className="text-slate-600 mb-0.5">{label}</div>
            <div className="font-mono text-slate-400 break-all">{new Date(value).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>

      {/* Detection flags */}
      {detected && <DetectionGrid detected={detected} label={type === 'input' ? 'Prompt classifier results' : 'Response classifier results'} />}

      {masked && (
        <div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold mb-1.5">Masked Data</div>
          <CodeBlock code={masked} language="json" maxHeight="100px" />
        </div>
      )}
      {details && (
        <div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold mb-1.5">Detection Details</div>
          <CodeBlock code={details} language="json" maxHeight="140px" />
        </div>
      )}
    </div>
  )
}

// ─── Recent Traces mini-list ───────────────────────────────────────────────────
function RecentTraces() {
  const { dispatch } = useAppContext()
  const [traces, setTraces] = React.useState([])

  React.useEffect(() => {
    const load = () =>
      fetch('/api/traces?limit=5')
        .then(r => r.ok ? r.json() : { traces: [] })
        .then(d => setTraces(d.traces ?? []))
        .catch(() => {})
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [])

  if (!traces.length) return (
    <p className="text-[10px] text-slate-700 py-2 text-center">No traces yet</p>
  )

  const goToTrace = (traceId) => {
    dispatch({ type: 'SET_SELECTED_TRACE', payload: traceId })
    dispatch({ type: 'SET_VIEW', payload: 'observability' })
  }

  return (
    <div className="space-y-1">
      {traces.slice(0, 5).map(t => (
        <button
          key={t.id}
          onClick={() => goToTrace(t.id)}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors group text-left"
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.verdict === 'BLOCKED' ? 'bg-red-500' : t.verdict === 'ALLOWED' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
          <span className="flex-1 text-[10px] text-slate-500 truncate group-hover:text-slate-400 transition-colors">
            {t.attack_label ?? t.prompt?.slice(0, 32) ?? '—'}
          </span>
          <span className="text-[9px] font-mono text-slate-700">{t.total_ms != null ? `${t.total_ms}ms` : ''}</span>
        </button>
      ))}
      <button
        onClick={() => dispatch({ type: 'SET_VIEW', payload: 'observability' })}
        className="w-full text-center text-[9px] text-teal-600 hover:text-teal-400 transition-colors pt-1"
      >
        View all in Observability →
      </button>
    </div>
  )
}

// ─── Inline trace components (same as PromptTelemetryDrawer, no drawer chrome) ─

function SbCopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }
  return (
    <button onClick={copy} className="ml-1 text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0" title="Copy">
      {copied ? <span className="text-[8px] text-emerald-400">✓</span> : <Copy size={10} />}
    </button>
  )
}

const SB_SPAN_CFG = {
  user_prompt_received: { label: 'User Prompt', icon: '👤', dotBg: 'bg-slate-100 border-slate-300', bar: 'bg-slate-400', text: 'text-slate-600', cardBg: 'bg-white/[0.06] border-white/[0.10]', line: '#94a3b8', badge: 'received', detail: () => 'Message sent to the protected LLM endpoint' },
  airs_input_scan:      { label: 'AIRS Input Scan', icon: '🔍', dotBg: 'bg-emerald-50 border-emerald-300', bar: 'bg-emerald-500', text: 'text-emerald-600', cardBg: 'bg-emerald-500/[0.06] border-emerald-500/20', line: '#34d399', badge: null, detail: (s) => { const m = s.metadata ?? {}; const p = []; if (m.action) p.push(`action: ${m.action}`); if (m.category) p.push(m.category); if (m.scan_id) p.push(`scan: ${m.scan_id.slice(0, 8)}…`); return p.join(' · ') || 'Prompt scanned · Prisma AIRS' } },
  llm_inference:        { label: 'LLM Inference', icon: '🤖', dotBg: 'bg-blue-50 border-blue-300', bar: 'bg-blue-500', text: 'text-blue-600', cardBg: 'bg-blue-500/[0.06] border-blue-500/20', line: '#60a5fa', badge: null, detail: (s) => { const m = s.metadata ?? {}; const p = []; if (m.model) p.push(m.model); if (m.tokens_in != null && m.tokens_out != null) p.push(`${m.tokens_in} in / ${m.tokens_out} out tokens`); return p.join(' · ') || 'LLM processing' } },
  airs_output_scan:     { label: 'AIRS Output Scan', icon: '🔍', dotBg: 'bg-violet-50 border-violet-300', bar: 'bg-violet-500', text: 'text-violet-600', cardBg: 'bg-violet-500/[0.06] border-violet-500/20', line: '#a78bfa', badge: null, detail: (s) => { const m = s.metadata ?? {}; const p = []; if (m.action) p.push(`action: ${m.action}`); if (m.category) p.push(m.category); return p.join(' · ') || 'Response scanned · Prisma AIRS' } },
  response_delivered:   { label: 'Response Delivered', icon: '✅', dotBg: 'bg-teal-50 border-teal-300', bar: 'bg-teal-500', text: 'text-teal-600', cardBg: 'bg-teal-500/[0.06] border-teal-500/20', line: '#14b8a6', badge: null, detail: (s) => s.status === 'blocked' ? 'Blocked — response suppressed' : 'Clean response returned to user' },
}

function SbFlowNode({ span, totalMs, isLast }) {
  const cfg = SB_SPAN_CFG[span.name] ?? { label: span.name, icon: '●', dotBg: 'bg-slate-100 border-slate-300', bar: 'bg-slate-400', text: 'text-slate-600', cardBg: 'bg-white/[0.06] border-white/[0.10]', line: '#94a3b8', badge: null, detail: () => '' }
  const isBlocked = span.status === 'blocked'
  const barPct = totalMs > 0 && span.latency_ms > 0 ? Math.max((span.latency_ms / totalMs) * 100, 2) : 0
  const detail = typeof cfg.detail === 'function' ? cfg.detail(span) : cfg.detail
  return (
    <div className="flex gap-3 items-stretch">
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 44 }}>
        <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-lg flex-shrink-0 z-10 ${cfg.dotBg} ${isBlocked ? 'ring-2 ring-red-400' : ''}`}>{cfg.icon}</div>
        {!isLast && <div className="w-0.5 flex-1 mt-1" style={{ background: cfg.line, opacity: 0.4, minHeight: 16 }} />}
      </div>
      <div className={`flex-1 mb-3 p-3 rounded-xl border ${cfg.cardBg}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[12px] font-bold ${cfg.text}`}>{cfg.label}</span>
              {cfg.badge && <span className="text-[10px] text-slate-400">{cfg.badge}</span>}
              {isBlocked && <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 border border-red-300 text-slate-900 text-[8px] font-black"><AlertTriangle size={7} />BLOCKED</span>}
            </div>
            {detail && <div className="text-[11px] text-slate-400 mt-1 leading-relaxed font-medium">{detail}</div>}
            {span.metadata?.scan_id && (
              <span className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] font-mono text-slate-500 truncate">{span.metadata.scan_id.slice(0, 16)}…</span>
                <SbCopyButton text={span.metadata.scan_id} />
              </span>
            )}
          </div>
          {span.latency_ms > 0 && <span className={`text-[11px] font-mono font-bold flex-shrink-0 ${cfg.text}`}>{span.latency_ms.toLocaleString()}ms</span>}
        </div>
        {barPct > 0 && (
          <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden mt-2.5">
            <motion.div className={`h-full rounded-full ${cfg.bar} opacity-70`} initial={{ width: 0 }} animate={{ width: `${barPct}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} />
          </div>
        )}
      </div>
    </div>
  )
}

function SbVerdictBanner({ trace }) {
  const isBlocked = trace.verdict === 'BLOCKED'
  const isDirect  = trace.verdict === 'DIRECT'
  const styles = isBlocked
    ? { wrap: 'bg-red-500/10 border-red-500/30', icon: <ShieldX size={22} className="text-red-400" />, iconBg: 'bg-red-500/20', text: 'text-red-300', badge: 'bg-red-500/20 border-red-500/30 text-red-400' }
    : isDirect
    ? { wrap: 'bg-white/[0.04] border-white/[0.08]', icon: <Zap size={22} className="text-slate-400" />, iconBg: 'bg-white/[0.06]', text: 'text-slate-300', badge: 'bg-white/[0.06] border-white/[0.08] text-slate-500' }
    : { wrap: 'bg-emerald-500/10 border-emerald-500/30', icon: <ShieldCheck size={22} className="text-emerald-400" />, iconBg: 'bg-emerald-500/20', text: 'text-emerald-300', badge: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' }
  return (
    <div className={`p-4 rounded-2xl border ${styles.wrap}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${styles.iconBg}`}>{styles.icon}</div>
        <div className="flex-1 min-w-0">
          <div className={`text-base font-black tracking-wide ${styles.text}`}>{trace.verdict}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate font-medium">
            {trace.backend} · {trace.model ?? trace.backend}{trace.profile ? ` · ${trace.profile}` : ''}
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${styles.badge}`}>{trace.category?.toUpperCase() ?? 'UNKNOWN'}</span>
      </div>
      {trace.threats_detected?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/[0.06]">
          {trace.threats_detected.map(t => (
            <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 border border-red-300 text-[9px] font-black text-slate-900 uppercase tracking-wide">
              <AlertTriangle size={7} />{t.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SbMetricsStrip({ trace }) {
  const airsMs = (trace.airs_input_ms ?? 0) + (trace.airs_output_ms ?? 0)
  const cards = [
    { label: 'Total Time',    value: trace.total_ms, sub: 'end-to-end',  color: 'text-slate-300',   icon: Clock },
    { label: 'LLM Latency',  value: trace.llm_ms,   sub: 'inference',   color: 'text-blue-400',    icon: Cpu },
    ...(airsMs > 0 ? [{ label: 'AIRS Overhead', value: airsMs, sub: 'total scans', color: 'text-emerald-400', icon: Activity }] : []),
  ].filter(c => c.value != null)
  if (!cards.length) return null
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cards.length}, 1fr)` }}>
      {cards.map(({ label, value, sub, color, icon: Icon }) => (
        <div key={label} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
          <div className="flex items-center gap-1.5 mb-1.5"><Icon size={11} className={color} /><span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{label}</span></div>
          <div className={`text-xl font-black font-mono leading-none ${color}`}>{value.toLocaleString()}<span className="text-xs font-normal text-slate-500 ml-1">ms</span></div>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">{sub}</div>
        </div>
      ))}
    </div>
  )
}

function SbTokenBar({ trace }) {
  const { tokens_in, tokens_out, llm_ms } = trace
  if (tokens_in == null && tokens_out == null) return null
  const total  = (tokens_in ?? 0) + (tokens_out ?? 0)
  const inPct  = total > 0 ? ((tokens_in ?? 0) / total) * 100 : 0
  const outPct = total > 0 ? ((tokens_out ?? 0) / total) * 100 : 0
  const tps    = (tokens_out && llm_ms) ? Math.round((tokens_out / llm_ms) * 1000) : null
  return (
    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-slate-400">Token distribution</span>
        <div className="flex items-center gap-2"><span className="text-[11px] font-mono font-bold text-slate-300">{total.toLocaleString()} total</span>{tps != null && <span className="text-[10px] font-bold text-slate-500">{tps} tok/s</span>}</div>
      </div>
      <div className="flex h-3 rounded-lg overflow-hidden bg-black/[0.06] gap-px">
        <motion.div className="bg-blue-500/80" initial={{ width: 0 }} animate={{ width: `${inPct}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
        <motion.div className="bg-violet-500/80" initial={{ width: 0 }} animate={{ width: `${outPct}%` }} transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }} />
      </div>
      <div className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />{tokens_in ?? '—'} input</span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" />{tokens_out ?? '—'} output</span>
      </div>
    </div>
  )
}

function SbSectionLabel({ children }) {
  return <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 pt-3 pb-1">{children}</div>
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function TelemetrySidebar({ telemetry }) {
  const [sdkTab, setSdkTab] = useState('python')
  const [trace, setTrace]   = useState(null)
  const theme = useProtectionTheme()
  const traceId = telemetry?.trace_id ?? null

  useEffect(() => {
    if (!traceId) { setTrace(null); return }
    fetch(`/api/traces/${traceId}`)
      .then(r => r.json())
      .then(setTrace)
      .catch(console.error)
  }, [traceId])

  const totalMs = trace?.total_ms ?? 0

  return (
    <div className="flex flex-col h-full overflow-hidden border-l border-white/10 bg-base-900">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
        <Activity size={14} className={theme.primaryText} />
        <span className="text-xs font-semibold text-slate-300">Prompt Telemetry</span>
        {trace && (
          <motion.span
            key={trace.verdict}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`ml-auto flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
              trace.verdict === 'BLOCKED'
                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                : trace.verdict === 'DIRECT'
                ? 'bg-slate-800 text-slate-500 border-slate-700'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            }`}
          >
            {trace.verdict === 'BLOCKED' ? <ShieldX size={10} /> : trace.verdict === 'DIRECT' ? <Zap size={10} /> : <ShieldCheck size={10} />}
            {trace.verdict}
          </motion.span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Empty */}
        {!telemetry && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8 py-16">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
              <Activity size={28} className="text-slate-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Waiting for scan data</p>
              <p className="text-[11px] text-slate-700 mt-1.5 leading-relaxed">Send a message to capture<br/>live AIRS telemetry</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {telemetry && !trace && (
          <div className="flex items-center justify-center py-12 text-slate-600 text-sm">Loading…</div>
        )}

        {/* Trace content */}
        {trace && (
          <div className="space-y-0">
            <div className="px-4 pt-4 space-y-3">
              <SbVerdictBanner trace={trace} />

              {(trace.model || trace.backend) && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] w-fit">
                  <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-400">
                    {trace.model && trace.model !== trace.backend
                      ? `${trace.model} · ${trace.backend === 'vertex' ? 'Vertex AI' : trace.backend === 'bedrock' ? 'AWS Bedrock' : trace.backend}`
                      : trace.backend}
                  </span>
                </div>
              )}
            </div>

            {/* Performance Metrics */}
            <SbSectionLabel>Performance Metrics</SbSectionLabel>
            <div className="px-4 pb-3"><SbMetricsStrip trace={trace} /></div>

            {/* Token Usage */}
            <SbSectionLabel>Token Usage</SbSectionLabel>
            <div className="px-4 pb-3"><SbTokenBar trace={trace} /></div>

            {/* Pipeline Flow */}
            <SbSectionLabel>Pipeline Flow</SbSectionLabel>
            <div className="px-4 pb-3">
              {trace.spans?.length > 0 && (
                <div>
                  {trace.spans.map((span, i) => (
                    <SbFlowNode key={span.id ?? `${span.name}-${i}`} span={span} totalMs={totalMs} isLast={i === trace.spans.length - 1} />
                  ))}
                  <div className="flex items-center justify-between text-[11px] pt-3 mt-1 border-t border-white/[0.08]">
                    <span className="text-slate-400 font-bold">Total round-trip</span>
                    <span className="font-mono font-bold text-slate-300">{totalMs.toLocaleString()}ms</span>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt */}
            {trace.prompt && (
              <>
                <SbSectionLabel>Prompt</SbSectionLabel>
                <div className="px-4 pb-3">
                  <div className="p-3 rounded-xl border bg-white/[0.03] border-white/[0.06] text-xs text-slate-400 font-mono leading-relaxed">
                    <div className="overflow-y-auto max-h-[140px] pr-1 whitespace-pre-wrap break-words">{trace.prompt}</div>
                  </div>
                </div>
              </>
            )}

            {/* Attack label */}
            {trace.attack_label && (
              <div className="px-4 pb-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/[0.07] border border-orange-500/20">
                  <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-orange-300">{trace.attack_label}</div>
                    <div className="text-[10px] text-orange-500/70 mt-0.5">{trace.attack_severity} severity</div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 uppercase">{trace.attack_severity}</span>
                </div>
              </div>
            )}

            <div className="border-t border-white/[0.06] mt-2" />
          </div>
        )}

        {/* ── Dev Corner ── */}
        {telemetry && (
          <Section title="Dev Corner" icon={FileCode} iconColor="text-yellow-400" defaultOpen={false}>
            <div className="flex gap-1 mb-3 p-1 bg-black/30 rounded-lg border border-white/10">
              {['python', 'node'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setSdkTab(tab)}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold transition-all duration-150 ${
                    sdkTab === tab
                      ? `${theme.primaryBg2} ${theme.primaryText} border ${theme.primaryBorder2}`
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  {tab === 'python' ? 'Python' : 'Node.js'}
                </button>
              ))}
            </div>
            <CodeBlock
              code={SDK_SNIPPETS[sdkTab]}
              language={sdkTab === 'python' ? 'python' : 'javascript'}
              maxHeight="260px"
            />
          </Section>
        )}

        {/* ── Recent Traces ── */}
        <Section title="Recent Traces" icon={History} iconColor="text-teal-400" defaultOpen={false}>
          <RecentTraces />
        </Section>

      </div>
    </div>
  )
}
