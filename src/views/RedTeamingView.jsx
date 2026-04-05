import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Swords, Play, Square, RefreshCw, Plus, ChevronDown,
  Terminal, Shield, AlertTriangle, CheckCircle2, ExternalLink,
  Target, Layers, BarChart3, Zap, Clock, X, ChevronRight,
} from 'lucide-react'
import { useProtectionTheme } from '../hooks/useProtectionTheme'
import { RobustnessGauge } from '../components/red-teaming/RobustnessGauge'
import { LogEntry } from '../components/red-teaming/LogEntry'
import { RedTeamReport } from '../components/red-teaming/RedTeamReport'

// ─── Static category taxonomy ─────────────────────────────────────────────────
const CATEGORIES = {
  SECURITY: [
    'JAILBREAK', 'PROMPT_INJECTION', 'SYSTEM_PROMPT_LEAK', 'ADVERSARIAL_SUFFIX',
    'EVASION', 'MULTI_TURN', 'REMOTE_CODE_EXECUTION', 'TOOL_LEAK',
    'MALWARE_GENERATION', 'INDIRECT_PROMPT_INJECTION',
  ],
  SAFETY: [
    'BIAS', 'CBRN', 'CYBERCRIME', 'DRUGS', 'HATE_TOXIC_ABUSE',
    'NON_VIOLENT_CRIMES', 'POLITICAL', 'SELF_HARM', 'SEXUAL', 'VIOLENT_CRIMES_WEAPONS',
  ],
  COMPLIANCE: ['OWASP', 'MITRE_ATLAS', 'NIST', 'DASF_V2'],
}

const CAT_COLOR = {
  SECURITY:   { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    dot: 'bg-red-400' },
  SAFETY:     { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-400' },
  COMPLIANCE: { text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   dot: 'bg-blue-400' },
}

const PRESETS = {
  OPENAI: {
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    requestJson: '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"{INPUT}"}]}',
    responseKey: 'choices[0].message.content',
  },
  REST: {
    apiEndpoint: '',
    requestJson: '{"messages":[{"role":"user","content":"{INPUT}"}]}',
    responseKey: 'choices[0].message.content',
  },
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'ABORTED'])

// ─── Target creation form ─────────────────────────────────────────────────────
function CreateTargetForm({ onCreated, onCancel }) {
  const theme = useProtectionTheme()
  const [form, setForm] = useState({
    name: '',
    connectionType: 'OPENAI',
    apiEndpoint: '',
    authHeader: '',
    requestJson: '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"{INPUT}"}]}',
    responseKey: 'choices[0].message.content',
    apiKey: '',
    modelName: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const applyPreset = (type) => {
    const p = PRESETS[type] || PRESETS.REST
    setForm(f => ({ ...f, connectionType: type, ...p }))
  }

  const handleCreate = async () => {
    setErr(''); setSaving(true)
    try {
      let requestJsonObj
      try { requestJsonObj = JSON.parse(form.requestJson) }
      catch { throw new Error('Request JSON is invalid') }

      const headers = { 'Content-Type': 'application/json' }
      if (form.authHeader) headers.Authorization = form.authHeader

      const body = {
        name: form.name || 'SUDO AIRS Demo Target',
        target_type: 'MODEL',
        connection_type: form.connectionType,
        api_endpoint_type: 'PUBLIC',
        response_mode: 'REST',
        session_supported: false,
        connection_params: {
          api_endpoint: form.apiEndpoint,
          request_headers: headers,
          request_json: requestJsonObj,
          response_key: form.responseKey,
          ...(form.connectionType === 'OPENAI' && form.apiKey ? {
            target_connection_config: { api_key: form.apiKey, model_name: form.modelName },
          } : {}),
        },
        target_metadata: { rate_limit_enabled: false, content_filter_enabled: false },
      }

      const res = await fetch('/api/redteam/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Create failed')
      onCreated(data)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 p-3 rounded-xl border border-white/15 bg-black/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">Create Target</span>
        <button onClick={onCancel} className="text-slate-600 hover:text-slate-400"><X size={12} /></button>
      </div>

      {/* Name */}
      <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Target name"
        className="w-full bg-black/40 border border-white/15 text-slate-200 text-xs rounded-lg px-3 py-2 placeholder-slate-700 focus:outline-none focus:border-white/30" />

      {/* Connection type */}
      <div className="flex gap-1">
        {['OPENAI', 'REST'].map(t => (
          <button key={t} onClick={() => applyPreset(t)}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${
              form.connectionType === t
                ? `${theme.primaryBg2} ${theme.primaryText} ${theme.primaryBorder2}`
                : 'border-white/10 text-slate-500 hover:border-white/20'
            }`}>{t}</button>
        ))}
      </div>

      {/* Endpoint */}
      <input value={form.apiEndpoint} onChange={e => set('apiEndpoint', e.target.value)}
        placeholder="https://api.openai.com/v1/chat/completions"
        className="w-full bg-black/40 border border-white/15 text-slate-200 text-[10px] font-mono rounded-lg px-3 py-2 placeholder-slate-700 focus:outline-none focus:border-white/30" />

      {/* Auth header */}
      <input value={form.authHeader} onChange={e => set('authHeader', e.target.value)}
        placeholder="Bearer sk-..."
        className="w-full bg-black/40 border border-white/15 text-slate-200 text-[10px] font-mono rounded-lg px-3 py-2 placeholder-slate-700 focus:outline-none focus:border-white/30" />

      {/* Request JSON */}
      <div>
        <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">Request Template (use {'{INPUT}'} placeholder)</div>
        <textarea value={form.requestJson} onChange={e => set('requestJson', e.target.value)} rows={3}
          className="w-full bg-black/40 border border-white/15 text-slate-300 text-[10px] font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-white/30 resize-none" />
      </div>

      {/* Response key */}
      <input value={form.responseKey} onChange={e => set('responseKey', e.target.value)}
        placeholder="choices[0].message.content"
        className="w-full bg-black/40 border border-white/15 text-slate-200 text-[10px] font-mono rounded-lg px-3 py-2 placeholder-slate-700 focus:outline-none focus:border-white/30" />

      {err && <p className="text-[10px] text-red-400">{err}</p>}

      <button onClick={handleCreate} disabled={saving || !form.apiEndpoint}
        className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${
          saving || !form.apiEndpoint
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
            : `${theme.isProtected ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'} hover:brightness-110`
        }`}>
        {saving ? 'Creating…' : 'Create Target'}
      </button>
    </div>
  )
}

// ─── Category picker ──────────────────────────────────────────────────────────
function CategoryPicker({ selected, onChange }) {
  const toggle = (cat, sub) => {
    const next = { ...selected }
    if (!next[cat]) next[cat] = []
    if (next[cat].includes(sub)) {
      next[cat] = next[cat].filter(s => s !== sub)
      if (!next[cat].length) delete next[cat]
    } else {
      next[cat] = [...next[cat], sub]
    }
    onChange(next)
  }

  const toggleAll = (cat) => {
    const next = { ...selected }
    if (next[cat]?.length === CATEGORIES[cat].length) {
      delete next[cat]
    } else {
      next[cat] = [...CATEGORIES[cat]]
    }
    onChange(next)
  }

  const totalSelected = Object.values(selected).flat().length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">Attack Categories</div>
        <span className="text-[9px] text-slate-500">{totalSelected} selected</span>
      </div>
      {Object.entries(CATEGORIES).map(([cat, subs]) => {
        const c = CAT_COLOR[cat]
        const selCount = selected[cat]?.length || 0
        const allSel = selCount === subs.length
        return (
          <div key={cat} className={`rounded-xl border ${c.border} ${c.bg} overflow-hidden`}>
            <button onClick={() => toggleAll(cat)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left">
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                allSel ? `${c.bg} ${c.border} border` : selCount > 0 ? `${c.bg} ${c.border} border` : 'border-white/20'
              }`}>
                {allSel ? <CheckCircle2 size={10} className={c.text} />
                  : selCount > 0 ? <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} /> : null}
              </div>
              <span className={`flex-1 text-xs font-semibold ${c.text}`}>{cat}</span>
              <span className="text-[9px] text-slate-600">{selCount}/{subs.length}</span>
            </button>
            <div className="flex flex-wrap gap-1 px-3 pb-2">
              {subs.map(sub => {
                const on = selected[cat]?.includes(sub)
                return (
                  <button key={sub} onClick={() => toggle(cat, sub)}
                    className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border transition-all ${
                      on ? `${c.bg} ${c.text} ${c.border}` : 'border-white/10 text-slate-700 hover:border-white/20 hover:text-slate-500'
                    }`}>
                    {sub.replace(/_/g, ' ')}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────
export function RedTeamingView() {
  const theme = useProtectionTheme()

  // Targets
  const [targets, setTargets]         = useState([])
  const [targetsLoading, setTargetsLoading] = useState(true)
  const [selectedTarget, setSelectedTarget] = useState(null)
  const [showCreate, setShowCreate]   = useState(false)

  // Job config
  const [jobType, setJobType]         = useState('STATIC')
  const [categories, setCategories]   = useState({ SECURITY: ['JAILBREAK', 'PROMPT_INJECTION', 'SYSTEM_PROMPT_LEAK'] })

  // Running job state
  const [jobId, setJobId]             = useState(null)
  const [jobStatus, setJobStatus]     = useState(null) // full job object
  const [attacks, setAttacks]         = useState([])
  const [report, setReport]           = useState(null)
  const [isRunning, setIsRunning]     = useState(false)

  const pollRef = useRef(null)
  const attackPollRef = useRef(null)
  const attackDelayRef = useRef(null)

  const stopPolling = useCallback(() => {
    clearInterval(pollRef.current)
    clearInterval(attackPollRef.current)
    clearTimeout(attackDelayRef.current)
  }, [])

  // Load targets on mount
  useEffect(() => {
    fetch('/api/redteam/targets')
      .then(r => r.json())
      .then(d => {
        const list = d.data || []
        setTargets(list)
        if (list.length > 0) setSelectedTarget(list[0])
      })
      .catch(() => {})
      .finally(() => setTargetsLoading(false))
  }, [])

  // Poll job status
  const pollStatus = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/redteam/scan/${id}`)
      const data = await res.json()
      setJobStatus(prev =>
        prev?.status === data.status && prev?.completed === data.completed && prev?.total === data.total
          ? prev
          : data
      )
      if (TERMINAL_STATUSES.has(data.status)) {
        stopPolling()
        setIsRunning(false)
        // Fetch final report
        if (data.status === 'COMPLETED') {
          fetch(`/api/redteam/scan/${id}/report`)
            .then(r => r.json())
            .then(setReport)
            .catch(() => {})
        }
      }
    } catch {}
  }, [stopPolling])

  // Poll attacks
  const pollAttacks = useCallback(async (id) => {
    try {
      // Fetch both bypassed and blocked separately so threat is always set
      const [bypRes, blkRes] = await Promise.all([
        fetch(`/api/redteam/scan/${id}/attacks?limit=50&threat=true`),
        fetch(`/api/redteam/scan/${id}/attacks?limit=50&threat=false`),
      ])
      const [bypData, blkData] = await Promise.all([bypRes.json(), blkRes.json()])
      const combined = [
        ...(bypData.data || []),
        ...(blkData.data || []),
      ].sort((a, b) => (a.uuid > b.uuid ? 1 : -1))
      if (combined.length) setAttacks(prev => prev.length === combined.length ? prev : combined)
    } catch {}
  }, [])

  const handleLaunch = async () => {
    if (!selectedTarget) return
    setAttacks([]); setReport(null); setJobStatus(null)

    const body = {
      name: `SUDO AIRS Demo · ${selectedTarget.name} · ${new Date().toLocaleTimeString()}`,
      target: { uuid: selectedTarget.uuid },
      job_type: jobType,
      job_metadata: jobType === 'STATIC'
        ? { categories, rate_limit_enabled: false, content_filter_enabled: false }
        : { rate_limit_enabled: false, content_filter_enabled: false },
    }

    const res  = await fetch('/api/redteam/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok || !data.uuid) { console.error('Launch failed', data); return }

    setJobId(data.uuid)
    setJobStatus(data)
    setIsRunning(true)

    pollRef.current       = setInterval(() => pollStatus(data.uuid), 8000)
    attackPollRef.current = setInterval(() => pollAttacks(data.uuid), 10000)
    pollStatus(data.uuid)
    attackDelayRef.current = setTimeout(() => pollAttacks(data.uuid), 5000)
  }

  const handleAbort = async () => {
    if (!jobId) return
    await fetch(`/api/redteam/scan/${jobId}/abort`, { method: 'POST' })
    stopPolling()
    setIsRunning(false)
  }

  useEffect(() => () => stopPolling(), [stopPolling])

  // Derived stats
  const pct       = jobStatus?.total > 0 ? Math.round((jobStatus.completed / jobStatus.total) * 100) : 0
  const asr       = jobStatus?.asr ?? report?.asr ?? null
  const score     = jobStatus?.score ?? report?.score ?? 0
  const { bypassed, blocked } = useMemo(() => {
    let bypassed = 0, blocked = 0
    for (const a of attacks) a.threat ? bypassed++ : blocked++
    return { bypassed, blocked }
  }, [attacks])

  const scmUrl = jobId
    ? `https://stratacloudmanager.paloaltonetworks.com/ai-security/red-team/scans/${jobId}/overview`
    : null

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── LEFT: Campaign Builder ── */}
      <div className="w-[340px] flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden bg-base-900/30">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
          <Swords size={14} className={theme.primaryText} />
          <span className="text-xs font-semibold text-slate-300">Campaign Builder</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Target selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">Target</div>
              <button onClick={() => setShowCreate(v => !v)}
                className={`flex items-center gap-1 text-[9px] font-semibold transition-colors ${showCreate ? theme.primaryText : 'text-slate-600 hover:text-slate-400'}`}>
                <Plus size={9} /> {showCreate ? 'Cancel' : 'New target'}
              </button>
            </div>

            {showCreate
              ? <CreateTargetForm
                  onCreated={(t) => { setTargets(v => [t, ...v]); setSelectedTarget(t); setShowCreate(false) }}
                  onCancel={() => setShowCreate(false)} />
              : targetsLoading
              ? <div className="flex items-center gap-2 p-3 text-slate-600"><RefreshCw size={12} className="animate-spin" /><span className="text-xs">Loading targets…</span></div>
              : targets.length === 0
              ? <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03] text-center">
                  <Target size={20} className="mx-auto mb-1.5 text-slate-700" />
                  <p className="text-xs text-slate-600">No targets yet</p>
                  <p className="text-[10px] text-slate-700">Create one above or add targets in SCM</p>
                </div>
              : <div className="space-y-1.5">
                  {targets.map(t => (
                    <button key={t.uuid} onClick={() => setSelectedTarget(t)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        selectedTarget?.uuid === t.uuid
                          ? `${theme.primaryBorder2} ${theme.primaryBg2}`
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        selectedTarget?.uuid === t.uuid ? theme.primaryBg2 : 'bg-white/5'
                      }`}>
                        <Target size={12} className={selectedTarget?.uuid === t.uuid ? theme.primaryText : 'text-slate-500'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-200 truncate">{t.name}</div>
                        <div className="text-[9px] text-slate-600">{t.target_type} · {t.connection_type}</div>
                      </div>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                        t.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'
                      }`}>{t.status}</span>
                    </button>
                  ))}
                </div>
            }
          </div>

          {/* Job type */}
          <div>
            <div className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold mb-2">Job Type</div>
            <div className="flex p-1 bg-black/40 rounded-lg border border-white/10 gap-1">
              {[
                { id: 'STATIC', label: 'Static Library' },
                { id: 'DYNAMIC', label: 'Dynamic Agent' },
              ].map(jt => (
                <button key={jt.id} onClick={() => setJobType(jt.id)}
                  className={`relative flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
                    jobType === jt.id ? '' : 'text-slate-500 hover:text-slate-400'
                  }`}>
                  {jobType === jt.id && (
                    <motion.span layoutId="jt-pill"
                      className={`absolute inset-0 rounded-md ${theme.primaryBg2} border ${theme.primaryBorder2}`}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                  )}
                  <span className={`relative z-10 ${jobType === jt.id ? theme.primaryText : ''}`}>{jt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Category picker (STATIC only) */}
          {jobType === 'STATIC' && (
            <CategoryPicker selected={categories} onChange={setCategories} />
          )}

          {jobType === 'DYNAMIC' && (
            <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03]">
              <p className="text-xs text-slate-500">Dynamic mode uses an AI agent to generate contextual multi-turn attacks based on your target's use case.</p>
              <p className="text-[10px] text-slate-700 mt-1">Configure attack goals in SCM before launching.</p>
            </div>
          )}

          {/* AIRS protection note */}
          <div className={`p-3 rounded-xl border transition-all duration-500 ${
            theme.isProtected
              ? 'bg-emerald-500/10 border-emerald-500/25'
              : 'bg-red-500/10 border-red-500/25'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={10} className={theme.primaryText} />
              <span className={`text-[10px] font-semibold ${theme.primaryText}`}>
                {theme.isProtected ? 'AIRS Protection Active' : 'Unprotected Mode'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              {theme.isProtected
                ? 'Red team attacks will be intercepted by AIRS. Lower ASR = stronger protection.'
                : 'Toggle protection to see how AIRS reduces attack success rate.'}
            </p>
          </div>

          {/* Launch / Abort */}
          <motion.button
            onClick={isRunning ? handleAbort : handleLaunch}
            disabled={!selectedTarget && !isRunning}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 shadow-lg ${
              isRunning
                ? 'bg-red-500 text-white hover:bg-red-400'
                : !selectedTarget
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                : theme.isProtected
                ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                : 'bg-red-500 text-white hover:bg-red-400'
            }`}
            whileTap={{ scale: 0.97 }}
          >
            {isRunning ? <><Square size={14} /> Abort Campaign</> : <><Play size={14} /> Launch Campaign</>}
          </motion.button>
        </div>
      </div>

      {/* ── RIGHT: Live results ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Score strip */}
        <div className={`flex items-center gap-6 px-6 py-4 border-b border-white/10 flex-shrink-0 transition-all duration-500 ${
          isRunning ? theme.primaryBg2 : ''
        }`}>
          <RobustnessGauge score={Math.round(100 - (asr ?? 0))} isRunning={isRunning} />

          <div className="flex-1 grid grid-cols-3 gap-3">
            {/* Job status */}
            <div className="col-span-3 flex items-center gap-3 mb-1">
              {jobStatus ? (
                <>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    jobStatus.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : jobStatus.status === 'RUNNING'   ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 animate-pulse'
                    : jobStatus.status === 'QUEUED'    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                    : jobStatus.status === 'FAILED'    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    :                                    'bg-slate-700 text-slate-400 border-slate-600'
                  }`}>{jobStatus.status}</span>
                  <span className="text-xs text-slate-500">{jobStatus.name}</span>
                  {isRunning && jobStatus.total > 0 && (
                    <span className="text-[10px] text-slate-600 ml-auto font-mono">{jobStatus.completed}/{jobStatus.total} attacks</span>
                  )}
                  {scmUrl && (
                    <a href={scmUrl} target="_blank" rel="noopener noreferrer"
                      className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-all ${theme.primaryBg2} ${theme.primaryBorder2} ${theme.primaryText} ${theme.primaryHoverBg2}`}>
                      <ExternalLink size={10} /> View in SCM
                    </a>
                  )}
                </>
              ) : (
                <span className="text-xs text-slate-600">No campaign running — configure a target and launch</span>
              )}
            </div>

            {/* Progress bar (running) */}
            {jobStatus && !TERMINAL_STATUSES.has(jobStatus.status) && jobStatus.total > 0 && (
              <div className="col-span-3">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-blue-500 rounded-full"
                    animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                </div>
              </div>
            )}

            {/* Stats */}
            {attacks.length > 0 && [
              { label: 'Total Sent',  value: attacks.length, color: 'text-slate-300' },
              { label: 'Bypassed',   value: bypassed, color: 'text-red-400' },
              { label: 'Blocked',    value: blocked,  color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="text-center p-2.5 rounded-xl bg-white/5 border border-white/10">
                <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
                <div className="text-[9px] text-slate-600">{s.label}</div>
              </div>
            ))}

            {/* ASR */}
            {asr != null && (
              <div className="text-center p-2.5 rounded-xl bg-white/5 border border-white/10">
                <div className={`text-xl font-bold font-mono ${asr > 50 ? 'text-red-400' : asr > 20 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  {asr.toFixed(1)}%
                </div>
                <div className="text-[9px] text-slate-600">ASR</div>
              </div>
            )}
          </div>
        </div>

        {/* Report summary (when complete) */}
        <RedTeamReport report={report} />

        {/* Attack log */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 flex-shrink-0">
          <Terminal size={12} className={theme.primaryText} />
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Attack Log</span>
          {isRunning && (
            <span className={`flex items-center gap-1.5 text-[9px] font-bold ${theme.primaryText}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${theme.pulseColor} animate-pulse`} /> LIVE
            </span>
          )}
          {attacks.length > 0 && (
            <span className="ml-auto text-[10px] text-slate-600">{attacks.length} attacks</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {attacks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <Terminal size={32} className="text-slate-800" />
              <div>
                <p className="text-sm font-semibold text-slate-600">Attack log will appear here</p>
                <p className="text-xs text-slate-700 mt-1">Select a target and launch a campaign</p>
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {attacks.map(a => <LogEntry key={a.uuid} entry={a} />)}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}
