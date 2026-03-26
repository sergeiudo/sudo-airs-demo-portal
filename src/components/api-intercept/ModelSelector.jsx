import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Loader2, CheckCircle2, AlertCircle, RefreshCw, Cpu } from 'lucide-react'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'

const TABS = [
  {
    id: 'vertex',
    label: 'Vertex AI',
    sublabel: 'Google Cloud',
    logo: '/logo-gcp.png',
    activeColor: '#4285F4',
    activeBorder: 'border-blue-500/40',
    activeBg: 'bg-blue-500/10',
  },
  {
    id: 'bedrock',
    label: 'Bedrock',
    sublabel: 'Amazon Web Services',
    logo: '/logo-aws.png',
    activeColor: '#FF9900',
    activeBorder: 'border-orange-500/40',
    activeBg: 'bg-orange-500/10',
  },
  {
    id: 'azure',
    label: 'Azure OpenAI',
    sublabel: 'Microsoft Azure',
    logo: '/logo-azure.png',
    activeColor: '#0078D4',
    activeBorder: 'border-blue-600/40',
    activeBg: 'bg-blue-600/10',
  },
]

const STATUS_DOT = {
  available:    'bg-emerald-400',
  experimental: 'bg-yellow-400',
  legacy:       'bg-slate-500',
  unknown:      'bg-slate-600',
}

export function ModelSelector({ backend, model, onBackendChange, onModelChange }) {
  const theme = useProtectionTheme()
  const [open, setOpen] = useState(false)
  const [vertexModels, setVertexModels] = useState([])
  const [bedrockModels, setBedrockModels] = useState([])
  const [azureModels, setAzureModels] = useState([])
  const [loading, setLoading] = useState({ vertex: false, bedrock: false, azure: false })
  const [errors, setErrors] = useState({ vertex: null, bedrock: null, azure: null })
  const [filter, setFilter] = useState('')
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const fetchModels = async (provider) => {
    setLoading(prev => ({ ...prev, [provider]: true }))
    setErrors(prev => ({ ...prev, [provider]: null }))
    try {
      const res = await fetch(`/api/models/${provider}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load models')
      if (provider === 'vertex') setVertexModels(data.models ?? [])
      else if (provider === 'bedrock') setBedrockModels(data.models ?? [])
      else setAzureModels(data.models ?? [])
    } catch (err) {
      setErrors(prev => ({ ...prev, [provider]: err.message }))
    } finally {
      setLoading(prev => ({ ...prev, [provider]: false }))
    }
  }

  useEffect(() => {
    fetchModels('vertex')
    fetchModels('bedrock')
    fetchModels('azure')
  }, [])

  const currentModels = backend === 'vertex' ? vertexModels : backend === 'azure' ? azureModels : bedrockModels
  const isLoading = loading[backend]
  const error = errors[backend]
  const activeTab = TABS.find(t => t.id === backend)

  const filtered = currentModels.filter(m =>
    m.label?.toLowerCase().includes(filter.toLowerCase()) ||
    m.id?.toLowerCase().includes(filter.toLowerCase()) ||
    m.provider?.toLowerCase().includes(filter.toLowerCase())
  )

  const activeModel = currentModels.find(m => m.id === model) ?? { id: model, label: model }

  return (
    <div className="relative" ref={panelRef}>
      <div className="space-y-2">

        {/* ── Provider tabs ── */}
        <div className="grid grid-cols-3 gap-1.5">
          {TABS.map(tab => {
            const isActive = backend === tab.id
            return (
              <motion.button
                key={tab.id}
                onClick={() => { onBackendChange(tab.id); setFilter('') }}
                whileTap={{ scale: 0.97 }}
                className={`relative flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-xl border transition-all duration-200
                  ${isActive
                    ? `${tab.activeBg} ${tab.activeBorder}`
                    : 'bg-black/20 border-white/10 hover:bg-white/5 hover:border-white/20'
                  }`}
              >
                <img
                  src={tab.logo}
                  alt={tab.label}
                  className="h-5 w-auto object-contain transition-all duration-200"
                  style={{ opacity: isActive ? 1 : 0.4, filter: isActive ? 'none' : 'grayscale(40%)' }}
                />
                <span
                  className="text-[10px] font-semibold leading-tight text-center transition-colors duration-200"
                  style={{ color: isActive ? tab.activeColor : 'rgb(100,116,139)' }}
                >
                  {tab.label}
                </span>
                {/* Active indicator dot */}
                {isActive && (
                  <motion.div
                    layoutId="active-dot"
                    className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: tab.activeColor }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            )
          })}
        </div>

        {/* ── Model picker trigger ── */}
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all duration-200 text-left
            ${open
              ? `${activeTab?.activeBg} ${activeTab?.activeBorder}`
              : 'border-white/10 bg-black/20 hover:border-white/20'
            }`}
        >
          <Cpu size={10} style={{ color: open ? activeTab?.activeColor : '#64748b', flexShrink: 0 }} />
          <span className="flex-1 text-[11px] font-mono text-slate-300 truncate">
            {activeModel.label || activeModel.id}
          </span>
          {isLoading ? (
            <Loader2 size={10} className="animate-spin text-slate-500 flex-shrink-0" />
          ) : (
            <ChevronDown
              size={10}
              className={`text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          )}
        </button>
      </div>

      {/* ── Dropdown panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border overflow-hidden bg-base-800/95 backdrop-blur-xl shadow-2xl shadow-black/60
              ${activeTab?.activeBorder ?? 'border-white/15'}`}
            style={{ minWidth: '230px' }}
          >
            {/* Search + refresh */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
              <img src={activeTab?.logo} alt="" className="h-3.5 w-auto object-contain opacity-60 flex-shrink-0" />
              <input
                autoFocus
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder={`Filter ${activeTab?.label} models…`}
                className="flex-1 bg-transparent text-xs text-slate-300 placeholder-slate-600 outline-none"
              />
              <button
                onClick={() => fetchModels(backend)}
                disabled={isLoading}
                className="text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40 flex-shrink-0"
                title="Refresh"
              >
                <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Model list */}
            <div className="max-h-64 overflow-y-auto">
              {isLoading && filtered.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-6 text-slate-500">
                  <Loader2 size={12} className="animate-spin" />
                  <span className="text-xs">Loading models…</span>
                </div>
              ) : error ? (
                <div className="px-3 py-4 text-center">
                  <AlertCircle size={16} className="text-red-400 mx-auto mb-1" />
                  <p className="text-[10px] text-red-400 mb-2">{error}</p>
                  <button onClick={() => fetchModels(backend)} className="text-[10px] text-slate-500 hover:text-slate-300 underline">
                    Retry
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-600">No models match</div>
              ) : (
                filtered.map((m, i) => {
                  const isSelected = m.id === model
                  const dot = STATUS_DOT[m.status] ?? STATUS_DOT.unknown
                  return (
                    <button
                      key={m.id}
                      onClick={() => { onModelChange(m.id); setOpen(false); setFilter('') }}
                      className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors duration-100 border-l-2
                        ${isSelected
                          ? `${activeTab?.activeBg} border-l-[${activeTab?.activeColor}]`
                          : 'border-l-transparent hover:bg-white/5'
                        }`}
                      style={isSelected ? { borderLeftColor: activeTab?.activeColor } : {}}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-medium truncate"
                            style={{ color: isSelected ? activeTab?.activeColor : '#cbd5e1' }}
                          >
                            {m.label ?? m.id}
                          </span>
                          {m.provider && (
                            <span className="text-[9px] text-slate-600 flex-shrink-0">{m.provider}</span>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-slate-600 truncate block">{m.id}</span>
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={11} className="flex-shrink-0 mt-0.5" style={{ color: activeTab?.activeColor }} />
                      )}
                    </button>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/10">
              <span className="text-[9px] text-slate-600">
                {filtered.length} model{filtered.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[9px]" style={{ color: activeTab?.activeColor, opacity: 0.8 }}>
                {activeTab?.sublabel}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
