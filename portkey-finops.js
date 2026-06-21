// Budget / FinOps backend for the AI/LLM Gateway pillar.
// Real Portkey data: Analytics API for dashboards, Admin API for budget
// enforcement on an isolated demo key, plus a bounded traffic generator.
import { Portkey } from 'portkey-ai'

const PK_BASE = 'https://api.portkey.ai/v1'
const ADMIN_KEY = () => process.env.PORTKEY_ADMIN_API_KEY || ''

const FINOPS_DEMO_KEY_NAME = 'sudo-finops-demo'
const DEMO_CAP_USD = Number(process.env.FINOPS_DEMO_CAP_USD || 1)
const FINOPS_WORKSPACE_ID = '0cfd0b1a-6e24-4617-91b7-a0a44c241f23'

// Enforcement demo — isolated token-capped key that trips 412 fast and cheaply
const ENFORCE_KEY_NAME = 'sudo-finops-enforce'
const ENFORCE_TOKEN_CAP = Number(process.env.FINOPS_ENFORCE_TOKEN_CAP) || 6000

// Admin API helper — uses hyphen paths for list/create, underscore for delete (Portkey quirk)
async function adminFetch(path, opts = {}) {
  const resp = await fetch(`${PK_BASE}${path}`, {
    ...opts,
    headers: {
      'x-portkey-api-key': ADMIN_KEY(),
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  })
  const text = await resp.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  if (!resp.ok) throw new Error(`admin ${path} → HTTP ${resp.status}: ${String(text).slice(0, 200)}`)
  return body
}

// Find or create the isolated demo key with a small cost cap.
// The full `key` value is only returned at create time; list returns masked values.
// Export so Tasks 4/5 can reuse it.
export async function ensureDemoKey() {
  const list = await adminFetch('/api-keys?page_size=100').catch(() => ({ data: [] }))
  const existing = (list.data || []).find(k => k.name === FINOPS_DEMO_KEY_NAME)
  if (existing) return existing
  // Omit alert_threshold: floor($1 * 0.8) = 0 which Portkey rejects (must be >=1)
  return adminFetch('/api-keys/workspace/service', {
    method: 'POST',
    body: JSON.stringify({
      name: FINOPS_DEMO_KEY_NAME,
      workspace_id: FINOPS_WORKSPACE_ID,
      scopes: ['completions.write'],
      usage_limits: {
        type: 'cost',
        credit_limit: DEMO_CAP_USD,
        periodic_reset: 'monthly',
      },
    }),
  })
}

// Recreate the enforcement key fresh each run so usage starts at 0 and we hold the full key value.
// List returns masked keys — delete any existing one, then create a fresh token-capped key.
async function recreateEnforceKey() {
  const list = await adminFetch('/api-keys?page_size=100').catch(() => ({ data: [] }))
  const existing = (list.data || []).find(k => k.name === ENFORCE_KEY_NAME)
  if (existing?.id) {
    await adminFetch(`/api-keys/${existing.id}`, { method: 'DELETE' }).catch(e => {
      console.warn('[finops/enforce] delete existing key failed (continuing):', e?.message)
    })
  }
  return adminFetch('/api-keys/workspace/service', {
    method: 'POST',
    body: JSON.stringify({
      name: ENFORCE_KEY_NAME,
      workspace_id: FINOPS_WORKSPACE_ID,
      scopes: ['completions.write'],
      usage_limits: {
        type: 'tokens',
        credit_limit: ENFORCE_TOKEN_CAP,
        periodic_reset: 'monthly',
      },
    }),
  })
}

// ISO8601 helpers (NO Date.now in workflow scripts, but this is server code — fine)
function isoRange(days) {
  const max = new Date()
  const min = new Date(max.getTime() - days * 86400000)
  return { min: min.toISOString(), max: max.toISOString() }
}

// GET a Portkey Analytics endpoint with the admin key.
async function analyticsGet(path, params = {}) {
  const url = new URL(`${PK_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v)
  const resp = await fetch(url, {
    headers: { 'x-portkey-api-key': ADMIN_KEY(), 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
  })
  if (!resp.ok) throw new Error(`analytics ${path} → HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
  return resp.json()
}

export function registerFinopsRoutes(router) {
  router.get('/finops/health', async (_req, res) => {
    const adminKey = !!ADMIN_KEY()
    let reachable = false
    if (adminKey) {
      try {
        const r = isoRange(1)
        await analyticsGet('/analytics/groups/ai-models', {
          time_of_generation_min: r.min,
          time_of_generation_max: r.max,
        })
        reachable = true
      } catch (e) { console.warn('[finops/health]', e?.message) }
    }
    res.json({ ok: adminKey && reachable, adminKey, reachable })
  })

  const _cache = new Map() // key -> { at, data }
  router.get('/finops/overview', async (req, res) => {
    if (!ADMIN_KEY()) return res.status(503).json({ error: 'configure_admin_key' })
    const range = ['24h', '7d', '30d'].includes(req.query.range) ? req.query.range : '30d'
    const days = range === '24h' ? 1 : range === '7d' ? 7 : 30
    const attrKey = ['team', '_user', 'app'].includes(req.query.attr) ? req.query.attr : 'team'
    const ck = `${range}:${attrKey}`
    const hit = _cache.get(ck)
    if (hit && Date.now() - hit.at < 45000) return res.json(hit.data)

    const { min, max } = isoRange(days)
    const tg = { time_of_generation_min: min, time_of_generation_max: max }
    try {
      const [models, costGraph, attr] = await Promise.all([
        analyticsGet('/analytics/groups/ai-models', tg).catch(() => ({ data: [] })),
        analyticsGet('/analytics/graphs/cost', tg).catch(() => ({ data_points: [], summary: {} })),
        analyticsGet(`/analytics/groups/metadata/${attrKey}`, tg).catch(() => ({ data: [] })),
      ])
      const byModel = (models.data || []).map(m => ({
        model: m.ai_model || m.model, cost: Number(m.cost || 0), requests: Number(m.requests || 0),
      }))
      // confirmed live shape: data_points use `total` for per-bucket cost
      const series = (costGraph.data_points || []).map(p => ({
        timestamp: p.timestamp, cost: Number(p.total ?? p.cost ?? 0),
      }))
      // summary.total is the authoritative workspace spend; fall back to sum of byModel costs
      const spend = (costGraph.summary?.total != null)
        ? Number(costGraph.summary.total)
        : byModel.reduce((s, m) => s + m.cost, 0)
      const attribution = (attr.data || []).map(a => ({
        name: a.metadata_value, cost: Number(a.cost || 0), requests: Number(a.requests || 0),
      })).sort((x, y) => y.cost - x.cost)
      const attrTotal = attribution.reduce((s, a) => s + a.cost, 0) || 1
      attribution.forEach(a => { a.share = Math.round((a.cost / attrTotal) * 100) })
      const data = {
        range,
        kpis: {
          spend,
          requests: byModel.reduce((s, m) => s + m.requests, 0),
          tokensIn: null, tokensOut: null, // no token graph available at v1
        },
        byModel, series, attribution,
        generatedAt: new Date().toISOString(),
      }
      _cache.set(ck, { at: Date.now(), data })
      res.json(data)
    } catch (e) {
      res.status(502).json({ error: 'analytics_failed', message: String(e?.message || e) })
    }
  })

  // GET /finops/budget — demo key cap + current 30-day spend from analytics
  router.get('/finops/budget', async (_req, res) => {
    if (!ADMIN_KEY()) return res.status(503).json({ error: 'configure_admin_key' })
    try {
      const key = await ensureDemoKey()
      const lim = key.usage_limits || {}
      const creditLimit = Number(lim.credit_limit ?? DEMO_CAP_USD)

      // Key objects have no live usage field — query analytics filtered by this key's id
      let used = 0
      try {
        const { min, max } = isoRange(30)
        const costData = await analyticsGet('/analytics/graphs/cost', {
          time_of_generation_min: min,
          time_of_generation_max: max,
          api_key_ids: key.id,
        })
        used = Number(costData?.summary?.total ?? 0)
      } catch (e) {
        console.warn('[finops/budget] analytics query failed, defaulting used=0:', e?.message)
      }

      res.json({
        creditLimit,
        alertThreshold: lim.alert_threshold ?? null,
        periodicReset: lim.periodic_reset ?? 'monthly',
        used,
        pct: creditLimit ? Math.min(100, Math.round((used / creditLimit) * 100)) : 0,
        currency: 'USD',
      })
    } catch (e) {
      res.status(502).json({ error: 'budget_failed', message: String(e?.message || e) })
    }
  })

  // POST /finops/generate — bounded SSE traffic generator.
  // Fires real, metadata-tagged LLM calls so attribution dashboards have data.
  router.post('/finops/generate', async (req, res) => {
    if (!ADMIN_KEY()) return res.status(503).json({ error: 'configure_admin_key' })
    const maxRequests = Math.min(50, Math.max(1, Number(req.body?.maxRequests) || 12))
    const models = Array.isArray(req.body?.models) && req.body.models.length
      ? req.body.models
      : GEN_MODELS_DEFAULT

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    const send = (event, data) => {
      if (res.writableEnded) return
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    try {
      let generated = 0
      for (let i = 0; i < maxRequests; i++) {
        const model = models[i % models.length]
        try {
          const r = await finopsChat(model, i)
          send('step', { i: i + 1, of: maxRequests, ok: true, ...r })
          generated++
        } catch (e) {
          send('step', {
            i: i + 1, of: maxRequests, ok: false, model,
            error: String(e?.message || e).slice(0, 160),
          })
        }
      }
      send('done', { generated })
    } finally {
      if (!res.writableEnded) res.end()
    }
  })

  // POST /finops/enforce/run — SSE: fires real requests through a fresh token-capped key until 412
  // Token caps trip fast + cheap (Portkey blocks before provider call on 412).
  router.post('/finops/enforce/run', async (_req, res) => {
    if (!ADMIN_KEY()) return res.status(503).json({ error: 'configure_admin_key' })
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    const send = (event, data) => {
      if (res.writableEnded) return
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    try {
      const enforceKey = await recreateEnforceKey()
      const keyValue = enforceKey.key || enforceKey.api_key
      if (!keyValue) throw new Error('recreateEnforceKey returned no usable key value')

      const client = new Portkey({ apiKey: keyValue, strictOpenAiCompliance: false })
      let blocked = false

      for (let n = 1; n <= 8 && !blocked; n++) {
        try {
          await client.chat.completions.create({
            model: '@sudo-bedrock/us.anthropic.claude-opus-4-8',
            max_tokens: 1024,
            messages: [{ role: 'user', content: LONG_PROMPT }],
          })
          send('req', { n, status: 'allowed', code: 200 })
        } catch (e) {
          // Log the full error once on first failure to expose where 412 lives
          if (n === 1 || process.env.FINOPS_DEBUG) console.log('[finops/enforce] error shape:', JSON.stringify({ status: e?.status, responseStatus: e?.response?.status, message: String(e?.message || '').slice(0, 300) }))
          const code = e?.status ?? e?.response?.status ?? (/412/.test(String(e?.message)) ? 412 : null)
          if (code === 412) {
            send('req', { n, status: 'blocked', code: 412 })
            blocked = true
          } else {
            send('req', { n, status: 'error', code, error: String(e?.message || e).slice(0, 200) })
          }
        }
      }
      send('done', { blocked })
    } catch (e) {
      send('error', { message: String(e?.message || e).slice(0, 300) })
    } finally {
      if (!res.writableEnded) res.end()
    }
  })

  // POST /finops/enforce/reset — delete the enforce key so next run starts fresh
  router.post('/finops/enforce/reset', async (_req, res) => {
    if (!ADMIN_KEY()) return res.status(503).json({ error: 'configure_admin_key' })
    try {
      const list = await adminFetch('/api-keys?page_size=100').catch(() => ({ data: [] }))
      const existing = (list.data || []).find(k => k.name === ENFORCE_KEY_NAME)
      if (existing?.id) {
        await adminFetch(`/api-keys/${existing.id}`, { method: 'DELETE' })
      }
      res.json({ ok: true })
    } catch (e) {
      res.status(502).json({ error: 'reset_failed', message: String(e?.message || e) })
    }
  })
}

export { analyticsGet, isoRange }

// ─── Traffic generator constants ────────────────────────────────────────────

const GEN_TEAMS = ['Platform', 'Support bot', 'Data Science', 'Marketing', 'Sandbox']
const GEN_MODELS_DEFAULT = [
  '@sudo-bedrock/us.anthropic.claude-opus-4-8',
  '@sudo-bedrock/anthropic.claude-3-haiku-20240307-v1:0',
  '@sudo-vertexai/gemini-3.5-flash',
]
const LONG_PROMPT = 'Write a detailed, approximately 600-word technical explainer on how an AI gateway enforces cost budgets, ' +
  'with clear sections and concrete examples. Cover: (1) request-level metadata tagging for attribution, ' +
  '(2) hard credit caps and periodic reset policies, (3) real-time analytics dashboards, ' +
  '(4) alert thresholds and automated throttling, (5) multi-team chargeback workflows.'

// One tagged, token-heavy call routed by the model\'s @integration prefix.
// Creates a fresh Portkey client per call so metadata is per-request.
async function finopsChat(model, idx) {
  if (!process.env.PORTKEY_API_KEY) throw new Error('PORTKEY_API_KEY not set')
  const team = GEN_TEAMS[idx % GEN_TEAMS.length]
  const user = `user-${(idx % 7) + 1}`
  const metadata = { _user: user, team, app: 'finops-generator', env: 'demo' }
  const client = new Portkey({
    apiKey: process.env.PORTKEY_API_KEY,
    strictOpenAiCompliance: false,
    metadata,
  })
  const r = await client.chat.completions.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: LONG_PROMPT }],
  })
  const usage = r?.usage || {}
  return { model, team, user, tokens: usage.total_tokens ?? null }
}
