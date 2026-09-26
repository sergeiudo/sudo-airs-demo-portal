import React, { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ShieldCheck, Biohazard, Scale, AlertTriangle, ArrowUpRight, Boxes, History, Puzzle, ChevronDown,
  Database, ExternalLink, Info,
} from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { CopyCmd, Footnote } from '../runtime-launch/LaunchModelPicker'
import { LIBRARY, KIND_TONE, INSIGHTS_URL, scanFault } from '../model-scanning-2027/scanModel'
import { LaunchScanHistory } from './LaunchScanHistory'
import { LaunchSkillScans } from './LaunchSkillScans'
import { Notice } from './Notice'

/**
 * LaunchScanLibrary — the AI Supply Chain rail in the launch design.
 *
 * Same three tabs and the same behaviour as ScanLibrary (the v1 console
 * keeps it): Library scans on click, SCM history opens a tenant scan as a
 * record, Skills explains the Preview and hands off to SCM. The look is the
 * runtime console's: pill tabs, the library as category cards of app rows —
 * a kind dot where a payload has its severity dot, the expected verdict as a
 * pill, an arrow that fills on hover.
 *
 * The scanner's health lives on the pillar header now (ScanActions); the rail
 * only speaks up when it is down, with the fix for this host.
 */

const KIND_ICON = { clean: ShieldCheck, threat: Biohazard, policy: Scale }
const KIND_LABEL = { clean: 'control', threat: 'threat', policy: 'policy' }
const INSIGHTS_HUE = '#0EA5E9'
const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

const TABS = [
  { id: 'library', label: 'Library', icon: Boxes },
  { id: 'history', label: 'SCM history', icon: History },
  { id: 'skills',  label: 'Skills', icon: Puzzle },
]

/** Why the scanner cannot run, with the fix for this host. */
function HealthNotice({ t, health }) {
  if (health.state !== 'stub' && health.state !== 'offline') return null
  const f = scanFault({ health: health.state })
  const reasons = Array.isArray(health.reason) ? health.reason : []
  return (
    <div className="px-3 pt-3">
      <Notice t={t} title={f.title} cmd={f.cmd} after={f.after}>
        {f.why}
        {reasons.map((r) => (
          <span key={r} className="block" style={{ fontFamily: FONT.mono, fontSize: 10, lineHeight: 1.45, color: t.inkDim, marginTop: 4 }}>{r}</span>
        ))}
      </Notice>
    </div>
  )
}

/** One model, as an app row: click to scan it. */
function ModelScanRow({ t, item, hue, onPick, disabled, active, index }) {
  const reduce = useReducedMotion()
  const [hot, setHot] = useState(false)
  const tone = KIND_TONE[item.kind]
  const Icon = KIND_ICON[item.kind]
  const expectTone = item.expect === 'ALLOWED' ? t.pass : t.block
  const insTone = item.insights === 'Unsafe' ? t.block : t.pass
  const lit = hot && !disabled
  return (
    <motion.button type="button" onClick={() => !disabled && onPick(item)} aria-disabled={disabled}
                   initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: disabled ? 0.55 : 1, x: 0 }}
                   transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.2 }}
                   onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
                   title={disabled ? 'Scanner unavailable, or a scan is already running' : `Scan ${item.uri}`}
                   className={`w-full flex items-start gap-2.5 rounded-xl text-left ${focusCls}`}
                   style={{
                     padding: '8px 8px 8px 10px', cursor: disabled ? 'not-allowed' : 'pointer',
                     background: active ? `${hue}14` : lit ? `${hue}0f` : 'transparent', transition: 'background 140ms ease',
                   }}>
      <span className="grid place-items-center rounded-lg flex-shrink-0" title={KIND_LABEL[item.kind]}
            style={{ width: 24, height: 24, marginTop: 1, background: `${tone}17`, color: t.isLight ? shade(tone, 0.3) : tone }}>
        <Icon size={12} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 flex-wrap">
          <span style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{item.title}</span>
          <span className="rounded-full px-1.5" title={`Measured Sep 2026: ${item.measured}`}
                style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 600, lineHeight: '16px',
                         color: t.isLight ? shade(expectTone, 0.25) : expectTone, background: `${expectTone}17` }}>
            expect {item.expect.toLowerCase()}
          </span>
          {item.insights && (
            <span className="rounded-full px-1.5" title="Verdict on insights-db.paloaltonetworks.com"
                  style={{ fontFamily: FONT.prose, fontSize: 10, lineHeight: '14px', color: t.isLight ? shade(insTone, 0.25) : insTone, border: `1px dashed ${insTone}66` }}>
              insights · {item.insights.toLowerCase()}
            </span>
          )}
        </span>
        <span className="block truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, marginTop: 2 }}>{item.uri}</span>
        <span className="block" style={{
          fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.4, color: t.inkDim, marginTop: 2,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{item.story}</span>
      </span>
      <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
            style={{ width: 26, height: 26, marginTop: 1, color: lit ? '#fff' : t.inkDim, background: lit ? shade(hue) : t.sunken, transition: 'background 140ms ease, color 140ms ease' }}>
        <ArrowUpRight size={13} />
      </span>
    </motion.button>
  )
}

/** A group of models, as a category card. Open by default — there are eight, not 142. */
function Collection({ t, title, sub, icon: Icon, hue, items, children, ...row }) {
  const [open, setOpen] = useState(true)
  const [hot, setHot] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden"
         style={{
           background: t.panel, border: `1px solid ${open || hot ? `${hue}55` : t.hairline}`,
           boxShadow: open ? `0 10px 24px ${hue}1a` : hot ? t.shadowSm : 'none',
           transition: 'border-color 160ms ease, box-shadow 200ms ease',
         }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
              className={`w-full flex items-center gap-3 text-left ${focusCls}`} style={{ padding: '9px 10px' }}>
        <span className="grid place-items-center rounded-xl flex-shrink-0"
              style={{ width: 34, height: 34, background: bandBg(hue), boxShadow: open || hot ? `0 5px 12px ${hue}55` : 'none' }}>
          <Icon size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink, lineHeight: 1.2 }}>{title}</span>
          {sub && <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }}>{sub}</span>}
        </span>
        <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim }}>{items.length}</span>
        <ChevronDown size={13} className="flex-shrink-0" style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }} className="overflow-hidden">
            <div className="px-1.5 pb-1.5 pt-0.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
              {children}
              {items.map((item, i) => (
                <ModelScanRow key={item.id} t={t} item={item} hue={hue} index={i} active={row.activeUri === item.uri} {...row} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function LibraryTab({ t, tone, onPick, disabled, activeUri }) {
  const curated = LIBRARY.filter((i) => !i.group)
  const insights = LIBRARY.filter((i) => i.group === 'insights')
  const row = { onPick, disabled, activeUri }
  return (
    <div className="px-3 pt-3.5 pb-3">
      <div className="flex items-center px-1 mb-2">
        <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Model library</span>
        <span className="ml-auto" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>{LIBRARY.length} models · click to scan</span>
      </div>
      <div className="space-y-2">
        <Collection t={t} title="Curated demo set" sub="a control, a threat and two policy blocks" icon={Boxes} hue={tone} items={curated} {...row} />
        <Collection t={t} title="From Insights DB" sub="Palo Alto's public verdicts on Hugging Face" icon={Database} hue={INSIGHTS_HUE} items={insights} {...row}>
          <div className="px-1.5 pt-2 pb-1">
            <Footnote t={t} icon={Info} tone={INSIGHTS_HUE} title="Safe there is not allowed here">
              <em>Safe</em> on Insights DB means no threat was found. Your security group also enforces license, publisher and
              format, so a Safe model can still be blocked here — that gap is the point of the set.{' '}
              <a href={INSIGHTS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: t.live }}>
                insights-db <ExternalLink size={10} aria-hidden="true" />
              </a>
            </Footnote>
          </div>
        </Collection>
      </div>
      {/* The old "Clean Demo" turned into a policy block when the group's rules
          changed and kept its SAFE label. Say out loud that these are predictions. */}
      <p className="px-1 mt-3" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.5, color: t.inkDim }}>
        Expected verdicts were measured against this tenant's <span style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>Default HUGGING_FACE</span> security
        group in Sep 2026. Change its rules and the outcome changes with it — the scan is the source of truth, not the label.
      </p>
    </div>
  )
}

export function LaunchScanLibrary({ t, tone, health, onPick, busy, activeUri, tab, onTab, history, tsg, onTenant }) {
  const ready = health.state === 'live'
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── tabs ── */}
      <div className="flex gap-1.5 px-3 pt-3.5 flex-shrink-0" role="tablist" aria-label="AI Supply Chain">
        {TABS.map((x) => {
          const on = tab === x.id
          return (
            <button key={x.id} type="button" role="tab" aria-selected={on} onClick={() => onTab(x.id)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full whitespace-nowrap ${focusCls}`}
                    style={{
                      height: 32, fontFamily: FONT.prose, fontSize: 12, fontWeight: on ? 700 : 500,
                      color: on ? '#fff' : t.inkDim, background: on ? bandBg(tone) : t.sunken,
                      border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 4px 12px ${tone}40` : 'none',
                    }}>
              <x.icon size={13} aria-hidden="true" /> {x.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'library' && (
          <>
            <HealthNotice t={t} health={health} />
            <LibraryTab t={t} tone={tone} onPick={onPick} disabled={!ready || busy} activeUri={activeUri} />
          </>
        )}
        {tab === 'history' && <LaunchScanHistory t={t} tone={tone} {...history} onTenant={onTenant} />}
        {tab === 'skills' && <LaunchSkillScans t={t} tone={tone} tsg={tsg} />}
      </div>
    </div>
  )
}
