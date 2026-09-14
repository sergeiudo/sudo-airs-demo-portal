import React from 'react'
import { motion } from 'framer-motion'
import { AigwFlowDiagram } from '../../components/api-intercept/AigwFlowDiagram'
import { SIGNAL } from './tokens'

/**
 * SessionArchitecture — what an empty console shows.
 *
 * The room cannot follow a verdict without first seeing where the verdict comes
 * from, and the two enforcement architectures in this pillar are genuinely
 * different shapes: the SCM AI-GW lane has the guardrail *inside* the gateway,
 * the other three call the AIRS Runtime API from this app and reach the
 * provider directly. One picture cannot honestly describe both, so each backend
 * opens on its own.
 *
 * The AI-GW diagram is the existing one (`AigwFlowDiagram`) rather than a copy —
 * it is already wired to the live toggles and re-drawing it here would give the
 * pillar two versions of the same architecture to keep in sync.
 *
 * Both are hand-built SVG on a forced-dark panel so they stay crisp on a
 * projector, and both react to the switches: turn AIRS off and the scan nodes
 * go grey, dashed and BYPASSED. A diagram that disagrees with the toggles is
 * worse than no diagram.
 */

const PINK  = '#EC4899' // AIRS
const SLATE = '#94A3B8'
const OFF   = '#64748B'
const BLOCK = SIGNAL.block // vermilion — interception, the console's one loud colour
const MONO  = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const SANS  = 'Inter, ui-sans-serif, system-ui, sans-serif'

const PROVIDER = {
  vertex:  { name: 'Google Vertex AI', short: 'VERTEX AI', accent: '#4285F4', where: 'GCP · sergei-playground-338006' },
  bedrock: { name: 'AWS Bedrock',      short: 'BEDROCK',   accent: '#FF9900', where: 'AWS · us-west-2' },
  azure:   { name: 'Azure OpenAI',     short: 'AZURE',     accent: '#4CC2FF', where: 'Azure AI Foundry' },
}

/** The API-layer architecture: two out-of-band scans around one direct call. */
function ApiLayerFlowDiagram({ isProtected, backend, model }) {
  const p = PROVIDER[backend] ?? PROVIDER.bedrock
  const airs = isProtected ? PINK : OFF
  const modelShort = String(model || '').split('/').pop() || 'model'

  const Node = ({ cx, cy, w, h, title, sub, color, dashed, titleSize = 11.5 }) => (
    <g>
      <rect
        x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={9}
        fill={color} fillOpacity={0.11}
        stroke={color} strokeOpacity={dashed ? 0.45 : 0.65}
        strokeWidth={1.3} strokeDasharray={dashed ? '5 3' : undefined}
      />
      <text x={cx} y={sub ? cy - 1 : cy + titleSize / 3} textAnchor="middle"
            fontFamily={MONO} fontSize={titleSize} fontWeight={700} fill={color}>
        {title}
      </text>
      {sub && (
        <text x={cx} y={cy + 12} textAnchor="middle" fontFamily={SANS} fontSize={8.5} fill={SLATE} opacity={0.85}>
          {sub}
        </text>
      )}
    </g>
  )

  const Packet = ({ path, color, dur, delay = 0, r = 3.5 }) => (
    <circle r={r} fill={color}>
      <animateMotion path={path} dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;1;1;0" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
    </circle>
  )

  return (
    <div
      className="rounded-2xl p-4 overflow-x-auto"
      style={{
        background: 'radial-gradient(120% 130% at 50% 28%, #16182e 0%, #090c17 74%)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      <svg viewBox="0 0 1120 380" width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', minWidth: 760 }}>
        <defs>
          <radialGradient id="alf-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={p.accent} stopOpacity="0.4" />
            <stop offset="70%" stopColor={p.accent} stopOpacity="0" />
          </radialGradient>
          {[['alf-slate', SLATE], ['alf-pink', PINK], ['alf-off', OFF], ['alf-prov', p.accent], ['alf-block', BLOCK]].map(([id, c]) => (
            <marker key={id} id={id} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
              <path d="M0,0 L6,3.5 L0,7 Z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* ── This app orchestrates the sequence; AIRS and the provider are both
               services it calls out to. That is the whole difference from the
               gateway lane, so the envelope is drawn around the app, not around
               the enforcement. ── */}
        <rect x={24} y={48} width={1072} height={112} rx={14}
              fill={SLATE} fillOpacity={0.03} stroke={SLATE} strokeOpacity={0.22}
              strokeWidth={1.2} strokeDasharray="6 4" />
        <text x={40} y={38} fontFamily={SANS} fontSize={9.5} fontWeight={800} letterSpacing="1.3" fill={SLATE}>
          API-LAYER ENFORCEMENT · THIS APP ORCHESTRATES EVERY CALL
        </text>
        <text x={1080} y={38} textAnchor="end" fontFamily={MONO} fontSize={8.5} fill={SLATE} opacity={0.75}>
          {isProtected ? 'profile: AIRS_PROFILE_NAME' : 'AIRS scan skipped'}
        </text>

        {/* model glow */}
        <circle cx={575} cy={104} r={92} fill="url(#alf-glow)" />

        {/* ── the chat path ── */}
        <g fill="none" strokeLinecap="round">
          <path d="M162,104 L226,104" stroke={SLATE} strokeOpacity={0.55} strokeWidth={2} markerEnd="url(#alf-slate)" />
          <path d="M414,104 L470,104" stroke={airs} strokeOpacity={0.75} strokeWidth={2.2}
                markerEnd={`url(#${isProtected ? 'alf-pink' : 'alf-off'})`} />
          <path d="M680,104 L746,104" stroke={p.accent} strokeOpacity={0.75} strokeWidth={2.2} markerEnd="url(#alf-prov)" />
          <path d="M934,104 L974,104" stroke={airs} strokeOpacity={0.75} strokeWidth={2.2}
                markerEnd={`url(#${isProtected ? 'alf-pink' : 'alf-off'})`} />
        </g>

        <Packet path="M162,104 L1040,104" color={isProtected ? PINK : '#F59E0B'} dur={4.2} r={4} />

        <Node cx={92}  cy={104} w={140} h={54} title="CLIENT" sub="attack library · chat" color={SLATE} />
        <Node cx={320} cy={104} w={188} h={54}
              title={isProtected ? 'AIRS · SCAN' : 'BYPASSED'}
              sub={isProtected ? 'prompt, before the model' : 'nothing inspected'}
              color={airs} dashed={!isProtected} />
        <Node cx={575} cy={104} w={210} h={58} title={p.short} sub={modelShort} color={p.accent} titleSize={12.5} />
        <Node cx={840} cy={104} w={188} h={54}
              title={isProtected ? 'AIRS · SCAN' : 'BYPASSED'}
              sub={isProtected ? 'answer, before the user' : 'nothing inspected'}
              color={airs} dashed={!isProtected} />
        <Node cx={1040} cy={104} w={130} h={54} title="ANSWER" sub="to the user" color={SLATE} />

        <text x={575} y={148} textAnchor="middle" fontFamily={MONO} fontSize={8.5} fill={SLATE} opacity={0.7}>
          {p.where} · direct SDK call, no proxy
        </text>

        {/* ── The short circuit: on a block this app returns the verdict and
               never reaches step 2. `server.js` returns before the provider
               call, so the arc is the code, not an idealisation. ── */}
        {isProtected && (
          <g>
            <text x={442} y={70} textAnchor="middle" fontFamily={MONO} fontSize={7.5} fontWeight={700} fill={SLATE} opacity={0.8}>
              only if clean
            </text>
            <path d="M252,133 C248,186 136,186 132,133" fill="none" strokeLinecap="round"
                  stroke={BLOCK} strokeOpacity={0.8} strokeWidth={2} strokeDasharray="5 3"
                  markerEnd="url(#alf-block)" />
            <Packet path="M252,133 C248,186 136,186 132,133" color={BLOCK} dur={5} delay={2.4} r={3} />
            <text x={192} y={196} textAnchor="middle" fontFamily={MONO} fontSize={8.5} fontWeight={700} fill={BLOCK}>
              BLOCKED → straight back
            </text>
            <text x={192} y={207} textAnchor="middle" fontFamily={SANS} fontSize={8} fill={SLATE} opacity={0.85}>
              {p.short} is never called · no tokens spent
            </text>
          </g>
        )}

        {/* ── both scans are the same service, called twice out of band ── */}
        <g fill="none" strokeLinecap="round" opacity={isProtected ? 1 : 0.22}>
          <path d="M320,131 C320,196 372,214 452,246" stroke={airs} strokeOpacity={0.5} strokeWidth={1.8}
                strokeDasharray="4 3" markerEnd={`url(#${isProtected ? 'alf-pink' : 'alf-off'})`} />
          <path d="M840,131 C840,196 788,214 708,246" stroke={airs} strokeOpacity={0.5} strokeWidth={1.8}
                strokeDasharray="4 3" markerEnd={`url(#${isProtected ? 'alf-pink' : 'alf-off'})`} />
        </g>

        {isProtected && (
          <>
            <Packet path="M320,131 C320,196 372,214 452,246" color={PINK} dur={2.4} r={3} />
            <Packet path="M840,131 C840,196 788,214 708,246" color={PINK} dur={2.4} delay={1.2} r={3} />
          </>
        )}

        <g opacity={isProtected ? 1 : 0.3}>
          <rect x={330} y={250} width={500} height={96} rx={13}
                fill={airs} fillOpacity={0.07} stroke={airs} strokeOpacity={isProtected ? 0.5 : 0.3}
                strokeWidth={1.3} strokeDasharray={isProtected ? undefined : '5 3'} />
          <text x={580} y={276} textAnchor="middle" fontFamily={MONO} fontSize={12} fontWeight={700} fill={airs}>
            PRISMA AIRS · RUNTIME API
          </text>
          <text x={580} y={293} textAnchor="middle" fontFamily={SANS} fontSize={8.5} fill={SLATE} opacity={0.85}>
            service.api.aisecurity.paloaltonetworks.com
          </text>
          {[['injection', 372], ['PII / DLP', 458], ['toxic', 536], ['malicious URL', 618], ['code', 706], ['agent', 772]]
            .map(([k, x]) => (
              <text key={k} x={x} y={322} textAnchor="middle" fontFamily={MONO} fontSize={8.5}
                    fill={isProtected ? PINK : OFF} opacity={0.8}>
                {k}
              </text>
            ))}
          <text x={580} y={338} textAnchor="middle" fontFamily={SANS} fontSize={8} fill={SLATE} opacity={0.6}>
            {isProtected
              ? 'one profile, two calls — the provider never sees the scan'
              : 'AIRS is off: the payload reaches the model unread'}
          </text>
        </g>
      </svg>
    </div>
  )
}

/**
 * The heading and the explanatory paragraph that used to sit here are gone: the
 * diagram is labelled well enough to carry itself, and four lines of prose above
 * it pushed the architecture — the thing the room is meant to look at — down the
 * panel. Only the section eyebrow survives. Anything that genuinely needs saying
 * belongs on the diagram or in the short-circuit strip below it.
 */
const AIGW_EYEBROW = 'SCM AI-GW · SESSION ARCHITECTURE'

/**
 * Why short-circuiting matters, in the three terms an audience actually weighs.
 * Stated once here rather than on both diagrams, because it is a property of
 * the enforcement model, not of either topology.
 */
const SHORT_CIRCUIT = [
  ['Performance', 'no round trip to a model that was never going to be allowed to answer'],
  ['Security',    'the payload never reaches the model, so it cannot be manipulated by it'],
  ['Cost',        'a blocked request consumes no provider tokens'],
]

function ShortCircuitNote({ t, isProtected }) {
  return (
    <div style={{
      marginTop: 10, padding: '10px 13px', borderRadius: 14,
      background: isProtected ? `${SIGNAL.block}0f` : t.sunken,
      border: `1px solid ${isProtected ? `${SIGNAL.block}33` : t.hairline}`,
    }}>
      <p style={{
        fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
        color: isProtected ? SIGNAL.block : t.inkFaint, marginBottom: 6,
      }}>
        {isProtected
          ? 'ON A BLOCK, THE REQUEST STOPS HERE'
          : 'AIRS IS OFF — NOTHING IS INTERCEPTED. WITH PROTECTION ON:'}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px' }}>
        {SHORT_CIRCUIT.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 240, flex: '1 1 240px' }}>
            <span style={{
              fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10, fontWeight: 800,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color: isProtected ? t.ink : t.inkFaint, whiteSpace: 'nowrap',
            }}>
              {k}
            </span>
            <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10.5, lineHeight: 1.45, color: t.inkDim }}>
              {v}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SessionArchitecture({ t, backend, model, isProtected, mcpEnabled }) {
  const isAigw = backend === 'aigw'
  const p = PROVIDER[backend] ?? PROVIDER.bedrock
  const accent = isAigw ? PINK : p.accent

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full px-4 pt-1 pb-4"
    >
      <p style={{
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10, fontWeight: 900,
        letterSpacing: '0.14em', color: accent, marginBottom: 6,
      }}>
        {isAigw ? AIGW_EYEBROW : `${p.name.toUpperCase()} · SESSION ARCHITECTURE`}
      </p>

      {isAigw
        ? <AigwFlowDiagram isProtected={isProtected} mcpEnabled={mcpEnabled} model={model} />
        : <ApiLayerFlowDiagram isProtected={isProtected} backend={backend} model={model} />}

      <ShortCircuitNote t={t} isProtected={isProtected} />

      <p style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10.5, color: t.inkFaint, marginTop: 8 }}>
        Fire a payload from the attack library, or type one below — this diagram collapses to the live
        intercept line as soon as the session has a record.
      </p>
    </motion.div>
  )
}
