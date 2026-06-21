// Express router for Portkey-backed AI/LLM Gateway pillar.
// Mounted at /api/gateway from server.js.

import express from 'express'
import { Portkey } from 'portkey-ai'
import { mcpChatHandler, mcpHealth } from './portkey-mcp.js'

const router = express.Router()

// MCP Registry demo (CoinGecko via Portkey MCP Registry) — see portkey-mcp.js
router.get('/mcp/health', mcpHealth)
router.post('/mcp', mcpChatHandler)

const ENV = {
  apiKey:           process.env.PORTKEY_API_KEY || '',
  configAirs:       process.env.PORTKEY_CONFIG_AIRS || '',
  configNoGuard:    process.env.PORTKEY_CONFIG_NO_GUARDRAIL || '',
  configDefaults:   process.env.PORTKEY_CONFIG_DEFAULTS || '',
  configFallback:   process.env.PORTKEY_CONFIG_FALLBACK || '',
  vertexSlug:       process.env.PORTKEY_VERTEX_SLUG || '@sudo-vertexai',
  bedrockSlug:      process.env.PORTKEY_BEDROCK_SLUG || '',
}

// strictOpenAiCompliance:false makes the gateway include hook_results (AIRS
// guardrail verdicts) on ALLOWED responses too — as dedicated stream chunks
// carrying only { hook_results } (input scan before the first token, output
// scan after the last), and as a top-level field on non-streaming bodies.
// They sit directly on the chunk/completion object in the Node SDK — there is
// NO model_extra (that's the Python SDK's pydantic accessor).
function buildClient(configId, { cacheForceRefresh = false } = {}) {
  if (!ENV.apiKey) throw new Error('PORTKEY_API_KEY not set')
  const opts = { apiKey: ENV.apiKey, strictOpenAiCompliance: false }
  if (configId) opts.config = configId
  if (cacheForceRefresh) opts.cacheForceRefresh = true
  return new Portkey(opts)
}

// Merge hook_results arriving across multiple stream chunks (input + output
// scans come in separate frames) into one { before, after } object.
function mergeHookResults(prev, incoming) {
  if (!incoming) return prev
  const base = prev || {}
  return {
    before_request_hooks: [...(base.before_request_hooks || []), ...(incoming.before_request_hooks || [])],
    after_request_hooks:  [...(base.after_request_hooks  || []), ...(incoming.after_request_hooks  || [])],
  }
}

// Pull the Prisma AIRS check payload out of a hook array (before or after).
function extractAirsScan(hooks) {
  for (const h of hooks || []) {
    for (const c of h?.checks || []) {
      if (String(c?.id || '').includes('panw-prisma-airs') || c?.data?.profile_name) {
        return { execMs: c.execution_time ?? h.execution_time ?? null, data: c.data || null, verdict: c.verdict }
      }
    }
  }
  return null
}

// Direct provider call for the no-gateway lane (bypasses Portkey entirely).
// Routes by the model's @integration prefix (so the lane is multi-provider):
//   @sudo-bedrock/...  → Bedrock via the portal's own AWS creds (EC2 IAM role)
//   gemini-3.x         → Vertex OpenAI-compatible endpoint on `global` (google/ prefix;
//                        the @google-cloud/vertexai SDK can't reach `global`)
//   gemini-2.5 / other → Gemini SDK (region-pinned)
async function callDirectProvider(prompt, fullModel) {
  const { callVertexAI, callVertexMaaS, callBedrock } = await import('./server.js')
  const hasSlug = String(fullModel).includes('/')
  const slug = hasSlug ? String(fullModel).split('/')[0] : ''
  const bare = hasSlug ? String(fullModel).split('/').slice(1).join('/') : String(fullModel)
  if (slug.includes('bedrock')) return callBedrock(prompt, bare)
  if (/^gemini-3/.test(bare)) return callVertexMaaS(prompt, `google/${bare}`, 'global')
  return callVertexAI(prompt, bare)
}

function detectedThreats(data) {
  const out = []
  for (const [src, det] of [['prompt', data?.prompt_detected], ['response', data?.response_detected]]) {
    for (const [k, v] of Object.entries(det || {})) if (v === true) out.push(`${src}:${k}`)
  }
  return out
}

// Persist a gateway request (allowed, blocked, or direct-bypass) into the
// same trace store /api/chat uses, so the Observability pillar shows ALL
// gateway traffic — security events included.
async function persistGatewayTrace({ configId, slug, model, promptText, responseText, verdict, hookResults, latencyMs, tokensIn, tokensOut, cacheState, fallbackUsed, portkeyTraceId }) {
  try {
    const { persistTrace } = await import('./server.js')
    const inputScan  = extractAirsScan(hookResults?.before_request_hooks)
    const outputScan = extractAirsScan(hookResults?.after_request_hooks)
    const airsRan = !!(inputScan || outputScan)
    const scanData = inputScan?.data || outputScan?.data || null
    const airsInMs  = inputScan?.execMs  ?? 0
    const airsOutMs = outputScan?.execMs ?? 0
    return persistTrace({
      message: promptText,
      chatResponse: { content: responseText ?? null },
      telemetry: {
        timing: {
          airs_input_scan_ms: airsInMs || null,
          // No LLM ran on a block — the remainder is gateway overhead, not inference
          llm_ms: verdict === 'BLOCKED' ? null : (Math.max(0, latencyMs - airsInMs - airsOutMs) || null),
          airs_output_scan_ms: airsOutMs || null,
          total_ms: latencyMs,
        },
        llm: { model, tokens_in: tokensIn ?? null, tokens_out: tokensOut ?? null },
        summary: {
          verdict,
          category: scanData?.category ?? (verdict === 'BLOCKED' ? 'malicious' : 'benign'),
          threats_detected: verdict === 'BLOCKED' ? detectedThreats(scanData) : [],
          profile: scanData?.profile_name ?? null,
        },
        inputScan:  inputScan?.data  ? { scan_id: inputScan.data.scan_id,  category: inputScan.data.category,  action: inputScan.data.action }  : null,
        outputScan: outputScan?.data ? { scan_id: outputScan.data.scan_id, category: outputScan.data.category, action: outputScan.data.action } : null,
      },
      backend: 'portkey',
      resolvedModelId: model,
      airsEnabled: airsRan,
      attackMeta: {
        label: configId,
        extras: { portkeyConfigId: configId, portkeyConfigSlug: slug, cache: cacheState, fallbackUsed, hookResults, portkeyTraceId },
      },
    })
  } catch (e) {
    console.warn('persistGatewayTrace failed:', e?.message)
    return null
  }
}

router.get('/health', async (_req, res) => {
  // PORTKEY_CONFIG_NO_GUARDRAIL and PORTKEY_CONFIG_FALLBACK are intentionally
  // NOT required: no-guardrail bypasses Portkey entirely (no config attached),
  // and fallback (Vertex→Bedrock) is an optional control. Missing either should
  // not mark the gateway "degraded".
  // Bedrock is no longer provisioned in the Portkey workspace (Vertex-only),
  // so PORTKEY_BEDROCK_SLUG is intentionally NOT required — its absence must
  // not mark the gateway "degraded".
  const required = {
    PORTKEY_API_KEY:               !!ENV.apiKey,
    PORTKEY_CONFIG_AIRS:           !!ENV.configAirs,
    PORTKEY_CONFIG_DEFAULTS:       !!ENV.configDefaults,
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
  // modelCount reflects the static catalog (Portkey's /v1/models passthrough
  // 404s through Vertex, so it can't be probed live).
  const modelCount = Object.values(MODEL_CATALOG).reduce((n, arr) => n + arr.length, 0)
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
      { id: 'no-guardrail', label: 'Direct provider (no gateway)', slug: '(direct)',      attached: 'none — bypasses Portkey entirely', ready: true },
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
    // Models provisioned on the sudo-vertexai integration (global region) AND
    // reachable in the GCP project. The demo configs no longer pin a model
    // (override_params removed), so the picked model flows to all three lanes —
    // incl. the direct no-gateway lane, which routes gemini-3.x via the global
    // OpenAI endpoint in callDirectProvider. Add more here as you provision them.
    { id: 'gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite' },
    { id: 'gemini-3.5-flash',      displayName: 'Gemini 3.5 Flash (reasoning)' },
  ],
}

if (ENV.bedrockSlug) {
  // Multi-vendor Bedrock catalog — mirrors what the API Intercept picker lists.
  // Each must be provisioned on the @sudo-bedrock integration (Portkey → Model
  // Provisioning) AND have AWS Bedrock → Model access granted in us-west-2, or
  // the native/AIRS lanes return `model_not_allowed`. The no-gateway lane uses
  // Bedrock's Converse API (callBedrock) — not every open model supports it.
  MODEL_CATALOG[ENV.bedrockSlug] = [
    // Anthropic Claude — Claude 4.x requires the us. cross-region inference
    // profile (no on-demand throughput); the role's IAM policy must allow
    // bedrock:InvokeModel on inference-profile/* ARNs (see CLAUDE.md gotcha).
    { id: 'us.anthropic.claude-opus-4-8', displayName: 'Claude Opus 4.8 (Bedrock)' },
    { id: 'us.anthropic.claude-fable-5',  displayName: 'Claude Fable 5 (Bedrock)' },
    { id: 'anthropic.claude-sonnet-4-20250514-v1:0', displayName: 'Claude Sonnet 4 (Bedrock)' },
    { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0', displayName: 'Claude 3.5 Sonnet v2 (Bedrock)' },
    { id: 'anthropic.claude-3-haiku-20240307-v1:0',  displayName: 'Claude 3 Haiku (Bedrock)' },
    // DeepSeek
    { id: 'deepseek.v3.2',   displayName: 'DeepSeek V3.2 (Bedrock)' },
    { id: 'deepseek.r1-v1:0', displayName: 'DeepSeek R1 (reasoning · Bedrock)' },
    // Qwen
    { id: 'qwen.qwen3-235b-a22b-2507-v1:0', displayName: 'Qwen3 235B A22B 2507 (Bedrock)' },
    { id: 'qwen.qwen3-coder-480b-a35b-v1:0', displayName: 'Qwen3 Coder 480B (Bedrock)' },
    // Moonshot Kimi
    { id: 'moonshotai.kimi-k2.5',     displayName: 'Kimi K2.5 (Bedrock)' },
    { id: 'moonshot.kimi-k2-thinking', displayName: 'Kimi K2 Thinking (Bedrock)' },
    // NVIDIA Nemotron
    { id: 'nvidia.nemotron-nano-12b-v2', displayName: 'Nemotron Nano 12B v2 (Bedrock)' },
    { id: 'nvidia.nemotron-super-3-120b', displayName: 'Nemotron Super 3 120B (Bedrock)' },
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

  // Resolve configId → slug. 'no-guardrail' deliberately calls Portkey with
  // NO config attached, regardless of what PORTKEY_CONFIG_NO_GUARDRAIL is set
  // to — relying on the @<integration>/model prefix to route. This guarantees
  // a true bypass even if the user's no-guardrail Portkey config happens to
  // have a guardrail attached (which would otherwise block).
  // An unconfigured slug (e.g. fallback without PORTKEY_CONFIG_FALLBACK) must
  // 503 — never silently fall through to another config.
  const configMap = {
    airs:     ENV.configAirs,
    defaults: ENV.configDefaults,
    fallback: ENV.configFallback,
  }
  let slug
  if (configId === 'no-guardrail') {
    slug = null   // explicit bypass — buildClient(null) attaches no config
  } else if (configId == null) {
    slug = ENV.configAirs
    if (!slug) return res.status(503).json({ error: 'config_missing', configId: 'airs' })
  } else if (configId in configMap) {
    slug = configMap[configId]
    if (!slug) return res.status(503).json({ error: 'config_missing', configId })
  } else {
    return res.status(400).json({ error: 'bad_request', message: `unknown configId: ${configId}` })
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
  let tokensIn = null
  let chunkCount = 0
  let usageSeen = false
  let assembledText = ''
  let hookResults = null
  let fallbackUsed = false
  let cacheState = cacheEnabled ? 'MISS' : 'disabled'
  let portkeyTraceId = null
  let blocked = false
  let blockReason = null
  const promptText = messages.map(m => m.content).join('\n')

  // ── no-guardrail lane: bypass Portkey entirely, call Vertex directly ──
  // The user's Portkey workspace has the AIRS guardrail applied as a default,
  // so even calls without a config still get blocked. Direct Vertex is the
  // only way to demonstrate the truly-unguarded path.
  if (configId === 'no-guardrail') {
    try {
      // callDirectProvider routes by the @integration prefix (bedrock vs vertex)
      const r = await callDirectProvider(promptText, model)
      const text = r?.text || ''
      // Fake a token stream by chunking the response so the UI feels alive
      const chunkSize = 24
      for (let i = 0; i < text.length; i += chunkSize) {
        const piece = text.slice(i, i + chunkSize)
        assembledText += piece
        sendEvent(null, { type: 'token', text: piece })
      }
      const latencyMs = r?.latencyMs ?? (Date.now() - startedAt)
      const traceId = await persistGatewayTrace({
        configId, slug: '(direct)', model, promptText,
        responseText: assembledText, verdict: 'DIRECT', hookResults: null,
        latencyMs, tokensIn: r?.tokens?.input ?? null, tokensOut: r?.tokens?.output ?? null,
        cacheState: 'disabled', fallbackUsed: false, portkeyTraceId: null,
      })
      sendEvent('metadata', {
        hook_results: null,
        model, latencyMs, tokensOut: r?.tokens?.output ?? null,
        cache: 'disabled', fallbackUsed: false, traceId,
        bypass: 'direct-vertex',
      })
    } catch (e) {
      sendEvent('error', { message: `Direct Vertex call failed: ${String(e?.message || e)}` })
    } finally {
      res.end()
    }
    return
  }

  // Shared blocked-path handler: persist the security event as a trace, then
  // emit the blocked frame (with trace id + timing) the frontend renders.
  async function emitBlocked(blockedHook, hr) {
    const latencyMs = Date.now() - startedAt
    const traceId = await persistGatewayTrace({
      configId, slug, model, promptText,
      responseText: null, verdict: 'BLOCKED', hookResults: hr,
      latencyMs, tokensIn: null, tokensOut: null,
      cacheState, fallbackUsed, portkeyTraceId,
    })
    sendEvent('blocked', {
      reason: blockedHook, hook_results: hr,
      model, latencyMs, traceId, portkeyTraceId, cache: cacheState,
    })
  }

  try {
    // Cache semantics: the Portkey config controls whether responses are
    // cached. The UI toggle maps to cache-force-refresh — OFF forces a fresh
    // upstream call (and rewrites the cache), ON allows cache reads (HIT).
    const client = buildClient(slug, { cacheForceRefresh: !cacheEnabled })
    const stream = await client.chat.completions.create({
      model, messages, stream: true,
      stream_options: { include_usage: true },
    })

    // Real gateway telemetry lives in response headers (available immediately).
    try {
      const h = stream?.response?.headers
      if (h) {
        cacheState = String(h.get('x-portkey-cache-status') || cacheState).toUpperCase()
        portkeyTraceId = h.get('x-portkey-trace-id') || null
        if (h.get('x-portkey-last-used-option-index')?.includes('fallback')) fallbackUsed = true
      }
    } catch {}

    for await (const chunk of stream) {
      // With strictOpenAiCompliance:false, hook_results arrive as dedicated
      // chunks: input-scan results BEFORE the first token, output-scan after
      // the last. Forward each to the client live for stage-by-stage UI.
      if (chunk?.hook_results) {
        const phase = (chunk.hook_results.before_request_hooks || []).length ? 'input' : 'output'
        hookResults = mergeHookResults(hookResults, chunk.hook_results)
        sendEvent('hooks', { phase, hook_results: chunk.hook_results })

        const failed = (chunk.hook_results.before_request_hooks || []).find(h => h?.verdict === false)
        if (failed) {
          blocked = true
          blockReason = failed
          await emitBlocked(failed, hookResults)
          break
        }
        continue
      }

      if (chunk?.usage) {
        usageSeen = true
        tokensOut = chunk.usage.completion_tokens ?? tokensOut
        tokensIn  = chunk.usage.prompt_tokens ?? tokensIn
      }

      const token = chunk?.choices?.[0]?.delta?.content || ''
      if (token) {
        chunkCount += 1
        assembledText += token
        sendEvent(null, { type: 'token', text: token })
      }
    }

    if (!blocked) {
      const latencyMs = Date.now() - startedAt
      if (!usageSeen) tokensOut = chunkCount // best-effort fallback
      const traceId = await persistGatewayTrace({
        configId, slug, model, promptText,
        responseText: assembledText, verdict: 'ALLOWED', hookResults,
        latencyMs, tokensIn, tokensOut,
        cacheState, fallbackUsed, portkeyTraceId,
      })
      sendEvent('metadata', {
        hook_results: hookResults,
        model, latencyMs, tokensOut, tokensIn,
        cache: cacheState, fallbackUsed, traceId, portkeyTraceId,
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
      await emitBlocked(blockedHook, hr)
    } else {
      sendEvent('error', { message: raw })
    }
  } finally {
    res.end()
  }
})

// slug semantics:
//   string     → use that Portkey config
//   null       → BYPASS Portkey entirely, call Vertex directly (no-guardrail lane)
//   undefined  → config missing → UNCONFIGURED lane
async function runLane(laneId, slug, model, messages) {
  const startedAt = Date.now()
  if (slug === undefined) {
    return {
      id: laneId, slug: null, verdict: 'UNCONFIGURED',
      blockReason: null, response: '', latencyMs: 0,
      tokens: 0, hookResults: null,
      error: 'Config slug missing — set the corresponding env var',
    }
  }

  // Bypass: call Vertex directly (no Portkey, no guardrails at all).
  if (slug === null) {
    try {
      const promptText = messages.map(m => m.content).join('\n')
      const r = await callDirectProvider(promptText, model)
      return {
        id: laneId, slug: '(direct)',
        verdict: 'ALLOWED',
        blockReason: null,
        response: r?.text || '',
        latencyMs: r?.latencyMs ?? (Date.now() - startedAt),
        tokens: r?.tokens?.output ?? 0,
        hookResults: null,
        error: null,
      }
    } catch (e) {
      return {
        id: laneId, slug: '(direct)',
        verdict: 'ERROR', blockReason: null,
        response: '', latencyMs: Date.now() - startedAt,
        tokens: 0, hookResults: null,
        error: String(e?.message || e),
      }
    }
  }

  try {
    const client = buildClient(slug)
    const completion = await client.chat.completions.create({
      model, messages, stream: false,
    })
    const latencyMs = Date.now() - startedAt
    // Node SDK: hook_results is a top-level field on the parsed body
    // (model_extra is a Python-SDK concept and never exists here).
    const hookResults = completion?.hook_results || completion?.model_extra?.hook_results || null
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
    // no-guardrail lane: pass null = bypass (no config attached). Routes via
    // the @integration prefix in the model id. Always available, never UNCONFIGURED.
    runLane('no-guardrail', null,                        model, messages),
    runLane('defaults',     ENV.configDefaults || undefined, model, messages),
    runLane('airs',         ENV.configAirs     || undefined, model, messages),
  ])
  res.json({ prompt, model, lanes: [noGuard, defaults, airs] })
})

export default router
export { ENV, buildClient }
