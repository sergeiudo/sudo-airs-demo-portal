import React, { useEffect, useRef, useState } from 'react'
import {
  MessageCircleQuestion, ArrowUp, Loader2, Search, Trash2, BookOpen, Eye, Library, Sparkles, Layers,
} from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots, bandGlass } from '../home-2027/band'
import { deepBand } from '../runtime-launch/diagramKit'
import { CopyIcon } from './CodeTabs'
import { useAskStore, askAirs, removeAsk, clearAsks, selectAsk, indexLine } from '../../components/shared/askairs/askStore'
import { ASK_TONE, focusCls, inkOn, AnswerBody, AnswerFoot, ResearchSteps, SourceRow, plainAnswer } from '../../components/shared/askairs/AskParts'
import { ASK_SUGGESTIONS } from '../../components/shared/askairs/AskAirs'

/**
 * Ask AIRS in the Developer Corner — the full-width view of the docs helper
 * that also sits as a drawer on every pillar (components/shared/askairs).
 * Same store, same thread, same server (/api/assist): here the answer gets
 * the middle pane and its sources the right one.
 */

const SUGGESTIONS = [
  ...ASK_SUGGESTIONS,
  'What HTTP status does an AI Gateway guardrail deny return?',
  'Which fields does the AIRS synchronous scan request take?',
]

export function useAskDocs() {
  const s = useAskStore()
  return { ...s, setSelected: selectAsk, ask: (q) => askAirs(q), remove: removeAsk, clear: clearAsks }
}

// ─── the rail entry ──────────────────────────────────────────────────────────

/** The card at the top of the guide rail; with a query, it offers to ask the query itself. */
export function AskRailCard({ t, active, status, query, onOpen, onAskQuery }) {
  const [hot, setHot] = useState(false)
  const q = query?.trim()
  return (
    <div className="space-y-1.5">
      <button type="button" onClick={onOpen} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center gap-2.5 rounded-2xl text-left ${focusCls}`}
              style={{ padding: '9px 10px', background: active ? `${ASK_TONE}14` : hot ? t.sunken : t.panel, border: `1px solid ${active || hot ? `${ASK_TONE}66` : t.hairline}`, transition: 'background 140ms, border-color 140ms' }}>
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 34, height: 34, background: bandBg(ASK_TONE), boxShadow: active || hot ? `0 5px 12px ${ASK_TONE}55` : 'none' }}>
          <MessageCircleQuestion size={16} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>Ask AIRS</span>
          <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
            {status?.state === 'ready' ? `${status.pages.toLocaleString()} pages · every answer cites its page` : indexLine(status)}
          </span>
        </span>
      </button>
      {q && (
        <button type="button" onClick={() => onAskQuery(q)}
                className={`w-full flex items-center gap-2 rounded-xl px-2.5 text-left ${focusCls}`}
                style={{ minHeight: 32, background: `${ASK_TONE}0d`, border: `1px dashed ${ASK_TONE}66`, fontFamily: FONT.prose, fontSize: 12, color: t.ink }}>
          <ArrowUp size={13} style={{ color: inkOn(t, ASK_TONE, 0.25), flexShrink: 0 }} aria-hidden="true" />
          <span className="min-w-0 truncate">Ask AIRS: <b style={{ fontWeight: 650 }}>“{q}”</b></span>
        </button>
      )}
    </div>
  )
}

// ─── the answer view ─────────────────────────────────────────────────────────

function AskBand({ t, status }) {
  return (
    <div className="relative overflow-hidden rounded-3xl" style={{ background: deepBand(ASK_TONE), boxShadow: `0 14px 32px ${ASK_TONE}2e` }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
      <MessageCircleQuestion aria-hidden="true" strokeWidth={1.2} style={{ position: 'absolute', right: -26, bottom: -48, width: 190, height: 190, color: '#fff', opacity: 0.13, transform: 'rotate(-10deg)' }} />
      <div className="relative flex items-start gap-4 px-5 py-5">
        <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
          <MessageCircleQuestion size={22} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div style={{ ...LBL, fontSize: 10, color: 'rgba(255,255,255,0.86)' }}>Your Prisma AIRS sidekick</div>
          <h1 style={{ fontFamily: FONT.display, fontSize: 25, fontWeight: 700, color: '#fff', lineHeight: 1.18, margin: '4px 0 0' }}>Ask AIRS</h1>
          <p style={{ fontFamily: FONT.prose, fontSize: 13.5, color: 'rgba(255,255,255,0.92)', margin: '5px 0 0' }}>
            Ask anything about Prisma AIRS. Claude searches the official docs — admin guides, the API reference and its specs, the AI Gateway docs, the release notes — reads the pages, opens live official pages when it needs to, and answers with sources. The same sidekick opens from every page: “Ask AIRS” in the header.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5" style={{ height: 26, ...bandGlass, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600 }}>
              {status?.state === 'building' ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <BookOpen size={12} aria-hidden="true" />} {indexLine(status)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AskBox({ t, onAsk, disabled, pending }) {
  const [text, setText] = useState('')
  const ref = useRef(null)
  const submit = () => { if (!text.trim() || disabled) return; onAsk(text); setText('') }
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div className="flex items-end gap-2 rounded-3xl p-2" style={{ background: t.panel, border: `1.5px solid ${ASK_TONE}55`, boxShadow: `0 8px 22px ${ASK_TONE}14` }}>
      <textarea ref={(el) => { ref.current = el; el?.style.setProperty('background-color', 'transparent', 'important') }}
                value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={600}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
                placeholder="Ask anything about Prisma AIRS — scans, profiles, guardrails, models, red teaming, the gateway…"
                aria-label="Your question for Ask AIRS"
                className="flex-1 min-w-0 resize-none outline-none px-2.5 py-1.5" style={{ fontFamily: FONT.prose, fontSize: 14, lineHeight: 1.5, color: t.ink, border: 'none' }} />
      <button type="button" onClick={submit} disabled={disabled || !text.trim()} aria-label="Ask"
              className={`inline-flex items-center gap-1.5 rounded-full px-4 flex-shrink-0 disabled:opacity-45 ${focusCls}`}
              style={{ height: 38, fontFamily: FONT.prose, fontSize: 13, fontWeight: 700, color: '#fff', background: shade(ASK_TONE), boxShadow: `0 4px 12px ${ASK_TONE}40` }}>
        {pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ArrowUp size={14} aria-hidden="true" />} Ask
      </button>
    </div>
  )
}

function AskItem({ t, item, selected, onSelect }) {
  return (
    <article onClick={onSelect} className="rounded-3xl overflow-hidden"
             style={{ background: t.panel, border: `1px solid ${selected ? `${ASK_TONE}66` : t.glassEdge}`, boxShadow: selected ? `0 12px 26px ${ASK_TONE}1a` : t.shadowSm, transition: 'border-color 160ms, box-shadow 200ms', cursor: selected ? 'default' : 'pointer' }}>
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${ASK_TONE}17`, color: inkOn(t, ASK_TONE, 0.25) }}>
          <MessageCircleQuestion size={15} aria-hidden="true" />
        </span>
        <h2 className="min-w-0 flex-1" style={{ fontFamily: FONT.display, fontSize: 15.5, fontWeight: 700, lineHeight: 1.35, color: t.ink, margin: '4px 0 0' }}>{item.question}</h2>
        {!item.pending && (
          <span className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {item.answer && <span className="grid place-items-center rounded-full" style={{ width: 28, height: 28, color: t.inkDim }} title="Copy the answer with its sources"><CopyIcon text={plainAnswer(item)} light={t.isLight} size={13} /></span>}
            <button type="button" onClick={() => removeAsk(item.id)} aria-label="Remove this question" className={`grid place-items-center rounded-full ${focusCls}`} style={{ width: 28, height: 28, color: t.inkFaint }}>
              <Trash2 size={13} />
            </button>
          </span>
        )}
      </div>
      <div className="px-4 pb-4 pt-2.5 space-y-3" style={{ paddingLeft: 58 }}>
        <ResearchSteps t={t} item={item} />
        {!item.pending && (
          <>
            {item.answer && <AnswerBody t={t} item={item} />}
            <AnswerFoot t={t} item={item} />
          </>
        )}
      </div>
    </article>
  )
}

export function AskView({ t, ask, onGo }) {
  const { items, current, setSelected, clear, status, pending } = ask
  const ready = status?.state === 'ready'
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto px-5 py-4 space-y-5" style={{ maxWidth: 900 }}>
        <AskBand t={t} status={status} />
        <AskBox t={t} onAsk={ask.ask} disabled={!ready || pending} pending={pending} />
        {(items.length === 0 || !pending) && (
          <div>
            <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, margin: '0 4px 8px' }}>{items.length ? 'Try also' : 'Try asking'}</div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.filter((s) => !items.some((i) => i.question === s)).slice(0, items.length ? 3 : 6).map((s) => (
                <button key={s} type="button" onClick={() => ask.ask(s)} disabled={!ready || pending}
                        className={`rounded-full px-3 text-left disabled:opacity-45 ${focusCls}`}
                        style={{ minHeight: 30, fontFamily: FONT.prose, fontSize: 12.5, color: t.ink, background: t.panel, border: `1px solid ${t.hairline}` }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${ASK_TONE}66` }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.hairline }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {items.map((item) => (
          <AskItem key={item.id} t={t} item={item} selected={current?.id === item.id} onSelect={() => setSelected(item.id)} />
        ))}
        {items.length > 1 && !pending && (
          <div className="flex justify-center">
            <button type="button" onClick={clear} className={`inline-flex items-center gap-1.5 rounded-full px-3 ${focusCls}`}
                    style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
              <Trash2 size={12} aria-hidden="true" /> Clear the conversation ({items.length})
            </button>
          </div>
        )}
        <p className="px-1 pb-4" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.55, color: t.inkFaint }}>
          Claude decides what to search and read; every claim from the docs cites its source, field notes from a live SCM tenant and known contradictions between doc pages are labelled, and anything from the model&apos;s own knowledge is marked “model knowledge”. Check anything that matters on the page itself — the chips open it. Nothing is saved: the conversation is gone when you reload.
          {onGo && <> Browse every AI Gateway page in <button type="button" onClick={() => onGo('docs-aigw')} className={`underline underline-offset-2 ${focusCls}`} style={{ color: inkOn(t, t.live, 0.2) }}>the catalog</button>.</>}
        </p>
      </div>
    </div>
  )
}

// ─── the right pane: where the answer came from ──────────────────────────────

export function AskSources({ t, ask }) {
  const { current, status } = ask
  const sources = current?.sources ?? []
  return (
    <div className="h-full flex flex-col overflow-hidden" style={glass(t, { radius: 22 })}>
      <div className="relative flex-shrink-0 overflow-hidden" style={{ background: deepBand(ASK_TONE) }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
        <div className="relative px-4 py-3.5">
          <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Sources</div>
          <div style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 2 }}>
            {current ? (current.pending ? `Researching… ${sources.length} source${sources.length === 1 ? '' : 's'} so far` : `${sources.length} source${sources.length === 1 ? '' : 's'} consulted`) : 'Where answers come from'}
          </div>
          <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>{current?.question ?? indexLine(status)}</div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {!current && (
          <>
            {(status?.collections ?? []).filter((c) => c.pages).length > 0 && (
              <div className="rounded-2xl px-3 py-2.5" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
                <div style={{ ...LBL, fontSize: 9, color: t.inkDim, marginBottom: 6 }}>What is indexed</div>
                {status.collections.filter((c) => c.pages).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 py-0.5" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.ink }}>
                    <span className="truncate">{c.label}</span><span style={{ color: t.inkDim, fontVariantNumeric: 'tabular-nums' }}>{c.pages.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            {[
              { icon: Library, title: 'The official docs, whole', sub: 'Five admin guides, the pan.dev API reference and its OpenAPI specs, the AI Gateway developer docs and the release notes — re-read daily.' },
              { icon: Search, title: 'It researches first', sub: 'Claude searches in the docs\' own words, tries again when results are off, and reads whole pages before explaining a procedure.' },
              { icon: Layers, title: 'Live pages when needed', sub: 'If the index lacks something, it can open a live page on the official docs sites — and only those.' },
              { icon: Eye, title: 'Honest about where it comes from', sub: 'Docs claims cite their source; field notes, doc conflicts and the model\'s own knowledge are labelled as such.' },
            ].map((r) => (
              <div key={r.title} className="flex items-start gap-3 rounded-2xl px-3 py-2.5" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
                <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${ASK_TONE}17`, color: inkOn(t, ASK_TONE, 0.25) }}><r.icon size={14} aria-hidden="true" /></span>
                <span className="min-w-0">
                  <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{r.title}</span>
                  <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>{r.sub}</span>
                </span>
              </div>
            ))}
          </>
        )}
        {current?.pending && !sources.length && <p className="px-2 py-4" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}><Sparkles size={12} className="inline mr-1" aria-hidden="true" />Researching…</p>}
        {sources.map((s) => <SourceRow key={s.id} t={t} s={s} />)}
      </div>
    </div>
  )
}
