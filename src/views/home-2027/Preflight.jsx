import React, { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Activity, ChevronDown } from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'

/**
 * Preflight — "am I ready to demo?", answered on the home page.
 *
 * Reads /api/health (configuration only, no network calls) and the local
 * scanner check. It is labelled as configuration because that is all it is:
 * a set key says nothing about an expired STS token or a lapsed ADC login.
 * The end-to-end check stays a deliberate act (/api/moh/health?probe=1), for
 * the reason CLAUDE.md gives — probing on every page load floods the SCM logs.
 */

const isLocal = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)

function Dot({ tone }) {
  return <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: tone }} aria-hidden="true" />
}

function RowItem({ t, tone, name, children, status }) {
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
      <Dot tone={tone} />
      <span className="flex-1 min-w-0" style={{ fontFamily: FONT.prose, fontSize: 13, fontWeight: 600, color: t.ink }}>
        {name}
        <span className="sr-only"> — {status}</span>
      </span>
      <span className="flex items-center gap-1.5 flex-wrap justify-end min-w-0" style={{ fontFamily: FONT.mono, fontSize: 11.5, color: t.inkDim }}>
        {children}
      </span>
    </div>
  )
}

function Pill({ t, on, children }) {
  return (
    <span className="rounded-full px-2 py-0.5"
          style={{
            fontFamily: FONT.mono, fontSize: 10.5,
            color: on ? t.pass : t.inkDim,
            background: on ? `${t.pass}14` : t.sunken,
            border: `1px solid ${on ? `${t.pass}40` : t.hairline}`,
            textDecoration: on ? 'none' : 'line-through',
          }}>
      {children}
    </span>
  )
}

/**
 * Readiness checks, shared by the top-bar pill and its popover. Configuration
 * only — see the note at the top of this file.
 */
export function usePreflight(t) {
  const [h, setH] = useState(null)
  const [scanner, setScanner] = useState(null)
  const [at, setAt] = useState(null)
  const [busy, setBusy] = useState(false)

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

  useEffect(() => { check() }, [check])

  const ok = t.pass, warn = t.warn, off = t.idle
  const scannerState = !scanner ? 'unknown' : !scanner.running ? 'offline' : scanner.configured === false ? 'stub' : 'live'
  // An older server does not send the newer fields; say "restart" rather
  // than showing a false red.
  const stale = h && h.aigw === undefined

  const rows = h ? [
    {
      name: 'AIRS Runtime API', tone: h.airs?.configured ? ok : warn, status: h.airs?.configured ? 'configured' : 'not configured',
      detail: h.airs?.configured ? <span className="truncate max-w-[180px]" title={h.airs.profile}>{h.airs.profile || 'profile unset'}</span> : 'no API key',
    },
    {
      name: 'SCM AI Gateway', tone: stale ? off : h.aigw?.configured ? ok : warn,
      status: stale ? 'unknown' : h.aigw?.configured ? 'configured' : 'not configured',
      detail: stale ? 'restart server to check' : h.aigw?.configured ? 'protected config set' : 'not set',
    },
    {
      name: 'Model providers', tone: (h.bedrock?.region || h.vertex?.project) ? ok : warn, status: 'providers',
      detail: (
        <>
          <Pill t={t} on={!!h.bedrock?.region}>Bedrock</Pill>
          <Pill t={t} on={!!h.vertex?.project}>Vertex</Pill>
          {!stale && <Pill t={t} on={!!h.azure?.configured}>Azure</Pill>}
        </>
      ),
    },
    {
      name: 'Model scanner', status: scannerState,
      tone: scannerState === 'live' ? ok : scannerState === 'stub' ? warn : off,
      detail: scannerState === 'live' ? 'live on :8001'
        : scannerState === 'stub' ? 'stub — credentials missing'
        : scannerState === 'offline' ? (isLocal() ? 'not running — npm run dev' : 'laptop only')
        : '—',
    },
    {
      name: 'Model Security API', tone: h.modelScanner?.configured ? ok : off, status: h.modelScanner?.configured ? 'configured' : 'not configured',
      detail: h.modelScanner?.configured ? 'SCM scan history on' : 'history unavailable',
    },
    {
      name: 'Telemetry', tone: h.traces ? ok : off, status: 'telemetry',
      detail: h.traces ? `${h.traces.total.toLocaleString()} traces · ${h.traces.blocked.toLocaleString()} blocked` : stale ? 'restart server to count' : '—',
    },
  ] : []

  // Amber = a core surface is unconfigured. The scanner (laptop-only) and the
  // Model Security history are optional and never turn the pill amber.
  const core = rows.filter((r) => ['AIRS Runtime API', 'SCM AI Gateway', 'Model providers'].includes(r.name))
  const needsAttention = core.some((r) => r.tone === warn)
  return { h, rows, at, busy, check, needsAttention, loaded: !!h || (!busy && at != null) }
}

/** The full check list — rendered inside the pill's popover. */
function PreflightPanel({ t, pf }) {
  const { h, rows, at, busy, check } = pf
  return (
    <section aria-labelledby="preflight-title" className="flex flex-col" style={{ ...glass(t, { radius: 22 }), padding: 18 }}>
      <div className="flex items-center gap-2 mb-1">
        <Activity size={15} style={{ color: t.ink }} aria-hidden="true" />
        <h2 id="preflight-title" style={{ fontFamily: FONT.display, fontSize: 16, fontWeight: 700, color: t.ink }}>Pre-flight</h2>
        <span className="ml-auto" style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim }}>
          {at ? `checked ${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'checking…'}
        </span>
        <button type="button" onClick={check} disabled={busy} aria-label="Re-check configuration"
                className="grid place-items-center rounded-full disabled:opacity-50"
                style={{ width: 30, height: 30, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>
      <p style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginBottom: 6 }}>
        Configuration on this host — set, not probed.
      </p>

      {!h && !busy && (
        <p style={{ fontFamily: FONT.prose, fontSize: 13, color: t.inkDim, padding: '10px 0' }}>The server did not answer /api/health.</p>
      )}
      {rows.map((r) => (
        <RowItem key={r.name} t={t} tone={r.tone} name={r.name} status={r.status}>{r.detail}</RowItem>
      ))}

      <p className="pt-3" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.5, color: t.inkDim, borderTop: `1px solid ${t.hairline}` }}>
        A set key can still be expired. For an end-to-end check before a demo, open{' '}
        <span style={{ fontFamily: FONT.mono, color: t.ink }}>/api/moh/health?probe=1</span>.
      </p>
    </section>
  )
}

/**
 * ReadinessPill — the pre-flight checks, off the front stage.
 *
 * They used to be a card in the home page hero, where an audience read
 * "protected config set" and "live on :8001" as noise. They are presenter
 * information, so they now live behind a pill in the top bar: green "Ready"
 * when the core surfaces are configured, amber when one is not, and the
 * full list one click away.
 */
export function ReadinessPill({ t }) {
  const pf = usePreflight(t)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const tone = !pf.loaded ? t.idle : pf.needsAttention ? t.warn : t.pass
  const label = !pf.loaded ? 'Checking' : pf.needsAttention ? 'Check setup' : 'Ready'

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog"
              title="Pre-flight: configuration on this host"
              className="inline-flex items-center gap-2 rounded-full px-3"
              style={{ height: 38, fontFamily: FONT.prose, fontSize: 13, fontWeight: 600, color: t.ink, background: t.panel, border: `1px solid ${t.hairline}` }}>
        <span className="rounded-full" style={{ width: 8, height: 8, background: tone, boxShadow: `0 0 0 3px ${tone}2e` }} aria-hidden="true" />
        {label}
        <ChevronDown size={13} style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} aria-hidden="true" />
      </button>
      {open && (
        <div role="dialog" aria-label="Pre-flight" className="absolute right-0 z-50" style={{ top: 'calc(100% + 8px)', width: 440 }}>
          <PreflightPanel t={t} pf={pf} />
        </div>
      )}
    </div>
  )
}
