# AI/LLM Gateway Pillar — Guided Demo Redesign

**Date:** 2026-06-20
**Status:** Approved (design)
**Pillar:** AI/LLM Gateway (`src/views/LlmGatewayView.jsx` + `src/views/llm-gateway/`)

## Goal

Turn the AI/LLM Gateway pillar into a state-of-the-art, self-explanatory demo for
customers and partners. It must tell one clear story across three flows:

1. **No gateway** — traffic goes straight to the model, no inspection.
2. **Portkey gateway + native guardrails** — business/data policy (PII redaction, code
   detection, banned words).
3. **Portkey + Prisma AIRS** — adds AI-native threat protection (prompt injection,
   jailbreak, dangerous content, DLP, malicious URLs).

A customer should understand the value progression without a presenter narrating it.

## Grounding (verified behavior)

These outcomes were verified live via `/api/gateway/compare` on 2026-06-20 and drive
all scenario explanations:

- **Benign** prompt → all three lanes ALLOW (scanning is transparent).
- **Banned word ("Kokomoko") / source code** → no-gateway answers; **Portkey native
  BLOCKS** (`default.contains` / `default.containsCode`); AIRS allows.
- **PII request** → no-gateway leaks synthetic PII; Portkey native **redacts** (`portkey.pii`).
- **Prompt injection / jailbreak** → no-gateway + native PASS; **AIRS BLOCKS**
  (`panw-prisma-airs.intercept`).

The existing `explainPerLane` text in `llmGatewayAttacks.js` is stale (it assumes native
catches almost nothing) and will be rewritten to match the above.

Any per-lane outcome not in the verified list (e.g. PII through the AIRS lane, dangerous
content) is confirmed by a live `/api/gateway/compare` run during implementation **before**
the explainer text is finalized — no claim ships unverified.

## Tab structure

`LlmGatewayView.jsx` gains two tabs. Final order:

`Overview · Scenarios · Live Demo · Integration Guide`

All tabs stay mounted (existing pattern) so switching preserves state mid-demo.

## 1. Overview tab — `src/views/llm-gateway/OverviewTab.jsx` (new)

Static, scrollable, theme-aware (reactive via `useAppContext().state.isDark`), centered
max-width. Pink accent `#ec4899`. Three blocks:

- **What is an AI/LLM Gateway?** — one short paragraph: a single control point in front
  of every model call where guardrails inspect each request and response.
- **The 3 flows** — three side-by-side `FlowCard`s, each with a mini flow diagram
  `prompt → [input scan] → model → [output scan] → response`, a "catches" list, and a
  "misses" list:
  1. No gateway — app → model directly, zero inspection.
  2. Portkey + native — PII redaction, code detection, banned words.
  3. Portkey + AIRS — adds prompt injection, jailbreak, dangerous content, DLP, URLs.
- **How to read the demo** — legend for the 3 lanes, verdicts
  (ALLOWED / BLOCKED / REDACTED), the two-stage (input/output) scan, and the trace
  deep-link into the Observability pillar. Ends with a pointer to the Scenarios tab.

## 2. Scenarios tab — `src/views/llm-gateway/ScenariosTab.jsx` (new)

- Top: `ModelPicker` (defaults to first catalog model, `gemini-3.1-flash-lite`).
- Three collapsible groups (see data model below), each with 2–3 `ScenarioCard`s.
- **Click a scenario card → auto-runs `POST /api/gateway/compare`** with that prompt and
  the selected model. While running, show a per-lane loading state.
- On result, render a `ScenarioResult`: three `LaneCard`s (reused) + a "What this
  demonstrates" blurb + a "Why each lane behaved this way" 3-column explainer.
- Reuses `LaneCard`, `GuardrailVerdictCard`, `parseHookResults`.
- No backend change — `/api/gateway/compare` already returns lane verdicts + hook results.

## 3. Scenario data — rewrite `src/data/llmGatewayAttacks.js`

Restructure into three groups with accurate per-lane explanations. Shape per scenario:

```
{ id, group, label, severity, prompt,
  whatItDemonstrates: string,
  explainPerLane: { 'no-guardrail', 'defaults', 'airs' } }
```

Groups and scenarios:

- **Baseline / benign**
  - Simple Q&A (e.g. "Explain OAuth2 client credentials in 3 sentences.") → all allow.
- **Business & Data Policy** (Portkey native shines)
  - PII record request (SSN/CC/DOB/address) → native redacts.
  - Banned competitor word (contains "Kokomoko"/"Chekpoint") → native blocks.
  - Source-code request → native blocks (Contains Code).
- **AI-Native Threats** (AIRS shines)
  - Prompt injection (instruction override) → AIRS blocks.
  - Jailbreak (DAN persona) → AIRS blocks.
  - Dangerous content (harmful how-to) → AIRS blocks.

The existing `LLM_GATEWAY_ATTACK_CATEGORIES` export is replaced by the grouped structure;
the Live Demo tab and `CompareBlock` are updated to consume it.

## 4. Model selection

- `MODEL_CATALOG` in `portkey-routes.js` lists both `gemini-3.1-flash-lite` and
  `gemini-3.5-flash` (the latter labeled as a reasoning/premium model).
- **Requires a manual Portkey change:** remove `override_params` from both demo configs
  (`sudo-demo-portal-portkey`, `sudo-demo-portal-airs-portkey`) so the per-request model
  drives all three lanes. Without this, the picker would only affect the no-gateway lane.
- After the configs are updated, verify Portkey honors the per-request model. If the
  `@sudo-vertexai/` prefix causes a routing error, strip it to the bare model name for the
  Portkey lanes in `portkey-routes.js`.
- `gemini-3.x` models are global-only; the direct (no-gateway) lane already routes them
  through the `global` OpenAI-compatible endpoint via `callDirectVertex`.

## 5. Live Demo tab — light touch

Stays the freeform playground. Its left "Attack Library" re-points at the new grouped
scenario data; the `CompareBlock` "why each lane" callout keeps working against the
rewritten `explainPerLane`.

## Components

Reuse: `LaneCard`, `GuardrailVerdictCard`, `parseHookResults`, `ModelPicker`.
New, defined locally per the pillar's component-reuse convention:
- `FlowCard` (Overview 3-flow cards)
- `ScenarioCard`, `ScenarioResult` (Scenarios tab)

## Out of scope (YAGNI)

- No step-through "cinematic" single-lane reveal mode (chose one-click auto-run).
- No new backend endpoints (`/api/gateway/compare` suffices).
- No new regions or provider integrations.
- No changes to Integration Guide tab content.

## Manual steps required (outside code) — ALL DONE & VERIFIED 2026-06-20

1. ✅ `override_params` removed from both demo configs (`sudo-demo-portal-portkey` →
   `pg-sudo-p-c7e4ad`; `sudo-demo-portal-airs-portkey` → `pg-sudo-a-c3bfdd`).
2. ✅ `gemini-3.1-flash-lite` and `gemini-3.5-flash` provisioned on the `sudo-vertexai`
   integration, region `global`; native guardrail checks corrected.
3. ✅ Verified live: both models pass all three lanes with the correct guardrail firing
   per lane (`portkey.*` on native, `panw-prisma-airs.intercept` on AIRS). Model picker
   now drives every lane.

Code already landed (supports the above): `MODEL_CATALOG` lists both models;
`callDirectVertex` routes `gemini-3.x` via the `global` endpoint; health no longer
requires Bedrock.
