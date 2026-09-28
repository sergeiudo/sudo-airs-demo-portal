import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Route, ShieldX, AlertTriangle, Loader2, MessageCircle, Shuffle, ArrowUpRight, FlaskConical, Send, Timer,
} from 'lucide-react'
import { FONT, glass } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots } from '../home-2027/band'
import { Markdown } from '../api-intercept-2027/Markdown'
import { RouteDiagram } from './RouteDiagram'
import { callVerdict, clock, gatewayHint, labelOf } from './accessModel'

/**
 * RequestStream — the centre column. Before the first prompt: the user's own
 * route (the sign-in page's diagram, fed with their real claims); the sign-in
 * step by step sits in the evidence pane beside it. After it:
 * one card per request — asked for, answered by, and a band when the policy
 * replaced the choice or the gateway refused a doctored credential.
 * Latency stays off this surface; the lifecycle drawer has it.
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
const hasHebrew = (s) => /[֐-׿]/.test(String(s ?? ''))
const prose = (s) => (hasHebrew(s) ? '"Heebo", Inter, sans-serif' : FONT.prose)

const PROMPTS = [
  'In one sentence: which model are you, and who made you?',
  'Explain in two lines why RS256 beats a shared secret for this setup.',
  'What can a JWT payload reveal, and what can it not prove?',
  'Summarise the OAuth 2.0 authorization code flow with PKCE in three bullets.',
  'Write a haiku about zero trust.',
  'Why should an employee never hold a raw model API key?',
  'Give me three questions an auditor would ask about AI access control.',
  'What is the difference between an ID token and an access token?',
]
const draw = () => [...PROMPTS].sort(() => Math.random() - 0.5).slice(0, 3)

// ─── empty state ─────────────────────────────────────────────────────────────

function EmptyState({ t, tone, a, live }) {
  const first = String(a.session.user?.name ?? '').split(' ')[0]
  return (
    <div className="space-y-3 pb-2">
      <div className="px-1 pt-1">
        <h2 style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: t.ink, margin: 0 }}>
          {first ? `${first}, you are signed in — without an API key.` : 'Signed in — without an API key.'}
        </h2>
        <p style={{ fontFamily: FONT.prose, fontSize: 13, lineHeight: 1.55, color: t.inkDim, margin: '4px 0 0' }}>
          Pick a model your role is not allowed to use, send a prompt, and watch a different one answer.
        </p>
      </div>
      <RouteDiagram t={t} tone={tone} config={a.config} mode="live" live={live} />
    </div>
  )
}

// ─── one request ─────────────────────────────────────────────────────────────

function Notice({ t, tone, icon: Icon, title, sub, flashKey }) {
  const reduce = useReducedMotion()
  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ background: bandBg(tone) }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
      {!reduce && (
        <motion.div key={flashKey} aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.22)' }}
                    initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8 }} />
      )}
      <Icon aria-hidden="true" strokeWidth={1.3}
            style={{ position: 'absolute', right: -14, bottom: -30, width: 104, height: 104, color: '#fff', opacity: 0.14, transform: 'rotate(-10deg)' }} />
      <div className="relative flex items-center gap-3 px-3.5 py-3">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
          <Icon size={17} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{title}</div>
          <div className="break-words" style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 2 }}>{sub}</div>
        </div>
      </div>
    </div>
  )
}

function Fault({ t, call }) {
  const hint = gatewayHint(call)
  const ink = t.isLight ? shade(t.warn, 0.4) : t.warn
  return (
    <div className="rounded-2xl p-3" style={{ background: `${t.warn}10`, border: `1px solid ${t.warn}55` }}>
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: bandBg(t.warn) }}>
          <AlertTriangle size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>
            {call.status ? `The gateway answered HTTP ${call.status}` : 'The call did not complete'}
          </div>
          <div className="break-words" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11, color: ink, marginTop: 1 }}>{call.error}</div>
        </div>
      </div>
      {hint && <p style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.55, color: t.inkDim, margin: '8px 0 0' }}>{hint}</p>}
    </div>
  )
}

function Turn({ t, who, children }) {
  return (
    <div>
      <div style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, color: t.inkDim, marginBottom: 3 }}>{who}</div>
      {children}
    </div>
  )
}

function RequestCard({ t, tone, call, selected, onSelect, onOpen, models }) {
  const reduce = useReducedMotion()
  const v = callVerdict(call)
  const tamper = call.kind === 'tamper'
  const reqLabel = call.requested?.label ?? labelOf(models, call.requested?.id)
  const servedLabel = call.served?.label
  const accentInk = t.isLight ? shade(tone, 0.25) : tone
  const blockInk = t.isLight ? shade(t.block, 0.2) : t.block
  return (
    <motion.article initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                    onClick={onSelect}
                    className="rounded-3xl overflow-hidden cursor-pointer"
                    style={{
                      background: t.panel,
                      border: `1px solid ${selected ? `${tone}66` : t.glassEdge}`,
                      boxShadow: selected ? `0 0 0 3px ${tone}1a, ${t.shadow}` : t.shadowSm,
                      transition: 'border-color 160ms ease, box-shadow 200ms ease',
                    }}>
      <header className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: `1px solid ${t.hairline}`, background: t.sunken }}>
        <span className="rounded-md px-1.5 flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 700, color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
          {String(call.n ?? '·').padStart(2, '0')}
        </span>
        {tamper && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 flex-shrink-0" style={{ height: 20, fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: blockInk, background: `${t.block}14` }}>
            <FlaskConical size={11} aria-hidden="true" /> tamper test
          </span>
        )}
        <span className="flex-1 min-w-0 truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>
          {tamper
            ? <b style={{ color: t.ink }}>{call.tamper?.label}</b>
            : call.overridden
            ? <><span style={{ textDecoration: 'line-through', color: t.inkFaint }}>{reqLabel}</span> → <b style={{ color: accentInk }}>{servedLabel}</b></>
            : <b style={{ color: t.ink }}>{servedLabel ?? reqLabel}</b>}
        </span>
        <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkFaint }}>{clock(call.at)}</span>
      </header>

      <div className="px-4 py-3.5 space-y-3">
        {v === 'rerouted' && (
          <Notice t={t} tone={t.block} icon={Route} flashKey={call.id} title="Policy replaced your choice"
                  sub={<>{reqLabel} → {servedLabel}{call.predicted?.rule ? ` · rule ${call.predicted.rule}: ${call.predicted.field} = ${call.predicted.value}` : ''}</>} />
        )}
        {v === 'refused' && (
          <Notice t={t} tone={t.block} icon={ShieldX} flashKey={call.id} title="The gateway refused the doctored credential"
                  sub={`HTTP ${call.status} · ${call.error}`} />
        )}
        {v === 'accepted' && (
          <Notice t={t} tone={t.warn} icon={AlertTriangle} flashKey={call.id} title="The gateway accepted a doctored credential"
                  sub={`${servedLabel ?? 'A model'} answered — this token should have been refused`} />
        )}
        {v === 'fault' && <Fault t={t} call={call} />}

        {tamper ? (
          <Turn t={t} who="What was changed">
            <ul className="space-y-1">
              {(call.tamper?.changes ?? []).map((c) => (
                <li key={c.path} className="flex items-baseline gap-2 flex-wrap" style={{ fontFamily: FONT.mono, fontSize: 11.5 }}>
                  <span style={{ color: t.ink }}>{c.path}</span>
                  <span style={{ color: t.inkFaint, textDecoration: 'line-through' }}>{String(c.from)}</span>
                  <span style={{ color: t.inkFaint }}>→</span>
                  <span style={{ color: blockInk, fontWeight: 600 }}>{String(c.to)}</span>
                </li>
              ))}
              {!call.tamper?.changes && <li style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>{call.tamper?.what}</li>}
            </ul>
          </Turn>
        ) : (
          <Turn t={t} who="You">
            <div dir="auto" className="whitespace-pre-wrap break-words" style={{ fontFamily: prose(call.prompt), fontSize: 13.5, lineHeight: 1.6, color: t.inkDim }}>{call.prompt}</div>
          </Turn>
        )}
        {call.reply != null && (
          <Turn t={t} who={servedLabel ?? 'Answer'}>
            <div dir="auto" style={{ fontFamily: prose(call.reply), fontSize: 13.5, lineHeight: 1.65, color: t.ink }}>
              <Markdown text={call.reply} t={t} />
            </div>
          </Turn>
        )}
        {selected && !call.pending && (
          <div className="flex justify-end">
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpen() }}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 ${focusCls}`}
                    style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.live, background: `${t.live}12`, border: `1px solid ${t.live}40` }}>
              Token lifecycle for this request <ArrowUpRight size={12} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </motion.article>
  )
}

function PendingCard({ t, tone, pending }) {
  const reduce = useReducedMotion()
  const tamper = pending.kind === 'tamper'
  return (
    <div className="rounded-3xl px-4 py-3.5" style={{ background: t.panel, border: `1px solid ${t.live}40`, boxShadow: `0 8px 20px ${t.live}14` }}>
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: `${t.live}14`, color: t.live }}>
          <Loader2 size={15} className={reduce ? '' : 'animate-spin'} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>On the line — through the AI Gateway</div>
          <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>
            {tamper ? `${pending.tamper?.label} · asking for Claude Opus 4.8` : `Asking for ${pending.requested?.label} · the gateway verifies the token, then routes`}
          </div>
        </div>
      </div>
      {!tamper && <div dir="auto" className="mt-2.5 whitespace-pre-wrap break-words" style={{ fontFamily: prose(pending.prompt), fontSize: 13.5, lineHeight: 1.6, color: t.inkDim }}>{pending.prompt}</div>}
    </div>
  )
}

// ─── composer ────────────────────────────────────────────────────────────────

function Composer({ t, tone, busy, expired, onSend, helper }) {
  const [text, setText] = useState('')
  const [focus, setFocus] = useState(false)
  const [chips, setChips] = useState(draw)
  const taRef = useRef(null)
  const can = text.trim() && !busy && !expired
  const grow = (el) => { if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 150)}px` }
  const submit = (e) => {
    e?.preventDefault()
    if (!can) return
    onSend(text.trim())
    setText('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }
  return (
    <div className="flex-shrink-0 mx-3 mb-3 mt-2">
      <AnimatePresence initial={false}>
        {!text && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="flex items-center gap-2 pb-2.5 px-1">
              {chips.map((q) => (
                <button key={q} type="button" onClick={() => { setText(q); requestAnimationFrame(() => { taRef.current?.focus(); grow(taRef.current) }) }}
                        title={q}
                        className={`flex items-center gap-2 rounded-full min-w-0 ${focusCls}`}
                        style={{ padding: '4px 12px 4px 4px', flex: '1 1 0', maxWidth: 320, background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${tone}55` }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.hairline }}>
                  <span className="grid place-items-center rounded-full flex-shrink-0" style={{ width: 22, height: 22, background: `${tone}16`, color: t.isLight ? shade(tone, 0.25) : tone }}>
                    <MessageCircle size={11} aria-hidden="true" />
                  </span>
                  <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink }}>{q}</span>
                </button>
              ))}
              <button type="button" onClick={() => setChips(draw())} aria-label="Draw three more prompts" title="Draw three more prompts"
                      className="grid place-items-center rounded-full flex-shrink-0" style={{ width: 30, height: 30, color: t.inkDim, border: `1px dashed ${t.railBed}` }}>
                <Shuffle size={13} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <form onSubmit={submit} style={{
        ...glass(t, { radius: 24 }),
        border: `1px solid ${focus ? `${tone}66` : t.glassEdge}`,
        boxShadow: focus ? `0 0 0 4px ${tone}1a, ${t.shadow}` : t.shadow, transition: 'border-color 160ms ease, box-shadow 200ms ease',
      }}>
        <div className="flex items-end gap-2 p-1.5 pl-3">
          <textarea ref={(el) => { taRef.current = el; el?.style.setProperty('background-color', 'transparent', 'important') }}
                    value={text} rows={1} dir="auto" disabled={busy || expired}
                    onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
                    onChange={(e) => { setText(e.target.value); grow(e.target) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e) }}
                    placeholder={expired ? 'Your credential has expired — sign out and in again' : 'Ask something…'}
                    aria-label="Message" className="flex-1 min-w-0 resize-none outline-none self-center"
                    style={{ padding: '8px 2px', border: 'none', maxHeight: 150, lineHeight: 1.5, fontFamily: prose(text), fontSize: 14.5, color: t.ink }} />
          <motion.button type="submit" disabled={!can} whileTap={can ? { scale: 0.96 } : {}}
                         title={busy ? 'Waiting for the gateway' : 'Send (Enter) — Shift+Enter for a new line'}
                         className={`inline-flex items-center gap-2 rounded-full px-5 flex-shrink-0 ${focusCls}`}
                         style={{
                           height: 38, fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700,
                           color: can ? '#fff' : t.inkDim, background: can ? bandBg(tone) : t.sunken,
                           border: `1px solid ${can ? 'transparent' : t.hairline}`, boxShadow: can ? `0 8px 20px ${tone}44` : 'none',
                           cursor: can ? 'pointer' : 'default',
                         }}>
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />} Send
          </motion.button>
        </div>
        <div className="flex items-center gap-1.5 px-4 pb-2" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: expired ? (t.isLight ? shade(t.warn, 0.4) : t.warn) : t.inkDim }}>
          {expired ? <Timer size={12} aria-hidden="true" /> : <Route size={12} aria-hidden="true" />}
          <span className="truncate">{helper}</span>
        </div>
      </form>
    </div>
  )
}

export function RequestStream({ t, tone, a, live, expired, helper, onSend, onOpenLifecycle }) {
  const scroll = useRef(null)
  const calls = a.calls
  const models = a.config?.models ?? []

  useEffect(() => {
    const el = scroll.current
    if (el && (calls.length || a.pending)) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [calls.length, a.pending])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scroll} className="flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-1 space-y-3">
        {!calls.length && !a.pending
          ? <EmptyState t={t} tone={tone} a={a} live={live} />
          : calls.map((c) => (
              <RequestCard key={c.id} t={t} tone={tone} call={c} models={models}
                           selected={a.selected?.id === c.id}
                           onSelect={() => a.select(c.id)}
                           onOpen={() => onOpenLifecycle('gateway', c.id)} />
            ))}
        {a.pending && <PendingCard t={t} tone={tone} pending={a.pending} />}
      </div>
      <Composer t={t} tone={tone} busy={!!a.pending} expired={expired} onSend={onSend} helper={helper} />
    </div>
  )
}

