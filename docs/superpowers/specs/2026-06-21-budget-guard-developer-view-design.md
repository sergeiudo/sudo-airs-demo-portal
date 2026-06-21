# Budget Guard — the developer's view (design)

**Date:** 2026-06-21
**Status:** Approved for planning
**Branch:** `feat/gateway-budget-guard`
**Supersedes the UI of:** the FinOps dashboard Budget tab (2026-06-21-gateway-finops). Backend analytics endpoints from that feature are retained but no longer surfaced in the tab.

## 1. Goal

Reframe the AI/LLM Gateway's **Budget** tab from an admin/FinOps dashboard into a **developer's real-time experience**: a chat console where a developer asks questions of Vertex/Bedrock models, watches a **per-model budget meter** tick down, and — mid-conversation — **gets blocked** when a model's budget is exhausted (real Portkey HTTP 412). Switching to a model with budget left lets them keep going. The lesson lands viscerally from the developer's seat: *the gateway enforces budgets in real time, and expensive models burn them fast.*

Reuses the enforcement infra already built (Portkey Admin API key management, real 412 enforcement, `PORTKEY_ADMIN_API_KEY`). Real spend on the user's Vertex/Bedrock accounts is intentional and approved.

## 2. The experience

1. Developer picks a model (Vertex Gemini / Bedrock Claude·Opus·etc.) and types a prompt.
2. Gets a **real answer** from the provider (routed through the gateway), and the model's **budget meter** ticks up by the real tokens used (with an estimated $ alongside).
3. After a few prompts the model's token budget is exhausted → the next prompt returns a **red blocked bubble**: *"🛑 Budget exceeded for {model} — gateway rejected this request (HTTP 412). Switch model or reset."*
4. A **model strip** shows each model's remaining budget (green→amber→red); switch to one with headroom and keep chatting.
5. **Reset** re-arms a model's (or all) budgets for the next demo run.

## 3. Scope

**In scope (v1):**
- Reframed `FinOpsTab.jsx` chat console: model picker, per-model budget meter (tokens used/cap + est $), chat bubbles (user + assistant + blocked), model strip with per-model remaining, reset.
- Backend: per-model token-capped Portkey keys; `POST /finops/devchat`; `POST /finops/budget/reset`.
- Real answers from Vertex + Bedrock; real 412 block when a model's cap is hit.
- **Remove** the dashboard UI (KPI strip, charts, attribution table, savings, generate, enforce-demo panel) from the tab.

**Non-goals (v1):**
- No streaming for devchat (non-streaming keeps token accounting clean; streaming is optional polish).
- No big analytics dashboards in the tab (backend `/overview`, `/budget`, `/generate`, `/enforce/*` endpoints remain in the codebase, unused by the tab — a future admin view could use them).
- No per-developer identity/auth (budgets are per-model, single demo developer).

## 4. Architecture

### 4.1 Backend — `portkey-finops.js` (add to existing module)
- **Per-model budget keys:** `ensureBudgetKey(modelId, { fresh })` — manage a token-capped Portkey key per model, named `sudo-budget-<slug>` where `<slug>` is the model id sanitized to `[a-z0-9-]`. Reuses `adminFetch` + the create/delete patterns proven in the enforce-key work (create `POST /v1/api-keys/workspace/service` with `usage_limits:{ type:'tokens', credit_limit: BUDGET_TOKEN_CAP, periodic_reset:'monthly' }`; delete `DELETE /v1/api-keys/{id}` — hyphen, empirically verified). Create returns the FULL key value; list returns it masked, so `fresh:true` deletes + recreates to obtain a usable value and zero the usage. Cache the full key value in a module map keyed by modelId.
- `POST /finops/devchat` `{ model, prompt }` → 503 if no `PORTKEY_ADMIN_API_KEY`. Resolve the model's budget key (create on first use), build a `new Portkey({ apiKey: budgetKey, strictOpenAiCompliance:false })` (NO guardrail config — pure `@integration/` routing), call `chat.completions.create({ model, max_tokens: 1024, messages:[{role:'user',content:prompt}] })`. On success → `{ blocked:false, answer, tokensUsed, estCost, model }`. On a **412** (catch `e.status`/`e.response?.status`/message) → `{ blocked:true, code:412, model, reason:'budget_exceeded' }`. Other errors → `{ blocked:false, error }` (e.g. provider error) with a 200 envelope so the chat UI can render it.
- `POST /finops/budget/reset` `{ model? }` → recreate the budget key for that model (or all known budget keys) → returns `{ ok:true, reset:[...models] }`.
- **Pricing for est $:** a small `MODEL_PRICING` map (model → blended $ per 1M tokens, approximate public list prices) used only to compute the `estCost` label. Clearly an estimate; approximate values are acceptable.
- **Budget cap:** `BUDGET_TOKEN_CAP = Number(process.env.FINOPS_BUDGET_TOKEN_CAP) || 8000` (≈4–5 long prompts; env-configurable).

### 4.2 Frontend — `FinOpsTab.jsx` (reframe)
- Replace the dashboard sections with the chat console:
  - **Model picker** (reuse `ModelPicker`; Vertex + Bedrock) — selecting a model focuses its budget.
  - **Per-model budget meter** for the active model: `used / cap tokens (~$est)` with a bar green (<80%) → amber (80–99%) → red (≥100% / blocked).
  - **Chat**: prompt input + message bubbles (user, assistant answer, and a distinct red **blocked** bubble for 412).
  - **Model strip**: a row of chips, one per model, each with a mini remaining-budget bar; click to switch; exhausted models show red.
  - **Reset** button (reset active model + a "reset all").
- **Usage tracking:** the frontend accumulates each model's `tokensUsed` from real `devchat` responses to drive the meter instantly (the backend cap is the enforcing source of truth → real 412). Reset zeroes the local counters and recreates the key.
- Conventions: reactive `isLight = !state.isDark`; both-theme readable; no `process.env` in `src/`; `Intl.NumberFormat` for est $; bar tracks theme-aware.

### 4.3 Environment
- Reuses `PORTKEY_ADMIN_API_KEY` (already set). New optional `FINOPS_BUDGET_TOKEN_CAP` (default 8000). Graceful degradation: no admin key → the existing setup screen.

## 5. Data flow
pick model → `POST /finops/devchat {model,prompt}` → backend routes via the model's token-capped key → (real answer + tokensUsed) OR (412 blocked) → frontend appends bubble + advances that model's meter → at cap, 412 → red blocked bubble → switch model / reset.

## 6. Error handling
- No admin key → setup screen (reuse).
- Provider error (non-412) → rendered as an inline error bubble, chat stays usable.
- 412 → the intended blocked bubble (not an error).
- Budget-key create/delete failures → surfaced as a clear error; chat degrades gracefully.
- Real spend disclaimer shown near the chat ("real calls to your Vertex/Bedrock accounts").

## 7. Testing / verification
No test harness → verify via `curl` (`/finops/devchat` returns a real answer under budget; returns `blocked:true,code:412` after the cap; `/finops/budget/reset` re-arms) + `npm run build` + visual check in both themes.

## 8. Integration points
1. `portkey-finops.js` — new endpoints + per-model key management + pricing map.
2. `portkey-routes.js` — register the two new routes (devchat, reset) if not auto-covered by `registerFinopsRoutes`.
3. `src/views/llm-gateway/FinOpsTab.jsx` — reframed to the chat console (dashboard UI removed).
4. `.env.example` — document `FINOPS_BUDGET_TOKEN_CAP`.
5. README / CLAUDE.md — update the Budget tab description (developer chat + per-model budgets).

## 9. Decisions settled
- Replace the tab with the dev chat (dashboards removed from UI; backend endpoints retained).
- Per-model budgets.
- Token budget (per-model token cap, default 8,000), displayed with an estimated $.
- Non-streaming devchat for clean token accounting.

## 10. Deployment
- Branch `feat/gateway-budget-guard`; merge to `main` only after review (with explicit user OK).
- EC2: standard `git pull && npm run build && pm2 restart airs-server`; `PORTKEY_ADMIN_API_KEY` already required from the prior feature; optional `FINOPS_BUDGET_TOKEN_CAP`.

## 11. Out of scope / future
- Streaming devchat.
- A real $-equivalent token budget (per-model token caps sized by price) — current v1 uses equal token caps per model with est-$ readout for the money contrast.
- An admin/FinOps view toggle reusing the retained dashboard endpoints.
- Wiring real cache-savings metrics (carried over from the prior feature's backlog).
