import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, RefreshCw, ExternalLink, Calendar, Clock, CheckCircle2, AlertCircle, Server, Cpu, HardDrive, Activity, ChevronDown } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import airsLogo from '../../prisma-AIRS_RGB_logo_Lockup_Negative.png'

const PILLAR_LINKS = {
  'AI Runtime Firewall': 'https://docs.paloaltonetworks.com/ai-runtime-security/release-notes/features-introduced/ai-runtime-security-network-intercept',
  'AI Runtime API':      'https://docs.paloaltonetworks.com/ai-runtime-security/release-notes/features-introduced/ai-runtime-security-api-intercept',
  'AI Model Security':   'https://docs.paloaltonetworks.com/ai-runtime-security/release-notes/features-introduced/ai-model-security',
  'AI Red Teaming':      'https://docs.paloaltonetworks.com/ai-runtime-security/release-notes/features-introduced/ai-red-teaming',
}

function groupByDate(features) {
  const groups = {}
  for (const f of features) {
    const key = f.date || 'Undated'
    if (!groups[key]) groups[key] = []
    groups[key].push(f)
  }
  return Object.entries(groups)
}

function PillarSection({ pillar, index }) {
  const [open, setOpen] = useState(false)
  const groups = groupByDate(pillar.features)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${pillar.color}25`, background: '#ffffff', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
    >
      {/* Pillar header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-slate-50"
        style={{ borderBottom: open ? `1px solid ${pillar.color}15` : 'none' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${pillar.color}12`, border: `1px solid ${pillar.color}30` }}>
          {pillar.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-black" style={{ color: pillar.color }}>{pillar.name}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {pillar.error
              ? `Failed to load: ${pillar.error}`
              : `${pillar.features.length} feature${pillar.features.length !== 1 ? 's' : ''} · latest: ${pillar.features[0]?.date || '—'}`
            }
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <a
            href={PILLAR_LINKS[pillar.name]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
            style={{ color: pillar.color, background: `${pillar.color}10`, border: `1px solid ${pillar.color}25` }}
          >
            Full docs <ExternalLink size={10} />
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
            {pillar.error ? (
              <div className="flex items-center gap-2 px-6 py-5 text-[13px] text-slate-400">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                Could not load release notes. Check server logs or try refreshing.
              </div>
            ) : pillar.features.length === 0 ? (
              <div className="px-6 py-5 text-[13px] text-slate-400">No features parsed from this page.</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {groups.map(([date, feats]) => (
                  <div key={date} className="px-6 py-4">
                    {/* Date group header */}
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar size={11} style={{ color: pillar.color }} />
                      <span className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: pillar.color }}>
                        {date}
                      </span>
                      <div className="flex-1 h-px" style={{ background: `${pillar.color}15` }} />
                    </div>
                    {/* Feature bubbles */}
                    <div className="space-y-3">
                      {feats.map((f, i) => (
                        <div key={i} className="rounded-2xl p-4" style={{
                          background: `${pillar.color}07`,
                          border: `1px solid ${pillar.color}20`,
                        }}>
                          {/* Title */}
                          <div className="flex items-start gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: pillar.color }} />
                            <div className="text-[13px] font-bold text-slate-800 leading-snug">{f.title}</div>
                          </div>

                          {/* Supported for */}
                          {f.supportedFor && (
                            <div className="ml-4 mb-2 text-[11px] px-2 py-0.5 rounded-full w-fit" style={{ background: `${pillar.color}15`, color: pillar.color }}>
                              {f.supportedFor}
                            </div>
                          )}

                          {/* Paragraphs */}
                          {f.paragraphs?.length > 0 && (
                            <div className="ml-4 space-y-1.5">
                              {f.paragraphs.map((p, pi) => (
                                <p key={pi} className="text-[12px] text-slate-600 leading-relaxed">{p}</p>
                              ))}
                            </div>
                          )}

                          {/* Bullets */}
                          {f.bullets?.length > 0 && (
                            <ul className="ml-4 mt-2 space-y-1.5">
                              {f.bullets.map((b, bi) => (
                                <li key={bi} className="flex gap-2 text-[12px] text-slate-600 leading-relaxed">
                                  <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: `${pillar.color}60` }} />
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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

  const totalFeatures = data?.pillars?.reduce((s, p) => s + p.features.length, 0) ?? 0

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
              Features introduced · scraped weekly from{' '}
              <a href="https://docs.paloaltonetworks.com/ai-runtime-security/release-notes/features-introduced" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
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
              <div className="text-[18px] font-black text-slate-800 leading-none">{data.pillars?.length ?? 0}</div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Pillars</div>
            </div>
          </div>
        )}

        <div className="w-px h-5 bg-slate-200 flex-shrink-0" />

        {/* Cache status + refresh */}
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

          {!loading && data?.pillars?.map((pillar, i) => (
            <PillarSection key={pillar.name} pillar={pillar} index={i} />
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
                        <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold" style={{ background: '#dbeafe', color: '#1e40af' }}>{health.git.hash}</span>
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
