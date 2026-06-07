import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, RefreshCw, ExternalLink, Calendar, Clock, CheckCircle2, AlertCircle, Server, Cpu, HardDrive, Activity, ChevronDown, X, Filter } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import airsLogo from '../../prisma-AIRS_RGB_logo_Lockup_Negative.png'

// PA now publishes a single by-date feed; each feature carries one or more tag groups.
const MONTH_ACCENT = '#3b82f6'

// Colour per product sub-category (shown as a badge in each card's top-right corner).
const CATEGORY_COLORS = {
  'AI Runtime Firewall': '#ef4444',
  'AI Runtime API':      '#3b82f6',
  'AI Model Security':   '#8b5cf6',
  'AI Red Teaming':      '#f97316',
  'Core':                '#0ea5e9',
  'Prisma AIRS':         '#64748b',
  'General':             '#64748b',
}
const catColor = (c) => CATEGORY_COLORS[c] || '#64748b'

// Distinct product sub-categories for a feature (middle tag segment), e.g. ["Core","AI Red Teaming"].
function featureCategories(f) {
  const subs = [...new Set((f.tags || []).filter(g => g.length >= 3).map(g => g[1]))]
  if (subs.length) return subs
  const parent = (f.tags && f.tags[0] && f.tags[0][0]) || null
  return parent ? [parent] : []
}

function MonthSection({ month, index, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const accent = MONTH_ACCENT

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${accent}25`, background: '#ffffff', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
    >
      {/* Month header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-slate-50"
        style={{ borderBottom: open ? `1px solid ${accent}15` : 'none' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}12`, border: `1px solid ${accent}30` }}>
          <Calendar size={16} style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-black" style={{ color: accent }}>{month.label}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {month.features.length} feature{month.features.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <a
            href={month.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
            style={{ color: accent, background: `${accent}10`, border: `1px solid ${accent}25` }}
          >
            View month <ExternalLink size={10} />
          </a>
          <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
        </div>
      </button>

      {/* Features */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            {month.features.length === 0 ? (
              <div className="px-6 py-5 text-[13px] text-slate-400">No features parsed for this month.</div>
            ) : (
              <div className="px-6 py-4 space-y-3">
                {month.features.map((f, i) => (
                  <div key={i} className="rounded-2xl p-5 bg-white" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    {/* Title + product badge(s) top-right */}
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="text-[15px] font-bold text-slate-800 leading-snug">{f.title}</div>
                      {featureCategories(f).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 justify-end flex-shrink-0">
                          {featureCategories(f).map(c => (
                            <span key={c} className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: `${catColor(c)}15`, color: catColor(c), border: `1px solid ${catColor(c)}30` }}>
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Dates line (docs style) */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mb-3">
                      {f.releaseDate && <span>Release Date: <span className="text-slate-500 font-medium">{f.releaseDate}</span></span>}
                      {f.releaseDate && f.lastUpdated && <span className="text-slate-300">|</span>}
                      {f.lastUpdated && <span>Last Updated: <span className="text-slate-500 font-medium">{f.lastUpdated}</span></span>}
                    </div>

                    {/* Description */}
                    {f.paragraphs?.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {f.paragraphs.map((p, pi) => (
                          <p key={pi} className="text-[12.5px] text-slate-600 leading-relaxed">{p}</p>
                        ))}
                      </div>
                    )}

                    {/* Tag groups (docs-style funnel pills) at the bottom */}
                    {f.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {f.tags.map((group, gi) => (
                          <div key={gi} className="inline-flex items-center rounded-md overflow-hidden" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                            <span className="flex items-center px-2 py-1" style={{ color: '#94a3b8' }}>
                              <Filter size={11} />
                            </span>
                            {group.map((seg, si) => (
                              <span key={si} className="px-2.5 py-1 text-[11px] text-slate-600 whitespace-nowrap" style={{ borderLeft: '1px solid #e2e8f0' }}>
                                {seg}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* View all on docs */}
                <a
                  href={month.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 mt-1 py-2 rounded-xl text-[12px] font-semibold transition-colors"
                  style={{ color: accent, background: `${accent}08`, border: `1px dashed ${accent}30` }}
                >
                  View all {month.label} features on docs.paloaltonetworks.com <ExternalLink size={11} />
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function ReleaseNotesView() {
  const { state, dispatch } = useAppContext()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  // Allow page scroll (globals.css sets overflow:hidden on #root)
  useEffect(() => {
    const root = document.getElementById('root')
    const prev = root?.style.overflow || ''
    if (root) root.style.overflow = 'auto'
    return () => { if (root) root.style.overflow = prev }
  }, [])

  const load = async (force = false) => {
    force ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/release-notes${force ? '?force=1' : ''}`)
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const fetchedAgo = data?.fetchedAt
    ? (() => {
        const ms = Date.now() - new Date(data.fetchedAt).getTime()
        const days = Math.floor(ms / 86400000)
        const hours = Math.floor((ms % 86400000) / 3600000)
        if (days > 0) return `${days}d ${hours}h ago`
        if (hours > 0) return `${hours}h ago`
        return 'just now'
      })()
    : null

  const totalFeatures = data?.totalFeatures ?? 0
  const indexUrl = data?.indexUrl || 'https://docs.paloaltonetworks.com/ai-runtime-security/new-features/by-date/prisma-airs'

  return (
    <div
      className="flex flex-col min-h-screen w-screen select-none"
      style={{ overflowY: 'auto', overflowX: 'hidden', background: '#f1f5f9' }}
    >
      {/* Header */}
      <header className="flex-shrink-0 flex items-center gap-4 px-8 py-4 border-b" style={{ background: '#ffffff', borderColor: '#e2e8f0' }}>
        {/* Back */}
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={13} /> Home
        </button>

        <div className="w-px h-5 bg-slate-200 flex-shrink-0" />

        {/* Title block */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#003087' }}>
            <span className="text-white text-[14px]">📋</span>
          </div>
          <div>
            <div className="text-[15px] font-black text-slate-800 leading-none">What's New in Prisma AIRS</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              New features by date · scraped from{' '}
              <a href={indexUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                docs.paloaltonetworks.com
              </a>
            </div>
          </div>
        </div>

        {/* Stats */}
        {data && !loading && (
          <div className="flex items-center gap-5 flex-shrink-0">
            <div className="text-center">
              <div className="text-[18px] font-black text-slate-800 leading-none">{totalFeatures}</div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Features</div>
            </div>
            <div className="text-center">
              <div className="text-[18px] font-black text-slate-800 leading-none">{data.months?.length ?? 0}</div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Months</div>
            </div>
          </div>
        )}

        <div className="w-px h-5 bg-slate-200 flex-shrink-0" />

        {/* Cache status + refresh + activity icon */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {data && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock size={10} />
              {data.cached ? `Updated ${fetchedAgo}` : 'Just refreshed'}
            </div>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}
          >
            <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={() => setActivityOpen(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ opacity: 0.15 }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.5'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.15'}
            title=""
          >
            <Activity size={14} style={{ color: '#6366f1' }} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 px-8 py-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <RefreshCw size={28} className="animate-spin text-blue-400" />
              <div className="text-[13px] text-slate-400">Fetching release notes from docs.paloaltonetworks.com…</div>
              <div className="text-[11px] text-slate-300">This may take 10–15 seconds on first load</div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-[13px]">
              <AlertCircle size={18} className="flex-shrink-0" />
              <div>
                <div className="font-bold mb-0.5">Failed to load release notes</div>
                <div className="text-red-400">{error}</div>
              </div>
            </div>
          )}

          {!loading && data?.months?.map((month, i) => (
            <MonthSection key={month.slug} month={month} index={i} defaultOpen={i === 0} />
          ))}

          {!loading && !error && data && (
            <div className="flex items-center justify-center gap-2 pt-4 text-[11px] text-slate-300">
              <CheckCircle2 size={12} />
              Data cached for 7 days · Next refresh after {new Date(new Date(data.fetchedAt).getTime() + 7 * 86400000).toLocaleDateString()}
            </div>
          )}

          {/* System Health */}
          <SystemHealth />
        </div>
      </div>

      {/* Activity Log Drawer */}
      <AnimatePresence>
        {activityOpen && (
          <>
            <motion.div
              key="activity-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.2)' }}
              onClick={() => setActivityOpen(false)}
            />
            <motion.div
              key="activity-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
              style={{ width: 480, background: '#ffffff', borderLeft: '1px solid #e2e8f0', boxShadow: '-4px 0 24px rgba(0,0,0,0.08)' }}
            >
              {/* Drawer header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
                  <Activity size={14} style={{ color: '#6366f1' }} />
                </div>
                <div className="flex-1">
                  <div className="text-[14px] font-black text-slate-800">Activity Log</div>
                  <div className="text-[11px] text-slate-400">Unique visitors to this portal</div>
                </div>
                <button onClick={() => setActivityOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
                  <X size={13} className="text-slate-400" />
                </button>
              </div>
              {/* Drawer body */}
              <div className="flex-1 overflow-y-auto">
                <ActivityLog />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── System Health ─────────────────────────────────────────────────────────────
function StatTile({ icon: Icon, label, value, sub, color = '#64748b' }) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-2xl bg-white border border-slate-200" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} style={{ color }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <div className="text-[20px] font-black leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function SystemHealth() {
  const [open, setOpen] = useState(false)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/system-health')
      if (!res.ok) throw new Error(`${res.status}`)
      setHealth(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    setOpen(v => {
      if (!v && !health) load()
      return !v
    })
  }

  const fmtUptime = (sec) => {
    const d = Math.floor(sec / 86400)
    const h = Math.floor((sec % 86400) / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const diskPct = health?.disk ? Math.round((health.disk.usedMb / health.disk.totalMb) * 100) : null
  const memPct  = health?.os   ? Math.round((health.os.usedMb  / health.os.totalMb)  * 100) : null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e2e8f0', background: '#f8fafc' }}>
      {/* Header */}
      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <Server size={14} style={{ color: '#10b981' }} />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-black text-slate-700">Instance Health</div>
          <div className="text-[11px] text-slate-400">EC2 t3.medium · us-west-2 · 16.145.84.141</div>
        </div>
        <div className="flex items-center gap-2">
          {health && !loading && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Healthy
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); load() }} className="p-1 rounded-lg hover:bg-slate-200 transition-colors" title="Refresh">
            <RefreshCw size={11} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} className="text-slate-400" />
          </motion.div>
        </div>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1">
              {loading && <div className="text-[12px] text-slate-400 py-4 text-center">Loading…</div>}
              {error && <div className="text-[12px] text-red-400 py-4 text-center">Could not reach server: {error}</div>}
              {health && !loading && (
                <div className="space-y-5">

                  {/* ── Row 1: Core metrics ── */}
                  <div className="grid grid-cols-4 gap-3">
                    <StatTile icon={Cpu}       label="Node.js"    value={health.node.version}       color="#3b82f6" sub={`uptime ${fmtUptime(health.node.uptimeSec)}`} />
                    <StatTile icon={Activity}  label="App RAM"    value={`${health.node.memMb} MB`} color="#8b5cf6" sub="process RSS" />
                    <StatTile icon={Server}    label="OS Memory"  value={memPct != null ? `${memPct}%` : '—'} color={memPct > 80 ? '#ef4444' : '#10b981'} sub={`${health.os?.usedMb ?? '—'} / ${health.os?.totalMb ?? '—'} MB`} />
                    <StatTile icon={HardDrive} label="Disk /"     value={health.disk?.usePct ?? '—'} color={diskPct > 80 ? '#ef4444' : '#10b981'} sub={`${Math.round((health.disk?.usedMb??0)/1024)}GB / ${Math.round((health.disk?.totalMb??0)/1024)}GB`} />
                  </div>

                  {/* ── Row 2: Performance ── */}
                  <div className="grid grid-cols-3 gap-3">
                    {health.load && (
                      <StatTile icon={Cpu} label="CPU Load (1m / 5m / 15m)"
                        value={health.load.m1.toFixed(2)}
                        color={health.load.m1 > 1.5 ? '#ef4444' : '#10b981'}
                        sub={`5m: ${health.load.m5.toFixed(2)} · 15m: ${health.load.m15.toFixed(2)}`} />
                    )}
                    {health.pingMs != null && (
                      <StatTile icon={Activity} label="API Response"
                        value={`${health.pingMs}ms`}
                        color={health.pingMs > 200 ? '#f97316' : '#10b981'}
                        sub="self-ping to /api/health" />
                    )}
                    {health.db && (
                      <StatTile icon={Server} label="Traces (SQLite)"
                        value={health.db.totalTraces.toLocaleString()}
                        color="#6366f1"
                        sub={`${health.db.tracesToday} scans today`} />
                    )}
                  </div>

                  {/* ── Memory bar ── */}
                  {health.os && (
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1.5">
                        <span className="font-semibold">OS Memory</span>
                        <span>{health.os.availableMb} MB available of {health.os.totalMb} MB</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: memPct > 80 ? '#ef4444' : '#10b981' }}
                          initial={{ width: 0 }} animate={{ width: `${memPct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
                      </div>
                    </div>
                  )}

                  {/* ── Disk bar ── */}
                  {health.disk && (
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1.5">
                        <span className="font-semibold">Disk /</span>
                        <span>{Math.round(health.disk.availableMb / 1024)} GB available of {Math.round(health.disk.totalMb / 1024)} GB</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: diskPct > 80 ? '#ef4444' : '#3b82f6' }}
                          initial={{ width: 0 }} animate={{ width: `${diskPct}%` }} transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }} />
                      </div>
                    </div>
                  )}

                  {/* ── PM2 Processes ── */}
                  {health.pm2?.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">PM2 Processes</div>
                      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              {['Name', 'Status', 'Memory', 'CPU', 'Restarts', 'Uptime'].map(h => (
                                <th key={h} className="px-3 py-2 text-left font-bold text-slate-400 uppercase tracking-wider text-[9px]">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {health.pm2.map((p, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td className="px-3 py-2 font-bold text-slate-700">{p.name}</td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: p.status === 'online' ? '#d1fae5' : '#fee2e2', color: p.status === 'online' ? '#065f46' : '#991b1b' }}>
                                    {p.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-500 font-mono">{p.memMb} MB</td>
                                <td className="px-3 py-2 text-slate-500 font-mono">{p.cpu}%</td>
                                <td className="px-3 py-2 text-slate-500 font-mono">{p.restarts}</td>
                                <td className="px-3 py-2 text-slate-500">{p.uptimeSec != null ? fmtUptime(p.uptimeSec) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Last Deploy ── */}
                  {health.git && (
                    <div className="p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Last Deploy</div>
                      <div className="flex items-start gap-3">
                        <a href={`https://github.com/sergeiudo/sudo-airs-local-demo-vertex-bedrock/commit/${health.git.hash}`} target="_blank" rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded font-mono text-[11px] font-bold hover:opacity-80 transition-opacity" style={{ background: '#dbeafe', color: '#1e40af' }}>
                          {health.git.hash}
                        </a>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] text-slate-700 font-medium truncate">{health.git.message}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{new Date(health.git.date).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Stack Info ── */}
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Tech Stack</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Runtime',    value: `Node.js ${health.node.version}`,  color: '#22c55e' },
                        { label: 'Framework',  value: 'Express.js',                       color: '#6366f1' },
                        { label: 'Frontend',   value: 'React + Vite',                     color: '#38bdf8' },
                        { label: 'Styling',    value: 'Tailwind CSS',                     color: '#06b6d4' },
                        { label: 'Database',   value: 'SQLite (better-sqlite3)',           color: '#f59e0b' },
                        { label: 'Process Mgr',value: 'PM2',                              color: '#a78bfa' },
                        { label: 'Proxy',      value: 'Nginx',                            color: '#10b981' },
                        { label: 'LLM Infra',  value: 'Vertex AI · Bedrock · Azure',     color: '#ef4444' },
                        { label: 'AI Security',value: 'Prisma AIRS API',                  color: '#f97316' },
                      ].map(s => (
                        <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                          <div className="min-w-0">
                            <div className="text-[9px] text-slate-400 uppercase tracking-wider">{s.label}</div>
                            <div className="text-[11px] font-bold text-slate-700 truncate">{s.value}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-300 text-right">
                    Snapshot at {new Date(health.ts).toLocaleTimeString()}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Activity Log ─────────────────────────────────────────────────────────────
const VIEW_NAMES = {
  apiIntercept:    'API Intercept',
  modelScanning:   'Model Scanning',
  redTeaming:      'Red Teaming',
  claudeHooks:     'AI Code Assistant',
  observability:   'LLM Telemetry',
  developerCorner: 'Developer Corner',
  releaseNotes:    'Release Notes',
}

const VIEW_COLORS = {
  apiIntercept:    '#EF4444',
  modelScanning:   '#3B82F6',
  redTeaming:      '#F97316',
  claudeHooks:     '#8B5CF6',
  observability:   '#10B981',
  developerCorner: '#06B6D4',
  releaseNotes:    '#F59E0B',
}

function parseUA(ua) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown' }
  let browser = 'Other'
  if (/Edg\//.test(ua))     browser = 'Edge'
  else if (/Chrome\//.test(ua))  browser = 'Chrome'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua))  browser = 'Safari'

  let os = 'Other'
  if (/iPhone/.test(ua))         os = 'iPhone'
  else if (/Android/.test(ua))   os = 'Android'
  else if (/Windows/.test(ua))   os = 'Windows'
  else if (/Mac OS X/.test(ua))  os = 'macOS'
  else if (/Linux/.test(ua))     os = 'Linux'

  return { browser, os }
}

function timeAgo(ts) {
  const ms = Date.now() - new Date(ts).getTime()
  const m = Math.floor(ms / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

function ActivityLog() {
  const [logs, setLogs] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/activity')
      .then(r => r.json())
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-[12px] text-slate-400 py-8 text-center">Loading…</div>
  if (!logs || logs.length === 0) return (
    <div className="text-[12px] text-slate-400 py-8 text-center px-6">No activity yet — navigate to a pillar to log your first visit.</div>
  )

  return (
    <div className="p-4 space-y-3">
      <div className="text-[11px] font-semibold text-indigo-500 px-1">{logs.length} unique visitor{logs.length !== 1 ? 's' : ''}</div>
      {logs.map((row, i) => {
        const { browser, os } = parseUA(row.user_agent)
        const location = [row.city, row.country].filter(Boolean).join(', ') || null
        return (
          <div key={i} className="rounded-xl p-4 space-y-2.5" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            {/* Top row: IP + time */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold font-mono text-slate-700">{row.ip ?? '—'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
                  {row.visits} view{row.visits !== 1 ? 's' : ''}
                </span>
                <span className="text-[11px] text-slate-400">{timeAgo(row.last_seen)}</span>
              </div>
            </div>

            {/* Meta pills */}
            <div className="flex flex-wrap gap-1.5">
              {location && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                  📍 {location}
                </span>
              )}
              {row.timezone && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                  🕐 {row.timezone}
                </span>
              )}
              {browser !== 'Other' && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                  {browser}
                </span>
              )}
              {os !== 'Other' && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                  {os}
                </span>
              )}
              {row.language && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                  🌐 {row.language}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
