import { Activity, Fingerprint, Layers, Network, Terminal } from 'lucide-react'
import { pick } from './links'

/**
 * Prisma AIRS AI Gateway — the developer docs at portkey.ai/docs/aigw, read
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
      "failure_threshold": 5,
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
      { "query": { "url.pathname": { "$regex": "/embeddings$" } }, "then": "embed" }
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

const LOG_INSERT = `# Log a call that did not go through the gateway — one object or an array of them.
# Scopes (AB03 help page): completions.write AND logs.write.
curl https://aigw.portkey.ai/v1/logs \\
  -H "Authorization: Bearer $PORTKEY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "request": {
      "url": "https://llm.internal.example.com/v1/chat/completions",
      "method": "POST",
      "body": { "model": "in-house-llm", "messages": [{ "role": "user", "content": "Hi" }] }
    },
    "response": {
      "status": 200,
      "response_time": 412,
      "body": { "choices": [{ "message": { "role": "assistant", "content": "Hello" } }] }
    },
    "metadata": { "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736", "_user": "u-123" }
  }'`

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
  { id: 'messages', label: 'Messages', lang: 'curl', code: `# Anthropic's format — native for Claude (Anthropic, Bedrock and other Claude hosts), translated for the rest
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
wire_api = "responses"                   # the only value current Codex accepts (and its default)

# Optional gateway headers on every request
http_headers = { "x-portkey-config" = "pc-codex-prod" }
env_http_headers = { "x-portkey-metadata" = "PORTKEY_METADATA" }   # value read from $PORTKEY_METADATA`

export const AIGW_GATEWAY = [
  {
    id: 'gw-routing',
    group: 'gateway',
    title: 'Fallbacks, retries, load balancing and caching',
    sub: 'Reliability in a saved config — the app keeps calling one model',
    minutes: 10,
    level: 'Build',
    docs: pick('agConfigs', 'agFallbacks', 'agRetries', 'agLoadBalance', 'agConditional', 'agCircuit', 'agCache', 'agTimeouts', 'agCanary', 'agDefaultCfg', 'agSavedOnly', 'arConfigObject', 'arResponseSchema', 'agChangelog'),
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
          ['Passthrough target', '`"passthrough": true` on a target', 'No `provider`: the target takes it from the request — `x-portkey-provider: @slug`, else the `@slug/` in `model` — so one fallback chain can front whichever provider the caller names. The documented answer to the provider-pin pitfall below; untested on this tenant.'],
          ['Retry', '`retry.attempts`, `retry.on_status_codes`', 'Up to **5**. Default codes `429, 500, 502, 503, 504, 529` — setting your own replaces them. Backoff 1, 2, 4, 8, 16 s, or the provider\'s `retry-after` with `use_retry_after_headers` (a single value over 60 s fails the request at once). Total wait is capped at **60 s**.'],
          ['Circuit breaker', '`cb_config` (under `strategy` on the product page)', '`failure_threshold` and/or `failure_threshold_percentage` (+ `minimum_requests` before the rate counts), `failure_status_codes` (default "> 500"), `cooldown_interval` in **ms** (minimum 30 s). A strategy without `cb_config` inherits its parent\'s; targets inherit their strategy\'s. State is kept per strategy path; an open target is skipped and closes by itself after the cooldown (no half-open probe is documented); if every target is open, the breaker is bypassed and all are used.'],
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
        type: 'callout', tone: 'docs', title: 'The circuit breaker has two published shapes',
        text: 'The Circuit Breaker page nests `cb_config` under `strategy`, and its example uses only `failure_threshold_percentage` + `minimum_requests`. The Gateway Config Object schema puts `cb_config` at the config root, requires `failure_threshold` **and** `cooldown_interval`, and lists neither `failure_threshold_percentage` nor `minimum_requests`. The tab above follows the product page and adds `failure_threshold`, so it carries both required fields — test the placement on your tenant. The default "> 500" read literally leaves out 500 itself; list the codes you mean.',
      },
      {
        type: 'callout', tone: 'warn', title: 'Status codes chain together — with three catches',
        text: [
          'Three things produce a status the other blocks can act on: a **timeout** gives `408`, a failed sync guardrail gives `246` (let through) or `446` (denied), and the provider gives its own. So `"on_status_codes": [408]` on a fallback means "fall back only on timeout", and the Guardrails page uses `[246, 446]` for "try the next model when the guardrail fails".',
          '`246` is a 2xx, so the default any-non-2xx fallback never fires on it — list it. A denied request on this portal\'s SCM tenant comes back as **HTTP 200** (the `soft_deny_200` shape, gateway 2.14.0 — see "Guardrail actions, verdicts and PII redaction"), so a fallback on `446` may never fire there; that combination is untested. And output-guardrail results on a stream are informational only — no fallback, no retry.',
          '`408` is **not** in the default retry list — add it explicitly. The three keys are spelled differently: `strategy.on_status_codes` (fallback), `retry.on_status_codes` (retry), `cb_config.failure_status_codes` (circuit breaker). Over gRPC (self-run gateway only) the call itself returns OK and the HTTP status sits in the response\'s `status_code`.',
        ],
      },
      {
        type: 'code',
        title: 'Conditional routing',
        text: 'Route on `metadata.<key>` (from `x-portkey-metadata` or the key/JWT defaults), `params.<key>` (any top-level body field with a primitive value — and, since gateway 2.25.0, text fields of multipart/form-data requests such as image edits and transcriptions) or `url.pathname`. Operators: `$eq` `$ne` `$in` `$nin` `$regex` `$gt` `$gte` `$lt` `$lte`, combined with `$and` / `$or`. The page does not say whether `url.pathname` includes `/v1` (its intro says "route `/v1/embeddings`", its one example matches `^/responses`), so the sample uses an unanchored `/embeddings$`, which matches either way — untested.',
        tabs: [{ id: 'json', lang: 'json', file: 'pc-conditional', code: CFG_CONDITIONAL }],
      },
      {
        type: 'table',
        title: 'Conditional routing — the rules that bite',
        columns: ['Rule', 'What it means'],
        rows: [
          ['Two-segment paths only', '`metadata.tier` works; `metadata.features.beta` does not.'],
          ['Primitive values only', 'Metadata values are strings (Metadata page: strings of at most 128 characters — yet the Conditional Routing page matches `{"$eq": true}` on metadata); `params.*` can be string, number or boolean — not arrays or objects.'],
          ['Missing key = false', 'A condition on a key the caller did not send is simply false — no error, the next condition is tried. Malformed conditions are skipped the same way.'],
          ['`$regex`', 'A JavaScript regex with no flags — case-sensitive; an invalid pattern evaluates to false.'],
          ['Order matters', 'Conditions are evaluated top to bottom; put specific ones first. Making `default` the cheapest or most restricted target is this guide\'s advice, not the docs\'.'],
          ['No circuit breaker', '`cb_config` is not evaluated for conditional strategies.'],
          ['Fan-out caps', 'At most 100 root targets (1,000 for a conditional strategy) and 50 nested targets per root target; a bigger config is rejected at request time (gateway 2.14.0).'],
        ],
      },
      {
        type: 'prose',
        title: 'Canary releases',
        text: 'A canary is a `loadbalance` config with a small weight on the new target — 0.95 / 0.05, or the 0.9 / 0.1 of the "Weighted + sticky" tab above. The app sends the same request; compare cost, latency, errors and feedback in Analytics. Keep `strategy.sticky` so each user stays on one side, or route an opt-in cohort with a conditional rule on a metadata key (`metadata.user_group` = `beta`) instead of a random slice. Do not copy the Canary Testing page\'s JSON — it is missing a closing brace.',
      },
      {
        type: 'table',
        title: 'Caching',
        columns: ['', 'Simple', 'Semantic'],
        rows: [
          ['Matches', 'The exact body, metadata and cache namespace', 'User text above a similarity threshold (default 0.95) **and** identical model and parameters'],
          ['Endpoints', 'All, including image generation', '`/chat/completions` and `/completions` only'],
          ['Limits', '—', 'Under 8,191 tokens and at most 4 messages; the system prompt is ignored'],
          ['Force a fresh answer', '`x-portkey-cache-force-refresh: true` on the request (needs a cache config; cannot be set in a config)', 'Same — refreshes every matching entry'],
          ['Partition', '`x-portkey-cache-namespace: <string>` instead of all headers', 'Same'],
          ['Scope', 'Top level or per target — a target\'s own `cache` wins. A target with `override_params` hits only once that exact parameter combination is cached.', 'Same'],
          ['TTL', '`max_age` from 60 s to 90 days, default 7 days. The organisation TTL (Admin Settings → Organisation Properties → Cache Settings, at most 25,923,000 s) wins when a request asks for longer.', 'Same'],
          ['Status', 'Header `x-portkey-cache-status`: `HIT`, `MISS`, `DISABLED`, `REFRESH`. Logs: Cache Hit, Cache Miss, Cache Refreshed, Cache Disabled', '`SEMANTIC HIT` / `SEMANTIC MISS`; Logs: Cache Semantic Hit'],
          ['Never cached', 'A stream that ends without its terminal event — the gateway appends a `stream_incomplete` error event and keeps it out of the cache (2.24.0)', 'Same'],
        ],
        note: 'The docs describe semantic-cache setup (a vector database and an embedding provider) only for self-hosted gateways and do not say whether the SaaS gateway offers it. `x-portkey-debug: false` disables caching for that request; Nitro mode ignores `cache` silently.',
      },
      {
        type: 'table',
        title: 'Recent gateway releases that change routing',
        columns: ['Version', 'Change'],
        rows: [
          ['2.24.0 (22 Sep 2026)', 'Every retry attempt is logged as its own row under the same trace id — the Retries page still says attempts are not logged individually.'],
          ['2.25.0 (24 Sep)', 'Conditional routing reads text fields of multipart/form-data requests.'],
          ['2.25.1 (29 Sep)', 'Streamed Responses API errors from non-native providers carry the real upstream status instead of 200, so fallback and retry now trigger.'],
          ['2.27.0 (6 Oct)', 'Bedrock model allow-lists accept cross-region inference profiles (`us.anthropic.…`) when the base model is allowed, and application inference-profile ARNs.'],
        ],
        note: 'From the Enterprise Gateway changelog. A hybrid data plane gets a change only when it is upgraded.',
      },
      {
        type: 'callout', tone: 'observed', title: 'Which target answered — and three pitfalls',
        text: [
          'The SCM AI Gateway returns `x-portkey-last-used-option-index` (e.g. `config.targets[2]`) together with `x-portkey-provider`, `x-portkey-cache-status` and `x-portkey-retry-attempt-count` — Enterprise AI Access reads the first, the Ministry of Health pillar the cache status. The API reference\'s Response Schema page documents all of them except `x-portkey-provider`.',
          'A `targets` / `strategy` provider pin overrides the `@slug/` in the model name; remove the pair **together** (an empty fallback chain fails every request); and configs are versioned in the console, so a bad edit is one rollback away.',
        ],
      },
      {
        type: 'callout', tone: 'warn', title: 'Copying examples from the docs',
        text: 'Some examples on the official pages are not valid JSON as published: the canary-testing config never closes the second target\'s `override_params`, and the Request Timeouts page has a misplaced quote in its nested example (`"provider:"@openai"`) and trailing commas in its target-level and "Triggering Fallbacks" examples. The shapes on this page are corrected. The docs also do not state whether retries run inside each fallback target or around the whole chain.',
      },
    ],
  },

  {
    id: 'gw-guardrails',
    group: 'gateway',
    title: 'Guardrail actions, verdicts and PII redaction',
    sub: 'How any gateway guardrail runs, blocks and reports — beyond AIRS',
    minutes: 10,
    level: 'Build',
    docs: pick('agGuardrails', 'agGuardCaps', 'agGuardList', 'agGuardRaw', 'agPii', 'agByo', 'agOrgGuard', 'agWsGuard', 'agGuardHdrs', 'agModelRules', 'agReqParams', 'agGuardBatches', 'agDecisionsGuard', 'arCreateGuard', 'arOrgGuard', 'agChangelog'),
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
        note: 'The Guardrails and Capabilities pages give `async: true` as the default; the create-guardrail API schema gives `false`. Set it explicitly whichever way you create the guardrail.',
      },
      {
        type: 'table',
        title: 'What comes back (sync guardrails)',
        columns: ['Verdict', '`deny`', 'HTTP status', 'Body'],
        rows: [
          ['Pass', 'either', '200', 'Normal response + `hook_results`'],
          ['Fail', '`false`', '**246**', 'Normal response + `hook_results` with `verdict: false`'],
          ['Fail', '`true`', '**446**', '`error.type: "hooks_failed"` + `hook_results`; the model was not called (input) or the answer withheld (output)'],
          ['Fail, soft deny', '`true` + `soft_deny_200`', '**200**', 'A chat-completion-shaped answer carrying the denial message + `hook_results`; as with 446, an input deny stops the model call'],
          ['Any (async)', 'either', 'the provider\'s', 'No `hook_results` in the response — logs only'],
        ],
        note: 'Soft deny comes from changelog 2.14.0: "a guardrail denial returns HTTP 200 … instead of the standard HTTP 446", for clients that treat 4xx as fatal, such as Claude Code. The Decisions guardrails page spells it `softDeny200`; neither the Guardrails page nor the create-guardrail schema lists it. Streaming: input guardrails run before the stream (a deny returns 446 before any token); output guardrails run on the assembled answer after `[DONE]` and arrive as an extra `hook_results` chunk — informational only, no fallback or retry. With strict OpenAI compliance on, output guardrails still run (2.7.0) but that chunk is not sent; set `x-portkey-strict-open-ai-compliance: false` to see it.',
      },
      {
        type: 'callout', tone: 'observed', title: 'This portal\'s SCM tenant blocks with HTTP 200',
        text: 'A denied request on the SCM AI Gateway used here came back as **HTTP 200** with the content replaced by "The guardrail checks defined in the config failed…" and the model never called — the soft-deny row above. Do not branch on the status code alone: read `hook_results.*_hooks[].verdict`, and treat 200-with-a-false-verdict, 246 and 446 as the three outcomes.',
      },
      { type: 'code', title: 'Reading `hook_results`', text: 'Trimmed to the documented fields. `verdict` on the guardrail is true only if every check passed — but the docs\' own streaming example shows a guardrail with `verdict: true` whose check failed with an `error` and `fail_on_error: false`, so a check that errors does not fail the guardrail unless it fails on error.', tabs: [{ id: 'json', lang: 'json', code: HOOK_RESULTS }] },
      {
        type: 'table',
        title: 'Three stages a check can run in',
        columns: ['Stage', 'Config key', 'Runs'],
        rows: [
          ['Start (gateway 2.25.0)', '`startHooks`', 'At the very start — before authentication, routing and every other hook. Two checks were added for it: **Header Check** (allow or block on header key-value pairs, matching `all`, `any` or `none`) and **Header Transform** (remove, set or rewrite headers; `x-portkey-*` and other protected headers cannot be changed). `allowedRequestTypes`, `webhook` and JWT header lookup can run here too.'],
          ['Input', '`input_guardrails` (= `before_request_hooks`)', 'Before the model is called'],
          ['Output', '`output_guardrails` (= `after_request_hooks`)', 'Before the caller sees the answer'],
        ],
        note: '`startHooks` is described only in the changelog so far — the Guardrails page and the config-object schema do not list it.',
      },
      {
        type: 'table',
        title: 'Where guardrails run',
        columns: ['Coverage', 'Endpoints'],
        rows: [
          ['Input and output', '`/v1/chat/completions`, `/v1/completions`, `/v1/messages`, `POST /v1/responses`'],
          ['Input only', '`/v1/embeddings`; `/v1/decisions` (the `state` field only)'],
          ['Not covered', 'audio, images, files, fine-tuning, moderations, models, assistants and threads, `GET /v1/responses/*`'],
          ['Batches', 'Applied asynchronously to the input and output files, through a config passed in `portkey_options` — needs gateway 2.9.0+ **and** Data Service 1.8.0+. The Capabilities page still lists batches as not covered.'],
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
          ['PARTNER', '**Palo Alto Networks Prisma AIRS**, Acuvity, Akto, Aporia, AWS Bedrock Guardrails, Azure, Cato Networks, CrowdStrike AIDR, F5, Javelin, Lakera, Lasso, Mistral, Pangea, Patronus, Pillar, Prompt Security, Qualifire, Zscaler'],
        ],
        note: 'The check-list page still shows Walled AI, whose card links outside the AI Gateway docs, and leaves out Cato Networks and Lakera, which have pages. The changelog also names Singulr (2.18.0) and Alibaba Cloud content safety (2.13.0, 2.22.0), neither with a page.',
      },
      {
        type: 'prose',
        title: 'PII redaction',
        text: [
          'A guardrail with **Redact PII** on rewrites the request before it is forwarded, so the model never sees the value: `"reach me at {{EMAIL_ADDRESS_1}} or {{PHONE_NUMBER_1}}"`. Each instance is numbered; redaction is irreversible and `transformed: true` marks it in `hook_results`. Since gateway 2.26.0 it applies to embedding requests too. Or use a **Regex Replace** check with your own pattern and replacement text (`[SSN_REDACTED]`).',
          'Which providers redact depends on the page: the PII Redaction page names five — the PRO PII check, Patronus, Pangea, AWS Bedrock Guardrails and Promptfoo — while redact or anonymise options also appear on the Azure PII, CrowdStrike AIDR, F5, Prompt Security, Lakera (when only PII categories fire), Cato Networks and Acuvity pages. The Patronus page itself shows an output-only check with no redact switch.',
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
          ['Organisation', 'Admin Settings → **Organisation Guardrails**, or the Admin API: `POST https://api.apps.paloaltonetworks.com/ai_gw/admin/v2/guardrails` with an SCM token', 'Input and/or output guardrails on every request in the organisation. Same body as a workspace guardrail (`name`, `target` `llm` or `mcp_tools`, `checks`, `actions`). Workspace exclusions are API-only: `PUT …/ai_gw/admin/v2/workspace-exclusions/input-guardrails` (or `output-guardrails`), body `organisation_id` plus `workspaces: [{ workspace_id, excluded }]`.'],
          ['Workspace', 'The workspace → Edit', 'One input and one output guardrail, created in that workspace, enforced on every request in it.'],
          ['API key', 'The key\'s default config, with **Allow Config Override** off', 'The caller cannot swap the config away (400).'],
          ['Tenant', '**Block Inline Configs**', 'No request can bring its own raw guardrails or providers.'],
        ],
        note: 'The docs do not say in what order organisation, workspace and config guardrails run, or how their verdicts combine — only that `startHooks` run before everything else.',
      },
    ],
  },

  {
    id: 'gw-observability',
    group: 'gateway',
    title: 'Logs, traces, metadata and OpenTelemetry',
    sub: 'Every request logged — and tied to its AIRS verdict by one id',
    minutes: 9,
    level: 'Build',
    docs: pick('agLogs', 'agTraces', 'agMetadata', 'agFeedback', 'agAnalytics', 'agLogsExport', 'agOtel', 'agOtelExport', 'agOtelLogs', 'arLogsInsert', 'agReqLogging', 'agEnforceMeta', 'agCost'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Every request through the gateway lands in **Observability → Logs** in Strata Cloud Manager: model, provider, tokens (thinking tokens included), cost, latency, the raw request and response, the config used and — if a guardrail ran — its verdict. A status column shows what the config did: `Cache Hit` / `Cache Semantic Hit` / `Cache Miss`, `Retry Success on {x} Tries`, `Fallback Active`, `Loadbalancer Active`. Since gateway 2.24.0 each retry attempt is also its own log row under the same trace id.',
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
        type: 'callout', tone: 'tip', title: 'One id, two consoles — send it yourself',
        text: [
          'With the Prisma AIRS guardrail on, the Simple Setup page says a trace id **passed on the request** resolves on the Prisma AIRS side under **AI Runtime → AI Sessions**. Quote the `x-portkey-trace-id` of a blocked request and both the gateway log and the AIRS scan are one search away.',
          'Send the header rather than relying on the generated one: the open-source gateway\'s Prisma AIRS plugin uses the caller\'s `x-portkey-trace-id` as the AIRS `tr_id` and a random UUID when there is none. That is from the plugin code, not the docs, and the SaaS build may differ.',
        ],
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
      { type: 'code', title: 'Feedback on a request', text: '`value` is an integer from -10 to 10 (thumbs up/down = 1 / -1); `weight` 0–1, default 1. This is the Feedback page\'s form — gateway host, gateway key with `logs.write`. The API reference instead serves `POST /feedback` (and `PUT /feedback/{id}`) from the Admin API, `https://api.apps.paloaltonetworks.com/ai_gw/v2`, with an SCM token; test which your tenant accepts.', tabs: [{ id: 'curl', lang: 'curl', code: FEEDBACK_CURL }] },
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
          ['What', 'Your app\'s own OTel traces and logs (Vercel AI SDK, OpenLLMetry, OpenLIT, Logfire, Phoenix, MLflow…) shown next to gateway requests, costed from `gen_ai.usage.*`', '**Analytics** (aggregated counts, latency, tokens, cost — stable) and **Complete logs** (full prompts and completions in GenAI semantic conventions 1.40.0 — experimental)'],
          ['How', 'OTLP over HTTP to `https://aigw.portkey.ai/v1/otel` (or `/v1/otel/v1/traces`, `/v1/otel/v1/logs`) with `Authorization=Bearer <key>`; the MLflow page sends `http/protobuf`', 'Environment variables on the gateway process — `OTEL_PUSH_ENABLED`, `OTEL_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`; `EXPERIMENTAL_GEN_AI_OTEL_*` — then a redeploy'],
          ['Where', 'SaaS and hybrid', 'In practice hybrid only: both are gateway environment variables, which a SaaS tenant cannot set, and the Complete Logs page says self-hosted only'],
          ['Delivery', 'Costed and shown in the logs', 'Complete logs: OTLP HTTP/JSON, one push per log (no batching), no retry — logs are lost while the endpoint is down; sent after the response, so no added latency. The same switch emits guardrail spans `portkey.guardrail.*` (2.12.0).'],
        ],
      },
      { type: 'code', title: 'Point an OTel SDK at the gateway', tabs: [{ id: 'bash', lang: 'bash', code: OTEL_ENV }] },
      { type: 'code', title: 'Export logs', text: 'Up to 50,000 logs per job, as JSONL. The same flow exists in the console under Exports → Request Data. From the Logs Export product page; the API reference has no export endpoints.', tabs: [{ id: 'bash', lang: 'bash', code: LOG_EXPORT }] },
      { type: 'code', title: 'Insert a log from elsewhere', text: 'Calls your app makes outside the gateway can be written into the same logs with `POST /v1/logs` (API reference: `request` with `url` and `body`, `response` with `body`, optional `metadata`). The Admin API introduction lists this endpoint under the Admin API, which takes only SCM tokens, while the AB03 help page gives gateway-key scopes for it — test which credential your tenant accepts.', tabs: [{ id: 'bash', lang: 'bash', code: LOG_INSERT }] },
      {
        type: 'callout', tone: 'warn', title: 'Streamed requests cost 0 unless you ask for usage',
        text: 'For streamed completions the gateway logs tokens and cost only when the request sends `stream_options: { "include_usage": true }` — the usage arrives in the final chunk. This portal\'s gateway chats send it; counting SSE chunks is not a token count. A model with no pricing data shows 0 cents, and budget limits do not apply to it.',
      },
      {
        type: 'callout', tone: 'docs', title: 'What the developer docs leave out',
        text: [
          'No request-log retention period is given there (the Palo Alto Networks admin guide gives one year — see "What the AI Gateway is"); the only retention claim nearby is the Audit Logs page\'s "indefinite", for audit logs.',
          'The OTLP ingest URL is `/v1/otel` in the OpenTelemetry page\'s environment block, the OTel Python SDK page and changelog 1.11.1, but `/v1/logs/otel` in the same page\'s Getting Started step and on the Logfire, OpenLIT, MLflow, Phoenix and Traceloop pages. The export field names differ between the create example (`ai_provider`, `request_tokens`, `status_code`…) and the denied-fields list (`ai_org`, `req_units`, `response_status_code`…) — test against your tenant.',
        ],
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
    minutes: 10,
    level: 'Build',
    docs: pick('agUniversal', 'agChat', 'agMessages', 'agResponses', 'agDecisions', 'agMultimodal', 'agThinking', 'agStrict', 'agCustomHosts', 'agCustomModels', 'agRemoteMcp', 'agNitro', 'agGrpc', 'agBeta', 'agHeaders', 'agApiRef', 'agBedrockLlm', 'agVertexLlm', 'agMantle'),
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
          ['Responses', 'OpenAI, Azure OpenAI, xAI, Groq, OpenRouter, Azure AI, Perplexity — and Bedrock Mantle (its integration page)', 'Anthropic, Gemini, Vertex AI, Bedrock, Mistral and the rest', 'Anything stateful: `previous_response_id`, `store`, `GET`/`DELETE /responses/{id}`, and the built-in `web_search` / `file_search` / `computer_use` tools — only `function` tools translate, except gateway-run MCP tools (Remote MCP, below). Cancel and input-token counting (2.25.1) work only where the upstream has them.'],
          ['Messages', 'Anthropic; Claude on Bedrock; per the integration pages also Claude on Vertex AI and Azure AI Foundry, Claude Platform on AWS and Bedrock Mantle', 'Everything else, via Chat Completions', '`thinking`, `top_k`, `cache_control`, `container`, `mcp_servers` (except gateway-run MCP), `service_tier`, `anthropic_beta` — dropped silently, no error'],
        ],
        note: 'The Messages page lists only Anthropic and Bedrock Claude as native and calls Vertex AI an adapter, while the Vertex AI page, the Supported Providers matrix and changelog 2.27.0 (`context_management` and `safeguards` for Claude on Vertex) treat Claude on Vertex as native. The Bedrock and Vertex AI pages also still say `/messages` works only with Claude models; the Universal API and Messages pages say any provider. Test a non-Claude model on `/messages` before relying on it.',
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
          ['`x-portkey-provider: openai` + your own provider key in `Authorization`', 'Bring-your-own-credential; the gateway key moves to `x-portkey-api-key`. The raw provider name is rejected (`inline_provider_blocked`) when Block Inline Configs is on; the saved-only page still allows your own credential in `Authorization` alongside a saved `@slug`.'],
        ],
      },
      {
        type: 'prose',
        title: 'Decisions — a typed answer instead of text',
        text: [
          '`/v1/decisions` returns a judgment per question: `noul` (a yes/no probability), `choice` (one label from a set, with probabilities) or `score` (a position on a scale). It is served by TypeSafe\'s Jev models — directly, or through OpenRouter since gateway 2.27.0 — without streaming. Input guardrails scan only the `state` field — never the questions or criteria; a soft deny answers with empty `answers` and the guardrail message.',
          'The sample sends `x-portkey-provider: @typesafe`, meaning a Model Catalog integration with the slug `typesafe`. The Decisions page writes `typesafe` without the `@` — a raw provider name, which Block Inline Configs rejects with `inline_provider_blocked`.',
        ],
      },
      { type: 'code', tabs: DECISIONS_TABS },
      {
        type: 'table',
        title: 'Everything else behind the same URL',
        columns: ['Capability', 'Endpoint and notes'],
        minWidth: 600,
        rows: [
          ['Embeddings', '`/v1/embeddings` — input guardrails apply'],
          ['Rerank · OCR · moderations', '`/v1/rerank` (Cohere, Jina, Voyage, Vertex, Bedrock…), `/v1/ocr` (Mistral, Azure AI Foundry; 2.18.0), `/v1/moderations` (no guardrails). The Capabilities page does not mention rerank or OCR.'],
          ['Images', '`/v1/images/generations`, edits, variations — no guardrails; edits need the provider in a header'],
          ['Speech', '`/v1/audio/speech`, `/transcriptions`, `/translations` — no guardrails'],
          ['Files, batches, fine-tuning', '`/v1/files`, `/v1/batches`, `/v1/fine_tuning/jobs` — provider batch APIs, or gateway-managed batching (needs the Data Service)'],
          ['Function calling', 'OpenAI `tools` / `tool_choice` across providers; guardrails read tool-call JSON as text'],
          ['Thinking (beta)', 'Reasoning arrives in `content_blocks` (needs strict compliance off). Send the signed `thinking` block back on the next turn — the docs show it for Anthropic, Bedrock and Claude on Vertex AI. Gemini 3 tool calling needs each `thought_signature` echoed back, which needs `x-portkey-strict-open-ai-compliance: false` on every request. Effort mapping: next table.'],
          ['Realtime', '`wss://aigw.portkey.ai/v1/realtime?model=…` — OpenAI Realtime with logs and cost'],
          ['Model list', '`GET /v1/models`. Any provider signal makes it proxy the provider\'s own list; `x-portkey-fetch-integrated-models: true` forces the Model Catalog. Sent with `anthropic-version`, it answers in Anthropic\'s shape (2.22.0).'],
          ['Other provider paths', 'Any `/v1/<provider path>` with `x-portkey-provider: @slug` — configs and logging apply, the response is not transformed, and guardrails do not run (except a webhook check with `executeOnProxy`, 2.20.0). Only a card on the AI Gateway page here; the full page is in Portkey\'s own docs.'],
        ],
      },
      {
        type: 'table',
        title: 'How a reasoning effort is mapped',
        columns: ['Provider', 'What `reasoning_effort` / `reasoning.effort` becomes'],
        rows: [
          ['OpenAI o-series', 'Sent as is'],
          ['Anthropic', '`thinking.budget_tokens`: low 1,024 · medium 8,192 · high 16,384 · xhigh 32,768'],
          ['Claude on Bedrock', 'Opus / Sonnet 4.6: adaptive thinking. Other Claude reasoning models: a share of `max_tokens` — minimal 10 %, low 20 %, medium 50 %, high 80 % (at least 1,024; `max_tokens` must exceed 1,024). `none` turns thinking off.'],
          ['Gemini 2.5 (Vertex)', '`thinking_budget`: low 1,024 · medium 8,192 · high 24,576'],
          ['Gemini 3.0+ (Vertex)', '`thinkingLevel`: minimal, low, medium, high'],
        ],
        note: 'An explicit `thinking` object wins over the effort. Sources: the Responses page (Anthropic, Gemini 2.5, OpenAI), and the Bedrock and Vertex AI integration pages.',
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
          ['Custom host', '`x-portkey-custom-host`, a config target\'s `custom_host`, or `custom_host` (+ `custom_headers`) on a Model Catalog model', 'With Block Inline Configs on, a host supplied with the request is refused (`inline_custom_host_blocked`); set it on the saved provider (the saved-only page\'s fix) or per model in the Model Catalog. The URL includes `/v1`, is `http(s)` with no embedded credentials and at most 2,048 characters. On SaaS the host must be publicly reachable: private ranges, cloud metadata addresses and internal names (`.local`, `.internal`, `cluster.local`…) are refused, and so are ports 22, 25, 445, 3306, 5432, 6379, 6443, 9200 and 27017 (80, 443, 8000, 8080, 8443 are fine). `TRUSTED_CUSTOM_HOSTS` exists only on hybrid gateways.'],
          ['Remote MCP (beta)', '`x-portkey-beta: server-side-mcp-2026-06-01`. Responses: an `mcp` tool with `server_label: "@portkey-mcp/<server>"`. Messages: `mcp_servers: [{ "type": "url", "name": "@portkey-mcp/<server>" }]` plus an `mcp_toolset` tool with `mcp_server_name: "@portkey-mcp/<server>"`', 'The gateway fetches the tools and runs them, so Bedrock and Vertex models can use them; `server_url`, `server_description` and `require_approval` are ignored with the prefix. Only an entry that points at an external URL is provider-run, outside the gateway\'s audit. The page\'s "runs within your own VPC" holds for hybrid only, and its SDK snippets misspell the header `x-portkey-portkey-beta`.'],
          ['Nitro mode (beta)', '`x-portkey-nitro-mode: true`, provider by header or a single-provider config', 'Streams the body untouched — so no retries, no `override_params`, `cache` silently ignored, one target only, and **no input guardrails, including organisation and workspace defaults** (violations get a 4xx). Incompatible with an AIRS input guardrail. Only chat and embeddings on OpenAI, Fireworks and OpenRouter, `/v1/messages` on Anthropic, `/v1/responses` on OpenAI and OpenRouter — not Bedrock or Vertex. Enabled through the account team.'],
          ['gRPC (beta)', 'Service `gateway.Gateway` on a self-run gateway (`npm start -- --llm-grpc`, port 8789 by default)', 'No SaaS endpoint is given. Errors come back inside the response\'s `status_code` while the gRPC call itself returns OK; HTTP headers arrive as trailing metadata. No realtime; files and batches only through the HTTP proxy mode.'],
          ['Beta flags', '`x-portkey-beta: use-responses-api-2026-07-30` (comma-separate several)', 'The Beta Features page: routes `/messages` for non-Anthropic providers through the Responses adapter. Changelog 2.17.0 describes the same flag as opting into the July 2026 Responses API contract.'],
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
    minutes: 7,
    level: 'Build',
    docs: pick('agAgentGw', 'agAgentQuick', 'agAgentReg', 'agAgentServers', 'agAgentCat', 'agOpenaiAgents', 'agLanggraph', 'agStrands', 'agLangchain', 'agVercel', 'agOpenaiCompat'),
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
          { title: 'Provision it to workspaces and set access', text: 'Choose which workspaces may call it, then control access to the agent itself and to each of its skills and capabilities. Access for specific users, and skills per workspace or per user, are listed as coming soon.' },
          { title: 'Create a key that may invoke agents', text: 'A workspace API key with the **Agent Gateway** toggle and the `agents.invoke` scope.' },
          { title: 'Swap the URL', text: 'Callers use `https://aigw.portkey.ai/agent/{agent-slug}` instead of the agent\'s own URL, with `Authorization: Bearer <gateway key>`. Copy the exact address from the console — this portal\'s tenant already serves MCP from a different host than the docs show.' },
        ],
      },
      { type: 'code', title: 'Calling an agent through the gateway', text: 'The docs use the earlier A2A names (`tasks/send`, `/.well-known/agent.json`) and POST for the agent card; current A2A clients may call `message/send` and GET `agent-card.json`.', tabs: [{ id: 'curl', lang: 'curl', code: A2A_CURL }] },
      {
        type: 'callout', tone: 'docs', title: 'What the Agent Gateway does not document yet',
        text: [
          'No guardrail, rate-limit or budget configuration for agent-to-agent traffic is described. Today it is authentication, access to the agent and its skills per workspace, and logging; per-user access is "coming soon". To scan what an agent sends and receives, scan its tool calls with the Runtime API.',
          'The route differs too: the Servers and Quickstart pages use `https://aigw.portkey.ai/agent/{agent-slug}`, while changelog 2.6.1 announced the preview as `/v1/agent/:agentServerId/*`. Neither has been tried from this portal.',
        ],
      },
      {
        type: 'cards',
        items: [
          { icon: Network, tone: '#2dd4bf', title: 'Scan every tool call', kicker: 'Agents & MCP',
            text: 'Two-stage `tool_event` scans — parameters before a tool runs, output before the agent reads it.', go: 'mcp-tool-events', goLabel: 'Open the guide' },
          { icon: Layers, tone: '#38bdf8', title: 'Frameworks with Prisma AIRS built in', kicker: 'Integrations',
            text: 'The same frameworks protected without the gateway — SDK hooks, AWS and Microsoft Foundry samples, n8n and coding-assistant hooks.', go: 'int-frameworks', goLabel: 'Open the guide' },
        ],
      },
    ],
  },

  {
    id: 'gw-coding',
    group: 'gateway',
    title: 'Claude Code, Codex and Cursor through the gateway',
    sub: 'Central keys, budgets, logs and guardrails for coding agents',
    minutes: 8,
    level: 'Build',
    docs: pick('agCoding', 'agClaudeCode', 'agClaudeBedrock', 'agClaudeVertex', 'agClaudeAnthropic', 'agCodex', 'agCursor', 'agMcpClaude', 'gwDevGuard', 'agChangelog'),
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
          ['Model discovery', 'Since gateway 2.22.0, `/v1/models` answers in Anthropic\'s shape when the caller sends `anthropic-version`, so Claude Code can list models through the gateway.'],
          ['Guardrail blocks', 'A 446 can end a Claude Code session; the `soft_deny_200` flag (2.14.0) was added for exactly this client and returns the block as an HTTP 200 answer — what this portal\'s tenant does.'],
        ],
      },
      {
        type: 'callout', tone: 'warn', title: 'The two mistakes the docs warn about',
        text: '`CLAUDE_CODE_USE_BEDROCK` / `CLAUDE_CODE_USE_VERTEX` with `ANTHROPIC_BEDROCK_BASE_URL` pointing at the gateway gives `API Error: 500 fetch failed` — use the plain Anthropic variables above for every provider. A `/v1` on the base URL turns requests into an unprocessed passthrough (a ⚡ in the gateway logs).',
      },
      {
        type: 'callout', tone: 'docs', title: 'Where the pages disagree',
        text: [
          '`anthropic-beta`: the Claude Code and Claude Code with Anthropic pages add `forward_headers: ["anthropic-beta"]` to a **saved config** (`{ "provider": "@anthropic-prod", "forward_headers": ["anthropic-beta"] }`); the saved-only page also allows forward headers set by an admin on the saved provider; the Bedrock and Vertex pages say the gateway filters and remaps the header itself. Changelog 2.22.0 settles the Anthropic-direct case: an incoming `anthropic-beta` / `anthropic-version` now reaches Anthropic (and Bedrock Mantle, Claude Platform on AWS) when neither the provider nor the config sets one. Forward headers on the request itself are blocked by Block Inline Configs.',
          'Model names on Vertex: the Claude Code with Vertex page uses Anthropic-style names (`claude-sonnet-…`), while the Vertex AI integration page writes Claude as `anthropic.<model>` — check which your tenant accepts.',
          'The Claude Code, Codex and coding-agent pages recommend the `npx portkey` CLI to write these settings, but its own guide writes `https://api.portkey.ai` and expects an app.portkey.ai account — the wrong host for an SCM tenant. Check the result, or write the settings by hand as above.',
        ],
      },
      {
        type: 'callout', tone: 'tip', title: 'The AIRS guardrail for coding agents',
        text: 'Set the Prisma AIRS guardrail to `scan_scope: "last_user_message"` with `strip_scaffolding: true`: the agent\'s harness text (system reminders, tool instructions) is not scanned as if the user wrote it. The PANW page says `tool_result` content is kept and scanned **regardless of** `strip_scaffolding` — not regardless of `scan_scope`. With `last_user_message`, only the newest user turn is scanned; in the Messages format that is where the latest tool result sits, which is where indirect prompt injection arrives. See "The AIRS guardrail in the gateway".',
      },
      { type: 'code', title: 'OpenAI Codex', text: 'Codex can send headers: `http_headers` (static) and `env_http_headers` (from environment variables) on the provider block can carry `x-portkey-config` — or attach the config to the key and send nothing. Current Codex speaks only the Responses API (`wire_api = "responses"`; the AIGW Codex page still shows `"chat"` as the default), so with a non-OpenAI model the gateway\'s Responses adapter applies — untested here.', tabs: [{ id: 'bash', label: 'config.toml', lang: 'bash', code: CODEX_TOML }] },
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

// Policy bodies in the API reference's flat shape (create schemas for
// POST /policies/usage-limits and /policies/rate-limits). Not run from here.
const POLICY_TABS = [
  { id: 'usage', label: 'Usage limit — $50 per user per month', lang: 'json', file: 'usage-policy.json', code: `{
  "name": "per-user-50-usd-monthly",
  "conditions": [{ "key": "metadata._user", "value": "*" }],
  "group_by": [{ "key": "metadata._user" }],
  "type": "cost",
  "credit_limit": 50,
  "alert_threshold": 40,
  "periodic_reset": "monthly",
  "workspace_id": "<workspace-id>"
}` },
  { id: 'rate', label: 'Rate limit — 1,000 rpm per workspace', lang: 'json', file: 'rate-policy.json', code: `{
  "name": "workspace-1000-rpm",
  "conditions": [{ "key": "api_key", "value": "*" }],
  "group_by": [{ "key": "workspace_id" }],
  "type": "requests",
  "unit": "rpm",
  "value": 1000,
  "target": "llm",
  "workspace_id": "<workspace-id>"
}` },
  { id: 'exclude', label: 'Exclude one model', lang: 'json', file: 'usage-policy.json', code: `{
  "name": "openai-except-gpt-4o",
  "conditions": [{ "key": "model", "value": "@openai/*", "excludes": "@openai/gpt-4o" }],
  "group_by": [{ "key": "api_key" }],
  "type": "cost",
  "credit_limit": 200,
  "periodic_reset": "monthly",
  "workspace_id": "<workspace-id>"
}` },
  { id: 'curl', label: 'Send it', lang: 'curl', code: `# Admin API: an SCM service-account token — a gateway key gets 401 (AB05)
curl -X POST https://api.apps.paloaltonetworks.com/ai_gw/v2/policies/usage-limits \\
  -H "Authorization: Bearer $SCM_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d @usage-policy.json

curl -X POST https://api.apps.paloaltonetworks.com/ai_gw/v2/policies/rate-limits \\
  -H "Authorization: Bearer $SCM_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d @rate-policy.json` },
]

export const AIGW_GOVERNANCE = [
  {
    id: 'gw-governance',
    group: 'gwgov',
    title: 'Keys, budgets and rate limits',
    sub: 'Who may call what, how much and how fast — enforced at the gateway',
    minutes: 10,
    level: 'Setup',
    docs: pick('agKeys', 'agKeyRotation', 'agBudget', 'agRate', 'agKeyLimits', 'agWsLimits', 'agPolicies', 'arUsagePolicy', 'arRatePolicy', 'arAdminAuth', 'agDefaultCfg', 'agSavedOnly', 'agCatalog', 'agWsProv', 'agModelProv', 'agPricing', 'agSecretRefs', 'agAb03'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Two kinds of credential, never interchangeable: **gateway API keys** authenticate inference (models, MCP, agents), and the **Admin API** is called with a Strata Cloud Manager access token issued to a service account (15 minutes; see "Org admin: workspaces, roles, SSO and directory sync" for the base URLs). A key\'s scopes say what it may do on the inference path.',
          'Keys come in two levels. **Admin keys** belong to the organisation and act across workspaces; **workspace keys** are scoped to one workspace and are either **Service** keys (automation, CI) or **User** keys (one person, so every log line names them). Only workspace keys can call the completion APIs.',
        ],
      },
      {
        type: 'table',
        title: 'Inference scopes worth knowing',
        columns: ['Scope', 'Allows'],
        rows: [
          ['`completions.write`', 'API Keys page: `/chat/completions`, `/completions`, `/images`, `/audio`. The AB03 help page: every data-plane endpoint — also `/responses`, `/messages`, `/embeddings`, files, batches, fine-tuning, `/realtime`, `/models`, `/decisions`'],
          ['`mcp.invoke` · `agents.invoke`', 'Calling MCP servers and A2A agents through the gateway'],
          ['`guardrails.invoke` · `prompts.render`', 'Running guardrails and rendering prompt templates directly'],
          ['`logs.view` · `logs.list` · `logs.export` · `logs.write` · `analytics.view`', 'Reading, exporting and inserting logs; analytics'],
          ['`workspace_user_api_keys.*` · `workspace_service_api_keys.*`', 'Managing other keys — Service keys only'],
        ],
        note: 'Admin keys carry organisation scopes (`workspaces.*`, `organisation_guardrails.*`, `audit_logs.list`, `secret_references.*`…) but not `completions.write`. The same API Keys page says no gateway key is accepted on the Admin API, so it leaves open what an Admin key is for on an SCM tenant; the AB03 page says audit logs need one.',
      },
      { type: 'code', title: 'Create a service key with policy attached', text: 'The default config and metadata ride on the key; the rotation policy rotates its secret monthly with a one-day overlap.', tabs: [{ id: 'curl', lang: 'curl', code: KEY_CREATE }] },
      {
        type: 'table',
        title: 'Rotation',
        columns: ['', 'Detail'],
        rows: [
          ['What changes', 'Only the secret — the key id, its budget, attribution and analytics stay.'],
          ['Manual', '`POST https://api.apps.paloaltonetworks.com/ai_gw/v2/api-keys/{id}/rotate` (SCM token) with an optional `key_transition_period_ms` (minimum 30 minutes). Returns the new `key` and `key_transition_expires_at`. Both secrets work during the transition; at most two at a time, and no new rotation while one is running.'],
          ['Automatic', '`rotation_policy`: `weekly` (Monday 00:00 UTC), `monthly` (the 1st) or `rotation_period_days` 1–365 — the last is on the rotation page but not in the API reference schema. Email warnings 24 hours ahead.'],
          ['Enforced', '`user_api_key_rotation_period` (1–365 days) applies to newly created workspace user keys that have no policy of their own, organisation-wide or per workspace.'],
        ],
      },
      {
        type: 'table',
        title: 'Where budgets and rate limits live',
        columns: ['Level', 'Where', 'Notes'],
        minWidth: 640,
        rows: [
          ['Integration, per workspace', 'Integration → Workspace Provisioning → Edit Budget & Rate Limits', 'Cascades to every provider made from the integration. A rate limit of 0 disables the provider.'],
          ['API key', 'The key → Add Budget Limit / rate limit, when creating or editing it', 'Email at the alert threshold; requests keep flowing until the limit.'],
          ['Workspace', 'Workspace Control → **Budget Allocation**', 'Applies whichever key is used.'],
          ['Policy', '`POST https://api.apps.paloaltonetworks.com/ai_gw/v2/policies/usage-limits` or `/rate-limits` (SCM token)', 'Conditions plus `group_by` — e.g. one counter per user, per model or per key.'],
          ['JWT', 'the `usage_limits` claim', 'Each distinct token is tracked separately.'],
        ],
      },
      {
        type: 'table',
        title: 'How limits behave',
        columns: ['', 'Budget (usage limit)', 'Rate limit'],
        rows: [
          ['Measured in', 'Cost in USD (min $1), tokens (min 100) or — in policies, per the product page — requests', 'Requests or tokens per minute, hour or day (`rpm` / `rph` / `rpd`); policies add `rpw`, and the API-key create schema also accepts `rps` and `rpw`'],
          ['Resets', 'Integration and key: never, weekly or monthly. Workspace and policies: also every N days', 'Each window'],
          ['When exceeded', '**412** Precondition Failed', '**429** Too Many Requests'],
          ['Editing', 'Integration-level: cannot be edited by anyone once set. API key: set or changed when creating or editing the key. Policy: `PUT` (conditions too, Backend 1.16.0+)', 'Same'],
        ],
        note: 'A model with no pricing data logs 0 cents and does not count towards a cost budget. Integration, key and workspace budgets email at the alert threshold; a policy\'s `alert_threshold` only writes an audit-log event — the docs say emails are not sent yet.',
      },
      { type: 'code', title: 'Policies as code', text: 'Bodies in the API reference\'s flat shape; required are `conditions`, `group_by`, `type` and `credit_limit` (usage) or `unit` and `value` (rate). Not run from this portal.', tabs: POLICY_TABS },
      {
        type: 'table',
        title: 'How a policy matches and counts',
        columns: ['', 'Rule'],
        rows: [
          ['Conditions', 'All conditions must match (AND); a `value` array matches any of its entries (OR); `"*"` is a wildcard; `excludes` carves values out.'],
          ['Keys', '`api_key` and `metadata.*` (gateway 1.17.0+), `model` (2.0.0+, `@provider/*` wildcards, matched on the model name in the request), `virtual_key`, `provider`, `config`, `prompt`; `workspace_id` only in `group_by`; rate policies also `endpoint_type`. With `target: "mcp_tools"` (immutable; gateway 2.18.0+, Backend 1.24.0+): `mcp_server`, `mcp_tool`.'],
          ['Counters', 'One per distinct `group_by` value. List them with `GET …/policies/usage-limits/{id}/entities`, reset one with `PUT …/entities/{entityId}/reset`.'],
          ['Resets', '`periodic_reset` `weekly` or `monthly`, or `periodic_reset_days` 1–365 — mutually exclusive; `next_usage_reset_at` moves the next one.'],
          ['Availability', 'The policies page opens with "Available on self-hosted deployments. Requires 1.17.0 or higher" — unclear whether that is a version gate or self-hosted only; the API reference lists the endpoints on the SaaS Admin API.'],
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Two published shapes for a policy',
        text: 'The policies product page posts `{ "type": "usage_limits", "policy": { …, "status": "active" } }` to `/v1/policies/usage-limits` with `x-portkey-api-key`, marks `name` required yet omits it in every use case, and adds `requests` as a usage type and `periodic_reset_days` on create. The API reference posts a flat body to `https://api.apps.paloaltonetworks.com/ai_gw/v2/policies/…` with an SCM token, has no `type` / `policy` wrapper and no `status`, makes `name` optional, and its usage `type` is only `cost` or `tokens` (`periodic_reset_days` appears on update). The tabs follow the reference — the Admin API introduction says to trust it where pages disagree.',
      },
      {
        type: 'table',
        title: 'Enforced policy — what a caller cannot opt out of',
        columns: ['Control', 'Where', 'What the caller sees'],
        minWidth: 640,
        rows: [
          ['Default config, override off', 'The key → Config, **Allow Config Override** off', '400 on any request that sends a different config'],
          ['Block Inline Configs', 'Admin Settings → Security → Data Plane Security Settings', '400 with a specific code (below) — only saved `pc-…` configs and `@slug` providers'],
          ['Model provisioning', 'Integration → Model Provisioning: all models or an allow-list', 'A rejected request for any model outside the list. Since gateway 2.27.0 a Bedrock allow-list also admits `us.*` inference profiles of an allowed base model, and application inference-profile ARNs.'],
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
          ['Integration', 'Stored provider credentials at organisation level, shared into workspaces. Bedrock page: access key, assumed role or Bedrock API key. Vertex AI page: service-account JSON, project + region with the caller\'s own OAuth token, or workload identity where the gateway runs on Google Cloud. The Admin API schema knows only `aws_auth_type` `accessKey` | `assumedRole` and `vertex_auth_type` `basic` | `serviceAccount` — Bedrock API key and workload identity may be console-only.'],
          ['Provider (`@slug`)', 'What a workspace sees when an integration is shared with it. One integration can back `@openai-dev`, `@openai-prod`…'],
          ['Custom model', 'A fine-tuned or private model with a base model for API compatibility, optional custom pricing, host and headers.'],
          ['Pricing adjustment', 'A multiplier per integration (`0.8` = 20% off) so cost tracking matches your negotiated rate. Since 2.22.0 also per model — a model-level adjustment replaces the integration\'s rather than merging.'],
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
        text: [
          'Weekly budgets reset on **Sunday** 00:00 UTC on the budget-limit pages (integration, key, workspace) but **Monday** on the policies page — and weekly key rotation is Monday too.',
          'For the Admin API the reference now states one rule: an SCM service-account token on every endpoint, served from `api.apps.paloaltonetworks.com/ai_gw/v2` or `/ai_gw/admin/v2` by resource; a gateway key gets 401 (`AB05`). The policies, secret-references, MCP-guardrails and feedback product pages still show `aigw.portkey.ai/v1/…` with a gateway key; the Admin API introduction says to trust the reference page where they disagree.',
        ],
      },
    ],
  },

  {
    id: 'gw-admin',
    group: 'gwgov',
    title: 'Org admin: workspaces, roles, SSO and directory sync',
    sub: 'Organisation → workspace → user, and how people get there',
    minutes: 9,
    level: 'Setup',
    docs: pick('agOrgMgmt', 'agWorkspaces', 'agRoles', 'agAccessCtl', 'agSso', 'agScim', 'agScimGroups', 'agCie', 'agAudit', 'agKms', 'agSecurity', 'agGatewayUrls', 'agGwRegister', 'arAdminIntro', 'arAdminAuth', 'arAdminErrors', 'arDeployments'),
    blocks: [
      {
        type: 'prose',
        text: 'The tenancy model is **Organisation → Workspace → User or machine**. The organisation is the Strata Cloud Manager tenant (one TSG is one organisation). Integrations — the provider credentials — are organisation-level and shared into workspaces; configs, providers, guardrails and keys live in a workspace, and people and service keys act inside one. A user must belong to the organisation before joining a workspace.',
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
          ['Workspace', 'Member', 'Read-only per the roles page; the access-control page lets members create configs and guardrails, and the SCIM page says "read and write" — the access settings below decide'],
        ],
      },
      {
        type: 'table',
        title: 'Access settings (Admin Settings → Security)',
        columns: ['Setting', 'Controls'],
        rows: [
          ['Logs', 'Whether managers, members and organisation admins see logs, and logs metadata (all on by default)'],
          ['Analytics', 'Whether managers and members see analytics'],
          ['Data visibility', 'Off: a role sees only logs, traces and analytics from its own keys; service-key and JWT-authenticated traffic is hidden from it'],
          ['API keys', 'Managers: service and user keys. Members: only their own user keys'],
          ['Guardrails', 'Managers view and write, members view (defaults)'],
          ['Integrations · Providers', 'Managers may write workspace integrations, MCP integrations and MCP servers (on by default); providers: both roles view, managers manage'],
        ],
        note: 'Analytics, data visibility, guardrails, integrations and providers can allow a workspace-level override; the docs show none for logs or API keys, and no page for prompt permissions.',
      },
      {
        type: 'table',
        title: 'Getting people in',
        columns: ['Method', 'How it works', 'Notes'],
        minWidth: 660,
        rows: [
          ['SSO', 'OIDC or SAML 2.0; first sign-in provisions the user', 'Only verified **Allowed Domains** are provisioned; auto-provisioning can be turned off.'],
          ['SCIM', 'Entra ID or Okta push users and groups; a group maps to one or more workspaces with one role across all of them', 'Okta: SAML apps only, and groups must be pushed. Pattern mapping defaults to `ws-{Workspace}-role-{admin|manager|member}`; prefix and separator are configurable (Admin Settings → Authentication Settings → SCIM Provisioning → Pattern Based SCIM Grouping). Deleting a mapping keeps its users in the workspace — cleanup happens only when the IdP deletes the group.'],
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
        text: 'Turning Directory Sync off removes every CIE user from their workspaces and deletes all group mappings; turning it back on does not restore them. Deleting one CIE mapping removes its users at once — the opposite of SCIM, where they stay. The docs also name no role for CIE-mapped users, unlike SCIM mappings.',
      },
      {
        type: 'table',
        title: 'Security and audit',
        columns: ['Topic', 'Detail'],
        minWidth: 600,
        rows: [
          ['Audit logs', 'Admin Settings → Audit Logs (owners and admins): who, what, which resource, status, client IP and country. Key rotations, invalid JWTs and every Admin API call are recorded too. The page claims indefinite retention; there is no audit-log endpoint in the API reference.'],
          ['Encryption', 'TLS 1.2+ in transit, AES-256 at rest. Provider keys are decrypted only in memory, in sandboxed workers.'],
          ['Bring your own key', 'AWS KMS only (envelope encryption) for configs, integration credentials, prompts, guardrails and SSO secrets.'],
          ['Gateway URLs', 'Settings → Organisation → General: the gateway and MCP gateway URLs shown in snippets — self-hosted deployments.'],
          ['Hybrid data plane', 'Admin Settings → Gateway Registration → download `values.yaml` (shown once) → Helm. Or the Admin API: `POST https://api.apps.paloaltonetworks.com/ai_gw/admin/v2/deployments` (`name`, `type`, `auth_settings` with `gateway_base_url` / `mcp_gateway_base_url`) returns `client_auth` and `credentials`; `GET …/deployments/{id}/ping` checks reachability.'],
        ],
      },
      {
        type: 'table',
        title: 'The Admin API — one credential, three base URLs',
        columns: ['Base URL', 'Serves'],
        rows: [
          ['`https://api.apps.paloaltonetworks.com/ai_gw/v2`', 'Configs, workspace guardrails, providers, API keys, usage and rate-limit policies, MCP servers, analytics, feedback'],
          ['`https://api.apps.paloaltonetworks.com/ai_gw/admin/v2`', 'Integrations, MCP integrations, secret references, deployments (hybrid data planes), organisation guardrails'],
          ['`https://aigw.portkey.ai/v1`', 'Only `POST /logs` and `GET /logs/{logId}`'],
        ],
        note: 'Every Admin endpoint takes `Authorization: Bearer <scm-token>`: a 15-minute token from an SCM service account (`POST https://auth.apps.paloaltonetworks.com/oauth2/access_token`, `grant_type=client_credentials&scope=tsg_id:<tsg-id>`). The token names the tenant; a gateway API key gets 401 (`AB05`). Configs, integrations and providers are addressed by slug; guardrails, MCP servers, policies and keys by id; `workspace_id` goes in the query on GET, in the body on POST and PUT. The reference has no endpoints for workspaces, users and roles, SSO / SCIM / CIE or organisation settings — those stay in the console.',
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
