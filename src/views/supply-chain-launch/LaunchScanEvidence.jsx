import React, { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ShieldCheck, ShieldX, AlertTriangle, Loader2, Radar, Package, ExternalLink, ListChecks, Biohazard, Scale,
  ArrowUpRight, Link2, Activity,
} from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots } from '../home-2027/band'
import { Block, EvidenceLook, ctaWash } from '../api-intercept-2027/EvidencePane'
import {
  KIND_TONE, scanVerdict, ruleCounts, groupViolations, threatSignals, unapprovedFormats,
  parseTarget, scmScanUrl, fmtBytes,
} from '../model-scanning-2027/scanModel'

/**
 * LaunchScanEvidence — proof for the selected scan, in the launch design.
 *
 * The verdict is a band (Allowed / Blocked / Scanning / Fault), the SCM
 * record is a card right under it, and the evidence is list-row sections.
 *
 * One home per piece of evidence. The pane is the verdict and the failures at
 * a glance: each failed rule is a row naming its threat code and what runs on
 * load. Everything deeper — findings, how to fix, every rule including the
 * ones that passed, the file tree with hashes, provenance, identifiers and the
 * raw payloads — lives in the scan telemetry drawer, opened from the card
 * under the SCM link or from any rule row (which opens it at that rule).
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

// ─── empty ───────────────────────────────────────────────────────────────────

/** Before the first scan: what this pane is for. */
export function ScanEvidenceEmpty({ t, ready }) {
  const reduce = useReducedMotion()
  const tone = ready ? t.pass : t.warn
  const rows = [
    { icon: ShieldCheck, title: 'Verdict', text: 'Allowed or blocked — and whether the reason is a threat or a policy rule.' },
    { icon: ListChecks, title: 'Security group', text: 'How many rules passed, and each one that failed.' },
    { icon: Biohazard, title: 'Threats', text: 'PAIT codes and the operators that run on load — exec, os, Lambda layers.' },
    { icon: Activity, title: 'Full scan telemetry', text: 'Every rule and its configuration, the scanned file tree with hashes, provenance and raw JSON.' },
    { icon: ExternalLink, title: 'SCM record', text: 'The same scan in Strata Cloud Manager, by its scan id.' },
  ]
  return (
    <div className="flex flex-col h-full overflow-hidden" style={glass(t, { radius: 22 })}>
      <div className="relative flex-shrink-0 overflow-hidden" style={{ height: 96, background: bandBg(tone) }}>
        <div aria-hidden="true" className="absolute inset-0" style={bandDots} />
        <Radar aria-hidden="true" strokeWidth={1.3}
               style={{ position: 'absolute', right: -24, bottom: -40, width: 150, height: 150, color: '#fff', opacity: 0.15, transform: 'rotate(-10deg)' }} />
        <div className="relative h-full flex items-center gap-3 px-4">
          <motion.span className="grid place-items-center rounded-2xl flex-shrink-0"
                       animate={reduce ? undefined : { scale: [1, 1.06, 1] }} transition={{ duration: 2.4, repeat: Infinity }}
                       style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
            <Radar size={20} style={{ color: '#fff' }} aria-hidden="true" />
          </motion.span>
          <div className="min-w-0">
            <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Evidence</div>
            <div style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 2 }}>
              {ready ? 'Standing by' : 'Scanner unavailable'}
            </div>
            <div style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>
              {ready ? 'Ready for the first scan' : 'The SCM history still works'}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, marginBottom: 10 }}>What lands here after each scan</div>
        <ul className="space-y-3">
          {rows.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: `${t.live}14`, color: t.live }}>
                <Icon size={15} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{title}</span>
                <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 pt-3" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.inkDim, borderTop: `1px solid ${t.hairline}` }}>
          Scan a model from the library, open one from the SCM history, or click any record to inspect what the scan found.
        </p>
      </div>
    </div>
  )
}

// ─── verdict + SCM ───────────────────────────────────────────────────────────

const TITLE = { allowed: 'Allowed', blocked: 'Blocked', scanning: 'Scanning', error: 'Fault' }

function BandVerdict({ t, v, record, why, where }) {
  const color = v === 'blocked' ? t.block : v === 'allowed' ? t.pass : v === 'scanning' ? t.live : t.warn
  const Icon = v === 'blocked' ? ShieldX : v === 'allowed' ? ShieldCheck : v === 'scanning' ? Loader2 : AlertTriangle
  return (
    <div className="relative flex-shrink-0 overflow-hidden" style={{ minHeight: 100, background: bandBg(color) }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
      {v === 'blocked' && (
        <motion.div key={record.id} aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.22)' }}
                    initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8 }} />
      )}
      <Icon aria-hidden="true" strokeWidth={1.3}
            style={{ position: 'absolute', right: -24, bottom: -40, width: 150, height: 150, color: '#fff', opacity: 0.15, transform: 'rotate(-10deg)' }} />
      <div className="relative flex items-center gap-3 px-4 py-4">
        <motion.span key={`${record.id}-${v}`} className="grid place-items-center rounded-2xl flex-shrink-0"
                     initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                     style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
          <Icon size={21} className={v === 'scanning' ? 'animate-spin' : ''} style={{ color: '#fff' }} aria-hidden="true" />
        </motion.span>
        <div className="min-w-0">
          <div className="truncate" style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Verdict · {where}</div>
          <div style={{ fontFamily: FONT.display, fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.1, marginTop: 3 }}>
            {TITLE[v] ?? 'Verdict'}
          </div>
          <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 2 }}>{why}</div>
        </div>
      </div>
    </div>
  )
}

/** The scan's full record in SCM — visible, not buried at the bottom. */
function ScmCta({ t, href }) {
  const [hot, setHot] = useState(false)
  const tone = t.live
  return (
    <a href={href} target="_blank" rel="noreferrer"
       onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
       className={`w-full flex items-center gap-3 rounded-2xl text-left mt-3 ${focusCls}`}
       style={{
         padding: '10px 10px 10px 11px', background: t.panel,
         border: `1px solid ${hot ? `${tone}88` : `${tone}40`}`,
         boxShadow: hot ? `0 10px 24px ${tone}2e` : `0 6px 16px ${tone}17`,
         transition: 'border-color 160ms ease, box-shadow 200ms ease',
       }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: bandBg(tone), boxShadow: `0 5px 12px ${tone}55` }}>
        <ExternalLink size={16} style={{ color: '#fff' }} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>Open in Strata Cloud Manager</span>
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1 }}>The scan record · files · hashes · rules</span>
      </span>
      <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
            style={{ width: 28, height: 28, color: hot ? '#fff' : tone, background: hot ? shade(tone) : `${tone}14`, transition: 'background 140ms ease, color 140ms ease' }}>
        <ArrowUpRight size={14} />
      </span>
    </a>
  )
}

/**
 * The way into the scan telemetry drawer — a visible card, not a hover
 * action, the same as the runtime console's "Open full telemetry".
 */
function TelemetryCta({ t, onOpen }) {
  const [hot, setHot] = useState(false)
  const tone = t.live
  return (
    <button type="button" onClick={() => onOpen(null)}
            onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className={`w-full flex items-center gap-3 rounded-2xl text-left mt-2 ${focusCls}`}
            style={{
              padding: '10px 10px 10px 11px', background: ctaWash(t, tone, hot),
              border: `1px solid ${hot ? `${tone}88` : `${tone}55`}`,
              boxShadow: hot ? `0 10px 24px ${tone}2e` : `0 6px 16px ${tone}17`,
              transition: 'border-color 160ms ease, box-shadow 200ms ease, background 160ms ease',
            }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: bandBg(tone), boxShadow: `0 5px 12px ${tone}55` }}>
        <Activity size={16} style={{ color: '#fff' }} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>Open full scan telemetry</span>
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1 }}>Every rule · file tree · provenance · raw</span>
      </span>
      <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
            style={{ width: 28, height: 28, color: hot ? '#fff' : tone, background: hot ? shade(tone) : t.panel, transition: 'background 140ms ease, color 140ms ease' }}>
        <ArrowUpRight size={14} />
      </span>
    </button>
  )
}

// ─── sections ────────────────────────────────────────────────────────────────

function ModelRow({ t, rec }) {
  const r = rec.result
  const m = parseTarget(rec)
  const bad = unapprovedFormats(r?.violations)
  const isHf = rec.source === 'huggingface'
  const facts = [
    m.org, isHf ? 'Hugging Face' : 'local file', rec.fromScm ? 'from SCM history' : null,
    rec.size != null ? fmtBytes(rec.size) : null,
    r?.total_files_scanned != null ? `${r.total_files_scanned} files scanned${r.total_files_skipped ? ` · ${r.total_files_skipped} skipped` : ''}` : null,
  ].filter(Boolean)
  return (
    <div className="flex items-start gap-3 px-4 py-3" style={{ borderTop: `1px solid ${t.hairline}` }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: `${t.live}14`, color: t.live }}>
        <Package size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate" dir="ltr" title={m.id} style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{m.name}</div>
        <div style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>{facts.join(' · ')}</div>
        {/* Formats, with the ones policy rejected struck through — the whole
            "unapproved format" story in one row. */}
        {r?.model_formats?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {r.model_formats.map((f) => {
              const no = bad.has(f)
              return (
                <span key={f} dir="ltr" className="rounded-full px-2" title={no ? 'not on this security group’s approved-format list' : 'format found'}
                      style={{
                        fontFamily: FONT.mono, fontSize: 10, lineHeight: '18px',
                        color: no ? (t.isLight ? shade(t.block, 0.2) : t.block) : t.inkDim,
                        background: no ? `${t.block}14` : t.sunken, textDecoration: no ? 'line-through' : 'none',
                      }}>
                  {f}
                </span>
              )
            })}
          </div>
        )}
        {isHf && (
          <a href={`https://huggingface.co/${m.id}`} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1 mt-2" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.live }}>
            <Link2 size={11} aria-hidden="true" /> Open on Hugging Face
          </a>
        )}
      </div>
    </div>
  )
}

/**
 * One segment per rule in the group. The API returns violations, not the
 * passing set, so the meter shows proportion and the rows below name the
 * failures.
 */
function RuleMeter({ t, total, passed, failed }) {
  const segs = Array.from({ length: Math.max(total, 1) }, (_, i) => (i < failed ? 'fail' : i < failed + passed ? 'pass' : 'other'))
  return (
    <div>
      <div className="flex items-end gap-5 mb-2">
        {[['passed', passed, t.pass], ['failed', failed, failed ? t.block : t.inkFaint], ['rules', total, t.ink]].map(([k, v, c]) => (
          <div key={k}>
            <div style={{ fontFamily: FONT.display, fontSize: 24, fontWeight: 700, color: c, lineHeight: 1 }}>{v}</div>
            <div style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 3 }}>{k}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {segs.map((s, i) => (
          <motion.span key={i} className="flex-1 rounded-full"
                       initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.035, duration: 0.25 }}
                       style={{ height: 8, transformOrigin: 'left', background: s === 'fail' ? t.block : s === 'pass' ? t.pass : t.railBed, opacity: s === 'pass' ? 0.75 : 1 }} />
        ))}
      </div>
    </div>
  )
}

/**
 * A failed rule, at a glance: state, kind, threat code, finding count and the
 * operators that run on load. Its findings and fix open in the scan telemetry
 * drawer, at this rule.
 */
function RuleRow({ t, g, onOpen }) {
  const [hot, setHot] = useState(false)
  const tone = KIND_TONE[g.kind]
  const ink = t.isLight ? shade(tone, 0.3) : tone
  const Icon = g.kind === 'threat' ? Biohazard : Scale
  const signals = g.kind === 'threat' ? threatSignals(g.items) : []
  const stateTone = g.state === 'BLOCKING' ? t.block : g.state === 'WARNING' ? t.warn : t.inkDim
  const Tag = onOpen ? 'button' : 'div'

  return (
    <Tag {...(onOpen ? { type: 'button', onClick: () => onOpen(g.key), 'aria-label': `${g.name} — open in scan telemetry` } : {})}
         onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
         className={`w-full flex items-start gap-2.5 text-left rounded-2xl ${focusCls}`}
         style={{
           padding: '9px 10px', background: t.panel, cursor: onOpen ? 'pointer' : 'default',
           border: `1px solid ${hot && onOpen ? `${tone}66` : t.hairline}`,
           boxShadow: hot && onOpen ? `0 8px 18px ${tone}1f` : 'none', transition: 'border-color 160ms ease, box-shadow 180ms ease',
         }}>
      <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 26, height: 26, background: `${tone}17`, color: ink }}>
        <Icon size={13} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{g.name}</span>
        <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }}>
          <span style={{ color: t.isLight ? shade(stateTone, 0.25) : stateTone, fontWeight: 600 }}>{g.state.toLowerCase()}</span>
          {' · '}{g.kind}
          {g.threat ? <> · <span style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>{g.threat}</span></> : null}
          {g.items.length > 1 ? ` · ${g.items.length} findings` : ''}
        </span>
        {signals.length > 0 && (
          <span className="flex flex-wrap gap-1 mt-1.5">
            {signals.map((s) => (
              <span key={s.label} dir="ltr" className="rounded-full px-2" title={s.module ? `from module ${s.module}` : undefined}
                    style={{ fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 600, lineHeight: '18px', color: t.isLight ? shade(t.block, 0.2) : t.block, background: `${t.block}17` }}>
                {s.label}
              </span>
            ))}
          </span>
        )}
      </span>
      {onOpen && (
        <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
              style={{ width: 26, height: 26, marginTop: 1, color: hot ? '#fff' : t.inkDim, background: hot ? shade(tone) : t.sunken, transition: 'background 140ms ease, color 140ms ease' }}>
          <ArrowUpRight size={13} />
        </span>
      )}
    </Tag>
  )
}

// ─── the pane ────────────────────────────────────────────────────────────────

export function LaunchScanEvidence({ t, record, ready, onOpenTelemetry }) {
  if (!record) return <ScanEvidenceEmpty t={t} ready={ready} />

  const v = scanVerdict(record)
  const r = record.result
  const { total, passed, failed } = ruleCounts(r)
  const groups = groupViolations(r?.violations)
  const threats = groups.filter((g) => g.kind === 'threat')
  const policy = groups.filter((g) => g.kind === 'policy')
  const scm = scmScanUrl(r)
  // The drawer reads AIMS by scan id — no id, no drawer.
  const openTel = r?.uuid && onOpenTelemetry ? onOpenTelemetry : null
  const signals = threatSignals(threats.flatMap((g) => g.items)).filter((s) => s.module && !/layer/i.test(s.label))

  const where = v === 'blocked'
    ? (threats.length ? 'a threat in the artifact' : 'a policy rule')
    : v === 'allowed' ? (r?.security_group_name ?? 'security group')
    : v === 'scanning' ? (record.source === 'local' ? 'scanning on this host' : 'AIRS is reading the repo')
    : 'the scan did not complete'
  const why = v === 'blocked'
    ? (signals.length ? `Runs on load: ${signals.map((s) => s.label).join(', ')}`
      : threats.length ? [...new Set(threats.map((g) => g.threat || g.name))].join(' · ')
      : policy.map((g) => g.name).join(' · ') || `${failed} of ${total} rules failed`)
    : v === 'allowed' ? `All ${total} rules passed`
    : v === 'scanning' ? 'Evaluating every rule in the security group'
    : 'See the fault in the transcript'
  const note = v === 'blocked'
    ? (threats.length
        ? 'Blocked by Prisma AIRS Model Security — the artifact carries code that runs when it is loaded.'
        : 'Blocked on policy. Nothing malicious was found; the model breaks a rule this security group enforces.')
    : v === 'allowed' ? 'Allowed — every rule in the security group passed. Safe to load.'
    : v === 'scanning' ? 'Waiting for Prisma AIRS Model Security to evaluate the security group.'
    : (record.error?.message || r?.error_message || 'The scan did not complete.')

  return (
    <EvidenceLook.Provider value="band">
      <div className="h-full flex flex-col overflow-hidden" style={glass(t, { radius: 22 })}>
        <BandVerdict t={t} v={v} record={record} why={why} where={where} />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 pt-3 pb-3">
            <p style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.5, color: t.inkDim, overflowWrap: 'anywhere' }}>{note}</p>
            {scm && <ScmCta t={t} href={scm} />}
            {openTel && <TelemetryCta t={t} onOpen={openTel} />}
          </div>

          <ModelRow t={t} rec={record} />

          {r && total > 0 && (
            <Block t={t} title="Security group" icon={ListChecks} accent={failed ? t.block : t.pass}
                   sub={`${r.security_group_name ?? 'security group'} · ${failed ? `${failed} of ${total} failed` : `all ${total} passed`}`}
                   count={`${failed} of ${total}`}>
              <RuleMeter t={t} total={total} passed={passed} failed={failed} />
              {groups.length > 0 && (
                <>
                  <div style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.inkDim, margin: '14px 0 6px' }}>
                    {groups.length} rule{groups.length === 1 ? '' : 's'} failed · {r.violations.length} finding{r.violations.length === 1 ? '' : 's'}{openTel ? ' — open one for its findings and fix' : ''}
                  </div>
                  <div className="space-y-1.5">
                    {groups.map((g) => <RuleRow key={g.key} t={t} g={g} onOpen={openTel} />)}
                  </div>
                </>
              )}
              {v === 'allowed' && (
                <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 10 }}>All {total} rules ran and none failed.</p>
              )}
              {r?.violations_error && (
                <p className="mt-2 px-3 py-2 rounded-xl" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, background: `${t.warn}14` }}>
                  The verdict is real, but the rule details could not be fetched: <span style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>{r.violations_error}</span>
                </p>
              )}
            </Block>
          )}

        </div>
      </div>
    </EvidenceLook.Provider>
  )
}
