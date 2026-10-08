import { Plug, Cloud, ShieldCheck, KeyRound, Vault, ClipboardList, Route, Server, Code2, Network, Rocket, Activity } from 'lucide-react'
import { pick } from './links'

/**
 * SCM AI Gateway, from the implementation guides — Area A: the deployment
 * itself (SaaS, and the parts SaaS and hybrid share).
 *
 * Source: "Palo Alto Networks Implementation Guides" on jollymahn.github.io —
 * process-driven guides by one author, NOT official documentation, no licence
 * file. Summarised in our own words (UI paths, field names, values and
 * commands kept exact), no screenshots; the pages are linked instead. Every
 * fact was cross-checked on 2026-10-08 against docs.paloaltonetworks.com, the
 * AIGW developer docs (portkey.ai/docs/aigw) and the Admin API reference.
 * Where they disagree, a `docs` callout or table names both sides. Nothing in
 * this file was run from this portal; hybrid infrastructure lives in hybrid.js.
 */

// ─── code (declared above the array: const TDZ) ──────────────────────────────

const FIRST_CALL_TABS = [
  { id: 'curl', label: 'Chat Completions', lang: 'curl', code: `# OpenAI wire format: the base URL keeps /v1; the model names the integration
curl -sS https://aigw.portkey.ai/v1/chat/completions \\
  -H "Authorization: Bearer $AIGW_API_KEY" \\
  -H 'Content-Type: application/json' \\
  -d '{
    "model": "@<integration-slug>/<model-name>",
    "max_tokens": 32,
    "messages": [{ "role": "user", "content": "Reply with OK" }]
  }'` },
  { id: 'messages', label: 'Messages', lang: 'curl', code: `# Anthropic wire format: the path Claude Code and the Anthropic SDK use
# (they append /v1/messages themselves, so their base URL has no /v1)
curl -sS https://aigw.portkey.ai/v1/messages \\
  -H "Authorization: Bearer $AIGW_API_KEY" \\
  -H 'anthropic-version: 2023-06-01' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "model": "@<integration-slug>/<model-name>",
    "max_tokens": 32,
    "messages": [{ "role": "user", "content": "Reply with OK" }]
  }'` },
  { id: 'bash', label: 'Keep the key out of history', lang: 'bash', code: `# zsh: a command that starts with a space is not written to history
setopt HIST_IGNORE_SPACE          # bash: export HISTCONTROL=ignorespace
 export AIGW_API_KEY="<gateway-api-key>"

# or read it from a file only you can open
mkdir -p ~/.config/aigw && chmod 700 ~/.config/aigw
# …paste the key into ~/.config/aigw/key with an editor, then:
chmod 600 ~/.config/aigw/key
export AIGW_API_KEY="$(cat ~/.config/aigw/key)"` },
]

const MCP_TABS = [
  { id: 'curl', label: 'Check the endpoint', lang: 'curl', code: `MCP_BASE=https://mcp-aigw.portkey.ai     # Admin Settings → General → MCP Gateway URLs

# 1. The MCP listener answers: {"status":"healthy","timestamp":…,"version":…}
curl -s "$MCP_BASE/health"

# 2. The server URL is reachable and protected: HTTP 401 plus a WWW-Authenticate header.
#    A wrong slug gets the same 401, so this proves the listener, not the server.
curl -si "$MCP_BASE/<server-slug>/mcp" | head -n 12` },
  { id: 'bash', label: 'Claude Code', lang: 'bash', code: `# The key needs the Mcp (Invoke) permission; --scope user = every project on this machine
claude mcp add --scope user --transport http <server-slug> \\
  "$MCP_BASE/<server-slug>/mcp" \\
  --header "x-portkey-api-key: $AIGW_API_KEY"

# Inside Claude Code, /mcp should now list the server as connected.
# Changing the URL or the key later: remove the entry, then add it again.
claude mcp remove --scope user <server-slug>` },
]

const GUARD_CFG_TABS = [
  { id: 'json', label: 'Saved guardrail (official)', lang: 'json', file: 'pc-airs-guarded', code: `{
  "input_guardrails": ["pg-<airs-guardrail-id>"],
  "output_guardrails": ["pg-<airs-guardrail-id>"]
}` },
  { id: 'raw', label: 'Raw hooks (implementation guide)', lang: 'json', file: 'pc-airs-guarded', code: `{
  "before_request_hooks": [{
    "type": "guardrail",
    "id": "airs-prompt-scan",
    "credentials": { "AIRS_API_KEY": "<airs-api-key>" },
    "checks": [{
      "id": "panw-prisma-airs.intercept",
      "parameters": {
        "profile_name": "<security-profile-name>",
        "app_name": "<application-name>",
        "scan_scope": "last_user_message",
        "strip_scaffolding": true
      }
    }],
    "deny": true,
    "async": false
  }],
  "after_request_hooks": [{
    "type": "guardrail",
    "id": "airs-response-scan",
    "credentials": { "AIRS_API_KEY": "<airs-api-key>" },
    "checks": [{
      "id": "panw-prisma-airs.intercept",
      "parameters": {
        "profile_name": "<security-profile-name>",
        "app_name": "<application-name>",
        "scan_scope": "last_user_message",
        "strip_scaffolding": true
      }
    }],
    "deny": true,
    "async": false
  }]
}` },
]

const SCM_TOKEN = `# A 15-minute SCM token for a service account — the Admin API refuses gateway keys
SCM_TOKEN=$(curl -sS -X POST https://auth.apps.paloaltonetworks.com/oauth2/access_token \\
  -u "$CLIENT_ID:$CLIENT_SECRET" \\
  -d "grant_type=client_credentials&scope=tsg_id:$TSG_ID" | jq -r .access_token)`

const VAULT_TABS = [
  { id: 'bash', label: 'Vault', lang: 'bash', code: `RG=rg-ai-gateway
LOCATION=eastus
VAULT=kv-aigw-llm-<suffix>        # globally unique, 3–24 characters

# RBAC permission model and purge protection (soft delete is always on for new vaults)
az keyvault create --name "$VAULT" --resource-group "$RG" --location "$LOCATION" \\
  --enable-rbac-authorization true --retention-days 90 --enable-purge-protection true
VAULT_ID=$(az keyvault show --name "$VAULT" --query id -o tsv)

# Setup-only admin rights for you — scope them down once the secrets are in
az role assignment create --role "Key Vault Administrator" \\
  --assignee "$(az ad signed-in-user show --query id -o tsv)" --scope "$VAULT_ID"` },
  { id: 'store', label: 'Store', lang: 'bash', code: `# 90 days out: GNU date first, BSD / macOS date as the fallback
EXPIRY=$(date -u -d '+90 days' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+90d +%Y-%m-%dT%H:%M:%SZ)

read -rs PROVIDER_KEY                 # paste the key: not echoed, not saved to history
az keyvault secret set --vault-name "$VAULT" --name llm-anthropic-api-key \\
  --value "$PROVIDER_KEY" --expires "$EXPIRY" --description "Anthropic key for the AI Gateway"
unset PROVIDER_KEY

# A Vertex service-account JSON goes in whole, as one secret — then delete the local file
az keyvault secret set --vault-name "$VAULT" --name llm-google-vertex-sa-key \\
  --file ./vertex-sa.json --expires "$EXPIRY"
rm ./vertex-sa.json` },
  { id: 'grant', label: 'Grant', lang: 'bash', code: `# The reader: the identity a Secret Reference signs in as. On SaaS that means a
# service principal (its client secret is printed once — store it somewhere else)
az ad sp create-for-rbac --name sp-aigw-secret-reader
SP_ID=$(az ad sp list --display-name sp-aigw-secret-reader --query '[0].id' -o tsv)
az role assignment create --role "Key Vault Secrets User" --assignee "$SP_ID" --scope "$VAULT_ID"

# The rotators: write new versions (Secrets Officer can read values too)
az role assignment create --role "Key Vault Secrets Officer" \\
  --assignee "$(az ad group show --group sg-ai-ops --query id -o tsv)" --scope "$VAULT_ID"` },
  { id: 'curl', label: 'Secret reference', lang: 'curl', code: `${SCM_TOKEN}

# 1. The reference: where the secret is and how to sign in to the vault — never the value
curl -sS -X POST https://api.apps.paloaltonetworks.com/ai_gw/admin/v2/secret-references \\
  -H "Authorization: Bearer $SCM_TOKEN" -H 'Content-Type: application/json' \\
  -d '{
    "name": "anthropic-prod-key",
    "slug": "anthropic-prod-key",
    "manager_type": "azure_kv",
    "auth_config": {
      "azure_auth_mode": "entra",
      "azure_entra_tenant_id": "<entra-tenant-id>",
      "azure_entra_client_id": "<app-id>",
      "azure_entra_client_secret": "<client-secret>",
      "azure_vault_url": "https://<vault-name>.vault.azure.net/"
    },
    "secret_path": "llm-anthropic-api-key"
  }'

# 2. Map the integration's provider key to it (the console: the Secret Ref toggle)
curl -sS -X PUT https://api.apps.paloaltonetworks.com/ai_gw/admin/v2/integrations/<integration-slug> \\
  -H "Authorization: Bearer $SCM_TOKEN" -H 'Content-Type: application/json' \\
  -d '{ "secret_mappings": [{ "target_field": "key", "secret_reference_id": "anthropic-prod-key" }] }'` },
]

const ROTATE_TABS = [
  { id: 'bash', label: 'Vault-backed', lang: 'bash', code: `# 2. A new version under the SAME secret name (the reference points at the name)
read -rs PROVIDER_KEY
az keyvault secret set --vault-name "$VAULT" --name llm-anthropic-api-key \\
  --value "$PROVIDER_KEY" --expires "$EXPIRY"
unset PROVIDER_KEY

# 3. Wait out the gateway's 5-minute secret cache, send a test request, check Observability → Logs
# 4. Revoke the old key at the provider, then disable the old version here
az keyvault secret list-versions --vault-name "$VAULT" --name llm-anthropic-api-key \\
  --query "[].{id:id, enabled:attributes.enabled, created:attributes.created}" -o table
az keyvault secret set-attributes --vault-name "$VAULT" --name llm-anthropic-api-key \\
  --version <old-version-id> --enabled false` },
  { id: 'curl', label: 'Pasted key', lang: 'curl', code: `# The Admin API takes a new provider key in place: the integration, its slug and
# its workspace limits stay. body.json = {"key": "<new-provider-key>"} — delete it afterwards.
curl -sS -X PUT https://api.apps.paloaltonetworks.com/ai_gw/admin/v2/integrations/<integration-slug> \\
  -H "Authorization: Bearer $SCM_TOKEN" -H 'Content-Type: application/json' \\
  -d @body.json
rm body.json` },
  { id: 'alert', label: 'Expiry alert', lang: 'bash', code: `# Key Vault raises Microsoft.KeyVault.SecretNearExpiry 30 days before a secret's
# expiry date (and SecretExpired on the day). Route both to whoever rotates.
az eventgrid event-subscription create --name llm-secret-expiry \\
  --source-resource-id "$VAULT_ID" \\
  --included-event-types Microsoft.KeyVault.SecretNearExpiry Microsoft.KeyVault.SecretExpired \\
  --endpoint "<https-endpoint>"
# A plain webhook endpoint must complete Event Grid's subscription validation handshake.` },
]

const WIRE = `# What the application sends — it holds only the gateway key
POST https://aigw.portkey.ai/v1/messages
Authorization: Bearer <gateway-api-key>
x-portkey-provider: @default-anthropic
{ "model": "claude-<model>", "max_tokens": 512, "messages": [ … ] }

# What the provider receives — the gateway key is gone, the stored credential is attached
POST https://api.anthropic.com/v1/messages
x-api-key: <provider key held in the integration>
{ "model": "claude-<model>", "max_tokens": 512, "messages": [ … ] }`

// ─── guides ──────────────────────────────────────────────────────────────────

export const IMPL_AIGW = [
  {
    id: 'gw-deploy-walkthrough',
    group: 'gateway',
    title: 'Deploy the AI Gateway end to end in Strata Cloud Manager',
    sub: 'Licence, integration, workspaces, keys, MCP, guardrail — to the first logged request',
    minutes: 18,
    level: 'Setup',
    docs: pick('imAigwDeploy', 'imAigwLicense', 'imAigwLlm', 'imAigwMcp', 'imAigwGuard', 'imAigwRef', 'imAigwIndex', 'imHybridInfra', 'gwActivate', 'gwDeploy',
      'gwIntegrations', 'gwWsControl', 'gwSecKeys', 'gwPolicies', 'gwAdminSettings', 'gwDevSetup', 'agWsProv', 'agModelProv', 'agPricing', 'agModelOverrides',
      'agDefaultCfg', 'agApiKeyPut', 'agIntegrationWs', 'agEnforceMeta', 'agGatewayUrls', 'agMcpRegistry', 'arErrors'),
    blocks: [
      {
        type: 'prose',
        text: [
          'The other gateway guides explain features. This one is the **click path**: from a flex-credit pool to a request that shows up in Observability with its tokens, cost and the key that sent it. It follows the five phases of the community implementation guide — licence, enable, LLM integration, MCP (optional), guardrails and logs — for the **SaaS** gateway. On hybrid only Phase 2 changes; the rest applies unchanged.',
          'The product runs on the Portkey platform, so Portkey host names appear throughout: `aigw.portkey.ai`, `mcp-aigw.portkey.ai`, `registry.portkey.ai`. That is expected, not a misconfiguration.',
        ],
      },
      {
        type: 'callout', tone: 'info', title: 'Where this comes from',
        text: 'A process-driven guide by one author on GitHub Pages, not Palo Alto Networks documentation. Its screenshots stay there (links in the sidebar); the steps are summarised here and checked against docs.paloaltonetworks.com and the developer docs. Where they disagree you will see "From the official docs" next to the step.',
      },
      {
        type: 'facts',
        items: [
          { label: 'Phases', value: '5', sub: 'Licence · enable · LLM integration · MCP (optional) · guardrails and logs', accent: true },
          { label: 'Differs on hybrid', value: 'Phase 2 only', sub: 'Registration, `values.yaml` and Helm — see "Hybrid deployment"' },
          { label: 'Profile → tenant', value: 'Up to 30 min', sub: 'Before the AI Gateway card appears in SCM' },
          { label: 'Workspace limits', value: 'Immutable', sub: 'Integration budgets and rate limits cannot be edited once applied' },
        ],
      },
      {
        type: 'checklist',
        title: 'Before you start',
        items: [
          'An active Prisma AIRS (AI Runtime Security) licence on the tenant, and a cloud account onboarded in Strata Cloud Manager.',
          'A Customer Support Portal login on the support account that owns the flex-credit pool, with a role that can see **Software NGFW Credits** and create deployment profiles — and credits left in that pool.',
          'An SCM role whose left navigation shows **AI Security**.',
          'A dedicated API key (or IAM identity / service account) for the first provider — not a personal key.',
          'For the guardrail in Phase 5: an AIRS API key linked to an AI security profile ("Get an API key and a security profile").',
          'Optional: a Strata Logging Service instance on the tenant, where Threat Logs land.',
        ],
      },
      {
        type: 'steps',
        title: 'Phase 1 — Licence and activate',
        steps: [
          { title: 'Size the licence in billions of tokens a month', text: [
            'Every kind of traffic — prompts, MCP calls, agent-to-agent — is metered in tokens, both directions. For each app, agent and MCP server: requests a month × (average prompt + average response, in characters) ÷ 4, plus headroom. System prompts, retrieved documents, tool schemas and history usually dominate.',
            'The profile field takes **whole billions, minimum 1** — the same rule the official Runtime API deployment-profile procedure states for its token field. A worked estimate is in "AI Gateway requirements checklist".',
          ] },
          { title: 'Create the deployment profile in the Customer Support Portal', text: [
            'Open the credit pool that will fund the gateway and look at its **Current Deployment Profiles** table first: an AI-GW row with your name already holds credits, so reuse its Finish Setup link rather than creating a second one. Then **Create New Profile** and, in STEP 1, select **AI Gateway** in the Prisma AIRS column (the wizard calls it a firewall type — expected).',
            'On the FORM: **Deployment** — Managed Service for SaaS, Self Service (DIY) for hybrid (informational; it changes neither credits nor limits) · **Profile Name** · **Billion tokens per month** · Strata Cloud Manager Pro is bundled and cannot be removed. **Calculate Estimated Cost** shows the credit draw; **Create Deployment Profile** adds an AI-GW row with an Auth Code — keep that code out of tickets and screenshots.',
          ], path: ['support.paloaltonetworks.com', 'Products', 'Software NGFW Credits', '<credit pool>', 'Create New Profile'] },
          { title: 'Map the profile to your tenant (TSG)', text: 'Finish Setup opens **Activate Subscriptions based on Deployment Profile(s)**: the support account, the recipient **Tenant** (the TSG — check its name under Common Services → Tenant Management), a **Region** (required; the gateway is Americas-only for now), and a tick on the AI Gateway profile. Rows already ticked are existing associations — unticking one removes it. Leave Data Loss Prevention and Cloud Identity Engine at their defaults, agree to the terms, **Activate**. The TSG becomes the AI Gateway organisation, and the mapping is what links Strata Logging Service for Threat Logs.', path: ['Current Deployment Profiles', 'Finish Setup', 'Activate'] },
          { title: 'Wait for the AI Gateway card', text: 'Under AI Security → Home the card reads **Not Started** with Go to Gateway Registration, Launch AI Gateway and Deploy Hybrid — the guide carries on from the left navigation instead. No card: allow 30 minutes for the profile-to-tenant association, then recheck the two steps above.', path: ['Strata Cloud Manager', 'AI Security', 'Home'] },
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Two activation procedures',
        text: [
          'The Palo Alto Networks page "Activate AI Gateway" (updated 2026-09-23) creates the profile **inside Strata Cloud Manager** — AI Gateway tile → Get Started → Create Deployment Profile (a name only) → Activate → Commit — and meters "1 flex credit equals 4 characters of LLM input or output".',
          'The implementation guide creates it in the **Customer Support Portal** from a Software NGFW credit pool, sized in billions of tokens a month (1 token = 4 characters), maps it through Finish Setup, and records different card actions. The official Runtime API procedure also starts in the Customer Support Portal with a monthly-token field. Follow the path your tenant actually offers, and confirm with the account team.',
        ],
      },
      {
        type: 'steps',
        title: 'Phase 2 — Confirm the SaaS gateway is on',
        steps: [
          { title: 'Check the toggle', text: 'Admin Settings → **Gateway Registration**: the SaaS Gateway banner ("This is your default SaaS Gateway per TSG") should read **Enabled** — switch it back on if an earlier hybrid attempt turned it off. The Total Gateways list underneath counts hybrid data planes only, so zero is normal on SaaS.', path: ['AI Security', 'AI Gateway', 'Admin Settings', 'Gateway Registration'] },
          { title: 'Know what is now exposed', text: 'Enabled means `https://aigw.portkey.ai` (LLM) and `https://mcp-aigw.portkey.ai` (MCP) accept TLS on 443 from any address. There is no source-IP allow-list: until a gateway API key exists nothing can authenticate, and from then on the key is the only control — so give keys expiries and budgets.' },
          { title: 'Hybrid instead', text: 'Register a gateway, keep the one-time `values.yaml` and install the `airs-gw` chart ("Hybrid deployment"; the implementation guide\'s Hybrid Infrastructure companion covers sizing and egress). A hybrid gateway does **not** close the SaaS endpoint: the same keys keep working there until you set the SaaS Gateway toggle to Disabled — only after a request has succeeded through your own data plane.' },
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Settings, workspaces and virtual keys',
        text: [
          'The Palo Alto Networks "Deploy AI Gateway" page checks SaaS under AI Security → AI Gateway → **Settings** (Enable AI Gateway, type SaaS), creates a workspace under **Workspaces → Add Workspace**, and has developers send that workspace\'s virtual key in `x-portkey-virtual-key`, then Commit.',
          'The implementation guide, the developer docs\' Simple Setup and this portal\'s tenant use Admin Settings, **Workspace Control**, gateway API keys from **Security Keys** and `@slug/model` addressing. The developer docs mark virtual keys deprecated, and both `Authorization: Bearer` and `x-portkey-api-key` authenticated from this portal ("Connect any app to the gateway").',
        ],
      },
      {
        type: 'steps',
        title: 'Phase 3 — Create the LLM integration',
        steps: [
          { title: 'Pick the provider', text: 'Integrations opens on **LLM Integrations**, beside MCP Registry, Secret References and Agent Integrations. **+ Add LLM Integration**, click the provider tile, **Next: Set Details**. Recreating one? Delete the old row first so its slug is free — reusing the slug keeps existing clients working.', path: ['AI Security', 'AI Gateway', 'Integrations', 'LLM Integrations', '+ Add LLM Integration'] },
          { title: 'Name, slug and credential', text: [
            '**Name** (required), an optional **Short Description**, and a **Slug** of lowercase letters, digits and hyphens, unique in the organisation. The slug becomes the `@<slug>/` prefix every caller sends and cannot change without a new integration — pick one developers recognise (`default-anthropic`, `prod-openai`).',
            'Then the credential: a dedicated organisational key (**Grab API Key** links to the provider\'s instructions), or a vault entry — "Provider keys: vault, rotation and expiry alerts". Bedrock auth types, Vertex project and region, Azure resources and deployments: "Model providers".',
          ] },
          { title: 'Advanced options and pricing', text: [
            '**Custom Host URL** (e.g. `https://api.example.com/v1`) aims the integration at a private or self-hosted model; **Custom headers** add a header to every upstream call, shared by every workspace. On SaaS the hosted data plane makes that connection, so the host must be reachable from the internet behind TLS — the developer docs refuse private ranges, internal names and several ports ("One endpoint, three API formats").',
            '**Pricing Adjustments** change cost reporting only: `1` list price, `0.8` a 20 % discount, `1.2` a 20 % markup; a discount is 1 − (discount ÷ 100), and unset token types inherit Default. Then **Next: Choose Workspace**.',
          ] },
          { title: 'Workspaces, budgets and rate limits', text: [
            'Tick each workspace that may use the integration — a new tenant has one default workspace; more are created under **Workspace Control**. Leave **Automatically provision this integration for new workspaces** off until the limits are settled, because every future workspace inherits them.',
            '**Set Value** (or Set Value for All Selected) opens Set Budget and Rate Limits. **Add Budget**: dollars or tokens, an optional threshold — the field reads "Alter Threshold ($)", a UI typo for the alert threshold: it warns, it does not block; 80 % of the limit is common — and a reset: none, weekly (Sunday 00:00 UTC) or monthly (the 1st, 00:00 UTC). **Add Rate Limit**: requests or tokens per minute, hour or day. **Apply**, then **Next: Select Models**.',
          ], path: ['Workspace Access, Budget & Rate Limits', 'Set Value', 'Apply'] },
          { title: 'Choose the models and create it', text: 'Toggle the models workspaces may call; anything left off is outside the allow-list (Select All is fine for a first test — this list, unlike the limits, stays editable). **Set Pricing** opens Update Base Model for custom input, output and cache prices and a per-model Custom Host — a model with custom pricing ignores pricing adjustments. Optionally auto-enable the provider\'s new models; **+ Add Model** for a missing one; **Create Integration**. The row shows name, slug, provider, creator and workspace count, and the models appear under **Catalogs** in each provisioned workspace.' },
        ],
      },
      {
        type: 'callout', tone: 'warn', title: 'Decide the limits before you click Apply',
        text: [
          'Integration budgets and rate limits cannot be edited by anyone once applied — the budget-limits page and the implementation guide agree. The console way out is to remove the workspace and provision it again; in practice, delete the integration and recreate it with the same slug, and that workspace\'s traffic fails in between.',
          'Minimums are $1 and 100 tokens; a rate limit of `0` switches the provider off for that workspace; a budget counts only requests made after it is set. The Admin API\'s `PUT /integrations/{slug}/workspaces` does accept `usage_limits` and `rate_limits` per workspace — whether that replaces an applied limit is untested.',
        ],
      },
      {
        type: 'steps',
        title: 'Collect the three values every client needs',
        steps: [
          { title: 'The gateway base URL', text: 'Admin Settings → General → Organization Details → **Gateway URLs** — `https://aigw.portkey.ai/v1` on SaaS. OpenAI-style clients use it as shown; the Anthropic SDK and Claude Code take it **without** `/v1`. On hybrid, use your own data plane\'s address instead.', path: ['AI Security', 'AI Gateway', 'Admin Settings', 'General'] },
          { title: 'The model reference', text: 'Integrations → click the row: the slug is the pill in the panel header; the **Model Provisioning** tab lists Provisioned LLMs. Together: `@<integration-slug>/<model-name>`.' },
          { title: 'A gateway API key', text: [
            'Security Keys has two tabs: **User** (one person — Claude Code, an IDE) and **Service** (unattended apps, CI). **+ Create New** → API Key Details: API Key Name, Short Description (up to 100 characters), **Configuration** (empty until a config exists), **Metadata** (JSON tags, below) and Controls & Limits — Add Rate Limit, Add Budget, Add Rotation Policy (overlap of at least 30 minutes), Auto Expire, Email Notifications.',
            '**Next: Set Permissions** lists Completions (Write), Agents (Invoke), Mcp (Invoke), Logs (Write) and Prompts (Render) — grant only what the caller uses. **Create Gateway API Key** shows the key once. The form does not say which workspace the key lands in: check the Workspace selector at the top left of the AI Gateway pages first.',
          ], path: ['AI Security', 'AI Gateway', 'Security Keys', 'User or Service', '+ Create New'] },
        ],
      },
      { type: 'code', title: 'The first request', text: 'Either format proves the URL, the key and the model reference together. Replace the placeholders before running — the shell accepts angle brackets without complaint.', tabs: FIRST_CALL_TABS },
      {
        type: 'table',
        title: 'Reading the first answer',
        columns: ['What comes back', 'What it means'],
        rows: [
          ['A JSON answer (`chatcmpl-…` or `msg_…`)', 'Everything works. The call is on Observability → Logs with model, tokens and cost.'],
          ['An error naming the model', 'URL and key are fine — the gateway authenticated you, then refused the model. Check the allow-list (this portal\'s tenant says "Model X is not allowed for this integration").'],
          ['401', 'Wrong or revoked key, a key from another tenant, or a key in a workspace the integration is not provisioned to.'],
          ['400 "Either x-portkey-config or x-portkey-provider header is required"', 'A bare model name with no provider header — what Claude Code sends unless `ANTHROPIC_CUSTOM_HEADERS` carries `x-portkey-provider: @<slug>` ("Claude Code, Codex and Cursor through the gateway").'],
          ['Connection refused or a timeout', 'Wrong base URL; on hybrid, the port-forward or the ingress is down.'],
          ['Strange answers from Claude Code or the Anthropic SDK', '`/v1` left on their base URL — they add their own path, and the developer docs say the request then becomes an unprocessed passthrough.'],
        ],
        note: 'The triage and the 400 wording are the implementation guide\'s; the developer docs\' error table lists only 408, 412, 429, 446 and 246.',
      },
      {
        type: 'table',
        title: 'Tell people and agents apart — before the first key',
        columns: ['Caller', 'Key', 'Key metadata (admin sets it)', 'Request metadata (client sends it)'],
        minWidth: 720,
        rows: [
          ['A person: Claude Code, Codex, an IDE', 'User, one per person', '`{"actor": "human", "_user": "<email>"}`', '`x-portkey-metadata: {"_user": "<email>", "client": "claude-code"}`'],
          ['An agent, pipeline or backend service', 'Service, one per agent', '`{"actor": "agent", "agent": "<agent-name>"}`', '`{"_user": "<end-user>"}` when it acts for someone, plus run or ticket ids'],
        ],
        note: 'Values are strings of up to 128 characters. Key metadata wins over request metadata (workspace > key > request), so a caller cannot relabel itself; `_user` feeds the Users analytics, and an OpenAI `user` field is copied into it. Groups do not come from SSO or Cloud Identity Engine — those decide who signs in to SCM, not how traffic is tagged (JWT routing is the exception). Make tags mandatory for new keys under Admin Settings → Organisation Properties → API Key Metadata Schema ("AI Gateway requirements checklist" has a schema).',
      },
      {
        type: 'callout', tone: 'docs', title: 'Edit a key, or replace it?',
        text: [
          'The implementation guide could not confirm that a key\'s Metadata, Configuration or permissions can be changed, so it replaces keys: create the new one with the same settings, update every client (`~/.claude/settings.json`, shell profiles, `claude mcp` entries), then delete the old row.',
          'The developer docs attach a default config to an existing key with its edit icon, set key budgets and rate limits "when creating or editing" a key, and the Admin API\'s `PUT /api-keys/{id}` accepts `scopes`, `defaults.metadata`, `defaults.config_id`, limits and `expires_at`. Try the edit action first; replace the key when the console will not let you. Neither was tested from this portal.',
        ],
      },
      {
        type: 'steps',
        title: 'Phase 4 (optional) — Broker an MCP server',
        steps: [
          { title: 'Find the MCP base and check it', text: 'Admin Settings → General → **MCP Gateway URLs**, just under Gateway URLs — on SaaS `https://mcp-aigw.portkey.ai`, which is also what this portal\'s tenant serves (the developer docs\' default is `https://aigw.portkey.ai/m`, so copy yours). `GET <mcp-base>/health` should answer `"status": "healthy"`.' },
          { title: 'Register the origin server', text: 'MCP Registry → **+ Add MCP Servers**: Name, optional Short Description, the **URL** of the origin server (not the gateway\'s), the Slug, **Server Type** (Streamable HTTP; SSE only if the server needs it), optional Passthrough headers (client headers such as trace ids — not credentials) and **Authentication** as the server dictates — OAuth 2.1 (the default: per-user consent with dynamic client registration, or one shared identity with client credentials), Headers (a static token every user shares; it can come from a Secret Reference) or None. Leave Advanced Settings empty unless the server documents keys for it. **Next: Choose Workspace**.', path: ['AI Security', 'AI Gateway', 'Integrations', 'MCP Registry', '+ Add MCP Servers'] },
          { title: 'Provision it to workspaces', text: 'Switch on each workspace under Total Valid Workspaces; keep automatic provisioning for new workspaces off for anything that reaches sensitive systems. **Create MCP Server** — the row should read **Active** with your workspace count (an empty Server version is normal). A server not provisioned to the key\'s workspace connects but lists no tools — the most common "no tools" cause.' },
          { title: 'Point a client at it and prove one tool call', text: 'The URL is `<mcp-base>/<server-slug>/mcp`, authenticated with `x-portkey-api-key` (the guide reports `Authorization: Bearer` works too) from a key with Mcp (Invoke). After one tool call, Observability → Logs shows a row whose model column is the server slug, next to the LLM traffic — proof the gateway brokered it. Tool-level access, OAuth and guardrails: "MCP Gateway: registry, auth and tool control".' },
        ],
      },
      { type: 'code', title: 'MCP: check, then connect', tabs: MCP_TABS },
      {
        type: 'steps',
        title: 'Phase 5 — Policies, the AIRS guardrail and logs',
        steps: [
          { title: 'Policy-level budgets and rate limits (optional)', text: [
            'Phase 3 limits stand alone; policies add caps across models, users, workspaces or metadata. **+ Add Budget Limit**: Policy Name, Description, Policy Type (Cost or Tokens), Budget Limit ($), Alert Threshold ($), Periodic Reset (including every N days), **Conditions** (a Condition Key with Includes and Excludes lists — e.g. `actor`) and **Groups** (Group by Key: one counter per value, e.g. per team). The Rate Limits tab is the same with requests or tokens per minute, hour or day.',
            'Test with a throwaway key carrying a metadata value nothing real uses, and confirm a policy row can be deleted before scoping one to real traffic — a second policy with the same conditions stacks a second cap. Field reference and the API form: "Keys, budgets and rate limits".',
          ], path: ['AI Security', 'AI Gateway', 'Policies & Profiles', 'Budget Limits', '+ Add Budget Limit'] },
          { title: 'Create the Prisma AIRS guardrail config', text: 'The documented route: store the AIRS endpoint and key once under Admin Settings → Plugins → PANW Prisma AIRS, create a Partner guardrail (PANW Prisma AIRS Guardrail, Deny or Log Only) and note its `pg-…` id. Then **Configuration → + Create configs** opens a JSON editor with an example — replace it (below), **Save Configuration**, note the `pc-…` id, and give the data plane a minute to sync. Parameters and scan scope: "The AIRS guardrail in the gateway".', path: ['Policies & Profiles', 'Configuration', '+ Create configs'] },
          { title: 'Attach it where callers cannot skip it', text: 'Select the config in the key\'s **Configuration** dropdown (or edit an existing key) — every request with that key is scanned. The `x-portkey-config: pc-…` header is fine for testing but opt-in: a request without it is not scanned, and a header config replaces the key\'s unless Allow Config Override is off on the key. The config names no provider, so callers still pick the integration with `@slug/` or `x-portkey-provider`.' },
          { title: 'Read the logs, then wire up export', text: 'Observability → **Logs**: a row opens its trace — Trace ID, model, cost, timing, the integration and the key, and the full request and response (Pretty or raw). Event and prompt logs are kept for a year. For a SIEM: on SaaS, forward Threat Logs from Strata Logging Service; on hybrid, set the OTLP variables on the data plane ("Logs, traces, metadata and OpenTelemetry").', path: ['AI Security', 'AI Gateway', 'Observability', 'Logs'] },
        ],
      },
      { type: 'code', title: 'The guardrail config', text: 'The first tab references a saved guardrail, whose AIRS credentials live with the plugin. The second is the implementation guide\'s raw-hook form: the AIRS key is typed into the config itself, readable by anyone who can open Policies & Profiles, and has to be rotated in both hooks at once. Neither was run from this portal.', tabs: GUARD_CFG_TABS },
      {
        type: 'callout', tone: 'docs', title: 'A blocked prompt: 446 or 200?',
        text: [
          'The implementation guide expects a blocked prompt back as **HTTP 446** (246 with Deny off), as the developer docs\' error table says. On the SCM tenant this portal uses, a deny came back as **HTTP 200** with the content replaced and `verdict: false` in `hook_results` — the documented soft-deny shape.',
          'So test on the verdict, not the status code ("The AIRS guardrail in the gateway"). Test the response side too: ask for output your profile blocks (a sample card number with DLP on) and look for a response-side verdict under AI Security → AI Runtime, where gateway scans carry your app name prefixed `Portkey-`.',
        ],
      },
      {
        type: 'checklist',
        title: 'Final end-to-end check',
        items: [
          'Licence — the AI-GW row in the credit pool shows consumption (it lags behind traffic).',
          'Gateway — SaaS enabled; on hybrid, Healthy with a recent Last Sync, and SaaS disabled if traffic must not use the hosted endpoint.',
          'Integration — a provisioned workspace sees the provider under Catalogs and calls an allowed model without holding any provider credential.',
          'Allow-list — a request for a model you switched off is refused.',
          'Rate limit — a throwaway key limited to 1 request a minute refuses the second request (never test with Add Budget on a key you keep).',
          'Guardrail — a benign prompt answers; an injection is blocked even with the `x-portkey-config` header removed, proving the config rides on the key.',
          'Logs — each row names the key and its `actor` tag; Threat Logs reach Strata Logging Service if the tenant has one.',
        ],
      },
      {
        type: 'table',
        title: 'Smaller differences between the guide and the official docs',
        columns: ['Topic', 'Implementation guide', 'Official docs or this portal'],
        minWidth: 760,
        rows: [
          ['Policies & Profiles tabs', 'Budget Limits, Rate Limits, Configuration', 'Six on the PANW page: also Access Policies, Guardrails and Agent Endpoint; the AIRS guardrail page creates guardrails under Policies & Profiles → Guardrails'],
          ['Policy budgets', 'A console form with Conditions and Group by Key', 'PANW page: policy-based rules "through the Admin API"; the developer docs describe only the API (`conditions`, `group_by`)'],
          ['Rate-limit windows', 'Per minute, hour or day', 'PANW page: per minute and per day; developer docs `rpm` / `rph` / `rpd`, policies also `rpw`'],
          ['Pricing modes', 'Form and JSON', 'Default and Custom on the pricing-adjustments page'],
          ['Weekly reset', 'Sunday 00:00 UTC', 'Same on the budget pages; the policies page says Monday'],
          ['MCP server type', 'Streamable HTTP or SSE in the form', 'Product pages: Streamable HTTP only (the Admin API schema accepts `sse`)'],
          ['Bedrock assumed role on SaaS', 'The trust principal "is not shown" — use an access key or a Bedrock API key', 'Docs publish `arn:aws:iam::039293892788:role/AirsGwEnterpriseRole`; on this portal\'s tenant assumed role failed with a token error ("Model providers")'],
          ['Check Language, Detect Gibberish', 'Basic tier', 'PRO (LLM-based) checks in the developer docs'],
          ['Hybrid prompt bodies', 'Still reach the SCM backend in the GA release', 'PANW deploy page: "never transmitted to Palo Alto Networks" — "Hybrid deployment", What crosses the boundary'],
        ],
      },
      {
        type: 'checklist',
        title: 'Tear down in reverse order',
        items: [
          'Clients: the `env` block in `~/.claude/settings.json`, `AIGW_API_KEY` in shell profiles, the `aigw` provider in `~/.codex/config.toml`, and `claude mcp remove --scope user <server>`.',
          'Security Keys: delete every User and Service key — keys in clients work until revoked.',
          'Integrations: delete the MCP Registry and LLM Integrations rows; Policies & Profiles: budget and rate policies and configs (a raw-hook config holds an AIRS key).',
          'At each provider, revoke the key you pasted — deleting the integration in SCM does not.',
          'Hybrid: uninstall the release, delete the claims and the namespace, then the gateway row ("Hybrid deployment").',
          'Ask the CSP Super User or the account team to remove the deployment profile and return its credits.',
        ],
      },
      {
        type: 'cards',
        min: 240,
        items: [
          { icon: Route, tone: '#EC4899', title: 'Request flows', kicker: 'Two keys · six gates', text: 'Where a call can stop, which error it gets, and where the record goes.', go: 'gw-flows' },
          { icon: Plug, tone: '#EC4899', title: 'Connect any app', kicker: 'Base URL · key · slug', text: 'Headers, response headers and the SDK details.', go: 'gw-connect' },
          { icon: Cloud, tone: '#EC4899', title: 'Model providers', kicker: 'Bedrock · Vertex · Azure', text: 'Every auth type, SaaS versus hybrid.', go: 'gw-providers' },
          { icon: ShieldCheck, tone: '#EC4899', title: 'The AIRS guardrail', kicker: 'Partner check', text: 'Parameters, scan scope and how to read a block.', go: 'gw-guardrail' },
          { icon: Code2, tone: '#EC4899', title: 'Coding agents', kicker: 'Claude Code · Codex · Cursor', text: 'The settings files, per-developer keys and their gotchas.', go: 'gw-coding' },
          { icon: KeyRound, tone: '#d946ef', title: 'Keys, budgets, rate limits', kicker: 'Governance', text: 'Scopes, rotation, policies and enforced configs.', go: 'gw-governance' },
          { icon: Vault, tone: '#d946ef', title: 'Provider keys in a vault', kicker: 'Secret References', text: 'Keep the provider credential in your vault and rotate it without an outage.', go: 'gw-llm-keys' },
          { icon: Server, tone: '#EC4899', title: 'Hybrid deployment', kicker: 'Helm · your Kubernetes', text: 'The Phase 2 that hybrid replaces.', go: 'gw-hybrid' },
        ],
      },
    ],
  },

  {
    id: 'gw-llm-keys',
    group: 'gwgov',
    title: 'Provider keys: vault, rotation and expiry alerts',
    sub: 'Where the provider credential lives, how it reaches the gateway, and how to rotate it',
    minutes: 11,
    level: 'Operate',
    docs: pick('imAigwKeys', 'imAigwKeyRotation', 'agSecretRefs', 'agSecretRefApi', 'agIntegrationPut', 'agIntegrations', 'gwIntegrations', 'agAzureAuth', 'agVertex', 'agBedrock', 'agBedrockRole', 'agKeyRotation', 'scmTokens'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Two credentials meet at the gateway and never mix. **Gateway API keys** go to applications ("Keys, budgets and rate limits"). The **provider credential** — an OpenAI key, a Bedrock IAM identity, a Vertex service account — lives in the integration and is never handed out; the gateway swaps it in on every call. This guide is about that second one.',
          'The implementation guide sets up Azure Key Vault for teams that have no secrets process yet. The official docs add the part that connects a vault to the gateway: **Secret References**, where the gateway\'s data plane reads the credential from your vault itself.',
        ],
      },
      {
        type: 'table',
        title: 'Three ways to hold a provider credential',
        columns: ['Way', 'How', 'Rotation', 'Watch out'],
        minWidth: 760,
        rows: [
          ['Paste it into the integration', 'The credential field on the integration\'s details page. Stored encrypted in SCM; on hybrid the data plane also caches it, encrypted, in its Redis.', 'New key at the provider → replace it on the integration (Integration Details tab, or the Admin API\'s `PUT /integrations/{slug}` with `key`) → revoke the old one.', 'The guide falls back to delete-and-recreate when the field is read-only — traffic fails in between. The API call keeps slug and limits.'],
          ['A Secret Reference', 'Integrations → **Secret References** → Create (Name, Slug, manager, authentication, **Secret Path**, optional Secret Key), then the **Secret Ref** toggle on the integration. Gateway 2.2.4+; AWS Secrets Manager, Azure Key Vault, HashiCorp Vault.', 'A new version under the same secret name. The data plane caches values for **5 minutes**, then fetches again.', 'The vault sign-in is itself a credential (a service-principal secret, an access key, a Vault token) unless the gateway runs in your cloud. On SaaS the fetching data plane is Palo Alto Networks\' — the vault must be reachable from it; the docs list no egress addresses.'],
          ['No stored secret', 'The gateway\'s own cloud identity: Bedrock service role (IRSA / Pod Identity), Vertex workload identity, Azure managed or workload identity.', 'Nothing to rotate.', 'Hybrid only — "Model providers" and "Hybrid deployment".'],
        ],
        note: 'Secret References from the Secret References page: the management plane stores only the reference (manager, path, sign-in), never the value, and masks sensitive sign-in fields when you read a reference back. Deleting a reference fails while an integration still uses it.',
      },
      {
        type: 'table',
        title: 'Per provider: what to store, and the keyless option',
        columns: ['Provider', 'What the integration needs', 'Expiry and least privilege'],
        minWidth: 740,
        rows: [
          ['OpenAI · Anthropic', 'One API key (OpenAI optionally adds Organization ID and Project ID).', 'Neither expires on its own — a vault expiry date is your rotation trigger.'],
          ['Amazon Bedrock', 'Access key id + secret + region · an assumed role (role ARN, optional external id) · or a Bedrock API key.', '`bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on the models; for `us.*` profile ids also `bedrock:GetInferenceProfile` and the profile ARNs (the guide\'s sample policy covers only foundation models). Access keys are long-lived: rotate on a schedule.'],
          ['Google Vertex AI', 'A service-account JSON key, the project ID and a region.', 'Grant `roles/aiplatform.user` (developer docs and the deployment guide). The key guide\'s "only `aiplatform.endpoints.predict`" is a permission, so it needs a custom role; self-deployed `endpoints.*` models need that permission explicitly. Keys do not expire by default, but an org policy can cap them — this portal\'s organisation caps them at 30 days ("Model providers").'],
          ['Azure OpenAI · Azure AI Foundry', 'The resource key — or `entra`: tenant id, client id and client secret of an app registration.', 'Role **Cognitive Services OpenAI User** on the resource, not Contributor. An Entra client secret expires (one year by default for `az ad sp create-for-rbac`) — record where its rotation is tracked.'],
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Keyless Azure OpenAI needs a hybrid gateway',
        text: [
          'The key-management guide says Azure OpenAI needs no API key at all: give the gateway\'s identity the Cognitive Services OpenAI User role.',
          'The developer docs\' Azure authentication page limits `managed`, `workload` and `entraFederated` to **hybrid** deployments. On SaaS the gateway has no identity in your tenant, so the keyless-looking option is `entra` — which stores a client secret in SCM. The same goes for a Secret Reference into Key Vault: on SaaS plan on `entra`. Its `managed` and `default` modes sign in with the gateway host\'s own Azure identity, which only a data plane you run can have — inferred, the Secret References page does not say.',
        ],
      },
      {
        type: 'steps',
        title: 'A vault from scratch (Azure Key Vault)',
        steps: [
          { title: 'Create a dedicated vault', text: 'One vault for gateway credentials only, so its access can be scoped exactly: RBAC permission model, purge protection, 90-day retention. Give yourself **Key Vault Administrator** for the setup and narrow it afterwards. Already have HashiCorp Vault, AWS Secrets Manager or CyberArk? Use it and skip to the reference step.' },
          { title: 'Store one secret per credential, with an expiry', text: 'Name them `llm-<provider>-<credential-type>` (`llm-openai-api-key`, `llm-aws-bedrock-secret-access-key`, `llm-google-vertex-sa-key`) and set `--expires` 90 days out on every key-type secret. Read keys with `read -s` so they never reach shell history; store a service-account JSON from its file and delete the file. Region, project and endpoint values need no expiry.' },
          { title: 'Give the reader an identity', text: 'Whatever reads the vault: on SaaS, a service principal for the Secret Reference (`entra`); on a hybrid gateway in Azure, a managed identity. A service principal\'s secret is shown once — keep it outside this vault.' },
          { title: 'Grant the least role that works', text: '**Key Vault Secrets User** (read) to the reader; **Key Vault Secrets Officer** to the team that rotates. Officer can read values too — if rotators must not, build a custom role without `Microsoft.KeyVault/vaults/secrets/getSecret/action`.' },
          { title: 'Point the gateway at it', text: 'Create the Secret Reference (Azure Key Vault, `entra`, the vault URL, Secret Path = the secret name) and switch the integration\'s key to **Secret Ref** — or do both through the Admin API (last tab).', path: ['AI Security', 'AI Gateway', 'Integrations', 'Secret References', 'Create'] },
        ],
      },
      { type: 'code', title: 'Vault, secrets, roles and the reference', text: 'Azure CLI from the implementation guide, adjusted: soft delete needs no flag, keys are read without echo, and the last tab wires the vault to the gateway through the Admin API (SCM service-account token, `api.apps.paloaltonetworks.com/ai_gw/admin/v2`). Not run from this portal.', tabs: VAULT_TABS },
      {
        type: 'callout', tone: 'docs', title: 'The guide\'s runtime code is for your apps, not the gateway',
        text: 'Step 5 of the key-management guide reads every provider key with `DefaultAzureCredential` and `SecretClient` and calls Azure OpenAI with a token provider. That is how your own application would read a vault. The SCM gateway runs none of your code: it holds the pasted credential, or fetches it through a Secret Reference. And once apps go through the gateway, they need a gateway key — not the provider keys.',
      },
      {
        type: 'steps',
        title: 'Rotate a provider key without an outage',
        steps: [
          { title: 'Create the new key at the provider', text: 'Keep the old one active until the gateway is proven on the new one.' },
          { title: 'Put it where the gateway reads it', text: 'Vault-backed: a new version under the same secret name. Pasted: replace the value on the integration, or send the new `key` with `PUT /integrations/{slug}`.' },
          { title: 'Prove the switch', text: 'Wait out the 5-minute secret cache, send a test request and confirm it on Observability → Logs for that integration.' },
          { title: 'Retire the old key', text: 'Revoke it at the provider, then disable the previous secret version in the vault.' },
          { title: 'Re-arm the alert', text: 'The new version carries its own `--expires` date, so the next near-expiry event fires 30 days before it.' },
        ],
      },
      { type: 'code', title: 'Rotation and the expiry alert', tabs: ROTATE_TABS },
      {
        type: 'table',
        title: 'Expiry alerting',
        columns: ['What expires', 'How you find out'],
        minWidth: 640,
        rows: [
          ['A Key Vault secret', 'Event Grid: Key Vault publishes `Microsoft.KeyVault.SecretNearExpiry` 30 days before the expiry date and `SecretExpired` on it (Microsoft\'s Key Vault Event Grid docs). The guide\'s `az monitor alert create` is not in the current Azure CLI — use the event subscription, or a log alert with `az monitor scheduled-query`.'],
          ['An Entra client secret', 'Its own end date in Entra — track it beside the vault secrets, since it unlocks all of them.'],
          ['A Vertex service-account key', 'Never, unless an org policy (`iam.serviceAccountKeyExpiryHours`) caps it — then the cap is the deadline.'],
          ['Gateway API keys (the other credential)', 'Rotation Policy, Auto Expire and Email Notifications on the key — "Keys, budgets and rate limits".'],
        ],
      },
      {
        type: 'table',
        title: 'Who gets which role',
        columns: ['Identity', 'Role', 'Why'],
        rows: [
          ['The reader (gateway or service principal)', 'Key Vault Secrets User', 'Reads secrets at runtime; cannot write.'],
          ['Ops team that rotates', 'Key Vault Secrets Officer', 'Creates, updates and disables versions — and can read values.'],
          ['The person doing setup', 'Key Vault Administrator', 'Setup only; remove or narrow it once access is verified.'],
          ['The reader, for keyless Azure OpenAI (hybrid)', 'Cognitive Services OpenAI User', 'Assigned on the Azure OpenAI resource, not on the vault.'],
        ],
      },
      {
        type: 'callout', tone: 'warn', title: 'The vault sign-in becomes the master key',
        text: 'Whatever unlocks the vault — `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET`, a Vault token, an AWS access key in a Secret Reference — now opens every provider credential at once. Keep it in a different store from the vault, give it an expiry, inject it with the platform\'s secret mechanism rather than a `.env` file, and remember that anyone who can edit the Secret Reference can point it elsewhere.',
      },
      {
        type: 'cards',
        items: [
          { icon: KeyRound, tone: '#d946ef', title: 'Gateway keys and limits', kicker: 'Governance', text: 'Scopes, rotation policies and the controls callers cannot opt out of.', go: 'gw-governance' },
          { icon: Cloud, tone: '#EC4899', title: 'Every auth type per provider', kicker: 'Model providers', text: 'Which credentials SaaS accepts and which need hybrid.', go: 'gw-providers' },
          { icon: Rocket, tone: '#EC4899', title: 'The whole deployment', kicker: 'Walkthrough', text: 'Where the credential goes in the integration wizard.', go: 'gw-deploy-walkthrough' },
        ],
      },
    ],
  },

  {
    id: 'gw-flows',
    group: 'gateway',
    title: 'Request flows end to end',
    sub: 'Two keys, six gates, two meters — and the traffic the gateway never sees',
    minutes: 8,
    level: 'Reference',
    docs: pick('imAigwFlows', 'imAigwRef', 'imAigwDeploy', 'arErrors', 'agCommonErrors', 'agGuardrails', 'agMetadata', 'agPolicies', 'agCost', 'agPricing', 'gwObservability'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Every call through the gateway follows the same path: the app presents its gateway key, a series of checks can stop it, the gateway swaps in the provider credential, and the result is metered and logged. Knowing the path turns a support conversation into a lookup — start from the error the caller saw and find the gate that produced it.',
          'The diagrams behind this page are the implementation guides\' review set; the error codes are from the developer docs, and where this portal\'s tenant behaves differently that is said.',
        ],
      },
      {
        type: 'table',
        title: 'What happens to one request',
        columns: ['#', 'Gate', 'Question', 'Stops with'],
        minWidth: 700,
        rows: [
          ['1', 'Authenticate', 'Is the gateway key valid, unexpired and not revoked?', '401'],
          ['2', 'Resolve the integration', 'Which integration serves this call (`@slug/` or `x-portkey-provider`), and may this key\'s workspace use it?', '400 when neither the slug nor a provider header names one (the guide\'s wording: "Either x-portkey-config or x-portkey-provider header is required")'],
          ['3', 'Model allow-list', 'Is the model provisioned on that integration?', 'A refusal naming the model — the allow-list working, not a fault'],
          ['4', 'Guardrails', 'Do the attached input checks pass — basic, PRO, partner (Prisma AIRS)?', '446 with Deny on, 246 with Deny off; HTTP 200 with a false verdict on this portal\'s tenant (soft deny)'],
          ['5', 'Rate limit', 'Within the key, workspace and policy windows?', '429 until the window resets'],
          ['6', 'Budget', 'Within the key, workspace and policy budgets?', '412 until the reset — permanently if no reset was set'],
          ['7', 'Swap and forward', 'Gateway key removed, provider credential attached, request reshaped for the provider', 'Provider errors pass through'],
          ['8', 'Meter, log, return', 'Tokens, cost (with the pricing multiplier), latency, prompt and response, the key and its metadata', 'An output guardrail can still withhold the answer before the caller sees it'],
        ],
        note: 'A refused call is still logged, so a block leaves evidence. The order is the one the implementation guide\'s lifecycle diagram draws; the developer docs publish codes, not an order.',
      },
      {
        type: 'callout', tone: 'docs', title: 'An unattached guardrail does nothing — and async does not answer 246',
        text: [
          'Both sources agree that a guardrail in the catalogue enforces nothing until its id sits in a config\'s input or output hooks, and that config reaches the request (on the key, or by header).',
          'The implementation guide adds that an `async: true` guardrail "returns 246 rather than 446". In the developer docs 246 is a synchronous check that failed with Deny off; an async check returns the provider\'s own status with no `hook_results` — its result is in the logs only ("Guardrail actions, verdicts and PII redaction").',
        ],
      },
      {
        type: 'table',
        title: 'The two keys',
        columns: ['', 'Gateway API key', 'Provider credential'],
        minWidth: 640,
        rows: [
          ['Held by', 'The app, agent or person — one each', 'Strata Cloud Manager (or your vault, through a Secret Reference)'],
          ['Sent as', '`Authorization: Bearer` or `x-portkey-api-key`', 'Whatever the provider wants — added by the gateway'],
          ['Carries', 'Workspace, permissions, limits, expiry, metadata tags, optional default config', 'Nothing about the caller: the provider sees one client'],
          ['Revoke it and', 'Only that caller stops', 'Every workspace using the integration stops'],
          ['Rotate it with', 'A rotation policy or a new key per client', 'One change on the integration — no client changes ("Provider keys")'],
        ],
      },
      { type: 'code', title: 'On the wire, before and after the swap', tabs: [{ id: 'http', lang: 'http', code: WIRE }] },
      {
        type: 'table',
        title: 'Getting inline — five values and how each one fails',
        columns: ['Value', 'Example', 'Wrong, and you get'],
        minWidth: 680,
        rows: [
          ['Base URL', '`https://aigw.portkey.ai/v1` (no `/v1` for Claude Code and the Anthropic SDK)', 'Traffic still going straight to the provider, or a doubled path'],
          ['Gateway key', '`Authorization: Bearer <key>`', '401 — and one shared key collapses cost attribution into one bucket'],
          ['Slug', '`default-anthropic` — lowercase, digits, hyphens', 'A request for an integration that does not exist for this workspace'],
          ['Model reference', '`@default-anthropic/<model-name>`', 'A refusal from the allow-list'],
          ['Provider header (bare model names only)', '`x-portkey-provider: @default-anthropic`', '400 — the gateway cannot guess the integration'],
        ],
        note: 'SaaS versus hybrid changes only the base URL; the key, slug and model reference come from the same SCM tenant either way.',
      },
      {
        type: 'callout', tone: 'warn', title: 'The gateway is opt-in per application',
        text: [
          'Nothing forces traffic through it — no routing, DNS or proxy setting. An app still pointing at the provider keeps working and never appears in the logs, so coverage is an inventory job: find every caller, cut it over, then close the bypass with egress policy to the provider endpoints or by revoking the direct provider keys.',
          'Consumer apps — ChatGPT in a browser or on the desktop, Claude.ai, Copilot surfaces — have no base-URL setting and can never route through the gateway. Governing those is a CASB / SASE or vendor-admin question. Settle which one a customer means on the first call.',
        ],
      },
      {
        type: 'table',
        title: 'Provider paths worth knowing',
        columns: ['Provider', 'What changes'],
        minWidth: 680,
        rows: [
          ['Amazon Bedrock', 'The app holds no AWS credential; the gateway signs with the integration\'s IAM identity in its default region (the Bedrock page\'s `x-portkey-aws-region` overrides it per request — untested with Block Inline Configs on). On SaaS the prompt passes through a Palo Alto Networks endpoint before reaching your own AWS account — raise it early with anyone who chose Bedrock to keep inference in-account.'],
          ['OpenAI', 'The gateway fronts the OpenAI **API**, not the ChatGPT app. The OpenAI usage page shows one caller — the gateway. Streamed calls log zero tokens and cost unless the client sends `stream_options: {"include_usage": true}` (any OpenAI-compatible provider).'],
          ['Azure OpenAI · Azure AI Foundry', 'Two separate catalog entries — pick by the resource that hosts the model. The app names a **deployment**, not a model; a renamed deployment breaks callers with a model-not-found, not an auth error.'],
          ['Claude Code', 'Three variables — base URL without `/v1`, the gateway key, and `x-portkey-provider` in the custom headers ("Claude Code, Codex and Cursor through the gateway").'],
        ],
      },
      {
        type: 'table',
        title: 'Two money flows that never reconcile',
        columns: ['', 'Flex credits', 'Provider bill'],
        minWidth: 620,
        rows: [
          ['Paid to', 'Palo Alto Networks, by token volume — prompts, MCP and agent traffic from one pool', 'The provider, as before — the gateway does not change it'],
          ['Where you see it', 'Customer Support Portal → Software NGFW Credits → the AI-GW row', 'The provider console; the gateway shows a calculated cost per call (list price × your pricing multiplier)'],
          ['Breaks when', 'The profile runs out — traffic stops', 'Committed capacity (e.g. Azure PTU): the bill no longer tracks tokens, so gateway cost is an allocation tool, not a forecast'],
        ],
        note: 'Groups in those numbers come from key metadata, never from directory groups: policies match a Condition Key and Group by Key splits one cap per value. Agree the schema before the first key — tags are not retroactive.',
      },
      {
        type: 'table',
        title: 'Where the record goes',
        columns: ['Destination', 'What', 'Notes'],
        minWidth: 640,
        rows: [
          ['Observability (SCM)', 'Event and prompt logs, analytics', 'Native storage, one year'],
          ['Strata Logging Service', 'Threat Logs', 'Enabled by the TSG mapping; not needed to run the gateway'],
          ['Your SIEM / SOAR', 'Event logs', 'OTLP from a hybrid data plane, or forwarding from SLS'],
          ['Your own object storage', 'Prompt bodies', 'Hybrid only, set in the Helm values — see the caveat below'],
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Where the prompt travels on hybrid',
        text: 'The implementation guide\'s flow set says hybrid prompt traffic no longer transits a Palo Alto Networks endpoint, but prompt logs still reach the SCM backend. The PANW deploy page says hybrid payloads are never transmitted to Palo Alto Networks. The chart\'s default log store forwards to the control plane — "Hybrid deployment", What crosses the boundary.',
      },
      {
        type: 'cards',
        items: [
          { icon: Activity, tone: '#EC4899', title: 'Logs and traces', kicker: 'Observability', text: 'Trace ids, metadata rules and OpenTelemetry.', go: 'gw-observability' },
          { icon: ShieldCheck, tone: '#EC4899', title: 'Guardrail verdicts', kicker: '246 · 446 · soft deny', text: 'Actions, stages and how a block comes back.', go: 'gw-guardrails' },
          { icon: Network, tone: '#EC4899', title: 'MCP traffic', kicker: 'MCP Gateway', text: 'The same two-key model for tool calls.', go: 'gw-mcp' },
          { icon: Rocket, tone: '#EC4899', title: 'Build it', kicker: 'Walkthrough', text: 'The SCM click path that sets up every gate above.', go: 'gw-deploy-walkthrough' },
        ],
      },
    ],
  },
]
