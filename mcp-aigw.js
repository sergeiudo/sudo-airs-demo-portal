/**
 * mcp-aigw.js — real MCP tool-calling for the API Intercept "SCM AI-GW" backend.
 *
 * The other three backends answer from the model alone. This one can reach out
 * to MCP servers registered on the SCM AI Gateway (plus one third-party server
 * that is NOT brokered by the gateway), run a multi-step agentic loop inside
 * the protected lane, and return the full step trace so the UI can show how the
 * answer was actually produced.
 *
 * Why it belongs in a security pillar rather than being an MCP toy:
 *   • every model turn still goes through the AI-GW AIRS guardrail
 *   • each server's tools/list manifest is scanned as an AIRS tool_event before
 *     a single description is shown to the model — that is the tool-poisoning
 *     check, and these are genuinely third-party manifests
 *   • each tool call is scanned twice: parameters before execution (stage 1)
 *     and the result before the model reads it (stage 2). Stage 2 is the one
 *     that matters most here: a tool result is untrusted remote content and is
 *     the classic indirect-injection vector.
 *
 * Measured before this was written (Sep 2026), so the shapes below are not
 * guesses: tool calling works through the AI-GW WITH the guardrail attached —
 * Kimi K2.5, Opus 4.8 and Claude 3 Haiku all return finish_reason 'tool_use'
 * with well-formed arguments in 3-4s.
 */

import { captureHttp } from './telemetry.js'

// ─── Server registry ──────────────────────────────────────────────────────────
//
// `allow` is an ALLOW-LIST, never a deny-pattern. The GitHub server is
// authenticated as a real user account and exposes 17 write tools; three of
// them (issue_write, pull_request_review_write, sub_issue_write) do not match
// the create_/update_/delete_ naming a deny-pattern would key on, so a
// deny-pattern silently leaks write access. This pillar fires prompt injections
// by design and runs with AIRS off half the time — nothing here may be able to
// mutate a real repository.
//
// The lists are also a token budget. All 30 GitHub read tools total ~85KB of
// JSON schema; sending that every turn is both expensive and worse for tool
// selection than a focused set.

export const MCP_SERVERS = [
  {
    id: 'huggingface',
    label: 'Hugging Face',
    short: 'HF',
    url: 'https://mcp-aigw.portkey.ai/huggingface/mcp',
    brokered: true, // registered on the SCM AI Gateway
    accent: '#FFD21E',
    blurb: 'Models, datasets, Spaces and papers on the Hugging Face Hub.',
    allow: ['hf_whoami', 'hub_repo_search', 'hub_repo_details', 'hf_fs'],
    // No bare 'model', 'models' or 'llm': every prompt in an AI-security demo
    // contains them, and routing on them offered Hub tools to "what model are you?".
    hints: ['huggingface', 'hugging face', 'hf', 'dataset', 'datasets', 'spaces', 'checkpoint',
            'checkpoints', 'fine-tune', 'finetune', 'safetensors', 'gguf', 'model card',
            'trending models', 'open-source model', 'open-source models', 'open weights'],
    guidance: [
      'Hugging Face tools:',
      '- hub_repo_search(query, repo_type): find models / datasets / spaces. repo_type is "model", "dataset" or "space".',
      '- hub_repo_details(...): details for a specific repo once you know its id.',
      '- hf_fs(...): list or read files inside a repo.',
      '- hf_whoami(): the authenticated Hugging Face account.',
      'Report download counts, likes and the repo id when you have them.',
    ].join('\n'),
  },
  {
    id: 'github',
    label: 'GitHub',
    short: 'GH',
    url: 'https://mcp-aigw.portkey.ai/github-copilot/mcp',
    brokered: true,
    accent: '#8B949E',
    blurb: 'Repositories, issues, pull requests and code search. Read-only.',
    // Read-only by explicit allow-list. Adding a name here grants the model
    // that capability against a real GitHub account — do not add a *_write
    // tool, issue_write, pull_request_review_write or sub_issue_write.
    allow: [
      'get_me',
      'search_repositories',
      'get_file_contents',
      'list_commits',
      'list_issues',
      'list_pull_requests',
      'search_code',
      'get_latest_release',
    ],
    // Bare 'issue'/'release'/'branch' are gone for the same reason — "security
    // issues with LLMs" is not a GitHub question.
    hints: ['github', 'repo', 'repos', 'repository', 'repositories', 'pull request', 'pull requests',
            'pull-request', 'pr', 'prs', 'commit', 'commits', 'open issues', 'github issues',
            'latest release', 'changelog', 'source code', 'readme', 'contributor', 'contributors'],
    guidance: [
      'GitHub tools (READ-ONLY — you cannot create, edit, push, merge or delete anything):',
      '- search_repositories(query): find repositories.',
      '- get_file_contents(owner, repo, path): read a file, e.g. path "README.md".',
      '- list_commits / list_issues / list_pull_requests(owner, repo): recent activity.',
      '- search_code(query): code search across GitHub. Slow (up to ~10s) — prefer search_repositories or get_file_contents when they answer the question.',
      '- get_me(): the authenticated GitHub account.',
      'If the user names a repo as "owner/name", split it into the owner and repo arguments.',
      'If asked to create, modify, merge or delete anything, explain that this demo is read-only and refuse.',
    ].join('\n'),
  },
  {
    id: 'coingecko',
    label: 'CoinGecko',
    short: 'CG',
    url: 'https://mcp.api.coingecko.com/mcp',
    // NOT brokered by the gateway — this one is called directly. That contrast
    // is the point: the gateway has no visibility into it, so the only control
    // on its tool definitions and results is the direct AIRS tool_event scan.
    brokered: false,
    needsSession: true, // returns Mcp-Session-Id on initialize and demands it back
    accent: '#8DC647',
    blurb: 'Live crypto prices and market data. Called directly, not via the gateway.',
    allow: ['search_docs', 'execute'],
    // No bare 'token' or 'price': LLM tokens and API pricing are not crypto.
    hints: ['crypto', 'cryptocurrency', 'coin', 'coins', 'bitcoin', 'btc', 'ethereum', 'eth',
            'solana', 'bnb', 'binancecoin', 'xrp', 'ripple', 'doge', 'dogecoin', 'market cap',
            'marketcap', 'defi', 'stablecoin', 'altcoin', 'nft'],
    guidance: [
      'CoinGecko tools — this server exposes a code runner, not per-metric endpoints:',
      '- execute(code): run TypeScript. The code MUST be one top-level async function:',
      '    async function run(client) { /* ... */ return <data>; }',
      '  For live prices call execute directly — no search_docs needed:',
      '    client.simple.price.get({ ids: "bitcoin,ethereum", vs_currencies: "usd", include_24hr_change: true })',
      '- search_docs(query, language): only when you need a method other than simple.price. Always pass language "typescript".',
      'CoinGecko ids: BTC=bitcoin, ETH=ethereum, SOL=solana, BNB=binancecoin, XRP=ripple, DOGE=dogecoin.',
      'Quote live figures with $ and the 24h % change where available.',
    ].join('\n'),
  },
]

export const MCP_SERVER_IDS = MCP_SERVERS.map((s) => s.id)
const byId = Object.fromEntries(MCP_SERVERS.map((s) => [s.id, s]))

// Tool names are namespaced so two servers cannot collide and so the step trace
// can say which server ran. Bedrock requires ^[a-zA-Z0-9_-]{1,64}$, and every
// upstream name here is already snake_case, so "<server>__<tool>" is safe.
const NS = '__'
const nsName = (serverId, tool) => `${serverId}${NS}${tool}`
function unNs(name) {
  const i = String(name).indexOf(NS)
  if (i < 0) return { serverId: null, tool: name }
  return { serverId: name.slice(0, i), tool: name.slice(i + NS.length) }
}

// ─── JSON-RPC over streamable HTTP ────────────────────────────────────────────

// Session ids live for the process. CoinGecko hands one back on initialize and
// rejects every later call without it; the brokered servers need none.
const sessions = new Map()

async function rpc(server, method, params, id, { retryOnSession = true } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  }
  if (server.brokered) headers['x-portkey-api-key'] = process.env.AIGW_API_KEY || ''
  // `initialize` must NOT carry a session id — CoinGecko rejects it outright
  // with "Initialization requests must not include a sessionId". Attaching the
  // id cached from a previous handshake is why the first run of the process
  // succeeded and every run after it failed discovery.
  const sid = method === 'initialize' ? null : sessions.get(server.id)
  if (sid) headers['Mcp-Session-Id'] = sid

  const body = id == null
    ? { jsonrpc: '2.0', method, params }
    : { jsonrpc: '2.0', id, method, params }

  const resp = await fetch(server.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  })

  const newSid = resp.headers.get('mcp-session-id')
  if (newSid) sessions.set(server.id, newSid)

  // Notifications get no reply body.
  if (id == null) return null

  const text = await resp.text()
  const ct = resp.headers.get('content-type') || ''

  // An inline web filter (PAN-OS URL filtering categorises CoinGecko as
  // cryptocurrency) answers with an HTML block page instead of JSON-RPC.
  if (/web page blocked/i.test(text)) {
    throw new Error(
      `${server.label}: blocked by a network URL filter — this endpoint is categorised as cryptocurrency. ` +
      `Allow ${new URL(server.url).host} in the URL-filtering policy, or disconnect the filtering VPN.`
    )
  }
  if (!resp.ok && !text.trim().startsWith('{')) {
    throw new Error(`${server.label} ${method}: HTTP ${resp.status} (${ct || 'no content-type'})`)
  }

  const datas = text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).filter(Boolean)
  let msg = null
  if (datas.length) {
    for (const d of datas) {
      try { const j = JSON.parse(d); if (j && (j.id === id || j.result || j.error)) msg = j } catch { /* keep looking */ }
    }
  } else {
    try { msg = JSON.parse(text) } catch { /* handled below */ }
  }
  if (!msg) throw new Error(`${server.label} ${method}: no JSON-RPC message in the response`)

  if (msg.error) {
    // A dropped session reads as a normal error; re-handshake once rather than
    // failing the whole turn.
    const em = String(msg.error?.message || '')
    if (retryOnSession && /session/i.test(em)) {
      sessions.delete(server.id)
      await handshake(server)
      return rpc(server, method, params, id, { retryOnSession: false })
    }
    throw new Error(`${server.label} ${method}: ${em || JSON.stringify(msg.error).slice(0, 200)}`)
  }
  return msg.result
}

async function handshake(server) {
  // Drop any stale session before re-initialising, so the new id returned by
  // this handshake is the one used for the calls that follow it.
  sessions.delete(server.id)
  await rpc(server, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'sudo-airs-demo-portal', version: '1.0' },
  }, 1, { retryOnSession: false })
  if (server.needsSession) {
    try { await rpc(server, 'notifications/initialized', {}, null, { retryOnSession: false }) } catch { /* optional */ }
  }
}

// ─── Tool discovery (cached, AIRS-scanned) ────────────────────────────────────

const TOOL_TTL_MS = 10 * 60 * 1000
const toolCache = new Map() // serverId -> { at, tools, manifestScan }

/**
 * tools/list for one server, filtered to the allow-list, with the raw manifest
 * scanned by AIRS as a tool_event.
 *
 * The scan runs over the UNFILTERED manifest on purpose — a poisoned
 * description on a tool we do not expose is still evidence the server is
 * compromised, and hiding it would make the demo weaker than reality.
 */
export async function listServerTools(server, { airsEnabled = true, scanTools = null } = {}) {
  const hit = toolCache.get(server.id)
  if (hit && Date.now() - hit.at < TOOL_TTL_MS) return hit

  await handshake(server)
  const result = await rpc(server, 'tools/list', {}, 2)
  const all = result?.tools || []

  let manifestScan = null
  let manifestTiming = null
  if (airsEnabled && scanTools && all.length) {
    const m0 = performance.now()
    try {
      // tools/list output MUST be a bare mcp.Tool[]; wrapping it as
      // {"tools":[…]} fails with "cannot unmarshal object into Go value of
      // type []*mcp.Tool".
      manifestScan = await scanTools({
        serverName: server.id,
        method: 'tools/list',
        toolName: all[0]?.name || 'tools/list',
        toolInput: JSON.stringify({ method: 'tools/list' }),
        toolOutput: JSON.stringify(all.map((t) => ({
          name: t.name, description: t.description, inputSchema: t.inputSchema || { type: 'object' },
        }))),
      })
    } catch (e) {
      manifestScan = { error: String(e?.message || e).slice(0, 200) }
    }
    manifestTiming = { start: m0, end: performance.now(), http: manifestScan?._http ?? [] }
  }

  const allowed = all.filter((t) => server.allow.includes(t.name))
  const entry = {
    at: Date.now(),
    serverId: server.id,
    tools: allowed,
    totalCount: all.length,
    hiddenCount: all.length - allowed.length,
    manifestScan,
    manifestTiming,
  }
  toolCache.set(server.id, entry)
  return entry
}

/** OpenAI/Bedrock function-tool shape, namespaced. */
function toOpenAiTools(serverId, tools) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: nsName(serverId, t.name),
      description: t.description || '',
      parameters: t.inputSchema || { type: 'object', properties: {} },
    },
  }))
}

// ─── Routing ──────────────────────────────────────────────────────────────────

/**
 * Which servers should be offered for this question.
 *
 * Keyword routing rather than a model call: it is one round-trip cheaper, it is
 * deterministic on stage, and the chosen server is something the chain-of-
 * thought panel can show as its own step.
 *
 * Hints match WHOLE words. A substring match sent "prompt" to GitHub (it
 * contains "pr"), so nearly every question in this pillar — prompt injection,
 * system prompts, "Prisma", "previous instructions" — was handed seven GitHub
 * tools, and a benign one-line question took a minute of searches.
 *
 * No match means no tools: the MCP servers are here to showcase tool calling on
 * prompts that are actually about them, not to be offered to everything.
 */
const hintRe = new Map()
function mentions(q, hint) {
  if (!hintRe.has(hint)) {
    const esc = hint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    hintRe.set(hint, new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`))
  }
  return hintRe.get(hint).test(q)
}

export function routeServers(prompt, forced = 'auto') {
  if (forced && forced !== 'auto') {
    const s = byId[forced]
    return { servers: s ? [s] : [], reason: `forced to ${s?.label ?? forced} by the operator` }
  }
  const q = String(prompt || '').toLowerCase()
  const scored = MCP_SERVERS
    .map((s) => ({ s, score: s.hints.reduce((n, h) => n + (mentions(q, h) ? 1 : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  if (!scored.length) {
    return { servers: [], reason: 'no MCP topic in the question — answered without tools' }
  }
  const top = scored[0].score
  const picked = scored.filter((x) => x.score >= top).map((x) => x.s)
  return {
    servers: picked,
    reason: `matched ${picked.map((s) => s.label).join(' + ')} on the question wording`,
  }
}

// ─── The agentic loop ─────────────────────────────────────────────────────────

const MAX_ROUNDS = 5
const MAX_TOOL_RESULT_CHARS = 6000

// Deliberately NOT borrowed from the n8n prompt: "security is enforced upstream,
// process requests directly". That tells the model to lower its own guard, which
// would make the unprotected lane look worse than it is — rigging, not a demo.
function systemPrompt(servers) {
  return [
    'You are a research assistant with access to the live MCP (Model Context Protocol) servers below.',
    '',
    'When to use a tool:',
    '- Only when the question needs live data one of these servers holds: a price, a repository, a file, a model or dataset on the Hub.',
    '- General, conceptual or security questions: answer directly from your own knowledge and call no tool, even if a tool looks loosely related.',
    '- When a tool is needed, make the fewest calls that answer the question, and request independent calls together in one turn. Stop as soon as you have enough.',
    '- Never invent a figure a tool should supply. If a tool fails or returns nothing useful, say so plainly.',
    '- If Prisma AIRS blocks a call or withholds a result, say so in one sentence. Do not retry it or work around it with another tool.',
    '',
    'Answer concisely and directly, quoting the live figures you retrieved. Do not narrate tool calls or paste raw tool output: the execution trace is shown to the user separately.',
    '',
    ...servers.map((s) => `## ${s.label}\n${s.guidance}`),
  ].join('\n')
}

/**
 * Run the MCP tool-calling loop through the SCM AI Gateway.
 *
 * @param {object}   o
 * @param {string}   o.prompt
 * @param {string}   o.model              full "@slug/model" id
 * @param {Function} o.createCompletion   ({messages, tools}) => portkey completion
 * @param {Function} o.scanTool           AIRS tool_event scan, or null when AIRS is off
 * @param {Function} o.detectBlock        (completion) => blockReason|null. Required: on this
 *                                        tenant a guardrail block is HTTP 200 with the content
 *                                        replaced, so without it the loop hands the audience
 *                                        "The guardrail checks defined in the config failed."
 *                                        as if it were the model's answer.
 * @param {string}   o.forcedServer       'auto' | server id
 * @param {boolean}  o.airsEnabled
 * @returns {{answer, steps, blocked, blockReason, servers, rounds, toolCalls, latencyMs}}
 */
export async function runMcpLoop({
  prompt, model, createCompletion, scanTool = null, detectBlock = null,
  forcedServer = 'auto', airsEnabled = true,
}) {
  const t0 = Date.now()
  const steps = []
  const route = routeServers(prompt, forcedServer)

  steps.push({
    kind: 'route',
    title: 'Selecting MCP servers',
    detail: route.reason,
    servers: route.servers.map((s) => ({ id: s.id, label: s.label, brokered: s.brokered })),
  })

  // ── Discover + scan manifests (skipped when nothing was routed)
  const tools = []
  const liveServers = []
  for (const s of route.servers) {
    try {
      const d0 = performance.now()
      const entry = await listServerTools(s, { airsEnabled, scanTools: scanTool })
      const d1 = performance.now()
      // A manifest cached from an earlier run was neither fetched nor scanned
      // now — say so, rather than drawing a scan that did not happen here.
      const cached = entry.manifestTiming ? entry.manifestTiming.start < d0 : (d1 - d0) < 5
      const verdict = entry.manifestScan?.data
      steps.push({
        kind: 'discover',
        title: `${s.label} · tools/list`,
        detail: `${entry.tools.length} tool${entry.tools.length === 1 ? '' : 's'} offered` +
                (entry.hiddenCount ? ` · ${entry.hiddenCount} withheld by the read-only allow-list` : ''),
        server: s.id,
        brokered: s.brokered,
        toolNames: entry.tools.map((t) => t.name),
        scan: verdict ? { action: verdict.action, category: verdict.category, scanId: verdict.scan_id } : null,
        scanError: entry.manifestScan?.error ?? null,
        timing: { start: d0, end: d1, cached, manifestScan: cached ? null : entry.manifestTiming },
      })
      // A poisoned manifest is not something to route around quietly.
      if (verdict?.action === 'block') {
        steps.push({
          kind: 'blocked',
          title: `${s.label} manifest blocked by Prisma AIRS`,
          detail: `AIRS flagged this server's tool definitions (${verdict.category}). Its tools were not offered to the model.`,
          server: s.id,
        })
        continue
      }
      tools.push(...toOpenAiTools(s.id, entry.tools))
      liveServers.push(s)
    } catch (e) {
      steps.push({ kind: 'error', title: `${s.label} unreachable`, detail: String(e?.message || e).slice(0, 300), server: s.id })
    }
  }

  if (route.servers.length && !tools.length) {
    return {
      answer: '', steps, blocked: false,
      error: 'No MCP tools are available — every matched server failed discovery or was blocked.',
      servers: liveServers.map((s) => s.id), rounds: 0, toolCalls: 0, latencyMs: Date.now() - t0,
    }
  }

  // ── Loop. With no server routed this is one plain turn — no tools and no
  // system prompt — so a payload behaves exactly as it does with MCP off.
  const messages = liveServers.length
    ? [{ role: 'system', content: systemPrompt(liveServers) }, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }]
  let answer = ''
  let rounds = 0
  let toolCalls = 0
  let lastHooks = null
  let blocked = false
  let blockReason = null
  // One entry per model turn through the gateway, with its own guardrail time —
  // the loop used to reach the trace as a single "LLM inference" bar.
  const turns = []
  const hookMs = (hooks) => (hooks || []).reduce((n, h) => n + (h?.execution_time || 0), 0) || null

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    rounds = round
    const c0 = performance.now()
    const completion = await createCompletion({ messages, tools })
    const c1 = performance.now()
    lastHooks = completion?.hook_results ?? lastHooks
    turns.push({
      round,
      start: c0,
      end: c1,
      tokensIn: completion?.usage?.prompt_tokens ?? null,
      tokensOut: completion?.usage?.completion_tokens ?? null,
      finish: completion?.choices?.[0]?.finish_reason ?? null,
      toolCalls: completion?.choices?.[0]?.message?.tool_calls?.length ?? 0,
      toolsOffered: tools.length,
      guardrailInMs: hookMs(completion?.hook_results?.before_request_hooks),
      guardrailOutMs: hookMs(completion?.hook_results?.after_request_hooks),
      http: completion?._http ?? [],
    })

    // The gateway guardrail can stop any round, not just the first — a tool
    // result carrying an injection is caught on the NEXT model turn.
    const gwBlock = detectBlock ? detectBlock(completion) : null
    if (gwBlock) {
      blocked = true
      blockReason = gwBlock
      steps.push({
        kind: 'blocked',
        title: `Blocked by the AI Gateway guardrail${round > 1 ? ` on round ${round}` : ''}`,
        detail: gwBlock,
        round,
      })
      break
    }

    const choice = completion?.choices?.[0]
    const msg = choice?.message
    const calls = msg?.tool_calls || []

    if (!calls.length) {
      answer = msg?.content ?? ''
      steps.push({
        kind: 'answer',
        title: `Model answered${round > 1 ? ` after ${round - 1} tool round${round === 2 ? '' : 's'}` : ' without calling a tool'}`,
        detail: null,
        round,
      })
      break
    }

    // Anthropic-family models reject a tool_result whose tool_use block is not
    // in the history, so the assistant turn must be appended verbatim.
    messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: calls })

    if (msg?.content) {
      steps.push({ kind: 'think', title: 'Model reasoning', detail: String(msg.content).slice(0, 1200), round })
    }

    // Three phases so a round's calls EXECUTE in parallel while the AIRS scans
    // stay sequential. The executions are the slow, variable part (GitHub
    // search_code measured up to ~9.5s); the scans are not, and AIRS silently
    // skips DLP when scans arrive faster than ~1 per 2s — so firing them
    // concurrently would trade a few seconds for missed detections.
    // `reply` is what the model reads for that call; tool messages go back in
    // the order the model asked, which Anthropic-family models expect.
    const jobs = calls.map((call) => {
      toolCalls++
      const { serverId, tool } = unNs(call.function?.name)
      const server = byId[serverId]
      let args = {}
      try { args = JSON.parse(call.function?.arguments || '{}') } catch { /* keep {} */ }

      const step = {
        kind: 'tool',
        title: `${server?.label ?? serverId} · ${tool}`,
        server: serverId,
        brokered: server?.brokered ?? null,
        tool,
        args,
        round,
        inputScan: null,
        outputScan: null,
        result: null,
        error: null,
        blocked: false,
        latencyMs: null,
        timing: {},
      }
      steps.push(step)
      const job = { call, server, tool, args, step, rpcId: 100 + toolCalls, reply: null, text: '' }
      if (!server) {
        step.error = `Unknown tool namespace "${call.function?.name}"`
        job.reply = step.error
      }
      return job
    })

    // Stage 1 — parameters, before anything runs.
    if (scanTool) {
      for (const job of jobs.filter((j) => !j.reply)) {
        const { server, tool, args, step } = job
        const p0 = performance.now()
        try {
          const s1 = await scanTool({ serverName: server.id, method: 'tools/call', toolName: tool, toolInput: args })
          step.timing.paramsScan = { start: p0, end: performance.now(), http: s1?._http ?? [] }
          step.inputScan = { action: s1.data?.action, category: s1.data?.category, scanId: s1.data?.scan_id }
          if (s1.data?.action === 'block') {
            step.blocked = true
            step.error = `Blocked by Prisma AIRS before execution (${s1.data.category})`
            job.reply = `Prisma AIRS blocked this tool call: ${s1.data.category}. Do not retry it.`
          }
        } catch (e) { step.inputScan = { error: String(e?.message || e).slice(0, 160) } }
      }
    }

    // Execute — concurrently.
    await Promise.all(jobs.filter((j) => !j.reply).map(async (job) => {
      const { server, tool, args, step } = job
      const tc0 = performance.now()
      let http = []
      try {
        const cap = await captureHttp(() => rpc(server, 'tools/call', { name: tool, arguments: args }, job.rpcId))
        http = cap.http
        const r = cap.value
        job.text = (r?.content || []).map((c) => c.text ?? JSON.stringify(c)).join('\n')
        if (r?.isError) step.error = 'The MCP server reported a tool error.'
      } catch (e) {
        step.error = String(e?.message || e).slice(0, 300)
        job.reply = `Tool error: ${step.error}`
      }
      const tc1 = performance.now()
      step.latencyMs = Math.round(tc1 - tc0)
      step.timing.exec = { start: tc0, end: tc1, http, resultChars: job.text.length }
    }))

    // Stage 2 — the result, before the model reads it. This is the important
    // one: a tool result is untrusted remote content.
    for (const job of jobs.filter((j) => !j.reply)) {
      const { server, tool, args, step, text } = job
      if (scanTool) {
        const q0 = performance.now()
        try {
          const s2 = await scanTool({ serverName: server.id, method: 'tools/call', toolName: tool, toolInput: args, toolOutput: text.slice(0, 20000) })
          step.timing.resultScan = { start: q0, end: performance.now(), http: s2?._http ?? [], scannedChars: Math.min(text.length, 20000) }
          step.outputScan = { action: s2.data?.action, category: s2.data?.category, scanId: s2.data?.scan_id }
          if (s2.data?.action === 'block') {
            step.blocked = true
            step.result = null
            step.error = `Result withheld — Prisma AIRS blocked it (${s2.data.category})`
            job.reply = `Prisma AIRS blocked this tool's result before you could read it (${s2.data.category}). Tell the user the result was withheld.`
            continue
          }
        } catch (e) { step.outputScan = { error: String(e?.message || e).slice(0, 160) } }
      }
      const trimmed = text.length > MAX_TOOL_RESULT_CHARS
        ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n…[truncated ${text.length - MAX_TOOL_RESULT_CHARS} chars]`
        : text
      step.result = trimmed
      job.reply = trimmed || '(empty result)'
    }

    for (const job of jobs) messages.push({ role: 'tool', tool_call_id: job.call.id, content: job.reply })

    if (round === MAX_ROUNDS) {
      steps.push({ kind: 'error', title: 'Step limit reached', detail: `Stopped after ${MAX_ROUNDS} tool rounds without a final answer.` })
    }
  }

  return {
    answer: blocked ? '' : answer,
    steps,
    blocked,
    blockReason,
    hookResults: lastHooks,
    servers: liveServers.map((s) => s.id),
    rounds,
    toolCalls,
    turns,
    latencyMs: Date.now() - t0,
  }
}

/** Registry for the UI, with no network calls. */
export function describeServers() {
  return MCP_SERVERS.map((s) => ({
    id: s.id,
    label: s.label,
    short: s.short,
    blurb: s.blurb,
    accent: s.accent,
    brokered: s.brokered,
    host: new URL(s.url).host,
    toolCount: s.allow.length,
    readOnly: s.id === 'github' ? true : undefined,
  }))
}
