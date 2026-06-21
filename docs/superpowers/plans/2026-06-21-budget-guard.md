# Budget Guard (Developer View) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the AI/LLM Gateway's Budget tab into a developer chat console where each model has its own token budget, and the gateway blocks prompts in real time (HTTP 412) when a model's budget is exhausted.

**Architecture:** Backend adds per-model token-capped Portkey keys + `POST /finops/devchat` (routes a prompt through that model's budget key → real answer or real 412) + `POST /finops/budget/reset`, in the existing `portkey-finops.js`. Frontend rewrites `FinOpsTab.jsx` from the dashboard into a chat console: a model strip (curated models, each with a budget bar), an active-model meter, chat bubbles incl. a red "blocked" bubble, and reset. Reuses the Admin-API key patterns proven in the prior FinOps feature.

**Tech Stack:** Node/Express, React + Vite + Tailwind, Portkey Node SDK (`portkey-ai` v3.1.0), Portkey Admin + chat APIs.

## Global Constraints

- JavaScript only, ES modules. React/Vite/Tailwind frontend; `portkey-finops.js` is ESM.
- **No automated test harness** — verify with `curl` (expected output shown), `npm run build`, and visual checks in BOTH light and dark themes.
- Never reference `process.env` in `src/`. Reactive theme: `const isLight = !state.isDark` from `useAppContext()` (never a stale `classList` const).
- Portkey Node SDK v3.1.0: metadata via the **constructor** option (no `withOptions`). Admin API base `https://api.portkey.ai/v1`, header `x-portkey-api-key`. Create key `POST /v1/api-keys/workspace/service` (hyphen) → returns FULL `key`; list returns `key` MASKED; delete `DELETE /v1/api-keys/{id}` (hyphen — empirically verified). `workspace_id` = `0cfd0b1a-6e24-4617-91b7-a0a44c241f23`.
- Budget enforcement = **token** `usage_limits` (`{type:'tokens', credit_limit, periodic_reset:'monthly'}`); Portkey returns **HTTP 412** when the cap is hit (no spend on a blocked request).
- Reuses `PORTKEY_ADMIN_API_KEY` (already set). Real spend on Vertex/Bedrock is intentional. Pink accent `#ec4899`; budget bar green `#34d399` <80% → amber `#f59e0b` 80–99% → red `#ef4444` ≥100%.
- Default budget `BUDGET_TOKEN_CAP = Number(process.env.FINOPS_BUDGET_TOKEN_CAP) || 8000`.

## File structure

| File | Responsibility |
|------|----------------|
| `portkey-finops.js` (modify) | Add per-model budget-key mgmt, `MODEL_PRICING`, `POST /finops/devchat`, `POST /finops/budget/reset` |
| `src/data/finopsConfig.js` (modify) | Add `BUDGET_MODELS` (curated model strip) + `BUDGET_TOKEN_CAP` mirror |
| `src/views/llm-gateway/FinOpsTab.jsx` (rewrite) | Developer chat console (replaces the dashboard UI) |
| `.env.example` (modify) | Document `FINOPS_BUDGET_TOKEN_CAP` |
| `README.md`, `CLAUDE.md` (modify) | Update Budget tab description |

Existing backend dashboard endpoints (`/overview`, `/budget`, `/generate`, `/enforce/*`) are **retained, untouched** (unused by the new UI).

---

### Task 0: Branch + config scaffolding

**Files:** branch `feat/gateway-budget-guard`; modify `.env.example`, `src/data/finopsConfig.js`; commit the spec + plan.

**Interfaces:** Produces `BUDGET_MODELS`, `BUDGET_TOKEN_CAP` from `finopsConfig.js`.

- [ ] **Step 1: Branch** (ask git permission first)
```bash
git checkout main && git checkout -b feat/gateway-budget-guard
```
- [ ] **Step 2: Add env doc to `.env.example`** under the FinOps block:
```bash
# Per-model token budget for the Budget tab's developer chat (default 8000)
FINOPS_BUDGET_TOKEN_CAP=
```
- [ ] **Step 3: Extend `src/data/finopsConfig.js`** (append):
```js
// Curated models for the Budget tab's developer chat — each gets its own
// token budget. One expensive (Opus), one cheap Bedrock (Haiku), one Vertex.
export const BUDGET_MODELS = [
  { id: '@sudo-bedrock/us.anthropic.claude-opus-4-8', label: 'Claude Opus 4.8', vendor: 'Bedrock' },
  { id: '@sudo-bedrock/anthropic.claude-3-haiku-20240307-v1:0', label: 'Claude 3 Haiku', vendor: 'Bedrock' },
  { id: '@sudo-vertexai/gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', vendor: 'Vertex' },
]
// Mirror of the backend default (FINOPS_BUDGET_TOKEN_CAP) for display fallback;
// the backend returns the authoritative `cap` in each devchat response.
export const BUDGET_TOKEN_CAP = 8000
```
- [ ] **Step 4: Commit** (show command, get OK)
```bash
git add docs/superpowers/specs/2026-06-21-budget-guard-developer-view-design.md \
        docs/superpowers/plans/2026-06-21-budget-guard.md .env.example src/data/finopsConfig.js
git commit -m "chore(budget-guard): scaffold — spec, plan, env, model config"
```

---

### Task 1: Backend — per-model budget keys + `/finops/devchat` + `/finops/budget/reset`

**Files:** Modify `portkey-finops.js` (routes auto-registered via `registerFinopsRoutes`).

**Interfaces:**
- Consumes: `adminFetch`, `ADMIN_KEY`, `FINOPS_WORKSPACE_ID` (already in `portkey-finops.js`).
- Produces:
  - `POST /api/gateway/finops/devchat` body `{model, prompt}` → `{ blocked:false, answer, tokensUsed, estCost, cap, model }` | `{ blocked:true, code:412, reason:'budget_exceeded', cap, model }` | `{ blocked:false, error, model }`
  - `POST /api/gateway/finops/budget/reset` body `{model?}` → `{ ok:true, reset:[modelIds] }`

- [ ] **Step 1: Add constants + pricing + budget-key management** (near the other finops constants)
```js
import { Portkey } from 'portkey-ai' // already imported; ensure present
const BUDGET_TOKEN_CAP = Number(process.env.FINOPS_BUDGET_TOKEN_CAP) || 8000
const BUDGET_KEY_PREFIX = 'sudo-budget-'
// Approx blended USD per 1M tokens — for the est-$ label only (not billing).
const MODEL_PRICING = {
  'us.anthropic.claude-opus-4-8': 45,
  'anthropic.claude-sonnet-4-20250514-v1:0': 9,
  'anthropic.claude-3-haiku-20240307-v1:0': 0.75,
  'gemini-3.1-flash-lite': 0.2,
  'gemini-3.5-flash': 0.6,
}
const _budgetKeys = new Map() // modelId -> full key value

function bareModel(modelId) {
  const s = String(modelId)
  return s.includes('/') ? s.split('/').slice(1).join('/') : s
}
function budgetKeyName(modelId) {
  return BUDGET_KEY_PREFIX + bareModel(modelId).replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)
}
function estCostUSD(modelId, tokens) {
  const rate = MODEL_PRICING[bareModel(modelId)] ?? 1
  return +(((tokens || 0) / 1e6) * rate).toFixed(4)
}

// Create/find a token-capped key for a model. fresh=true deletes+recreates to
// zero usage and obtain the FULL key value (list returns it masked).
async function ensureBudgetKey(modelId, { fresh = false } = {}) {
  if (!fresh && _budgetKeys.has(modelId)) return _budgetKeys.get(modelId)
  const name = budgetKeyName(modelId)
  const list = await adminFetch('/api-keys?page_size=100').catch(() => ({ data: [] }))
  const existing = (list.data || []).find(k => k.name === name)
  if (existing?.id) await adminFetch(`/api-keys/${existing.id}`, { method: 'DELETE' }).catch(() => {})
  const created = await adminFetch('/api-keys/workspace/service', {
    method: 'POST',
    body: JSON.stringify({
      name, workspace_id: FINOPS_WORKSPACE_ID, scopes: ['completions.write'],
      usage_limits: { type: 'tokens', credit_limit: BUDGET_TOKEN_CAP, periodic_reset: 'monthly' },
    }),
  })
  const value = created.key || created.api_key
  if (!value) throw new Error('budget key create returned no key value')
  _budgetKeys.set(modelId, value)
  return value
}
```

- [ ] **Step 2: Add the `/finops/devchat` route** (inside `registerFinopsRoutes`)
```js
router.post('/finops/devchat', async (req, res) => {
  if (!ADMIN_KEY()) return res.status(503).json({ error: 'configure_admin_key' })
  const { model, prompt } = req.body || {}
  if (!model || !String(prompt || '').trim()) return res.status(400).json({ error: 'bad_request', message: 'model and prompt required' })
  try {
    const keyValue = await ensureBudgetKey(model)
    const client = new Portkey({ apiKey: keyValue, strictOpenAiCompliance: false })
    try {
      const r = await client.chat.completions.create({
        model, max_tokens: 1024, messages: [{ role: 'user', content: String(prompt) }],
      })
      const tokensUsed = r?.usage?.total_tokens ?? 0
      const answer = r?.choices?.[0]?.message?.content ?? ''
      res.json({ blocked: false, answer, tokensUsed, estCost: estCostUSD(model, tokensUsed), cap: BUDGET_TOKEN_CAP, model })
    } catch (e) {
      const code = e?.status || e?.response?.status || (/412/.test(String(e?.message)) ? 412 : null)
      if (code === 412) return res.json({ blocked: true, code: 412, reason: 'budget_exceeded', cap: BUDGET_TOKEN_CAP, model })
      res.json({ blocked: false, error: String(e?.message || e).slice(0, 200), cap: BUDGET_TOKEN_CAP, model })
    }
  } catch (e) {
    res.status(502).json({ error: 'devchat_failed', message: String(e?.message || e) })
  }
})
```

- [ ] **Step 3: Add the `/finops/budget/reset` route** (inside `registerFinopsRoutes`)
```js
router.post('/finops/budget/reset', async (req, res) => {
  if (!ADMIN_KEY()) return res.status(503).json({ error: 'configure_admin_key' })
  const { model } = req.body || {}
  try {
    const targets = model ? [model] : [..._budgetKeys.keys()]
    for (const m of targets) await ensureBudgetKey(m, { fresh: true })
    res.json({ ok: true, reset: targets })
  } catch (e) {
    res.status(502).json({ error: 'reset_failed', message: String(e?.message || e) })
  }
})
```

- [ ] **Step 4: Verify** (no test harness — curl; spends real money; CREATES per-model keys)
```bash
cd /Users/sudovenko/sudo-airs-demo-portal
lsof -ti tcp:3001 | xargs kill -9 2>/dev/null; sleep 1
nohup node server.js > /tmp/finops-srv.log 2>&1 & sleep 3
node --check portkey-finops.js
# under budget → real answer:
curl -s -X POST localhost:3001/api/gateway/finops/devchat -H 'Content-Type: application/json' \
  -d '{"model":"@sudo-bedrock/us.anthropic.claude-opus-4-8","prompt":"Say hello in 8 words."}' --max-time 60 | python3 -m json.tool
# fire long prompts until 412 (budget exceeded):
for i in 1 2 3 4 5 6 7 8; do
  curl -s -X POST localhost:3001/api/gateway/finops/devchat -H 'Content-Type: application/json' \
    -d '{"model":"@sudo-bedrock/us.anthropic.claude-opus-4-8","prompt":"Write a 400-word essay on AI gateways."}' --max-time 60 \
    | python3 -c "import json,sys;d=json.load(sys.stdin);print('blocked' if d.get('blocked') else f\"ok tokens={d.get('tokensUsed')} est=\${d.get('estCost')}\")"
done
# reset:
curl -s -X POST localhost:3001/api/gateway/finops/budget/reset -H 'Content-Type: application/json' -d '{"model":"@sudo-bedrock/us.anthropic.claude-opus-4-8"}' | python3 -m json.tool
```
Expected: first call returns a real `answer` + `tokensUsed`; the loop shows a few `ok` then `blocked` (real 412); reset returns `{ok:true, reset:[...]}`. If it never blocks within 8, lower `FINOPS_BUDGET_TOKEN_CAP` and retry.

- [ ] **Step 5: Commit**
```bash
git add portkey-finops.js
git commit -m "feat(budget-guard): per-model token-budget keys + /finops/devchat + /finops/budget/reset"
```

---

### Task 2: Frontend — reframe `FinOpsTab.jsx` into the developer chat console

**Files:** Rewrite `src/views/llm-gateway/FinOpsTab.jsx`.

**Interfaces:**
- Consumes: `BUDGET_MODELS`, `BUDGET_TOKEN_CAP` from `finopsConfig.js`; `POST /finops/devchat`, `POST /finops/budget/reset`, `GET /finops/health`.

- [ ] **Step 1: Rewrite the component** to the chat console. Remove all dashboard sections (KPI/charts/attribution/savings/enforce/generate). Keep the setup screen (when `health.adminKey===false`). Structure:
  - State: `active` (selected model id, default `BUDGET_MODELS[0].id`), `messages` (array of `{role:'user'|'assistant'|'blocked', text, model, tokensUsed?, estCost?}`), `usedByModel` (`{[modelId]: tokens}`), `estByModel` (`{[modelId]: $}`), `sending`, `input`.
  - **Model strip:** render `BUDGET_MODELS` as chips; each shows `label`, a mini budget bar (`usedByModel[id]/cap`, green/amber/red), and "{used}/{cap} tok". Click sets `active`. Highlight `active`.
  - **Active meter:** prominent bar for the active model: `usedByModel[active]/cap tokens (~$est)` + % + color thresholds. When ≥100% show "budget exhausted — reset or switch".
  - **Chat:** scrollable bubbles. User bubble (right), assistant bubble (left, render text), and a **red blocked bubble** for `role:'blocked'`: "🛑 Budget exceeded for {label} — the gateway rejected this request (HTTP 412). Switch model or reset its budget."
  - **Input row:** textarea + Send. Disabled while `sending`.
  - **Reset:** a "Reset budget" button (active model) + "Reset all". On reset: POST `/finops/budget/reset` with `{model}` (or no body for all), then zero `usedByModel`/`estByModel` for the target(s).
  - **Real-spend note:** small caption "Real calls to your Vertex/Bedrock accounts via the gateway."
- [ ] **Step 2: Wire `send()`**:
```js
const send = async () => {
  const prompt = input.trim(); if (!prompt || sending) return
  setMessages(m => [...m, { role: 'user', text: prompt, model: active }])
  setInput(''); setSending(true)
  try {
    const res = await fetch('/api/gateway/finops/devchat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: active, prompt }),
    })
    const d = await res.json()
    if (d.blocked) {
      setMessages(m => [...m, { role: 'blocked', model: active }])
      setUsedByModel(u => ({ ...u, [active]: (d.cap ?? BUDGET_TOKEN_CAP) })) // peg meter to full
    } else if (d.error) {
      setMessages(m => [...m, { role: 'assistant', text: `⚠ ${d.error}`, model: active }])
    } else {
      setMessages(m => [...m, { role: 'assistant', text: d.answer, model: active, tokensUsed: d.tokensUsed, estCost: d.estCost }])
      setUsedByModel(u => ({ ...u, [active]: (u[active] || 0) + (d.tokensUsed || 0) }))
      setEstByModel(e => ({ ...e, [active]: +(((e[active] || 0) + (d.estCost || 0)).toFixed(4)) }))
    }
  } catch (e) {
    setMessages(m => [...m, { role: 'assistant', text: `⚠ ${String(e)}`, model: active }])
  } finally { setSending(false) }
}
```
- [ ] **Step 3: Theme + style.** Reactive `isLight = !state.isDark`. Bar tracks `isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'`. Pink accent for active chip; bubbles readable in both themes. Currency via `Intl.NumberFormat('en-US',{style:'currency',currency:'USD'})`. Keep the existing `SetupScreen` (admin-key-missing) path.
- [ ] **Step 4: Verify** (build + endpoint wiring; visual checked by controller/user)
```bash
cd /Users/sudovenko/sudo-airs-demo-portal
npm run build 2>&1 | tail -5
```
Expected: build succeeds. Grep confirms dashboard sections removed (no recharts import left if unused) and `devchat`/`budget/reset` fetches wired.
- [ ] **Step 5: Commit**
```bash
git add src/views/llm-gateway/FinOpsTab.jsx
git commit -m "feat(budget-guard): reframe Budget tab into the developer chat console"
```

---

### Task 3: Docs

**Files:** Modify `README.md`, `CLAUDE.md` (CLAUDE.md is gitignored — update locally, do NOT `git add` it).

- [ ] **Step 1: Update README** Budget-tab bullet: it's now a **developer chat console** — pick a model, chat with real Vertex/Bedrock answers, watch the per-model **token budget** deplete, and get a real **HTTP 412** block when it's exhausted (switch model / reset). Note `FINOPS_BUDGET_TOKEN_CAP` (default 8000). Mention the FinOps analytics endpoints remain in the backend but are no longer surfaced.
- [ ] **Step 2: Update CLAUDE.md** (local) — Budget tab reframed to the dev chat; new endpoints `/finops/devchat` + `/finops/budget/reset`; per-model `sudo-budget-<model>` token-capped keys; `FINOPS_BUDGET_TOKEN_CAP`; dashboards retained backend-only.
- [ ] **Step 3: Commit** (README only)
```bash
git add README.md
git commit -m "docs(budget-guard): document the developer chat Budget tab"
```

---

## Self-review

- **Spec coverage:** dev chat console (T2) · per-model token budgets + meter (T1 keys, T2 meter) · real answers + real 412 block (T1 devchat, T2 blocked bubble) · model strip switch (T2) · reset (T1 + T2) · est $ (T1 pricing, T2 display) · dashboards removed from UI / backend retained (T2) · env var + graceful degradation (T0/T1/T2) · docs (T3). All spec sections mapped. ✓
- **Placeholders:** none — backend steps carry full code; frontend carries the component structure + the `send()` wiring + style rules; the bubble/strip markup follows the spec + existing chat patterns (`LiveDemoTab.jsx`).
- **Type consistency:** `ensureBudgetKey(modelId,{fresh})`, `bareModel`, `budgetKeyName`, `estCostUSD`, `BUDGET_TOKEN_CAP`, `BUDGET_MODELS` defined once and reused; devchat response shape (`blocked/answer/tokensUsed/estCost/cap/model`) matches the frontend `send()` consumer. ✓

## Notes for the implementer
- Real spend is expected; the verify loop intentionally fires expensive Opus prompts to trip the cap.
- Reuse the Admin-API patterns already in `portkey-finops.js` (don't reinvent `adminFetch`).
- The frontend is a focused single-file rewrite; reference `LiveDemoTab.jsx` for chat-bubble styling and `console-v1.html` is NOT relevant here (that was the dashboard).
