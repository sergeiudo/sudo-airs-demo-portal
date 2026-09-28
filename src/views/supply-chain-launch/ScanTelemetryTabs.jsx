import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldX, ShieldCheck, Biohazard, Scale, ListChecks, FileWarning, Files, Layers, Check, X, ChevronDown, ChevronRight,
  Folder, FolderOpen, File as FileIcon, Loader2, BookOpen, ExternalLink, Wrench, Clock, Package, GitCommitHorizontal,
  Boxes, Settings2, Cpu, Braces, Link2,
} from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade } from '../home-2027/band'
import { Card, KV, Stat, IconSquare, IdValue, CopyButton, Note, Empty, fmtMs, fmtNum } from '../../components/api-intercept/telemetry/primitives'
import { Markdown } from '../api-intercept-2027/Markdown'
import { ruleCounts, threatSignals, unapprovedFormats, filesWithFindings, parseTarget, isTempCopy } from '../model-scanning-2027/scanModel'
import { useFolder, seedFolder, stamp, relative, msBetween, leaf } from './scanTelemetry'

/**
 * ScanTelemetryTabs — the body of the scan telemetry drawer.
 *
 *   Overview  numbers, the rule map (artifact vs metadata checks), how AIRS
 *             decided, and when.
 *   Rules     every rule the group evaluated — failed ones open onto their
 *             findings, configured values and fix; passed ones say what they
 *             checked and how they are configured.
 *   Files     the scanned tree from AIMS, a folder at a time, each file with
 *             its result, formats and blob hash.
 *   Model     provenance (Hugging Face commit, licence), the AIRS inventory
 *             record, the security group and the scanner.
 *   Raw       every payload the drawer is built from.
 *
 * Built on the runtime drawer's primitives in their launch look (Card, KV,
 * Stat), so the two drawers read as one system.
 */

const inkOf = (t, tone, k = 0.28) => (t.isLight ? shade(tone, k) : tone)
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const cap = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : s)
const SOURCE_LABEL = { HUGGING_FACE: 'Hugging Face', LOCAL: 'Local file', S3: 'Amazon S3', GCS: 'Google Cloud Storage', AZURE: 'Azure Blob Storage', ARTIFACTORY: 'Artifactory', GITLAB: 'GitLab' }
const sourceLabel = (s) => (s ? SOURCE_LABEL[String(s).toUpperCase()] ?? cap(s) : null)
const ruleTone = (t, r) => (r.result !== 'FAILED' ? t.pass : r.state === 'BLOCKING' ? t.block : t.warn)

function Pill({ t, tone, children, strike, title, mono }) {
  const c = tone || t.inkDim
  return (
    <span title={title} className="inline-flex items-center gap-1 rounded-full px-2 whitespace-nowrap"
          style={{
            fontFamily: mono ? FONT.mono : FONT.prose, fontSize: mono ? 10.5 : 11, fontWeight: 600, lineHeight: '19px',
            color: tone ? inkOf(t, c) : t.inkDim, background: tone ? `${c}17` : t.sunken,
            textDecoration: strike ? 'line-through' : 'none',
          }}>
      {children}
    </span>
  )
}

function FormatChips({ t, formats = [], bad }) {
  if (!formats.length) return <span style={{ color: t.inkFaint }}>—</span>
  return (
    <span className="flex flex-wrap gap-1">
      {formats.map((f) => (
        <span key={f} dir="ltr" className="rounded-full px-2" title={bad?.has(f) ? 'not on this security group’s approved-format list' : undefined}
              style={{
                fontFamily: FONT.mono, fontSize: 10.5, lineHeight: '19px',
                color: bad?.has(f) ? inkOf(t, t.block, 0.2) : t.inkDim, background: bad?.has(f) ? `${t.block}14` : t.sunken,
                textDecoration: bad?.has(f) ? 'line-through' : 'none',
              }}>{f}</span>
      ))}
    </span>
  )
}

/** A rule's configured values — "Approved formats: safetensors · json …". */
function FieldValues({ t, fields }) {
  const set = (fields ?? []).filter((f) => f.value != null)
  if (!set.length) return null
  return (
    <div className="space-y-1.5">
      {set.map((f) => (
        <div key={f.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span title={f.description ?? undefined} style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.inkDim }}>{f.label}</span>
          {Array.isArray(f.value)
            ? (f.value.length
                ? f.value.map((v) => <span key={v} dir="ltr" className="rounded-full px-2" style={{ fontFamily: FONT.mono, fontSize: 10.5, lineHeight: '19px', color: t.ink, background: t.sunken }}>{v}</span>)
                : <span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkFaint }}>none configured</span>)
            : <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.ink }}>{String(f.value)}</span>}
        </div>
      ))}
    </div>
  )
}

function When({ t, iso, now }) {
  const s = stamp(iso)
  if (!s) return <span style={{ color: t.inkFaint }}>—</span>
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span style={{ fontWeight: 600 }}>{s.date}</span>
      <span style={{ fontFamily: FONT.mono, fontSize: 11 }}>{s.time}</span>
      <span style={{ color: t.inkDim, fontSize: 11.5 }}>{relative(now - s.ms)}</span>
    </span>
  )
}

function StoryRow({ t, icon, tone, title, children }) {
  return (
    <div className="flex items-start gap-3">
      <IconSquare t={t} icon={icon} tone={tone} size={32} />
      <div className="min-w-0 flex-1">
        <div style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{title}</div>
        <div style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.inkDim, marginTop: 2 }}>{children}</div>
      </div>
    </div>
  )
}

function DocLink({ t, href, icon: Icon = ExternalLink, children }) {
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1"
       style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.live }}>
      <Icon size={12} aria-hidden="true" /> {children}
    </a>
  )
}

// ─── Overview ────────────────────────────────────────────────────────────────

const TYPE_ROWS = [
  { type: 'ARTIFACT', title: 'Artifact checks', sub: 'What is inside the files — code that runs on load, backdoors, unknown operators.' },
  { type: 'METADATA', title: 'Metadata checks', sub: 'Who published it, under what licence, in which file formats.' },
]

function RuleTile({ t, r, onRule }) {
  const [hot, setHot] = useState(false)
  const tone = ruleTone(t, r)
  const failed = r.result === 'FAILED'
  return (
    <button type="button" onClick={() => onRule(r.id)} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            title={r.description ?? undefined}
            className="text-left rounded-2xl flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
            style={{
              padding: '10px 11px', minHeight: 84,
              background: failed ? `${tone}10` : t.sunken,
              border: `1px solid ${failed ? `${tone}${hot ? '88' : '4d'}` : hot ? `${t.pass}66` : t.hairline}`,
              boxShadow: hot ? `0 8px 18px ${tone}24` : 'none', transition: 'border-color 150ms ease, box-shadow 180ms ease',
            }}>
      <span className="flex items-center gap-2">
        <span className="grid place-items-center rounded-full flex-shrink-0" style={{ width: 18, height: 18, background: failed ? tone : `${tone}24`, color: failed ? '#fff' : inkOf(t, tone) }}>
          {failed ? <X size={11} strokeWidth={3} aria-hidden="true" /> : <Check size={11} strokeWidth={3} aria-hidden="true" />}
        </span>
        <span style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600, color: failed ? inkOf(t, tone) : t.inkDim }}>
          {failed ? `failed · ${r.state.toLowerCase()}` : 'passed'}
        </span>
        {failed && r.count > 0 && <span className="ml-auto" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: inkOf(t, tone) }}>{r.count}</span>}
      </span>
      <span style={{
        fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, lineHeight: 1.3, marginTop: 7,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{r.name}</span>
    </button>
  )
}

function RuleMap({ t, rules, onRule }) {
  const typed = rules.list.some((r) => r.type)
  const rows = typed
    ? [...TYPE_ROWS.map((row) => ({ ...row, list: rules.list.filter((r) => r.type === row.type) })),
       { type: 'other', title: 'Other rules', sub: null, list: rules.list.filter((r) => !r.type || !TYPE_ROWS.some((x) => x.type === r.type)) }]
    : [{ type: 'all', title: null, sub: null, list: rules.list }]
  const failed = rules.list.filter((r) => r.result === 'FAILED').length
  return (
    <Card t={t} title={`Rule map · ${rules.list.length} rules`} icon={Boxes} tone={failed ? t.block : t.pass}
          right={<span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>click a rule for the detail</span>}>
      <div className="space-y-4">
        {rows.filter((row) => row.list.length).map((row) => (
          <div key={row.type}>
            {row.title && (
              <div className="flex items-baseline gap-2 flex-wrap mb-2">
                <span style={{ fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: t.ink }}>{row.title}</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>
                  {row.list.filter((r) => r.result === 'FAILED').length} of {row.list.length} failed
                </span>
                {row.sub && <span className="basis-full" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>{row.sub}</span>}
              </div>
            )}
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {row.list.map((r) => <RuleTile key={r.id} t={t} r={r} onRule={onRule} />)}
            </div>
          </div>
        ))}
      </div>
      {rules.partial && (
        <Note t={t}>Only the failed rules are listed — the per-rule evaluations did not load, so the rules that passed cannot be named.</Note>
      )}
    </Card>
  )
}

export function OverviewTab({ t, record, tel, rules, onRule, now }) {
  const r = record.result
  const { total, passed, failed } = ruleCounts(r)
  const violations = r.violations ?? []
  const bad = unapprovedFormats(violations)
  const hits = filesWithFindings(violations)
  const counts = r.violations_counts ?? {}
  const blocked = String(r.eval_outcome ?? '').toUpperCase().includes('BLOCK')
  const failedRules = rules.list.filter((x) => x.result === 'FAILED')
  const threatRules = failedRules.filter((x) => x.kind === 'threat')
  const policyRules = failedRules.filter((x) => x.kind !== 'threat')
  const allBlocking = failedRules.length > 0 && failedRules.every((x) => x.state === 'BLOCKING')
  const formatRule = rules.list.find((x) => x.fields?.some((f) => f.key === 'approved_formats'))
  const approvedFormats = formatRule?.fields.find((f) => f.key === 'approved_formats')?.value
  const licenseRule = rules.list.find((x) => x.fields?.some((f) => f.key === 'approved_licenses'))
  const artifactPassed = rules.list.filter((x) => x.type === 'ARTIFACT' && x.result !== 'FAILED').length
  const v = tel?.version
  const evalMs = msBetween(r.time_started, r.updated_at)

  // One line per distinct PAIT code, with the files it was found in.
  const threats = (() => {
    const map = new Map()
    for (const g of threatRules) {
      for (const item of g.group?.items ?? []) {
        const code = item.threat || g.name
        if (!map.has(code)) map.set(code, { code, desc: item.threat_description, kb: item.threat_kb_url, files: new Set(), items: [] })
        const e = map.get(code)
        if (item.file) e.files.add(item.file)
        e.items.push(item)
      }
    }
    return [...map.values()]
  })()

  return (
    <div className="space-y-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Stat t={t} label="Rules" icon={ListChecks} value={failed ? `${failed} failed` : 'All passed'}
              sub={`${passed} passed · ${total} evaluated`} tone={failed ? t.block : t.pass} />
        <Stat t={t} label="Findings" icon={FileWarning} value={fmtNum(violations.length)}
              sub={Object.entries(counts).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(' · ') || 'none'} tone={violations.length ? t.block : t.pass} />
        <Stat t={t} label="Files" icon={Files} value={fmtNum(r.total_files_scanned)}
              sub={`${hits.length} with findings${r.total_files_skipped ? ` · ${r.total_files_skipped} skipped` : ''}`} />
        <Stat t={t} label="Formats" icon={Layers} value={fmtNum(r.model_formats?.length ?? 0)}
              sub={bad.size ? `${bad.size} not approved` : formatRule ? 'all approved' : 'detected'} tone={bad.size ? t.warn : undefined} />
      </div>

      <RuleMap t={t} rules={rules} onRule={onRule} />

      <Card t={t} title="How AIRS decided" icon={blocked ? ShieldX : ShieldCheck} tone={blocked ? t.block : t.pass}>
        <div className="space-y-4">
          <StoryRow t={t} icon={blocked ? ShieldX : ShieldCheck} tone={blocked ? t.block : t.pass}
                    title={`${blocked ? 'Blocked' : 'Allowed'} by ${r.security_group_name ?? 'the security group'}`}>
            {blocked
              ? <>{failed} of {total} rules failed{allBlocking ? ', every one in blocking mode' : ''}. A single failure in blocking mode stops the load — the model is never deserialised.</>
              : <>All {total} rules passed. Nothing in the artifact runs on load and the model meets every policy the group enforces.</>}
          </StoryRow>

          {threats.length > 0 ? (
            <StoryRow t={t} icon={Biohazard} tone={t.block} title="Threat in the artifact">
              <div className="space-y-2.5 mt-1">
                {threats.map((x) => {
                  const ops = threatSignals(x.items)
                  return (
                    <div key={x.code}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Pill t={t} tone={t.block} mono>{x.code}</Pill>
                        {x.desc && <span style={{ color: t.ink }}>{x.desc}</span>}
                      </div>
                      {ops.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          <span style={{ fontSize: 11.5 }}>Runs on load:</span>
                          {ops.map((o) => <Pill key={o.label} t={t} tone={t.block} mono title={o.module ? `from module ${o.module}` : undefined}>{o.label}{o.module ? ` · ${o.module}` : ''}</Pill>)}
                        </div>
                      )}
                      {x.files.size > 0 && (
                        <div className="mt-1" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>in {[...x.files].join(' · ')}</div>
                      )}
                      {x.kb && <div className="mt-1"><DocLink t={t} href={x.kb} icon={BookOpen}>{x.code} in the knowledge base</DocLink></div>}
                    </div>
                  )
                })}
              </div>
            </StoryRow>
          ) : artifactPassed > 0 ? (
            <StoryRow t={t} icon={Biohazard} tone={t.pass} title="No threat in the artifact">
              All {artifactPassed} artifact checks passed — no load-time code execution, backdoor or unknown operator was found.
            </StoryRow>
          ) : null}

          {policyRules.length > 0 && (
            <StoryRow t={t} icon={Scale} tone={t.warn} title={threats.length ? 'Policy, as well' : 'Policy, not malware'}>
              <ul className="space-y-1.5 mt-1">
                {policyRules.map((p) => {
                  const first = p.group?.items?.[0]
                  const isFormat = p.fields?.some((f) => f.key === 'approved_formats')
                  return (
                    <li key={p.id}>
                      <div style={{ color: t.ink, fontWeight: 600 }}>{p.name}</div>
                      {isFormat && bad.size > 0
                        ? <div>{[...bad].join(', ')} {bad.size === 1 ? 'is' : 'are'} not approved{approvedFormats?.length ? <> — the group approves {approvedFormats.join(', ')}</> : null}.</div>
                        : first?.description ? <Markdown text={first.description} t={t} /> : null}
                    </li>
                  )
                })}
              </ul>
            </StoryRow>
          )}

          {!blocked && licenseRule && v?.license && (
            <StoryRow t={t} icon={Scale} tone={t.pass} title="Policy met">
              Licence <span style={{ fontFamily: FONT.mono }}>{v.license}</span> is on the approved list, and every format the model ships is approved.
            </StoryRow>
          )}
        </div>
      </Card>

      <Card t={t} title="Timing" icon={Clock}>
        <KV t={t} k="Scan started"><When t={t} iso={r.time_started ?? r.created_at} now={now} /></KV>
        {evalMs != null && (
          <KV t={t} k="Result recorded" hint="time_started → updated_at on the scan record">
            <span style={{ fontFamily: FONT.mono, fontSize: 11.5 }}>+{fmtMs(evalMs)}</span>
            <span style={{ color: t.inkDim, fontSize: 11.5 }}> after the scan started, on AIRS’ own clock</span>
          </KV>
        )}
        {v?.created_at && <KV t={t} k="First seen by AIRS"><When t={t} iso={v.created_at} now={now} /></KV>}
        {v?.latest_scan_time && (
          <KV t={t} k="Latest scan">
            {v.latest_scan_time === r.created_at ? <span>this scan is the latest of this model version</span> : <When t={t} iso={v.latest_scan_time} now={now} />}
          </KV>
        )}
        <Note t={t}>AIRS times are recorded server-side. A first scan of a Hugging Face repo also waits for AIRS to fetch the files, which happens before the scan record starts.</Note>
      </Card>
    </div>
  )
}

// ─── Rules ───────────────────────────────────────────────────────────────────

function Finding({ t, v, tone, uploadName }) {
  return (
    <div className="pl-3" style={{ borderLeft: `2px solid ${tone}55` }}>
      <div style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.ink }}>
        <Markdown text={v.description ?? v.threat_description ?? ''} t={t} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
        {v.file && (
          <span className="truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim, maxWidth: '100%' }}>
            {v.file}{uploadName && isTempCopy(v.file) ? ` · temp copy of ${uploadName}` : ''}
          </span>
        )}
        {v.hash && (
          <span className="inline-flex items-center gap-1" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim }}>
            sha1 <IdValue t={t} value={v.hash} truncate={12} />
          </span>
        )}
        {v.insights_url && <DocLink t={t} href={v.insights_url}>in AI model insights</DocLink>}
      </div>
    </div>
  )
}

function FailedRule({ t, r, open, onToggle, uploadName, innerRef }) {
  const [all, setAll] = useState(false)
  const tone = ruleTone(t, r)
  const Icon = r.kind === 'threat' ? Biohazard : Scale
  const items = r.group?.items ?? []
  const shown = all ? items : items.slice(0, 6)
  const steps = r.remediation?.steps ?? []
  const threat = r.group?.threat
  return (
    <section ref={innerRef} className="rounded-2xl overflow-hidden"
             style={{ background: t.panel, border: `1px solid ${open ? `${tone}66` : `${tone}33`}`, boxShadow: open ? `0 10px 24px ${tone}1c` : t.shadowSm, scrollMarginTop: 12 }}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-start gap-3 text-left" style={{ padding: '12px 14px' }}>
        <IconSquare t={t} icon={Icon} tone={tone} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>{r.name}</span>
          <span className="flex flex-wrap items-center gap-1 mt-1.5">
            <Pill t={t} tone={tone}>failed · {r.state.toLowerCase()}</Pill>
            <Pill t={t}>{r.kind === 'threat' ? 'threat' : 'policy'}{r.type ? ` · ${r.type.toLowerCase()}` : ''}</Pill>
            {threat && <Pill t={t} tone={tone} mono>{threat}</Pill>}
            {r.count > 0 && <Pill t={t}>{plural(r.count, 'finding')}</Pill>}
          </span>
        </span>
        <ChevronDown size={15} className="flex-shrink-0" style={{ color: t.inkDim, marginTop: 8, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3.5" style={{ borderTop: `1px solid ${t.hairline}`, paddingTop: 12 }}>
              {r.description && <p style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.5, color: t.inkDim }}>{r.description}</p>}
              {r.fields?.some((f) => f.value != null) && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: t.sunken }}>
                  <div style={{ fontFamily: FONT.display, fontSize: 12, fontWeight: 700, color: t.ink, marginBottom: 6 }}>Configured in this security group</div>
                  <FieldValues t={t} fields={r.fields} />
                </div>
              )}
              {items.length > 0 && (
                <div>
                  <div style={{ fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: t.ink, marginBottom: 8 }}>Findings · {items.length}</div>
                  <div className="space-y-2.5">
                    {shown.map((v) => <Finding key={v.uuid} t={t} v={v} tone={tone} uploadName={uploadName} />)}
                  </div>
                  {items.length > shown.length || all ? (
                    <button type="button" onClick={() => setAll((a) => !a)} className="mt-2"
                            style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.live }}>
                      {all ? 'Show fewer' : `Show all ${items.length} findings`}
                    </button>
                  ) : null}
                </div>
              )}
              {steps.length > 0 && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: t.sunken }}>
                  <div className="flex items-center gap-1.5" style={{ fontFamily: FONT.display, fontSize: 12, fontWeight: 700, color: t.ink, marginBottom: 5 }}>
                    <Wrench size={12} aria-hidden="true" /> How to fix
                  </div>
                  <ol className="space-y-1">
                    {steps.map((s, i) => (
                      <li key={i} className="flex gap-2" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.inkDim }}>
                        <span style={{ fontFamily: FONT.mono, fontSize: 11, minWidth: 16 }}>{i + 1}.</span><span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <DocLink t={t} href={r.group?.kbUrl} icon={BookOpen}>{threat ?? 'Threat'} knowledge base</DocLink>
                <DocLink t={t} href={r.remediation?.url}>Rule documentation</DocLink>
              </div>
              <div className="flex flex-wrap gap-x-4" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
                <span>origin {r.origin ? cap(r.origin) : '—'}</span>
                <span className="inline-flex items-center gap-1">rule instance <IdValue t={t} value={r.id} truncate={13} /></span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function PassedRule({ t, r, innerRef, focused }) {
  return (
    <div ref={innerRef} className="flex items-start gap-3 rounded-2xl"
         style={{ padding: '11px 14px', background: t.panel, border: `1px solid ${focused ? `${t.pass}88` : t.hairline}`, scrollMarginTop: 12 }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: `${t.pass}14`, color: t.pass }}>
        <Check size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{r.name}</span>
          {r.type && <Pill t={t}>{r.type.toLowerCase()}</Pill>}
          <Pill t={t}>{r.state.toLowerCase()} mode</Pill>
        </span>
        {r.description && <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginTop: 2 }}>{r.description}</span>}
        {r.fields?.some((f) => f.value != null) && <div className="mt-2"><FieldValues t={t} fields={r.fields} /></div>}
      </span>
    </div>
  )
}

export function RulesTab({ t, record, rules, focus, focusKey }) {
  const [filter, setFilter] = useState('all')
  const failedList = rules.list.filter((r) => r.result === 'FAILED')
  const passedList = rules.list.filter((r) => r.result !== 'FAILED')
  const [openIds, setOpenIds] = useState(() => new Set(focus ? [focus] : failedList.slice(0, 1).map((r) => r.id)))
  const refs = useRef({})
  const uploadName = record.source === 'local' && !record.fromScm ? record.target : null

  // Opening the drawer at a rule: switch to it, open it, bring it into view.
  useEffect(() => {
    if (!focus) return
    setFilter('all')
    setOpenIds((s) => new Set([...s, focus]))
    const id = setTimeout(() => refs.current[focus]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    return () => clearTimeout(id)
  }, [focus, focusKey])

  const toggle = (id) => setOpenIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const pills = [['all', `All ${rules.list.length}`], ['failed', `Failed ${failedList.length}`], ['passed', `Passed ${passedList.length}`]]
  const accent = failedList.length ? t.block : t.pass

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {pills.map(([id, label]) => {
          const on = filter === id
          return (
            <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={on}
                    className="rounded-full px-3" style={{
                      height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: on ? 700 : 500,
                      color: on ? '#fff' : t.inkDim, background: on ? (id === 'passed' ? t.pass : id === 'failed' ? accent : t.ink) : t.sunken,
                      border: `1px solid ${on ? 'transparent' : t.hairline}`,
                    }}>{label}</button>
          )
        })}
        {failedList.length > 0 && filter !== 'passed' && (
          <button type="button" className="ml-auto" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.live }}
                  onClick={() => setOpenIds((s) => (s.size >= failedList.length ? new Set() : new Set(failedList.map((r) => r.id))))}>
            {openIds.size >= failedList.length ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {filter !== 'passed' && failedList.map((r) => (
        <FailedRule key={r.id} t={t} r={r} open={openIds.has(r.id)} onToggle={() => toggle(r.id)} uploadName={uploadName}
                    innerRef={(el) => { refs.current[r.id] = el }} />
      ))}
      {filter !== 'failed' && passedList.length > 0 && (
        <>
          {filter === 'all' && failedList.length > 0 && (
            <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, paddingTop: 6 }}>Passed</div>
          )}
          {passedList.map((r) => <PassedRule key={r.id} t={t} r={r} focused={focus === r.id} innerRef={(el) => { refs.current[r.id] = el }} />)}
        </>
      )}
      {rules.partial && <Note t={t}>The rules that passed are not listed — the per-rule evaluations did not load.</Note>}
      {!rules.list.length && <Empty t={t}>No rule evaluations on this scan.</Empty>}
    </div>
  )
}

// ─── Files ───────────────────────────────────────────────────────────────────

/**
 * A file's pill comes from its FINDINGS, not from AIMS's per-file `result`:
 * that result covers the artifact scan only, so a pickle blob that breaks the
 * approved-format policy still reads SUCCESS there — and the tree said "clean"
 * beside a file the header counted as having findings. A folder counts the
 * findings under it. AIMS's own result stays in the tooltip.
 */
const isThreat = (v) => /^PAIT-/i.test(v.threat ?? '')

function ResultPill({ t, item, hits }) {
  const raw = item.result ? `AIMS file result: ${item.result}` : undefined
  const dir = item.type === 'DIRECTORY'
  if (hits?.length) {
    const tone = hits.some(isThreat) ? t.block : t.warn
    return <Pill t={t} tone={tone} title={raw}>{dir ? `${plural(hits.length, 'finding')} inside` : plural(hits.length, 'finding')}</Pill>
  }
  if (item.result === 'FAILED') return <Pill t={t} tone={t.block} title={raw}>failed</Pill>
  if (item.result === 'SUCCESS') return <Pill t={t} tone={t.pass} title={raw}>clean</Pill>
  return item.result ? <Pill t={t} title={raw}>{cap(item.result)}</Pill> : null
}

function TreeNode({ t, uuid, item, depth, byFile, bad }) {
  const [open, setOpen] = useState(false)
  const dir = item.type === 'DIRECTORY'
  const prefix = `${String(item.path).replace(/\/+$/, '')}/`
  const hits = useMemo(
    () => (dir ? [...byFile.entries()].filter(([f]) => f.startsWith(prefix)).flatMap(([, vs]) => vs) : byFile.get(item.path)),
    [dir, byFile, prefix, item.path],
  )
  const expandable = dir || hits?.length
  const Icon = dir ? (open ? FolderOpen : Folder) : hits?.length || item.result === 'FAILED' ? FileWarning : FileIcon
  const iconTone = hits?.length ? (hits.some(isThreat) ? t.block : t.warn) : item.result === 'FAILED' ? t.block : t.inkDim
  // The toggle and the hash's copy button are siblings — never a button
  // inside a button.
  const Toggle = expandable ? 'button' : 'div'
  return (
    <>
      <div className="w-full flex items-center gap-2 rounded-lg" style={{ padding: '0 8px 0 0' }}
           onMouseEnter={(e) => { e.currentTarget.style.background = t.sunken }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
        <Toggle {...(expandable ? { type: 'button', onClick: () => setOpen((o) => !o), 'aria-expanded': open } : {})}
                className="flex-1 min-w-0 flex items-center gap-2 text-left"
                style={{ padding: '6px 0', paddingLeft: 8 + depth * 18, cursor: expandable ? 'pointer' : 'default' }}>
          <span className="flex-shrink-0" style={{ width: 12, color: t.inkFaint }} aria-hidden="true">
            {expandable ? <ChevronRight size={12} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} /> : null}
          </span>
          <Icon size={14} className="flex-shrink-0" style={{ color: iconTone }} aria-hidden="true" />
          <span className="truncate" dir="ltr" title={item.path} style={{ fontFamily: FONT.mono, fontSize: 11.5, fontWeight: dir ? 600 : 500, color: t.ink, minWidth: 0 }}>
            {leaf(item.path)}{dir ? '/' : ''}
          </span>
          {!dir && item.formats?.length > 0 && <span className="hidden sm:flex flex-shrink-0"><FormatChips t={t} formats={item.formats} bad={bad} /></span>}
          <span className="flex-1" />
          <ResultPill t={t} item={item} hits={hits} />
        </Toggle>
        {!dir && item.blob_id && (
          <span className="flex-shrink-0 inline-flex items-center" title={`blob ${item.blob_id}`}>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkFaint }}>{item.blob_id.slice(0, 8)}</span>
            <CopyButton t={t} text={item.blob_id} size={10} />
          </span>
        )}
      </div>
      {open && dir && <FolderChildren t={t} uuid={uuid} path={`/${item.path.replace(/^\/+|\/+$/g, '')}/`} depth={depth + 1} byFile={byFile} bad={bad} />}
      {open && !dir && hits?.length > 0 && (
        <div className="space-y-2 py-2" style={{ paddingLeft: 8 + (depth + 1) * 18 + 20, paddingRight: 8 }}>
          {hits.map((v) => (
            <div key={v.uuid} className="pl-3" style={{ borderLeft: `2px solid ${/^PAIT-/i.test(v.threat ?? '') ? t.block : t.warn}55` }}>
              <div style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.ink }}>{v.rule_name}</div>
              <div style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim }}><Markdown text={v.description ?? ''} t={t} /></div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function FolderChildren({ t, uuid, path, depth, byFile, bad }) {
  const { items, total, loading, error, more } = useFolder(uuid, path, true)
  const indent = 8 + depth * 18 + 20
  return (
    <>
      {items.map((it) => <TreeNode key={it.uuid ?? it.path} t={t} uuid={uuid} item={it} depth={depth} byFile={byFile} bad={bad} />)}
      {loading && (
        <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: indent, fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
          <Loader2 size={12} className="animate-spin" /> Loading {path}
        </div>
      )}
      {error && <div className="py-1.5" style={{ paddingLeft: indent, fontFamily: FONT.prose, fontSize: 11.5, color: t.warn }}>Could not load {path}: {error}</div>}
      {more && !loading && (
        <button type="button" onClick={more} className="py-1.5" style={{ paddingLeft: indent, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.live }}>
          Load {total - items.length} more
        </button>
      )}
      {!loading && !error && total === 0 && <div className="py-1.5" style={{ paddingLeft: indent, fontFamily: FONT.prose, fontSize: 11.5, color: t.inkFaint }}>empty</div>}
    </>
  )
}

export function FilesTab({ t, record, tel, telError }) {
  const r = record.result
  const uuid = r.uuid
  const violations = r.violations ?? []
  const bad = unapprovedFormats(violations)
  const hits = filesWithFindings(violations)
  const byFile = useMemo(() => {
    const m = new Map()
    for (const v of violations) if (v.file) m.set(v.file, [...(m.get(v.file) ?? []), v])
    return m
  }, [violations])
  if (tel?.files) seedFolder(uuid, tel.files)

  return (
    <div className="space-y-3">
      <Card t={t} title="Scanned files" icon={Files} tone={hits.length ? t.block : t.pass}
            right={<span style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim }}>{fmtNum(r.total_files_scanned)} scanned · {hits.length} with findings</span>}>
        <p style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.inkDim, marginBottom: 8 }}>
          The tree AIRS recorded for this scan. Folders load as you open them; a file with findings opens onto them. Hashes are the blob ids AIRS keys each file by.
        </p>
        {tel?.files ? (
          <div className="rounded-xl py-1" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
            <FolderChildren t={t} uuid={uuid} path="/" depth={0} byFile={byFile} bad={bad} />
          </div>
        ) : (
          <>
            <Note t={t}>
              {telError ? <>The file tree did not load ({telError}). </> : tel ? <>The file tree endpoint did not answer{tel.errors?.files ? ` (${tel.errors.files})` : ''}. </> : <>Loading the file tree… </>}
              The files that carry findings come from the scan record itself:
            </Note>
            <div className="mt-2 space-y-1.5">
              {hits.map((f) => (
                <div key={f.file} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: t.sunken }}>
                  <FileWarning size={13} style={{ color: f.threat ? t.block : t.warn }} aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11.5, color: t.ink }}>{f.file}</span>
                  <Pill t={t} tone={f.threat ? t.block : t.warn}>{plural(f.count, 'finding')}</Pill>
                  {f.hash && <IdValue t={t} value={f.hash} truncate={10} />}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

// ─── Model ───────────────────────────────────────────────────────────────────

export function ModelTab({ t, record, tel, rules, now }) {
  const r = record.result
  const m = parseTarget(record)
  const v = tel?.version
  const model = tel?.model
  const group = tel?.group
  const hf = record.source === 'huggingface'
  const bad = unapprovedFormats(r.violations)
  const approvedLicenses = rules.list.flatMap((x) => x.fields ?? []).find((f) => f.key === 'approved_licenses')?.value
  const licenseOk = v?.license && Array.isArray(approvedLicenses) ? approvedLicenses.includes(v.license) : null
  const outcomeTone = (o) => (String(o ?? '').includes('BLOCK') ? t.block : String(o ?? '').includes('ALLOW') ? t.pass : t.warn)

  return (
    <div className="space-y-3">
      <Card t={t} title="Model" icon={Package}>
        <KV t={t} k="Name">
          {hf
            ? <a href={`https://huggingface.co/${m.id}`} target="_blank" rel="noreferrer" dir="ltr" className="inline-flex items-center gap-1" style={{ fontFamily: FONT.mono, fontSize: 11.5, color: t.live }}><Link2 size={11} aria-hidden="true" />{m.id}</a>
            : <span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11.5 }}>{m.name}</span>}
        </KV>
        <KV t={t} k="Source">{hf ? 'Hugging Face' : 'Local file, scanned on this host'}</KV>
        {(v?.hf_organization || m.org) && <KV t={t} k="Publisher">{v?.hf_organization ?? m.org}</KV>}
        {v?.license !== undefined && (
          <KV t={t} k="Licence">
            <span className="inline-flex items-center gap-2">
              <span style={{ fontFamily: FONT.mono, fontSize: 11.5 }}>{v.license ?? 'none declared'}</span>
              {licenseOk === true && <Pill t={t} tone={t.pass}>approved by the group</Pill>}
              {licenseOk === false && <Pill t={t} tone={t.warn}>not on the approved list</Pill>}
            </span>
          </KV>
        )}
        {v?.revision && <KV t={t} k="Revision">{v.revision}</KV>}
        {v?.hf_commit_sha && (
          <KV t={t} k="Commit">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <GitCommitHorizontal size={13} style={{ color: t.inkDim, flexShrink: 0 }} aria-hidden="true" />
              <a href={`https://huggingface.co/${m.id}/commit/${v.hf_commit_sha}`} target="_blank" rel="noreferrer" dir="ltr"
                 style={{ fontFamily: FONT.mono, fontSize: 11.5, color: t.live }}>{v.hf_commit_sha.slice(0, 12)}</a>
              <CopyButton t={t} text={v.hf_commit_sha} size={10} />
            </span>
          </KV>
        )}
        {v?.hf_commit_title && <KV t={t} k="Commit message">{v.hf_commit_title}</KV>}
        {v?.hf_commit_authors?.length > 0 && <KV t={t} k="Authors">{v.hf_commit_authors.join(', ')}</KV>}
        <KV t={t} k="Files">{fmtNum(v?.file_count ?? r.total_files_scanned)}{r.total_files_skipped ? ` · ${r.total_files_skipped} skipped` : ''}</KV>
        <KV t={t} k="Formats" top><FormatChips t={t} formats={r.model_formats ?? []} bad={bad} /></KV>
      </Card>

      {(model || v) && (
        <Card t={t} title="AIRS model inventory" icon={Boxes}>
          {model?.created_at && <KV t={t} k="First seen"><When t={t} iso={model.created_at} now={now} /></KV>}
          {model?.latest_version_outcome && (
            <KV t={t} k="Latest outcome">
              <span className="inline-flex items-center gap-2 flex-wrap">
                <Pill t={t} tone={outcomeTone(model.latest_version_outcome)}>{cap(model.latest_version_outcome)}</Pill>
                {model.latest_version_scan_time && <When t={t} iso={model.latest_version_scan_time} now={now} />}
              </span>
            </KV>
          )}
          {v?.source_types?.length > 0 && <KV t={t} k="Seen via">{v.source_types.map(sourceLabel).join(', ')}</KV>}
          {v?.fingerprint && <KV t={t} k="Fingerprint"><IdValue t={t} value={v.fingerprint} /></KV>}
          <KV t={t} k="Model id"><IdValue t={t} value={r.model_uuid ?? model?.uuid} /></KV>
          <KV t={t} k="Version id"><IdValue t={t} value={r.model_version_uuid ?? v?.uuid} /></KV>
        </Card>
      )}

      <Card t={t} title="Security group" icon={Settings2}>
        <KV t={t} k="Name">{group?.name ?? r.security_group_name ?? '—'}</KV>
        {group?.description && <KV t={t} k="Description">{group.description}</KV>}
        {group?.source_type && <KV t={t} k="Applies to">{sourceLabel(group.source_type)} models</KV>}
        {group?.state && <KV t={t} k="State">{cap(group.state)}</KV>}
        <KV t={t} k="Rules enabled">{r.enabled_rule_count_snapshot ?? ruleCounts(r).total}{rules.list.length && !rules.partial ? ` · ${rules.list.filter((x) => x.state === 'BLOCKING').length} blocking` : ''}</KV>
        {group?.created_at && <KV t={t} k="Created"><When t={t} iso={group.created_at} now={now} /></KV>}
        <KV t={t} k="Group id"><IdValue t={t} value={r.security_group_uuid} /></KV>
      </Card>

      <Card t={t} title="Scanner and scan" icon={Cpu}>
        <KV t={t} k="Scan id"><IdValue t={t} value={r.uuid} /></KV>
        <KV t={t} k="Scanner">{r.scanner_version ?? '—'}{r.sdk_version ? ` · SDK ${r.sdk_version}` : ''}</KV>
        <KV t={t} k="Origin">{sourceLabel(r.scan_origin) ?? '—'}{r.source_type && r.source_type !== r.scan_origin ? ` · ${sourceLabel(r.source_type)}` : ''}</KV>
        <KV t={t} k="Tenant (TSG)"><IdValue t={t} value={r.tsg_id} /></KV>
        {r.created_by && <KV t={t} k="Created by"><IdValue t={t} value={r.created_by} /></KV>}
        <KV t={t} k="Labels">{r.labels?.length ? r.labels.map((l) => (typeof l === 'string' ? l : `${l.key}=${l.value}`)).join(', ') : <span style={{ color: t.inkFaint }}>none</span>}</KV>
        {(r.error_code || r.error_message) && <KV t={t} k="Error">{[r.error_code, r.error_message].filter(Boolean).join(' · ')}</KV>}
      </Card>
    </div>
  )
}

// ─── Raw ─────────────────────────────────────────────────────────────────────

export function CodeBlock({ t, title, sub, value, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const text = useMemo(() => (value == null ? null : JSON.stringify(value, null, 2)), [value])
  if (text == null) return null
  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: t.panel, border: `1px solid ${t.glassEdge}`, boxShadow: t.shadowSm }}>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
          <IconSquare t={t} icon={Braces} size={28} />
          <span className="min-w-0">
            <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{title}</span>
            <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{sub ? `${sub} · ` : ''}{(text.length / 1024).toFixed(1)} KB</span>
          </span>
        </button>
        <CopyButton t={t} text={text} size={12} />
        <ChevronDown size={14} style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} aria-hidden="true" />
      </div>
      {open && (
        <pre className="mx-3 mb-3 px-3 py-2.5 rounded-xl overflow-auto whitespace-pre-wrap break-all"
             style={{ background: t.codeBg, fontFamily: FONT.mono, fontSize: 10, lineHeight: 1.5, color: t.inkDim, maxHeight: 440, direction: 'ltr' }}>
          {text}
        </pre>
      )}
    </section>
  )
}

export function RawTab({ t, record, tel }) {
  return (
    <div className="space-y-2.5">
      <CodeBlock t={t} title="Scan record" sub={record.fromScm ? 'GET /v1/scans/{uuid} + rule-violations' : 'POST /scan-model'} value={record.result} defaultOpen />
      <CodeBlock t={t} title="Rule evaluations" sub="GET /v1/scans/{uuid}/evaluations" value={tel?.evaluations} />
      <CodeBlock t={t} title="Rule instances" sub="security group rules, schema trimmed" value={tel?.rules} />
      <CodeBlock t={t} title="Model version" sub="GET /v1/model-versions/{uuid}" value={tel?.version} />
      <CodeBlock t={t} title="Model" sub="GET /v1/models/{uuid}" value={tel?.model} />
      <CodeBlock t={t} title="Security group" sub="GET /v1/security-groups/{uuid}" value={tel?.group} />
      <CodeBlock t={t} title="File tree · /" sub="GET /v1/scans/{uuid}/files" value={tel?.files} />
      {tel?.errors && Object.keys(tel.errors).length > 0 && <CodeBlock t={t} title="Endpoint errors" value={tel.errors} defaultOpen />}
    </div>
  )
}
