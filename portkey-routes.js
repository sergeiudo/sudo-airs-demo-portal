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

router.get('/configs', (_req, res) => {
  res.json({
    configs: [
      { id: 'airs',         label: 'Portkey + AIRS',             slug: ENV.configAirs,     attached: 'AIRS guardrail',           ready: !!ENV.configAirs },
      { id: 'no-guardrail', label: 'Vertex (no guardrail)',      slug: ENV.configNoGuard,  attached: 'none',                     ready: !!ENV.configNoGuard },
      { id: 'defaults',     label: 'Portkey default guardrails', slug: ENV.configDefaults, attached: 'Portkey regex/PII checks', ready: !!ENV.configDefaults },
      { id: 'fallback',     label: 'Vertex → Bedrock fallback',  slug: ENV.configFallback, attached: 'fallback chain',           ready: !!ENV.configFallback },
    ],
  })
})

// Hardcoded model catalog. Portkey's OpenAI-compatible /v1/models routes to
// the upstream provider (Vertex doesn't have /models, returns Google 404),
// so dynamic discovery is not possible via the standard SDK. Curate models
// here matching what's provisioned in your Portkey integrations. Vertex
// models are the ones enabled in this project's GCP; Bedrock models match
// what the user provisioned in Portkey under @sudo-bedrock.
const MODEL_CATALOG = {
  [`${ENV.vertexSlug || '@sudo-vertexai'}`]: [
    { id: 'gemini-2.0-flash-001',       displayName: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.5-flash',           displayName: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro',             displayName: 'Gemini 2.5 Pro' },
    { id: 'gemini-1.5-pro-002',         displayName: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash-002',       displayName: 'Gemini 1.5 Flash' },
  ],
}

if (ENV.bedrockSlug) {
  MODEL_CATALOG[ENV.bedrockSlug] = [
    { id: 'anthropic.claude-sonnet-4-20250514-v1:0', displayName: 'Claude Sonnet 4 (Bedrock)' },
    { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0', displayName: 'Claude 3.5 Sonnet v2 (Bedrock)' },
    { id: 'anthropic.claude-3-haiku-20240307-v1:0',  displayName: 'Claude 3 Haiku (Bedrock)' },
  ]
}

router.get('/models', (_req, res) => {
  const providers = {}
  let total = 0
  for (const [provider, models] of Object.entries(MODEL_CATALOG)) {
    providers[provider] = models.map(m => ({
      id: `${provider}/${m.id}`,
      displayName: m.displayName,
    }))
    total += models.length
  }
  res.json({ providers, total, fetchedAt: new Date().toISOString(), cached: false, static: true })
})

export default router
export { ENV, buildClient }
