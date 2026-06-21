# AI/LLM Gateway — Budget / FinOps tab (design)

**Date:** 2026-06-21
**Status:** Approved for planning
**Branch:** `feat/gateway-finops`

## 1. Goal

Add a new tab to the **AI/LLM Gateway** pillar — placed **after MCP Registry, before Integration Guide** — that demonstrates Portkey's **cost-governance / FinOps** capabilities to a CFO/CTO audience. Where the rest of the pillar tells a *security* story (native vs AIRS guardrails), this tab tells the *money* story: **you can see, attribute, cap, and optimize AI spend through the gateway.**

The defining principle: **maximize real Portkey data, minimize mockups.** Dashboards are driven by the live Portkey Analytics API against the real `sudo` workspace; budget enforcement is real (HTTP 412 from Portkey on a dedicated key); attribution is real (Portkey metadata analytics). Real spend against the user's `@sudo-vertexai` and `@sudo-bedrock` corp accounts is acceptable and is generated on demand by a bounded traffic generator.

## 2. Audience & narrative

Three acts a CFO/CTO immediately understands:

1. **Control** — "We *cannot* overspend; the gateway enforces caps." (hero)
2. **Visibility** — "We know exactly who/what spends, to the dollar."
3. **Optimization** — "We're already cutting the bill (caching)."

## 3. Scope

**In scope (v1):**
- Single-scroll **cost console** (layout A) with five sections:
  1. KPI strip (spend, tokens, requests, budget used + projected month-end)
  2. Spend over time (time-series) + by-model breakdown
  3. Cost attribution (by team / user / app via Portkey metadata)
  4. Budget caps + **live real enforcement** (hero)
  5. Optimization & savings (caching real; cheaper-model routing estimated)
- **Traffic generator** to populate real spend + attribution (bounded by request count + estimated-spend ceiling).
- **Time-range selector** (e.g. 24h / 7d / 30d) for the dashboards.
- Tag existing Live Demo / Scenarios gateway calls with metadata so ongoing demo use is also attributable.

**Non-goals (v1):**
- No simulated/enterprise mock dataset (dropped — real data only).
- No editing of the workspace's primary budgets from the UI (enforcement uses an isolated demo key only).
- No multi-workspace management.

## 4. Architecture

Follows existing pillar patterns: a dedicated backend module (like `portkey-mcp.js`) mounted under `/api/gateway`, and a tab component registered in `LlmGatewayView.jsx`.

### 4.1 Frontend — `src/views/llm-gateway/FinOpsTab.jsx`
- Single-scroll console; **recharts** (already a dependency, used in `RedTeamReport.jsx`) for the area trend + donut + bars; attribution table, budget panel, savings cards hand-built.
- Pink pillar accent (`#ec4899`); amber (`#f59e0b`) for savings; budget-utilization bar green→amber→red by threshold.
- Top controls: **time-range selector**, a **"Generate traffic"** demo control (shows estimated spend before running), and the data reflects **real Portkey analytics**.
- Registered in `LlmGatewayView.jsx`: add to `TABS` (after `mcp`, before `guide`) + a mounted `display:none` body div, matching siblings. Pick an icon (e.g. `Wallet` / `CircleDollarSign` from lucide).
- All panels follow the project's "readable panel backgrounds" + reactive light/dark rules.

### 4.2 Backend — `portkey-finops.js`, mounted at `/api/gateway/finops`
Registered from `portkey-routes.js` (same way `portkey-mcp.js` routes are registered).

| Endpoint | Purpose |
|----------|---------|
| `GET /finops/overview?range=24h\|7d\|30d` | Aggregate dashboard payload: KPIs, spend time-series, by-model, attribution, savings — assembled from Portkey Analytics API calls. Short in-memory cache (e.g. 30–60s) to avoid hammering. |
| `GET /finops/budget` | Read the dedicated demo key's `usage_limits` + current usage (for the budget bar / projected month-end). |
| `POST /finops/generate` (SSE) | Traffic generator: fire N long token-maximizing prompts across selected models with rotating metadata; stream progress; bounded by `maxRequests` + estimated-spend ceiling. |
| `POST /finops/enforce/run` (SSE) | Ensure dedicated demo key with tiny cost cap exists; fire long prompts through it until HTTP **412** budget-exceeded; stream per-request results. |
| `POST /finops/enforce/reset` | Delete + recreate the demo key (fresh usage). |
| `GET /finops/health` | Reports whether `PORTKEY_ADMIN_API_KEY` is configured + analytics reachability. |

### 4.3 Data sources (real)
- **Portkey Analytics API** (control-plane; requires admin/org key with analytics scope):
  - `GET /v1/analytics/groups/ai-models` — cost / requests / tokens per model (time-ranged).
  - `GET /v1/analytics/graphs/requests` (+ cost/tokens graph siblings) — time-series for the trend chart.
  - `GET /v1/analytics/groups/metadata/{key}` — attribution by `team` / `_user` / `app`.
  - Common query params: `time_of_generation_min/max` (ISO8601), `workspace_slug`, optional `metadata`, `configs`, `api_key_ids`.
  - **Cost is returned directly by Portkey** — no local pricing table needed for dashboards.
- **Budget enforcement** (Admin API): create/delete API key with `usage_limits: { type:'cost', credit_limit, periodic_reset, alert_threshold }`. A hit cap returns **HTTP 412** *before* the provider call (no spend on blocked requests). Rate limit → 429; expired key → 401.
- **Metadata attribution**: requests carry `metadata: { _user, team, app, env }`; the generator rotates a fixed set (e.g. teams: Platform, Support bot, Data Science, Marketing, Sandbox).

### 4.4 Environment
- **New:** `PORTKEY_ADMIN_API_KEY` — admin/org-scoped key with **analytics read** + **API-key management** scopes. Stays server-side in gitignored `.env` (local + EC2). Powerful (manages keys), so never exposed to the browser.
- **Graceful degradation:** if `PORTKEY_ADMIN_API_KEY` is missing, the tab renders the dashboards in a clearly-labeled "configure admin key" state and disables the generator + enforcement, rather than crashing (mirrors the pillar's existing setup-screen pattern).

## 5. Section details

1. **KPI strip** — total spend (selected range, with Δ vs previous range), tokens (in/out), requests, budget used % + projected month-end vs cap. All from analytics + `/finops/budget`.
2. **Spend over time + by model** — area time-series (toggle by model / lane) from `graphs/*`; donut by model from `groups/ai-models`.
3. **Cost attribution** — table by team (toggle user/app) from `groups/metadata/{key}`: spend, share %, requests, mini-bar.
4. **Budget caps + live enforcement (hero)** — left: the cap / alert-threshold / utilization bar / projection (read from the key's `usage_limits`); right: dedicated-key demo with **▶ Fire requests** (streams `req1 ✓ … reqN 🔴 BLOCKED 412 budget exceeded`) + **↺ Reset**. Shows it's the real Portkey Admin API on an isolated key.
5. **Optimization & savings** — caching savings (real, from cache-hit requests) as the primary card; cheaper-model routing savings as a secondary card **labeled "estimated"** (counterfactual). Total saved + % off.

## 6. Real-spend controls
Budget is **not** a constraint (user's Vertex/Bedrock corp projects have headroom), so the generator and enforcement **prefer higher-tier models** (e.g. Claude Opus 4.8, Sonnet 4, Gemini 3.x) to produce rich real cost numbers and trip caps quickly.
- Generator: configurable `maxRequests` (default ~12–20, freely raisable) firing **long prompts with generous `max_tokens`** across higher-tier models; a shown estimated-spend figure for transparency (informational, not a hard blocker — user has approved real spend).
- Enforcement: small cost cap so it trips within 1–3 long higher-tier requests; blocked requests incur no cost (Portkey checks before the provider).
- UI still states plainly "this spends real money on your Vertex/Bedrock accounts" so it's never a surprise.

## 7. Error handling
- Missing admin key → degraded mode (above).
- Analytics API errors / empty data → friendly empty-state ("no usage yet — run the generator") instead of broken charts.
- SSE endpoints guard `res.writableEnded` (same pattern as `portkey-mcp.js`) so a mid-stream error/block can't crash the process.
- Generator/enforcement surface Portkey errors verbatim-but-readable.

## 8. Color / theme
- Pillar pink accent; amber for savings; budget bar green (<alert) → amber (alert→100%) → red (over). Reactive light/dark per project rules; syntax/JSON viewers (if any) stay forced-dark per the exception.

## 9. Testing / verification
- No automated test harness in repo → verify via `curl` on each `/finops/*` endpoint (overview/budget/generate/enforce/reset/health) + visual check of the tab in **both** light and dark themes.
- Confirm: generator produces real attributable spend (visible in Portkey console); enforcement returns a real 412; reset restores the key.

## 10. Integration points (smaller than a full pillar)
1. `FinOpsTab.jsx` (new).
2. `LlmGatewayView.jsx` — `TABS` entry (after `mcp`) + mounted body div.
3. `portkey-finops.js` (new) + route registration in `portkey-routes.js`.
4. `.env` / `.env.example` — `PORTKEY_ADMIN_API_KEY`.
5. Docs: note the new tab + env var in README / CLAUDE.md at the end.

## 11. Decisions settled
- **Cheaper-model routing savings:** **included** as a secondary card, clearly labeled **"estimated"** (it's a counterfactual vs the higher-tier model). Real caching savings remain the primary card.
- **Model tier for generator/enforcement:** prefer **higher-tier models** (Opus 4.8 / Sonnet 4 / Gemini 3.x) — budget is not a constraint.

## 12. Deployment
- All work on `feat/gateway-finops`; merge to `main` only after review.
- EC2: standard `git pull && npm run build && pm2 restart airs-server`, plus hand-set `PORTKEY_ADMIN_API_KEY` in EC2 `.env`. No new npm deps (recharts already present).

## 13. Out of scope / future
- Editing real workspace/team budgets from the UI.
- Alerts feed / webhook notifications surfaced in-app.
- Per-request cost drill-down table (could reuse Observability traces later).
