import React, { useMemo, useState } from 'react'
import {
  Link2, ListTree, CheckCircle2, XCircle, MinusCircle, Copy, Check, KeyRound, Fingerprint, Building2, Timer,
  Terminal, Waypoints, ScrollText, ShieldCheck, ArrowRight, Info,
} from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { Card, KV, IconSquare, fmtMs } from '../../components/api-intercept/telemetry/primitives'
import { CodeBlock } from '../supply-chain-launch/ScanTelemetryTabs'
import {
  SEGMENT, ENTRA_BLUE, CLAIM_NOTES, TIME_CLAIMS, STEPS, claimRows, clock, clockS, relative, short, journeyLines, callVerdict, VERDICT, toneOf,
} from './accessModel'

/**
 * LifecycleSteps — the body of the token lifecycle drawer: an overview of the
 * whole journey (with the three tokens' lifetimes on one axis), then one tab
 * per step holding the real artifacts captured from this sign-in. The
 * teaching notes are the standalone app's; the values are this session's.
 */

// Lighter segment colours for the dark theme — the light ones sink into it.
const SEG_DARK = { header: '#22D3EE', payload: '#A78BFA', signature: '#E879F9' }
const seg = (t, k) => (t.isLight ? SEGMENT[k] : SEG_DARK[k])

function Pill({ t, tone, children }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 whitespace-nowrap"
          style={{ height: 20, fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: t.isLight ? shade(tone, 0.3) : tone, background: `${tone}17` }}>
      {children}
    </span>
  )
}

const Yes = ({ t, ok, yes = 'yes', no = 'no' }) => <Pill t={t} tone={ok ? t.pass : t.block}>{ok ? yes : no}</Pill>

function StepHead({ t, tone, entry, note, missing }) {
  if (!entry) {
    return (
      <div className="rounded-2xl p-4" style={{ background: t.sunken, border: `1px dashed ${t.railBed}` }}>
        <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>Not reached</div>
        <p style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.inkDim, margin: '3px 0 0' }}>{missing ?? 'The sign-in stopped before this step, so nothing was captured.'}</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
        <span>captured <span style={{ fontFamily: FONT.mono, color: t.ink }}>{clock(entry.at)}</span></span>
        {entry.ms != null && <span>· took <span style={{ fontFamily: FONT.mono, color: t.ink }}>{fmtMs(entry.ms)}</span></span>}
      </div>
      {note && (
        <div className="flex gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ background: `${tone}0f`, border: `1px solid ${tone}30` }}>
          <Info size={14} style={{ color: t.isLight ? shade(tone, 0.25) : tone, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <p style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.ink, margin: 0 }}>{note}</p>
        </div>
      )}
    </div>
  )
}

function CopyBtn({ t, text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" title={label} aria-label={label}
            onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200) }}
            className="grid place-items-center rounded-full flex-shrink-0" style={{ width: 26, height: 26, color: done ? t.pass : t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
      {done ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

function UrlBlock({ t, title, url }) {
  if (!url) return null
  return (
    <Card t={t} title={title} icon={Link2} right={<CopyBtn t={t} text={url} label="Copy URL" />}>
      <div dir="ltr" className="rounded-xl px-3 py-2.5 overflow-auto" style={{ background: t.codeBg, border: `1px solid ${t.hairline}`, maxHeight: 130, fontFamily: FONT.mono, fontSize: 11, lineHeight: 1.6, color: t.inkDim, wordBreak: 'break-all' }}>
        {url}
      </div>
    </Card>
  )
}

/** A token as the three segments a verifier separates it into. */
export function JwtAnatomy({ t, parts, caption, sub }) {
  if (!parts) return null
  if (parts.opaque) {
    return (
      <Card t={t} title={caption} icon={KeyRound}>
        <p style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, margin: 0 }}>An opaque token ({parts.length} characters) — not a JWT, so there is nothing to decode.</p>
      </Card>
    )
  }
  const legend = [
    { k: 'header', label: 'Header', len: parts.headerB64.length, text: `JOSE header · alg ${parts.header?.alg ?? '—'}${parts.header?.kid ? ` · kid ${short(parts.header.kid, 6, 4)}` : ''}` },
    { k: 'payload', label: 'Payload', len: parts.payloadB64.length, text: `the claims · ${Object.keys(parts.payload ?? {}).length} keys` },
    { k: 'signature', label: 'Signature', len: parts.signatureB64.length, text: parts.signatureBytes ? `${parts.signatureBytes} bytes` : 'empty — unsigned' },
  ]
  return (
    <Card t={t} title={caption} icon={KeyRound} right={<CopyBtn t={t} text={parts.raw} label="Copy token" />}>
      {sub && <p style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, margin: '0 0 8px' }}>{sub}</p>}
      <div dir="ltr" className="rounded-xl px-3 py-2.5 overflow-auto" style={{ background: t.codeBg, border: `1px solid ${t.hairline}`, maxHeight: 150, fontFamily: FONT.mono, fontSize: 11, lineHeight: 1.6, wordBreak: 'break-all' }}>
        <span style={{ color: seg(t, 'header') }}>{parts.headerB64}</span>
        <span style={{ color: t.ink, fontWeight: 700 }}>.</span>
        <span style={{ color: seg(t, 'payload') }}>{parts.payloadB64}</span>
        <span style={{ color: t.ink, fontWeight: 700 }}>.</span>
        <span style={{ color: seg(t, 'signature') }}>{parts.signatureB64}</span>
      </div>
      <div className="grid gap-2 mt-2.5" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        {legend.map((l) => (
          <div key={l.k} className="rounded-xl px-2.5 py-2 min-w-0" style={{ background: `${seg(t, l.k)}10`, border: `1px solid ${seg(t, l.k)}33` }}>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full" style={{ width: 7, height: 7, background: seg(t, l.k) }} aria-hidden="true" />
              <span style={{ fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: t.ink }}>{l.label}</span>
              <span style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }}>{l.len} ch</span>
            </div>
            <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 2 }} title={l.text}>{l.text}</div>
          </div>
        ))}
      </div>
      <p style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.55, color: t.inkDim, margin: '10px 0 0' }}>
        Signed input is <code style={{ fontFamily: FONT.mono, color: t.ink }}>header.payload</code> — {parts.signingInputLength} characters hashed with SHA-256,
        {parts.signatureBytes ? <> then RSA-signed into {parts.signatureBytes} bytes.</> : <> but nothing was signed.</>} The payload is only base64: anyone can read it; nobody can change it without the private key.
      </p>
    </Card>
  )
}

function fmtValue(v) {
  if (Array.isArray(v)) return `[${v.map((x) => JSON.stringify(x)).join(', ')}]`
  if (v && typeof v === 'object') return JSON.stringify(v)
  return typeof v === 'string' ? v : JSON.stringify(v)
}

/** Every claim, with what it is for; the ones this demo acts on are marked. */
export function ClaimsTable({ t, tone, payload, title = 'Every claim', used = {} }) {
  const rows = useMemo(() => claimRows(payload), [payload])
  if (!payload) return null
  return (
    <Card t={t} title={title} icon={ListTree} right={<span style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim }}>{rows.filter((r) => !r.group).length}</span>}>
      <div>
        {rows.map((r) => {
          const leaf = r.key.split('.').pop()
          if (r.group) {
            return (
              <div key={r.key} className="py-1.5" style={{ borderTop: `1px solid ${t.hairline}`, paddingLeft: r.depth * 14 }}>
                <span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, color: t.ink }}>{leaf}</span>
                {CLAIM_NOTES[r.key] && <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}> — {CLAIM_NOTES[r.key]}</span>}
              </div>
            )
          }
          const note = CLAIM_NOTES[r.key] ?? (r.depth === 0 ? null : CLAIM_NOTES[leaf])
          const mark = used[r.key]
          const isTime = TIME_CLAIMS.has(leaf) && typeof r.value === 'number'
          return (
            <div key={r.key} className="flex gap-3 py-1.5 rounded-lg" style={{ borderTop: `1px solid ${t.hairline}`, background: mark ? `${tone}0f` : 'transparent' }}>
              <span className="flex-shrink-0 truncate" dir="ltr" title={r.key}
                    style={{ width: 150, paddingLeft: r.depth * 14 + (mark ? 6 : 0), fontFamily: FONT.mono, fontSize: 11, color: t.ink }}>{leaf}</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline gap-2 flex-wrap">
                  <span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11, color: t.isLight ? shade(seg(t, 'payload'), 0.1) : seg(t, 'payload'), wordBreak: 'break-all' }}>{fmtValue(r.value)}</span>
                  {isTime && <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{clockS(r.value)} · {relative(r.value * 1000 - Date.now())}</span>}
                  {mark && <Pill t={t} tone={tone}>{mark}</Pill>}
                </span>
                {note && <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>{note}</span>}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── overview ────────────────────────────────────────────────────────────────

/** The three tokens' lifetimes on one axis, with now marked. */
function Lifetimes({ t, tone, session, now }) {
  const L = session.lifecycle ?? {}
  const id = L.exchange?.data?.idToken?.payload
  const at = L.exchange?.data?.accessToken?.payload
  const cred = L.mint?.data?.jwt?.payload
  const bars = [
    id && { key: 'id', label: 'ID token', by: 'Microsoft → this portal', iat: id.nbf ?? id.iat, exp: id.exp, color: ENTRA_BLUE },
    at && { key: 'at', label: 'Graph access token', by: 'Microsoft → Microsoft Graph', iat: at.nbf ?? at.iat, exp: at.exp, color: '#38BDF8' },
    cred && { key: 'cred', label: 'Gateway credential', by: 'this portal → the AI Gateway', iat: cred.iat, exp: cred.exp, color: tone },
  ].filter(Boolean)
  if (!bars.length) return null
  const lo = Math.min(...bars.map((b) => b.iat))
  const hi = Math.max(...bars.map((b) => b.exp))
  const span = Math.max(1, hi - lo)
  const x = (s) => `${Math.max(0, Math.min(100, ((s - lo) / span) * 100))}%`
  const nowS = now / 1000
  return (
    <Card t={t} title="Three tokens, three lifetimes" icon={Timer}>
      <p style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.inkDim, margin: '0 0 10px' }}>
        Each token is issued by one party to another and dies on its own clock. None of them is refreshed here: when the credential expires, you sign in again.
      </p>
      <div className="relative" style={{ marginTop: 22 }}>
        {bars.map((b) => {
          const left = ((b.iat - lo) / span) * 100
          const width = ((b.exp - b.iat) / span) * 100
          const alive = b.exp > nowS
          return (
            <div key={b.key} className="mb-3">
              <div className="flex items-baseline justify-between gap-2">
                <span style={{ fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: t.ink }}>{b.label} <span style={{ fontFamily: FONT.prose, fontWeight: 400, fontSize: 11, color: t.inkDim }}>· {b.by}</span></span>
                <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: alive ? t.inkDim : (t.isLight ? shade(t.warn, 0.4) : t.warn) }}>
                  {clockS(b.iat)} → {clockS(b.exp)} · {alive ? `${Math.round((b.exp - nowS) / 60)} min left` : 'expired'}
                </span>
              </div>
              <div className="relative mt-1 rounded-full" style={{ height: 10, background: t.sunken }}>
                <div className="absolute top-0 bottom-0 rounded-full" style={{ left: `${left}%`, width: `${width}%`, background: bandBg(b.color), opacity: alive ? 1 : 0.4 }} />
              </div>
            </div>
          )
        })}
        {nowS >= lo && nowS <= hi && (
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: x(nowS), width: 0, borderLeft: `2px dashed ${t.live}` }}>
            <span className="absolute rounded-full px-1.5" style={{ top: -16, left: -16, fontFamily: FONT.prose, fontSize: 10, fontWeight: 700, color: '#fff', background: t.live }}>now</span>
          </div>
        )}
      </div>
    </Card>
  )
}

function Audiences({ t, tone, session }) {
  const L = session.lifecycle ?? {}
  const ex = L.exchange?.data
  const sig = L.claims?.data?.verification?.checks?.find((c) => c.id === 'signature')
  const mint = L.mint?.data
  const cards = [
    { icon: Fingerprint, color: ENTRA_BLUE, title: 'ID token', who: 'Who you are',
      rows: [['Issued by', 'Microsoft Entra ID'], ['Audience', `this app · ${short(ex?.idToken?.payload?.aud, 6, 4)}`], ['Verified by', sig?.ok ? "this portal, against Microsoft's JWKS" : sig?.ok === false ? 'FAILED here' : 'not checked (JWKS unreachable)']] },
    { icon: Building2, color: '#38BDF8', title: 'Access token', who: 'Read your department',
      rows: [['Issued by', 'Microsoft Entra ID'], ['Audience', 'Microsoft Graph'], ['Verified by', 'Graph only — its header carries a nonce, so no one else can check it']] },
    { icon: KeyRound, color: tone, title: 'Gateway credential', who: 'What you may use',
      rows: [['Issued by', 'this portal (token broker)'], ['Audience', `the AI Gateway · org ${short(mint?.jwt?.payload?.portkey_oid, 6, 4)}`], ['Verified by', `the gateway, against the JWKS · kid ${short(mint?.kidInHeader, 6, 4)}`]] },
  ]
  return (
    <div>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        {cards.map((c) => (
          <div key={c.title} className="rounded-2xl p-3 min-w-0" style={{ background: t.panel, border: `1px solid ${c.color}33`, boxShadow: t.shadowSm }}>
            <div className="flex items-center gap-2">
              <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: bandBg(c.color) }}>
                <c.icon size={14} style={{ color: '#fff' }} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{c.title}</span>
                <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{c.who}</span>
              </span>
            </div>
            <div className="mt-2">
              {c.rows.map(([k, v]) => (
                <div key={k} className="py-1" style={{ borderTop: `1px solid ${t.hairline}` }}>
                  <div style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim }}>{k}</div>
                  <div style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.ink, lineHeight: 1.4 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {ex?.refreshTokenReturned && (
        <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, margin: '8px 2px 0' }}>
          A refresh token was returned too (because of <code style={{ fontFamily: FONT.mono }}>offline_access</code>). It was discarded on arrival — never stored, never shown.
        </p>
      )}
    </div>
  )
}

export function OverviewTab({ t, tone, session, now, onStep }) {
  const lines = journeyLines(session)
  const L = session.lifecycle ?? {}
  const first = STEPS.map((s) => L[s.id]?.at).find(Boolean)
  return (
    <div className="space-y-3">
      <Card t={t} title="The journey" icon={Waypoints}>
        <ol>
          {STEPS.map((st) => {
            const e = L[st.id]
            const reached = st.id === 'gateway' ? !!L.mint : !!e
            const failed = session.error?.step === st.id
            const c = failed ? t.warn : reached ? tone : t.inkFaint
            return (
              <li key={st.id}>
                <button type="button" onClick={() => onStep(st.id)} className="w-full flex items-center gap-3 rounded-xl text-left py-2 px-1.5"
                        style={{ borderTop: `1px solid ${t.hairline}` }}
                        onMouseEnter={(ev) => { ev.currentTarget.style.background = t.sunken }}
                        onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent' }}>
                  <span className="grid place-items-center rounded-full flex-shrink-0"
                        style={{ width: 24, height: 24, fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 700, color: reached || failed ? '#fff' : t.inkDim, background: reached || failed ? bandBg(c) : t.sunken }}>
                    {st.n}
                  </span>
                  <IconSquare t={t} icon={st.icon} tone={c} size={28} />
                  <span className="flex-1 min-w-0">
                    <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{st.title}{failed && <span style={{ color: t.isLight ? shade(t.warn, 0.4) : t.warn }}> · stopped here</span>}</span>
                    <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }} title={lines[st.id]}>{lines[st.id] ?? (reached ? st.line : 'not reached')}</span>
                  </span>
                  {e?.at && <span className="flex-shrink-0 text-right" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>
                    {first ? `+${fmtMs(e.at - first)}` : clock(e.at)}{e.ms != null ? <span style={{ color: t.inkFaint }}> · {fmtMs(e.ms)}</span> : null}
                  </span>}
                  <ArrowRight size={13} style={{ color: t.inkFaint, flexShrink: 0 }} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ol>
      </Card>
      <Lifetimes t={t} tone={tone} session={session} now={now} />
      <Audiences t={t} tone={tone} session={session} />
    </div>
  )
}

// ─── the steps ───────────────────────────────────────────────────────────────

const PARAM_NOTES = {
  client_id: 'Which application is asking.',
  response_type: 'code — ask for a single-use code, not a token.',
  redirect_uri: 'Where Microsoft sends the browser back. Must match the registration exactly.',
  response_mode: 'The code comes back in the query string.',
  scope: 'openid profile → an ID token · User.Read → a Graph token · offline_access → a refresh token.',
  state: 'Must come back unchanged — ties the answer to this request (CSRF protection).',
  nonce: 'Will be echoed inside the ID token — proves the token answers this request.',
  code_challenge: 'SHA-256 of a secret verifier that stays on this server (PKCE).',
  code_challenge_method: 'S256 — the challenge is a hash, so the verifier cannot be derived from it.',
  prompt: 'select_account — always show the account picker.',
}

export function AuthorizeTab({ t, tone, session }) {
  const e = session.lifecycle?.authorize
  const d = e?.data
  return (
    <div className="space-y-3">
      <StepHead t={t} tone={tone} entry={e}
                note={d?.live ? 'Built by this server and opened in the browser. No token exists yet — only a request, carrying a hash of a secret the server keeps.' : 'The sign-in started before the portal restarted, so the original request was not in memory. Sign out and in again to capture a live one.'} />
      <UrlBlock t={t} title="Authorize URL" url={d?.url} />
      {d?.params && (
        <Card t={t} title="Query parameters Microsoft received" icon={ListTree}>
          {Object.entries(d.params).map(([k, v]) => (
            <KV key={k} t={t} k={k} top>
              <span className="block" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11, color: t.ink, wordBreak: 'break-all' }}>{v}</span>
              {PARAM_NOTES[k] && <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }}>{PARAM_NOTES[k]}</span>}
            </KV>
          ))}
        </Card>
      )}
    </div>
  )
}

export function CallbackTab({ t, tone, session }) {
  const e = session.lifecycle?.callback
  const d = e?.data
  return (
    <div className="space-y-3">
      <StepHead t={t} tone={tone} entry={e} note="The code is a single-use voucher, not a token. It is worthless without the client secret and the PKCE verifier — which is why the next step happens server side." />
      {d && <UrlBlock t={t} title="Redirect Microsoft sent the browser to" url={d.redirectUrl} />}
      {d && (
        <Card t={t} title="What came back" icon={ShieldCheck}>
          <KV t={t} k="Authorization code"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{d.code ? short(d.code, 14, 8) : '—'}</span></KV>
          <KV t={t} k="Code length">{d.codeLength} characters</KV>
          <KV t={t} k="State returned"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{d.state ?? 'none'}</span></KV>
          <KV t={t} k="Matches our request"><Yes t={t} ok={d.stateMatches} /></KV>
          <KV t={t} k="Same browser"><Yes t={t} ok={d.browserBound} yes="yes — binding cookie matched" no="no" /></KV>
          {d.sessionState && <KV t={t} k="session_state"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{d.sessionState}</span></KV>}
          {d.error && <KV t={t} k="Error" top><span style={{ color: t.isLight ? shade(t.warn, 0.4) : t.warn }}>{d.error}: {d.errorDescription}</span></KV>}
        </Card>
      )}
    </div>
  )
}

export function ExchangeTab({ t, tone, session }) {
  const e = session.lifecycle?.exchange
  const d = e?.data
  return (
    <div className="space-y-3">
      <StepHead t={t} tone={tone} entry={e} note="Two tokens arrive. The ID token describes the user; the access token is addressed to Microsoft Graph. Neither is addressed to the AI gateway — that is why the portal mints its own." />
      {d && (
        <>
          <Card t={t} title="Back-channel request" icon={Terminal}>
            <KV t={t} k="POST" top><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11, wordBreak: 'break-all' }}>{d.url}</span></KV>
            {Object.entries(d.requestFields ?? {}).map(([k, v]) => (
              <KV key={k} t={t} k={k} top><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11, wordBreak: 'break-all', color: k === 'client_secret' ? t.inkDim : t.ink }}>{v}</span></KV>
            ))}
          </Card>
          <Card t={t} title="Response" icon={ScrollText}>
            <KV t={t} k="HTTP status"><Pill t={t} tone={d.status === 200 ? t.pass : t.warn}>{d.status || 'no answer'}</Pill></KV>
            <KV t={t} k="token_type">{d.tokenType ?? '—'}</KV>
            <KV t={t} k="expires_in">{d.expiresIn != null ? `${d.expiresIn} s` : '—'}</KV>
            {d.extExpiresIn != null && <KV t={t} k="ext_expires_in">{d.extExpiresIn} s</KV>}
            <KV t={t} k="Scope granted" top><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{d.scope ?? '—'}</span></KV>
            <KV t={t} k="Fields returned" top><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{(d.keysReturned ?? []).join(', ')}</span></KV>
            <KV t={t} k="Refresh token">{d.refreshTokenReturned ? 'returned — discarded, never stored or shown' : 'not returned'}</KV>
            {d.responseHeaders?.['x-ms-request-id'] && <KV t={t} k="x-ms-request-id"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{d.responseHeaders['x-ms-request-id']}</span></KV>}
            {d.error && <KV t={t} k="Error" top><span style={{ color: t.isLight ? shade(t.warn, 0.4) : t.warn }}>{d.error}: {d.errorDescription}</span></KV>}
          </Card>
          <JwtAnatomy t={t} parts={d.idToken} caption="ID token, as issued by Microsoft" />
          <ClaimsTable t={t} tone={tone} payload={d.idToken?.payload} title="ID token claims" used={{ preferred_username: 'routed as email', roles: 'decides the role', nonce: 'checked', aud: 'checked', iss: 'checked', tid: 'checked' }} />
          <JwtAnatomy t={t} parts={d.accessToken} caption="Graph access token"
                      sub="This portal does not verify this signature, and should not: the token belongs to Microsoft Graph, whose tokens carry a nonce in the header so that only Graph can validate them." />
          <ClaimsTable t={t} tone={tone} payload={d.accessToken?.payload} title="Access token claims" used={{ scp: 'lets us read /me' }} />
          <CodeBlock t={t} title="Response headers" sub="token endpoint" value={d.responseHeaders} />
        </>
      )}
    </div>
  )
}

function CheckRow({ t, c }) {
  const Icon = c.ok ? CheckCircle2 : c.ok === false ? XCircle : MinusCircle
  const tone = c.ok ? t.pass : c.ok === false ? t.block : t.warn
  return (
    <div className="flex items-start gap-2.5 py-2" style={{ borderTop: `1px solid ${t.hairline}` }}>
      <Icon size={15} style={{ color: tone, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{c.label}</span>
        <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1 }}>{c.detail}</span>
      </span>
    </div>
  )
}

export function ClaimsTab({ t, tone, session }) {
  const e = session.lifecycle?.claims
  const d = e?.data
  return (
    <div className="space-y-3">
      <StepHead t={t} tone={tone} entry={e} note="An absent roles claim is not an error here: the portal falls back to User, which is why an account with no app role assigned looks like a normal user." />
      {d && (
        <>
          <Card t={t} title="ID token verification" icon={ShieldCheck}
                right={<Pill t={t} tone={d.verification?.ok ? t.pass : t.block}>{d.verification?.ok ? 'passed' : 'failed'}</Pill>}>
            {(d.verification?.checks ?? []).map((c) => <CheckRow key={c.id} t={t} c={c} />)}
            {d.verification?.jwksUrl && <KV t={t} k="Microsoft JWKS" top><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5, wordBreak: 'break-all' }}>{d.verification.jwksUrl}</span></KV>}
          </Card>
          <Card t={t} title="What was decided from it" icon={Fingerprint}>
            <KV t={t} k="Email from">{d.emailResolvedFrom ?? 'no claim matched'}</KV>
            <KV t={t} k="Email"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{d.email}</span></KV>
            <KV t={t} k="Subject"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{d.sub}</span></KV>
            <KV t={t} k="Object id"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{d.oid}</span></KV>
            <KV t={t} k="roles claim"><Yes t={t} ok={d.rolesClaimPresent} yes="present" no="absent" /> <span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11, marginLeft: 6 }}>{d.roles?.length ? `[${d.roles.join(', ')}]` : ''}</span></KV>
            <KV t={t} k="Role decided"><Pill t={t} tone={tone}>{d.role}</Pill></KV>
            <KV t={t} k="Issued · expires">{clockS(d.issuedAt)} → {clockS(d.expiresAt)}</KV>
          </Card>
          <ClaimsTable t={t} tone={tone} payload={d.all} title="Every claim in the ID token" used={{ preferred_username: 'routed as email', roles: 'decides the role', sub: 'sealed as sub', nonce: 'checked' }} />
        </>
      )}
    </div>
  )
}

export function GraphTab({ t, tone, session }) {
  const e = session.lifecycle?.graph
  const d = e?.data
  return (
    <div className="space-y-3">
      <StepHead t={t} tone={tone} entry={e} note="Department is not a token claim, so it costs a round trip. A non-200 here falls through to the General fallback without failing the sign-in." />
      {d && (
        <>
          <Card t={t} title="The call" icon={Building2}>
            <KV t={t} k="GET" top><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11, wordBreak: 'break-all' }}>{d.requestUrl}</span></KV>
            <KV t={t} k="HTTP status"><Pill t={t} tone={d.status === 200 ? t.pass : t.warn}>{d.status ?? d.exception ?? '—'}</Pill></KV>
            <KV t={t} k="Department used">{d.departmentUsed} {d.fellBack && <Pill t={t} tone={t.warn}>fallback</Pill>}</KV>
            {d.responseHeaders?.['request-id'] && <KV t={t} k="request-id"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{d.responseHeaders['request-id']}</span></KV>}
          </Card>
          <CodeBlock t={t} title="Request headers" sub="the Graph access token as a bearer" value={d.requestHeaders} />
          <CodeBlock t={t} title="Response body" sub="/me" value={d.responseBody} defaultOpen />
          <CodeBlock t={t} title="Response headers" sub="Microsoft Graph" value={d.responseHeaders} />
        </>
      )}
    </div>
  )
}

/** The credential used from a terminal — the policy travels with the token, not with this app. */
function TryIt({ t, token, config }) {
  const [done, setDone] = useState(false)
  const pick = config?.models?.find((m) => /sonnet/i.test(m.label))?.id ?? config?.models?.[0]?.id
  const cmd = [
    `curl -s ${config?.gateway?.baseUrl}/chat/completions \\`,
    '  -H "x-portkey-api-key: $JWT" \\',
    `  -H "x-portkey-provider: ${config?.provider}" \\`,
    '  -H "Content-Type: application/json" \\',
    `  -d '{"model":"${config?.provider}/${pick}","messages":[{"role":"user","content":"Which model are you?"}],"max_tokens":64}'`,
  ].join('\n')
  return (
    <Card t={t} title="Use it from a terminal" icon={Terminal}
          right={<button type="button" onClick={() => { navigator.clipboard?.writeText(`JWT='${token}'\n${cmd}`); setDone(true); setTimeout(() => setDone(false), 1400) }}
                         className="inline-flex items-center gap-1.5 rounded-full px-2.5" style={{ height: 26, fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: done ? t.pass : t.ink, background: t.sunken, border: `1px solid ${t.hairline}` }}>
                   {done ? <Check size={12} /> : <Copy size={12} />} {done ? 'Copied' : 'Copy with your token'}
                 </button>}>
      <p style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.inkDim, margin: '0 0 8px' }}>
        The credential works outside this app — and the routing still applies, because the policy is sealed inside it. Ask for any model; the gateway decides.
      </p>
      <pre dir="ltr" className="rounded-xl overflow-auto" style={{ margin: 0, padding: '10px 12px', background: t.codeBg, border: `1px solid ${t.hairline}`, fontFamily: FONT.mono, fontSize: 10.5, lineHeight: 1.6, color: t.inkDim }}>{cmd}</pre>
    </Card>
  )
}

export function MintTab({ t, tone, session, config }) {
  const e = session.lifecycle?.mint
  const d = e?.data
  return (
    <div className="space-y-3">
      <StepHead t={t} tone={tone} entry={e} note="The payload is signed, not encrypted: anyone can read these claims, but altering one invalidates the signature. The gateway finds the right public key by matching kid." />
      {d && (
        <>
          <JwtAnatomy t={t} parts={d.jwt} caption="Minted by this portal" />
          <ClaimsTable t={t} tone={tone} payload={d.jwt?.payload} title="Payload — the claims the gateway will route on"
                       used={{ 'defaults.config_id': 'locks the policy', 'defaults.metadata.email': 'rule 1', 'defaults.metadata.user_role': 'rules 2–3', portkey_oid: 'picks the JWKS' }} />
          <Card t={t} title="Checks before it leaves" icon={ShieldCheck}>
            <KV t={t} k="kid in token"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{d.kidInHeader}</span></KV>
            <KV t={t} k="kid in JWKS"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{d.kidInJwks}</span></KV>
            <KV t={t} k="kid match"><Yes t={t} ok={d.kidMatch} no="NO — every request will 401" /></KV>
            <KV t={t} k="Modulus length">{d.modulusLength} characters {d.modulusLength === 342 ? <Pill t={t} tone={t.pass}>RSA-2048, intact</Pill> : <Pill t={t} tone={t.warn}>expected 342 — truncated?</Pill>}</KV>
            <KV t={t} k="Self-verification"><Yes t={t} ok={d.selfVerified} yes="the signature verifies against the JWKS" no="does NOT verify" /></KV>
            <KV t={t} k="Private key">{d.privateKeyFile} · never leaves this server</KV>
          </Card>
          <CodeBlock t={t} title="JOSE header" value={d.jwt?.header} />
          <CodeBlock t={t} title="Public key the gateway verifies against" sub="JWKS entry — public, safe to publish" value={d.jwks} />
          <TryIt t={t} token={d.jwt?.raw} config={config} />
        </>
      )}
    </div>
  )
}

export function GatewayTab({ t, tone, session, callId, onPick }) {
  const calls = session.calls ?? []
  const call = calls.find((c) => c.id === callId) ?? calls[calls.length - 1]
  if (!session.lifecycle?.mint) return <StepHead t={t} tone={tone} entry={null} />
  if (!calls.length) {
    return (
      <div className="space-y-3">
        <StepHead t={t} tone={tone} entry={{ at: session.lifecycle.mint.at, ms: null }} note="The JWT travels in x-portkey-api-key. The gateway reads portkey_oid from it, loads that org's JWKS, verifies the signature, and only then applies the routing rules." />
        <p style={{ fontFamily: FONT.prose, fontSize: 13, color: t.inkDim }}>Send a prompt and the request and response land here — headers, body, what answered.</p>
      </div>
    )
  }
  const v = callVerdict(call)
  const tn = toneOf(t, v)
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {[...calls].reverse().map((c) => {
          const on = c.id === call.id
          const ct = toneOf(t, callVerdict(c))
          return (
            <button key={c.id} type="button" onClick={() => onPick(c.id)} aria-pressed={on}
                    className="inline-flex items-center gap-1.5 rounded-full px-3"
                    style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? '#fff' : t.inkDim, background: on ? bandBg(ct) : t.sunken, border: `1px solid ${on ? 'transparent' : t.hairline}` }}>
              <span className="rounded-full" style={{ width: 6, height: 6, background: on ? '#fff' : ct }} aria-hidden="true" />
              {String(c.n).padStart(2, '0')} · {c.kind === 'tamper' ? c.tamper?.label : c.served?.label ?? c.requested?.label}
            </button>
          )
        })}
      </div>
      <StepHead t={t} tone={tone} entry={{ at: call.at, ms: call.elapsedMs }}
                note="The JWT travels in x-portkey-api-key. The gateway reads portkey_oid from it, loads that org's JWKS, verifies the signature, and only then applies the routing rules." />
      <Card t={t} title="Outcome" icon={Waypoints} tone={tn} right={<Pill t={t} tone={tn}>{VERDICT[v]?.title}</Pill>}>
        <KV t={t} k="Model asked for"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{call.requestBody?.model ?? call.requested?.id}</span></KV>
        <KV t={t} k="Model served"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{call.served?.id ?? '—'}</span></KV>
        <KV t={t} k="Replaced by policy">{call.overridden ? 'yes' : 'no'}</KV>
        {call.gatewayTarget && <KV t={t} k="Target (gateway)"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{call.gatewayTarget.name} · config.{call.gatewayTarget.raw}</span></KV>}
        {call.predicted && <KV t={t} k="Portal predicted">{call.predicted.serveLabel} {call.agreed != null && <Yes t={t} ok={call.agreed} yes="gateway agreed" no="gateway disagreed" />}</KV>}
        <KV t={t} k="HTTP status">{call.status || '—'}</KV>
        <KV t={t} k="Round trip">{fmtMs(call.elapsedMs)}</KV>
        <KV t={t} k="Trace id"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{call.responseHeaders?.['x-portkey-trace-id'] ?? '—'}</span></KV>
        <KV t={t} k="Response id"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{call.responseId ?? '—'}</span></KV>
        {call.error && <KV t={t} k="Error" top><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11, color: t.isLight ? shade(t.warn, 0.4) : t.warn }}>{call.error}</span></KV>}
      </Card>
      {call.kind === 'tamper' && <JwtAnatomy t={t} parts={call.tamper?.token} caption="The doctored credential that was sent" sub={call.tamper?.what} />}
      <CodeBlock t={t} title="Request headers" sub="the JWT is the API key" value={call.requestHeaders} defaultOpen />
      <CodeBlock t={t} title="Request body" sub={`POST ${call.url ?? '/chat/completions'}`} value={call.requestBody} />
      <CodeBlock t={t} title="Response headers" sub="from the gateway" value={call.responseHeaders} />
      <CodeBlock t={t} title="Response body" value={call.responseBody} />
      {call.usage && <CodeBlock t={t} title="Usage" value={call.usage} />}
      {call.hookResults && <CodeBlock t={t} title="Guardrail hook results" value={call.hookResults} />}
    </div>
  )
}
