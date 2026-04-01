import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, RefreshCw, ExternalLink, Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
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
                    {/* Feature entries */}
                    <div className="space-y-6">
                      {feats.map((f, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex-shrink-0 pt-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: pillar.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-bold text-slate-800 leading-snug mb-1">{f.title}</div>
                            {f.supportedFor && (
                              <div className="text-[11px] text-slate-400 mb-2">
                                <span className="font-semibold">Supported for:</span> {f.supportedFor}
                              </div>
                            )}
                            {f.paragraphs?.map((p, pi) => (
                              <p key={pi} className="text-[12px] text-slate-600 leading-relaxed mb-2">{p}</p>
                            ))}
                            {f.bullets?.length > 0 && (
                              <ul className="mt-1 space-y-1">
                                {f.bullets.map((b, bi) => (
                                  <li key={bi} className="flex gap-2 text-[12px] text-slate-600 leading-relaxed">
                                    <span className="flex-shrink-0 mt-1.5 w-1 h-1 rounded-full bg-slate-300" />
                                    <span>{b}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
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
        </div>
      </div>
    </div>
  )
}
