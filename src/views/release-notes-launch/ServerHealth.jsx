import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Server, ChevronDown, Cpu, MemoryStick, HardDrive, Activity, Database, GitCommit, Loader2, X, Users, RefreshCw } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { bandBg, bandDots, bandGlass, shade } from '../home-2027/band'
import { deepBand } from '../runtime-launch/diagramKit'

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
const fmtUptime = (sec) => {
  if (sec == null) return '—'
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60)
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
}
const pctOf = (a, b) => (a != null && b ? Math.round((a / b) * 100) : null)

function Tile({ t, icon: Icon, label, value, sub, tone }) {
  return (
    <div className="rounded-2xl px-3.5 py-3 min-w-0" style={{ background: t.sunken }}>
      <div className="flex items-center gap-2">
        <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 24, height: 24, background: `${tone}17`, color: tone }}><Icon size={12} aria-hidden="true" /></span>
        <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.inkDim }}>{label}</span>
      </div>
      <div className="truncate" style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: t.ink, marginTop: 6 }}>{value}</div>
      {sub && <div className="truncate" title={sub} style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function Meter({ t, label, pct, detail }) {
  const reduce = useReducedMotion()
  const tone = pct > 80 ? t.warn : t.pass
  return (
    <div>
      <div className="flex justify-between" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
        <span style={{ fontWeight: 600, color: t.ink }}>{label}</span><span>{detail}</span>
      </div>
      <div className="rounded-full overflow-hidden mt-1.5" style={{ height: 8, background: t.sunken }}>
        <motion.div className="h-full rounded-full" style={{ background: tone }} initial={reduce ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
      </div>
    </div>
  )
}

/**
 * The server the portal runs on — collapsed until opened, and fetched only
 * then (it shells out to free/df/pm2/git). Describes whatever host answered,
 * so a laptop never claims to be the EC2 instance.
 */
export function ServerHealth({ t }) {
  const [open, setOpen] = useState(false)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/system-health')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setHealth(await r.json())
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  const toggle = () => setOpen((o) => { if (!o && !health) load(); return !o })

  const h = health
  const memPct = pctOf(h?.os?.usedMb, h?.os?.totalMb)
  const diskPct = pctOf(h?.disk?.usedMb, h?.disk?.totalMb)
  const onPm2 = h?.pm2?.length > 0
  const sub = h
    ? `Node ${h.node.version} · up ${fmtUptime(h.node.uptimeSec)} · ${onPm2 ? `${h.pm2.length} PM2 process${h.pm2.length > 1 ? 'es' : ''}` : 'not under PM2 (a dev run)'}`
    : 'The host this portal runs on — memory, disk, processes, last deploy'

  return (
    <section className="rounded-[22px] overflow-hidden" style={{ background: t.panel, border: `1px solid ${t.glassEdge}`, boxShadow: t.shadowSm }}>
      <button type="button" onClick={toggle} aria-expanded={open} className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${focusCls}`}>
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 34, height: 34, background: bandBg(t.pass), boxShadow: `0 5px 12px ${t.pass}44` }}>
          <Server size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block" style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink }}>Server health</span>
          <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1 }}>{sub}</span>
        </span>
        {h && !loading && (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 flex-shrink-0" style={{ height: 24, fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.isLight ? shade(t.pass, 0.3) : t.pass, background: `${t.pass}17` }}>
            <span className="rounded-full" style={{ width: 6, height: 6, background: t.pass }} /> answering
          </span>
        )}
        {loading && <Loader2 size={14} className="animate-spin" style={{ color: t.inkDim }} aria-hidden="true" />}
        <ChevronDown size={15} style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4" style={{ borderTop: `1px solid ${t.hairline}`, paddingTop: 14 }}>
              {error && <p style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.isLight ? shade(t.warn, 0.4) : t.warn }}>Could not read server health: {error}</p>}
              {h && (
                <>
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
                    <Tile t={t} icon={Cpu} tone={t.live} label="Node.js" value={h.node.version} sub={`uptime ${fmtUptime(h.node.uptimeSec)}`} />
                    <Tile t={t} icon={MemoryStick} tone={t.live} label="App memory" value={`${h.node.memMb} MB`} sub="process RSS" />
                    {h.load && <Tile t={t} icon={Activity} tone={h.load.m1 > 1.5 ? t.warn : t.pass} label="CPU load" value={h.load.m1.toFixed(2)} sub={`5 min ${h.load.m5.toFixed(2)} · 15 min ${h.load.m15.toFixed(2)}`} />}
                    {h.pingMs != null && <Tile t={t} icon={Activity} tone={h.pingMs > 200 ? t.warn : t.pass} label="API response" value={`${h.pingMs} ms`} sub="self-request to /api/health" />}
                    {h.db && <Tile t={t} icon={Database} tone={t.live} label="Traces stored" value={h.db.totalTraces.toLocaleString()} sub={`${h.db.tracesToday.toLocaleString()} since 00:00 UTC`} />}
                  </div>
                  {(memPct != null || diskPct != null) && (
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                      {memPct != null && <Meter t={t} label="Memory" pct={memPct} detail={`${h.os.availableMb.toLocaleString()} MB free of ${h.os.totalMb.toLocaleString()} MB`} />}
                      {diskPct != null && <Meter t={t} label="Disk /" pct={diskPct} detail={`${Math.round(h.disk.availableMb / 1024)} GB free of ${Math.round(h.disk.totalMb / 1024)} GB`} />}
                    </div>
                  )}
                  {onPm2 && (
                    <div>
                      <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, marginBottom: 6 }}>PM2 processes</div>
                      <div className="space-y-1">
                        {h.pm2.map((p) => {
                          const up = p.status === 'online'
                          return (
                            <div key={p.name} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: t.sunken }}>
                              <span className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, background: up ? t.pass : t.warn }} />
                              <span className="flex-1 truncate" style={{ fontFamily: FONT.mono, fontSize: 11.5, fontWeight: 600, color: t.ink }}>{p.name}</span>
                              <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{p.status} · {p.memMb} MB · {p.cpu}% CPU · {p.restarts} restarts · up {fmtUptime(p.uptimeSec)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {h.git && (
                    <a href={`https://github.com/sergeiudo/sudo-airs-local-demo-vertex-bedrock/commit/${h.git.hash}`} target="_blank" rel="noopener noreferrer"
                       className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${focusCls}`} style={{ background: t.sunken }}>
                      <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 28, height: 28, background: `${t.live}17`, color: t.live }}><GitCommit size={14} aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{h.git.message}</span>
                        <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>Last commit · {new Date(h.git.date).toLocaleString()}</span>
                      </span>
                      <span className="rounded-md px-2" style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, color: t.isLight ? shade(t.live, 0.2) : '#9DB6FA', background: `${t.live}14` }}>{h.git.hash}</span>
                    </a>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {['Node.js + Express', 'React + Vite', 'SQLite', 'PM2 + Nginx', 'Vertex · Bedrock · Azure', 'Prisma AIRS API'].map((x) => (
                        <span key={x} className="rounded-full px-2.5" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: '22px', color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>{x}</span>
                      ))}
                    </div>
                    <button type="button" onClick={load} disabled={loading} className={`inline-flex items-center gap-1.5 rounded-full px-3 flex-shrink-0 ${focusCls}`}
                            style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
                      <RefreshCw size={11} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> {new Date(h.ts).toLocaleTimeString()}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ─── visitors (the owner's view — deliberately low-key) ──────────────────────

function parseUA(ua) {
  if (!ua) return { browser: null, os: null }
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : null
  const os = /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null
  return { browser, os }
}
function ago(ts) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`
}

export function VisitorsDrawer({ t, open, onClose }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!open) return undefined
    fetch('/api/activity').then((r) => r.json()).then(setRows).catch(() => setRows([]))
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bd" className="fixed inset-0" style={{ zIndex: 60, background: 'rgba(0,0,0,0.25)' }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside key="dr" role="dialog" aria-label="Visitors" className="fixed top-0 right-0 bottom-0 flex flex-col"
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                        style={{ zIndex: 61, width: 460, maxWidth: '100vw', background: t.ground, boxShadow: '-12px 0 40px rgba(0,0,0,0.2)' }}>
            <div className="relative flex-shrink-0 overflow-hidden" style={{ background: deepBand('#6366F1'), minHeight: 92 }}>
              <div aria-hidden="true" className="absolute inset-0" style={bandDots} />
              <Users aria-hidden="true" strokeWidth={1.3} style={{ position: 'absolute', right: -20, bottom: -38, width: 140, height: 140, color: '#fff', opacity: 0.13 }} />
              <div className="relative flex items-center gap-3 px-4 py-4">
                <span className="grid place-items-center rounded-2xl" style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}><Users size={19} style={{ color: '#fff' }} aria-hidden="true" /></span>
                <div className="flex-1 min-w-0">
                  <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Activity</div>
                  <div style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 700, color: '#fff' }}>{rows ? `${rows.length} visitor${rows.length === 1 ? '' : 's'}` : 'Visitors'}</div>
                  <div style={{ fontFamily: FONT.prose, fontSize: 11.5, color: 'rgba(255,255,255,0.9)' }}>Unique addresses that opened a pillar</div>
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="grid place-items-center rounded-full" style={{ width: 30, height: 30, ...bandGlass }}><X size={14} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!rows ? <p style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, padding: 12 }}>Loading…</p>
                : !rows.length ? <p style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, padding: 12 }}>No visits logged yet.</p>
                : rows.map((r, i) => {
                  const { browser, os } = parseUA(r.user_agent)
                  const pills = [[r.city, r.country].filter(Boolean).join(', '), r.timezone, browser, os, r.language].filter(Boolean)
                  return (
                    <div key={i} className="rounded-2xl px-3.5 py-3" style={{ background: t.panel, border: `1px solid ${t.glassEdge}` }}>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate" style={{ fontFamily: FONT.mono, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{r.ip ?? '—'}</span>
                        <span className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, lineHeight: '19px', color: '#6366F1', background: '#6366F11a' }}>{r.visits} view{r.visits === 1 ? '' : 's'}</span>
                        <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{ago(r.last_seen)}</span>
                      </div>
                      {pills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {pills.map((x) => <span key={x} className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: '18px', color: t.inkDim, background: t.sunken }}>{x}</span>)}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
