import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { VertexAI } from '@google-cloud/vertexai'
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime'
import {
  BedrockClient,
  ListFoundationModelsCommand,
} from '@aws-sdk/client-bedrock'
import { AzureOpenAI } from 'openai'
import { insertTrace, insertSpan, getTraces, getTrace, getMetrics, deleteTrace, deleteAllTraces } from './src/traceStore.js'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PROXY_PORT || 3001

// ─── Known Vertex AI publisher models ────────────────────────────────────────
const VERTEX_MODELS = [
  { id: 'gemini-2.0-flash-001',      label: 'Gemini 2.0 Flash',       status: 'available' },
  { id: 'gemini-2.0-flash-lite-001', label: 'Gemini 2.0 Flash Lite',  status: 'available' },
  { id: 'gemini-2.0-pro-exp-02-05',  label: 'Gemini 2.0 Pro (Exp)',   status: 'experimental' },
  { id: 'gemini-1.5-pro',            label: 'Gemini 1.5 Pro',         status: 'available' },
  { id: 'gemini-1.5-flash',          label: 'Gemini 1.5 Flash',       status: 'available' },
  { id: 'gemini-1.5-flash-8b',       label: 'Gemini 1.5 Flash 8B',   status: 'available' },
]

// ─── AWS credential helper ────────────────────────────────────────────────────
function awsCredentials() {
  if (!process.env.AWS_ACCESS_KEY_ID) return undefined // use EC2 instance role / default provider chain
  const creds = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
  if (process.env.AWS_SESSION_TOKEN) creds.sessionToken = process.env.AWS_SESSION_TOKEN
  return creds
}

// ─── AIRS scan helper ─────────────────────────────────────────────────────────
async function airscan(prompt, response = null, model = 'unknown') {
  const body = {
    tr_id: `citadel-${Date.now()}`,
    ai_profile: { profile_name: process.env.AIRS_PROFILE_NAME },
    metadata: { app_name: 'SUDO AIRS Demo', ai_model: model, app_user: 'demo-user' },
    contents: [{ prompt, ...(response != null ? { response } : {}) }],
  }

  const t0 = Date.now()
  const res = await fetch(
    `${process.env.AIRS_BASE_URL}/v1/scan/sync/request`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-pan-token': process.env.AIRS_API_KEY,
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AIRS scan failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return { data, latencyMs: Date.now() - t0, requestBody: body }
}

// ─── Azure OpenAI helper ──────────────────────────────────────────────────────
function makeAzureClient() {
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview',
  })
}

async function callAzureOpenAI(prompt, deploymentName) {
  const client = makeAzureClient()
  const t0 = Date.now()
  const response = await client.chat.completions.create({
    model: deploymentName,
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 1024,
  })
  const latencyMs = Date.now() - t0
  const choice = response.choices?.[0]
  const text = choice?.message?.content ?? ''
  const usage = response.usage ?? {}
  return {
    text,
    latencyMs,
    tokens: {
      input:  usage.prompt_tokens     ?? null,
      output: usage.completion_tokens ?? null,
      total:  usage.total_tokens      ?? null,
    },
    finishReason: choice?.finish_reason ?? null,
  }
}

// ─── Vertex AI helper ─────────────────────────────────────────────────────────
const vertexAI = new VertexAI({
  project: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_REGION || 'us-central1',
})

async function callVertexAI(prompt, modelId) {
  const genModel = vertexAI.getGenerativeModel({ model: modelId })
  const t0 = Date.now()
  const result = await genModel.generateContent(prompt)
  const latencyMs = Date.now() - t0
  const candidate = result.response?.candidates?.[0]
  const text = candidate?.content?.parts?.map(p => p.text).join('') ?? ''
  const usage = result.response?.usageMetadata ?? {}
  return {
    text,
    latencyMs,
    tokens: {
      input:  usage.promptTokenCount      ?? null,
      output: usage.candidatesTokenCount  ?? null,
      total:  usage.totalTokenCount       ?? null,
    },
    finishReason: candidate?.finishReason ?? null,
  }
}

// ─── Bedrock helper ───────────────────────────────────────────────────────────
function makeBedrockRuntime() {
  const creds = awsCredentials()
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    ...(creds && { credentials: creds }),
  })
}

async function callBedrock(prompt, modelId) {
  const client = makeBedrockRuntime()
  const t0 = Date.now()

  // ConverseCommand is the universal Bedrock API — works across all model families
  // and is required for cross-region inference profiles.
  // For newer models needing inference profiles, auto-retry with us. prefix.
  const candidateIds = [modelId]
  if (!modelId.startsWith('us.') && !modelId.startsWith('eu.')) {
    candidateIds.push(`us.${modelId}`)
  }

  let lastErr
  for (const id of candidateIds) {
    try {
      const cmd = new ConverseCommand({
        modelId: id,
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 1024 },
      })
      const response = await client.send(cmd)
      const latencyMs = Date.now() - t0
      const text = response.output?.message?.content?.[0]?.text ?? ''
      const usage = response.usage ?? {}
      if (id !== modelId) console.log(`[Bedrock] Auto-retried with inference profile: ${id}`)
      return {
        text,
        latencyMs,
        tokens: {
          input:  usage.inputTokens  ?? null,
          output: usage.outputTokens ?? null,
          total:  (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) || null,
        },
        finishReason: response.stopReason ?? null,
      }
    } catch (err) {
      lastErr = err
      // Only retry on inference-profile errors; surface everything else immediately
      if (!err.message?.includes('on-demand throughput')) throw err
    }
  }
  throw lastErr
}

// ─── Build full telemetry payload — raw AIRS data preserved ──────────────────
function buildTelemetry({ airsPromptScan, airsResponseScan, llmLatencyMs, modelLabel, llmText, llmTokens, llmFinishReason }) {
  const decidingScan = airsResponseScan ?? airsPromptScan
  const isBlocked = decidingScan.data.action === 'block'

  const promptDetected = airsPromptScan.data.prompt_detected ?? {}
  const responseDetected = airsResponseScan?.data.response_detected ?? {}
  const activeThreats = Object.entries(promptDetected).filter(([, v]) => v).map(([k]) => k)

  return {
    // ── Summary ──────────────────────────────────────────────────────────────
    summary: {
      verdict: isBlocked ? 'BLOCKED' : 'ALLOWED',
      action: decidingScan.data.action,
      category: decidingScan.data.category,
      threats_detected: activeThreats,
      model: modelLabel,
      profile: process.env.AIRS_PROFILE_NAME,
    },

    // ── Input scan (prompt) — full raw AIRS payload ───────────────────────
    inputScan: {
      scan_id:    airsPromptScan.data.scan_id,
      report_id:  airsPromptScan.data.report_id,
      tr_id:      airsPromptScan.data.tr_id,
      session_id: airsPromptScan.data.session_id ?? null,
      profile_id: airsPromptScan.data.profile_id,
      profile_name: airsPromptScan.data.profile_name,
      category:   airsPromptScan.data.category,
      action:     airsPromptScan.data.action,
      timeout:    airsPromptScan.data.timeout,
      error:      airsPromptScan.data.error,
      created_at:   airsPromptScan.data.created_at,
      completed_at: airsPromptScan.data.completed_at,
      latency_ms:   airsPromptScan.latencyMs,
      prompt_detected: promptDetected,
      prompt_masked_data:        airsPromptScan.data.prompt_masked_data ?? null,
      prompt_detection_details:  airsPromptScan.data.prompt_detection_details ?? null,
    },

    // ── Output scan (response) — full raw AIRS payload ────────────────────
    outputScan: airsResponseScan ? {
      scan_id:    airsResponseScan.data.scan_id,
      report_id:  airsResponseScan.data.report_id,
      tr_id:      airsResponseScan.data.tr_id,
      session_id: airsResponseScan.data.session_id ?? null,
      profile_id: airsResponseScan.data.profile_id,
      profile_name: airsResponseScan.data.profile_name,
      category:   airsResponseScan.data.category,
      action:     airsResponseScan.data.action,
      timeout:    airsResponseScan.data.timeout,
      error:      airsResponseScan.data.error,
      created_at:   airsResponseScan.data.created_at,
      completed_at: airsResponseScan.data.completed_at,
      latency_ms:   airsResponseScan.latencyMs,
      response_detected: responseDetected,
      response_masked_data:       airsResponseScan.data.response_masked_data ?? null,
      response_detection_details: airsResponseScan.data.response_detection_details ?? null,
    } : null,

    // ── Timing & LLM stats ────────────────────────────────────────────────
    timing: {
      airs_input_scan_ms:  airsPromptScan.latencyMs,
      llm_ms:              llmLatencyMs ?? null,
      airs_output_scan_ms: airsResponseScan?.latencyMs ?? null,
      total_ms: airsPromptScan.latencyMs + (llmLatencyMs ?? 0) + (airsResponseScan?.latencyMs ?? 0),
    },
    llm: {
      model:        modelLabel,
      latency_ms:   llmLatencyMs ?? null,
      tokens_in:    llmTokens?.input  ?? null,
      tokens_out:   llmTokens?.output ?? null,
      tokens_total: llmTokens?.total  ?? null,
      throughput_tps: (llmTokens?.output && llmLatencyMs)
        ? Math.round((llmTokens.output / llmLatencyMs) * 1000)
        : null,
      finish_reason: llmFinishReason ?? null,
    },

    // ── Chat response ────────────────────────────────────────────────────
    chatResponse: {
      role: 'assistant',
      content: isBlocked ? null : llmText,
      blocked: isBlocked,
      block_reason: isBlocked
        ? `Blocked by Prisma AIRS.`
        : null,
    },
  }
}

// ─── Persist trace + spans to SQLite ─────────────────────────────────────────
function persistTrace({ message, chatResponse, telemetry, backend, resolvedModelId, airsEnabled, attackMeta }) {
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const timing  = telemetry.timing ?? {}
  const llm     = telemetry.llm ?? {}
  const summary = telemetry.summary ?? {}

  const verdict   = summary.verdict ?? (airsEnabled ? 'ALLOWED' : 'DIRECT')
  const category  = summary.category ?? 'benign'
  const threats   = summary.threats_detected ?? []

  const airsInMs  = timing.airs_input_scan_ms  ?? 0
  const llmMs     = timing.llm_ms              ?? 0
  const airsOutMs = timing.airs_output_scan_ms ?? 0
  const totalMs   = timing.total_ms            ?? (airsInMs + llmMs + airsOutMs)

  try {
    insertTrace({
      id: traceId,
      prompt: message,
      response: chatResponse?.content ?? null,
      backend,
      model: resolvedModelId ?? backend,
      verdict,
      category,
      threats_detected: threats,
      airs_enabled: airsEnabled,
      total_ms: totalMs,
      airs_input_ms: airsInMs || null,
      llm_ms: llmMs || null,
      airs_output_ms: airsOutMs || null,
      tokens_in: llm.tokens_in ?? null,
      tokens_out: llm.tokens_out ?? null,
      profile: summary.profile ?? process.env.AIRS_PROFILE_NAME ?? null,
      attack_label: attackMeta?.label ?? null,
      attack_severity: attackMeta?.severity ?? null,
    })

    // Build spans
    const spans = []
    let cursor = 0

    spans.push({ trace_id: traceId, name: 'user_prompt_received', start_ms: 0, end_ms: 0, latency_ms: 0, status: 'success', metadata: null })

    if (airsEnabled && airsInMs) {
      spans.push({ trace_id: traceId, name: 'airs_input_scan', start_ms: cursor, end_ms: cursor + airsInMs, latency_ms: airsInMs, status: verdict === 'BLOCKED' && !llmMs ? 'blocked' : 'success', metadata: telemetry.inputScan ? { scan_id: telemetry.inputScan.scan_id, category: telemetry.inputScan.category, action: telemetry.inputScan.action } : null })
      cursor += airsInMs
    }

    if (llmMs) {
      spans.push({ trace_id: traceId, name: 'llm_inference', start_ms: cursor, end_ms: cursor + llmMs, latency_ms: llmMs, status: 'success', metadata: { model: llm.model, tokens_in: llm.tokens_in, tokens_out: llm.tokens_out } })
      cursor += llmMs
    }

    if (airsEnabled && airsOutMs) {
      spans.push({ trace_id: traceId, name: 'airs_output_scan', start_ms: cursor, end_ms: cursor + airsOutMs, latency_ms: airsOutMs, status: verdict === 'BLOCKED' && llmMs ? 'blocked' : 'success', metadata: telemetry.outputScan ? { scan_id: telemetry.outputScan.scan_id, category: telemetry.outputScan.category, action: telemetry.outputScan.action } : null })
      cursor += airsOutMs
    }

    spans.push({ trace_id: traceId, name: 'response_delivered', start_ms: cursor, end_ms: cursor, latency_ms: 0, status: verdict === 'BLOCKED' ? 'blocked' : 'success', metadata: null })

    for (const s of spans) insertSpan(s)
  } catch (err) {
    console.error('[TraceStore] Failed to persist trace:', err.message)
    // Non-fatal — don't break the chat response
  }
  return traceId
}

// ─── POST /api/chat ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, backend = 'vertex', modelId, airsEnabled = false } = req.body
  if (!message) return res.status(400).json({ error: 'message is required' })

  const resolvedModelId = modelId || (
    backend === 'vertex'  ? process.env.VERTEX_MODEL :
    backend === 'azure'   ? process.env.AZURE_OPENAI_DEPLOYMENT :
    process.env.BEDROCK_MODEL_ID
  )
  const modelLabel = `${backend}/${resolvedModelId}`

  console.log(`[chat] airsEnabled=${airsEnabled} backend=${backend} model=${resolvedModelId}`)

  // ── UNPROTECTED: straight to LLM, no AIRS ────────────────────────────────
  if (!airsEnabled) {
    console.log(`[LLM] Unprotected — calling ${modelLabel} directly…`)
    try {
      const r = backend === 'vertex'  ? await callVertexAI(message, resolvedModelId)
              : backend === 'azure'   ? await callAzureOpenAI(message, resolvedModelId)
              : await callBedrock(message, resolvedModelId)
      console.log(`[LLM] Response received (${r.latencyMs}ms, ${r.tokens?.total ?? '?'} tokens) — no AIRS scan`)
      const responsePayload = {
        summary: null,
        inputScan: null,
        outputScan: null,
        timing: { llm_ms: r.latencyMs, airs_input_scan_ms: null, airs_output_scan_ms: null, total_ms: r.latencyMs },
        llm: {
          model: modelLabel,
          latency_ms: r.latencyMs,
          tokens_in: r.tokens?.input ?? null,
          tokens_out: r.tokens?.output ?? null,
          tokens_total: r.tokens?.total ?? null,
          throughput_tps: (r.tokens?.output && r.latencyMs)
            ? Math.round((r.tokens.output / r.latencyMs) * 1000) : null,
          finish_reason: r.finishReason ?? null,
        },
        chatResponse: { role: 'assistant', content: r.text, blocked: false, block_reason: null },
      }
      const traceId = persistTrace({ message, chatResponse: responsePayload.chatResponse, telemetry: responsePayload, backend, resolvedModelId, airsEnabled: false, attackMeta: req.body.attackMeta ?? null })
      return res.json({ ...responsePayload, trace_id: traceId })
    } catch (err) {
      console.error('[LLM] Error:', err.message)
      return res.status(502).json({ error: `LLM call failed: ${err.message}` })
    }
  }

  // ── PROTECTED: AIRS scan → LLM → AIRS scan ───────────────────────────────
  try {
    // Step 1: AIRS scan the prompt
    console.log(`[AIRS] Scanning prompt via profile "${process.env.AIRS_PROFILE_NAME}"…`)
    const airsPromptScan = await airscan(message, null, modelLabel)
    console.log(`[AIRS] Prompt verdict: ${airsPromptScan.data.action} / ${airsPromptScan.data.category}`)

    if (airsPromptScan.data.action === 'block') {
      const telemetry = buildTelemetry({ airsPromptScan, airsResponseScan: null, llmLatencyMs: null, modelLabel, llmText: null, llmTokens: null, llmFinishReason: null })
      const traceId = persistTrace({ message, chatResponse: telemetry.chatResponse, telemetry, backend, resolvedModelId, airsEnabled: true, attackMeta: req.body.attackMeta ?? null })
      return res.json({ ...telemetry, trace_id: traceId })
    }

    // Step 2: Call LLM
    let llmText = '', llmLatencyMs = 0, llmTokens = null, llmFinishReason = null
    try {
      console.log(`[LLM] Calling ${modelLabel}…`)
      const r = backend === 'vertex'  ? await callVertexAI(message, resolvedModelId)
              : backend === 'azure'   ? await callAzureOpenAI(message, resolvedModelId)
              : await callBedrock(message, resolvedModelId)
      llmText = r.text; llmLatencyMs = r.latencyMs; llmTokens = r.tokens; llmFinishReason = r.finishReason
      console.log(`[LLM] Response received (${llmLatencyMs}ms)`)
    } catch (err) {
      console.error('[LLM] Error:', err.message)
      return res.status(502).json({ error: `LLM call failed: ${err.message}` })
    }

    // Step 3: AIRS scan the response
    console.log('[AIRS] Scanning LLM response…')
    const airsResponseScan = await airscan(message, llmText, modelLabel)
    console.log(`[AIRS] Response verdict: ${airsResponseScan.data.action} / ${airsResponseScan.data.category}`)

    const telemetry = buildTelemetry({ airsPromptScan, airsResponseScan, llmLatencyMs, modelLabel, llmText, llmTokens, llmFinishReason })
    const traceId = persistTrace({ message, chatResponse: telemetry.chatResponse, telemetry, backend, resolvedModelId, airsEnabled: true, attackMeta: req.body.attackMeta ?? null })
    return res.json({ ...telemetry, trace_id: traceId })
  } catch (err) {
    console.error('[server] Unhandled error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── POST /api/redteam/proxy ──────────────────────────────────────────────────
// Thin wrapper for the Prisma Red Team API. Returns { reply } shape the
// Red Team service expects. Accepts the same request body as /api/chat.
app.post('/api/redteam/proxy', async (req, res) => {
  const { prompt, model, backend = 'vertex', airsEnabled = false } = req.body
  const message = prompt || req.body.message
  if (!message) return res.status(400).json({ error: 'prompt is required' })

  const resolvedModelId = model || req.body.modelId || (
    backend === 'vertex'  ? process.env.VERTEX_MODEL :
    backend === 'azure'   ? process.env.AZURE_OPENAI_DEPLOYMENT :
    process.env.BEDROCK_MODEL_ID
  )

  try {
    const r = backend === 'vertex'  ? await callVertexAI(message, resolvedModelId)
            : backend === 'azure'   ? await callAzureOpenAI(message, resolvedModelId)
            : await callBedrock(message, resolvedModelId)
    return res.json({ reply: r.text })
  } catch (err) {
    console.error('[redteam/proxy] Error:', err.message)
    return res.status(502).json({ error: err.message })
  }
})

// ─── GET /api/models/vertex ───────────────────────────────────────────────────
app.get('/api/models/vertex', (_req, res) => {
  // Return the known publisher model list — no API call needed
  res.json({
    provider: 'Google Cloud Vertex AI',
    project: process.env.GCP_PROJECT_ID,
    region: process.env.GCP_REGION,
    models: VERTEX_MODELS,
  })
})

// ─── GET /api/models/bedrock ──────────────────────────────────────────────────
app.get('/api/models/bedrock', async (_req, res) => {
  try {
    const creds = awsCredentials()
    const client = new BedrockClient({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(creds && { credentials: creds }),
    })
    const cmd = new ListFoundationModelsCommand({ byOutputModality: 'TEXT' })
    const result = await client.send(cmd)

    const models = (result.modelSummaries ?? []).map(m => ({
      id: m.modelId,
      label: m.modelName,
      provider: m.providerName,
      status: m.modelLifecycle?.status === 'ACTIVE' ? 'available' : m.modelLifecycle?.status?.toLowerCase() ?? 'unknown',
      inputModalities: m.inputModalities ?? [],
      outputModalities: m.outputModalities ?? [],
      streamingSupported: m.responseStreamingSupported ?? false,
    }))

    res.json({ provider: 'AWS Bedrock', region: process.env.AWS_REGION, models })
  } catch (err) {
    console.error('[bedrock] ListFoundationModels error:', err.message)
    res.status(502).json({ error: err.message })
  }
})

// ─── GET /api/models/azure ────────────────────────────────────────────────────
// Returns the actual deployments configured in the Azure AI Foundry resource
const AZURE_DEPLOYMENTS = [
  { id: 'gpt-5.4-nano',               label: 'GPT-5.4 Nano',              provider: 'OpenAI',    status: 'available' },
  { id: 'DeepSeek-V3.2',              label: 'DeepSeek V3.2',             provider: 'DeepSeek',  status: 'available' },
  { id: 'grok-4-1-fast-non-reasoning', label: 'Grok 4.1 Fast',            provider: 'xAI',       status: 'available' },
]

app.get('/api/models/azure', (_req, res) => {
  res.json({ provider: 'Azure OpenAI', endpoint: process.env.AZURE_OPENAI_ENDPOINT, models: AZURE_DEPLOYMENTS })
})

// ═══════════════════════════════════════════════════════════════════════════════
// RED TEAM API
// Management plane: https://api.sase.paloaltonetworks.com/ai-red-teaming/mgmt-plane
// Data plane:       https://api.sase.paloaltonetworks.com/ai-red-teaming/data-plane
// Auth: OAuth2 Bearer token (reuses MODEL_SECURITY credentials)
// ═══════════════════════════════════════════════════════════════════════════════

const RT_MGMT = 'https://api.sase.paloaltonetworks.com/ai-red-teaming/mgmt-plane'
const RT_DATA = 'https://api.sase.paloaltonetworks.com/ai-red-teaming/data-plane'
const _rtToken = { value: null, expiresAt: 0 }

async function getRedTeamToken() {
  const now = Date.now() / 1000
  if (_rtToken.value && _rtToken.expiresAt - 60 > now) return _rtToken.value

  const id  = process.env.MODEL_SECURITY_CLIENT_ID
  const sec = process.env.MODEL_SECURITY_CLIENT_SECRET
  const tsg = process.env.TSG_ID
  if (!id || !sec || !tsg) throw new Error('Missing MODEL_SECURITY_CLIENT_ID / CLIENT_SECRET / TSG_ID for Red Team API')

  const res = await fetch('https://auth.apps.paloaltonetworks.com/oauth2/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${id}:${sec}`).toString('base64'),
    },
    body: `grant_type=client_credentials&scope=tsg_id:${tsg}`,
  })
  if (!res.ok) throw new Error(`Red Team token error (${res.status}): ${await res.text()}`)
  const d = await res.json()
  _rtToken.value     = d.access_token
  _rtToken.expiresAt = now + (d.expires_in || 900)
  return d.access_token
}

async function rtFetch(base, path, method = 'GET', body = null, params = {}) {
  const token = await getRedTeamToken()
  const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''
  const res = await fetch(`${base}${path}${qs}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }
  return { status: res.status, data }
}

// ── Targets ──────────────────────────────────────────────────────────────────
app.get('/api/redteam/targets', async (req, res) => {
  try {
    const { status, data } = await rtFetch(RT_MGMT, '/v1/target', 'GET', null, { limit: 50, skip: 0 })
    res.status(status).json(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/redteam/targets', async (req, res) => {
  try {
    const { status, data } = await rtFetch(RT_MGMT, '/v1/target', 'POST', req.body, { validate: 'true' })
    res.status(status).json(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/redteam/targets/:id', async (req, res) => {
  try {
    const { status, data } = await rtFetch(RT_MGMT, `/v1/target/${req.params.id}`)
    res.status(status).json(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Jobs ──────────────────────────────────────────────────────────────────────
app.post('/api/redteam/scan', async (req, res) => {
  try {
    const { status, data } = await rtFetch(RT_DATA, '/v1/scan', 'POST', req.body)
    res.status(status).json(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/redteam/scan', async (req, res) => {
  try {
    const { status, data } = await rtFetch(RT_DATA, '/v1/scan', 'GET', null, { limit: 20, skip: 0 })
    res.status(status).json(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/redteam/scan/:id', async (req, res) => {
  try {
    const { status, data } = await rtFetch(RT_DATA, `/v1/scan/${req.params.id}`)
    res.status(status).json(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/redteam/scan/:id/abort', async (req, res) => {
  try {
    const { status, data } = await rtFetch(RT_DATA, `/v1/scan/${req.params.id}/abort`, 'POST')
    res.status(status).json(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Reports ───────────────────────────────────────────────────────────────────
app.get('/api/redteam/scan/:id/report', async (req, res) => {
  try {
    const { status, data } = await rtFetch(RT_DATA, `/v1/report/static/${req.params.id}/report`)
    res.status(status).json(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/redteam/scan/:id/attacks', async (req, res) => {
  try {
    const params = { limit: req.query.limit || 100, skip: req.query.skip || 0 }
    if (req.query.threat   !== undefined) params.threat   = req.query.threat
    if (req.query.status   !== undefined) params.status   = req.query.status
    if (req.query.category !== undefined) params.category = req.query.category
    if (req.query.sub_category) params.sub_category = req.query.sub_category
    const { status, data } = await rtFetch(RT_DATA, `/v1/report/static/${req.params.id}/list-attacks`, 'GET', null, params)
    res.status(status).json(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── GET /api/scanner/health — check if Python scanner is running ────────────
app.get('/api/scanner/health', async (_req, res) => {
  const scannerPort = process.env.MODEL_SCANNER_PORT || 8001
  try {
    const r = await fetch(`http://localhost:${scannerPort}/`)
    res.json({ running: r.ok, port: scannerPort })
  } catch {
    res.json({ running: false, port: scannerPort })
  }
})

// ─── GET /api/airs-probe — live latency test to all AIRS regional endpoints ───
app.get('/api/airs-probe', async (_req, res) => {
  if (!process.env.AIRS_API_KEY) {
    return res.status(503).json({ error: 'AIRS not configured' })
  }

  const REGIONS = [
    { id: 'us', label: 'United States', flag: '🇺🇸', base: 'https://service.api.aisecurity.paloaltonetworks.com' },
    { id: 'eu', label: 'EU (Germany)',  flag: '🇩🇪', base: 'https://service-de.api.aisecurity.paloaltonetworks.com' },
    { id: 'in', label: 'India',         flag: '🇮🇳', base: 'https://service-in.api.aisecurity.paloaltonetworks.com' },
    { id: 'sg', label: 'Singapore',     flag: '🇸🇬', base: 'https://service-sg.api.aisecurity.paloaltonetworks.com' },
  ]

  const probeRegion = async (region) => {
    const times = []
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now()
      try {
        // Pure HTTP GET — no credentials, no scan, measures network round-trip only
        await fetch(`${region.base}/`, { method: 'GET', signal: AbortSignal.timeout(5000) })
      } catch { times.push(9999); continue }
      times.push(Date.now() - t0)
    }
    const valid = times.filter(t => t < 9999)
    return {
      ...region,
      min_ms: valid.length ? Math.min(...times) : null,
      avg_ms: valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null,
      max_ms: valid.length ? Math.max(...valid) : null,
      samples: times.map(t => t === 9999 ? null : t),
      reachable: valid.length > 0,
    }
  }

  // Run all regions in parallel
  const results = await Promise.all(REGIONS.map(probeRegion))
  res.json({ regions: results, active_endpoint: process.env.AIRS_BASE_URL })
})

// ─── GET /api/health ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    airs: { configured: !!process.env.AIRS_API_KEY, profile: process.env.AIRS_PROFILE_NAME },
    vertex: { project: process.env.GCP_PROJECT_ID, region: process.env.GCP_REGION, model: process.env.VERTEX_MODEL },
    bedrock: { region: process.env.AWS_REGION, model: process.env.BEDROCK_MODEL_ID, sessionToken: !!process.env.AWS_SESSION_TOKEN },
    modelScanner: {
      configured: !!(process.env.MODEL_SECURITY_CLIENT_ID && process.env.MODEL_SECURITY_CLIENT_SECRET && process.env.TSG_ID),
      localGroupSet: !!process.env.LOCAL_SCAN_GROUP_UUID,
      hfGroupSet: !!process.env.HF_SCAN_GROUP_UUID,
    },
  })
})

// ─── GET /api/traces ──────────────────────────────────────────────────────────
app.get('/api/traces', (req, res) => {
  try {
    const { status, model, category, search, limit = '50', offset = '0' } = req.query
    const traces = getTraces({ status, model, category, search, limit: parseInt(limit), offset: parseInt(offset) })
    res.json({ traces, total: traces.length })
  } catch (err) {
    console.error('[traces] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/traces/metrics ──────────────────────────────────────────────────
app.get('/api/traces/metrics', (req, res) => {
  try {
    const sinceMap = { '20m': '-20 minutes', '1h': '-1 hours', '24h': '-24 hours', 'all': '-100 years' }
    const since = sinceMap[req.query.since] ?? '-20 minutes'
    res.json(getMetrics(since))
  } catch (err) {
    console.error('[traces/metrics] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/traces/:id ──────────────────────────────────────────────────────
app.get('/api/traces/:id', (req, res) => {
  try {
    const trace = getTrace(req.params.id)
    if (!trace) return res.status(404).json({ error: 'trace not found' })
    res.json(trace)
  } catch (err) {
    console.error('[traces/:id] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── DELETE /api/traces ───────────────────────────────────────────────────────
app.delete('/api/traces', (req, res) => {
  try {
    deleteAllTraces()
    res.json({ ok: true })
  } catch (err) {
    console.error('[traces] DELETE Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── DELETE /api/traces/:id ───────────────────────────────────────────────────
app.delete('/api/traces/:id', (req, res) => {
  try {
    deleteTrace(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    console.error('[traces/:id] DELETE Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Release Notes scraper (weekly cache) ─────────────────────────────────────
const RN_PILLARS = [
  { name: 'AI Runtime Firewall',  emoji: '🔥', color: '#ef4444', url: 'https://docs.paloaltonetworks.com/ai-runtime-security/release-notes/features-introduced/ai-runtime-security-network-intercept' },
  { name: 'AI Runtime API',       emoji: '🔌', color: '#3b82f6', url: 'https://docs.paloaltonetworks.com/ai-runtime-security/release-notes/features-introduced/ai-runtime-security-api-intercept' },
  { name: 'AI Model Security',    emoji: '🛡️',  color: '#8b5cf6', url: 'https://docs.paloaltonetworks.com/ai-runtime-security/release-notes/features-introduced/ai-model-security' },
  { name: 'AI Red Teaming',       emoji: '🎯', color: '#f97316', url: 'https://docs.paloaltonetworks.com/ai-runtime-security/release-notes/features-introduced/ai-red-teaming' },
]
const RN_CACHE = { data: null, fetchedAt: 0 }
const RN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/\s+/g, ' ').trim()
}

function parseReleaseNotes(html) {
  const features = []
  // Top-level concept divs only (id="concept-XXX" but not deeper nested ones)
  const sectionRe = /<div[^>]+class="[^"]*topic[^"]*concept[^"]*"[^>]+id="(concept-[^"]*)"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*topic[^"]*concept[^"]*"|$)/gi
  let m
  while ((m = sectionRe.exec(html)) !== null) {
    const block = m[2]

    // Title: first h2
    const titleM = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
    if (!titleM) continue
    const title = stripTags(titleM[1])
    if (!title || title.length < 4) continue

    // Date: inside <tt> tag or bare month year text
    const dateM = block.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\b/)
    const date = dateM ? dateM[0] : ''

    // "Supported for:" — grab li items after it
    let supportedFor = ''
    const supportedM = block.match(/Supported\s+for[^<]*<\/b[^>]*>([\s\S]*?)(?=<\/div>|<section)/i)
    if (supportedM) {
      const liM = supportedM[1].match(/<li[^>]*>([\s\S]*?)<\/li>/i)
      if (liM) supportedFor = stripTags(liM[1])
    }

    // Extract the main content section (after the table with date/supported-for)
    const sectionM = block.match(/<section[^>]*class="[^"]*section[^"]*"[^>]*>([\s\S]*?)<\/section>/i)
    const contentBlock = sectionM ? sectionM[1] : block

    // Paragraphs: <div class="p"> is how PA docs renders paragraphs
    const paragraphs = []
    const divParaRe = /<div[^>]+class="[^"]*\bp\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    let dp
    while ((dp = divParaRe.exec(contentBlock)) !== null) {
      const txt = stripTags(dp[1]).trim()
      if (txt.length > 25 && !txt.match(/^Supported\s+for/i)) paragraphs.push(txt)
    }
    // Fallback: real <p> tags
    if (!paragraphs.length) {
      const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi
      let pm
      while ((pm = pRe.exec(contentBlock)) !== null) {
        const txt = stripTags(pm[1]).trim()
        if (txt.length > 25 && !txt.match(/^Supported\s+for/i)) paragraphs.push(txt)
      }
    }

    // Bullets: <li class="li"> inside the section
    const bullets = []
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi
    let lm
    while ((lm = liRe.exec(contentBlock)) !== null) {
      const txt = stripTags(lm[1]).trim()
      if (txt.length > 10) bullets.push(txt)
    }

    features.push({ title, date, supportedFor, paragraphs, bullets })
  }
  return features
}

function parseDateKey(dateStr) {
  const months = { january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12 }
  const parts = (dateStr || '').toLowerCase().split(' ')
  return (parseInt(parts[1]) || 0) * 100 + (months[parts[0]] || 0)
}

async function fetchReleaseNotes() {
  const results = []
  for (const pillar of RN_PILLARS) {
    try {
      const res = await fetch(pillar.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      const features = parseReleaseNotes(html)
      features.sort((a, b) => parseDateKey(b.date) - parseDateKey(a.date))
      results.push({ ...pillar, features, error: null })
    } catch (err) {
      results.push({ ...pillar, features: [], error: err.message })
    }
  }
  return results
}

app.get('/api/release-notes', async (req, res) => {
  const force = req.query.force === '1'
  const now = Date.now()
  if (!force && RN_CACHE.data && (now - RN_CACHE.fetchedAt) < RN_TTL_MS) {
    return res.json({ pillars: RN_CACHE.data, fetchedAt: new Date(RN_CACHE.fetchedAt).toISOString(), cached: true })
  }
  try {
    console.log('[release-notes] Scraping Palo Alto docs...')
    const pillars = await fetchReleaseNotes()
    RN_CACHE.data = pillars
    RN_CACHE.fetchedAt = now
    console.log(`[release-notes] Done. Features: ${pillars.map(p => p.features.length).join(', ')}`)
    res.json({ pillars, fetchedAt: new Date(now).toISOString(), cached: false })
  } catch (err) {
    console.error('[release-notes]', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── System health endpoint ───────────────────────────────────────────────────
import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)

app.get('/api/system-health', async (_req, res) => {
  try {
    const mem = process.memoryUsage()
    const uptime = process.uptime()

    // OS memory (Linux: free -m, macOS: vm_stat fallback)
    let osMem = null
    try {
      const { stdout } = await execFileAsync('free', ['-m'], { timeout: 3000 })
      const lines = stdout.trim().split('\n')
      const memLine = lines.find(l => l.startsWith('Mem:'))?.split(/\s+/)
      if (memLine) osMem = { totalMb: +memLine[1], usedMb: +memLine[2], freeMb: +memLine[3], availableMb: +memLine[6] }
    } catch {}

    // Disk usage for /
    let disk = null
    try {
      const { stdout } = await execFileAsync('df', ['-m', '/'], { timeout: 3000 })
      const line = stdout.trim().split('\n')[1]?.split(/\s+/)
      if (line) disk = { totalMb: +line[1], usedMb: +line[2], availableMb: +line[3], usePct: line[4] }
    } catch {}

    res.json({
      node: { version: process.version, uptimeSec: Math.round(uptime), memMb: Math.round(mem.rss / 1024 / 1024) },
      os: osMem,
      disk,
      ts: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════════╗`)
  console.log(`  ║  SUDO AIRS Demo  →  http://localhost:${PORT}    ║`)
  console.log(`  ╠══════════════════════════════════════════════╣`)
  console.log(`  ║  AIRS profile : ${process.env.AIRS_PROFILE_NAME}`)
  console.log(`  ║  Vertex AI    : ${process.env.GCP_PROJECT_ID} / ${process.env.VERTEX_MODEL}`)
  console.log(`  ║  Bedrock      : ${process.env.BEDROCK_MODEL_ID} (${process.env.AWS_REGION})`)
  if (!process.env.AWS_SESSION_TOKEN) {
    console.log(`  ║  ⚠  AWS_SESSION_TOKEN not set (ASIA key detected)`)
  }
  console.log(`  ╚══════════════════════════════════════════════╝\n`)
})
