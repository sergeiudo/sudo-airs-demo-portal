# AI/LLM Gateway Pillar — Design Spec

**Status:** Draft for review
**Author:** Claude + Sergei (SUDO) Udovenko
**Date:** 2026-05-27
**Branch (to be created):** `feat/llm-gateway-pillar`

---

## 1. Purpose & Audience

Add a 9th pillar to the SUDO AIRS demo portal showing how a customer-built AI app can be routed through the **Portkey LLM Gateway** while remaining protected by **Prisma AIRS** (attached as a Portkey Guardrail).

The pillar serves three audiences via three tabs:

| Tab | Audience | Walk-away message |
|---|---|---|
| **Live Demo** | Customer architects evaluating gateways | "This is the modern AI app shape — gateway + observability + AIRS as the security layer." |
| **Detection Showcase** | Customer devs already on Portkey | "AIRS catches what your current Portkey guardrails miss." |
| **Integration Guide** | Devs building from scratch | "Here's curl/Node/Python you can copy into your own app." |

## 2. Identity & Placement

| Field | Value |
|---|---|
| `id` | `llmGateway` |
| Title | AI/LLM Gateway |
| Tag | Gateway Layer |
| Icon | `Network` (lucide) — routing-hub glyph |
| Accent color | `#ec4899` (pink-500) |
| Glow | `rgba(236,72,153,0.32)` |
| Dim | `rgba(236,72,153,0.08)` |
| Summary | One gateway, every model, AIRS-protected. |
| Description | Build an AI app the modern way — route to any Vertex/Bedrock model through Portkey, with Prisma AIRS attached as a guardrail. Side-by-side comparison shows what AIRS catches that Portkey's default guardrails miss. |
| Highlights | Live Portkey gateway · Real AIRS guardrail (`pg-sudo-a-c3bfdd`) · 3-lane detection comparison · Vertex + Bedrock fallback |

**Home grid change:** `4 + 4` → `5 + 4`. Row 1 = `apiIntercept, modelScanning, redTeaming, claudeHooks, llmGateway` with `gridTemplateColumns: 'repeat(5, 1fr)'`. Row 2 unchanged (`observability, developerCorner, mcpSecurity, ragSecurity`).

**Cross-file plumbing** (established pattern from CLAUDE.md):
- `src/views/HomeViewV2.jsx` — add to `PILLARS`; change `slice(0,4)/slice(4)` → `slice(0,5)/slice(5)`; row-1 gridTemplateColumns to `repeat(5, 1fr)`.
- `src/components/Sidebar.jsx` — add to `NAV_ITEMS` with pink color object.
- `src/components/TopBar.jsx` — add to `VIEW_LABELS`.
- `src/components/HelpDrawer.jsx` — add to `VIEWS`.
- `src/App.jsx` — import + switch-case.
- No `NavItem.jsx` lookup-table additions needed — pink already mapped.

## 3. View Layout

Top-level: `LlmGatewayView.jsx` with a tab bar (Live Demo · Detection Showcase · Integration Guide) and a persistent **status strip** above the tabs.

**Status strip content:**
- 🟢 / 🔴 Portkey API reachable · API key OK · `X/4` configs wired
- Live model count from Portkey `/v1/models`
- "Open Portkey console →" external link

### 3.1 Tab 1 — Live Demo (3-column resizable)

| Left (≈260px) — Controls | Center (flex) — Chat | Right (≈380px) — Pipeline + Logs |
|---|---|---|
| **Model picker** — live `/v1/models` from Portkey, grouped by provider | Streaming chat (SSE), token-by-token | Live pipeline trace: `Client → Portkey → AIRS → Vertex → AIRS → back` |
| **Guardrail switch** — `None / Portkey-default / AIRS` | User messages + assistant streamed tokens | Per-message expandable Portkey `hook_results` JSON viewer (before & after) |
| **Fallback toggle** — `Vertex → Bedrock` | Per-message metadata strip: model, latencyMs, tokens, cache `HIT/MISS` badge | "Open in Portkey Logs" deep-link |
| **Cache toggle** — `enabled / disabled` | Suggested-prompts row (1 benign + 3 attack examples) | |

### 3.2 Tab 2 — Detection Showcase (2-column)

- **Left:** curated attack library, ~12–15 prompts grouped by category (Injection · Jailbreak · DLP · Malicious URL · Code Injection). Curated so Portkey-defaults misses **at least 6** items — that's the AIRS differentiation moment.
- **Right:** 3-lane comparison runner:

```
┌─ Lane 1: Vertex (no guardrail) ──┬─ Lane 2: Portkey defaults ──┬─ Lane 3: Portkey + AIRS ──┐
│ Verdict: ✅ ALLOWED (leaked!)    │ Verdict: ✅ ALLOWED (missed)│ Verdict: 🛡 BLOCKED        │
│ Response preview...               │ Response preview...          │ Block reason: prompt_inj. │
│ Latency: 1.2s · 240 tok           │ Latency: 1.3s · 240 tok      │ Latency: 0.4s · stopped   │
└──────────────────────────────────┴─────────────────────────────┴────────────────────────────┘
```

Single "Run attack" button fires the same prompt through all 3 lanes in parallel. Below the lanes: per-attack **"Why each lane behaved this way"** teaching callout (data lives on the attack item).

### 3.3 Tab 3 — Integration Guide (single column)

Language tabs: `curl` / `Node` / `Python`. Each tab is a top-to-bottom walkthrough:

1. Set env vars (uses placeholders; mentions real config slug `pc-sudo-a-315f92` and integration `@sudo-vertexai`)
2. Init Portkey client
3. Send a chat request
4. Read `hook_results` (annotated JSON sample showing the AIRS verdict shape)
5. Streaming variant

Snippets are copy-paste-runnable, syntax-highlighted, GitHub-dark background (`#0d1117`) per project convention. Each block has a `CopyButton`.

## 4. Backend

### 4.1 File & dependency

- **New file** `portkey-routes.js` at project root. Reason: `server.js` is already 1432 lines and Portkey flows add ~400 more (SSE streaming + 3-lane fan-out + SDK init). Mount via `app.use('/api/gateway', portkeyRoutes)` in `server.js`.
- **New dependency** `portkey-ai` (Node SDK). Reason: SDK handles SSE chunks and surfaces `model_extra.hook_results` cleanly.

### 4.2 Environment variables (add to `.env.example`)

```
PORTKEY_API_KEY=                              # required
PORTKEY_CONFIG_AIRS=pc-sudo-a-315f92          # existing: sudo-airs-prompt-profile (AIRS guardrail)
PORTKEY_CONFIG_NO_GUARDRAIL=                  # to create: Vertex only, no checks
PORTKEY_CONFIG_DEFAULTS=                      # to create: Vertex + Portkey regex/PII guardrail
PORTKEY_CONFIG_FALLBACK=                      # to create: Vertex primary → Bedrock fallback
PORTKEY_VERTEX_SLUG=@sudo-vertexai            # existing
PORTKEY_BEDROCK_SLUG=                         # to create in Portkey
```

### 4.3 Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/gateway/health` | Portkey reachability + which configs are wired (`{ ok, missing: [...], modelCount }`). |
| `GET` | `/api/gateway/models` | Proxies Portkey `GET /v1/models`, returns flattened list grouped by provider. 5-min in-memory cache, `?force=1` to bypass. |
| `GET` | `/api/gateway/configs` | Static metadata for the 4 configs (`id, label, slug, attached`). Used to populate UI without hitting Portkey. |
| `POST` | `/api/gateway/chat` | **SSE streaming.** Body: `{ model, configId, messages, cacheEnabled }`. Emits `data: {token}` then `event: metadata` with `{hook_results, timing, cache, fallbackUsed, traceId}`. On guardrail block emits `event: blocked` with verdict. |
| `POST` | `/api/gateway/compare` | **3-lane runner.** Body: `{ prompt, model }`. Calls Portkey 3× in parallel (no-guardrail / defaults / AIRS). Non-streaming. Returns `{ lanes: [{ id, verdict, blockReason, response, latencyMs, tokens, hookResults, rawError }, ...] }`. |

### 4.4 Trace persistence

- Live Demo chat → calls existing `persistTrace()` with extra fields: `{ source: 'gateway', portkeyConfigId, modelSlug, cacheHit, fallbackUsed, hookResults }`. Visible in LLM Telemetry pillar.
- Detection Showcase compare → **does not** persist (3 lanes × N attacks would pollute the trace table).
- Pipeline trace panel reads streamed metadata directly — matches MCP pillar's synthetic-trace pattern, not a `/api/traces/:id` fetch.

### 4.5 Error handling

| Condition | Server behavior | UI behavior |
|---|---|---|
| `PORTKEY_API_KEY` missing | All endpoints return `503 { error: 'configure_portkey', missing: [...] }` | Pillar opens to "Configure Portkey" screen with env snippet |
| One config slug missing | `/health` reports `degraded`; affected control returns `503` on use | Yellow banner above tabs + control disabled with tooltip |
| Portkey unreachable | `/health` reports `down`; chat/compare return `502` | Red banner; chat input disabled |
| Stream error mid-message | Closes SSE with `event: error` | Red error footer on bubble + retry button; partial tokens preserved |
| AIRS guardrail blocks | SSE emits `event: blocked` with verdict, no tokens | Red "Blocked by AIRS guardrail" card, expandable verdict JSON |
| Bedrock fallback fires | `metadata.fallbackUsed = true` | Green pill "↪ Fell back to Bedrock" in metadata strip |

## 5. Data Flow

### 5.1 Live Demo chat

```
Browser POST /api/gateway/chat { model, configId, messages, cacheEnabled }
  → portkey-routes builds Portkey client w/ selected config slug
  → portkey.chat.completions.create({ model, messages, stream: true })
  → for each chunk:
      • forward token: data: {"type":"token","text":"..."}
      • capture chunk.model_extra.hook_results when present
  → on stream end emit: event: metadata
      data: { hook_results: {before, after}, model, latencyMs, tokensIn, tokensOut,
              cache: "HIT|MISS|disabled", fallbackUsed, traceId }
  → persistTrace(...) using existing helper
```

### 5.2 Detection Showcase compare

```
Browser POST /api/gateway/compare { prompt, model }
  → Promise.all([
      runLane('no-guardrail', PORTKEY_CONFIG_NO_GUARDRAIL),
      runLane('defaults',     PORTKEY_CONFIG_DEFAULTS),
      runLane('airs',         PORTKEY_CONFIG_AIRS),
    ])
  → returns { lanes: [...] }
```

Lane verdict logic:
- `hook_results.before_request_hooks[].verdict === false` → `BLOCKED (input)`
- `hook_results.after_request_hooks[].verdict === false` → `BLOCKED (output)`
- otherwise → `ALLOWED` (plus response text for visual comparison)

### 5.3 Frontend message state

```js
{
  id, role, content,
  status: 'streaming' | 'done' | 'blocked' | 'error',
  metadata: { model, latencyMs, tokens, cache, fallbackUsed, hookResults, traceId }
}
```

### 5.4 Attack library item shape

```js
{
  id, label, category, severity, prompt,
  explainPerLane: {
    'no-guardrail': '...',
    'defaults':     '...',
    'airs':         '...',
  }
}
```

## 6. Theming & UX Rules

- All theme tokens via `useProtectionTheme()` where applicable.
- Pillar **ignores** global AIRS ON/OFF toggle — has local guardrail controls. Sidebar toggle disabled with tooltip "This pillar uses local guardrail controls" (matches Developer Corner's pattern).
- Pillar accent `#ec4899` used for: active tab underline, AIRS lane highlight, severity dots, primary CTA button.
- JSON / code blocks: `background: '#0d1117'` regardless of theme.
- Dropdowns/popovers: inline-style theme detection via `!state.isDark` from `useAppContext()`; never Tailwind hover classes alone.
- Both light and dark themes verified for: tab bar, status strip, lane cards, attack library list, code blocks, dropdowns.

## 7. File Plan

```
docs/superpowers/specs/2026-05-27-llm-gateway-portkey-pillar-design.md   (this doc)

portkey-routes.js                                       (new) — Express router
.env.example                                            (edit) — add Portkey vars

src/views/LlmGatewayView.jsx                            (new) — top-level tab routing
src/views/llm-gateway/LiveDemoTab.jsx                   (new)
src/views/llm-gateway/ShowcaseTab.jsx                   (new)
src/views/llm-gateway/GuideTab.jsx                      (new)
src/views/llm-gateway/components/LaneCard.jsx           (new)
src/views/llm-gateway/components/HookResultsViewer.jsx  (new)
src/views/llm-gateway/components/PortkeyStatusStrip.jsx (new)
src/views/llm-gateway/components/ModelPicker.jsx        (new)
src/hooks/usePortkeyChat.js                             (new) — SSE consumer
src/data/llmGatewayAttacks.js                           (new) — curated library
src/data/llmGatewayGuideSnippets.js                     (new) — code strings

src/views/HomeViewV2.jsx                                (edit) — add pillar, 5+4 grid
src/components/Sidebar.jsx                              (edit) — NAV_ITEMS entry
src/components/TopBar.jsx                               (edit) — VIEW_LABELS entry
src/components/HelpDrawer.jsx                           (edit) — VIEWS entry
src/App.jsx                                             (edit) — import + switch case
server.js                                               (edit) — mount portkey-routes
package.json                                            (edit) — add portkey-ai
CLAUDE.md                                               (edit) — document new pillar/endpoints
```

Per CLAUDE.md convention, small visual components (`JsonToken`, `CopyButton`-style) are inlined inside their tab files. Only larger/reused widgets go in `components/`.

## 8. Scope Guardrails (NOT in v1)

- ❌ Portkey Prompt Library / Prompt Engineering
- ❌ Portkey virtual-keys management UI
- ❌ Portkey MCP integration (already have a dedicated MCP Security pillar)
- ❌ Conditional / metadata-based routing
- ❌ Bedrock-on-Portkey setup automation — done manually, slugs dropped into `.env`

## 9. Prerequisites (from user, before implementation)

1. ✅ `PORTKEY_API_KEY` — received in chat, will go in local `.env` only
2. ⏳ Create **Bedrock integration** in Portkey UI → send slug for `PORTKEY_BEDROCK_SLUG`
3. ⏳ Create **3 additional configs** in Portkey:
   - `PORTKEY_CONFIG_NO_GUARDRAIL` — Vertex only, no checks
   - `PORTKEY_CONFIG_DEFAULTS` — Vertex + Portkey's built-in regex/PII guardrail (create new Portkey guardrail in UI for this)
   - `PORTKEY_CONFIG_FALLBACK` — Vertex primary + Bedrock fallback
4. ⏳ Decide where to enable **semantic cache** — existing AIRS config OR all 3 new configs

Without (2) and (3), the pillar can still be built and shipped with affected controls disabled and tooltips explaining what's missing.

## 10. Implementation Order (will become the plan)

1. Backend scaffold: `portkey-routes.js` + env wiring + `/health` + `/models` + `/configs`
2. Backend `/chat` SSE endpoint
3. Backend `/compare` endpoint
4. Frontend pillar scaffold: home grid 5+4, sidebar item, App.jsx wiring, status strip, empty tabs
5. Live Demo tab (model picker, chat, guardrail/fallback/cache switches, pipeline trace)
6. Detection Showcase tab (attack library + 3-lane runner + teaching callout)
7. Integration Guide tab (curl/Node/Python snippets)
8. Polish: error states, light/dark sweep, dev-server manual verification

## 11. Open Questions for Implementation Phase

- Exact shape of Portkey-default guardrail (regex/PII) to attach to `PORTKEY_CONFIG_DEFAULTS` — user to define when creating the config.
- Whether to surface `traceId` from `persistTrace()` in the Pipeline Trace panel as a clickable link to the LLM Telemetry drawer.
- Whether Detection Showcase compare endpoint should also accept the user's chosen model from Live Demo state, or always use a fixed model for fair comparison (recommend: fixed `gemini-2.0-flash-001` to keep lanes apples-to-apples).
