import React, { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import {
  ShieldAlert, Package, Layers, Siren, BadgeCheck, Check, X, Quote, Scale, Handshake, BookOpen, ArrowRight, ArrowUpRight, ExternalLink,
} from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade, bandDots, bandGlass } from '../home-2027/band'
import { HOME_PILLARS } from '../home-2027/homeData'
import { PITCH, SIDE, CONTROLS, RESOLVED, GATEWAY_DEPS, SOURCES, AS_OF } from './content'
import { focusCls, inkOn, SideTag } from './parts'
import { useRecord } from './LiveRecord'

/**
 * Overview — the pillar's front page, for the customer who asks "why AIRS AI
 * Gateway and not LiteLLM?". Two screens:
 *
 *   1  one line, then three numbers drawn as marks — every dot a real CVE
 *      (live from OSV), every square a real package, every tile a control point
 *   2  the March 2026 story, the enterprise checklist, the closing question
 *
 * Copy is data (PITCH in content.js). The deep dive — claim check, objections,
 * sources — is the "Full brief" one switch away in the header.
 */

const PINK = SIDE.airs.tone
const CYAN = SIDE.litellm.tone
const PILLAR_BY_ID = Object.fromEntries(HOME_PILLARS.map((p) => [p.id, p]))
const R = PITCH.reasons

// Text spans the whole band, so it stays on shaded pink from end to end.
const heroBg = `linear-gradient(118deg, ${shade(PINK, 0.6)} 0%, ${shade(PINK, 0.44)} 48%, ${shade(PINK, 0.2)} 100%)`

/** Counts up to `target` once `run` turns true; from wherever it stands when the target moves. */
function useCountUp(target, run, reduce, ms = 950) {
  const [n, setN] = useState(reduce && target != null ? target : 0)
  const cur = useRef(n)
  useEffect(() => {
    if (target == null || !run) return
    if (reduce) { cur.current = target; setN(target); return }
    const from = cur.current
    let raf = 0
    let start = 0
    const step = (ts) => {
      start ||= ts
      const k = Math.min(1, (ts - start) / ms)
      const v = Math.round(from + (target - from) * (1 - (1 - k) ** 3))
      cur.current = v
      setN(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, run, reduce, ms])
  return n
}

// ─── screen 1 · the line ─────────────────────────────────────────────────────
function SideChip({ side, text }) {
  const s = SIDE[side]
  return (
    <div className="flex items-start gap-3 rounded-2xl" style={{ padding: '11px 14px', ...bandGlass }}>
      <span className="rounded-full flex-shrink-0" style={{ width: 11, height: 11, marginTop: 4, background: s.tone, boxShadow: '0 0 0 2.5px rgba(255,255,255,0.85)' }} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block" style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{s.label}</span>
        <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.88)', marginTop: 2, lineHeight: 1.4 }}>{text}</span>
      </span>
    </div>
  )
}

function Hero({ reduce }) {
  return (
    <motion.section initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
                    className="relative overflow-hidden" style={{ borderRadius: 28, background: heroBg, boxShadow: `0 18px 40px ${PINK}33` }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 92% -10%, rgba(255,255,255,0.22), transparent 50%)' }} />
      <Scale aria-hidden="true" strokeWidth={1.1} style={{ position: 'absolute', right: -30, bottom: -70, width: 260, height: 260, color: '#fff', opacity: 0.1, transform: 'rotate(-10deg)' }} />
      <div className="relative flex flex-wrap items-center gap-x-10 gap-y-5" style={{ padding: '28px 32px' }}>
        <div className="min-w-0" style={{ flex: '1 1 520px' }}>
          <div style={{ ...LBL, fontSize: 10.5, color: 'rgba(255,255,255,0.86)' }}>{PITCH.eyebrow}</div>
          <h2 style={{ fontFamily: FONT.display, fontSize: 'clamp(26px, 2.5vw, 36px)', fontWeight: 700, color: '#fff', lineHeight: 1.12, letterSpacing: '-0.02em', margin: '8px 0 0', maxWidth: 760 }}>
            {PITCH.title}
          </h2>
          <p style={{ fontFamily: FONT.prose, fontSize: 15, color: 'rgba(255,255,255,0.92)', lineHeight: 1.6, margin: '12px 0 0', maxWidth: 720 }}>{PITCH.sub}</p>
        </div>
        <div className="flex flex-col gap-2 min-w-0" style={{ flex: '0 1 340px' }}>
          <SideChip side="airs" text={PITCH.sides.airs} />
          <span className="self-center" style={{ fontFamily: FONT.display, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.7)' }}>VS</span>
          <SideChip side="litellm" text={PITCH.sides.litellm} />
        </div>
      </div>
    </motion.section>
  )
}

// ─── screen 1 · three numbers ────────────────────────────────────────────────
function Big({ t, side, n }) {
  return (
    <div className="min-w-0">
      <div style={{ fontFamily: FONT.display, fontSize: 52, fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.04em', color: inkOn(t, SIDE[side].tone, 0.22), fontVariantNumeric: 'tabular-nums' }}>
        {n ?? '–'}
      </div>
      <div className="mt-1.5 whitespace-nowrap"><SideTag t={t} side={side} small short /></div>
    </div>
  )
}

function Versus({ t, airs, litellm, unit, run, reduce }) {
  const a = useCountUp(airs, run, reduce)
  const l = useCountUp(litellm, run, reduce)
  return (
    <div>
      <div className="flex items-start gap-4">
        <Big t={t} side="airs" n={airs == null ? null : a} />
        <span style={{ fontFamily: FONT.prose, fontSize: 13, color: t.inkFaint, paddingTop: 20 }}>vs</span>
        <Big t={t} side="litellm" n={litellm == null ? null : l} />
      </div>
      <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink, marginTop: 10 }}>{unit}</div>
    </div>
  )
}

function ReasonCard({ t, icon: Icon, reason, airs, litellm, run, reduce, index, caption, children, cardRef }) {
  return (
    <motion.article ref={cardRef} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.12 + index * 0.09 }}
                    className="flex flex-col min-w-0" style={{ borderRadius: 22, background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm, padding: '16px 18px 14px' }}>
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${PINK}17`, color: inkOn(t, PINK, 0.25) }}>
          <Icon size={15} aria-hidden="true" />
        </span>
        <span style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.inkDim }}>
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: inkOn(t, PINK, 0.25), marginRight: 6 }}>{reason.n}</span>{reason.eyebrow}
        </span>
      </div>
      <div className="mt-3.5"><Versus t={t} airs={airs} litellm={litellm} unit={reason.unit} run={run} reduce={reduce} /></div>
      <div className="flex-1 mt-3.5" style={{ minHeight: 150 }}>{children}</div>
      <p style={{ fontFamily: FONT.display, fontSize: 14.5, fontWeight: 600, color: t.ink, lineHeight: 1.45, margin: '12px 0 0' }}>{reason.take}</p>
      <div className="mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${t.hairline}`, minHeight: 30 }} aria-live="polite">
        <span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, lineHeight: 1.45 }}>{caption}</span>
      </div>
    </motion.article>
  )
}

/** A row of marks under its side's name. */
function MarkRow({ t, side, gap = 5, children }) {
  return (
    <div>
      <SideTag t={t} side={side} small />
      <div className="flex flex-wrap mt-1.5" style={{ gap }}>{children}</div>
    </div>
  )
}

/** One mark that pops in when its card is in view, and names itself on hover. */
function Mark({ i, run, reduce, onHot, hot, style, children }) {
  return (
    <motion.span initial={reduce ? false : { scale: 0, opacity: 0 }} animate={run ? { scale: 1, opacity: 1 } : {}}
                 transition={{ duration: 0.22, delay: reduce ? 0 : 0.35 + i * 0.012 }}
                 onMouseEnter={onHot} onMouseLeave={() => onHot(null)}
                 style={{ display: 'grid', placeItems: 'center', flexShrink: 0, cursor: 'default', outline: hot ? '2px solid currentColor' : 'none', outlineOffset: 1.5, ...style }}>
      {children}
    </motion.span>
  )
}

const SEV_RANK = { critical: 0, high: 1, moderate: 2, low: 3 }
const SEV_WORD = { critical: 'critical', high: 'high', moderate: 'moderate', low: 'low' }
const tidy = (s) => s.replace(/^(BerriAI\s+)?LiteLLM:\s*/i, '').replace(/^./, (c) => c.toUpperCase())

/** Severity in one hue: filled + ring for critical, filled for high, outlined below. */
function dotStyle(tone, sev, size = 14) {
  const base = { width: size, height: size, borderRadius: 999, color: tone }
  if (sev === 'critical') return { ...base, background: tone, boxShadow: `0 0 0 2.5px ${tone}40` }
  if (sev === 'high') return { ...base, background: tone }
  return { ...base, border: `2px solid ${tone}`, background: 'transparent' }
}

function fromSnapshot(bySev) {
  return Object.entries(bySev).flatMap(([sev, n]) => Array.from({ length: n }, () => ({ severity: sev })))
}

function CveField({ t, data, error, run, reduce, setCaption }) {
  const [hot, setHot] = useState(null)
  const live = !!data?.litellm
  const sort = (xs) => [...xs].sort((a, b) => (SEV_RANK[a.severity] ?? 4) - (SEV_RANK[b.severity] ?? 4))
  const ll = live ? sort(data.litellm.items.filter((x) => x.cve)) : error ? sort(fromSnapshot(R.safe.snapshot.litellm)) : []
  const gw = data?.gateway ? data.gateway.items.filter((x) => x.cve) : error ? fromSnapshot(R.safe.snapshot.gateway) : []
  const malware = live ? data.litellm.items.filter((x) => x.malware) : []
  const llTone = inkOn(t, CYAN, 0.12)
  const gwTone = inkOn(t, PINK, 0.12)
  const warn = inkOn(t, t.warn, 0.3)

  const pick = (key, text) => (k) => { setHot(k ? key : null); setCaption(k ? text : null) }
  const say = (x, side) => x.cve ? `${x.cve} · ${SEV_WORD[x.severity] ?? 'unrated'} — ${tidy(x.summary)}` : `${side} · ${SEV_WORD[x.severity] ?? 'unrated'} (snapshot of ${AS_OF})`

  if (!live && !error) {
    return <div className="grid place-items-center h-full" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>Reading the record from OSV.dev…</div>
  }
  return (
    <div className="space-y-3">
      <MarkRow t={t} side="airs">
        {gw.map((x, i) => (
          <Mark key={x.cve ?? i} i={i} run={run} reduce={reduce} hot={hot === `g${i}`} onHot={pick(`g${i}`, say(x, 'AIRS AI Gateway core'))} style={dotStyle(gwTone, x.severity)} />
        ))}
      </MarkRow>
      <MarkRow t={t} side="litellm">
        {ll.map((x, i) => (
          <Mark key={x.cve ?? i} i={i} run={run} reduce={reduce} hot={hot === `l${i}`} onHot={pick(`l${i}`, say(x, 'LiteLLM'))} style={dotStyle(llTone, x.severity)} />
        ))}
        {malware.length > 0 && (
          <Mark i={ll.length} run={run} reduce={reduce} hot={hot === 'mal'}
                onHot={pick('mal', `Not a CVE — malware: litellm 1.82.7 and 1.82.8, published 24 March 2026 (${malware.map((m) => m.id).join(', ')})`)}
                style={{ width: 14, height: 14, color: warn, borderRadius: 3 }}>
            {/* framer-motion owns the wrapper's transform, so the rotation lives inside */}
            <span data-malware style={{ width: 10, height: 10, background: warn, transform: 'rotate(45deg)', borderRadius: 2 }} />
          </Mark>
        )}
      </MarkRow>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
        {[['critical', 'Critical'], ['high', 'High'], ['moderate', 'Moderate or low']].map(([k, w]) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span style={dotStyle(t.inkDim, k, 9)} aria-hidden="true" />{w}</span>
        ))}
        {malware.length > 0 && <span className="inline-flex items-center gap-1.5"><span style={{ width: 8, height: 8, background: warn, transform: 'rotate(45deg)', borderRadius: 1 }} aria-hidden="true" />Malware</span>}
      </div>
      <span className="sr-only">
        {live ? `LiteLLM: ${ll.length} CVEs, ${data.litellm.bySeverity?.critical ?? 0} critical, plus ${malware.length} malware advisories. AIRS AI Gateway core: ${gw.length}.` : ''}
      </span>
    </div>
  )
}

function PackageField({ t, data, run, reduce, setCaption }) {
  const [hot, setHot] = useState(null)
  const gw = data?.npm?.dependencies?.length ? data.npm.dependencies : GATEWAY_DEPS
  const sq = (tone) => ({ width: 10, height: 10, borderRadius: 2.5, background: tone, color: tone })
  const pick = (key, text) => (k) => { setHot(k ? key : null); setCaption(k ? text : null) }
  return (
    <div className="space-y-3">
      <MarkRow t={t} side="airs" gap={3}>
        {gw.map((p, i) => <Mark key={p} i={i} run={run} reduce={reduce} hot={hot === `g${p}`} onHot={pick(`g${p}`, `${p} — gateway core dependency (npm)`)} style={sq(inkOn(t, PINK, 0.12))} />)}
      </MarkRow>
      <MarkRow t={t} side="litellm" gap={3}>
        {RESOLVED.packages.map((p, i) => <Mark key={p} i={i} run={run} reduce={reduce} hot={hot === `l${p}`} onHot={pick(`l${p}`, `${p} — installed by ${RESOLVED.spec}`)} style={sq(inkOn(t, CYAN, 0.12))} />)}
      </MarkRow>
      <span className="sr-only">AIRS AI Gateway core: {gw.length} dependencies. LiteLLM proxy: {RESOLVED.packages.length} packages.</span>
    </div>
  )
}

function ControlChip({ t, c, i, run, reduce, onGo, setCaption }) {
  const portal = c.portal && PILLAR_BY_ID[c.portal]
  const Icon = c.icon
  const both = c.covered
  const soon = c.status === 'Coming'
  const rest = `${PINK}0d`
  const style = {
    height: 30, padding: '0 8px 0 4px', borderRadius: 10, background: rest,
    border: `1px solid ${both ? CYAN : `${PINK}2e`}`, boxShadow: both ? `0 0 0 2px ${CYAN}2e` : 'none', transition: 'background 140ms',
  }
  const body = (
    <>
      <span className="grid place-items-center rounded-md flex-shrink-0" style={{ width: 22, height: 22, background: `${PINK}1f`, color: inkOn(t, PINK, 0.25) }}>
        <Icon size={12} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0 truncate text-left" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink }}>{c.short}</span>
      {soon && <span style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 600, color: t.inkDim }}>soon</span>}
      {both && <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: CYAN }} aria-hidden="true" />}
    </>
  )
  const say = `${c.title}${both ? ' — the one LiteLLM covers too' : ''}${soon ? ' — coming soon' : ''}${portal ? ` · see it live in ${portal.title}` : ''}`
  const enter = (e) => { setCaption(say); if (portal) e.currentTarget.style.background = `${PINK}1f` }
  const leave = (e) => { setCaption(null); e.currentTarget.style.background = rest }
  return (
    <motion.div initial={reduce ? false : { opacity: 0, x: -6 }} animate={run ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.25, delay: reduce ? 0 : 0.4 + i * 0.07 }} className="min-w-0">
      {portal ? (
        <button type="button" onClick={() => onGo(`pillar:${c.portal}`)} aria-label={`${c.title} — open ${portal.title}`}
                onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={leave}
                className={`w-full flex items-center gap-2 ${focusCls}`} style={style}>
          {body}
        </button>
      ) : (
        <div className="flex items-center gap-2" style={style} onMouseEnter={enter} onMouseLeave={leave}>{body}</div>
      )}
    </motion.div>
  )
}

function ControlField({ t, run, reduce, onGo, setCaption }) {
  return (
    <div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {CONTROLS.map((c, i) => <ControlChip key={c.title} t={t} c={c} i={i} run={run} reduce={reduce} onGo={onGo} setCaption={setCaption} />)}
      </div>
      <div className="flex items-center gap-1.5 mt-2.5" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
        <span className="rounded-full" style={{ width: 8, height: 8, background: CYAN }} aria-hidden="true" /> The one LiteLLM covers
      </div>
    </div>
  )
}

function Reasons({ t, reduce, onGo }) {
  const { data, error } = useRecord()
  const ref = useRef(null)
  const run = useInView(ref, { once: true, amount: 0.25 })
  const [cap, setCap] = useState({})
  const setCaption = (k) => (text) => setCap((c) => ({ ...c, [k]: text }))
  const llCves = data?.litellm?.cves ?? (error ? Object.values(R.safe.snapshot.litellm).reduce((a, b) => a + b, 0) : null)
  const gwCves = data?.gateway?.cves ?? (error ? Object.values(R.safe.snapshot.gateway).reduce((a, b) => a + b, 0) : null)
  const gwDeps = data?.npm?.dependencies?.length || GATEWAY_DEPS.length
  const safeFoot = data?.litellm ? `${R.safe.foot} · ${data.litellm.bySeverity?.critical ?? 0} critical` : error ? `OSV.dev unreachable — the snapshot of ${AS_OF}` : R.safe.foot
  return (
    <div ref={ref} className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))' }}>
      <ReasonCard t={t} icon={ShieldAlert} reason={R.safe} airs={gwCves} litellm={llCves} run={run} reduce={reduce} index={0} caption={cap.safe ?? safeFoot}>
        <CveField t={t} data={data} error={error} run={run} reduce={reduce} setCaption={setCaption('safe')} />
      </ReasonCard>
      <ReasonCard t={t} icon={Package} reason={R.lean} airs={gwDeps} litellm={RESOLVED.packages.length} run={run} reduce={reduce} index={1} caption={cap.lean ?? R.lean.foot}>
        <PackageField t={t} data={data} run={run} reduce={reduce} setCaption={setCaption('lean')} />
      </ReasonCard>
      <ReasonCard t={t} icon={Layers} reason={R.broad} airs={CONTROLS.length} litellm={CONTROLS.filter((c) => c.covered).length} run={run} reduce={reduce} index={2} caption={cap.broad ?? R.broad.foot}>
        <ControlField t={t} run={run} reduce={reduce} onGo={onGo} setCaption={setCaption('broad')} />
      </ReasonCard>
    </div>
  )
}

// ─── screen 2 · the story, the checklist ─────────────────────────────────────
function Panel({ t, icon: Icon, tone, eyebrow, title, sub, children, style }) {
  return (
    <section className="min-w-0 flex flex-col" style={{ borderRadius: 22, background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm, padding: '18px 20px', ...style }}>
      <div className="flex items-start gap-3">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: `${tone}17`, color: inkOn(t, tone, 0.3) }}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          {eyebrow && <div style={{ ...LBL, fontSize: 9.5, color: inkOn(t, tone, 0.4) }}>{eyebrow}</div>}
          <h3 style={{ fontFamily: FONT.display, fontSize: 19, fontWeight: 700, color: t.ink, margin: eyebrow ? '3px 0 0' : 0, lineHeight: 1.2, letterSpacing: '-0.01em' }}>{title}</h3>
          {sub && <p style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, margin: '3px 0 0' }}>{sub}</p>}
        </div>
      </div>
      <div className="mt-4 flex-1 flex flex-col">{children}</div>
    </section>
  )
}

function Story({ t, reduce }) {
  const s = PITCH.story
  const warn = t.warn
  const src = SOURCES[s.quoteSource]
  return (
    <Panel t={t} icon={Siren} tone={warn} eyebrow={s.eyebrow} title={s.title} sub={s.sub}>
      <ol className="relative" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {s.steps.map((x, i) => {
          const last = i === s.steps.length - 1
          return (
            <motion.li key={x.title} initial={reduce ? false : { opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.6 }}
                       transition={{ duration: 0.3, delay: reduce ? 0 : i * 0.08 }}
                       className="grid gap-x-3" style={{ gridTemplateColumns: '104px 18px minmax(0, 1fr)' }}>
              <span style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: x.hot ? inkOn(t, warn, 0.4) : t.inkDim, paddingTop: 1, textAlign: 'right' }}>{x.when}</span>
              <span className="relative flex justify-center">
                <span className="relative z-10 rounded-full" aria-hidden="true"
                      style={{ width: x.hot ? 12 : 10, height: x.hot ? 12 : 10, marginTop: x.hot ? 3 : 4, background: x.hot ? warn : t.panel, border: `2px solid ${x.hot ? warn : t.inkFaint}`, boxShadow: x.hot ? `0 0 0 4px ${warn}2e` : 'none' }} />
                {!last && <span aria-hidden="true" className="absolute" style={{ top: 14, bottom: -4, width: 2, background: t.hairline }} />}
              </span>
              <span className="min-w-0" style={{ paddingBottom: last ? 0 : 10 }}>
                <span className="block" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink, lineHeight: 1.3 }}>{x.title}</span>
                <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, lineHeight: 1.5, marginTop: 1 }}>{x.text}</span>
              </span>
            </motion.li>
          )
        })}
      </ol>
      <figure className="mt-auto rounded-2xl" style={{ margin: '14px 0 0', padding: '12px 14px', background: `${warn}10`, borderLeft: `3px solid ${warn}` }}>
        <div className="flex gap-2.5">
          <Quote size={15} aria-hidden="true" style={{ color: inkOn(t, warn, 0.35), flexShrink: 0, marginTop: 2 }} />
          <blockquote style={{ margin: 0, fontFamily: FONT.display, fontSize: 14.5, fontWeight: 600, color: t.ink, lineHeight: 1.45 }}>{s.quote}</blockquote>
        </div>
        <figcaption className="mt-1.5" style={{ paddingLeft: 25 }}>
          <a href={src?.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 rounded ${focusCls}`}
             style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: inkOn(t, t.live, 0.2) }}>
            {s.quoteBy} <ExternalLink size={10} aria-hidden="true" />
          </a>
        </figcaption>
      </figure>
    </Panel>
  )
}

function LitellmMark({ t, mark }) {
  if (mark === 'paid') {
    return (
      <span className="inline-flex items-center rounded-full px-1.5 flex-shrink-0" style={{ height: 18, marginTop: 1, fontFamily: FONT.prose, fontSize: 10, fontWeight: 700, color: inkOn(t, t.warn, 0.45), background: `${t.warn}1f` }}>
        Paid
      </span>
    )
  }
  return (
    <span className="grid place-items-center rounded-full flex-shrink-0" style={{ width: 18, height: 18, marginTop: 1, background: t.sunken, color: t.inkDim }}>
      <X size={11} strokeWidth={2.6} aria-label="No" />
    </span>
  )
}

const READY_COLS = '128px minmax(0, 1.15fr) minmax(0, 1fr)'

function Ready({ t, reduce }) {
  const r = PITCH.ready
  const ok = t.pass
  return (
    <Panel t={t} icon={BadgeCheck} tone={ok} title={r.title} sub={r.sub}>
      <div role="table" aria-label={r.title} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${t.hairline}` }}>
        <div role="row" className="grid" style={{ gridTemplateColumns: READY_COLS, borderBottom: `1px solid ${t.hairline}` }}>
          <span role="columnheader" className="sr-only">Topic</span>
          <span aria-hidden="true" />
          <span role="columnheader" style={{ padding: '9px 12px', background: `${PINK}0d` }}><SideTag t={t} side="airs" small /></span>
          <span role="columnheader" style={{ padding: '9px 12px' }}><SideTag t={t} side="litellm" small /></span>
        </div>
        {r.rows.map((x, i) => (
          <motion.div key={x.topic} role="row" initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.8 }}
                      transition={{ duration: 0.3, delay: reduce ? 0 : i * 0.06 }}
                      className="grid" style={{ gridTemplateColumns: READY_COLS, borderBottom: i < r.rows.length - 1 ? `1px solid ${t.hairline}` : 'none' }}>
            <span role="rowheader" style={{ padding: '10px 12px', fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: t.ink, lineHeight: 1.35 }}>{x.topic}</span>
            <span role="cell" className="flex items-start gap-2" style={{ padding: '10px 12px', background: `${PINK}0d` }}>
              <span className="grid place-items-center rounded-full flex-shrink-0" style={{ width: 18, height: 18, marginTop: 1, background: `${ok}22`, color: inkOn(t, ok, 0.3) }}>
                <Check size={11} strokeWidth={3} aria-label="Yes" />
              </span>
              <span style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, lineHeight: 1.45 }}>{x.airs}</span>
            </span>
            <span role="cell" className="flex items-start gap-2" style={{ padding: '10px 12px' }}>
              <LitellmMark t={t} mark={x.mark} />
              <span style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, lineHeight: 1.45 }}>{x.litellm}</span>
            </span>
          </motion.div>
        ))}
      </div>
    </Panel>
  )
}

// ─── screen 2 · the question ─────────────────────────────────────────────────
function Close({ t, onGo, onBrief }) {
  const c = PITCH.close
  const runtime = PILLAR_BY_ID.apiIntercept
  return (
    <div className="space-y-3">
      <section className="relative overflow-hidden" style={{ borderRadius: 24, background: heroBg, boxShadow: `0 14px 32px ${PINK}2e` }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
        <Quote aria-hidden="true" strokeWidth={1.1} style={{ position: 'absolute', right: -14, bottom: -40, width: 170, height: 170, color: '#fff', opacity: 0.12, transform: 'rotate(-8deg)' }} />
        <div className="relative flex flex-wrap items-center gap-x-8 gap-y-4" style={{ padding: '22px 28px' }}>
          <div className="flex-1 min-w-0" style={{ minWidth: 'min(100%, 420px)' }}>
            <div style={{ ...LBL, fontSize: 10, color: 'rgba(255,255,255,0.86)' }}>{c.eyebrow}</div>
            <p style={{ fontFamily: FONT.display, fontSize: 'clamp(20px, 1.8vw, 26px)', fontWeight: 700, color: '#fff', lineHeight: 1.25, letterSpacing: '-0.015em', margin: '6px 0 0', maxWidth: 820 }}>
              “{c.q}”
            </p>
            <p style={{ fontFamily: FONT.prose, fontSize: 13, color: 'rgba(255,255,255,0.88)', margin: '6px 0 0' }}>{c.note}</p>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {runtime && (
              <button type="button" onClick={() => onGo('pillar:apiIntercept')}
                      className="inline-flex items-center gap-2 rounded-full pl-1.5 pr-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                      style={{ height: 38, background: '#fff', color: shade(PINK, 0.45), fontFamily: FONT.prose, fontSize: 13, fontWeight: 700, boxShadow: '0 6px 16px rgba(0,0,0,0.18)' }}>
                <span className="grid place-items-center rounded-full" style={{ width: 28, height: 28, background: `${PINK}1f` }}>
                  <runtime.icon size={14} aria-hidden="true" />
                </span>
                Show the AI Gateway live <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={onBrief}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    style={{ height: 34, ...bandGlass, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600 }}>
              <BookOpen size={13} aria-hidden="true" /> Full brief, claim check and sources
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))' }}>
        {[[Scale, 'Fair to say', c.fair], [Handshake, 'Already on LiteLLM?', c.already]].map(([Icon, title, text]) => (
          <div key={title} className="flex items-start gap-3 rounded-2xl" style={{ padding: '12px 14px', background: t.panel, border: `1px solid ${t.hairline}` }}>
            <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${CYAN}17`, color: inkOn(t, CYAN, 0.25) }}>
              <Icon size={14} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{title}</span>
              <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, lineHeight: 1.5, marginTop: 1 }}>{text}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Footnote({ t }) {
  const { data } = useRecord()
  const when = data?.fetchedAt ? new Date(data.fetchedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null
  return (
    <p style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint, lineHeight: 1.6, margin: 0 }}>
      CVEs read live from OSV.dev{when ? ` (${when})` : ''}, each CVE counted once across its advisories. Packages: the gateway core&apos;s declared dependencies on npm, and {RESOLVED.spec} resolved with pip on {AS_OF}.
      Timeline: OSV advisories PYSEC-2026-2 and MAL-2026-2144 and the October 2026 competitive brief; organisations and gigabytes as reported by Hudson Rock.
      Feature rows are checked against LiteLLM&apos;s own documentation — see the claim check in the full brief.
    </p>
  )
}

// ─── the page ────────────────────────────────────────────────────────────────
export function Overview({ t, onGo, onBrief }) {
  const reduce = useReducedMotion()
  return (
    <div className="mx-auto px-5 py-4 space-y-4" style={{ maxWidth: 1240 }}>
      <Hero reduce={reduce} />
      <Reasons t={t} reduce={reduce} onGo={onGo} />
      <div className="grid gap-4 pt-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))' }}>
        <Story t={t} reduce={reduce} />
        <Ready t={t} reduce={reduce} />
      </div>
      <Close t={t} onGo={onGo} onBrief={onBrief} />
      <Footnote t={t} />
      <div style={{ height: 8 }} />
    </div>
  )
}
