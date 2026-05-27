import React, { useState } from 'react'
import { Play, Loader2 } from 'lucide-react'
import { LLM_GATEWAY_ATTACKS, LLM_GATEWAY_ATTACK_CATEGORIES } from '../../data/llmGatewayAttacks'
import { LaneCard } from './components/LaneCard'
import { useAppContext } from '../../context/AppContext'

const ACCENT = '#ec4899'
const FIXED_MODEL = '@sudo-vertexai/gemini-2.0-flash-001' // see spec open-question #3 — fixed for fair comparison

export function ShowcaseTab() {
  const { state } = useAppContext()
  const isLight = !state.isDark
  const [selected, setSelected] = useState(LLM_GATEWAY_ATTACKS[0])
  const [running, setRunning] = useState(false)
  const [lanes, setLanes] = useState(null)
  const [error, setError] = useState(null)

  async function runCompare() {
    if (running) return
    setRunning(true)
    setError(null)
    setLanes(null)
    try {
      const r = await fetch('/api/gateway/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: selected.prompt, model: FIXED_MODEL }),
      })
      const data = await r.json()
      if (!r.ok) {
        setError(data?.message || JSON.stringify(data))
      } else {
        setLanes(data.lanes || [])
      }
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      setRunning(false)
    }
  }

  const surfaceBg = isLight ? '#ffffff' : 'rgba(15,20,35,0.6)'
  const surfaceBorder = isLight ? 'rgba(0,48,135,0.14)' : 'rgba(255,255,255,0.08)'
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'

  return (
    <div className="flex flex-1 min-h-0">
      {/* LEFT — attack library */}
      <aside className="flex-shrink-0 flex flex-col gap-3 p-4 border-r overflow-y-auto"
             style={{ width: 320, background: surfaceBg, borderColor: surfaceBorder }}>
        <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: textSecondary }}>Attack Library</div>
        {LLM_GATEWAY_ATTACK_CATEGORIES.map(cat => (
          <div key={cat.id} className="flex flex-col gap-1">
            <div className="text-[10px] font-bold uppercase tracking-wider px-2" style={{ color: cat.color }}>{cat.label}</div>
            {LLM_GATEWAY_ATTACKS.filter(a => a.category === cat.id).map(a => {
              const active = selected.id === a.id
              return (
                <button key={a.id}
                        onClick={() => { setSelected(a); setLanes(null) }}
                        className="text-left px-3 py-2 rounded-lg text-[11px]"
                        style={{
                          background: active ? `${ACCENT}1a` : 'transparent',
                          border: `1px solid ${active ? `${ACCENT}55` : 'transparent'}`,
                          color: active ? ACCENT : textPrimary,
                        }}>
                  <div className="font-semibold leading-tight">{a.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">severity: {a.severity}</div>
                </button>
              )
            })}
          </div>
        ))}
      </aside>

      {/* RIGHT — runner + lanes */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6 gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: textSecondary }}>Prompt</div>
            <div className="text-[13px] mt-1" style={{ color: textPrimary }}>{selected.prompt}</div>
          </div>
          <button onClick={runCompare} disabled={running}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-bold flex-shrink-0"
                  style={{ background: ACCENT, color: '#fff', opacity: running ? 0.6 : 1 }}>
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {running ? 'Running 3 lanes…' : 'Run attack'}
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg text-[12px]" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {lanes && (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {lanes.map(l => <LaneCard key={l.id} lane={l} />)}
          </div>
        )}

        {lanes && (
          <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}33` }}>
            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: ACCENT }}>Why each lane behaved this way</div>
            <div className="grid gap-2 text-[12px]" style={{ color: textPrimary, gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div><span className="font-semibold">No guardrail:</span> {selected.explainPerLane?.['no-guardrail']}</div>
              <div><span className="font-semibold">Portkey defaults:</span> {selected.explainPerLane?.['defaults']}</div>
              <div><span className="font-semibold">AIRS:</span> {selected.explainPerLane?.['airs']}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
