import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Paperclip, X, Loader2, ShieldCheck, ShieldX, AlertTriangle, Zap, Shuffle, FileText, Swords, MessageCircle,
} from 'lucide-react'
import { FileDropModal, DropOverlay, useDropTarget } from '../../components/upload/FileDropZone'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'
import { drawSuggestions } from '../api-intercept-2027/Composer'
import { useAttachment } from '../api-intercept-2027/useAttachment'
import { shade, bandBg } from '../home-2027/band'

/**
 * LaunchComposer — the runtime console's message box, in the launcher design.
 *
 * Built like a modern chat composer: suggestions above, then one compact row —
 * an attach icon, the text, and Fire in the pillar's band — with an attached
 * file shown as a card above it. Prose type rather than monospace: it reads
 * as a message, and payloads are still shown verbatim in the transcript.
 *
 * Behaviour is the 2027 composer's: the same suggestion draw (one control,
 * two attacks), and the shared useAttachment — a file is scanned before it
 * can become context, a blocked file is never sent, send waits for a scan.
 */

const hasHebrew = (s) => /[֐-׿]/.test(s)

function Suggestion({ t, q, onPick }) {
  const [hot, setHot] = useState(false)
  const benign = q.kind === 'benign'
  const c = benign ? t.pass : t.block
  const Icon = benign ? MessageCircle : Swords
  return (
    <button type="button" dir="auto" onClick={() => onPick(q.text)}
            onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            title={`${benign ? 'Control — a benign prompt' : 'Attack payload'}: ${q.text}`}
            className="flex items-center gap-2 rounded-full min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            style={{
              padding: '4px 12px 4px 4px', flex: '1 1 0', maxWidth: 340,
              background: hot ? `${c}14` : t.panel,
              border: `1px solid ${hot ? `${c}55` : t.hairline}`,
              boxShadow: hot ? `0 6px 16px ${c}22` : t.shadowSm,
              transition: 'background 140ms ease, border-color 140ms ease, box-shadow 160ms ease',
            }}>
      <span className="inline-flex items-center gap-1 rounded-full flex-shrink-0 px-2"
            style={{ height: 22, ...LBL, fontSize: 8.5, color: benign ? t.pass : t.block, background: `${c}16` }}>
        <Icon size={10} aria-hidden="true" /> {benign ? 'Control' : 'Attack'}
      </span>
      <span className="truncate" style={{
        fontFamily: hasHebrew(q.text) ? '"Heebo", Inter, sans-serif' : FONT.prose, fontSize: 12.5, color: t.ink,
      }}>{q.text}</span>
    </button>
  )
}

function FileCard({ t, attachment, onDetails, onRemove }) {
  const s = attachment.status
  const c = s === 'blocked' || s === 'error' ? t.block : s === 'scanning' ? t.live : s === 'unscanned' ? t.warn : t.pass
  const Icon = s === 'scanning' ? Loader2 : s === 'clean' ? ShieldCheck : s === 'blocked' ? ShieldX : AlertTriangle
  const note = s === 'scanning' ? 'Scanning with Prisma AIRS…'
    : s === 'blocked' ? 'Blocked — this file will not be sent'
    : s === 'error' ? (attachment.error || 'Could not read the file')
    : s === 'unscanned' ? 'Not scanned — AIRS is off'
    : `Clean${attachment.pages ? ` · ${attachment.pages} pages` : ''}${attachment.chars ? ` · ${attachment.chars.toLocaleString()} chars` : ''}`
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                className="flex items-center gap-3 rounded-2xl mx-2 mt-2 px-2.5 py-2"
                style={{ background: t.panel, border: `1px solid ${c}44`, boxShadow: `0 4px 12px ${c}18` }}>
      <span className="relative grid place-items-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: `${c}16`, color: c }}>
        <FileText size={16} aria-hidden="true" />
        <span className="absolute grid place-items-center rounded-full" style={{ right: -4, bottom: -4, width: 17, height: 17, background: t.panel, color: c }}>
          <Icon size={11} className={s === 'scanning' ? 'animate-spin' : ''} aria-hidden="true" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{attachment.name}</span>
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: s === 'clean' ? t.inkDim : c, marginTop: 1 }}>
          {note}{attachment.detected?.length > 0 ? ` · ${attachment.detected.join(', ')}` : ''}
        </span>
      </span>
      {s !== 'scanning' && (
        <button type="button" onClick={onDetails} className="rounded-full px-2.5 flex-shrink-0"
                style={{ height: 26, fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.ink, background: t.sunken, border: `1px solid ${t.hairline}` }}>
          Details
        </button>
      )}
      <button type="button" onClick={onRemove} aria-label="Remove the file" title="Remove"
              className="grid place-items-center rounded-full flex-shrink-0" style={{ width: 26, height: 26, color: t.inkDim }}>
        <X size={13} />
      </button>
    </motion.div>
  )
}

export function LaunchComposer({ t, tone, isProtected, isLoading, onSend, onScan }) {
  const [text, setText] = useState('')
  const [dropOpen, setDropOpen] = useState(false)
  const [focus, setFocus] = useState(false)
  const [hotFire, setHotFire] = useState(false)
  const taRef = useRef(null)
  const { attachment, busy, pending, doc, uploadFile, clear } = useAttachment({ isProtected, onScan })
  const { dragging, handlers } = useDropTarget(uploadFile, { enabled: !isLoading && !busy })
  const canSend = text.trim() && !isLoading && !pending
  // Drawn once per mount — a fresh set per render would flicker as you type.
  const [suggestions, setSuggestions] = useState(drawSuggestions)
  const sh = shade(tone)

  const submit = (e) => {
    e?.preventDefault()
    if (!canSend) return
    onSend(text.trim(), doc)
    setText('')
    clear()
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  const pick = (q) => { setText(q); requestAnimationFrame(() => { taRef.current?.focus(); grow(taRef.current) }) }
  const grow = (el) => { if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px` }

  return (
    <div className="relative flex-shrink-0 mx-3 mb-3 mt-2" {...handlers}>
      <DropOverlay visible={dragging} isProtected={isProtected} />
      <FileDropModal open={dropOpen} onClose={() => setDropOpen(false)} onFile={uploadFile}
                     isProtected={isProtected} busy={busy} limitsUrl="/api/upload/limits" />

      {/* ── suggestions: one control, two attacks ── */}
      <AnimatePresence initial={false}>
        {!text && !attachment && (
          <motion.div key="sugg" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }} className="overflow-hidden">
            {/* One row: the chips share it and truncate (the full text is on
                hover); three stacked rows ate a third of the transcript. */}
            <div className="flex items-center gap-2 pb-2.5 px-1">
              {suggestions.map((q) => <Suggestion key={q.text} t={t} q={q} onPick={pick} />)}
              <button type="button" onClick={() => setSuggestions(drawSuggestions())} aria-label="Draw three more prompts" title="Draw three more prompts"
                      className="grid place-items-center rounded-full flex-shrink-0"
                      style={{ width: 30, height: 30, color: t.inkDim, background: 'transparent', border: `1px dashed ${t.railBed}` }}>
                <Shuffle size={13} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── the box ── */}
      <form onSubmit={submit}
            className="relative"
            style={{
              ...glass(t, { radius: 24 }),
              border: `1px solid ${focus ? `${tone}66` : t.glassEdge}`,
              boxShadow: focus ? `0 0 0 4px ${tone}1a, ${t.shadow}` : t.shadow,
              transition: 'border-color 160ms ease, box-shadow 200ms ease',
            }}>
        <AnimatePresence>
          {attachment && (
            <FileCard key="file" t={t} attachment={attachment}
                      onDetails={() => onScan?.(attachment)} onRemove={() => { clear(); onScan?.(null) }} />
          )}
        </AnimatePresence>

        {/* One row: attach · text · Fire. Buttons sit on the last line as the
            text grows. AIRS state and the target are already on the header
            and the target cards; repeating them here only widened the box. */}
        <div className="flex items-end gap-2 p-1.5">
          <button type="button" onClick={() => setDropOpen(true)} disabled={isLoading || busy}
                  aria-label="Attach a document" title="Attach a document — drag one in, or click for formats and limits"
                  className="grid place-items-center rounded-full flex-shrink-0 transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  style={{ width: 38, height: 38, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = t.ink }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = t.inkDim }}>
            <Paperclip size={16} aria-hidden="true" />
          </button>

          <textarea
            ref={(el) => { taRef.current = el; el?.style.setProperty('background-color', 'transparent', 'important') }}
            value={text} rows={1} dir="auto" disabled={isLoading}
            onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            onChange={(e) => { setText(e.target.value); grow(e.target) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e) }}
            placeholder={attachment ? 'Ask something about the file…' : 'Ask anything, or paste an attack payload…'}
            aria-label="Message"
            className="flex-1 min-w-0 resize-none outline-none self-center"
            style={{
              padding: '8px 4px', border: 'none', maxHeight: 160, lineHeight: 1.5,
              fontFamily: hasHebrew(text) ? '"Heebo", Inter, sans-serif' : FONT.prose, fontSize: 14.5, color: t.ink,
            }}
          />

          <motion.button type="submit" disabled={!canSend}
                         onMouseEnter={() => setHotFire(true)} onMouseLeave={() => setHotFire(false)}
                         whileTap={canSend ? { scale: 0.96 } : {}}
                         title={pending ? 'Waiting for the AIRS scan to finish' : isLoading ? 'Waiting for the answer' : 'Fire (Enter) — Shift+Enter for a new line'}
                         className="relative inline-flex items-center gap-2 rounded-full px-5 flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                         style={{
                           height: 38, fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, letterSpacing: '0.01em',
                           color: canSend ? '#fff' : t.inkDim,
                           background: canSend ? bandBg(tone) : t.sunken,
                           border: `1px solid ${canSend ? 'transparent' : t.hairline}`,
                           boxShadow: canSend ? `0 8px 20px ${tone}${hotFire ? '66' : '44'}` : 'none',
                           transition: 'box-shadow 180ms ease, color 160ms ease',
                           cursor: canSend ? 'pointer' : 'default',
                         }}>
            {isLoading
              ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              : <Zap size={14} aria-hidden="true" style={{ color: canSend ? '#fff' : sh }} />}
            {isLoading ? 'Firing…' : 'Fire'}
          </motion.button>
        </div>
      </form>
    </div>
  )
}
