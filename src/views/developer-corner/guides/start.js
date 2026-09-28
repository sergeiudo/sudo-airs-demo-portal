import { Terminal, Waypoints, Server, ScanSearch, Swords, Network } from 'lucide-react'
import { pick } from './links'

/**
 * Start here — choosing an integration path, and what you need before any of
 * them: tenant, licence, roles, credentials, regions, egress.
 */

export const START = [
  {
    id: 'overview',
    group: 'start',
    title: 'Choose your integration path',
    sub: 'Five ways Prisma AIRS plugs into an AI stack — and how they combine',
    minutes: 4,
    level: 'Orientation',
    docs: pick('docsHub', 'pandev', 'pdfRuntime', 'pdfGateway'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Prisma AIRS protects AI at four points in its life — **before a model is loaded**, **before an app ships**, and **at runtime**, where it can sit in your code, in an AI gateway, or on the network. Most customers start with one path and add the others; they share one tenant, one set of security profiles and one console (Strata Cloud Manager).',
          'Pick the row that matches where you can make a change today.',
        ],
      },
      {
        type: 'cards',
        items: [
          { icon: Terminal, tone: '#f43f5e', title: 'AIRS Runtime API', kicker: 'API intercept · in your code',
            text: 'Call a scan API before the model sees a prompt and before the user sees an answer. One HTTPS call, sub-second, any language.',
            bullets: ['Full control over what is scanned and what happens on a block', 'Python SDK, or plain REST from anything', 'Also scans agent tool calls (`tool_event`)'],
            go: 'rt-first-scan', goLabel: 'First scan in 5 minutes' },
          { icon: Waypoints, tone: '#EC4899', title: 'SCM AI Gateway', kicker: 'In the traffic path · almost no code',
            text: 'Point your OpenAI-compatible client at the gateway. Routing, budgets, logs — and the Prisma AIRS guardrail — are enforced centrally.',
            bullets: ['Change the base URL and key; keep your code', 'One guardrail across every provider and cloud', 'MCP servers can be brokered through it too'],
            go: 'gw-connect', goLabel: 'Connect an app' },
          { icon: Server, tone: '#06b6d4', title: 'Network intercept', kicker: 'Inline firewall · no code change',
            text: 'Prisma AIRS firewalls inspect AI traffic between apps, models and the internet — including Kubernetes east-west — with TLS decryption.',
            bullets: ['No application change at all', 'Terraform from Strata Cloud Manager; Helm for Kubernetes', 'Understands Bedrock, Vertex, Azure and OpenAI formats'],
            go: 'ni-deploy', goLabel: 'Deployment options' },
          { icon: ScanSearch, tone: '#6366f1', title: 'AI Model Security', kicker: 'Before a model is loaded',
            text: 'Scan model files and repositories for code that runs on load, backdoors and policy violations — in a CLI, a pipeline or your own code.',
            bullets: ['Hugging Face, local, S3, GCS, Azure, Artifactory, GitLab', 'CLI exits non-zero on a blocked model — a CI gate', 'Every scan lands in Strata Cloud Manager'],
            go: 'ms-setup', goLabel: 'Install the SDK' },
          { icon: Swords, tone: '#fb923c', title: 'AI Red Teaming', kicker: 'Before an app ships',
            text: 'Point automated attack campaigns at your model, app or agent endpoint and get a risk report plus a recommended runtime profile.',
            bullets: ['REST, streaming, WebSocket, OpenAI, Bedrock, n8n…', 'Private endpoints through network channels', 'Scriptable over the Red Teaming API'],
            go: 'rtm-targets', goLabel: 'Connect a target' },
          { icon: Network, tone: '#2dd4bf', title: 'Agents & MCP', kicker: 'Tools, not just text',
            text: 'Scan every tool definition, tool call and tool result an agent handles — through the scan API, the Prisma AIRS MCP server or the MCP relay.',
            bullets: ['Two-stage: parameters before, output after', 'Tool-poisoning checks on `tools/list`', 'Hosted MCP server and a local relay'],
            go: 'mcp-tool-events', goLabel: 'Scan tool calls' },
        ],
      },
      {
        type: 'table',
        title: 'How the runtime paths compare',
        columns: ['', 'Runtime API', 'AI Gateway', 'Network intercept'],
        rows: [
          ['Where it enforces', 'In your code, around each model call', 'Inside the gateway, on every request through it', 'On the wire, at a Prisma AIRS firewall'],
          ['Code change', 'Add a scan call (or the SDK)', 'Change base URL + key', 'None'],
          ['What it can see', 'Exactly what you send — prompts, answers, tool calls, context', 'Everything routed through the gateway (LLM, MCP, A2A)', 'All decrypted AI traffic on the segment'],
          ['You decide on a block', 'Fully — your code handles the verdict', 'Gateway denies or logs, per guardrail', 'Firewall policy (block, alert)'],
          ['Typical first step', 'Get an API key and profile, then one cURL', 'Create an integration and a config in SCM', 'Terraform from SCM, or Helm on Kubernetes'],
        ],
      },
      {
        type: 'callout', tone: 'tip', title: 'They combine',
        text: 'A common layout: **Model Security** gates what gets deployed, **Red Teaming** tests the app before release and recommends a runtime profile, and the **Runtime API or the AI Gateway** enforces that profile in production. The same security profile names work across the runtime paths.',
      },
      {
        type: 'callout', tone: 'observed', title: 'See each one working in this portal',
        text: '**AIRS Runtime & AI-GW** fires attacks through both runtime architectures side by side; **AI Supply Chain** scans real models; **Red Teaming** runs campaigns; **Enterprise AI Access** routes by identity through the AI Gateway. Every guide here links the code that runs them.',
      },
    ],
  },

  {
    id: 'prereqs',
    group: 'start',
    title: 'Tenant, licence & credentials',
    sub: 'What you need in Strata Cloud Manager before writing code',
    minutes: 6,
    level: 'Setup',
    docs: pick('pdfRuntime', 'scmTokens', 'rbac', 'docsHub'),
    blocks: [
      {
        type: 'prose',
        text: 'Every Prisma AIRS product hangs off a **tenant** (a Tenant Service Group, TSG) in Strata Cloud Manager and is funded by **Software NGFW credits** through a **deployment profile**. Developers then need one of two kinds of credential, depending on the product.',
      },
      {
        type: 'facts',
        min: 200,
        items: [
          { label: 'Runtime API (API intercept)', value: 'API key', sub: 'Sent as `x-pan-token`. Created per app in SCM; an OAuth token (1 h – 30 d) can replace it.' },
          { label: 'AI Gateway', value: 'Gateway API key', sub: 'Sent as `Authorization: Bearer` (or `x-portkey-api-key`). A signed JWT can stand in for it.' },
          { label: 'Model Security · Red Teaming · Mgmt APIs', value: 'Service account', sub: 'Client ID + secret → OAuth2 token from `auth.apps.paloaltonetworks.com` with scope `tsg_id:<TSG>`.' },
          { label: 'Monthly quota (Runtime API)', value: 'Tokens', sub: 'Billions of tokens per month; 1 token ≈ 4 characters of prompt, response or tool call.', accent: true },
        ],
      },
      {
        type: 'steps',
        title: 'Activate, then create credentials',
        steps: [
          { title: 'Create a deployment profile for the product', text: 'In the Customer Support Portal: Software/Cloud NGFW Credits → your credit pool → **Create Deployment Profile**. The Runtime API profile is sized in monthly billions of tokens (minimum 1). Model Security, Red Teaming and the AI Gateway each have their own profile type.', path: ['Customer Support Portal', 'Products', 'Software/Cloud NGFW Credits', 'Create Deployment Profile'] },
          { title: 'Associate it with your tenant', text: 'Finish setup in the Hub and link the profile to the TSG. For the Runtime API this activates the token subscription; enable Strata Logging Service forwarding if you want API logs in the Log Viewer. Activation can take up to two hours.', path: ['Hub', 'Common Services', 'Tenant Management', 'Deployment Profiles'] },
          { title: 'Runtime API: an app, a security profile and an API key', text: 'In Strata Cloud Manager create an API application (up to 20 per deployment profile), a security profile with the detection services you want, then **Generate API Key**. Copy the key and the Code Template it shows.', path: ['AI Security', 'API Applications', 'Manage'] },
          { title: 'Model Security, Red Teaming, management APIs: a service account', text: 'Create a service account in Identity & Access and store its client secret immediately — it cannot be shown again. Give it a role with the right permissions (below).', path: ['Common Services', 'Identity & Access', 'Service Accounts'],
            code: [{ id: 'curl', lang: 'curl', code: `# One call gets a 15-minute token for any Prisma AIRS management/data API
curl -sS -X POST https://auth.apps.paloaltonetworks.com/oauth2/access_token \\
  -u "$CLIENT_ID:$CLIENT_SECRET" \\
  -H 'Content-Type: application/x-www-form-urlencoded' \\
  -d "grant_type=client_credentials&scope=tsg_id:$TSG_ID"` }] },
        ],
      },
      {
        type: 'table',
        title: 'Roles and permissions',
        columns: ['Task', 'Role or permission'],
        rows: [
          ['Generate and manage Runtime API keys and OAuth tokens', 'Superuser (other roles may be more limited)'],
          ['Runtime management API (profiles, keys, topics) from code', 'Custom role with `airs_api.ai_sec_profile`, `airs_api.api_keys`, `airs_api.custom_topic`; or View Only for reads'],
          ['Model Security SDK / CLI', 'Service account role with `ai_ms_pypi_auth`, `ai_ms.scans`, `ai_ms.security_groups`'],
          ['AI Red Teaming', 'Superuser, a read-only role with AI Red Teaming, or a custom role'],
          ['Red Teaming network-channel client', 'Service account with `airt.network_channels_client`'],
          ['AI Gateway', 'Workspace-scoped access in SCM; gateway keys have ORGANISATION_SERVICE, WORKSPACE_SERVICE or WORKSPACE_USER roles'],
        ],
      },
      {
        type: 'table',
        title: 'Regions',
        columns: ['Product', 'Regions'],
        rows: [
          ['Runtime API (API intercept)', 'US · Germany (EU) · India · Singapore — each has its own base URL'],
          ['AI Model Security', 'US · EU (Netherlands) · Japan · Singapore'],
          ['AI Red Teaming', 'Americas · EU (Netherlands) · Singapore'],
          ['AI Gateway', 'Americas (SaaS and Hybrid)'],
        ],
        note: 'A deployment profile inherits the region of the tenant it is associated with.',
      },
      {
        type: 'checklist',
        title: 'Outbound HTTPS to allow',
        items: [
          '`service*.api.aisecurity.paloaltonetworks.com` — the Runtime API (and the hosted MCP server)',
          '`auth.apps.paloaltonetworks.com` — OAuth tokens for service accounts',
          '`api.sase.paloaltonetworks.com` — Model Security (`/aims`), Red Teaming, management APIs',
          '`*.pkg.dev`, `pypi.org`, `files.pythonhosted.org` — installing the Model Security client',
          '`aigw.portkey.ai` — the SaaS AI Gateway',
          '`registry.ai-red-teaming.paloaltonetworks.com` — the Red Teaming network-channel client images',
        ],
      },
    ],
  },
]
