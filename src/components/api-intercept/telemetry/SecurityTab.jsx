/**
 * Security — every enforcement point this request passed through, with the
 * evidence AIRS returned for it. API-layer scans carry the full per-service
 * report; gateway guardrail scans carry the detector map and masking (their
 * report belongs to the key configured inside the gateway); MCP tool scans can
 * load their report on demand.
 */
import React, { useState, useEffect } from 'react'
import { ShieldCheck, ShieldX, Loader2, Bot, FileLock2, Syringe, Biohazard, Link2, Code2, Database, MessagesSquare, Anchor } from 'lucide-react'
import { Card, KV, Chip, IdValue, Note, Empty, FONT, LBL, fmtMs, IconSquare, useLaunch } from './primitives'

const SERVICE_NAME = {
  agent_security: 'Agent security',
  dlp: 'Data loss prevention',
  pi: 'Prompt injection',
  tc: 'Toxic content',
  uf: 'URL filtering',
  malicious_code: 'Malicious code',
  dbs: 'Database security',
  topic_guardrails: 'Topic guardrails',
  ungrounded: 'Contextual grounding',
  contextual_grounding: 'Contextual grounding',
}

// Same icons as the evidence pane's service grid, for the launch look.
const SERVICE_ICON = {
  agent_security: Bot, dlp: FileLock2, pi: Syringe, tc: Biohazard, uf: Link2, malicious_code: Code2,
  dbs: Database, topic_guardrails: MessagesSquare, ungrounded: Anchor, contextual_grounding: Anchor,
}

const DETECTOR_NAME = {
  agent: 'agent', dlp: 'dlp', injection: 'injection', malicious_code: 'code', toxic_content: 'toxic',
  url_cats: 'url', db_security: 'db', topic_violation: 'topic', ungrounded: 'grounding',
}

const VIA = {
  'airs-api': { label: 'AIRS API · this app', hint: 'POST /v1/scan/sync/request from this server' },
  'ai-gateway-guardrail': { label: 'AI-GW guardrail', hint: 'Scanned inside the SCM AI Gateway' },
  tool_event: { label: 'AIRS tool_event', hint: 'Direct AIRS scan of an MCP event' },
}

const isBad = (x) => x?.action === 'block' || x?.verdict === 'malicious'

function Detectors({ t, map }) {
  const entries = Object.entries(map || {}).filter(([, v]) => typeof v === 'boolean')
  if (!entries.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <Chip key={k} t={t} tone={v ? t.block : t.pass} title={k}>{v ? '✕' : '✓'} {DETECTOR_NAME[k] ?? k}</Chip>
      ))}
    </div>
  )
}

/** Service-specific evidence. Shapes verified against live AIRS reports. */
function Evidence({ t, r }) {
  const rd = r.result_detail || {}
  const mono = { fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }
  const Snip = ({ s }) => <p className="break-words" style={{ ...mono, color: t.ink, marginTop: 2 }}>“{String(s).slice(0, 400)}”</p>

  if (r.detection_service === 'dlp') {
    const d = rd.dlp_report || {}
    return (
      <div>
        <div className="flex flex-wrap gap-x-3" style={mono}>
          {d.dlp_profile_name && <span>profile <b style={{ color: t.ink }}>{d.dlp_profile_name}</b></span>}
          {d.data_pattern_rule1_verdict && <span>rule 1 <b style={{ color: t.ink }}>{d.data_pattern_rule1_verdict}</b></span>}
          {d.data_pattern_rule2_verdict && <span>rule 2 <b style={{ color: t.ink }}>{d.data_pattern_rule2_verdict}</b></span>}
        </div>
        {(d.data_pattern_detection_offsets || []).map((p, i) => {
          const tiers = [['high', p.high_confidence_detections], ['medium', p.medium_confidence_detections], ['low', p.low_confidence_detections]]
            .filter(([, v]) => v?.length).map(([k, v]) => `${k} ×${v.length}`).join(' · ')
          return (
            <div key={i} className="flex flex-wrap items-baseline gap-x-2 mt-1">
              <span style={{ fontFamily: FONT.display, fontSize: 11, fontWeight: 700, color: t.block }}>{p.name}</span>
              <span style={mono}>{tiers || 'no confidence tier'}{p.version != null ? ` · v${p.version}` : ''}</span>
            </div>
          )
        })}
        {(rd.dlp_snippets || []).map((g, i) => (
          <div key={i} style={mono} className="mt-1">
            {g.meta?.data_pattern} · {g.meta?.confidence_level} confidence · {g.meta?.data_pattern_type}
            {(g.snippets || []).map((s, j) => <Snip key={j} s={s} />)}
          </div>
        ))}
      </div>
    )
  }
  if (r.detection_service === 'pi') return <>{(rd.pi_snippets || []).slice(0, 2).map((s, i) => <Snip key={i} s={s} />)}</>
  if (r.detection_service === 'tc' && rd.tc_report) {
    return (
      <div style={mono}>
        {rd.tc_report.confidence ? `confidence ${rd.tc_report.confidence} · ` : ''}
        {(rd.tc_report.toxic_categories || []).join(', ') || 'no toxic category'}
        {(rd.tc_snippets || []).slice(0, 1).map((s, i) => <Snip key={i} s={s} />)}
      </div>
    )
  }
  if (r.detection_service === 'uf') {
    const rows = Array.isArray(rd.urlf_report) ? rd.urlf_report : []
    if (!rows.length) return <span style={mono}>no URL in the text</span>
    return (
      <div className="space-y-1">
        {rows.map((u, i) => (
          <div key={i} style={mono} className="break-all">
            <span style={{ color: t.ink }}>{u.url}</span> · {(u.categories || []).join(', ') || 'uncategorised'}
            {u.action ? ` · ${u.action}` : ''}{u.risk_level && u.risk_level !== 'Not Given' ? ` · risk ${u.risk_level}` : ''}
          </div>
        ))}
      </div>
    )
  }
  if (r.detection_service === 'agent_security' && rd.agent_report) {
    const a = rd.agent_report
    return (
      <div style={mono}>
        {a.agent_framework ? `framework ${a.agent_framework} · ` : ''}model verdict {a.model_verdict ?? '—'}
        {(a.agent_patterns || []).length > 0 && ` · patterns ${a.agent_patterns.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(', ')}`}
      </div>
    )
  }
  if (r.detection_service === 'malicious_code' && rd.mc_report) {
    return (
      <div style={mono}>
        malware script {rd.mc_report.malware_script_report?.verdict ?? '—'}
        {(rd.mc_report.code_analysis_by_type || []).length > 0 && ` · ${rd.mc_report.code_analysis_by_type.map((x) => x?.type ?? x?.language ?? JSON.stringify(x)).join(', ')}`}
      </div>
    )
  }
  const keys = Object.keys(rd)
  return keys.length ? <div className="break-all" style={mono}>{JSON.stringify(rd).slice(0, 300)}</div> : null
}

/**
 * report = AIRS `/v1/scan/reports` data array. A response scan sends the prompt
 * along with the answer, so its report re-checks the prompt too; `dir` keeps the
 * card about its own direction and folds the re-check into one line.
 */
function ReportTable({ t, report, dir }) {
  const all = (report || []).flatMap((b) => b.detection_results || [])
  if (!all.length) return <Empty t={t}>The report came back with no detection results.</Empty>
  const results = dir ? all.filter((r) => r.data_type === dir) : all
  const other = dir ? all.filter((r) => r.data_type !== dir) : []
  const fired = results.filter(isBad).length
  const launch = useLaunch()
  return (
    <div>
      <div style={launch
        ? { fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: fired ? t.block : t.pass, margin: '8px 0 4px' }
        : { ...LBL, fontSize: 8, color: fired ? t.block : t.pass, marginBottom: 4 }}>
        {fired} of {results.length} detection services flagged the {dir ?? 'content'}
      </div>
      {other.length > 0 && (
        <div style={{ fontFamily: FONT.prose, fontSize: 10.5, color: other.some(isBad) ? t.block : t.inkFaint, marginBottom: 4 }}>
          The prompt was re-checked alongside it: {other.filter(isBad).length} of {other.length} services flagged it
          {other.some(isBad) ? ` (${other.filter(isBad).map((r) => SERVICE_NAME[r.detection_service] ?? r.detection_service).join(', ')})` : ''}.
        </div>
      )}
      {results.map((r, i) => {
        const bad = isBad(r)
        if (launch) {
          const tone = bad ? t.block : t.pass
          return (
            <div key={i} className="flex items-start gap-3 py-2.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
              <IconSquare t={t} icon={SERVICE_ICON[r.detection_service] ?? ShieldCheck} tone={tone} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: bad ? t.block : t.ink }}>
                    {SERVICE_NAME[r.detection_service] ?? r.detection_service}
                  </span>
                  <span className="ml-auto flex-shrink-0 px-2 py-0.5 rounded-full"
                        style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: tone, background: `${tone}1a` }}>
                    {bad ? 'blocked' : 'clean'}
                  </span>
                </div>
                <div style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1 }}>
                  {r.data_type} · {r.verdict} · {r.action}
                </div>
                {(bad || r.detection_service === 'uf' || r.detection_service === 'dlp') && <div className="mt-1"><Evidence t={t} r={r} /></div>}
              </div>
            </div>
          )
        }
        return (
          <div key={i} className="flex gap-2.5 py-1.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
            <span className="flex-shrink-0 mt-[3px]" style={{ width: 7, height: 7, borderRadius: 9, background: bad ? t.block : t.pass }} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span style={{ fontFamily: FONT.display, fontSize: 11.5, fontWeight: 700, color: bad ? t.block : t.ink }}>
                  {SERVICE_NAME[r.detection_service] ?? r.detection_service}
                </span>
                <span style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkFaint }}>
                  {r.data_type} · {r.verdict} · {r.action}
                </span>
              </div>
              {(bad || r.detection_service === 'uf' || r.detection_service === 'dlp') && <Evidence t={t} r={r} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Masked({ t, masked, where, action }) {
  if (!masked?.data) return null
  return (
    <KV t={t} k={`Masked ${where}`} top>
      <p className="break-words" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.pass }}>{masked.data}</p>
      {(masked.pattern_detections || []).length > 0 && (
        <div style={{ fontFamily: FONT.prose, fontSize: 10, color: t.inkFaint, marginTop: 2 }}>
          {masked.pattern_detections.map((p) => `${p.pattern} @ ${(p.locations || []).map((l) => l.join('–')).join(', ')}`).join(' · ')}
        </div>
      )}
      {/* Measured: on an allowed request AIRS still returns a masked copy, but
          the original is what gets delivered — the answer is not rewritten. */}
      {action === 'allow' && (
        <div style={{ fontFamily: FONT.prose, fontSize: 10, color: t.inkDim, marginTop: 2 }}>
          The masked copy is informational: this {where} was allowed, so the original text went through unchanged.
        </div>
      )}
    </KV>
  )
}

function DetailsBlock({ t, details, where }) {
  const groups = Object.entries(details || {}).filter(([, v]) => v && typeof v === 'object' && Object.keys(v).length)
  if (!groups.length) return null
  return groups.map(([g, body]) => (
    <KV key={g} t={t} k={`${g.replace(/_details$/, '').replace(/_/g, ' ')} · ${where}`} top>
      <div className="flex flex-wrap gap-1">
        {Object.entries(body).flatMap(([f, v]) => (Array.isArray(v) ? v : [v]).filter(Boolean).map((x, i) => (
          <Chip key={`${f}-${i}`} t={t} tone={t.block}>{f.replace(/_/g, ' ')}: {typeof x === 'object' ? JSON.stringify(x).slice(0, 40) : String(x)}</Chip>
        )))}
      </div>
    </KV>
  ))
}

/**
 * The drawer opened before the deferred report landed. The server joins its own
 * in-flight fetch for this id, so asking here does not call AIRS again.
 */
function PendingReport({ t, reportId, dir }) {
  const [state, setState] = useState({ report: null, error: null })
  useEffect(() => {
    let live = true
    fetch(`/api/airs/report?id=${encodeURIComponent(reportId)}`)
      .then((r) => r.json())
      .then((j) => live && setState({ report: j.data?.length ? j.data : null, error: j.data?.length ? null : (j.error || 'AIRS returned no report') }))
      .catch((e) => live && setState({ report: null, error: e.message }))
    return () => { live = false }
  }, [reportId])
  if (state.report) return <ReportTable t={t} report={state.report} dir={dir} />
  if (state.error) return <Note t={t}>AIRS report: {state.error}</Note>
  return (
    <div className="flex items-center gap-2 py-1" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint }}>
      <Loader2 size={12} className="animate-spin" /> Loading the AIRS report — it is fetched after the response now, off the critical path.
    </div>
  )
}

function StageCard({ t, stage }) {
  const s = stage.scan
  const bad = isBad(s)
  const via = VIA[s.via] ?? { label: s.via }
  const where = stage.dir
  return (
    <Card
      t={t}
      tone={bad ? t.block : undefined}
      title={stage.title}
      right={(
        <span className="flex items-center gap-1.5">
          <Chip t={t} title={via.hint}>{via.label}</Chip>
          <Chip t={t} tone={bad ? t.block : t.pass} solid={bad}>{s.action ?? '—'} · {s.category ?? '—'}</Chip>
        </span>
      )}
    >
      <KV t={t} k="Detectors"><Detectors t={t} map={where === 'response' ? s.response_detected : s.prompt_detected} />
        {s.tool_detected && Object.keys(s.tool_detected).length > 0 && <div className="mt-1"><Detectors t={t} map={s.tool_detected} /></div>}
      </KV>
      <Masked t={t} masked={s.prompt_masked_data} where="prompt" action={s.action} />
      <Masked t={t} masked={s.response_masked_data} where="response" action={s.action} />
      <DetailsBlock t={t} details={s.prompt_detection_details} where="prompt" />
      <DetailsBlock t={t} details={s.response_detection_details} where="response" />
      <KV t={t} k="Scan time">{fmtMs(s.latencyMs)}{s.via === 'ai-gateway-guardrail' ? ' · measured by the gateway' : ' · round trip from this server'}</KV>
      <KV t={t} k="Profile"><span dir="ltr">{s.profile_name ?? '—'}</span>{s.profile_id && <span style={{ color: t.inkFaint }}> · <IdValue t={t} value={s.profile_id} truncate={13} /></span>}</KV>
      {s.guardrailId && <KV t={t} k="Guardrail"><IdValue t={t} value={s.guardrailId} /> {s.checkId && <span style={{ color: t.inkFaint, fontSize: 10.5 }}>· {s.checkId}</span>}</KV>}
      <KV t={t} k="Scan id"><IdValue t={t} value={s.scan_id} /></KV>
      <KV t={t} k="Report id"><IdValue t={t} value={s.report_id} /></KV>
      <KV t={t} k="Transaction"><IdValue t={t} value={s.transaction_id} /></KV>
      <KV t={t} k="tr_id / session"><IdValue t={t} value={s.tr_id} />{s.session_id && s.session_id !== s.tr_id && <> · <IdValue t={t} value={s.session_id} /></>}</KV>
      {s.requestId && <KV t={t} k="AIRS request id" hint="x-request-id response header"><IdValue t={t} value={s.requestId} /></KV>}
      {s.endpoint && <KV t={t} k="Endpoint"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>POST {s.endpoint}</span></KV>}
      {(s.timeout || s.error || s.errors?.length > 0) && (
        <KV t={t} k="Scan health"><span style={{ color: t.warn }}>{s.timeout ? 'timed out · ' : ''}{s.error ? 'error · ' : ''}{(s.errors || []).map((e) => JSON.stringify(e)).join(' · ')}</span></KV>
      )}
      <div className="mt-2">
        {s.report ? <ReportTable t={t} report={s.report} dir={where} />
          : s.reportPending && s.report_id ? <PendingReport t={t} reportId={s.report_id} dir={where} />
          : s.via === 'ai-gateway-guardrail'
            ? <Note t={t}>The per-service report for a gateway guardrail scan belongs to the AIRS key configured inside the guardrail, so this portal cannot read it (verified: the reports endpoint returns an empty list for it). The detector map and masking above come from the gateway's own hook result.</Note>
            : s.reportError ? <Note t={t}>AIRS report fetch failed: {s.reportError}</Note> : null}
      </div>
    </Card>
  )
}

/** An MCP tool_event scan — verdict inline, report on demand. */
function ToolScanRow({ t, item }) {
  const [state, setState] = useState({ loading: false, report: null, error: null })
  const bad = isBad(item.scan)
  const load = () => {
    setState({ loading: true, report: null, error: null })
    fetch(`/api/airs/report?id=R${item.scan.scanId}&via=gateway`)
      .then((r) => r.json())
      .then((j) => setState({ loading: false, report: j.data?.length ? j.data : null, error: j.data?.length ? null : (j.error || 'AIRS returned no report for this scan yet') }))
      .catch((e) => setState({ loading: false, report: null, error: e.message }))
  }
  return (
    <div className="py-2" style={{ borderTop: `1px solid ${t.hairline}` }}>
      <div className="flex items-center gap-2 flex-wrap">
        {bad ? <ShieldX size={13} style={{ color: t.block }} /> : <ShieldCheck size={13} style={{ color: t.pass }} />}
        <span style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.ink }}>{item.title}</span>
        <Chip t={t} tone={bad ? t.block : t.pass}>{item.scan.action ?? '—'} · {item.scan.category ?? '—'}</Chip>
        <span className="flex-1" />
        {item.scan.scanId && !state.report && (
          <button type="button" onClick={load} disabled={state.loading}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ ...LBL, fontSize: 8, color: t.live, border: `1px solid ${t.live}40` }}>
            {state.loading && <Loader2 size={10} className="animate-spin" />} AIRS report
          </button>
        )}
      </div>
      <div className="mt-0.5 ml-5"><IdValue t={t} value={item.scan.scanId} /></div>
      {state.error && <div className="ml-5" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.warn }}>{state.error}</div>}
      {state.report && <div className="ml-5 mt-1"><ReportTable t={t} report={state.report} /></div>}
    </div>
  )
}

export function SecurityTab({ t, detail }) {
  if (!detail.airsEnabled) {
    // The legacy gateway's native lane still enforces — with Portkey's own
    // checks, not AIRS — so show what those hooks decided.
    const hooks = detail.gateway?.hooks || []
    if (hooks.length) {
      return (
        <Card t={t} title="Portkey native guardrail · not Prisma AIRS">
          {hooks.map((h, i) => (
            <KV key={i} t={t} k={`${h.phase} hook`} top>
              <span className="inline-flex items-center gap-2 flex-wrap">
                <IdValue t={t} value={h.id} />
                <Chip t={t} tone={h.verdict === false ? t.block : t.pass}>{h.verdict === false ? 'failed' : 'passed'}</Chip>
                <span style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }}>{fmtMs(h.execMs)}</span>
              </span>
              {(h.checks || []).map((c, j) => (
                <div key={j} style={{ fontFamily: FONT.mono, fontSize: 10, color: c.verdict === false ? t.block : t.inkFaint, marginTop: 2 }}>
                  {c.id} · {c.verdict === false ? 'failed' : 'passed'} · {fmtMs(c.execMs)}
                </div>
              ))}
            </KV>
          ))}
        </Card>
      )
    }
    return <Card t={t} title="Security"><Empty t={t}>Prisma AIRS was off for this request — nothing was scanned, in either direction. This is the unprotected baseline.</Empty></Card>
  }
  const a = detail.airs || {}
  const gw = detail.backend === 'aigw'
  // In an MCP loop every turn is guarded; the hook result kept is the last
  // turn's, whose "last message" is often a tool result rather than the prompt.
  const turn = detail.mcp?.turns?.length > 1 ? ` · turn ${detail.mcp.turns.length} of ${detail.mcp.turns.length}` : ''
  const stages = [
    a.input && { title: gw ? `Input · AI-GW input guardrail${turn}` : 'Prompt · before the model', scan: a.input, dir: 'prompt' },
    a.output && { title: gw ? `Response · AI-GW output guardrail${turn}` : 'Response · after the model', scan: a.output, dir: 'response' },
  ].filter(Boolean)

  const toolScans = []
  for (const st of detail.mcp?.steps ?? []) {
    if (st.kind === 'discover' && st.scan) toolScans.push({ title: `${st.title} · manifest (tool poisoning)`, scan: st.scan })
    if (st.kind === 'tool') {
      if (st.inputScan?.scanId) toolScans.push({ title: `${st.server} · ${st.tool} · parameters`, scan: st.inputScan })
      if (st.outputScan?.scanId) toolScans.push({ title: `${st.server} · ${st.tool} · result`, scan: st.outputScan })
    }
  }

  const errored = (detail.gateway?.hooks || []).flatMap((h) => (h.checks || []).filter((c) => c.error).map((c) => ({ h, c })))

  return (
    <div className="space-y-3">
      {errored.length > 0 && (
        <Card t={t} tone={t.warn} title="Guardrail check errored — not scanned">
          {errored.map(({ h, c }, i) => (
            <KV key={i} t={t} k={`${h.phase} guardrail`} top>
              <span className="inline-flex items-center gap-2 flex-wrap">
                <IdValue t={t} value={h.id} /> <span style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }}>{c.id}</span>
              </span>
              <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.warn, marginTop: 2 }}>{c.error?.message || JSON.stringify(c.error)}</div>
              <div style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim, marginTop: 2 }}>
                {h.verdict === false ? 'The guardrail treated the failure as a block.' : 'The guardrail failed OPEN: its hook reported a pass, so the request went through with no AIRS verdict at all.'}
              </div>
            </KV>
          ))}
          <Note t={t}>An HTTP 401/403 here usually means the AIRS API key or profile configured inside the gateway guardrail is no longer valid.</Note>
        </Card>
      )}
      {stages.map((s) => <StageCard key={s.title} t={t} stage={s} />)}
      {!stages.length && !toolScans.length && !errored.length && <Card t={t} title="Security"><Empty t={t}>No scan result was recorded for this request.</Empty></Card>}
      {toolScans.length > 0 && (
        <Card t={t} title={`MCP · ${toolScans.length} AIRS tool_event scans`}>
          {toolScans.map((x, i) => <ToolScanRow key={i} t={t} item={x} />)}
          <Note t={t}>Tool events are scanned directly by this server on the gateway's tenant: the manifest before the model sees it, each call's parameters before it runs, and each result before the model reads it.</Note>
        </Card>
      )}
    </div>
  )
}
