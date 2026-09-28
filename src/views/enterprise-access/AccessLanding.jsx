import React, { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Fingerprint, Route, KeyRound, Building2, ShieldCheck, Github, AlertTriangle, KeySquare, Layers, Clock3, Wrench, ArrowUpRight, Loader2,
} from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { TelemetryLook, Stat } from '../../components/api-intercept/telemetry/primitives'
import { CopyCmd } from '../runtime-launch/LaunchModelPicker'
import { RouteDiagram } from './RouteDiagram'
import { PolicyPanel } from './PolicyPanel'
import { scenarios as buildScenarios } from './accessModel'

/**
 * AccessLanding — the pillar before anyone signs in. The standalone app's
 * sign-in page, carried over (headline, the four stages, the animated
 * request, the numbers, the policy) and rebuilt in the launch design. The
 * standalone's pre-flight card and author pill were dropped at the user's
 * request — the header already credits the author, and configuration only
 * needs saying when something is missing (the setup card). Every value is
 * read from the server's configuration, so the page cannot claim a key or a
 * config the portal does not have.
 */

const SOURCE_URL = 'https://github.com/sergeiudo/AI-Gateway-JWT-Demo'
const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

const STAGES = [
  { n: '01', icon: Fingerprint, title: 'Identity', text: 'Microsoft Entra ID authenticates the user and returns the app role.' },
  { n: '02', icon: Building2, title: 'Attributes', text: 'Department is read from Microsoft Graph; it is not a token claim.' },
  { n: '03', icon: KeyRound, title: 'Credential', text: 'A short-lived RS256 token is minted with the claims sealed inside.' },
  { n: '04', icon: ShieldCheck, title: 'Enforcement', text: 'The gateway verifies the signature, then routes on what it read.' },
]

// Entra accepts http:// only for localhost; anything else must be served over https.
const httpNotAllowed = () => window.location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(window.location.hostname)

/** What it takes to switch the pillar on — shown only while something is missing. */
function SetupCard({ t, config }) {
  const keyProblem = !config.key?.ok ? config.key?.error : config.key.pairMatches === false ? 'the private key and the JWKS are not one pair — every request would 401' : null
  return (
    <section className="rounded-3xl p-4" style={{ maxWidth: 760, background: `${t.warn}0f`, border: `1px solid ${t.warn}44` }}>
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${t.warn}22`, color: t.isLight ? shade(t.warn, 0.38) : t.warn }}>
          <Wrench size={14} aria-hidden="true" />
        </span>
        <span style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>Finish setting up this host</span>
      </div>
      <ol className="mt-2 space-y-2 pl-1" style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.inkDim }}>
        <li>1. Set the pillar's variables in <code style={{ fontFamily: FONT.mono }}>.env</code> — still missing here:
          <span className="block mt-1.5" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11, lineHeight: 1.6, color: t.ink }}>
            {config.missing.join(' · ') || '—'}
          </span>
          {keyProblem && config.missing.length === 0 && (
            <span className="block mt-1" style={{ color: t.isLight ? shade(t.warn, 0.4) : t.warn }}>Signing key: {keyProblem}</span>
          )}
          <span className="block mt-1">The key paths point at files outside this repo, never inside it.</span>
        </li>
        <li>2. In the Entra app registration, add this as a <b style={{ color: t.ink }}>Web</b> redirect URI, character for character:
          <CopyCmd t={t} cmd={config.entra.redirectUri} />
        </li>
        <li>3. Restart Express — <code style={{ fontFamily: FONT.mono }}>.env</code> is only read at start-up.</li>
        {httpNotAllowed() && (
          <li style={{ color: t.isLight ? shade(t.warn, 0.4) : t.warn }}>
            This host is served over plain http. Entra accepts <code style={{ fontFamily: FONT.mono }}>https://</code> redirect URIs only (or <code style={{ fontFamily: FONT.mono }}>http://localhost</code>), so sign-in cannot work here until the portal has a domain with TLS.
          </li>
        )}
      </ol>
    </section>
  )
}

/** The last sign-in attempt stopped somewhere — say where, in Microsoft's own words. */
function SignInError({ t, error, onOpenLifecycle }) {
  const ink = t.isLight ? shade(t.warn, 0.4) : t.warn
  return (
    <section className="flex items-start gap-3 rounded-3xl p-4" style={{ background: `${t.warn}10`, border: `1px solid ${t.warn}55` }}>
      <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 40, height: 40, background: bandBg(t.warn) }}>
        <AlertTriangle size={18} style={{ color: '#fff' }} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink }}>
          The last sign-in stopped at the {error.step} step{error.code ? <span style={{ fontFamily: FONT.mono, fontSize: 12, color: ink }}> · {error.code}</span> : null}
        </div>
        <p className="break-words" style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.inkDim, margin: '3px 0 0' }}>{error.message}</p>
        {error.hint && <p style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: ink, margin: '6px 0 0', fontWeight: 600 }}>{error.hint}</p>}
      </div>
      <button type="button" onClick={onOpenLifecycle}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 flex-shrink-0 ${focusCls}`}
              style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, background: t.panel, border: `1px solid ${t.hairline}` }}>
        What was captured <ArrowUpRight size={13} aria-hidden="true" />
      </button>
    </section>
  )
}

function StageCard({ t, tone, stage, index }) {
  const reduce = useReducedMotion()
  const [hot, setHot] = useState(false)
  const Icon = stage.icon
  const ink = t.isLight ? shade(tone, 0.25) : tone
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * index, duration: 0.3 }}
                onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
                className="rounded-3xl p-4 min-w-0"
                style={{
                  background: t.panel, border: `1px solid ${hot ? `${tone}55` : t.glassEdge}`,
                  boxShadow: hot ? `0 12px 26px ${tone}1f` : t.shadowSm, transform: hot ? 'translateY(-2px)' : 'none',
                  transition: 'transform 180ms ease, box-shadow 200ms ease, border-color 160ms ease',
                }}>
      <div className="flex items-center justify-between">
        <span className="grid place-items-center rounded-xl" style={{ width: 34, height: 34, background: bandBg(tone), boxShadow: hot ? `0 5px 12px ${tone}55` : 'none' }}>
          <Icon size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <span className="rounded-md px-1.5" style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 700, color: ink, background: `${tone}17` }}>{stage.n}</span>
      </div>
      <div style={{ fontFamily: FONT.display, fontSize: 15.5, fontWeight: 700, color: t.ink, marginTop: 12 }}>{stage.title}</div>
      <div style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.inkDim, marginTop: 3 }}>{stage.text}</div>
    </motion.div>
  )
}

export function SignInButton({ t, tone, configured, onClick, size = 'lg' }) {
  const [hot, setHot] = useState(false)
  const [going, setGoing] = useState(false)
  const lg = size === 'lg'
  return (
    <button type="button" disabled={!configured || going}
            onClick={() => { setGoing(true); onClick() }}
            onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            title={configured ? 'Sign in with your organisation account' : 'Finish setting up this host first — see the setup card'}
            className={`inline-flex items-center gap-2.5 rounded-full flex-shrink-0 disabled:cursor-not-allowed ${focusCls}`}
            style={{
              height: lg ? 48 : 38, padding: lg ? '0 22px 0 6px' : '0 16px 0 4px',
              fontFamily: FONT.display, fontSize: lg ? 15 : 13.5, fontWeight: 700,
              color: configured ? '#fff' : t.inkDim, background: configured ? bandBg(tone) : t.sunken,
              border: `1px solid ${configured ? 'transparent' : t.hairline}`,
              boxShadow: configured ? `0 10px 24px ${tone}${hot ? '66' : '44'}` : 'none',
              transform: hot && configured ? 'translateY(-1px)' : 'none', transition: 'box-shadow 180ms ease, transform 160ms ease',
            }}>
      <span className="grid place-items-center rounded-full flex-shrink-0" style={{ width: lg ? 36 : 30, height: lg ? 36 : 30, background: '#fff' }}>
        {going ? <Loader2 size={15} className="animate-spin" style={{ color: tone }} /> : <img src="/logo-entra.png" alt="" style={{ width: lg ? 20 : 17, height: lg ? 20 : 17 }} />}
      </span>
      {going ? 'Opening Microsoft…' : 'Sign in with Microsoft Entra ID'}
    </button>
  )
}

export function AccessLanding({ t, tone, a, onOpenLifecycle }) {
  const reduce = useReducedMotion()
  const c = a.config
  const ink = t.isLight ? shade(tone, 0.2) : tone
  if (!c) return null
  const people = buildScenarios(c)
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto px-6 pt-6 pb-10 space-y-8" style={{ maxWidth: 1240 }}>
        {a.session?.error && <SignInError t={t} error={a.session.error} onOpenLifecycle={onOpenLifecycle} />}

        {/* ── hero ── */}
        <div>
          <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="pt-3 min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full px-3" style={{ height: 28, background: t.panel, border: `1px solid ${t.glassEdge}`, boxShadow: t.shadowSm }}>
              <span className="rounded-full" style={{ width: 7, height: 7, background: c.configured ? t.pass : t.warn }} aria-hidden="true" />
              <span style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.inkDim }}>Enterprise AI Access · live demo</span>
            </span>
            <h2 style={{ fontFamily: FONT.display, fontSize: 46, fontWeight: 700, lineHeight: 1.06, letterSpacing: '-0.035em', color: t.ink, margin: '18px 0 0' }}>
              Real prompts, real models —<br />
              <span style={{ color: ink }}>routed by policy, not by trust.</span>
            </h2>
            {/* Same words as the pillar's description on the portal home (PILLARS in HomeViewV2), split for reading. */}
            {/* One wide paragraph, not two narrow ones — the hero has the full width since the pre-flight card went. */}
            <div style={{ fontFamily: FONT.prose, fontSize: 15, lineHeight: 1.65, color: t.inkDim, maxWidth: 1080, marginTop: 16 }}>
              <p style={{ margin: 0 }}>
                An enterprise app that lets employees use LLMs without ever holding an API key, and lets the organization decide which
                model each person may reach — enforced cryptographically, not in the browser. Users sign in with Microsoft Entra ID; the
                backend seals their app role and department into a short-lived RS256 JWT and sends it to the AI gateway as the API key.
                The gateway verifies the signature, trusts the claims, and routes.
              </p>
              <p style={{ margin: '10px 0 0', color: t.ink }}>
                Pick a model your role isn't allowed to use, and a different one answers. <b style={{ color: ink }}>That's the demo.</b>
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap mt-6">
              <SignInButton t={t} tone={tone} configured={c.configured} onClick={a.signIn} />
              <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer"
                 className={`inline-flex items-center gap-2 rounded-full px-5 ${focusCls}`}
                 style={{ height: 48, fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink, background: t.panel, border: `1px solid ${t.glassEdge}`, boxShadow: t.shadowSm }}>
                <Github size={16} aria-hidden="true" /> View the source
              </a>
            </div>
          </motion.div>
          {/* Only on a host that is not set up — otherwise the page would just grey out the sign-in button without saying why. */}
          {!c.configured && <div className="mt-6"><SetupCard t={t} config={c} /></div>}
        </div>

        {/* ── the four stages ── */}
        <section>
          <h3 style={{ fontFamily: FONT.display, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: t.ink, margin: 0 }}>A request, in running order</h3>
          <p style={{ fontFamily: FONT.prose, fontSize: 13, color: t.inkDim, margin: '3px 0 14px' }}>Every step runs for real on each prompt you send.</p>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
            {STAGES.map((s, i) => <StageCard key={s.n} t={t} tone={tone} stage={s} index={i} />)}
          </div>
        </section>

        {/* ── the request, animated ── */}
        <RouteDiagram t={t} tone={tone} config={c} mode="demo" scenarios={people} />

        {/* ── the numbers — every one derived from configuration ── */}
        <TelemetryLook.Provider value="launch">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
            <Stat t={t} icon={KeySquare} label="API keys issued" value="0" tone={ink} sub="the credential is minted per sign-in" />
            <Stat t={t} icon={Layers} label="Models reachable" value={c.models.length} sub={`through ${c.provider}`} />
            <Stat t={t} icon={Route} label="Routing rules" value={c.rules} sub="conditions + the default" />
            <Stat t={t} icon={Clock3} label="Credential life" value={`${c.credentialLifeMin} min`} sub="then sign in again" />
          </div>
        </TelemetryLook.Provider>

        <PolicyPanel t={t} tone={tone} config={c} />
      </div>
    </div>
  )
}
