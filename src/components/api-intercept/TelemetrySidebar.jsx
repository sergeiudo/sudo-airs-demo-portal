import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, Activity, Cpu, Hash,
  Zap, ArrowDownToLine, ArrowUpFromLine,
  AlertTriangle, CheckCircle2, ShieldX, ShieldCheck,
  Layers, FileCode, Clock, History, Copy,
  FileJson, ShieldAlert,
} from 'lucide-react'
import { CodeBlock } from '../shared/CodeBlock'
import { DEV_CORNER_TABS } from '../../data/mockData'
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
        </div>
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

// ─── MCP tool name inference from attack label ────────────────────────────────
const MCP_LABEL_TO_TOOL = {
  'Path Traversal via Agent':      'read_file',
  'OS Command Execution via Agent': 'execute_code',
  'Persistent Memory Poisoning':   'set_memory',
  'Tool Shadowing / Override':     'set_memory',
  'PII Exfiltration via File Read': 'read_file',
}

function isMcpAttack(telemetry) {
  const label = telemetry?.attackMeta?.label ?? ''
  const tech  = telemetry?.attackMeta?.technique ?? ''
  return MCP_LABEL_TO_TOOL[label] != null || tech.toLowerCase().includes('tool') || tech.toLowerCase().includes('memory store')
}

// ─── SCM-style Transaction Metadata card ─────────────────────────────────────
function ScmTransactionCard({ trace, telemetry, isDark }) {
  const isMcp = isMcpAttack(telemetry)
  const inputScan = telemetry?.inputScan

  const fields = [
    { label: 'Session ID', value: inputScan?.tr_id ?? trace.id, mono: true },
    { label: 'Scan ID',    value: inputScan?.scan_id, mono: true },
    { label: 'Profile',    value: inputScan?.profile_name ?? trace.profile },
    { label: 'Model',      value: trace.model ?? trace.backend },
    { label: 'Environment', value: 'dev' },
    { label: 'User ID',    value: 'sudo-airs-demo-portal' },
  ].filter(f => f.value)

  const cardBg     = isDark ? 'rgba(10,15,28,0.7)'      : 'rgba(0,48,135,0.04)'
  const borderCol  = isDark ? 'rgba(255,255,255,0.10)'   : 'rgba(0,48,135,0.12)'
  const dividerCol = isDark ? 'rgba(255,255,255,0.05)'   : 'rgba(0,48,135,0.08)'
  const labelCol   = isDark ? '#475569'                  : '#94a3b8'
  const valueCol   = isDark ? '#cbd5e1'                  : '#1e293b'

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${borderCol}` }}>
      {/* Content type tags */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${dividerCol}` }}>
        <span className="text-[9px] font-bold uppercase tracking-widest mr-1" style={{ color: labelCol }}>Content Type</span>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border" style={{ background: 'rgba(96,165,250,0.12)', borderColor: 'rgba(96,165,250,0.4)', color: '#93c5fd' }}>Prompt</span>
        {isMcp && (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border" style={{ background: 'rgba(20,184,166,0.12)', borderColor: 'rgba(20,184,166,0.4)', color: '#5eead4' }}>Tool</span>
        )}
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-0" style={{ borderColor: dividerCol }}>
        {fields.map(({ label, value, mono }, i) => (
          <div key={label} className="px-3 py-2" style={{
            borderBottom: i < fields.length - 2 ? `1px solid ${dividerCol}` : 'none',
            borderRight: i % 2 === 0 ? `1px solid ${dividerCol}` : 'none',
          }}>
            <div className="text-[9px] uppercase tracking-wide mb-0.5" style={{ color: labelCol }}>{label}</div>
            <div className={`text-[10px] truncate ${mono ? 'font-mono' : 'font-medium'}`} style={{ color: valueCol }} title={value}>
              {mono && value?.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value}
              {mono && value && <SbCopyButton text={value} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MCP Tool Event panel ─────────────────────────────────────────────────────
function McpToolEventPanel({ telemetry, trace, isDark }) {
  const attackLabel = telemetry?.attackMeta?.label ?? trace?.attack_label ?? ''
  const toolName = MCP_LABEL_TO_TOOL[attackLabel] ?? 'mcp_tool'
  const inputScan = telemetry?.inputScan
  const snippet = telemetry?.prompt ?? trace?.prompt ?? ''

  const cardBg      = isDark ? 'rgba(10,25,25,0.7)'       : 'rgba(20,184,166,0.04)'
  const dividerCol  = isDark ? 'rgba(20,184,166,0.15)'     : 'rgba(20,184,166,0.18)'
  const rowDivider  = isDark ? 'rgba(255,255,255,0.04)'    : 'rgba(0,0,0,0.06)'
  const snippetBg   = isDark ? 'rgba(0,0,0,0.4)'          : 'rgba(0,0,0,0.04)'
  const snippetBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,184,166,0.2)'
  const labelCol    = isDark ? '#475569'                   : '#94a3b8'
  const valueCol    = isDark ? '#94a3b8'                   : '#334155'

  const rows = [
    { label: 'Tool Name',  value: toolName },
    { label: 'Direction',  value: 'input' },
    { label: 'Ecosystem',  value: 'mcp' },
    { label: 'Method',     value: 'tools/call' },
    { label: 'Server',     value: 'airs-mcp-demo-server' },
  ]

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: cardBg, border: '1px solid rgba(20,184,166,0.2)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${dividerCol}`, background: 'rgba(20,184,166,0.07)' }}>
        <Layers size={11} className="text-teal-400 flex-shrink-0" />
        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Tool Event</span>
        <span className="ml-auto text-[9px] font-mono text-teal-600">MCP · tools/call</span>
      </div>

      {/* Tool metadata table */}
      <div>
        {rows.map(({ label, value }, i) => (
          <div key={label} className="flex items-center px-3 py-1.5" style={{ borderBottom: i < rows.length - 1 ? `1px solid ${rowDivider}` : 'none' }}>
            <span className="text-[9px] w-20 flex-shrink-0" style={{ color: labelCol }}>{label}</span>
            <span className="text-[10px] font-mono" style={{ color: label === 'Tool Name' ? '#5eead4' : label === 'Ecosystem' ? '#67e8f9' : valueCol, fontWeight: label === 'Tool Name' ? 700 : 400 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Violated snippet */}
      {snippet && (
        <div className="px-3 pb-3 pt-2" style={{ borderTop: `1px solid ${rowDivider}` }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-wide" style={{ color: labelCol }}>Violated snippet</span>
            <SbCopyButton text={snippet} />
          </div>
          <div
            className="rounded-lg p-2 font-mono text-[10px] overflow-y-auto whitespace-pre-wrap break-words leading-relaxed"
            style={{ background: snippetBg, border: `1px solid ${snippetBorder}`, maxHeight: '100px', color: isDark ? '#6ee7b7' : '#0f766e' }}
          >
            {snippet.length > 200 ? snippet.slice(0, 200) + '…' : snippet}
          </div>
        </div>
      )}

      {/* Scan ID badge */}
      {inputScan?.scan_id && (
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderTop: `1px solid ${rowDivider}` }}>
          <span className="text-[9px]" style={{ color: labelCol }}>scan_id</span>
          <span className="text-[9px] font-mono flex-1 truncate" style={{ color: valueCol }}>{inputScan.scan_id}</span>
          <SbCopyButton text={inputScan.scan_id} />
        </div>
      )}
    </div>
  )
}

// ─── SCM-style Threat Snippets panel ─────────────────────────────────────────
function ScmThreatPanel({ trace, telemetry, isDark }) {
  const threats = trace.threats_detected ?? []
  if (!threats.length) return null

  const isMcp = isMcpAttack(telemetry)
  const attackLabel = telemetry?.attackMeta?.label ?? trace.attack_label ?? ''
  const toolName = MCP_LABEL_TO_TOOL[attackLabel] ?? 'mcp_tool'

  const cardBg      = isDark ? 'rgba(10,12,22,0.85)'      : 'rgba(239,68,68,0.03)'
  const dividerCol  = isDark ? 'rgba(255,255,255,0.06)'    : 'rgba(239,68,68,0.10)'
  const subBg       = isDark ? 'rgba(0,0,0,0.3)'           : 'rgba(0,0,0,0.03)'
  const subBorder   = isDark ? 'rgba(255,255,255,0.07)'    : 'rgba(239,68,68,0.12)'
  const snippetCol  = isDark ? '#67e8f9'                   : '#0e7490'
  const labelCol    = isDark ? '#475569'                   : '#94a3b8'
  const threatNameCol = isDark ? '#e2e8f0'                 : '#1e293b'

  const SEV_STYLE = {
    critical: { label: 'Critical', bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  text: '#f87171' },
    high:     { label: 'High',     bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.4)', text: '#fb923c' },
    medium:   { label: 'Medium',   bg: 'rgba(234,179,8,0.15)',  border: 'rgba(234,179,8,0.4)',  text: isDark ? '#facc15' : '#a16207' },
    low:      { label: 'Low',      bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', text: '#94a3b8' },
  }

  const THREAT_META = {
    injection:     { name: 'Prompt Injection',  sev: 'high' },
    agent:         { name: 'Agent Manipulation', sev: 'high' },
    toxic_content: { name: 'Toxic Content',      sev: 'medium' },
    dlp:           { name: 'Data Leakage (DLP)', sev: 'high' },
    url_cats:      { name: 'Malicious URL',      sev: 'medium' },
    jailbreak:     { name: 'Jailbreak',          sev: 'critical' },
  }

  const snippet = telemetry?.prompt ?? trace.prompt ?? ''
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${dividerCol}` }}>
      {/* Header */}
      <div className="px-3 py-2" style={{ borderBottom: `1px solid ${dividerCol}`, background: 'rgba(239,68,68,0.06)' }}>
        <div className="flex items-center gap-2">
          <ShieldX size={11} className="text-red-400 flex-shrink-0" />
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex-1">Threat Snippets</span>
        </div>
        <div className="text-[9px] mt-0.5 font-medium" style={{ color: labelCol }}>Profile: {telemetry?.inputScan?.profile_name ?? trace.profile ?? 'AIRS security profile'}</div>
      </div>

      {threats.map((threatKey, ti) => {
        const meta = THREAT_META[threatKey] ?? { name: threatKey.replace(/_/g, ' '), sev: 'medium' }
        const sevStyle = SEV_STYLE[meta.sev] ?? SEV_STYLE.medium

        return (
          <div key={threatKey} style={{ borderTop: ti > 0 ? `1px solid ${dividerCol}` : 'none' }}>
            <button
              onClick={() => setOpen(v => !v)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-black/[0.03]"
            >
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}>
                <ShieldX size={9} className="text-red-400" />
              </div>
              <span className="flex-1 text-[11px] font-semibold" style={{ color: threatNameCol }}>{meta.name}</span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border" style={{ background: sevStyle.bg, borderColor: sevStyle.border, color: sevStyle.text }}>{sevStyle.label}</span>
              <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
                <ChevronDown size={11} className="text-slate-500" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                  <div className="px-3 pb-3 space-y-2">

                    {/* Prompt violation */}
                    <div className="rounded-lg overflow-hidden" style={{ background: subBg, border: `1px solid ${subBorder}` }}>
                      <div className="flex items-center justify-between px-2.5 py-1.5" style={{ borderBottom: `1px solid ${subBorder}` }}>
                        <span className="text-[9px]" style={{ color: labelCol }}>Prompt · <span className="font-bold" style={{ color: sevStyle.text }}>{sevStyle.label}</span></span>
                        <span className="text-[9px]" style={{ color: labelCol }}>1 prompt has a violation</span>
                      </div>
                      <div className="p-2">
                        <div className="text-[9px] mb-1" style={{ color: labelCol }}>Violated snippet #1</div>
                        <div className="font-mono text-[10px] leading-relaxed" style={{ color: snippetCol }}>
                          {snippet.length > 160 ? snippet.slice(0, 160) + '…' : snippet}
                        </div>
                      </div>
                    </div>

                    {/* MCP Tool violation */}
                    {isMcp && (
                      <div className="rounded-lg overflow-hidden" style={{ background: subBg, border: '1px solid rgba(20,184,166,0.2)' }}>
                        <div className="flex items-center justify-between px-2.5 py-1.5" style={{ borderBottom: '1px solid rgba(20,184,166,0.15)' }}>
                          <span className="text-[9px] text-teal-400 font-semibold">Tool</span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border" style={{ background: 'rgba(148,163,184,0.1)', borderColor: 'rgba(148,163,184,0.3)', color: '#94a3b8' }}>Low</span>
                        </div>
                        <div className="px-2.5 py-2">
                          <div className="text-[9px] mb-2" style={{ color: labelCol }}>1 violation for <span className="font-mono text-teal-400">{toolName}</span></div>
                          <div className="grid grid-cols-5 gap-x-2 mb-2 text-[9px] font-semibold uppercase tracking-wide pb-1" style={{ color: labelCol, borderBottom: `1px solid ${dividerCol}` }}>
                            <span>Tool Name</span><span>Direction</span><span>Ecosystem</span><span>Method</span><span>Server</span>
                          </div>
                          <div className="grid grid-cols-5 gap-x-2 mb-2 text-[10px] font-mono">
                            <span style={{ color: '#5eead4', fontWeight: 700 }}>{toolName}</span>
                            <span style={{ color: isDark ? '#94a3b8' : '#334155' }}>input</span>
                            <span style={{ color: '#67e8f9' }}>mcp</span>
                            <span style={{ color: isDark ? '#94a3b8' : '#334155' }}>tools/call</span>
                            <span className="truncate" style={{ color: isDark ? '#64748b' : '#475569' }} title="airs-mcp-demo-server">airs-mcp-demo-server</span>
                          </div>
                          <div className="text-[9px] mb-1" style={{ color: labelCol }}>Violated snippet #2</div>
                          <div
                            className="rounded p-1.5 font-mono text-[10px] overflow-y-auto whitespace-pre-wrap break-words leading-relaxed"
                            style={{ background: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.04)', border: `1px solid ${dividerCol}`, maxHeight: '80px', color: snippetCol }}
                          >
                            {snippet.length > 120 ? snippet.slice(0, 120) + '…' : snippet}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

// ─── Syntax-highlighted JSON ──────────────────────────────────────────────────
const HIGHLIGHT_KEYS = new Set(['verdict', 'category', 'action', 'blocked', 'threats_detected', 'scan_id', 'tr_id', 'profile_id', 'profile_name'])

function HighlightedJson({ data }) {
  const lines = JSON.stringify(data, null, 2).split('\n')
  return (
    <pre className="font-mono text-[11px] leading-relaxed whitespace-pre">
      {lines.map((line, i) => {
        // key: "value" — split on first colon
        const keyMatch = line.match(/^(\s*)(")([\w_]+)(")(\s*:\s*)(.*)$/)
        if (keyMatch) {
          const [, indent, , key, , colon, rest] = keyMatch
          const isImportant = HIGHLIGHT_KEYS.has(key)
          const keyColor = isImportant ? '#67e8f9' : '#7dd3fc' // cyan-300 : sky-300
          const rendered = renderValue(rest.trimEnd())
          return (
            <span key={i} style={{ display: 'block' }}>
              <span style={{ color: '#64748b' }}>{indent}</span>
              <span style={{ color: keyColor, fontWeight: isImportant ? 700 : 400 }}>"{key}"</span>
              <span style={{ color: '#94a3b8' }}>{colon}</span>
              {rendered}
            </span>
          )
        }
        // structural lines: {, }, [, ], etc.
        return (
          <span key={i} style={{ display: 'block', color: '#94a3b8' }}>{line}</span>
        )
      })}
    </pre>
  )
}

function renderValue(raw) {
  if (raw === 'null,' || raw === 'null') return <span style={{ color: '#94a3b8' }}>{raw}</span>
  if (raw === 'true,' || raw === 'true') return <span style={{ color: '#f472b6', fontWeight: 700 }}>{raw}</span>
  if (raw === 'false,' || raw === 'false') return <span style={{ color: '#f472b6', fontWeight: 700 }}>{raw}</span>
  if (/^-?\d/.test(raw)) return <span style={{ color: '#fb923c' }}>{raw}</span>
  if (raw.startsWith('"')) {
    const trailing = raw.endsWith(',') ? ',' : ''
    const inner = trailing ? raw.slice(0, -1) : raw
    // color special string values
    const val = inner.slice(1, -1)
    const isVerdict = ['BLOCKED', 'ALLOWED', 'DIRECT'].includes(val)
    const isAction  = ['block', 'allow'].includes(val)
    const isMalicious = ['malicious', 'benign'].includes(val)
    const color = isVerdict
      ? (val === 'BLOCKED' ? '#f87171' : val === 'ALLOWED' ? '#34d399' : '#94a3b8')
      : isAction
      ? (val === 'block' ? '#f87171' : '#34d399')
      : isMalicious
      ? (val === 'malicious' ? '#f87171' : '#34d399')
      : '#86efac' // green-300 for normal strings
    return <><span style={{ color, fontWeight: (isVerdict || isAction || isMalicious) ? 700 : 400 }}>{inner}</span><span style={{ color: '#94a3b8' }}>{trailing}</span></>
  }
  // arrays/objects opening brackets on same line
  return <span style={{ color: '#94a3b8' }}>{raw}</span>
}

// ─── Raw AIRS payload viewer block ────────────────────────────────────────────
// Used for both the verbatim sync scan response and the detailed threat report.
function AirsRawBlock({ heading, sublabel, data, emptyMsg = 'No data', maxHeight = '360px' }) {
  if (!data) {
    return (
      <div className="text-[10px] text-slate-600 italic px-1 py-2">{emptyMsg}</div>
    )
  }
  const json = JSON.stringify(data, null, 2)
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{heading}</span>
          {sublabel && <span className="text-[9px] text-slate-600 font-mono truncate">{sublabel}</span>}
        </div>
        <SbCopyButton text={json} />
      </div>
      <div
        className="rounded-xl overflow-auto"
        style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.10)', maxHeight }}
      >
        <div className="p-3">
          <HighlightedJson data={data} />
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function TelemetrySidebar({ telemetry }) {
  const [sdkTab, setSdkTab] = useState('python')
  const [trace, setTrace]   = useState(null)
  const theme = useProtectionTheme()
  const { state } = useAppContext()
  const isDark = state.isDark !== false  // default dark
  const traceId    = telemetry?.trace_id ?? null
  const isMcpInvoke = !!telemetry?.isMcpInvoke

  useEffect(() => {
    // MCP invoke path — no DB trace, build a synthetic trace from telemetry directly
    if (isMcpInvoke && telemetry) {
      const s1 = telemetry.stage1 ?? null
      const s2 = telemetry.stage2 ?? null
      const threats = Object.entries(s1?.prompt_detected ?? s2?.response_detected ?? {})
        .filter(([, v]) => v).map(([k]) => k)
      const verdict = telemetry.blocked ? 'BLOCKED' : s1 ? 'ALLOWED' : 'DIRECT'
      const totalMs = (s1?.latencyMs ?? 0) + (s2?.latencyMs ?? 0)

      // Build spans for Pipeline Flow
      const spans = []
      spans.push({ id: 'recv', name: 'user_prompt_received', latency_ms: 0, status: 'success', metadata: null })
      if (s1) spans.push({ id: 'stage1', name: 'airs_input_scan', latency_ms: s1.latencyMs, status: s1.action === 'block' ? 'blocked' : 'success', metadata: { action: s1.action, category: s1.category, scan_id: s1.scan_id } })
      if (s2) spans.push({ id: 'stage2', name: 'airs_output_scan', latency_ms: s2.latencyMs, status: s2.action === 'block' ? 'blocked' : 'success', metadata: { action: s2.action, category: s2.category, scan_id: s2.scan_id } })
      spans.push({ id: 'done', name: 'response_delivered', latency_ms: 0, status: telemetry.blocked ? 'blocked' : 'success', metadata: null })

      setTrace({
        id: s1?.trId ?? `mcp-${Date.now()}`,
        verdict,
        category: (s1 ?? s2)?.category ?? 'unknown',
        threats_detected: threats,
        backend: 'mcp',
        model: `${telemetry.tool ?? 'tool'} · airs-mcp-demo-server`,
        profile: telemetry.inputScan?.profile_name ?? null,
        total_ms: totalMs || null,
        airs_input_ms: s1?.latencyMs ?? null,
        airs_output_ms: s2?.latencyMs ?? null,
        llm_ms: null,
        tokens_in: null,
        tokens_out: null,
        prompt: telemetry.prompt ?? null,
        attack_label: telemetry.attackMeta?.label ?? null,
        attack_severity: telemetry.attackMeta?.severity ?? null,
        spans,
      })
      return
    }
    if (!traceId) { setTrace(null); return }
    fetch(`/api/traces/${traceId}`)
      .then(r => r.json())
      .then(setTrace)
      .catch(console.error)
  }, [traceId, isMcpInvoke, telemetry])

  const totalMs = trace?.total_ms ?? 0

  return (
    <div className="flex flex-col h-full overflow-hidden border-l border-white/10 bg-base-900">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
        <Activity size={14} className={theme.primaryText} />
        <span className="text-xs font-semibold" style={{ color: '#cbd5e1' }}>Prompt Telemetry</span>
        {trace && (
          <motion.span
            key={trace.verdict}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="ml-auto flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border"
            style={
              trace.verdict === 'BLOCKED'
                ? { background: 'rgba(239,68,68,0.2)', color: '#f87171', borderColor: 'rgba(239,68,68,0.4)' }
                : trace.verdict === 'DIRECT'
                ? { background: 'rgba(148,163,184,0.12)', color: '#64748b', borderColor: 'rgba(148,163,184,0.3)' }
                : { background: 'rgba(52,211,153,0.2)', color: '#34d399', borderColor: 'rgba(52,211,153,0.4)' }
            }
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
              <ScmTransactionCard trace={trace} telemetry={telemetry} isDark={isDark} />
              {isMcpAttack(telemetry) && <McpToolEventPanel telemetry={telemetry} trace={trace} isDark={isDark} />}
            </div>

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

            {/* Attack label + SCM-style threat snippets */}
            {trace.attack_label && (
              <div className="px-4 pb-1">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/[0.07] border border-orange-500/20 mb-3">
                  <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-orange-300">{trace.attack_label}</div>
                    <div className="text-[10px] text-orange-500/70 mt-0.5">{trace.attack_severity} severity · {telemetry?.attackMeta?.technique ?? ''}</div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 uppercase">{trace.attack_severity}</span>
                </div>
                <ScmThreatPanel trace={trace} telemetry={telemetry} isDark={isDark} />
              </div>
            )}

            <div className="border-t border-white/[0.06] mt-2" />
          </div>
        )}

        {/* ── Raw AIRS Sync Response (verbatim per pan.dev sync scan endpoint) ── */}
        {(telemetry?.inputScan?.rawResponse || telemetry?.outputScan?.rawResponse) && (
          <Section
            title="Raw AIRS Sync Response"
            icon={FileJson}
            iconColor="text-cyan-400"
            defaultOpen
            badge="POST /v1/scan/sync/request"
            badgeColor="bg-cyan-500/15 text-cyan-300 font-mono"
          >
            <div className="text-[10px] text-slate-500 mb-3 leading-relaxed">
              Verbatim response body from the AIRS sync scan endpoint — including <span className="font-mono text-cyan-400">prompt_detected</span>, <span className="font-mono text-cyan-400">prompt_masked_data</span> (when profile action = mask), and <span className="font-mono text-cyan-400">prompt_detection_details</span>.
            </div>

            {telemetry?.inputScan?.rawResponse && (
              <AirsRawBlock
                heading="Input scan (prompt)"
                sublabel={telemetry.inputScan.scan_id}
                data={telemetry.inputScan.rawResponse}
              />
            )}
            {telemetry?.outputScan?.rawResponse && (
              <AirsRawBlock
                heading="Output scan (response)"
                sublabel={telemetry.outputScan.scan_id}
                data={telemetry.outputScan.rawResponse}
              />
            )}
            {!telemetry?.outputScan?.rawResponse && telemetry?.inputScan?.action === 'block' && (
              <div className="text-[10px] text-slate-600 italic">
                Output scan skipped — input scan blocked the request before LLM execution.
              </div>
            )}
          </Section>
        )}

        {/* ── Detailed Threat Scan Reports (GET /v1/scan/reports) ── */}
        {(telemetry?.inputScan?.report || telemetry?.outputScan?.report) && (
          <Section
            title="Threat Scan Reports"
            icon={ShieldAlert}
            iconColor="text-orange-400"
            defaultOpen={false}
            badge="GET /v1/scan/reports"
            badgeColor="bg-orange-500/15 text-orange-300 font-mono"
          >
            <div className="text-[10px] text-slate-500 mb-3 leading-relaxed">
              Detailed per-detector report — <span className="font-mono text-orange-300">detection_results[]</span> with <span className="font-mono text-orange-300">dlp_report</span>, <span className="font-mono text-orange-300">pi_report</span>, <span className="font-mono text-orange-300">tc_report</span>, <span className="font-mono text-orange-300">mc_report</span>, etc. (including data pattern offsets and DLP profile metadata).
            </div>

            {telemetry?.inputScan?.report && (
              <AirsRawBlock
                heading="Input scan report"
                sublabel={telemetry.inputScan.report_id}
                data={telemetry.inputScan.report.error
                  ? { error: telemetry.inputScan.report.error, hint: 'Report may not be available immediately after scan — try again in a few seconds.' }
                  : telemetry.inputScan.report.data}
              />
            )}
            {telemetry?.outputScan?.report && (
              <AirsRawBlock
                heading="Output scan report"
                sublabel={telemetry.outputScan.report_id}
                data={telemetry.outputScan.report.error
                  ? { error: telemetry.outputScan.report.error, hint: 'Report may not be available immediately after scan — try again in a few seconds.' }
                  : telemetry.outputScan.report.data}
              />
            )}
          </Section>
        )}

        {/* ── Raw JSON (persisted trace object) ── */}
        {trace && (
          <Section title="Trace Object" icon={Hash} iconColor="text-sky-400" defaultOpen={false}>
            {/* Always dark — code editor style regardless of theme */}
            <div
              className="rounded-xl overflow-auto"
              style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.10)', maxHeight: '420px' }}
            >
              <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="text-[9px] font-bold text-sky-500 uppercase tracking-widest">persisted trace</span>
                <SbCopyButton text={JSON.stringify(trace, null, 2)} />
              </div>
              <div className="p-3">
                <HighlightedJson data={trace} />
              </div>
            </div>
          </Section>
        )}

        {/* ── Dev Corner ── */}
        <Section title="Dev Corner" icon={FileCode} iconColor="text-yellow-400" defaultOpen={false}>
          {/* Architecture flow */}
          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
            {['User Prompt', 'Your App', 'Prisma AIRS', 'LLM', 'Prisma AIRS', 'Response'].map((label, i, arr) => (
              <React.Fragment key={i}>
                <div className={`flex-shrink-0 px-2 py-1 rounded-lg text-[9px] font-bold text-center leading-tight ${
                  label === 'Prisma AIRS'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                    : label === 'LLM'
                    ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400'
                    : 'bg-white/[0.06] border border-white/10 text-slate-400'
                }`}>
                  {label}
                </div>
                {i < arr.length - 1 && (
                  <span className="text-slate-700 text-[10px] flex-shrink-0">→</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 mb-3 p-1 bg-black/30 rounded-lg border border-white/10">
            {DEV_CORNER_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setSdkTab(tab.id)}
                className={`flex-1 py-1.5 rounded-md text-[9px] font-semibold transition-all duration-150 ${
                  sdkTab === tab.id
                    ? `${theme.primaryBg2} ${theme.primaryText} border ${theme.primaryBorder2}`
                    : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* What / Why / Where card */}
          {DEV_CORNER_TABS.filter(t => t.id === sdkTab).map(tab => (
            <div key={tab.id} className="mb-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.07] space-y-1">
              <div className="flex gap-1.5 text-[10px]">
                <span className="font-bold text-yellow-400 flex-shrink-0">What:</span>
                <span className="text-slate-400">{tab.what}</span>
              </div>
              <div className="flex gap-1.5 text-[10px]">
                <span className="font-bold text-emerald-400 flex-shrink-0">Why:</span>
                <span className="text-slate-400">{tab.why}</span>
              </div>
              <div className="flex gap-1.5 text-[10px]">
                <span className="font-bold text-blue-400 flex-shrink-0">Where:</span>
                <span className="text-slate-400">{tab.where}</span>
              </div>
            </div>
          ))}

          {/* Code block */}
          {DEV_CORNER_TABS.filter(t => t.id === sdkTab).map(tab => (
            <CodeBlock
              key={tab.id}
              code={tab.code}
              language={tab.language}
              maxHeight="280px"
            />
          ))}
        </Section>

        {/* ── Recent Traces ── */}
        <Section title="Recent Traces" icon={History} iconColor="text-teal-400" defaultOpen={false}>
          <RecentTraces />
        </Section>

      </div>
    </div>
  )
}
