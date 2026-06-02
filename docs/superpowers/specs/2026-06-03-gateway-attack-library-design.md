# AI/LLM Gateway — merge Detection Showcase into Live Demo (attack library)

**Date:** 2026-06-03
**Status:** approved

## Goal
Replace the standalone "Detection Showcase" tab with an **attack-library sidebar inside the Live Demo tab**, mirroring the API Intercept view: pick an attack → it fills the chat input → send it through the selected guardrail lane.

## Scope
- **`LlmGatewayView.jsx`** — remove the `showcase` tab. Tabs become **Live Demo · Integration Guide**.
- **`LiveDemoTab.jsx`** — add an **Attack Library** section to the existing left controls panel (below model picker / guardrail switch / toggles). Reuse `LLM_GATEWAY_ATTACKS` + `LLM_GATEWAY_ATTACK_CATEGORIES` from `src/data/llmGatewayAttacks.js`. Clicking an attack sets the chat input to its `prompt` (does **not** auto-send). Left panel becomes scrollable.
- **`ShowcaseTab.jsx`** — no longer rendered. Left in the tree (and `LaneCard`, `/api/gateway/compare`) for easy restore; not deleted.

## Layout (Live Demo, after)
```
左 Controls + Attack Library  |  Center Chat  |  Right Pipeline Trace
  MODEL ▾                     |  messages     |  Client→Portkey→
  GUARDRAIL (None/Def/AIRS)   |  + input box  |  Guardrail→Vertex
  ☐ Fallback  ☐ Cache         |               |  hook_results
  [Clear chat]                |               |
  ── ATTACK LIBRARY ──        |               |
  PROMPT INJECTION            |               |
   Classic override  (click→fills input)      |
  JAILBREAK / DAN … PII … URL … CODE          |
```

## Behavior
- Click attack → `setInput(attack.prompt)`; user reviews and hits Send.
- The guardrail toggle (None / Portkey default / AIRS) determines the lane; the demo contrast comes from re-sending the same attack on different lanes.
- The 3-lane parallel `/compare` view is dropped from the UI (backend endpoint untouched).

## Non-goals
- No change to backend (`portkey-routes.js`), the chat hook (`usePortkeyChat`), or the Pipeline Trace panel.
- No deletion of `ShowcaseTab` / `LaneCard` / `compare` endpoint.

## Verification
- `npm run build` clean.
- Live Demo renders attack library; clicking an attack fills the input; sending through AIRS blocks a malicious payload and allows a benign one; no-guardrail lane streams. Detection Showcase tab is gone; Integration Guide still works.
