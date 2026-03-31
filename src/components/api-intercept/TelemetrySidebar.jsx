import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, Activity, Cpu, Hash,
  Zap, ArrowDownToLine, ArrowUpFromLine,
  AlertTriangle, CheckCircle2, ShieldX, ShieldCheck,
  Layers, FileCode, Clock, History,
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
          <span className="text-slate-500">{latencyLabel(llm).label}</span>
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export function TelemetrySidebar({ telemetry }) {
  const [sdkTab, setSdkTab] = useState('python')
  const theme = useProtectionTheme()

  const isBlocked = telemetry?.summary?.verdict === 'BLOCKED'
  const hasAirs   = telemetry?.summary != null
  const isDirect  = telemetry && !telemetry.summary
  const llm       = telemetry?.llm
  const timing    = telemetry?.timing

  return (
    <div className="flex flex-col h-full overflow-hidden border-l border-white/10 bg-base-900/20">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
        <Activity size={14} className={theme.primaryText} />
        <span className="text-xs font-semibold text-slate-300">Telemetry</span>
        {hasAirs && (
          <motion.span
            key={isBlocked ? 'blocked' : 'allowed'}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`ml-auto flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
              isBlocked
                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            }`}
          >
            {isBlocked ? <ShieldX size={10} /> : <ShieldCheck size={10} />}
            {isBlocked ? 'BLOCKED' : 'ALLOWED'}
          </motion.span>
        )}
        {isDirect && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-slate-800 text-slate-500 border-slate-700">
            <Zap size={10} /> DIRECT
          </span>
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

        {/* ── AIRS verdict hero ── */}
        {hasAirs && (
          <motion.div
            key={isBlocked ? 'blocked' : 'allowed'}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`mx-3 mt-3 mb-2 rounded-2xl border overflow-hidden ${
              isBlocked
                ? 'bg-gradient-to-br from-red-950/60 to-red-900/20 border-red-500/40'
                : 'bg-gradient-to-br from-emerald-950/60 to-emerald-900/20 border-emerald-500/40'
            }`}
          >
            {/* Top accent bar */}
            <div className={`h-1 w-full ${isBlocked ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'}`} />
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isBlocked ? 'bg-red-500/25 border border-red-500/30' : 'bg-emerald-500/25 border border-emerald-500/30'
                }`}>
                  {isBlocked
                    ? <ShieldX size={22} className="text-red-400" />
                    : <ShieldCheck size={22} className="text-emerald-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-base font-bold leading-tight ${isBlocked ? 'text-red-300' : 'text-emerald-300'}`}>
                    {isBlocked ? 'Threat Blocked' : 'Request Allowed'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                    {telemetry.summary.profile}
                  </div>
                </div>
                <div className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
                  isBlocked ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                }`}>
                  {telemetry.summary.category?.toUpperCase()}
                </div>
              </div>
              {telemetry.summary.threats_detected?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {telemetry.summary.threats_detected.map(t => (
                    <span key={t} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-[9px] font-bold text-red-300 uppercase tracking-wide">
                      <AlertTriangle size={8} />{t.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Unprotected hero ── */}
        {isDirect && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-3 mt-3 mb-2 p-4 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-800/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                <Zap size={20} className="text-slate-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-300">Direct LLM Response</div>
                <div className="text-[10px] text-slate-600 mt-0.5">AIRS scanning disabled — no protection active</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── LLM Performance ── */}
        {llm && (
          <Section title="LLM Performance" icon={Cpu} iconColor="text-blue-400" defaultOpen>
            <div className="space-y-3">
              {/* Model pill */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/30 border border-white/8">
                <Layers size={11} className="text-slate-500" />
                <span className="text-[10px] font-mono text-slate-300 flex-1 truncate">{llm.model}</span>
                {llm.finish_reason && (
                  <span className="text-[9px] text-slate-600 font-semibold uppercase">{llm.finish_reason}</span>
                )}
              </div>

              {/* Token stats */}
              <div className="grid grid-cols-2 gap-1.5">
                <StatCard
                  label="Input tokens"
                  value={fmt(llm.tokens_in)}
                  sub="prompt length"
                  color="text-blue-400"
                />
                <StatCard
                  label="Output tokens"
                  value={fmt(llm.tokens_out)}
                  sub="response length"
                  color="text-violet-400"
                />
              </div>

              {/* Token split bar */}
              {(llm.tokens_in || llm.tokens_out) && (
                <div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold mb-1.5">Token split</div>
                  <TokenBar tokensIn={llm.tokens_in} tokensOut={llm.tokens_out} />
                </div>
              )}
            </div>
          </Section>
        )}


        {/* ── AIRS sections (protected only) ── */}
        {hasAirs && (
          <>
            <Section
              title="Input Scan · Prompt"
              icon={ArrowDownToLine}
              iconColor="text-orange-400"
              defaultOpen
              badge={telemetry.inputScan?.category}
              badgeColor={telemetry.inputScan?.category === 'malicious'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-emerald-500/20 text-emerald-400'}
            >
              <ScanBlock scan={telemetry.inputScan} type="input" />
            </Section>

            {telemetry.outputScan && (
              <Section
                title="Output Scan · Response"
                icon={ArrowUpFromLine}
                iconColor="text-teal-400"
                defaultOpen={false}
                badge={telemetry.outputScan?.category}
                badgeColor={telemetry.outputScan?.category === 'malicious'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-emerald-500/20 text-emerald-400'}
              >
                <ScanBlock scan={telemetry.outputScan} type="output" />
              </Section>
            )}

            <Section title="Raw JSON Payload" icon={Hash} iconColor="text-slate-400" defaultOpen={false}>
              <div className="space-y-2">
                <p className="text-[9px] text-slate-600 uppercase tracking-wider">Input scan</p>
                <CodeBlock code={telemetry.inputScan} language="json" maxHeight="200px" />
                {telemetry.outputScan && (
                  <>
                    <p className="text-[9px] text-slate-600 uppercase tracking-wider mt-2">Output scan</p>
                    <CodeBlock code={telemetry.outputScan} language="json" maxHeight="200px" />
                  </>
                )}
              </div>
            </Section>
          </>
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
