import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Biohazard, Scale, RefreshCw, AlertTriangle, Play, Boxes, History, Puzzle, ExternalLink } from 'lucide-react'
import { FONT, label as LBL, bloom } from '../api-intercept-2027/tokens'
import { Copyable } from '../api-intercept-2027/RecordStream'
import { LIBRARY, KIND_TONE, INSIGHTS_URL, scanFault } from './scanModel'
import { ScanHistory } from './ScanHistory'
import { SkillScans } from './SkillScans'

/**
 * ScanLibrary — the left rail. The runtime console's attack library, for
 * models: click a card and it scans, the way clicking a payload fires it.
 *
 * Each card states the story it demonstrates and the verdict it is expected to
 * produce, plus the measured rule result that expectation rests on. The four
 * were picked to separate the two reasons a model gets blocked — a threat in
 * the artifact versus a policy it breaks — because "blocked" alone does not
 * tell a customer which conversation they are in.
 */

const KIND_ICON = { clean: ShieldCheck, threat: Biohazard, policy: Scale }
const KIND_LABEL = { clean: 'control', threat: 'threat', policy: 'policy' }

const HEALTH = {
  checking: { label: 'CHECKING', tone: 'idle' },
  live:     { label: 'LIVE',     tone: 'pass' },
  stub:     { label: 'STUB',     tone: 'warn' },
  offline:  { label: 'OFFLINE',  tone: 'block' },
}

function HealthChip({ t, health }) {
  const h = HEALTH[health.state] ?? HEALTH.checking
  const c = t[h.tone]
  return (
    <button onClick={health.recheck} title="Re-check the scanner"
            className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ ...LBL, fontSize: 8.5, color: c, background: `${c}18`, border: `1px solid ${c}44` }}>
      {health.state === 'checking'
        ? <RefreshCw size={8} className="animate-spin" />
        : <motion.span className="rounded-full" style={{ width: 5, height: 5, background: c }}
                       animate={health.state === 'live' ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
                       transition={{ duration: 1.8, repeat: Infinity }} />}
      {h.label}
    </button>
  )
}

/** Why the scanner cannot run, with the fix for this host. */
function HealthNotice({ t, health }) {
  if (health.state !== 'stub' && health.state !== 'offline') return null
  const f = scanFault({ health: health.state })
  const reasons = Array.isArray(health.reason) ? health.reason : []
  return (
    <div className="mx-3 mt-3 px-3 py-2.5" style={{ background: `${t.warn}10`, border: `1px solid ${t.warn}40`, borderRadius: 16 }}>
      <div className="flex items-center gap-1.5 mb-1">
        <AlertTriangle size={12} style={{ color: t.warn }} />
        <span style={{ ...LBL, fontSize: 8.5, color: t.warn }}>{f.title}</span>
      </div>
      {f.why && <p style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.5, color: t.inkDim }}>{f.why}</p>}
      {reasons.map((r) => (
        <p key={r} style={{ fontFamily: FONT.mono, fontSize: 9.5, lineHeight: 1.45, color: t.inkFaint, marginTop: 4 }}>{r}</p>
      ))}
      {f.cmd && (
        <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-xl" style={{ background: t.codeBg, border: `1px solid ${t.hairline}` }}>
          <span className="flex-1 min-w-0" style={{ fontFamily: FONT.mono, fontSize: 11, color: t.ink, userSelect: 'all' }}>{f.cmd}</span>
          <Copyable t={t} text={f.cmd} />
        </div>
      )}
      {f.after && <p style={{ fontFamily: FONT.prose, fontSize: 10, lineHeight: 1.5, color: t.inkFaint, marginTop: 6 }}>{f.after}</p>}
    </div>
  )
}

function LibraryCard({ t, item, onPick, disabled, active }) {
  const insTone = item.insights === 'Unsafe' ? t.block : t.pass
  const [hover, setHover] = useState(false)
  const Icon = KIND_ICON[item.kind]
  const tone = KIND_TONE[item.kind]
  const expectTone = item.expect === 'ALLOWED' ? t.pass : t.block
  const lift = hover && !disabled

  return (
    <motion.button
      type="button"
      onClick={() => !disabled && onPick(item)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      animate={{ y: lift ? -2 : 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className="w-full text-left px-3 py-2.5"
      title={disabled ? 'Scanner unavailable, or a scan is already running' : `Scan ${item.uri}`}
      style={{
        background: active ? `${tone}0d` : t.panel,
        border: `1px solid ${active ? `${tone}55` : t.glassEdge}`,
        borderRadius: 16,
        boxShadow: lift ? bloom(tone, 0.7) : t.shadowSm,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="grid place-items-center rounded-lg flex-shrink-0"
              style={{ width: 26, height: 26, background: `${tone}18`, border: `1px solid ${tone}33` }}>
          <Icon size={13} style={{ color: tone }} />
        </span>
        <div className="min-w-0 flex-1">
          <div style={{ fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: t.ink, lineHeight: 1.2 }}>
            {item.title}
          </div>
          <div style={{ ...LBL, fontSize: 7.5, color: tone, marginTop: 1 }}>{KIND_LABEL[item.kind]}</div>
        </div>
        {/* Palo Alto's public verdict, beside the one your policy will give —
            they disagree on purpose for the "safe but blocked" examples. */}
        {item.insights && (
          <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full" title="Verdict on insights-db.paloaltonetworks.com"
                style={{ fontFamily: FONT.mono, fontSize: 8.5, color: insTone, background: `${insTone}12`, border: `1px dashed ${insTone}55` }}>
            insights · {item.insights.toLowerCase()}
          </span>
        )}
      </div>
      <div className="truncate mt-2" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>{item.uri}</div>
      <p style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.45, color: t.inkFaint, marginTop: 3 }}>{item.story}</p>
      <div className="flex items-center gap-1.5 mt-2">
        {/* the chip and the measurement it rests on, side by side */}
        <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full"
              style={{ ...LBL, fontSize: 7.5, color: expectTone, background: `${expectTone}16`, border: `1px solid ${expectTone}40` }}>
          expect {item.expect.toLowerCase()}
        </span>
        <span className="truncate" style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>{item.measured}</span>
        <span className="ml-auto flex items-center gap-1 flex-shrink-0 transition-opacity"
              style={{ ...LBL, fontSize: 8, color: t.block, opacity: lift ? 1 : 0 }}>
          <Play size={9} /> scan
        </span>
      </div>
    </motion.button>
  )
}

function LibraryTab({ t, onPick, disabled, activeUri }) {
  const curated = LIBRARY.filter((i) => !i.group)
  const insights = LIBRARY.filter((i) => i.group === 'insights')
  return (
    <>
      <div className="px-4 pt-3 pb-1.5" style={{ ...LBL, fontSize: 8.5, color: t.inkFaint }}>Curated · click to scan</div>
      <div className="px-3 space-y-2">
        {curated.map((item) => (
          <LibraryCard key={item.id} t={t} item={item} onPick={onPick} disabled={disabled} active={activeUri === item.uri} />
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 pt-4 pb-1.5">
        <span style={{ ...LBL, fontSize: 8.5, color: t.inkFaint }}>From Insights DB</span>
        <a href={INSIGHTS_URL} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1"
           style={{ ...LBL, fontSize: 8, color: t.live }}>
          insights-db <ExternalLink size={9} />
        </a>
      </div>
      <p className="px-4 pb-2" style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: 1.45, color: t.inkFaint }}>
        Palo Alto's public verdicts on Hugging Face models. <em>Safe</em> there means no threat was found — your security
        group also enforces license, publisher and format, so a Safe model can still be blocked here.
      </p>
      <div className="px-3 space-y-2">
        {insights.map((item) => (
          <LibraryCard key={item.id} t={t} item={item} onPick={onPick} disabled={disabled} active={activeUri === item.uri} />
        ))}
      </div>

      {/* The old "Clean Demo" turned into a policy block when the group's
          rules changed and kept its SAFE label. Say out loud that these are
          predictions. */}
      <p className="mx-4 mt-3" style={{ fontFamily: FONT.prose, fontSize: 10, lineHeight: 1.5, color: t.inkFaint }}>
        Expected verdicts were measured against this tenant's <span style={{ fontFamily: FONT.mono }}>Default HUGGING_FACE</span> security
        group in Sep 2026. Change that group's rules and the outcome changes with it — the scan is the source of truth,
        not the label.
      </p>
    </>
  )
}

const TABS = [
  { id: 'library', label: 'Library', icon: Boxes },
  { id: 'history', label: 'SCM history', icon: History },
  { id: 'skills',  label: 'Skills', icon: Puzzle },
]

/**
 * The rail: the model library, the tenant's scan history, and the skill-scan
 * story — the three things under "AI Supply Chain" in SCM that the portal can
 * speak to. The tab is held by the shell so opening a history record does not
 * reset it.
 */
export function ScanLibrary({ t, health, onPick, busy, activeUri, tab, onTab, history, tsg, onTenant }) {
  const ready = health.state === 'live'
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${t.hairline}` }}>
        <span className="grid place-items-center rounded-lg" style={{ width: 24, height: 24, background: t.sunken }}>
          <Boxes size={13} style={{ color: t.ink }} />
        </span>
        <div className="min-w-0">
          <div style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink, lineHeight: 1.1 }}>AI Supply Chain</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>models · scan history · skills</div>
        </div>
        <HealthChip t={t} health={health} />
      </div>

      <div className="flex gap-1 px-3 pt-2.5 flex-shrink-0">
        {TABS.map((x) => {
          const on = tab === x.id
          return (
            <button key={x.id} type="button" onClick={() => onTab(x.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl transition-colors"
                    style={{
                      fontFamily: FONT.prose, fontSize: 11, fontWeight: 600,
                      color: on ? t.ink : t.inkFaint,
                      background: on ? t.sunken : 'transparent',
                      border: `1px solid ${on ? t.hairline : 'transparent'}`,
                    }}>
              <x.icon size={12} /> {x.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto pb-3">
        {tab === 'library' && (
          <>
            <HealthNotice t={t} health={health} />
            <LibraryTab t={t} onPick={onPick} disabled={!ready || busy} activeUri={activeUri} />
          </>
        )}
        {tab === 'history' && <ScanHistory t={t} {...history} onTenant={onTenant} />}
        {tab === 'skills' && <SkillScans t={t} tsg={tsg} />}
      </div>
    </div>
  )
}
