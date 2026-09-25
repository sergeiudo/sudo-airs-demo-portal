import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Ban, ShieldCheck, AlertTriangle, Biohazard, Scale, Link2, FileBox, Copy, Check, RotateCcw,
  ExternalLink, ListChecks, BookOpen, ChevronRight, Crosshair, History,
} from 'lucide-react'
import { FONT, label as LBL, bloom } from '../api-intercept-2027/tokens'
import { Reveal, Chip, Copyable } from '../api-intercept-2027/RecordStream'
import { Markdown } from '../api-intercept-2027/Markdown'
import {
  LIBRARY, KIND_TONE, SCAN_META, scanVerdict, ruleCounts, groupViolations, threatSignals,
  scanFault, fmtBytes, isTempCopy,
} from './scanModel'

/**
 * ScanStream — the session as a stack of exchanges, the way the runtime
 * console renders a conversation: the request on the right, the verdict on the
 * left, the evidence folded underneath it.
 *
 * A block is a full vermilion notice, not a red badge: it says what fired and
 * that the model was never loaded, which is the question the room asks next.
 * Rule findings are grouped by rule, so "7 rules failed" and the list under it
 * finally count the same thing.
 */

const basename = (p) => String(p ?? '').split('/').pop()

function Action({ t, icon: Icon, children, onClick, href, tone, title }) {
  const style = { fontFamily: FONT.prose, fontSize: 10, fontWeight: 500, color: tone || t.inkFaint, opacity: tone ? 1 : 0.8 }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={title}
         className="flex items-center gap-1 hover:opacity-100" style={style}>
        <Icon size={11} /> {children}
      </a>
    )
  }
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick() }} title={title}
            className="flex items-center gap-1 hover:opacity-100" style={style}>
      <Icon size={11} /> {children}
    </button>
  )
}

function Actions({ t, rec, onRescan, busy }) {
  const [copied, setCopied] = useState(false)
  const isHf = rec.source === 'huggingface'
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 mt-1.5 px-0.5">
      <Action t={t} icon={copied ? Check : Copy} tone={copied ? t.pass : null} title="Copy the model id"
              onClick={() => { navigator.clipboard?.writeText(rec.target); setCopied(true); setTimeout(() => setCopied(false), 1100) }}>
        {copied ? 'Copied' : 'Copy'}
      </Action>
      {isHf && !busy && (
        <Action t={t} icon={RotateCcw} title="Scan this model again" onClick={() => onRescan(rec)}>Scan again</Action>
      )}
      {isHf && (
        <Action t={t} icon={ExternalLink} href={`https://huggingface.co/${rec.target}`} title="Open the repo on Hugging Face">
          Hugging Face
        </Action>
      )}
    </div>
  )
}

/** Blocked: an incident note from the control, not an error from the app. */
function BlockedNotice({ t, result, groups, uploadName }) {
  const { total, failed } = ruleCounts(result)
  const threats = groups.filter((g) => g.kind === 'threat')
  const policy = groups.filter((g) => g.kind === 'policy')
  const threatItems = threats.flatMap((g) => g.items)
  // Operators only — a custom or Lambda layer is a runtime/structural finding,
  // not a call that executes on load, and the sentence below claims the latter.
  const signals = threatSignals(threatItems).filter((s) => s.module && !/layer/i.test(s.label))
  const found = threatItems.find((v) => v.file)?.file
  const file = found && uploadName && isTempCopy(found) ? uploadName : found

  const headline = threats.length
    ? 'Prisma AIRS Model Security found code that runs on load, and blocked this model.'
    : 'Prisma AIRS Model Security blocked this model on policy, before it could be loaded.'

  const facts = [
    `${failed} of ${total} rules in ${result.security_group_name ?? 'the security group'} failed.`,
    threats.length
      ? (signals.length
          ? `Code that executes on load: ${signals.map((s) => s.label).join(', ')}${file ? ` — in ${basename(file)}` : ''}.`
          : `Threats detected: ${[...new Set(threats.map((g) => g.threat).filter(Boolean))].join(', ') || threats.map((g) => g.name).join(', ')}.`)
      : `No malware found — the block is policy: ${policy.map((g) => g.name).join(' · ')}.`,
    'This app never loaded the model — the verdict comes before the load, not after it.',
  ]

  return (
    <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                className="relative overflow-hidden px-5 py-4 w-full"
                style={{ background: t.block, borderRadius: 26, borderBottomLeftRadius: 8, boxShadow: `0 14px 34px ${t.block}55` }}>
      <span className="absolute pointer-events-none" style={{ right: -40, top: -40, width: 150, height: 150, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.16)' }} />
      <span className="absolute pointer-events-none" style={{ right: -14, top: -58, width: 150, height: 150, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)' }} />
      <div className="relative flex items-start gap-3">
        <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.18)' }}>
          <Ban size={16} color="#fff" />
        </span>
        <div className="min-w-0">
          <p style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: '#fff' }}>{headline}</p>
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.22)' }}>
            <div style={{ ...LBL, fontSize: 8, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>Model security · scan context</div>
            <ul className="space-y-1.5">
              {facts.map((f) => (
                <li key={f} className="flex items-start gap-2"
                    style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.94)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>·</span>{f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function AllowedNotice({ t, result }) {
  const { total } = ruleCounts(result)
  return (
    <div className="px-4 py-3 w-full"
         style={{ background: t.sunken, border: `1px solid ${t.pass}44`, borderRadius: 20, borderBottomLeftRadius: 6 }}>
      <p style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>Cleared — safe to load.</p>
      <p style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.6, color: t.inkDim, marginTop: 3 }}>
        All {total} rules in <span style={{ fontFamily: FONT.mono, fontSize: 11.5 }}>{result.security_group_name ?? 'the security group'}</span> passed
        across {result.total_files_scanned ?? '—'} file{result.total_files_scanned === 1 ? '' : 's'}. No threat signatures, and license,
        publisher and file formats are all within policy.
      </p>
      {result.model_formats?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {result.model_formats.map((f) => (
            <span key={f} className="px-2 py-0.5 rounded-full"
                  style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.pass, background: `${t.pass}14`, border: `1px solid ${t.pass}33` }}>{f}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function InFlight({ t, rec }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full"
         style={{ background: t.sunken, border: `1px solid ${t.live}3a`, borderBottomLeftRadius: 6 }}>
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="rounded-full" style={{ width: 7, height: 7, background: t.live, boxShadow: bloom(t.live, 0.8) }}
                     animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                     transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }} />
      ))}
      <div className="min-w-0">
        <div style={{ ...LBL, fontSize: 9.5, color: t.live }}>Scanning</div>
        <div style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint }}>
          {rec.source === 'local' ? 'Scanning on this host, then evaluating the findings against the security group…'
                                  : 'Prisma AIRS is reading the repo and evaluating every rule in the security group…'}
        </div>
      </div>
    </div>
  )
}

/** A failed scan diagnoses itself, like the runtime console's FaultNotice. */
function FaultNotice({ t, error }) {
  const f = scanFault(error)
  return (
    <div className="px-4 py-3 w-full" style={{ background: `${t.warn}0f`, border: `1px solid ${t.warn}44`, borderRadius: 20, borderBottomLeftRadius: 6 }}>
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle size={13} style={{ color: t.warn }} />
        <span style={{ ...LBL, fontSize: 9, color: t.warn }}>{f.title}{error?.status ? ` · HTTP ${error.status}` : ''}</span>
      </div>
      {error?.message && (
        <p style={{ fontFamily: FONT.mono, fontSize: 10.5, lineHeight: 1.5, color: t.inkDim, overflowWrap: 'anywhere' }}>{error.message}</p>
      )}
      {f.why && <p className="mt-2" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.55, color: t.inkDim }}>{f.why}</p>}
      {f.cmd && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl" style={{ background: t.codeBg, border: `1px solid ${t.hairline}` }}>
          <span className="flex-1 min-w-0" style={{ fontFamily: FONT.mono, fontSize: 11.5, color: t.ink, userSelect: 'all' }}>{f.cmd}</span>
          <Copyable t={t} text={f.cmd} />
        </div>
      )}
      {f.after && <p className="mt-1.5" style={{ fontFamily: FONT.prose, fontSize: 10, lineHeight: 1.5, color: t.inkFaint }}>{f.after}</p>}
    </div>
  )
}

const STATE_TONE = (t, s) => (s === 'BLOCKING' ? t.block : s === 'WARNING' ? t.warn : t.idle)

/** One failed rule, with every finding it produced and how to fix it. */
function RuleGroup({ t, g, uploadName }) {
  const [all, setAll] = useState(false)
  const [fix, setFix] = useState(false)
  const Icon = g.kind === 'threat' ? Biohazard : Scale
  const tone = KIND_TONE[g.kind]
  const signals = g.kind === 'threat' ? threatSignals(g.items) : []
  // A threat rule firing on six operators is six near-identical sentences;
  // the chips above already name them, so one sentence stands for the set.
  const limit = signals.length ? 1 : 3
  const shown = all ? g.items : g.items.slice(0, limit)
  const steps = g.remediation?.steps ?? []

  return (
    <div className="px-3 py-2.5 mb-2 last:mb-0"
         style={{ background: t.panel, borderRadius: 14, border: `1px solid ${t.hairline}` }}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Icon size={12} style={{ color: tone, flexShrink: 0 }} />
        <span style={{ fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: t.ink }}>{g.name}</span>
        <Chip t={t} tone={STATE_TONE(t, g.state)}>{g.state.toLowerCase()}</Chip>
        {g.threat && <Chip t={t} tone={t.block}>{g.threat}</Chip>}
        {g.items.length > 1 && (
          <span style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkFaint }}>×{g.items.length}</span>
        )}
      </div>
      {g.description && (
        <p style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: 1.45, color: t.inkFaint, marginTop: 2 }}>{g.description}</p>
      )}

      {signals.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {signals.map((s) => (
            <span key={s.label} dir="ltr" className="px-1.5 py-0.5 rounded"
                  title={s.module ? `from module ${s.module}` : undefined}
                  style={{ fontFamily: FONT.mono, fontSize: 10, fontWeight: 600, color: t.block, background: `${t.block}14`, border: `1px solid ${t.block}38` }}>
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 space-y-1.5">
        {shown.map((v) => (
          <div key={v.uuid} className="pl-2.5" style={{ borderLeft: `2px solid ${tone}55` }}>
            <div style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.5, color: t.inkDim }}>
              <Markdown text={v.description ?? v.threat_description ?? ''} t={t} />
            </div>
            {v.file && (
              <span className="inline-block mt-0.5 truncate max-w-full" dir="ltr" title={v.hash ? `sha1 ${v.hash}` : undefined}
                    style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkFaint }}>
                {v.file}{uploadName && isTempCopy(v.file) ? ` · temp copy of ${uploadName}` : ''}
              </span>
            )}
          </div>
        ))}
        {g.items.length > limit && (
          <button onClick={(e) => { e.stopPropagation(); setAll((a) => !a) }}
                  style={{ ...LBL, fontSize: 8, color: t.inkFaint }}>
            {all ? 'show fewer' : `show ${g.items.length - limit} more finding${g.items.length - limit === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-2">
        {steps.length > 0 && (
          <button onClick={(e) => { e.stopPropagation(); setFix((f) => !f) }}
                  className="flex items-center gap-1" style={{ ...LBL, fontSize: 8.5, color: fix ? t.ink : t.inkDim }}>
            <ChevronRight size={10} style={{ transform: fix ? 'rotate(90deg)' : 'none', transition: 'transform 160ms' }} />
            How to fix
          </button>
        )}
        {g.kbUrl && (
          <a href={g.kbUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
             className="flex items-center gap-1" style={{ ...LBL, fontSize: 8.5, color: t.live }}>
            <BookOpen size={10} /> {g.threat ?? 'threat'} knowledge base
          </a>
        )}
        {g.insightsUrl && (
          <a href={g.insightsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
             className="flex items-center gap-1" style={{ ...LBL, fontSize: 8.5, color: t.live }}>
            <ExternalLink size={10} /> file in AI model insights
          </a>
        )}
      </div>

      <AnimatePresence initial={false}>
        {fix && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }} className="overflow-hidden">
            <ol className="mt-2 space-y-1">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-2" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.5, color: t.inkDim }}>
                  <span style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkFaint, minWidth: 14 }}>{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            {g.remediation?.url && (
              <a href={g.remediation.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                 className="inline-flex items-center gap-1 mt-1.5" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.live }}>
                Rule documentation <ExternalLink size={9} />
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Record({ t, rec, selected, onSelect, onRescan, busy }) {
  const [hover, setHover] = useState(false)
  const v = scanVerdict(rec)
  const meta = SCAN_META[v]
  const preset = LIBRARY.find((l) => l.id === rec.preset)
  const r = rec.result
  const groups = useMemo(() => groupViolations(r?.violations), [r])
  const findings = r?.violations?.length ?? 0
  // A history record can be weeks old; the date matters there, not just the time.
  const time = rec.fromScm
    ? new Date(rec.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date(rec.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const isHf = rec.source === 'huggingface'
  const expectTone = preset?.expect === 'ALLOWED' ? t.pass : t.block
  // The library's verdicts are predictions. When a scan disagrees, say so —
  // that is exactly how the old "Clean Demo" went stale unnoticed.
  const drift = preset && (v === 'allowed' || v === 'blocked') && v.toUpperCase() !== preset.expect

  return (
    <motion.div layout
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
                onClick={() => onSelect(rec.id)}
                className="px-5 py-2"
                style={{ background: selected ? `${meta.color}08` : 'transparent', borderRadius: 14 }}>

      {/* ── the request ── */}
      <div className="flex justify-end">
        <div className="flex flex-col items-end" style={{ maxWidth: '74%' }}>
          {rec.fromScm && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="px-1.5 rounded-full inline-flex items-center gap-1"
                    style={{ ...LBL, fontSize: 7.5, color: t.live, background: `${t.live}14`, border: `1px solid ${t.live}40` }}>
                <History size={8} /> from SCM history
              </span>
            </div>
          )}
          {preset && (
            <div className="flex items-center gap-1.5 mb-1">
              <span style={{ fontFamily: FONT.display, fontSize: 10.5, fontWeight: 700, color: t.inkDim }}>{preset.title}</span>
              <span className="px-1.5 rounded-full"
                    style={{ ...LBL, fontSize: 7.5, color: expectTone, background: `${expectTone}1c`, border: `1px solid ${expectTone}44` }}>
                expect {preset.expect.toLowerCase()}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2.5 px-4 py-3"
               style={{
                 background: t.isLight ? 'rgba(74,118,240,0.09)' : 'rgba(74,118,240,0.16)',
                 border: `1px solid ${t.isLight ? 'rgba(74,118,240,0.20)' : 'rgba(74,118,240,0.28)'}`,
                 borderRadius: 20, borderBottomRightRadius: 6,
               }}>
            {isHf ? <Link2 size={14} style={{ color: t.live, flexShrink: 0 }} /> : <FileBox size={14} style={{ color: t.live, flexShrink: 0 }} />}
            <span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 13, color: t.ink, wordBreak: 'break-all' }}>{rec.target}</span>
          </div>
          <span className="mt-1" style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>
            {time} · {isHf ? 'hugging face' : `local file${rec.size != null ? ` · ${fmtBytes(rec.size)}` : ''}`}
          </span>
          <AnimatePresence>
            {(hover || selected) && (
              <motion.div initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Actions t={t} rec={rec} onRescan={onRescan} busy={busy} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── the verdict ── */}
      <div className="flex justify-start mt-2.5">
        <div className="flex flex-col items-start w-full" style={{ maxWidth: '82%' }}>
          {v === 'scanning' ? <InFlight t={t} rec={rec} />
            : v === 'blocked' ? <BlockedNotice t={t} result={r} groups={groups} uploadName={isHf || rec.fromScm ? null : rec.target} />
            : v === 'allowed' ? <AllowedNotice t={t} result={r} />
            : <FaultNotice t={t} error={rec.error ?? { message: r?.error_message || `Scan returned ${r?.eval_outcome ?? 'no outcome'}` }} />}

          {v !== 'scanning' && (
            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              {v !== 'blocked' && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                      style={{ background: `${meta.color}1a`, border: `1px solid ${meta.color}55` }}>
                  {v === 'allowed' ? <ShieldCheck size={10} style={{ color: meta.color }} /> : <AlertTriangle size={10} style={{ color: meta.color }} />}
                  <span style={{ ...LBL, fontSize: 8.5, color: meta.color }}>{meta.label}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
                <Crosshair size={9} style={{ color: t.inkFaint }} />
                {isHf ? 'Hugging Face' : 'local file'}
              </span>
              {r?.scanner_version && (
                <span style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>scanner {r.scanner_version}</span>
              )}
            </div>
          )}

          {drift && (
            <p className="mt-2 px-3 py-2 rounded-xl flex items-start gap-1.5"
               style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: 1.45, color: t.inkDim, background: `${t.warn}14`, border: `1px solid ${t.warn}3a` }}>
              <AlertTriangle size={11} style={{ color: t.warn, flexShrink: 0, marginTop: 2 }} />
              <span>
                The library expected <strong style={{ color: t.ink }}>{preset.expect}</strong> ({preset.measured}). The security group's
                rules have changed since that was measured — the scan is right, the label is stale.
              </span>
            </p>
          )}

          {groups.length > 0 && (
            <div className="w-full mt-2">
              <Reveal t={t} icon={ListChecks} title="Rule findings" accent={meta.color}
                      count={`${groups.length} rule${groups.length === 1 ? '' : 's'} · ${findings} finding${findings === 1 ? '' : 's'}`}>
                {groups.map((g) => <RuleGroup key={g.key} t={t} g={g} uploadName={isHf || rec.fromScm ? null : rec.target} />)}
              </Reveal>
            </div>
          )}

          {r?.violations_error && (
            <p className="mt-2 px-3 py-2 rounded-xl" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim, background: `${t.warn}12` }}>
              The verdict is real, but the rule details could not be fetched: <span style={{ fontFamily: FONT.mono }}>{r.violations_error}</span>
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function ScanStream({ t, records, selectedId, onSelect, onRescan, busy, empty }) {
  const endRef = useRef(null)
  const statusKey = records.map((r) => r.status).join()
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [records.length, statusKey])

  if (!records.length) return <div className="flex-1 overflow-y-auto min-h-0 flex">{empty}</div>

  return (
    <div className="flex-1 overflow-y-auto min-h-0 pt-3">
      <AnimatePresence initial={false}>
        {records.map((rec) => (
          <Record key={rec.id} t={t} rec={rec} selected={rec.id === selectedId}
                  onSelect={onSelect} onRescan={onRescan} busy={busy} />
        ))}
      </AnimatePresence>
      <div ref={endRef} />
    </div>
  )
}
