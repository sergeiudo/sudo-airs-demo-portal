import React, { useEffect, useRef, useState } from 'react'
import { Boxes, Plug, Wrench, ArrowDownToLine, Loader2, Send, Sparkles, ChevronRight, Check, X, ShieldCheck, ShieldX } from 'lucide-react'
import { ModelPicker } from './components/ModelPicker'
import { useAppContext } from '../../context/AppContext'

const ACCENT = '#ec4899'
const TEAL = '#2dd4bf'

// Example prompts grouped by the tool path they should trigger.
const EXAMPLE_GROUPS = [
  {
    id: 'direct', label: 'Direct price', hint: '→ execute', color: TEAL,
    items: [
      'What is the current price of BTC and ETH in USD?',
      'Give me current prices for Bitcoin, Ethereum, and Solana in USD.',
      'What is the current price of Bitcoin in USD and EUR?',
      'Get the current USD price, market cap, and 24h volume for BTC and ETH.',
      'Compare current prices of BTC, ETH, SOL, XRP, and DOGE in USD.',
      'What is the current price of Ethereum and its 24h change?',
      'Show me current prices for bitcoin, ethereum, and binancecoin using CoinGecko.',
      'Get live crypto prices for BTC, ETH, and SOL, and return them in a short table.',
    ],
  },
  {
    id: 'discovery', label: 'Discovery', hint: '→ search_docs', color: '#0ea5e9',
    items: [
      'Which CoinGecko SDK method should I use to get trending coins?',
      'Find the correct CoinGecko SDK method for historical price chart data.',
      'Search CoinGecko docs for how to get top gainers and losers.',
      'Which API method returns coin market data like market cap, volume, and 24h change?',
      'Find the SDK method for getting supported fiat currencies.',
      'How can I get the historical price of bitcoin for a specific date using the CoinGecko MCP?',
      'Search the CoinGecko SDK docs for how to get market chart data between two timestamps.',
      'What CoinGecko SDK method should I use to list all supported coins and their IDs?',
    ],
  },
  {
    id: 'multi', label: 'Multi-step', hint: '→ search_docs → execute', color: ACCENT,
    items: [
      'What is the current price of BTC and ETH?',
      'Which CoinGecko SDK method should I use for top gainers and losers?',
      'Search the docs for top gainers and losers, then fetch the current top gainers in USD.',
    ],
  },
]

// Minimal, safe markdown → React: **bold**, *italic*, `code`, newlines.
// Rendered as elements (no dangerouslySetInnerHTML).
function inlineMd(line) {
  const out = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let last = 0, m, k = 0
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push(line.slice(last, m.index))
    const t = m[0]
    if (t.startsWith('**')) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('`')) out.push(<code key={k++}>{t.slice(1, -1)}</code>)
    else out.push(<em key={k++}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}
function renderMd(text) {
  const lines = String(text || '').split('\n')
  return lines.map((line, i) => (
    <React.Fragment key={i}>{inlineMd(line)}{i < lines.length - 1 && <br />}</React.Fragment>
  ))
}

// ── Dark hero architecture diagram: prompt → model ⇄ Portkey MCP Registry
//    (CoinGecko MCP: search_docs, execute) → live data → answer ──────────────
function McpFlowDiagram() {
  const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace'
  const sans = 'Inter, ui-sans-serif, system-ui, sans-serif'
  const text = '#e2e8f0', muted = '#94a3b8'
  const boxFill = 'rgba(255,255,255,0.05)', boxStroke = 'rgba(255,255,255,0.18)'

  const Box = ({ cx, cy, w = 130, h = 40, label, sub, fill, stroke, color }) => (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={9}
            fill={fill} fillOpacity={color ? 0.14 : 1} stroke={stroke} strokeOpacity={color ? 0.7 : 1} strokeWidth={1.3} />
      <text x={cx} y={sub ? cy - 1 : cy + 4} textAnchor="middle" fontFamily={mono} fontSize={11.5} fontWeight={700} fill={color || text}>{label}</text>
      {sub && <text x={cx} y={cy + 12} textAnchor="middle" fontFamily={sans} fontSize={8} fill={muted}>{sub}</text>}
    </g>
  )

  return (
    <div className="rounded-2xl p-4 overflow-x-auto flex-shrink-0 mx-auto w-full"
         style={{ maxWidth: 1000, background: 'radial-gradient(115% 130% at 50% 30%, #141b33 0%, #090d1a 72%)', border: '1px solid rgba(255,255,255,0.10)' }}>
      <svg viewBox="0 0 1040 250" width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', minWidth: 520 }}>
        <defs>
          <radialGradient id="mcp-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
            <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="mcp-model" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0ea5e9" /><stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          {[['mcp-aBlue', '#0ea5e9'], ['mcp-aPink', '#ec4899'], ['mcp-aTeal', TEAL], ['mcp-aPurple', '#8b5cf6']].map(([id, c]) => (
            <marker key={id} id={id} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M0,0 L6,3.5 L0,7 Z" fill={c} /></marker>
          ))}
        </defs>

        {/* top row: prompt → model → answer */}
        <path d="M186,80 L300,80" fill="none" stroke="#0ea5e9" strokeOpacity={0.85} strokeWidth={2.2} markerEnd="url(#mcp-aBlue)" />
        <path d="M452,80 L866,80" fill="none" stroke="#8b5cf6" strokeOpacity={0.85} strokeWidth={2.2} markerEnd="url(#mcp-aPurple)" />
        <text x={659} y={70} textAnchor="middle" fontFamily={sans} fontSize={9} fontWeight={700} letterSpacing="0.5" fill={muted}>FINAL ANSWER</text>

        {/* model glow + node */}
        <circle cx={376} cy={80} r={62} fill="url(#mcp-glow)" />
        <Box cx={120} cy={80} w={128} label="PROMPT" fill={boxFill} stroke={boxStroke} />
        <g>
          <rect x={310} y={58} width={132} height={44} rx={10} fill="url(#mcp-model)" fillOpacity={0.28} stroke="#8b5cf6" strokeOpacity={0.85} strokeWidth={1.4} />
          <text x={376} y={76} textAnchor="middle" fontFamily={mono} fontSize={11.5} fontWeight={700} fill={text}>AI MODEL</text>
          <text x={376} y={90} textAnchor="middle" fontFamily={sans} fontSize={8} fill={muted}>Gemini · decides tools</text>
        </g>
        <Box cx={936} cy={80} w={130} label="ANSWER" fill={boxFill} stroke={boxStroke} />

        {/* agentic loop connector: model ⇄ registry */}
        <path d="M366,102 L366,150" fill="none" stroke="#ec4899" strokeOpacity={0.9} strokeWidth={2} markerEnd="url(#mcp-aPink)" />
        <path d="M388,150 L388,102" fill="none" stroke={TEAL} strokeOpacity={0.9} strokeWidth={2} markerEnd="url(#mcp-aTeal)" />
        <text x={300} y={130} textAnchor="end" fontFamily={sans} fontSize={8.5} fontWeight={700} fill={muted}>agentic</text>
        <text x={300} y={141} textAnchor="end" fontFamily={sans} fontSize={8.5} fontWeight={700} fill={muted}>loop ×N</text>
        <text x={406} y={120} fontFamily={sans} fontSize={8} fill="#ec4899">tool call ↓</text>
        <text x={406} y={140} fontFamily={sans} fontSize={8} fill={TEAL}>result ↑</text>

        {/* Portkey MCP Registry container */}
        <rect x={232} y={152} width={672} height={82} rx={12} fill="rgba(236,72,153,0.06)" stroke="#ec4899" strokeOpacity={0.4} strokeWidth={1.2} />
        <text x={252} y={172} fontFamily={sans} fontSize={9} fontWeight={800} letterSpacing="1.2" fill="#ec4899">PORTKEY MCP REGISTRY</text>

        {/* CoinGecko MCP + tools inside */}
        <Box cx={350} cy={202} w={150} h={38} label="CoinGecko MCP" sub="v6.0.0" fill={TEAL} stroke={TEAL} color={TEAL} />
        <path d="M425,202 L470,202" fill="none" stroke={TEAL} strokeOpacity={0.8} strokeWidth={1.8} markerEnd="url(#mcp-aTeal)" />
        {[['search_docs', 188], ['execute', 216]].map(([t, cy]) => (
          <g key={t}>
            <rect x={478} y={cy - 11} width={118} height={22} rx={6} fill={TEAL} fillOpacity={0.14} stroke={TEAL} strokeOpacity={0.55} />
            <text x={537} y={cy + 4} textAnchor="middle" fontFamily={mono} fontSize={10} fontWeight={700} fill={TEAL}>{t}</text>
          </g>
        ))}
        <text x={636} y={206} fontFamily={sans} fontSize={9} fill={muted}>→ live CoinGecko API</text>
      </svg>
      <div className="text-[11px] italic px-1 mt-1" style={{ color: muted }}>
        Crypto questions route through the Portkey MCP Registry — the model calls CoinGecko tools, runs them, and answers with live data.
      </div>
    </div>
  )
}

// ── live step timeline ───────────────────────────────────────────────────────
function StepLine({ step, isLight }) {
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  const k = step.kind
  if (k === 'airs') {
    if (step.note) return <Row icon={ShieldCheck} color="#94a3b8" isLight={isLight}><span style={{ color: textSecondary }}>Prisma AIRS {step.phase} scan — {step.note}</span></Row>
    const ok = step.ok
    const Icon = ok ? ShieldCheck : ShieldX
    const col = ok ? '#10b981' : '#ef4444'
    return <Row icon={Icon} color={col} isLight={isLight}>
      <b style={{ color: col }}>Prisma AIRS</b> {step.phase} scan — {ok ? 'passed' : 'BLOCKED'}
      {step.category ? <span style={{ color: textSecondary }}> · {step.category}</span> : null}
      {step.latencyMs != null ? <span style={{ color: textSecondary }}> · {step.latencyMs}ms</span> : null}
      {!ok && step.threats && step.threats.length > 0 ? <span style={{ color: col }}> · {step.threats.join(', ')}</span> : null}
    </Row>
  }
  if (k === 'connect') {
    return <Row icon={Plug} color="#ec4899" isLight={isLight}>
      Connected to <b>Portkey MCP Registry</b> → <span style={{ color: TEAL }}>{step.server}</span> {step.version} <span style={{ color: textSecondary }}>({step.url})</span>
    </Row>
  }
  if (k === 'tools') {
    return <Row icon={Boxes} color={TEAL} isLight={isLight}>
      Tools discovered: {(step.tools || []).map(t => <code key={t} className="mx-0.5">{t}</code>)}
    </Row>
  }
  if (k === 'tool_call') {
    const isCode = step.name === 'execute' && step.args?.code
    return <Row icon={Wrench} color="#ec4899" isLight={isLight}>
      <span>[r{step.round}] calling <b>{step.name}</b></span>
      {isCode
        ? <pre className="mt-1 p-2 rounded text-[10px] overflow-x-auto" style={{ background: isLight ? '#f1f5f9' : '#0d1117', color: isLight ? '#1e293b' : '#c9d1d9' }}>{step.args.code}</pre>
        : <span style={{ color: textSecondary }}> · {JSON.stringify(step.args)}</span>}
    </Row>
  }
  if (k === 'tool_result') {
    const Icon = step.ok ? Check : X
    const col = step.ok ? '#10b981' : '#ef4444'
    return <Row icon={Icon} color={col} isLight={isLight}>
      <span>[r{step.round}] {step.name} {step.ok ? 'result' : 'error'}</span>
      <pre className="mt-1 p-2 rounded text-[10px] overflow-x-auto max-h-32 overflow-y-auto" style={{ background: isLight ? '#f1f5f9' : '#0d1117', color: isLight ? '#1e293b' : '#c9d1d9' }}>{step.result}</pre>
    </Row>
  }
  return null
}

function Row({ icon: Icon, color, children, isLight }) {
  return (
    <div className="flex items-start gap-2 text-[12px]" style={{ color: isLight ? '#0f172a' : '#e2e8f0' }}>
      <Icon size={13} style={{ color, marginTop: 2, flexShrink: 0 }} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// Collapsible chain-of-thought / MCP pipeline panel.
function McpPipelinePanel({ message, isLight }) {
  const [open, setOpen] = useState(true)
  const surfaceBg = isLight ? '#ffffff' : 'rgba(15,20,35,0.6)'
  const surfaceBorder = isLight ? 'rgba(0,48,135,0.14)' : 'rgba(255,255,255,0.08)'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  const running = message.status === 'running'
  if (message.steps.length === 0 && !running) return null
  return (
    <div className="rounded-xl flex flex-col" style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
      <button onClick={() => setOpen(o => !o)}
              className="flex items-center gap-2 px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-left"
              style={{ color: ACCENT }}>
        <ChevronRight size={13} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
        <ArrowDownToLine size={12} /> MCP pipeline
        {running && <Loader2 size={12} className="animate-spin" />}
        {message.steps.length > 0 && (
          <span className="normal-case font-semibold" style={{ color: textSecondary }}>· {message.steps.length} steps{open ? '' : ' (hidden)'}</span>
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 px-4 pb-4">
          {message.steps.map((s, i) => <StepLine key={i} step={s} isLight={isLight} />)}
          {running && message.steps.length === 0 && (
            <div className="text-[12px]" style={{ color: textSecondary }}>connecting to the registry…</div>
          )}
        </div>
      )}
    </div>
  )
}

function ResizeHandle({ onMouseDown, active, isLight }) {
  const [hover, setHover] = useState(false)
  const lit = active || hover
  return (
    <div onMouseDown={onMouseDown} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
         className="relative flex-shrink-0 w-1 cursor-col-resize">
      <div className="absolute inset-y-0 -left-1.5 -right-1.5 z-10" />
      <div className="h-full w-full transition-colors duration-150"
           style={{ background: lit ? `${ACCENT}${active ? '99' : '66'}` : (isLight ? 'rgba(0,48,135,0.12)' : 'rgba(255,255,255,0.10)') }} />
    </div>
  )
}

export function McpRegistryTab() {
  const { state } = useAppContext()
  const isLight = !state.isDark
  const [model, setModel] = useState('')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [airsOn, setAirsOn] = useState(false)
  const [messages, setMessages] = useState([])
  const bottomRef = useRef(null)

  // resizable left panel
  const [leftWidth, setLeftWidth] = useState(290)
  const [drag, setDrag] = useState(false)
  const dragRef = useRef({ startX: 0, startW: 0 })
  const startDrag = (e) => { e.preventDefault(); dragRef.current = { startX: e.clientX, startW: leftWidth }; setDrag(true) }
  useEffect(() => {
    if (!drag) return
    const onMove = (e) => setLeftWidth(Math.min(470, Math.max(230, dragRef.current.startW + (e.clientX - dragRef.current.startX))))
    const onUp = () => setDrag(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [drag])

  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  const surfaceBg = isLight ? '#ffffff' : 'rgba(15,20,35,0.6)'
  const surfaceBorder = isLight ? 'rgba(0,48,135,0.14)' : 'rgba(255,255,255,0.08)'

  async function run(prompt) {
    if (!prompt.trim() || busy) return
    setBusy(true)
    const asstId = `a-${Date.now()}`
    setMessages(prev => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: prompt },
      { id: asstId, role: 'assistant', steps: [], answer: '', status: 'running', meta: null },
    ])
    setInput('')
    const patch = (fn) => setMessages(prev => prev.map(m => m.id === asstId ? fn(m) : m))
    try {
      const resp = await fetch('/api/gateway/mcp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model, airs: airsOn }),
      })
      const reader = resp.body.getReader()
      const dec = new TextDecoder()
      let buf = '', ev = null
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('event:')) ev = line.slice(6).trim()
          else if (line.startsWith('data:')) {
            const d = line.slice(5).trim(); if (!d) continue
            let p; try { p = JSON.parse(d) } catch { continue }
            if (ev === 'step') patch(m => ({ ...m, steps: [...m.steps, p] }))
            else if (ev === 'answer') patch(m => ({ ...m, answer: p.text, status: 'done', meta: p }))
            else if (ev === 'blocked') patch(m => ({ ...m, status: 'blocked', answer: `Blocked by Prisma AIRS — ${p.category || 'policy violation'}${(p.threats && p.threats.length) ? ` (${p.threats.join(', ')})` : ''}` }))
            else if (ev === 'error') patch(m => ({ ...m, status: 'error', answer: p.message }))
            ev = null
          } else if (line.trim() === '') ev = null
        }
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
      patch(m => (m.status === 'running' ? { ...m, status: 'done' } : m))
    } catch (e) {
      patch(m => ({ ...m, status: 'error', answer: String(e?.message || e) }))
    } finally {
      setBusy(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
    }
  }

  return (
    <div className="flex flex-1 min-h-0" style={{ cursor: drag ? 'col-resize' : 'default', userSelect: drag ? 'none' : 'auto' }}>
      {/* LEFT — model picker + grouped example library (resizable) */}
      <aside className="flex-shrink-0 flex flex-col gap-3 p-4 border-r overflow-y-auto"
             style={{ width: leftWidth, background: surfaceBg, borderColor: surfaceBorder }}>
        <div className="flex flex-col gap-1">
          <ModelPicker value={model} onChange={setModel} filterProviders={(p) => /vertex/i.test(p)} />
          <div className="text-[9px] leading-snug px-1" style={{ color: textSecondary }}>
            Gemini drives the MCP agentic loop (runs on Vertex's tool-calling endpoint).
          </div>
        </div>

        {/* AIRS protection toggle — wraps the MCP loop with input + output scans */}
        <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer text-[11px] font-semibold"
               style={{ background: airsOn ? `${ACCENT}14` : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)'), border: `1px solid ${airsOn ? `${ACCENT}55` : surfaceBorder}`, color: airsOn ? ACCENT : textPrimary }}>
          <span className="flex items-center gap-1.5"><ShieldCheck size={13} /> AIRS protection</span>
          <input type="checkbox" checked={airsOn} onChange={(e) => setAirsOn(e.target.checked)} />
        </label>
        <div className="text-[9px] leading-snug px-1 -mt-1" style={{ color: textSecondary }}>
          {airsOn ? 'Prompt + answer scanned by Prisma AIRS around the MCP loop.' : 'Off — prompt → model → MCP, no guardrail.'}
        </div>

        <div className="text-[10px] uppercase tracking-wider font-semibold pt-1" style={{ color: textSecondary }}>Example prompts</div>
        {EXAMPLE_GROUPS.map(g => (
          <div key={g.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-1 flex-wrap">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }} />
              <span className="text-[11px] font-bold" style={{ color: textPrimary }}>{g.label}</span>
              <span className="text-[9px] font-mono" style={{ color: g.color }}>{g.hint}</span>
            </div>
            {g.items.map((p, i) => (
              <button key={i} onClick={() => run(p)} disabled={busy}
                      className="text-left px-3 py-2 rounded-lg text-[11px] leading-snug transition-colors"
                      style={{ background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: `1px solid ${surfaceBorder}`, color: textPrimary, opacity: busy ? 0.55 : 1 }}>
                {p}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <ResizeHandle onMouseDown={startDrag} active={drag} isLight={isLight} />

      {/* MAIN — intro + diagram + chat + input */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* intro */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold" style={{ color: ACCENT }}>
              <Boxes size={13} /> MCP Registry
            </div>
            <h2 className="text-xl font-bold" style={{ color: textPrimary }}>Tool-calling through the Portkey MCP Registry</h2>
            <p className="text-[12px] leading-relaxed" style={{ color: textSecondary }}>
              Pick an example on the left (or ask your own). The model reaches the <strong>CoinGecko</strong> MCP server you
              registered in Portkey, calls its tools (<code>search_docs</code>, <code>execute</code>), and answers with <strong>live</strong> data — every step shown.
            </p>
          </div>
          <McpFlowDiagram />

          {/* chat */}
          <div className="flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="text-[12px] text-center py-6" style={{ color: textSecondary }}>
                ← Click an example prompt to run it through the CoinGecko MCP, or type your own below.
              </div>
            )}
            {messages.map(m => m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-md text-[13px]" style={{ background: '#0ea5e9', color: '#fff' }}>{m.content}</div>
              </div>
            ) : (
              <div key={m.id} className="flex flex-col gap-3">
                {/* collapsible step timeline (chain of thought) */}
                <McpPipelinePanel message={m} isLight={isLight} />
                {/* answer — assistant chat bubble (left-aligned) */}
                {m.answer && (
                  <div className="flex flex-col gap-1.5 items-start">
                    <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-tl-md text-[13px] leading-relaxed"
                         style={{ background: (m.status === 'error' || m.status === 'blocked') ? '#7f1d1d' : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'), color: (m.status === 'error' || m.status === 'blocked') ? '#fff' : textPrimary }}>
                      {m.status === 'blocked' && <ShieldX size={13} className="inline mr-1 -mt-0.5" />}{renderMd(m.answer)}
                    </div>
                    {m.meta && (
                      <div className="flex items-center gap-2 flex-wrap text-[10px]" style={{ color: textSecondary }}>
                        <Sparkles size={11} style={{ color: TEAL }} />
                        <span>via Portkey MCP Registry · {m.meta.server}</span>
                        <span>· {m.meta.rounds} tool round{m.meta.rounds === 1 ? '' : 's'}</span>
                        <span>· {m.meta.latencyMs}ms</span>
                        <span className="font-mono">· {m.meta.model}</span>
                        {m.meta.airs && <span className="px-1.5 rounded-full" style={{ background: '#10b98122', color: '#10b981', border: '1px solid #10b98155' }}>AIRS protected</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* input footer */}
        <form onSubmit={(e) => { e.preventDefault(); run(input) }} className="flex-shrink-0 flex gap-2 p-4 border-t" style={{ borderColor: surfaceBorder }}>
          <input value={input} onChange={(e) => setInput(e.target.value)}
                 placeholder="Ask about crypto prices, market caps…" disabled={busy}
                 className="flex-1 px-4 py-2.5 rounded-lg text-[13px]"
                 style={{ background: surfaceBg, border: `1px solid ${surfaceBorder}`, color: textPrimary }} />
          <button type="submit" disabled={busy || !input.trim()}
                  className="px-4 py-2.5 rounded-lg text-[13px] font-bold flex items-center gap-2"
                  style={{ background: ACCENT, color: '#fff', opacity: (busy || !input.trim()) ? 0.5 : 1 }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {busy ? 'Running…' : 'Ask'}
          </button>
        </form>
      </main>
    </div>
  )
}
