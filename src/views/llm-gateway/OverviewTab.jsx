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

// One diagram, all three flows stacked and column-aligned, so the audience sees
// that the ONLY thing that changes between flows is the inspection step in the
// middle. Colours match the flow cards below (amber / blue / pink).
function FlowComparison({ isLight }) {
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  const neutralBg = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)'
  const arrowColor = isLight ? '#94a3b8' : '#64748b'

  const rows = [
    { label: '1 · No gateway',     color: '#f59e0b', guard: null },
    { label: '2 · Portkey native', color: '#0ea5e9', guard: 'AI GW' },
    { label: '3 · AIRS + Portkey', color: '#ec4899', guard: 'AIRS' },
  ]

  const Arrow = () => <ArrowRight size={12} className="justify-self-center" style={{ color: arrowColor }} />
  const Pill = ({ children }) => (
    <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold whitespace-nowrap text-center"
          style={{ background: neutralBg, color: textPrimary }}>{children}</span>
  )
  const Guard = ({ guard, color }) => guard ? (
    <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold whitespace-nowrap text-center"
          style={{ background: `${color}1f`, color, border: `1px solid ${color}66` }}>{guard}</span>
  ) : (
    <span className="px-2.5 py-1 rounded-md text-[10px] font-mono whitespace-nowrap text-center"
          style={{ color: textSecondary, border: `1px dashed ${isLight ? '#cbd5e1' : '#475569'}` }}>no check</span>
  )

  const cols = 'minmax(110px,max-content) max-content 18px max-content 18px max-content 18px max-content 18px max-content'

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3 overflow-x-auto"
         style={{ background: isLight ? '#ffffff' : 'rgba(15,20,35,0.55)', border: `1px solid ${isLight ? 'rgba(0,48,135,0.12)' : 'rgba(255,255,255,0.08)'}` }}>
      <div className="grid items-center gap-x-2 gap-y-3" style={{ gridTemplateColumns: cols, minWidth: 'max-content' }}>
        {/* header: scan-stage hints over the two guard columns */}
        <div /><div /><div />
        <div className="text-[9px] uppercase tracking-wider font-bold text-center" style={{ color: textSecondary }}>input scan</div>
        <div /><div /><div />
        <div className="text-[9px] uppercase tracking-wider font-bold text-center" style={{ color: textSecondary }}>output scan</div>
        <div /><div />
        {rows.map(r => (
          <React.Fragment key={r.label}>
            <span className="text-[12px] font-bold pr-2 whitespace-nowrap" style={{ color: r.color }}>{r.label}</span>
            <Pill>prompt</Pill>
            <Arrow />
            <Guard guard={r.guard} color={r.color} />
            <Arrow />
            <Pill>model</Pill>
            <Arrow />
            <Guard guard={r.guard} color={r.color} />
            <Arrow />
            <Pill>response</Pill>
          </React.Fragment>
        ))}
      </div>
      <div className="text-[11px] italic" style={{ color: textSecondary }}>
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
          <FlowComparison isLight={isLight} />
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
