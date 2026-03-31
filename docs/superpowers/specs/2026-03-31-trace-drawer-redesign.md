# TraceDrawer Redesign — Design Spec
**Date:** 2026-03-31
**Status:** Approved

---

## Goal

Replace the sparse TraceDrawer with a rich, Langfuse-inspired trace detail panel: vertical pipeline flow diagram, performance metrics, token usage bar, full prompt + response, and contextual per-stage detail.

---

## Scope

Single file rewrite: `src/components/observability/TraceDrawer.jsx`

No new API endpoints needed. All data already returned by `GET /api/traces/:id`:
- `trace` fields: `id`, `prompt`, `response`, `backend`, `model`, `verdict`, `category`, `threats_detected`, `airs_enabled`, `total_ms`, `airs_input_ms`, `llm_ms`, `airs_output_ms`, `tokens_in`, `tokens_out`, `profile`, `attack_label`, `attack_severity`, `created_at`
- `trace.spans[]` fields: `id`, `name`, `start_ms`, `end_ms`, `latency_ms`, `status`, `metadata`

---

## Layout (top → bottom, 600px wide)

### 1. Header
- Trace ID (monospace, truncated) + "Trace Detail" label
- Close (×) button
- Width: 600px (up from 480px)

### 2. Verdict Banner
- Large colored card (green=ALLOWED, red=BLOCKED, slate=DIRECT)
- Icon (ShieldCheck / ShieldX / Zap) + verdict text + category badge
- Sub-line: `backend · model · timestamp`
- Threat pills rendered inline below if `threats_detected.length > 0`

### 3. Performance Metrics (3-card row)
| Card | Value | Sub |
|------|-------|-----|
| Total Time | `total_ms` ms | end-to-end |
| LLM Latency | `llm_ms` ms | inference |
| AIRS Overhead | `airs_input_ms + airs_output_ms` ms | total scans |

Only render cards where value is non-null.

### 4. Token Usage Bar
- Horizontal bar split: blue = `tokens_in`, violet = `tokens_out`
- Label: `tokens_in + tokens_out` total
- Throughput: `Math.round((tokens_out / llm_ms) * 1000)` tok/s (only when both present)
- Omit entire section if `tokens_in` and `tokens_out` are both null

### 5. Pipeline Flow Diagram
Vertical node-connector layout. Each span becomes a node:

```
● [dot]    [stage name]              [timing badge]
│           [1-line context detail]
│           [mini relative-width bar]
● [dot]    ...
```

**Node colors per span name:**
- `user_prompt_received` → slate
- `airs_input_scan` → emerald
- `llm_inference` → blue
- `airs_output_scan` → violet
- `response_delivered` → teal

**Per-node content card details:**
- `user_prompt_received`: "Message sent to protected endpoint"
- `airs_input_scan`: "action: [allow|block] · profile: [profile name]" + scan_id if available
- `llm_inference`: "[model] · [tokens_in] in / [tokens_out] out · stop: [finish_reason]"
- `airs_output_scan`: "action: [allow|block] · no threats / N threats"
- `response_delivered`: "Clean response returned" or "Blocked — response suppressed"

**Blocked spans:** red ring on dot + red "BLOCKED" badge inline.

**Mini bar:** shows `latency_ms / totalMs * 100%` width, same color as dot. Hidden for 0ms spans.

**Connector lines:** colored gradient between nodes (top node color → bottom node color). Hidden after last node.

### 6. Prompt
- Section label: "PROMPT"
- Scrollable bubble, max-height 120px, fade at bottom
- Font: monospace, 12px

### 7. LLM Response
- Only shown when `trace.response` is not null (i.e. not blocked)
- Section label: "RESPONSE"
- Same bubble style but green tint background
- Max-height 120px, fade

### 8. Attack Meta
- Orange card with AlertTriangle icon
- Shows `attack_label` + `attack_severity` badge
- Only rendered when `trace.attack_label` is set

### 9. Raw JSON Toggle
- Collapsible, chevron rotates
- `pre` block, max-height 200px, scrollable
- At the very bottom

---

## Component Structure

```
TraceDrawer (export)
  ├── useEffect: fetch trace on traceId change, clear stale state
  ├── VerdictBanner (internal)
  ├── MetricsStrip (internal)
  ├── TokenBar (internal)
  ├── PipelineFlow (internal)
  │     └── FlowNode (internal, renders one span)
  ├── MessageBubble (internal, reused for prompt + response)
  └── RawJsonToggle (internal)
```

---

## Light/Dark Theme

All colors use Tailwind opacity classes (`bg-white/[0.04]`, `border-white/10`, `text-slate-400`) or semantic color tokens (`bg-emerald-500/10`, `text-red-400`) so they respond correctly to the existing `html.light` CSS overrides in `globals.css`.

Avoid hardcoded `bg-slate-950` — use `bg-white/[0.02]` for section backgrounds, consistent with the rest of the observability components.

---

## Non-Goals

- No new backend endpoints
- No pagination or trace navigation (next/prev)
- No editing or annotation
