import React, { useEffect, useState } from 'react'
import { useAppContext } from '../../../context/AppContext'

// `filterProviders` (optional): predicate on the provider/integration key —
// return false to hide that provider's models. Used by the MCP tab to show only
// Vertex models (the MCP agentic loop runs on Vertex's OpenAI endpoint).
export function ModelPicker({ value, onChange, filterProviders }) {
  const [providers, setProviders] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { state } = useAppContext()
  const isLight = !state.isDark

  useEffect(() => {
    let cancelled = false
    fetch('/api/gateway/models')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { if (!cancelled) { setProviders(data.providers || {}); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e?.message || e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const entries = Object.entries(providers).filter(([prov]) => !filterProviders || filterProviders(prov))
  const allIds = entries.flatMap(([, models]) => models).map(m => m.id)

  // Auto-select the first model if none chosen, or if the current value is no
  // longer offered (e.g. a Bedrock model that's now filtered out of this picker).
  useEffect(() => {
    if (allIds.length > 0 && (!value || !allIds.includes(value))) onChange(allIds[0])
  }, [value, allIds.join(',')])

  if (loading) return <div className="text-[11px] text-slate-500">Loading models…</div>
  if (error) return <div className="text-[11px] text-red-400">Models error: {error}</div>

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Model</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-[12px] font-mono"
        style={{
          background: isLight ? '#ffffff' : 'rgba(15,20,35,0.95)',
          border: `1px solid ${isLight ? 'rgba(0,48,135,0.14)' : 'rgba(255,255,255,0.12)'}`,
          color: isLight ? '#1e293b' : '#e2e8f0',
        }}>
        {entries.map(([provider, models]) => (
          <optgroup key={provider} label={provider}>
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
