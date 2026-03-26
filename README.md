# SUDO AIRS Demo Portal

**Created by Sergei (SUDO) Udovenko, Palo Alto Networks**

An interactive demo portal showing how **Prisma AI Runtime Security (AIRS)** protects AI applications from real-world attacks. Toggle protection on/off to see the difference between a secured and vulnerable deployment — using live LLMs across **Google Vertex AI**, **AWS Bedrock**, and **Azure OpenAI**.

![Home screen](docs/sudo-demo-portal.png)

![API Intercept](docs/sudo-api-intercept-home.png)

![Chat with AIRS](docs/sudo-api-intercept-chat.png)

---

## Four Pillars

### 1 — API Intercept
Fire curated attacks (prompt injection, jailbreaks, data exfiltration) against a live LLM and watch AIRS scan every request and response in real time. With protection **on**, malicious prompts are blocked before reaching the model. With protection **off**, attacks pass through unfiltered. Full telemetry panel shows scan verdict, threat category, latency, and a direct link to the transaction in Strata Cloud Manager.

Supports all three cloud backends — switch between Gemini, Claude, GPT, DeepSeek, Grok, and more.

### 2 — Model Scanning
Scan AI model files for embedded threats before deployment — malware, backdoors, pickle exploits, unsafe tensor serialization. Submit a HuggingFace model URI or upload a local file. Returns a full vulnerability report with CVE matches.

> Requires Model Security credentials. Without them the scanner runs in stub mode.

### 3 — Red Teaming
Run automated adversarial campaigns (DAN variants, role-play escapes, multi-turn manipulation) against a target model and track robustness over time via a score gauge.

> Campaign UI is simulated client-side — no extra credentials needed.

### 4 — AI Code Assistant Protection
Shows how to protect **Claude Code CLI** with Prisma AIRS hook scripts — zero changes to the app. Four hooks intercept every surface: user prompts, URLs fetched, MCP tool calls, and tool responses.

---

## Protection Toggle

The sidebar toggle switches the entire app between two modes:

| Mode | What happens | Theme |
|------|-------------|-------|
| **Protected** | AIRS scans every prompt + response | Emerald / blue |
| **Unprotected** | LLM called directly, no scanning | Red |

All credentials stay server-side — the browser never touches cloud APIs directly.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| npm | 9+ |
| Python | 3.10+ |

You need accounts and credentials for the cloud providers you want to use. Each section is independent — the app works with any combination.

---

## Setup

### 1. Clone & install

```bash
git clone <repo-url>
cd sudo-airs-local-demo-vertex-bedrock
npm install
```

### 2. Python environment (required even without Model Scanner)

```bash
python3 -m venv airs-model-scanner-main/.venv
airs-model-scanner-main/.venv/bin/pip install fastapi "uvicorn[standard]" requests python-dotenv python-multipart
```

### 3. Configure `.env`

```bash
cp .env.example .env
```

#### Prisma AIRS *(required for protection mode)*
Get from [Strata Cloud Manager](https://stratacloudmanager.paloaltonetworks.com) → AI Security:
```
AIRS_API_KEY=
AIRS_PROFILE_NAME=
AIRS_BASE_URL=        # https://service.api.aisecurity.paloaltonetworks.com
```

#### Google Vertex AI
```
GCP_PROJECT_ID=
GCP_REGION=           # e.g. us-central1
VERTEX_MODEL=         # e.g. gemini-2.0-flash-001
GOOGLE_APPLICATION_CREDENTIALS=   # path to service account JSON
```
Or skip the key file and run `gcloud auth application-default login`.

#### AWS Bedrock
```
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=    # required if key starts with ASIA (STS temporary creds)
AWS_REGION=           # e.g. us-east-1
BEDROCK_MODEL_ID=     # e.g. us.anthropic.claude-opus-4-6-v1:0
```
> Claude 4.x models require cross-region inference profile IDs (`us.anthropic.*`). Claude 3.x uses direct IDs.

#### Azure OpenAI
```
AZURE_OPENAI_ENDPOINT=        # https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_API_VERSION=     # 2025-04-01-preview
AZURE_OPENAI_DEPLOYMENT=      # default deployment name
```
Add your Foundry deployments to `AZURE_DEPLOYMENTS` in `server.js`:
```js
const AZURE_DEPLOYMENTS = [
  { id: 'gpt-5.4-nano',                label: 'GPT-5.4 Nano',  provider: 'OpenAI',   status: 'available' },
  { id: 'DeepSeek-V3.2',               label: 'DeepSeek V3.2', provider: 'DeepSeek', status: 'available' },
  { id: 'grok-4-1-fast-non-reasoning', label: 'Grok 4.1 Fast', provider: 'xAI',      status: 'available' },
]
```

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

Opens three processes: Vite frontend (`5173`), Express proxy (`3001`), Python scanner (`8001`).

Visit **http://localhost:5173**

---

## Troubleshooting

**Blank page / no API response** — stale processes on ports. Kill and restart:
```bash
lsof -ti tcp:3001 | xargs kill -9 2>/dev/null; lsof -ti tcp:5173 | xargs kill -9 2>/dev/null; lsof -ti tcp:8001 | xargs kill -9 2>/dev/null
npm run dev
```

**AWS "on-demand throughput not supported"** — use `us.anthropic.*` inference profile ID for Claude 4.x.

**AWS auth error with ASIA keys** — export `AWS_SESSION_TOKEN` in your shell before `npm run dev`.

**Vertex AI 404** — enable the model in GCP Console → Vertex AI → Model Garden first.

**Azure "deployment does not exist"** — deployment name in `AZURE_DEPLOYMENTS` must match exactly (case-sensitive) what's in Foundry. Use API version `2025-04-01-preview`.
