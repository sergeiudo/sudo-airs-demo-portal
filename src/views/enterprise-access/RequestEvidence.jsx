import React, { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ShieldCheck, ShieldX, Route, AlertTriangle, Loader2, Radar, Cpu, KeyRound, Waypoints, Coins, ShieldQuestion,
  ArrowUpRight, Scale, Copy, Check, CheckCircle2, XCircle,
} from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots } from '../home-2027/band'
import { Block, EvidenceLook, ctaWash } from '../api-intercept-2027/EvidencePane'
import { PolicyRules } from './PolicyPanel'
import { Journey } from './Journey'
import { callVerdict, VERDICT, toneOf, clockS, short, minsLeft } from './accessModel'

/**
 * RequestEvidence — proof for the selected request; before the first one,
 * what will land here and the sign-in step by step. The verdict as a band
 * (sent as requested, rerouted by the policy, refused, fault), the way into
 * the lifecycle drawer right under it, then list-row sections: what was asked
 * for and what answered, which rule decided and whether the portal's copy of
 * the policy agreed with the gateway, the credential that was presented, and
 * the gateway's own evidence. Everything deeper lives in the drawer.
 */

const ICON = { passed: ShieldCheck, rerouted: Route, refused: ShieldX, accepted: AlertTriangle, fault: AlertTriangle, pending: Loader2 }

function KV({ t, k, v, mono = true, copy }) {
  const [done, setDone] = useState(false)
  if (v == null || v === '') return null
  return (
    <div className="flex items-baseline gap-3 py-1.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
      <span className="flex-shrink-0" style={{ width: 96, fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>{k}</span>
      <span className="flex-1 min-w-0 truncate" dir={mono ? 'ltr' : undefined} title={String(v)}
            style={{ fontFamily: mono ? FONT.mono : FONT.prose, fontSize: mono ? 11 : 12.5, color: t.ink }}>{String(v)}</span>
      {copy && (
        <button type="button" title="Copy" aria-label={`Copy ${k}`} className="flex-shrink-0"
                onClick={() => { navigator.clipboard?.writeText(String(v)); setDone(true); setTimeout(() => setDone(false), 1100) }}
                style={{ color: done ? t.pass : t.inkFaint }}>
          {done ? <Check size={11} /> : <Copy size={11} />}
        </button>
      )}
    </div>
  )
}

function Band({ t, call, v }) {
  const reduce = useReducedMotion()
  const color = toneOf(t, v)
  const Icon = ICON[v] ?? ShieldQuestion
  const meta = VERDICT[v]
  const p = call.predicted
  const why = v === 'passed'
    ? (p?.why === 'exempt' ? `exempt · ${call.served?.label} forwarded untouched` : `${call.served?.label}${p?.rule ? ` · rule ${p.rule}: ${p.field} = ${p.value}` : ''}`)
    : v === 'rerouted' ? `rule ${p?.rule ?? '—'} · ${p?.field} = ${p?.value} → ${p?.target}`
    : v === 'refused' ? `HTTP ${call.status} · ${call.error}`
    : v === 'accepted' ? `HTTP ${call.status} · ${call.served?.label ?? 'a model'} answered`
    : v === 'pending' ? `${call.requested?.label ?? ''}`
    : `HTTP ${call.status || '—'} · ${call.error}`
  return (
    <div className="relative flex-shrink-0 overflow-hidden" style={{ minHeight: 100, background: bandBg(color) }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
      {(v === 'rerouted' || v === 'refused') && !reduce && (
        <motion.div key={call.id} aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.22)' }}
                    initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8 }} />
      )}
      <Icon aria-hidden="true" strokeWidth={1.3}
            style={{ position: 'absolute', right: -24, bottom: -40, width: 150, height: 150, color: '#fff', opacity: 0.15, transform: 'rotate(-10deg)' }} />
      <div className="relative flex items-center gap-3 px-4 py-4">
        <motion.span key={call.id} className="grid place-items-center rounded-2xl flex-shrink-0"
                     initial={reduce ? false : { scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                     style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
          <Icon size={21} className={v === 'pending' ? 'animate-spin' : ''} style={{ color: '#fff' }} aria-hidden="true" />
        </motion.span>
        <div className="min-w-0">
          <div className="truncate" style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Verdict · {meta.where}</div>
          <div style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.12, marginTop: 3 }}>{meta.title}</div>
          <div className="truncate" title={why} style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 2 }}>{why}</div>
        </div>
      </div>
    </div>
  )
}

function LifecycleCta({ t, onOpen }) {
  const [hot, setHot] = useState(false)
  const tone = t.live
  return (
    <button type="button" onClick={onOpen} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className="w-full flex items-center gap-3 rounded-2xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            style={{
              padding: '10px 10px 10px 11px', background: ctaWash(t, tone, hot),
              border: `1px solid ${hot ? `${tone}88` : `${tone}55`}`, boxShadow: hot ? `0 10px 24px ${tone}2e` : `0 6px 16px ${tone}17`,
              transition: 'border-color 160ms ease, box-shadow 200ms ease, background 180ms ease',
            }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: bandBg(tone), boxShadow: `0 5px 12px ${tone}55` }}>
        <KeyRound size={16} style={{ color: '#fff' }} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>Open the token lifecycle</span>
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1 }}>Headers · body · the credential · timing</span>
      </span>
      <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
            style={{ width: 28, height: 28, color: hot ? '#fff' : tone, background: hot ? shade(tone) : t.panel, transition: 'background 140ms ease, color 140ms ease' }}>
        <ArrowUpRight size={14} />
      </span>
    </button>
  )
}

function Empty({ t, tone, expired, session, onOpenLifecycle }) {
  const c = expired ? t.warn : t.pass
  const rows = [
    { icon: ShieldCheck, title: 'Verdict', text: 'Sent as requested, or rerouted by the policy — and by which rule.' },
    { icon: Cpu, title: 'Asked for, answered by', text: 'The model you picked, and the one the gateway actually served.' },
    { icon: Scale, title: 'Prediction check', text: "Whether the portal's copy of the policy agreed with the gateway." },
    { icon: KeyRound, title: 'The credential presented', text: 'Key id, expiry and the claims the gateway matched on.' },
    { icon: Waypoints, title: 'Gateway evidence', text: 'Trace id, response headers and token usage, in its own words.' },
  ]
  return (
    <div className="flex flex-col h-full overflow-hidden" style={glass(t, { radius: 22 })}>
      <div className="relative flex-shrink-0 overflow-hidden" style={{ height: 96, background: bandBg(c) }}>
        <div aria-hidden="true" className="absolute inset-0" style={bandDots} />
        <Radar aria-hidden="true" strokeWidth={1.3} style={{ position: 'absolute', right: -24, bottom: -40, width: 150, height: 150, color: '#fff', opacity: 0.15, transform: 'rotate(-10deg)' }} />
        <div className="relative h-full flex items-center gap-3 px-4">
          <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
            <Radar size={20} style={{ color: '#fff' }} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Evidence</div>
            <div style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 2 }}>{expired ? 'Credential expired' : 'Standing by'}</div>
            <div style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>{expired ? 'Sign in again to send' : 'Credential verified · ready for a prompt'}</div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, marginBottom: 10 }}>What lands here after each prompt</div>
        <ul className="space-y-3">
          {rows.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: `${t.live}14`, color: t.live }}>
                <Icon size={15} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{title}</span>
                <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.inkDim }}>
          Send a prompt, or run one of the tamper tests in the rail, then click any request to inspect it.
        </p>
        {session?.lifecycle && (
          <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${t.hairline}` }}>
            <Journey t={t} tone={tone} session={session} onOpen={onOpenLifecycle} />
          </div>
        )}
      </div>
    </div>
  )
}

function ModelRows({ t, tone, call }) {
  const accentInk = t.isLight ? shade(tone, 0.25) : tone
  const Row = ({ k, label, id, struck, strong }) => (
    <div className="py-2" style={{ borderTop: `1px solid ${t.hairline}` }}>
      <div style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{k}</div>
      <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: strong ? accentInk : struck ? t.inkFaint : t.ink, textDecoration: struck ? 'line-through' : 'none' }}>{label}</div>
      <div className="truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }}>{id}</div>
    </div>
  )
  return (
    <>
      {Row({ k: 'Asked for', label: call.requested?.label, id: call.requested?.id, struck: call.overridden })}
      {call.served
        ? Row({ k: call.overridden ? 'Answered by — the policy replaced it' : 'Answered by', label: call.served.label, id: call.served.id, strong: call.overridden })
        : <div className="py-2" style={{ borderTop: `1px solid ${t.hairline}`, fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>No model answered — the request never got past the gateway.</div>}
    </>
  )
}

function Agreement({ t, call }) {
  if (call.kind === 'tamper') {
    return <p style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.inkDim, margin: '8px 0 0' }}>
      {call.refused ? 'Not reached — the credential failed verification, so no rule was ever evaluated.' : 'The gateway handled this token as if it were genuine.'}
    </p>
  }
  if (call.agreed == null) return null
  const tone = call.agreed ? t.pass : t.warn
  const Icon = call.agreed ? CheckCircle2 : XCircle
  return (
    <div className="flex items-start gap-2 rounded-xl mt-2.5 px-2.5 py-2" style={{ background: `${tone}12`, border: `1px solid ${tone}33` }}>
      <Icon size={14} style={{ color: tone, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
      <span style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.ink }}>
        {call.agreed
          ? <>The portal predicted <b>{call.predicted?.serveLabel}</b>, and the gateway served it. The copy of the policy is in step.</>
          : <>The portal predicted <b>{call.predicted?.serveLabel}</b> but the gateway served <b>{call.served?.label}</b> — the portal's copy of the policy is out of step with the gateway's config.</>}
        {call.gatewayTarget?.name && (
          <> The gateway's own header names target <b dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11.5 }}>{call.gatewayTarget.name}</b>
            {call.predicted?.target ? (call.gatewayTarget.name === call.predicted.target ? ' — the one rule ' + (call.predicted.rule || 'default') + ' points at.' : ` — the portal expected ${call.predicted.target}.`) : '.'}</>
        )}
      </span>
    </div>
  )
}

function Credential({ t, call, session }) {
  const payload = call.kind === 'tamper' ? call.tamper?.token?.payload : session.credential?.payload
  const header = call.kind === 'tamper' ? call.tamper?.token?.header : { alg: session.credential?.alg, kid: session.credential?.kid }
  const md = payload?.defaults?.metadata ?? {}
  const exp = payload?.exp
  const validAtCall = exp ? exp * 1000 > call.at : null
  return (
    <div>
      <KV t={t} k="Algorithm" v={header?.alg} />
      <KV t={t} k="Key id" v={header?.kid ? short(header.kid, 8, 4) : '—'} />
      <KV t={t} k="Expires" v={exp ? `${clockS(exp)} · ${validAtCall ? `valid at send (${minsLeft(exp, call.at)} min left)` : 'already expired at send'}` : null} mono={false} />
      <KV t={t} k="email" v={md.email} />
      <KV t={t} k="user_role" v={md.user_role} />
      <KV t={t} k="department" v={md.department} />
      <KV t={t} k="config_id" v={payload?.defaults?.config_id} />
      {call.kind === 'tamper' && (
        <KV t={t} k="Signature" v={call.tamper?.kind === 'unsigned' ? 'none' : call.tamper?.kind === 'forged' ? 'by an unregistered key' : call.tamper?.kind === 'claims' ? 'original — no longer matches' : 'valid, but expired'} mono={false} />
      )}
    </div>
  )
}

function Gateway({ t, call }) {
  const h = call.responseHeaders ?? {}
  return (
    <div>
      <KV t={t} k="HTTP status" v={call.status || '—'} />
      <KV t={t} k="Trace id" v={h['x-portkey-trace-id']} copy />
      <KV t={t} k="Provider" v={h['x-portkey-provider']} />
      <KV t={t} k="Target used" v={call.gatewayTarget ? `${call.gatewayTarget.name ?? '?'} · config.${call.gatewayTarget.raw}` : h['x-portkey-last-used-option-index']} />
      <KV t={t} k="Retries" v={h['x-portkey-retry-attempt-count']} />
      <KV t={t} k="Cache" v={h['x-portkey-cache-status']} />
      <KV t={t} k="Response id" v={call.responseId} copy />
      <KV t={t} k="Finish reason" v={call.finishReason} />
    </div>
  )
}

function Guardrails({ t, call }) {
  const hr = call.hookResults
  const hooks = [...(hr?.before_request_hooks ?? []), ...(hr?.after_request_hooks ?? [])]
  if (!hooks.length) {
    return <p style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.inkDim, margin: 0 }}>
      No guardrail ran on this config — it routes by identity and inspects nothing. Pair it with an AIRS guardrail to scan the prompts as well.
    </p>
  }
  return (
    <ul className="space-y-1.5">
      {hooks.map((hk, i) => (
        <li key={hk.id ?? i} className="flex items-center gap-2" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink }}>
          <span className="rounded-full" style={{ width: 7, height: 7, background: hk.verdict === false ? t.block : t.pass }} aria-hidden="true" />
          <span className="truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{hk.id ?? `hook ${i + 1}`}</span>
          <span style={{ color: t.inkDim }}>{hk.verdict === false ? 'failed' : 'passed'}</span>
        </li>
      ))}
    </ul>
  )
}

export function RequestEvidence({ t, tone, a, expired, onOpenLifecycle }) {
  const call = a.pending ?? a.selected
  if (!call) return <Empty t={t} tone={tone} expired={expired} session={a.session} onOpenLifecycle={onOpenLifecycle} />
  const v = callVerdict(call)
  const u = call.usage
  const matched = call.kind === 'tamper' ? null : call.predicted?.rule
  return (
    <div className="flex flex-col h-full overflow-hidden" style={glass(t, { radius: 22 })}>
      <Band t={t} call={call} v={v} />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!call.pending && <div className="px-3 pt-3"><LifecycleCta t={t} onOpen={() => onOpenLifecycle('gateway', call.id)} /></div>}
        {!call.pending && (
          <EvidenceLook.Provider value="band">
            <div className="mt-3">
              <Block t={t} title="Asked for · answered by" icon={Cpu} accent={tone} sub={call.served ? `${call.served.label}${call.overridden ? ' (replaced)' : ''}` : 'nothing answered'}>
                <ModelRows t={t} tone={tone} call={call} />
              </Block>
              <Block t={t} title="Policy decision" icon={Route} accent={tone}
                     sub={call.kind === 'tamper' ? (call.refused ? 'never evaluated' : 'evaluated on a doctored token') : call.predicted?.rule ? `rule ${call.predicted.rule} of ${a.config?.rules}` : 'default route'}>
                {call.kind !== 'tamper' && <PolicyRules t={t} tone={tone} config={a.config} match={matched ?? 0} />}
                <Agreement t={t} call={call} />
              </Block>
              <Block t={t} title="Credential presented" icon={KeyRound} accent={call.kind === 'tamper' ? t.block : tone}
                     sub={call.kind === 'tamper' ? call.tamper?.what : 'your minted credential, as the API key'} defaultOpen={call.kind === 'tamper'}>
                <Credential t={t} call={call} session={a.session} />
              </Block>
              <Block t={t} title="Gateway" icon={Waypoints} accent={t.live} sub={call.responseHeaders?.['x-portkey-trace-id'] ? `trace ${short(call.responseHeaders['x-portkey-trace-id'], 8, 4)}` : `HTTP ${call.status || '—'}`} defaultOpen={false}>
                <Gateway t={t} call={call} />
              </Block>
              {u && (
                <Block t={t} title="Tokens" icon={Coins} accent={t.live} sub={`${u.prompt_tokens ?? '—'} in · ${u.completion_tokens ?? '—'} out`} defaultOpen={false}>
                  <KV t={t} k="Prompt" v={u.prompt_tokens} />
                  <KV t={t} k="Completion" v={u.completion_tokens} />
                  <KV t={t} k="Total" v={u.total_tokens} />
                </Block>
              )}
              <Block t={t} title="Guardrails" icon={ShieldQuestion} accent={t.idle} sub={call.hookResults ? 'hook results returned' : 'none on this config'} defaultOpen={false}>
                <Guardrails t={t} call={call} />
              </Block>
            </div>
          </EvidenceLook.Provider>
        )}
      </div>
    </div>
  )
}
