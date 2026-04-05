import React, { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, MessageSquare, Send, RotateCcw, Plus, ShieldCheck, Cpu, User, AlertTriangle, CheckCircle2, ShieldX, Zap, Lock } from 'lucide-react'
import { ChatMessage } from './ChatMessage'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'

// ─── Animated pipeline node ───────────────────────────────────────────────────
function PipelineNode({ id, label, sublabel, icon: Icon, color, glowColor, activeNode, blockedAt }) {
  const isActive = activeNode === id
  const isBlocked = blockedAt === id
  const isPast = activeNode !== null && !isBlocked && (
    (id === 'user-in' && ['airs-in','llm','airs-out','user-out'].includes(activeNode)) ||
    (id === 'airs-in' && ['llm','airs-out','user-out'].includes(activeNode)) ||
    (id === 'llm' && ['airs-out','user-out'].includes(activeNode)) ||
    (id === 'airs-out' && ['user-out'].includes(activeNode))
  )

  return (
    <div className="flex flex-col items-center gap-2 relative">
      <motion.div
        animate={{
          scale: isActive ? [1, 1.12, 1] : isBlocked ? [1, 1.08, 1] : 1,
          boxShadow: isActive
            ? [`0 0 0px ${glowColor}00`, `0 0 28px ${glowColor}`, `0 0 10px ${glowColor}88`]
            : isBlocked
            ? ['0 0 0px #ef444400', '0 0 32px #ef4444', '0 0 14px #ef444488']
            : isPast
            ? `0 0 8px ${glowColor}44`
            : '0 0 0px transparent',
        }}
        transition={{ duration: isActive || isBlocked ? 0.5 : 0.3 }}
        className={`relative w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
          isBlocked
            ? 'border-red-500 bg-red-500/20'
            : isActive
            ? `${color.border} ${color.bg} border-opacity-100`
            : isPast
            ? `${color.border} ${color.bg} opacity-80`
            : 'border-slate-700 bg-slate-800/40 opacity-50'
        }`}
      >
        {isBlocked
          ? <ShieldX size={20} className="text-red-400" />
          : <Icon size={18} className={isActive || isPast ? color.text : 'text-slate-600'} />
        }
        {isActive && !isBlocked && (
          <motion.div
            className={`absolute inset-0 rounded-2xl ${color.bg}`}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.div>
      <div className="text-center">
        <div className={`text-[9px] font-bold tracking-widest transition-colors duration-300 ${
          isBlocked ? 'text-red-400' : isActive || isPast ? color.text : 'text-slate-600'
        }`}>{isBlocked ? 'BLOCKED' : label}</div>
        <div className="text-[7px] text-slate-600 mt-0.5">{sublabel}</div>
      </div>
    </div>
  )
}

// ─── Animated connector line with traveling packet ────────────────────────────
function Connector({ fromId, toId, activeNode, packetPos, blockedAt, color }) {
  const isActive = activeNode === fromId
  const isDimmed = !activeNode || (
    activeNode !== fromId &&
    !(['user-in','airs-in','llm','airs-out'].slice(0, ['user-in','airs-in','llm','airs-out','user-out'].indexOf(fromId))).includes(activeNode)
  )

  return (
    <div className="flex flex-col items-center justify-center gap-1 relative w-12">
      <div className={`h-px w-full transition-all duration-500 ${
        isActive ? (blockedAt === toId ? 'bg-red-500' : color) : 'bg-slate-700'
      }`} />
      {isActive && (
        <motion.div
          className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
            blockedAt === toId ? 'bg-red-400' : 'bg-cyan-300'
          }`}
          style={{ left: 0 }}
          animate={{ left: '100%' }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />
      )}
      <div className="text-[6px] text-slate-700 tracking-wider mt-0.5">
        {isActive && blockedAt === toId ? '✕ denied' : ''}
      </div>
    </div>
  )
}

// ─── Stats ticker ─────────────────────────────────────────────────────────────
function StatTicker({ isProtected }) {
  const [count, setCount] = useState({ scanned: null, blocked: null, latency: null })

  useEffect(() => {
    const load = () => {
      fetch('/api/traces/metrics')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return
          setCount({
            scanned: data.protected_count ?? 0,
            blocked: data.blocked_count ?? 0,
            latency: data.avg_airs_input_ms != null ? Math.round(data.avg_airs_input_ms) : null,
          })
        })
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2 }}
      className="flex items-center gap-4"
    >
      {[
        { label: 'PROMPTS SCANNED', value: count.scanned != null ? count.scanned.toLocaleString() : '—', color: 'text-cyan-400' },
        { label: 'THREATS BLOCKED', value: count.blocked != null ? count.blocked.toLocaleString() : '—', color: 'text-red-400' },
        { label: 'SCAN LATENCY',    value: count.latency != null ? `${count.latency}ms` : '—',           color: 'text-emerald-400' },
      ].map(s => (
        <div key={s.label} className="text-center">
          <motion.div
            key={s.value}
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`text-sm font-bold font-mono ${s.color}`}
          >
            {s.value}
          </motion.div>
          <div className="text-[7px] text-slate-600 tracking-widest mt-0.5">{s.label}</div>
        </div>
      ))}
    </motion.div>
  )
}

// ─── Main welcome diagram ─────────────────────────────────────────────────────
const NODES = [
  { id: 'user-in',  label: 'USER',    sublabel: 'App / Client',    icon: User,        color: { border: 'border-slate-400', bg: 'bg-slate-700/60', text: 'text-slate-200' }, glow: '#94a3b8' },
  { id: 'airs-in',  label: 'AIRS',    sublabel: 'Prompt Scan',     icon: ShieldCheck, color: { border: 'border-cyan-500',  bg: 'bg-cyan-500/15',  text: 'text-cyan-300'  }, glow: '#06b6d4' },
  { id: 'llm',      label: 'LLM',     sublabel: 'AI Model',        icon: Cpu,         color: { border: 'border-blue-500',  bg: 'bg-blue-500/15',  text: 'text-blue-300'  }, glow: '#3b82f6' },
  { id: 'airs-out', label: 'AIRS',    sublabel: 'Response Scan',   icon: Lock,        color: { border: 'border-violet-500',bg: 'bg-violet-500/15',text: 'text-violet-300'}, glow: '#8b5cf6' },
  { id: 'user-out', label: 'USER',    sublabel: 'Safe Response',   icon: CheckCircle2,color: { border: 'border-emerald-500',bg:'bg-emerald-500/15',text:'text-emerald-300'}, glow: '#10b981' },
]
const SEQUENCE = ['user-in','airs-in','llm','airs-out','user-out']

function WelcomeDiagram({ isProtected }) {
  const [activeNode, setActiveNode] = useState(null)
  const [blockedAt, setBlockedAt] = useState(null)
  const [mode, setMode] = useState('safe') // 'safe' | 'attack'
  const timerRef = useRef(null)

  const runAnimation = useCallback((attackMode) => {
    setBlockedAt(null)
    setActiveNode(null)
    const seq = attackMode ? ['user-in','airs-in'] : SEQUENCE
    let i = 0
    const step = () => {
      if (i >= seq.length) {
        setTimeout(() => { setActiveNode(null); setBlockedAt(null) }, 1200)
        return
      }
      setActiveNode(seq[i])
      if (attackMode && seq[i] === 'airs-in') {
        setTimeout(() => { setBlockedAt('airs-in'); setActiveNode('airs-in') }, 500)
        setTimeout(() => { setActiveNode(null); setBlockedAt(null) }, 2200)
        return
      }
      i++
      timerRef.current = setTimeout(step, 750)
    }
    step()
  }, [])

  useEffect(() => {
    const autoRun = () => {
      const doAttack = Math.random() > 0.65
      setMode(doAttack ? 'attack' : 'safe')
      runAnimation(doAttack)
    }
    const loop = setInterval(autoRun, 4500)
    setTimeout(autoRun, 800)
    return () => { clearInterval(loop); clearTimeout(timerRef.current) }
  }, [runAnimation])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col items-center justify-center h-full gap-7 px-4 py-6 select-none"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="w-5 h-5 rounded-full border border-cyan-500/50 flex items-center justify-center"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          </motion.div>
          <span className="text-xs font-bold tracking-[0.3em] text-slate-200">PRISMA AIRS</span>
          <motion.div
            animate={{ rotate: [0, -360] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="w-5 h-5 rounded-full border border-violet-500/50 flex items-center justify-center"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          </motion.div>
        </div>
        <div className="text-[9px] tracking-[0.25em] text-slate-500">AI RUNTIME SECURITY · LIVE INTERCEPTION</div>
      </motion.div>

      {/* Mode indicator */}
      <motion.div
        key={mode}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-bold tracking-wider ${
          mode === 'attack'
            ? 'border-red-500/40 bg-red-500/10 text-red-400'
            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
        }`}
      >
        {mode === 'attack'
          ? <><AlertTriangle size={9} /> SIMULATING PROMPT INJECTION ATTACK</>
          : <><Zap size={9} /> NORMAL TRAFFIC · AIRS SCANNING</>
        }
      </motion.div>

      {/* Pipeline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-0"
      >
        {NODES.map((node, i) => (
          <React.Fragment key={node.id}>
            <PipelineNode
              {...node}
              activeNode={activeNode}
              blockedAt={blockedAt}
              glowColor={node.glow}
            />
            {i < NODES.length - 1 && (
              <Connector
                fromId={node.id}
                toId={NODES[i+1].id}
                activeNode={activeNode}
                blockedAt={blockedAt}
                color={blockedAt ? 'bg-red-500' : 'bg-cyan-500/60'}
              />
            )}
          </React.Fragment>
        ))}
      </motion.div>

      {/* What AIRS checks */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="grid grid-cols-3 gap-2 w-full max-w-sm"
      >
        {[
          { label: 'Prompt Injection', color: 'text-cyan-400', dot: 'bg-cyan-400' },
          { label: 'Jailbreak Attempts', color: 'text-violet-400', dot: 'bg-violet-400' },
          { label: 'Data Exfiltration', color: 'text-red-400', dot: 'bg-red-400' },
          { label: 'Toxic Content', color: 'text-orange-400', dot: 'bg-orange-400' },
          { label: 'PII Leakage', color: 'text-yellow-400', dot: 'bg-yellow-400' },
          { label: 'Model Hijacking', color: 'text-pink-400', dot: 'bg-pink-400' },
        ].map(t => (
          <div key={t.label} className="flex items-center gap-1.5">
            <div className={`w-1 h-1 rounded-full flex-shrink-0 ${t.dot}`} />
            <span className={`text-[8px] ${t.color}`}>{t.label}</span>
          </div>
        ))}
      </motion.div>

      {/* Live stats */}
      <StatTicker isProtected={isProtected} />

      {/* Interactive buttons */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        className="flex items-center gap-3"
      >
        <button
          onClick={() => { setMode('safe'); runAnimation(false) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          <CheckCircle2 size={9} /> Safe Request
        </button>
        <button
          onClick={() => { setMode('attack'); runAnimation(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-[9px] font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <AlertTriangle size={9} /> Simulate Attack
        </button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        className="text-[9px] text-slate-600 text-center"
      >
        Use the <span className="text-slate-400 font-medium">Attack Library</span> on the left · or type a prompt below
      </motion.p>
    </motion.div>
  )
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
}

export function ChatCenter({ messages, isLoading, onSendMessage, onClear, backend, model, onOpenTelemetry }) {
  const theme = useProtectionTheme()
  const hasConversation = messages.some(m => m.role === 'user' || m.role === 'assistant')
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const [input, setInput] = useState('')
  const [translating, setTranslating] = useState(null)

  const handleTranslate = async (text, language) => {
    setTranslating(text)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Translate the following text to ${language}. Return ONLY the translated text, nothing else:\n\n${text}`,
          airsEnabled: false,
          backend,
          modelId: model,
        }),
      })
      const data = await res.json()
      const translated = data.chatResponse?.content?.trim() || text
      onSendMessage(translated, backend, model)
    } catch {
      onSendMessage(text, backend, model)
    } finally {
      setTranslating(null)
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    onSendMessage(text, backend, model)
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
        <MessageSquare size={14} className={theme.primaryText} />
        <span className="text-xs font-semibold text-slate-300">Intercept Console</span>
        <div className="ml-auto flex items-center gap-2">
          {hasConversation && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              <RotateCcw size={10} /> Clear
            </button>
          )}
          <button
            onClick={onClear}
            className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border transition-colors ${
              theme.isProtected
                ? 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                : 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10'
            }`}
          >
            <Plus size={10} /> New Session
          </button>
        </div>
      </div>

      {/* Messages or Welcome Diagram */}
      <div className="flex-1 overflow-y-auto py-4">
        {!hasConversation ? (
          <WelcomeDiagram isProtected={theme.isProtected} theme={theme} />
        ) : (
          <motion.div variants={staggerContainer} animate="animate">
            <AnimatePresence>
              {messages.map((msg) => (
                <div key={msg.id} className="mb-4">
                  <ChatMessage
                    message={msg}
                    onResend={msg.role === 'user' ? () => onSendMessage(msg.content, backend, model) : undefined}
                    onTranslate={msg.role === 'user' ? (text, lang) => handleTranslate(text, lang) : undefined}
                    isLoading={isLoading || translating === msg.content}
                    isTranslating={translating === msg.content}
                    onOpenTelemetry={onOpenTelemetry}
                  />
                </div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 mb-4"
          >
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
              theme.isProtected
                ? 'bg-emerald-500/10 border-emerald-500/25'
                : 'bg-blue-500/15 border-blue-400/30'
            }`}>
              <Loader2 size={12} className={`animate-spin ${theme.isProtected ? theme.primaryText : 'text-blue-500'}`} />
              <span className={`text-xs font-medium ${theme.isProtected ? 'text-slate-200' : 'text-blue-700'}`}>
                {theme.isProtected ? 'AIRS scanning…' : 'Sending to LLM…'}
              </span>
              <span className="flex gap-0.5">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className={`w-1 h-1 rounded-full ${theme.isProtected ? theme.pulseColor : 'bg-blue-400'}`}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                  />
                ))}
              </span>
            </div>
          </motion.div>
        )}

        <div ref={endRef} />
      </div>

      {/* Chat input */}
      <div className="flex-shrink-0 px-4 pb-4">
        <form onSubmit={handleSubmit}>
          <div className={`flex items-end gap-2 rounded-xl border p-2 transition-all duration-300 ${
            theme.isProtected
              ? 'border-emerald-500/30 bg-emerald-500/5 focus-within:border-emerald-500/50'
              : 'border-white/10 bg-white/5 focus-within:border-white/20'
          }`}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message or use the attack library…"
              rows={1}
              disabled={isLoading}
              className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 resize-none outline-none leading-relaxed max-h-32 disabled:opacity-50"
              style={{ minHeight: '20px' }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`flex-shrink-0 p-2 rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed
                ${theme.isProtected
                  ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }
              `}
            >
              <Send size={12} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[9px] text-slate-700">Enter to send · Shift+Enter for newline</span>
            <span className={`text-[9px] font-semibold ${theme.primaryText}`}>
              {theme.isProtected ? '⚡ AIRS Protected' : '⚠ Unprotected'}
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
