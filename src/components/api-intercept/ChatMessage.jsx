import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldX, ShieldCheck, Info, RefreshCw, ArrowDownToLine, ArrowUpFromLine, Languages, Copy, Check, Activity, ChevronDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'
import { useAppContext } from '../../context/AppContext'
import { PipelineTraceV2 } from './PipelineTraceV2'

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Used by AssistantMessage for Hebrew RTL display — do not remove
function isHebrewText(str) {
  return /[\u0590-\u05FF]/.test(str)
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
    } else {
      fallbackCopy(text)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const fallbackCopy = (str) => {
    const el = document.createElement('textarea')
    el.value = str
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity" title="Copy">
      {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

// ─── System message ───────────────────────────────────────────────────────────
function SystemMessage({ message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center gap-2 px-4 py-1"
    >
      <div className="h-px flex-1 bg-white/5" />
      <div className="flex items-center gap-1.5">
        <Info size={10} className="text-slate-600" />
        <p className="text-[9px] text-slate-600 italic">{message.content}</p>
      </div>
      <div className="h-px flex-1 bg-white/5" />
    </motion.div>
  )
}

// ─── User bubble (iMessage style) ─────────────────────────────────────────────
const LANGUAGES = [
  { label: 'English',            flag: '🇺🇸' },
  { label: 'Spanish',            flag: '🇪🇸' },
  { label: 'Russian',            flag: '🇷🇺' },
  { label: 'German',             flag: '🇩🇪' },
  { label: 'French',             flag: '🇫🇷' },
  { label: 'Japanese',           flag: '🇯🇵' },
  { label: 'Portuguese',         flag: '🇧🇷' },
  { label: 'Italian',            flag: '🇮🇹' },
  { label: 'Simplified Chinese', flag: '🇨🇳' },
  { label: 'Hebrew',             flag: '🇮🇱' },
]

function UserMessage({ message, onResend, onTranslate, isLoading, isTranslating }) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const btnRef = useRef(null)
  const isLight = document.documentElement.classList.contains('light')

  useEffect(() => {
    if (!showDropdown) return
    const handler = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  const severityColor = message.attackMeta?.severity === 'critical'
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : message.attackMeta?.severity === 'high'
    ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex flex-col items-end px-4"
    >
      {/* Attack badge */}
      {message.attackMeta && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 mb-1.5"
        >
          <span className="text-[8px] text-slate-500 font-mono tracking-wider">{message.attackMeta.technique}</span>
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${severityColor}`}>
            {message.attackMeta.severity.toUpperCase()}
          </span>
        </motion.div>
      )}

      {/* Bubble */}
      <div className="relative max-w-[78%]">
        <div
          className="relative px-4 py-3 rounded-[22px] rounded-tr-[5px]"
          style={{
            background: 'rgba(99, 155, 255, 0.13)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(147, 197, 253, 0.18)',
            boxShadow: '0 2px 20px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.12)',
          }}
        >
          {/* Subtle inner gloss */}
          <div
            className="absolute inset-0 rounded-[22px] rounded-tr-[5px] pointer-events-none"
            style={{ background: 'linear-gradient(150deg, rgba(255,255,255,0.07) 0%, transparent 55%)' }}
          />
          <p
            className="relative leading-relaxed whitespace-pre-wrap break-words"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: '12px',
              color: 'var(--user-bubble-text)',
            }}
          >
            {message.content}
          </p>
        </div>

        {/* Bubble tail */}
        <div
          className="absolute top-0 -right-1"
          style={{
            width: 0, height: 0,
            borderLeft: '8px solid rgba(99,155,255,0.18)',
            borderBottom: '8px solid transparent',
          }}
        />
      </div>

      {/* Action row — always visible */}
      <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-500">
        <span className="text-slate-600">{new Date(message.timestamp).toLocaleTimeString()}</span>
        {onResend && (
          <button
            onClick={onResend}
            disabled={isLoading}
            className="flex items-center gap-1 hover:text-slate-300 transition-colors disabled:opacity-30"
            title="Resend"
          >
            <RefreshCw size={9} className={isLoading && !isTranslating ? 'animate-spin' : ''} />
            Resend
          </button>
        )}
        {onTranslate && (
          <div className="relative translate-dropdown-root" ref={btnRef}>
            <button
              onClick={() => {
                if (btnRef.current) {
                  const rect = btnRef.current.getBoundingClientRect()
                  setOpenUpward(rect.bottom > window.innerHeight / 2)
                }
                setShowDropdown(prev => !prev)
              }}
              disabled={isLoading}
              className="flex items-center gap-1 text-blue-400/70 hover:text-blue-300 transition-colors disabled:opacity-30"
              title="Translate message"
            >
              <Languages size={9} className={isTranslating ? 'animate-spin' : ''} />
              Translate
            </button>
            {showDropdown && (
              <div
                className={`absolute right-0 z-50 w-44 rounded-xl shadow-xl overflow-hidden ${
                  openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
                }`}
                style={isLight ? {
                  background: '#ffffff',
                  border: '1px solid rgba(0,48,135,0.14)',
                  boxShadow: '0 8px 24px rgba(0,48,135,0.10)',
                } : {
                  background: 'rgba(15, 20, 35, 0.98)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                {LANGUAGES.map(({ label, flag }) => (
                  <button
                    key={label}
                    onClick={() => {
                      setShowDropdown(false)
                      onTranslate(message.content, label)
                    }}
                    className="w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center gap-2"
                    style={{ color: isLight ? '#1e293b' : '#e2e8f0' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = isLight ? 'rgba(0,48,135,0.06)' : 'rgba(255,255,255,0.08)'
                      e.currentTarget.style.color = isLight ? '#0f172a' : '#ffffff'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = isLight ? '#1e293b' : '#e2e8f0'
                    }}
                  >
                    <span className="text-[13px]">{flag}</span>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <CopyButton text={message.content} />
      </div>
    </motion.div>
  )
}

// ─── MCP tool name inference (mirrors TelemetrySidebar) ──────────────────────
const MCP_LABEL_TO_TOOL = {
  'Path Traversal via Agent':       'read_file',
  'OS Command Execution via Agent': 'execute_code',
  'Persistent Memory Poisoning':    'set_memory',
  'Tool Shadowing / Override':      'set_memory',
  'PII Exfiltration via File Read': 'read_file',
}

function isMcpMessage(message) {
  const label = message.telemetry?.attackMeta?.label ?? ''
  const tech  = message.telemetry?.attackMeta?.technique ?? ''
  return MCP_LABEL_TO_TOOL[label] != null || tech.toLowerCase().includes('tool') || tech.toLowerCase().includes('memory store')
}


// ─── Assistant bubble ─────────────────────────────────────────────────────────
function AssistantMessage({ message, onOpenTelemetry }) {
  const isBlocked = message.blocked
  const isError = message.verdict === 'ERROR'
const hebrew = isHebrewText(message.content || '')

  // Verdict config — only show pill for BLOCKED and ERROR
  const verdict = isError
    ? { icon: <ShieldX size={11} className="text-orange-400" />, label: 'LLM ERROR', labelColor: 'text-orange-400', dot: 'bg-orange-400', border: 'border-orange-500/20' }
    : isBlocked
    ? { icon: <ShieldX size={11} className="text-red-400" />, label: 'BLOCKED BY AIRS', labelColor: 'text-red-400', dot: 'bg-red-500', border: 'border-red-500/20' }
    : { icon: <ShieldCheck size={11} className="text-emerald-400" />, label: 'AIRS ALLOWED', labelColor: 'text-emerald-400', dot: 'bg-emerald-400', border: 'border-emerald-500/20' }

  const showPill = isBlocked || isError

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex flex-col items-start px-4"
    >
      {/* Verdict pill — only for BLOCKED / ERROR */}
      {showPill && (
      <div className={`flex items-center gap-1.5 mb-1.5 px-2 py-0.5 rounded-full border ${verdict.border} bg-white/3`}>
        <motion.div
          className={`w-1.5 h-1.5 rounded-full ${verdict.dot}`}
          animate={!isBlocked && !isError ? { opacity: [1, 0.4, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        />
        {verdict.icon}
        <span className={`text-[9px] font-bold tracking-wider ${verdict.labelColor}`}>{verdict.label}</span>
        {message.riskScore && (
          <span className={`text-[8px] ${verdict.labelColor} opacity-60`}>· Risk {message.riskScore}/100</span>
        )}
      </div>
      )}

      {/* Bubble */}
      <div
        className="relative max-w-[78%] rounded-[22px] rounded-tl-[5px] px-4 py-3"
        style={{
          background: isBlocked
            ? 'rgba(239,68,68,0.08)'
            : isError
            ? 'rgba(249,115,22,0.08)'
            : 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: isBlocked
            ? '1px solid rgba(239,68,68,0.2)'
            : isError
            ? '1px solid rgba(249,115,22,0.2)'
            : '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.07)',
        }}
      >
        {/* Bubble tail */}
        <div
          className="absolute top-0 -left-1"
          style={{
            width: 0, height: 0,
            borderRight: `8px solid ${isBlocked ? 'rgba(239,68,68,0.15)' : isError ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.07)'}`,
            borderBottom: '8px solid transparent',
          }}
        />

        {(isError || isBlocked) ? (
          <div className="flex items-start gap-2">
            <ShieldX size={13} className={`flex-shrink-0 mt-0.5 ${isError ? 'text-orange-400' : 'text-red-400'}`} />
            <p className={`text-sm leading-relaxed ${isError ? 'text-orange-300' : 'text-red-300'}`}>
              {message.blockReason}
            </p>
          </div>
        ) : (
          <p
            className="leading-relaxed text-[13px] whitespace-pre-wrap break-words text-slate-800 dark:text-slate-100"
            style={hebrew
              ? { fontFamily: 'Arial, sans-serif', direction: 'rtl', textAlign: 'right' }
              : {}
            }
          >
            {message.content}
          </p>
        )}
      </div>

      {/* Pipeline Trace (v2 — animated stepper + tabbed details) */}
      <PipelineTraceV2 message={message} />

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
        {message.traceId && onOpenTelemetry && (
          <button
            onClick={() => onOpenTelemetry(message.traceId)}
            className="flex items-center gap-1 text-slate-500 hover:text-blue-400 transition-colors"
            title="View prompt telemetry"
          >
            <Activity size={9} />
            Prompt Telemetry
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────
export function ChatMessage({ message, onResend, onTranslate, isLoading, isTranslating, onOpenTelemetry }) {
  if (message.role === 'system') return <SystemMessage message={message} />
  if (message.role === 'user') return (
    <UserMessage
      message={message}
      onResend={onResend}
      onTranslate={onTranslate}
      isLoading={isLoading}
      isTranslating={isTranslating}
    />
  )
  if (message.role === 'assistant') return <AssistantMessage message={message} onOpenTelemetry={onOpenTelemetry} />
  return null
}
