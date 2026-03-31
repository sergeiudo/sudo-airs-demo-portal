# Observability Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full LLM observability layer to the AIRS demo portal — every real prompt/response is captured as a trace+spans in SQLite, visualized in a new Observability view (tabbed: Overview metrics + Trace explorer) and a compact Recent Traces section in the existing TelemetrySidebar.

**Architecture:** A singleton `TraceStore` module (better-sqlite3) is imported by `server.js`. After every `/api/chat` call, a trace + 5 spans are written to SQLite. Three new Express endpoints expose traces and aggregated metrics. A new `ObservabilityView` React view plus a `useObservability` hook consume those endpoints; the existing `TelemetrySidebar` gains a "Recent Traces" footer section.

**Tech Stack:** Node.js + Express (existing), better-sqlite3 (new), React 18 (existing), Recharts (new), Framer Motion (existing), Tailwind CSS (existing), Lucide React (existing)

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/traceStore.js` | SQLite singleton — schema init, `insertTrace()`, `insertSpan()`, `getTraces()`, `getTrace()`, `getMetrics()` |
| `src/views/ObservabilityView.jsx` | Top-level view — tab switcher (Overview / Traces), empty state |
| `src/components/observability/KpiStrip.jsx` | 5 stat cards row |
| `src/components/observability/LatencyChart.jsx` | Recharts LineChart — total / llm / airs latency over time |
| `src/components/observability/VolumeChart.jsx` | Recharts BarChart — stacked ALLOWED + BLOCKED per time bucket |
| `src/components/observability/DetectionDonut.jsx` | Recharts PieChart — threat category breakdown |
| `src/components/observability/ProviderChart.jsx` | Recharts BarChart — requests per LLM provider |
| `src/components/observability/P95Gauge.jsx` | Custom SVG arc gauge — P95 latency ms |
| `src/components/observability/TraceTable.jsx` | Filterable, paginated trace list |
| `src/components/observability/TraceDrawer.jsx` | Slide-out panel — span waterfall + detection flags |
| `src/components/observability/FilterBar.jsx` | Status / model / search filters |
| `src/hooks/useObservability.js` | Fetches `/api/traces` + `/api/traces/metrics`, auto-refreshes every 5s |

### Modified files
| File | Change |
|------|--------|
| `server.js` | Import TraceStore, write trace+spans in `/api/chat`, add 3 new GET endpoints |
| `src/context/AppContext.jsx` | Add `selectedTraceId` state + `SET_SELECTED_TRACE` action |
| `src/components/layout/Sidebar.jsx` | Add Observability nav item |
| `src/components/api-intercept/TelemetrySidebar.jsx` | Add "Recent Traces" collapsible section at bottom |
| `src/App.jsx` | Add `case 'observability'` to view switcher |
| `package.json` | Add `better-sqlite3` + `recharts` dependencies |

---

## Task 1: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install backend + frontend packages**

```bash
npm install better-sqlite3 recharts
```

Expected output: added 2 packages, no errors. `node_modules/better-sqlite3` and `node_modules/recharts` present.

- [ ] **Step 2: Verify better-sqlite3 loads**

```bash
node -e "import('better-sqlite3').then(m => console.log('ok', typeof m.default))"
```

Expected: `ok function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add better-sqlite3 and recharts dependencies"
```

---

## Task 2: TraceStore module

**Files:**
- Create: `src/traceStore.js`

- [ ] **Step 1: Create the TraceStore module**

```js
// src/traceStore.js
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'traces.db')

let _db = null

function db() {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.exec(`
    CREATE TABLE IF NOT EXISTS traces (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      prompt TEXT,
      response TEXT,
      backend TEXT,
      model TEXT,
      verdict TEXT,
      category TEXT,
      threats_detected TEXT,
      airs_enabled INTEGER,
      total_ms INTEGER,
      airs_input_ms INTEGER,
      llm_ms INTEGER,
      airs_output_ms INTEGER,
      tokens_in INTEGER,
      tokens_out INTEGER,
      profile TEXT,
      attack_label TEXT,
      attack_severity TEXT
    );
    CREATE TABLE IF NOT EXISTS spans (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL,
      status TEXT NOT NULL,
      metadata TEXT
    );
  `)
  return _db
}

export function insertTrace(t) {
  db().prepare(`
    INSERT INTO traces (id, created_at, prompt, response, backend, model, verdict, category,
      threats_detected, airs_enabled, total_ms, airs_input_ms, llm_ms, airs_output_ms,
      tokens_in, tokens_out, profile, attack_label, attack_severity)
    VALUES (@id, @created_at, @prompt, @response, @backend, @model, @verdict, @category,
      @threats_detected, @airs_enabled, @total_ms, @airs_input_ms, @llm_ms, @airs_output_ms,
      @tokens_in, @tokens_out, @profile, @attack_label, @attack_severity)
  `).run({
    id: `trace_${randomUUID()}`,
    created_at: new Date().toISOString(),
    threats_detected: JSON.stringify(t.threats_detected ?? []),
    airs_enabled: t.airs_enabled ? 1 : 0,
    ...t,
  })
  return t.id ?? `trace_${randomUUID()}`
}

export function insertSpan(s) {
  db().prepare(`
    INSERT INTO spans (id, trace_id, name, start_ms, end_ms, latency_ms, status, metadata)
    VALUES (@id, @trace_id, @name, @start_ms, @end_ms, @latency_ms, @status, @metadata)
  `).run({
    id: `span_${randomUUID()}`,
    metadata: s.metadata ? JSON.stringify(s.metadata) : null,
    ...s,
  })
}

export function getTraces({ status, model, search, limit = 50, offset = 0 } = {}) {
  let where = '1=1'
  const params = []
  if (status)  { where += ' AND verdict = ?';                params.push(status) }
  if (model)   { where += ' AND model LIKE ?';               params.push(`%${model}%`) }
  if (search)  { where += ' AND (prompt LIKE ? OR model LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
  const rows = db().prepare(
    `SELECT * FROM traces WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset)
  return rows.map(r => ({ ...r, threats_detected: JSON.parse(r.threats_detected || '[]'), airs_enabled: !!r.airs_enabled }))
}

export function getTrace(id) {
  const trace = db().prepare('SELECT * FROM traces WHERE id = ?').get(id)
  if (!trace) return null
  const spans = db().prepare('SELECT * FROM spans WHERE trace_id = ? ORDER BY start_ms ASC').all(id)
  return {
    ...trace,
    threats_detected: JSON.parse(trace.threats_detected || '[]'),
    airs_enabled: !!trace.airs_enabled,
    spans: spans.map(s => ({ ...s, metadata: s.metadata ? JSON.parse(s.metadata) : null })),
  }
}

export function getMetrics() {
  const d = db()
  const total = d.prepare('SELECT COUNT(*) as n FROM traces').get().n
  if (total === 0) return { total_requests: 0, blocked_count: 0, allowed_count: 0, block_rate_pct: 0, avg_total_ms: 0, p95_total_ms: 0, avg_llm_ms: 0, avg_airs_input_ms: 0, avg_airs_output_ms: 0, detection_breakdown: {}, provider_breakdown: {}, latency_series: [], volume_series: [] }

  const agg = d.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN verdict='BLOCKED' THEN 1 ELSE 0 END) as blocked,
      SUM(CASE WHEN verdict='ALLOWED' THEN 1 ELSE 0 END) as allowed,
      AVG(total_ms) as avg_total,
      AVG(llm_ms) as avg_llm,
      AVG(airs_input_ms) as avg_airs_in,
      AVG(airs_output_ms) as avg_airs_out
    FROM traces
  `).get()

  // P95 latency
  const allLatencies = d.prepare('SELECT total_ms FROM traces WHERE total_ms IS NOT NULL ORDER BY total_ms ASC').all().map(r => r.total_ms)
  const p95idx = Math.floor(allLatencies.length * 0.95)
  const p95 = allLatencies[p95idx] ?? 0

  // Detection breakdown — threats_detected is JSON array per row
  const threatRows = d.prepare('SELECT threats_detected FROM traces WHERE threats_detected != ?').all('[]')
  const detection_breakdown = {}
  for (const row of threatRows) {
    const threats = JSON.parse(row.threats_detected)
    for (const t of threats) {
      detection_breakdown[t] = (detection_breakdown[t] ?? 0) + 1
    }
  }

  // Provider breakdown (backend field, e.g. "vertex/gemini-2.0-flash-001" → "vertex")
  const providerRows = d.prepare('SELECT backend, COUNT(*) as n FROM traces GROUP BY backend').all()
  const provider_breakdown = {}
  for (const r of providerRows) provider_breakdown[r.backend ?? 'unknown'] = r.n

  // Time series — last 20 minutes in 1-minute buckets
  const seriesRows = d.prepare(`
    SELECT
      strftime('%H:%M', created_at) as time,
      AVG(total_ms) as total_ms,
      AVG(llm_ms) as llm_ms,
      AVG(airs_input_ms + airs_output_ms) as airs_ms,
      SUM(CASE WHEN verdict='ALLOWED' THEN 1 ELSE 0 END) as allowed,
      SUM(CASE WHEN verdict='BLOCKED' THEN 1 ELSE 0 END) as blocked
    FROM traces
    WHERE created_at >= datetime('now', '-20 minutes')
    GROUP BY strftime('%H:%M', created_at)
    ORDER BY time ASC
  `).all()

  const latency_series = seriesRows.map(r => ({ time: r.time, total_ms: Math.round(r.total_ms ?? 0), llm_ms: Math.round(r.llm_ms ?? 0), airs_ms: Math.round(r.airs_ms ?? 0) }))
  const volume_series  = seriesRows.map(r => ({ time: r.time, allowed: r.allowed, blocked: r.blocked }))

  return {
    total_requests: agg.total,
    blocked_count: agg.blocked,
    allowed_count: agg.allowed,
    block_rate_pct: agg.total > 0 ? Math.round((agg.blocked / agg.total) * 1000) / 10 : 0,
    avg_total_ms: Math.round(agg.avg_total ?? 0),
    p95_total_ms: p95,
    avg_llm_ms: Math.round(agg.avg_llm ?? 0),
    avg_airs_input_ms: Math.round(agg.avg_airs_in ?? 0),
    avg_airs_output_ms: Math.round(agg.avg_airs_out ?? 0),
    detection_breakdown,
    provider_breakdown,
    latency_series,
    volume_series,
  }
}
```

- [ ] **Step 2: Verify the module loads without errors**

```bash
node -e "import('./src/traceStore.js').then(m => { console.log('exports:', Object.keys(m).join(', ')); require('fs').unlinkSync('traces.db') }).catch(e => { console.error(e); process.exit(1) })"
```

Expected: `exports: insertTrace, insertSpan, getTraces, getTrace, getMetrics`

- [ ] **Step 3: Commit**

```bash
git add src/traceStore.js
git commit -m "feat: add SQLite TraceStore module with traces and spans schema"
```

---

## Task 3: Wire TraceStore into server.js

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add import at top of server.js (after existing imports)**

After line 15 (`import { AzureOpenAI } from 'openai'`), add:

```js
import { insertTrace, insertSpan, getTraces, getTrace, getMetrics } from './src/traceStore.js'
```

- [ ] **Step 2: Add a helper to build and persist a trace from a completed chat call**

Add this function after the `buildTelemetry` function (around line 276):

```js
// ─── Persist trace + spans to SQLite ─────────────────────────────────────────
function persistTrace({ message, chatResponse, telemetry, backend, resolvedModelId, airsEnabled, attackMeta }) {
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const timing  = telemetry.timing ?? {}
  const llm     = telemetry.llm ?? {}
  const summary = telemetry.summary ?? {}

  const verdict   = summary.verdict ?? (airsEnabled ? 'ALLOWED' : 'DIRECT')
  const category  = summary.category ?? 'benign'
  const threats   = summary.threats_detected ?? []

  const airsInMs  = timing.airs_input_scan_ms  ?? 0
  const llmMs     = timing.llm_ms              ?? 0
  const airsOutMs = timing.airs_output_ms      ?? timing.airs_output_scan_ms ?? 0
  const totalMs   = timing.total_ms            ?? (airsInMs + llmMs + airsOutMs)

  try {
    insertTrace({
      id: traceId,
      prompt: message,
      response: chatResponse?.content ?? null,
      backend,
      model: backend,
      verdict,
      category,
      threats_detected: threats,
      airs_enabled: airsEnabled,
      total_ms: totalMs,
      airs_input_ms: airsInMs || null,
      llm_ms: llmMs || null,
      airs_output_ms: airsOutMs || null,
      tokens_in: llm.tokens_in ?? null,
      tokens_out: llm.tokens_out ?? null,
      profile: summary.profile ?? process.env.AIRS_PROFILE_NAME ?? null,
      attack_label: attackMeta?.label ?? null,
      attack_severity: attackMeta?.severity ?? null,
    })

    // Build spans
    const spans = []
    let cursor = 0

    spans.push({ trace_id: traceId, name: 'user_prompt_received', start_ms: 0, end_ms: 0, latency_ms: 0, status: 'success', metadata: null })

    if (airsEnabled && airsInMs) {
      spans.push({ trace_id: traceId, name: 'airs_input_scan', start_ms: cursor, end_ms: cursor + airsInMs, latency_ms: airsInMs, status: verdict === 'BLOCKED' && !llmMs ? 'blocked' : 'success', metadata: telemetry.inputScan ? { scan_id: telemetry.inputScan.scan_id, category: telemetry.inputScan.category, action: telemetry.inputScan.action } : null })
      cursor += airsInMs
    }

    if (llmMs) {
      spans.push({ trace_id: traceId, name: 'llm_inference', start_ms: cursor, end_ms: cursor + llmMs, latency_ms: llmMs, status: 'success', metadata: { model: llm.model, tokens_in: llm.tokens_in, tokens_out: llm.tokens_out } })
      cursor += llmMs
    }

    if (airsEnabled && airsOutMs) {
      spans.push({ trace_id: traceId, name: 'airs_output_scan', start_ms: cursor, end_ms: cursor + airsOutMs, latency_ms: airsOutMs, status: verdict === 'BLOCKED' && llmMs ? 'blocked' : 'success', metadata: telemetry.outputScan ? { scan_id: telemetry.outputScan.scan_id, category: telemetry.outputScan.category, action: telemetry.outputScan.action } : null })
      cursor += airsOutMs
    }

    spans.push({ trace_id: traceId, name: 'response_delivered', start_ms: cursor, end_ms: cursor, latency_ms: 0, status: verdict === 'BLOCKED' ? 'blocked' : 'success', metadata: null })

    for (const s of spans) insertSpan(s)
  } catch (err) {
    console.error('[TraceStore] Failed to persist trace:', err.message)
    // Non-fatal — don't break the chat response
  }
  return traceId
}
```

- [ ] **Step 3: Call persistTrace in the UNPROTECTED branch of /api/chat**

In the `if (!airsEnabled)` branch, just before `return res.json(...)` (around line 300), add the `persistTrace` call. The existing return block becomes:

```js
      const responsePayload = {
        summary: null,
        inputScan: null,
        outputScan: null,
        timing: { llm_ms: r.latencyMs, airs_input_scan_ms: null, airs_output_scan_ms: null, total_ms: r.latencyMs },
        llm: {
          model: modelLabel,
          latency_ms: r.latencyMs,
          tokens_in: r.tokens?.input ?? null,
          tokens_out: r.tokens?.output ?? null,
          tokens_total: r.tokens?.total ?? null,
          throughput_tps: (r.tokens?.output && r.latencyMs)
            ? Math.round((r.tokens.output / r.latencyMs) * 1000) : null,
          finish_reason: r.finishReason ?? null,
        },
        chatResponse: { role: 'assistant', content: r.text, blocked: false, block_reason: null },
      }
      persistTrace({ message, chatResponse: responsePayload.chatResponse, telemetry: responsePayload, backend, resolvedModelId, airsEnabled: false, attackMeta: req.body.attackMeta ?? null })
      return res.json(responsePayload)
```

- [ ] **Step 4: Call persistTrace in the PROTECTED branch of /api/chat**

In the protected branch, replace the final `return res.json(buildTelemetry(...))` line (around line 353) with:

```js
    const telemetry = buildTelemetry({ airsPromptScan, airsResponseScan, llmLatencyMs, modelLabel, llmText, llmTokens, llmFinishReason })
    persistTrace({ message, chatResponse: telemetry.chatResponse, telemetry, backend, resolvedModelId, airsEnabled: true, attackMeta: req.body.attackMeta ?? null })
    return res.json(telemetry)
```

Also replace the early-return block when the prompt is blocked (around line 331):

```js
    if (airsPromptScan.data.action === 'block') {
      const telemetry = buildTelemetry({ airsPromptScan, airsResponseScan: null, llmLatencyMs: null, modelLabel, llmText: null, llmTokens: null, llmFinishReason: null })
      persistTrace({ message, chatResponse: telemetry.chatResponse, telemetry, backend, resolvedModelId, airsEnabled: true, attackMeta: req.body.attackMeta ?? null })
      return res.json(telemetry)
    }
```

- [ ] **Step 5: Add the 3 new GET endpoints (add before the `app.listen` call)**

```js
// ─── GET /api/traces ──────────────────────────────────────────────────────────
app.get('/api/traces', (req, res) => {
  try {
    const { status, model, search, limit = '50', offset = '0' } = req.query
    const traces = getTraces({ status, model, search, limit: parseInt(limit), offset: parseInt(offset) })
    res.json({ traces, total: traces.length })
  } catch (err) {
    console.error('[traces] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/traces/metrics ──────────────────────────────────────────────────
app.get('/api/traces/metrics', (req, res) => {
  try {
    res.json(getMetrics())
  } catch (err) {
    console.error('[traces/metrics] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /api/traces/:id ──────────────────────────────────────────────────────
app.get('/api/traces/:id', (req, res) => {
  try {
    const trace = getTrace(req.params.id)
    if (!trace) return res.status(404).json({ error: 'trace not found' })
    res.json(trace)
  } catch (err) {
    console.error('[traces/:id] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
```

**Important:** These 3 endpoints MUST be placed BEFORE the `app.get('/api/traces/:id')` route — but note `/api/traces/metrics` must come before `/api/traces/:id` so Express doesn't match `metrics` as the `:id` param. Order in server.js: `/api/traces` → `/api/traces/metrics` → `/api/traces/:id`.

- [ ] **Step 6: Smoke-test the new endpoints**

```bash
# Start the server in one terminal:
npm run server

# In another terminal, send a test chat (no AIRS):
curl -s -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"hello","backend":"vertex","airsEnabled":false}' | head -c 200

# Then check the trace was stored:
curl -s http://localhost:3001/api/traces | python3 -m json.tool | head -30
curl -s http://localhost:3001/api/traces/metrics | python3 -m json.tool
```

Expected: `/api/traces` returns `{"traces":[{...}],"total":1}`. `/api/traces/metrics` returns `{"total_requests":1,...}`.

- [ ] **Step 7: Commit**

```bash
git add server.js
git commit -m "feat: wire TraceStore into /api/chat and add /api/traces endpoints"
```

---

## Task 4: AppContext — add selectedTraceId

**Files:**
- Modify: `src/context/AppContext.jsx`

- [ ] **Step 1: Update AppContext to add selectedTraceId**

Replace the entire file content with:

```jsx
import React, { createContext, useContext, useReducer } from 'react'

const AppContext = createContext(null)

const initialState = {
  isProtected: false,
  activeView: 'home',
  scmUrl: null,
  isDark: false,
  selectedTraceId: null,
}

function appReducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_PROTECTION':
      return { ...state, isProtected: !state.isProtected }
    case 'SET_VIEW':
      return { ...state, activeView: action.payload }
    case 'SET_SCM_URL':
      return { ...state, scmUrl: action.payload }
    case 'TOGGLE_THEME':
      return { ...state, isDark: !state.isDark }
    case 'SET_SELECTED_TRACE':
      return { ...state, selectedTraceId: action.payload }
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add src/context/AppContext.jsx
git commit -m "feat: add selectedTraceId state and SET_SELECTED_TRACE action to AppContext"
```

---

## Task 5: useObservability hook

**Files:**
- Create: `src/hooks/useObservability.js`

- [ ] **Step 1: Create the hook**

```js
// src/hooks/useObservability.js
import { useState, useEffect, useCallback } from 'react'

export function useObservability() {
  const [metrics, setMetrics]     = useState(null)
  const [traces, setTraces]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [filters, setFilters]     = useState({ status: '', model: '', search: '' })

  const fetchData = useCallback(async () => {
    try {
      const qs = new URLSearchParams()
      if (filters.status) qs.set('status', filters.status)
      if (filters.model)  qs.set('model',  filters.model)
      if (filters.search) qs.set('search', filters.search)
      qs.set('limit', '100')

      const [metricsRes, tracesRes] = await Promise.all([
        fetch('/api/traces/metrics'),
        fetch(`/api/traces?${qs}`),
      ])
      if (metricsRes.ok) setMetrics(await metricsRes.json())
      if (tracesRes.ok)  setTraces((await tracesRes.json()).traces ?? [])
    } catch (err) {
      console.error('[useObservability] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Initial fetch + 5s auto-refresh
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  return { metrics, traces, loading, filters, setFilters, refresh: fetchData }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useObservability.js
git commit -m "feat: add useObservability hook with 5s auto-refresh"
```

---

## Task 6: KpiStrip component

**Files:**
- Create: `src/components/observability/KpiStrip.jsx`

- [ ] **Step 1: Create KpiStrip**

```jsx
// src/components/observability/KpiStrip.jsx
import React from 'react'
import { Activity, Clock, TrendingUp, ShieldX, Zap } from 'lucide-react'

function KpiCard({ label, value, sub, icon: Icon, color = 'text-slate-200', bgColor = 'bg-white/[0.04]', borderColor = 'border-white/[0.08]' }) {
  return (
    <div className={`flex flex-col gap-2 p-4 rounded-2xl border ${bgColor} ${borderColor} flex-1 min-w-0`}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">
          <Icon size={14} className={color} />
        </div>
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold truncate">{label}</span>
      </div>
      <span className={`text-3xl font-bold font-mono leading-none ${color}`}>{value ?? '—'}</span>
      {sub && <span className="text-[10px] text-slate-600">{sub}</span>}
    </div>
  )
}

export function KpiStrip({ metrics }) {
  if (!metrics) return null
  return (
    <div className="flex gap-3">
      <KpiCard
        label="Total Requests"
        value={metrics.total_requests}
        sub="all time"
        icon={Activity}
        color="text-slate-200"
      />
      <KpiCard
        label="Avg Latency"
        value={metrics.avg_total_ms ? `${metrics.avg_total_ms}ms` : '—'}
        sub="end-to-end"
        icon={Clock}
        color="text-blue-400"
        bgColor="bg-blue-500/[0.06]"
        borderColor="border-blue-500/20"
      />
      <KpiCard
        label="P95 Latency"
        value={metrics.p95_total_ms ? `${metrics.p95_total_ms}ms` : '—'}
        sub="95th percentile"
        icon={TrendingUp}
        color="text-violet-400"
        bgColor="bg-violet-500/[0.06]"
        borderColor="border-violet-500/20"
      />
      <KpiCard
        label="Blocked"
        value={metrics.blocked_count}
        sub={`${metrics.block_rate_pct ?? 0}% block rate`}
        icon={ShieldX}
        color="text-red-400"
        bgColor="bg-red-500/[0.06]"
        borderColor="border-red-500/20"
      />
      <KpiCard
        label="Detection Rate"
        value={metrics.total_requests > 0 ? `${metrics.block_rate_pct}%` : '—'}
        sub="threats caught"
        icon={Zap}
        color="text-emerald-400"
        bgColor="bg-emerald-500/[0.06]"
        borderColor="border-emerald-500/20"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/observability/KpiStrip.jsx
git commit -m "feat: add KpiStrip observability component"
```

---

## Task 7: Chart components

**Files:**
- Create: `src/components/observability/LatencyChart.jsx`
- Create: `src/components/observability/VolumeChart.jsx`
- Create: `src/components/observability/DetectionDonut.jsx`
- Create: `src/components/observability/ProviderChart.jsx`
- Create: `src/components/observability/P95Gauge.jsx`

- [ ] **Step 1: Create LatencyChart**

```jsx
// src/components/observability/LatencyChart.jsx
import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export function LatencyChart({ data = [] }) {
  if (!data.length) return <div className="flex items-center justify-center h-40 text-slate-700 text-sm">No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} unit="ms" width={48} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#94a3b8' }}
        />
        <Legend wrapperStyle={{ fontSize: 10, color: '#64748b' }} />
        <Line type="monotone" dataKey="total_ms" stroke="#94a3b8" strokeWidth={2} dot={false} name="Total" />
        <Line type="monotone" dataKey="llm_ms"   stroke="#60a5fa" strokeWidth={2} dot={false} name="LLM" />
        <Line type="monotone" dataKey="airs_ms"  stroke="#34d399" strokeWidth={2} dot={false} name="AIRS" />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Create VolumeChart**

```jsx
// src/components/observability/VolumeChart.jsx
import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export function VolumeChart({ data = [] }) {
  if (!data.length) return <div className="flex items-center justify-center h-40 text-slate-700 text-sm">No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#94a3b8' }}
        />
        <Legend wrapperStyle={{ fontSize: 10, color: '#64748b' }} />
        <Bar dataKey="allowed" stackId="a" fill="#34d399" fillOpacity={0.8} name="Allowed" radius={[0,0,0,0]} />
        <Bar dataKey="blocked" stackId="a" fill="#ef4444" fillOpacity={0.8} name="Blocked" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Create DetectionDonut**

```jsx
// src/components/observability/DetectionDonut.jsx
import React from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#ef4444', '#f97316', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24']

export function DetectionDonut({ breakdown = {} }) {
  const data = Object.entries(breakdown).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
  if (!data.length) return <div className="flex items-center justify-center h-40 text-slate-700 text-sm">No detections yet</div>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />)}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
        />
        <Legend wrapperStyle={{ fontSize: 10, color: '#64748b' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 4: Create ProviderChart**

```jsx
// src/components/observability/ProviderChart.jsx
import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const PROVIDER_COLORS = { vertex: '#60a5fa', bedrock: '#f97316', azure: '#a78bfa', direct: '#94a3b8' }

export function ProviderChart({ breakdown = {} }) {
  const data = Object.entries(breakdown).map(([name, value]) => ({ name, value }))
  if (!data.length) return <div className="flex items-center justify-center h-40 text-slate-700 text-sm">No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Requests">
          {data.map((entry, i) => <Cell key={i} fill={PROVIDER_COLORS[entry.name] ?? '#64748b'} fillOpacity={0.85} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 5: Create P95Gauge**

```jsx
// src/components/observability/P95Gauge.jsx
import React from 'react'

export function P95Gauge({ p95Ms = 0, avgMs = 0 }) {
  // Arc from -140deg to +140deg (280deg sweep), max scale = 3000ms
  const MAX = 3000
  const pct = Math.min(p95Ms / MAX, 1)
  const RADIUS = 60
  const STROKE = 10
  const cx = 80
  const cy = 80
  const startAngle = -220
  const sweepDeg = 260
  const endAngle = startAngle + sweepDeg * pct

  function polarToXY(angleDeg, r) {
    const rad = (angleDeg * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  function arcPath(fromDeg, toDeg, r) {
    const start = polarToXY(fromDeg, r)
    const end   = polarToXY(toDeg, r)
    const large = toDeg - fromDeg > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`
  }

  const color = p95Ms > 2000 ? '#ef4444' : p95Ms > 1000 ? '#f97316' : '#34d399'

  return (
    <div className="flex flex-col items-center justify-center">
      <svg width={160} height={140} viewBox="0 0 160 140">
        {/* Track */}
        <path d={arcPath(startAngle, startAngle + sweepDeg, RADIUS)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE} strokeLinecap="round" />
        {/* Value arc */}
        {pct > 0 && (
          <path d={arcPath(startAngle, endAngle, RADIUS)} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
        )}
        {/* Center text */}
        <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={22} fontWeight="bold" fontFamily="monospace">
          {p95Ms > 0 ? `${p95Ms}` : '—'}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#475569" fontSize={10}>ms P95</text>
        <text x={cx} y={cy + 28} textAnchor="middle" fill="#334155" fontSize={9}>avg {avgMs}ms</text>
      </svg>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/observability/LatencyChart.jsx \
        src/components/observability/VolumeChart.jsx \
        src/components/observability/DetectionDonut.jsx \
        src/components/observability/ProviderChart.jsx \
        src/components/observability/P95Gauge.jsx
git commit -m "feat: add chart components (latency, volume, detection donut, provider, P95 gauge)"
```

---

## Task 8: FilterBar + TraceTable

**Files:**
- Create: `src/components/observability/FilterBar.jsx`
- Create: `src/components/observability/TraceTable.jsx`

- [ ] **Step 1: Create FilterBar**

```jsx
// src/components/observability/FilterBar.jsx
import React from 'react'
import { Search, X } from 'lucide-react'

export function FilterBar({ filters, setFilters }) {
  const set = (key, val) => setFilters(prev => ({ ...prev, [key]: val }))
  const clear = () => setFilters({ status: '', model: '', search: '' })
  const hasFilters = filters.status || filters.model || filters.search

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status filter */}
      <select
        value={filters.status}
        onChange={e => set('status', e.target.value)}
        className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-teal-500/40"
      >
        <option value="">All statuses</option>
        <option value="BLOCKED">BLOCKED</option>
        <option value="ALLOWED">ALLOWED</option>
        <option value="DIRECT">DIRECT</option>
      </select>

      {/* Model filter */}
      <select
        value={filters.model}
        onChange={e => set('model', e.target.value)}
        className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-300 text-xs focus:outline-none focus:border-teal-500/40"
      >
        <option value="">All providers</option>
        <option value="vertex">Vertex AI</option>
        <option value="bedrock">Bedrock</option>
        <option value="azure">Azure</option>
      </select>

      {/* Search */}
      <div className="relative flex-1 min-w-[160px]">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          type="text"
          placeholder="Search prompts..."
          value={filters.search}
          onChange={e => set('search', e.target.value)}
          className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-300 text-xs placeholder-slate-700 focus:outline-none focus:border-teal-500/40"
        />
      </div>

      {hasFilters && (
        <button onClick={clear} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 border border-white/[0.06] hover:border-white/[0.12] transition-colors">
          <X size={10} /> Clear
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create TraceTable**

```jsx
// src/components/observability/TraceTable.jsx
import React from 'react'
import { ShieldX, ShieldCheck, Zap, AlertTriangle } from 'lucide-react'

function VerdictBadge({ verdict }) {
  if (verdict === 'BLOCKED') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/20 border border-red-500/30 text-red-400">
      <ShieldX size={8} /> BLOCKED
    </span>
  )
  if (verdict === 'ALLOWED') return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
      <ShieldCheck size={8} /> ALLOWED
    </span>
  )
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/[0.06] border border-white/[0.08] text-slate-500">
      <Zap size={8} /> DIRECT
    </span>
  )
}

export function TraceTable({ traces, selectedId, onSelect }) {
  if (!traces.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
        <AlertTriangle size={20} className="text-slate-700" />
      </div>
      <p className="text-sm text-slate-600">No traces match the current filters</p>
    </div>
  )

  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_120px_90px_80px_80px_100px] gap-3 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
        {['Prompt', 'Model', 'Verdict', 'Total', 'LLM', 'Time'].map(h => (
          <span key={h} className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{h}</span>
        ))}
      </div>
      {/* Rows */}
      {traces.map(trace => (
        <button
          key={trace.id}
          onClick={() => onSelect(trace.id)}
          className={`w-full grid grid-cols-[1fr_120px_90px_80px_80px_100px] gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 text-left transition-colors hover:bg-white/[0.04] ${selectedId === trace.id ? 'bg-teal-500/[0.07] border-l-2 border-l-teal-500/50' : ''}`}
        >
          <span className="text-xs text-slate-400 truncate pr-2">
            {trace.attack_label
              ? <><span className="text-orange-400 font-semibold mr-1.5">[{trace.attack_label}]</span>{trace.prompt?.slice(0, 60)}</>
              : trace.prompt?.slice(0, 80) ?? '—'}
            {trace.prompt?.length > 80 ? '…' : ''}
          </span>
          <span className="text-[10px] text-slate-500 font-mono truncate">{trace.backend ?? '—'}</span>
          <span><VerdictBadge verdict={trace.verdict} /></span>
          <span className="text-[10px] font-mono text-slate-400">{trace.total_ms != null ? `${trace.total_ms}ms` : '—'}</span>
          <span className="text-[10px] font-mono text-blue-400">{trace.llm_ms != null ? `${trace.llm_ms}ms` : '—'}</span>
          <span className="text-[9px] text-slate-600">{new Date(trace.created_at).toLocaleTimeString()}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/observability/FilterBar.jsx src/components/observability/TraceTable.jsx
git commit -m "feat: add FilterBar and TraceTable observability components"
```

---

## Task 9: TraceDrawer — span waterfall slide-out

**Files:**
- Create: `src/components/observability/TraceDrawer.jsx`

- [ ] **Step 1: Create TraceDrawer**

```jsx
// src/components/observability/TraceDrawer.jsx
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldX, ShieldCheck, Zap, AlertTriangle, ChevronDown } from 'lucide-react'

const SPAN_COLORS = {
  user_prompt_received: { bar: 'bg-slate-500',   text: 'text-slate-400',   label: 'User Prompt' },
  airs_input_scan:      { bar: 'bg-emerald-500',  text: 'text-emerald-400', label: 'AIRS Input Scan' },
  llm_inference:        { bar: 'bg-blue-500',     text: 'text-blue-400',    label: 'LLM Inference' },
  airs_output_scan:     { bar: 'bg-violet-500',   text: 'text-violet-400',  label: 'AIRS Output Scan' },
  response_delivered:   { bar: 'bg-teal-500',     text: 'text-teal-400',    label: 'Response Delivered' },
}

function SpanWaterfall({ spans }) {
  if (!spans?.length) return null
  const totalMs = spans.reduce((max, s) => Math.max(max, s.end_ms), 1)

  return (
    <div className="space-y-2">
      {spans.map(span => {
        const cfg    = SPAN_COLORS[span.name] ?? { bar: 'bg-slate-600', text: 'text-slate-400', label: span.name }
        const left   = totalMs > 0 ? (span.start_ms / totalMs) * 100 : 0
        const width  = totalMs > 0 ? Math.max((span.latency_ms / totalMs) * 100, span.latency_ms > 0 ? 1 : 0) : 0
        const isBlocked = span.status === 'blocked'

        return (
          <div key={span.id} className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.bar} ${isBlocked ? 'ring-1 ring-red-500' : ''}`} />
                <span className={`font-semibold ${cfg.text}`}>{cfg.label}</span>
                {isBlocked && <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-[8px] font-bold"><AlertTriangle size={7} />BLOCKED</span>}
              </div>
              <span className="font-mono text-slate-500">{span.latency_ms > 0 ? `${span.latency_ms}ms` : '—'}</span>
            </div>
            {/* Waterfall bar */}
            <div className="h-4 rounded bg-white/[0.04] relative overflow-hidden">
              {span.latency_ms > 0 && (
                <motion.div
                  className={`absolute top-0 h-full rounded ${cfg.bar} opacity-70`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              )}
            </div>
          </div>
        )
      })}
      {/* Total row */}
      <div className="flex items-center justify-between text-[10px] pt-2 border-t border-white/[0.06]">
        <span className="text-slate-600 font-semibold">Total round-trip</span>
        <span className="font-mono font-bold text-slate-300">{totalMs}ms</span>
      </div>
    </div>
  )
}

export function TraceDrawer({ traceId, onClose }) {
  const [trace, setTrace] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    if (!traceId) return
    setLoading(true)
    fetch(`/api/traces/${traceId}`)
      .then(r => r.json())
      .then(setTrace)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [traceId])

  return (
    <AnimatePresence>
      {traceId && (
        <motion.div
          key="drawer"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed top-0 right-0 bottom-0 w-[480px] bg-slate-950 border-l border-white/10 z-50 flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08] flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-300">Trace Detail</div>
              <div className="text-[9px] font-mono text-slate-600 truncate mt-0.5">{traceId}</div>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center transition-colors">
              <X size={12} className="text-slate-400" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {loading && <div className="text-center text-slate-600 text-sm py-8">Loading trace...</div>}
            {!loading && trace && (
              <>
                {/* Verdict hero */}
                <div className={`p-4 rounded-xl border ${trace.verdict === 'BLOCKED' ? 'bg-red-500/10 border-red-500/30' : trace.verdict === 'ALLOWED' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.04] border-white/[0.08]'}`}>
                  <div className="flex items-center gap-3">
                    {trace.verdict === 'BLOCKED' ? <ShieldX size={20} className="text-red-400" /> : trace.verdict === 'ALLOWED' ? <ShieldCheck size={20} className="text-emerald-400" /> : <Zap size={20} className="text-slate-400" />}
                    <div>
                      <div className={`text-sm font-bold ${trace.verdict === 'BLOCKED' ? 'text-red-300' : trace.verdict === 'ALLOWED' ? 'text-emerald-300' : 'text-slate-300'}`}>{trace.verdict}</div>
                      <div className="text-[10px] text-slate-500">{trace.category} · {trace.backend} · {new Date(trace.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  {trace.threats_detected?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {trace.threats_detected.map(t => (
                        <span key={t} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-[9px] font-bold text-red-300 uppercase tracking-wide">
                          <AlertTriangle size={7} />{t.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prompt */}
                <div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-wider font-bold mb-2">Prompt</div>
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 leading-relaxed max-h-28 overflow-y-auto">{trace.prompt}</div>
                </div>

                {/* Span waterfall */}
                <div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-wider font-bold mb-3">Pipeline Trace</div>
                  <SpanWaterfall spans={trace.spans} />
                </div>

                {/* Attack meta */}
                {trace.attack_label && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/[0.07] border border-orange-500/20">
                    <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-orange-300">{trace.attack_label}</div>
                      <div className="text-[10px] text-orange-500/70">{trace.attack_severity} severity</div>
                    </div>
                  </div>
                )}

                {/* Raw JSON toggle */}
                <div>
                  <button
                    onClick={() => setShowRaw(v => !v)}
                    className="flex items-center gap-2 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    <motion.div animate={{ rotate: showRaw ? 180 : 0 }} transition={{ duration: 0.18 }}>
                      <ChevronDown size={12} />
                    </motion.div>
                    Raw JSON
                  </button>
                  {showRaw && (
                    <pre className="mt-2 p-3 rounded-lg bg-black/40 border border-white/[0.06] text-[9px] text-slate-500 overflow-auto max-h-48">
                      {JSON.stringify(trace, null, 2)}
                    </pre>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/observability/TraceDrawer.jsx
git commit -m "feat: add TraceDrawer with span waterfall visualization"
```

---

## Task 10: ObservabilityView — top-level view

**Files:**
- Create: `src/views/ObservabilityView.jsx`

- [ ] **Step 1: Create ObservabilityView**

```jsx
// src/views/ObservabilityView.jsx
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, Activity, Crosshair } from 'lucide-react'
import { useObservability } from '../hooks/useObservability'
import { useAppContext } from '../context/AppContext'
import { KpiStrip } from '../components/observability/KpiStrip'
import { LatencyChart } from '../components/observability/LatencyChart'
import { VolumeChart } from '../components/observability/VolumeChart'
import { DetectionDonut } from '../components/observability/DetectionDonut'
import { ProviderChart } from '../components/observability/ProviderChart'
import { P95Gauge } from '../components/observability/P95Gauge'
import { FilterBar } from '../components/observability/FilterBar'
import { TraceTable } from '../components/observability/TraceTable'
import { TraceDrawer } from '../components/observability/TraceDrawer'

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart2 },
  { id: 'traces',   label: 'Traces',   icon: Activity },
]

function ChartCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">{title}</div>
      {children}
    </div>
  )
}

function EmptyState({ dispatch }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center py-24">
      <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
        <BarChart2 size={32} className="text-slate-700" />
      </div>
      <div>
        <p className="text-base font-semibold text-slate-400">No traces yet</p>
        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed max-w-xs">Send your first prompt in API Intercept to start capturing live telemetry</p>
      </div>
      <button
        onClick={() => dispatch({ type: 'SET_VIEW', payload: 'apiIntercept' })}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 text-sm font-semibold hover:bg-teal-500/20 transition-colors"
      >
        <Crosshair size={14} /> Go to API Intercept
      </button>
    </div>
  )
}

export function ObservabilityView() {
  const [activeTab, setActiveTab]       = useState('overview')
  const [selectedTraceId, setSelectedTraceId] = useState(null)
  const { metrics, traces, loading, filters, setFilters } = useObservability()
  const { dispatch, state } = useAppContext()

  // If a trace was pre-selected from the TelemetrySidebar, open it
  React.useEffect(() => {
    if (state.selectedTraceId) {
      setSelectedTraceId(state.selectedTraceId)
      setActiveTab('traces')
      dispatch({ type: 'SET_SELECTED_TRACE', payload: null })
    }
  }, [state.selectedTraceId])

  const isEmpty = !loading && metrics?.total_requests === 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.08] flex-shrink-0">
        <BarChart2 size={16} className="text-teal-400" />
        <span className="text-sm font-semibold text-slate-300">Observability</span>

        {/* Tab switcher */}
        <div className="flex gap-1 ml-4 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-teal-500/20 border border-teal-500/30 text-teal-400'
                  : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <tab.icon size={11} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Live indicator */}
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
          Live · refreshes every 5s
        </div>
      </div>

      {/* Body */}
      {isEmpty ? (
        <EmptyState dispatch={dispatch} />
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Overview tab */}
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <KpiStrip metrics={metrics} />
              <div className="grid grid-cols-2 gap-4">
                <ChartCard title="Latency over time (ms)">
                  <LatencyChart data={metrics?.latency_series ?? []} />
                </ChartCard>
                <ChartCard title="Request volume">
                  <VolumeChart data={metrics?.volume_series ?? []} />
                </ChartCard>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <ChartCard title="Detection breakdown">
                  <DetectionDonut breakdown={metrics?.detection_breakdown ?? {}} />
                </ChartCard>
                <ChartCard title="LLM provider distribution">
                  <ProviderChart breakdown={metrics?.provider_breakdown ?? {}} />
                </ChartCard>
                <ChartCard title="P95 latency">
                  <P95Gauge p95Ms={metrics?.p95_total_ms ?? 0} avgMs={metrics?.avg_total_ms ?? 0} />
                </ChartCard>
              </div>
            </motion.div>
          )}

          {/* Traces tab */}
          {activeTab === 'traces' && (
            <motion.div key="traces" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <FilterBar filters={filters} setFilters={setFilters} />
              <TraceTable traces={traces} selectedId={selectedTraceId} onSelect={setSelectedTraceId} />
            </motion.div>
          )}
        </div>
      )}

      {/* Slide-out drawer */}
      <TraceDrawer traceId={selectedTraceId} onClose={() => setSelectedTraceId(null)} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/ObservabilityView.jsx
git commit -m "feat: add ObservabilityView with tabbed Overview + Traces layout"
```

---

## Task 11: Wire up nav + App routing

**Files:**
- Modify: `src/components/layout/Sidebar.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Add Observability nav item to Sidebar.jsx**

In `Sidebar.jsx`, add `BarChart2` to the existing lucide-react import:

```js
import { Crosshair, ScanSearch, Swords, Terminal, Settings, Activity, ExternalLink, BarChart2 } from 'lucide-react'
```

Then add this item to the `NAV_ITEMS` array (after the `claudeHooks` entry):

```js
  {
    id: 'observability',
    label: 'Observability',
    sublabel: 'LLM trace explorer',
    icon: BarChart2,
    color: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30', bar: 'bg-teal-400' },
  },
```

- [ ] **Step 2: Add Observability case to App.jsx**

In `src/App.jsx`, add the import:

```js
import { ObservabilityView } from './views/ObservabilityView'
```

And add the case to the `renderView` switch:

```js
      case 'observability':    return <ObservabilityView />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.jsx src/App.jsx
git commit -m "feat: add Observability nav item and route to App"
```

---

## Task 12: Enhance TelemetrySidebar with Recent Traces

**Files:**
- Modify: `src/components/api-intercept/TelemetrySidebar.jsx`

- [ ] **Step 1: Add import for useAppContext and the missing Clock import at the top of TelemetrySidebar.jsx**

The existing file imports `Clock` from lucide-react but it's not in the import list — add it (and `History`):

Find the existing import line:
```js
import {
  ChevronDown, Activity, Cpu, Hash,
  Zap, ArrowDownToLine, ArrowUpFromLine,
  AlertTriangle, CheckCircle2, ShieldX, ShieldCheck,
  Layers, FileCode,
} from 'lucide-react'
```

Replace with:
```js
import {
  ChevronDown, Activity, Cpu, Hash,
  Zap, ArrowDownToLine, ArrowUpFromLine,
  AlertTriangle, CheckCircle2, ShieldX, ShieldCheck,
  Layers, FileCode, Clock, History,
} from 'lucide-react'
```

Also add this import after the existing imports:
```js
import { useAppContext } from '../../context/AppContext'
```

- [ ] **Step 2: Add a RecentTraces component inside TelemetrySidebar.jsx (add before the main export)**

```jsx
// ─── Recent Traces mini-list ───────────────────────────────────────────────────
function RecentTraces() {
  const { dispatch } = useAppContext()
  const [traces, setTraces] = React.useState([])

  React.useEffect(() => {
    const load = () =>
      fetch('/api/traces?limit=5')
        .then(r => r.ok ? r.json() : { traces: [] })
        .then(d => setTraces(d.traces ?? []))
        .catch(() => {})
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [])

  if (!traces.length) return (
    <p className="text-[10px] text-slate-700 py-2 text-center">No traces yet</p>
  )

  const goToTrace = (traceId) => {
    dispatch({ type: 'SET_SELECTED_TRACE', payload: traceId })
    dispatch({ type: 'SET_VIEW', payload: 'observability' })
  }

  return (
    <div className="space-y-1">
      {traces.map(t => (
        <button
          key={t.id}
          onClick={() => goToTrace(t.id)}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors group text-left"
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.verdict === 'BLOCKED' ? 'bg-red-500' : t.verdict === 'ALLOWED' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
          <span className="flex-1 text-[10px] text-slate-500 truncate group-hover:text-slate-400 transition-colors">
            {t.attack_label ?? t.prompt?.slice(0, 32) ?? '—'}
          </span>
          <span className="text-[9px] font-mono text-slate-700">{t.total_ms != null ? `${t.total_ms}ms` : ''}</span>
        </button>
      ))}
      <button
        onClick={() => dispatch({ type: 'SET_VIEW', payload: 'observability' })}
        className="w-full text-center text-[9px] text-teal-600 hover:text-teal-400 transition-colors pt-1"
      >
        View all in Observability →
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Add the Recent Traces section to the TelemetrySidebar JSX**

In the `TelemetrySidebar` component's return block, add this section just before the closing `</div>` of the scrollable body (the `flex-1 overflow-y-auto` div), after the Dev Corner section:

```jsx
        {/* ── Recent Traces ── */}
        <Section title="Recent Traces" icon={History} iconColor="text-teal-400" defaultOpen={false}>
          <RecentTraces />
        </Section>
```

- [ ] **Step 4: Verify the app starts without errors**

```bash
npm run dev
```

Open `http://localhost:5173`. Check browser console for errors. Navigate to API Intercept, send one message, then navigate to Observability — confirm the trace appears.

- [ ] **Step 5: Commit**

```bash
git add src/components/api-intercept/TelemetrySidebar.jsx
git commit -m "feat: add Recent Traces section to TelemetrySidebar"
```

---

## Task 13: Add traces.db to .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add traces.db to .gitignore**

```bash
echo "traces.db" >> .gitignore
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore traces.db SQLite file"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Trace + Span model → Task 2 (TraceStore schema)
- ✅ Metrics (total, avg, P95, blocked, detection rate, provider, error) → Task 2 `getMetrics()`, Task 6 KpiStrip, Task 7 charts
- ✅ Timeline view per request → Task 9 TraceDrawer SpanWaterfall
- ✅ Table of recent traces with filtering → Task 8 TraceTable + FilterBar
- ✅ Drill-down view → Task 9 TraceDrawer
- ✅ Charts: latency, volume, detection, provider, P95 → Task 7
- ✅ Backend endpoints → Task 3
- ✅ Demo-friendly empty state + CTA → Task 10 EmptyState
- ✅ Live data only, no mock → TraceStore writes only on real `/api/chat` calls
- ✅ Attack metadata captured → `persistTrace` reads `req.body.attackMeta`
- ✅ Recent Traces in TelemetrySidebar → Task 12
- ✅ AppContext `SET_SELECTED_TRACE` → Task 4, used in Task 9 + Task 12

**Type/name consistency:**
- `insertTrace` / `insertSpan` / `getTraces` / `getTrace` / `getMetrics` — consistent across Task 2 and Task 3 import
- `selectedTraceId` — consistent across AppContext (Task 4), ObservabilityView (Task 10), TraceDrawer (Task 9)
- `filters` shape `{ status, model, search }` — consistent across `useObservability` (Task 5) and `FilterBar` (Task 8)
- `verdict` values `BLOCKED` / `ALLOWED` / `DIRECT` — consistent across TraceStore, TraceTable, TraceDrawer

**Note on `attackMeta`:** The frontend currently calls `/api/chat` without `attackMeta` in the body. To capture attack labels, `useAttackSimulator.js` must include `attackMeta` in the POST body. The `send()` function already has `attackMeta` in scope — it just needs to be added to the request body:

In `src/hooks/useAttackSimulator.js`, in the `fetch('/api/chat', ...)` call body, add `attackMeta: attackMeta ?? null` to the JSON body:

```js
      body: JSON.stringify({
        message: payload,
        backend,
        modelId,
        airsEnabled: isProtected,
        attackMeta: attackMeta ?? null,
      }),
```

This is a one-line change — add it as a sub-step of Task 3 or as its own small commit after Task 3.
