import React from 'react'
import { motion } from 'framer-motion'
import { SIGNAL } from '../api-intercept-2027/tokens'

/**
 * ScanArchitecture — what an empty model-scanning console shows.
 *
 * Same treatment as the runtime pillar's SessionArchitecture: a hand-built SVG
 * on a forced-dark panel, crisp on a projector, and wired to live state rather
 * than drawn once. The source toggle lights the lane in use; a scanner that is
 * down or in stub mode greys the SDK node and stops the packets. A diagram
 * that disagrees with the controls is worse than none.
 *
 * The two lanes are genuinely different shapes, verified in the SDK source
 * (`model_security_client/api.py`): a Hugging Face scan sends only the URI and
 * AIRS reads the repo itself, while a local scan runs on this host and sends
 * file hashes and findings — never the artifact. Both then meet the same
 * security group, which is where the verdict is decided.
 */

const PINK  = '#EC4899' // AIRS — same colour it carries in the runtime diagrams
const SLATE = '#94A3B8'
const OFF   = '#64748B'
const HF    = '#FFD21E'
const LOCAL = SIGNAL.live
const PASS  = SIGNAL.pass
const BLOCK = SIGNAL.block
const WARN  = SIGNAL.warn
const MONO  = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const SANS  = 'Inter, ui-sans-serif, system-ui, sans-serif'

function Node({ cx, cy, w, h, title, sub, color, dashed, titleSize = 11.5 }) {
  return (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={9}
            fill={color} fillOpacity={dashed ? 0.05 : 0.11}
            stroke={color} strokeOpacity={dashed ? 0.45 : 0.65}
            strokeWidth={1.3} strokeDasharray={dashed ? '5 3' : undefined} />
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
}

function Packet({ path, color, dur, delay = 0, r = 3.5 }) {
  return (
    <circle r={r} fill={color}>
      <animateMotion path={path} dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;1;1;0" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
    </circle>
  )
}

const HF_IN    = 'M198,110 C250,110 250,178 266,180'
const LOCAL_IN = 'M198,262 C250,262 250,194 266,192'
const TO_AIRS  = 'M444,186 L496,186'
const TO_PASS  = 'M822,160 C862,160 866,120 896,120'
const TO_BLOCK = 'M822,212 C862,212 866,254 896,254'
const FETCH    = 'M560,86 C536,28 196,28 128,80'

function ScanFlowDiagram({ mode, ready }) {
  const hf = mode !== 'local'
  const sdk = ready ? SLATE : OFF
  const airs = ready ? PINK : OFF

  return (
    <div className="rounded-2xl p-4 overflow-x-auto"
         style={{
           background: 'radial-gradient(120% 130% at 50% 28%, #16182e 0%, #090c17 74%)',
           border: '1px solid rgba(255,255,255,0.10)',
         }}>
      <svg viewBox="0 0 1120 350" width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', minWidth: 760 }}>
        <defs>
          {[['msa-slate', SLATE], ['msa-pink', PINK], ['msa-off', OFF], ['msa-hf', HF], ['msa-local', LOCAL],
            ['msa-pass', PASS], ['msa-block', BLOCK]].map(([id, c]) => (
            <marker key={id} id={id} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
              <path d="M0,0 L6,3.5 L0,7 Z" fill={c} />
            </marker>
          ))}
          <radialGradient id="msa-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={PINK} stopOpacity={ready ? 0.28 : 0.08} />
            <stop offset="70%" stopColor={PINK} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── Everything before the verdict happens before anything loads the
               model — the envelope is drawn around that, and the outcomes sit
               outside it. ── */}
        <rect x={24} y={44} width={820} height={286} rx={14}
              fill={SLATE} fillOpacity={0.03} stroke={SLATE} strokeOpacity={0.22}
              strokeWidth={1.2} strokeDasharray="6 4" />
        <text x={40} y={34} fontFamily={SANS} fontSize={9.5} fontWeight={800} letterSpacing="1.3" fill={SLATE}>
          SUPPLY-CHAIN ENFORCEMENT · THE SCAN GATES THE FIRST LOAD
        </text>
        <text x={1096} y={34} textAnchor="end" fontFamily={MONO} fontSize={8.5} fill={SLATE} opacity={0.75}>
          {ready ? `source: ${hf ? 'hugging face' : 'local artifact'}` : 'scanner unavailable'}
        </text>

        <circle cx={660} cy={186} r={150} fill="url(#msa-glow)" />

        {/* ── sources ── */}
        <g fill="none" strokeLinecap="round">
          <path d={HF_IN} stroke={hf ? HF : OFF} strokeOpacity={hf ? 0.75 : 0.35} strokeWidth={2}
                strokeDasharray={hf ? undefined : '4 3'} markerEnd={`url(#${hf ? 'msa-hf' : 'msa-off'})`} />
          <path d={LOCAL_IN} stroke={!hf ? LOCAL : OFF} strokeOpacity={!hf ? 0.75 : 0.35} strokeWidth={2}
                strokeDasharray={!hf ? undefined : '4 3'} markerEnd={`url(#${!hf ? 'msa-local' : 'msa-off'})`} />
          <path d={TO_AIRS} stroke={airs} strokeOpacity={0.75} strokeWidth={2.2}
                markerEnd={`url(#${ready ? 'msa-pink' : 'msa-off'})`} />
        </g>

        <Node cx={118} cy={110} w={160} h={56} title="HUGGING FACE" sub="repo · by URI"
              color={hf ? HF : OFF} dashed={!hf} />
        <Node cx={118} cy={262} w={160} h={56} title="LOCAL ARTIFACT" sub="uploaded to this app"
              color={!hf ? LOCAL : OFF} dashed={hf} />
        <Node cx={356} cy={186} w={176} h={60}
              title={ready ? 'MODEL SECURITY SDK' : 'SCANNER DOWN'}
              sub={ready ? 'this app · scanner :8001' : 'see the library panel'}
              color={sdk} dashed={!ready} />

        {/* where the bytes are read — the one thing the two lanes differ on */}
        {hf ? (
          <g opacity={ready ? 1 : 0.35}>
            <path d={FETCH} fill="none" stroke={HF} strokeOpacity={0.55} strokeWidth={1.6}
                  strokeDasharray="4 3" markerEnd="url(#msa-hf)" />
            {ready && <Packet path={FETCH} color={HF} dur={3.2} delay={1.4} r={2.8} />}
            <text x={345} y={60} textAnchor="middle" fontFamily={MONO} fontSize={8.5} fontWeight={700} fill={HF} opacity={0.9}>
              AIRS reads the repo itself
            </text>
            <text x={345} y={72} textAnchor="middle" fontFamily={SANS} fontSize={8} fill={SLATE} opacity={0.8}>
              only the URI leaves this app · nothing is downloaded here
            </text>
          </g>
        ) : (
          <g opacity={ready ? 1 : 0.35}>
            <text x={356} y={234} textAnchor="middle" fontFamily={MONO} fontSize={8.5} fontWeight={700} fill={LOCAL}>
              scanned on this host
            </text>
            <text x={356} y={246} textAnchor="middle" fontFamily={SANS} fontSize={8} fill={SLATE} opacity={0.8}>
              only file hashes and findings leave · the artifact does not
            </text>
          </g>
        )}

        {ready && <Packet path={`${hf ? HF_IN : LOCAL_IN} L444,186 L496,186`} color={hf ? HF : LOCAL} dur={3} r={3.5} />}

        {/* ── the enforcement point ── */}
        <g opacity={ready ? 1 : 0.4}>
          <rect x={500} y={86} width={320} height={200} rx={13}
                fill={airs} fillOpacity={0.07} stroke={airs} strokeOpacity={ready ? 0.55 : 0.3}
                strokeWidth={1.3} strokeDasharray={ready ? undefined : '5 3'} />
          <circle cx={816} cy={90} r={4.5} fill={ready ? WARN : OFF} />
          <text x={660} y={112} textAnchor="middle" fontFamily={MONO} fontSize={12} fontWeight={700} fill={airs}>
            PRISMA AIRS · MODEL SECURITY
          </text>
          <text x={660} y={127} textAnchor="middle" fontFamily={SANS} fontSize={8.5} fill={SLATE} opacity={0.85}>
            api.sase.paloaltonetworks.com/aims
          </text>
          <line x1={528} y1={140} x2={792} y2={140} stroke={SLATE} strokeOpacity={0.18} />
          <text x={660} y={156} textAnchor="middle" fontFamily={SANS} fontSize={8.5} fontWeight={800} letterSpacing="1.1" fill={SLATE}>
            SECURITY GROUP · EVERY RULE, EVERY FILE
          </text>
          <text x={580} y={176} textAnchor="middle" fontFamily={SANS} fontSize={9} fontWeight={800} letterSpacing="1" fill={ready ? BLOCK : OFF}>THREATS</text>
          <text x={740} y={176} textAnchor="middle" fontFamily={SANS} fontSize={9} fontWeight={800} letterSpacing="1" fill={ready ? WARN : OFF}>POLICY</text>
          {['code exec on load', 'runtime code exec', 'suspicious components'].map((k, i) => (
            <text key={k} x={580} y={197 + i * 19} textAnchor="middle" fontFamily={MONO} fontSize={9.5} fill={airs} opacity={0.9}>{k}</text>
          ))}
          {['license', 'verified publisher', 'approved format'].map((k, i) => (
            <text key={k} x={740} y={197 + i * 19} textAnchor="middle" fontFamily={MONO} fontSize={9.5} fill={airs} opacity={0.9}>{k}</text>
          ))}
          <text x={660} y={272} textAnchor="middle" fontFamily={SANS} fontSize={8} fill={SLATE} opacity={0.65}>
            any BLOCKING rule that fails blocks the model
          </text>
        </g>

        {/* ── outcomes, outside the envelope ── */}
        <g fill="none" strokeLinecap="round" opacity={ready ? 1 : 0.3}>
          <path d={TO_PASS} stroke={PASS} strokeOpacity={0.75} strokeWidth={2} markerEnd="url(#msa-pass)" />
          <path d={TO_BLOCK} stroke={BLOCK} strokeOpacity={0.8} strokeWidth={2} strokeDasharray="5 3" markerEnd="url(#msa-block)" />
        </g>
        {ready && (
          <>
            <Packet path={TO_PASS} color={PASS} dur={2.6} delay={2.2} r={3} />
            <Packet path={TO_BLOCK} color={BLOCK} dur={2.6} delay={3.5} r={3} />
          </>
        )}
        <text x={862} y={108} textAnchor="middle" fontFamily={MONO} fontSize={8.5} fontWeight={700} fill={PASS} opacity={0.9}>all rules pass</text>
        <text x={858} y={276} textAnchor="middle" fontFamily={MONO} fontSize={8.5} fontWeight={700} fill={BLOCK} opacity={0.9}>a rule fails</text>

        <Node cx={990} cy={120} w={180} h={58} title="ALLOWED" sub="safe to load · deploy" color={PASS} titleSize={12.5} />
        <Node cx={990} cy={254} w={180} h={58} title="BLOCKED" sub="never loaded" color={BLOCK} titleSize={12.5} />
        <text x={990} y={302} textAnchor="middle" fontFamily={MONO} fontSize={8.5} fontWeight={700} fill={BLOCK}>
          verdict before load_model()
        </text>
        <text x={990} y={314} textAnchor="middle" fontFamily={SANS} fontSize={8} fill={SLATE} opacity={0.85}>
          a load-time payload never gets to run
        </text>
      </svg>
    </div>
  )
}

/**
 * Why the gate sits before the load, in the three terms an audience weighs.
 * The runtime pillar's ShortCircuitNote, translated: there the model is never
 * called; here the model is never loaded.
 */
const GATE = [
  ['Security',   'a pickle or Keras payload executes the moment the model is loaded — the check has to come first'],
  ['Governance', 'license, publisher and file-format rules are enforced by the security group, not left to review'],
  ['Evidence',   'every verdict is a scan record in Strata Cloud Manager, down to the file, hash and rule that fired'],
]

function GateNote({ t }) {
  return (
    <div style={{
      marginTop: 10, padding: '10px 13px', borderRadius: 14,
      background: `${BLOCK}0f`, border: `1px solid ${BLOCK}33`,
    }}>
      <p style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', color: BLOCK, marginBottom: 6 }}>
        ON A BLOCK, THE MODEL IS NEVER LOADED
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px' }}>
        {GATE.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 240, flex: '1 1 240px' }}>
            <span style={{
              fontFamily: SANS, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: t.ink, whiteSpace: 'nowrap',
            }}>{k}</span>
            <span style={{ fontFamily: SANS, fontSize: 10.5, lineHeight: 1.45, color: t.inkDim }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ScanArchitecture({ t, mode, ready }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
                className="w-full px-4 pt-1 pb-4">
      <p style={{ fontFamily: SANS, fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', color: PINK, marginBottom: 6 }}>
        MODEL SECURITY · SCAN ARCHITECTURE
      </p>
      <ScanFlowDiagram mode={mode} ready={ready} />
      <GateNote t={t} />
      <p style={{ fontFamily: SANS, fontSize: 10.5, color: t.inkFaint, marginTop: 8 }}>
        Pick a model from the library, or enter a Hugging Face repo below — this diagram collapses to the
        live scan line as soon as the session has a record.
      </p>
    </motion.div>
  )
}
