import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircleQuestion, ArrowUp, Loader2, X, Trash2, ChevronDown, Maximize2, BookOpen } from 'lucide-react'
import { useAppContext } from '../../../context/AppContext'
import { tokens, FONT, label as LBL } from '../../../views/api-intercept-2027/tokens'
import { shade, bandDots, bandGlass } from '../../../views/home-2027/band'
import { deepBand } from '../../../views/runtime-launch/diagramKit'
import { CopyIcon } from '../../../views/developer-corner/CodeTabs'
import { Tip } from '../Tip'
import { PILLAR_BY_ID } from '../../../data/assist-pillars'
import { useAskStore, openAskAirs, closeAskAirs, askAirs, removeAsk, clearAsks, indexLine, requestAskView } from './askStore'
import { ASK_TONE, focusCls, inkOn, AnswerBody, AnswerFoot, Pending, SourceRow, plainAnswer } from './AskParts'

/**
 * Ask AIRS — the docs helper on every pillar of the New design.
 *
 * AskAirsButton sits in the pillar header (variant band) and the app bars
 * (variant bar); AskAirsDrawer is rendered once by App.jsx. The drawer does
 * not block the page — read an answer while you keep using the pillar. It
 * knows which pillar is open (its products rank first, its questions are
 * suggested); the server does the rest (/api/assist, assist-routes.js).
 */

export function AskAirsButton({ t, variant = 'bar' }) {
  const band = variant === 'band'
  const [hot, setHot] = useState(false)
  return (
    <Tip title="Ask AIRS" text="Ask the Prisma AIRS docs — admin guides, API reference, AI Gateway docs, release notes. Every answer cites its page.">
      <button type="button" onClick={openAskAirs} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} aria-haspopup="dialog"
              className={`inline-flex items-center gap-1.5 rounded-full flex-shrink-0 whitespace-nowrap ${band ? 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white' : focusCls}`}
              style={band
                ? { height: 30, padding: '0 12px 0 9px', fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, ...bandGlass, background: hot ? 'rgba(0,0,0,0.34)' : bandGlass.background, transition: 'background 160ms ease' }
                : { height: 38, padding: '0 14px 0 11px', fontFamily: FONT.prose, fontSize: 13, fontWeight: 600, color: t.ink, background: hot ? t.sunken : t.panel, border: `1px solid ${hot ? `${ASK_TONE}66` : t.hairline}`, transition: 'background 160ms ease, border-color 160ms ease' }}>
        <MessageCircleQuestion size={14} style={{ color: band ? '#fff' : inkOn(t, ASK_TONE, 0.2) }} aria-hidden="true" />
        Ask AIRS
      </button>
    </Tip>
  )
}

function Thread({ t, item, pillarId, status }) {
  const [showSources, setShowSources] = useState(false)
  const askedOn = item.pillar && item.pillar !== pillarId ? PILLAR_BY_ID[item.pillar]?.title : null
  return (
    <article className="rounded-2xl overflow-hidden" style={{ background: t.panel, border: `1px solid ${t.glassEdge}`, boxShadow: t.shadowSm }}>
      <div className="flex items-start gap-2.5 px-3.5 pt-3">
        <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 26, height: 26, background: `${ASK_TONE}17`, color: inkOn(t, ASK_TONE, 0.25) }}>
          <MessageCircleQuestion size={13} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 style={{ fontFamily: FONT.display, fontSize: 14.5, fontWeight: 700, lineHeight: 1.35, color: t.ink, margin: '3px 0 0' }}>{item.question}</h3>
          {askedOn && <span className="inline-block rounded-full px-2 mt-1" style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: '17px', color: t.inkDim, background: t.sunken }}>asked on {askedOn}</span>}
        </div>
        {!item.pending && (
          <span className="flex items-center gap-0.5 flex-shrink-0">
            {item.answer && <span className="grid place-items-center rounded-full" style={{ width: 26, height: 26, color: t.inkDim }} title="Copy the answer with its sources"><CopyIcon text={plainAnswer(item)} light={t.isLight} size={12} /></span>}
            <button type="button" onClick={() => removeAsk(item.id)} aria-label="Remove this question" className={`grid place-items-center rounded-full ${focusCls}`} style={{ width: 26, height: 26, color: t.inkFaint }}><Trash2 size={12} /></button>
          </span>
        )}
      </div>
      <div className="px-3.5 pb-3 pt-2 space-y-2.5">
        {item.pending ? <Pending t={t} status={status} /> : (
          <>
            {item.answer && <AnswerBody t={t} item={item} size={13.5} />}
            <AnswerFoot t={t} item={item} />
            {item.sources?.length > 0 && (
              <div>
                <button type="button" onClick={() => setShowSources((v) => !v)} aria-expanded={showSources}
                        className={`inline-flex items-center gap-1 rounded-full ${focusCls}`} style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: inkOn(t, t.live, 0.2) }}>
                  <BookOpen size={12} aria-hidden="true" /> {showSources ? 'Hide' : 'Show'} the {item.sources.length} sources
                  <ChevronDown size={12} style={{ transform: showSources ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} aria-hidden="true" />
                </button>
                {showSources && <div className="space-y-1 mt-2">{item.sources.map((s) => <SourceRow key={s.n} t={t} s={s} compact />)}</div>}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  )
}

export function AskAirsDrawer() {
  const { state, dispatch } = useAppContext()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const ask = useAskStore()
  const pillar = PILLAR_BY_ID[state.activeView] ?? null
  const [text, setText] = useState('')
  const inputRef = useRef(null)
  const ready = ask.status?.state === 'ready'

  useEffect(() => {
    if (!ask.open) return undefined
    const id = setTimeout(() => inputRef.current?.focus(), 120)
    const onKey = (e) => { if (e.key === 'Escape') closeAskAirs() }
    document.addEventListener('keydown', onKey)
    return () => { clearTimeout(id); document.removeEventListener('keydown', onKey) }
  }, [ask.open])

  const submit = (q = text) => { if (!q.trim() || !ready || ask.pending) return; askAirs(q, pillar?.id ?? state.activeView); setText('') }
  const fullView = () => {
    closeAskAirs()
    requestAskView()
    dispatch({ type: 'SET_VIEW', payload: 'developerCorner' })
  }
  const suggestions = (pillar?.questions ?? PILLAR_BY_ID.home.questions).filter((q) => !ask.items.some((i) => i.question === q))

  return createPortal(
    <AnimatePresence>
      {ask.open && (
        <motion.aside key="ask-airs" role="dialog" aria-modal="false" aria-label="Ask AIRS"
                      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 34 }}
                      className="fixed top-0 right-0 bottom-0 flex flex-col"
                      style={{ zIndex: 80, width: 600, maxWidth: '100vw', background: t.ground, borderLeft: `1px solid ${t.hairline}`, boxShadow: t.isLight ? '-16px 0 44px rgba(18,18,22,0.16)' : '-16px 0 44px rgba(0,0,0,0.55)' }}>
          <div className="relative flex-shrink-0 overflow-hidden" style={{ background: deepBand(ASK_TONE) }}>
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
            <MessageCircleQuestion aria-hidden="true" strokeWidth={1.2} style={{ position: 'absolute', right: -26, bottom: -48, width: 160, height: 160, color: '#fff', opacity: 0.13, transform: 'rotate(-10deg)' }} />
            <div className="relative flex items-center gap-3 px-4 py-3.5">
              <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
                <MessageCircleQuestion size={19} style={{ color: '#fff' }} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate" style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Ask AIRS{pillar ? ` · ${pillar.title}` : ''}</div>
                <div style={{ fontFamily: FONT.display, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.15, marginTop: 2 }}>Ask the Prisma AIRS docs</div>
                <div className="truncate" aria-live="polite" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
                  {ask.status?.state === 'building' && <Loader2 size={11} className="animate-spin inline mr-1" aria-hidden="true" />}{indexLine(ask.status)} · every answer cites its page
                </div>
              </div>
              <button type="button" onClick={fullView} aria-label="Open the full view in the Developer Corner" title="Full view (Developer Corner)"
                      className="grid place-items-center rounded-full flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" style={{ width: 30, height: 30, ...bandGlass }}>
                <Maximize2 size={13} />
              </button>
              <button type="button" onClick={closeAskAirs} aria-label="Close Ask AIRS"
                      className="grid place-items-center rounded-full flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" style={{ width: 30, height: 30, ...bandGlass }}>
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3.5 space-y-3">
            <div className="flex items-end gap-2 rounded-2xl p-1.5" style={{ background: t.panel, border: `1.5px solid ${ASK_TONE}55`, boxShadow: `0 8px 20px ${ASK_TONE}14` }}>
              <textarea ref={(el) => { inputRef.current = el; el?.style.setProperty('background-color', 'transparent', 'important') }}
                        value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={600}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
                        placeholder={pillar && pillar.id !== 'home' ? `Ask about ${pillar.title} — or anything in Prisma AIRS…` : 'Ask anything about Prisma AIRS…'}
                        aria-label="Your question for Ask AIRS"
                        className="flex-1 min-w-0 resize-none outline-none px-2 py-1.5" style={{ fontFamily: FONT.prose, fontSize: 13.5, lineHeight: 1.5, color: t.ink, border: 'none' }} />
              <button type="button" onClick={() => submit()} disabled={!ready || ask.pending || !text.trim()} aria-label="Ask"
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 flex-shrink-0 disabled:opacity-45 ${focusCls}`}
                      style={{ height: 34, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 700, color: '#fff', background: shade(ASK_TONE), boxShadow: `0 4px 12px ${ASK_TONE}40` }}>
                {ask.pending ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <ArrowUp size={13} aria-hidden="true" />} Ask
              </button>
            </div>

            {suggestions.length > 0 && !ask.pending && (
              <div>
                <div style={{ ...LBL, fontSize: 9, color: t.inkDim, margin: '0 4px 6px' }}>{pillar && pillar.id !== 'home' ? `Asked about ${pillar.title}` : 'Try asking'}</div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.slice(0, ask.items.length ? 2 : 4).map((q) => (
                    <button key={q} type="button" onClick={() => submit(q)} disabled={!ready}
                            className={`rounded-full px-3 text-left disabled:opacity-45 ${focusCls}`}
                            style={{ minHeight: 28, fontFamily: FONT.prose, fontSize: 12, color: t.ink, background: t.panel, border: `1px solid ${t.hairline}` }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${ASK_TONE}66` }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.hairline }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ask.items.map((item) => <Thread key={item.id} t={t} item={item} pillarId={pillar?.id} status={ask.status} />)}

            {ask.items.length > 1 && !ask.pending && (
              <div className="flex justify-center">
                <button type="button" onClick={clearAsks} className={`inline-flex items-center gap-1.5 rounded-full px-3 ${focusCls}`}
                        style={{ height: 26, fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
                  <Trash2 size={11} aria-hidden="true" /> Clear the conversation ({ask.items.length})
                </button>
              </div>
            )}
            <p className="px-1 pb-2" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.5, color: t.inkFaint }}>
              Answers come only from the Prisma AIRS admin guides, the pan.dev API reference and its OpenAPI specs, the AI Gateway docs, the release notes and this portal&apos;s own guides — refreshed daily — and cite the passages they used. {pillar && pillar.id !== 'home' ? `On ${pillar.title}, its products rank first.` : ''} Check anything that matters on the page itself. Nothing is saved — the conversation is gone when you reload.
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body,
  )
}
