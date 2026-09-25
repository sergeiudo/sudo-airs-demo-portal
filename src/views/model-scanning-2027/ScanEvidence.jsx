import React from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, ShieldX, AlertTriangle, Radar, Package, ExternalLink, BookOpen, FileWarning, Loader2, Hash } from 'lucide-react'
import { FONT, label as LBL, glass, bloom } from '../api-intercept-2027/tokens'
import { Row, Block } from '../api-intercept-2027/EvidencePane'
import { Copyable } from '../api-intercept-2027/RecordStream'
import {
  SCAN_META, KIND_TONE, scanVerdict, ruleCounts, groupViolations, threatSignals, unapprovedFormats,
  filesWithFindings, parseTarget, scmScanUrl, fmtBytes, isTempCopy,
} from './scanModel'

/**
 * ScanEvidence — proof for the selected scan, in the runtime console's
 * evidence-pane grammar: the verdict loud at the top, then one card per kind
 * of evidence at a single weight.
 *
 * Everything here was already in the scan response and unused by the old view
 * — the security group's name, the formats found, files scanned, per-file
 * hashes, the PAIT threat codes with their knowledge-base links. The
 * old right column was a raw JSON dump; that is still here, folded, last.
 */

function ModelCard({ t, rec }) {
  const r = rec.result
  const m = parseTarget(rec)
  const bad = unapprovedFormats(r?.violations)
  const isHf = rec.source === 'huggingface'
  // `model` is charcoal in both themes — invisible on the dark panel.
  const mc = t.isLight ? t.model : t.inkDim
  return (
    <div className="mx-3 mt-3 px-3.5 py-3" style={{ background: t.panel, boxShadow: t.shadowSm, borderRadius: 18 }}>
      <div className="flex items-center gap-2">
        <span className="grid place-items-center rounded-xl flex-shrink-0"
              style={{ width: 30, height: 30, background: `${mc}14`, border: `1px solid ${mc}2e` }}>
          <Package size={15} style={{ color: mc }} />
        </span>
        <div className="min-w-0">
          <div style={{ ...LBL, fontSize: 8, color: t.inkFaint }}>Scanned model</div>
          <div className="truncate" dir="ltr" title={m.id}
               style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: t.ink, lineHeight: 1.15 }}>
            {m.name}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {m.org && (
          <span className="px-2 py-0.5 rounded-full" style={{ ...LBL, fontSize: 8, color: t.inkDim, background: t.sunken }}>{m.org}</span>
        )}
        <span className="px-2 py-0.5 rounded-full"
              style={{ ...LBL, fontSize: 8, color: mc, background: `${mc}14`, border: `1px solid ${mc}2e` }}>
          {isHf ? 'Hugging Face' : 'local file'}
        </span>
        {rec.fromScm && (
          <span className="px-2 py-0.5 rounded-full"
                style={{ ...LBL, fontSize: 8, color: t.live, background: `${t.live}14`, border: `1px solid ${t.live}33` }}>SCM history</span>
        )}
        {rec.size != null && (
          <span className="px-2 py-0.5 rounded-full" style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkDim, background: t.sunken }}>{fmtBytes(rec.size)}</span>
        )}
        {r?.total_files_scanned != null && (
          <span className="px-2 py-0.5 rounded-full" style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkDim, background: t.sunken }}>
            {r.total_files_scanned} files scanned{r.total_files_skipped ? ` · ${r.total_files_skipped} skipped` : ''}
          </span>
        )}
      </div>

      {/* Formats, with the ones policy rejected marked — the whole of the
          "unapproved format" story in one row. */}
      {r?.model_formats?.length > 0 && (
        <div className="mt-2.5">
          <div style={{ ...LBL, fontSize: 7.5, color: t.inkFaint, marginBottom: 4 }}>Formats found</div>
          <div className="flex flex-wrap gap-1">
            {r.model_formats.map((f) => {
              const no = bad.has(f)
              return (
                <span key={f} dir="ltr" className="px-1.5 py-0.5 rounded"
                      title={no ? 'not on this security group’s approved-format list' : undefined}
                      style={{
                        fontFamily: FONT.mono, fontSize: 9.5,
                        color: no ? t.block : t.inkDim,
                        background: no ? `${t.block}12` : t.sunken,
                        border: `1px solid ${no ? `${t.block}40` : 'transparent'}`,
                        textDecoration: no ? 'line-through' : 'none',
                      }}>
                  {f}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {isHf && (
        <a href={`https://huggingface.co/${m.id}`} target="_blank" rel="noreferrer"
           className="inline-flex items-center gap-1 mt-2.5" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.live }}>
          Open on Hugging Face <ExternalLink size={9} />
        </a>
      )}
    </div>
  )
}

/**
 * One segment per rule in the group. We only learn the names of the rules
 * that FAILED — the API returns violations, not the passing set — so the meter
 * shows proportion and the list below names the failures.
 */
function RuleMeter({ t, total, passed, failed }) {
  const segs = Array.from({ length: Math.max(total, 1) }, (_, i) => (i < failed ? 'fail' : i < failed + passed ? 'pass' : 'other'))
  return (
    <div>
      <div className="flex items-end gap-4 mb-2">
        {[['passed', passed, t.pass], ['failed', failed, failed ? t.block : t.inkFaint], ['rules', total, t.ink]].map(([k, v, c]) => (
          <div key={k}>
            <div style={{ fontFamily: FONT.display, fontSize: 24, fontWeight: 700, color: c, lineHeight: 1 }}>{v}</div>
            <div style={{ ...LBL, fontSize: 7.5, color: t.inkFaint, marginTop: 3 }}>{k}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {segs.map((s, i) => (
          <motion.span key={i} className="flex-1 rounded-full"
                       initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.035, duration: 0.25 }}
                       style={{
                         height: 8, transformOrigin: 'left',
                         background: s === 'fail' ? t.block : s === 'pass' ? t.pass : t.railBed,
                         opacity: s === 'pass' ? 0.75 : 1,
                       }} />
        ))}
      </div>
    </div>
  )
}

function Standby({ t }) {
  return (
    <div className="flex flex-col h-full items-center justify-center px-7 text-center" style={glass(t, { radius: 18 })}>
      <motion.div className="rounded-full flex items-center justify-center mb-4"
                  style={{ width: 56, height: 56, border: `1px solid ${t.hairline}` }}
                  animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.4, repeat: Infinity }}>
        <Radar size={22} style={{ color: t.inkFaint }} />
      </motion.div>
      <p style={{ ...LBL, fontSize: 10, color: t.inkDim }}>Standing by</p>
      <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkFaint, marginTop: 6, lineHeight: 1.55 }}>
        Scan a model from the library, or click any record to inspect what the scan found.
      </p>
    </div>
  )
}

export function ScanEvidence({ t, record }) {
  if (!record) return <Standby t={t} />

  const v = scanVerdict(record)
  const meta = SCAN_META[v]
  const r = record.result
  const { total, passed, failed } = ruleCounts(r)
  const groups = groupViolations(r?.violations)
  const threats = groups.filter((g) => g.kind === 'threat')
  const files = filesWithFindings(r?.violations)
  const scm = scmScanUrl(r)

  const note = v === 'blocked'
    ? (threats.length
        ? 'Blocked by Prisma AIRS Model Security — the artifact carries code that runs when it is loaded.'
        : 'Blocked on policy. Nothing malicious was found; the model breaks a rule this security group enforces.')
    : v === 'allowed'
    ? 'Allowed — every rule in the security group passed. Safe to load.'
    : v === 'scanning'
    ? 'Waiting for Prisma AIRS Model Security to evaluate the security group.'
    : (record.error?.message || r?.error_message || 'The scan did not complete.')

  return (
    <div className="h-full overflow-y-auto" style={glass(t, { radius: 18 })}>
      {/* Verdict — the loudest thing in this column */}
      <div className="relative px-4 pt-4 pb-4 overflow-hidden" style={{ borderBottom: `1px solid ${t.hairline}` }}>
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: `radial-gradient(120% 90% at 50% 0%, ${meta.color}26, transparent 70%)` }} />
        {v === 'blocked' && (
          <motion.div key={record.id} className="absolute inset-0 pointer-events-none" style={{ background: `${t.block}18` }}
                      initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8 }} />
        )}
        <div className="relative">
          <div style={{ ...LBL, fontSize: 8.5, color: t.inkFaint }}>Verdict</div>
          <div className="flex items-center gap-2.5 mt-2">
            <motion.span key={`${record.id}-${v}`} className="flex items-center justify-center rounded-xl flex-shrink-0"
                         style={{ width: 38, height: 38, background: `${meta.color}1f`, border: `1.5px solid ${meta.color}77`, boxShadow: bloom(meta.color, 0.9) }}
                         initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
              {v === 'blocked' ? <ShieldX size={19} style={{ color: meta.color }} />
                : v === 'allowed' ? <ShieldCheck size={19} style={{ color: meta.color }} />
                : v === 'scanning' ? <Loader2 size={19} className="animate-spin" style={{ color: meta.color }} />
                : <AlertTriangle size={19} style={{ color: meta.color }} />}
            </motion.span>
            <span style={{ fontFamily: FONT.display, fontSize: 25, fontWeight: 700, letterSpacing: '-0.02em', color: meta.color, lineHeight: 1, textShadow: `0 0 24px ${meta.color}66` }}>
              {meta.label}
            </span>
          </div>
          <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 8, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{note}</p>
        </div>
      </div>

      <ModelCard t={t} rec={record} />

      {r && total > 0 && (
        <Block t={t} title="Security group" accent={failed ? t.block : t.pass} count={`${failed} of ${total} failed`}>
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <span style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, color: t.ink }}>{r.security_group_name ?? '—'}</span>
            {r.source_type && (
              <span className="px-1.5 py-0.5 rounded-full" style={{ ...LBL, fontSize: 7, color: t.inkDim, background: t.sunken }}>{r.source_type.replace(/_/g, ' ')}</span>
            )}
          </div>
          <RuleMeter t={t} total={total} passed={passed} failed={failed} />
          {groups.length > 0 && (
            <div className="mt-3 space-y-1">
              {groups.map((g) => (
                <div key={g.key} className="flex items-center gap-2 px-2.5 py-1.5" style={{ background: t.sunken, borderRadius: 10 }}>
                  <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: KIND_TONE[g.kind] }} />
                  <span className="flex-1 min-w-0 truncate" title={g.name}
                        style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: t.ink }}>{g.name}</span>
                  <span style={{ ...LBL, fontSize: 7, color: KIND_TONE[g.kind] }}>{g.kind}</span>
                  {g.items.length > 1 && <span style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>×{g.items.length}</span>}
                </div>
              ))}
            </div>
          )}
          {v === 'allowed' && (
            <p style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 10 }}>
              All {total} rules ran and none failed.
            </p>
          )}
        </Block>
      )}

      {threats.length > 0 && (
        <Block t={t} title="Threats" accent={t.block} count={threats.length}>
          {threats.map((g) => {
            const sig = threatSignals(g.items)
            const file = g.items.find((x) => x.file)?.file
            return (
              <div key={g.key} className="px-3 py-2.5 mb-1.5 last:mb-0" style={{ background: t.sunken, borderRadius: 16 }}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {g.threat && (
                    <span dir="ltr" className="px-1.5 py-0.5 rounded"
                          style={{ fontFamily: FONT.mono, fontSize: 10, fontWeight: 700, color: t.block, background: `${t.block}16`, border: `1px solid ${t.block}40` }}>
                      {g.threat}
                    </span>
                  )}
                  <span style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 700, color: t.ink }}>{g.name}</span>
                </div>
                {sig.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {sig.map((s) => (
                      <span key={s.label} dir="ltr" className="px-2 py-0.5 rounded-full"
                            style={{ fontFamily: FONT.mono, fontSize: 10, fontWeight: 600, color: t.block, background: `${t.block}1f` }}>{s.label}</span>
                    ))}
                  </div>
                )}
                {file && (
                  <div className="truncate mt-1.5" dir="ltr" title={file} style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkFaint }}>
                    in {record.source === 'local' && !record.fromScm && isTempCopy(file) ? `${record.target} (scanned as ${file.split('/').pop()})` : file}
                  </div>
                )}
                <div className="flex flex-wrap gap-3 mt-1.5">
                  {g.kbUrl && (
                    <a href={g.kbUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1"
                       style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.live }}>
                      <BookOpen size={10} /> Knowledge base
                    </a>
                  )}
                  {g.insightsUrl && (
                    <a href={g.insightsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1"
                       style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.live }}>
                      <ExternalLink size={10} /> Model insights
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </Block>
      )}

      {files.length > 0 && (
        <Block t={t} title="Files with findings" count={files.length} accent={files.some((f) => f.threat) ? t.block : t.warn} defaultOpen={false}>
          {files.map((f) => (
            <div key={f.file} className="px-2.5 py-2 mb-1.5 last:mb-0" style={{ background: t.sunken, borderRadius: 12 }}>
              <div className="flex items-center gap-1.5">
                <FileWarning size={11} style={{ color: f.threat ? t.block : t.warn, flexShrink: 0 }} />
                <span className="flex-1 min-w-0 truncate" dir="ltr" title={f.file}
                      style={{ fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 600, color: t.ink }}>{f.file}</span>
                {record.source === 'local' && !record.fromScm && isTempCopy(f.file) && (
                  <span style={{ ...LBL, fontSize: 7, color: t.inkFaint }}>temp copy</span>
                )}
                <span style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>×{f.count}</span>
              </div>
              {f.hash && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Hash size={9} style={{ color: t.inkFaint, flexShrink: 0 }} />
                  <span className="flex-1 min-w-0 truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>{f.hash}</span>
                  <Copyable t={t} text={f.hash} />
                </div>
              )}
              <div style={{ fontFamily: FONT.prose, fontSize: 10, color: t.inkDim, marginTop: 3 }}>{[...f.rules].join(' · ')}</div>
            </div>
          ))}
        </Block>
      )}

      {r && (
        <Block t={t} title="Identifiers" defaultOpen={false}>
          <Row t={t} label="scan_id" value={r.uuid} />
          <Row t={t} label="version" value={r.model_version_uuid} />
          <Row t={t} label="group" value={r.security_group_name} />
          <Row t={t} label="group_id" value={r.security_group_uuid} />
          <Row t={t} label="tsg" value={r.tsg_id} />
          <Row t={t} label="scanner" value={r.scanner_version} />
          <Row t={t} label="origin" value={r.scan_origin} />
          <Row t={t} label="started" value={r.time_started} />
        </Block>
      )}

      {scm && (
        <a href={scm} target="_blank" rel="noreferrer"
           className="flex items-center justify-center gap-2 mx-3 mb-2.5 px-3 py-2 rounded-xl transition-colors"
           style={{ ...LBL, fontSize: 9, color: t.block, background: `${t.block}16`, border: `1px solid ${t.block}4d`, boxShadow: bloom(t.block, 0.35) }}>
          <ExternalLink size={11} /> Open in Strata Cloud Manager
        </a>
      )}

      {r && (
        <Block t={t} title="Raw scan response" defaultOpen={false}>
          <pre className="px-2.5 py-2 rounded-lg overflow-auto whitespace-pre-wrap break-all"
               style={{ background: t.codeBg, fontFamily: FONT.mono, fontSize: 9.5, color: t.inkDim, maxHeight: 360, direction: 'ltr' }}>
            {JSON.stringify(r, null, 2)}
          </pre>
        </Block>
      )}
    </div>
  )
}
