/**
 * telemetry.js — measured timelines for one /api/chat request.
 *
 * The old drawer showed a total that was `airs_in + llm + airs_out` added up,
 * spans laid end to end from a cursor, and a "how latency is measured" panel
 * whose numbers (~150–200ms network, ~500–600ms AIRS) were typed in. None of it
 * was measured, and the gaps between the parts — the AIRS report fetch after
 * every scan, an ADC token refresh, JSON parsing — were simply invisible.
 *
 * This records what actually happened:
 *   • every span with its real start and end on one clock (performance.now())
 *   • every HTTP exchange inside a span, split into connect / wait / download,
 *     using undici's diagnostics channels — the same hooks Node's built-in
 *     fetch publishes. Verified to attribute correctly under concurrency.
 *
 * What it deliberately does NOT claim: "wait" (time to first byte) is network
 * round-trip plus the remote service's processing, and no service here reports
 * its processing time separately. It is shown as one number, not split by
 * guesswork. Bedrock's SDK uses node:http rather than fetch, so it gets no
 * phases — but Bedrock reports its own server-side latency, which is better.
 */

import dc from 'node:diagnostics_channel'
import { AsyncLocalStorage } from 'node:async_hooks'
import { performance } from 'node:perf_hooks'

const als = new AsyncLocalStorage()
const byRequest = new WeakMap()
// connectParams is NOT the same object in beforeConnect and connected, so the
// connect start is keyed by origin. Two simultaneous connects to one origin
// would share a start; that is rare here and errs toward a longer connect.
const connecting = new Map()       // "host:port" → connect start
const socketOpened = new WeakMap() // socket → { start, end }
const originKey = (p) => `${p?.hostname ?? p?.host ?? ''}:${p?.port ?? ''}`

const now = () => performance.now()

dc.subscribe('undici:request:create', ({ request }) => {
  const sink = als.getStore()
  if (!sink) return
  let host = ''
  try { host = new URL(request.origin).host } catch { /* keep '' */ }
  const x = {
    method: request.method,
    host,
    path: String(request.path || '').split('?')[0], // never persist query strings
    created: now(), sent: null, headers: null, done: null,
    status: null, reused: null, connectMs: null, error: null,
  }
  sink.push(x)
  byRequest.set(request, x)
})
dc.subscribe('undici:client:beforeConnect', ({ connectParams }) => {
  if (connectParams) connecting.set(originKey(connectParams), now())
})
dc.subscribe('undici:client:connected', ({ connectParams, socket }) => {
  if (!socket) return
  const key = originKey(connectParams)
  socketOpened.set(socket, { start: connecting.get(key) ?? null, end: now(), version: connectParams?.version ?? null })
  connecting.delete(key)
})
dc.subscribe('undici:client:sendHeaders', ({ request, socket }) => {
  const x = byRequest.get(request)
  if (!x) return
  x.sent = now()
  // A socket opened after this request was created was opened FOR it.
  const opened = socket && socketOpened.get(socket)
  x.httpVersion = opened?.version ?? null
  if (opened && opened.end >= x.created) {
    x.reused = false
    x.connectMs = opened.start != null ? opened.end - opened.start : null
  } else {
    x.reused = true
  }
})
dc.subscribe('undici:request:headers', ({ request, response }) => {
  const x = byRequest.get(request)
  if (x) { x.headers = now(); x.status = response?.statusCode ?? null }
})
dc.subscribe('undici:request:trailers', ({ request }) => {
  const x = byRequest.get(request)
  if (x) x.done = now()
})
dc.subscribe('undici:request:error', ({ request, error }) => {
  const x = byRequest.get(request)
  if (x) { x.done = now(); x.error = String(error?.message || error).slice(0, 160) }
})

/**
 * Run fn and return every HTTP exchange it made, with absolute stamps.
 * Usable without a Timeline — airscan() uses it to split scan from report.
 */
export async function captureHttp(fn) {
  const sink = []
  const start = now()
  const value = await als.run(sink, fn)
  return { value, http: sink, start, end: now() }
}

export { now as perfNow }

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10)
const r0 = (v) => (v == null ? null : Math.round(v))

export class Timeline {
  constructor() {
    this.t0 = now()
    this.startedAt = new Date().toISOString()
    this.spans = []
  }

  rel(t) { return r1(t - this.t0) }

  /** An exchange, re-based onto this timeline. */
  exchange(x) {
    return {
      method: x.method,
      host: x.host,
      path: x.path,
      status: x.status,
      reused: x.reused,
      httpVersion: x.httpVersion ?? null,
      start: this.rel(x.created),
      connectMs: r0(x.connectMs),
      waitMs: x.headers != null && x.sent != null ? r0(x.headers - x.sent) : null,
      downloadMs: x.done != null && x.headers != null ? r0(x.done - x.headers) : null,
      totalMs: x.done != null ? r0(x.done - x.created) : null,
      error: x.error,
    }
  }

  /** Run fn as a span: real start/end plus every HTTP exchange inside it. */
  async span(name, label, fn, attrs = {}) {
    const rec = { name, label, start: null, end: null, ms: null, status: 'ok', attrs: { ...attrs }, http: [] }
    this.spans.push(rec)
    const sink = []
    const start = now()
    rec.start = this.rel(start)
    try {
      return await als.run(sink, fn)
    } catch (e) {
      rec.status = 'error'
      rec.error = String(e?.message || e).slice(0, 200)
      throw e
    } finally {
      const end = now()
      rec.end = this.rel(end)
      rec.ms = r0(end - start)
      rec.http = sink.map((x) => this.exchange(x))
    }
  }

  /** A span measured elsewhere, from absolute performance.now() stamps. */
  add(name, label, start, end, attrs = {}, { http = [], status = 'ok', parent = null, derived = null } = {}) {
    if (start == null || end == null) return null
    const rec = {
      name, label,
      start: this.rel(start), end: this.rel(end), ms: r0(end - start),
      status, attrs, http: http.map((x) => this.exchange(x)),
      ...(parent ? { parent } : {}),
      ...(derived ? { derived } : {}),
    }
    this.spans.push(rec)
    return rec
  }

  elapsed() { return r0(now() - this.t0) }

  toJSON(totalMs = this.elapsed()) {
    return {
      startedAt: this.startedAt,
      totalMs,
      spans: [...this.spans].sort((a, b) => a.start - b.start),
    }
  }
}

/**
 * Rebuild what happened INSIDE one AI-GW call from the gateway's own hook
 * timestamps. Portkey stamps each guardrail hook with `created_at` (its start)
 * and `execution_time`, all on the gateway's clock, so the order and duration
 * of input guardrail → provider → output guardrail is exact. What cannot be
 * known from the client is how the remaining time splits between the trip in
 * and the trip out, so the inner block is centred and marked `derived`.
 *
 * Measured on a real call: 2,465ms client-side = 410 input guardrail + 1,390
 * provider + 497 output guardrail + 168 outside the gateway.
 */
export function gatewayBreakdown(hookResults, callStart, callEnd) {
  const before = (hookResults?.before_request_hooks || []).filter((h) => h?.created_at)
  const after = (hookResults?.after_request_hooks || []).filter((h) => h?.created_at)
  if (!before.length && !after.length) return null

  const ts = (h) => Date.parse(h.created_at)
  const inStart = before.length ? Math.min(...before.map(ts)) : null
  const inEnd = before.length ? Math.max(...before.map((h) => ts(h) + (h.execution_time || 0))) : null
  const outStart = after.length ? Math.min(...after.map(ts)) : null
  const outEnd = after.length ? Math.max(...after.map((h) => ts(h) + (h.execution_time || 0))) : null
  const blockedAtInput = before.some((h) => h.verdict === false) && !after.length

  const gwStart = inStart ?? outStart
  const gwEnd = outEnd ?? inEnd
  const gatewayMs = gwEnd - gwStart
  const clientMs = callEnd - callStart
  const outsideMs = Math.max(0, clientMs - gatewayMs)
  const base = callStart + outsideMs / 2 - gwStart // map gateway clock → our clock

  return {
    inputGuardrailMs: inStart != null ? inEnd - inStart : null,
    providerMs: blockedAtInput ? null : (inEnd != null && outStart != null ? outStart - inEnd : null),
    outputGuardrailMs: outStart != null ? outEnd - outStart : null,
    gatewayMs,
    outsideMs: r0(outsideMs),
    blockedAtInput,
    // absolute perf stamps for Timeline.add
    segments: [
      inStart != null && { name: 'gateway_guardrail_input', label: 'AI-GW input guardrail · Prisma AIRS', start: base + inStart, end: base + inEnd },
      !blockedAtInput && inEnd != null && outStart != null && { name: 'gateway_provider', label: 'Provider call (via gateway)', start: base + inEnd, end: base + outStart },
      outStart != null && { name: 'gateway_guardrail_output', label: 'AI-GW output guardrail · Prisma AIRS', start: base + outStart, end: base + outEnd },
    ].filter(Boolean),
  }
}

/** Hook results → a compact, persistable list (the AIRS payload trimmed to what is read). */
export function summarizeHooks(hookResults) {
  const one = (phase) => (h) => ({
    phase,
    id: h.id ?? null,
    verdict: h.verdict ?? null,
    execMs: h.execution_time ?? null,
    createdAt: h.created_at ?? null,
    deny: h.deny ?? null,
    checks: (h.checks || []).map((c) => ({
      id: c.id ?? null,
      verdict: c.verdict ?? null,
      execMs: c.execution_time ?? null,
      error: c.error ?? null,
      scan: c.data && typeof c.data === 'object' ? {
        action: c.data.action ?? null,
        category: c.data.category ?? null,
        scan_id: c.data.scan_id ?? null,
        report_id: c.data.report_id ?? null,
        tr_id: c.data.tr_id ?? null,
        transaction_id: c.data.transaction_id ?? null,
        profile_id: c.data.profile_id ?? null,
        profile_name: c.data.profile_name ?? null,
        source: c.data.source ?? null,
        timeout: c.data.timeout ?? null,
        error: c.data.error ?? null,
        prompt_detected: c.data.prompt_detected ?? null,
        response_detected: c.data.response_detected ?? null,
        prompt_masked_data: c.data.prompt_masked_data ?? null,
        response_masked_data: c.data.response_masked_data ?? null,
      } : null,
    })),
  })
  return [
    ...(hookResults?.before_request_hooks || []).map(one('input')),
    ...(hookResults?.after_request_hooks || []).map(one('output')),
  ]
}

/** Deep copy with every long string cut — keeps traces.db from ballooning. */
export function truncateDeep(value, max = 4000) {
  if (typeof value === 'string') return value.length > max ? `${value.slice(0, max)}…[+${value.length - max} chars]` : value
  if (Array.isArray(value)) return value.map((v) => truncateDeep(v, max))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) if (typeof v !== 'function') out[k] = truncateDeep(v, max)
    return out
  }
  return value
}

/**
 * An attached document must not be archived through the back door. The trace
 * stores only a reference to it, but the AIRS request body, the masked prompt
 * and the report's snippets all quote the text AIRS saw — which includes the
 * document. Replace those with a marker.
 */
const SNIPPET_KEYS = new Set(['pi_snippets', 'dlp_snippets', 'tc_snippets', 'snippets', 'data'])
export function redactDocument(value, marker = '[attachment text not stored]') {
  if (Array.isArray(value)) return value.map((v) => redactDocument(v, marker))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (SNIPPET_KEYS.has(k) && (typeof v === 'string' || Array.isArray(v))) out[k] = typeof v === 'string' ? marker : v.map((x) => (typeof x === 'string' ? marker : redactDocument(x, marker)))
      else if ((k === 'prompt' || k === 'response') && typeof v === 'string') out[k] = marker
      else out[k] = redactDocument(v, marker)
    }
    return out
  }
  return value
}
