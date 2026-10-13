import React, { useState } from 'react'
import { AlertTriangle, CheckCircle2, Timer, Database } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { bandBg } from '../home-2027/band'
import { MATH, SIDE } from './content'
import { focusCls, inkOn, Card, IconSquare, Text, HoverNote, SideTag } from './parts'

/**
 * calculators.jsx — the two pieces of arithmetic behind the brief's
 * performance claims, made interactive so a seller can run them with the
 * prospect's own numbers.
 *
 *   TailCalc  the chance an agent task of N calls meets the gateway's p99
 *             at least once (1 − 0.99ᴺ), and each gateway's published p99
 *   PgCalc    the Postgres connections a LiteLLM deployment asks for at its
 *             autoscaling ceiling, against what the database accepts
 *
 * Bars are one measure in each side's identity colour (a validated pair),
 * every bar direct-labelled with its value.
 */

function Slider({ t, label, value, min, max, step = 1, onChange, unit, tone }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink }}>{label}</span>
        <span style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink }}>{value.toLocaleString()}{unit ? <span style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 500, color: t.inkDim }}> {unit}</span> : null}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
             className={`w-full ${focusCls}`} style={{ accentColor: tone }} aria-label={label} />
    </label>
  )
}

// ─── tail latency ────────────────────────────────────────────────────────────
const pct = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`

export function TailCalc({ t, tone }) {
  const [calls, setCalls] = useState(20)
  const [hot, setHot] = useState(null)
  const m = MATH.tail
  const p = 1 - 0.99 ** calls
  const max = Math.max(...m.series.map((s) => s.p99))
  return (
    <Card t={t} pad="16px 18px">
      <div className="flex items-start gap-3 mb-3">
        <IconSquare t={t} icon={Timer} tone={tone} />
        <div className="min-w-0">
          <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink }}>{m.title}</div>
          <Text t={t} size={12.5} text={m.text} />
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)' }}>
        <div className="rounded-2xl" style={{ padding: '12px 14px', background: t.sunken }}>
          <Slider t={t} label="Gateway calls per agent task" value={calls} min={1} max={200} onChange={setCalls} tone={tone} />
          <div className="mt-3" style={{ fontFamily: FONT.display, fontSize: 38, fontWeight: 700, color: t.ink, lineHeight: 1, letterSpacing: '-0.03em' }}>{pct(p)}</div>
          <div style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginTop: 4, lineHeight: 1.45 }}>
            of {calls}-call tasks meet at least one call in the gateway's slowest 1%.
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>
            {[10, 50, 100].map((n) => <span key={n}>{n} calls → {pct(1 - 0.99 ** n)}</span>)}
          </div>
        </div>
        <div>
          <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, marginBottom: 8 }}>Published p99 gateway overhead, ms</div>
          <div className="space-y-2.5" role="list" aria-label="Published p99 gateway overhead">
            {m.series.map((s) => {
              const c = SIDE[s.side].tone
              return (
                <div key={s.id} role="listitem" className="relative" onMouseEnter={() => setHot(s.id)} onMouseLeave={() => setHot(null)}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink }}>{s.label}</span>
                    <span style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>{s.side === 'airs' ? '15–20' : s.p99} <span style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 500, color: t.inkDim }}>ms</span></span>
                  </div>
                  <div className="relative mt-1" style={{ height: 10 }}>
                    <span className="absolute inset-y-0 left-0" style={{ width: `${(s.p99 / max) * 100}%`, background: c, borderRadius: '0 4px 4px 0', opacity: hot && hot !== s.id ? 0.45 : 1, transition: 'opacity 120ms' }} />
                  </div>
                  <HoverNote t={t} show={hot === s.id}>
                    <b>{s.label}</b><br />
                    p50 {s.p50 === 1 && s.side === 'airs' ? 'under 1' : s.p50} ms{s.p95 != null ? ` · p95 ${s.p95} ms` : ''} · p99 {s.side === 'airs' ? '15–20' : s.p99} ms<br />
                    <span style={{ opacity: 0.8 }}>{s.src}</span>
                  </HoverNote>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-3 mt-3"><SideTag t={t} side="litellm" small /><SideTag t={t} side="airs" small /></div>
        </div>
      </div>
      <div className="rounded-xl mt-4 flex gap-2.5" style={{ padding: '9px 12px', background: `${t.warn}10`, border: `1px solid ${t.warn}38` }}>
        <AlertTriangle size={14} style={{ color: inkOn(t, t.warn, 0.45), flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <div style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink, lineHeight: 1.55 }}>
          The probability argument is sound; the comparison is not one-sided. LiteLLM's own table puts its p99 at 43 ms on two instances and 13 ms on four — under the brief's 15–20 ms for AIRS. Use this to explain why tails matter, not to claim a latency win.
        </div>
      </div>
    </Card>
  )
}

// ─── Postgres connections ────────────────────────────────────────────────────
export function PgCalc({ t, tone }) {
  const d = MATH.pg.defaults
  const [replicas, setReplicas] = useState(d.replicas)
  const [workers, setWorkers] = useState(d.workers)
  const [pool, setPool] = useState(d.pool)
  const [bouncer, setBouncer] = useState(d.pgbouncer)
  const [maxConn, setMaxConn] = useState(d.maxConnections)
  const perPod = bouncer ? d.bouncerCap : workers * pool
  const asks = replicas * perPod
  const over = asks > maxConn
  const status = over ? t.warn : t.pass
  const scale = Math.max(asks, maxConn)
  const isDefault = replicas === d.replicas && workers === d.workers && pool === d.pool && !bouncer && maxConn === d.maxConnections
  const reset = () => { setReplicas(d.replicas); setWorkers(d.workers); setPool(d.pool); setBouncer(d.pgbouncer); setMaxConn(d.maxConnections) }

  return (
    <Card t={t} pad="16px 18px">
      <div className="flex items-start gap-3 mb-3">
        <IconSquare t={t} icon={Database} tone={tone} />
        <div className="min-w-0 flex-1">
          <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink }}>{MATH.pg.title}</div>
          <Text t={t} size={12.5} text={MATH.pg.text} />
        </div>
        {!isDefault && (
          <button type="button" onClick={reset} className={`rounded-full px-2.5 flex-shrink-0 ${focusCls}`}
                  style={{ height: 24, fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: inkOn(t, t.live, 0.2), background: `${t.live}12` }}>
            Chart defaults
          </button>
        )}
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <div className="space-y-3 rounded-2xl" style={{ padding: '12px 14px', background: t.sunken }}>
          <Slider t={t} label="Replicas (the autoscaling ceiling)" value={replicas} min={1} max={200} onChange={setReplicas} tone={tone} />
          <Slider t={t} label="Workers per pod" value={workers} min={1} max={8} onChange={setWorkers} tone={tone} />
          <Slider t={t} label="Pool limit per worker" value={pool} min={1} max={50} onChange={setPool} tone={tone} />
          <label className="flex items-center gap-2 cursor-pointer" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink }}>
            <input type="checkbox" checked={bouncer} onChange={(e) => setBouncer(e.target.checked)} style={{ accentColor: tone }} />
            In-pod PgBouncer (off in the chart; caps each pod at {d.bouncerCap})
          </label>
          <div>
            <div style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink, marginBottom: 5 }}>Postgres <code style={{ fontFamily: FONT.mono, fontSize: 11 }}>max_connections</code></div>
            <div role="radiogroup" aria-label="Postgres max_connections" className="flex flex-wrap gap-1">
              {[100, 500, 1000, 5000].map((n) => {
                const on = maxConn === n
                return (
                  <button key={n} type="button" role="radio" aria-checked={on} onClick={() => setMaxConn(n)}
                          className={`rounded-full px-2.5 ${focusCls}`}
                          style={{ height: 26, fontFamily: FONT.prose, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? '#fff' : t.ink, background: on ? bandBg(tone) : t.panel, border: `1px solid ${on ? 'transparent' : t.hairline}` }}>
                    {n.toLocaleString()}{n === 100 ? ' · default' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 700, color: inkOn(t, status, over ? 0.45 : 0.3) }}>
            {over ? <AlertTriangle size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
            {over ? `Asks for ${(asks / maxConn).toFixed(asks / maxConn >= 10 ? 0 : 1)}× what the database accepts` : 'Fits within the database\'s limit'}
          </div>
          <div className="mt-3 space-y-3">
            {[
              { label: 'LiteLLM asks for', n: asks, c: status },
              { label: 'Postgres accepts', n: maxConn, c: t.isLight ? '#94a3b8' : '#64748b' },
            ].map((r) => (
              <div key={r.label}>
                <div className="flex items-baseline justify-between">
                  <span style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>{r.label}</span>
                  <span style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 700, color: t.ink }}>{r.n.toLocaleString()}</span>
                </div>
                <div className="relative mt-1" style={{ height: 10 }}>
                  <span className="absolute inset-y-0 left-0" style={{ width: `${(r.n / scale) * 100}%`, minWidth: 4, background: r.c, borderRadius: '0 4px 4px 0' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl mt-3" style={{ padding: '8px 10px', background: t.sunken, fontFamily: FONT.mono, fontSize: 11, color: t.ink, lineHeight: 1.6 }}>
            {replicas} replicas × {bouncer ? `${d.bouncerCap} (PgBouncer cap)` : `${workers} worker${workers === 1 ? '' : 's'} × ${pool}`} = {asks.toLocaleString()}
          </div>
          <div className="mt-3 rounded-xl" style={{ padding: '8px 10px', background: `${SIDE.airs.tone}0e`, borderLeft: `3px solid ${SIDE.airs.tone}` }}>
            <SideTag t={t} side="airs" small />
            <div style={{ fontFamily: FONT.prose, fontSize: 12, color: t.ink, marginTop: 2, lineHeight: 1.5 }}>Stateless data plane with no database on the request path (the brief).</div>
          </div>
        </div>
      </div>
      <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, margin: '12px 0 0', lineHeight: 1.55 }}>
        Defaults are the LiteLLM chart's and production guide's: <code style={{ fontFamily: FONT.mono }}>maxReplicas: 100</code>, one worker per pod, a pool of 10. PostgreSQL's own docs give a typical default of 100 connections. With PgBouncer on, each pod holds at most 20 — fewer than four workers × 10, more than one × 10. The guide's advice: size the pool as max connections ÷ (instances × workers), and add a Redis transaction buffer above about 1,000 requests per second.
      </p>
    </Card>
  )
}
