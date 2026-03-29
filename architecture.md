# SUDO AIRS Demo — Architecture

**Created by Sergei (SUDO) Udovenko, Palo Alto Networks**

---

## Purpose

An interactive security demonstration that shows how **Prisma AI Runtime Security (AIRS)** protects AI applications across four attack surfaces. Users can toggle AIRS protection on and off in real time to see the difference between a vulnerable and a secured AI deployment.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS v3, Framer Motion, Lucide React |
| Proxy / API gateway | Node.js, Express 4 |
| Model scanner | Python 3.12, FastAPI, Uvicorn |
| LLM — Google | Vertex AI (`@google-cloud/vertexai`) — Gemini family |
| LLM — AWS | Bedrock Runtime (`@aws-sdk/client-bedrock-runtime`) — Anthropic Claude family |
| AI Security | Prisma AIRS REST API (`/v1/scan/sync/request`) |
| Model security | Prisma AIRS Model Security SDK (`model-security-client`) |
| Red Teaming | Prisma AIRS Red Team API (mgmt-plane + data-plane via OAuth2) |

---

## Process Topology

Three processes start together via `npm run dev` (using `concurrently`):

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│                   localhost:5173                        │
└────────────┬───────────────────────┬────────────────────┘
             │ /api/*                │ /scan-model
             ▼                       ▼
┌────────────────────┐   ┌──────────────────────────────┐
│  Node.js Express   │   │  Python FastAPI (Uvicorn)    │
│   server.js        │   │  scanner_server.py           │
│   port 3001        │   │  port 8001                   │
└───────┬────────────┘   └──────────────┬───────────────┘
        │                               │
   ┌────┴────┐                 ┌────────┴────────┐
   │Vertex AI│  AWS Bedrock    │  AIRS Model     │
   │(GCP)    │  (us-west-2)    │  Security SDK   │
   └─────────┘  └─────────┘   └─────────────────┘
        │
   Prisma AIRS REST API
   Prisma AIRS Red Team API
```

- The browser **never calls cloud services directly** — all credentials stay server-side.
- Vite proxies `/api/*` → port 3001 and `/scan-model` → port 8001.
- The Python scanner starts in **stub mode** (returns 503) if credentials or the SDK are missing, so `npm run dev` never fails.
- Default AWS region is **us-west-2** (changed from us-east-1).

---

## Pillar 1 — API Intercept

Simulates prompt injection, jailbreak, and data exfiltration attacks against live LLM endpoints.

### Request flow (AIRS enabled)

```
Browser
  │  POST /api/chat
  │  { message, backend, modelId, airsEnabled: true }
  ▼
server.js
  │
  ├─ 1. airscan(prompt)
  │       POST /v1/scan/sync/request  →  Prisma AIRS
  │       ← { action, category, verdict, scan_id, tr_id, ... }
  │
  ├─ 2a. If action == "block"  →  skip LLM call
  │
  ├─ 2b. If action == "allow"
  │       ├─ callVertexAI(prompt, modelId)   OR
  │       └─ callBedrock(prompt, modelId)
  │           ← { text, latencyMs, tokens, finishReason }
  │
  ├─ 3. airscan(prompt, response)    ← response scan
  │       POST /v1/scan/sync/request  →  Prisma AIRS
  │
  └─ 4. buildTelemetry(...)
         ← { summary, inputScan, outputScan, timing, llm, chatResponse }

Browser
  ├─ Renders chatResponse in chat bubble
  ├─ Renders telemetry in resizable sidebar
  └─ Builds SCM deep-link from tr_id / profile_id / scan_id
```

### Request flow (AIRS disabled)

```
Browser → POST /api/chat { airsEnabled: false }
  → server.js: callVertexAI / callBedrock directly
  ← { chatResponse, summary: null, inputScan: null, outputScan: null }
```

### Bedrock model ID handling

Claude 4.x models require cross-region inference profile IDs (`us.anthropic.*`) and use `ConverseCommand`. The server automatically retries with the `us.` prefix if a direct ID returns "on-demand throughput not supported". Claude 3.x models work with direct IDs.

---

## Pillar 2 — Model Scanning

Scans AI model artifacts for embedded malware, backdoors, pickle exploits, and unsafe tensor serialisation before deployment.

### Request flow

```
Browser
  │  POST /scan-model  (multipart file  OR  { hf_uri: "org/model" })
  ▼
scanner_server.py  (port 8001)
  │
  ├─ Validates input (HuggingFace URI or local file upload)
  ├─ Calls model_security_client.ModelSecurityAPIClient
  │     → Prisma AIRS Model Security cloud API
  └─ Returns scan results (rule violations, CVE matches, verdict)

Browser  →  VulnerabilityReport component
```

The scanner authenticates with Palo Alto Networks OAuth2 (`MODEL_SECURITY_CLIENT_ID` / `CLIENT_SECRET`) to obtain a short-lived token, then submits the model to the designated scan group (`LOCAL_SCAN_GROUP_UUID` or `HF_SCAN_GROUP_UUID`).

---

## Pillar 3 — Red Teaming

Runs automated adversarial campaigns against live AI targets via the **Prisma AIRS Red Team API** (not simulated). Tracks scan status, attack logs, and robustness scores in real time.

### Implementation

`RedTeamingView.jsx` manages campaign state locally and calls the real `/api/redteam/*` endpoints. The Express server proxies all requests to the Prisma Red Team API using OAuth2 client-credentials tokens (`MODEL_SECURITY_CLIENT_ID` / `CLIENT_SECRET`).

### Server endpoints

| Endpoint | Description |
|---|---|
| `GET /api/redteam/targets` | List registered attack targets |
| `POST /api/redteam/targets` | Register a new target |
| `GET /api/redteam/targets/:id` | Get target details |
| `POST /api/redteam/scan` | Launch a scan campaign |
| `GET /api/redteam/scan` | List scan jobs |
| `GET /api/redteam/scan/:id` | Poll scan status |
| `POST /api/redteam/scan/:id/abort` | Abort a running scan |
| `GET /api/redteam/scan/:id/report` | Fetch final report |
| `GET /api/redteam/scan/:id/attacks` | Fetch individual attack results |

### Red Team proxy endpoint

`POST /api/redteam/proxy` — thin wrapper that accepts `{ prompt, model, backend }` and returns `{ reply: "..." }`. Used to register the demo portal itself as a Red Team attack target, matching the `{ "reply": "{RESPONSE}" }` response shape the Prisma Red Team API expects.

### AWS IT Helpdesk chatbot target (`aws-chatbot-target/`)

A separate deployable Red Team target — a deliberately unguarded IT Helpdesk chatbot running on **AWS Lambda + API Gateway**, deployed via AWS SAM. Persona: ACME Corp IT Helpdesk Assistant with implied access to internal systems.

- **Deploy:** `cd aws-chatbot-target && bash deploy.sh` (~2 min)
- **Runtime:** Python, Claude 3 Haiku via Bedrock (us-east-1), 1024 MB Lambda
- **Auth:** API Gateway API key (printed on deploy)
- **Request shape:** `{ "message": "{INPUT}" }` / **Response path:** `$.response`
- **Teardown:** `aws cloudformation delete-stack --stack-name sudo-airs-chatbot --region us-east-1`

---

## Pillar 4 — IDE Protection (Claude Code Hooks)

Intercepts AI-generated code at write time using **Claude Code hooks** (`PreToolUse` on `Write`/`Edit` events). Every file write triggers a Prisma AIRS scan; insecure code is flagged or blocked before it touches the filesystem.

### Implementation

`ClaudeHooksView.jsx` renders `public/hooks-guide.html` in a full-screen iframe. The guide walks through hook configuration, the scan shell script, and example block events. No backend calls — the hooks run inside the user's Claude Code environment, not the demo server.

---

## Frontend Architecture

### State management

Global state lives in `AppContext` (React `useReducer`). No external state library.

| State field | Type | Purpose |
|---|---|---|
| `isProtected` | boolean | Toggles AIRS scanning and the visual theme |
| `activeView` | string | Which pillar is shown (`home`, `apiIntercept`, `modelScanning`, `redTeaming`, `claudeHooks`) |
| `scmUrl` | string \| null | SCM deep-link, set after each AIRS scan |

### Theme system

`useProtectionTheme()` is the **single source of truth** for all colours. Every component calls this hook. Colours shift between red (vulnerable) and emerald/blue (secured) based on `isProtected`. Colours are never hardcoded in components.

### Hook responsibilities

| Hook | Responsibility |
|---|---|
| `useProtectionTheme()` | Returns Tailwind class strings for the current protection state |
| `useAttackSimulator()` | Chat message state, `/api/chat` calls, SCM URL dispatch |
| `useScanner()` | Scan state machine (`idle → scanning → complete`) for Model Scanning |

### View layout

| View | Layout |
|---|---|
| **Home** | Full-screen landing page (outside `MainLayout`, no sidebar). Three pillar cards navigate to each feature. |
| **API Intercept** | 3-column — 260 px attack library + flex chat + resizable telemetry sidebar (drag handle) |
| **Model Scanning** | 2-column — 340 px model registry + flex scanner panel |
| **Red Teaming** | 2-column — 340 px campaign builder + flex log feed + gauge |
| **IDE Protection** | Full-width iframe rendering `public/hooks-guide.html` |

---

## Environment Variables

### Prisma AIRS

| Variable | Description |
|---|---|
| `AIRS_API_KEY` | API key from SCM → AI Security → API Applications |
| `AIRS_PROFILE_NAME` | Security profile name |
| `AIRS_BASE_URL` | Regional scan endpoint (US / EU / India / Singapore) |

### Google Vertex AI

| Variable | Description |
|---|---|
| `GCP_PROJECT_ID` | GCP project ID |
| `GCP_REGION` | Vertex AI region (e.g. `us-central1`) |
| `VERTEX_MODEL` | Default model ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON (or use ADC) |

### AWS Bedrock

| Variable | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM access key (`ASIA…` = STS temporary) |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `AWS_SESSION_TOKEN` | Required when using STS temporary credentials |
| `AWS_REGION` | Bedrock region (default `us-west-2`) |
| `BEDROCK_MODEL_ID` | Default model ID |

### Model Scanner & Red Teaming

| Variable | Required | Description |
|---|---|---|
| `MODEL_SECURITY_CLIENT_ID` | Yes | OAuth2 client ID (model scanner + red team) |
| `MODEL_SECURITY_CLIENT_SECRET` | Yes | OAuth2 client secret |
| `TSG_ID` | Yes | Tenant Service Group ID |
| `LOCAL_SCAN_GROUP_UUID` | Yes | Security group UUID for local / uploaded models |
| `HF_SCAN_GROUP_UUID` | No | Security group UUID for HuggingFace scans (falls back to `LOCAL_SCAN_GROUP_UUID`) |
| `MODEL_SCANNER_PORT` | No | Scanner port (default `8001`) |

### Other

| Variable | Description |
|---|---|
| `PROXY_PORT` | Express server port (default `3001`) |

---

## SCM Deep-link

After each protected scan, `useAttackSimulator` constructs a Strata Cloud Manager URL from the AIRS scan response and stores it in `AppContext.scmUrl`. The sidebar renders a **"View in SCM Console"** button.

```
https://stratacloudmanager.paloaltonetworks.com/ai-security/runtime/ai-sessions/
  {tr_id}/{profile_id}/CITADEL/transactions/{scan_id}/0#date=24hr
```

> The `/CITADEL/` segment is a fixed path in the SCM API and cannot be changed.
