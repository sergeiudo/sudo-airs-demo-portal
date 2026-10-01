import { Activity, Fingerprint, Network, Terminal } from 'lucide-react'
import { pick } from './links'

/**
 * Prisma AIRS AI Gateway — the developer docs at docs.gw.prismaairs.com, read
 * end to end on 2026-10-01 and folded into guides: the Universal API, routing
 * and reliability, the guardrail framework, observability, the MCP and Agent
 * gateways, coding agents, and the governance / admin side.
 *
 * Facts come from those pages unless a callout says "observed": those were
 * seen against the live SCM AI Gateway from this portal. Where the docs leave
 * something out or contradict themselves, the guide says so instead of
 * guessing — and doc examples with broken JSON are not copied.
 */

// ─── routing and reliability ─────────────────────────────────────────────────

const CFG_FALLBACK = `{
  "strategy": { "mode": "fallback", "on_status_codes": [429, 500, 502, 503, 504] },
  "targets": [
    { "override_params": { "model": "@bedrock-prod/us.anthropic.claude-sonnet-5" } },
    { "override_params": { "model": "@vertex-prod/gemini-3.5-flash" } }
  ]
}`

const CFG_LOADBALANCE = `{
  "strategy": {
    "mode": "loadbalance",
    "sticky": { "enabled": true, "hash_fields": ["metadata.user_id"], "ttl": 3600 }
  },
  "targets": [
    { "provider": "@openai-prod", "weight": 0.9 },
    { "provider": "@azure-prod",  "weight": 0.1 }
  ]
}`

const CFG_RETRY = `{
  "request_timeout": 10000,
  "retry": { "attempts": 3, "on_status_codes": [408, 429, 503], "use_retry_after_headers": true },
  "override_params": { "model": "@openai-prod/gpt-4o" }
}`

const CFG_BREAKER = `{
  "strategy": {
    "mode": "fallback",
    "cb_config": {
      "failure_threshold_percentage": 20,
      "minimum_requests": 10,
      "cooldown_interval": 60000,
      "failure_status_codes": [401, 429, 500]
    }
  },
  "targets": [
    { "override_params": { "model": "@bedrock-prod/us.anthropic.claude-sonnet-5" } },
    { "override_params": { "model": "@bedrock-prod/us.anthropic.claude-opus-4-8" } }
  ]
}`

const CFG_CONDITIONAL = `{
  "strategy": {
    "mode": "conditional",
    "conditions": [
      { "query": { "metadata.user_plan": { "$eq": "paid" } }, "then": "large" },
      { "query": { "$and": [
          { "metadata.env": { "$eq": "prod" } },
          { "params.temperature": { "$lte": 0.3 } }
        ] }, "then": "large" },
      { "query": { "url.pathname": { "$regex": "^/v1/embeddings" } }, "then": "embed" }
    ],
    "default": "small"
  },
  "targets": [
    { "name": "large", "override_params": { "model": "@openai-prod/gpt-4o" } },
    { "name": "small", "override_params": { "model": "@openai-prod/gpt-4o-mini" } },
    { "name": "embed", "provider": "@openai-prod" }
  ]
}`

const CFG_CACHE = `{
  "cache": { "mode": "simple", "max_age": 3600 },
  "override_params": { "model": "@openai-prod/gpt-4o-mini" }
}`

// ─── guardrails ──────────────────────────────────────────────────────────────

const HOOK_RESULTS = `{
  "hook_results": {
    "before_request_hooks": [
      {
        "id": "pg-airs-1a2b3c",
        "type": "guardrail",
        "verdict": false,          // true only if every check passed
        "deny": true,
        "async": false,
        "transformed": false,      // true when a check rewrote the request (e.g. PII redaction)
        "execution_time": 412,     // ms
        "checks": [
          {
            "id": "…",             // the check, e.g. default.regexMatch
            "verdict": false,
            "data": { … },         // check-specific detail
            "execution_time": 405,
            "error": null
          }
        ]
      }
    ],
    "after_request_hooks": []
  }
}`

const RAW_GUARDRAIL = `{
  "before_request_hooks": [{
    "type": "guardrail",
    "id": "my_solid_guardrail",
    "checks": [{ "id": "default.regexMatch", "parameters": { "rule": "test" } }],
    "deny": false,
    "async": false,
    "sequential": false,
    "on_success": { "feedback": { "value": 1, "weight": 1 } },
    "on_fail": { "feedback": { "value": -1, "weight": 1 } }
  }]
}`

const MODEL_RULES = `{
  "defaults": ["gpt-4.1-mini"],
  "metadata": {
    "customer_tier": { "enterprise": ["*"], "free": ["gpt-4.1-mini"] },
    "team": { "research": ["claude-3-7-sonnet", "gpt-4.1"] }
  }
}`

const REQ_PARAMS = `{
  "tools": {
    "allowedTypes": ["function"],
    "blockedFunctionNames": ["executeShell"]
  },
  "params": {
    "blockedKeys": ["logit_bias"],
    "values": {
      "model":  { "allowedValues": ["gpt-4o", "gpt-4o-mini"] },
      "stream": { "blockedValues": [true] }
    }
  }
}`

const WEBHOOK_IO = `// What the gateway POSTs to your webhook
{
  "request":  { "json": { … }, "text": "last message", "isStreamingRequest": false, "isTransformed": false },
  "response": { "json": null, "text": "", "statusCode": null, "isTransformed": false },
  "provider": "openai",
  "requestType": "chatComplete",          // chatComplete | complete | embed
  "metadata": { "_user": "u-123" },       // x-portkey-metadata + key / workspace defaults
  "eventType": "beforeRequestHook"        // or afterRequestHook
}

// What it must answer — verdict is required; transformedData replaces the whole body
{
  "verdict": true,
  "transformedData": { "request": { "json": { … } } }
}`

const WEBHOOK_NODE = `import express from 'express'

const app = express()
app.use(express.json({ limit: '2mb' }))

// A custom check: block prompts that name an internal project, on input only.
app.post('/guardrail', (req, res) => {
  const { eventType, request } = req.body
  if (eventType !== 'beforeRequestHook') return res.json({ verdict: true })
  const hit = /project\\s+(atlas|orion)/i.test(request?.text ?? '')
  res.json({ verdict: !hit })
})

// Answer fast: the default timeout is 3 s, and a timeout counts as a PASS
// unless the check is created with failOnError.
app.listen(8080)`

// ─── observability ───────────────────────────────────────────────────────────

const TRACE_TABS = [
  { id: 'curl', lang: 'curl', code: `curl https://aigw.portkey.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $PORTKEY_API_KEY" \\
  -H "x-portkey-trace-id: 4bf92f3577b34da6a3ce929d0e0e4736" \\
  -H "x-portkey-span-id: 00f067aa0ba902b7" \\
  -H "x-portkey-span-name: answer_question" \\
  -H 'x-portkey-metadata: {"_user":"u-123","feature":"support-bot","env":"prod"}' \\
  -d '{
    "model": "@openai-prod/gpt-4o",
    "messages": [{ "role": "user", "content": "Where is my order?" }]
  }'` },
  { id: 'python', lang: 'python', file: 'traced.py', code: `import json
from openai import OpenAI

client = OpenAI(api_key="YOUR_GATEWAY_API_KEY", base_url="https://aigw.portkey.ai/v1")

resp = client.chat.completions.with_raw_response.create(
    model="@openai-prod/gpt-4o",
    messages=[{"role": "user", "content": "Where is my order?"}],
    extra_headers={
        "x-portkey-trace-id": "4bf92f3577b34da6a3ce929d0e0e4736",
        "x-portkey-span-id": "00f067aa0ba902b7",
        "x-portkey-span-name": "answer_question",
        "x-portkey-metadata": json.dumps({"_user": "u-123", "feature": "support-bot"}),
    },
)
print(resp.headers.get("x-portkey-trace-id"))   # the id to quote in AIRS and in feedback
print(resp.parse().choices[0].message.content)` },
  { id: 'node', lang: 'node', file: 'traced.mjs', code: `import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.PORTKEY_API_KEY, baseURL: 'https://aigw.portkey.ai/v1' })

const { data, response } = await client.chat.completions.create(
  {
    model: '@openai-prod/gpt-4o',
    messages: [{ role: 'user', content: 'Where is my order?' }],
  },
  {
    headers: {
      'x-portkey-trace-id': '4bf92f3577b34da6a3ce929d0e0e4736',
      'x-portkey-span-id': '00f067aa0ba902b7',
      'x-portkey-span-name': 'answer_question',
      'x-portkey-metadata': JSON.stringify({ _user: 'u-123', feature: 'support-bot' }),
    },
  },
).withResponse()

console.log(response.headers.get('x-portkey-trace-id'))
console.log(data.choices[0].message.content)` },
]

const FEEDBACK_CURL = `curl https://aigw.portkey.ai/v1/feedback \\
  -H "Authorization: Bearer $PORTKEY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
    "value": -1,
    "weight": 1,
    "metadata": { "_user": "u-123", "reason": "answer cited the wrong order" }
  }'`

const OTEL_ENV = `# Send your app's own OpenTelemetry traces and logs to the gateway
OTEL_EXPORTER_OTLP_ENDPOINT="https://aigw.portkey.ai/v1/otel"
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer YOUR_GATEWAY_API_KEY"

# or per signal
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="https://aigw.portkey.ai/v1/otel/v1/traces"
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT="https://aigw.portkey.ai/v1/otel/v1/logs"`

const LOG_EXPORT = `# Needs a key with the logs.export scope. Asynchronous: create → start → poll → download.
GW=https://aigw.portkey.ai/v1
ID=$(curl -s $GW/logs/exports -H "Authorization: Bearer $PORTKEY_API_KEY" -H "Content-Type: application/json" -d '{
  "filters": { "created_at": { "gte": "2026-09-01T00:00:00Z", "lte": "2026-09-30T23:59:59Z" } },
  "requested_data": ["id", "trace_id", "created_at", "ai_model", "cost", "response_time", "metadata"]
}' | jq -r .id)

curl -s -X POST $GW/logs/exports/$ID/start -H "Authorization: Bearer $PORTKEY_API_KEY"
until curl -s $GW/logs/exports/$ID -H "Authorization: Bearer $PORTKEY_API_KEY" | jq -e '.status | test("success|failure")' >/dev/null; do sleep 5; done
curl -s $GW/logs/exports/$ID/download -H "Authorization: Bearer $PORTKEY_API_KEY"   # → a signed URL to a JSONL file`

// ─── Universal API ───────────────────────────────────────────────────────────

const ASK = 'Summarise our refund policy in one line.'

const UNIVERSAL_TABS = [
  { id: 'curl', label: 'Chat Completions', lang: 'curl', code: `curl https://aigw.portkey.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $PORTKEY_API_KEY" \\
  -d '{
    "model": "@bedrock-prod/us.anthropic.claude-sonnet-5",
    "max_tokens": 300,
    "messages": [{ "role": "user", "content": "${ASK}" }]
  }'` },
  { id: 'messages', label: 'Messages', lang: 'curl', code: `# Anthropic's format — native for Claude on Anthropic and Bedrock, translated for the rest
curl https://aigw.portkey.ai/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $PORTKEY_API_KEY" \\
  -d '{
    "model": "@bedrock-prod/us.anthropic.claude-sonnet-5",
    "max_tokens": 300,
    "messages": [{ "role": "user", "content": "${ASK}" }]
  }'` },
  { id: 'responses', label: 'Responses', lang: 'curl', code: `# OpenAI's Responses format — translated to Chat Completions for Gemini, Claude, Bedrock…
curl https://aigw.portkey.ai/v1/responses \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $PORTKEY_API_KEY" \\
  -d '{
    "model": "@vertex-prod/gemini-3.5-flash",
    "instructions": "Answer in one line.",
    "input": "Summarise our refund policy."
  }'` },
  { id: 'python', label: 'Anthropic SDK', lang: 'python', file: 'messages.py', code: `import anthropic

# The Anthropic SDK appends /v1/messages itself — no /v1 in the base URL.
client = anthropic.Anthropic(
    api_key="unused",  # the gateway authenticates on the Authorization header
    base_url="https://aigw.portkey.ai",
    default_headers={"Authorization": "Bearer YOUR_GATEWAY_API_KEY"},
)

msg = client.messages.create(
    model="@bedrock-prod/us.anthropic.claude-sonnet-5",
    max_tokens=300,
    messages=[{"role": "user", "content": "${ASK}"}],
)
# Join every text block: with thinking on, block 0 is the reasoning, not the answer.
print("".join(b.text for b in msg.content if b.type == "text"))` },
  { id: 'node', label: 'OpenAI SDK · Responses', lang: 'node', file: 'responses.mjs', code: `import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.PORTKEY_API_KEY, baseURL: 'https://aigw.portkey.ai/v1' })

const r = await client.responses.create({
  model: '@vertex-prod/gemini-3.5-flash',
  instructions: 'Answer in one line.',
  input: 'Summarise our refund policy.',
})
console.log(r.output_text)` },
]

const DECISIONS_TABS = [
  { id: 'curl', lang: 'curl', code: `curl https://aigw.portkey.ai/v1/decisions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $PORTKEY_API_KEY" \\
  -H "x-portkey-provider: @typesafe" \\
  -d '{
    "model": "jev-latest",
    "state": "Help! My payouts have been failing for 3 days.",
    "questions": {
      "department": {
        "type": "choice",
        "instructions": "Which team should handle this?",
        "criteria": { "billing": "Payments", "technical": "Bugs" }
      }
    }
  }'` },
  { id: 'json', label: 'Response', lang: 'json', code: `{
  "model": "jev-1.13.0",
  "answers": {
    "department": {
      "type": "choice",
      "choice": "billing",
      "probabilities": { "billing": 0.88, "technical": 0.12 },
      "confidence": 0.81
    }
  },
  "usage": { "input_tokens": 296, "output_tokens": 20 },
  "provider": "typesafe"
}` },
]

// ─── agents ──────────────────────────────────────────────────────────────────

const FRAMEWORK_TABS = [
  { id: 'python', label: 'OpenAI Agents SDK', lang: 'python', file: 'agent.py', code: `import os
from openai import AsyncOpenAI
from agents import Agent, Runner, set_default_openai_api, set_default_openai_client

gateway = AsyncOpenAI(base_url="https://aigw.portkey.ai/v1", api_key=os.environ["PORTKEY_API_KEY"])
set_default_openai_client(gateway, use_for_tracing=False)  # keep SDK tracing off the gateway key
set_default_openai_api("chat_completions")                 # the SDK defaults to the Responses API

agent = Agent(name="Assistant", instructions="Be brief.", model="@bedrock-prod/us.anthropic.claude-sonnet-5")
print(Runner.run_sync(agent, "What does an AI gateway do?").final_output)` },
  { id: 'langgraph', label: 'LangChain / LangGraph', lang: 'python', file: 'graph.py', code: `from langchain_openai import ChatOpenAI

# One client for every provider; LangGraph nodes call it unchanged.
llm = ChatOpenAI(
    model="@vertex-prod/gemini-3.5-flash",
    base_url="https://aigw.portkey.ai/v1",
    api_key="YOUR_GATEWAY_API_KEY",
    default_headers={"x-portkey-trace-id": "chat-session-123"},
)

def chatbot(state):
    return {"messages": [llm.invoke(state["messages"])]}` },
  { id: 'strands', label: 'Strands Agents', lang: 'python', file: 'strands_agent.py', code: `from strands import Agent
from strands.models.openai import OpenAIModel

model = OpenAIModel(
    client_args={"api_key": "YOUR_GATEWAY_API_KEY", "base_url": "https://aigw.portkey.ai/v1"},
    model_id="@bedrock-prod/us.anthropic.claude-sonnet-5",
)
agent = Agent(model=model)
agent("What does an AI gateway do?")` },
  { id: 'typescript', label: 'Vercel AI SDK', lang: 'typescript', file: 'route.ts', code: `import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

const gateway = createOpenAI({ baseURL: 'https://aigw.portkey.ai/v1', apiKey: process.env.PORTKEY_API_KEY })

// .chat() = Chat Completions, which every provider behind the gateway accepts
const { text } = await generateText({
  model: gateway.chat('@bedrock-prod/us.anthropic.claude-sonnet-5'),
  prompt: 'What does an AI gateway do?',
})` },
  { id: 'bash', label: 'Any OpenAI app', lang: 'bash', code: `# Two settings in any app that lets you set an OpenAI base URL and key
export OPENAI_BASE_URL="https://aigw.portkey.ai/v1"
export OPENAI_API_KEY="$PORTKEY_API_KEY"   # the gateway key, never a provider key

# Model: "@openai-prod/gpt-4o". If the app only accepts plain names like "gpt-4o",
# attach a config with override_params.model to the key — the name sent is then ignored.` },
]

const A2A_CURL = `# The agent card, through the gateway
curl -X POST 'https://aigw.portkey.ai/agent/{agent-slug}/.well-known/agent.json' \\
  -H 'Content-Type: application/json' \\
  -H "Authorization: Bearer $PORTKEY_API_KEY"

# A task (JSON-RPC), through the gateway
curl 'https://aigw.portkey.ai/agent/{agent-slug}' \\
  -H 'Content-Type: application/json' \\
  -H "Authorization: Bearer $PORTKEY_API_KEY" \\
  -d '{
    "jsonrpc": "2.0", "id": "req-1", "method": "tasks/send",
    "params": { "id": "task-1", "message": { "role": "user", "parts": [{ "type": "text", "text": "Hello" }] } }
  }'`

// ─── coding agents ───────────────────────────────────────────────────────────

const claudeSettings = (slug, opus, sonnet, haiku, extra = '') => `{
  "env": {
    "ANTHROPIC_BASE_URL": "https://aigw.portkey.ai",
    "ANTHROPIC_AUTH_TOKEN": "YOUR_GATEWAY_API_KEY",
    "ANTHROPIC_CUSTOM_HEADERS": "Authorization: Bearer YOUR_GATEWAY_API_KEY\\nx-portkey-provider: ${slug}${extra}",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "${opus}",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "${sonnet}",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "${haiku}"
  },
  "model": "${sonnet}"
}`

const CLAUDE_CODE_TABS = [
  { id: 'bedrock', label: 'Via Bedrock', lang: 'json', file: '~/.claude/settings.json',
    code: claudeSettings('@bedrock-prod', 'us.anthropic.claude-opus-5', 'us.anthropic.claude-sonnet-5', 'us.anthropic.claude-haiku-4-5-20251001-v1:0', '\\nx-portkey-trace-id: claude-code') },
  { id: 'vertex', label: 'Via Vertex AI', lang: 'json', file: '~/.claude/settings.json',
    code: claudeSettings('@vertex-prod', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5') },
  { id: 'anthropic', label: 'Via Anthropic', lang: 'json', file: '~/.claude/settings.json',
    code: claudeSettings('@anthropic-prod', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5') },
  { id: 'bash', label: 'MCP servers', lang: 'bash', code: `# A gateway-brokered MCP server — API-key auth
claude mcp add --transport http github https://aigw.portkey.ai/m/github/mcp \\
  --header "Authorization: Bearer $PORTKEY_API_KEY"

# Or OAuth: no header — sign in from /mcp inside Claude Code on first use
claude mcp add --transport http github https://aigw.portkey.ai/m/github/mcp` },
]

const CODEX_TOML = `# ~/.codex/config.toml — or .codex/config.toml in a repository
model_provider = "airs-gw"
model = "@openai-prod/gpt-4o"            # always @slug/model

[model_providers.airs-gw]
name = "Prisma AIRS AI Gateway"
base_url = "https://aigw.portkey.ai/v1"
env_key = "PORTKEY_API_KEY"              # export PORTKEY_API_KEY=<gateway key>
# wire_api = "responses"                 # default "chat"`

export const AIGW_GATEWAY = [
  {
    id: 'gw-routing',
    group: 'gateway',
    title: 'Fallbacks, retries, load balancing and caching',
    sub: 'Reliability in a saved config — the app keeps calling one model',
    minutes: 8,
    level: 'Build',
    docs: pick('agConfigs', 'agFallbacks', 'agRetries', 'agLoadBalance', 'agConditional', 'agCircuit', 'agCache', 'agTimeouts', 'agCanary', 'agDefaultCfg', 'agSavedOnly'),
    blocks: [
      {
        type: 'prose',
        text: [
          'A **config** is a saved JSON object with a `pc-…` id that tells the gateway how to serve a request: which targets to try and in what order or proportion, how often to retry, how long to wait, what to cache and which guardrails to run. The app does not change — it keeps sending one model name, and the config decides what actually answers.',
          'Configs are created in Strata Cloud Manager (**AI Gateway → Configs → Create**). A request picks one up from its API key or from a header — and a request-level config **replaces** the key\'s default for that request; the two are never merged.',
        ],
      },
      {
        type: 'table',
        title: 'How a request picks up a config',
        columns: ['Where', 'How', 'Notes'],
        rows: [
          ['The API key\'s default', 'Security Keys → the key → **Config**', 'Applies with no header at all — policy rides on the key. One config per key.'],
          ['Per request', '`x-portkey-config: pc-…`', 'Replaces the key default. With **Allow Config Override** off on the key, the gateway answers **400**.'],
          ['A JWT', 'the `defaults.config_id` claim', 'Sealed inside the signed token — see "Identity-based routing with JWT".'],
          ['Workspace default for user keys', '`defaults.user_api_key_config` on the workspace', 'Inherited by auto-created user keys. A config cannot be deleted while it is a workspace default.'],
          ['Inline JSON', 'the config itself in `x-portkey-config`', 'Rejected with 400 `inline_config_blocked` when **Block Inline Configs** is on — the default for organisations created on or after 19 June 2026.'],
        ],
      },
      {
        type: 'table',
        title: 'The building blocks',
        columns: ['Block', 'Key', 'Defaults and limits'],
        minWidth: 640,
        rows: [
          ['Fallback', '`strategy.mode: "fallback"`', 'Next target on **any non-2xx**; narrow it with `strategy.on_status_codes`.'],
          ['Load balance', '`strategy.mode: "loadbalance"`, `weight` per target', 'Weights are relative and normalised (unset = 1; 0 parks a target without removing it). Optional sticky sessions: `strategy.sticky` with `hash_fields` and `ttl` (seconds, default 3600).'],
          ['Conditional', '`strategy.mode: "conditional"`', '`conditions` and `default` are required; the first matching condition wins.'],
          ['Retry', '`retry.attempts`, `retry.on_status_codes`', 'Up to **5**. Default codes `429, 500, 502, 503, 504, 529` — setting your own replaces them. Backoff 1, 2, 4, 8, 16 s, or the provider\'s `retry-after` with `use_retry_after_headers`. Total wait is capped at **60 s**.'],
          ['Circuit breaker', '`strategy.cb_config`', '`failure_threshold` or `failure_threshold_percentage` (+ `minimum_requests`), `failure_status_codes`, `cooldown_interval` in **ms** (minimum 30 s). Open targets are skipped; if every target is open, all are used.'],
          ['Timeout', '`request_timeout` (ms) or `x-portkey-request-timeout`', 'Returns **408**, per attempt. A stream that has delivered its first chunk is not timed out.'],
          ['Cache', '`cache.mode` (`simple` or `semantic`), `max_age` (s)','Minimum 60 s, default 7 days, maximum 90 days; an organisation-level TTL caps it.'],
          ['Request shaping', '`default_params` → `override_params` → `drop_params`', 'Fill a missing field, force a field, or delete one (dot paths, `[n]` and `[*]`). Applied in that order; inherited by nested targets.'],
        ],
      },
      {
        type: 'code',
        title: 'The shapes you will use most',
        text: 'Any strategy can nest inside any other: a target can itself be a fallback chain, a load balancer or a conditional router. `@slug/model` in `override_params.model` picks the provider, so a target does not need its own `provider`.',
        tabs: [
          { id: 'fallback', label: 'Fallback across clouds', lang: 'json', code: CFG_FALLBACK },
          { id: 'loadbalance', label: 'Weighted + sticky', lang: 'json', code: CFG_LOADBALANCE },
          { id: 'retry', label: 'Retry + timeout', lang: 'json', code: CFG_RETRY },
          { id: 'breaker', label: 'Circuit breaker', lang: 'json', code: CFG_BREAKER },
          { id: 'cache', label: 'Cache', lang: 'json', code: CFG_CACHE },
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Status codes chain together',
        text: [
          'Three things produce a status the other blocks can act on: a **timeout** gives `408`, a failed sync guardrail gives `246` (allowed) or `446` (denied), and the provider gives its own. So `"on_status_codes": [408]` on a fallback means "fall back only on timeout", and `[246, 446]` means "try the next model when the guardrail fails".',
          '`408` is **not** in the default retry list — add it explicitly. The three keys are spelled differently: `strategy.on_status_codes` (fallback), `retry.on_status_codes` (retry), `strategy.cb_config.failure_status_codes` (circuit breaker).',
        ],
      },
      {
        type: 'code',
        title: 'Conditional routing',
        text: 'Route on `metadata.<key>` (from `x-portkey-metadata` or the key/JWT defaults), `params.<key>` (any top-level body field with a primitive value) or `url.pathname`. Operators: `$eq` `$ne` `$in` `$nin` `$regex` `$gt` `$gte` `$lt` `$lte`, combined with `$and` / `$or`.',
        tabs: [{ id: 'json', lang: 'json', file: 'pc-conditional', code: CFG_CONDITIONAL }],
      },
      {
        type: 'table',
        title: 'Conditional routing — the rules that bite',
        columns: ['Rule', 'What it means'],
        rows: [
          ['Two-segment paths only', '`metadata.tier` works; `metadata.features.beta` does not.'],
          ['Primitive values only', 'Metadata values are strings; `params.*` can be string, number or boolean — not arrays or objects.'],
          ['Missing key = false', 'A condition on a key the caller did not send is simply false — no error, the next condition is tried.'],
          ['`$regex`', 'A JavaScript regex with no flags — case-sensitive; an invalid pattern evaluates to false.'],
          ['Order matters', 'Conditions are evaluated top to bottom; put specific ones first and make `default` the most restricted target.'],
          ['No circuit breaker', '`cb_config` is not evaluated for conditional strategies.'],
        ],
      },
      {
        type: 'table',
        title: 'Caching',
        columns: ['', 'Simple', 'Semantic'],
        rows: [
          ['Matches', 'The exact body, metadata and cache namespace', 'User text above a similarity threshold (default 0.95) **and** identical model and parameters'],
          ['Endpoints', 'All, including image generation', '`/chat/completions` and `/completions` only'],
          ['Limits', '—', 'Under 8,191 tokens and at most 4 messages; the system prompt is ignored'],
          ['Force a fresh answer', '`x-portkey-cache-force-refresh: true` on the request (needs a cache config)', 'Same — refreshes every matching entry'],
          ['Partition', '`x-portkey-cache-namespace: <string>` instead of all headers', 'Same'],
        ],
        note: 'The docs describe semantic-cache setup (a vector database and an embedding provider) only for self-hosted gateways and do not say whether the SaaS gateway offers it. `x-portkey-debug: false` disables caching for that request.',
      },
      {
        type: 'callout', tone: 'observed', title: 'Which target answered — and three pitfalls',
        text: [
          'The docs name no "which target served" header, but the SCM AI Gateway returns `x-portkey-last-used-option-index` (e.g. `config.targets[2]`) together with `x-portkey-provider`, `x-portkey-cache-status` and `x-portkey-retry-attempt-count` — Enterprise AI Access reads the first, the Ministry of Health pillar the cache status.',
          'A `targets` / `strategy` provider pin overrides the `@slug/` in the model name; remove the pair **together** (an empty fallback chain fails every request); and configs are versioned in the console, so a bad edit is one rollback away.',
        ],
      },
      {
        type: 'callout', tone: 'warn', title: 'Copying examples from the docs',
        text: 'Two examples on the official pages are not valid JSON as published: the canary-testing config is missing a closing brace, and the nested request-timeout example has a misplaced quote and trailing commas. The shapes on this page are corrected. The docs also do not state whether retries run inside each fallback target or around the whole chain.',
      },
    ],
  },

  {
    id: 'gw-guardrails',
    group: 'gateway',
    title: 'Guardrail actions, verdicts and PII redaction',
    sub: 'How any gateway guardrail runs, blocks and reports — beyond AIRS',
    minutes: 8,
    level: 'Build',
    docs: pick('agGuardrails', 'agGuardCaps', 'agGuardList', 'agGuardRaw', 'agPii', 'agByo', 'agOrgGuard', 'agWsGuard', 'agGuardHdrs', 'agModelRules', 'agReqParams'),
    blocks: [
      {
        type: 'prose',
        text: [
          'A gateway guardrail is a set of **checks** (each returns pass or fail) plus **actions** (what happens on a fail). The Prisma AIRS guardrail is one partner check; the same framework runs deterministic checks (regex, JSON schema, model and parameter rules), LLM-based checks (PII, moderation, gibberish) and your own webhook — attached the same way, as `input_guardrails` / `output_guardrails` in a config.',
          'Input guardrails see the request before the model is called; output guardrails see the response before the caller does. By default **only the last message** is evaluated — the AIRS guardrail\'s scan scope is the documented way to widen that.',
        ],
      },
      {
        type: 'table',
        title: 'Actions',
        columns: ['Action', 'Raw JSON key', 'Default', 'Effect'],
        rows: [
          ['Async', '`async`', '`true`', 'Runs alongside the model call; adds no latency; results go to the logs only. Set `false` to run before forwarding (input) or before returning (output) — the only mode that can block or modify.'],
          ['Deny', '`deny`', '`false`', 'On a fail: `true` kills the request (**446**); `false` lets it through and marks it (**246**).'],
          ['Sequential', '`sequential`', '`false`', 'Run the checks one after another instead of in parallel.'],
          ['Feedback', '`on_success` / `on_fail`', '—', '`{ "feedback": { "value", "weight" } }` appended to the request\'s feedback — builds an evaluation dataset.'],
        ],
      },
      {
        type: 'table',
        title: 'What comes back (sync guardrails)',
        columns: ['Verdict', '`deny`', 'HTTP status', 'Body'],
        rows: [
          ['Pass', 'either', '200', 'Normal response + `hook_results`'],
          ['Fail', '`false`', '**246**', 'Normal response + `hook_results` with `verdict: false`'],
          ['Fail', '`true`', '**446**', '`error.type: "hooks_failed"` + `hook_results`; the model was not called (input) or the answer withheld (output)'],
          ['Any (async)', 'either', 'the provider\'s', 'No `hook_results` in the response — logs only'],
        ],
        note: 'Streaming: input guardrails run before the stream (a deny returns 446 before any token); output guardrails run on the assembled answer after `[DONE]` and arrive as an extra `hook_results` chunk — informational only, no fallback or retry. Both need `x-portkey-strict-open-ai-compliance: false`.',
      },
      {
        type: 'callout', tone: 'observed', title: 'This portal\'s SCM tenant blocks with HTTP 200',
        text: 'A denied request on the SCM AI Gateway used here came back as **HTTP 200** with the content replaced by "The guardrail checks defined in the config failed…" — the shape the docs describe only as a "soft deny" on `/v1/decisions`. Do not branch on the status code alone: read `hook_results.*_hooks[].verdict`, and treat 200-with-a-false-verdict, 246 and 446 as the three outcomes.',
      },
      { type: 'code', title: 'Reading `hook_results`', text: 'Trimmed to the documented fields. `verdict` on the guardrail is true only if every check passed; a check can also carry an `error`.', tabs: [{ id: 'json', lang: 'json', code: HOOK_RESULTS }] },
      {
        type: 'table',
        title: 'Where guardrails run',
        columns: ['Coverage', 'Endpoints'],
        rows: [
          ['Input and output', '`/v1/chat/completions`, `/v1/completions`, `/v1/messages`, `POST /v1/responses`, `/v1/prompts/{id}/completions`'],
          ['Input only', '`/v1/embeddings`; `/v1/decisions` (the `state` field only)'],
          ['Not covered', 'audio, images, files, fine-tuning, moderations, models, assistants and threads, `GET /v1/responses/*`'],
          ['Batches', 'Applied asynchronously to the input and output files — only through a config in `portkey_options` (gateway 2.9.0+)'],
        ],
        note: 'Text only: images are not evaluated, the text parts of a multimodal message are. Tool-call JSON is evaluated as text — the model\'s tool call by output guardrails, the tool result on the follow-up request by input guardrails.',
      },
      {
        type: 'table',
        title: 'The check catalogue',
        columns: ['Tier', 'Checks'],
        minWidth: 600,
        rows: [
          ['BASIC — deterministic', 'Regex match / replace, sentence, word and character count, JSON schema, JSON keys, contains, valid URLs, contains code, uppercase / lowercase, ends with, not null · **Model Rules**, model whitelist, allowed request types, **Request Parameters Check**, required metadata keys and values, JWT token validator · inline image URLs · webhook, log'],
          ['PRO — LLM-based', 'Detect PII (with redaction), moderate content, check language, detect gibberish'],
          ['PARTNER', '**Palo Alto Networks Prisma AIRS**, Acuvity, Akto, Aporia, AWS Bedrock Guardrails, Azure, CrowdStrike AIDR, F5, Javelin, Lasso, Mistral, Pangea, Patronus, Pillar, Prompt Security, Qualifire, Walled AI, Zscaler'],
        ],
        note: 'Developer plans get BASIC; Production adds PRO and PARTNER; Enterprise adds custom guardrails.',
      },
      {
        type: 'prose',
        title: 'PII redaction',
        text: [
          'A guardrail with **Redact PII** on rewrites the request before it is forwarded, so the model never sees the value: `"reach me at {{EMAIL_ADDRESS_1}} or {{PHONE_NUMBER_1}}"`. Each instance is numbered; redaction is irreversible and `transformed: true` marks it in `hook_results`. Redaction comes from the PRO PII check, AWS Bedrock Guardrails, Pangea, Patronus and Azure — or from a **Regex Replace** check with your own pattern and replacement text (`[SSN_REDACTED]`).',
          'The Prisma AIRS guardrail **blocks, it does not redact** — pair it with a redacting check if the requirement is "mask and continue".',
        ],
      },
      {
        type: 'code',
        title: 'Guardrails as JSON',
        text: 'A hook that carries its own `checks` runs as-is — nothing is created or looked up, and `id` is only a label. Inline configs are rejected when Block Inline Configs is on; save the guardrail and reference its `pg-…` id instead.',
        tabs: [
          { id: 'raw', label: 'Raw guardrail', lang: 'json', code: RAW_GUARDRAIL },
          { id: 'rules', label: 'Model Rules', lang: 'json', code: MODEL_RULES },
          { id: 'params', label: 'Request Parameters Check', lang: 'json', code: REQ_PARAMS },
        ],
      },
      {
        type: 'code',
        title: 'Bring your own guardrail — a webhook',
        text: 'A `default.webhook` check POSTs the request (input) or the response (output) to your URL. `transformedData` fully replaces the body, so send every field. Client headers reach the webhook only if listed in the check\'s `forwardHeaders` (credentials, cookies and most `x-portkey-*` are refused).',
        tabs: [
          { id: 'json', label: 'Payload and answer', lang: 'json', code: WEBHOOK_IO },
          { id: 'node', lang: 'node', file: 'guardrail-webhook.mjs', code: WEBHOOK_NODE },
        ],
      },
      {
        type: 'table',
        title: 'Enforce guardrails centrally',
        columns: ['Level', 'Where', 'Notes'],
        rows: [
          ['Organisation', 'Admin Settings → **Organisation Guardrails**', 'Input and/or output guardrails on every request in the organisation. Workspace exclusions are API-only: `PUT …/ai_gw/admin/v2/workspace-exclusions/input-guardrails`.'],
          ['Workspace', 'The workspace → Edit', 'One input and one output guardrail, enforced on every request in the workspace.'],
          ['API key', 'The key\'s default config, with **Allow Config Override** off', 'The caller cannot swap the config away (400).'],
          ['Tenant', '**Block Inline Configs**', 'No request can bring its own raw guardrails or providers.'],
        ],
        note: 'The docs do not say in what order organisation, workspace and config guardrails run, or how their verdicts combine.',
      },
    ],
  },

  {
    id: 'gw-observability',
    group: 'gateway',
    title: 'Logs, traces, metadata and OpenTelemetry',
    sub: 'Every request logged — and tied to its AIRS verdict by one id',
    minutes: 7,
    level: 'Build',
    docs: pick('agLogs', 'agTraces', 'agMetadata', 'agFeedback', 'agAnalytics', 'agLogsExport', 'agOtel', 'agOtelExport', 'agReqLogging', 'agEnforceMeta', 'agCost'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Every request through the gateway lands in **Observability → Logs** in Strata Cloud Manager: model, provider, tokens (thinking tokens included), cost, latency, the raw request and response, the config used and — if a guardrail ran — its verdict. A status column shows what the config did: `Cache Hit` / `Semantic Hit` / `Miss`, `Retry Success on 2 Tries`, `Fallback Active`, `Loadbalancer Active`.',
          'Three headers make those logs useful: a **trace id** to group a session, **spans** to show its shape, and **metadata** to slice it by user, feature or environment.',
        ],
      },
      {
        type: 'table',
        title: 'Headers that shape what is logged',
        columns: ['Header', 'Use'],
        rows: [
          ['`x-portkey-trace-id`', 'Groups requests into one trace. Generated if you do not send one, and returned as a response header.'],
          ['`x-portkey-span-id` · `x-portkey-parent-span-id` · `x-portkey-span-name`', 'Build a tree of spans inside the trace.'],
          ['`traceparent` · `baggage`', 'W3C trace context: the trace id and parent span are mapped automatically; baggage pairs merge into metadata. The `x-portkey-*` headers win if both are sent.'],
          ['`x-portkey-metadata`', 'A JSON object of string values (≤ 128 characters each). `_user` powers the Users analytics tab — the OpenAI `user` field is copied into it.'],
          ['`x-portkey-debug: false`', 'Do not store request and response content for this request — only tokens, cost and latency. Also disables caching.'],
          ['`x-portkey-sensitive-headers`', 'Header names whose values are masked in request, response and trace logs.'],
        ],
      },
      { type: 'code', title: 'A traced request', text: 'Use W3C-shaped ids (32 hex for the trace, 16 for the span) — the OpenTelemetry export keeps only valid ones and generates new ids for anything else.', tabs: TRACE_TABS },
      {
        type: 'callout', tone: 'tip', title: 'One id, two consoles',
        text: 'With the Prisma AIRS guardrail on, the gateway trace id resolves on the Prisma AIRS side under **AI Runtime → AI Sessions**. Quote the `x-portkey-trace-id` of a blocked request and both the gateway log and the AIRS scan are one search away.',
      },
      {
        type: 'table',
        title: 'Metadata rules',
        columns: ['Rule', 'Detail'],
        rows: [
          ['Values', 'Strings only, at most 128 characters; any number of keys. Routing conditions only read two-segment keys (`metadata.tier`).'],
          ['Reserved', '`_user` (user analytics); `_organisation`, `_environment` and `_prompt` are indexed for feedback. `environment` and `_environment` are different keys.'],
          ['Precedence', '**Workspace > API key > request** (gateway 1.10.20 and later) — a request cannot override a key or workspace value.'],
          ['Required keys', 'Admin Settings → Organisation Properties → API Key / Workspace **Metadata Schema** (JSON Schema, string properties). Checked when a key or workspace is created or updated — not per request.'],
        ],
      },
      { type: 'code', title: 'Feedback on a request', text: '`value` is an integer from -10 to 10 (thumbs up/down = 1 / -1); `weight` 0–1, default 1.', tabs: [{ id: 'curl', lang: 'curl', code: FEEDBACK_CURL }] },
      {
        type: 'table',
        title: 'Privacy controls',
        columns: ['Control', 'Scope', 'Effect'],
        rows: [
          ['`x-portkey-debug: false`', 'One request', 'Content not stored; metrics kept.'],
          ['Request Logging: **Full** or **Metrics Only**', 'Organisation (Admin Settings → Organization Properties), optionally delegated to workspace managers', 'Metrics Only stores tokens, latency, cost and metadata, never content. Switching is not retroactive.'],
          ['Sensitive headers', 'Request, or `ORGANISATION_HEADERS_TO_MASK` on a self-hosted gateway', 'Values hashed in logs.'],
          ['Export denied fields', 'Organisation `export_settings.deniedFields`', 'Exports cannot include e.g. `request`, `response` or `metadata`.'],
        ],
      },
      {
        type: 'table',
        title: 'OpenTelemetry — both directions',
        columns: ['', 'Into the gateway', 'Out of the gateway'],
        minWidth: 620,
        rows: [
          ['What', 'Your app\'s own OTel traces and logs (Vercel AI SDK, OpenLLMetry, OpenLIT, Logfire, Phoenix, MLflow…) shown next to gateway requests, costed from `gen_ai.usage.*`', '**Analytics** (aggregated counts, latency, tokens, cost — stable) and **Complete logs** (full prompts and completions in GenAI semantic conventions — experimental)'],
          ['How', 'OTLP/HTTP to `https://aigw.portkey.ai/v1/otel` with `Authorization=Bearer <key>`', 'Environment variables on the gateway (`OTEL_PUSH_ENABLED`, `OTEL_ENDPOINT`; `EXPERIMENTAL_GEN_AI_OTEL_*`) — Complete logs is self-hosted only, over OTLP HTTP/JSON'],
        ],
      },
      { type: 'code', title: 'Point an OTel SDK at the gateway', tabs: [{ id: 'bash', lang: 'bash', code: OTEL_ENV }] },
      { type: 'code', title: 'Export logs', text: 'Up to 50,000 logs per job, as JSONL. The same flow exists in the console under Exports → Request Data.', tabs: [{ id: 'bash', lang: 'bash', code: LOG_EXPORT }] },
      {
        type: 'callout', tone: 'warn', title: 'Streamed requests cost 0 unless you ask for usage',
        text: 'For streamed completions the gateway logs tokens and cost only when the request sends `stream_options: { "include_usage": true }` — the usage arrives in the final chunk. This portal\'s gateway chats send it; counting SSE chunks is not a token count. A model with no pricing data shows 0 cents, and budget limits do not apply to it.',
      },
      {
        type: 'callout', tone: 'docs', title: 'What the developer docs leave out',
        text: 'No request-log retention period is given there (the Palo Alto Networks admin guide gives one year — see "What the AI Gateway is"). The OTLP ingest URL appears both as `/v1/otel` and `/v1/logs/otel`, and the export field names differ between the create example and the denied-fields list — test against your tenant.',
      },
      {
        type: 'cards',
        items: [
          { icon: Activity, tone: '#22c55e', title: 'Gateway headers in LLM Telemetry', kicker: 'This portal',
            text: 'Every gateway request from the portal records its trace id, provider, cache status, retry count and the target used, next to the AIRS verdict.', go: 'pillar:observability', goLabel: 'Open LLM Telemetry' },
        ],
      },
    ],
  },

  {
    id: 'gw-universal',
    group: 'gateway',
    title: 'One endpoint, three API formats',
    sub: 'Chat Completions, Responses or Anthropic Messages — against any provider',
    minutes: 7,
    level: 'Build',
    docs: pick('agUniversal', 'agChat', 'agMessages', 'agResponses', 'agDecisions', 'agMultimodal', 'agThinking', 'agStrict', 'agCustomHosts', 'agRemoteMcp', 'agHeaders', 'agApiRef'),
    blocks: [
      {
        type: 'prose',
        text: [
          'The gateway speaks three wire formats on `https://aigw.portkey.ai/v1`: **Chat Completions** (`/chat/completions`), OpenAI\'s **Responses** (`/responses`) and Anthropic\'s **Messages** (`/messages`). Each works with every provider — natively where the provider speaks it, through an adapter where it does not — and configs, caching, guardrails and logs apply to all three.',
          'So keep the SDK or agent you already have. A Claude Code session, an OpenAI Agents app and a LangChain service can all reach the same Bedrock or Vertex model through one gateway, one key and one guardrail.',
        ],
      },
      {
        type: 'table',
        title: 'Native or translated',
        columns: ['Format', 'Native on', 'Translated for', 'Lost in translation'],
        minWidth: 680,
        rows: [
          ['Chat Completions', 'OpenAI-compatible providers', 'Anthropic, Bedrock, Vertex and the rest', 'Provider-only fields, unless strict OpenAI compliance is off (below)'],
          ['Responses', 'OpenAI, Azure OpenAI, xAI, Groq, OpenRouter, Azure AI, Perplexity', 'Anthropic, Gemini, Vertex AI, Bedrock, Mistral and the rest', 'Anything stateful: `previous_response_id`, `store`, `GET`/`DELETE /responses/{id}`, and the built-in `web_search` / `file_search` / `computer_use` tools — only `function` tools translate'],
          ['Messages', 'Anthropic, and Claude on Bedrock', 'Everything else, via Chat Completions', '`thinking`, `top_k`, `cache_control`, `mcp_servers`, `service_tier`, `anthropic_beta` — dropped silently, no error'],
        ],
        note: 'The Bedrock and Vertex AI integration pages still say `/messages` works only with Claude models; the Universal API and Messages pages say any provider. Test a non-Claude model on `/messages` before relying on it.',
      },
      { type: 'code', title: 'The same question, three ways', tabs: UNIVERSAL_TABS },
      {
        type: 'callout', tone: 'warn', title: 'The base URL depends on the SDK',
        text: 'OpenAI SDKs and raw HTTP use `https://aigw.portkey.ai/v1`. The **Anthropic SDK and Claude Code** use `https://aigw.portkey.ai` — they append `/v1/messages` themselves, so a `/v1` there doubles the path. (Two Anthropic TypeScript samples on the Bedrock and Vertex pages include `/v1`; the Universal API and Messages pages do not.)',
      },
      {
        type: 'table',
        title: 'Addressing a model',
        columns: ['Form', 'When'],
        rows: [
          ['`"model": "@<slug>/<model>"`', 'The default. `@bedrock-prod/us.anthropic.claude-sonnet-5` = that model through the integration with slug `bedrock-prod`.'],
          ['`x-portkey-provider: @<slug>` + a bare model', 'Endpoints with no `model` field (files, batches), image edits, Nitro mode — and Claude Code.'],
          ['A config with `override_params.model`', 'The app cannot change the model name it sends (Cursor, many SaaS tools).'],
          ['`x-portkey-provider: openai` + your own provider key in `Authorization`', 'Bring-your-own-credential; the gateway key moves to `x-portkey-api-key`. Rejected (`inline_provider_blocked`) when Block Inline Configs is on.'],
        ],
      },
      {
        type: 'prose',
        title: 'Decisions — a typed answer instead of text',
        text: '`/v1/decisions` returns a judgment per question: `noul` (a yes/no probability), `choice` (one label from a set, with probabilities) or `score` (a position on a scale). It is served today only by TypeSafe\'s Jev models, without streaming. Input guardrails scan only the `state` field — never the questions or criteria.',
      },
      { type: 'code', tabs: DECISIONS_TABS },
      {
        type: 'table',
        title: 'Everything else behind the same URL',
        columns: ['Capability', 'Endpoint and notes'],
        minWidth: 600,
        rows: [
          ['Embeddings', '`/v1/embeddings` — input guardrails apply'],
          ['Images', '`/v1/images/generations`, edits, variations — no guardrails; edits need the provider in a header'],
          ['Speech', '`/v1/audio/speech`, `/transcriptions`, `/translations` — no guardrails'],
          ['Files, batches, fine-tuning', '`/v1/files`, `/v1/batches`, `/v1/fine_tuning/jobs` — provider batch APIs, or gateway-managed batching'],
          ['Function calling', 'OpenAI `tools` / `tool_choice` across providers; guardrails read tool-call JSON as text'],
          ['Thinking', 'Reasoning arrives in `content_blocks` (needs strict compliance off). On Anthropic and Bedrock, send the signed `thinking` block back on the next turn. Responses `reasoning.effort` maps to each provider\'s budget.'],
          ['Realtime', '`wss://aigw.portkey.ai/v1/realtime?model=…` — OpenAI Realtime with logs and cost'],
          ['Model list', '`GET /v1/models`; `x-portkey-fetch-integrated-models: true` lists the Model Catalog'],
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Strict OpenAI compliance',
        text: [
          'With the OpenAI SDKs the gateway returns strictly OpenAI-shaped responses by default and drops everything else — including the guardrail `hook_results` chunks in a stream, thinking `content_blocks`, Anthropic citations and Gemini thought signatures. Send `x-portkey-strict-open-ai-compliance: false` (as a default header) to keep them. Portkey\'s own SDKs default to `false`.',
        ],
      },
      {
        type: 'table',
        title: 'Custom hosts and the advanced switches',
        columns: ['Feature', 'How', 'Watch out for'],
        minWidth: 640,
        rows: [
          ['Custom host', '`x-portkey-custom-host`, or set on the saved provider / model', 'On SaaS the host must be publicly reachable: private ranges, cloud metadata addresses, internal TLDs (`.local`, `.internal`, `.corp`…) and ports like 22 or 5432 are refused. `TRUSTED_CUSTOM_HOSTS` exists only on self-hosted gateways. Inline hosts are blocked by Block Inline Configs.'],
          ['Remote MCP', '`x-portkey-beta: server-side-mcp-2026-06-01` and an `mcp` tool with `server_label: "@portkey-mcp/<server>"`', 'Runs the MCP tools through the gateway (works for Bedrock and Vertex models). Provider-run MCP (`server_url`, `mcp_servers`) bypasses the gateway\'s audit.'],
          ['Nitro mode (beta)', '`x-portkey-nitro-mode: true`', 'Streams the body untouched — so no retries, no `override_params` and **no input guardrails, including organisation and workspace defaults**. Incompatible with an AIRS input guardrail.'],
          ['gRPC (beta)', 'Service `gateway.Gateway`', 'Documented only against a self-run gateway; no SaaS endpoint is given.'],
          ['Beta flags', '`x-portkey-beta: use-responses-api-2026-07-30`', 'Routes `/messages` for non-Anthropic providers through the Responses adapter.'],
        ],
      },
      {
        type: 'callout', tone: 'observed', title: 'What this portal has exercised',
        text: 'The gateway paths in this portal use `/v1/chat/completions` with `@sudo-bedrock/us.anthropic.claude-sonnet-5` and `@sudo-vertexai/gemini-3.5-flash` — one guardrail config, two clouds, identical verdicts on the same attack. The Messages, Responses and Decisions paths above are from the docs and have not been run from here.',
      },
    ],
  },

  {
    id: 'gw-agents',
    group: 'gateway',
    title: 'Agent Gateway and agent frameworks',
    sub: 'Frameworks call models through the gateway; A2A agents sit behind it',
    minutes: 6,
    level: 'Build',
    docs: pick('agAgentGw', 'agAgentQuick', 'agAgentReg', 'agAgentCat', 'agOpenaiAgents', 'agLanggraph', 'agStrands', 'agLangchain', 'agVercel', 'agOpenaiCompat'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Two different things share the word "agent" here. An **agent framework** (OpenAI Agents SDK, LangGraph, Strands, CrewAI, the Vercel AI SDK) calls models — point its OpenAI-compatible client at the gateway and every model call gets routing, budgets, logs and the AIRS guardrail. The **Agent Gateway** fronts **A2A agents** themselves: callers reach an agent through the gateway, which authenticates them, controls which agents and skills they may use, and logs every call.',
        ],
      },
      { type: 'code', title: 'Frameworks: change the client, keep the agent', text: 'Every framework takes the same two settings — base URL and gateway key — and the model as `@slug/model`.', tabs: FRAMEWORK_TABS },
      {
        type: 'callout', tone: 'warn', title: 'Framework examples that break on newer tenants',
        text: [
          'Many framework pages in the docs pass an **inline JSON config** or a **raw provider name** (`"provider": "openai"`) in `x-portkey-config`. With **Block Inline Configs** on — the default for organisations created on or after 19 June 2026, and on for this portal\'s tenant — those requests fail with 400 `inline_config_blocked` / `inline_provider_blocked`. Use a saved `pc-…` id and `@slug` references.',
          'OpenAI Agents SDK: switch it to Chat Completions and keep its tracing off the gateway key, as above. Vercel AI SDK: use `.chat(…)` for non-OpenAI providers.',
        ],
      },
      {
        type: 'steps',
        title: 'Put an A2A agent behind the Agent Gateway',
        steps: [
          { title: 'Register the agent', text: 'Give its URL, then **Fetch Agent Card** to validate the transport and auth schemes. The upstream must be a public `http(s)` endpoint — private addresses, metadata hosts and URLs with `#` fragments are refused.', path: ['AI Gateway', 'Agent Registry', 'Add agent'] },
          { title: 'Provision it to workspaces', text: 'Choose which workspaces may call it. Per-user access and per-skill access are listed as coming soon.' },
          { title: 'Create a key that may invoke agents', text: 'A workspace API key with the **Agent Gateway** toggle and the `agents.invoke` scope.' },
          { title: 'Swap the URL', text: 'Callers use `https://aigw.portkey.ai/agent/{agent-slug}` instead of the agent\'s own URL, with `Authorization: Bearer <gateway key>`.' },
        ],
      },
      { type: 'code', title: 'Calling an agent through the gateway', text: 'The docs use the earlier A2A names (`tasks/send`, `/.well-known/agent.json`); current A2A clients may call `message/send` and `agent-card.json`.', tabs: [{ id: 'curl', lang: 'curl', code: A2A_CURL }] },
      {
        type: 'callout', tone: 'docs', title: 'What the Agent Gateway does not document yet',
        text: 'No guardrail or rate-limit configuration for agent-to-agent traffic is described, and per-user and per-skill access are "coming soon". Today it is authentication, workspace-level access and logging. To scan what an agent sends and receives, scan its tool calls with the Runtime API.',
      },
      {
        type: 'cards',
        items: [
          { icon: Network, tone: '#2dd4bf', title: 'Scan every tool call', kicker: 'Agents & MCP',
            text: 'Two-stage `tool_event` scans — parameters before a tool runs, output before the agent reads it.', go: 'mcp-tool-events', goLabel: 'Open the guide' },
        ],
      },
    ],
  },

  {
    id: 'gw-coding',
    group: 'gateway',
    title: 'Claude Code, Codex and Cursor through the gateway',
    sub: 'Central keys, budgets, logs and guardrails for coding agents',
    minutes: 6,
    level: 'Build',
    docs: pick('agCoding', 'agClaudeCode', 'agClaudeBedrock', 'agClaudeVertex', 'agCodex', 'agCursor', 'agMcpClaude', 'gwDevGuard'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Give each developer a gateway **user key** instead of provider credentials. The gateway holds the Bedrock, Vertex or Anthropic credential, attributes every request to the person, enforces their budget and rate limit, can fall back between clouds — and runs the Prisma AIRS guardrail on prompts and on the tool results the agent feeds back.',
        ],
      },
      { type: 'code', title: 'Claude Code', text: 'One base URL for every provider; the provider is picked by `x-portkey-provider` (or `x-portkey-config: pc-…`) inside `ANTHROPIC_CUSTOM_HEADERS`, one header per line. Model ids are the provider\'s own, without `@slug/`.', tabs: CLAUDE_CODE_TABS },
      {
        type: 'table',
        title: 'The settings that matter',
        columns: ['Setting', 'Value'],
        rows: [
          ['`ANTHROPIC_BASE_URL`', '`https://aigw.portkey.ai` — **without** `/v1`'],
          ['`ANTHROPIC_AUTH_TOKEN`', 'The gateway key (the docs also repeat it as `Authorization` in the custom headers)'],
          ['`ANTHROPIC_CUSTOM_HEADERS`', '`x-portkey-provider: @slug` or `x-portkey-config: pc-…`; optionally `x-portkey-trace-id`, `x-portkey-metadata`'],
          ['`ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL`', 'The provider\'s model ids, so `/model` and sub-agents resolve correctly'],
          ['Non-Claude models on Bedrock', '`DISABLE_PROMPT_CACHING=1` and `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` — otherwise a 403 `AccessDeniedException`'],
        ],
      },
      {
        type: 'callout', tone: 'warn', title: 'The two mistakes the docs warn about',
        text: [
          '`CLAUDE_CODE_USE_BEDROCK` / `CLAUDE_CODE_USE_VERTEX` with `ANTHROPIC_BEDROCK_BASE_URL` pointing at the gateway gives `API Error: 500 fetch failed` — use the plain Anthropic variables above for every provider. A `/v1` on the base URL turns requests into an unprocessed passthrough (a ⚡ in the gateway logs).',
          'The pages disagree on `anthropic-beta`: the Claude Code page says to add `forward_headers: ["anthropic-beta"]` to the config, the Bedrock and Vertex pages say the gateway remaps it itself. Inline forward headers are blocked by Block Inline Configs, so set them on the saved provider. The Vertex page also uses Anthropic-style model names, while the Vertex AI integration page writes Claude as `anthropic.<model>` — check which your tenant accepts.',
        ],
      },
      {
        type: 'callout', tone: 'tip', title: 'The AIRS guardrail for coding agents',
        text: 'Set the Prisma AIRS guardrail to `scan_scope: "last_user_message"` with `strip_scaffolding: true`: the agent\'s harness text (system reminders, tool instructions) is not scanned as if the user wrote it, while **tool results are always scanned** — that is where indirect prompt injection arrives. See "The AIRS guardrail in the gateway".',
      },
      { type: 'code', title: 'OpenAI Codex', text: 'Codex has no custom-header setting, so policy (fallbacks, cache, guardrails) rides on a config attached to the key.', tabs: [{ id: 'bash', label: 'config.toml', lang: 'bash', code: CODEX_TOML }] },
      {
        type: 'steps',
        title: 'Cursor',
        steps: [
          { title: 'Create a config that names the model', text: 'Cursor sends no gateway headers and plain model names, so the config decides: `{"override_params": {"model": "@openai-prod/gpt-4o"}}`.' },
          { title: 'Create a gateway key and attach the config', text: 'The config becomes the key\'s default.' },
          { title: 'Point Cursor at the gateway', text: 'Enable **OpenAI API Key** (paste the gateway key) and **Override OpenAI Base URL** = `https://aigw.portkey.ai/v1`.', path: ['Cursor Settings', 'Models'] },
          { title: 'Add a custom model and select it in Chat', text: 'Call it something that is not a real model id (e.g. `airs_model`) — otherwise Cursor may use a built-in model and the traffic never reaches the gateway. Autocomplete and Apply need Cursor Pro or Enterprise.' },
        ],
      },
      {
        type: 'cards',
        items: [
          { icon: Terminal, tone: '#a855f7', title: 'Hooks on the laptop, too', kicker: 'AI Code Assistant Protection',
            text: 'The gateway sees model traffic; Claude Code hooks in this portal also scan URL fetches and MCP tool calls before they run. The two combine.', go: 'pillar:claudeHooks', goLabel: 'Open the pillar' },
        ],
      },
    ],
  },
]

// ─── governance ──────────────────────────────────────────────────────────────

const KEY_CREATE = `# The Admin API takes an SCM access token from a service account — gateway API keys
# authenticate inference only.
curl -X POST "https://api.apps.paloaltonetworks.com/ai_gw/v2/api-keys/service" \\
  -H "Authorization: Bearer $SCM_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "support-bot-prod",
    "workspace_id": "YOUR_WORKSPACE_ID",
    "scopes": ["completions.write", "logs.view"],
    "defaults": {
      "config_id": "pc-support-prod",
      "metadata": { "team": "support", "environment": "production" }
    },
    "rotation_policy": { "rotation_period": "monthly", "key_transition_period_ms": 86400000 }
  }'`

const POLICY_TABS = [
  { id: 'usage', label: 'Usage limit — $50 per user per month', lang: 'json', code: `{
  "type": "usage_limits",
  "policy": {
    "conditions": [{ "key": "metadata._user", "value": "*" }],
    "group_by": [{ "key": "metadata._user" }],
    "credit_limit": 50,
    "type": "cost",
    "periodic_reset": "monthly",
    "status": "active"
  }
}` },
  { id: 'rate', label: 'Rate limit — 1,000 rpm per workspace', lang: 'json', code: `{
  "type": "rate_limits",
  "policy": {
    "conditions": [{ "key": "api_key", "value": "*" }],
    "group_by": [{ "key": "workspace_id" }],
    "value": 1000,
    "type": "requests",
    "unit": "rpm",
    "status": "active"
  }
}` },
  { id: 'exclude', label: 'Exclude one model', lang: 'json', code: `{
  "type": "usage_limits",
  "policy": {
    "conditions": [{ "key": "model", "value": "@openai/*", "excludes": "@openai/gpt-4o" }],
    "group_by": [{ "key": "api_key" }],
    "credit_limit": 200,
    "type": "cost",
    "periodic_reset": "monthly"
  }
}` },
]

export const AIGW_GOVERNANCE = [
  {
    id: 'gw-governance',
    group: 'gwgov',
    title: 'Keys, budgets and rate limits',
    sub: 'Who may call what, how much and how fast — enforced at the gateway',
    minutes: 8,
    level: 'Setup',
    docs: pick('agKeys', 'agKeyRotation', 'agBudget', 'agRate', 'agKeyLimits', 'agWsLimits', 'agPolicies', 'agDefaultCfg', 'agSavedOnly', 'agCatalog', 'agWsProv', 'agModelProv', 'agPricing', 'agSecretRefs'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Two kinds of credential, never interchangeable: **gateway API keys** authenticate inference (models, MCP, agents), and the **Admin API** is called with a Strata Cloud Manager access token issued to a service account. A key\'s scopes say what it may do on the inference path.',
          'Keys come in two levels. **Admin keys** belong to the organisation and act across workspaces; **workspace keys** are scoped to one workspace and are either **Service** keys (automation, CI) or **User** keys (one person, so every log line names them). Only workspace keys can call the completion APIs.',
        ],
      },
      {
        type: 'table',
        title: 'Inference scopes worth knowing',
        columns: ['Scope', 'Allows'],
        rows: [
          ['`completions.write`', '`/chat/completions`, `/completions`, `/images`, `/audio`'],
          ['`mcp.invoke` · `agents.invoke`', 'Calling MCP servers and A2A agents through the gateway'],
          ['`guardrails.invoke` · `prompts.render`', 'Running guardrails and rendering prompt templates directly'],
          ['`logs.view` · `logs.list` · `logs.export` · `logs.write` · `analytics.view`', 'Reading, exporting and inserting logs; analytics'],
          ['`workspace_user_api_keys.*` · `workspace_service_api_keys.*`', 'Managing other keys — Service keys only'],
        ],
        note: 'Admin keys carry organisation scopes (`workspaces.*`, `organisation_guardrails.*`, `audit_logs.list`, `secret_references.*`…) but not `completions.write`.',
      },
      { type: 'code', title: 'Create a service key with policy attached', text: 'The default config and metadata ride on the key; the rotation policy rotates its secret monthly with a one-day overlap.', tabs: [{ id: 'curl', lang: 'curl', code: KEY_CREATE }] },
      {
        type: 'table',
        title: 'Rotation',
        columns: ['', 'Detail'],
        rows: [
          ['What changes', 'Only the secret — the key id, its budget, attribution and analytics stay.'],
          ['Manual', '`POST /v2/api-keys/{id}/rotate` with an optional `key_transition_period_ms` (minimum 30 minutes). Both secrets work during the transition; at most two at a time.'],
          ['Automatic', '`rotation_policy`: `weekly` (Monday 00:00 UTC), `monthly` (the 1st) or `rotation_period_days` 1–365. Email warnings 24 hours ahead.'],
          ['Enforced', '`user_api_key_rotation_period` makes every user key in the organisation (or a workspace) rotate on a cadence.'],
        ],
      },
      {
        type: 'table',
        title: 'Where budgets and rate limits live',
        columns: ['Level', 'Where', 'Notes'],
        minWidth: 640,
        rows: [
          ['Integration, per workspace', 'Integration → Workspace Provisioning → Edit Budget & Rate Limits', 'Cascades to every provider made from the integration. A rate limit of 0 disables the provider.'],
          ['API key', 'The key → Add Budget Limit / rate limit', 'Email at the alert threshold; requests keep flowing until the limit.'],
          ['Workspace', 'Workspace Control → **Budget Allocation**', 'Applies whichever key is used.'],
          ['Policy', '`POST /v1/policies/usage-limits` or `/rate-limits`', 'Conditions plus `group_by` — e.g. one counter per user, per model or per key.'],
          ['JWT', 'the `usage_limits` claim', 'Each distinct token is tracked separately.'],
        ],
      },
      {
        type: 'table',
        title: 'How limits behave',
        columns: ['', 'Budget (usage limit)', 'Rate limit'],
        rows: [
          ['Measured in', 'Cost in USD (min $1), tokens (min 100) or — in policies — requests', 'Requests or tokens per minute, hour or day (`rpm` / `rph` / `rpd`; policies add `rpw`)'],
          ['Resets', 'Never, weekly, monthly, or every N days', 'Each window'],
          ['When exceeded', '**412** Precondition Failed', '**429** Too Many Requests'],
          ['Editing', 'Immutable once set on an integration or key — duplicate the provider to change it', 'Same for integration-level limits'],
        ],
        note: 'A model with no pricing data logs 0 cents and does not count towards a cost budget. Policy alert thresholds write an audit-log event; the docs say emails for them are not sent yet.',
      },
      { type: 'code', title: 'Policies as code', tabs: POLICY_TABS },
      {
        type: 'table',
        title: 'Enforced policy — what a caller cannot opt out of',
        columns: ['Control', 'Where', 'What the caller sees'],
        minWidth: 640,
        rows: [
          ['Default config, override off', 'The key → Config, **Allow Config Override** off', '400 on any request that sends a different config'],
          ['Block Inline Configs', 'Admin Settings → Security → Data Plane Security Settings', '400 with a specific code (below) — only saved `pc-…` configs and `@slug` providers'],
          ['Model provisioning', 'Integration → Model Provisioning: all models or an allow-list', 'A rejected request for any model outside the list'],
          ['Workspace provisioning', 'Integration → Workspace Provisioning', 'The provider slug does not exist for other workspaces'],
          ['Metadata schema', 'Admin Settings → Organisation Properties → API Key / Workspace Metadata Schema', 'Checked when a key or workspace is created or updated — not per request'],
          ['Org / workspace guardrails', 'Admin Settings → Organisation Guardrails; the workspace → Edit', 'Guardrails on every request — see "Guardrail actions, verdicts and PII redaction"'],
        ],
      },
      {
        type: 'table',
        title: 'Block Inline Configs — the 400 error codes',
        columns: ['`error.code`', 'Blocked'],
        rows: [
          ['`inline_config_blocked`', 'Config JSON in `x-portkey-config` instead of a `pc-…` id'],
          ['`inline_provider_blocked`', 'A raw provider name (`openai`) instead of `@slug`'],
          ['`inline_custom_host_blocked`', 'A custom host on the request'],
          ['`inline_provider_url_blocked`', 'An inline provider URL (Hugging Face, Azure Foundry, Databricks)'],
          ['`inline_forward_headers_blocked`', 'Forward headers on the request'],
        ],
        note: 'On by default for organisations created on or after 19 June 2026, off for older ones. Only the first violation is reported. Hybrid gateways need 2.11.0 or later.',
      },
      {
        type: 'table',
        title: 'The Model Catalog',
        columns: ['Object', 'What it is'],
        rows: [
          ['Integration', 'Stored provider credentials at organisation level. Bedrock: access key, assumed role or Bedrock API key; Vertex: service-account JSON, or workload identity on self-hosted.'],
          ['Provider (`@slug`)', 'What a workspace sees when an integration is shared with it. One integration can back `@openai-dev`, `@openai-prod`…'],
          ['Custom model', 'A fine-tuned or private model with a base model for API compatibility, optional custom pricing, host and headers.'],
          ['Pricing adjustment', 'A multiplier per integration (`0.8` = 20% off) so cost tracking matches your negotiated rate.'],
          ['Secret reference', 'The credential stays in AWS Secrets Manager, Azure Key Vault or HashiCorp Vault; the data plane fetches it and caches it for 5 minutes.'],
        ],
      },
      {
        type: 'callout', tone: 'observed', title: 'Seen on the SCM tenant this portal uses',
        text: [
          'Block Inline Configs is **on** — every gateway call here uses saved `pc-…` configs. A model outside the integration\'s allow-list (or behind a provider pin in the config) comes back as "Model X is not allowed for this integration"; the developer docs name no error for it.',
          'The Bedrock integration here authenticates with an IAM-user access key. The documented **Assumed Role** option (trust `arn:aws:iam::039293892788:role/AirsGwEnterpriseRole`, optional external id) failed on the SCM gateway with `UnrecognizedClientException: The security token included in the request is invalid`, and no `sts:AssumeRole` reached the AWS account — the same role works on the standalone Portkey gateway. Raised with Palo Alto Networks support; check its status before choosing assumed role.',
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Where the docs disagree with themselves',
        text: 'Weekly budgets reset on **Sunday** 00:00 UTC on the budget pages but **Monday** on the policies page. The Admin API is shown with an SCM token on `api.apps.paloaltonetworks.com/ai_gw/v2`, with `/ai_gw/admin/v2` for organisation guardrails, and with a gateway key on `aigw.portkey.ai/v1` for policies and secret references — confirm which your tenant accepts before scripting it.',
      },
    ],
  },

  {
    id: 'gw-admin',
    group: 'gwgov',
    title: 'Org admin: workspaces, roles, SSO and directory sync',
    sub: 'Organisation → workspace → user, and how people get there',
    minutes: 7,
    level: 'Setup',
    docs: pick('agOrgMgmt', 'agWorkspaces', 'agRoles', 'agAccessCtl', 'agSso', 'agScim', 'agScimGroups', 'agCie', 'agAudit', 'agKms', 'agSecurity', 'agGatewayUrls', 'agGwRegister'),
    blocks: [
      {
        type: 'prose',
        text: 'The tenancy model is **Organisation → Workspace → User or machine**. The organisation is the Strata Cloud Manager tenant; workspaces divide it and own integrations, configs, guardrails and keys; people and service keys act inside a workspace. A user must belong to the organisation before joining a workspace.',
      },
      {
        type: 'table',
        title: 'Roles',
        columns: ['Level', 'Role', 'Can'],
        rows: [
          ['Organisation', 'Owner', 'Everything, including billing'],
          ['Organisation', 'Admin', 'Settings, workspaces, admin keys, roles, invitations, access permissions — and admin rights in every workspace'],
          ['Organisation', 'Member', 'Belong to workspaces'],
          ['Workspace', 'Admin / Manager', 'Invite organisation members, assign workspace roles, create workspace keys, manage resources (identical by default)'],
          ['Workspace', 'Member', 'Read-only by default — the docs are not consistent on this; the access settings below decide'],
        ],
      },
      {
        type: 'table',
        title: 'Access settings (Admin Settings → Security)',
        columns: ['Setting', 'Controls'],
        rows: [
          ['Logs', 'Whether managers and members see logs, and logs metadata'],
          ['Analytics', 'Whether managers and members see analytics'],
          ['Data visibility', 'Off: a role sees only logs and traces from its own keys; service-key traffic is hidden from it'],
          ['API keys', 'Managers: service and user keys. Members: only their own user keys'],
          ['Prompts · Guardrails · Integrations · Providers', 'View and write rights per role'],
        ],
        note: 'Each section can allow a workspace-level override.',
      },
      {
        type: 'table',
        title: 'Getting people in',
        columns: ['Method', 'How it works', 'Notes'],
        minWidth: 660,
        rows: [
          ['SSO', 'OIDC or SAML 2.0; first sign-in provisions the user', 'Only verified **Allowed Domains** are provisioned; auto-provisioning can be turned off.'],
          ['SCIM', 'Entra ID or Okta push users and groups; a group maps to one or more workspaces with one role', 'Okta: SAML apps only, and groups must be pushed. Pattern mapping: `ws-{Workspace}-role-{admin|manager|member}`.'],
          ['**CIE Directory Sync**', 'Cloud Identity Engine pulls users and groups from Entra ID, Okta, Google or on-prem AD', 'SCM tenants only — it replaces SCIM there. Delta sync every 15 minutes.'],
        ],
      },
      {
        type: 'steps',
        title: 'Set up CIE Directory Sync',
        steps: [
          { title: 'Sync a directory in Cloud Identity Engine', text: 'At least one directory must have synced successfully in CIE first. You need organisation admin rights.', path: ['CIE', 'Directory Sync', 'Directories', 'Add New Directory'] },
          { title: 'Connect it to the AI Gateway', text: 'Pick the **connected directory** (one at a time) and the **user identity attribute** — UPN (default) or Mail. Users without that attribute are skipped.', path: ['AI Gateway', 'Admin Settings', 'Authentication', 'Directory Sync'] },
          { title: 'Choose the Auth Profile', text: 'Synced from CIE authentication profiles; it is what MCP Gateway sign-in through Palo Alto Networks CAS uses.' },
          { title: 'Map groups to workspaces', text: 'Strictly one group to one workspace; the workspace must already exist (sync never creates one). Deleting a mapping removes its users immediately.' },
          { title: 'Give synced users keys', text: 'Create a **User** key and pick a synced member; the key is shown once.', path: ['AI Gateway', 'Security Keys', 'Create New', 'User'] },
        ],
      },
      {
        type: 'callout', tone: 'warn', title: 'Disabling sync is destructive',
        text: 'Turning Directory Sync off removes every CIE user from their workspaces and deletes all group mappings; turning it back on does not restore them. The docs also name no role for CIE-mapped users, unlike SCIM mappings.',
      },
      {
        type: 'table',
        title: 'Security and audit',
        columns: ['Topic', 'Detail'],
        minWidth: 600,
        rows: [
          ['Audit logs', 'Admin Settings → Audit Logs (owners and admins): who, what, which resource, status, client IP and country. Key rotations and invalid JWTs are recorded too.'],
          ['Encryption', 'TLS 1.2+ in transit, AES-256 at rest. Provider keys are decrypted only in memory, in sandboxed workers.'],
          ['Bring your own key', 'AWS KMS only (envelope encryption) for configs, integration credentials, prompts, guardrails and SSO secrets.'],
          ['Compliance claims', 'SOC 2, ISO 27001, GDPR, HIPAA.'],
          ['Gateway URLs', 'Settings → Organisation → General: the gateway and MCP gateway URLs shown in snippets — self-hosted deployments.'],
          ['Hybrid data plane', 'Admin Settings → Gateway Registration → download `values.yaml` (shown once) → Helm.'],
        ],
      },
      {
        type: 'cards',
        items: [
          { icon: Fingerprint, tone: '#8b5cf6', title: 'Entra ID in front of the gateway', kicker: 'Enterprise AI Access pillar',
            text: 'Users sign in with Entra ID, the portal mints a short-lived JWT, and the gateway routes by their role — no gateway key in the browser.', go: 'pillar:enterpriseAccess', goLabel: 'Open Enterprise AI Access' },
        ],
      },
    ],
  },
]
