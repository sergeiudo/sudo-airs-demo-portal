import React, { useEffect, useState } from 'react'
import { useAppContext } from '../../../context/AppContext'

export function ModelPicker({ value, onChange }) {
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

  const allIds = Object.values(providers).flat().map(m => m.id)

  // Auto-select first model if none chosen
  useEffect(() => {
    if (!value && allIds.length > 0) onChange(allIds[0])
  }, [value, allIds.length])

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
        {Object.entries(providers).map(([provider, models]) => (
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
