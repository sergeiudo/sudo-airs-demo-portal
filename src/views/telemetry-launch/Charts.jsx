import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { BarChart3, Gauge, ShieldX, ShieldCheck, ShieldOff, Waypoints } from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { Section, Fine, IconSquare } from './Overview'
import { fmtCount, fmtMs, windowLong, inkOn } from './telemetryModel'


function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

const niceMax = (v) => {
  if (v <= 4) return Math.max(1, Math.ceil(v))
  const p = 10 ** Math.floor(Math.log10(v))
  const m = [1, 2, 2.5, 5, 10].find((k) => k * p >= v)
  return m * p
}

function bucketLabel(iso, bucketMs, spanMs) {
  const d = new Date(iso)
  if (bucketMs >= 86_400_000) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (spanMs > 86_400_000) return d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** A column whose top corners are rounded — the data end; the baseline stays square. */
function colPath(x, y, w, h, r) {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`
}

// ─── traffic over time ───────────────────────────────────────────────────────

export function TrafficChart({ t, data }) {
  const reduce = useReducedMotion()
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const { buckets, bucketMs } = data.series
  const series = useMemo(() => [
    { k: 'stopped', label: 'Stopped by AIRS', c: t.block },
    { k: 'cleared', label: 'Cleared', c: t.pass },
    { k: 'unscanned', label: 'Not inspected', c: t.warn },
  ], [t])
  const H = 176
  const PAD = { l: 34, r: 6, t: 8, b: 24 }
  const plotW = Math.max(0, width - PAD.l - PAD.r)
  const plotH = H - PAD.t - PAD.b
  const max = niceMax(Math.max(1, ...buckets.map((b) => b.stopped + b.cleared + b.unscanned)))
  const band = buckets.length ? plotW / buckets.length : 0
  const colW = Math.max(2, Math.min(24, band - 2))
  const spanMs = buckets.length * bucketMs
  const tickEvery = Math.max(1, Math.ceil(buckets.length / Math.max(2, Math.floor(plotW / 92))))
  const empty = buckets.every((b) => b.stopped + b.cleared + b.unscanned === 0)
  const hb = hover != null ? buckets[hover] : null

  return (
    <Section t={t} icon={BarChart3} tone={t.live} title="Traffic over time"
             sub={`Prompts per ${bucketMs >= 86_400_000 ? `${bucketMs / 86_400_000 > 1 ? `${bucketMs / 86_400_000} days` : 'day'}` : bucketMs >= 3_600_000 ? `${bucketMs / 3_600_000 > 1 ? `${bucketMs / 3_600_000} hours` : 'hour'}` : `${bucketMs / 60_000} min`}, ${windowLong(data.window)}`}
             right={(
               <div className="hidden sm:flex items-center gap-3 flex-shrink-0" aria-hidden="true">
                 {series.map((s) => (
                   <span key={s.k} className="inline-flex items-center gap-1.5" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
                     <span className="rounded-full" style={{ width: 8, height: 8, background: s.c }} /> {s.label}
                   </span>
                 ))}
               </div>
             )}>
      <div ref={ref} className="relative" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label="Prompts over time, stacked by outcome — a table follows for screen readers">
            {[0, 0.5, 1].map((k) => {
              const y = PAD.t + plotH * (1 - k)
              return (
                <g key={k}>
                  <line x1={PAD.l} x2={width - PAD.r} y1={y} y2={y} stroke={t.hairline} strokeWidth={1} />
                  <text x={PAD.l - 6} y={y + 3.5} textAnchor="end" style={{ fontFamily: FONT.prose, fontSize: 10, fill: t.inkFaint, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCount(Math.round(max * k))}
                  </text>
                </g>
              )
            })}
            {buckets.map((b, i) => {
              const x = PAD.l + i * band + (band - colW) / 2
              let y = PAD.t + plotH
              const parts = series.map((s) => ({ ...s, v: b[s.k] })).filter((p) => p.v > 0)
              const dim = hover != null && hover !== i
              return (
                <motion.g key={b.t} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: dim ? 0.4 : 1 }} transition={{ duration: 0.25 }}>
                  {parts.map((p, j) => {
                    const h = (p.v / max) * plotH
                    const top = j === parts.length - 1
                    const gap = j > 0 ? 2 : 0
                    y -= h
                    return top
                      ? <path key={p.k} d={colPath(x, y + gap, colW, h - gap, 4)} fill={p.c} />
                      : <rect key={p.k} x={x} y={y + gap} width={colW} height={Math.max(0, h - gap)} fill={p.c} />
                  })}
                </motion.g>
              )
            })}
            {buckets.map((b, i) => (i % tickEvery === 0 ? (
              <text key={`x${b.t}`} x={PAD.l + i * band + band / 2} y={H - 6} textAnchor="middle"
                    style={{ fontFamily: FONT.prose, fontSize: 10, fill: t.inkFaint }}>
                {bucketLabel(b.t, bucketMs, spanMs)}
              </text>
            ) : null))}
            {/* Hit targets: the whole column height, wider than the mark. */}
            {buckets.map((b, i) => (
              <rect key={`h${b.t}`} x={PAD.l + i * band} y={PAD.t} width={band} height={plotH} fill="transparent"
                    onMouseEnter={() => setHover(i)} />
            ))}
          </svg>
        )}
        {empty && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>
            No prompts in this window.
          </div>
        )}
        {hb && (
          <div className="absolute pointer-events-none rounded-xl px-3 py-2"
               style={{
                 top: 4, left: Math.min(Math.max(PAD.l + hover * band + band / 2, 90), width - 90), transform: 'translateX(-50%)', zIndex: 5,
                 background: t.isLight ? '#fff' : t.raised, border: `1px solid ${t.hairline}`, boxShadow: t.isLight ? '0 10px 28px rgba(18,18,22,0.14)' : '0 10px 28px rgba(0,0,0,0.5)', minWidth: 160,
               }}>
            <div style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, color: t.ink }}>
              {bucketLabel(hb.t, bucketMs, spanMs)} – {bucketLabel(new Date(Date.parse(hb.t) + bucketMs).toISOString(), bucketMs, spanMs)}
            </div>
            {series.map((s) => (
              <div key={s.k} className="flex items-center gap-2 mt-1" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
                <span className="rounded-full" style={{ width: 7, height: 7, background: s.c }} /> {s.label}
                <span className="ml-auto" style={{ color: t.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtCount(hb[s.k])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>Prompts per bucket by outcome</caption>
        <thead><tr><th>Start</th>{series.map((s) => <th key={s.k}>{s.label}</th>)}</tr></thead>
        <tbody>{buckets.filter((b) => b.stopped + b.cleared + b.unscanned > 0).map((b) => (
          <tr key={b.t}><td>{new Date(b.t).toLocaleString()}</td>{series.map((s) => <td key={s.k}>{b[s.k]}</td>)}</tr>
        ))}</tbody>
      </table>
    </Section>
  )
}

// ─── the cost of protection ──────────────────────────────────────────────────

function CompareRow({ t, icon, tone, label, sub, ms, max, n }) {
  const reduce = useReducedMotion()
  return (
    <div className="flex items-center gap-3 py-1.5">
      <IconSquare icon={icon} tone={tone} size={30} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{label}</span>
          <span className="ml-auto flex-shrink-0" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>{ms != null ? fmtMs(ms) : '—'}</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 8, marginTop: 4, background: t.sunken }}>
          {ms != null && (
            <motion.div className="h-full rounded-full" style={{ background: tone }}
                        initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.max(2, (ms / max) * 100)}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} />
          )}
        </div>
        <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 3 }}>{sub}{n ? ` · p50 of ${fmtCount(n)}` : ''}</div>
      </div>
    </div>
  )
}

export function CostOfProtection({ t, data }) {
  const L = data.latency
  const a = L.answered
  const has = a.n > 0 || L.promptBlocks.n > 0 || L.direct.n > 0
  const parts = [
    { k: 'in', label: 'Prompt scan', ms: a.scanIn.p50, c: t.pass },
    { k: 'model', label: 'Model', ms: a.model.p50, c: t.isLight ? '#71717A' : '#A1A1AA' },
    { k: 'out', label: 'Response scan', ms: a.scanOut.p50, c: t.pass },
  ].filter((p) => p.ms != null)
  const sum = parts.reduce((s, p) => s + p.ms, 0)
  const max = Math.max(1, L.promptBlocks.total.p50 ?? 0, a.total.p50 ?? 0, L.direct.total.p50 ?? 0)
  const faster = L.promptBlocks.total.p50 && a.total.p50 ? a.total.p50 / L.promptBlocks.total.p50 : null

  return (
    <Section t={t} icon={Gauge} tone={t.live} title="The cost of protection, measured"
             sub="Medians from this portal's own traces — what a scan adds, and what a block saves">
      {!has ? (
        <p style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>No API-layer traffic with timings in this window. The gateway lanes time the guardrail inside one call — see below when there is any.</p>
      ) : (
        <>
          {parts.length > 0 && (
            <div>
              <div className="flex items-baseline gap-2">
                <span style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink }}>Inside an inspected answer</span>
                <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>median of each hop · {fmtCount(a.n)} answers</span>
              </div>
              <div className="flex w-full overflow-hidden rounded-lg mt-2" style={{ height: 26, gap: 2 }}>
                {parts.map((p) => (
                  <div key={p.k} className="grid place-items-center min-w-0" title={`${p.label} · ${fmtMs(p.ms)}`}
                       style={{ flex: p.ms, background: p.c, minWidth: 6 }}>
                    {p.ms / sum > 0.16 && (
                      <span className="truncate px-1.5" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, color: '#fff' }}>{fmtMs(p.ms)}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {parts.map((p) => (
                  <span key={p.k} className="inline-flex items-center gap-1.5" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
                    <span className="rounded-sm" style={{ width: 8, height: 8, background: p.c }} /> {p.label} {fmtMs(p.ms)}
                  </span>
                ))}
                {sum > 0 && a.scanIn.p50 != null && (
                  <span className="ml-auto" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: inkOn(t, t.pass, 0.3) }}>
                    scans ≈ {Math.round((((a.scanIn.p50 ?? 0) + (a.scanOut.p50 ?? 0)) / sum) * 100)}% of the hops
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${t.hairline}` }}>
            <CompareRow t={t} icon={ShieldX} tone={t.block} label="Blocked at the prompt" ms={L.promptBlocks.total.p50} max={max} n={L.promptBlocks.n}
                        sub="the model is never called — no tokens spent" />
            <CompareRow t={t} icon={ShieldCheck} tone={t.pass} label="Inspected answer" ms={a.total.p50} max={max} n={a.n}
                        sub="prompt scan, model, response scan" />
            <CompareRow t={t} icon={ShieldOff} tone={t.warn} label="Unprotected answer" ms={L.direct.total.p50} max={max} n={L.direct.n}
                        sub="AIRS off — the model alone" />
          </div>

          {faster != null && faster > 1.2 && (
            <div className="mt-2 rounded-xl px-3 py-2" style={{ background: `${t.block}0f`, border: `1px solid ${t.block}2e` }}>
              <span style={{ fontFamily: FONT.prose, fontSize: 12, color: t.ink }}>
                A block comes back <b style={{ fontFamily: FONT.display }}>{faster.toFixed(1)}×</b> faster than an inspected answer — the attack never costs a model call.
              </span>
            </div>
          )}
        </>
      )}
      {L.gateway.n > 0 && (L.gateway.guardrailIn.p50 != null || L.gateway.guardrailOut.p50 != null) && (
        <div className="flex items-center gap-3 mt-3 pt-2.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
          <IconSquare icon={Waypoints} tone="#EC4899" size={30} />
          <div className="min-w-0" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.ink, lineHeight: 1.45 }}>
            Inside the gateway: input guardrail <b>{fmtMs(L.gateway.guardrailIn.p50)}</b>, output guardrail <b>{fmtMs(L.gateway.guardrailOut.p50)}</b>
            <span style={{ color: t.inkDim }}> · p50 from the gateway's own hook timings, {fmtCount(L.gateway.n)} measured traces</span>
          </div>
        </div>
      )}
      <Fine t={t}>
        API-layer targets only, where the scans and the model are separate timed hops. Different prompts and models sit behind each median, so
        compare the shapes, not a controlled benchmark. Hop medians don't add up to the total's median. The AIRS round trip from this host is in every scan — the “AIRS regions” pill in the header shows how much of it is network.
      </Fine>
    </Section>
  )
}
