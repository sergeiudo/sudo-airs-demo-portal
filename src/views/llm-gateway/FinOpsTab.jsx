import React, { useEffect, useRef, useState } from 'react'
import { Wallet, RotateCcw, Send } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { BUDGET_MODELS, BUDGET_TOKEN_CAP } from '../../data/finopsConfig'

const ACCENT = '#ec4899'
const GREEN  = '#34d399'
const AMBER  = '#f59e0b'
const RED    = '#ef4444'
const FMT_USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// ─── Setup screen ─────────────────────────────────────────────────────────────
function SetupScreen({ isLight }) {
  const text  = isLight ? '#0f172a' : '#e2e8f0'
  const muted = isLight ? '#475569' : '#94a3b8'
  const codeBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-xl p-6 rounded-2xl text-center"
           style={{ background: `${ACCENT}0f`, border: `1px solid ${ACCENT}66` }}>
        <Wallet size={32} style={{ color: ACCENT, margin: '0 auto 12px' }} />
        <h2 className="text-lg font-bold mb-2" style={{ color: text }}>
          Portkey Admin API key required
        </h2>
        <p className="text-[12px] mb-4" style={{ color: muted }}>
          The Budget &amp; FinOps tab reads cost analytics from the Portkey Admin API.
          Add your Admin key to{' '}
          <code className="px-1 rounded" style={{ background: codeBg }}>.env</code>{' '}
          as{' '}
          <code className="px-1 rounded" style={{ background: codeBg }}>PORTKEY_ADMIN_API_KEY</code>,
          then restart the dev server.
        </p>
        <a href="https://app.portkey.ai/api-keys" target="_blank" rel="noreferrer"
           className="inline-block px-4 py-2 rounded-lg text-[12px] font-bold"
           style={{ background: ACCENT, color: '#fff' }}>
          Open Portkey API Keys
        </a>
      </div>
    </div>
  )
}

// ─── Budget bar (mini, for model chips) ───────────────────────────────────────
function MiniBar({ used, cap, isLight }) {
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0
  const color = pct >= 100 ? RED : pct >= 80 ? AMBER : GREEN
  const trackBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  return (
    <div style={{ height: 4, borderRadius: 2, background: trackBg, overflow: 'hidden', width: '100%', marginTop: 4 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s ease' }} />
    </div>
  )
}

// ─── Active budget meter (prominent) ──────────────────────────────────────────
function ActiveMeter({ model, used, cap, est, isLight }) {
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0
  const color = pct >= 100 ? RED : pct >= 80 ? AMBER : GREEN
  const trackBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  const exhausted = pct >= 100

  return (
    <div className="rounded-xl p-4"
         style={{
           background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
           border: `1px solid ${exhausted ? `${RED}66` : `${ACCENT}33`}`,
         }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold" style={{ color: textPrimary }}>
          {model.label}
          <span className="ml-2 text-[9px] font-normal px-1.5 py-0.5 rounded"
                style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', color: textSecondary }}>
            {model.vendor}
          </span>
        </span>
        <span className="text-[11px] font-mono" style={{ color }}>
          {used.toLocaleString()} / {cap.toLocaleString()} tok
          {est > 0 && (
            <span className="ml-2 text-[10px]" style={{ color: textSecondary }}>
              (~{FMT_USD.format(est)})
            </span>
          )}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: trackBg, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s ease' }} />
      </div>
      <div className="mt-1.5 text-[10px]" style={{ color: exhausted ? RED : textSecondary }}>
        {exhausted
          ? 'Budget exhausted — reset or switch model'
          : `${pct.toFixed(0)}% used`}
      </div>
    </div>
  )
}

// ─── Tiny markdown renderer (whitespace-preserving, links, bold) ───────────────
function RenderMd({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
      {lines.map((line, i) => {
        // Bold: **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        return (
          <React.Fragment key={i}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : <span key={j}>{part}</span>
            )}
            {i < lines.length - 1 && '\n'}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Chat message bubble ───────────────────────────────────────────────────────
function ChatBubble({ msg, isLight, modelLabel }) {
  const isUser    = msg.role === 'user'
  const isBlocked = msg.role === 'blocked'
  const textPrimary   = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[70%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px]"
             style={{ background: ACCENT, color: '#fff' }}>
          <RenderMd text={msg.text} />
        </div>
      </div>
    )
  }

  if (isBlocked) {
    return (
      <div className="flex justify-start mb-3">
        <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px]"
             style={{ background: `${RED}18`, border: `1px solid ${RED}55`, color: RED }}>
          🛑 Budget exceeded for <strong>{modelLabel}</strong> — the gateway rejected this request (HTTP 412).
          Switch model or reset its budget.
        </div>
      </div>
    )
  }

  // Assistant
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px]"
           style={{
             background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)',
             border: `1px solid ${isLight ? 'rgba(0,48,135,0.10)' : 'rgba(255,255,255,0.08)'}`,
             color: textPrimary,
           }}>
        <RenderMd text={msg.text} />
        {(msg.tokensUsed || msg.estCost) && (
          <div className="mt-1.5 text-[9px]" style={{ color: textSecondary }}>
            {msg.tokensUsed ? `${msg.tokensUsed.toLocaleString()} tokens` : ''}
            {msg.tokensUsed && msg.estCost ? ' · ' : ''}
            {msg.estCost ? FMT_USD.format(msg.estCost) : ''}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function FinOpsTab() {
  const { state } = useAppContext()
  const isLight = !state.isDark

  // Setup guard
  const [health, setHealth] = useState(null)
  useEffect(() => {
    fetch('/api/gateway/finops/health')
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false, adminKey: false, reachable: false }))
  }, [])

  // Chat state
  const [active,       setActive]       = useState(BUDGET_MODELS[0].id)
  const [messages,     setMessages]     = useState([])
  const [usedByModel,  setUsedByModel]  = useState({})
  const [estByModel,   setEstByModel]   = useState({})
  const [sending,      setSending]      = useState(false)
  const [input,        setInput]        = useState('')
  const [latestCap,    setLatestCap]    = useState(BUDGET_TOKEN_CAP)

  const messagesEndRef = useRef(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // ── Send handler ───────────────────────────────────────────────────────────
  const send = async () => {
    const prompt = input.trim()
    if (!prompt || sending) return
    setMessages(m => [...m, { role: 'user', text: prompt, model: active }])
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/gateway/finops/devchat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: active, prompt }),
      })
      const d = await res.json()
      if (d.blocked) {
        setMessages(m => [...m, { role: 'blocked', model: active }])
        setUsedByModel(u => ({ ...u, [active]: (d.cap ?? latestCap) }))
      } else if (d.error) {
        setMessages(m => [...m, { role: 'assistant', text: `⚠ ${d.error}`, model: active }])
      } else {
        if (d.cap != null) setLatestCap(d.cap)
        setMessages(m => [...m, {
          role: 'assistant',
          text: d.answer,
          model: active,
          tokensUsed: d.tokensUsed,
          estCost: d.estCost,
        }])
        setUsedByModel(u => ({ ...u, [active]: (u[active] || 0) + (d.tokensUsed || 0) }))
        setEstByModel(e => ({ ...e, [active]: +(((e[active] || 0) + (d.estCost || 0)).toFixed(4)) }))
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: `⚠ ${String(e)}`, model: active }])
    } finally {
      setSending(false)
    }
  }

  // ── Reset handler ──────────────────────────────────────────────────────────
  const resetBudget = async (modelId) => {
    try {
      await fetch('/api/gateway/finops/budget/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: modelId ? JSON.stringify({ model: modelId }) : undefined,
      })
      if (modelId) {
        setUsedByModel(u => ({ ...u, [modelId]: 0 }))
        setEstByModel(e => ({ ...e, [modelId]: 0 }))
      } else {
        setUsedByModel({})
        setEstByModel({})
      }
    } catch {
      // silently fail — budget is local-state-tracked anyway
    }
  }

  // ── Setup screen guard ─────────────────────────────────────────────────────
  if (health !== null && health.adminKey === false) {
    return <SetupScreen isLight={isLight} />
  }

  // ── Theme tokens ───────────────────────────────────────────────────────────
  const textPrimary   = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  const borderColor   = isLight ? 'rgba(0,48,135,0.10)' : 'rgba(255,255,255,0.08)'
  const trackBg       = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'

  const activeModel = BUDGET_MODELS.find(m => m.id === active) ?? BUDGET_MODELS[0]
  const cap = latestCap

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ color: textPrimary }}>

      {/* ── Model strip ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 pt-4 pb-3"
           style={{ borderBottom: `1px solid ${borderColor}` }}>
        <div className="flex items-center gap-2 flex-wrap">
          {BUDGET_MODELS.map(m => {
            const used    = usedByModel[m.id] || 0
            const pct     = cap > 0 ? Math.min(100, (used / cap) * 100) : 0
            const barColor = pct >= 100 ? RED : pct >= 80 ? AMBER : GREEN
            const isActive = m.id === active
            return (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className="rounded-xl px-3 py-2 text-left transition-all"
                style={{
                  background: isActive
                    ? `${ACCENT}18`
                    : isLight ? '#f8fafc' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? ACCENT : borderColor}`,
                  minWidth: 160,
                  cursor: 'pointer',
                }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold truncate"
                        style={{ color: isActive ? ACCENT : textPrimary }}>
                    {m.label}
                  </span>
                  <span className="text-[9px] flex-shrink-0 px-1.5 py-0.5 rounded"
                        style={{ background: trackBg, color: textSecondary }}>
                    {m.vendor}
                  </span>
                </div>
                <MiniBar used={used} cap={cap} isLight={isLight} />
                <div className="text-[9px] mt-1" style={{ color: barColor }}>
                  {used.toLocaleString()} / {cap.toLocaleString()} tok
                </div>
              </button>
            )
          })}

          <div className="flex-1" />

          {/* Reset buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => resetBudget(active)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
              style={{ border: `1px solid ${borderColor}`, color: textSecondary, background: 'transparent' }}
              title="Reset active model budget">
              <RotateCcw size={11} />
              Reset budget
            </button>
            <button
              onClick={() => resetBudget(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
              style={{ border: `1px solid ${RED}55`, color: RED, background: 'transparent' }}
              title="Reset all model budgets">
              <RotateCcw size={11} />
              Reset all
            </button>
          </div>
        </div>
      </div>

      {/* ── Active-model budget meter ─────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-3"
           style={{ borderBottom: `1px solid ${borderColor}` }}>
        <ActiveMeter
          model={activeModel}
          used={usedByModel[active] || 0}
          cap={cap}
          est={estByModel[active] || 0}
          isLight={isLight}
        />
        <p className="text-[9px] mt-1.5" style={{ color: textSecondary }}>
          Real calls to your Vertex/Bedrock accounts via the gateway.
        </p>
      </div>

      {/* ── Chat messages ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
            <div className="text-[28px]">💬</div>
            <div className="text-[13px] font-semibold" style={{ color: textPrimary }}>
              Developer Chat Console
            </div>
            <div className="text-[11px] max-w-xs" style={{ color: textSecondary }}>
              Send prompts to the selected model. Each reply deducts from that model's token budget.
              Once the budget is exhausted the gateway returns HTTP 412.
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const label = (BUDGET_MODELS.find(m => m.id === msg.model) ?? BUDGET_MODELS[0]).label
          return (
            <ChatBubble
              key={i}
              msg={msg}
              isLight={isLight}
              modelLabel={label}
            />
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input row ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-3"
           style={{ borderTop: `1px solid ${borderColor}` }}>
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none rounded-xl px-4 py-3 text-[13px] outline-none"
            rows={2}
            placeholder={`Send a message to ${activeModel.label}…`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            style={{
              background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${borderColor}`,
              color: textPrimary,
              caretColor: ACCENT,
            }}
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="flex items-center justify-center rounded-xl px-4 py-3 font-bold text-[13px] transition-opacity disabled:opacity-40"
            style={{ background: ACCENT, color: '#fff', flexShrink: 0, height: 64 }}>
            {sending
              ? <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              : <Send size={16} />
            }
          </button>
        </div>
        <div className="text-[9px] mt-1.5" style={{ color: textSecondary }}>
          Enter to send · Shift+Enter for new line · budget resets above
        </div>
      </div>
    </div>
  )
}
