/**
 * Ask AIRS — what the docs helper knows about each place in this portal.
 * Shared by the server (indexed as "this portal" knowledge; `boost` weights
 * the products a pillar is about) and the client (the drawer's suggestions).
 *
 * PUBLIC: this file ships to the browser and is indexed by a public helper.
 * Never put account ids, tenant ids, profile names, keys or hostnames here.
 *
 * Products: runtime (AI Runtime Security — API intercept, network intercept,
 * MCP threat detection), gateway (AI Gateway), supply (AI Supply Chain —
 * Model Security, skill scanning), redteam (AI Red Teaming), agents (AI Agent
 * Identity, the Prisma AIRS MCP server), portal (this portal's own guides).
 */
export const ASSIST_PRODUCTS = {
  runtime: 'AI Runtime Security',
  gateway: 'AI Gateway',
  supply: 'AI Supply Chain Security',
  redteam: 'AI Red Teaming',
  agents: 'AI Agent Identity',
  portal: 'This portal',
}

export const ASSIST_PILLARS = [
  {
    id: 'home', title: 'Home',
    boost: {},
    demo: 'The portal home: five run-of-show pillars (AIRS Runtime & AI-GW, AI Supply Chain, Red Teaming, Enterprise AI Access, Ministry of Health), deep dives and tools, the Prisma AIRS release wire, AIRS regions and Server status.',
    questions: ['What can Prisma AIRS protect, product by product?', 'What is the difference between API intercept and the AI Gateway?', 'Which AIRS regions exist and how do I pick one?', 'What is new in Prisma AIRS this month?'],
  },
  {
    id: 'apiIntercept', title: 'AIRS Runtime & AI-GW',
    boost: { runtime: 1.5, gateway: 1.3 },
    demo: 'Fires a library of attack payloads at live LLM targets — Vertex AI, Bedrock and Azure OpenAI protected by the AIRS Runtime API at the API layer (a prompt scan before the model, a response scan after it), and the SCM AI Gateway, where the Prisma AIRS guardrail runs inside the gateway. Each fire shows the verdict, the detections and the full telemetry of the call.',
    howto: 'Pick a target, pick an attack from the library (or type a prompt), and fire. Toggle AIRS off to see the unprotected model answer. Open the telemetry drawer for the raw AIRS scan, the report and per-service detections.',
    questions: ['What does each AIRS detection service catch?', 'How do I scan both the prompt and the response?', 'What is the difference between the Runtime API and the AI Gateway guardrail?', 'What are the AIRS API rate limits?'],
  },
  {
    id: 'modelScanning', title: 'AI Supply Chain',
    boost: { supply: 1.6 },
    demo: 'Scans model artifacts for code that runs on load, unsafe serialisation, licence and publisher problems before deployment — from a Hugging Face URI or a local upload — and browses the scan history in Strata Cloud Manager, grouped by the security rule that failed.',
    howto: 'Paste a Hugging Face model URI or upload a model file, run the scan, then open the scan telemetry for every rule, finding and file.',
    questions: ['Which model formats can AI Model Security scan?', 'How do security groups and rules decide a verdict?', 'How do I scan models from S3 or a private registry?', 'How does skill scanning work?'],
  },
  {
    id: 'redTeaming', title: 'Red Teaming',
    boost: { redteam: 1.6 },
    demo: 'Runs automated adversarial campaigns against AI targets across attack categories, tracks the risk score and compares a protected target with an unprotected one.',
    howto: 'Choose a target and a campaign, start it, and follow the attempts and the report as they arrive.',
    questions: ['How do I add a target for AI Red Teaming?', 'What attack categories does AI Red Teaming cover?', 'How do network channels reach a private target?', 'How is the red-teaming risk score calculated?'],
  },
  {
    id: 'enterpriseAccess', title: 'Enterprise AI Access',
    boost: { gateway: 1.5, agents: 1.1 },
    demo: 'Users sign in with Entra ID; the portal mints a short-lived RS256 JWT and the SCM AI Gateway routes each request by the user\'s role — no gateway API key in the browser. Tamper tests show what the gateway refuses.',
    howto: 'Sign in, pick a model your role is or is not allowed, and compare which model answers; open the token artifacts and run the tamper tests.',
    questions: ['Which JWT claims does the AI Gateway require?', 'How does identity-based routing work in the AI Gateway?', 'How do I rotate the JWT signing keys?', 'Can a user override the config bound to their JWT?'],
  },
  {
    id: 'ministryHealth', title: 'Ministry of Health',
    boost: { gateway: 1.3, runtime: 1.3 },
    demo: 'A bilingual (Hebrew/English) health assistant built for an RFI: every model turn goes through the SCM AI Gateway with the Prisma AIRS guardrail, and every tool call is also scanned with AIRS tool_event scans; citizen file uploads are scanned too.',
    questions: ['How does AIRS detect sensitive data such as national ID numbers?', 'What is a tool_event scan?', 'How do custom topics work in an AIRS security profile?', 'Which languages does AIRS detection support?'],
  },
  {
    id: 'developerCorner', title: 'Developer Corner',
    boost: { portal: 1.1 },
    demo: 'Integration guides for every Prisma AIRS product — the Runtime API, agents and MCP, the AI Gateway, Model Security, Red Teaming, network intercept — with code in five languages, live calls sent from the portal, and a catalog of every AI Gateway doc page.',
    questions: ['How do I make my first AIRS Runtime API scan?', 'How do I route an app through the AI Gateway?', 'How do I create an AI Gateway config with the Prisma AIRS guardrail?', 'How do I deploy the AI Gateway data plane on Kubernetes?'],
  },
  {
    id: 'mcpSecurity', title: 'MCP Security',
    boost: { runtime: 1.4, agents: 1.3, gateway: 1.1 },
    demo: 'A live MCP server with real tools (file read, web fetch, code execution, memory). Every tool call is scanned by Prisma AIRS before it runs (stage 1) and its output after (stage 2), against OWASP-style MCP attack scenarios.',
    questions: ['How do I scan MCP tool calls with AIRS?', 'What MCP threats can AIRS detect?', 'What is the Prisma AIRS MCP server?', 'How does the AI Gateway MCP Gateway control tool access?'],
  },
  {
    id: 'ragSecurity', title: 'RAG Security',
    boost: { runtime: 1.5 },
    demo: 'A simulated retrieval-augmented generation pipeline over a mock vector store: AIRS scans the augmented prompt upstream (before the model) and the answer downstream (before the user), including poisoned documents.',
    questions: ['How do I protect a RAG pipeline with AIRS?', 'Can AIRS detect poisoned or malicious retrieved content?', 'Should I scan the retrieved documents or the final prompt?', 'What does AIRS return when it finds a malicious URL?'],
  },
  {
    id: 'llmGateway', title: 'AI/LLM Gateway (legacy)',
    boost: { gateway: 1.4 },
    demo: 'The original gateway pillar on the legacy Portkey workspace: Vertex and Bedrock models compared in three lanes side by side — no gateway, Portkey-native guardrails, and the Prisma AIRS guardrail.',
    questions: ['How do guardrail actions (deny, async) work in the AI Gateway?', 'What do the 246 and 446 status codes mean?', 'How do fallbacks and retries work in a gateway config?', 'How is semantic caching configured?'],
  },
  {
    id: 'claudeHooks', title: 'AI Code Assistant Protection',
    boost: { runtime: 1.4, agents: 1.1 },
    demo: 'Secures the Claude Code CLI with hook scripts that scan every prompt, URL fetch and MCP tool call with the AIRS Runtime API before content reaches the model — no code changes.',
    questions: ['How do I scan Claude Code prompts and tool calls with AIRS?', 'Can coding agents be routed through the AI Gateway instead?', 'What does a tool_event scan contain?', 'How do I protect Cursor or Codex?'],
  },
  {
    id: 'observability', title: 'LLM Telemetry',
    boost: { runtime: 1.2, gateway: 1.2 },
    demo: 'Live telemetry for every request the portal sends: where it went, what AIRS decided and at which stage, detector families, latency and the cost of protection — streamed as it happens.',
    questions: ['How do I export AI Gateway logs to OpenTelemetry?', 'What fields does an AIRS scan report contain?', 'How do I find a request in Strata Cloud Manager?', 'What does the x-portkey-trace-id header do?'],
  },
  {
    id: 'releaseNotes', title: 'Release notes',
    boost: {},
    demo: 'Every Prisma AIRS feature by month from docs.paloaltonetworks.com, and every AI Gateway release from the Enterprise Gateway changelog, with the full notes.',
    questions: ['What changed in the latest AI Gateway releases?', 'What is new in AI Red Teaming?', 'What is new in AI Model Security?', 'Which gateway version added soft deny?'],
  },
]

export const PILLAR_BY_ID = Object.fromEntries(ASSIST_PILLARS.map((p) => [p.id, p]))
