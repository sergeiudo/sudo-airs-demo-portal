import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Loader2, CheckCircle2, AlertCircle, RefreshCw, Cpu, ShieldCheck } from 'lucide-react'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'
import { useAppContext } from '../../context/AppContext'

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
  // Not a provider — a ROUTE. The prompt goes through the SCM AI Gateway to
  // Bedrock, and AIRS runs as an in-gateway guardrail rather than as the two
  // direct airscan() calls the other three backends use. Different enforcement
  // point, different SCM tenant, same attack library.
  {
    id: 'aigw',
    label: 'SCM AI-GW',
    sublabel: 'Prisma AIRS Gateway',
    activeColor: '#EC4899',
    activeBorder: 'border-pink-500/40',
    activeBg: 'bg-pink-500/10',
  },
]

// Curated-tier badges. `weak` and `denied` are the two that matter on stage:
// weak models actually comply with an injection, and denied ones are blocked by
// the org SCP rather than by anything in this app.
// Two palettes: the /15 alphas that read on a dark panel are invisible on
// white, so light mode gets solid tints and darker text.
const TIER_BADGE = {
  frontier: { text: 'FRONTIER',   dark: 'bg-sky-500/20 text-sky-300',     light: 'bg-sky-100 text-sky-800' },
  fast:     { text: 'FAST',       dark: 'bg-cyan-500/20 text-cyan-300',   light: 'bg-cyan-100 text-cyan-800' },
  mid:      { text: 'MID',        dark: 'bg-slate-500/25 text-slate-300', light: 'bg-slate-200 text-slate-700' },
  weak:     { text: 'WEAK',       dark: 'bg-amber-500/25 text-amber-300', light: 'bg-amber-100 text-amber-800' },
  denied:   { text: 'SCP DENIED', dark: 'bg-red-500/25 text-red-300',     light: 'bg-red-100 text-red-800' },
}

const STATUS_DOT = {
  available:    'bg-emerald-400',
  experimental: 'bg-yellow-400',
  legacy:       'bg-slate-500',
  unknown:      'bg-slate-600',
}

export function ModelSelector({ backend, model, onBackendChange, onModelChange }) {
  const theme = useProtectionTheme()
  // Reactive theme. Every colour below was hardcoded to dark-theme greys, which
  // rendered the model names near-invisible on the light background.
  const { state } = useAppContext()
  const isLight = state.isDark === false
  const C = {
    panelBg:     isLight ? '#ffffff' : 'rgba(15,20,35,0.97)',
    panelShadow: isLight ? '0 12px 32px rgba(0,48,135,0.14)' : '0 12px 32px rgba(0,0,0,0.6)',
    divider:     isLight ? 'rgba(0,48,135,0.10)' : 'rgba(255,255,255,0.10)',
    name:        isLight ? '#0f172a' : '#e2e8f0',
    meta:        isLight ? '#64748b' : '#94a3b8',
    mono:        isLight ? '#475569' : '#8b9bb4',
    note:        isLight ? '#5b6b7c' : '#94a3b8',
    rowHover:    isLight ? 'rgba(0,48,135,0.05)' : 'rgba(255,255,255,0.05)',
    inputText:   isLight ? '#1e293b' : '#cbd5e1',
  }
  const [open, setOpen] = useState(false)
  const [aigwModels, setAigwModels] = useState([])
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
      else if (provider === 'aigw') setAigwModels(data.models ?? [])
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
    fetchModels('aigw')
  }, [])


  const currentModels = backend === 'vertex' ? vertexModels : backend === 'azure' ? azureModels : backend === 'aigw' ? aigwModels : bedrockModels
  const isLoading = loading[backend]

  // Self-heal a stale selection. If the chosen model is not in the list the
  // server actually serves — a retired id, a model dropped from the curated
  // set, a hand-edited default — the button used to display the raw id and the
  // first send would fail. Fall back to the first selectable model instead.
  useEffect(() => {
    if (isLoading || !currentModels.length) return
    if (currentModels.some((m) => m.id === model)) return
    const fallback = currentModels.find((m) => m.status !== 'unavailable') ?? currentModels[0]
    if (fallback && fallback.id !== model) onModelChange(fallback.id)
  }, [currentModels, isLoading, model, onModelChange])
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
        <div className="grid grid-cols-4 gap-1.5">
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
                {tab.logo ? (
                  <img
                    src={tab.logo}
                    alt={tab.label}
                    className="h-5 w-auto object-contain transition-all duration-200"
                    style={{ opacity: isActive ? 1 : 0.4, filter: isActive ? 'none' : 'grayscale(40%)' }}
                  />
                ) : (
                  // SCM AI-GW ships no vendor logo — it is a route, not a vendor.
                  <ShieldCheck
                    size={20}
                    className="transition-all duration-200"
                    style={{ color: isActive ? tab.activeColor : 'rgb(100,116,139)', opacity: isActive ? 1 : 0.5 }}
                  />
                )}
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
            className={`absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border overflow-hidden backdrop-blur-xl
              ${activeTab?.activeBorder ?? 'border-white/15'}`}
            style={{ minWidth: '300px', background: C.panelBg, boxShadow: C.panelShadow }}
          >
            {/* Search + refresh */}
            <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: C.divider }}>
              <img src={activeTab?.logo} alt="" className="h-3.5 w-auto object-contain opacity-60 flex-shrink-0" />
              <input
                autoFocus
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder={`Filter ${activeTab?.label} models…`}
                className="flex-1 bg-transparent text-xs outline-none" style={{ color: C.inputText }}
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
            <div className="max-h-80 overflow-y-auto">
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
                <div className="py-6 text-center text-xs" style={{ color: C.meta }}>No models match</div>
              ) : (
                filtered.map((m, i) => {
                  const isSelected = m.id === model
                  const dot = STATUS_DOT[m.status] ?? STATUS_DOT.unknown
                  return (
                    <button
                      key={m.id}
                      onClick={() => { onModelChange(m.id); setOpen(false); setFilter('') }}
                      className={`w-full flex items-start gap-2.5 px-3 py-3 text-left transition-colors duration-100 border-l-2
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
                            className="text-[13px] font-semibold truncate"
                            style={{ color: isSelected ? activeTab?.activeColor : C.name }}
                          >
                            {m.label ?? m.id}
                          </span>
                          {m.provider && (
                            <span className="text-[10px] flex-shrink-0" style={{ color: C.meta }}>{m.provider}</span>
                          )}
                          {/* Tier is the whole point of the curated list: which
                              models resist an injection and which comply. */}
                          {/* Never let an untested model look tested. */}
                          {m.verified === false && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 tracking-wide ${isLight ? 'bg-violet-100 text-violet-700' : 'bg-violet-500/25 text-violet-300'}`}>
                              UNVERIFIED
                            </span>
                          )}
                          {m.tier && TIER_BADGE[m.tier] && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 tracking-wide ${isLight ? TIER_BADGE[m.tier].light : TIER_BADGE[m.tier].dark}`}>
                              {TIER_BADGE[m.tier].text}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono truncate block mt-0.5" style={{ color: C.mono }}>{m.id}</span>
                        {m.note && (
                          <span className="text-[10.5px] block leading-snug mt-1" style={{ color: C.note }}>{m.note}</span>
                        )}
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
            <div className="flex items-center justify-between px-3 py-1.5 border-t" style={{ borderColor: C.divider }}>
              <span className="text-[10px]" style={{ color: C.meta }}>
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
