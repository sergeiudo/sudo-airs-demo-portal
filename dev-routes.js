/**
 * dev-routes.js — "Run it live" for the Developer Corner (/api/dev).
 *
 * Each route performs exactly the call a Developer Corner snippet shows, with
 * this portal's own credentials, and returns what actually went over the wire:
 * the request (method, URL, headers, body) and the response (status, headers,
 * body), timed. It is the proof that the code on the page is real.
 *
 * Rules:
 *   • Secrets never leave the server. API keys and bearer tokens are replaced
 *     by a fixed mask in the echoed request — not truncated, masked.
 *   • Plain fetch, not an SDK, so the HTTP the snippets describe is what is
 *     shown. (The snippets offer the SDKs as well; this proves the wire format.)
 *   • Nothing is written to traces.db — these are documentation calls.
 *   • The site is public, so every route is rate limited per client.
 */
import express from 'express'
import { performance } from 'perf_hooks'
import { airsFetch, SCAN_RETRY_MS, REPORT_RETRY_MS } from './telemetry.js'
import { MOH_ENV, MOH_MODELS } from './moh-routes.js'

const router = express.Router()
const MASK = '•••••••• (kept on the server)'
const MAX_TEXT = 4000

const AIRS = {
  base: () => (process.env.AIRS_BASE_URL || 'https://service.api.aisecurity.paloaltonetworks.com').replace(/\/+$/, ''),
  key: () => process.env.AIRS_API_KEY || '',
  profile: () => process.env.AIRS_PROFILE_NAME || '',
}
const AIMS_BASE = 'https://api.sase.paloaltonetworks.com/aims'
const TOKEN_URL = 'https://auth.apps.paloaltonetworks.com/oauth2/access_token'

// ─── rate limit: 30 live runs per client per 10 minutes ──────────────────────
const HITS = new Map()
function limited(req, res) {
  // The LAST x-forwarded-for entry is the address our own proxy (Nginx on EC2)
  // saw; earlier entries are whatever the client chose to send.
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',').pop().trim()
  const now = Date.now()
  const recent = (HITS.get(ip) || []).filter((t) => now - t < 10 * 60e3)
  if (recent.length >= 30) {
    res.status(429).json({ error: 'Live runs are limited to 30 per 10 minutes. Try again shortly.' })
    return true
  }
  recent.push(now)
  HITS.set(ip, recent)
  if (HITS.size > 5000) HITS.delete(HITS.keys().next().value)
  return false
}

const clip = (s) => String(s ?? '').slice(0, MAX_TEXT)
const pickHeaders = (h, names) => Object.fromEntries(names.filter((n) => h.get(n) != null).map((n) => [n, h.get(n)]))

/** One HTTP exchange, captured for display. `shownHeaders` is what the page may see. */
async function exchange({ url, method = 'GET', headers, shownHeaders, body, keepResponseHeaders = [], retry }) {
  const t0 = performance.now()
  let status = 0
  let resHeaders = {}
  let resBody = null
  let error = null
  try {
    const init = { method, headers, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) }
    const r = retry ? await airsFetch(url, init, retry) : await fetch(url, init)
    status = r.status
    resHeaders = pickHeaders(r.headers, ['content-type', 'x-request-id', 'x-portkey-trace-id', 'x-portkey-provider', 'x-portkey-last-used-option-index', 'x-portkey-cache-status', 'x-portkey-retry-attempt-count', ...keepResponseHeaders])
    const text = await r.text()
    try { resBody = JSON.parse(text) } catch { resBody = text.slice(0, 4000) }
  } catch (err) {
    error = `${err.name}: ${err.message}`
  }
  return {
    request: { method, url, headers: shownHeaders ?? headers, ...(body !== undefined ? { body } : {}) },
    response: { status, headers: resHeaders, body: resBody },
    elapsedMs: Math.round(performance.now() - t0),
    ok: status >= 200 && status < 300,
    error,
  }
}

function airsHeaders() {
  return {
    real: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-pan-token': AIRS.key() },
    shown: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-pan-token': MASK },
  }
}

function scanBody({ prompt, response, toolEvent, app = 'developer-corner' }) {
  const content = {}
  if (prompt) content.prompt = clip(prompt)
  if (response) content.response = clip(response)
  if (toolEvent) content.tool_event = toolEvent
  return {
    tr_id: `devcorner-${Date.now()}`,
    ai_profile: { profile_name: AIRS.profile() },
    metadata: { app_name: app, app_user: 'developer-corner', ai_model: 'n/a' },
    contents: [content],
  }
}

// ─── what can run on this host ───────────────────────────────────────────────
router.get('/status', (_req, res) => {
  // Readiness only — the browser needs to know what it can run, nothing more.
  res.json({
    runtime: { ready: !!(AIRS.key() && AIRS.profile()), base: AIRS.base() },
    gateway: { ready: !!(MOH_ENV.apiKey && MOH_ENV.configProtected), base: MOH_ENV.baseUrl },
    modelSecurity: { ready: !!(process.env.MODEL_SECURITY_CLIENT_ID && process.env.MODEL_SECURITY_CLIENT_SECRET && process.env.TSG_ID), base: AIMS_BASE },
  })
})

// ─── AIRS Runtime API ────────────────────────────────────────────────────────

router.post('/runtime/scan', async (req, res) => {
  if (limited(req, res)) return
  if (!AIRS.key() || !AIRS.profile()) return res.status(503).json({ error: 'AIRS_API_KEY and AIRS_PROFILE_NAME are not set on this host.' })
  const { prompt, response } = req.body || {}
  if (!prompt && !response) return res.status(400).json({ error: 'Send a prompt, a response, or both.' })
  const h = airsHeaders()
  const body = scanBody({ prompt, response })
  res.json(await exchange({ url: `${AIRS.base()}/v1/scan/sync/request`, method: 'POST', headers: h.real, shownHeaders: h.shown, body, retry: SCAN_RETRY_MS }))
})

router.post('/runtime/tool-event', async (req, res) => {
  if (limited(req, res)) return
  if (!AIRS.key() || !AIRS.profile()) return res.status(503).json({ error: 'AIRS_API_KEY and AIRS_PROFILE_NAME are not set on this host.' })
  const { serverName = 'demo-mcp-server', method = 'tools/call', toolName = 'read_file', input = '', output } = req.body || {}
  const toolEvent = {
    metadata: { ecosystem: 'mcp', method, server_name: String(serverName).slice(0, 100), tool_invoked: String(toolName).slice(0, 100) },
    input: clip(typeof input === 'string' ? input : JSON.stringify(input)),
    ...(output != null && output !== '' ? { output: clip(typeof output === 'string' ? output : JSON.stringify(output)) } : {}),
  }
  const h = airsHeaders()
  const body = scanBody({ toolEvent })
  res.json(await exchange({ url: `${AIRS.base()}/v1/scan/sync/request`, method: 'POST', headers: h.real, shownHeaders: h.shown, body, retry: SCAN_RETRY_MS }))
})

router.get('/runtime/report', async (req, res) => {
  if (limited(req, res)) return
  const id = String(req.query.id || '')
  if (!/^R[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'A report id looks like R followed by a UUID.' })
  if (!AIRS.key()) return res.status(503).json({ error: 'AIRS_API_KEY is not set on this host.' })
  const h = airsHeaders()
  res.json(await exchange({
    url: `${AIRS.base()}/v1/scan/reports?report_ids=${encodeURIComponent(id)}`,
    headers: { Accept: 'application/json', 'x-pan-token': AIRS.key() },
    shownHeaders: { Accept: 'application/json', 'x-pan-token': MASK },
    retry: REPORT_RETRY_MS,
  }))
})

// ─── SCM AI Gateway ──────────────────────────────────────────────────────────

router.post('/gateway/chat', async (req, res) => {
  if (limited(req, res)) return
  if (!MOH_ENV.apiKey || !MOH_ENV.configProtected) return res.status(503).json({ error: 'AIGW_API_KEY and AIGW_CONFIG_PROTECTED are not set on this host.' })
  const { prompt, guarded = true } = req.body || {}
  if (!prompt) return res.status(400).json({ error: 'Send a prompt.' })
  const config = guarded ? MOH_ENV.configProtected : (MOH_ENV.configUnprotected || MOH_ENV.configProtected)
  const body = {
    model: `${MOH_ENV.bedrockSlug}/${MOH_MODELS[0].id}`,
    messages: [{ role: 'user', content: clip(prompt) }],
    max_tokens: 200,
  }
  const base = {
    'Content-Type': 'application/json',
    'x-portkey-config': config,
    // Without this, hook_results (the guardrail verdict) are stripped from allowed responses.
    'x-portkey-strict-open-ai-compliance': 'false',
  }
  const out = await exchange({
    url: `${MOH_ENV.baseUrl.replace(/\/+$/, '')}/chat/completions`, method: 'POST',
    headers: { ...base, 'x-portkey-api-key': MOH_ENV.apiKey },
    shownHeaders: { ...base, 'x-portkey-api-key': MASK },
    body,
  })
  // A guardrail block on this tenant is HTTP 200 with the content replaced — read the hook verdict.
  const hooks = out.response.body?.hook_results
  const all = [...(hooks?.before_request_hooks || []), ...(hooks?.after_request_hooks || [])]
  out.verdict = !out.ok ? 'error' : all.some((h) => h?.verdict === false) ? 'blocked' : all.length ? 'allowed' : 'no-guardrail'
  out.guarded = guarded
  res.json(out)
})

// ─── AI Model Security: scan history (AIMS data API) ─────────────────────────

let aimsToken = { value: null, exp: 0 }
async function aimsBearer() {
  if (aimsToken.value && Date.now() < aimsToken.exp - 60e3) return aimsToken.value
  const basic = Buffer.from(`${process.env.MODEL_SECURITY_CLIENT_ID}:${process.env.MODEL_SECURITY_CLIENT_SECRET}`).toString('base64')
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: `tsg_id:${process.env.TSG_ID}` }),
    signal: AbortSignal.timeout(15000),
  })
  if (!r.ok) throw new Error(`token endpoint answered ${r.status}`)
  const j = await r.json()
  aimsToken = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 900) * 1000 }
  return aimsToken.value
}

router.get('/model-security/scans', async (req, res) => {
  if (limited(req, res)) return
  if (!process.env.MODEL_SECURITY_CLIENT_ID || !process.env.MODEL_SECURITY_CLIENT_SECRET || !process.env.TSG_ID) {
    return res.status(503).json({ error: 'MODEL_SECURITY_CLIENT_ID, MODEL_SECURITY_CLIENT_SECRET and TSG_ID are not set on this host.' })
  }
  let token
  try { token = await aimsBearer() } catch (err) { return res.status(502).json({ error: err.message }) }
  const limit = Math.max(1, Math.min(10, Number(req.query.limit) || 3))
  const out = await exchange({
    url: `${AIMS_BASE}/data/v1/scans?limit=${limit}&skip=0&sort_order=desc`,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    shownHeaders: { Authorization: `Bearer ${MASK}`, Accept: 'application/json' },
  })
  out.tokenStep = {
    method: 'POST', url: TOKEN_URL,
    headers: { Authorization: `Basic ${MASK}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&scope=tsg_id:${process.env.TSG_ID}`,
  }
  res.json(out)
})

export default router
