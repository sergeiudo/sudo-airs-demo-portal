import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ScanSearch, Upload, Link2, Play, AlertTriangle,
  CheckCircle2, ShieldX, ShieldCheck, Hash, ChevronDown,
  RefreshCw, AlertCircle, Wifi, WifiOff, ExternalLink, Zap, History,
} from 'lucide-react'
import { useProtectionTheme } from '../hooks/useProtectionTheme'
import { RadarAnimation } from '../components/model-scanning/RadarAnimation'
import { CodeBlock } from '../components/shared/CodeBlock'

// ─── Quick presets ────────────────────────────────────────────────────────────
const PRESETS = [
  {
    id: 'malicious',
    label: 'Malicious Demo',
    uri: 'opendiffusion/sentimentcheck',
    tag: 'BLOCKED',
    color: 'red',
  },
  {
    id: 'safe',
    label: 'Clean Demo',
    uri: 'google/flan-t5-small',
    tag: 'SAFE',
    color: 'emerald',
  },
]

// ─── Scanner health ───────────────────────────────────────────────────────────
function useScannerHealth() {
  const [health, setHealth] = useState(null)
  useEffect(() => {
    fetch('/api/scanner/health')
      .then(r => r.json())
      .then(d => setHealth(d.running))
      .catch(() => setHealth(false))
  }, [])
  return health
}

// ─── Violation card ───────────────────────────────────────────────────────────
function ViolationCard({ v }) {
  const state = (v.rule_instance_state || 'OTHER').toUpperCase()
  const isBlocking = state === 'BLOCKING'
  const isWarning  = state === 'WARNING'

  return (
    <div className={`rounded-xl border p-3 space-y-1.5 ${
      isBlocking ? 'border-red-500/30 bg-red-500/5'
      : isWarning ? 'border-yellow-500/30 bg-yellow-500/5'
      : 'border-white/10 bg-white/[0.03]'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold text-slate-200">{v.rule_name || 'Unnamed rule'}</span>
        <span className={`flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
          isBlocking ? 'bg-red-500/20 text-red-400 border-red-500/40'
          : isWarning ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
          : 'bg-white/10 text-slate-400 border-white/20'
        }`}>{state}</span>
      </div>
      {v.threat_description && (
        <p className="text-[10px] text-slate-500 leading-relaxed">{v.threat_description}</p>
      )}
      {v.description && (
        <p className="text-[10px] text-slate-600 leading-relaxed">{v.description}</p>
      )}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {v.file      && <span className="font-mono text-[9px] bg-black/40 border border-white/10 px-1.5 py-0.5 rounded text-slate-500">File: {v.file}</span>}
        {v.module    && <span className="font-mono text-[9px] bg-black/40 border border-white/10 px-1.5 py-0.5 rounded text-slate-500">Module: {v.module}</span>}
        {v.operator  && <span className="font-mono text-[9px] bg-black/40 border border-white/10 px-1.5 py-0.5 rounded text-slate-500">Op: {v.operator}</span>}
      </div>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────
export function ModelScanningView() {
  const theme = useProtectionTheme()
  const scannerUp = useScannerHealth()

  const [mode, setMode]     = useState('huggingface')
  const [hfUri, setHfUri]   = useState('')
  const [file, setFile]     = useState(null)
  const fileInputRef        = useRef(null)

  const [scanState, setScanState] = useState('idle')
  const [progress, setProgress]   = useState(0)
  const [result, setResult]       = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const [history, setHistory]     = useState([])

  // Resizable JSON panel — default 1/3 of container
  const containerRef = useRef(null)
  const [jsonWidth, setJsonWidth] = useState(null) // null = use 1/3 default
  const isDragging = useRef(false)
  const dragStart  = useRef({ x: 0, w: 0 })

  const onDragStart = (e) => {
    isDragging.current = true
    const currentW = jsonWidth ?? Math.round((containerRef.current?.offsetWidth ?? 1200) / 3)
    dragStart.current  = { x: e.clientX, w: currentW }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return
      const delta = dragStart.current.x - e.clientX
      const next  = Math.min(800, Math.max(240, dragStart.current.w + delta))
      setJsonWidth(next)
    }
    const onUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const progressRef = useRef(null)

  const startProgressTick = () => {
    setProgress(0)
    progressRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 85) { clearInterval(progressRef.current); return 85 }
        return p + Math.random() * 3
      })
    }, 500)
  }

  const stopProgress = (final = 100) => {
    clearInterval(progressRef.current)
    setProgress(final)
  }

  const handleScan = async () => {
    setResult(null); setErrorMsg(''); setScanState('scanning'); startProgressTick()
    try {
      const formData = new FormData()
      formData.append('source_type', mode)
      if (mode === 'huggingface') {
        formData.append('hf_model_uri', hfUri.trim())
      } else {
        if (!file) throw new Error('Please select a file to upload')
        formData.append('file', file)
      }
      const res  = await fetch('/scan-model', { method: 'POST', body: formData })
      const json = await res.json()
      stopProgress(100)
      if (!res.ok) throw new Error(json.detail || 'Scan failed')
      setResult(json); setScanState('complete')
      const outcome = (json.eval_outcome ?? '').toUpperCase()
      const allowed = outcome.includes('ALLOW') || outcome.includes('PASS')
      setHistory(h => [{
        id: Date.now(),
        uri: mode === 'huggingface' ? hfUri.trim() : (file?.name ?? 'local file'),
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        allowed,
        result: json,
      }, ...h].slice(0, 10))
    } catch (err) {
      stopProgress(0); setErrorMsg(err.message); setScanState('error')
    }
  }

  const reset = () => {
    setScanState('idle'); setProgress(0); setResult(null)
    setErrorMsg(''); setFile(null)
  }

  // Derived stats
  const evalSummary = result?.eval_summary ?? {}
  const total    = evalSummary.total_rules  ?? result?.rules_summary?.total  ?? 0
  const passed   = evalSummary.rules_passed ?? result?.rules_summary?.passed ?? 0
  const failed   = evalSummary.rules_failed ?? result?.rules_summary?.failed ?? 0
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '—'
  const outcome  = result?.eval_outcome ?? ''
  const isAllowed = outcome.toUpperCase().includes('ALLOW') || outcome.toUpperCase().includes('PASS')
  const violations  = result?.violations ?? []
  const violCounts  = result?.violations_counts ?? {}
  const blocking    = violCounts.BLOCKING ?? 0
  const warning     = violCounts.WARNING  ?? 0

  const canScan = scannerUp && (mode === 'huggingface' ? !!hfUri.trim() : !!file)

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── LEFT: config panel ── */}
      <div className="w-[300px] flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden bg-base-900/30">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
          <ScanSearch size={14} className={theme.primaryText} />
          <span className="text-xs font-semibold text-slate-300">Model Scanner</span>
          <div className={`ml-auto flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
            scannerUp === null  ? 'border-slate-700 bg-slate-800 text-slate-500'
            : scannerUp         ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
            :                     'border-red-500/40 bg-red-500/10 text-red-400'
          }`}>
            {scannerUp === null ? <RefreshCw size={8} className="animate-spin" />
             : scannerUp ? <Wifi size={8} /> : <WifiOff size={8} />}
            {scannerUp === null ? 'CHECKING' : scannerUp ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Offline warning */}
          {scannerUp === false && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10">
              <p className="text-xs font-semibold text-red-400 mb-1">Scanner offline</p>
              <p className="text-[10px] text-red-300/70">Add credentials to <code className="font-mono">.env</code> and run <code className="font-mono">bash setup-scanner.sh</code></p>
            </div>
          )}

          {/* Quick presets */}
          <div>
            <div className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold mb-2">Quick Demo</div>
            <div className="space-y-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setMode('huggingface'); setHfUri(p.uri); reset() }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all duration-150 ${
                    hfUri === p.uri
                      ? p.color === 'red'
                        ? 'border-red-500/40 bg-red-500/10'
                        : 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                    p.color === 'red' ? 'bg-red-500/20' : 'bg-emerald-500/20'
                  }`}>
                    {p.color === 'red'
                      ? <ShieldX size={11} className="text-red-400" />
                      : <ShieldCheck size={11} className="text-emerald-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-300">{p.label}</div>
                    <div className="text-[9px] font-mono text-slate-600 truncate">{p.uri}</div>
                  </div>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                    p.color === 'red'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}>{p.tag}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-[9px] text-slate-700 uppercase tracking-wider">or custom</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Mode tabs */}
          <div>
            <div className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold mb-2">Scan source</div>
            <div className="flex p-1 bg-black/40 rounded-lg border border-white/10 gap-1">
              {[
                { id: 'huggingface', label: 'HuggingFace', icon: Link2 },
                { id: 'local',       label: 'Local File',  icon: Upload },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setMode(tab.id); reset() }}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
                    mode === tab.id ? '' : 'text-slate-500 hover:text-slate-400'
                  }`}
                >
                  {mode === tab.id && (
                    <motion.span
                      layoutId="scan-mode-pill"
                      className={`absolute inset-0 rounded-md ${theme.primaryBg2} border ${theme.primaryBorder2}`}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <tab.icon size={11} className={`relative z-10 ${mode === tab.id ? theme.primaryText : ''}`} />
                  <span className={`relative z-10 ${mode === tab.id ? theme.primaryText : ''}`}>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          {mode === 'huggingface' ? (
            <div className="space-y-1.5">
              <label className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">HuggingFace URI</label>
              <input
                value={hfUri}
                onChange={e => setHfUri(e.target.value)}
                placeholder="org/model-name"
                className="w-full bg-black/40 border border-white/15 text-slate-200 text-xs rounded-lg px-3 py-2.5 placeholder-slate-700 focus:outline-none focus:border-white/30 font-mono"
              />
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-white/10 hover:border-white/20 rounded-xl p-5 text-center cursor-pointer transition-all"
            >
              <Upload size={18} className="mx-auto mb-2 text-slate-600" />
              {file ? (
                <p className="text-xs font-semibold text-slate-300 truncate">{file.name}</p>
              ) : (
                <p className="text-xs text-slate-500">Drop file or click to upload</p>
              )}
              <input ref={fileInputRef} type="file" className="hidden"
                accept=".zip,.pkl,.bin,.safetensors,.pt,.onnx"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {/* Scan history */}
          {history.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <History size={9} className="text-slate-600" />
                <div className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">Scan History</div>
              </div>
              <div className="space-y-1">
                <AnimatePresence>
                  {history.map(h => (
                    <motion.button
                      key={h.id}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      onClick={() => { setResult(h.result); setScanState('complete'); setProgress(100) }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/5 text-left transition-all"
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${h.allowed ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                        {h.allowed
                          ? <ShieldCheck size={10} className="text-emerald-400" />
                          : <ShieldX size={10} className="text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-mono text-slate-400 truncate">{h.uri}</div>
                        <div className="text-[9px] text-slate-700">{h.ts}</div>
                      </div>
                      <span className={`text-[8px] font-bold flex-shrink-0 ${h.allowed ? 'text-emerald-500' : 'text-red-500'}`}>
                        {h.allowed ? 'SAFE' : 'BLOCKED'}
                      </span>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Scan button */}
          <motion.button
            onClick={scanState === 'complete' || scanState === 'error' ? reset : handleScan}
            disabled={scanState === 'scanning' || !canScan}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300"
            style={
              scanState === 'scanning'
                ? { background: 'rgba(100,116,139,0.2)', color: '#94a3b8', cursor: 'not-allowed' }
                : scanState === 'complete' || scanState === 'error'
                ? { background: 'rgba(100,116,139,0.15)', color: '#64748b', border: '1px solid rgba(100,116,139,0.3)' }
                : !scannerUp || !canScan
                ? { background: 'rgba(100,116,139,0.15)', color: '#94a3b8', cursor: 'not-allowed' }
                : { background: '#3b82f6', color: '#ffffff' }
            }
            whileTap={{ scale: 0.97 }}
          >
            {scanState === 'scanning' ? <><RefreshCw size={14} className="animate-spin" /> Scanning…</>
             : scanState === 'complete' || scanState === 'error' ? <><RefreshCw size={14} /> New Scan</>
             : <><Play size={14} /> Scan Model</>}
          </motion.button>
        </div>
      </div>

      {/* ── RIGHT: results panel ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Radar strip */}
        <div className={`flex items-center gap-6 px-6 py-4 border-b border-white/10 flex-shrink-0 transition-all duration-500 ${
          scanState === 'scanning' ? theme.primaryBg2 : ''
        }`}>
          <div className="flex-shrink-0">
            <RadarAnimation isScanning={scanState === 'scanning'} progress={Math.round(progress)} />
          </div>

          <div className="flex-1 space-y-3 min-w-0">
            {/* Status */}
            <AnimatePresence mode="wait">
              {scanState === 'idle' && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-sm font-semibold text-slate-500">Ready to scan</p>
                  <p className="text-[10px] text-slate-700">Select a preset or enter a HuggingFace model URI</p>
                </motion.div>
              )}
              {scanState === 'scanning' && (
                <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className={`text-sm font-bold ${theme.primaryText}`}>Scanning model…</p>
                  <p className="text-[10px] text-slate-500 font-mono truncate">{hfUri || file?.name}</p>
                </motion.div>
              )}
              {scanState === 'complete' && result && (
                <motion.div key="complete" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isAllowed ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                      {isAllowed ? <ShieldCheck size={18} className="text-emerald-400" /> : <ShieldX size={18} className="text-red-400" />}
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${isAllowed ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isAllowed ? 'Model Approved' : 'Model Blocked'}
                      </p>
                      <p className="text-[10px] text-slate-500">{outcome} · {result.scanner_version} · {result.scan_source === 'huggingface' ? result.model_uri?.replace('https://huggingface.co/', '') : result.original_filename}</p>
                    </div>
                    {result.uuid && (
                      <a
                        href={`https://stratacloudmanager.paloaltonetworks.com/ai-security/model-security/scans/${result.uuid}/overview#timeRange%5Bvalue%5D=past-30-days`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex-shrink-0 transition-all ${
                          isAllowed
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                        }`}
                      >
                        <ExternalLink size={11} /> View in SCM
                      </a>
                    )}
                  </div>
                </motion.div>
              )}
              {scanState === 'error' && (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <p className="text-sm font-bold text-red-400">Scan Error</p>
                  <p className="text-[10px] text-red-400/70">{errorMsg}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress bar */}
            {(scanState === 'scanning' || scanState === 'complete') && (
              <div className="space-y-1.5">
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-blue-500"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {['Upload', 'Analyze', 'Policy', 'Report'].map((phase, i) => {
                    const pct = (i + 1) * 25
                    return (
                      <div key={phase} className={`text-center py-0.5 rounded text-[9px] font-semibold transition-all ${
                        progress >= pct ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : progress >= pct - 25 && scanState === 'scanning' ? 'bg-white/5 text-slate-500 border border-white/10 animate-pulse'
                        : 'text-slate-700'
                      }`}>{phase}</div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats strip ── */}
        {scanState === 'complete' && result && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10 flex-shrink-0"
          >
            {[
              { label: 'PASSED RULES', value: `${passed} / ${total}`, sub: 'Policies satisfied', color: 'text-emerald-400' },
              { label: 'FAILED RULES', value: `${failed} / ${total}`, sub: 'Blocking & warning', color: failed > 0 ? 'text-red-400' : 'text-slate-400' },
              { label: 'PASS RATE',    value: `${passRate}%`,          sub: 'Overall policy health', color: parseFloat(passRate) >= 80 ? 'text-emerald-400' : parseFloat(passRate) >= 50 ? 'text-yellow-400' : 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="px-6 py-4">
                <div className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold mb-1">{s.label}</div>
                <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── 2-column: violations + raw JSON ── */}
        <div ref={containerRef} className="flex-1 overflow-hidden flex gap-0 min-h-0">
          {scanState === 'complete' && result ? (
            <>
              {/* Violations */}
              <div className="flex-1 min-w-0 border-r border-white/10 flex flex-col overflow-hidden">
                <div className="px-5 pt-4 pb-3 flex-shrink-0">
                  <div className="flex items-baseline gap-3 mb-1">
                    <h2 className="text-sm font-semibold text-slate-200">Rule Violations</h2>
                    <p className="text-[11px] text-slate-600">Blocking and warning findings from Prisma AIRS Model Security.</p>
                  </div>
                  {/* Violation count pills */}
                  <div className="flex gap-2 mt-2">
                    {blocking > 0 && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-500/40 bg-red-500/10 text-[10px] font-bold text-red-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{blocking} BLOCKING
                      </span>
                    )}
                    {warning > 0 && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-yellow-500/40 bg-yellow-500/10 text-[10px] font-bold text-yellow-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />{warning} WARNING
                      </span>
                    )}
                    {violations.length === 0 && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-[10px] font-bold text-emerald-400">
                        <CheckCircle2 size={10} /> No violations
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
                  {violations.map((v, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <ViolationCard v={v} />
                    </motion.div>
                  ))}
                  {violations.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-slate-700">
                      <CheckCircle2 size={28} className="mb-2" />
                      <p className="text-sm">No rule violations reported</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Drag handle */}
              <div
                onMouseDown={onDragStart}
                className="w-1 flex-shrink-0 cursor-col-resize group relative hover:bg-blue-500/30 transition-colors duration-150 border-r border-white/10"
                title="Drag to resize"
              >
                <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-blue-500/10" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-8 flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="w-0.5 h-4 rounded-full bg-blue-400/60" />
                </div>
              </div>

              {/* Raw JSON — default 1/3, resizable */}
              <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{ width: jsonWidth ?? '33%' }}>
                <div className="px-5 pt-4 pb-3 flex-shrink-0">
                  <h2 className="text-sm font-semibold text-slate-200">Raw JSON Response</h2>
                  <p className="text-[11px] text-slate-600 mt-0.5">Direct output from the Prisma Model Security API.</p>
                </div>
                <div className="flex-1 overflow-auto px-5 pb-5">
                  <CodeBlock code={result} language="json" maxHeight="100%" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
              <ScanSearch size={36} className="text-slate-800" />
              <div>
                <p className="text-sm font-semibold text-slate-600">No scan results yet</p>
                <p className="text-xs text-slate-700 mt-1">Pick a demo preset or enter a model URI and press Scan</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
