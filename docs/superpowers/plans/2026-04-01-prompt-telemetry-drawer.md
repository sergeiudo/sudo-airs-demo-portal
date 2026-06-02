# Prompt Telemetry Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Prompt Telemetry" button to each assistant chat bubble that opens a slide-in drawer showing the full AIRS + LLM telemetry for that specific prompt.

**Architecture:** Attach the full telemetry object to each assistant message in `useAttackSimulator` when it's created. A new `PromptTelemetryDrawer` component renders it as a slide-in panel (matching `TraceDrawer` style). Drawer state lives in `ApiInterceptView`; the open callback threads down through `ChatCenter` → `ChatMessage`.

**Tech Stack:** React, Framer Motion, Lucide icons, Tailwind CSS (no new deps)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/hooks/useAttackSimulator.js` | Modify | Attach `telemetry` object to each assistant message |
| `src/components/api-intercept/PromptTelemetryDrawer.jsx` | Create | Slide-in drawer showing verdict, metrics, latency flow, tokens |
| `src/components/api-intercept/ChatMessage.jsx` | Modify | Add "Prompt Telemetry" button to `AssistantMessage` |
| `src/components/api-intercept/ChatCenter.jsx` | Modify | Accept + pass `onOpenTelemetry` prop to each `ChatMessage` |
| `src/views/ApiInterceptView.jsx` | Modify | Manage drawer state, render `PromptTelemetryDrawer` |

---

## Telemetry shape reference

The `activeTelemetry` object (returned by `/api/chat`, built by `buildTelemetry` in `server.js`):

```js
{
  summary: {
    verdict: 'BLOCKED' | 'ALLOWED',   // null when airsEnabled: false
    action: 'block' | 'allow',
    category: string,
    threats_detected: string[],
    model: string,
    profile: string,
  },
  inputScan: { latency_ms, category, action, scan_id, profile_name, ... },
  outputScan: { latency_ms, ... } | null,
  timing: {
    airs_input_scan_ms: number,
    llm_ms: number | null,
    airs_output_scan_ms: number | null,
    total_ms: number,
  },
  llm: {
    model: string,
    latency_ms: number | null,
    tokens_in: number | null,
    tokens_out: number | null,
    tokens_total: number | null,
  },
  chatResponse: { content, blocked, block_reason },
}
```

When `airsEnabled: false`, `summary` is `null` and only `timing` + `llm` are populated.

---

### Task 1: Attach telemetry to each assistant message

**Files:**
- Modify: `src/hooks/useAttackSimulator.js`

- [ ] **Step 1: Open the file and locate the assistant message object**

In `src/hooks/useAttackSimulator.js`, find the `send` callback (around line 39). The assistant message is built at line ~79:

```js
setMessages(prev => [...prev, {
  id: `msg-${Date.now()}-assistant`,
  role: 'assistant',
  content: chatResponse?.content ?? null,
  blocked: chatResponse?.blocked ?? false,
  blockReason: chatResponse?.block_reason ?? null,
  verdict,
  riskScore: null,
  tokensIn: data.llm?.tokens_in ?? null,
  tokensOut: data.llm?.tokens_out ?? null,
  timestamp: new Date().toISOString(),
}])
```

- [ ] **Step 2: Add `telemetry` field to the assistant message**

Replace the assistant message object with:

```js
setMessages(prev => [...prev, {
  id: `msg-${Date.now()}-assistant`,
  role: 'assistant',
  content: chatResponse?.content ?? null,
  blocked: chatResponse?.blocked ?? false,
  blockReason: chatResponse?.block_reason ?? null,
  verdict,
  riskScore: null,
  tokensIn: data.llm?.tokens_in ?? null,
  tokensOut: data.llm?.tokens_out ?? null,
  timestamp: new Date().toISOString(),
  telemetry: { ...telemetry, chatResponse },
}])
```

Note: `telemetry` is already destructured from `data` two lines above (`const { chatResponse, ...telemetry } = data`), so no additional destructuring needed.

- [ ] **Step 3: Commit**

```bash
cd /Users/sudovenko/sudo-airs-local-demo-vertex-bedrock
git add src/hooks/useAttackSimulator.js
git commit -m "feat: attach telemetry object to each assistant message"
```

---

### Task 2: Create PromptTelemetryDrawer component

**Files:**
- Create: `src/components/api-intercept/PromptTelemetryDrawer.jsx`

- [ ] **Step 1: Create the file with full implementation**

Create `src/components/api-intercept/PromptTelemetryDrawer.jsx`:

```jsx
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldX, ShieldCheck, Zap, AlertTriangle, Clock, Activity, Cpu } from 'lucide-react'

// ─── VerdictBanner ────────────────────────────────────────────────────────────
function VerdictBanner({ telemetry }) {
  const verdict  = telemetry.summary?.verdict ?? 'DIRECT'
  const isBlocked = verdict === 'BLOCKED'
  const isDirect  = verdict === 'DIRECT'
  const threats   = telemetry.summary?.threats_detected ?? []
  const category  = telemetry.summary?.category ?? 'UNKNOWN'

  const styles = isBlocked
    ? { wrap: 'bg-red-500/10 border-red-500/30', icon: <ShieldX size={22} className="text-red-400" />, iconBg: 'bg-red-500/20', text: 'text-red-300', badge: 'bg-red-500/20 border-red-500/30 text-red-400' }
    : isDirect
    ? { wrap: 'bg-white/[0.04] border-white/[0.08]', icon: <Zap size={22} className="text-slate-400" />, iconBg: 'bg-white/[0.06]', text: 'text-slate-300', badge: 'bg-white/[0.06] border-white/[0.08] text-slate-500' }
    : { wrap: 'bg-emerald-500/10 border-emerald-500/30', icon: <ShieldCheck size={22} className="text-emerald-400" />, iconBg: 'bg-emerald-500/20', text: 'text-emerald-300', badge: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' }

  const modelLabel = telemetry.llm?.model ?? telemetry.summary?.model ?? '—'
  const profile    = telemetry.summary?.profile ?? null

  return (
    <div className={`p-4 rounded-2xl border ${styles.wrap}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${styles.iconBg}`}>
          {styles.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-base font-black tracking-wide ${styles.text}`}>{verdict}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate font-medium">
            {modelLabel}{profile ? ` · ${profile}` : ''}
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${styles.badge}`}>
          {category.toUpperCase()}
        </span>
      </div>

      {threats.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/[0.06]">
          {threats.map(t => (
            <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 border border-red-300 text-[9px] font-black text-slate-900 uppercase tracking-wide">
              <AlertTriangle size={7} />{t.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MetricsStrip ─────────────────────────────────────────────────────────────
function MetricsStrip({ telemetry }) {
  const timing  = telemetry.timing  ?? {}
  const airsMs  = (timing.airs_input_scan_ms ?? 0) + (timing.airs_output_scan_ms ?? 0)
  const totalMs = timing.total_ms ?? null
  const llmMs   = timing.llm_ms ?? null

  const cards = [
    totalMs != null && { label: 'Total Time',    value: totalMs, sub: 'end-to-end',   color: 'text-slate-300',  icon: Clock },
    llmMs   != null && { label: 'LLM Latency',   value: llmMs,   sub: 'inference',    color: 'text-blue-400',   icon: Cpu },
    airsMs  > 0     && { label: 'AIRS Overhead', value: airsMs,  sub: 'total scans',  color: 'text-emerald-400',icon: Activity },
  ].filter(Boolean)

  if (!cards.length) return null

  return (
    <div className="space-y-2">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cards.length}, 1fr)` }}>
        {cards.map(({ label, value, sub, color, icon: Icon }) => (
          <div key={label} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon size={11} className={color} />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{label}</span>
            </div>
            <div className={`text-xl font-black font-mono leading-none ${color}`}>
              {value.toLocaleString()}
              <span className="text-xs font-normal text-slate-500 ml-1">ms</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-medium">{sub}</div>
          </div>
        ))}
      </div>

      {/* Latency flow diagram */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.03)' }}>
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid rgba(59,130,246,0.1)', background: 'rgba(59,130,246,0.05)' }}>
          <span style={{ color: '#3b82f6', fontSize: 14 }}>ℹ</span>
          <span className="text-[11px] font-bold tracking-wide" style={{ color: '#0f172a' }}>HOW AIRS SCAN LATENCY IS MEASURED</span>
        </div>
        <div className="px-3 pt-3 pb-1">
          {[
            { n: '1', bg: '#64748b', line: 'linear-gradient(#64748b,#10b981)', bodyBg: '#f8fafc', bodyBorder: '#e2e8f0', title: 'User prompt received', titleColor: '#334155', detail: 'Message arrives at your app server · t₀ = Date.now() starts here', detailColor: '#64748b', badge: null },
            { n: '2', bg: '#10b981', line: 'linear-gradient(#10b981,#3b82f6)', bodyBg: 'rgba(16,185,129,0.06)', bodyBorder: 'rgba(16,185,129,0.25)', title: 'HTTP POST → Prisma AIRS Cloud', titleColor: '#065f46', detail: 'POST /v1/scan/sync/request · uses AIRS_BASE_URL from your config', detailColor: '#047857', badge: null },
            { n: '3', bg: '#3b82f6', line: 'linear-gradient(#3b82f6,#8b5cf6)', bodyBg: 'rgba(59,130,246,0.06)', bodyBorder: 'rgba(59,130,246,0.25)', title: 'Network transit', titleColor: '#1e40af', detail: 'TCP handshake + TLS negotiation + payload in-flight to AIRS endpoint', detailColor: '#1d4ed8', badge: { text: '~150–200ms', bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' } },
            { n: '4', bg: '#8b5cf6', line: 'linear-gradient(#8b5cf6,#f97316)', bodyBg: 'rgba(139,92,246,0.06)', bodyBorder: 'rgba(139,92,246,0.25)', title: 'AIRS ML classifiers run', titleColor: '#5b21b6', detail: 'Prompt injection · Jailbreak · DLP · Toxicity · Agent detection — all in parallel', detailColor: '#6d28d9', badge: { text: '~500–600ms', bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' } },
            { n: '5', bg: '#f97316', line: 'linear-gradient(#f97316,#14b8a6)', bodyBg: 'rgba(249,115,22,0.06)', bodyBorder: 'rgba(249,115,22,0.25)', title: 'Verdict returned to your server', titleColor: '#9a3412', detail: 'action=block|allow · category · scan_id · latencyMs = Date.now() − t₀', detailColor: '#c2410c', badge: null },
            { n: '6', bg: '#14b8a6', line: null, bodyBg: 'rgba(20,184,166,0.06)', bodyBorder: 'rgba(20,184,166,0.25)', title: 'LLM called or response suppressed', titleColor: '#0f766e', detail: 'BLOCKED → response suppressed immediately · ALLOWED → LLM inference begins', detailColor: '#0d9488', badge: null },
          ].map(({ n, bg, line, bodyBg, bodyBorder, title, titleColor, detail, detailColor, badge }) => (
            <div key={n} className="flex gap-3">
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: 28 }}>
                <div className="flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 z-10"
                  style={{ width: 22, height: 22, borderRadius: '50%', background: bg }}>
                  {n}
                </div>
                {line && <div style={{ width: 2, flex: 1, minHeight: 8, background: line, opacity: 0.5, margin: '2px auto' }} />}
              </div>
              <div className="flex-1 mb-2 px-2.5 py-2 rounded-lg text-[10px] leading-relaxed"
                style={{ background: bodyBg, border: `1px solid ${bodyBorder}` }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold" style={{ color: titleColor }}>{title}</span>
                  {badge && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                      {badge.text}
                    </span>
                  )}
                </div>
                <div className="mt-0.5" style={{ color: detailColor }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}>
          <div className="flex items-center gap-2 flex-wrap text-[11px] mb-1.5">
            <span style={{ color: '#0f172a' }}>Typical US → US:</span>
            <span className="font-black font-mono" style={{ color: '#2563eb', fontSize: 14 }}>~200ms</span>
            <span style={{ color: '#0f172a', fontSize: 10 }}>network</span>
            <span style={{ color: '#0f172a', fontWeight: 700 }}>+</span>
            <span className="font-black font-mono" style={{ color: '#7c3aed', fontSize: 14 }}>~550ms</span>
            <span style={{ color: '#0f172a', fontSize: 10 }}>AIRS processing</span>
            <span style={{ color: '#0f172a', fontWeight: 700 }}>=</span>
            <span className="font-black font-mono" style={{ color: '#059669', fontSize: 15 }}>500–900ms</span>
          </div>
          <div className="flex gap-2 flex-wrap text-[10px]" style={{ color: '#0f172a' }}>
            <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Co-located</span>
            <span>Same cloud region → network &lt;10ms</span>
            <span style={{ color: '#334155' }}>·</span>
            <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>Async mode</span>
            <span>AIRS runs parallel with LLM → off critical path</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TokenBar ─────────────────────────────────────────────────────────────────
function TokenBar({ telemetry }) {
  const tokens_in  = telemetry.llm?.tokens_in  ?? null
  const tokens_out = telemetry.llm?.tokens_out ?? null
  const llm_ms     = telemetry.llm?.latency_ms ?? null

  if (tokens_in == null && tokens_out == null) return null

  const total  = (tokens_in ?? 0) + (tokens_out ?? 0)
  const inPct  = total > 0 ? ((tokens_in ?? 0) / total) * 100 : 0
  const outPct = total > 0 ? ((tokens_out ?? 0) / total) * 100 : 0
  const tps    = (tokens_out && llm_ms) ? Math.round((tokens_out / llm_ms) * 1000) : null

  return (
    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-slate-400">Token distribution</span>
        <span className="text-[11px] font-mono font-bold text-slate-300">{total.toLocaleString()} total</span>
      </div>
      <div className="flex h-3 rounded-lg overflow-hidden bg-black/[0.06] gap-px">
        <motion.div className="bg-blue-500/80" initial={{ width: 0 }} animate={{ width: `${inPct}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
        <motion.div className="bg-violet-500/80" initial={{ width: 0 }} animate={{ width: `${outPct}%` }} transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }} />
      </div>
      <div className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
          {tokens_in ?? '—'} input tokens
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
          <span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" />
          {tokens_out ?? '—'} output tokens
        </span>
        {tps != null && (
          <span className="ml-auto text-[10px] font-bold text-slate-400">{tps} tok/s</span>
        )}
      </div>
    </div>
  )
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{children}</div>
}

// ─── PromptTelemetryDrawer (export) ──────────────────────────────────────────
export function PromptTelemetryDrawer({ telemetry, onClose }) {
  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const modelLabel = telemetry?.llm?.model ?? telemetry?.summary?.model ?? null
  const isProtected = !!telemetry?.summary

  return (
    <AnimatePresence>
      {telemetry && (
        <motion.div
          key="prompt-telemetry-drawer"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed top-0 right-0 bottom-0 w-[520px] bg-white/[0.02] border-l border-white/[0.08] z-50 flex flex-col shadow-2xl backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08] flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-300">Prompt Telemetry</div>
              {modelLabel && (
                <div className="text-[9px] font-mono text-slate-600 mt-0.5">{modelLabel}</div>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
            >
              <X size={12} className="text-slate-400" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <VerdictBanner telemetry={telemetry} />

            {modelLabel && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] w-fit">
                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-slate-400">{modelLabel}</span>
              </div>
            )}

            {isProtected && (
              <div className="space-y-2">
                <SectionLabel>Performance Metrics</SectionLabel>
                <MetricsStrip telemetry={telemetry} />
              </div>
            )}

            <div className="space-y-2">
              <SectionLabel>Token Usage</SectionLabel>
              <TokenBar telemetry={telemetry} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/sudovenko/sudo-airs-local-demo-vertex-bedrock
git add src/components/api-intercept/PromptTelemetryDrawer.jsx
git commit -m "feat: add PromptTelemetryDrawer component"
```

---

### Task 3: Add "Prompt Telemetry" button to AssistantMessage

**Files:**
- Modify: `src/components/api-intercept/ChatMessage.jsx`

- [ ] **Step 1: Add `Activity` to the lucide import and add `onOpenTelemetry` prop**

In `src/components/api-intercept/ChatMessage.jsx`, update the import line (line 2):

```js
import { ShieldX, ShieldCheck, Info, RefreshCw, ArrowDownToLine, ArrowUpFromLine, Languages, Copy, Check, Activity } from 'lucide-react'
```

- [ ] **Step 2: Add `onOpenTelemetry` prop to `AssistantMessage` signature**

Change line 163:

```jsx
function AssistantMessage({ message, onOpenTelemetry }) {
```

- [ ] **Step 3: Add the Prompt Telemetry button to the meta row**

In `AssistantMessage`, find the meta row (around line 250):

```jsx
{/* Meta row */}
<div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-600 pl-1">
  <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
  {message.tokensIn != null && (
    <span className="flex items-center gap-1 text-blue-400/60">
      <ArrowDownToLine size={9} />{message.tokensIn.toLocaleString()} in
    </span>
  )}
  {message.tokensOut != null && (
    <span className="flex items-center gap-1 text-violet-400/60">
      <ArrowUpFromLine size={9} />{message.tokensOut.toLocaleString()} out
    </span>
  )}
</div>
```

Replace with:

```jsx
{/* Meta row */}
<div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-600 pl-1">
  <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
  {message.tokensIn != null && (
    <span className="flex items-center gap-1 text-blue-400/60">
      <ArrowDownToLine size={9} />{message.tokensIn.toLocaleString()} in
    </span>
  )}
  {message.tokensOut != null && (
    <span className="flex items-center gap-1 text-violet-400/60">
      <ArrowUpFromLine size={9} />{message.tokensOut.toLocaleString()} out
    </span>
  )}
  {message.telemetry && onOpenTelemetry && (
    <button
      onClick={() => onOpenTelemetry(message.telemetry)}
      className="flex items-center gap-1 text-slate-500 hover:text-blue-400 transition-colors"
      title="View prompt telemetry"
    >
      <Activity size={9} />
      Prompt Telemetry
    </button>
  )}
</div>
```

- [ ] **Step 4: Pass `onOpenTelemetry` through the main `ChatMessage` export**

Find the export at the bottom (around line 268):

```jsx
export function ChatMessage({ message, onResend, onResendHebrew, isLoading, isTranslating }) {
  if (message.role === 'system') return <SystemMessage message={message} />
  if (message.role === 'user') return (
    <UserMessage
      message={message}
      onResend={onResend}
      onResendHebrew={onResendHebrew}
      isLoading={isLoading}
      isTranslating={isTranslating}
    />
  )
  if (message.role === 'assistant') return <AssistantMessage message={message} />
  return null
}
```

Replace with:

```jsx
export function ChatMessage({ message, onResend, onResendHebrew, isLoading, isTranslating, onOpenTelemetry }) {
  if (message.role === 'system') return <SystemMessage message={message} />
  if (message.role === 'user') return (
    <UserMessage
      message={message}
      onResend={onResend}
      onResendHebrew={onResendHebrew}
      isLoading={isLoading}
      isTranslating={isTranslating}
    />
  )
  if (message.role === 'assistant') return <AssistantMessage message={message} onOpenTelemetry={onOpenTelemetry} />
  return null
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/sudovenko/sudo-airs-local-demo-vertex-bedrock
git add src/components/api-intercept/ChatMessage.jsx
git commit -m "feat: add Prompt Telemetry button to assistant message bubble"
```

---

### Task 4: Thread onOpenTelemetry through ChatCenter

**Files:**
- Modify: `src/components/api-intercept/ChatCenter.jsx`

- [ ] **Step 1: Add `onOpenTelemetry` to `ChatCenter` props**

Find the `ChatCenter` function signature (around line 327):

```jsx
export function ChatCenter({ messages, isLoading, onSendMessage, onClear, backend, model }) {
```

Replace with:

```jsx
export function ChatCenter({ messages, isLoading, onSendMessage, onClear, backend, model, onOpenTelemetry }) {
```

- [ ] **Step 2: Pass `onOpenTelemetry` to each `ChatMessage`**

Find the `ChatMessage` render (around line 416):

```jsx
<ChatMessage
  message={msg}
  onResend={msg.role === 'user' ? () => onSendMessage(msg.content, backend, model) : undefined}
  onResendHebrew={msg.role === 'user' ? () => handleSendHebrew(msg.content) : undefined}
  isLoading={isLoading || translating === msg.content}
  isTranslating={translating === msg.content}
/>
```

Replace with:

```jsx
<ChatMessage
  message={msg}
  onResend={msg.role === 'user' ? () => onSendMessage(msg.content, backend, model) : undefined}
  onResendHebrew={msg.role === 'user' ? () => handleSendHebrew(msg.content) : undefined}
  isLoading={isLoading || translating === msg.content}
  isTranslating={translating === msg.content}
  onOpenTelemetry={onOpenTelemetry}
/>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/sudovenko/sudo-airs-local-demo-vertex-bedrock
git add src/components/api-intercept/ChatCenter.jsx
git commit -m "feat: thread onOpenTelemetry prop through ChatCenter"
```

---

### Task 5: Wire drawer state in ApiInterceptView

**Files:**
- Modify: `src/views/ApiInterceptView.jsx`

- [ ] **Step 1: Import PromptTelemetryDrawer**

Add to the existing imports at the top of `src/views/ApiInterceptView.jsx`:

```jsx
import { PromptTelemetryDrawer } from '../components/api-intercept/PromptTelemetryDrawer'
```

- [ ] **Step 2: Add drawer state**

After the existing state declarations (around line 27, after `const [isDragging, setIsDragging] = useState(false)`), add:

```jsx
const [telemetryDrawer, setTelemetryDrawer] = useState(null)
```

- [ ] **Step 3: Pass `onOpenTelemetry` to `ChatCenter`**

Find the `ChatCenter` render (around line 125):

```jsx
<ChatCenter
  messages={messages}
  isLoading={isLoading}
  onSendMessage={sendMessage}
  onClear={clearChat}
  backend={backend}
  model={model}
/>
```

Replace with:

```jsx
<ChatCenter
  messages={messages}
  isLoading={isLoading}
  onSendMessage={sendMessage}
  onClear={clearChat}
  backend={backend}
  model={model}
  onOpenTelemetry={setTelemetryDrawer}
/>
```

- [ ] **Step 4: Render `PromptTelemetryDrawer` at the end of the return**

Find the closing `</div>` of the main return (the very last line before `}`). Add the drawer just before it:

```jsx
      {/* Prompt Telemetry Drawer */}
      <PromptTelemetryDrawer
        telemetry={telemetryDrawer}
        onClose={() => setTelemetryDrawer(null)}
      />
    </div>
  )
}
```

So the full closing section looks like:

```jsx
      {/* Right: Telemetry — resizable */}
      <div
        className="flex-shrink-0 overflow-hidden bg-base-900/30"
        style={{ width: sidebarWidth }}
      >
        <TelemetrySidebar telemetry={activeTelemetry} />
      </div>

      {/* Prompt Telemetry Drawer */}
      <PromptTelemetryDrawer
        telemetry={telemetryDrawer}
        onClose={() => setTelemetryDrawer(null)}
      />
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/sudovenko/sudo-airs-local-demo-vertex-bedrock
git add src/views/ApiInterceptView.jsx
git commit -m "feat: wire PromptTelemetryDrawer state in ApiInterceptView"
```

---

## Manual verification

After all tasks are complete:

1. Start the app: `npm run dev`
2. Go to API Intercept view
3. Send a message (with AIRS protection **on**)
4. Check assistant bubble meta row — "Prompt Telemetry" button should appear
5. Click it — drawer slides in from the right showing: BLOCKED/ALLOWED banner, model pill, performance metrics, latency flow diagram, token bar
6. Press `Escape` or click X — drawer closes
7. Send a second message — click "Prompt Telemetry" on the **first** message — confirms per-message telemetry works independently
8. Send a message with AIRS **off** (Direct mode) — click "Prompt Telemetry" — drawer shows DIRECT verdict, only token bar (no AIRS metrics)
