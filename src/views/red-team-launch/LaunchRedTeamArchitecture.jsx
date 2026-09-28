import React, { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Swords, Gavel, FileBarChart, ShieldCheck, Workflow, Library, Bot, RefreshCcw } from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { useGeometry, pt, Markers, Wire, Packet, WirePill, Node } from '../runtime-launch/diagramKit'
import { targetMeta } from './redTeamModel'

/**
 * LaunchRedTeamArchitecture — the empty Red Teaming console: how a campaign
 * runs, as HTML cards and measured wires (diagramKit), like the other launch
 * consoles.
 *
 *   Prisma AIRS Red Teaming → the target, called exactly as it is deployed →
 *   a judge scores every response → the report (risk score, ASR, OWASP) →
 *   a recommended AIRS runtime profile, which is what protects the target in
 *   step 01. That last wire is the story: red teaming finds it, runtime stops it.
 *
 * The target card shows the one picked in the rail. Colours follow the portal:
 * the pillar's orange for the attacker, blue for the customer's side, green
 * for AIRS judging and protecting.
 */

const COLS = 'minmax(0,1.15fr) minmax(40px,0.3fr) minmax(0,1fr) minmax(40px,0.3fr) minmax(0,1fr) minmax(34px,0.22fr) minmax(0,1fr)'

const POINTS = [
  { icon: Library,     title: 'Attack library', text: 'Hundreds of curated prompts per campaign across security, safety, brand and compliance — each tried several times.' },
  { icon: Bot,         title: 'Agent',          text: 'Profiles the target, writes goals for its use case, then runs multi-turn conversations to reach them.' },
  { icon: RefreshCcw,  title: 'Closes the loop', text: 'Every report comes with remediations and a recommended AIRS runtime profile built from what landed.' },
]

export function LaunchRedTeamArchitecture({ t, tone, target, jobType }) {
  const reduce = useReducedMotion()
  const mid = useId().replace(/:/g, '')
  const { root, bind, geo: g } = useGeometry([target?.uuid, jobType])
  const compact = !!g && g.w < 700
  const meta = targetMeta(target?.target_type)
  const ok = g && g.engine && g.target && g.judge && g.report && g.runtime

  let wires = null
  let pills = null
  if (ok) {
    const y = g.target.cy
    const attack = `M${pt(g.engine.r + 6, y)} L${pt(g.target.x - 7, y)}`
    const respond = `M${pt(g.target.r + 6, y)} L${pt(g.judge.x - 7, y)}`
    const score = `M${pt(g.judge.r + 6, y)} L${pt(g.report.x - 7, y)}`
    // report ↓ → runtime (in from the right)
    const recommend = `M${pt(g.report.cx, g.report.b + 6)} C${pt(g.report.cx, g.runtime.cy)} ${pt(g.runtime.r + 34, g.runtime.cy)} ${pt(g.runtime.r + 7, g.runtime.cy)}`
    // runtime ← → up into the target: the loop closes
    const protect = `M${pt(g.runtime.x - 6, g.runtime.cy)} C${pt(g.target.cx, g.runtime.cy)} ${pt(g.target.cx, g.runtime.cy)} ${pt(g.target.cx, g.target.b + 7)}`
    const main = `${attack} L${pt(g.judge.x, y)} L${pt(g.report.x, y)}`
    wires = (
      <svg aria-hidden="true" className="absolute inset-0 pointer-events-none" width={g.w} height={g.h} style={{ zIndex: 1, overflow: 'visible' }}>
        <Markers id={mid} colors={{ attack: tone, live: t.live, pass: t.pass }} />
        <Wire d={attack} color={tone} opacity={0.85} width={1.8} marker={`${mid}-attack`} />
        <Wire d={respond} color={t.live} opacity={0.75} marker={`${mid}-live`} />
        <Wire d={score} color={t.pass} opacity={0.75} marker={`${mid}-pass`} />
        <Wire d={recommend} color={t.pass} opacity={0.7} marker={`${mid}-pass`} />
        <Wire d={protect} color={t.pass} opacity={0.75} dashed width={1.8} marker={`${mid}-pass`} />
        {!reduce && (
          <g key={`${g.w}x${g.h}`}>
            <Packet d={main} color={tone} dur={3.2} r={3.6} />
            <Packet d={respond} color={t.live} dur={1.6} delay={1.2} r={3} />
            <Packet d={recommend} color={t.pass} dur={2.2} delay={2.6} r={3} />
            <Packet d={protect} color={t.pass} dur={2.4} delay={3.6} r={3} />
          </g>
        )}
      </svg>
    )
    pills = (
      <>
        <WirePill t={t} x={(g.engine.r + g.target.x) / 2} y={y - 22} tone={tone}>attacks</WirePill>
        <WirePill t={t} x={(g.target.r + g.judge.x) / 2} y={y - 22} tone={t.live}>replies</WirePill>
        <WirePill t={t} x={(g.target.cx + g.runtime.x) / 2} y={g.runtime.cy - 16} tone={t.pass}>
          {compact ? 'protects it · step 01' : 'deployed in front of the target · step 01'}
        </WirePill>
      </>
    )
  }

  return (
    <div className="w-full px-4 pt-3 pb-4 self-start">
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                      aria-label="Red teaming campaign architecture" className="overflow-hidden" style={glass(t, { radius: 22 })}>
        <header className="flex items-center gap-3 px-4 pt-4 pb-2">
          <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: bandBg(tone), boxShadow: `0 5px 12px ${tone}45` }}>
            <Workflow size={16} style={{ color: '#fff' }} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Campaign architecture</div>
            <div className="truncate" style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink, marginTop: 1 }}>
              How a red-team campaign runs
            </div>
            <div style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginTop: 1 }}>
              Prisma AIRS attacks your endpoint as it is deployed, judges every reply, and turns what landed into a runtime profile.
            </div>
          </div>
        </header>

        <div className="pt-8 pb-5">
          <div ref={root} className="relative" style={{ display: 'grid', gridTemplateColumns: COLS, gridTemplateRows: 'auto 26px auto', padding: '0 14px' }}>
            <Node t={t} nodeRef={bind('engine')} kind="model" tone={tone} icon={Swords} compact={compact}
                  title="Prisma AIRS Red Teaming" sub={jobType === 'DYNAMIC' ? 'agent · multi-turn' : 'attack library'} style={{ gridRow: 1, gridColumn: 1 }} />
            <Node t={t} nodeRef={bind('target')} kind="user" tone={t.live} icon={meta.icon} compact={compact} delay={0.06}
                  title={target?.name ?? 'Your AI endpoint'} sub={`${target ? meta.label.toLowerCase() : 'model · app · agent'} · called as deployed`}
                  style={{ gridRow: 1, gridColumn: 3 }} />
            <Node t={t} nodeRef={bind('judge')} kind="scan" tone={t.pass} icon={Gavel} compact={compact} delay={0.12}
                  title="Judge" sub="scores every reply" style={{ gridRow: 1, gridColumn: 5 }} />
            <Node t={t} nodeRef={bind('report')} kind="user" tone={tone} icon={FileBarChart} compact={compact} delay={0.18}
                  title="Report" sub="risk score · ASR · OWASP" style={{ gridRow: 1, gridColumn: 7 }} />
            <Node t={t} nodeRef={bind('runtime')} kind="scan" tone={t.pass} icon={ShieldCheck} compact={compact} delay={0.24}
                  title="Recommended runtime profile" sub="AIRS Runtime policies from the findings" style={{ gridRow: 3, gridColumn: 5 }} />
            {wires}
            {pills}
          </div>
        </div>

        <div className="px-4 pt-3.5 pb-4" style={{ borderTop: `1px solid ${t.hairline}` }}>
          <div style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, marginBottom: 10, color: t.isLight ? shade(tone, 0.25) : tone }}>
            Two ways to attack, one loop back to runtime
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            {POINTS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-2.5">
                <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${tone}17`, color: t.isLight ? shade(tone, 0.2) : tone }}>
                  <Icon size={14} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{title}</span>
                  <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>{text}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <p className="px-1 mt-2.5" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkFaint }}>
        Pick a target and launch a campaign, or open a finished one from History — a new campaign takes minutes to hours.
      </p>
    </div>
  )
}
