# SUDO AIRS Demo Portal

**Created by Sergei (SUDO) Udovenko, Palo Alto Networks**

An interactive demo portal showing how **Prisma AI Runtime Security (AIRS)** protects AI applications from real-world attacks. Run live LLMs across **Google Vertex AI**, **AWS Bedrock**, and **Azure OpenAI**, route them through a **Portkey AI gateway**, drive **MCP (Model Context Protocol)** tools — and watch AIRS inspect every request and response. Toggle protection on/off to compare a secured vs. vulnerable deployment.

**Nine pillars** cover the AI attack surface end to end: API traffic, the model supply chain, adversarial testing, the LLM gateway, MCP tool-calling, RAG pipelines, the IDE / code assistant, and full observability.

![Home screen](docs/sudo-demo-portal.png)

![API Intercept](docs/sudo-api-intercept-home.png)

![Chat with AIRS](docs/sudo-api-intercept-chat.png)

---

## Pillars

### 1 — API Intercept
Fire curated attacks (prompt injection, jailbreaks, data exfiltration) against a live LLM and watch AIRS scan every request and response in real time. With protection **on**, malicious prompts are blocked before reaching the model; with protection **off**, they pass through unfiltered. Full telemetry panel shows verdict, threat category, latency, and a deep-link to the transaction in Strata Cloud Manager. Switch between Gemini, Claude, GPT, DeepSeek, Grok, and more.

### 2 — Model Scanning
Scan AI model files for embedded threats before deployment — malware, backdoors, pickle exploits, unsafe tensor serialization. Submit a HuggingFace model URI or upload a local file; returns a vulnerability report with CVE matches.
> Requires Model Security credentials. Without them the scanner runs in stub mode.

### 3 — Red Teaming
Run automated adversarial campaigns (DAN variants, role-play escapes, multi-turn manipulation) against a target model via the Palo Alto Red Team API, and track robustness over time on a live score gauge. Post-campaign report renders a severity donut + compliance bars.

### 4 — AI/LLM Gateway *(Portkey + AIRS)*
Build an AI app the modern way: route models through the **Portkey** gateway with **Prisma AIRS** attached as a guardrail. A five-tab pillar:
- **Overview** — what an LLM gateway is, an at-a-glance architecture diagram, and the three flows.
- **Scenarios** — one-click runs of the same prompt through **3 lanes** (No gateway → Portkey native guardrails → Portkey + AIRS), grouped by Baseline / Business & Data Policy / AI-Native Threats, with editable prompts.
- **Live Demo** — free-form streaming chat with a per-request guardrail switch + live pipeline trace + a "3 lanes" comparison.
- **MCP Registry** — agentic **CoinGecko** tool-calling routed through the **Portkey MCP Registry** (`search_docs` → `execute`), with a collapsible chain-of-thought timeline and an optional **AIRS edge-protection toggle**.
- **Integration Guide** — curl / Node / Python walkthroughs.

The story: Portkey's native guardrails enforce **business/data policy** (PII redaction, banned terms, code), while AIRS catches the **AI-native threats** (prompt injection, jailbreak, DLP, malicious URLs) that regex/PII checks miss.

### 5 — AI Code Assistant Protection
Protect the **Claude Code CLI** with Prisma AIRS hook scripts — zero changes to the app. Hooks intercept every surface: user prompts, URLs fetched, MCP tool calls, and tool responses.

### 6 — MCP Security
Live MCP server demo with 5 real tools (file read, web fetch, code execution, memory). Every tool invocation is scanned by AIRS **before** execution (Stage 1) and **after** (Stage 2) using the `tool_event` object — detecting prompt injection, malicious URLs, code injection, and data exfiltration across 10 OWASP MCP Top-10 scenarios.

### 7 — RAG Security
Simulate a full Retrieval-Augmented Generation pipeline over a mock vector DB. AIRS intercepts the augmented prompt **upstream** (before the LLM) and the response **downstream** (before the user) — catching indirect prompt injection hidden in retrieved documents and PII leaking in output.

### 8 — LLM Telemetry / Observability
Full observability layer that captures every prompt and response as a structured trace: latency, token usage, threat-detection rates, AIRS overhead, and a searchable prompt-history log.

### 9 — Developer Corner
Complete Prisma AIRS integration reference for dev teams — Python SDK, REST API, live code samples extracted from this portal, and a full API explorer with all fields and error codes.

> Also included: a live **Release Notes** feed that scrapes Palo Alto's "New Features" docs, and an optional weekly **Slack notifier** for new AIRS features.

---

## Protection model

The sidebar toggle switches most pillars between two modes:

| Mode | What happens | Theme |
|------|-------------|-------|
| **Protected** | AIRS scans every prompt + response | Emerald / blue |
| **Unprotected** | LLM called directly, no scanning | Red |

The **AI/LLM Gateway** pillar is per-request instead (each lane / toggle chooses its own protection), so it ignores the global toggle. All credentials stay server-side — the browser never touches cloud APIs directly.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| npm | 9+ |
| Python | 3.10+ |

You need credentials only for the providers/features you want to use — each pillar is independent and the app degrades gracefully (setup screen / stub mode) when a credential is missing.

---

## Setup

### 1. Clone & install
```bash
git clone https://github.com/sergeiudo/sudo-airs-demo-portal.git
cd sudo-airs-demo-portal
npm install
```

### 2. Python environments
```bash
# Model scanner (required even without Model Scanner creds — runs as a stub)
python3 -m venv airs-model-scanner-main/.venv
airs-model-scanner-main/.venv/bin/pip install fastapi "uvicorn[standard]" requests python-dotenv python-multipart

# MCP Security demo server
bash setup-mcp.sh
```

### 3. Configure `.env`
```bash
cp .env.example .env
```

#### Prisma AIRS *(required for protection mode)*
From [Strata Cloud Manager](https://stratacloudmanager.paloaltonetworks.com) → AI Security:
```
AIRS_API_KEY=
AIRS_PROFILE_NAME=
AIRS_BASE_URL=        # https://service.api.aisecurity.paloaltonetworks.com
```

#### Google Vertex AI
```
GCP_PROJECT_ID=
GCP_REGION=           # e.g. us-central1  (note: gemini-3.x models are global-only)
VERTEX_MODEL=         # e.g. gemini-2.5-flash
GOOGLE_APPLICATION_CREDENTIALS=   # path to service account JSON
```
Or run `gcloud auth application-default login`.

#### AWS Bedrock
```
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=    # required if key starts with ASIA (STS temporary creds)
AWS_REGION=           # e.g. us-east-1
BEDROCK_MODEL_ID=     # e.g. us.anthropic.claude-sonnet-4-20250514-v1:0
```
> Claude 4.x models require cross-region inference profile IDs (`us.anthropic.*`). Claude 3.x uses direct IDs.

#### Azure OpenAI
```
AZURE_OPENAI_ENDPOINT=        # https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_API_VERSION=     # 2025-04-01-preview
AZURE_OPENAI_DEPLOYMENT=      # default deployment name
```
Add Foundry deployments to `AZURE_DEPLOYMENTS` in `server.js`.

#### Portkey AI/LLM Gateway *(required for the AI/LLM Gateway pillar)*
Create the integration, guardrails, configs and a service key in your Portkey workspace, then:
```
PORTKEY_API_KEY=              # service key — MUST have "Allow Config Override" = ON
PORTKEY_CONFIG_AIRS=          # Portkey config whose guardrail is PANW Prisma AIRS
PORTKEY_CONFIG_DEFAULTS=      # Portkey config with native guardrails (PII / code / words)
PORTKEY_CONFIG_NO_GUARDRAIL=  # vestigial — the no-gateway lane bypasses Portkey (direct provider)
PORTKEY_CONFIG_FALLBACK=      # optional fallback chain
PORTKEY_VERTEX_SLUG=@your-vertex-integration
PORTKEY_BEDROCK_SLUG=         # optional
```
> The MCP Registry tab also needs an MCP server registered in your Portkey **MCP Registry** (the demo uses CoinGecko). A full annotated walkthrough — integration, keys, guardrails, configs, the 3 flows, and the MCP flow — lives in [`docs/portkey-setup-deck.html`](docs/portkey-setup-deck.html) (open in a browser).

#### Model Scanner *(optional)*
```
MODEL_SECURITY_CLIENT_ID=
MODEL_SECURITY_CLIENT_SECRET=
TSG_ID=
LOCAL_SCAN_GROUP_UUID=
```
Then run once: `bash setup-scanner.sh`

### 4. Run
```bash
npm run dev
```
Starts four processes: **Vite** frontend (`5173`), **Express** proxy (`3001`), **Python scanner** (`8001`), and the **MCP server** (`8002`). Visit **http://localhost:5173**.

---

## Troubleshooting

**Blank page / no API response** — stale processes on ports. Kill and restart:
```bash
lsof -ti tcp:3001 | xargs kill -9 2>/dev/null; lsof -ti tcp:5173 | xargs kill -9 2>/dev/null; lsof -ti tcp:8001 | xargs kill -9 2>/dev/null; lsof -ti tcp:8002 | xargs kill -9 2>/dev/null
npm run dev
```

**AWS "on-demand throughput not supported"** — use a `us.anthropic.*` inference profile ID for Claude 4.x.

**AWS auth error with ASIA keys** — export `AWS_SESSION_TOKEN` before `npm run dev`.

**Vertex AI 404** — enable the model in GCP Console → Vertex AI → Model Garden first. `gemini-3.x` models are only available in the `global` region.

**Azure "deployment does not exist"** — the name in `AZURE_DEPLOYMENTS` must match Foundry exactly (case-sensitive). Use API version `2025-04-01-preview`.

**AI/LLM Gateway pillar shows a setup screen** — `PORTKEY_API_KEY` is missing. If lanes don't switch, the key needs **Allow Config Override = ON**. If a model errors with `model_not_allowed`, provision it in both Portkey (Model Provisioning) **and** Vertex.

---

## License

Apache License 2.0 — free to use, modify, and distribute. See [LICENSE](LICENSE).

## Disclaimer

This is an independent, community-driven open source project. It is **not affiliated with, endorsed by, or sponsored by Palo Alto Networks**.

This project builds on top of the official **Palo Alto Networks Prisma AIRS (AI Runtime Security)** API, which is an excellent foundation for securing AI applications at runtime. We are grateful to the Palo Alto Networks team for creating and maintaining Prisma AIRS and the Strata Cloud Manager platform.

Prisma AIRS itself is **not included in this repository** — you must obtain your own Prisma AIRS deployment profile and API key separately from Palo Alto Networks.

**Trademarks:** Palo Alto Networks, Prisma, Prisma AIRS, Strata, and Strata Cloud Manager are trademarks of Palo Alto Networks, Inc. All other trademarks — including Portkey, Google Cloud, Vertex AI, Gemini, Amazon Web Services, Amazon Bedrock, Anthropic, Claude, Azure, and CoinGecko — are the property of their respective owners.
