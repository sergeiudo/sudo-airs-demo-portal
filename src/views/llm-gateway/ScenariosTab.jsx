import React, { useState } from 'react'
import { Loader2, Play, ChevronDown, Columns3, ShieldCheck, EyeOff, Code, Ban, RotateCcw } from 'lucide-react'
import { ModelPicker } from './components/ModelPicker'
import { LaneCard } from './components/LaneCard'
import { useAppContext } from '../../context/AppContext'
import { LLM_GATEWAY_SCENARIO_GROUPS } from '../../data/llmGatewayAttacks'

const ACCENT = '#ec4899'

const SEVERITY_COLOR = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  none: '#10b981',
}

// Order the compare endpoint returns lanes in.
const LANE_ORDER = ['no-guardrail', 'defaults', 'airs']
const LANE_SHORT = { 'no-guardrail': 'No gateway', defaults: 'Portkey native', airs: 'AIRS' }

function ExpectedPills({ expected, isLight }) {
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {LANE_ORDER.map(id => {
        const v = expected?.[id]
        const blocked = v === 'BLOCKED'
        const redacted = v === 'REDACTED'
        // Block colour by source: AIRS lane = red · native (defaults) = purple.
        const blockColor = id === 'airs' ? '#ef4444' : '#8b5cf6'
        const color = blocked ? blockColor : redacted ? '#f59e0b' : '#10b981'
        return (
          <span key={id} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: `${color}14`, border: `1px solid ${color}44`, color }}>
            {LANE_SHORT[id]}: {v?.toLowerCase() || '—'}
          </span>
        )
      })}
      <span className="text-[10px]" style={{ color: textSecondary }}>(expected)</span>
    </div>
  )
}

// Reference card: what the native Portkey guardrail (pg-sudo-p-c7e4ad) is
// configured to do. Purely informational — mirrors the Portkey console so the
// presenter doesn't have to remember what's enabled.
function NativeGuardrailsBanner({ isLight }) {
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  const blue = '#0ea5e9'
  const checks = [
    {
      icon: EyeOff, title: 'No PII — detect & redact',
      detail: 'EMAIL · PHONE · ADDRESS · NAME · IP · CREDIT_CARD · SSN',
      note: 'masks matches to **** before the model sees them',
    },
    {
      icon: Code, title: 'Contains Code',
      detail: 'Python',
      note: 'flags prompts/responses that contain Python code',
    },
    {
      icon: Ban, title: 'Banned terms',
      detail: 'סרגיי · Chekpoint · Kokomoko',
      note: 'blocks when any of these words appears',
    },
  ]
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: `${blue}0d`, border: `1px solid ${blue}33` }}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold" style={{ color: blue }}>
        <ShieldCheck size={13} /> Active native guardrails
        <span className="font-mono normal-case px-1.5 py-0.5 rounded" style={{ background: `${blue}1a`, color: blue }}>pg-sudo-p-c7e4ad</span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {checks.map(c => {
          const Icon = c.icon
          return (
            <div key={c.title} className="flex flex-col gap-1.5 p-3 rounded-lg"
                 style={{ background: isLight ? '#ffffff' : 'rgba(255,255,255,0.03)', border: `1px solid ${isLight ? 'rgba(0,48,135,0.10)' : 'rgba(255,255,255,0.06)'}` }}>
              <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: textPrimary }}>
                <Icon size={13} style={{ color: blue }} /> {c.title}
              </div>
              <div className="flex flex-wrap gap-1">
                {c.detail.split(' · ').map(d => (
                  <span key={d} className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: `${blue}14`, color: blue }}>{d}</span>
                ))}
              </div>
              <div className="text-[10.5px] leading-snug" style={{ color: textSecondary }}>{c.note}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ScenarioResult({ scenario, lanes, loading, error, isLight, accentColor = ACCENT }) {
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[12px] py-6 justify-center" style={{ color: textSecondary }}>
        <Loader2 size={14} className="animate-spin" /> Running all three lanes…
      </div>
    )
  }
  if (error) {
    return (
      <div className="px-4 py-3 rounded-lg text-[12px]"
           style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)', color: isLight ? '#b91c1c' : '#fca5a5' }}>
        {error}
      </div>
    )
  }
  if (!lanes) {
    return (
      <div className="text-[12px] py-4 text-center" style={{ color: textSecondary }}>
        Press <Play size={11} className="inline -mt-0.5" /> to run this prompt through all three lanes.
      </div>
    )
  }

  // Keep canonical lane order regardless of response ordering.
  const ordered = LANE_ORDER.map(id => lanes.find(l => l.id === id)).filter(Boolean)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {ordered.map(l => <LaneCard key={l.id} lane={l} isLight={isLight} />)}
      </div>

      <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}33` }}>
        <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: accentColor }}>Why each lane behaved this way</div>
        <div className="grid gap-2 text-[12px]" style={{ color: textPrimary, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div><span className="font-semibold">No gateway:</span> {scenario.explainPerLane['no-guardrail']}</div>
          <div><span className="font-semibold">Portkey native:</span> {scenario.explainPerLane['defaults']}</div>
          <div><span className="font-semibold">AIRS:</span> {scenario.explainPerLane['airs']}</div>
        </div>
      </div>
    </div>
  )
}

function ScenarioCard({ scenario, active, lanes, loading, error, promptValue, onPromptChange, onRun, onToggle, isLight, accentColor = ACCENT }) {
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  const sevColor = SEVERITY_COLOR[scenario.severity] || '#64748b'
  const surfaceBg = isLight ? '#ffffff' : 'rgba(15,20,35,0.5)'
  const surfaceBorder = isLight ? 'rgba(0,48,135,0.14)' : 'rgba(255,255,255,0.08)'
  const edited = promptValue !== scenario.prompt

  return (
    <div className="rounded-xl overflow-hidden"
         style={{ background: surfaceBg, border: `1px solid ${active ? `${accentColor}aa` : `${accentColor}40`}` }}>
      <div className="w-full flex items-start gap-3 p-4" style={{ background: active ? `${accentColor}0d` : 'transparent' }}>
        {/* Play = EXECUTE (only this runs the scenario) */}
        <button onClick={(e) => { e.stopPropagation(); onRun() }} disabled={loading}
                title="Run this prompt through all three lanes"
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-opacity hover:opacity-80"
                style={{ background: `${accentColor}1a`, border: `1px solid ${accentColor}66`, color: accentColor, opacity: loading ? 0.6 : 1 }}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
        </button>

        {/* Clicking the body just OPENS/closes the card (no execution) */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold" style={{ color: textPrimary }}>{scenario.label}</span>
            {scenario.severity !== 'none' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
                    style={{ background: `${sevColor}1a`, border: `1px solid ${sevColor}55`, color: sevColor }}>
                {scenario.severity}
              </span>
            )}
            {edited && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
                    style={{ background: `${accentColor}1a`, border: `1px solid ${accentColor}55`, color: accentColor }}>
                custom
              </span>
            )}
          </div>
          {/* Highlighted prompt */}
          <div className="text-[12.5px] font-semibold leading-snug rounded-md px-2.5 py-1.5"
               style={{ color: textPrimary, background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)', border: `1px solid ${surfaceBorder}` }}>
            “{promptValue}”
          </div>
          {edited
            ? <span className="text-[10px] italic" style={{ color: textSecondary }}>custom prompt — expected outcome may differ</span>
            : <ExpectedPills expected={scenario.expected} isLight={isLight} />}
        </div>

        <button onClick={onToggle} className="flex-shrink-0 mt-1" title={active ? 'Collapse' : 'Expand'}>
          <ChevronDown size={16} className="transition-transform"
                       style={{ color: textSecondary, transform: active ? 'rotate(180deg)' : 'rotate(0)' }} />
        </button>
      </div>

      {active && (
        <div className="px-4 pb-4 pt-1 flex flex-col gap-3 border-t" style={{ borderColor: surfaceBorder }}>
          <div className="text-[12px] leading-relaxed pt-3" style={{ color: textPrimary }}>
            <span className="font-semibold" style={{ color: accentColor }}>What this demonstrates · </span>
            {scenario.whatItDemonstrates}
          </div>

          {/* Editable prompt — tweak it or write your own, then Run */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: textSecondary }}>Prompt — edit or write your own</label>
              {edited && (
                <button onClick={() => onPromptChange(scenario.prompt)}
                        className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: textSecondary }}>
                  <RotateCcw size={10} /> reset
                </button>
              )}
            </div>
            <textarea value={promptValue} onChange={(e) => onPromptChange(e.target.value)} rows={2}
                      placeholder="Type any prompt to test…"
                      className="w-full px-3 py-2 rounded-lg text-[12px] resize-y"
                      style={{ background: isLight ? '#ffffff' : 'rgba(15,20,35,0.6)', border: `1px solid ${surfaceBorder}`, color: textPrimary }} />
            <button onClick={onRun} disabled={loading || !promptValue.trim()}
                    className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold"
                    style={{ background: accentColor, color: '#fff', opacity: (loading || !promptValue.trim()) ? 0.5 : 1 }}>
              {loading ? <><Loader2 size={12} className="animate-spin" /> Running…</> : <><Play size={12} /> Run 3 lanes</>}
            </button>
          </div>

          <ScenarioResult scenario={scenario} lanes={lanes} loading={loading} error={error} isLight={isLight} accentColor={accentColor} />
        </div>
      )}
    </div>
  )
}

export function ScenariosTab() {
  const { state } = useAppContext()
  const isLight = !state.isDark
  const [model, setModel] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [prompts, setPrompts] = useState({})   // id -> edited prompt
  const [results, setResults] = useState({})   // id -> lanes[]
  const [loadingId, setLoadingId] = useState(null)
  const [errors, setErrors] = useState({})     // id -> string

  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'

  const getPrompt = (s) => (prompts[s.id] !== undefined ? prompts[s.id] : s.prompt)
  const setPrompt = (id, val) => setPrompts(p => ({ ...p, [id]: val }))

  async function runCompare(s) {
    const prompt = getPrompt(s)
    if (!model || loadingId === s.id || !prompt.trim()) return
    setLoadingId(s.id)
    setErrors(e => ({ ...e, [s.id]: null }))
    try {
      const r = await fetch('/api/gateway/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model }),
      })
      const data = await r.json()
      if (!r.ok) setErrors(e => ({ ...e, [s.id]: data?.message || JSON.stringify(data) }))
      else setResults(res => ({ ...res, [s.id]: data.lanes || [] }))
    } catch (e) {
      setErrors(er => ({ ...er, [s.id]: String(e?.message || e) }))
    } finally {
      setLoadingId(null)
    }
  }

  // Play button → expand + execute. Chevron / body → expand only (no execution).
  const onRun = (s) => { setActiveId(s.id); runCompare(s) }
  const onToggle = (s) => setActiveId(a => (a === s.id ? null : s.id))

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">

        {/* Header + model picker */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold" style={{ color: ACCENT }}>
              <Columns3 size={13} /> Scenarios
            </div>
            <h2 className="text-xl font-bold" style={{ color: textPrimary }}>Press ▶ to run a scenario through all three flows</h2>
            <p className="text-[12px]" style={{ color: textSecondary }}>
              Each fires the prompt at <span className="font-semibold">No gateway</span>,{' '}
              <span className="font-semibold">Portkey native</span> and{' '}
              <span className="font-semibold">Portkey + AIRS</span> in parallel. Click a card to expand and edit the prompt.
            </p>
          </div>
          <div style={{ minWidth: 220 }}>
            <ModelPicker value={model} onChange={setModel} />
          </div>
        </div>

        {/* Groups */}
        {LLM_GATEWAY_SCENARIO_GROUPS.map(group => (
          <div key={group.id} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: group.color }} />
                <span className="text-[14px] font-bold" style={{ color: textPrimary }}>{group.label}</span>
                <span className="text-[11px] font-semibold" style={{ color: group.color }}>· {group.tagline}</span>
              </div>
              <p className="text-[12px] leading-relaxed pl-5" style={{ color: textSecondary }}>{group.intro}</p>
            </div>

            {/* What the native guardrails are configured to catch */}
            {group.id === 'policy' && <NativeGuardrailsBanner isLight={isLight} />}

            <div className="flex flex-col gap-2.5">
              {group.scenarios.map(s => (
                <ScenarioCard key={s.id} scenario={s} isLight={isLight} accentColor={group.color}
                              active={activeId === s.id}
                              lanes={results[s.id]} loading={loadingId === s.id} error={errors[s.id]}
                              promptValue={getPrompt(s)} onPromptChange={(v) => setPrompt(s.id, v)}
                              onRun={() => onRun(s)} onToggle={() => onToggle(s)} />
              ))}
            </div>
          </div>
        ))}

      </div>
    </div>
  )
}
