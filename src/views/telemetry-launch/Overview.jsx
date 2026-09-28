import React, { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ShieldX, ShieldCheck, ShieldOff, Radar, Syringe, Bot, Fingerprint, MessageSquareWarning, Link2, Code2, FileCode2,
  Database, Anchor, Tags, HelpCircle, ChevronRight, PieChart, Building2, AlertTriangle, Flag, Ban,
} from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots, bandGlass } from '../home-2027/band'
import { deepBand } from '../runtime-launch/diagramKit'
import { targetMeta, fmtCount, fmtPct, fmtMs, windowLong, spanLabel, inkOn, WINDOWS } from './telemetryModel'
import { useCountUp } from './useTelemetry'

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
const IDLE = '#71717A'

// ─── pieces ──────────────────────────────────────────────────────────────────

export function IconSquare({ icon: Icon, tone, size = 32 }) {
  return (
    <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: size, height: size, background: `${tone}14`, color: tone }}>
      <Icon size={Math.round(size * 0.47)} aria-hidden="true" />
    </span>
  )
}

/** A soft card with a gradient-icon header — the section container of this console. */
export function Section({ t, icon: Icon, tone, title, sub, right, children, className = '', pad = true }) {
  return (
    <section className={`rounded-[22px] overflow-hidden min-w-0 ${className}`} style={{ background: t.panel, border: `1px solid ${t.glassEdge}`, boxShadow: t.shadow }}>
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 34, height: 34, background: bandBg(tone), boxShadow: `0 5px 12px ${tone}44` }}>
          <Icon size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>{title}</h2>
          {sub && <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1, lineHeight: 1.4 }}>{sub}</p>}
        </div>
        {right}
      </div>
      <div className={pad ? 'px-4 pb-4 pt-1' : ''}>{children}</div>
    </section>
  )
}

/** An honest footnote under a figure: what it is, and what it is not. */
export function Fine({ t, children }) {
  return <p style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.5, color: t.inkFaint, marginTop: 10 }}>{children}</p>
}

// ─── hero ────────────────────────────────────────────────────────────────────

function GlassStat({ label, value, sub }) {
  return (
    <div className="rounded-2xl px-3.5 py-2.5 min-w-0" style={{ ...bandGlass, background: 'rgba(0,0,0,0.2)' }}>
      <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>{label}</div>
      <div className="truncate" style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.15, marginTop: 2 }}>{value}</div>
      {sub && <div className="truncate" title={sub} style={{ fontFamily: FONT.prose, fontSize: 10.5, color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

/**
 * The window's answer in one band. Vermilion only when AIRS actually stopped
 * something — the colour means interception, never "this is a dashboard".
 */
export function Hero({ t, data, win, target, onWindow }) {
  const reduce = useReducedMotion()
  const tt = data.totals
  const airsStops = tt.stopped - tt.stages.native
  const n = useCountUp(tt.traces === 0 ? 0 : airsStops > 0 ? airsStops : tt.inspected > 0 ? tt.inspected : tt.traces, { reduce })
  const meta = target ? targetMeta(target) : null

  let tone, Icon, title, sub
  if (tt.traces === 0) {
    tone = IDLE; Icon = Radar; title = 'Quiet on the wire'
    sub = `No prompts in ${windowLong(win)}${meta ? ` on ${meta.label}` : ''}.`
  } else if (airsStops > 0) {
    tone = t.block; Icon = ShieldX; title = airsStops === 1 ? 'attack stopped' : 'attacks stopped'
    sub = tt.stages.input === airsStops
      ? 'Every one before the model was ever called.'
      : `${fmtCount(tt.stages.input)} before the model was ever called — ${fmtPct(tt.stages.input, airsStops)} of them.`
  } else if (tt.inspected > 0) {
    tone = t.pass; Icon = ShieldCheck; title = tt.inspected === 1 ? 'prompt inspected, nothing to stop' : 'prompts inspected, nothing to stop'
    sub = 'Every prompt AIRS saw in this window cleared both scans.'
  } else {
    tone = t.warn; Icon = ShieldOff; title = tt.traces === 1 ? 'prompt, none inspected' : 'prompts, none inspected'
    sub = 'AIRS was off (or failed open) for all of them — nothing was checked.'
  }

  const lat = data.latency
  const blockTime = lat.promptBlocks.total.p50
  const answerTime = lat.answered.total.p50
  const allTimeHint = tt.traces === 0 && data.allTime.traces > 0 && win !== 'all'

  return (
    <section aria-label="Summary" className="relative overflow-hidden rounded-[22px]" style={{ background: deepBand(tone), boxShadow: `0 14px 34px ${tone}38` }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 92% 0%, rgba(255,255,255,0.16), transparent 50%)' }} />
      <Icon aria-hidden="true" strokeWidth={1.2} style={{ position: 'absolute', right: -30, bottom: -56, width: 230, height: 230, color: '#fff', opacity: 0.1, transform: 'rotate(-10deg)' }} />
      <div className="relative flex items-center gap-5 px-5 py-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0 flex-1" style={{ minWidth: 300 }}>
          <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 52, height: 52, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
            <Icon size={24} style={{ color: '#fff' }} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="truncate" style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>
              {WINDOWS.find((w) => w.id === win)?.label}{meta ? ` · ${meta.label}` : ' · every target'}{data.first ? ` · ${spanLabel(data.first, data.last)}` : ''}
            </div>
            <div className="flex items-baseline gap-2.5 flex-wrap" style={{ marginTop: 2 }}>
              {tt.traces > 0 && (
                <span style={{ fontFamily: FONT.display, fontSize: 52, fontWeight: 700, letterSpacing: '-0.035em', color: '#fff', lineHeight: 1 }}>{fmtCount(n)}</span>
              )}
              <span style={{ fontFamily: FONT.display, fontSize: tt.traces > 0 ? 22 : 28, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.1 }}>{title}</span>
            </div>
            <div style={{ fontFamily: FONT.prose, fontSize: 12.5, color: 'rgba(255,255,255,0.92)', marginTop: 5 }}>{sub}</div>
            {allTimeHint && (
              <button type="button" onClick={() => onWindow('all')}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                      style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: 700, color: shade(tone, 0.5), background: '#fff' }}>
                Show all time · {fmtCount(data.allTime.traces)} {data.allTime.traces === 1 ? 'trace' : 'traces'}{meta ? ` on ${meta.label}` : ''} <ChevronRight size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {tt.traces > 0 && (
          <div className="grid gap-2 flex-shrink-0" style={{ gridTemplateColumns: 'repeat(3, minmax(118px, 1fr))' }}>
            <GlassStat label="Prompts traced" value={fmtCount(tt.traces)} sub={`${fmtCount(tt.measured)} with full telemetry`} />
            <GlassStat label="Inspected by AIRS" value={fmtPct(tt.inspected, tt.traces)}
                       sub={tt.traces - tt.inspected > 0 ? `${fmtCount(tt.traces - tt.inspected)} not inspected` : 'every prompt'} />
            {blockTime != null && answerTime != null
              ? <GlassStat label="Time to a block" value={fmtMs(blockTime)} sub={`vs ${fmtMs(answerTime)} to an answer · p50`} />
              : <GlassStat label="Model calls avoided" value={fmtCount(data.modelCallsAvoided)} sub="stopped before the model" />}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── what AIRS caught ────────────────────────────────────────────────────────

const FAMILY_ICON = {
  injection: Syringe, agent: Bot, dlp: Fingerprint, toxic: MessageSquareWarning, url: Link2, code: Code2,
  source: FileCode2, db: Database, ungrounded: Anchor, topic: Tags,
}

function StageSplit({ t, stages }) {
  const parts = [
    stages.input && `${fmtCount(stages.input)} at the prompt`,
    stages.output && `${fmtCount(stages.output)} at the response`,
    stages.tool && `${fmtCount(stages.tool)} at a tool`,
  ].filter(Boolean)
  return <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{parts.join(' · ')}</span>
}

export function Caught({ t, data, onOpenLog }) {
  const reduce = useReducedMotion()
  const airsStops = data.totals.stopped - data.totals.stages.native
  const top = Math.max(1, ...data.families.map((f) => f.count), data.unattributed)
  const bar = t.block
  return (
    <Section t={t} icon={ShieldX} tone={t.block} title="What AIRS caught"
             sub={airsStops ? `${fmtCount(airsStops)} stops, by detector family — a prompt that trips two families counts in both` : 'Nothing was stopped in this window'}>
      {airsStops === 0 ? (
        <p style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, padding: '6px 0 2px' }}>
          No AIRS stops {windowLong(data.window)}. Fire an attack from the AIRS Runtime &amp; AI-GW library and it lands here.
        </p>
      ) : (
        <div className="space-y-0.5">
          {data.families.map((f, i) => {
            const Icon = FAMILY_ICON[f.key] ?? HelpCircle
            return (
              <button key={f.key} type="button" onClick={() => onOpenLog({ outcome: 'stopped', family: f.key })}
                      className={`w-full flex items-center gap-3 rounded-xl px-1.5 py-1.5 text-left ${focusCls}`}
                      onMouseEnter={(e) => { e.currentTarget.style.background = `${bar}0d` }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <IconSquare icon={Icon} tone={bar} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{f.label}</span>
                    <span className="ml-auto flex-shrink-0" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>{fmtCount(f.count)}</span>
                  </span>
                  <span className="block rounded-full overflow-hidden" style={{ height: 6, marginTop: 4, background: t.sunken }}>
                    <motion.span className="block h-full rounded-full" style={{ background: bar, opacity: 0.85 }}
                                 initial={reduce ? false : { width: 0 }} animate={{ width: `${(f.count / top) * 100}%` }}
                                 transition={{ duration: 0.6, delay: i * 0.04, ease: 'easeOut' }} />
                  </span>
                  <span className="flex mt-1"><StageSplit t={t} stages={f.stages} /></span>
                </span>
              </button>
            )
          })}
          {data.unattributed > 0 && (
            <div className="flex items-center gap-3 px-1.5 py-1.5">
              <IconSquare icon={HelpCircle} tone={t.inkDim} size={30} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>No detector named</span>
                  <span className="ml-auto" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>{fmtCount(data.unattributed)}</span>
                </span>
                <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 2 }}>
                  Blocked, but the record names only a verdict (e.g. an older gateway block, or a tool result scanned as "malicious").
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

// ─── coverage ────────────────────────────────────────────────────────────────

function CoverageRow({ t, icon, tone, title, count, total, text, onClick }) {
  const body = (
    <>
      <IconSquare icon={icon} tone={tone} size={30} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{title}</span>
          <span className="ml-auto flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{total ? fmtPct(count, total) : ''}</span>
          <span className="flex-shrink-0" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink, minWidth: 34, textAlign: 'right' }}>{fmtCount(count)}</span>
        </span>
        <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.4, color: t.inkDim, marginTop: 1 }}>{text}</span>
      </span>
      {onClick && <ChevronRight size={14} style={{ color: t.inkFaint, flexShrink: 0 }} aria-hidden="true" />}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-3 rounded-xl px-1.5 py-1.5 text-left ${focusCls}`}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${tone}0d` }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
      {body}
    </button>
  ) : <div className="flex items-center gap-3 px-1.5 py-1.5">{body}</div>
}

export function Coverage({ t, data, onOpenLog }) {
  const tt = data.totals
  const airsStops = tt.stopped - tt.stages.native
  const segs = [
    { k: 'stopped', n: airsStops, c: t.block, label: 'Stopped by AIRS' },
    { k: 'cleared', n: tt.cleared, c: t.pass, label: 'Cleared by AIRS' },
    { k: 'unscanned', n: tt.traces - tt.inspected, c: t.warn, label: 'Not inspected' },
  ].filter((s) => s.n > 0)
  return (
    <Section t={t} icon={PieChart} tone={t.pass} title="Coverage" sub="What AIRS saw, and what went past it unchecked">
      {tt.traces > 0 && (
        <div className="flex w-full overflow-hidden rounded-full" style={{ height: 12, gap: 2, background: t.panel }} role="img"
             aria-label={segs.map((s) => `${s.label} ${s.n}`).join(', ')}>
          {segs.map((s) => (
            <div key={s.k} title={`${s.label} · ${fmtCount(s.n)}`} style={{ flex: s.n, background: s.c, minWidth: 4 }} />
          ))}
        </div>
      )}
      <div className="space-y-0.5 mt-2.5">
        <CoverageRow t={t} icon={ShieldX} tone={t.block} title="Stopped by AIRS" count={airsStops} total={tt.traces}
                     text="Blocked at the prompt, the response or a tool call." onClick={airsStops ? () => onOpenLog({ outcome: 'stopped' }) : null} />
        <CoverageRow t={t} icon={ShieldCheck} tone={t.pass} title="Cleared by AIRS" count={tt.cleared} total={tt.traces}
                     text={tt.flagged ? `Inspected and allowed — ${fmtCount(tt.flagged)} flagged but served.` : 'Inspected and allowed.'}
                     onClick={tt.cleared ? () => onOpenLog({ outcome: 'cleared' }) : null} />
        <CoverageRow t={t} icon={ShieldOff} tone={t.warn} title="AIRS switched off" count={tt.off} total={tt.traces}
                     text="Sent with protection off, or down a gateway lane with no AIRS in it — nothing was checked." onClick={tt.off ? () => onOpenLog({ outcome: 'unscanned' }) : null} />
        <CoverageRow t={t} icon={AlertTriangle} tone={t.warn} title="Guardrail failed open" count={tt.failopen} total={tt.traces}
                     text={tt.failopen
                       ? 'AIRS was on, but the guardrail check errored and let the request through unscanned. Its trace reads NOT SCANNED.'
                       : 'None in this window — every guardrail check that ran returned a verdict.'}
                     onClick={tt.failopen ? () => onOpenLog({ outcome: 'unscanned' }) : null} />
        {tt.stages.native > 0 && (
          <CoverageRow t={t} icon={Ban} tone={t.inkDim} title="Stopped by a non-AIRS guardrail" count={tt.stages.native} total={tt.traces}
                       text="The legacy gateway's own checks (banned words, PII) with AIRS off." />
        )}
        {tt.flagged > 0 && (
          <CoverageRow t={t} icon={Flag} tone={t.warn} title="Flagged, served" count={tt.flagged} total={tt.traces}
                       text="A flag-only guardrail matched, and the answer was still delivered." />
        )}
      </div>
    </Section>
  )
}

// ─── enforcement points ──────────────────────────────────────────────────────

function TargetIcon({ meta, size = 34 }) {
  if (meta.logo) {
    return (
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: size, height: size, background: '#fff', boxShadow: `0 4px 10px ${meta.tone}33`, border: '1px solid rgba(0,0,0,0.06)' }}>
        <img src={meta.logo} alt="" style={{ height: Math.round(size * 0.46), width: 'auto' }} />
      </span>
    )
  }
  const Icon = meta.icon
  return (
    <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: size, height: size, background: bandBg(meta.tone), boxShadow: `0 5px 12px ${meta.tone}44` }}>
      <Icon size={Math.round(size * 0.45)} style={{ color: '#fff' }} aria-hidden="true" />
    </span>
  )
}
export { TargetIcon }

function TargetCard({ t, row, active, onScope }) {
  const meta = targetMeta(row.id)
  const [hot, setHot] = useState(false)
  const airsStops = row.stopped - row.stages.native
  const segs = [[airsStops, t.block], [row.cleared, t.pass], [row.traces - row.inspected, t.warn]].filter(([n]) => n > 0)
  return (
    <button type="button" onClick={() => onScope(active ? '' : row.id)} aria-pressed={active}
            onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            title={active ? 'Show every target again' : `Scope the whole console to ${meta.label}`}
            className={`text-left rounded-2xl p-3 min-w-0 ${focusCls}`}
            style={{
              background: active ? `linear-gradient(135deg, ${meta.tone}1c, ${meta.tone}06), ${t.panel}` : t.panel,
              border: `1px solid ${active || hot ? `${meta.tone}77` : t.hairline}`,
              boxShadow: active ? `0 10px 24px ${meta.tone}26` : hot ? t.shadowSm : 'none',
              transition: 'border-color 160ms ease, box-shadow 200ms ease',
            }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <TargetIcon meta={meta} />
        <div className="min-w-0 flex-1">
          <div className="truncate" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{meta.label}</div>
          <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
            {meta.where === 'gateway' ? 'Inside the gateway' : meta.where === 'api' ? 'API layer' : meta.cloud}
          </div>
        </div>
        <span style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em' }}>{fmtCount(row.traces)}</span>
      </div>
      <div className="flex w-full overflow-hidden rounded-full mt-2.5" style={{ height: 7, gap: 2 }}>
        {segs.map(([n, c], i) => <div key={i} style={{ flex: n, background: c, minWidth: 3 }} />)}
      </div>
      <dl className="grid mt-2.5 gap-y-1" style={{ gridTemplateColumns: 'auto 1fr', columnGap: 10 }}>
        {[
          ['Stopped / inspected', airsStops ? `${fmtCount(airsStops)} · ${fmtPct(airsStops, row.inspected)}` : 'none'],
          [meta.where === 'gateway' ? 'Guardrail p50' : 'Prompt scan p50', row.scan.p50 != null ? `${fmtMs(row.scan.p50)}${row.scan.n < row.traces ? ` · n=${row.scan.n}` : ''}` : 'not recorded'],
          ['Answer p50', row.total.p50 != null ? fmtMs(row.total.p50) : '—'],
        ].map(([k, v]) => (
          <React.Fragment key={k}>
            <dt style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{k}</dt>
            <dd className="truncate text-right" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.ink }}>{v}</dd>
          </React.Fragment>
        ))}
      </dl>
    </button>
  )
}

export function EnforcementPoints({ t, data, target, onScope }) {
  const api = data.targets.filter((r) => targetMeta(r.id).where === 'api')
  const gw = data.targets.filter((r) => targetMeta(r.id).where !== 'api')
  const group = (label, sub, rows) => rows.length > 0 && (
    <div className="min-w-0">
      <div className="flex items-baseline gap-2 mb-2">
        <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>{label}</span>
        <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint }}>{sub}</span>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
        {rows.map((r) => <TargetCard key={r.id} t={t} row={r} active={target === r.id} onScope={onScope} />)}
      </div>
    </div>
  )
  return (
    <Section t={t} icon={Building2} tone={t.live} title="Enforcement points compared"
             sub="Same attack library, two architectures: this app calls AIRS around the model, or the guardrail runs inside the gateway. Click one to scope the console to it.">
      {data.targets.length === 0
        ? <p style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>No traffic in this window.</p>
        : (
          <div className="space-y-3.5">
            {group('API layer', 'the app scans before and after the model', api)}
            {group('Inside the gateway', 'one request carries the model turn and the verdict', gw)}
          </div>
        )}
      {target && (
        <Fine t={t}>Scoped to {targetMeta(target).label}. Click its card again, or pick “Every target” above, to see them all.</Fine>
      )}
    </Section>
  )
}

export { inkOn }
