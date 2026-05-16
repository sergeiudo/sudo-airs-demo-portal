import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Copy, Check, User, Search, Bot, CheckCircle2, ShieldX, Wrench, AlertTriangle } from 'lucide-react'

// ──────────────────────────────────────────────────────────────────────────────
// Pipeline Trace v2 — horizontal animated stepper + rich tabbed detail card.
// Every value rendered is sourced from message.telemetry (real /api/chat or
// /api/mcp/invoke response). Zero mocked data.
// ──────────────────────────────────────────────────────────────────────────────

// ─── Small copy button ───────────────────────────────────────────────────────
function CopyBtn({ text, size = 10 }) {
  const [c, setC] = useState(false)
  if (!text) return null
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText?.(String(text)); setC(true); setTimeout(() => setC(false), 1200) }}
      className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
      title="Copy"
    >
      {c ? <Check size={size} className="text-emerald-400" /> : <Copy size={size} />}
    </button>
  )
}

// ─── Truncate utility ─────────────────────────────────────────────────────────
function trunc(s, n = 28) {
  if (s == null) return '—'
  const str = String(s)
  return str.length > n ? `${str.slice(0, n - 1)}…` : str
}

// ─── DETECTORS list (per pan.dev OpenAPI) ─────────────────────────────────────
const DETECTORS = [
  { key: 'dlp',  label: 'DLP',        full: 'Data Loss Prevention' },
  { key: 'pi',   label: 'PI',         full: 'Prompt Injection' },
  { key: 'tc',   label: 'TC',         full: 'Toxic Content' },
  { key: 'mc',   label: 'MC',         full: 'Malicious Code' },
  { key: 'cg',   label: 'CG',         full: 'Contextual Grounding' },
  { key: 'agent',label: 'Agent',      full: 'Agentic Threats' },
  { key: 'urlf', label: 'URL Filt',   full: 'URL Filtering' },
  { key: 'dbs',  label: 'DBS',        full: 'Database Security' },
  { key: 'topic_violation', label: 'Topic', full: 'Topic Guardrails' },
  { key: 'injection',       label: 'Injection', full: 'Prompt Injection (legacy)' },
  { key: 'malicious_code',  label: 'Code', full: 'Malicious Code (legacy)' },
  { key: 'toxic_content',   label: 'Toxic', full: 'Toxic Content (legacy)' },
]

// ─── Format an ISO timestamp ──────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return null
  try { return new Date(iso).toISOString().replace('T', ' ').replace('Z', ' UTC') } catch { return iso }
}

// ─── Build step models from telemetry ─────────────────────────────────────────
function buildSteps(message) {
  const tel = message.telemetry ?? {}
  const isMcp   = !!tel.isMcpInvoke
  const input   = tel.inputScan  ?? null
  const output  = tel.outputScan ?? null
  const timing  = tel.timing     ?? {}
  const llm     = tel.llm        ?? {}
  const meta    = tel.attackMeta ?? null
  const tool    = tel.tool ?? null
  const params  = tel.params ?? null
  const result  = tel.toolResult ?? null
  const blocked = !!message.blocked
  const direct  = !input && !isMcp                    // unprotected path
  const inputBlocked = input?.action === 'block'
  const stage1Blocked = isMcp && tel.stage1?.action === 'block'

  const steps = []

  // 1) Prompt / Tool invocation received
  steps.push({
    id: 'prompt',
    title: isMcp ? `MCP Invoke · ${tool ?? 'tool'}` : 'Prompt received',
    icon: isMcp ? Wrench : User,
    color: '#94a3b8',
    status: 'success',
    latencyMs: 0,
    summary: [
      meta && { label: 'attack',     value: meta.label },
      meta && { label: 'technique',  value: meta.technique },
      meta && { label: 'severity',   value: meta.severity, accent: meta.severity === 'critical' ? '#f87171' : meta.severity === 'high' ? '#fb923c' : '#facc15' },
      isMcp && tool   && { label: 'tool',   value: tool, mono: true },
      isMcp && params && { label: 'params', value: JSON.stringify(params), mono: true },
      { label: 'airsEnabled', value: String(!direct), mono: true, accent: direct ? '#fb923c' : '#34d399' },
      direct && { label: '⚠ warning', value: 'AIRS scanning is OFF — prompt sent directly to LLM', accent: '#fb923c' },
    ].filter(Boolean),
  })

  // 2) AIRS Input Scan / Stage 1
  if (input || (isMcp && tel.stage1)) {
    const s    = isMcp ? tel.stage1 : input
    const isB  = isMcp ? tel.stage1?.action === 'block' : inputBlocked
    const det  = isMcp ? tel.stage1?.prompt_detected : input?.prompt_detected
    const lat  = isMcp ? tel.stage1?.latencyMs : (timing.airs_input_scan_ms ?? input?.latency_ms)
    const trId = isMcp ? tel.stage1?.trId : input?.tr_id
    const reqBody = isMcp ? tel.stage1?.requestBody : (input?.rawRequest ?? input?.requestBody)
    const toolEv  = reqBody?.contents?.[0]?.tool_event?.metadata ?? null
    const maskd   = !isMcp ? (input?.prompt_masked_data ?? input?.rawResponse?.prompt_masked_data ?? null) : null
    const rawRes  = !isMcp ? input?.rawResponse : null
    const report  = !isMcp ? (input?.report?.data ?? input?.report ?? null) : null

    steps.push({
      id: 'input',
      title: isMcp ? 'AIRS Stage 1 · Tool Input Scan' : 'AIRS Input Scan',
      icon: Search,
      color: isB ? '#f87171' : '#34d399',
      status: isB ? 'blocked' : 'allowed',
      latencyMs: lat ?? 0,
      summary: [
        { label: 'action',     value: s?.action,   mono: true, accent: isB ? '#f87171' : '#34d399' },
        { label: 'category',   value: s?.category, mono: true, accent: s?.category === 'malicious' ? '#f87171' : '#34d399' },
        { label: 'scan_id',    value: s?.scan_id ?? s?.scanId ?? null, mono: true, copy: true },
        !isMcp && input?.report_id  ? { label: 'report_id', value: input.report_id,  mono: true, copy: true } : null,
        !isMcp && input?.profile_name ? { label: 'profile',   value: input.profile_name, mono: true } : null,
        trId ? { label: 'session_id', value: trId, mono: true, copy: true } : null,
        !isMcp && input?.created_at   ? { label: 'created',   value: fmtTime(input.created_at),   mono: true } : null,
        !isMcp && input?.completed_at ? { label: 'completed', value: fmtTime(input.completed_at), mono: true } : null,
      ].filter(Boolean),
      detection: det ?? null,
      detectionDir: 'prompt',
      maskedSet: maskd ? { masked: maskd, profile: input?.profile_name } : null,
      toolEvent: toolEv ?? null,
      raw: { request: reqBody, response: rawRes, report },
      note: isB ? (isMcp ? 'Tool params blocked at Stage 1 — MCP server never invoked.' : 'Prompt blocked — request never reached the LLM.') : null,
    })
  }

  // 3) MCP Tool execution
  if (isMcp && !stage1Blocked) {
    const executed = !!result
    const noAirs   = !tel.stage1 && !tel.stage2
    let outSummary = null
    if (result) {
      if (result.content    != null) outSummary = trunc(result.content, 200)
      else if (result.stdout != null) outSummary = `exit=${result.returncode} stdout: ${trunc(result.stdout, 120)}${result.stderr ? ` | stderr: ${trunc(result.stderr, 60)}` : ''}`
      else if (result.found  != null) outSummary = `found=${result.found}${result.value != null ? ` value="${trunc(result.value, 80)}"` : ''}`
      else if (result.stored != null) outSummary = `stored=${result.stored} key="${params?.key}"`
      else if (result.status_code)    outSummary = `HTTP ${result.status_code} · ${trunc(result.body_preview ?? '', 120)}`
      else outSummary = trunc(JSON.stringify(result), 150)
    }
    steps.push({
      id: 'tool',
      title: `MCP Tool · ${tool}`,
      icon: executed ? Wrench : ShieldX,
      color: executed ? (noAirs ? '#fb923c' : '#5eead4') : '#f87171',
      status: executed ? (noAirs ? 'unprotected' : 'success') : 'blocked',
      latencyMs: null,
      summary: [
        { label: 'tool',       value: tool, mono: true, accent: '#5eead4' },
        { label: 'server',     value: 'airs-mcp-demo-server', mono: true },
        { label: 'ecosystem',  value: 'mcp', mono: true },
        { label: 'method',     value: 'tools/call', mono: true },
        params ? { label: 'params', value: JSON.stringify(params), mono: true } : null,
        outSummary ? { label: 'result', value: outSummary, mono: true, accent: noAirs ? '#fb923c' : '#5eead4' } : null,
        noAirs ? { label: '⚠ warning', value: 'Tool executed without AIRS scanning', accent: '#fb923c' } : null,
      ].filter(Boolean),
      raw: { params, result },
    })
  }

  // 4) LLM Inference (chat only, unblocked)
  if (!isMcp && !inputBlocked && (timing.llm_ms || llm.tokens_in != null || direct)) {
    steps.push({
      id: 'llm',
      title: 'LLM Inference',
      icon: Bot,
      color: '#60a5fa',
      status: 'success',
      latencyMs: timing.llm_ms ?? 0,
      summary: [
        llm.model        ? { label: 'model',        value: llm.model,        mono: true } : null,
        llm.tokens_in    != null ? { label: 'tokens_in',    value: String(llm.tokens_in),    mono: true } : null,
        llm.tokens_out   != null ? { label: 'tokens_out',   value: String(llm.tokens_out),   mono: true } : null,
        llm.tokens_total != null ? { label: 'tokens_total', value: String(llm.tokens_total), mono: true } : null,
        llm.throughput_tps ? { label: 'throughput', value: `${llm.throughput_tps} tok/s`, mono: true } : null,
        llm.finish_reason ? { label: 'finish_reason', value: llm.finish_reason, mono: true } : null,
      ].filter(Boolean),
    })
  }

  // 5) AIRS Output Scan / Stage 2
  if (output || (isMcp && tel.stage2)) {
    const s    = isMcp ? tel.stage2 : output
    const isB  = isMcp ? tel.stage2?.action === 'block' : output?.action === 'block'
    const det  = isMcp ? tel.stage2?.response_detected : output?.response_detected
    const lat  = isMcp ? tel.stage2?.latencyMs : (timing.airs_output_scan_ms ?? output?.latency_ms)
    const trId = isMcp ? tel.stage2?.trId : output?.tr_id
    const reqBody = isMcp ? tel.stage2?.requestBody : (output?.rawRequest ?? output?.requestBody)
    const toolEv  = reqBody?.contents?.[0]?.tool_event?.metadata ?? null
    const maskd   = !isMcp ? (output?.response_masked_data ?? output?.rawResponse?.response_masked_data ?? null) : null
    const rawRes  = !isMcp ? output?.rawResponse : null
    const report  = !isMcp ? (output?.report?.data ?? output?.report ?? null) : null
    steps.push({
      id: 'output',
      title: isMcp ? 'AIRS Stage 2 · Tool Output Scan' : 'AIRS Output Scan',
      icon: Search,
      color: isB ? '#f87171' : '#a78bfa',
      status: isB ? 'blocked' : 'allowed',
      latencyMs: lat ?? 0,
      summary: [
        { label: 'action',     value: s?.action,   mono: true, accent: isB ? '#f87171' : '#a78bfa' },
        { label: 'category',   value: s?.category, mono: true, accent: s?.category === 'malicious' ? '#f87171' : '#34d399' },
        { label: 'scan_id',    value: s?.scan_id ?? s?.scanId ?? null, mono: true, copy: true },
        !isMcp && output?.report_id   ? { label: 'report_id', value: output.report_id,   mono: true, copy: true } : null,
        !isMcp && output?.profile_name ? { label: 'profile',  value: output.profile_name, mono: true } : null,
        trId ? { label: 'session_id', value: trId, mono: true, copy: true } : null,
        !isMcp && output?.created_at   ? { label: 'created',   value: fmtTime(output.created_at),   mono: true } : null,
        !isMcp && output?.completed_at ? { label: 'completed', value: fmtTime(output.completed_at), mono: true } : null,
      ].filter(Boolean),
      detection: det ?? null,
      detectionDir: 'response',
      maskedSet: maskd ? { masked: maskd, profile: output?.profile_name } : null,
      toolEvent: toolEv ?? null,
      raw: { request: reqBody, response: rawRes, report },
      note: isB ? 'Output suppressed — response not returned to caller.' : null,
    })
  }

  // 6) Final
  steps.push({
    id: 'final',
    title: blocked ? 'Response suppressed' : (isMcp ? 'Tool result returned' : 'Response delivered'),
    icon: blocked ? ShieldX : CheckCircle2,
    color: blocked ? '#f87171' : '#34d399',
    status: blocked ? 'blocked' : 'success',
    latencyMs: 0,
    summary: [
      { label: 'verdict',  value: message.verdict ?? (direct ? 'DIRECT' : 'ALLOWED'), mono: true, accent: blocked ? '#f87171' : direct ? '#94a3b8' : '#34d399' },
    ].filter(Boolean),
  })

  return steps
}

// ─── Step node (stepper) ──────────────────────────────────────────────────────
function StepNode({ step, active, onClick, idx }) {
  const Icon = step.icon
  const isBlocked = step.status === 'blocked'
  const isUnprotected = step.status === 'unprotected'
  const ringColor = step.color
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * idx, duration: 0.25, ease: 'easeOut' }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 flex-shrink-0 group focus:outline-none"
      style={{ minWidth: 64 }}
    >
      <div className="relative">
        {/* Active glow ring */}
        {active && (
          <motion.div
            layoutId="stepActiveRing"
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: `0 0 0 3px ${ringColor}33, 0 0 18px ${ringColor}66, 0 0 32px ${ringColor}33`,
              background: 'transparent',
            }}
          />
        )}
        {/* Subtle pulse on blocked/unprotected even when not active */}
        {(isBlocked || isUnprotected) && !active && (
          <motion.div
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 12px ${ringColor}88` }}
          />
        )}
        <div
          className="relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors"
          style={{
            borderColor: active ? ringColor : `${ringColor}55`,
            background: active ? `${ringColor}22` : 'rgba(15, 17, 23, 0.85)',
          }}
        >
          <Icon size={16} style={{ color: ringColor }} />
        </div>
      </div>
      <div className="text-[9px] font-semibold leading-tight text-center max-w-[80px] mt-1" style={{ color: active ? '#e2e8f0' : '#475569' }}>
        {step.title.replace(/AIRS Stage \d · /, '').replace('AIRS ', '').split(' · ')[0]}
      </div>
    </motion.button>
  )
}

// ─── Connector line between nodes ─────────────────────────────────────────────
function Connector({ fromColor, toColor, animated }) {
  return (
    <div className="flex-1 flex items-center px-1" style={{ minWidth: 16, marginTop: -22 }}>
      <div className="relative w-full h-px" style={{ background: `linear-gradient(90deg, ${fromColor}88, ${toColor}88)` }}>
        {animated && (
          <motion.div
            className="absolute top-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${toColor}, transparent)`, width: '40%' }}
            animate={{ left: ['-40%', '100%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Tab pill ─────────────────────────────────────────────────────────────────
function TabPill({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="relative px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors"
      style={{ color: active ? color : '#64748b' }}
    >
      {label}
      {active && (
        <motion.div
          layoutId="activeTabPill"
          className="absolute inset-0 rounded-md -z-10"
          style={{ background: `${color}1a`, border: `1px solid ${color}55` }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </button>
  )
}

// ─── Summary table ────────────────────────────────────────────────────────────
function SummaryRows({ rows }) {
  if (!rows?.length) return <Empty msg="No summary fields" />
  return (
    <div className="space-y-px">
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} className="flex items-start gap-3 px-3 py-1.5 rounded transition-colors hover:bg-white/[0.03]">
          <span className="text-[10px] font-mono w-24 flex-shrink-0 pt-0.5" style={{ color: '#64748b' }}>{r.label}</span>
          <span className={`text-[11px] flex-1 leading-relaxed break-all ${r.mono ? 'font-mono' : 'font-medium'}`} style={{ color: r.accent ?? (r.mono ? '#67e8f9' : '#e2e8f0') }}>
            {r.copy && r.value?.length > 28 ? trunc(r.value, 28) : r.value}
          </span>
          {r.copy && <CopyBtn text={r.value} />}
        </div>
      ))}
    </div>
  )
}

// ─── Detection grid (per-detector ✓/✗) ────────────────────────────────────────
function DetectionGrid({ detected, direction }) {
  if (!detected) return <Empty msg="No detector data" />
  const allKeys = Object.keys(detected)
  // Use canonical list order if matching, otherwise show whatever keys exist
  const rendered = []
  for (const d of DETECTORS) if (allKeys.includes(d.key)) rendered.push({ ...d, value: detected[d.key] })
  // Append any unknown keys
  for (const k of allKeys) if (!DETECTORS.find(d => d.key === k)) rendered.push({ key: k, label: k, full: k, value: detected[k] })

  return (
    <div className="space-y-2">
      <div className="text-[9px] font-semibold uppercase tracking-widest px-3" style={{ color: '#64748b' }}>
        {direction === 'response' ? 'Response detectors' : 'Prompt detectors'} · {rendered.length}
      </div>
      <div className="grid grid-cols-2 gap-1.5 px-2">
        {rendered.map(d => (
          <div
            key={d.key}
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors"
            style={{
              background: d.value ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.04)',
              borderColor:  d.value ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)',
            }}
          >
            {d.value
              ? <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.25)' }}><div className="w-1.5 h-1.5 rounded-full" style={{ background: '#f87171', boxShadow: '0 0 6px #f87171' }} /></div>
              : <CheckCircle2 size={12} style={{ color: '#34d399', opacity: 0.6 }} />
            }
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold leading-none" style={{ color: d.value ? '#fca5a5' : '#94a3b8' }}>{d.label}</div>
              <div className="text-[8px] truncate leading-tight mt-0.5" style={{ color: d.value ? '#f87171aa' : '#64748b' }}>{d.full}</div>
            </div>
            <span className="text-[8px] font-mono font-bold uppercase" style={{ color: d.value ? '#f87171' : '#34d399' }}>{d.value ? 'detected' : 'clean'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Highlighted masked text ──────────────────────────────────────────────────
function HighlightedMasked({ data, patternDetections }) {
  // patternDetections: [{pattern, locations: [[start,end], ...]}]
  if (!data) return <span className="text-slate-600 text-[11px]">—</span>
  // Build a flat set of ranges with their pattern name
  const ranges = []
  for (const pd of patternDetections ?? []) {
    for (const loc of pd.locations ?? []) {
      const [start, end] = loc
      if (Number.isFinite(start) && Number.isFinite(end)) ranges.push({ start, end, pattern: pd.pattern })
    }
  }
  ranges.sort((a, b) => a.start - b.start)
  const segments = []
  let cursor = 0
  for (const r of ranges) {
    if (r.start > cursor) segments.push({ text: data.slice(cursor, r.start), masked: false })
    segments.push({ text: data.slice(r.start, r.end), masked: true, pattern: r.pattern })
    cursor = r.end
  }
  if (cursor < data.length) segments.push({ text: data.slice(cursor), masked: false })
  if (!segments.length) segments.push({ text: data, masked: false })
  return (
    <div className="text-[11px] font-mono leading-relaxed break-all whitespace-pre-wrap" style={{ color: '#e2e8f0' }}>
      {segments.map((seg, i) => seg.masked ? (
        <span key={i} title={seg.pattern} className="px-0.5 rounded" style={{
          background: 'rgba(251,191,36,0.18)',
          color: '#fbbf24',
          borderBottom: '1px dashed rgba(251,191,36,0.6)',
          fontWeight: 700,
        }}>{seg.text}</span>
      ) : (
        <span key={i}>{seg.text}</span>
      ))}
    </div>
  )
}

// ─── Masked & DLP tab ─────────────────────────────────────────────────────────
function MaskedDlpTab({ maskedSet, report, direction }) {
  const masked = maskedSet?.masked
  // Pull DLP report entries matching this direction
  const dlpEntries = (report?.[0]?.detection_results ?? report?.detection_results ?? []).filter(d => {
    if (!d) return false
    if (direction && d.data_type && d.data_type !== direction) return false
    return d.detection_service === 'dlp' || d.result_detail?.dlp_report
  })

  if (!masked && !dlpEntries.length) {
    return <Empty msg="No DLP findings · profile may be set to block (not mask) — switch DLP rule to “Mask” in SCM to see masked data here" />
  }

  return (
    <div className="space-y-4 px-3">
      {masked && (
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#fbbf24' }}>
            Masked {direction === 'response' ? 'response' : 'prompt'} · prompt_masked_data
          </div>
          <div className="rounded-lg p-3" style={{ background: '#0d1117', border: '1px solid rgba(251,191,36,0.25)' }}>
            <HighlightedMasked data={masked.data} patternDetections={masked.pattern_detections} />
          </div>
          {masked.pattern_detections?.length > 0 && (
            <div className="mt-2 space-y-1">
              {masked.pattern_detections.map((pd, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded text-[10px]" style={{ background: 'rgba(251,191,36,0.06)' }}>
                  <span className="font-bold" style={{ color: '#fbbf24' }}>{pd.pattern}</span>
                  <span className="text-slate-500">·</span>
                  <span className="font-mono text-slate-400">
                    {pd.locations?.length ?? 0} match{(pd.locations?.length ?? 0) === 1 ? '' : 'es'}
                    {pd.locations?.length ? ` @ ${pd.locations.map(l => `[${l[0]}, ${l[1]}]`).join(', ')}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {dlpEntries.length > 0 && (
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#fb923c' }}>
            DLP report · detection_results[].result_detail.dlp_report
          </div>
          <div className="space-y-2">
            {dlpEntries.map((d, i) => {
              const dlp = d.result_detail?.dlp_report ?? {}
              return (
                <div key={i} className="rounded-lg p-3" style={{ background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.2)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: d.action === 'block' ? '#f87171' : '#fb923c' }}>{d.action ?? '—'}</span>
                    <span className="text-[10px] font-mono" style={{ color: '#94a3b8' }}>{d.data_type ?? '—'}</span>
                    <span className="text-slate-700">·</span>
                    <span className="text-[10px] font-mono" style={{ color: d.verdict === 'malicious' ? '#f87171' : '#94a3b8' }}>{d.verdict ?? '—'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    {dlp.dlp_profile_name && <div><span className="text-slate-600">profile:</span> <span className="font-mono text-slate-300">{dlp.dlp_profile_name}</span></div>}
                    {dlp.dlp_profile_id   && <div className="truncate"><span className="text-slate-600">profile_id:</span> <span className="font-mono text-slate-400">{trunc(dlp.dlp_profile_id, 16)}</span></div>}
                    {dlp.data_pattern_rule1_verdict && <div><span className="text-slate-600">rule1:</span> <span className="font-mono" style={{ color: dlp.data_pattern_rule1_verdict === 'MATCHED' ? '#f87171' : '#34d399' }}>{dlp.data_pattern_rule1_verdict}</span></div>}
                    {dlp.data_pattern_rule2_verdict && <div><span className="text-slate-600">rule2:</span> <span className="font-mono" style={{ color: dlp.data_pattern_rule2_verdict === 'MATCHED' ? '#f87171' : '#34d399' }}>{dlp.data_pattern_rule2_verdict}</span></div>}
                    {dlp.dlp_report_id    && <div className="col-span-2 truncate"><span className="text-slate-600">report_id:</span> <span className="font-mono text-slate-500">{trunc(dlp.dlp_report_id, 40)}</span></div>}
                  </div>
                  {Array.isArray(dlp.data_pattern_detection_offsets) && dlp.data_pattern_detection_offsets.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#fb923c' }}>pattern offsets</div>
                      <div className="space-y-1">
                        {dlp.data_pattern_detection_offsets.map((o, j) => (
                          <div key={j} className="flex items-center gap-2 text-[10px] font-mono">
                            <span style={{ color: '#fbbf24' }}>{o.name}</span>
                            <span className="text-slate-700">·</span>
                            <span className="text-slate-500">hi:{o.high_confidence_detections ?? 0}</span>
                            <span className="text-slate-500">med:{o.medium_confidence_detections ?? 0}</span>
                            <span className="text-slate-500">low:{o.low_confidence_detections ?? 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tool Event tab ───────────────────────────────────────────────────────────
function ToolEventTab({ toolEvent }) {
  if (!toolEvent) return <Empty msg="No tool_event metadata" />
  const rows = Object.entries(toolEvent).map(([k, v]) => ({ label: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v), mono: true, accent: '#5eead4' }))
  return <SummaryRows rows={rows} />
}

// ─── Raw JSON tab ─────────────────────────────────────────────────────────────
function RawJsonTab({ raw }) {
  if (!raw) return <Empty msg="No raw payload available" />
  const sections = Object.entries(raw).filter(([, v]) => v != null)
  if (!sections.length) return <Empty msg="No raw payload available" />
  return (
    <div className="space-y-3 px-3">
      {sections.map(([key, value]) => {
        const json = JSON.stringify(value, null, 2)
        return (
          <div key={key} className="rounded-lg overflow-hidden" style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#67e8f9' }}>{key}</span>
              <CopyBtn text={json} />
            </div>
            <pre className="p-3 overflow-auto text-[10px] font-mono leading-relaxed" style={{ color: '#7dd3fc', maxHeight: 260, whiteSpace: 'pre', wordBreak: 'normal' }}>
              {json}
            </pre>
          </div>
        )
      })}
    </div>
  )
}

// ─── Empty placeholder ────────────────────────────────────────────────────────
function Empty({ msg }) {
  return (
    <div className="text-[10px] italic text-slate-600 px-3 py-4 text-center leading-relaxed">{msg}</div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export function PipelineTraceV2({ message }) {
  const steps = useMemo(() => buildSteps(message), [message])
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState(null)

  // Auto-pick first interesting step when expanded
  const defaultStepId = useMemo(() => {
    const blocked = steps.find(s => s.status === 'blocked')
    if (blocked) return blocked.id
    const scan = steps.find(s => s.id === 'input' || s.id === 'output')
    return scan?.id ?? steps[0]?.id ?? null
  }, [steps])

  const currentId = activeId ?? defaultStepId
  const activeStep = steps.find(s => s.id === currentId)

  // Available tabs for active step
  const tabs = useMemo(() => {
    if (!activeStep) return []
    const t = [{ key: 'summary', label: 'Summary' }]
    if (activeStep.detection)  t.push({ key: 'detection', label: 'Detection' })
    if (activeStep.maskedSet || (activeStep.raw?.report)) t.push({ key: 'dlp', label: 'Masked & DLP' })
    if (activeStep.toolEvent)  t.push({ key: 'toolEvent', label: 'Tool Event' })
    if (activeStep.raw && Object.values(activeStep.raw).some(v => v != null)) t.push({ key: 'raw', label: 'Raw JSON' })
    return t
  }, [activeStep])
  const [activeTab, setActiveTab] = useState('summary')
  // Reset tab if it's not valid for the new step
  React.useEffect(() => {
    if (!tabs.find(t => t.key === activeTab)) setActiveTab(tabs[0]?.key ?? 'summary')
  }, [tabs, activeTab])

  if (!steps.length) return null

  return (
    <div className="w-full max-w-[92%] mt-2 mb-1">
      {/* Toggle */}
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2">
        <span className="text-[12px]" style={{ color: '#38bdf8' }}>⬡</span>
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border tracking-wide"
          style={{ background: open ? 'rgba(56,189,248,0.15)' : 'rgba(56,189,248,0.07)', borderColor: 'rgba(56,189,248,0.4)', color: '#38bdf8' }}>
          Pipeline Trace
        </span>
        <span className="text-[9px] font-mono" style={{ color: '#4b5563' }}>
          {steps.length} steps
        </span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronDown size={10} style={{ color: '#38bdf8' }} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div
              className="mt-2 rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, #0f1118 0%, #0a0c12 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
            >
              {/* ── Stepper ───────────────────────────────────────────────── */}
              <div className="px-5 py-5" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(56,189,248,0.06), transparent 60%)' }}>
                <div className="flex items-start gap-1 overflow-x-auto">
                  {steps.map((s, i) => (
                    <React.Fragment key={s.id}>
                      <StepNode
                        step={s}
                        active={s.id === currentId}
                        onClick={() => setActiveId(s.id)}
                        idx={i}
                      />
                      {i < steps.length - 1 && (
                        <Connector
                          fromColor={s.color}
                          toColor={steps[i + 1].color}
                          animated={s.id === currentId || steps[i + 1].id === currentId}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* ── Active step detail card ──────────────────────────────── */}
              <AnimatePresence mode="wait">
                {activeStep && (
                  <motion.div
                    key={activeStep.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div
                      className="mx-4 mb-4 rounded-xl overflow-hidden"
                      style={{
                        background: 'rgba(15,17,24,0.85)',
                        border: `1px solid ${activeStep.color}44`,
                        boxShadow: `0 8px 24px ${activeStep.color}1a, inset 0 1px 0 rgba(255,255,255,0.04)`,
                      }}
                    >
                      {/* Card header */}
                      <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: `linear-gradient(90deg, ${activeStep.color}18, transparent)` }}>
                        <activeStep.icon size={14} style={{ color: activeStep.color }} />
                        <span className="text-[12px] font-bold tracking-tight flex-1" style={{ color: activeStep.color }}>{activeStep.title}</span>
                        {activeStep.status === 'blocked' && <Badge color="#f87171" label="BLOCKED" />}
                        {activeStep.status === 'allowed' && <Badge color="#34d399" label="ALLOWED" />}
                        {activeStep.status === 'unprotected' && <Badge color="#fb923c" label="UNPROTECTED" />}
                      </div>

                      {/* Warning note */}
                      {activeStep.note && (
                        <div className="mx-3 mt-3 px-3 py-2 rounded-lg flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                          <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" style={{ color: '#fca5a5' }} />
                          <span className="text-[10px] leading-relaxed" style={{ color: '#fca5a5' }}>{activeStep.note}</span>
                        </div>
                      )}

                      {/* Tabs */}
                      {tabs.length > 1 && (
                        <div className="flex items-center gap-1 px-3 pt-3 pb-1 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          {tabs.map(t => (
                            <TabPill key={t.key} label={t.label} active={activeTab === t.key} onClick={() => setActiveTab(t.key)} color={activeStep.color} />
                          ))}
                        </div>
                      )}

                      {/* Tab content */}
                      <div className="py-3 min-h-[60px]">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeTab + activeStep.id}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15 }}
                          >
                            {activeTab === 'summary'   && <SummaryRows rows={activeStep.summary} />}
                            {activeTab === 'detection' && <DetectionGrid detected={activeStep.detection} direction={activeStep.detectionDir} />}
                            {activeTab === 'dlp'       && <MaskedDlpTab maskedSet={activeStep.maskedSet} report={activeStep.raw?.report} direction={activeStep.detectionDir} />}
                            {activeTab === 'toolEvent' && <ToolEventTab toolEvent={activeStep.toolEvent} />}
                            {activeTab === 'raw'       && <RawJsonTab raw={activeStep.raw} />}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Badge({ color, label }) {
  return (
    <span className="text-[8px] font-black px-2 py-0.5 rounded-full border tracking-widest"
      style={{ background: `${color}22`, borderColor: `${color}55`, color }}>
      {label}
    </span>
  )
}
