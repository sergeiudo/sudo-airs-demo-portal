import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  MessageCircleQuestion, ArrowUp, Loader2, ExternalLink, ShieldCheck, ShieldX, AlertTriangle, Search, Trash2, BookOpen, Eye, ChevronDown, Library,
} from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots, bandGlass } from '../home-2027/band'
import { deepBand } from '../runtime-launch/diagramKit'
import { Markdown } from '../api-intercept-2027/Markdown'
import { CodeTabs, CopyIcon } from './CodeTabs'

/**
 * Ask the AI Gateway docs.
 *
 * The server holds the official Prisma AIRS AI Gateway docs (aigw-docs.js,
 * ~600 pages from portkey.ai), ranks the passages that match a question, and
 * sends them with the question through the SCM AI Gateway's AIRS-protected
 * config (/api/dev/docs/ask). The model is told to answer only from those
 * passages and to cite them; a citation chip opens the exact page.
 *
 * The answer is model output — rendered as React nodes by Markdown, never as
 * HTML, with http(s)-only links. Each question stands alone (no chat memory);
 * the last 20 are kept in this browser as a research log.
 */

export const ASK_TONE = '#EC4899'
const KEY = 'sudo-airs.dev.ask'
const MAX_KEEP = 20
const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
const inkOn = (t, c, k = 0.3) => (t.isLight ? shade(c, k) : c)

const SUGGESTIONS = [
  'What HTTP status does a guardrail deny return, and how do I detect a block?',
  'How do I set up a fallback from Bedrock to Vertex AI?',
  'How does the circuit breaker decide a target is unhealthy?',
  'Which parameters does the Prisma AIRS guardrail check take?',
  'How do I rotate a gateway API key without downtime?',
  'Which response headers tell me which provider and target served a request?',
]

const readLog = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
const writeLog = (items) => { try { localStorage.setItem(KEY, JSON.stringify(items.filter((i) => !i.pending).slice(0, MAX_KEEP))) } catch { /* quota / private mode */ } }

// ─── state ───────────────────────────────────────────────────────────────────

export function useAskDocs() {
  const [items, setItems] = useState(readLog) // newest first
  const [selected, setSelected] = useState(() => readLog()[0]?.id ?? null)
  const [status, setStatus] = useState(null)

  // The index builds in the background after a restart; poll until it is ready.
  useEffect(() => {
    let live = true
    let timer
    const tick = async () => {
      const s = await fetch('/api/dev/docs/status').then((r) => r.json()).catch(() => null)
      if (!live) return
      setStatus(s)
      if (!s || s.state !== 'ready') timer = setTimeout(tick, s ? 3000 : 15000)
    }
    tick()
    return () => { live = false; clearTimeout(timer) }
  }, [])

  const ask = useCallback(async (question) => {
    const q = String(question || '').trim()
    if (!q) return
    const id = `${Date.now()}`
    setItems((prev) => [{ id, question: q, pending: true, at: new Date().toISOString() }, ...prev])
    setSelected(id)
    let res
    try {
      const r = await fetch('/api/dev/docs/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) })
      res = await r.json().catch(() => ({}))
      if (!r.ok && !res.sources) res = { ...res, verdict: 'error', error: res.error || `HTTP ${r.status}`, sources: [] }
    } catch (e) { res = { verdict: 'error', error: e.message, sources: [] } }
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, ...res, question: q, pending: false } : i))
      writeLog(next)
      return next
    })
    if (res.status) setStatus(res.status)
  }, [])

  const remove = useCallback((id) => setItems((prev) => { const next = prev.filter((i) => i.id !== id); writeLog(next); return next }), [])
  const clear = useCallback(() => { setItems([]); writeLog([]); setSelected(null) }, [])
  const current = items.find((i) => i.id === selected) ?? items[0] ?? null
  return { items, current, setSelected, ask, remove, clear, status, pending: items.some((i) => i.pending) }
}

const indexLine = (s) => {
  if (!s) return 'Checking the docs index…'
  if (s.state === 'building') return s.progress ? `Indexing the docs — ${s.progress.done} of ${s.progress.total} pages` : 'Indexing the docs…'
  if (s.state !== 'ready') return `Docs index unavailable${s.error ? ` — ${s.error}` : ''}`
  const when = s.builtAt ? new Date(s.builtAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : ''
  return `${s.pages} pages · ${s.passages.toLocaleString()} passages · read ${when}`
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
          <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>Ask the AI Gateway docs</span>
          <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
            {status?.state === 'ready' ? `${status.pages} pages · every answer cites its page` : indexLine(status)}
          </span>
        </span>
      </button>
      {q && (
        <button type="button" onClick={() => onAskQuery(q)}
                className={`w-full flex items-center gap-2 rounded-xl px-2.5 text-left ${focusCls}`}
                style={{ minHeight: 32, background: `${ASK_TONE}0d`, border: `1px dashed ${ASK_TONE}66`, fontFamily: FONT.prose, fontSize: 12, color: t.ink }}>
          <ArrowUp size={13} style={{ color: inkOn(t, ASK_TONE, 0.25), flexShrink: 0 }} aria-hidden="true" />
          <span className="min-w-0 truncate">Ask the docs: <b style={{ fontWeight: 650 }}>“{q}”</b></span>
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
          <div style={{ ...LBL, fontSize: 10, color: 'rgba(255,255,255,0.86)' }}>Prisma AIRS AI Gateway · official docs</div>
          <h1 style={{ fontFamily: FONT.display, fontSize: 25, fontWeight: 700, color: '#fff', lineHeight: 1.18, margin: '4px 0 0' }}>Ask the AI Gateway docs</h1>
          <p style={{ fontFamily: FONT.prose, fontSize: 13.5, color: 'rgba(255,255,255,0.92)', margin: '5px 0 0' }}>
            Answers come only from the official docs, and every claim cites the page it came from. Each question is asked through your SCM AI Gateway with the Prisma AIRS guardrail on.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5" style={{ height: 26, ...bandGlass, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600 }}>
              {status?.state === 'building' ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <BookOpen size={12} aria-hidden="true" />} {indexLine(status)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5" style={{ height: 26, ...bandGlass, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600 }}>
              <ShieldCheck size={12} aria-hidden="true" /> AIRS-protected config
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
                placeholder="Ask anything about the AI Gateway — configs, guardrails, MCP, keys, headers, self-hosting…"
                aria-label="Your question about the AI Gateway docs"
                className="flex-1 min-w-0 resize-none outline-none px-2.5 py-1.5" style={{ fontFamily: FONT.prose, fontSize: 14, lineHeight: 1.5, color: t.ink, border: 'none' }} />
      <button type="button" onClick={submit} disabled={disabled || !text.trim()} aria-label="Ask"
              className={`inline-flex items-center gap-1.5 rounded-full px-4 flex-shrink-0 disabled:opacity-45 ${focusCls}`}
              style={{ height: 38, fontFamily: FONT.prose, fontSize: 13, fontWeight: 700, color: '#fff', background: shade(ASK_TONE), boxShadow: `0 4px 12px ${ASK_TONE}40` }}>
        {pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ArrowUp size={14} aria-hidden="true" />} Ask
      </button>
    </div>
  )
}

function CiteChip({ t, n, source }) {
  if (!source) return <span style={{ color: t.inkFaint }}>[{n}]</span>
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer" title={`${source.title}${source.heading && source.heading !== source.title ? ` › ${source.heading}` : ''}`}
       className="inline-grid place-items-center rounded-md"
       style={{ minWidth: 18, height: 18, padding: '0 4px', margin: '0 1px', verticalAlign: 'text-top', fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 700, lineHeight: 1, color: inkOn(t, ASK_TONE, 0.3), background: `${ASK_TONE}1a`, textDecoration: 'none' }}>
      {n}
    </a>
  )
}

function ConflictChip({ t }) {
  return (
    <span title="A known contradiction between two official doc pages — both sides are stated"
          className="inline-flex items-center gap-0.5 rounded-md"
          style={{ height: 18, padding: '0 5px', margin: '0 1px', verticalAlign: 'text-top', fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 700, lineHeight: '18px', color: inkOn(t, t.live, 0.25), background: `${t.live}17` }}>
      <BookOpen size={10} aria-hidden="true" /> docs conflict
    </span>
  )
}

function ObservedChip({ t }) {
  return (
    <span title="Observed on this portal's SCM tenant — not in the official docs"
          className="inline-flex items-center gap-0.5 rounded-md"
          style={{ height: 18, padding: '0 5px', margin: '0 1px', verticalAlign: 'text-top', fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 700, lineHeight: '18px', color: inkOn(t, t.warn, 0.42), background: `${t.warn}1f` }}>
      <Eye size={10} aria-hidden="true" /> observed
    </span>
  )
}

function Verdict({ t, item }) {
  if (item.verdict === 'blocked') {
    return (
      <div className="relative overflow-hidden rounded-2xl" style={{ background: bandBg(t.block) }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
        <div className="relative flex items-start gap-3 px-3.5 py-3">
          <ShieldX size={18} style={{ color: '#fff', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <div className="min-w-0">
            <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: '#fff' }}>AIRS stopped this request at the {item.blockedAt ?? 'guardrail'} scan</div>
            <div style={{ fontFamily: FONT.prose, fontSize: 12.5, color: 'rgba(255,255,255,0.92)', marginTop: 2 }}>
              The question, or a passage retrieved for it, tripped the gateway's Prisma AIRS guardrail — so no model answered. The pages that match are listed beside this; open them directly.
            </div>
          </div>
        </div>
      </div>
    )
  }
  const notice = {
    unavailable: 'No model is configured for answers on this host — the matching pages are listed beside this.',
    'no-sources': 'Nothing in the docs matches this question. Try other words — names of features, headers or settings work best.',
    error: `The answer did not come back: ${item.error ?? 'unknown error'}. The matching pages are listed beside this.`,
  }[item.verdict]
  if (notice) {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ background: `${t.warn}12`, border: `1px solid ${t.warn}55` }}>
        <AlertTriangle size={15} style={{ color: inkOn(t, t.warn, 0.42), flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <span style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.ink }}>{item.verdict === 'unavailable' && item.error ? item.error : notice}</span>
      </div>
    )
  }
  const guarded = item.verdict === 'allowed'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
      <span className="inline-flex items-center gap-1" style={{ fontWeight: 600, color: guarded ? inkOn(t, t.pass, 0.3) : inkOn(t, t.warn, 0.42) }}>
        {guarded ? <ShieldCheck size={13} aria-hidden="true" /> : <AlertTriangle size={13} aria-hidden="true" />}
        {guarded ? 'AIRS guardrail passed' : 'Answered — no guardrail ran on this request'}
      </span>
      {item.model && <span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>{item.model}</span>}
      {item.usage?.prompt_tokens != null && <span>{item.usage.prompt_tokens.toLocaleString()} tokens in · {item.usage.completion_tokens?.toLocaleString()} out</span>}
      {item.elapsedMs != null && <span>{(item.elapsedMs / 1000).toFixed(1)} s</span>}
    </div>
  )
}

function Pending({ t, status }) {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  useEffect(() => { const id = setTimeout(() => setStep(1), 700); return () => clearTimeout(id) }, [])
  const rows = [
    { icon: Search, text: `Ranking passages across ${status?.pages ?? 'the'} pages` },
    { icon: ShieldCheck, text: 'Asking the model through the SCM AI Gateway — AIRS scans the request and the answer' },
  ]
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <motion.div key={i} initial={reduce ? false : { opacity: 0, x: -4 }} animate={{ opacity: i <= step ? 1 : 0.35, x: 0 }} transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-2" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>
          {i === step ? <Loader2 size={13} className="animate-spin" style={{ color: ASK_TONE }} aria-hidden="true" /> : <r.icon size={13} aria-hidden="true" />}
          {r.text}
        </motion.div>
      ))}
    </div>
  )
}

const plainAnswer = (item) => {
  const refs = (item.sources ?? []).map((s) => `[${s.n}] ${s.title}${s.heading && s.heading !== s.title ? ` › ${s.heading}` : ''} — ${s.url}`).join('\n')
  return `Q: ${item.question}\n\n${item.answer ?? ''}${refs ? `\n\nSources:\n${refs}` : ''}`
}

function AskItem({ t, item, selected, onSelect, onRemove, status }) {
  const cite = useCallback((n) => (n === 'P' ? <ObservedChip t={t} /> : n === 'C' ? <ConflictChip t={t} /> : <CiteChip t={t} n={n} source={item.sources?.[Number(n) - 1]} />), [t, item.sources])
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
            <button type="button" onClick={onRemove} aria-label="Remove this question" className={`grid place-items-center rounded-full ${focusCls}`} style={{ width: 28, height: 28, color: t.inkFaint }}>
              <Trash2 size={13} />
            </button>
          </span>
        )}
      </div>
      <div className="px-4 pb-4 pt-2.5 space-y-3" style={{ paddingLeft: 58 }}>
        {item.pending ? <Pending t={t} status={status} /> : (
          <>
            {item.answer && <div style={{ fontFamily: FONT.prose, fontSize: 14, lineHeight: 1.65, color: t.ink }}><Markdown text={item.answer} t={t} cite={cite} /></div>}
            <Verdict t={t} item={item} />
          </>
        )}
      </div>
    </article>
  )
}

export function AskView({ t, ask, onGo }) {
  const { items, current, setSelected, remove, clear, status, pending } = ask
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
          <AskItem key={item.id} t={t} item={item} status={status} selected={current?.id === item.id}
                   onSelect={() => setSelected(item.id)} onRemove={() => remove(item.id)} />
        ))}
        {items.length > 1 && !pending && (
          <div className="flex justify-center">
            <button type="button" onClick={clear} className={`inline-flex items-center gap-1.5 rounded-full px-3 ${focusCls}`}
                    style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
              <Trash2 size={12} aria-hidden="true" /> Clear the research log ({items.length})
            </button>
          </div>
        )}
        <p className="px-1 pb-4" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.55, color: t.inkFaint }}>
          Passages are ranked by keyword match (BM25) over the docs mirrored from portkey.ai/docs, refreshed daily. The model sees the eight best passages, this portal's own observations of its SCM tenant (cited as “observed”) and the known contradictions between doc pages (cited as “docs conflict”). Check anything that matters on the page itself — the chips open it.
          {onGo && <> Browse every page in <button type="button" onClick={() => onGo('docs-aigw')} className={`underline underline-offset-2 ${focusCls}`} style={{ color: inkOn(t, t.live, 0.2) }}>the AI Gateway doc catalog</button>.</>}
        </p>
      </div>
    </div>
  )
}

// ─── the right pane: where the answer came from ──────────────────────────────

export function AskSources({ t, ask }) {
  const { current, status } = ask
  const [showReq, setShowReq] = useState(false)
  const sources = current?.sources ?? []
  return (
    <div className="h-full flex flex-col overflow-hidden" style={glass(t, { radius: 22 })}>
      <div className="relative flex-shrink-0 overflow-hidden" style={{ background: deepBand(ASK_TONE) }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
        <div className="relative px-4 py-3.5">
          <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Sources</div>
          <div style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 2 }}>
            {current ? (current.pending ? 'Finding the pages…' : `${sources.length} passage${sources.length === 1 ? '' : 's'} the answer drew on`) : 'Where answers come from'}
          </div>
          <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>{current?.question ?? indexLine(status)}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {!current && (
          <div className="space-y-2">
            {[
              { icon: Library, title: 'The official docs, whole', sub: `${status?.pages ?? '~600'} pages from portkey.ai/docs — product, integrations, self-hosting, the inference and admin API references, changelog.` },
              { icon: Search, title: 'Ranked passages, not guesses', sub: 'Your question picks the eight best-matching passages; the model may use nothing else.' },
              { icon: ShieldCheck, title: 'Through the AI Gateway', sub: 'Each question goes through the SCM AI Gateway with the Prisma AIRS guardrail on — the assistant is protected by the product it documents.' },
              { icon: Eye, title: 'This tenant, too', sub: 'What this portal has observed on its own SCM tenant rides along, cited as “observed” whenever an answer leans on it.' },
            ].map((r) => (
              <div key={r.title} className="flex items-start gap-3 rounded-2xl px-3 py-2.5" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
                <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${ASK_TONE}17`, color: inkOn(t, ASK_TONE, 0.25) }}><r.icon size={14} aria-hidden="true" /></span>
                <span className="min-w-0">
                  <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{r.title}</span>
                  <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>{r.sub}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {current?.pending && <p className="px-2 py-4" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>Ranking passages…</p>}

        {sources.map((s) => (
          <a key={s.n} href={s.url} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 ${focusCls}`}
             style={{ background: t.panel, border: `1px solid ${t.hairline}`, textDecoration: 'none' }}
             onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${ASK_TONE}66` }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.hairline }}>
            <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 24, height: 24, fontFamily: FONT.display, fontSize: 12, fontWeight: 700, color: inkOn(t, ASK_TONE, 0.3), background: `${ASK_TONE}1a` }}>{s.n}</span>
            <span className="min-w-0 flex-1">
              <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 650, lineHeight: 1.35, color: t.ink }}>
                {s.title}{s.heading && s.heading !== s.title ? <span style={{ fontWeight: 500, color: t.inkDim }}> › {s.heading}</span> : null}
              </span>
              <span className="flex items-center gap-1.5 mt-0.5 min-w-0">
                <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkFaint }}>{s.section}</span>
                {s.deprecated && <span className="rounded-full px-1.5 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 700, lineHeight: '16px', color: inkOn(t, t.warn, 0.42), background: `${t.warn}1f` }}>deprecated</span>}
              </span>
            </span>
            <ExternalLink size={12} style={{ color: t.inkFaint, flexShrink: 0, marginTop: 3 }} aria-hidden="true" />
          </a>
        ))}

        {current && !current.pending && current.request && (
          <div className="rounded-2xl overflow-hidden" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
            <button type="button" onClick={() => setShowReq((v) => !v)} aria-expanded={showReq} className={`w-full flex items-center gap-2 px-3 py-2.5 text-left ${focusCls}`}>
              <ShieldCheck size={14} style={{ color: t.inkDim }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>The request, as sent through the gateway</span>
                <span className="block truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>{current.request.method} {current.request.url}</span>
              </span>
              <ChevronDown size={14} style={{ color: t.inkDim, transform: showReq ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} aria-hidden="true" />
            </button>
            {showReq && (
              <div className="px-3 pb-3 space-y-2">
                <CodeTabs tabs={[{ id: 'json', lang: 'json', code: JSON.stringify({ headers: current.request.headers, body: current.request.body }, null, 2) }]} compact maxHeight={340} />
                <p style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint }}>The gateway key is masked; the excerpt text is the sources above.{current.traceId ? ` Trace id ${current.traceId}.` : ''}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
