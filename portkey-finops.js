// Budget / FinOps backend for the AI/LLM Gateway pillar.
// Real Portkey data: Analytics API for dashboards, Admin API for budget
// enforcement on an isolated demo key, plus a bounded traffic generator.
const PK_BASE = 'https://api.portkey.ai/v1'
const ADMIN_KEY = () => process.env.PORTKEY_ADMIN_API_KEY || ''

const FINOPS_DEMO_KEY_NAME = 'sudo-finops-demo'
const DEMO_CAP_USD = Number(process.env.FINOPS_DEMO_CAP_USD || 1)
const FINOPS_WORKSPACE_ID = '0cfd0b1a-6e24-4617-91b7-a0a44c241f23'

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
}

export { analyticsGet, isoRange }
