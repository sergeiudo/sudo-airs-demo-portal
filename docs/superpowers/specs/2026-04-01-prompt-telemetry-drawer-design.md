# Prompt Telemetry Drawer — Design Spec
**Date:** 2026-04-01

## Overview

Add a "Prompt Telemetry" button to each assistant message bubble in the API Intercept chat. Clicking it opens a slide-in drawer (matching the existing TraceDrawer style) showing the full telemetry for that specific prompt: verdict banner, model pill, performance metrics, latency flow diagram, and token bar.

## Problem

`activeTelemetry` in `useAttackSimulator` is a single shared value — it only holds the most recent prompt's telemetry. Older messages have no way to retrieve their telemetry. There is no per-message telemetry storage today.

## Design

### 1. Attach telemetry to each assistant message (useAttackSimulator.js)

When building the assistant message object, attach the full telemetry payload:

```js
{
  id: `msg-${Date.now()}-assistant`,
  role: 'assistant',
  // ...existing fields...
  telemetry: { ...telemetry, chatResponse },  // NEW
}
```

This persists each prompt's telemetry for the lifetime of the chat session.

### 2. PromptTelemetryDrawer component (new file)

`src/components/api-intercept/PromptTelemetryDrawer.jsx`

- Accepts `telemetry` prop (the stored object) and `onClose`
- Reuses logic from `TraceDrawer` sub-components (VerdictBanner, MetricsStrip, latency flow steps, TokenBar) — adapted to work with the `activeTelemetry` shape rather than the `/api/traces/:id` shape
- Slide-in from right, same animation as TraceDrawer (`x: '100%'` → `x: 0`)
- Header: "Prompt Telemetry" title + close button
- Body sections (in order):
  1. Verdict banner — derived from `telemetry.summary` (BLOCKED/ALLOWED) or "DIRECT" if no AIRS
  2. Model pill — `telemetry.llm.model` / backend
  3. Performance metrics — total ms, AIRS overhead ms, LLM ms
  4. Latency flow — static 6-step diagram (same as TraceDrawer's MetricsStrip)
  5. Token bar — input/output tokens from `telemetry.llm`
- Width: `w-[520px]`, z-index above telemetry sidebar but below any global modals

### 3. "Prompt Telemetry" button on AssistantMessage (ChatMessage.jsx)

Added to the meta row below the assistant bubble (alongside timestamp and token counts):

```jsx
<button onClick={() => onOpenTelemetry(message.telemetry)}>
  <Activity size={9} /> Prompt Telemetry
</button>
```

- Only rendered when `message.telemetry` is present
- Styled as a small pill button matching the existing meta row aesthetic

### 4. Prop threading (ChatCenter.jsx → ChatMessage.jsx)

- `ChatCenter` receives an `onOpenTelemetry` callback prop from `ApiInterceptView`
- Passes it down to each `ChatMessage` as `onOpenTelemetry`
- `ChatMessage` passes it to `AssistantMessage`

### 5. Drawer state in ApiInterceptView

```jsx
const [telemetryDrawer, setTelemetryDrawer] = useState(null)
// ...
<PromptTelemetryDrawer telemetry={telemetryDrawer} onClose={() => setTelemetryDrawer(null)} />
```

Only one drawer open at a time. Opening a new prompt's telemetry replaces the current one.

## Data shape mapping

The `activeTelemetry` object returned by `/api/chat`:

| Field | Used for |
|---|---|
| `summary.verdict` | VerdictBanner verdict (BLOCKED/ALLOWED) |
| `summary.action` | VerdictBanner category |
| `inputScan.category` | Threat category tags |
| `timing.totalMs` | Total time metric |
| `timing.airsMs` | AIRS overhead metric |
| `llm.latencyMs` | LLM latency metric |
| `llm.tokens_in` | TokenBar input |
| `llm.tokens_out` | TokenBar output |
| `llm.model` | Model pill |

## Files changed

| File | Change |
|---|---|
| `src/hooks/useAttackSimulator.js` | Attach `telemetry` to each assistant message |
| `src/components/api-intercept/ChatMessage.jsx` | Add Prompt Telemetry button to AssistantMessage |
| `src/components/api-intercept/PromptTelemetryDrawer.jsx` | New component |
| `src/components/api-intercept/ChatCenter.jsx` | Accept + pass `onOpenTelemetry` prop |
| `src/views/ApiInterceptView.jsx` | State + render PromptTelemetryDrawer |

## Out of scope

- Persisting telemetry across page refresh (session memory only)
- Showing telemetry on user bubbles
- Modifying the existing right-hand TelemetrySidebar
