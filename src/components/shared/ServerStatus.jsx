import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Server, Shield, Waypoints, Cloud, ScanSearch, Database, Activity, Cpu, MemoryStick, Gauge, GitCommit, Terminal, Loader2, RefreshCw, X,
} from 'lucide-react'
import { FONT, label as LBL } from '../../views/api-intercept-2027/tokens'
import { shade, bandDots, bandGlass } from '../../views/home-2027/band'
import { deepBand } from '../../views/runtime-launch/diagramKit'
import { Tip } from './Tip'
import { useWidgetFit, pillBox, pillClass } from './headerFit'

/**
 * ServerStatus — this portal's server, in one place: which services are
 * configured on it, and the host underneath (memory, disk, processes, last
 * deploy). It replaced two widgets that described the same machine without
 * saying so — the "Ready" pre-flight pill and the Server health card at the
 * foot of the release notes.
 *
 * Two reads, deliberately different:
 *   • /api/health on mount — configuration only, no network call, so the pill
 *     can colour itself on every page load. A set key can still be expired;
 *     the panel says "set, not probed" and points to the end-to-end probe
 *     (/api/moh/health?probe=1), which stays a deliberate act — probing on
 *     load floods the SCM logs.
 *   • /api/system-health on first open — it shells out (free, df, uptime, pm2,
 *     git), so it waits until someone asks.
 *
 * The pill is amber when a core service (AIRS, AI-GW, providers) is not
 * configured, or — once the host has been read — a PM2 process is not online.
 * The scanner (laptop-only) and the Model Security history are optional.
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
const isLocal = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)
const inkOn = (t, tone, k = 0.3) => (t.isLight ? shade(tone, k) : tone)
const hhmm = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
const pctOf = (a, b) => (a != null && b ? Math.round((a / b) * 100) : null)
const fmtUptime = (sec) => {
  if (sec == null) return '—'
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60)
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** "EC2", "Laptop" — what kind of machine answered, from its own hostname and platform. */
function hostKind(host) {
  if (!host) return null
  if (/\.compute\.internal$|^ip-\d+-\d+-\d+-\d+/.test(host.hostname)) return 'EC2'
  if (host.platform === 'darwin') return 'Laptop'
  if (host.platform === 'win32') return 'Windows host'
  return 'Linux host'
}

// ─── the reads ───────────────────────────────────────────────────────────────

export function useServerStatus() {
  const [h, setH] = useState(null)
  const [scanner, setScanner] = useState(null)
  const [at, setAt] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sys, setSys] = useState(null)
  const [sysBusy, setSysBusy] = useState(false)
  const [sysError, setSysError] = useState(null)

  const check = useCallback(async () => {
    setBusy(true)
    const [health, sc] = await Promise.all([
      fetch('/api/health').then((r) => r.json()).catch(() => null),
      fetch('/api/scanner/health').then((r) => r.json()).catch(() => null),
    ])
    setH(health)
    setScanner(sc)
    setAt(new Date())
    setBusy(false)
  }, [])

  const readHost = useCallback(async () => {
    setSysBusy(true)
    setSysError(null)
    try {
      const r = await fetch('/api/system-health')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setSys(await r.json())
    } catch (e) { setSysError(e.message) } finally { setSysBusy(false) }
  }, [])

  const refresh = useCallback(() => Promise.all([check(), readHost()]), [check, readHost])
  useEffect(() => { check() }, [check])

  // An older server does not send the newer fields; say "restart" rather than a false amber.
  const stale = h && h.aigw === undefined
  const scannerState = !scanner ? 'unknown' : !scanner.running ? 'offline' : scanner.configured === false ? 'stub' : 'live'
  const on = (text) => ({ text, tone: 'pass' })
  const services = h ? [
    {
      id: 'airs', icon: Shield, name: 'AIRS Runtime API', core: true,
      pill: h.airs?.configured ? on('configured') : { text: 'not set', tone: 'warn' },
      detail: h.airs?.configured ? (h.airs.profile ? `profile ${h.airs.profile}` : 'key set · profile unset') : 'AIRS_API_KEY is not set',
      mono: !!(h.airs?.configured && h.airs.profile),
    },
    {
      id: 'aigw', icon: Waypoints, name: 'SCM AI Gateway', core: true,
      pill: stale ? { text: 'unknown', tone: 'idle' } : h.aigw?.configured ? on('configured') : { text: 'not set', tone: 'warn' },
      detail: stale ? 'restart the server to check' : h.aigw?.configured ? 'gateway key and protected config set' : 'AIGW_API_KEY or AIGW_CONFIG_PROTECTED is not set',
    },
    {
      id: 'providers', icon: Cloud, name: 'Model providers', core: true,
      providers: [['Bedrock', !!h.bedrock?.region, h.bedrock?.region], ['Vertex', !!h.vertex?.project], ...(stale ? [] : [['Azure', !!h.azure?.configured]])],
      pill: (h.bedrock?.region || h.vertex?.project || h.azure?.configured) ? on('configured') : { text: 'none set', tone: 'warn' },
    },
    {
      id: 'scanner', icon: ScanSearch, name: 'Model scanner',
      pill: scannerState === 'live' ? on('live') : scannerState === 'stub' ? { text: 'stub', tone: 'warn' } : { text: scannerState === 'offline' ? 'off' : '—', tone: 'idle' },
      detail: scannerState === 'live' ? 'Python scanner answering on :8001'
        : scannerState === 'stub' ? 'running as a stub — scanner credentials missing'
        : scannerState === 'offline' ? (isLocal() ? 'not running — start it with npm run dev' : 'runs on the laptop only')
        : 'no answer',
    },
    {
      id: 'ms', icon: Database, name: 'Model Security API',
      pill: h.modelScanner?.configured ? on('configured') : { text: 'off', tone: 'idle' },
      detail: h.modelScanner?.configured ? 'SCM scan history available' : 'scan history unavailable',
    },
    {
      id: 'telemetry', icon: Activity, name: 'Telemetry',
      pill: h.traces ? on('recording') : { text: '—', tone: 'idle' },
      detail: h.traces ? `${h.traces.total.toLocaleString()} traces · ${h.traces.blocked.toLocaleString()} blocked` : stale ? 'restart the server to count' : 'trace store not readable',
    },
  ] : []

  const coreOff = services.filter((s) => s.core && s.pill.tone === 'warn')
  const down = (sys?.pm2 ?? []).filter((p) => p.status !== 'online')
  const loaded = !!h || (!busy && at != null)
  return {
    h, sys, sysBusy, sysError, at, busy, check, readHost, refresh, services, coreOff, down, loaded,
    warn: coreOff.length > 0 || down.length > 0,
    host: h?.host ?? null,
  }
}

const toneOf = (t, st) => (!st.loaded ? t.idle : st.warn ? t.warn : t.pass)

// ─── pieces ──────────────────────────────────────────────────────────────────

function Eyebrow({ t, children, aside }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
      <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>{children}</span>
      {aside && <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{aside}</span>}
    </div>
  )
}

function StatusPill({ t, pill }) {
  const c = t[pill.tone] ?? t.idle
  return (
    <span className="rounded-full px-2 flex-shrink-0 whitespace-nowrap"
          style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, lineHeight: '20px', color: pill.tone === 'idle' ? t.inkDim : inkOn(t, c, pill.tone === 'warn' ? 0.42 : 0.3), background: pill.tone === 'idle' ? t.sunken : `${c}17` }}>
      {pill.text}
    </span>
  )
}

function ServiceRow({ t, s }) {
  const c = t[s.pill.tone] ?? t.idle
  const Icon = s.icon
  return (
    <div className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${c}17`, color: s.pill.tone === 'idle' ? t.inkDim : inkOn(t, c, 0.25) }}>
        <Icon size={14} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{s.name}</span>
          {!s.core && <span style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkFaint }}>optional</span>}
        </div>
        {s.providers ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {s.providers.map(([name, ok, extra]) => (
              <span key={name} className="rounded-full px-2"
                    style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: '19px', color: ok ? inkOn(t, t.pass, 0.3) : t.inkFaint, background: ok ? `${t.pass}14` : t.sunken, textDecoration: ok ? 'none' : 'line-through' }}>
                {name}{ok && extra ? ` · ${extra}` : ''}
              </span>
            ))}
          </div>
        ) : (
          <div className="truncate" title={s.detail} dir={s.mono ? 'ltr' : undefined}
               style={{ fontFamily: s.mono ? FONT.mono : FONT.prose, fontSize: s.mono ? 11 : 11.5, color: t.inkDim, marginTop: 1 }}>{s.detail}</div>
        )}
      </div>
      <StatusPill t={t} pill={s.pill} />
    </div>
  )
}

function Tile({ t, icon: Icon, label, value, sub, tone }) {
  return (
    <div className="rounded-2xl px-3 py-2.5 min-w-0" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
      <div className="flex items-center gap-1.5">
        <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 22, height: 22, background: `${tone}17`, color: inkOn(t, tone, 0.25) }}><Icon size={11} aria-hidden="true" /></span>
        <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: t.inkDim }}>{label}</span>
      </div>
      <div className="truncate" style={{ fontFamily: FONT.display, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: t.ink, marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div className="truncate" title={sub} style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim, marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function Meter({ t, label, pct, detail }) {
  const reduce = useReducedMotion()
  const tone = pct > 80 ? t.warn : t.pass
  return (
    <div className="rounded-2xl px-3 py-2.5" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
      <div className="flex justify-between gap-2" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
        <span style={{ fontWeight: 600, color: t.ink }}>{label} · {pct}%</span><span className="truncate">{detail}</span>
      </div>
      <div className="rounded-full overflow-hidden mt-1.5" style={{ height: 7, background: t.sunken }}>
        <motion.div className="h-full rounded-full" style={{ background: tone }} initial={reduce ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
      </div>
    </div>
  )
}

function Note({ t, children, tone }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5" style={{ background: t.panel, border: `1px ${tone ? 'dashed' : 'solid'} ${tone ? `${tone}8c` : t.hairline}`, fontFamily: FONT.prose, fontSize: 12, color: tone ? inkOn(t, tone, 0.4) : t.inkDim }}>
      {children}
    </div>
  )
}

// ─── the card ────────────────────────────────────────────────────────────────

/** The whole status: band, services, host, processes, last deploy. Shared by the app-bar popover and the New sidebar. */
export function ServerStatusCard({ t, st, onClose, maxHeight = 'calc(100vh - 90px)' }) {
  const reduce = useReducedMotion()
  const tone = toneOf(t, st)
  const kind = hostKind(st.host)
  const sys = st.sys
  const busy = st.busy || st.sysBusy
  const memPct = pctOf(sys?.os?.usedMb, sys?.os?.totalMb)
  const diskPct = pctOf(sys?.disk?.usedMb, sys?.disk?.totalMb)

  const title = !st.loaded ? 'Checking this server…'
    : !st.h ? 'The server did not answer'
    : st.coreOff.length ? `${st.coreOff.length} core service${st.coreOff.length === 1 ? '' : 's'} not configured`
    : st.down.length ? `${st.down.length} process${st.down.length === 1 ? '' : 'es'} not online`
    : 'Ready to demo'
  const sub = st.host
    ? [st.host.hostname, `Node ${st.host.node}`, `up ${fmtUptime(st.host.uptimeSec)}`, st.host.pm2 ? 'under PM2' : 'a dev run'].join(' · ')
    : st.h ? 'Configuration on this host' : '/api/health did not answer'

  return (
    <div className="flex flex-col overflow-hidden" style={{
      maxHeight, borderRadius: 22, background: t.isLight ? '#FAFAFB' : t.raised, border: `1px solid ${tone}40`,
      boxShadow: t.isLight ? '0 22px 50px rgba(18,18,22,0.18)' : '0 22px 50px rgba(0,0,0,0.6)',
    }}>
      <div className="relative flex-shrink-0 overflow-hidden" style={{ background: deepBand(tone) }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
        <Server aria-hidden="true" strokeWidth={1.2} style={{ position: 'absolute', right: -24, bottom: -44, width: 150, height: 150, color: '#fff', opacity: 0.13, transform: 'rotate(-10deg)' }} />
        <div className="relative flex items-center gap-3 px-4 py-3">
          <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 42, height: 42, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
            <Server size={19} style={{ color: '#fff' }} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Server status{kind ? ` · ${kind}` : ''}</div>
            <div className="truncate" aria-live="polite" style={{ fontFamily: FONT.display, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.15, marginTop: 2 }}>{title}</div>
            <div className="truncate" title={sub} style={{ fontFamily: FONT.prose, fontSize: 11.5, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>{sub}</div>
          </div>
          <button type="button" onClick={st.refresh} disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 flex-shrink-0 disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  style={{ height: 30, fontFamily: FONT.prose, fontSize: 12, fontWeight: 700, color: shade(tone, 0.45), background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            {busy ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={12} aria-hidden="true" />}
            {busy ? 'Checking' : 'Re-check'}
          </button>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close"
                    className="grid place-items-center rounded-full flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    style={{ width: 30, height: 30, ...bandGlass }}>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pt-3.5 pb-4 space-y-4" style={{ scrollbarGutter: 'stable' }}>
        <section aria-label="Services">
          <Eyebrow t={t} aside={st.at ? `set, not probed · checked ${hhmm(st.at)}` : 'set, not probed'}>Services</Eyebrow>
          {!st.h && st.loaded && <Note t={t} tone={t.warn}>The server did not answer /api/health.</Note>}
          <div className="space-y-1.5">
            {st.services.map((s) => <ServiceRow key={s.id} t={t} s={s} />)}
          </div>
        </section>

        <section aria-label="Host">
          <Eyebrow t={t} aside={sys?.ts ? `read ${hhmm(new Date(sys.ts))}` : null}>Host</Eyebrow>
          {!sys && st.sysBusy && <Note t={t}><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Reading the host — memory, disk, processes, last deploy…</Note>}
          {st.sysError && <Note t={t} tone={t.warn}>Could not read the host: {st.sysError}</Note>}
          {sys && (
            <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))' }}>
                <Tile t={t} icon={Cpu} tone={t.live} label="Node.js" value={sys.node.version} sub={`up ${fmtUptime(sys.node.uptimeSec)}`} />
                <Tile t={t} icon={MemoryStick} tone={t.live} label="App memory" value={`${sys.node.memMb} MB`} sub="process RSS" />
                {sys.load && <Tile t={t} icon={Gauge} tone={sys.load.m1 > 1.5 ? t.warn : t.pass} label="CPU load" value={sys.load.m1.toFixed(2)} sub={`5 min ${sys.load.m5.toFixed(2)} · 15 min ${sys.load.m15.toFixed(2)}`} />}
                {sys.pingMs != null && <Tile t={t} icon={Activity} tone={sys.pingMs > 200 ? t.warn : t.pass} label="API response" value={`${sys.pingMs} ms`} sub="self-request to /api/health" />}
              </div>
              {memPct != null && <Meter t={t} label="Memory" pct={memPct} detail={`${sys.os.availableMb.toLocaleString()} MB free of ${sys.os.totalMb.toLocaleString()} MB`} />}
              {diskPct != null && <Meter t={t} label="Disk /" pct={diskPct} detail={`${Math.round(sys.disk.availableMb / 1024)} GB free of ${Math.round(sys.disk.totalMb / 1024)} GB`} />}
            </motion.div>
          )}
        </section>

        {sys && (
          <section aria-label="Processes">
            <Eyebrow t={t} aside={sys.pm2?.length ? `${sys.pm2.length - st.down.length} of ${sys.pm2.length} online` : null}>Processes</Eyebrow>
            {sys.pm2?.length ? (
              <div className="space-y-1.5">
                {sys.pm2.map((p) => {
                  const up = p.status === 'online'
                  return (
                    <div key={p.name} className="flex items-center gap-3 rounded-2xl px-3 py-2" style={{ background: t.panel, border: `1px solid ${up ? t.hairline : `${t.warn}8c`}` }}>
                      <span className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, background: up ? t.pass : t.warn }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 12, fontWeight: 600, color: t.ink }}>{p.name}</span>
                        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{p.memMb} MB · {p.cpu}% CPU · {p.restarts} restart{p.restarts === 1 ? '' : 's'} · up {fmtUptime(p.uptimeSec)}</span>
                      </span>
                      <StatusPill t={t} pill={{ text: p.status ?? 'unknown', tone: up ? 'pass' : 'warn' }} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <Note t={t}>
                <Terminal size={14} className="flex-shrink-0" aria-hidden="true" />
                <span>Not under PM2 — a development run{isLocal() ? ' (npm run dev starts Vite, Express, the scanner and the MCP server)' : ''}.</span>
              </Note>
            )}
          </section>
        )}

        {sys?.git && (
          <section aria-label="Last deploy">
            <Eyebrow t={t}>Last deploy</Eyebrow>
            <a href={`https://github.com/sergeiudo/sudo-airs-local-demo-vertex-bedrock/commit/${sys.git.hash}`} target="_blank" rel="noopener noreferrer"
               className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${focusCls}`} style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
              <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${t.live}17`, color: inkOn(t, t.live, 0.25) }}><GitCommit size={14} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{sys.git.message}</span>
                <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>Last commit · {new Date(sys.git.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
              </span>
              <span className="rounded-md px-2 flex-shrink-0" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, color: t.isLight ? shade(t.live, 0.2) : '#9DB6FA', background: `${t.live}14` }}>{sys.git.hash}</span>
            </a>
          </section>
        )}

        {sys && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {['Node.js + Express', 'React + Vite', 'SQLite', 'PM2 + Nginx', 'Vertex · Bedrock · Azure', 'Prisma AIRS API'].map((x) => (
              <span key={x} className="rounded-full px-2.5" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: '21px', color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>{x}</span>
            ))}
          </div>
        )}

        <p className="px-1" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.5, color: t.inkFaint }}>
          Services are read from this host’s configuration — a set key can still be expired or revoked. For an end-to-end check before a demo, open{' '}
          <span dir="ltr" style={{ fontFamily: FONT.mono, color: t.inkDim }}>/api/moh/health?probe=1</span>.
        </p>
      </div>
    </div>
  )
}

// ─── the app-bar pill ────────────────────────────────────────────────────────

function Popover({ t, st, anchor, onClose }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect()
      if (!r) return
      const width = Math.min(560, window.innerWidth - 24)
      setPos({ top: r.bottom + 10, left: Math.max(12, Math.min(r.right - width, window.innerWidth - width - 12)), width })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    const onDown = (e) => { if (!ref.current?.contains(e.target) && !anchor.current?.contains(e.target)) onClose() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [onClose, anchor])

  return createPortal(
    <motion.div ref={ref} role="dialog" aria-label="Server status"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: pos ? 1 : 0, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="fixed" style={{ zIndex: 9000, top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? 560 }}>
      <ServerStatusCard t={t} st={st} onClose={onClose} />
    </motion.div>,
    document.body,
  )
}

/**
 * The pill: a dot in the verdict's colour, "Server · ready", and the card one
 * click away. `variant="bar"` = soft pill on a light app bar, `"band"` = white
 * glass on a pillar's coloured header (HeaderWidgets places it).
 */
export function ServerStatusButton({ t, variant = 'bar' }) {
  const st = useServerStatus()
  const fit = useWidgetFit()
  const iconOnly = fit >= 4
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  const tone = toneOf(t, st)
  const word = !st.loaded ? 'checking' : !st.h ? 'no answer' : st.warn ? 'check setup' : 'ready'
  const toggle = () => setOpen((o) => { if (!o && !st.sys && !st.sysBusy) st.readHost(); return !o })
  const close = useCallback(() => setOpen(false), [])
  const band = variant === 'band'

  return (
    <>
      <Tip title="Server status" text="This portal's server: which services are configured on it, and its memory, disk, processes and last deploy">
        <button ref={anchor} type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog" aria-label={`Server status: ${word}`}
                className={pillClass(band)}
                style={{ ...pillBox({ t, band, iconOnly, active: open, border: open ? `${tone}66` : undefined }), padding: iconOnly ? 0 : band ? '0 12px 0 10px' : '0 14px 0 12px', gap: 8 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = band ? 'rgba(0,0,0,0.34)' : t.sunken }}
                onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = band ? bandGlass.background : t.panel }}>
          <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: tone, boxShadow: band ? '0 0 0 2px rgba(255,255,255,0.55)' : `0 0 0 3px ${tone}2e` }} aria-hidden="true" />
          {!iconOnly && <span>Server{fit < 3 && <span style={{ fontWeight: 500, color: band ? 'rgba(255,255,255,0.82)' : st.warn ? inkOn(t, t.warn, 0.42) : t.inkDim }}> · {word}</span>}</span>}
        </button>
      </Tip>
      <AnimatePresence>{open && <Popover key="server" t={t} st={st} anchor={anchor} onClose={close} />}</AnimatePresence>
    </>
  )
}
