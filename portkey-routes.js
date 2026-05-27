// Express router for Portkey-backed AI/LLM Gateway pillar.
// Mounted at /api/gateway from server.js.

import express from 'express'
import { Portkey } from 'portkey-ai'

const router = express.Router()

const ENV = {
  apiKey:           process.env.PORTKEY_API_KEY || '',
  configAirs:       process.env.PORTKEY_CONFIG_AIRS || '',
  configNoGuard:    process.env.PORTKEY_CONFIG_NO_GUARDRAIL || '',
  configDefaults:   process.env.PORTKEY_CONFIG_DEFAULTS || '',
  configFallback:   process.env.PORTKEY_CONFIG_FALLBACK || '',
  vertexSlug:       process.env.PORTKEY_VERTEX_SLUG || '@sudo-vertexai',
  bedrockSlug:      process.env.PORTKEY_BEDROCK_SLUG || '',
}

function buildClient(configId) {
  if (!ENV.apiKey) throw new Error('PORTKEY_API_KEY not set')
  const opts = { apiKey: ENV.apiKey }
  if (configId) opts.config = configId
  return new Portkey(opts)
}

router.get('/health', async (_req, res) => {
  const required = {
    PORTKEY_API_KEY:               !!ENV.apiKey,
    PORTKEY_CONFIG_AIRS:           !!ENV.configAirs,
    PORTKEY_CONFIG_NO_GUARDRAIL:   !!ENV.configNoGuard,
    PORTKEY_CONFIG_DEFAULTS:       !!ENV.configDefaults,
    PORTKEY_CONFIG_FALLBACK:       !!ENV.configFallback,
    PORTKEY_BEDROCK_SLUG:          !!ENV.bedrockSlug,
  }
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k)

  if (!ENV.apiKey) {
    return res.status(503).json({
      ok: false, status: 'unconfigured', missing,
      message: 'PORTKEY_API_KEY missing — see .env.example',
    })
  }

  // Probe Portkey reachability via a direct fetch to the Portkey API.
  // client.models.list() routes to the configured upstream (e.g. Vertex AI)
  // which does not expose a /models endpoint — use raw fetch instead.
  let reachable = false
  let modelCount = 0
  try {
    const resp = await fetch('https://api.portkey.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portkey-api-key': ENV.apiKey,
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      signal: AbortSignal.timeout(8000),
    })
    // Any HTTP response (even 4xx) means Portkey is reachable
    reachable = resp.status < 500
  } catch (e) {
    reachable = false
  }

  res.json({
    ok: reachable && missing.length === 0,
    status: !reachable ? 'down' : (missing.length ? 'degraded' : 'healthy'),
    reachable, modelCount, missing,
  })
})

export default router
export { ENV, buildClient }
