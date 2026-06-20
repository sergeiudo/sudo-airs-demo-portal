# Integration Guide redesign — design

**Date:** 2026-06-20
**Status:** Approved
**Files:** `src/views/llm-gateway/GuideTab.jsx`, `src/data/llmGatewayGuideSnippets.js`

## Goal
Turn the AI/LLM Gateway "Integration Guide" tab from a generic curl/Node/Python ×
5-step matrix into a **use-case-driven reference** that serves three audiences at once
(devs implementing it · Sergei answering "how did you build X" · prospects gauging effort).
Every snippet must be accurate to the current workspace and, where possible, the **real
code in this repo**.

## Per-section format (the "mix")
Each section renders:
1. **What / when** — 1–2 plain sentences.
2. **Generic snippet** — language-tabbed. `curl · Node · Python` for genuine SDK calls
   (guarded chat, streaming, AIRS scan); `curl · Node` for repo-internal ones (SSE
   handler, 3-lane, MCP loop, frontend).
3. **📁 In this repo** — the real code with a `file · function` label, in a distinct box.

## The 8 sections
1. **Setup & client init** — `.env` (real config IDs: AIRS `pc-sudo-t-5a505b`, native
   `pc-sudo-d-a72af9`, `@sudo-vertexai`, model `gemini-3.1-flash-lite`) + the two
   non-obvious flags: `strictOpenAiCompliance:false` (to receive `hook_results`) and the
   key's **Allow Config Override = ON** (to pass a config per request). Repo:
   `portkey-routes.js · buildClient()`.
2. **Guarded chat + read verdicts** — one chat call through a config; swap the config slug
   = native ↔ AIRS; allowed → `hook_results.before/after_request_hooks[].verdict===true`,
   blocked → SDK throws (message is JSON with `hook_results`). Repo: `runLane()` +
   `extractAirsScan()`.
3. **Streaming** — SSE; `hook_results` arrive as dedicated chunks (input before first
   token, output after last); cache (`x-portkey-cache-status`) + trace
   (`x-portkey-trace-id`) headers; blocked path. Repo: `POST /chat`.
4. **No gateway (direct)** — unprotected baseline; gemini-3.x is `global`-only → Vertex
   OpenAI-compatible endpoint with `google/` prefix. Repo: `callDirectVertex()` /
   `server.js · callVertexMaaS()`. (curl · Node)
5. **3-lane comparison** — same prompt → no-gateway / native / AIRS in parallel
   (`Promise.all`). Repo: `POST /compare`. (curl · Node)
6. **MCP Registry tool-calling** — two ways: (a) Portkey Responses API
   `tools:[{type:'mcp', server_url, require_approval:'never'}]`; (b) the agentic loop
   (`initialize → tools/list → model tool_calls → tools/call → answer`). Repo:
   `portkey-mcp.js · mcpRpc/vertexTurn/mcpChatHandler`. (curl · Node)
7. **Standalone AIRS scan** — guard any pipeline at the edges, independent of Portkey;
   two-stage (`prompt`, then `prompt+response`); `data.action === 'block'`. Repo:
   `server.js · airscan()`. (curl · Node · Python)
8. **Frontend: consuming the SSE** — parse `token` / `hooks` / `metadata` / `blocked`
   events in the browser. Repo: `usePortkeyChat.js`. (Node/JS)

## UI
- **Layout:** left **table-of-contents rail** (resizable per the repo convention —
  `useState` width + drag handle + `mousemove`/`mouseup`, pink accent) listing the 8
  sections; clicking scrolls to the section (`scrollIntoView`) and highlights the active
  one. Center column = the sections, scrollable.
- Keep the existing dark, copy-able `CodeBlock`. Per-section **language tabs** show only the
  langs that section has.
- The **📁 In this repo** block uses a distinct labeled style (file·function header) but the
  same dark code body.
- Theme-aware via `useAppContext().state.isDark`. Pink accent `#ec4899`.

## Data shape (`llmGatewayGuideSnippets.js`)
Replace `GUIDE_STEPS`/`GUIDE_SNIPPETS` with:
```
export const GUIDE_SECTIONS = [
  { id, num, title, what,            // what/when text
    snippets: [{ lang, label, code }],   // generic, language-tabbed
    repo: { file, symbol, lang, code } } // the in-repo reference (Node)
]
```
`GuideTab.jsx` consumes `GUIDE_SECTIONS`.

## Out of scope
- No backend changes (the guide only documents existing endpoints/functions).
- No new languages beyond curl/Node/Python.
- Python only where it's a real SDK call (sections 1, 2, 3, 7).
