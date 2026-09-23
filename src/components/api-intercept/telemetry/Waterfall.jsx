/**
 * Waterfall — the request as it actually happened, on one clock.
 *
 * Every bar is a measured span at its real offset; nothing is laid end to end.
 * Parallel work (MCP tool calls in one round) overlaps, because it did. Under
 * each bar, a thin strip shows the HTTP phases of the requests made inside it:
 * connect (only when a new connection was opened), wait (time to first byte)
 * and download.
 */
import React, { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { FONT, LBL, fmtMs, modelColor } from './primitives'

export function spanKind(name = '') {
  if (/^airs_.*_report$/.test(name)) return 'report'
  if (name.startsWith('airs_') || name.includes('guardrail') || name.endsWith('_scan')) return 'airs'
  if (name === 'llm_inference' || name === 'gateway_provider' || name === 'mcp_model_turn') return 'model'
  if (name === 'gateway_call') return 'gateway'
  if (name === 'mcp_tool_exec') return 'tool'
  if (name === 'mcp_discovery') return 'discovery'
  if (name === 'provider_auth') return 'auth'
  return 'other'
}

export const KIND_LABEL = {
  airs: 'Prisma AIRS scan',
  report: 'AIRS report fetch',
  model: 'Model / provider',
  gateway: 'AI-GW round trip',
  tool: 'MCP tool execution',
  discovery: 'MCP discovery',
  auth: 'Credential fetch',
}

export function kindColor(t, kind) {
  switch (kind) {
    case 'airs': return t.pass
    case 'report': return '#8FA3B8'
    case 'model': return modelColor(t)
    case 'gateway': return t.live
    case 'tool': return '#8C7BEA'
    case 'discovery': return '#9A9AA2'
    case 'auth': return t.warn
    default: return t.inkFaint
  }
}

export const PHASE_COLOR = { connect: '#E8A33D', wait: '#4A76F0', download: '#2E9E7B' }

/** Top-level spans with their children underneath, in start order. */
function nest(spans) {
  const top = []
  const kids = new Map()
  for (const s of spans) {
    const p = s.parent && spans.find((x) => x.name === s.parent && !x.parent && x.start <= s.start + 1 && x.end >= s.start - 1)
    if (!p) { top.push(s); continue }
    if (!kids.has(p)) kids.set(p, [])
    kids.get(p).push(s)
  }
  const rows = []
  for (const s of [...top].sort((a, b) => a.start - b.start)) {
    rows.push({ s, depth: 0 })
    for (const k of (kids.get(s) || []).sort((a, b) => a.start - b.start)) rows.push({ s: k, depth: 1 })
  }
  return rows
}

/** Wall-clock covered by top-level spans — overlaps counted once. */
export function coveredMs(spans) {
  const iv = spans.filter((s) => !s.parent).map((s) => [s.start, s.end]).sort((a, b) => a[0] - b[0])
  let total = 0, cur = null
  for (const [a, b] of iv) {
    if (!cur || a > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [a, b] } else cur[1] = Math.max(cur[1], b)
  }
  if (cur) total += cur[1] - cur[0]
  return total
}

/** Union of spans of one kind (any depth) — "how long was AIRS actually busy". */
export function kindMs(spans, kinds) {
  const iv = spans.filter((s) => kinds.includes(spanKind(s.name))).map((s) => [s.start, s.end]).sort((a, b) => a[0] - b[0])
  let total = 0, cur = null
  for (const [a, b] of iv) {
    if (!cur || a > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [a, b] } else cur[1] = Math.max(cur[1], b)
  }
  if (cur) total += cur[1] - cur[0]
  return Math.round(total)
}

function ticks(total) {
  const steps = [10, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 30000, 60000]
  const step = steps.find((s) => total / s <= 5) || 60000
  const out = []
  for (let v = 0; v <= total + 1; v += step) out.push(v)
  return out
}

const ATTR_LABEL = {
  action: 'action', category: 'category', scan_id: 'scan id', report_id: 'report id', round: 'round',
  tokensIn: 'tokens in', tokensOut: 'tokens out', toolCalls: 'tool calls', toolsOffered: 'tools offered',
  finish: 'finish', guardrailInMs: 'guardrail in', guardrailOutMs: 'guardrail out', server: 'server',
  cached: 'cached', via: 'via', resultChars: 'result chars', scannedChars: 'scanned chars', lane: 'lane', error: 'error',
}

function SpanDetail({ t, s }) {
  const attrs = Object.entries(s.attrs || {}).filter(([, v]) => v != null && v !== '')
  const mono = { fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }
  return (
    <div className="ml-4 mr-1 mb-2 mt-0.5 px-3 py-2" style={{ background: t.sunken, borderRadius: 12 }}>
      <div className="flex flex-wrap gap-x-4 gap-y-1" style={mono}>
        <span>start <b style={{ color: t.ink }}>+{fmtMs(s.start)}</b></span>
        <span>end <b style={{ color: t.ink }}>+{fmtMs(s.end)}</b></span>
        <span>duration <b style={{ color: t.ink }}>{fmtMs(s.ms)}</b></span>
        <span>status <b style={{ color: s.status === 'blocked' ? t.block : s.status === 'error' ? t.warn : t.ink }}>{s.status}</b></span>
      </div>
      {attrs.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5" style={mono}>
          {attrs.map(([k, v]) => (
            <span key={k} className="break-all">{ATTR_LABEL[k] ?? k} <b style={{ color: t.ink }}>{/Ms$/.test(k) ? fmtMs(v) : String(v)}</b></span>
          ))}
        </div>
      )}
      {s.error && <div className="mt-1.5 break-words" style={{ ...mono, color: t.warn }}>{s.error}</div>}
      {s.derived === 'gateway-clock' && (
        <div className="mt-1.5" style={{ fontFamily: FONT.prose, fontSize: 10, color: t.inkFaint, lineHeight: 1.45 }}>
          Order and duration come from the AI Gateway's own hook timestamps. How the time outside the
          gateway splits between the trip in and the trip out cannot be seen from here, so the block is centred.
        </div>
      )}
      {(s.http || []).map((h, i) => (
        <div key={i} className="mt-1.5 pt-1.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
          <div className="break-all" dir="ltr" style={{ ...mono, color: t.ink }}>
            {h.method} {h.host}{h.path} <span style={{ color: h.status >= 400 ? t.block : t.pass }}>{h.status ?? '—'}</span>
            {h.httpVersion ? <span style={{ color: t.inkFaint }}> · {h.httpVersion}</span> : null}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5" style={mono}>
            <span style={{ color: PHASE_COLOR.connect }}>{h.reused ? 'connection reused' : `new connection ${fmtMs(h.connectMs)}`}</span>
            <span style={{ color: PHASE_COLOR.wait }}>wait {fmtMs(h.waitMs)}</span>
            <span style={{ color: PHASE_COLOR.download }}>download {fmtMs(h.downloadMs)}</span>
            <span>total {fmtMs(h.totalMs)}</span>
            {h.error && <span style={{ color: t.warn }}>{h.error}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Waterfall({ t, spans = [], totalMs, compact = false }) {
  const rows = useMemo(() => nest(spans), [spans])
  const [open, setOpen] = useState(null)
  const total = Math.max(totalMs || 0, ...spans.map((s) => s.end || 0)) || 1
  const pctOf = (ms) => Math.max(0, Math.min(100, (ms / total) * 100))
  const labelW = compact ? '34%' : '40%'
  const grid = ticks(total)

  if (!rows.length) return null

  return (
    <div>
      {/* axis */}
      <div className="flex items-end mb-1">
        <div style={{ width: labelW }} />
        <div className="relative flex-1" style={{ height: 14 }}>
          {grid.map((v) => (
            <span key={v} className="absolute" style={{ left: `${pctOf(v)}%`, transform: v === 0 ? 'none' : 'translateX(-50%)', fontFamily: FONT.mono, fontSize: 8.5, color: t.inkFaint }}>
              {v === 0 ? '0' : fmtMs(v)}
            </span>
          ))}
        </div>
        <div style={{ width: 56 }} />
      </div>

      {rows.map(({ s, depth }, i) => {
        const kind = spanKind(s.name)
        const c = s.status === 'blocked' ? t.block : s.status === 'error' ? t.warn : kindColor(t, kind)
        const isOpen = open === i
        const left = pctOf(s.start)
        const width = Math.max(0.4, pctOf(s.end) - left)
        return (
          <div key={`${s.name}-${i}`}>
            <button
              type="button"
              onClick={() => !compact && setOpen(isOpen ? null : i)}
              className="flex items-center w-full text-left"
              style={{ cursor: compact ? 'default' : 'pointer', padding: '2px 0' }}
            >
              <div className="flex items-center gap-1.5 min-w-0 pr-2" style={{ width: labelW, paddingLeft: depth * 14 }}>
                {!compact && (
                  <ChevronRight size={10} style={{ color: t.inkFaint, flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                )}
                <span className="flex-shrink-0" style={{ width: 7, height: 7, borderRadius: 2, background: c, opacity: depth ? 0.75 : 1 }} />
                <span className="truncate" title={s.label} style={{ fontFamily: FONT.prose, fontSize: compact ? 10.5 : 11, color: depth ? t.inkDim : t.ink }}>
                  {s.label}
                </span>
                {s.derived && <span title="Derived from the gateway's own timestamps" style={{ fontSize: 10, color: t.inkFaint }}>≈</span>}
              </div>
              <div className="relative flex-1" style={{ height: compact ? 14 : 20 }}>
                {grid.map((v) => (
                  <span key={v} className="absolute top-0 bottom-0" style={{ left: `${pctOf(v)}%`, width: 1, background: t.hairline }} />
                ))}
                <span
                  className="absolute"
                  style={{
                    left: `${left}%`, width: `${width}%`, minWidth: 2,
                    top: compact ? 3 : 3, height: depth ? 7 : 9, borderRadius: 3,
                    background: s.derived ? `${c}55` : c,
                    border: s.derived ? `1px dashed ${c}` : 'none',
                    opacity: depth && !s.derived ? 0.8 : 1,
                  }}
                />
                {!compact && (s.http || []).map((h, j) => {
                  const segs = [
                    !h.reused && h.connectMs ? ['connect', h.connectMs] : null,
                    h.waitMs != null ? ['wait', h.waitMs] : null,
                    h.downloadMs ? ['download', h.downloadMs] : null,
                  ].filter(Boolean)
                  // End-aligned: the strip finishes where the exchange finished,
                  // and the small untimed gap (queueing, upload) sits at the front.
                  const measured = segs.reduce((n, [, ms]) => n + ms, 0)
                  let at = h.start + Math.max(0, (h.totalMs ?? measured) - measured)
                  return segs.map(([ph, ms]) => {
                    const l = pctOf(at)
                    at += ms
                    return (
                      <span key={`${j}-${ph}`} className="absolute" title={`${ph} ${fmtMs(ms)}`}
                        style={{ left: `${l}%`, width: `${Math.max(0.3, pctOf(at) - l)}%`, bottom: 1, height: 3, borderRadius: 2, background: PHASE_COLOR[ph] }} />
                    )
                  })
                })}
              </div>
              <div className="text-right flex-shrink-0" style={{ width: 56, fontFamily: FONT.mono, fontSize: 10, color: depth ? t.inkDim : t.ink }}>
                {fmtMs(s.ms)}
              </div>
            </button>
            {isOpen && <SpanDetail t={t} s={s} />}
          </div>
        )
      })}
    </div>
  )
}

export function Legend({ t, spans }) {
  const kinds = [...new Set(spans.map((s) => spanKind(s.name)))].filter((k) => KIND_LABEL[k])
  const hasHttp = spans.some((s) => s.http?.length)
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5" style={{ fontFamily: FONT.prose, fontSize: 10, color: t.inkDim }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: kindColor(t, k) }} />{KIND_LABEL[k]}
        </span>
      ))}
      {hasHttp && Object.entries(PHASE_COLOR).map(([k, c]) => (
        <span key={k} className="inline-flex items-center gap-1.5" style={{ fontFamily: FONT.prose, fontSize: 10, color: t.inkDim }}>
          <span style={{ width: 10, height: 3, borderRadius: 2, background: c }} />{k === 'wait' ? 'wait (TTFB)' : k}
        </span>
      ))}
      {spans.some((s) => s.derived) && (
        <span className="inline-flex items-center gap-1.5" style={{ ...LBL, fontSize: 8, color: t.inkFaint }}>≈ derived</span>
      )}
    </div>
  )
}
