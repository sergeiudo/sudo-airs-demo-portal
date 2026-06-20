// MCP Registry demo for the AI/LLM Gateway pillar.
//
// Showcases Portkey's MCP Registry: a crypto question is answered by routing tool
// calls through the CoinGecko MCP server hosted by Portkey
// (https://mcp.portkey.ai/coingecko/mcp). The model decides whether to use the
// tools; the backend runs the agentic loop and streams every step to the UI.
//
// Provider note: the model turns go straight to Vertex's OpenAI-compatible
// endpoint (so the native/AIRS guardrail configs — which would block the JS the
// `execute` tool needs — are NOT in the path). The MCP tool calls are what route
// through the Portkey MCP Registry. That's the part being showcased.

import { GoogleAuth } from 'google-auth-library'

const MCP_URL = 'https://mcp.portkey.ai/coingecko/mcp'
const mcpAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })

const SYSTEM_PROMPT = [
  'You are a crypto-market assistant with access to the CoinGecko MCP server,',
  'reached through the Portkey MCP Registry. You have two tools:',
  '- search_docs(query, language): find the correct CoinGecko SDK method BEFORE writing code. Always pass language "typescript".',
  '- execute(code): run TypeScript. The code MUST be a single top-level async function:',
  '    async function run(client) { /* ... */ return <data>; }',
  '  Use the method you discovered via search_docs (e.g. client.simple.price.get({ ids, vs_currencies })).',
  '',
  'For any crypto / token / market question: (1) call search_docs to find the method,',
  '(2) call execute with a run(client) function that returns the data, then (3) answer the',
  'user concisely using the live numbers (include $ and 24h % where relevant).',
  'If the question is NOT about crypto or markets, just answer directly without using any tools.',
].join('\n')

// ── MCP JSON-RPC over streamable HTTP ────────────────────────────────────────
// Each POST returns a single SSE `event: message` frame with the JSON-RPC reply.
async function mcpRpc(method, params, id) {
  const resp = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'x-portkey-api-key': process.env.PORTKEY_API_KEY || '',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    signal: AbortSignal.timeout(60000),
  })
  const text = await resp.text()
  const datas = text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).filter(Boolean)
  let msg = null
  for (const d of datas) {
    try { const j = JSON.parse(d); if (j && (j.id === id || j.result || j.error)) msg = j } catch {}
  }
  if (!msg) throw new Error(`MCP ${method}: no JSON-RPC message in response`)
  if (msg.error) throw new Error(`MCP ${method}: ${JSON.stringify(msg.error).slice(0, 200)}`)
  return msg.result
}

function toolResultText(result) {
  if (!result) return ''
  return (result.content || []).map(c => c.text ?? JSON.stringify(c)).join('\n')
}

// Human-readable threats from an AIRS scan `data` object.
function airsThreats(d) {
  const out = []
  for (const det of [d?.prompt_detected, d?.response_detected]) {
    for (const [k, v] of Object.entries(det || {})) if (v === true) out.push(k.replace(/_/g, ' '))
  }
  return out
}

// ── Vertex OpenAI-compatible chat turn (with optional tools) ─────────────────
// gemini-3.x lives on the `global` endpoint; gemini-2.5 on the regional one.
function vertexLocation(bareModel) {
  return /^gemini-3/.test(bareModel) ? 'global' : (process.env.GCP_REGION || 'us-central1')
}

async function vertexTurn(messages, tools, bareModel) {
  const project = process.env.GCP_PROJECT_ID
  const location = vertexLocation(bareModel)
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`
  const url = `https://${host}/v1/projects/${project}/locations/${location}/endpoints/openapi/chat/completions`
  const token = (await (await mcpAuth.getClient()).getAccessToken()).token
  const body = { model: `google/${bareModel}`, messages, max_tokens: 1200 }
  if (tools && tools.length) { body.tools = tools; body.tool_choice = 'auto' }
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  })
  const d = await resp.json()
  if (d.error) throw new Error(`Vertex: ${JSON.stringify(d.error).slice(0, 200)}`)
  return d.choices?.[0]?.message || { content: '' }
}

// ── SSE orchestration endpoint: POST /api/gateway/mcp ────────────────────────
export async function mcpChatHandler(req, res) {
  const { prompt, model, airs } = req.body || {}
  if (!process.env.PORTKEY_API_KEY) {
    return res.status(503).json({ error: 'configure_portkey', missing: ['PORTKEY_API_KEY'] })
  }
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: 'bad_request', message: 'prompt required' })
  }
  const bareModel = String(model || 'gemini-3.1-flash-lite').split('/').slice(-1)[0]

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
  const send = (event, data) => {
    if (res.writableEnded) return
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  const startedAt = Date.now()
  try {
    // 0. AIRS edge protection (optional) — scan the prompt BEFORE it reaches the
    // model or the MCP. A blocked prompt never runs a single tool.
    let airscanFn = null
    if (airs) {
      try {
        const mod = await import('./server.js')
        airscanFn = mod.airscan
        const r = await airscanFn(prompt, null, bareModel)
        const d = r?.data || {}
        const blocked = d.action === 'block'
        send('step', { kind: 'airs', phase: 'input', ok: !blocked, action: d.action, category: d.category, latencyMs: r.latencyMs, threats: airsThreats(d), profile: d.profile_name })
        if (blocked) {
          send('blocked', { reason: 'airs', phase: 'input', category: d.category, threats: airsThreats(d), latencyMs: r.latencyMs, profile: d.profile_name })
          send('done', {})
          return res.end()
        }
      } catch (e) {
        send('step', { kind: 'airs', phase: 'input', ok: true, note: 'scan skipped: ' + String(e?.message || e).slice(0, 80) })
      }
    }

    // 1. Connect to the Portkey MCP Registry server
    const init = await mcpRpc('initialize', {
      protocolVersion: '2025-03-26', capabilities: {},
      clientInfo: { name: 'sudo-demo-portal', version: '1.0' },
    }, 1)
    const serverInfo = init?.serverInfo || {}
    send('step', { kind: 'connect', server: serverInfo.name || 'coingecko', version: serverInfo.version || '', url: 'mcp.portkey.ai/coingecko/mcp' })

    // 2. Discover tools
    const listed = await mcpRpc('tools/list', {}, 2)
    const mcpTools = listed?.tools || []
    send('step', { kind: 'tools', tools: mcpTools.map(t => t.name) })
    const tools = mcpTools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }))

    // 3. Agentic loop
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }]
    let answer = ''
    let rounds = 0
    const MAX_ROUNDS = 5
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const msg = await vertexTurn(messages, tools, bareModel)
      const calls = msg.tool_calls || []
      if (!calls.length) { answer = msg.content || ''; break }
      rounds++
      messages.push({ role: 'assistant', content: msg.content || '', tool_calls: calls })
      for (const tc of calls) {
        let args = {}
        try { args = JSON.parse(tc.function?.arguments || '{}') } catch {}
        send('step', { kind: 'tool_call', name: tc.function?.name, args, round: rounds })
        let resultText
        try {
          const r = await mcpRpc('tools/call', { name: tc.function?.name, arguments: args }, 100 + i)
          resultText = toolResultText(r)
          send('step', { kind: 'tool_result', name: tc.function?.name, ok: !r?.isError, result: resultText.slice(0, 1400), round: rounds })
        } catch (e) {
          resultText = `error: ${String(e?.message || e)}`
          send('step', { kind: 'tool_result', name: tc.function?.name, ok: false, result: resultText, round: rounds })
        }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: resultText })
      }
    }

    // If the loop ran tools but never produced text, force one final answer turn.
    if (!answer) {
      const fin = await vertexTurn(
        [...messages, { role: 'user', content: 'Now answer my original question concisely using the tool results above.' }],
        undefined, bareModel,
      )
      answer = fin.content || '(no answer produced)'
    }

    // AIRS output scan on the final answer (edge protection)
    if (airscanFn && answer) {
      try {
        const r = await airscanFn(prompt, answer, bareModel)
        const d = r?.data || {}
        const blocked = d.action === 'block'
        send('step', { kind: 'airs', phase: 'output', ok: !blocked, action: d.action, category: d.category, latencyMs: r.latencyMs, threats: airsThreats(d), profile: d.profile_name })
        if (blocked) answer = '🛡 Response withheld — Prisma AIRS flagged the model output.'
      } catch (e) {
        send('step', { kind: 'airs', phase: 'output', ok: true, note: 'scan skipped' })
      }
    }

    send('answer', { text: answer, rounds, latencyMs: Date.now() - startedAt, model: bareModel, server: serverInfo.name || 'coingecko', airs: !!airs })
  } catch (e) {
    send('error', { message: String(e?.message || e) })
  } finally {
    if (!res.writableEnded) { send('done', {}); res.end() }
  }
}

export function mcpHealth(_req, res) {
  res.json({
    ok: !!process.env.PORTKEY_API_KEY,
    server: 'coingecko',
    version: 'v6.0.0',
    url: 'mcp.portkey.ai/coingecko/mcp',
    tools: ['execute', 'search_docs'],
  })
}
