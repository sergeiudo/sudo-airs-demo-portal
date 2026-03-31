# Observability Dashboard — Design Spec
**Date:** 2026-03-31
**Status:** Approved
**Approach:** A — In-app SQLite store + new view

---

## Overview

Enhance the Prisma AIRS demo portal with a full LLM observability layer inspired by Langfuse. Every real prompt/response interaction is captured as a trace with spans, stored in a local SQLite database, and visualized in a new dedicated Observability view plus an enhanced TelemetrySidebar.

No mock/seed data. All traces are live — populated only by real prompts sent through the API Intercept view.

---

## Architecture

```
Browser
  └── ObservabilityView (new React view, added to sidebar nav)
        ├── Tab: Overview
        │     ├── KpiStrip         — 5 stat cards
        │     ├── LatencyChart     — Recharts LineChart (total/llm/airs over time)
        │     ├── VolumeChart      — Recharts BarChart stacked (ALLOWED/BLOCKED)
        │     ├── DetectionDonut   — Recharts PieChart (threat categories)
        │     ├── ProviderChart    — Recharts BarChart (vertex vs bedrock)
        │     └── P95Gauge         — custom SVG arc gauge
        └── Tab: Traces
              ├── FilterBar        — status, model, risk, free-text search
              ├── TraceTable       — paginated list of traces
              └── TraceDrawer      — slide-out: span waterfall + detection detail

TelemetrySidebar (existing, enhanced)
  └── New "Recent Traces" section — last 5 traces, compact rows with verdict + latency

server.js (existing, extended)
  ├── TraceStore singleton (better-sqlite3, in-process)
  │     ├── traces table
  │     ├── spans table
  │     └── events table (detections per trace)
  ├── POST /api/chat — unchanged interface, now also writes trace+spans after each call
  └── New endpoints:
        ├── GET /api/traces
        ├── GET /api/traces/metrics
        └── GET /api/traces/:id
```

**New dependencies:**
- Backend: `better-sqlite3`
- Frontend: `recharts`

---

## Data Models

### Trace (one per user interaction)

```json
{
  "id": "trace_01J9X...",
  "created_at": "2026-03-31T14:23:01.000Z",
  "prompt": "Ignore all previous instructions...",
  "response": "I can't help with that.",
  "backend": "vertex",
  "model": "gemini-2.0-flash-001",
  "verdict": "BLOCKED",
  "category": "malicious",
  "threats_detected": ["prompt_injection"],
  "airs_enabled": true,
  "total_ms": 842,
  "airs_input_ms": 124,
  "llm_ms": 680,
  "airs_output_ms": 38,
  "tokens_in": 47,
  "tokens_out": 0,
  "profile": "sudo-demo-profile",
  "attack_label": "System Prompt Override",
  "attack_severity": "critical"
}
```

### Span (one per pipeline stage per trace)

```json
{
  "id": "span_01J9X...",
  "trace_id": "trace_01J9X...",
  "name": "airs_input_scan",
  "start_ms": 0,
  "end_ms": 124,
  "latency_ms": 124,
  "status": "blocked",
  "metadata": "{\"scan_id\": \"abc123\", \"category\": \"malicious\"}"
}
```

**Span names in pipeline order:**
1. `user_prompt_received`
2. `airs_input_scan`
3. `llm_inference`
4. `airs_output_scan`
5. `response_delivered`

### Metrics response (from `/api/traces/metrics`)

```json
{
  "total_requests": 142,
  "blocked_count": 31,
  "allowed_count": 111,
  "block_rate_pct": 21.8,
  "avg_total_ms": 654,
  "p95_total_ms": 1240,
  "avg_llm_ms": 510,
  "avg_airs_input_ms": 98,
  "avg_airs_output_ms": 46,
  "detection_breakdown": {
    "prompt_injection": 18,
    "jailbreak": 7,
    "data_leakage": 4,
    "other": 2
  },
  "provider_breakdown": {
    "vertex": 89,
    "bedrock": 53
  },
  "latency_series": [
    { "time": "14:20", "total_ms": 720, "llm_ms": 580, "airs_ms": 140 }
  ],
  "volume_series": [
    { "time": "14:20", "allowed": 8, "blocked": 2 }
  ]
}
```

---

## Backend API

### Existing (modified)
- `POST /api/chat` — unchanged request/response shape. After each call, writes one trace + five spans to SQLite.

### New endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/traces` | Paginated trace list. Query params: `?status=BLOCKED&model=gemini&limit=50&offset=0&search=injection` |
| GET | `/api/traces/metrics` | Aggregated KPIs + time-series arrays for all charts |
| GET | `/api/traces/:id` | Single trace with all spans and detection events |

All endpoints return JSON. No auth required (demo context).

---

## Frontend File Structure

```
src/views/ObservabilityView.jsx

src/components/observability/
  KpiStrip.jsx           — 5 stat cards (total, avg latency, P95, blocked, detection rate)
  LatencyChart.jsx       — Recharts LineChart, 3 series: total / llm / airs
  VolumeChart.jsx        — Recharts BarChart, stacked ALLOWED + BLOCKED per time bucket
  DetectionDonut.jsx     — Recharts PieChart, threat category breakdown
  ProviderChart.jsx      — Recharts BarChart, requests per LLM provider
  P95Gauge.jsx           — custom SVG arc gauge showing P95 latency
  TraceTable.jsx         — filterable, paginated trace list
  TraceDrawer.jsx        — slide-out panel: span waterfall timeline + detection flags + raw JSON
  FilterBar.jsx          — status / model / risk / free-text filters

src/hooks/useObservability.js
  — fetches /api/traces and /api/traces/metrics
  — auto-refreshes every 5 seconds
  — exposes: { metrics, traces, selectedTrace, setSelectedTrace, filters, setFilters, loading }
```

### Sidebar nav addition (`Sidebar.jsx`)

```js
{
  id: 'observability',
  label: 'Observability',
  sublabel: 'LLM trace explorer',
  icon: BarChart2,
  color: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30', bar: 'bg-teal-400' },
}
```

### TelemetrySidebar enhancement

Add a collapsible "Recent Traces" section at the bottom showing the last 5 traces as compact rows: verdict badge + model + latency + timestamp. Clicking a row navigates to the Observability view with that trace pre-selected in the drawer.

### Empty state

When no traces exist yet, `ObservabilityView` shows a centered empty state:
> "No traces yet — send your first prompt in API Intercept to start capturing live telemetry"
> [→ Go to API Intercept] button that dispatches `SET_VIEW: 'apiIntercept'`

---

## AppContext changes

Add `SET_SELECTED_TRACE` action and `selectedTraceId` to global state so the TelemetrySidebar "Recent Traces" click can pre-open the drawer in ObservabilityView.

---

## Demo UX notes

- The Observability view auto-refreshes every 5s — metrics and trace list stay live during a demo without manual refresh.
- `TraceDrawer` shows a horizontal span waterfall (like Langfuse) with color-coded bars per stage and BLOCKED/ALLOWED/MODIFIED badges.
- Detection threats render as red pill badges (e.g. "PROMPT INJECTION BLOCKED") — high visual impact for a pre-sales audience.
- Charts use the existing dark theme palette (emerald/blue/violet/red) consistent with the rest of the portal.
- The `FilterBar` lets a presenter quickly filter to "BLOCKED only" to tell the security story, or "vertex" to focus on a specific provider.
