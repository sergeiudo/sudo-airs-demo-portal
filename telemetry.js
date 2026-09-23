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
import os from 'node:os'

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
export function gatewayBreakdown(hookResults, callStart, callEnd, { alignEnd = false, gw = 'AI-GW', guard = 'Prisma AIRS' } = {}) {
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
  // Map the gateway clock onto ours. A streamed call is anchored at its END:
  // the output guardrail runs after the last token and its result is the
  // stream's final chunk, so it finishes when the call does (measured: centring
  // instead put it ~300ms early, overlapping the streamed tokens). Otherwise
  // the unseen network time is split evenly either side.
  const base = alignEnd && gwEnd != null ? callEnd - gwEnd : callStart + outsideMs / 2 - gwStart

  return {
    inputGuardrailMs: inStart != null ? inEnd - inStart : null,
    providerMs: blockedAtInput ? null : (inEnd != null && outStart != null ? outStart - inEnd : null),
    outputGuardrailMs: outStart != null ? outEnd - outStart : null,
    gatewayMs,
    outsideMs: r0(outsideMs),
    blockedAtInput,
    // absolute perf stamps for Timeline.add
    segments: [
      inStart != null && { name: 'gateway_guardrail_input', label: `${gw} input guardrail · ${guard}`, start: base + inStart, end: base + inEnd },
      !blockedAtInput && inEnd != null && outStart != null && { name: 'gateway_provider', label: 'Provider call (via gateway)', start: base + inEnd, end: base + outStart },
      outStart != null && { name: 'gateway_guardrail_output', label: `${gw} output guardrail · ${guard}`, start: base + outStart, end: base + outEnd },
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

// ─── AIRS rate limits ─────────────────────────────────────────────────────────

/**
 * fetch() that rides out AIRS's rate limits. Shared by the portal's airscan()
 * and the MOH pillar's airscanMoh().
 *
 * Two different 429s, measured: "Requests per second exceeded limit" (no
 * retry_after — clears in well under a second, so retry) and the reports
 * endpoint's per-minute quota, `retry_after: {interval: 1, unit: "minute"}`
 * (retrying in seconds only burns more of the quota, so stop and report it).
 * Every attempt still shows in the trace's network phases.
 */
export async function airsFetch(url, init, delays) {
  for (let i = 0; ; i++) {
    const res = await fetch(url, init)
    if (res.status !== 429) return res
    const text = await res.text().catch(() => '')
    let waitMs = 0
    try {
      const ra = JSON.parse(text)?.error?.retry_after
      if (ra?.interval) waitMs = ra.interval * ({ second: 1e3, minute: 6e4, hour: 36e5 }[ra.unit] ?? 1e3)
    } catch { /* not JSON */ }
    const path = new URL(url).pathname
    if (i >= delays.length || waitMs > 5000) {
      if (waitMs > 5000) console.warn(`[AIRS] 429 on ${path} — quota says retry in ${Math.round(waitMs / 1000)}s; not retrying`)
      return new Response(text, { status: 429, headers: res.headers })
    }
    console.warn(`[AIRS] 429 rate limit on ${path} — retry ${i + 1}/${delays.length} in ${delays[i]}ms`)
    await new Promise((r) => setTimeout(r, Math.max(delays[i], waitMs)))
  }
}
export const SCAN_RETRY_MS = [250, 600]          // enforcement path: short
export const REPORT_RETRY_MS = [500, 1200, 2500] // background: patient

// ─── Gateway pillars (MOH on the SCM AI-GW, the legacy LLM Gateway) ──────────

/**
 * Portkey headers in one shape. A stream exposes a Headers object with
 * `x-portkey-*` names; a non-streamed completion's getHeaders() returns a plain
 * object without the prefix. The drawer reads the unprefixed names.
 */
export function normalizeGatewayHeaders(h) {
  if (!h) return null
  const get = typeof h.get === 'function' ? (k) => h.get(`x-portkey-${k}`) ?? h.get(k) : (k) => h[k] ?? h[`x-portkey-${k}`]
  const out = {}
  for (const k of ['trace-id', 'provider', 'cache-status', 'retry-attempt-count', 'last-used-option-index']) {
    const v = get(k)
    if (v != null) out[k] = String(v)
  }
  return Object.keys(out).length ? out : null
}

/** The first input / last output guardrail scan, in the drawer's scan shape. */
function scanFromHooks(hooks, phase) {
  const list = hooks.filter((h) => h.phase === phase && h.checks?.some((c) => c.scan))
  const h = phase === 'input' ? list[0] : list[list.length - 1]
  const c = h?.checks?.find((x) => x.scan)
  return c ? { via: 'ai-gateway-guardrail', ...c.scan, latencyMs: c.execMs ?? h.execMs, guardrailId: h.id, checkId: c.id, report: null } : null
}

/**
 * Trace detail for a pillar that goes through a Portkey gateway, in the same
 * shape /api/chat produces — so the Prompt Telemetry drawer (now also the
 * Observability drawer) renders it unchanged.
 *
 * `calls` are gateway round trips with absolute performance.now() stamps. Each
 * becomes a span; its guardrail/provider breakdown is rebuilt from that call's
 * own hook timestamps; a streamed call also gets measured time-to-first-token
 * and streaming spans. Other steps (direct tool scans, tool execution) are
 * added to `tl` by the caller before this runs.
 */
export function gatewayTraceDetail({
  tl, backend, modelId, verdict, airsEnabled, enforcement,
  calls = [], headers = null, gateway = {}, tokens = {}, finishReason = null, path = null,
  profile = null, tsg = null, tools = null, document = null,
}) {
  let mainBreakdown = null
  let ttftMs = null
  let streamMs = null
  const allHooks = []
  for (const call of calls) {
    tl.add('gateway_call', call.label || 'Gateway call', call.start, call.end, { lane: gateway.lane ?? null }, { http: call.http || [] })
    const b = gatewayBreakdown(call.hookResults, call.start, call.end, { alignEnd: !!call.lastToken, gw: gateway.name ?? 'AI-GW', guard: gateway.guard ?? 'Prisma AIRS' })
    if (b) {
      for (const seg of b.segments) tl.add(seg.name, seg.label, seg.start, seg.end, {}, { parent: 'gateway_call', derived: 'gateway-clock' })
      mainBreakdown = { ...b, segments: undefined }
    }
    if (call.firstToken) {
      ttftMs = Math.round(call.firstToken - call.start)
      tl.add('stream_first_token', 'Waiting for the first token', call.start, call.firstToken, {}, { parent: 'gateway_call' })
      if (call.lastToken && call.lastToken > call.firstToken) {
        streamMs = Math.round(call.lastToken - call.firstToken)
        tl.add('stream_tokens', 'Streaming tokens', call.firstToken, call.lastToken, { tokensOut: tokens.output ?? null }, { parent: 'gateway_call' })
      }
    }
    allHooks.push(...summarizeHooks(call.hookResults))
  }

  const gwHeaders = normalizeGatewayHeaders(headers)
  const modelMs = calls.reduce((n, c) => n + (c.end - c.start), 0)
  let detail = {
    v: 2,
    backend,
    modelId,
    enforcement: enforcement ?? (airsEnabled ? 'ai-gateway-guardrail' : 'none'),
    verdict,
    airsEnabled,
    host: { server: os.hostname(), via: null, node: process.version },
    airs: {
      profile: profile ?? scanFromHooks(allHooks, 'input')?.profile_name ?? null,
      host: 'inside the gateway',
      tsg,
      // Only an AIRS guardrail produces an AIRS scan; the legacy gateway's
      // native lane has hooks too, and the drawer shows those separately.
      input: airsEnabled ? scanFromHooks(allHooks, 'input') : null,
      output: airsEnabled ? scanFromHooks(allHooks, 'output') : null,
    },
    llm: calls.length ? {
      backend,
      modelId,
      latencyMs: Math.round(modelMs),
      finishReason,
      tokens: { input: tokens.input ?? null, output: tokens.output ?? null, total: (tokens.input ?? 0) + (tokens.output ?? 0) || null },
      meta: {
        path,
        provider: gwHeaders?.provider ?? null,
        providerMs: calls.length === 1 ? mainBreakdown?.providerMs ?? null : null,
        ttftMs,
        streamMs,
      },
    } : null,
    gateway: calls.length ? {
      baseUrl: gateway.baseUrl ?? null,
      configId: gateway.configId ?? null,
      lane: gateway.lane ?? null,
      headers: gwHeaders,
      hooks: allHooks,
      breakdown: calls.length === 1 ? mainBreakdown : null,
    } : null,
    mcp: tools,
    attachment: document?.text ? { name: document.name, chars: document.text.length } : null,
    timeline: tl.toJSON(),
  }
  if (document?.text) detail = redactDocument(detail)
  return truncateDeep(detail, 4000)
}
