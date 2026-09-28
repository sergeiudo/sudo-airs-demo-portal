/**
 * links.js — every official URL the Developer Corner cites, in one place.
 * Checked on 2026-09-28: each returned HTTP 200. Several links that the SDK
 * README, its PyPI metadata and older pan.dev pages still carry return 404
 * today (e.g. pan.dev/prisma-airs/scan/api/) — they are deliberately absent.
 */
export const L = {
  // pan.dev — AI Runtime (API intercept)
  pandev:        { title: 'pan.dev · Prisma AIRS', url: 'https://pan.dev/airs/', source: 'pandev', what: 'Developer landing page for every Prisma AIRS API.' },
  rtOverview:    { title: 'AI Runtime API — overview', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/airuntimesecurityapi/', source: 'pandev', what: 'Authentication, regional endpoints and limits.' },
  rtSync:        { title: 'Scan — synchronous request', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/scan/scan-sync-request/', source: 'pandev', what: 'POST /v1/scan/sync/request — schema and examples.' },
  rtAsync:       { title: 'Scan — asynchronous request', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/scan/scan-async-request/', source: 'pandev', what: 'POST /v1/scan/async/request — batch scans.' },
  rtResults:     { title: 'Scan results by scan IDs', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/scan/get-scan-results-by-scan-i-ds/', source: 'pandev', what: 'GET /v1/scan/results — poll async verdicts.' },
  rtReports:     { title: 'Threat scan reports', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/scan/get-threat-scan-reports/', source: 'pandev', what: 'GET /v1/scan/reports — per-service detection detail.' },
  rtErrors:      { title: 'Error codes', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/errorcodes/', source: 'pandev', what: 'HTTP codes, and the 10-per-minute results/reports limit.' },
  rtUseCases:    { title: 'Use cases (per detector)', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/usecases/', source: 'pandev', what: 'cURL and Python per detection service; language support.' },
  sdkOverview:   { title: 'Python SDK — overview', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/pythonsdk/', source: 'pandev', what: 'Supported Python versions, exceptions.' },
  sdkUsage:      { title: 'Python SDK — usage', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/pythonsdkusage/', source: 'pandev', what: 'Sync, batch, results and reports examples.' },
  sdkAsyncio:    { title: 'Python SDK — asyncio usage', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/pythonsdkasynciousage/', source: 'pandev', what: 'The same calls with asyncio.' },
  rbac:          { title: 'RBAC for the AIRS APIs', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/oauth-based-authentication/', source: 'pandev', what: 'Superuser, view-only and custom airs_api.* permissions.' },
  mgmtApi:       { title: 'Management API — overview', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/prismaairsmanagementapi/', source: 'pandev', what: 'Create profiles, keys and custom topics from code.' },
  scanOauth:     { title: 'OAuth token for the Scan API', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/management/get-apigee-oauth-token/', source: 'pandev', what: 'POST /v1/mgmt/oauth/client_credential/accesstoken.' },
  mgmtSdk:       { title: 'Management Python SDK', url: 'https://pan.dev/prisma-airs/api/airuntimesecurity/management/mgmt-python-sdk/', source: 'pandev', what: 'pan-airs-api-mgmt-sdk.' },
  scanSpec:      { title: 'Scan API OpenAPI spec (raw)', url: 'https://raw.githubusercontent.com/PaloAltoNetworks/pan.dev/master/openapi-specs/prisma-airs/scan/scan-service_latest.yaml', source: 'github', what: 'Full request/response schemas — generate a client from it.' },
  scmTokens:     { title: 'SCM access tokens', url: 'https://pan.dev/scm/docs/access-tokens/', source: 'pandev', what: 'OAuth2 client credentials; tokens live 15 minutes.' },

  // pan.dev — Model Security, Red Teaming
  msApi:         { title: 'AI Model Security API — overview', url: 'https://pan.dev/prisma-airs-model-security/api/aisecuritymodel/aisecuritymodel/', source: 'pandev', what: 'Base URL /aims, data and management planes, pagination.' },
  msSdk:         { title: 'Model Security SDK and CLI', url: 'https://pan.dev/prisma-airs-model-security/api/aisecuritymodel/sdk-aisecuritymodel/', source: 'pandev', what: 'ModelSecurityAPIClient and the model-security CLI.' },
  msErrors:      { title: 'Model Security error codes', url: 'https://pan.dev/prisma-airs-model-security/api/aisecuritymodel/errorcodes/', source: 'pandev', what: 'HTTP codes and error body.' },
  msListScans:   { title: 'List scans (data plane)', url: 'https://pan.dev/prisma-airs-model-security/api/aisecuritymodel/dataplane/list-scans-v-1-scans-get/', source: 'pandev', what: 'GET /aims/data/v1/scans and its filters.' },
  rtmIntro:      { title: 'AI Red Teaming API — introduction', url: 'https://pan.dev/prisma-airs-redteam/api/ai-integration/introduction/', source: 'pandev', what: 'Base URLs and OAuth bearer auth.' },
  rtmOverview:   { title: 'AI Red Teaming API — overview', url: 'https://pan.dev/prisma-airs-redteam/api/ai-integration/aiintegration/', source: 'pandev', what: 'Data, management and network-broker planes.' },
  rtmCreateScan: { title: 'Create a red-teaming scan', url: 'https://pan.dev/prisma-airs-redteam/api/ai-integration/data-plane/create-job-v-1-scan-post/', source: 'pandev', what: 'POST /v1/scan.' },
  rtmCreateTgt:  { title: 'Create a red-teaming target', url: 'https://pan.dev/prisma-airs-redteam/api/ai-integration/management/create-target-v-1-target-post/', source: 'pandev', what: 'POST /v1/target.' },
  rtmChannels:   { title: 'Network channels API', url: 'https://pan.dev/prisma-airs-redteam/api/ai-integration/network-broker/networkchannel/', source: 'pandev', what: 'Reach private targets without inbound ports.' },
  rtmErrors:     { title: 'Red Teaming error codes', url: 'https://pan.dev/prisma-airs-redteam/api/ai-integration/errorcodes/', source: 'pandev', what: 'Including QUOTA_EXCEEDED and EULA-not-accepted.' },

  // docs.paloaltonetworks.com
  docsHub:       { title: 'Prisma AIRS documentation', url: 'https://docs.paloaltonetworks.com/prisma-airs', source: 'docs', what: 'The product documentation hub.' },
  pdfRuntime:    { title: 'AI Runtime Security guide (PDF)', url: 'https://docs.paloaltonetworks.com/content/dam/techdocs/en_US/pdf/prisma-airs/prisma-airs-ai-runtime-security.pdf', source: 'docs', what: 'API intercept onboarding, security profiles, rate limits, MCP threat detection, network intercept.' },
  pdfGateway:    { title: 'AI Gateway guide (PDF)', url: 'https://docs.paloaltonetworks.com/content/dam/techdocs/en_US/pdf/prisma-airs/ai-gateway.pdf', source: 'docs', what: 'The whole SCM AI Gateway admin guide.' },
  pdfAgentId:    { title: 'AI Agent Identity guide (PDF)', url: 'https://docs.paloaltonetworks.com/content/dam/techdocs/en_US/pdf/prisma-airs/ai-agent-identity.pdf', source: 'docs', what: 'Includes the Prisma AIRS MCP server.' },
  pdfSupply:     { title: 'AI Supply Chain Security guide (PDF)', url: 'https://docs.paloaltonetworks.com/content/dam/techdocs/en_US/pdf/prisma-airs/ai-supply-chain-security.pdf', source: 'docs', what: 'Model Security and Skill Security.' },
  pdfRedTeam:    { title: 'AI Red Teaming guide (PDF)', url: 'https://docs.paloaltonetworks.com/content/dam/techdocs/en_US/pdf/prisma-airs/ai-red-teaming.pdf', source: 'docs', what: 'Targets, network channels, the Adapter SDK, reports.' },
  gwOverview:    { title: 'AI Gateway overview', url: 'https://docs.paloaltonetworks.com/prisma-airs/ai-gateway/ai-gateway-overview', source: 'docs', what: 'What it is; SaaS and Hybrid deployment.' },
  gwDeploy:      { title: 'Deploy the AI Gateway', url: 'https://docs.paloaltonetworks.com/prisma-airs/ai-gateway/deploy-ai-gateway', source: 'docs', what: 'SaaS endpoint; Hybrid data plane with Helm.' },
  gwKeys:        { title: 'Manage gateway API keys', url: 'https://docs.paloaltonetworks.com/prisma-airs/ai-gateway/ai-gateway-configs/manage-gateway-api-keys', source: 'docs', what: 'Key roles, default configs, inline-config blocking.' },
  gwConfigs:     { title: 'Gateway configs', url: 'https://docs.paloaltonetworks.com/prisma-airs/ai-gateway/ai-gateway-configs', source: 'docs', what: 'pc- configs: routing, fallback, retries, cache, guardrails.' },
  gwGuardrails:  { title: 'Gateway guardrails', url: 'https://docs.paloaltonetworks.com/prisma-airs/ai-gateway/ai-gateway-guardrails', source: 'docs', what: 'pg- guardrails: basic, PRO and partner tiers.' },
  gwAirsGuard:   { title: 'Configure the AI Runtime API guardrail', url: 'https://docs.paloaltonetworks.com/prisma-airs/ai-gateway/ai-gateway-guardrails/configure-ai-runtime-api-guardrail', source: 'docs', what: 'Wire Prisma AIRS into the gateway as a guardrail.' },
  msInstall:     { title: 'Install AI Model Security', url: 'https://docs.paloaltonetworks.com/ai-runtime-security/ai-model-security/model-security-to-secure-your-ai-models/get-started-with-ai-model-security/install-ai-model-security', source: 'docs', what: 'Private index script, environment variables, requirements.' },
  msScanning:    { title: 'Scanning models', url: 'https://docs.paloaltonetworks.com/ai-runtime-security/ai-model-security/model-security-to-secure-your-ai-models/get-started-with-ai-model-security/scanning-models', source: 'docs', what: 'Hugging Face, local and object-storage scans; options.' },

  // Prisma AIRS AI Gateway developer docs (hosted by Portkey)
  gwDevSetup:    { title: 'AI Gateway developer docs — simple setup', url: 'https://docs.portkey.ai/docs/aigw/introduction/simple-setup', source: 'other', what: 'Prisma AIRS-branded developer docs: base URL, auth, first call.' },
  gwDevJwt:      { title: 'AI Gateway — JWT authentication', url: 'https://docs.portkey.ai/docs/aigw/product/enterprise-offering/org-management/jwt', source: 'other', what: 'JWKS, RS256, required claims.' },
  gwDevGuard:    { title: 'AI Gateway — PANW Prisma AIRS guardrail', url: 'https://docs.portkey.ai/docs/aigw/integrations/guardrails/palo-alto-panw-prisma', source: 'other', what: 'Guardrail parameters: profile, scan scope, strip scaffolding.' },
  gwDevMcp:      { title: 'AI Gateway — MCP gateway', url: 'https://docs.portkey.ai/docs/aigw/product/mcp-gateway/using-mcp-servers', source: 'other', what: 'Connect MCP servers through the gateway.' },
  gwSpec:        { title: 'AI Gateway OpenAPI spec (raw)', url: 'https://raw.githubusercontent.com/PaloAltoNetworks/openapi/refs/heads/main/openapi.yaml', source: 'github', what: 'Inference and admin API paths.' },

  // Packages and repos
  pypiSdk:       { title: 'pan-aisecurity on PyPI', url: 'https://pypi.org/project/pan-aisecurity/', source: 'pypi', what: 'The official Runtime API Python SDK.' },
  pypiMgmt:      { title: 'pan-airs-api-mgmt-sdk on PyPI', url: 'https://pypi.org/project/pan-airs-api-mgmt-sdk/', source: 'pypi', what: 'Management API Python SDK.' },
  pypiRelay:     { title: 'pan-mcp-relay on PyPI', url: 'https://pypi.org/project/pan-mcp-relay/', source: 'pypi', what: 'Local MCP security relay.' },
  ghSdk:         { title: 'aisecurity-python-sdk', url: 'https://github.com/PaloAltoNetworks/aisecurity-python-sdk', source: 'github', what: 'SDK source and examples (traditional, asyncio, MCP server).' },
  ghMgmt:        { title: 'airs-api-mgmt-sdk', url: 'https://github.com/PaloAltoNetworks/airs-api-mgmt-sdk', source: 'github', what: 'Management SDK source.' },
  ghRelay:       { title: 'pan-mcp-relay', url: 'https://github.com/PaloAltoNetworks/pan-mcp-relay', source: 'github', what: 'MCP relay source and configuration.' },
  ghIntegrations:{ title: 'prisma-airs-integrations', url: 'https://github.com/PaloAltoNetworks/prisma-airs-integrations', source: 'github', what: 'LiteLLM, Kong, Apigee, Azure APIM, AWS, n8n, coding-assistant hooks, CI examples.' },
  ghGwDocker:    { title: 'airs-ai-gateway-docker', url: 'https://github.com/PaloAltoNetworks/airs-ai-gateway-docker', source: 'github', what: 'Hybrid gateway data plane with Docker Compose.' },
  ghRtClient:    { title: 'ai-redteam-network-client-docker', url: 'https://github.com/PaloAltoNetworks/ai-redteam-network-client-docker', source: 'github', what: 'Red Teaming network-channel client installer.' },
  ghN8n:         { title: 'n8n-nodes-prisma-airs', url: 'https://github.com/PaloAltoNetworks/n8n-nodes-prisma-airs', source: 'github', what: 'Official n8n community node.' },
  ghNemo:        { title: 'airs-nemo-guardrails', url: 'https://github.com/PaloAltoNetworks/airs-nemo-guardrails', source: 'github', what: 'NVIDIA NeMo Guardrails custom action.' },
  ghRag:         { title: 'airs-api-intercept-rag-app', url: 'https://github.com/PaloAltoNetworks/airs-api-intercept-rag-app', source: 'github', what: 'Sample RAG app on Bedrock with API intercept.' },
  litellm:       { title: 'LiteLLM — PANW Prisma AIRS guardrail', url: 'https://docs.litellm.ai/docs/proxy/guardrails/panw_prisma_airs', source: 'other', what: 'Native guardrail in the LiteLLM proxy.' },
  kong:          { title: 'Kong — Prisma AIRS API Intercept plugin', url: 'https://developer.konghq.com/plugins/prisma-airs-intercept/', source: 'other', what: 'Kong Plugin Hub entry.' },
}

export const pick = (...keys) => keys.map((k) => L[k]).filter(Boolean)
