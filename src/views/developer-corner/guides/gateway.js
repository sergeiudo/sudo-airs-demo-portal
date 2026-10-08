import { Terminal, Fingerprint, Braces, Shuffle, ShieldCheck, Activity, Network, Code2, KeyRound, Building2, Server } from 'lucide-react'
import { pick } from './links'
import { gatewayChat, gatewayBlockCheck } from '../snippets'

const V = (tabs) => tabs.map((x) => ({ ...x, verified: true }))

/**
 * SCM AI Gateway, and the third-party gateways / frameworks that have a
 * native Prisma AIRS integration.
 *
 * Two official doc sets cover the gateway: docs.paloaltonetworks.com (SCM,
 * admin-centric) and the Prisma AIRS-branded developer docs hosted by Portkey
 * (code samples). Where they disagree, both are stated, plus what was verified
 * against the live SCM AI Gateway from this portal on 2026-09-28.
 */

const AIGW_CLIENT = `// The one line that does not exist anywhere else in this repo: baseURL. The
// Portkey Node SDK silently defaults to api.portkey.ai, so without this the
// SCM tenant's key would be sent to the wrong gateway and 401.
// strictOpenAiCompliance:false is what makes hook_results (the AIRS guardrail
// verdict) appear on ALLOWED responses too, not just blocks.
function buildAigwClient(configId, { metadata, cacheForceRefresh = true } = {}) {
  if (!ENV.apiKey) throw new Error('AIGW_API_KEY not set')
  const opts = {
    apiKey: ENV.apiKey,
    baseURL: ENV.baseUrl,
    strictOpenAiCompliance: false,
  }
  if (configId) opts.config = configId
  if (cacheForceRefresh) opts.cacheForceRefresh = true
  if (metadata) opts.metadata = metadata // v3.x: constructor option, no .withOptions()
  return new Portkey(opts)
}

// …

function hookVerdictFailed(hookResults) {
  const all = [
    ...(hookResults?.before_request_hooks || []),
    ...(hookResults?.after_request_hooks || []),
  ]
  return all.some((h) => h?.verdict === false)
}`

const JWT_MINT = `const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')

function signRs256(header, payload, privateKey) {
  const input = \`\${b64u(header)}.\${b64u(payload)}\`
  // An RSA key with sha256 signs RSASSA-PKCS1-v1_5 — that is exactly RS256.
  const sig = crypto.sign('sha256', Buffer.from(input), privateKey)
  return \`\${input}.\${sig.toString('base64url')}\`
}

// …

/** The credential the gateway routes on — same payload as the standalone app. Exported for scripts. */
export function mintCredential({ email, sub, role, department }, keys, overrides = {}) {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    portkey_oid: ENV.orgId,
    portkey_workspace: ENV.workspace,
    scope: ['completions.write', 'logs.view'],
    email_id: email,
    sub,
    iat: now,
    exp: now + CREDENTIAL_LIFE_S,
    defaults: {
      // Locks the routing config inside the signed token: the caller cannot
      // pick a different one, and cannot edit the metadata it is matched on.
      config_id: ENV.configId,
      metadata: { email, user_role: role, department },
    },
    ...overrides,
  }
  return signRs256({ alg: 'RS256', typ: 'JWT', kid: keys.kid }, payload, keys.privateKey)
}`

const MCP_CLIENT_TABS = [
  { id: 'bash', label: 'Claude Code', lang: 'bash', code: `# URL = <mcp-gateway-url>/<server-slug>/mcp; the docs' default base is https://aigw.portkey.ai/m —
# copy yours from AI Gateway → Catalogs (this portal's tenant serves https://mcp-aigw.portkey.ai/<slug>/mcp)
claude mcp add --transport http linear https://aigw.portkey.ai/m/linear/mcp \\
  --header "Authorization: Bearer $PORTKEY_API_KEY"

# OAuth instead of a key: leave the header out and sign in from /mcp on first use` },
  { id: 'json', label: 'Cursor / Claude Desktop', lang: 'json', code: `{
  "mcpServers": {
    "linear": {
      "url": "https://aigw.portkey.ai/m/linear/mcp",
      "headers": { "Authorization": "Bearer YOUR_GATEWAY_API_KEY" }
    }
  }
}` },
  { id: 'python', lang: 'python', file: 'mcp_client.py', code: `# pip install mcp
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

url = "https://aigw.portkey.ai/m/linear/mcp"          # your tenant's MCP gateway URL + server slug
headers = {"Authorization": "Bearer YOUR_GATEWAY_API_KEY"}

async with streamablehttp_client(url, headers=headers) as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()
        tools = await session.list_tools()
        for tool in tools.tools:
            print(f"{tool.name}: {tool.description}")
        result = await session.call_tool("create_issue", {"title": "Bug report", "priority": "high"})
        print(result)
` },
  { id: 'node', lang: 'node', file: 'mcp-client.mjs', code: `import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const transport = new StreamableHTTPClientTransport(new URL('https://aigw.portkey.ai/m/linear/mcp'), {
  requestInit: { headers: { Authorization: \`Bearer \${process.env.PORTKEY_API_KEY}\` } },
})
const client = new Client({ name: 'my-agent', version: '1.0.0' })
await client.connect(transport)
console.log((await client.listTools()).tools.map((t) => t.name))` },
]

// Admin API per the API reference: an SCM service-account token on
// api.apps.paloaltonetworks.com (a gateway key gets 401). The MCP Guardrails
// product page still shows aigw.portkey.ai/v1 + a gateway key + string actions.
const MCP_GUARD_TABS = [
  { id: 'create', label: 'Create', lang: 'curl', code: `# Admin API: an SCM service-account token (see "Tenant, licence & credentials"), not a gateway key
curl -sS -X POST https://api.apps.paloaltonetworks.com/ai_gw/v2/guardrails \\
  -H "Authorization: Bearer $SCM_TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "MCP tool content filter",
    "target": "mcp_tools",
    "workspace_id": "<workspace-id>",
    "checks": [
      { "id": "default.regexMatch", "parameters": { "rule": "(password|secret|api_key)" } },
      { "id": "default.contains", "parameters": { "words": ["DROP TABLE", "DELETE FROM"], "operator": "none" } }
    ],
    "actions": {
      "deny": true,
      "async": false,
      "on_success": { "feedback": { "value": 5, "weight": 1, "metadata": "" } },
      "on_fail": { "feedback": { "value": -5, "weight": 1, "metadata": "" } }
    }
  }'
# → {"id": "…", "slug": "pg-…", "version_id": "…"}` },
  { id: 'map', label: 'Map to servers', lang: 'curl', code: `# Replaces the whole set of server mappings for this guardrail (response: changed, added, updated, removed)
curl -sS -X PUT "https://api.apps.paloaltonetworks.com/ai_gw/v2/guardrails/$GUARDRAIL_ID/mcp-servers" \\
  -H "Authorization: Bearer $SCM_TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{
    "mcp_servers": {
      "<server-uuid>":   { "run_on": ["input", "output"] },
      "<server-uuid-2>": { "run_on": ["input"], "mcp_integration_capability_ids": ["<capability-id>"] }
    }
  }'
# Organisation guardrails: the same call under https://api.apps.paloaltonetworks.com/ai_gw/admin/v2/guardrails/<id>/mcp-servers` },
  { id: 'blocked', label: 'A blocked call', lang: 'json', code: `{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32446,
    "message": "Request blocked by guardrail",
    "data": { "guardrail_id": "default.regexMatch", "reason": "Input matched restricted pattern" }
  }
}` },
]

// Check id and profile_name / ai_model / app_user: the create-guardrail API
// reference. scan_scope / strip_scaffolding: the PANW integration page (the API
// schema omits them). Untested from this portal.
const AIRS_GUARD_CURL = `# 1. A 15-minute SCM token for a service account (the Admin API refuses gateway keys with 401)
SCM_TOKEN=$(curl -sS -X POST https://auth.apps.paloaltonetworks.com/oauth2/access_token \\
  -u "$CLIENT_ID:$CLIENT_SECRET" \\
  -d "grant_type=client_credentials&scope=tsg_id:$TSG_ID" | jq -r .access_token)

# 2. The AIRS guardrail, synchronous and denying
curl -sS -X POST https://api.apps.paloaltonetworks.com/ai_gw/v2/guardrails \\
  -H "Authorization: Bearer $SCM_TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Prisma AIRS - production profile",
    "workspace_id": "<workspace-id>",
    "checks": [{
      "id": "panw-prisma-airs.intercept",
      "parameters": {
        "profile_name": "<airs-security-profile>",
        "scan_scope": "last_user_message",
        "strip_scaffolding": true
      }
    }],
    "actions": {
      "deny": true,
      "async": false,
      "on_success": { "feedback": { "value": 5, "weight": 1, "metadata": "" } },
      "on_fail": { "feedback": { "value": -5, "weight": 1, "metadata": "" } }
    }
  }'
# → {"id": "…", "slug": "pg-…", "version_id": "…"} — put the pg- slug in a config's input/output_guardrails`

// Configs page, "Passthrough targets". Not yet tested on this portal's tenant.
const PASSTHROUGH_CFG = `{
  "strategy": { "mode": "fallback" },
  "targets": [
    { "passthrough": true },
    {
      "provider": "@my-bedrock",
      "override_params": { "model": "us.anthropic.claude-haiku-4-5-20251001-v1:0" }
    }
  ]
}`

const LITELLM_YAML = `model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: "panw-prisma-airs-guardrail"
    litellm_params:
      guardrail: panw_prisma_airs
      mode: "pre_call"                 # also during_call, post_call, pre_mcp_call, during_mcp_call, post_mcp_call
      api_key: os.environ/PANW_PRISMA_AIRS_API_KEY
      profile_name: os.environ/PANW_PRISMA_AIRS_PROFILE_NAME   # optional only if the key has a linked profile
      api_base: "https://service.api.aisecurity.paloaltonetworks.com"   # US; EU, India, Singapore: service-de / service-in / service-sg
      app_name: "my-app"               # reported to AIRS as LiteLLM-my-app
      fallback_on_error: "block"       # the default; "allow" fails open on 429, timeouts, network errors and 5xx
      timeout: 10                      # seconds (the default)
      mask_request_content: false      # true: continue with the prompt AIRS masked instead of blocking
      mask_response_content: false     # the same for responses`

const LITELLM_MCP_YAML = `guardrails:
  - guardrail_name: "panw-mcp-results"
    litellm_params:
      guardrail: panw_prisma_airs
      mode: "post_mcp_call"            # scans what an MCP server returned, before the model sees it
      api_key: os.environ/PANW_PRISMA_AIRS_API_KEY
      profile_name: os.environ/PANW_PRISMA_AIRS_PROFILE_NAME
      mask_response_content: true      # write AIRS's masked text back into the tool result
      default_on: true                 # without it, MCP child calls can skip the guardrail`

export const GATEWAY = [
  {
    id: 'gw-overview',
    group: 'gateway',
    title: 'What the AI Gateway is, and how to set it up',
    sub: 'Providers, integrations, workspaces, configs, guardrails',
    minutes: 7,
    level: 'Setup',
    docs: pick('agGateway', 'gwOverview', 'gwDeploy', 'gwConfigs', 'agWelcome', 'gwDevSetup', 'agFeatures', 'agGuardCaps', 'agBedrockRole'),
    blocks: [
      {
        type: 'prose',
        text: [
          'The AI Gateway is a centralised, OpenAI-compatible proxy in front of your LLM providers — and your MCP servers and agent-to-agent traffic — managed from Strata Cloud Manager. Apps call one endpoint; the gateway routes to the right provider, applies budgets, rate limits, retries, caching and **guardrails** (including Prisma AIRS), and logs every request.',
          'It runs as **SaaS** (`https://aigw.portkey.ai/v1`) or **Hybrid**, with the data plane on your own Kubernetes. It is available in the Americas; both models are priced the same.',
          'Two official doc sets cover it: the admin guide on docs.paloaltonetworks.com, and the **Prisma AIRS AI Gateway developer docs** at [portkey.ai/docs/aigw](https://portkey.ai/docs/aigw/product/ai-gateway) — the API, configs, guardrails, MCP and the code (docs.gw.prismaairs.com serves the same pages). The guides in this group draw on both.',
        ],
      },
      {
        type: 'facts',
        items: [
          { label: 'Models behind one API', value: '3,000+', sub: 'Chat Completions, Responses or Anthropic Messages format', accent: true },
          { label: 'Added latency', value: '20–40 ms', sub: 'Edge-hosted, per the developer docs\' benchmarks' },
          { label: 'Data protection', value: 'AES-256', sub: 'In transit and at rest; SSO with any OIDC provider' },
          { label: 'Gateway timeout', value: 'None', sub: 'For HTTP, per the welcome FAQ (the gRPC page gives 60 s, 300 s streaming). Set a client timeout, or `request_timeout` in a config' },
        ],
      },
      {
        type: 'table',
        title: 'The objects you will create',
        columns: ['Object', 'What it is'],
        rows: [
          ['Integration (provider)', 'Credentials for one provider account (Bedrock, Vertex, OpenAI, Azure…) with a **slug** — `@my-bedrock`. Apps address models as `@slug/model`.'],
          ['Workspace', 'Where apps live; an SCM workspace. An integration is shared into workspaces, with per-workspace budgets, rate limits and a model allow-list.'],
          ['Gateway API key', 'What an app authenticates with. Can carry a default config, so policy rides on the key.'],
          ['Config (`pc-…`)', 'Saved JSON: routing, fallback, retries, cache, conditional rules and guardrail hooks. Versioned.'],
          ['Guardrail (`pg-…`)', 'A check run before and/or after the model — basic, PRO or partner (Prisma AIRS is a partner guardrail).'],
        ],
      },
      {
        type: 'steps',
        title: 'Set it up in Strata Cloud Manager',
        steps: [
          { title: 'Activate', text: 'Create a deployment profile and allocate credits to AI Gateway, map it to your TSG, and launch SCM. Usage is metered in tokens — for LLM prompts the token counts the model returns, for MCP and A2A traffic 1 token per 4 characters (the older admin guide says 4 characters for everything).' },
          { title: 'Create an integration for each provider', text: 'Pick the provider, give it a name and slug, and add its credentials — an API key for most providers; for Bedrock an access key, an assumed role (trust principal `arn:aws:iam::039293892788:role/AirsGwEnterpriseRole`) or a Bedrock API key; for Vertex AI a service-account JSON. A custom host serves a private model; custom headers serve MCP servers with static tokens. Optionally set a pricing multiplier.', path: ['AI Security', 'AI Gateway', 'Integrations', 'Select a provider', 'Set details'] },
          { title: 'Provision it to workspaces', text: 'Share the integration with all or specific workspaces. Set budget limits (cost or tokens) and rate limits (requests or tokens per minute/hour/day). Both are immutable once set.', path: ['Provision the workspace'] },
          { title: 'Provision models', text: 'Allow all models or only an allow-list. A model that is not provisioned is rejected with `model_not_allowed`. Since gateway 2.27.0 a Bedrock allow-list also accepts cross-region inference profiles (`us.anthropic.…`) and application inference-profile ARNs when the base model is allowed.', path: ['Configure model provisioning', 'Create Integration'] },
          { title: 'Create a config and an API key', text: 'Create a `pc-…` config (add the Prisma AIRS guardrail — see "The AIRS guardrail in the gateway"), then a gateway API key, optionally with that config as its default. Wait about a minute before the first call: changes reach the data plane on its next sync (every 30 seconds per the Helm chart\'s resiliency page, every minute per the AIGW cache-behaviour page).' },
        ],
      },
      {
        type: 'code', title: 'Hybrid data plane on your Kubernetes — the full walkthrough is in "Hybrid deployment"',
        tabs: [{ id: 'bash', lang: 'bash', code: `helm repo add airs-gw https://portkey-ai.github.io/airs-gw-helm
helm repo update
helm upgrade --install airs-gw airs-gw/airs-gw \\
  -f ./values.yaml \\
  -n airs-gw \\
  --create-namespace` }],
      },
      {
        type: 'table',
        title: 'Logging',
        columns: ['', 'Event logs', 'Prompt logs'],
        rows: [
          ['Content', 'Audit, auth, traffic, metrics', 'Full LLM context windows'],
          ['Retention', '1 year', '1 year'],
          ['Export', 'OpenTelemetry; Strata Logging Service', 'Your own S3 (Hybrid only)'],
        ],
      },
      {
        type: 'callout', tone: 'observed', title: 'Bedrock on this portal\'s SCM tenant: an access key, not an assumed role',
        text: 'The Assumed Role auth type fails on the SCM gateway with "The security token included in the request is invalid", and no `sts:AssumeRole` reaches CloudTrail; the same role works on the legacy `api.portkey.ai` gateway. It is a Palo Alto Networks bug (ticket open since 2026-07-20), so the Bedrock integration here uses an IAM-user access key. The docs do not mention it.',
      },
      {
        type: 'table',
        title: 'What the Prisma AIRS guardrail actually reads',
        columns: ['Traffic', 'Guardrails run?'],
        minWidth: 560,
        rows: [
          ['Chat Completions, Completions, Messages, `POST /v1/responses`', 'Input and output — the **text** parts only. Images in a message (URL or base64) are not evaluated.'],
          ['Streaming responses', 'Input before the first token; output after `[DONE]`, informational only (no fallback or retry)'],
          ['Embeddings · Decisions', 'Input only · input, and only the `state` field'],
          ['Audio, images, files, batches, fine-tuning, assistants and threads, moderations, `/v1/models`, `GET /v1/responses/*`', 'No guardrails'],
          ['Provider paths proxied as-is (`/v1/<provider-path>`)', 'Not covered by the AIGW guardrail pages; the changelog opts in only `default.webhook` (`executeOnProxy`, 2.20.0) and `default.allowedRequestTypes` (2.10.0). Treat as unscanned.'],
          ['MCP tool calls through the MCP Gateway', 'MCP guardrails exclude partner checks, so no AIRS — see "MCP Gateway"'],
        ],
        note: 'From Guardrails → Supported endpoints. The Batches page contradicts it: it applies guardrails around a provider batch through `portkey_options`.',
      },
      {
        type: 'callout', tone: 'docs', title: 'PII and moderation: the two doc sets differ',
        text: 'The SCM admin guide says PII detection and content moderation are not gateway guardrails but are handled by Prisma AIRS (advanced DLP and threat detection) through the partner guardrail. The developer docs list PRO guardrails for PII detection (with redaction) and content moderation. Check what Guardrails → Create offers on your tenant.',
      },
      {
        type: 'cards',
        min: 240,
        items: [
          { icon: Braces, tone: '#EC4899', title: 'One endpoint, three formats', kicker: 'Universal API', text: 'Chat Completions, Responses or Messages, against any provider.', go: 'gw-universal' },
          { icon: Shuffle, tone: '#EC4899', title: 'Routing and reliability', kicker: 'Configs', text: 'Fallbacks, retries, load balancing, timeouts and caching.', go: 'gw-routing' },
          { icon: ShieldCheck, tone: '#EC4899', title: 'Guardrail framework', kicker: 'Actions · verdicts · PII', text: 'Deny vs log, 246 and 446, redaction, org-wide enforcement.', go: 'gw-guardrails' },
          { icon: Activity, tone: '#EC4899', title: 'Observability', kicker: 'Logs · traces · OTel', text: 'Trace ids, metadata, feedback, exports and OpenTelemetry.', go: 'gw-observability' },
          { icon: Network, tone: '#EC4899', title: 'MCP Gateway', kicker: 'Registry · auth · tools', text: 'Broker MCP servers with per-tool access and logs.', go: 'gw-mcp' },
          { icon: Code2, tone: '#EC4899', title: 'Coding agents', kicker: 'Claude Code · Codex · Cursor', text: 'Per-developer keys, budgets and guardrails.', go: 'gw-coding' },
          { icon: Server, tone: '#EC4899', title: 'Hybrid deployment', kicker: 'Helm · your Kubernetes', text: 'The data plane in your cluster — install, and upgrade when a gateway release ships.', go: 'gw-hybrid' },
          { icon: KeyRound, tone: '#d946ef', title: 'Keys, budgets, rate limits', kicker: 'Governance', text: 'Scopes, rotation, limits and what callers cannot opt out of.', go: 'gw-governance' },
          { icon: Building2, tone: '#d946ef', title: 'Org admin', kicker: 'Governance', text: 'Workspaces, roles, SSO, SCIM and CIE Directory Sync.', go: 'gw-admin' },
        ],
      },
    ],
  },

  {
    id: 'gw-connect',
    group: 'gateway',
    title: 'Connect any app to the gateway',
    sub: 'Change the base URL and the key — keep your code',
    minutes: 7,
    level: 'Build',
    live: 'gateway.chat',
    docs: pick('gwDevSetup', 'gwKeys', 'gwDeploy', 'agHeaders', 'agResponseSchema', 'agConfigs', 'agMetadata', 'gwSpec'),
    blocks: [
      {
        type: 'prose',
        text: 'Any OpenAI-compatible client works. Point it at the gateway, authenticate with the **gateway** key (never a provider key), and name the model as `@<integration-slug>/<model>`. The code below matches the Run it live panel — try the benign preset, then an attack.',
      },
      { type: 'code', build: (v) => V(gatewayChat(v)) },
      { type: 'live', title: 'Send it through the SCM AI Gateway', text: 'The panel calls the gateway from this portal with a config that carries the Prisma AIRS guardrail.' },
      {
        type: 'table',
        title: 'Headers worth knowing',
        columns: ['Header', 'Use'],
        rows: [
          ['`Authorization: Bearer <key>`', 'The gateway API key (or a signed JWT)'],
          ['`x-portkey-api-key`', 'Alternative to `Authorization` for the key'],
          ['`x-portkey-config: pc-…`', 'Apply a saved config to this request — overrides the key\'s default config (the key needs config override allowed)'],
          ['`x-portkey-provider: @<slug>`', 'Pick the integration by header with a bare `model` — for endpoints without a `model` field (files, batches) and image edits. A raw provider name (`openai`) means your own provider key in `Authorization`, which Block Inline Configs rejects (`inline_provider_blocked`).'],
          ['`x-portkey-trace-id`', 'Your trace id — with the AIRS guardrail on, the same id appears in AI Runtime → AI Sessions'],
          ['`x-portkey-metadata`', 'JSON metadata to log (and to route on, in conditional configs). Values are strings of at most 128 characters; `_user` is the end user (an OpenAI `user` field is copied there).'],
          ['`x-portkey-strict-open-ai-compliance: false`', 'Keep non-OpenAI fields such as `hook_results` (guardrail verdicts) in the response'],
          ['`x-portkey-request-timeout: <ms>`', 'Per-request timeout; the gateway answers 408'],
          ['`x-portkey-cache-force-refresh: true` · `x-portkey-cache-namespace`', 'Skip the cached answer and store a fresh one (needs a cache in the config) · partition the cache'],
          ['`x-portkey-forward-headers`', 'Names of request headers to pass upstream untouched. Inline forward headers are rejected under Block Inline Configs (`inline_forward_headers_blocked`).'],
          ['`x-portkey-sensitive-headers`', 'Names of headers whose values are hashed in request, response and trace logs. It does not forward them (hybrid: `ORGANISATION_HEADERS_TO_MASK` for an org-wide list).'],
          ['`x-portkey-beta`', 'Opt into beta behaviour, comma-separated (e.g. `server-side-mcp-2026-06-01`)'],
        ],
      },
      {
        type: 'table',
        title: 'Response headers',
        columns: ['Header', 'What it tells you'],
        rows: [
          ['`x-portkey-trace-id`', 'Your trace id, or the one the gateway generated'],
          ['`x-portkey-retry-attempt-count`', 'Retries made, not counting the first call (3 means four calls); the retries page adds `-1` for "all retries exhausted" and `0` for none configured'],
          ['`x-portkey-cache-status`', '`HIT`, `SEMANTIC HIT`, `MISS`, `SEMANTIC MISS`, `DISABLED` or `REFRESH`'],
          ['`x-portkey-last-used-option-index`', 'Which config target served, as a JSON path (e.g. `config.targets[2]`)'],
        ],
        note: 'From the Inference API\'s Response Schema page. The SCM tenant used here also returns `x-portkey-provider`, which that page does not list.',
      },
      {
        type: 'callout', tone: 'observed', title: 'Auth: the two doc sets differ — both work',
        text: [
          'docs.paloaltonetworks.com describes `x-portkey-api-key` plus `x-portkey-virtual-key`; the Prisma AIRS developer docs use `Authorization: Bearer` plus `@slug/model` and mark virtual keys deprecated.',
          'Against the SCM AI Gateway from this portal, **both** `Authorization: Bearer` and `x-portkey-api-key` authenticated, with `@slug/model` addressing and `x-portkey-config` honoured.',
        ],
      },
      {
        type: 'callout', tone: 'warn', title: 'Using the Portkey SDK? Set the base URL',
        text: 'The Portkey Node SDK defaults to `api.portkey.ai` and reads `PORTKEY_BASE_URL` from the environment when no base URL is passed. Always pass `baseURL: "https://aigw.portkey.ai/v1"` explicitly — and avoid setting `PORTKEY_BASE_URL` globally if other code on the host uses a different Portkey endpoint.',
      },
      {
        type: 'callout', tone: 'observed', title: 'A provider pin in the config beats the model slug',
        text: 'A config with `targets` / `strategy` that pins a provider overrides the `@slug/` in the model name. To let one config front several clouds, leave provider pins out — and remove `strategy` and `targets` together (an empty fallback chain breaks every request).',
      },
      {
        type: 'code', title: 'Keep the fallback and still honour the slug — passthrough targets',
        text: 'Documented on the Configs page, not yet tested on this portal\'s tenant. A target with `"passthrough": true` needs no `provider`: the gateway takes it from `x-portkey-provider: @<slug>`, else from the `@<slug>/<model>` in the body (and forwards the bare model). If neither resolves, that target fails. It works in fallback, load-balance and conditional strategies and can carry `override_params`.',
        tabs: [{ id: 'json', lang: 'json', file: 'pc-any-cloud-with-fallback', code: PASSTHROUGH_CFG }],
      },
      { type: 'repo', title: 'The SCM AI Gateway client', file: 'moh-routes.js', lines: '82-134', lang: 'javascript', code: AIGW_CLIENT, why: 'The client behind the AI-GW target in AIRS Runtime & AI-GW and the Ministry of Health pillar.' },
    ],
  },

  {
    id: 'gw-guardrail',
    group: 'gateway',
    title: 'The AIRS guardrail in the gateway',
    sub: 'One guardrail across every provider — and how to read a block',
    minutes: 8,
    level: 'Build',
    live: 'gateway.chat',
    docs: pick('gwAirsGuard', 'gwGuardrails', 'gwDevGuard', 'agCreateGuard', 'agGuardrails', 'agGuardCaps', 'agDecisionsGuard', 'agAdminAuth', 'agChangelog'),
    blocks: [
      {
        type: 'prose',
        text: 'The Prisma AIRS partner guardrail makes the gateway call the AIRS Runtime API on each request — before the model (input) and after it (output) — with the security profile you choose. Nothing changes in the app.',
      },
      {
        type: 'steps',
        steps: [
          { title: 'Connect the gateway to Prisma AIRS', text: [
            'Enter the API Intercept endpoint URL and an API key from your **AI Runtime Security** deployment profile. Per the PANW admin guide, a 401 at save means the key is wrong; a 400 later usually means a typo in the endpoint (it is not validated at save).',
            'The developer docs\' PANW page puts the form under Settings → Integrations; newer partner pages use Admin Settings → Plugins. On a self-hosted gateway the scan endpoint comes from the `AIRS_URL` environment variable (gateway 2.20.0).',
          ], path: ['Admin Settings', 'Plugins', 'PANW Prisma AIRS'] },
          { title: 'Create the guardrail', text: 'Create a partner guardrail **PANW Prisma AIRS Guardrail**, set its parameters (below) and its actions: run it synchronously (`async` off) with **Deny** on to block, or with Deny off to let the request through and mark it (246). Set `async` explicitly — the Guardrails page says it defaults to on (log only), the API reference says off. Note its `pg-…` id.', path: ['Guardrails', 'Create', 'Partner', 'PANW Prisma AIRS'] },
          { title: 'Attach it to a config', text: 'Reference the guardrail id as an input and/or output guardrail in a `pc-…` config, then use that config (as the key\'s default, or per request with `x-portkey-config`). Both forms below are on the developer docs\' Guardrails page and work identically; the SCM admin guide shows the hook form.',
            code: [
              { id: 'json', label: 'Config (shorthand)', lang: 'json', code: `{
  "input_guardrails": ["pg-xxxxxx"],
  "output_guardrails": ["pg-xxxxxx"]
}` },
              { id: 'yaml', label: 'Config (hook form)', lang: 'json', code: `{
  "before_request_hooks": [{ "id": "pg-xxxxxx" }],
  "after_request_hooks": [{ "id": "pg-xxxxxx" }]
}` },
            ] },
        ],
      },
      {
        type: 'table',
        title: 'Guardrail parameters',
        columns: ['Field', 'JSON key', 'Default', 'Notes'],
        minWidth: 640,
        rows: [
          ['Profile Name', '`profile_name`', '—', 'The AIRS security profile. The integration page calls every parameter optional (no profile = the one linked to the API key); the API reference marks this one required.'],
          ['Profile ID', '`profile_id`', '—', 'Instead of, or alongside, the name'],
          ['Scan Scope', '`scan_scope`', '`last_message`', '`last_message`, `last_user_message`, `user_messages`, `all_messages` (gateway 2.14.1)'],
          ['Strip Scaffolding', '`strip_scaffolding`', '`false`', 'Removes agent-harness wrappers (e.g. `<system-reminder>` blocks, MCP tool instructions) before scanning; `tool_result` content is always kept and scanned'],
          ['AI Model · Application User', '`ai_model` · `app_user`', '`unknown-model` · `portkey-gateway`', 'The defaults are the integration page\'s. Since gateway 2.20.0 scans report the model, user and provider from the live request instead of static config values. The page\'s best practices spell them `aiModel` / `appUser`.'],
          ['Application Name', '`app_name`', '—', 'Sent prefixed `Portkey-` (e.g. `Portkey-chatbot`)'],
        ],
        note: 'Check id `panw-prisma-airs.intercept` and the keys `profile_name`, `ai_model`, `app_user` are from the create-guardrail API reference (`PANWPrismaParameters`); `scan_scope` and `strip_scaffolding` from the integration page; `profile_id` and `app_name` only from the open-source plugin\'s manifest. For agentic clients (Claude Code, Cursor, Cline) the docs recommend `scan_scope: "last_user_message"` with `strip_scaffolding: true`, and separate security profiles for dev, staging and production.',
      },
      {
        type: 'code', title: 'The same guardrail as code',
        text: 'Guardrails are created through the Admin API on `api.apps.paloaltonetworks.com` with an SCM service-account token — a gateway key gets 401 there. The `actions` object is the API reference\'s shape (all four keys required). Assembled from the reference and the integration page; not run from this portal.',
        tabs: [{ id: 'curl', lang: 'curl', code: AIRS_GUARD_CURL }],
      },
      {
        type: 'callout', tone: 'docs', title: 'What the AIRS guardrail does — and does not — do',
        text: [
          'The check fails when AIRS returns `action=block` for the prompt (input) or the response (output); it covers prompt injection, malicious URLs, sensitive data, insecure output, jailbreaks, toxic content and model DoS. It **blocks; it does not redact** — pair it with a redacting check for "mask and continue". Since gateway 2.25.0 it retries transient scan failures (timeouts, 429s, 5xx) with exponential backoff instead of failing the check at once.',
          'Like every gateway guardrail it reads text only (images are skipped), its output verdict on a stream is informational, and per the MCP Guardrails page it is **not available on MCP tool calls** through the MCP Gateway, which excludes partner checks — scan tool events with the Runtime API instead. (The 2.20.0 changelog says MCP guardrails reuse "the same guardrail checks available for LLM requests"; no page lists the AIRS check for MCP.) Actions, status codes and `hook_results` are in "Guardrail actions, verdicts and PII redaction".',
        ],
      },
      { type: 'code', title: 'Detecting a block', build: () => V(gatewayBlockCheck()) },
      { type: 'live', title: 'Watch a block come back as HTTP 200', text: 'Run the "Prompt injection" preset, then "Same attack, no guardrail" — the only difference is the config.' },
      {
        type: 'callout', tone: 'observed', title: 'On the SCM tenant a block does not throw',
        text: [
          'The response is **HTTP 200** with `choices[0].message.content` replaced by "The guardrail checks defined in the config failed." and the model never called. Code that only catches exceptions will report every block as a pass.',
          'Read `hook_results.before_request_hooks[].verdict` / `after_request_hooks[].verdict` — `false` means blocked. The response header `x-portkey-trace-id` is the same id AIRS records as `tr_id`.',
          'A caveat from the open-source gateway code, not the docs: the plugin takes `tr_id` from the request\'s `x-portkey-trace-id` header and otherwise sends a random UUID — so the match is guaranteed only when the caller sends its own trace id.',
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'The docs now describe that 200: soft deny',
        text: 'Gateway 2.14.0 added a `soft_deny_200` flag on guardrail checks: a denial "returns HTTP 200 with the error message formatted as a chat completion response instead of the standard HTTP 446", for clients that treat 4xx as fatal (e.g. Claude Code). The Decisions guardrail page spells it `softDeny200`; the Guardrails and Errors pages still list only 446 and 246, and the create-guardrail schema has no such field. The SCM tenant behaves as if the flag were on — whether it is set, and where, is not visible from the portal.',
      },
    ],
  },

  {
    id: 'gw-jwt',
    group: 'gwgov',
    title: 'Identity-based routing with JWT',
    sub: 'No API keys for users — the model is chosen by who they are',
    minutes: 10,
    level: 'Build',
    docs: pick('gwDevJwt', 'gwConfigs', 'gwKeys', 'agKeys', 'agDefaultCfg', 'agResponseSchema', 'agAudit', 'agChangelog'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Instead of a gateway key, a client can present a **JWT** the gateway verifies against a JWKS registered on your organisation. Your backend acts as a token broker: it authenticates the user (e.g. with Microsoft Entra ID), seals facts like role and department into a short-lived RS256 token, and the gateway routes on those claims with a conditional config. The browser never holds a key, and cannot change the claims without breaking the signature.',
          'On the cloud (SaaS) gateway the token is validated on the management plane. A hybrid gateway can validate it locally instead (below).',
        ],
      },
      {
        type: 'cards',
        items: [
          { icon: Fingerprint, tone: '#8b5cf6', title: 'See it live in this portal', kicker: 'Enterprise AI Access pillar',
            text: 'Sign in with Entra ID, pick a model your role is not allowed, and watch a different one answer — with every token artifact and live tamper tests.', go: 'pillar:enterpriseAccess', goLabel: 'Open Enterprise AI Access' },
        ],
      },
      {
        type: 'table',
        title: 'What the gateway requires',
        columns: ['Item', 'Requirement'],
        rows: [
          ['Algorithm', '**RS256** only (HS256 is refused); RSA keys of 2048 bits or more'],
          ['JOSE header', '`alg: RS256`, `typ: JWT` (required) and a `kid` that matches a key in the JWKS'],
          ['JWKS', 'A JWKS URL (comma-separated for rotation; the sets are merged) or static JWKS JSON, under Admin Settings → Organisation → Authentication. Public parameters only (`kty`, `n`, `e`, `use`, `alg`, `kid`).'],
          ['Required claims', '`portkey_oid`, `portkey_workspace`, `scope` (or `scopes`), `exp`. The page names `organisation_id` / `workspace_slug` as alternates but says that on AI Gateway Cloud `portkey_oid` and `portkey_workspace` are required.'],
          ['Recommended', '`iat`, `nbf`; identity from `email_id` > `sub` > `uid`'],
          ['Optional', '`defaults` (an embedded default config and metadata — a config from another organisation is silently ignored), `usage_limits`, `rate_limits` (limits on JWT keys are enforced since gateway 2.20.0; earlier builds did not apply them)'],
          ['Config precedence', 'An `x-portkey-config` header on the request still overrides `defaults.config_id`, unless config override is disabled at the workspace level. Seal the routing in by turning override off.'],
          ['Sent as', '`x-portkey-api-key: <jwt>` (no `Bearer`) or `Authorization: Bearer <jwt>`; `Authorization` is read only when `x-portkey-api-key` is absent'],
          ['Acts as', 'A **workspace** API key — never an organisation key'],
          ['Revocation', 'None: a validated token is cached until `exp`. Keep tokens short-lived; rotate by publishing a new `kid` first.'],
          ['Errors', '401 invalid or expired · 403 scope/workspace not allowed · 412 usage limit · 429 rate limit. Invalid tokens are also written to the audit log (e.g. "Signing Key Not Found").'],
        ],
      },
      {
        type: 'table',
        title: 'Validating on the gateway itself — hybrid only',
        columns: ['Item', 'What the docs say'],
        rows: [
          ['Requires', 'A hybrid deployment, gateway 2.5.0+, `JWT_ENABLED=ON`, `ORGANISATIONS_TO_SYNC` (org UUIDs, also the allow-list) and `PORTKEY_CLIENT_AUTH`. Without `JWT_ENABLED=ON` the management plane validates.'],
          ['Mode A — your own issuer', 'Add the gateway claims yourself (`portkey_oid`, `portkey_workspace`, `defaults`, limits) and use the full feature set'],
          ['Mode B — a stock IdP token', 'Okta, Auth0, Entra ID, Cognito: one org UUID in `ORGANISATIONS_TO_SYNC`, the workspace from the deployment\'s allow-list or the org default, scopes from the IdP or `JWT_LOCAL_AUTH_DEFAULT_SCOPES`'],
          ['User attribution (2.21.0)', 'When the token\'s email matches a user in the target workspace, the request is attributed to that user and inherits their workspace role'],
          ['`x-portkey-workspace` (2.25.0)', 'Picks the workspace per request (slug or id) — honoured only for user-attributed tokens, never over a workspace set in the token; 403 if the user is not an active member'],
          ['`JWT_PREFER_USER_WORKSPACE_RESOLUTION=ON` (2.26.0)', 'A user token that names no workspace resolves to the user\'s own membership before the deployment or org default'],
        ],
        note: 'The JWT page covers the first four rows; the last two are so far only in the Enterprise Gateway changelog. Per the page, local validation cuts latency and keeps auth working while the management plane is briefly unreachable.',
      },
      {
        type: 'code', title: 'Mint the token',
        tabs: [
          { id: 'node', lang: 'node', file: 'mint.mjs', code: `import crypto from 'node:crypto'
import fs from 'node:fs'

const privateKey = crypto.createPrivateKey(fs.readFileSync(process.env.JWT_PRIVATE_KEY_PATH, 'utf8'))
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

export function mintGatewayToken({ email, sub, role, department }) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT', kid: process.env.JWT_KID }
  const payload = {
    portkey_oid: process.env.GW_ORG_ID,
    portkey_workspace: process.env.GW_WORKSPACE_SLUG,
    scope: ['completions.write'],
    email_id: email,
    sub,
    iat: now,
    exp: now + 3600,                               // short-lived
    defaults: {
      config_id: process.env.GW_CONFIG_ID,         // the routing config, sealed in
      metadata: { email, user_role: role, department },
    },
  }
  const input = \`\${b64u(header)}.\${b64u(payload)}\`
  const sig = crypto.sign('sha256', Buffer.from(input), privateKey)   // RSA + SHA-256 = RS256
  return \`\${input}.\${sig.toString('base64url')}\`
}` },
          { id: 'python', lang: 'python', file: 'mint.py', code: `# pip install pyjwt cryptography
import os
import time

import jwt

with open(os.environ["JWT_PRIVATE_KEY_PATH"]) as f:
    PRIVATE_KEY = f.read()


def mint_gateway_token(email: str, sub: str, role: str, department: str) -> str:
    now = int(time.time())
    payload = {
        "portkey_oid": os.environ["GW_ORG_ID"],
        "portkey_workspace": os.environ["GW_WORKSPACE_SLUG"],
        "scope": ["completions.write"],
        "email_id": email,
        "sub": sub,
        "iat": now,
        "exp": now + 3600,
        "defaults": {
            "config_id": os.environ["GW_CONFIG_ID"],
            "metadata": {"email": email, "user_role": role, "department": department},
        },
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256",
                      headers={"kid": os.environ["JWT_KID"], "typ": "JWT"})` },
        ],
      },
      {
        type: 'code', title: 'Route on the claims — a conditional config',
        text: 'Conditions are evaluated top to bottom; the first match wins. `default` should be the most restricted route. A target without `override_params` forwards whatever model was requested.',
        tabs: [{ id: 'json', lang: 'json', file: 'pc-identity-routing', code: `{
  "strategy": {
    "mode": "conditional",
    "conditions": [
      { "query": { "metadata.email": { "$eq": "exempt.user@example.com" } }, "then": "unrestricted" },
      { "query": { "metadata.user_role": { "$eq": "Admin" } }, "then": "admin-opus" },
      { "query": { "metadata.user_role": { "$eq": "User" } }, "then": "user-haiku" }
    ],
    "default": "user-haiku"
  },
  "targets": [
    { "name": "unrestricted", "provider": "@my-bedrock" },
    { "name": "admin-opus", "provider": "@my-bedrock", "override_params": { "model": "us.anthropic.claude-opus-4-8" } },
    { "name": "user-haiku", "provider": "@my-bedrock", "override_params": { "model": "us.anthropic.claude-haiku-4-5-20251001-v1:0" } }
  ]
}` }],
      },
      {
        type: 'callout', tone: 'observed', title: 'What happened when it was tested for real',
        text: 'From this portal against the SCM AI Gateway: a User token asking for Sonnet 5 was served by Haiku 4.5, an Admin token by Opus 4.8, the exempt address by Sonnet 5. An edited claim, a token signed by another key, an expired token and `alg: none` were all refused with 401 "Invalid API Key. Error Code: 03" — the same message a missing key gets, so it is not specific. The response header `x-portkey-last-used-option-index` names the target the gateway used (`config.targets[2]`).',
      },
      { type: 'repo', title: 'Minting the credential', file: 'access-routes.js', lines: '170-250', lang: 'javascript', code: JWT_MINT, why: 'Enterprise AI Access signs its gateway credential with node:crypto — no JWT library. Its comment says the caller cannot pick a different config; per the JWT page that holds only while config override is disabled at the workspace level.' },
      {
        type: 'callout', tone: 'docs', title: 'Where the JWT docs disagree',
        text: [
          'User attribution: the data-visibility settings page says requests made with JWT auth "are not attributed to a specific AI Gateway user"; the JWT page and changelog 2.21.0 attribute gateway-local requests to the user whose email matches.',
          'The JWT page\'s step "Send the JWT in the `x-portkey-api-key` header" shows an example that uses `Authorization: Bearer`. Both work. The "which target served" header above is documented on the Inference API\'s Response Schema page.',
        ],
      },
      {
        type: 'callout', tone: 'warn', title: 'Guard the private key',
        text: 'Anyone holding the signing key can mint a token for any role, and the gateway will believe it. Keep it in a KMS/HSM or at least outside the repository, publish only the JWKS, and rotate by adding a new `kid` before retiring the old one.',
      },
    ],
  },

  {
    id: 'gw-mcp',
    group: 'gateway',
    title: 'MCP Gateway: registry, auth and tool control',
    sub: 'Broker MCP servers with one key, per-tool access and a log of every call',
    minutes: 10,
    level: 'Build',
    docs: pick('agMcp', 'agMcpQuick', 'gwDevMcp', 'agGatewayUrls', 'agMcpRegistry', 'agMcpAuth', 'agByoa', 'agMcpCas', 'agMcpIdentity', 'agMcpAuthz', 'agMcpTools', 'agMcpTeams', 'agMcpGuard', 'agGuardMcpSync', 'agAdminAuth', 'agMcpRate', 'agMcpObs', 'agMcpRegApi', 'agMcpTrouble', 'agMcpClaude'),
    blocks: [
      {
        type: 'prose',
        text: [
          'The MCP Gateway sits between MCP clients and MCP servers. A client authenticates **once**, to the gateway; the gateway checks that the caller\'s workspace and user may reach that server and that tool, injects the server\'s own credential (an OAuth token, an API key or a signed identity header), forwards the call and logs it. Agents never hold an upstream credential, so those rotate without touching a client.',
          'Transport is **Streamable HTTP** only — a local stdio server has to be exposed over HTTP first. Sessions are ephemeral, so no sticky routing is needed.',
        ],
      },
      {
        type: 'table',
        title: 'Addresses',
        columns: ['What', 'URL'],
        rows: [
          ['One server', '`<mcp-gateway-url>/<server-slug>/mcp` — the default base is `https://aigw.portkey.ai/m` (Gateway URLs page); copy the exact URL from **AI Gateway → Catalogs**'],
          ['The approved-server catalog (Registry API, beta)', '`GET https://mcp-aigw.portkey.ai/v0.1/servers` (self-hosted: your MCP gateway host) with `x-portkey-api-key` only — no Bearer token, no query-string key. Needs the `mcp_servers.list` scope; MCP Registry v0.1 `server.json` format; `limit`, `cursor`, `search`, `updated_since` parameters.'],
          ['Keys that sign forwarded identity', '`https://aigw.portkey.ai/m/.well-known/jwks.json` in the docs'],
          ['Callback for upstream OAuth apps', '`<mcp-gateway-url>/oauth/upstream-callback` — the docs show `https://aigw.portkey.ai/m/oauth/upstream-callback`'],
        ],
      },
      {
        type: 'steps',
        title: 'Add a server and hand it out',
        steps: [
          { title: 'Register the server', text: 'Name, slug, URL, type **Streamable HTTP** and the upstream auth type, then **Test Connection**.', path: ['AI Gateway', 'Integrations', 'MCP Registry', 'Add MCP Server'] },
          { title: 'Provision it to workspaces', text: 'On the server\'s **Access Control** tab — optionally to every new workspace automatically.' },
          { title: 'Choose its tools', text: 'The **Capabilities** tab lists tools, resources and prompts, at two levels: the organisation (MCP Registry → server, org admins and owners) and each workspace (MCP Servers → server, workspace managers and admins). A disabled tool is hidden from `tools/list` and refused if called directly.' },
          { title: 'Choose its users', text: 'In the workspace, the server\'s **User Access** tab — access to the server as a whole (the API adds `default_user_access: allow | deny`). There is no per-user tool list.' },
          { title: 'Give callers a key that may invoke MCP', text: 'A workspace key with the `mcp.invoke` scope. Use a **User** key for servers that sign each user in with OAuth — the troubleshooting page says a Service key cannot. Sending no key starts the gateway\'s own OAuth 2.1 sign-in, which is untested on the cloud SCM gateway.' },
        ],
      },
      {
        type: 'table',
        title: 'Two authentication layers',
        columns: ['Layer', 'Options'],
        minWidth: 600,
        rows: [
          ['Caller → gateway', '**API key** (`Authorization: Bearer` or `x-portkey-api-key`, scope `mcp.invoke`) or an org-claim JWT · **OAuth 2.1** with PKCE, the default when no credential is sent — the client opens a browser · **OAuth through Palo Alto Networks CAS** — self-hosted MCP Gateway only, gateway 2.22.0+, with CIE Directory Sync and an Auth Profile selected'],
          ['Your IdP\'s user token (Bring Your Own Auth)', 'A **per-server check on top of** a gateway credential, not a replacement: `jwt_validation` (JWKS or introspection, required claims) runs after the request has authenticated, and an IdP token alone gets 401. Send the user\'s token in its own header via `headerKey` (e.g. `X-Auth-Token`).'],
          ['Gateway → server', '**None** · **Headers** (static API keys, stored encrypted, never logged) · **Client credentials** (one shared identity) · **OAuth 2.1** per user, by dynamic client registration or a pre-registered `client_id` / `client_secret`'],
          ['Who the user is, upstream', '`user_identity_forwarding`: `claims_header` (JSON claims in `X-User-Claims`), `bearer` (the original token) or `jwt_header` (a gateway-signed RS256 JWT in `X-User-JWT`, 5-minute expiry). Copies of these headers sent by the client are stripped.'],
        ],
      },
      { type: 'code', title: 'Connect a client', tabs: MCP_CLIENT_TABS },
      {
        type: 'table',
        title: 'Controls on tool calls',
        columns: ['Control', 'Status'],
        rows: [
          ['Server access', 'Per workspace (Access Control) and per user (User Access)'],
          ['Tool, resource and prompt provisioning', 'Per organisation and per workspace (Capabilities)'],
          ['Server access by claims', 'Available — `jwt_validation.requiredClaims` / `claimValues`, e.g. only `@yourcompany.com` addresses'],
          ['Guardrails', 'On `tools/call` — arguments (input) and result (output); deterministic checks and webhooks only. Workspace defaults `mcp_input_guardrails` / `mcp_output_guardrails` apply in addition to per-server mappings.'],
          ['Rate limits', 'Policies with `target: "mcp_tools"` per key, server, tool or user → 429. Gateway 2.18+ and backend 1.24+; workspace-scoped only; the `api_key` key is unavailable on OAuth flows.'],
          ['Tool-level claim rules · authorization webhook · circuit breakers', 'Coming soon'],
        ],
      },
      { type: 'code', title: 'An MCP guardrail', text: 'Created with `target: "mcp_tools"` through the Admin API (an SCM service-account token on `api.apps.paloaltonetworks.com/ai_gw/v2`; organisation guardrails under `/ai_gw/admin/v2`), then mapped to servers — optionally to single tools. A blocked call comes back as a JSON-RPC error. Not run from this portal.', tabs: MCP_GUARD_TABS },
      {
        type: 'callout', tone: 'docs', title: 'Two doc pages, two ways to create it',
        text: 'The MCP Guardrails product page posts to `https://aigw.portkey.ai/v1/guardrails` with a gateway key and string actions (`{"on_fail": "deny"}`). The Admin API introduction and the generated reference use the `api.apps.paloaltonetworks.com` host with an SCM token — "a key that works for inference returns 401 here" — and `actions` as `{deny, async, on_success: {feedback}, on_fail: {feedback}}`, as above.',
      },
      {
        type: 'callout', tone: 'warn', title: 'Prisma AIRS does not scan tool calls in the MCP Gateway',
        text: 'The MCP Guardrails page excludes LLM-based and partner checks — PII detection, moderation and every third-party provider — from MCP guardrails, and no page lists the Prisma AIRS check for tool calls. (The 2.20.0 changelog entry that launched MCP guardrails says they reuse "the same guardrail checks available for LLM requests"; until that is tested, go by the product page.) To scan tool parameters and results with AIRS, call the Runtime API with a `tool_event` around each call, or host a `default.webhook` check that does. The model turns still pass the AIRS guardrail on the AI Gateway.',
      },
      {
        type: 'callout', tone: 'observed', title: 'The URL on the SCM tenant used here',
        text: 'This portal\'s SCM tenant brokers servers at `https://mcp-aigw.portkey.ai/<server>/mcp` (e.g. `/huggingface/mcp`, `/github-copilot/mcp`) with `x-portkey-api-key` — not the docs\' default `aigw.portkey.ai/m/…`, so copy the URL from the console. Each tool manifest and every call is also scanned with `tool_event`, because the gateway\'s guardrails do not.',
      },
      {
        type: 'callout', tone: 'docs', title: 'Read the fine print',
        text: [
          'The two URL shapes reconcile: the Gateway URLs page builds each endpoint as `<mcp-gateway-url>/<slug>/mcp`, so the tenant above simply has `https://mcp-aigw.portkey.ai` as its MCP base — the host the Registry API page uses too, although its own sample `remotes[].url` is `https://aigw.portkey.ai/m/github-tools/mcp`.',
          'The MCP-client pages (Claude Code, Claude Desktop, Cursor, VS Code, LibreChat) still show `/m/{workspace-id}/{server-id}/mcp`; the troubleshooting page says the path takes the server **slug**, not a UUID. The Admin API\'s MCP-integration schema also accepts `transport: sse`, while the product pages say Streamable HTTP only.',
          'The Authentication and OAuth pages still present an IdP token as a standalone way in; the rewritten Bring Your Own Auth page says it is rejected without a gateway credential. OAuth through CAS is for the self-hosted MCP Gateway only, from gateway 2.22.0 (on 2.21.0 the consent screen returns 500 "immutable").',
        ],
      },
      {
        type: 'cards',
        items: [
          { icon: Network, tone: '#2dd4bf', title: 'Scan every tool call', kicker: 'Agents & MCP',
            text: 'Two-stage `tool_event` scans with the Runtime API — what this portal runs around every MCP call.', go: 'mcp-tool-events', goLabel: 'Open the guide' },
        ],
      },
    ],
  },
]

export const INTEGRATIONS = [
  {
    id: 'int-gateways',
    group: 'integrations',
    title: 'API gateways with a native integration',
    sub: 'LiteLLM, Kong, Apigee, Azure APIM and more',
    minutes: 7,
    level: 'Build',
    docs: pick('ghIntegrations', 'litellm', 'kong'),
    blocks: [
      {
        type: 'prose',
        text: [
          'If traffic already flows through an API or AI gateway, Prisma AIRS can plug into it. Reference implementations live in Palo Alto Networks\' `prisma-airs-integrations` repository (community examples, best-effort support). LiteLLM ships a built-in guardrail; Kong lists a custom plugin you download and mount yourself.',
          'None of these goes through the SCM AI Gateway: each calls the AIRS Runtime API directly, and none is described in the AIGW developer docs. The sources are the LiteLLM and Kong pages and the repository.',
        ],
      },
      {
        type: 'code', title: 'LiteLLM — built-in guardrail panw_prisma_airs',
        text: 'Parameters from LiteLLM\'s guardrail page. `post_mcp_call` is newer than the repository\'s coverage matrix.',
        tabs: [
          { id: 'yaml', label: 'Model calls', lang: 'yaml', file: 'litellm-config.yaml', code: LITELLM_YAML },
          { id: 'mcp', label: 'MCP tool results', lang: 'yaml', file: 'litellm-config.yaml', code: LITELLM_MCP_YAML },
        ],
      },
      {
        type: 'callout', tone: 'warn',
        text: '`profile_name` is optional only when the API key has a linked profile in Strata Cloud Manager. Without one, AIRS answers 400 "No default AI profile available", which LiteLLM surfaces as a 500 "Security scan failed" — auth and profile errors block even with `fallback_on_error: "allow"`. A block comes back as `{"error": {"type": "guardrail_violation", "code": "panw_prisma_airs_blocked", …}}`, optionally with `scan_id`, `report_id` and `tr_id`. Masking is decided by the AIRS security profile; the LiteLLM flags only choose between continuing with the masked text and blocking.',
      },
      {
        type: 'code', title: 'Kong — Prisma AIRS API Intercept plugin (custom)',
        tabs: [{ id: 'curl', lang: 'curl', code: `# Kong Gateway 3.4+ or Konnect. Not bundled with Kong: mount handler.lua and schema.lua at
# /usr/local/share/lua/5.1/kong/plugins/prisma-airs-intercept and set KONG_PLUGINS=bundled,prisma-airs-intercept
# (Konnect: upload schema.lua through the Control Planes API). OpenAI-compatible chat completions only.
curl -X POST http://localhost:8001/services/{service}/plugins \\
  --data "name=prisma-airs-intercept" \\
  --data "config.api_key=YOUR_API_KEY" \\
  --data "config.profile_name=YOUR_PROFILE_NAME"` }],
      },
      {
        type: 'table',
        title: 'What each integration covers',
        columns: ['Integration', 'Prompt', 'Response', 'Streaming', 'Tool calls'],
        rows: [
          ['LiteLLM', '✓', '✓', 'partial', 'pre-tool (matrix); pre + post with `post_mcp_call` (LiteLLM docs)'],
          ['Kong custom plugin v2 (MCP + SSE)', '✓', '✓', '✓', 'pre + post'],
          ['Kong AI Gateway 2.x policies', '✓', '✓', '—', 'partial'],
          ['Azure API Management (policy fragment)', '✓', '✓', '✓', 'post-tool'],
          ['Google Apigee (SharedFlow)', '✓', '✓', '—', '—'],
          ['Bifrost, TrueFoundry', '✓', '✓', 'partial', '—'],
        ],
        note: 'From the coverage matrix in `prisma-airs-integrations`. The repository also has a Kong `custom-plugin-v3` folder and a Google Cloud Run sample that the matrix does not list. Streaming responses have to be buffered at the gateway before AIRS can scan them.',
      },
    ],
  },

  {
    id: 'int-frameworks',
    group: 'integrations',
    title: 'Frameworks, clouds and assistants',
    sub: 'LangChain, OpenAI Agents, AWS, Microsoft Foundry, n8n, coding assistants',
    minutes: 6,
    level: 'Build',
    docs: pick('ghIntegrations', 'ghN8n', 'ghNemo', 'ghRag', 'gwDevSetup', 'agOpenaiAgents', 'agAgentcore', 'agStrands'),
    blocks: [
      {
        type: 'table',
        columns: ['Stack', 'How to plug Prisma AIRS in', 'Source'],
        minWidth: 640,
        rows: [
          ['LangChain, LlamaIndex, OpenAI Agents SDK, CrewAI, AutoGen', 'Point the model client at the AI Gateway (`https://aigw.portkey.ai/v1`, model `@<slug>/<model>`) — AIRS then applies if the key, the config or an org/workspace default carries the guardrail — or call the Runtime API / SDK in a callback around each model and tool call. There is no dedicated LangChain package.', 'AIGW docs (gateway route)'],
          ['AWS Bedrock', 'Bedrock SDK hooks (Python, Node.js, Java, Go), a Lambda decorator, Bedrock AgentCore and Strands Agents samples in `prisma-airs-integrations/AWS`. AgentCore (e.g. the OpenAI Agents SDK with `set_default_openai_api("chat_completions")`) and Strands (`OpenAIModel(client_args={"base_url": "https://aigw.portkey.ai/v1"})`) can also route through the AI Gateway.', 'Repository; gateway routes from the AIGW docs'],
          ['Microsoft Foundry', 'Native guardrail integration: Foundry → Guardrails → Integrations → Palo Alto Networks, with the AIRS endpoint and key in Key Vault. Enable only prompt injection and toxic content (a 300 ms budget applies).', 'Not in the AIGW docs'],
          ['n8n', 'The official community node `@paloaltonetworks/n8n-nodes-prisma-airs` — prompt, response, dual, batch and masking scans. (The AIGW docs only route n8n through the gateway.)', 'Repository / npm'],
          ['NVIDIA NeMo Guardrails', 'A custom action that calls API intercept (`airs-nemo-guardrails`).', 'GitHub, not the AIGW docs'],
          ['Coding assistants', 'Hooks for Claude Code, Codex, Cursor, Cline, Devin, Gemini CLI, Grok Build and Windsurf that scan prompts, tool calls and fetched content. The repository matrix rates Cursor and Devin prompt scanning as partial and their response scanning as absent.', 'Repository'],
          ['Ollama / OpenWebUI', 'A security proxy in front of Ollama (`panw-api-ollama`, Rust). The AIGW docs instead route Ollama and Open WebUI through the gateway.', 'GitHub, not the AIGW docs'],
        ],
      },
      {
        type: 'cards',
        items: [
          { icon: Terminal, tone: '#a855f7', title: 'Claude Code hooks in this portal', kicker: 'AI Code Assistant Protection',
            text: 'Zero-code-change hook scripts that scan every prompt, URL fetch and MCP tool call before it reaches the model.', go: 'pillar:claudeHooks', goLabel: 'Open the pillar' },
          { icon: Network, tone: '#EC4899', title: 'Frameworks through the gateway', kicker: 'SCM AI Gateway',
            text: 'Base URL, key and model slug for the agent frameworks the AIGW docs cover — and the examples that break on newer tenants.', go: 'gw-agents', goLabel: 'Open the guide' },
        ],
      },
    ],
  },
]

