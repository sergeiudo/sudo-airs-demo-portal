import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldX, ShieldCheck, Zap, Info, RefreshCw, ArrowDownToLine, ArrowUpFromLine, Languages, Copy, Check } from 'lucide-react'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'

const messageVariants = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: 'spring', stiffness: 400, damping: 30 },
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
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[9px] text-slate-600 hover:text-slate-300 transition-colors"
      title="Copy message"
    >
      {copied ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function ChatMessage({ message, onResend, onResendHebrew, isLoading, isTranslating }) {
  const theme = useProtectionTheme()

  if (message.role === 'system') {
    return (
      <motion.div
        variants={messageVariants}
        initial="initial"
        animate="animate"
        className="flex items-start gap-2 px-4"
      >
        <Info size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-500 italic">{message.content}</p>
      </motion.div>
    )
  }

  if (message.role === 'user') {
    return (
      <motion.div
        variants={messageVariants}
        initial="initial"
        animate="animate"
        className="flex justify-end px-4"
      >
        <div className="max-w-[80%]">
          {/* Attack meta badge */}
          {message.attackMeta && (
            <div className="flex items-center gap-2 mb-1 justify-end">
              <span className="text-[9px] text-slate-600 font-mono">{message.attackMeta.technique}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                message.attackMeta.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                message.attackMeta.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {message.attackMeta.severity.toUpperCase()}
              </span>
            </div>
          )}
          <div className="rounded-xl rounded-tr-sm bg-white/10 border border-white/15 px-3 py-2.5">
            <p className="text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 mt-1">
            <span className="text-[9px] text-slate-600">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
            {onResend && (
              <button
                onClick={onResend}
                disabled={isLoading}
                className="flex items-center gap-1 text-[9px] text-slate-600 hover:text-slate-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Resend this message"
              >
                <RefreshCw size={9} className={isLoading && !isTranslating ? 'animate-spin' : ''} />
                Resend
              </button>
            )}
            {onResendHebrew && (
              <button
                onClick={onResendHebrew}
                disabled={isLoading}
                className="flex items-center gap-1 text-[9px] text-blue-400/70 hover:text-blue-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Translate to Hebrew and send"
              >
                <Languages size={9} className={isTranslating ? 'animate-spin' : ''} />
                He
              </button>
            )}
            <CopyButton text={message.content} />
          </div>
        </div>
      </motion.div>
    )
  }

  if (message.role === 'assistant') {
    const isBlocked = message.blocked

    return (
      <motion.div
        variants={messageVariants}
        initial="initial"
        animate="animate"
        className="flex justify-start px-4"
      >
        <div className="max-w-[80%]">
          {/* Verdict badge */}
          <div className="flex items-center gap-2 mb-1">
            {message.verdict === 'ERROR' ? (
              <>
                <ShieldX size={12} className="text-orange-400" />
                <span className="text-[9px] font-bold text-orange-400 tracking-wider">LLM ERROR</span>
              </>
            ) : isBlocked ? (
              <>
                <ShieldX size={12} className="text-red-400" />
                <span className="text-[9px] font-bold text-red-400 tracking-wider">BLOCKED BY AIRS</span>
                {message.riskScore && (
                  <span className="text-[9px] text-red-400/60">· Risk {message.riskScore}/100</span>
                )}
              </>
            ) : message.verdict === 'DIRECT' ? (
              <>
                <Zap size={12} className="text-slate-500" />
                <span className="text-[9px] font-bold text-slate-500 tracking-wider">DIRECT — NO AIRS SCAN</span>
              </>
            ) : (
              <>
                <ShieldCheck size={12} className="text-emerald-400" />
                <span className="text-[9px] font-bold text-emerald-400 tracking-wider">AIRS ALLOWED</span>
                {message.riskScore && (
                  <span className="text-[9px] text-emerald-400/60">· Risk {message.riskScore}/100</span>
                )}
              </>
            )}
          </div>

          <div className={`rounded-xl rounded-tl-sm px-3 py-2.5 border ${
            message.verdict === 'ERROR'
              ? 'bg-orange-500/10 border-orange-500/25'
              : isBlocked
              ? 'bg-red-500/10 border-red-500/25'
              : 'bg-white/5 border-white/10'
          }`}>
            {(message.verdict === 'ERROR' || isBlocked) ? (
              <div className="flex items-start gap-2">
                <ShieldX size={12} className={`flex-shrink-0 mt-0.5 ${message.verdict === 'ERROR' ? 'text-orange-400' : 'text-red-400'}`} />
                <p className={`text-xs leading-relaxed ${message.verdict === 'ERROR' ? 'text-orange-300' : 'text-red-300'}`}>
                  {message.blockReason}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-200 leading-relaxed">{message.content}</p>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[9px] text-slate-600">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
            {(message.tokensIn != null || message.tokensOut != null) && (
              <div className="flex items-center gap-2">
                {message.tokensIn != null && (
                  <span className="flex items-center gap-1 text-[9px] text-blue-400/70">
                    <ArrowDownToLine size={9} />
                    {message.tokensIn.toLocaleString()} in
                  </span>
                )}
                {message.tokensOut != null && (
                  <span className="flex items-center gap-1 text-[9px] text-violet-400/70">
                    <ArrowUpFromLine size={9} />
                    {message.tokensOut.toLocaleString()} out
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  return null
}
