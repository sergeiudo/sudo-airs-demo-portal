import React, { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { RefreshCw, ShieldX, ArrowRight } from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'

/**
 * LiveProof — the hero's right side: what Prisma AIRS actually stopped here.
 *
 * It replaced a pre-flight card of configuration ("protected config set",
 * "live on :8001") and a row of vanity counters (pillars, payloads, targets).
 * Neither answered the only question an audience brings: does it work? This
 * does, with the portal's own traffic from the trace store (/api/home/proof):
 *
 *   • how many attacks were stopped, out of how many prompts AIRS scanned;
 *   • how many were stopped before the model was ever called — the security
 *     and cost argument in one number (same test as the Telemetry pillar's
 *     "Blocked at Input Scan", so the two pages agree);
 *   • which detectors fired;
 *   • the latest intercepts — labelled by attack or detector, never by prompt
 *     text, which is raw test traffic.
 *
 * Labelled as this portal's demo traffic, with a since-date and an updated
 * time, because it is not customer production data and must not read as such.
 */

const TARGETS = {
  bedrock: 'AWS Bedrock', vertex: 'Google Vertex', azure: 'Azure OpenAI',
  aigw: 'SCM AI Gateway', 'moh-aigw': 'MOH · AI Gateway', portkey: 'Portkey gateway',
}

function ago(iso) {
  const ts = Date.parse(iso)
  if (!ts) return ''
  const s = (Date.now() - ts) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function LiveProof({ t, onOpenTelemetry, onOpenRuntime }) {
  const reduce = useReducedMotion()
  const [d, setD] = useState(null)
  const [state, setState] = useState('loading') // loading | ok | stale | error
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/home/proof')
      if (r.status === 404) { setState('stale'); return }
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setD(j); setState('ok')
    } catch {
      setState('error')
    } finally {
      setBusy(false)
    }
  }, [])

  // Refresh every minute while the page is open — the numbers move as the
  // demo runs, and "updated 2m ago" must stay true.
  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id) }, [load])

  const shell = { ...glass(t, { radius: 24 }), padding: 22 }
  const head = (
    <div className="flex items-center gap-2 mb-4">
      <span className="relative flex" style={{ width: 8, height: 8 }} aria-hidden="true">
        {!reduce && state === 'ok' && (
          <motion.span className="absolute inset-0 rounded-full" style={{ background: t.pass }}
                       animate={{ scale: [1, 2.4], opacity: [0.5, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />
        )}
        <span className="relative rounded-full" style={{ width: 8, height: 8, background: state === 'ok' ? t.pass : t.idle }} />
      </span>
      <h2 style={{ ...LBL, fontSize: 11, color: t.ink }}>Live from this portal</h2>
      {d?.last && <span style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim }}>· updated {ago(d.last)}</span>}
      <button type="button" onClick={load} disabled={busy} aria-label="Refresh"
              className="ml-auto grid place-items-center rounded-full disabled:opacity-50"
              style={{ width: 30, height: 30, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
        <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
      </button>
    </div>
  )

  if (state === 'stale' || state === 'error' || (state === 'ok' && !d?.blocked)) {
    return (
      <section aria-label="Live from this portal" className="flex flex-col justify-center" style={shell}>
        {head}
        <p style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 700, color: t.ink }}>
          {state === 'stale' ? 'Restart the server to show live results.'
            : state === 'error' ? 'The trace store did not answer.'
            : 'No intercepts yet.'}
        </p>
        <p style={{ fontFamily: FONT.prose, fontSize: 14, lineHeight: 1.55, color: t.inkDim, marginTop: 6 }}>
          {state === 'stale' ? 'The page is newer than the running Express process — restart npm run dev (pm2 restart airs-server on EC2).'
            : 'Fire a payload in AIRS Runtime & AI-GW and every block it causes shows up here, with where it was stopped.'}
        </p>
        {state === 'ok' && (
          <button type="button" onClick={onOpenRuntime} className="self-start mt-4 inline-flex items-center gap-2 rounded-full px-4"
                  style={{ height: 38, fontFamily: FONT.prose, fontSize: 13.5, fontWeight: 600, color: t.panel, background: t.ink }}>
            Open AIRS Runtime <ArrowRight size={14} />
          </button>
        )}
      </section>
    )
  }

  if (state === 'loading' || !d) {
    return <section aria-label="Live from this portal" style={{ ...shell, minHeight: 420 }}>{head}</section>
  }

  const before = d.beforeModel
  const after = Math.max(0, d.blocked - before)
  const pct = Math.round((before / d.blocked) * 100)
  const top = d.families.slice(0, 4)
  const max = Math.max(...top.map((f) => f.count), 1)
  const since = d.first ? new Date(d.first).toLocaleDateString([], { month: 'short', year: 'numeric' }) : null

  return (
    <section aria-label="Live from this portal" className="flex flex-col" style={shell}>
      {head}

      {/* the headline number */}
      <div className="flex items-end gap-3">
        <span style={{ fontFamily: FONT.display, fontSize: 60, fontWeight: 700, letterSpacing: '-0.04em', color: t.ink, lineHeight: 0.9 }}>
          {d.blocked.toLocaleString()}
        </span>
        <span style={{ fontFamily: FONT.display, fontSize: 18, fontWeight: 600, color: t.ink, paddingBottom: 4 }}>attacks stopped</span>
      </div>
      <p style={{ fontFamily: FONT.prose, fontSize: 13.5, color: t.inkDim, marginTop: 8 }}>
        out of {d.scanned.toLocaleString()} prompts Prisma AIRS inspected on this portal{since ? ` since ${since}` : ''}
      </p>

      {/* the security + cost argument */}
      <div className="mt-5 px-4 py-3.5" style={{ background: `${t.block}10`, border: `1px solid ${t.block}33`, borderRadius: 16 }}>
        <p style={{ fontFamily: FONT.prose, fontSize: 14, lineHeight: 1.45, color: t.ink }}>
          <strong style={{ fontFamily: FONT.display, fontSize: 22, color: t.block }}>{pct}%</strong>{' '}
          stopped <strong>before the model was called</strong> — zero tokens spent.
        </p>
        <div className="flex mt-3 overflow-hidden" style={{ height: 8, borderRadius: 999, background: t.sunken }}
             role="img" aria-label={`${before} blocked at the input scan, ${after} at the output scan`}>
          <span style={{ width: `${pct}%`, background: t.block }} />
          <span style={{ width: `${100 - pct}%`, background: `${t.block}55` }} />
        </div>
        <div className="flex justify-between mt-1.5" style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim }}>
          <span>{before.toLocaleString()} at the input scan</span>
          <span>{after.toLocaleString()} at the output scan</span>
        </div>
      </div>

      {/* what fired */}
      <div className="mt-5">
        <div style={{ ...LBL, fontSize: 10, color: t.inkDim, marginBottom: 8 }}>What was caught</div>
        <ul className="space-y-2">
          {top.map((f) => (
            <li key={f.key} className="grid items-center gap-3" style={{ gridTemplateColumns: '150px 1fr 40px' }}>
              <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 13, color: t.ink }}>{f.label}</span>
              <span className="overflow-hidden" style={{ height: 8, borderRadius: 999, background: t.sunken }}>
                <motion.span className="block h-full" style={{ background: t.block, borderRadius: 999, opacity: 0.85 }}
                             initial={reduce ? false : { width: 0 }} animate={{ width: `${(f.count / max) * 100}%` }}
                             transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
              </span>
              <span className="text-right" style={{ fontFamily: FONT.mono, fontSize: 12, color: t.inkDim }}>{f.count}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* the latest intercepts */}
      {d.recent?.length > 0 && (
        <div className="mt-5">
          <div style={{ ...LBL, fontSize: 10, color: t.inkDim, marginBottom: 6 }}>Latest intercepts</div>
          <ul>
            {d.recent.slice(0, 3).map((r, i) => (
              <li key={r.at + i} className="flex items-center gap-2.5 py-2" style={{ borderTop: i ? `1px solid ${t.hairline}` : 'none' }}>
                <ShieldX size={14} style={{ color: t.block, flexShrink: 0 }} aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate" style={{ fontFamily: FONT.prose, fontSize: 13, fontWeight: 600, color: t.ink }}>{r.label}</span>
                {r.backend && (
                  <span className="flex-shrink-0 rounded-full px-2 py-0.5"
                        style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
                    {TARGETS[r.backend] ?? r.backend}
                  </span>
                )}
                <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim, width: 56, textAlign: 'right' }}>{ago(r.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 pt-3 flex items-center gap-3" style={{ borderTop: `1px solid ${t.hairline}` }}>
        <span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>This portal's demo traffic, from its own trace store.</span>
        <button type="button" onClick={onOpenTelemetry} className="ml-auto inline-flex items-center gap-1.5 flex-shrink-0"
                style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.live }}>
          LLM Telemetry <ArrowRight size={13} />
        </button>
      </div>
    </section>
  )
}
