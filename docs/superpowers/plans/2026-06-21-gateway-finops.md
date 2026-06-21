# Budget / FinOps Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Budget" (FinOps) tab to the AI/LLM Gateway pillar that showcases Portkey cost governance — real spend dashboards, real attribution, real budget enforcement — for a CFO/CTO audience.

**Architecture:** A new backend module `portkey-finops.js` (mounted at `/api/gateway/finops`, registered from `portkey-routes.js`, same pattern as `portkey-mcp.js`) calls the **Portkey Analytics API** for real cost/usage data, manages an **isolated demo API key** via the Portkey Admin API for real 412 budget enforcement, and runs a bounded **traffic generator** that fires long higher-tier-model prompts tagged with metadata. A new frontend tab `FinOpsTab.jsx` renders a single-scroll cost console (recharts) registered in `LlmGatewayView.jsx`.

**Tech Stack:** Node/Express (backend), React + Vite + Tailwind (frontend), recharts (already a dependency), Portkey Analytics + Admin REST APIs, SSE for streaming.

## Global Constraints

- JavaScript only, no TypeScript (per CLAUDE.md). React, Vite, Tailwind, Node.
- **No automated test harness** — verify each task with `curl` (expected output shown), `npm run build`, and visual checks in BOTH light and dark themes.
- Never reference `process.env` inside `src/` (browser bundle has no process.env).
- Never use `protected` as a JSON key; use `airsEnabled` convention where relevant.
- All secrets stay server-side; `.env` is gitignored — `PORTKEY_ADMIN_API_KEY` hand-set on each host.
- Dropdowns/menus/panels must adapt to both themes via inline styles + reactive `isLight = !state.isDark` from `useAppContext()` (NOT a stale `classList` const).
- Resizable side panels are the default for multi-column views — but this tab is single-scroll (layout A), so no resize handles needed.
- SSE handlers must guard `res.writableEnded` before every write/end (same as `portkey-mcp.js`) to avoid `ERR_STREAM_WRITE_AFTER_END`.
- Portkey Analytics/Admin base URL: `https://api.portkey.ai/v1`; auth header `x-portkey-api-key: <PORTKEY_ADMIN_API_KEY>`.
- Pillar accent pink `#ec4899`; savings amber `#f59e0b`; budget bar green `#34d399` → amber `#f59e0b` → red `#ef4444` by utilization.
- Real spend is acceptable; prefer higher-tier models (`@sudo-bedrock/us.anthropic.claude-opus-4-8`, `@sudo-bedrock/anthropic.claude-sonnet-4-20250514-v1:0`, `@sudo-vertexai/gemini-3.5-flash`).

## File structure

| File | Responsibility |
|------|----------------|
| `portkey-finops.js` (new) | Analytics client, `/finops/*` route handlers, traffic generator, enforcement, demo-key management |
| `portkey-routes.js` (modify) | Register finops routes; tag existing chat/compare requests with metadata |
| `src/views/llm-gateway/FinOpsTab.jsx` (new) | Single-scroll cost console UI |
| `src/views/LlmGatewayView.jsx` (modify) | Register the new tab |
| `src/data/finopsConfig.js` (new) | Shared constants: metadata team/user/app set, model tiers, time ranges |
| `.env.example` (modify) | Document `PORTKEY_ADMIN_API_KEY` |
| `README.md`, `CLAUDE.md` (modify) | Document the new tab + env var |

Reference for exact visual markup/colors: the approved mockup at `.superpowers/brainstorm/99610-1782058798/content/console-v1.html`.

---

### Task 0: Branch, env scaffolding, shared config, commit the spec

**Files:**
- Create branch `feat/gateway-finops`
- Modify: `.env` (local, gitignored), `.env.example`
- Create: `src/data/finopsConfig.js`
- Commit: the approved spec `docs/superpowers/specs/2026-06-21-gateway-finops-budget-tab-design.md`

**Interfaces:**
- Produces: `FINOPS_TEAMS`, `FINOPS_MODELS`, `FINOPS_RANGES` from `finopsConfig.js`.

- [ ] **Step 1: Create the branch** (ask user permission first per their git rule)

```bash
git checkout -b feat/gateway-finops
```

- [ ] **Step 2: Add the env var** to `.env.example` (and the real `.env` locally)

```bash
# ─── Portkey FinOps (Budget tab) ───
# Admin/org-scoped key with analytics-read + api-key-management scopes.
# Powers the Budget tab's real analytics dashboards + real budget enforcement.
PORTKEY_ADMIN_API_KEY=
```

- [ ] **Step 3: Create `src/data/finopsConfig.js`**

```js
// Shared FinOps constants. Imported by FinOpsTab (frontend) only — the backend
// has its own copy of the team set to avoid a cross-bundle import.
export const FINOPS_RANGES = [
  { id: '24h', label: '24h', days: 1 },
  { id: '7d',  label: '7d',  days: 7 },
  { id: '30d', label: '30d', days: 30 },
]
export const FINOPS_TEAMS = ['Platform', 'Support bot', 'Data Science', 'Marketing', 'Sandbox']
export const FINOPS_ATTR_KEYS = [
  { id: 'team', label: 'Team' },
  { id: '_user', label: 'User' },
  { id: 'app', label: 'App' },
]
```

- [ ] **Step 4: Commit** (show command, get user OK)

```bash
git add docs/superpowers/specs/2026-06-21-gateway-finops-budget-tab-design.md \
        docs/superpowers/plans/2026-06-21-gateway-finops.md \
        .env.example src/data/finopsConfig.js
git commit -m "chore(finops): scaffold Budget tab — spec, plan, env var, shared config"
```

---

### Task 1: Backend — analytics client + `/finops/health`

**Files:**
- Create: `portkey-finops.js`
- Modify: `portkey-routes.js` (register routes near the MCP route registration)

**Interfaces:**
- Produces: `registerFinopsRoutes(router)`; `analyticsGet(path, params)`; `GET /api/gateway/finops/health` → `{ ok, adminKey: bool, reachable: bool }`.

- [ ] **Step 1: Create `portkey-finops.js` with the analytics helper + health handler**

```js
// Budget / FinOps backend for the AI/LLM Gateway pillar.
// Real Portkey data: Analytics API for dashboards, Admin API for budget
// enforcement on an isolated demo key, plus a bounded traffic generator.
const PK_BASE = 'https://api.portkey.ai/v1'
const ADMIN_KEY = () => process.env.PORTKEY_ADMIN_API_KEY || ''

// ISO8601 helpers (NO Date.now in workflow scripts, but this is server code — fine)
function isoRange(days) {
  const max = new Date()
  const min = new Date(max.getTime() - days * 86400000)
  return { min: min.toISOString(), max: max.toISOString() }
}

// GET a Portkey Analytics endpoint with the admin key.
async function analyticsGet(path, params = {}) {
  const url = new URL(`${PK_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v)
  const resp = await fetch(url, {
    headers: { 'x-portkey-api-key': ADMIN_KEY(), 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
  })
  if (!resp.ok) throw new Error(`analytics ${path} → HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
  return resp.json()
}

export function registerFinopsRoutes(router) {
  router.get('/finops/health', async (_req, res) => {
    const adminKey = !!ADMIN_KEY()
    let reachable = false
    if (adminKey) {
      try { await analyticsGet('/analytics/groups/ai-models', { ...isoRange(1) }); reachable = true } catch {}
    }
    res.json({ ok: adminKey && reachable, adminKey, reachable })
  })
}

export { analyticsGet, isoRange }
```

- [ ] **Step 2: Register the routes in `portkey-routes.js`**

Find where the MCP routes are registered (search `mcp`) and add alongside:

```js
import { registerFinopsRoutes } from './portkey-finops.js'
// ...after the router is created and other routes are attached:
registerFinopsRoutes(router)
```

- [ ] **Step 3: Verify**

```bash
node --check portkey-finops.js && node --check portkey-routes.js
# restart server, then:
curl -s localhost:3001/api/gateway/finops/health | python3 -m json.tool
```
Expected: `{ "ok": true, "adminKey": true, "reachable": true }` once `PORTKEY_ADMIN_API_KEY` is set (or `adminKey: false` if not yet).

- [ ] **Step 4: Commit**

```bash
git add portkey-finops.js portkey-routes.js
git commit -m "feat(finops): analytics client + /finops/health"
```

---

### Task 2: Backend — `GET /finops/overview`

**Files:**
- Modify: `portkey-finops.js`

**Interfaces:**
- Produces: `GET /api/gateway/finops/overview?range=24h|7d|30d&attr=team` →
```
{ range, kpis:{ spend, tokensIn, tokensOut, requests },
  byModel:[{ model, cost, requests }],
  series:[{ timestamp, cost }],
  attribution:[{ name, cost, requests, share }],
  generatedAt }
```

- [ ] **Step 1: Implement the overview handler** (add inside `registerFinopsRoutes`)

```js
const _cache = new Map() // key -> {at, data}
router.get('/finops/overview', async (req, res) => {
  if (!ADMIN_KEY()) return res.status(503).json({ error: 'configure_admin_key' })
  const range = ['24h','7d','30d'].includes(req.query.range) ? req.query.range : '30d'
  const days = range === '24h' ? 1 : range === '7d' ? 7 : 30
  const attrKey = ['team','_user','app'].includes(req.query.attr) ? req.query.attr : 'team'
  const ck = `${range}:${attrKey}`
  const hit = _cache.get(ck)
  if (hit && Date.now() - hit.at < 45000) return res.json(hit.data)

  const { min, max } = isoRange(days)
  const tg = { time_of_generation_min: min, time_of_generation_max: max }
  try {
    const [models, costGraph, attr] = await Promise.all([
      analyticsGet('/analytics/groups/ai-models', tg).catch(() => ({ data: [] })),
      analyticsGet('/analytics/graphs/cost', tg).catch(() => ({ data_points: [], summary: {} })),
      analyticsGet(`/analytics/groups/metadata/${attrKey}`, tg).catch(() => ({ data: [] })),
    ])
    const byModel = (models.data || []).map(m => ({
      model: m.ai_model || m.model, cost: Number(m.cost || 0), requests: Number(m.requests || 0),
    }))
    const series = (costGraph.data_points || []).map(p => ({ timestamp: p.timestamp, cost: Number(p.cost ?? p.total ?? 0) }))
    const totalCost = byModel.reduce((s, m) => s + m.cost, 0) || Number(costGraph.summary?.total || 0)
    const attribution = (attr.data || []).map(a => ({
      name: a.metadata_value, cost: Number(a.cost || 0), requests: Number(a.requests || 0),
    })).sort((x, y) => y.cost - x.cost)
    const attrTotal = attribution.reduce((s, a) => s + a.cost, 0) || 1
    attribution.forEach(a => { a.share = Math.round((a.cost / attrTotal) * 100) })
    const data = {
      range,
      kpis: {
        spend: totalCost,
        requests: byModel.reduce((s, m) => s + m.requests, 0),
        tokensIn: null, tokensOut: null, // filled if a tokens graph is available
      },
      byModel, series, attribution,
      generatedAt: new Date().toISOString(),
    }
    _cache.set(ck, { at: Date.now(), data })
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: 'analytics_failed', message: String(e?.message || e) })
  }
})
```

- [ ] **Step 2: Verify the exact analytics endpoint shapes** (external API — confirm live)

```bash
curl -s "localhost:3001/api/gateway/finops/overview?range=30d&attr=team" | python3 -m json.tool | head -40
```
Expected: JSON with `kpis.spend` > 0, non-empty `byModel`, `series`, `attribution` AFTER traffic exists (Task 4). If a graph endpoint path differs (e.g. `/analytics/graphs/cost` 404s), check the Portkey API reference and adjust the path; the `.catch()` fallbacks keep the endpoint from crashing meanwhile.

- [ ] **Step 3: Commit**

```bash
git add portkey-finops.js
git commit -m "feat(finops): /finops/overview — KPIs, by-model, time-series, attribution from Portkey analytics"
```

---

### Task 3: Backend — `GET /finops/budget` (demo-key limits + usage)

**Files:**
- Modify: `portkey-finops.js`

**Interfaces:**
- Produces: helper `ensureDemoKey()` → `{ id, key, usage_limits }`; `GET /api/gateway/finops/budget` →
```
{ creditLimit, alertThreshold, periodicReset, used, pct, currency:'USD' }
```
- Demo key name constant: `FINOPS_DEMO_KEY_NAME = 'sudo-finops-demo'`.

- [ ] **Step 1: Implement demo-key management + budget read**

```js
const FINOPS_DEMO_KEY_NAME = 'sudo-finops-demo'
const DEMO_CAP_USD = Number(process.env.FINOPS_DEMO_CAP_USD || 1) // small cap so it trips fast

async function adminFetch(path, opts = {}) {
  const resp = await fetch(`${PK_BASE}${path}`, {
    ...opts,
    headers: { 'x-portkey-api-key': ADMIN_KEY(), 'Content-Type': 'application/json', ...(opts.headers || {}) },
    signal: AbortSignal.timeout(30000),
  })
  const text = await resp.text()
  let body; try { body = JSON.parse(text) } catch { body = text }
  if (!resp.ok) throw new Error(`admin ${path} → HTTP ${resp.status}: ${String(text).slice(0, 200)}`)
  return body
}

// Find or create the isolated demo key with a small cost cap.
async function ensureDemoKey() {
  const list = await adminFetch('/api-keys?page_size=100').catch(() => ({ data: [] }))
  const existing = (list.data || []).find(k => k.name === FINOPS_DEMO_KEY_NAME)
  if (existing) return existing
  return adminFetch('/api-keys/workspace/service', {
    method: 'POST',
    body: JSON.stringify({
      name: FINOPS_DEMO_KEY_NAME,
      type: 'workspace', sub_type: 'service', scopes: ['completions.write'],
      usage_limits: { type: 'cost', credit_limit: DEMO_CAP_USD, periodic_reset: 'monthly', alert_threshold: Math.max(1, Math.floor(DEMO_CAP_USD * 0.8)) },
    }),
  })
}

router.get('/finops/budget', async (_req, res) => {
  if (!ADMIN_KEY()) return res.status(503).json({ error: 'configure_admin_key' })
  try {
    const key = await ensureDemoKey()
    const lim = (key.usage_limits || {})
    const used = Number(key.usage?.cost ?? key.used ?? 0)
    const creditLimit = Number(lim.credit_limit ?? DEMO_CAP_USD)
    res.json({
      creditLimit, alertThreshold: lim.alert_threshold ?? null,
      periodicReset: lim.periodic_reset ?? 'monthly',
      used, pct: creditLimit ? Math.min(100, Math.round((used / creditLimit) * 100)) : 0,
      currency: 'USD',
    })
  } catch (e) {
    res.status(502).json({ error: 'budget_failed', message: String(e?.message || e) })
  }
})
```

- [ ] **Step 2: Verify the Admin key endpoints** (external API — confirm live; the create path/shape may need adjusting to the live Portkey Admin API)

```bash
curl -s localhost:3001/api/gateway/finops/budget | python3 -m json.tool
```
Expected: `{ creditLimit: 1, periodicReset: "monthly", used: <n>, pct: <n>, ... }`. If `/api-keys/workspace/service` create path differs, adjust to the documented Portkey "create API key" endpoint and re-verify. Confirm the demo key appears in the Portkey console with the cost cap.

- [ ] **Step 3: Commit**

```bash
git add portkey-finops.js
git commit -m "feat(finops): /finops/budget — isolated demo key with cost cap"
```

---

### Task 4: Backend — `POST /finops/generate` (SSE traffic generator)

**Files:**
- Modify: `portkey-finops.js`

**Interfaces:**
- Consumes: the existing Portkey chat path. Reuse `buildClient`/streaming OR call the gateway's own `/chat` internally. Simplest: import the Portkey SDK client builder from `portkey-routes.js` if exported, else POST to `localhost` chat. Decision: add a small `finopsChat(model, prompt, metadata)` in `portkey-finops.js` using the Portkey SDK directly (no guardrail config needed — use the integration slug as provider) so spend + metadata land in analytics.
- Produces: `POST /api/gateway/finops/generate` body `{ maxRequests?, models? }` → SSE `event: step` per request, `event: done`.

- [ ] **Step 1: Implement `finopsChat` + the generator handler**

```js
import { Portkey } from 'portkey-ai'

const GEN_TEAMS = ['Platform', 'Support bot', 'Data Science', 'Marketing', 'Sandbox']
const GEN_MODELS_DEFAULT = [
  '@sudo-bedrock/us.anthropic.claude-opus-4-8',
  '@sudo-bedrock/anthropic.claude-sonnet-4-20250514-v1:0',
  '@sudo-vertexai/gemini-3.5-flash',
]
const LONG_PROMPT = 'Write a detailed, ~600-word technical explainer on how an AI gateway enforces cost budgets, with sections and examples.'

function finopsClient() {
  return new Portkey({ apiKey: process.env.PORTKEY_API_KEY, strictOpenAiCompliance: false })
}

// One tagged, token-heavy call routed by the model's @integration prefix.
async function finopsChat(model, idx) {
  const client = finopsClient()
  const team = GEN_TEAMS[idx % GEN_TEAMS.length]
  const user = `user-${(idx % 7) + 1}`
  const r = await client.withOptions({
    metadata: { _user: user, team, app: 'finops-generator', env: 'demo' },
  }).chat.completions.create({
    model, max_tokens: 1024,
    messages: [{ role: 'user', content: LONG_PROMPT }],
  })
  const usage = r?.usage || {}
  return { model, team, user, tokens: usage.total_tokens ?? null }
}

router.post('/finops/generate', async (req, res) => {
  if (!ADMIN_KEY()) return res.status(503).json({ error: 'configure_admin_key' })
  const maxRequests = Math.min(50, Math.max(1, Number(req.body?.maxRequests) || 12))
  const models = Array.isArray(req.body?.models) && req.body.models.length ? req.body.models : GEN_MODELS_DEFAULT
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.flushHeaders?.()
  const send = (event, data) => { if (!res.writableEnded) { res.write(`event: ${event}\n`); res.write(`data: ${JSON.stringify(data)}\n\n`) } }
  try {
    for (let i = 0; i < maxRequests; i++) {
      const model = models[i % models.length]
      try { const r = await finopsChat(model, i); send('step', { i: i + 1, of: maxRequests, ok: true, ...r }) }
      catch (e) { send('step', { i: i + 1, of: maxRequests, ok: false, model, error: String(e?.message || e).slice(0, 160) }) }
    }
    send('done', { generated: maxRequests })
  } finally { if (!res.writableEnded) res.end() }
})
```

- [ ] **Step 2: Verify** (spends real money — small run)

```bash
curl -s -N -X POST localhost:3001/api/gateway/finops/generate -H 'Content-Type: application/json' -d '{"maxRequests":3}' --max-time 120 | head -10
```
Expected: 3 `event: step` frames with `ok:true`, varied `team`/`model`, then `event: done`. Confirm in the Portkey console that requests appear with metadata.

- [ ] **Step 3: Commit**

```bash
git add portkey-finops.js
git commit -m "feat(finops): /finops/generate — bounded metadata-tagged traffic generator"
```

---

### Task 5: Backend — `POST /finops/enforce/run` + `/finops/enforce/reset`

**Files:**
- Modify: `portkey-finops.js`

**Interfaces:**
- Consumes: `ensureDemoKey()`, `FINOPS_DEMO_KEY_NAME`, `DEMO_CAP_USD`.
- Produces: `POST /api/gateway/finops/enforce/run` (SSE: `event: req` per attempt with `{ n, status:'allowed'|'blocked', code }`, then `event: done`); `POST /api/gateway/finops/enforce/reset` → `{ ok }`.

- [ ] **Step 1: Implement enforcement run (fire through the demo key until 412)**

```js
router.post('/finops/enforce/run', async (_req, res) => {
  if (!ADMIN_KEY()) return res.status(503).json({ error: 'configure_admin_key' })
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.flushHeaders?.()
  const send = (event, data) => { if (!res.writableEnded) { res.write(`event: ${event}\n`); res.write(`data: ${JSON.stringify(data)}\n\n`) } }
  try {
    const demo = await ensureDemoKey()
    const demoKey = demo.key || demo.api_key
    const client = new Portkey({ apiKey: demoKey, strictOpenAiCompliance: false })
    let blocked = false
    for (let n = 1; n <= 6 && !blocked; n++) {
      try {
        await client.chat.completions.create({
          model: '@sudo-bedrock/us.anthropic.claude-opus-4-8', max_tokens: 1024,
          messages: [{ role: 'user', content: LONG_PROMPT }],
        })
        send('req', { n, status: 'allowed', code: 200 })
      } catch (e) {
        // Portkey returns 412 when the budget cap is hit (no spend on block).
        const code = e?.status || e?.response?.status || (/412/.test(String(e?.message)) ? 412 : null)
        if (code === 412) { send('req', { n, status: 'blocked', code: 412 }); blocked = true }
        else send('req', { n, status: 'error', code, error: String(e?.message || e).slice(0, 160) })
      }
    }
    send('done', { blocked })
  } finally { if (!res.writableEnded) res.end() }
})

router.post('/finops/enforce/reset', async (_req, res) => {
  if (!ADMIN_KEY()) return res.status(503).json({ error: 'configure_admin_key' })
  try {
    const list = await adminFetch('/api-keys?page_size=100').catch(() => ({ data: [] }))
    const existing = (list.data || []).find(k => k.name === FINOPS_DEMO_KEY_NAME)
    if (existing?.id) await adminFetch(`/api-keys/${existing.id}`, { method: 'DELETE' })
    await ensureDemoKey()
    res.json({ ok: true })
  } catch (e) {
    res.status(502).json({ error: 'reset_failed', message: String(e?.message || e) })
  }
})
```

- [ ] **Step 2: Verify**

```bash
curl -s -N -X POST localhost:3001/api/gateway/finops/enforce/run --max-time 180 | head
# then reset:
curl -s -X POST localhost:3001/api/gateway/finops/enforce/reset | python3 -m json.tool
```
Expected: a few `status:allowed` then one `status:blocked, code:412`, then `done {blocked:true}`. Reset returns `{ok:true}`. If the cap doesn't trip within 6 requests, lower `FINOPS_DEMO_CAP_USD` (e.g. 0.25) and re-run.

- [ ] **Step 3: Commit**

```bash
git add portkey-finops.js
git commit -m "feat(finops): real 412 budget enforcement on isolated demo key + reset"
```

---

### Task 6: Frontend — tab registration + FinOpsTab skeleton + controls + data fetch

**Files:**
- Create: `src/views/llm-gateway/FinOpsTab.jsx`
- Modify: `src/views/LlmGatewayView.jsx`

**Interfaces:**
- Consumes: `GET /finops/overview`, `GET /finops/budget`, `GET /finops/health`.
- Produces: `<FinOpsTab />`; tab id `finops`.

- [ ] **Step 1: Register the tab in `LlmGatewayView.jsx`**

Add import: `import { FinOpsTab } from './llm-gateway/FinOpsTab'` and a lucide icon `Wallet`. Insert into `TABS` after `mcp`, before `guide`:
```js
{ id: 'finops', label: 'Budget', icon: Wallet },
```
Add a mounted body div (matching siblings):
```jsx
<div className="flex-1 flex-col min-h-0 overflow-hidden" style={{ display: tab === 'finops' ? 'flex' : 'none' }}>
  <FinOpsTab />
</div>
```

- [ ] **Step 2: Create `FinOpsTab.jsx` skeleton** with controls + fetch + setup/empty states

```jsx
import React, { useEffect, useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { FINOPS_RANGES, FINOPS_ATTR_KEYS } from '../../data/finopsConfig'

const ACCENT = '#ec4899'

export function FinOpsTab() {
  const { state } = useAppContext()
  const isLight = !state.isDark
  const [range, setRange] = useState('30d')
  const [attr, setAttr] = useState('team')
  const [overview, setOverview] = useState(null)
  const [budget, setBudget] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetch('/api/gateway/finops/health').then(r => r.json()).then(setHealth).catch(() => setHealth({ ok: false, adminKey: false })) }, [])
  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/gateway/finops/overview?range=${range}&attr=${attr}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/gateway/finops/budget').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([o, b]) => { setOverview(o); setBudget(b); setLoading(false) })
  }, [range, attr])

  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'

  if (health && !health.adminKey) {
    return <SetupScreen isLight={isLight} />   // mirror LlmGatewayView's unconfigured screen, mention PORTKEY_ADMIN_API_KEY
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-5">
        {/* controls: range selector + attribution toggle + Generate traffic button */}
        {/* KPI strip / charts / attribution / budget+enforcement / savings — Tasks 7-8 */}
      </div>
    </div>
  )
}
```
(Define `SetupScreen` as a small local component echoing the pillar's existing unconfigured panel, swapping the copy to reference `PORTKEY_ADMIN_API_KEY`.)

- [ ] **Step 3: Verify**

```bash
npm run build 2>&1 | tail -3
```
Expected: build OK. Visually: the Budget tab appears after MCP Registry; with admin key set it loads (empty charts until Task 7); without it, the setup screen shows. Check both light/dark.

- [ ] **Step 4: Commit**

```bash
git add src/views/llm-gateway/FinOpsTab.jsx src/views/LlmGatewayView.jsx
git commit -m "feat(finops): Budget tab registration + skeleton, controls, data fetch"
```

---

### Task 7: Frontend — KPI strip + spend-over-time + by-model (recharts)

**Files:**
- Modify: `src/views/llm-gateway/FinOpsTab.jsx`

**Interfaces:**
- Consumes: `overview.kpis`, `overview.series`, `overview.byModel`, `budget`.

- [ ] **Step 1: Add the KPI strip + charts.** Use the approved mockup (`console-v1.html`) for exact card markup/colors. KPI cards: spend (`$overview.kpis.spend`), tokens, requests, budget used (`budget.pct`% + projection). Charts via recharts:

```jsx
import { AreaChart, Area, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, XAxis } from 'recharts'
// Spend trend (area) from overview.series; By-model donut from overview.byModel.
const MODEL_COLORS = ['#ec4899', '#38bdf8', '#fbbf24', '#a78bfa', '#475569']
```
KPI strip = 4 cards in a flex row; trend area chart (flex 2) + donut (flex 1) in a row beneath, matching the mockup. Format currency with `Intl.NumberFormat('en-US',{style:'currency',currency:'USD'})`.

- [ ] **Step 2: Verify**

```bash
# generate some traffic first so there's real data:
curl -s -N -X POST localhost:3001/api/gateway/finops/generate -H 'Content-Type: application/json' -d '{"maxRequests":6}' --max-time 180 >/dev/null
npm run build 2>&1 | tail -3
```
Expected: build OK; KPI numbers populate from real analytics; trend + donut render. Check both themes (charts readable, text contrast OK).

- [ ] **Step 3: Commit**

```bash
git add src/views/llm-gateway/FinOpsTab.jsx
git commit -m "feat(finops): KPI strip + spend trend + by-model charts"
```

---

### Task 8: Frontend — attribution table + budget/enforcement panel + savings

**Files:**
- Modify: `src/views/llm-gateway/FinOpsTab.jsx`

**Interfaces:**
- Consumes: `overview.attribution`, `budget`, SSE `POST /finops/enforce/run` + `/reset`, `POST /finops/generate`.

- [ ] **Step 1: Attribution table** (from `overview.attribution`) with the `attr` toggle (team/user/app) driving the refetch; columns name, spend, share %, requests, mini-bar (mockup markup).

- [ ] **Step 2: Budget + enforcement panel (hero).** Left: cap/alert/utilization bar (green→amber→red by `budget.pct`) + projection. Right: `▶ Fire requests` button → opens an `EventSource`-style fetch stream to `/finops/enforce/run`, rendering `req n ✓` then `🔴 BLOCKED 412 budget exceeded`; `↺ Reset` → POST `/finops/enforce/reset` then refetch budget. Reuse the SSE-reading pattern from `usePortkeyChat`/MCP tab (fetch + ReadableStream reader parsing `event:`/`data:` lines).

- [ ] **Step 3: Savings cards.** Caching savings (real — derive from cache-hit data if exposed by overview; otherwise show "—" until wired) as primary; cheaper-model routing savings as a secondary card with an explicit **"estimated"** badge; total saved + % off.

- [ ] **Step 4: Add the "Generate traffic" control** in the top controls — a button that streams `/finops/generate` with a small default and shows progress + an "this spends real money" note; on completion, refetch overview/budget.

- [ ] **Step 5: Verify**

```bash
npm run build 2>&1 | tail -3
```
Expected: build OK. Live: attribution table shows real teams after generator runs; Fire requests → real 412 block; Reset works; savings cards render with the estimated badge. Check both themes.

- [ ] **Step 6: Commit**

```bash
git add src/views/llm-gateway/FinOpsTab.jsx
git commit -m "feat(finops): attribution table, real budget enforcement panel, savings, generate control"
```

---

### Task 9: Tag existing gateway traffic with metadata (attribution coverage)

**Files:**
- Modify: `portkey-routes.js`

**Interfaces:**
- The existing `/chat` and `/compare` Portkey calls attach `metadata` so ongoing demo use is attributable.

- [ ] **Step 1: Add metadata to the gateway client calls.** In `portkey-routes.js`, where the Portkey client makes the chat/compare requests, attach a `metadata` object (e.g. `{ app: 'gateway-livedemo' | 'gateway-scenarios', _user: 'demo', team: 'Platform', env: 'demo' }`) via `withOptions`/the request body, matching how `finopsChat` does it. Keep it minimal and non-breaking.

- [ ] **Step 2: Verify**

```bash
curl -s -X POST localhost:3001/api/gateway/chat -H 'Content-Type: application/json' -d '{"model":"@sudo-vertexai/gemini-3.1-flash-lite","configId":"defaults","messages":[{"role":"user","content":"hi"}]}' --max-time 60 >/dev/null
# confirm the request shows the metadata in the Portkey console / analytics
curl -s "localhost:3001/api/gateway/finops/overview?range=24h&attr=app" | python3 -m json.tool | head -20
```
Expected: attribution by `app` now includes `gateway-livedemo`/`gateway-scenarios`.

- [ ] **Step 3: Commit**

```bash
git add portkey-routes.js
git commit -m "feat(finops): tag gateway chat/compare with metadata for real attribution"
```

---

### Task 10: Docs

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `.env.example` (already has the var from Task 0)

- [ ] **Step 1: Document the new tab** in README (pillar now has 6 tabs; Budget/FinOps description) and the `PORTKEY_ADMIN_API_KEY` env var (scopes, what it powers, graceful degradation).

- [ ] **Step 2: Update `CLAUDE.md`** — add the Budget tab to the gateway-pillar description, the new endpoints under "Endpoints", the env var, the `portkey-finops.js` module, and a gotcha noting real-spend + 412 enforcement + the isolated demo key.

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md .env.example
git commit -m "docs(finops): document the Budget tab + PORTKEY_ADMIN_API_KEY"
```

---

## Self-review

- **Spec coverage:** KPI strip (T7) · spend-over-time + by-model (T7) · attribution (T2 backend, T8 UI) · budget caps + real 412 enforcement (T3/T5 backend, T8 UI) · savings incl. estimated routing badge (T8) · traffic generator with metadata (T4, T8 control) · time-range selector (T6) · tag existing traffic (T9) · env var + graceful degradation (T0/T1/T6) · docs (T10). All spec sections map to a task. ✓
- **Placeholders:** Backend steps carry full code. Frontend visual steps reference the approved mockup `console-v1.html` for exact markup (the visual source of truth from brainstorming) rather than duplicating ~300 lines — concrete, not vague. The two external-API verification points (analytics graph path in T2, admin key-create path in T3/T5) are explicitly flagged as "confirm against live Portkey API" because they depend on Portkey's current REST surface; the `.catch()` fallbacks prevent crashes during confirmation.
- **Type consistency:** `ensureDemoKey`, `FINOPS_DEMO_KEY_NAME`, `DEMO_CAP_USD`, `analyticsGet`, `isoRange`, `finopsChat`, `LONG_PROMPT` are defined once (T1/T3/T4) and reused in later tasks. Overview payload shape (T2) matches the frontend consumers (T6-T8). ✓

## Notes for the implementer
- Real spend is expected; the generator/enforcement use higher-tier models on purpose.
- Two backend spots depend on Portkey's live Admin/Analytics REST surface (key-create path, cost-graph path). Verify each with the curl step and adjust the path/body to match the current Portkey API reference if needed — the handlers are written defensively so the tab degrades gracefully meanwhile.
