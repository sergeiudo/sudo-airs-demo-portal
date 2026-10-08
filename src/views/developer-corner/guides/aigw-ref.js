import { Braces, Cloud, KeyRound, Plug, Server, ShieldCheck, Waypoints } from 'lucide-react'
import { pick } from './links'

/**
 * AI Gateway reference guides: the Inference API, the Admin API, and the model
 * providers (Bedrock, Vertex, Azure, Claude Platform on AWS).
 *
 * Read on 2026-10-08: the AIGW API reference (every page is a bare OpenAPI
 * snippet — 188 operations in github.com/PaloAltoNetworks/openapi), the product
 * pages that carry the behaviour, the provider integration pages and the
 * Enterprise Gateway changelog (2.27.0). Nothing here was run from this portal;
 * the code tabs are deliberately not marked verified. Observed callouts carry
 * only facts already seen on this portal's SCM tenant.
 */

// ─── Inference API ──────────────────────────────────────────────────────────

const INF_REQUEST_TABS = [
  { id: 'curl', lang: 'curl', code: `# -D - prints the response headers along with the body
curl -s -D - https://aigw.portkey.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $GATEWAY_API_KEY" \\
  -H "x-portkey-config: pc-<config-slug>" \\
  -H "x-portkey-trace-id: order-4711" \\
  -H 'x-portkey-metadata: {"_user": "jane@example.com", "app": "support-bot"}' \\
  -H "x-portkey-strict-open-ai-compliance: false" \\
  -d '{"model": "@<integration-slug>/<model>", "messages": [{"role": "user", "content": "ping"}]}'

# Back come x-portkey-trace-id, x-portkey-cache-status,
# x-portkey-retry-attempt-count and x-portkey-last-used-option-index` },
  { id: 'python', lang: 'python', code: `import json
import os

from openai import OpenAI

client = OpenAI(
    api_key=os.environ["GATEWAY_API_KEY"],
    base_url="https://aigw.portkey.ai/v1",
    default_headers={
        "x-portkey-config": "pc-<config-slug>",
        "x-portkey-strict-open-ai-compliance": "false",
    },
)

# with_raw_response exposes the gateway's response headers
raw = client.chat.completions.with_raw_response.create(
    model="@<integration-slug>/<model>",
    messages=[{"role": "user", "content": "ping"}],
    extra_headers={
        "x-portkey-trace-id": "order-4711",
        "x-portkey-metadata": json.dumps({"_user": "jane@example.com", "app": "support-bot"}),
    },
)
print(raw.headers.get("x-portkey-trace-id"), raw.headers.get("x-portkey-cache-status"))
completion = raw.parse()
print(completion.choices[0].message.content)` },
  { id: 'node', lang: 'node', code: `import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.GATEWAY_API_KEY,
  baseURL: 'https://aigw.portkey.ai/v1',
  defaultHeaders: {
    'x-portkey-config': 'pc-<config-slug>',
    'x-portkey-strict-open-ai-compliance': 'false',
  },
})

// .withResponse() exposes the gateway's response headers
const { data, response } = await client.chat.completions
  .create(
    { model: '@<integration-slug>/<model>', messages: [{ role: 'user', content: 'ping' }] },
    { headers: {
        'x-portkey-trace-id': 'order-4711',
        'x-portkey-metadata': JSON.stringify({ _user: 'jane@example.com', app: 'support-bot' }),
    } },
  )
  .withResponse()

console.log(response.headers.get('x-portkey-trace-id'), response.headers.get('x-portkey-cache-status'))
console.log(data.choices[0].message.content)` },
]

// ─── Admin API ──────────────────────────────────────────────────────────────

const ADMIN_TOKEN = `# Exchange the service account for a token. The scope names the tenant (TSG);
# the token then carries it, so no Admin call takes a tenant parameter.
ACCESS_TOKEN=$(curl -s -X POST https://auth.apps.paloaltonetworks.com/oauth2/access_token \\
  -u "$CLIENT_ID:$CLIENT_SECRET" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials&scope=tsg_id:$TSG_ID" | jq -r .access_token)
# → {"access_token": "…", "token_type": "Bearer", "expires_in": 900}

curl -s https://api.apps.paloaltonetworks.com/ai_gw/v2/configs \\
  -H "Authorization: Bearer $ACCESS_TOKEN"`

const ADMIN_CONFIG = `# A config with retries, a simple cache and two saved guardrails — and no provider:
# the request's @slug picks the model. (A "targets" provider would override it.)
curl -s -X POST https://api.apps.paloaltonetworks.com/ai_gw/v2/configs \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "support-prod",
    "workspace_id": "<workspace-uuid>",
    "config": {
      "retry": { "attempts": 3, "on_status_codes": [429, 500, 502, 503, 504] },
      "cache": { "mode": "simple" },
      "input_guardrails": ["<input-guardrail-id>"],
      "output_guardrails": ["<output-guardrail-id>"]
    }
  }'
# → {"success": true, "data": {"id": "…", "version_id": "…"}} — no slug comes back

# Find the pc-… slug the key and requests refer to
curl -s "https://api.apps.paloaltonetworks.com/ai_gw/v2/configs?workspace_id=<workspace-uuid>" \\
  -H "Authorization: Bearer $ACCESS_TOKEN"`

const ADMIN_KEY = `curl -s -X POST https://api.apps.paloaltonetworks.com/ai_gw/v2/api-keys/service \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "support-bot-prod",
    "workspace_id": "<workspace-uuid>",
    "scopes": ["completions.write"],
    "defaults": {
      "config_id": "pc-<config-slug>",
      "allow_config_override": false,
      "metadata": { "team": "support" }
    },
    "rotation_policy": { "rotation_period": "monthly", "key_transition_period_ms": 86400000 }
  }'
# → {"id": "…", "key": "…", "object": "api-key"} — the key value is returned once`

const ADMIN_LOGS = `# One log — on the gateway host. The Admin intro files it under the Admin API (SCM token);
# the AB03 article lists gateway-key scopes for it (logs.read). The docs do not settle which.
curl -s "https://aigw.portkey.ai/v1/logs/<log-id>" \\
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Many logs — Logs Export (product page, gateway key with logs.export; not in the reference)
curl -s -X POST https://aigw.portkey.ai/v1/logs/exports \\
  -H "Authorization: Bearer $GATEWAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "filters": { "created_at": { "gte": "2026-09-01T00:00:00Z", "lte": "2026-09-30T23:59:59Z" } },
    "requested_data": ["id", "trace_id", "created_at", "ai_model", "cost", "response_time", "response_status_code", "metadata"]
  }'
# then POST /v1/logs/exports/<export-id>/start, poll GET /v1/logs/exports/<export-id>
# until "success", and GET /v1/logs/exports/<export-id>/download for a signed JSONL URL

# Aggregates — analytics on the Admin base with the token (workspace_slug is required)
curl -s "https://api.apps.paloaltonetworks.com/ai_gw/v2/analytics/graphs/cost?workspace_slug=<workspace-slug>&time_of_generation_min=2026-09-01T00:00:00Z&time_of_generation_max=2026-09-30T23:59:59Z" \\
  -H "Authorization: Bearer $ACCESS_TOKEN"`

const ADMIN_ORG_GUARD = `# An organisation guardrail with the Prisma AIRS check (schema from the API reference;
# the docs give no example). The AIRS credential sits on the gateway's PANW Prisma AIRS
# integration, not in this body.
curl -s -X POST https://api.apps.paloaltonetworks.com/ai_gw/admin/v2/guardrails \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "airs-org-input-scan",
    "target": "llm",
    "checks": [
      { "id": "panw-prisma-airs.intercept", "parameters": { "profile_name": "<airs-profile-name>" } }
    ],
    "actions": {
      "deny": true,
      "async": false,
      "on_success": { "feedback": { "value": 5, "weight": 1, "metadata": "" } },
      "on_fail": { "feedback": { "value": -5, "weight": 1, "metadata": "" } }
    }
  }'
# → {"id": "…", "slug": "…", "version_id": "…"}`

const ADMIN_EXCLUDE = `# Take one workspace out of the organisation's input guardrails
# (Enforcing Org Level Guardrails page — not in the API reference)
curl -s -X PUT https://api.apps.paloaltonetworks.com/ai_gw/admin/v2/workspace-exclusions/input-guardrails \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "organisation_id": "<organisation-id>",
    "workspaces": [ { "workspace_id": "<workspace-id>", "excluded": true } ]
  }'
# /output-guardrails for the output side · "excluded": false brings it back under enforcement
# · add "override_existing": true to replace the list instead of merging into it`

// ─── Providers ──────────────────────────────────────────────────────────────

const BEDROCK_TRUST = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::039293892788:role/AirsGwEnterpriseRole" },
      "Action": "sts:AssumeRole",
      "Condition": { "StringEquals": { "sts:ExternalId": "<your-external-id>" } }
    }
  ]
}`

const BEDROCK_PERMS = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeDirectAndThroughProfiles",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/*",
        "arn:aws:bedrock:*:*:inference-profile/*",
        "arn:aws:bedrock:*:*:application-inference-profile/*"
      ]
    },
    {
      "Sid": "ResolveProfiles",
      "Effect": "Allow",
      "Action": "bedrock:GetInferenceProfile",
      "Resource": [
        "arn:aws:bedrock:*:*:inference-profile/*",
        "arn:aws:bedrock:*:*:application-inference-profile/*"
      ]
    }
  ]
}`

const VERTEX_WIF = `# Hybrid gateway on EKS reaching Vertex AI with no key (Vertex AI page,
# "Cross-Cloud Workload Identity Federation"). The gateway's IAM role also
# needs sts:GetCallerIdentity; the pool needs an AWS provider, not OIDC.
environment:
  data:
    GCP_AUTH_MODE: workload
    GCP_WIF_AUDIENCE: //iam.googleapis.com/<workload-identity-provider-resource-name>
    # only when impersonating a Google service account:
    # GCP_WIF_SERVICE_ACCOUNT_EMAIL: <service-account-email>`

const CLAUDE_AWS_ENABLE = `# One-time, in the AWS account that holds the Claude Platform workspace.
# Without it every request fails: "Outbound web identity federation is disabled for your account"
aws iam enable-outbound-web-identity-federation`

export const AIGW_REF = [
  {
    id: 'gw-inference-api',
    group: 'gateway',
    title: 'Inference API reference',
    sub: 'Base URLs, auth, every header, response headers, error codes and all 18 endpoint families',
    minutes: 12,
    level: 'Reference',
    docs: pick('agApiRef', 'agAuth', 'agHeaders', 'arResponseSchema', 'arErrorCodes', 'arConfigObject', 'arSupportedProviders', 'gwSpec',
      'agSavedOnly', 'agStrict', 'agBeta', 'agNitro', 'agRealtime', 'agOtel', 'agLogsExport', 'agMcpRegApi', 'agHelpAb03', 'agHelpMcp', 'gwDevJwt', 'agAgentic', 'agChangelog'),
    blocks: [
      {
        type: 'prose',
        text: [
          'The Gateway API runs inference; the Admin API configures what it may do. Point an OpenAI-compatible client at the gateway, name a model as `@<integration-slug>/<model>`, and routing, guardrails, logging and budgets come from configuration the administrators already set.',
          'The API reference is generated from the published OpenAPI spec: 188 operations, and **no prose** — every endpoint page is a bare schema with empty descriptions. The behaviour lives in the product pages. This guide puts the two side by side and names where they disagree.',
        ],
      },
      {
        type: 'facts',
        items: [
          { label: 'Base URL', value: 'https://aigw.portkey.ai/v1', mono: true, sub: 'Self-hosted: your gateway host + `/v1`' },
          { label: 'Gateway auth', value: 'Authorization: Bearer', mono: true, sub: 'Or `x-portkey-api-key` when Authorization carries a provider key' },
          { label: 'Pick a model', value: '@<slug>/<model>', mono: true, sub: 'The integration slug from the Model Catalog' },
          { label: 'In the spec', value: '18 families', sub: 'Messages is not one of them' },
        ],
      },
      {
        type: 'table',
        title: 'Surfaces and base URLs',
        columns: ['Surface', 'URL', 'Notes'],
        minWidth: 680,
        rows: [
          ['Inference', '`https://aigw.portkey.ai/v1`', 'OpenAI SDKs and raw HTTP. The Anthropic SDK and Claude Code take `https://aigw.portkey.ai` — they append `/v1/messages` themselves.'],
          ['Self-hosted', '`https://<your-gateway-host>/v1`', 'The spec\'s second server. Same paths.'],
          ['MCP Gateway', '`/m` — docs: `https://aigw.portkey.ai/m/<slug>/mcp`', 'Needs the `mcp.invoke` scope. See the observed note below for this tenant\'s URL.'],
          ['MCP Registry API (beta)', '`GET https://mcp-aigw.portkey.ai/v0.1/servers`', '`x-portkey-api-key` only — no Bearer. Approved servers in the MCP Registry `v0.1` format.'],
          ['Agent Gateway', '`/agent` — `https://aigw.portkey.ai/agent/<slug>`', 'A2A agents, `agents.invoke` scope. The changelog (2.6.1) calls it a preview at `/v1/agent/:agentServerId/*`.'],
          ['Realtime', '`wss://aigw.portkey.ai/v1/realtime?model=<model>`', 'OpenAI Realtime over WebSocket.'],
          ['OTLP ingest', '`https://aigw.portkey.ai/v1/otel`', 'Also `/v1/otel/v1/traces` and `/v1/otel/v1/logs`. The same page and several tracing-provider pages say `/v1/logs/otel`.'],
          ['Logs', '`POST /v1/logs` · `GET /v1/logs/{logId}`', 'On the gateway host, but listed under the Admin API (see "Admin API: the gateway as code").'],
        ],
      },
      {
        type: 'table',
        title: 'Authentication',
        columns: ['Credential', 'How to send it', 'Notes'],
        minWidth: 660,
        rows: [
          ['Gateway API key', '`Authorization: Bearer <key>`', 'A **workspace** key — Service (automation) or User (one person). Admin keys cannot call data-plane endpoints (AB03).'],
          ['The same key, next to a provider credential', '`x-portkey-api-key: <key>`', 'Use it when `Authorization` carries the provider\'s own key (bring-your-own modes below).'],
          ['JWT', '`Authorization: Bearer <jwt>`, or the raw token in `x-portkey-api-key` (no `Bearer`)', 'RS256 only, with a `kid` that matches the organisation\'s JWKS; `x-portkey-api-key` wins when both are present. 401 invalid or expired, 403 scope or workspace not allowed, 412 usage limit, 429 rate limit. A gateway-local JWT may name a workspace with `x-portkey-workspace` (2.25.0).'],
          ['Admin API', '—', 'Takes neither keys nor JWTs: a Strata Cloud Manager service-account token only (401 otherwise).'],
        ],
      },
      {
        type: 'table',
        title: 'Scopes a key needs',
        columns: ['Scope', 'Grants'],
        rows: [
          ['`completions.write`', 'Every data-plane endpoint, per the AB03 help article: chat, completions, responses, messages, embeddings, images, audio, files, batches, fine-tuning, realtime, models, `/v1/gateway/tokenize`, decisions. (The API Keys page lists only chat, completions, images and audio.)'],
          ['`virtual_keys.list`', '`GET /v1/models` for a key without `completions.write`.'],
          ['`mcp.invoke` · `agents.invoke`', 'The MCP Gateway and the Agent Gateway.'],
          ['`logs.write` with `completions.write`', '`POST /v1/logs` needs both. `GET /v1/logs/{id}` accepts `logs.read`, `logs.write` or `completions.write`.'],
          ['`logs.export`', 'The Logs Export flow (`/v1/logs/exports`).'],
        ],
      },
      {
        type: 'table',
        title: 'Choosing the provider — four ways',
        columns: ['Way', 'What you send', 'With Block Inline Configs on'],
        minWidth: 680,
        rows: [
          ['Model Catalog provider', '`"model": "@<slug>/<model>"` — or `x-portkey-provider: @<slug>` with a bare model, for endpoints without a `model` field (files, batches), image edits, Claude Code. Legacy: `x-portkey-virtual-key`.', 'Allowed. `Authorization` stays free for the gateway key.'],
          ['Saved config', '`x-portkey-config: pc-<slug>`', 'A `pc-…` id is allowed; config JSON in the header → 400 `inline_config_blocked`.'],
          ['Provider name + provider credential', '`x-portkey-provider: openai`, `Authorization: Bearer <provider key>`, gateway key in `x-portkey-api-key`. Cloud variants: `x-portkey-aws-*`, `x-portkey-vertex-*`, `x-portkey-azure-*`.', '400 `inline_provider_blocked`.'],
          ['Custom host', '`x-portkey-custom-host` + `x-portkey-provider` + the provider\'s credential', '400 `inline_custom_host_blocked`. On SaaS the host must be publicly reachable anyway.'],
        ],
        note: 'Block Inline Configs is on by default for organisations created on or after 19 June 2026; only the first violation is reported. Since 2.13.0, user-passable provider parameters are ignored while it is on. Many doc examples — including the test requests on the Gateway Registration and EKS, GKE, AKS and ECS pages — send `x-portkey-provider: openai` and fail on such a tenant.',
      },
      {
        type: 'callout', tone: 'observed', title: 'How this tenant routes',
        text: [
          'Block Inline Configs is **on**: inline JSON configs and raw provider names are rejected, so every call here uses a saved `pc-…` id and an `@slug`.',
          'A provider pinned in a config\'s `targets` overrides the `@slug` in the request — the call goes where the config says, whatever model prefix was sent.',
        ],
      },
      {
        type: 'table',
        title: 'Request headers',
        columns: ['Header', 'Value', 'What it does'],
        minWidth: 720,
        rows: [
          ['`Authorization`', '`Bearer <key or JWT>`', 'Gateway auth — or the provider credential in the bring-your-own modes.'],
          ['`x-portkey-api-key`', 'key, or a raw JWT', 'Gateway auth when `Authorization` is taken.'],
          ['`x-portkey-provider`', '`@<slug>`, or a provider name', 'Selects the provider. A bare name means bring-your-own credentials.'],
          ['`x-portkey-config`', '`pc-<slug>`, or JSON', 'Routing, retries, cache, guardrails as one saved object.'],
          ['`x-portkey-virtual-key`', 'string', 'Legacy provider selector; still accepted.'],
          ['`x-portkey-custom-host`', 'URL', 'Upstream base URL. Private ranges and metadata hosts are refused — on SaaS always, on a hybrid gateway unless `TRUSTED_CUSTOM_HOSTS` allows them.'],
          ['`x-portkey-trace-id`', 'string', 'Groups requests; generated when absent and echoed back.'],
          ['`x-portkey-span-id` · `x-portkey-parent-span-id` · `x-portkey-span-name`', 'string', 'Spans inside a trace. In the spec (chat, realtime, rerank, decisions, OCR), not on the Headers page.'],
          ['`x-portkey-metadata`', 'JSON string', 'Filterable metadata. `_user`, `_prompt`, `_organisation` and `_environment` are special keys.'],
          ['`x-portkey-cache-force-refresh`', '`true` / `false`', 'Skip the cache read and store a fresh answer.'],
          ['`x-portkey-cache-namespace`', 'string', 'Partition the cache, ignoring metadata and other headers.'],
          ['`x-portkey-request-timeout`', 'milliseconds', 'Terminate the request after this long → 408.'],
          ['`x-portkey-fetch-integrated-models`', '`true`', '`GET /v1/models` returns the Model Catalog even when a provider is named (else it proxies the provider\'s list).'],
          ['`x-portkey-forward-headers`', 'header names', 'Forward those headers upstream untouched → `inline_forward_headers_blocked` under Block Inline Configs.'],
          ['`x-portkey-sensitive-headers`', 'header names', 'Mask those header values in logs. Does not forward them.'],
          ['`x-portkey-strict-open-ai-compliance`', '`false`', 'Keep `hook_results`, thinking `content_blocks` and citations. Default `true` with OpenAI SDKs. On the Strict compliance page, not the Headers page.'],
          ['`x-portkey-beta`', 'comma list', '`use-responses-api-2026-07-30` (Messages via the Responses adapter), `server-side-mcp-2026-06-01` (gateway-run remote MCP).'],
          ['`x-portkey-nitro-mode`', '`true`', 'Pass the body through untransformed: no retries, no `override_params`, no input guardrails.'],
          ['`x-portkey-workspace`', 'slug or id', 'Workspace for a user-attributed gateway-local JWT (2.25.0).'],
          ['`anthropic-version` · `anthropic-beta`', 'string', 'Passed through to Anthropic-format upstreams (2.22.0); `anthropic-version` also makes `GET /v1/models` answer in Anthropic\'s shape.'],
          ['Azure', '—', '`x-portkey-azure-resource-name`, `x-portkey-azure-deployment-id`, `x-portkey-azure-api-version`, `x-portkey-azure-model-name`'],
          ['Vertex AI', '—', '`x-portkey-vertex-project-id`, `x-portkey-vertex-region`, `X-Vertex-AI-LLM-Request-Type`'],
          ['Bedrock · Claude Platform on AWS', '—', '`x-portkey-aws-access-key-id`, `x-portkey-aws-secret-access-key`, `x-portkey-aws-region`, `x-portkey-aws-session-token`; `x-portkey-anthropic-aws-workspace-id`'],
        ],
        note: 'SDKs: camelCase in JavaScript (`traceID`, `cacheForceRefresh`), snake_case in Python. With the OpenAI SDKs, send gateway headers as `defaultHeaders` / `default_headers`, or per call.',
      },
      { type: 'code', title: 'A request with gateway headers — and reading what comes back', tabs: INF_REQUEST_TABS },
      {
        type: 'table',
        title: 'Response headers',
        columns: ['Header', 'Meaning'],
        rows: [
          ['`x-portkey-trace-id`', 'Your trace id, or the one the gateway generated.'],
          ['`x-portkey-cache-status`', '`HIT`, `SEMANTIC HIT`, `MISS`, `SEMANTIC MISS`, `DISABLED` (no cache asked for) or `REFRESH` (force refresh sent).'],
          ['`x-portkey-retry-attempt-count`', 'Retries made, not counting the first call — 3 means four calls.'],
          ['`x-portkey-last-used-option-index`', 'Which config target served, as a JSONPath such as `config.targets[2]`.'],
        ],
      },
      {
        type: 'table',
        title: 'Error codes',
        columns: ['Status', 'Meaning', 'Notes'],
        minWidth: 680,
        rows: [
          ['200, content replaced', 'Guardrail deny with `soft_deny_200`', 'Changelog 2.14.0: a denial formatted as a normal chat completion, for clients that treat 4xx as fatal. The Decisions page calls the flag `softDeny200`. Read the verdict in `hook_results`.'],
          ['246', 'Guardrail failed, request let through', '`deny: false` on a synchronous guardrail.'],
          ['446', 'Guardrail failed, request denied', '`deny: true`. Body: `error.type` `hooks_failed`, plus `hook_results`.'],
          ['400 `inline_*`', 'Block Inline Configs', '`inline_config_blocked`, `inline_provider_blocked`, `inline_custom_host_blocked`, `inline_provider_url_blocked`, `inline_forward_headers_blocked`. Body carries `error.code` and `error.field`.'],
          ['400', 'Config override refused', 'The key has a default config with Allow Config Override off.'],
          ['401', 'Bad or missing credential', '"Portkey Error: Invalid API Key. Error Code: 03" (MCP troubleshooting page); an invalid or expired JWT.'],
          ['403 · `AB03`', 'Not allowed', 'Missing scope, an Admin key on the data plane, a resource in another workspace, or an org security setting. Body: `{"success": false, "data": {"message": "…", "errorCode": "AB03"}}`.'],
          ['408', 'Timed out', 'The gateway\'s timeout or the provider\'s. Not in the default retry list.'],
          ['412', 'Budget exhausted', 'A usage limit on the key, provider, workspace or a policy.'],
          ['429', 'Rate limited', 'A gateway rate limit or the provider\'s.'],
          ['Provider codes', 'Passed through unchanged', 'The Support page says gateway errors are prefixed "AI Gateway Error"; the troubleshooting page quotes "Portkey Error".'],
          ['MCP `-32446`', 'MCP guardrail block', 'A JSON-RPC error inside the MCP response.'],
          ['MCP 502', 'Upstream MCP server unreachable', 'Names the server (2.27.0; a generic 500 before).'],
        ],
      },
      {
        type: 'callout', tone: 'observed', title: 'What this tenant returns',
        text: [
          'A guardrail block comes back as **HTTP 200** with the message content replaced by "The guardrail checks defined in the config failed." and the model never called — the documented `soft_deny_200` shape, not 446. Detect a block from the `hook_results` verdict, not from the status code.',
          'MCP servers answer at `https://mcp-aigw.portkey.ai/<server>/mcp` with `x-portkey-api-key`, not at the `aigw.portkey.ai/m/…` path the docs show.',
        ],
      },
      {
        type: 'table',
        title: 'Endpoint families — the 18 in the spec',
        columns: ['Family', 'Endpoints', 'Notes'],
        minWidth: 760,
        rows: [
          ['Chat', '`POST /chat/completions`', 'Any provider. Guardrails on input and output. `stream_options.include_usage` for real token counts.'],
          ['Completions', '`POST /completions`', 'Legacy text completions. Guardrails in and out.'],
          ['Responses', '`POST /responses` · `GET` · `DELETE /responses/{id}` · `GET /responses/{id}/input_items`', 'Native on OpenAI, Azure OpenAI, xAI, Groq, OpenRouter, Azure AI, Perplexity; elsewhere an adapter that loses the stateful features. Guardrails on POST.'],
          ['Decisions', '`POST /decisions`', '`model`, `state`, `questions` (`noul` · `choice` · `score`). TypeSafe Jev models, direct or via OpenRouter (2.27.0). No streaming; input guardrails read `state` only.'],
          ['Embeddings', '`POST /embeddings`', 'Input guardrails only; PII redaction applies (2.26.0).'],
          ['Rerank', '`POST /rerank`', '`model`, `query`, `documents`, `top_n`.'],
          ['OCR', '`POST /ocr`', '`document` as `document_url` or `image_url`. Mistral, Azure AI Foundry, Mistral on Vertex.'],
          ['Images', '`POST /images/generations` · `/images/edits` · `/images/variations`', 'No guardrails. Edits need the provider in a header.'],
          ['Audio', '`POST /audio/speech` · `/audio/transcriptions` · `/audio/translations`', 'No guardrails.'],
          ['Moderations', '`POST /moderations`', 'No guardrails.'],
          ['Models', '`GET /models` · `GET` · `DELETE /models/{model}`', 'The spec serves the last two from `api.apps.paloaltonetworks.com/ai_gw/v2`. List filters: `ai_service`, `provider`, `limit`, `offset`, `sort`, `order`.'],
          ['Model pricing', '`GET /model-configs/pricing/{provider}/{model}`', 'No auth. The Gateway Models page calls it on `https://aigw.portkey.ai/model-configs/…` (no `/v1`); the spec puts it on `/ai_gw/v2`.'],
          ['Files', '`GET` · `POST /files` · `GET` · `DELETE /files/{id}` · `GET /files/{id}/content`', 'No `model` field, so name the provider with `x-portkey-provider: @<slug>`. Purpose `assistants`, `batch`, `fine-tune` or `vision`.'],
          ['Batch', '`POST` · `GET /batches` · `GET /batches/{id}` · `POST /batches/{id}/cancel` · `GET /batches/{id}/output`', '`/output` is gateway-specific. The capabilities page says batches run no guardrails; data service 1.8.0 runs them on provider batches.'],
          ['Fine-tuning', '`POST` · `GET /fine_tuning/jobs` · `GET /fine_tuning/jobs/{id}` · `…/events` · `…/checkpoints` · `POST …/cancel`', '`portkey_options` carries the provider and the S3 or GCS bucket. The AB03 article spells it `/fine-tuning/jobs`.'],
          ['Realtime', '`GET /realtime?model=`', 'WebSocket upgrade; OpenAI Realtime.'],
          ['Assistants', '23 operations under `/assistants`, `/threads`, `/threads/{id}/messages`, `/threads/{id}/runs` (+ `submit_tool_outputs`, `cancel`, `steps`), `POST /threads/runs`', 'OpenAI Assistants v2. No guardrails.'],
          ['Vector stores', '13 operations under `/vector_stores`, `/vector_stores/{id}/files`, `/vector_stores/{id}/file_batches` (+ `cancel`, `files`)', 'OpenAI vector stores.'],
        ],
      },
      {
        type: 'table',
        title: 'Documented elsewhere, missing from the spec',
        columns: ['Endpoint', 'Where it is documented'],
        minWidth: 600,
        rows: [
          ['`POST /v1/messages` · `POST /v1/messages/count_tokens`', 'Messages page and the Anthropic count-tokens page. The Messages page links an "API Reference: Messages" that does not exist.'],
          ['Responses cancel and input-token counting', 'Changelog 2.25.1 — no paths given.'],
          ['`/v1/gateway/tokenize`', 'Only the AB03 article\'s scope table.'],
          ['`/v1/logs/exports` (+ `/{id}/start`, `/{id}`, `/{id}/download`, `/{id}/cancel`, `/field-restrictions`)', 'Logs Export page — gateway key with `logs.export`.'],
          ['`/v1/otel` (`/v1/otel/v1/traces`, `/v1/otel/v1/logs`)', 'OpenTelemetry page.'],
          ['`/m/<slug>/mcp` · `/agent/<slug>` · `GET /v0.1/servers`', 'MCP Gateway, Agent Gateway and MCP Registry API pages.'],
          ['`/v1/feedback` with a gateway key', 'Feedback page. The spec has `POST /feedback` on the Admin base with an SCM token instead.'],
          ['Prompt render, guardrail invoke', 'Only as scopes (`prompts.render`, `guardrails.invoke`); no path in the reference.'],
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Where the reference pages are wrong or thin',
        text: [
          '**Supported Providers matrix** — treat it as unreliable. AWS Bedrock and Google Vertex AI show ❌ for embeddings, batch, files and fine-tuning, though each has its own page for all four; Vertex shows ❌ for vision, tools and OCR (Mistral OCR on Vertex since 2.19.0); there are no Responses, Rerank or Decisions columns, and a "Prisma AIRS AI Gateway Prompts" column survives the rebrand.',
          '**Headers page** — the Bedrock list repeats `x-portkey-aws-session-token` and omits `x-portkey-aws-access-key-id`; the metadata and forward-headers examples are not valid JSON (single quotes). Send `x-portkey-metadata` as real JSON.',
          '**Errors page** lists only 408, 412, 429, 446 and 246 — no soft deny, no `inline_*` codes, no 401/403. **Response Schema** says the trace id is reused "from the request body"; it is a request header.',
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Agentic Usage: the SDK skills point at the wrong gateway',
        text: 'The Agentic Usage page recommends `npx add-skill portkey-ai/skills` for coding assistants. In that repo (last pushed 2026-03-25) the Python skill routes with the legacy `virtual_key` and never sets a base URL — so generated code targets `api.portkey.ai`, not `aigw.portkey.ai`; the TypeScript skill is still a placeholder ("PLACEHOLDER: Replace this content…") whose sample uses a default import of `portkey-ai`. Nothing in them knows about SCM, Block Inline Configs or the Prisma AIRS guardrail.',
      },
      {
        type: 'cards',
        items: [
          { icon: Waypoints, tone: '#EC4899', title: 'One endpoint, three formats', kicker: 'Universal API',
            text: 'Chat Completions, Responses and Messages against any provider — and what each loses in translation.', go: 'gw-universal' },
          { icon: ShieldCheck, tone: '#EC4899', title: 'Detect a guardrail block', kicker: 'AIRS guardrail',
            text: 'The 200 / 246 / 446 outcomes and how to read `hook_results`.', go: 'gw-guardrail' },
          { icon: Braces, tone: '#d946ef', title: 'The other API', kicker: 'Admin API',
            text: 'Configs, keys, guardrails, integrations and policies with an SCM token.', go: 'gw-admin-api' },
        ],
      },
    ],
  },

  {
    id: 'gw-admin-api',
    group: 'gwgov',
    title: 'Admin API: the gateway as code',
    sub: 'Service-account token, three base URLs, every endpoint group, recipes — and what still needs the console',
    minutes: 12,
    level: 'Reference',
    docs: pick('arAdminIntro', 'arAdminAuth', 'arAdminErrors', 'scmTokens', 'arCreateConfig', 'arCreateApiKey', 'arCreateGuardrail', 'arCreateOrgGuardrail',
      'arCreateIntegration', 'arCreateMcpIntegration', 'arCreateMcpServer', 'arCreateDeployment', 'arUsagePolicy', 'arRatePolicy', 'arAnalyticsCost', 'arGetLog',
      'agOrgGuard', 'agLogsExport', 'agKeyRotation', 'agSecretRefs', 'gwSpec'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Everything an administrator sets up in Strata Cloud Manager — integrations, configs, guardrails, keys, policies, MCP servers, hybrid data planes — has an Admin API endpoint, with a few exceptions listed at the end. The API is called with a **Strata Cloud Manager access token** issued to a service account. A gateway API key, the one that works for inference, returns 401 on every Admin endpoint.',
          'The token names one tenant (TSG); one TSG is one AI Gateway organisation. No request carries a tenant parameter — the token decides where it lands.',
        ],
      },
      {
        type: 'steps',
        title: 'Get a token',
        steps: [
          {
            title: 'Create a service account',
            text: 'Choose the tenant, add an identity of type **Service Account**, and save the Client ID and Client Secret — the secret is shown once. Its display name is `<name>@<tsg_id>.iam.panserviceaccount.com`; note the TSG id. Then assign a role: a service account with no role cannot obtain a token.',
            path: ['Strata Cloud Manager', 'System Settings', 'Identity & Access', 'Add Identity'],
          },
          {
            title: 'Exchange it for a token',
            text: 'Basic auth with the client credentials, the TSG in `scope`, on the separate auth host `auth.apps.paloaltonetworks.com`.',
            code: [{ id: 'bash', lang: 'bash', code: ADMIN_TOKEN }],
          },
          {
            title: 'Cache it for 15 minutes',
            text: 'Tokens last 900 seconds. Read `expires_in`, keep one in memory and refresh about a minute early — a token carried across a long job is what fails, with AB05.',
            note: 'A service account can mint tokens for its own TSG and every descendant, never an ancestor or a peer. Cross-hierarchy access needs an access policy: `POST https://api.strata.paloaltonetworks.com/iam/v1/access_policies` with `role`, `resource` (`prn:<tsg-id>::::`) and `principal`. It does not check that the principal exists.',
          },
        ],
      },
      {
        type: 'table',
        title: 'Three base URLs — the resource decides',
        columns: ['Base URL', 'Serves'],
        minWidth: 640,
        rows: [
          ['`https://api.apps.paloaltonetworks.com/ai_gw/v2`', 'Configs, workspace guardrails, providers, API keys, usage and rate-limit policies, MCP servers, analytics, feedback (plus `/models/{model}` and model pricing in the spec)'],
          ['`https://api.apps.paloaltonetworks.com/ai_gw/admin/v2`', 'Integrations, MCP integrations, secret references, deployments (hybrid data planes), organisation guardrails, workspace exclusions'],
          ['`https://aigw.portkey.ai/v1`', '`POST /logs` and `GET /logs/{logId}` — self-hosted gateways substitute their own host'],
        ],
        note: 'The spec writes organisation guardrails as `/admin/v2/guardrails` on `…/ai_gw` — the same place. Where the intro and an endpoint page disagree, the intro says trust the endpoint page.',
      },
      {
        type: 'table',
        title: 'Scoping: organisation or workspace',
        columns: ['', 'Rule'],
        rows: [
          ['Organisation level', 'Addressed by the token alone: integrations, MCP integrations, secret references, deployments, organisation guardrails.'],
          ['Workspace level', '`workspace_id` as a **query** parameter on GET and list calls, in the **body** on POST and PUT; a UUID or a slug both work, and omitting it means the organisation default. Configs, providers, workspace guardrails, MCP servers.'],
          ['Analytics', 'Need `workspace_slug` (query, required) instead, with `time_of_generation_min` and `time_of_generation_max`.'],
          ['Keys and policies', 'Span both levels. `POST /api-keys/{sub-type}` takes the level from the token; `sub-type` only picks `user` or `service`.'],
          ['Slugs vs ids', 'Slugs for what you name (`/configs/{slug}`, `/integrations/{slug}`, `/providers/{slug}`); ids for what the gateway names (guardrails, MCP servers, MCP integrations, policies, API keys, secret references, deployments). Mixing them up is the usual 404.'],
        ],
      },
      {
        type: 'table',
        title: 'Errors',
        columns: ['Code', 'HTTP', 'Usual cause'],
        rows: [
          ['`AB01`', '400', 'Validation: a required field missing, a wrong type, a value outside an enum'],
          ['`AB02`', '404', 'Validation error (the page gives no more)'],
          ['`AB03`', '403', 'Valid token, wrong tenant, a role that does not cover the operation, or the wrong workspace'],
          ['`AB04`', '500', 'Internal server error'],
          ['`AB05`', '401', 'A gateway API key instead of a token, an expired token, or a malformed one (truncated, stray newline)'],
          ['`AB06`', '429', 'Rate limit exceeded'],
          ['`AB07`', '409', 'Already exists — most creates are not idempotent, so check before retrying a timed-out create'],
          ['`AB08`', '404', 'Not found: a slug where an id belongs, or a resource in a workspace you did not name'],
          ['`AB09`', '402', 'Subscription exhausted'],
        ],
        note: 'Decode a token at jwt.io to read its `tsg_id` and the roles in its `access` claim — the fastest check for AB03 and AB05.',
      },
      {
        type: 'table',
        title: 'Organisation-level endpoints (/ai_gw/admin/v2)',
        columns: ['Group', 'Endpoints', 'Key body fields'],
        minWidth: 800,
        rows: [
          ['Integrations', '`GET` · `POST /integrations` · `GET` · `PUT` · `DELETE /integrations/{slug}` · `GET` · `PUT` · `DELETE …/{slug}/models` · `GET` · `PUT …/{slug}/workspaces`', '`name`, `ai_provider_id`, `key` or per-provider `configurations`, `secret_mappings[]`, `pricing_adjustments`, `create_default_provider` (default true). Models: `models[] {slug, enabled}`, `allow_all_models`. Workspaces: `workspaces[] {id, enabled, usage_limits, rate_limits}`, `global_workspace_access`.'],
          ['MCP integrations', '`GET` · `POST /mcp-integrations` · `GET` · `PUT` · `DELETE /mcp-integrations/{id}` · `GET` · `PUT …/capabilities` · `GET …/metadata` · `GET` · `PUT …/workspaces`', '`name`, `url`, `auth_type` (`oauth_auto` · `headers` · `none`), `transport` (`http` · `sse`), `configurations.custom_headers`, `secret_mappings`. The registry entry an MCP server is built from.'],
          ['Secret references', '`GET` · `POST /secret-references` · `GET` · `PUT` · `DELETE /secret-references/{id}`', '`name`, `manager_type` (`aws_sm` · `azure_kv` · `hashicorp_vault`), `auth_config`, `secret_path`, `secret_key`, `allow_all_workspaces`. GET masks secrets; delete fails while one is in use.'],
          ['Deployments', '`GET` · `POST /deployments` · `GET` · `PUT` · `DELETE /deployments/{id}` · `GET /deployments/{id}/ping`', 'Hybrid data planes: `name`, `type` (`production` · `non_production`), `auth_settings {gateway_base_url, mcp_gateway_base_url, workspaces_allowed, jwt_subs_allowed}`. Returns `client_auth` and `credentials`; PUT takes `rotate_auth`.'],
          ['Organisation guardrails', '`GET` · `POST /guardrails` · `GET` · `PUT` · `DELETE /guardrails/{id}` · `GET` · `PUT …/{id}/mcp-servers` · `PUT …/{id}/mcp-servers/{mcpServerId}`', 'Same body as workspace guardrails (below). Applies to every workspace unless excluded.'],
          ['Workspace exclusions', '`GET` · `PUT /workspace-exclusions/input-guardrails` · `…/output-guardrails`', '`organisation_id`, `workspaces[] {workspace_id, excluded}`, `override_existing`. On the product page only, not in the reference.'],
        ],
      },
      {
        type: 'table',
        title: 'Workspace-level endpoints (/ai_gw/v2)',
        columns: ['Group', 'Endpoints', 'Key body fields'],
        minWidth: 800,
        rows: [
          ['Configs', '`GET` · `POST /configs` · `GET` · `PUT` · `DELETE /configs/{slug}` · `GET /configs/{slug}/versions`', '`name`, `config` (the Config Object: `retry`, `cache`, `strategy` + `targets`, `input_guardrails`, `output_guardrails`, `override_params`…), `workspace_id`. Create returns `id` and `version_id` — list to find the `pc-…` slug.'],
          ['Guardrails', '`GET` · `POST /guardrails` · `GET` · `PUT` · `DELETE /guardrails/{id}` · `GET` · `PUT …/{id}/mcp-servers` · `PUT …/{id}/mcp-servers/{mcpServerId}`', '`name`, `target` (`llm` · `mcp_tools`), `checks[] {id, parameters}`, `actions {deny, async, on_success, on_fail}`. Prisma AIRS: check `panw-prisma-airs.intercept`, parameters `profile_name` (required), `ai_model`, `app_user`.'],
          ['Providers', '`GET` · `POST /providers` · `GET` · `PUT` · `DELETE /providers/{slug}`', 'A workspace\'s `@slug` on an integration: `name`, `integration_id`, `slug`, `usage_limits`, `rate_limits`, `expires_at`.'],
          ['API keys', '`POST /api-keys/{user|service}` · `GET /api-keys` · `GET` · `PUT` · `DELETE /api-keys/{id}` · `POST /api-keys/{id}/rotate`', '`name`, `scopes`, `workspace_id`, `user_id`, `rate_limits[]`, `usage_limits`, `defaults {config_id, metadata, allow_config_override}`, `expires_at`, `rotation_policy {rotation_period, key_transition_period_ms}` (min 1,800,000).'],
          ['Usage-limit policies', '`GET` · `POST /policies/usage-limits` · `GET` · `PUT` · `DELETE …/{id}` · `GET …/{id}/entities` · `PUT …/{id}/entities/{entityId}/reset`', 'Flat body: `name`, `conditions`, `group_by`, `type` (`cost` · `tokens`), `credit_limit`, `alert_threshold`, `periodic_reset`. Exceeded → 412.'],
          ['Rate-limit policies', '`GET` · `POST /policies/rate-limits` · `GET` · `PUT` · `DELETE …/{id}`', '`name`, `conditions`, `group_by`, `type` (`requests` · `tokens`), `unit` (`rpm` · `rph` · `rpd` · `rpw`), `value`, `target` (`llm` · `mcp_tools`, immutable). Exceeded → 429.'],
          ['MCP servers', '`GET` · `POST /mcp-servers` · `GET` · `PUT` · `DELETE /mcp-servers/{id}` · `POST …/test` · `GET` · `PUT …/capabilities` · `GET` · `PUT …/user-access` · `GET` · `DELETE …/connections`', '`name`, `mcp_integration_id` (required), `slug`. Capabilities: `capabilities[] {name, type, enabled}`. User access: `user_access[] {user_id, enabled}`, `default_user_access` (`allow` · `deny`).'],
          ['Analytics', '17 `GET /analytics/graphs/…`, 4 `GET /analytics/groups/…`, `GET /analytics/summary/cache`', 'Graphs include `cost`, `requests`, `latency`, `tokens`, `errors`, `cache/hit-rate`; groups `users`, `ai-models`, `provider`, `metadata/{metadataKey}`.'],
          ['Feedback', '`POST /feedback` · `PUT /feedback/{id}`', '`trace_id`, `value` (−10 to 10), `weight` (0 to 1), `metadata`.'],
        ],
      },
      {
        type: 'steps',
        title: 'Recipes: a config, then a key that cannot escape it',
        steps: [
          {
            title: 'Create the config',
            text: 'Retries, a cache and two saved guardrails. With no provider in it, the request\'s `@slug` chooses the model.',
            code: [{ id: 'bash', lang: 'bash', code: ADMIN_CONFIG }],
          },
          {
            title: 'Create a service key that rides on it',
            text: 'The default config with override off means every request through this key gets those guardrails; a different config in the request is refused with 400. Rotation is monthly with a one-day overlap.',
            code: [{ id: 'bash', lang: 'bash', code: ADMIN_KEY }],
          },
        ],
      },
      {
        type: 'code',
        title: 'Recipes: logs, an organisation guardrail, an exclusion',
        tabs: [
          { id: 'logs', label: 'Logs and analytics', lang: 'bash', code: ADMIN_LOGS },
          { id: 'org-guardrail', label: 'Org guardrail with Prisma AIRS', lang: 'bash', code: ADMIN_ORG_GUARD },
          { id: 'exclusion', label: 'Exclude a workspace', lang: 'bash', code: ADMIN_EXCLUDE },
        ],
      },
      {
        type: 'table',
        title: 'Tasks that take several calls',
        columns: ['Task', 'Calls, in order', 'Watch for'],
        minWidth: 720,
        rows: [
          ['Connect a provider for a team', '`POST /integrations` → `PUT /integrations/{slug}/models` → `PUT /integrations/{slug}/workspaces`', 'Skip the last two and the integration exists but nobody can reach it.'],
          ['Put an MCP server behind the gateway', '`POST /mcp-integrations` (admin base) → `POST /mcp-servers` with its id → `GET` then `PUT /mcp-servers/{id}/capabilities` → `PUT …/user-access` → `POST …/test`', 'The Admin intro starts at `POST /mcp-servers`, but that call requires `mcp_integration_id` — create the integration first.'],
          ['Cap a team\'s spend', '`POST /policies/usage-limits` → `GET …/{id}/entities` → `PUT …/{id}/entities/{entityId}/reset`', 'Entities are what the policy\'s `group_by` produced, e.g. one per user.'],
          ['Issue and rotate a key', '`POST /api-keys/service` → `POST /api-keys/{id}/rotate`', 'Both secrets work during `key_transition_period_ms`.'],
          ['Register a hybrid data plane', '`POST /deployments` → install with the returned client auth → `GET /deployments/{id}/ping`', 'The console\'s Gateway Registration does the same.'],
          ['Report on last month', '`GET /analytics/graphs/cost` → `GET /analytics/groups/ai-models` → `GET /analytics/groups/metadata/{key}`', 'The last one is only as useful as the metadata your requests send.'],
        ],
      },
      {
        type: 'table',
        title: 'Not in the Admin API',
        columns: ['Still console-only (or undocumented)', 'Note'],
        rows: [
          ['Workspaces', 'No create, update or delete endpoint.'],
          ['Users and roles', 'No endpoints; SSO, SCIM and CIE Directory Sync are console settings.'],
          ['Organisation settings', 'Block Inline Configs, data-plane security, access permissions, guardrail management toggles.'],
          ['Audit logs', 'Every Admin call is audited (principal, action, target, time, IP), but there is no read endpoint.'],
          ['Prompts', 'No endpoints.'],
          ['Logs Export', 'Exists, but as a gateway-key API on the product page, not in the reference.'],
        ],
        note: 'The Admin intro still says "Anything an administrator sets up in Strata Cloud Manager can be set up here instead."',
      },
      {
        type: 'callout', tone: 'docs', title: 'Product pages that still show the old gateway-key calls',
        text: [
          'The Admin pages settle it — an SCM token on every Admin endpoint, gateway keys refused — but these pages still show admin calls on `aigw.portkey.ai` with a gateway key: **Usage and Rate Limit Policies** (`/v1/policies` with `x-portkey-api-key`), **Secret References** (`/v1/secret-references`, `POST /v1/mcp-integrations`), **MCP Gateway Guardrails** and **Request Parameters Check** (`POST https://aigw.portkey.ai/v1/guardrails` with string actions such as `{"on_fail": "deny"}`), **MCP Rate Limits** (`/v1/policies/rate-limits`), **Feedback** (`/v1/feedback`), **Pricing Adjustments** (`PUT https://aigw.portkey.ai/v2/integrations/{id}`), **Custom Models** (`PUT https://aigw.portkey.ai/v1/integrations/{slug}/models`) and the AB03 article (`GET /v1/integrations` with key scopes).',
          'Use the endpoint reference page — it is generated from the spec.',
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Where the schema and the product pages differ',
        text: [
          'Policy create bodies are **flat** in the reference — no `{"type": "usage_limits", "policy": {…, "status": "active"}}` wrapper as on the Policies page — and a usage policy\'s `type` is `cost` or `tokens` (the page adds `requests`).',
          'The key schema has no `rotation_period_days` (the Rotation page does). Guardrail `actions.async` defaults to `false` in the schema, `true` on the Guardrails page. `workspace_id` is typed `uuid` on several create bodies although the intro says a slug works. The integration schema allows only `aws_auth_type` `accessKey` or `assumedRole` and `vertex_auth_type` `basic` or `serviceAccount` — see "Model providers".',
        ],
      },
      {
        type: 'callout', tone: 'warn', title: 'Not run from this portal',
        text: 'Every call here follows the API reference and the product pages; none was sent from this portal. Try a create against a non-production workspace first, and keep each service account to the narrowest role that covers it — its name is what the audit log shows.',
      },
      {
        type: 'cards',
        items: [
          { icon: KeyRound, tone: '#d946ef', title: 'What the keys and limits mean', kicker: 'Governance',
            text: 'Key types, scopes, budgets, rate limits and the enforced-policy controls behind these endpoints.', go: 'gw-governance' },
          { icon: Plug, tone: '#EC4899', title: 'Integration credentials per provider', kicker: 'Model providers',
            text: 'Which auth type each provider takes on SaaS and on hybrid — and which the Admin API schema can express.', go: 'gw-providers' },
          { icon: Server, tone: '#EC4899', title: 'The data plane itself', kicker: 'Hybrid deployment',
            text: 'What `POST /deployments` registers: the airs-gw chart, its sync and its upgrades.', go: 'gw-hybrid' },
        ],
      },
    ],
  },

  {
    id: 'gw-providers',
    group: 'gateway',
    title: 'Model providers: Bedrock, Vertex, Azure and Claude on AWS',
    sub: 'Every auth type, SaaS vs hybrid, the IAM it needs — and how to name the model',
    minutes: 11,
    level: 'Setup',
    docs: pick('agIntegrations', 'agBedrock', 'agBedrockRole', 'agBedrockMantle', 'agClaudeAws', 'agClaudeAwsRole', 'agClaudeAwsBeta', 'agVertex',
      'agAzureAuth', 'agAzureOpenai', 'agAzureFoundry', 'agModelProv', 'arCreateIntegration', 'agCustomHosts', 'ghAirsGwBedrock', 'ghAirsGwVertex', 'ghGwInfraBedrock'),
    blocks: [
      {
        type: 'prose',
        text: [
          'An **integration** holds a provider\'s credentials at organisation level; a workspace that is granted it sees an `@slug`. Which credentials an integration can hold depends on where the gateway runs.',
          'On **SaaS** the gateway runs in Palo Alto Networks\' cloud, so it can only use what you hand it: a key, or a role it is allowed to assume. On **hybrid** the gateway runs in your account and can also use its own identity — an IRSA or Pod Identity role, a GKE service account, an Azure managed identity — so no secret is stored at all.',
        ],
      },
      {
        type: 'table',
        title: 'Amazon Bedrock',
        columns: ['Auth type', 'SaaS', 'Hybrid', 'You provide'],
        minWidth: 700,
        rows: [
          ['AWS Access Key', 'Yes', 'Yes', 'Access key id, secret access key, region; a session token for STS credentials.'],
          ['AWS Assumed Role', 'Yes', 'Yes', 'Role ARN, optional External ID, region. On SaaS the role trusts `arn:aws:iam::039293892788:role/AirsGwEnterpriseRole`; on hybrid, the gateway\'s own credentials assume it.'],
          ['Bedrock API Key', 'Yes', 'Yes', 'Auth type `apiKey`: a Bedrock API key from the AWS console, and the region.'],
          ['AWS Service Role', 'No', 'Yes', 'Nothing — the gateway\'s pod (IRSA) or task role. Named in the ECS Terraform module\'s Bedrock doc and on the Mantle and Claude Platform pages, not on the Bedrock page.'],
        ],
      },
      {
        type: 'code',
        title: 'IAM for an assumed role',
        text: 'The trust policy names the SaaS gateway\'s published principal. The permissions policy covers on-demand models **and** inference profiles: `GetInferenceProfile` lets the gateway resolve a `us.*` profile, but `InvokeModel` must also be allowed on the profile ARN and on the foundation model in every region the profile routes to. Narrow the wildcards to your regions and models.',
        tabs: [
          { id: 'trust', label: 'Trust policy', lang: 'json', code: BEDROCK_TRUST },
          { id: 'perms', label: 'Permissions policy', lang: 'json', code: BEDROCK_PERMS },
        ],
      },
      {
        type: 'table',
        title: 'Bedrock options worth knowing',
        columns: ['Option', 'How', 'Where it works'],
        minWidth: 680,
        rows: [
          ['STS session tags', 'Request metadata is forwarded as STS session tags for Cost Explorer and CloudTrail. Needs `AWS_BEDROCK_STS_SESSION_TAGS_ENABLED=true` on the gateway container and `sts:TagSession` in the trust policy.', 'A container setting — hybrid. (The page\'s example nevertheless targets the SaaS host.)'],
          ['PrivateLink', 'Set the integration\'s Custom Host to your VPC endpoint for `https://bedrock.<region>.amazonaws.com`.', 'Hybrid'],
          ['GovCloud', 'Custom Host `https://bedrock.us-gov-east-1.amazonaws.com` or `https://bedrock.us-gov-west-1.amazonaws.com` (Advanced Options).', 'Any'],
          ['Bedrock Guardrails inline', '`guardrailConfig {guardrailIdentifier, guardrailVersion, trace}` in the body; stop reason `guardrail_intervened`.', 'Any'],
          ['Converse passthrough', '`additionalModelRequestFields`, `additionalModelResponseFieldPaths`.', 'Any'],
        ],
      },
      {
        type: 'table',
        title: 'Bedrock Mantle — the OpenAI-compatible way into Bedrock',
        columns: ['', 'Detail'],
        rows: [
          ['What', 'Provider `bedrock-mantle` → `bedrock-mantle.<region>.api.aws`: native `/v1/chat/completions`, `/v1/responses` and `/v1/messages` (via `/anthropic/v1`, `anthropic-version` defaulting to `2023-06-01`). The `bedrock` provider stays on Converse / InvokeModel.'],
          ['Auth', 'API Key (a Bedrock bearer token) · Assumed Role (`awsRoleArn`, `awsExternalId` — required here, optional on Bedrock — and `awsRegion`) · Service Role (EKS / IRSA, hybrid).'],
          ['Since 2.27.0', 'Anthropic betas Mantle does not support (`advanced-tool-use`, `extended-cache-ttl`, `prompt-caching-scope`, `redact-thinking`) are stripped; Messages accepts `safeguards`.'],
        ],
      },
      {
        type: 'table',
        title: 'Claude Platform on AWS',
        columns: ['', 'Detail'],
        minWidth: 640,
        rows: [
          ['What it is', 'Anthropic\'s own managed Claude platform, sold and billed through AWS Marketplace — **not Bedrock**. The Anthropic Messages API with AWS SigV4, under the IAM namespace `aws-external-anthropic`.'],
          ['Endpoint', '`aws-external-anthropic.<region>.api.aws`, picked from the integration\'s region.'],
          ['Provider', '`claude-platform-aws`. Needs Backend `v1.17.0+` in the Model Catalog (the Beta page).'],
          ['Auth', 'AWS Access Key (`awsAccessKeyId`, `awsSecretAccessKey`, `awsRegion`) · Assumed Role (`awsRoleArn`, optional `awsExternalId`, `awsRegion` — the same SaaS trust principal as Bedrock) · Service Role (EKS / IRSA, hybrid).'],
          ['Workspace id', '`anthropicAwsWorkspaceId` (`wrkspc_…`): optional per the main page, required for all three auth types per the Beta page. Inline: `x-portkey-anthropic-aws-workspace-id`.'],
          ['IAM', '`aws-external-anthropic:CreateInference` and `CountTokens` (plus batch and file actions) on `arn:aws:aws-external-anthropic:<region>:<account-id>:workspace/<workspace-id>`. Managed policies: `AnthropicFullAccess`, `AnthropicInferenceAccess`, `AnthropicReadOnlyAccess`.'],
          ['Upstream lacks', 'OAuth, OpenAI-compatible endpoints and webhooks. The gateway still serves `/v1/chat/completions` by translation; rate limits go through an Anthropic representative.'],
        ],
      },
      { type: 'code', tabs: [{ id: 'bash', lang: 'bash', code: CLAUDE_AWS_ENABLE }] },
      {
        type: 'table',
        title: 'Google Vertex AI',
        columns: ['Auth type', 'SaaS', 'Hybrid', 'You provide'],
        minWidth: 700,
        rows: [
          ['Service account JSON', 'Yes', 'Yes', 'The key file and the Vertex region (and project). Required for self-deployed `endpoints.*` models, which need `aiplatform.endpoints.predict`.'],
          ['Project ID + region', 'Yes', 'Yes', 'No stored secret: the caller sends a Google OAuth2 access token in `Authorization` on every request, so the gateway key moves to `x-portkey-api-key`. The page warns it "may not support all features".'],
          ['Workload Identity Federation', 'Not documented', 'Yes', 'Auth type "Workload Identity Federation" and the project id. The gateway uses its own identity — on GKE, `GCP_AUTH_MODE=workload` with the Kubernetes SA annotated `iam.gke.io/gcp-service-account`; the Google SA needs `roles/aiplatform.user`.'],
          ['Cross-cloud AWS → GCP', 'No', 'Yes', 'A gateway on EKS: `GCP_AUTH_MODE=workload`, `GCP_WIF_AUDIENCE`, optional `GCP_WIF_SERVICE_ACCOUNT_EMAIL`; `sts:GetCallerIdentity` on the gateway role; an AWS provider on the pool, conditioned on that role.'],
        ],
      },
      { type: 'code', title: 'Cross-cloud federation on a hybrid gateway', tabs: [{ id: 'yaml', lang: 'yaml', code: VERTEX_WIF, file: 'values.yaml' }] },
      {
        type: 'table',
        title: 'Vertex details that bite',
        columns: ['Topic', 'Detail'],
        minWidth: 640,
        rows: [
          ['Region → endpoint', '`global` → `https://aiplatform.googleapis.com`; `us` / `eu` → `https://aiplatform.<region>.rep.googleapis.com`; a region → `https://<region>-aiplatform.googleapis.com`. The model must be served where the request goes.'],
          ['Per-request region', '`x-portkey-vertex-region` overrides the integration\'s region (the embeddings page uses it with a saved provider). Changelog 2.13.0 says user-passable provider parameters are ignored while Block Inline Configs is on — untested whether this header survives that.'],
          ['Anthropic models', 'The Vertex page says prepend `anthropic.` (`meta.` for Llama). The Claude Code with Vertex page uses bare names. Untested which this gateway wants. `anthropic-beta` (or `x-portkey-anthropic-beta`) is forwarded.'],
          ['Metadata', 'Becomes Vertex labels, prefixed `pk_gateway_`.'],
        ],
      },
      {
        type: 'table',
        title: 'Azure OpenAI and Azure AI Foundry',
        columns: ['azureAuthMode', 'SaaS', 'Hybrid', 'You provide'],
        minWidth: 700,
        rows: [
          ['`apiKey`', 'Yes', 'Yes', 'Resource name, deployment, API version and key.'],
          ['`entra`', 'Yes', 'Yes', '`azureEntraTenantId`, `azureEntraClientId`, `azureEntraClientSecret`; optional `azureEntraScope` (default `https://cognitiveservices.azure.com/.default`). Tokens cached 15 minutes.'],
          ['`managed`', 'No', 'Yes', 'A gateway on an Azure VM, AKS or App Service; `azureManagedClientId` only to pick one of several user-assigned identities.'],
          ['`workload`', 'No', 'Yes', 'AKS federated token: `AZURE_AUTHORITY_HOST`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_FEDERATED_TOKEN_FILE` (injected by the webhook); per-integration `azureWorkloadClientId`, `azureWorkloadTenantId`. Backend `v1.16.0+`.'],
          ['`entraFederated`', 'No', 'Yes', 'A gateway on AWS: `sts:GetWebIdentityToken` (audience `api://AzureADTokenExchange`) exchanged at Entra; a federated credential with issuer `https://sts.<region>.amazonaws.com` and the gateway role ARN as subject. Enterprise Gateway `v2.6.2+`, Node.js runtime.'],
        ],
        note: 'The Authentication page says "four" modes and lists five; the Azure OpenAI and Foundry pages say three. Hybrid needs the Cognitive Services OpenAI User role on the resource. GovCloud: Custom Host `https://<resource>.openai.azure.us/openai`. Claude on Foundry: the target URI is cut to `…services.ai.azure.com/anthropic`.',
      },
      {
        type: 'table',
        title: 'Naming the model',
        columns: ['Provider', 'Form', 'Notes'],
        minWidth: 700,
        rows: [
          ['Bedrock — Claude 4.x and newer', '`@<slug>/us.anthropic.claude-…` (also `global.`, and `in.` since 2.20.0)', 'Cross-region inference-profile ids, with the profile permissions above. The prompt-caching page\'s table lists bare ids for Claude 4.x.'],
          ['Bedrock allow-lists', 'Model Provisioning', 'Since 2.27.0 an allow-list accepts a `us.*` profile when its base model is allowed, and accepts application-inference-profile ARNs.'],
          ['Vertex — Gemini', '`@<slug>/gemini-…`', 'The integration\'s region must serve the model; `global` has the broadest catalogue.'],
          ['Vertex — Claude', '`@<slug>/anthropic.claude-…`', 'Per the Vertex page; see the open question above.'],
          ['Claude Platform on AWS', '`@<slug>/claude-sonnet-4-6`', 'First-party Anthropic ids and dated aliases — no `anthropic.` and no region prefix.'],
          ['Bedrock Mantle', '`@<slug>/anthropic.claude-sonnet-4-5-20250929-v1:0`', 'The page\'s example: a plain Bedrock id.'],
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Narrower in the API, and no keyless Vertex on SaaS',
        text: [
          'The Admin API\'s integration schema lists only `aws_auth_type` `accessKey` or `assumedRole`, `vertex_auth_type` `basic` or `serviceAccount`, and `azure_auth_mode` `default`, `entra` or `managed` — narrower than the product pages. Bedrock API Key, Service Role, Vertex Workload Identity Federation and Azure `workload` / `entraFederated` do not appear, and Claude Platform and Bedrock Mantle have no configuration variant; whether the API accepts them anyway is untested.',
          'The docs describe Workload Identity Federation for Vertex only where the gateway runs on your infrastructure: it uses "the attached service account identity of the workload environment", which on SaaS is not yours. No page offers a keyless Vertex option for the SaaS gateway.',
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Provider pages that disagree',
        text: 'The Bedrock page lists three auth types; the ECS Bedrock doc and the Mantle page add Service Role. The assumed-role page\'s "least privilege" policy, and the EKS and ECS examples, omit `GetInferenceProfile`. The Bedrock page spells the strict-compliance header two other ways (`x-portkey-strict-openai-compliance`, `x-portkey-strict-open-a-i-compliance`); everywhere else it is `x-portkey-strict-open-ai-compliance`. Bedrock and Vertex pages still say `/v1/messages` works only with Claude models. Do not copy the Bedrock direct-credentials example — it sends `"model": "gpt-4o"`.',
      },
      {
        type: 'callout', tone: 'observed', title: 'On this portal\'s SCM tenant',
        text: [
          'The Bedrock integration authenticates with an **IAM-user access key**. Assumed Role is broken on this SCM tenant — a Palo Alto Networks bug, with a ticket open since 2026-07-20.',
          'Claude 4.x on Bedrock needs the `us.*` inference-profile ids. On Vertex, Gemini 3.x and Claude are served only from the `global` region in this project — set the integration\'s region to `global`.',
          'The gateway\'s Vertex integration uses a service-account JSON key, and the organisation caps service-account keys at 30 days — so the key has to be replaced at least that often.',
          'A provider pinned in a config\'s `targets` overrides the request\'s `@slug` — keep provider choice out of shared configs if callers are meant to pick the model.',
        ],
      },
      {
        type: 'cards',
        items: [
          { icon: Server, tone: '#EC4899', title: 'Keyless, on your own data plane', kicker: 'Hybrid deployment',
            text: 'Service Role, workload identity and managed identity need the gateway in your account.', go: 'gw-hybrid' },
          { icon: Braces, tone: '#d946ef', title: 'Integrations as code', kicker: 'Admin API',
            text: '`POST /integrations`, then models, then workspaces — three calls before anyone can use it.', go: 'gw-admin-api' },
          { icon: Cloud, tone: '#EC4899', title: 'The same model, two clouds', kicker: 'Universal API',
            text: 'Call Bedrock and Vertex through one endpoint and one guardrail.', go: 'gw-universal' },
        ],
      },
    ],
  },
]
