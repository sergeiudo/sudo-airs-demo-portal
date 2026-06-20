import React from 'react'
import { ShieldOff, Shield, ShieldCheck, ArrowRight, Layers, Columns3, Eye } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

const ACCENT = '#ec4899'

// The three flows, in narrative order. Each renders as a card with a mini
// pipeline diagram, what it catches, and what it misses.
const FLOWS = [
  {
    id: 'no-gateway',
    icon: ShieldOff,
    color: '#f59e0b',
    title: '1 · No gateway',
    subtitle: 'Raw, unprotected',
    pipeline: ['prompt', 'model', 'response'],
    blurb: 'The app calls the model directly. Nothing inspects the request or the response.',
    catches: [],
    misses: ['Everything — no inspection at all'],
  },
  {
    id: 'defaults',
    icon: Shield,
    color: '#0ea5e9',
    title: '2 · Portkey + native guardrails',
    subtitle: 'Business & data policy',
    pipeline: ['prompt', 'AI GW', 'model', 'AI GW', 'response'],
    blurb: 'Traffic routes through the Portkey gateway. Native guardrails enforce org policy on every call.',
    catches: ['PII (detect & redact)', 'Banned / competitor terms', 'Custom word & format rules'],
    misses: ['Prompt injection', 'Jailbreaks', 'Harmful content'],
  },
  {
    id: 'airs',
    icon: ShieldCheck,
    color: ACCENT,
    title: '3 · Portkey + Prisma AIRS',
    subtitle: 'Full AI-native protection',
    pipeline: ['prompt', 'AIRS', 'model', 'AIRS', 'response'],
    blurb: 'The gateway adds the Prisma AIRS guardrail — purpose-built to detect attacks on the model itself.',
    catches: ['Prompt injection', 'Jailbreaks (DAN, roleplay)', 'Harmful / dangerous content', 'Sensitive-data exposure', '+ everything above'],
    misses: [],
  },
]

function Pipeline({ steps, color, isLight }) {
  const stepBg = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)'
  const stepFg = isLight ? '#0f172a' : '#e2e8f0'
  const scanWords = ['scan', 'AIRS', 'AI GW']
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => {
        const isScan = scanWords.includes(s)
        return (
          <React.Fragment key={i}>
            <span className="px-2 py-1 rounded-md text-[10px] font-mono font-semibold"
                  style={{
                    background: isScan ? `${color}1f` : stepBg,
                    color: isScan ? color : stepFg,
                    border: isScan ? `1px solid ${color}55` : '1px solid transparent',
                  }}>
              {s}
            </span>
            {i < steps.length - 1 && <ArrowRight size={11} style={{ color: isLight ? '#94a3b8' : '#64748b' }} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function FlowCard({ flow, isLight }) {
  const Icon = flow.icon
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl"
         style={{
           background: isLight ? '#ffffff' : 'rgba(15,20,35,0.55)',
           border: `1px solid ${flow.color}44`,
           boxShadow: isLight ? '0 4px 16px rgba(0,48,135,0.06)' : 'none',
         }}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: `${flow.color}1a`, border: `1px solid ${flow.color}55` }}>
          <Icon size={16} style={{ color: flow.color }} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-bold" style={{ color: textPrimary }}>{flow.title}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: flow.color }}>{flow.subtitle}</span>
        </div>
      </div>

      <Pipeline steps={flow.pipeline} color={flow.color} isLight={isLight} />

      <p className="text-[12px] leading-relaxed" style={{ color: textSecondary }}>{flow.blurb}</p>

      {flow.catches.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#10b981' }}>Catches</span>
          {flow.catches.map(c => (
            <div key={c} className="flex items-start gap-1.5 text-[11px]" style={{ color: textPrimary }}>
              <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span>{c}
            </div>
          ))}
        </div>
      )}

      {flow.misses.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#ef4444' }}>Misses</span>
          {flow.misses.map(m => (
            <div key={m} className="flex items-start gap-1.5 text-[11px]" style={{ color: textSecondary }}>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>✕</span>{m}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LegendRow({ icon: Icon, title, children, isLight }) {
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
           style={{ background: `${ACCENT}14`, border: `1px solid ${ACCENT}40` }}>
        <Icon size={13} style={{ color: ACCENT }} />
      </div>
      <div className="flex flex-col">
        <span className="text-[12px] font-semibold" style={{ color: textPrimary }}>{title}</span>
        <span className="text-[11px] leading-relaxed" style={{ color: textSecondary }}>{children}</span>
      </div>
    </div>
  )
}

// Architecture diagram: one prompt fans into three lanes, each passing (or not)
// through an input-scan checkpoint, the shared model, and an output-scan checkpoint,
// then on to its response. The ONLY thing that differs between lanes is the
// inspector in the middle. Hand-built SVG so it stays crisp, scales, and adapts
// to light/dark (unlike a static raster). Colours match the flow cards below.
function FlowArchitectureDiagram() {
  // Rendered on a forced-dark panel (in both app themes) so the neon connectors
  // and the model glow pop — a deliberate hero treatment.
  const textPrimary = '#e2e8f0'
  const textSecondary = '#94a3b8'
  const boxFill = 'rgba(255,255,255,0.05)'
  const boxStroke = 'rgba(255,255,255,0.18)'
  const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace'
  const sans = 'Inter, ui-sans-serif, system-ui, sans-serif'

  const lanes = [
    { y: 80,  color: '#94a3b8', num: '1', name: 'NO GATEWAY',     sub: 'DIRECT PASS',      guard: null,    marker: 'fad-arrGray' },
    { y: 150, color: '#0ea5e9', num: '2', name: 'PORTKEY NATIVE', sub: 'AI GW INSPECTION', guard: 'AI GW', marker: 'fad-arrBlue' },
    { y: 222, color: '#ec4899', num: '3', name: 'AIRS + PORTKEY', sub: 'AIRS INSPECTION',  guard: 'AIRS',  marker: 'fad-arrPink' },
  ]

  // Rounded box + centred label. `color` set → tinted (guardrail) box; otherwise a
  // solid neutral box (prompt / model / response).
  const Box = ({ cx, cy, w = 104, h = 32, label, fill, stroke, color, dashed, fontSize = 11 }) => (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={8}
            fill={fill} fillOpacity={color ? 0.12 : 1} stroke={stroke}
            strokeOpacity={color ? 0.6 : 1} strokeDasharray={dashed ? '4 3' : undefined} strokeWidth={1.25} />
      <text x={cx} y={cy + fontSize / 3} textAnchor="middle" fontFamily={mono}
            fontSize={fontSize} fontWeight={700} fill={color || textPrimary}>{label}</text>
    </g>
  )

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2 overflow-x-auto"
         style={{ background: 'radial-gradient(115% 130% at 50% 32%, #141b33 0%, #090d1a 72%)', border: '1px solid rgba(255,255,255,0.10)' }}>
      <svg viewBox="0 0 1040 290" width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', minWidth: 720 }}>
        <defs>
          <radialGradient id="fad-modelGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
            <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fad-modelFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          {[['fad-arrGray', '#94a3b8'], ['fad-arrBlue', '#0ea5e9'], ['fad-arrPink', '#ec4899']].map(([id, c]) => (
            <marker key={id} id={id} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
              <path d="M0,0 L6,3.5 L0,7 Z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* column headers */}
        <text x={398} y={26} textAnchor="middle" fontFamily={sans} fontSize={10} fontWeight={700} letterSpacing="1.2" fill={textSecondary}>INPUT SCAN</text>
        <text x={702} y={26} textAnchor="middle" fontFamily={sans} fontSize={10} fontWeight={700} letterSpacing="1.2" fill={textSecondary}>OUTPUT SCAN</text>

        {/* connectors (drawn under the boxes) */}
        {lanes.map(l => (
          <g key={`c-${l.num}`} fill="none" strokeLinecap="round">
            <path d={`M148,150 C300,150 290,${l.y} 346,${l.y}`} stroke={l.color} strokeOpacity={0.4} strokeWidth={2} />
            <path d={`M450,${l.y} C482,${l.y} 472,150 502,150`} stroke={l.color} strokeOpacity={0.85} strokeWidth={2.4} />
            <path d={`M588,150 C616,150 606,${l.y} 650,${l.y}`} stroke={l.color} strokeOpacity={0.85} strokeWidth={2.4} />
            <path d={`M754,${l.y} L850,${l.y}`} stroke={l.color} strokeOpacity={0.9} strokeWidth={2.4} markerEnd={`url(#${l.marker})`} />
          </g>
        ))}

        {/* model: glow + node */}
        <circle cx={545} cy={150} r={74} fill="url(#fad-modelGlow)" />
        <rect x={506} y={128} width={84} height={44} rx={10} fill="#ec4899" fillOpacity={0.20} />
        <rect x={502} y={124} width={84} height={44} rx={10} fill="url(#fad-modelFill)" fillOpacity={0.30} stroke="#8b5cf6" strokeOpacity={0.85} strokeWidth={1.4} />
        <text x={544} y={150} textAnchor="middle" fontFamily={mono} fontSize={10.5} fontWeight={700} fill={textPrimary}>AI MODEL</text>

        {/* "response generation" pill under the model */}
        <rect x={471} y={244} width={148} height={22} rx={6} fill={boxFill} stroke={boxStroke} strokeWidth={1} />
        <text x={545} y={258} textAnchor="middle" fontFamily={sans} fontSize={8.5} fontWeight={700} letterSpacing="0.6" fill={textSecondary}>RESPONSE GENERATION</text>

        {/* prompt node (shared, centred) */}
        <rect x={44} y={132} width={104} height={36} rx={9} fill={boxFill} stroke={boxStroke} strokeWidth={1.25} />
        <text x={96} y={154} textAnchor="middle" fontFamily={mono} fontSize={11} fontWeight={700} fill={textPrimary}>PROMPT</text>

        {/* per-lane: label, input checkpoint, output checkpoint, response */}
        {lanes.map(l => {
          const gFill = l.guard ? l.color : 'none'
          const gStroke = l.guard ? l.color : boxStroke
          const gColor = l.guard ? l.color : textSecondary
          return (
            <g key={`l-${l.num}`}>
              <text x={164} y={l.y - 2} fontFamily={sans} fontSize={11} fontWeight={700} fill={textPrimary}>
                <tspan fill={l.color} fontWeight={800}>{l.num}.</tspan> {l.name}
              </text>
              <text x={178} y={l.y + 11} fontFamily={sans} fontSize={8.5} letterSpacing="0.3" fill={textSecondary}>({l.sub})</text>

              <Box cx={398} cy={l.y} label={l.guard || 'no check'} fill={gFill} stroke={gStroke} color={gColor} dashed={!l.guard} fontSize={l.guard ? 11 : 10} />
              <Box cx={702} cy={l.y} label={l.guard || 'no check'} fill={gFill} stroke={gStroke} color={gColor} dashed={!l.guard} fontSize={l.guard ? 11 : 10} />
              <Box cx={906} cy={l.y} w={112} h={34} label="RESPONSE" fill={boxFill} stroke={boxStroke} fontSize={10.5} />
            </g>
          )
        })}
      </svg>

      <div className="text-[11px] italic px-1" style={{ color: textSecondary }}>
        Same prompt, same model — the only thing that changes is what inspects the traffic in the middle.
      </div>
    </div>
  )
}

export function OverviewTab() {
  const { state } = useAppContext()
  const isLight = !state.isDark
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-8">

        {/* Hero */}
        <div className="flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-wider font-bold" style={{ color: ACCENT }}>Overview</div>
          <h2 className="text-2xl font-bold" style={{ color: textPrimary }}>Securing AI traffic with an LLM gateway</h2>
          <p className="text-[13px] leading-relaxed max-w-3xl" style={{ color: textSecondary }}>
            An <strong style={{ color: textPrimary }}>AI/LLM gateway</strong> is a single control point that every
            model call passes through. Instead of each app talking to a model directly, traffic routes through the
            gateway — where <strong style={{ color: textPrimary }}>guardrails</strong> inspect each request before it
            reaches the model and each response before it returns. This demo walks the same prompt through three
            levels of protection so you can see exactly what each layer adds.
          </p>
        </div>

        {/* All three flows at a glance — unified comparison diagram */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold" style={{ color: ACCENT }}>
            <Columns3 size={13} /> All three flows at a glance
          </div>
          <FlowArchitectureDiagram />
        </div>

        {/* The 3 flows */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold" style={{ color: ACCENT }}>
            <Layers size={13} /> The three flows
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {FLOWS.map(f => <FlowCard key={f.id} flow={f} isLight={isLight} />)}
          </div>
        </div>

        {/* How to read the demo */}
        <div className="flex flex-col gap-4 p-6 rounded-2xl"
             style={{ background: isLight ? 'rgba(236,72,153,0.04)' : 'rgba(236,72,153,0.06)', border: `1px solid ${ACCENT}33` }}>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold" style={{ color: ACCENT }}>
            <Eye size={13} /> How to read the demo
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            <LegendRow icon={Columns3} title="Three lanes, one prompt" isLight={isLight}>
              Each scenario fires the same prompt through all three flows side by side so the difference is obvious.
            </LegendRow>
            <LegendRow icon={ShieldCheck} title="Verdicts" isLight={isLight}>
              <span style={{ color: '#f97316', fontWeight: 600 }}>ALLOWED</span> = reached the model ·{' '}
              <span style={{ color: '#10b981', fontWeight: 600 }}>BLOCKED</span> = stopped by a guardrail ·{' '}
              REDACTED = sensitive data masked before the model saw it.
            </LegendRow>
            <LegendRow icon={Shield} title="Two-stage scan" isLight={isLight}>
              Guardrails run twice — on the input (before the model) and on the output (after). A block can happen at either stage.
            </LegendRow>
            <LegendRow icon={Layers} title="Where to go next" isLight={isLight}>
              Open the <strong style={{ color: textPrimary }}>Scenarios</strong> tab and click any scenario to run it.
              Use <strong style={{ color: textPrimary }}>Live Demo</strong> for free-form prompts, and{' '}
              <strong style={{ color: textPrimary }}>Integration Guide</strong> for the code.
            </LegendRow>
          </div>
        </div>

      </div>
    </div>
  )
}
