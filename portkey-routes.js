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

router.post('/chat', async (req, res) => {
  const { model, configId, messages, cacheEnabled } = req.body || {}

  if (!ENV.apiKey) {
    return res.status(503).json({ error: 'configure_portkey', missing: ['PORTKEY_API_KEY'] })
  }
  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'bad_request', message: 'model + messages required' })
  }

  // Resolve configId → slug
  const configMap = {
    airs:           ENV.configAirs,
    'no-guardrail': ENV.configNoGuard,
    defaults:       ENV.configDefaults,
    fallback:       ENV.configFallback,
  }
  const slug = configMap[configId] || ENV.configAirs
  if (!slug) {
    return res.status(503).json({ error: 'config_missing', configId })
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const sendEvent = (event, data) => {
    if (event) res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  const startedAt = Date.now()
  let tokensOut = 0
  let assembledText = ''
  let hookResults = null
  let fallbackUsed = false
  let cacheState = cacheEnabled ? 'MISS' : 'disabled'
  let blocked = false
  let blockReason = null

  try {
    const client = buildClient(slug)
    const stream = await client.chat.completions.create({
      model, messages, stream: true,
    })

    for await (const chunk of stream) {
      // Capture hook_results / fallback info from model_extra when present
      const extra = chunk?.model_extra || {}
      if (extra.hook_results) hookResults = extra.hook_results
      if (extra.cache_status) cacheState = String(extra.cache_status).toUpperCase()
      if (extra.fallback_used) fallbackUsed = true

      // Detect input-guardrail block before any tokens
      const before = hookResults?.before_request_hooks
      if (Array.isArray(before) && before.some(h => h?.verdict === false)) {
        blocked = true
        blockReason = before.find(h => h?.verdict === false)
        sendEvent('blocked', { reason: blockReason, hook_results: hookResults })
        break
      }

      const token = chunk?.choices?.[0]?.delta?.content || ''
      if (token) {
        tokensOut += 1
        assembledText += token
        sendEvent(null, { type: 'token', text: token })
      }
    }

    if (!blocked) {
      const latencyMs = Date.now() - startedAt
      let traceId = null
      try {
        // Use dynamic import to avoid circular-dependency issues at module load time.
        // server.js imports this router, so we can't do a static top-level import back.
        const { persistTrace } = await import('./server.js')
        // Adapt to persistTrace's real signature:
        // { message, chatResponse, telemetry, backend, resolvedModelId, airsEnabled, attackMeta }
        const promptText = messages.map(m => `${m.role}: ${m.content}`).join('\n')
        traceId = persistTrace({
          message: promptText,
          chatResponse: { content: assembledText },
          telemetry: {
            timing: { total_ms: latencyMs, llm_ms: latencyMs },
            llm: { tokens_out: tokensOut, model },
            summary: { verdict: 'ALLOWED', category: 'benign', threats_detected: [] },
          },
          backend: 'portkey',
          resolvedModelId: model,
          airsEnabled: false,
          attackMeta: {
            label: configId,
            extras: {
              portkeyConfigId: configId,
              portkeyConfigSlug: slug,
              cache: cacheState,
              fallbackUsed,
              hookResults,
            },
          },
        })
      } catch (e) {
        // Trace persistence failures shouldn't break the stream
        console.warn('persistTrace failed for gateway chat:', e?.message)
      }
      sendEvent('metadata', {
        hook_results: hookResults,
        model, latencyMs, tokensOut,
        cache: cacheState, fallbackUsed, traceId,
      })
    }
  } catch (e) {
    // Portkey raises AIRS guardrail blocks as thrown errors whose message is
    // a JSON string containing `{ error: { type: "hooks_failed", ... }, hook_results: {...} }`.
    // Normalize that into the same event: blocked frame the frontend already handles.
    const raw = String(e?.message || e)
    let parsed = null
    try { parsed = JSON.parse(raw) } catch {}
    const hr = parsed?.hook_results
    const before = hr?.before_request_hooks || []
    const blockedHook = before.find(h => h?.verdict === false)
    if (blockedHook) {
      sendEvent('blocked', { reason: blockedHook, hook_results: hr })
    } else {
      sendEvent('error', { message: raw })
    }
  } finally {
    res.end()
  }
})

async function runLane(laneId, slug, model, messages) {
  const startedAt = Date.now()
  if (!slug) {
    return {
      id: laneId, slug: null, verdict: 'UNCONFIGURED',
      blockReason: null, response: '', latencyMs: 0,
      tokens: 0, hookResults: null,
      error: 'Config slug missing — set the corresponding env var',
    }
  }
  try {
    const client = buildClient(slug)
    const completion = await client.chat.completions.create({
      model, messages, stream: false,
    })
    const latencyMs = Date.now() - startedAt
    const hookResults = completion?.model_extra?.hook_results || null
    const before = hookResults?.before_request_hooks || []
    const after  = hookResults?.after_request_hooks || []
    const inputBlocked  = before.some(h => h?.verdict === false)
    const outputBlocked = after.some(h => h?.verdict === false)

    let verdict = 'ALLOWED'
    let blockReason = null
    if (inputBlocked) {
      verdict = 'BLOCKED (input)'
      blockReason = before.find(h => h?.verdict === false)
    } else if (outputBlocked) {
      verdict = 'BLOCKED (output)'
      blockReason = after.find(h => h?.verdict === false)
    }

    const choice = completion?.choices?.[0]?.message?.content || ''
    const tokens = completion?.usage?.completion_tokens ?? 0

    return {
      id: laneId, slug,
      verdict, blockReason,
      response: choice, latencyMs, tokens,
      hookResults,
      error: null,
    }
  } catch (e) {
    // AIRS guardrail blocks arrive as thrown errors whose message is a JSON
    // string containing hook_results. Parse and convert to a BLOCKED verdict.
    const raw = String(e?.message || e)
    let parsed = null
    try { parsed = JSON.parse(raw) } catch {}
    const hookResults = parsed?.hook_results || null
    const before = hookResults?.before_request_hooks || []
    const blockedHook = before.find(h => h?.verdict === false)
    if (blockedHook) {
      return {
        id: laneId, slug,
        verdict: 'BLOCKED (input)',
        blockReason: blockedHook,
        response: '', latencyMs: Date.now() - startedAt,
        tokens: 0, hookResults,
        error: null,
      }
    }
    return {
      id: laneId, slug,
      verdict: 'ERROR', blockReason: null,
      response: '', latencyMs: Date.now() - startedAt,
      tokens: 0, hookResults: null,
      error: raw,
    }
  }
}

router.post('/compare', async (req, res) => {
  const { prompt, model } = req.body || {}
  if (!ENV.apiKey) {
    return res.status(503).json({ error: 'configure_portkey', missing: ['PORTKEY_API_KEY'] })
  }
  if (!prompt || !model) {
    return res.status(400).json({ error: 'bad_request', message: 'prompt + model required' })
  }
  const messages = [{ role: 'user', content: prompt }]
  const [noGuard, defaults, airs] = await Promise.all([
    runLane('no-guardrail', ENV.configNoGuard, model, messages),
    runLane('defaults',     ENV.configDefaults, model, messages),
    runLane('airs',         ENV.configAirs,     model, messages),
  ])
  res.json({ prompt, model, lanes: [noGuard, defaults, airs] })
})

export default router
export { ENV, buildClient }
