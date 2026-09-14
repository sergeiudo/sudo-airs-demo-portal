import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Loader2, CheckCircle2, AlertCircle, RefreshCw, Cpu, ShieldCheck, Building2, KeyRound, Copy, Check } from 'lucide-react'
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
// an org-level policy rather than by anything in this app — an AWS SCP on
// Bedrock, `vertexai.allowedModels` on Vertex, which is why the badge says
// POLICY rather than naming either mechanism.
// Two palettes: the /15 alphas that read on a dark panel are invisible on
// white, so light mode gets solid tints and darker text.
const TIER_BADGE = {
  frontier: { text: 'FRONTIER',   dark: 'bg-sky-500/20 text-sky-300',     light: 'bg-sky-100 text-sky-800' },
  fast:     { text: 'FAST',       dark: 'bg-cyan-500/20 text-cyan-300',   light: 'bg-cyan-100 text-cyan-800' },
  mid:      { text: 'MID',        dark: 'bg-slate-500/25 text-slate-300', light: 'bg-slate-200 text-slate-700' },
  weak:     { text: 'WEAK',       dark: 'bg-amber-500/25 text-amber-300', light: 'bg-amber-100 text-amber-800' },
  denied:   { text: 'POLICY DENIED', dark: 'bg-red-500/25 text-red-300',  light: 'bg-red-100 text-red-800' },
}

// The one command that brings Vertex back when the corp SSO session behind ADC
// lapses. Kept as a constant so the rail note and the clipboard never drift.
const ADC_LOGIN_CMD = 'gcloud auth application-default login'

// A Portkey integration slug says which cloud a row lands in, but `@sudo-bedrock`
// is jargon to a customer. The heading spells the cloud out and keeps the slug
// beside it, because the slug is what appears in the model id and in SCM logs.
const PROVIDER_TITLE = {
  '@sudo-bedrock':  'AWS Bedrock',
  '@sudo-vertexai': 'Google Vertex AI',
}

function providerHeading(p) {
  const slug = /(@[\w-]+)/.exec(p || '')?.[1]
  if (!slug) return p || 'Models'
  return `${PROVIDER_TITLE[slug] ?? slug} · ${slug}`
}

// Cloud colours, not protection colours: orange is AWS, blue is Google. This
// chip answers "where does this call actually land" at a glance, so it must not
// be confused with the pink/green the guardrail owns.
const SLUG_CHIP = {
  '@sudo-bedrock':  { text: 'AWS',    fg: '#b45309', bg: 'rgba(245,158,11,0.16)' },
  '@sudo-vertexai': { text: 'GCP',    fg: '#1d4ed8', bg: 'rgba(66,133,244,0.16)' },
}

const STATUS_DOT = {
  available:    'bg-emerald-400',
  experimental: 'bg-yellow-400',
  legacy:       'bg-slate-500',
  unknown:      'bg-slate-600',
}

export function ModelSelector({ backend, model, onBackendChange, onModelChange }) {
  const [tenantOpen, setTenantOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authCopied, setAuthCopied] = useState(false)
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
  // Read off the id, not the picker's provider field — the id is what actually
  // routes, and a stale/unknown selection should show nothing rather than lie.
  const activeSlug = /^(@[\w-]+)\//.exec(String(model || ''))?.[1] ?? null

  /**
   * Grouped by provider, in the order the server returned them.
   *
   * On the AI-GW backend `provider` is the integration slug, and that is the
   * one thing a viewer has to be able to see at a glance now that one gateway
   * fronts two clouds — a flat list repeating "via @sudo-bedrock" on every row
   * made the Vertex models impossible to find and the distinction easy to miss.
   * The other backends group by vendor for free, which is also an improvement.
   * A single group means no header: grouping one pile under its own name is
   * just a wasted row.
   */
  const groups = useMemo(() => {
    const out = []
    const byKey = new Map()
    for (const m of filtered) {
      const key = m.provider || ''
      if (!byKey.has(key)) {
        const g = { key, models: [] }
        byKey.set(key, g)
        out.push(g)
      }
      byKey.get(key).models.push(m)
    }
    return out
  }, [filtered])
  const grouped = groups.length > 1

  /**
   * Collapsible provider sections.
   *
   * Default is derived, not stored: the group holding the current selection is
   * open and the others are shut, so you land on where you already are with the
   * other cloud one click away instead of ten rows of scrolling. A click
   * records an override for that group only. While a filter is active every
   * group opens — a search that hides its own matches is broken.
   */
  const [openOverride, setOpenOverride] = useState({})
  const groupHasActive = (g) => g.models.some((m) => m.id === model)
  const isGroupOpen = (g) => (filter ? true : (openOverride[g.key] ?? groupHasActive(g)))
  const toggleGroup = (g) =>
    setOpenOverride((prev) => ({ ...prev, [g.key]: !(prev[g.key] ?? groupHasActive(g)) }))

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
          {/* Which cloud the selected model routes to, on the closed control.
              With one gateway fronting two providers, the model name alone does
              not say where the call lands — and that is the entire point of the
              backend. Only rendered when the id carries an integration slug. */}
          {activeSlug && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide flex-shrink-0"
              style={{
                color: SLUG_CHIP[activeSlug]?.fg ?? C.meta,
                background: SLUG_CHIP[activeSlug]?.bg ?? 'transparent',
              }}
            >
              {SLUG_CHIP[activeSlug]?.text ?? activeSlug}
            </span>
          )}
          {isLoading ? (
            <Loader2 size={10} className="animate-spin text-slate-500 flex-shrink-0" />
          ) : (
            <ChevronDown
              size={10}
              className={`text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          )}
        </button>

        {/* ── Which SCM tenant this backend logs to ──
            The AI-GW route is enforced by a guardrail on the personal tenant,
            so its scans never appear in the team console the other three
            backends use. Without this line the audience looks for the log in
            the wrong place and concludes nothing was scanned. */}
        {/* Collapsed to one line by default. The fact has to be *available* —
            an audience that looks in the team console sees nothing and
            concludes nothing was scanned — but it is a footnote, and at full
            height it was pushing the attack library off the panel. */}
        {backend === 'aigw' && (
          <div
            className="rounded-lg border overflow-hidden"
            style={{
              background: isLight ? 'rgba(236,72,153,0.07)' : 'rgba(236,72,153,0.10)',
              borderColor: isLight ? 'rgba(236,72,153,0.28)' : 'rgba(236,72,153,0.30)',
            }}
          >
            <button
              onClick={() => setTenantOpen((o) => !o)}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left"
              title="Which SCM tenant this backend logs to"
            >
              <Building2 size={10} style={{ color: '#EC4899', flexShrink: 0 }} />
              <span className="text-[9.5px] font-bold flex-1 min-w-0 truncate" style={{ color: '#EC4899' }}>
                Logs → SUDO-Personal · TSG 1698236796
              </span>
              <ChevronDown size={10} style={{
                color: '#EC4899', flexShrink: 0,
                transform: tenantOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms',
              }} />
            </button>
            <AnimatePresence initial={false}>
              {tenantOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                            className="overflow-hidden">
                  <p className="text-[9.5px] px-2.5 pb-2 leading-snug" style={{ color: C.note }}>
                    Same tenant as Ministry of Health. Vertex, Bedrock and Azure log to the team
                    tenant instead — an AI-GW scan will not appear in their console.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── How Vertex authenticates, and the one command that renews it ──
            There is no key file for this backend any more: local runs on an ADC
            login that dies with the corp SSO session, EC2 on keyless Workload
            Identity Federation. When it lapses the only symptom is a FAULT
            chip, so the fix lives here, one click from copyable, rather than
            being remembered mid-demo. Collapsed by default like the tenant
            note — this is a footnote until the moment it is the whole problem. */}
        {backend === 'vertex' && (
          <div
            className="rounded-lg border overflow-hidden"
            style={{
              background: isLight ? 'rgba(66,133,244,0.07)' : 'rgba(66,133,244,0.10)',
              borderColor: isLight ? 'rgba(66,133,244,0.28)' : 'rgba(66,133,244,0.30)',
            }}
          >
            <button
              onClick={() => setAuthOpen((o) => !o)}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left"
              title="How this backend authenticates, and how to renew it"
            >
              <KeyRound size={10} style={{ color: '#4285F4', flexShrink: 0 }} />
              <span className="text-[9.5px] font-bold flex-1 min-w-0 truncate" style={{ color: '#4285F4' }}>
                Auth → keyless ADC · renew if FAULT
              </span>
              <ChevronDown size={10} style={{
                color: '#4285F4', flexShrink: 0,
                transform: authOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms',
              }} />
            </button>
            <AnimatePresence initial={false}>
              {authOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                            className="overflow-hidden">
                  <div className="px-2.5 pb-2">
                    <p className="text-[9.5px] leading-snug mb-1.5" style={{ color: C.note }}>
                      No service-account key: corp policy caps them at 30 days. Local uses an
                      Application Default Credentials login; EC2 uses Workload Identity Federation
                      off its instance role and never expires.
                    </p>
                    <div
                      className="flex items-center gap-1.5 rounded px-2 py-1.5"
                      style={{
                        background: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <code className="text-[9.5px] flex-1 min-w-0 break-all" style={{ color: C.name, userSelect: 'all' }}>
                        {ADC_LOGIN_CMD}
                      </code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard?.writeText(ADC_LOGIN_CMD)
                          setAuthCopied(true)
                          setTimeout(() => setAuthCopied(false), 1200)
                        }}
                        title="Copy"
                        style={{ color: authCopied ? '#16a34a' : C.note, flexShrink: 0 }}
                      >
                        {authCopied ? <Check size={11} /> : <Copy size={11} />}
                      </button>
                    </div>
                    <p className="text-[9px] leading-snug mt-1.5" style={{ color: C.note }}>
                      Then restart the Express server — GoogleAuth caches its client.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
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
            style={{ minWidth: '250px', maxWidth: '100%', background: C.panelBg, boxShadow: C.panelShadow }}
          >
            {/* Search + refresh */}
            <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: C.divider }}>
              {activeTab?.logo
                ? <img src={activeTab.logo} alt="" className="h-3.5 w-auto object-contain opacity-60 flex-shrink-0" />
                : <ShieldCheck size={13} className="flex-shrink-0" style={{ color: activeTab?.activeColor, opacity: 0.7 }} />}
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
                groups.map((g) => (
                  <div key={g.key || 'all'}>
                    {grouped && (
                      // Sticky: with two clouds in one list, the heading has to
                      // stay on screen while you scroll or you lose track of
                      // which provider you are looking at halfway down.
                      <button
                        type="button"
                        onClick={() => toggleGroup(g)}
                        className="sticky top-0 z-10 w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                        style={{ background: C.panelBg, borderBottom: `1px solid ${C.divider}` }}
                        title={isGroupOpen(g) ? 'Collapse this provider' : 'Expand this provider'}
                      >
                        <ChevronDown
                          size={10}
                          className="flex-shrink-0"
                          style={{
                            color: C.meta,
                            transform: isGroupOpen(g) ? 'none' : 'rotate(-90deg)',
                            transition: 'transform 160ms',
                          }}
                        />
                        {/* Cloud dot: the same orange/blue as the chip on the
                            closed control, so the eye links the two. */}
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: SLUG_CHIP[/(@[\w-]+)/.exec(g.key || '')?.[1]]?.fg ?? C.meta }}
                        />
                        <span
                          className="text-[9px] font-bold tracking-[0.1em] uppercase truncate"
                          style={{ color: isLight ? '#334155' : '#cbd5e1' }}
                        >
                          {providerHeading(g.key)}
                        </span>
                        <span className="flex-1 h-px" style={{ background: C.divider }} />
                        {groupHasActive(g) && (
                          <span
                            className="text-[8.5px] font-bold px-1.5 py-0.5 rounded tracking-wide flex-shrink-0"
                            style={{ color: activeTab?.activeColor, background: `${activeTab?.activeColor}1f` }}
                          >
                            IN USE
                          </span>
                        )}
                        <span className="text-[9px] font-mono flex-shrink-0" style={{ color: C.meta }}>
                          {g.models.length}
                        </span>
                      </button>
                    )}
                    {grouped && !isGroupOpen(g) ? null : g.models.map((m) => {
                      const isSelected = m.id === model
                      const dot = STATUS_DOT[m.status] ?? STATUS_DOT.unknown
                      const denied = m.tier === 'denied'
                      // Inside a provider group the slug prefix is repeated on
                      // every id and adds nothing — show the bare model name.
                      const shownId = grouped ? m.id.replace(/^@[\w-]+\//, '') : m.id
                      return (
                        <button
                          key={m.id}
                          onClick={() => { onModelChange(m.id); setOpen(false); setFilter('') }}
                          className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors duration-100 border-l-2
                            ${isSelected
                              ? `${activeTab?.activeBg} border-l-[${activeTab?.activeColor}]`
                              : 'border-l-transparent hover:bg-white/5'
                            }`}
                          style={{
                            ...(isSelected ? { borderLeftColor: activeTab?.activeColor } : {}),
                            // A denied model is selectable-looking but useless;
                            // dimming it says so before the click does.
                            opacity: denied ? 0.6 : 1,
                          }}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="text-[13px] font-semibold truncate"
                                style={{ color: isSelected ? activeTab?.activeColor : C.name }}
                              >
                                {m.label ?? m.id}
                              </span>
                              {/* Tier is the whole point of the curated list:
                                  which models resist an injection and which
                                  comply. On the title line so it is scannable. */}
                              {m.tier && TIER_BADGE[m.tier] && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide flex-shrink-0 ${isLight ? TIER_BADGE[m.tier].light : TIER_BADGE[m.tier].dark}`}>
                                  {TIER_BADGE[m.tier].text}
                                </span>
                              )}
                              {/* Never let an untested model look tested — but a
                                  denied one is not "untested", it is blocked, and
                                  two badges saying so is noise. */}
                              {m.verified === false && !denied && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide flex-shrink-0 ${isLight ? 'bg-violet-100 text-violet-700' : 'bg-violet-500/25 text-violet-300'}`}>
                                  UNVERIFIED
                                </span>
                              )}
                            </div>
                            {!grouped && m.provider && (
                              <span className="text-[10px] block mt-0.5" style={{ color: C.meta }}>{m.provider}</span>
                            )}
                            <span className="text-[10px] font-mono truncate block mt-0.5" style={{ color: C.mono }}>{shownId}</span>
                            {m.note && (
                              <span className="text-[10.5px] block leading-snug mt-1" style={{ color: C.note }}>{m.note}</span>
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircle2 size={11} className="flex-shrink-0 mt-0.5" style={{ color: activeTab?.activeColor }} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))
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
