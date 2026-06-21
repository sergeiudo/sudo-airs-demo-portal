// Budget / FinOps backend for the AI/LLM Gateway pillar.
// Real Portkey data: Analytics API for dashboards, Admin API for budget
// enforcement on an isolated demo key, plus a bounded traffic generator.
const PK_BASE = 'https://api.portkey.ai/v1'
const ADMIN_KEY = () => process.env.PORTKEY_ADMIN_API_KEY || ''

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
      } catch {}
    }
    res.json({ ok: adminKey && reachable, adminKey, reachable })
  })
}

export { analyticsGet, isoRange }
