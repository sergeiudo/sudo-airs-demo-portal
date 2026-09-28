import { Terminal, Fingerprint } from 'lucide-react'
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

export const GATEWAY = [
  {
    id: 'gw-overview',
    group: 'gateway',
    title: 'What the AI Gateway is, and how to set it up',
    sub: 'Providers, integrations, workspaces, configs, guardrails',
    minutes: 6,
    level: 'Setup',
    docs: pick('gwOverview', 'gwDeploy', 'gwConfigs', 'pdfGateway', 'gwDevSetup'),
    blocks: [
      {
        type: 'prose',
        text: [
          'The AI Gateway is a centralised, OpenAI-compatible proxy in front of your LLM providers — and your MCP servers and agent-to-agent traffic — managed from Strata Cloud Manager. Apps call one endpoint; the gateway routes to the right provider, applies budgets, rate limits, retries, caching and **guardrails** (including Prisma AIRS), and logs every request.',
          'It runs as **SaaS** (`https://aigw.portkey.ai/v1`) or **Hybrid**, with the data plane on your own Kubernetes. It is available in the Americas; both models are priced the same.',
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
          { title: 'Create an integration for each provider', text: 'Pick the provider, give it a name and slug, paste its API key (or configure a custom host for a private model; custom headers for MCP servers with static tokens). Optionally set a pricing multiplier.', path: ['AI Security', 'AI Gateway', 'Integrations', 'Select a provider', 'Set details'] },
          { title: 'Provision it to workspaces', text: 'Share the integration with all or specific workspaces. Set budget limits (cost or tokens) and rate limits (requests or tokens per minute/hour/day). Both are immutable once set.', path: ['Provision the workspace'] },
          { title: 'Provision models', text: 'Allow all models or only an allow-list. A model that is not provisioned is rejected with `model_not_allowed`.', path: ['Configure model provisioning', 'Create Integration'] },
          { title: 'Create a config and an API key', text: 'Create a `pc-…` config (add the Prisma AIRS guardrail — see "The AIRS guardrail in the gateway"), then a gateway API key, optionally with that config as its default. Wait about a minute: configs sync to the data plane every 30 seconds.' },
        ],
      },
      {
        type: 'code', title: 'Hybrid data plane on your Kubernetes',
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
        type: 'callout', tone: 'docs',
        text: 'PII detection and content moderation are not gateway guardrails — they are handled by Prisma AIRS (advanced DLP and threat detection) through the partner guardrail.',
      },
    ],
  },

  {
    id: 'gw-connect',
    group: 'gateway',
    title: 'Connect any app to the gateway',
    sub: 'Change the base URL and the key — keep your code',
    minutes: 5,
    level: 'Build',
    live: 'gateway.chat',
    docs: pick('gwDevSetup', 'gwKeys', 'gwDeploy', 'gwSpec'),
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
          ['`x-portkey-trace-id`', 'Your trace id — with the AIRS guardrail on, the same id appears in AI Runtime → AI Sessions'],
          ['`x-portkey-metadata`', 'JSON metadata to log (and to route on, in conditional configs)'],
          ['`x-portkey-strict-open-ai-compliance: false`', 'Keep non-OpenAI fields such as `hook_results` (guardrail verdicts) in the response'],
        ],
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
      { type: 'repo', title: 'The SCM AI Gateway client', file: 'moh-routes.js', lines: '82-134', lang: 'javascript', code: AIGW_CLIENT, why: 'The client behind the AI-GW target in AIRS Runtime & AI-GW and the Ministry of Health pillar.' },
    ],
  },

  {
    id: 'gw-guardrail',
    group: 'gateway',
    title: 'The AIRS guardrail in the gateway',
    sub: 'One guardrail across every provider — and how to read a block',
    minutes: 6,
    level: 'Build',
    live: 'gateway.chat',
    docs: pick('gwAirsGuard', 'gwGuardrails', 'gwDevGuard'),
    blocks: [
      {
        type: 'prose',
        text: 'The Prisma AIRS partner guardrail makes the gateway call the AIRS Runtime API on each request — before the model (input) and after it (output) — with the security profile you choose. Nothing changes in the app.',
      },
      {
        type: 'steps',
        steps: [
          { title: 'Connect the gateway to Prisma AIRS', text: 'Enter the API Intercept endpoint URL and an API key from your **AI Runtime Security** deployment profile. A 401 at save means the key is wrong; a 400 later usually means a typo in the endpoint (it is not validated at save).', path: ['Admin Settings', 'Plugins', 'PANW Prisma AIRS'] },
          { title: 'Create the guardrail', text: 'Create a partner guardrail **PANW Prisma AIRS Guardrail**, choose Deny (block) or Log only, and set its parameters (below). Note its `pg-…` id.', path: ['Guardrails', 'Create', 'Partner', 'PANW Prisma AIRS'] },
          { title: 'Attach it to a config', text: 'Reference the guardrail id as an input and/or output guardrail in a `pc-…` config, then use that config (as the key\'s default, or per request with `x-portkey-config`).',
            code: [
              { id: 'json', label: 'Config (developer docs)', lang: 'json', code: `{
  "input_guardrails": ["pg-xxxxxx"],
  "output_guardrails": ["pg-xxxxxx"]
}` },
              { id: 'yaml', label: 'Config (SCM docs)', lang: 'json', code: `{
  "before_request_hooks": [{ "id": "pg-xxxxxx" }],
  "after_request_hooks": [{ "id": "pg-xxxxxx" }]
}` },
            ] },
        ],
      },
      {
        type: 'table',
        title: 'Guardrail parameters',
        columns: ['Parameter', 'Default', 'Notes'],
        rows: [
          ['Profile name / ID', '—', 'The AIRS security profile; falls back to the profile linked to the API key'],
          ['Scan scope', '`last_message`', '`last_message`, `last_user_message`, `user_messages`, `all_messages`'],
          ['Strip scaffolding', '`false`', 'Removes agent-harness wrappers (e.g. `<system-reminder>`) before scanning; tool results are still scanned'],
          ['AI model / app name / app user', '`unknown-model` / — / `portkey-gateway`', 'Sent to AIRS as metadata'],
        ],
        note: 'For agentic clients the developer docs recommend `scan_scope: "last_user_message"` with `strip_scaffolding: true`.',
      },
      { type: 'code', title: 'Detecting a block', build: () => V(gatewayBlockCheck()) },
      { type: 'live', title: 'Watch a block come back as HTTP 200', text: 'Run the "Prompt injection" preset, then "Same attack, no guardrail" — the only difference is the config.' },
      {
        type: 'callout', tone: 'observed', title: 'On the SCM tenant a block does not throw',
        text: [
          'The response is **HTTP 200** with `choices[0].message.content` replaced by "The guardrail checks defined in the config failed." and the model never called. Code that only catches exceptions will report every block as a pass.',
          'Read `hook_results.before_request_hooks[].verdict` / `after_request_hooks[].verdict` — `false` means blocked. The response header `x-portkey-trace-id` is the same id AIRS records as `tr_id`.',
        ],
      },
    ],
  },

  {
    id: 'gw-jwt',
    group: 'gateway',
    title: 'Identity-based routing with JWT',
    sub: 'No API keys for users — the model is chosen by who they are',
    minutes: 8,
    level: 'Build',
    docs: pick('gwDevJwt', 'gwConfigs', 'gwKeys'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Instead of a gateway key, a client can present a **JWT** the gateway verifies against a JWKS registered on your organisation. Your backend acts as a token broker: it authenticates the user (e.g. with Microsoft Entra ID), seals facts like role and department into a short-lived RS256 token, and the gateway routes on those claims with a conditional config. The browser never holds a key, and cannot change the claims without breaking the signature.',
          'JWT authentication is an add-on to the AI Gateway.',
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
          ['Algorithm', '**RS256** only; the JOSE header `kid` must match a key in the JWKS'],
          ['JWKS', 'A JWKS URL (comma-separated for rotation) or static JWKS JSON, configured on the organisation'],
          ['Required claims', '`portkey_oid` (organisation), `portkey_workspace`, `scope`, `exp`'],
          ['Recommended', '`iat`, `nbf`; identity from `email_id` > `sub` > `uid`'],
          ['Optional', '`defaults` (an embedded default config and metadata), `usage_limits`, `rate_limits`'],
          ['Sent as', '`x-portkey-api-key: <jwt>` or `Authorization: Bearer <jwt>`'],
          ['Errors', '401 invalid or expired · 403 scope/workspace not allowed · 412 usage limit · 429 rate limit'],
        ],
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
                      headers={"kid": os.environ["JWT_KID"]})` },
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
      { type: 'repo', title: 'Minting the credential', file: 'access-routes.js', lines: '170-250', lang: 'javascript', code: JWT_MINT, why: 'Enterprise AI Access signs its gateway credential with node:crypto — no JWT library.' },
      {
        type: 'callout', tone: 'warn', title: 'Guard the private key',
        text: 'Anyone holding the signing key can mint a token for any role, and the gateway will believe it. Keep it in a KMS/HSM or at least outside the repository, publish only the JWKS, and rotate by adding a new `kid` before retiring the old one.',
      },
    ],
  },

  {
    id: 'gw-mcp',
    group: 'gateway',
    title: 'MCP through the gateway',
    sub: 'Broker MCP servers with the same keys and guardrails',
    minutes: 4,
    level: 'Build',
    docs: pick('gwDevMcp', 'pdfGateway'),
    blocks: [
      {
        type: 'prose',
        text: 'The AI Gateway can front MCP servers too: clients connect to the gateway\'s MCP URL for a server, authenticate with the gateway key, and the gateway injects the server\'s own credentials. The documented URL shape is `https://aigw.portkey.ai/m/{server-slug}/mcp`; your tenant\'s exact MCP gateway URL is shown under Admin Settings → General.',
      },
      {
        type: 'code',
        tabs: [{ id: 'python', lang: 'python', file: 'mcp_client.py', code: `# pip install mcp
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
` }],
      },
      {
        type: 'callout', tone: 'observed', title: 'The URL on the SCM tenant used here',
        text: 'This portal\'s SCM tenant brokers servers at `https://mcp-aigw.portkey.ai/<server>/mcp` (e.g. `/huggingface/mcp`, `/github-copilot/mcp`) with `x-portkey-api-key`. It still scans each tool manifest and every call with `tool_event` — see "Scan every tool call" — because the gateway guardrail scans model turns, not tool events.',
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
    minutes: 6,
    level: 'Build',
    docs: pick('ghIntegrations', 'litellm', 'kong'),
    blocks: [
      {
        type: 'prose',
        text: 'If traffic already flows through an API or AI gateway, Prisma AIRS can plug into it. Reference implementations live in Palo Alto Networks\' `prisma-airs-integrations` repository (community examples, best-effort support); LiteLLM and Kong ship first-class plugins.',
      },
      {
        type: 'code', title: 'LiteLLM — built-in guardrail `panw_prisma_airs`',
        tabs: [{ id: 'yaml', lang: 'yaml', file: 'litellm-config.yaml', code: `model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: "panw-prisma-airs-guardrail"
    litellm_params:
      guardrail: panw_prisma_airs
      mode: "pre_call"                 # also during_call, post_call, pre_mcp_call, during_mcp_call
      api_key: os.environ/PANW_PRISMA_AIRS_API_KEY
      profile_name: os.environ/PANW_PRISMA_AIRS_PROFILE_NAME
      api_base: "https://service.api.aisecurity.paloaltonetworks.com"   # your region` }],
      },
      {
        type: 'callout', tone: 'warn',
        text: 'Set `profile_name` explicitly in LiteLLM. Without it AIRS answers 400 "No default AI profile available", which LiteLLM surfaces as a 500 "Security scan failed". A block comes back as `{"error": {"type": "guardrail_violation", "code": "panw_prisma_airs_blocked", …}}`.',
      },
      {
        type: 'code', title: 'Kong — Prisma AIRS API Intercept plugin',
        tabs: [{ id: 'curl', lang: 'curl', code: `# Kong Gateway 3.4+ or Konnect — after deploying the plugin files
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
          ['LiteLLM', '✓', '✓', 'partial', 'pre-tool'],
          ['Kong custom plugin v2 (MCP + SSE)', '✓', '✓', '✓', 'pre + post'],
          ['Kong AI Gateway 2.x policies', '✓', '✓', '—', 'partial'],
          ['Azure API Management (policy fragment)', '✓', '✓', '✓', 'post-tool'],
          ['Google Apigee (SharedFlow)', '✓', '✓', '—', '—'],
          ['Bifrost, TrueFoundry', '✓', '✓', 'partial', '—'],
        ],
        note: 'From the coverage matrix in `prisma-airs-integrations`. Streaming responses have to be buffered at the gateway before AIRS can scan them.',
      },
    ],
  },

  {
    id: 'int-frameworks',
    group: 'integrations',
    title: 'Frameworks, clouds and assistants',
    sub: 'LangChain, OpenAI Agents, AWS, Microsoft Foundry, n8n, coding assistants',
    minutes: 5,
    level: 'Build',
    docs: pick('ghIntegrations', 'ghN8n', 'ghNemo', 'ghRag', 'gwDevSetup'),
    blocks: [
      {
        type: 'table',
        columns: ['Stack', 'How to plug Prisma AIRS in'],
        rows: [
          ['LangChain, LlamaIndex, OpenAI Agents SDK, CrewAI, AutoGen', 'Point the model client at the AI Gateway (OpenAI-compatible base URL) — the guardrail applies — or call the Runtime API / SDK in a callback around each model and tool call. There is no dedicated LangChain package.'],
          ['AWS Bedrock', 'Bedrock SDK hooks (Python, Node.js, Java, Go), a Lambda decorator, Bedrock AgentCore and Strands Agents samples in `prisma-airs-integrations/AWS`.'],
          ['Microsoft Foundry', 'Native guardrail integration: Foundry → Guardrails → Integrations → Palo Alto Networks, with the AIRS endpoint and key in Key Vault. Enable only prompt injection and toxic content (a 300 ms budget applies).'],
          ['n8n', 'The official community node `@paloaltonetworks/n8n-nodes-prisma-airs` — prompt, response, dual, batch and masking scans.'],
          ['NVIDIA NeMo Guardrails', 'A custom action that calls API intercept (`airs-nemo-guardrails`).'],
          ['Coding assistants', 'Hooks for Claude Code, Codex, Cursor, Cline, Devin, Gemini CLI and Windsurf that scan prompts, tool calls and fetched content.'],
          ['Ollama / OpenWebUI', 'A security proxy in front of Ollama (`panw-api-ollama`, Rust).'],
        ],
      },
      {
        type: 'cards',
        items: [
          { icon: Terminal, tone: '#a855f7', title: 'Claude Code hooks in this portal', kicker: 'AI Code Assistant Protection',
            text: 'Zero-code-change hook scripts that scan every prompt, URL fetch and MCP tool call before it reaches the model.', go: 'pillar:claudeHooks', goLabel: 'Open the pillar' },
        ],
      },
    ],
  },
]

