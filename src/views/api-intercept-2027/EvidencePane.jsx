import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, ShieldX, AlertTriangle, ExternalLink, ChevronRight, Copy, Check, Radar, FileText,
         Bot, FileLock2, Syringe, Biohazard, Link2, Code2, Cpu, Wrench, Server, Globe,
         Route, CornerDownRight } from 'lucide-react'
import { FONT, label as LBL, VERDICT_META, verdictOf, glass, bloom } from './tokens'

/**
 * EvidencePane — proof for the selected turn.
 *
 * The verdict is a full-bleed panel at the top with its own glow, because on a
 * projector the answer to "did it get through" has to be readable from the back
 * of the room. Everything below it is supporting detail at one weight: the
 * stream already said what happened, this says prove it.
 */

function Row({ t, label, value }) {
  const [done, setDone] = useState(false)
  if (!value) return null
  return (
    <div className="flex items-center gap-2 py-1.5" style={{ borderBottom: `1px solid ${t.hairline}` }}>
      <span className="flex-shrink-0" style={{ ...LBL, fontSize: 8, color: t.inkFaint, width: 62 }}>{label}</span>
      <span className="flex-1 min-w-0 truncate" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.ink }}>{String(value)}</span>
      <button onClick={() => { navigator.clipboard?.writeText(String(value)); setDone(true); setTimeout(() => setDone(false), 1100) }}
              className="flex-shrink-0" style={{ color: done ? t.pass : t.inkFaint }} title="Copy">
        {done ? <Check size={10} /> : <Copy size={10} />}
      </button>
    </div>
  )
}

function Block({ t, title, children, count, accent, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const c = accent || t.inkDim
  return (
    <div className="mx-3 mb-2.5 overflow-hidden" style={{ background: t.panel, boxShadow: t.shadowSm, borderRadius: 20 }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-3 py-2.5">
        <ChevronRight size={12} style={{ color: c, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 160ms' }} />
        <span className="flex-1 text-left" style={{ ...LBL, fontSize: 10, color: t.ink }}>{title}</span>
        {count != null && (
          <span className="px-1.5 rounded-full" style={{ fontFamily: FONT.mono, fontSize: 9.5, color: c, background: `${c}1a` }}>{count}</span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function detectorKeys(d) {
  if (!d) return []
  return Array.isArray(d) ? d : Object.entries(d).filter(([, v]) => v).map(([k]) => k)
}

const BACKEND_META = {
  aigw:    { name: 'SCM AI-GW', note: 'guardrail enforced inside the gateway' },
  bedrock: { name: 'AWS Bedrock',    note: 'scanned at the API layer' },
  vertex:  { name: 'Google Vertex',  note: 'scanned at the API layer' },
  azure:   { name: 'Azure OpenAI',   note: 'scanned at the API layer' },
}

/**
 * Split `aigw/@sudo-bedrock/moonshotai.kimi-k2.5` into something a room can
 * read. The label the server sends is a routing string; it was rendered as one
 * line of faint grey mono, which is the wrong weight for the single fact people
 * ask about most — which model answered.
 */
function parseModel(label) {
  const raw = String(label ?? '')
  if (!raw) return null
  const segs = raw.split('/')
  const backend = segs.length > 1 && BACKEND_META[segs[0]] ? segs.shift() : null
  const integration = segs.length > 1 && segs[0].startsWith('@') ? segs.shift() : null
  const id = segs.join('/')
  const dot = id.split('.')
  // `moonshotai.kimi-k2.5` → vendor moonshotai, rest the model
  const vendor = dot.length > 1 && /^[a-z0-9-]+$/.test(dot[0]) ? dot[0] : null
  const name = vendor ? dot.slice(1).join('.') : id
  return { raw, backend, integration, id, vendor, name: name || id }
}

/** The model, given the weight it deserves. */
function ModelCard({ t, label, enforcement, lane, tokensIn, tokensOut }) {
  const m = parseModel(label)
  if (!m) return null
  const be = m.backend ? BACKEND_META[m.backend] : null
  return (
    <div className="mx-3 mt-3 px-3.5 py-3" style={{ background: t.panel, boxShadow: t.shadowSm, borderRadius: 18 }}>
      <div className="flex items-center gap-2">
        <span className="grid place-items-center rounded-xl flex-shrink-0"
              style={{ width: 30, height: 30, background: `${t.model}14`, border: `1px solid ${t.model}2e` }}>
          <Cpu size={15} style={{ color: t.model }} />
        </span>
        <div className="min-w-0">
          <div style={{ ...LBL, fontSize: 8, color: t.inkFaint }}>Answered by</div>
          <div className="truncate" title={m.raw}
               style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: t.ink, lineHeight: 1.15 }}>
            {m.name}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {m.vendor && (
          <span className="px-2 py-0.5 rounded-full"
                style={{ ...LBL, fontSize: 8, color: t.inkDim, background: t.sunken }}>{m.vendor}</span>
        )}
        {be && (
          <span className="px-2 py-0.5 rounded-full"
                style={{ ...LBL, fontSize: 8, color: t.model, background: `${t.model}14`, border: `1px solid ${t.model}2e` }}>
            {be.name}
          </span>
        )}
        {m.integration && (
          <span className="px-2 py-0.5 rounded-full"
                style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkDim, background: t.sunken }}>{m.integration}</span>
        )}
        {(tokensIn != null || tokensOut != null) && (
          <span className="px-2 py-0.5 rounded-full"
                style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkDim, background: t.sunken }}>
            {tokensIn ?? '—'} in · {tokensOut ?? '—'} out tok
          </span>
        )}
      </div>

      {/* Which enforcement point produced the verdict — the AI-GW lane is a
          different architecture from the other three, not just another model. */}
      {(enforcement || be) && (
        <p style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: 1.45, color: t.inkFaint, marginTop: 7 }}>
          {enforcement === 'ai-gateway-guardrail'
            ? 'Policy ran inside the gateway, before the request reached the model.'
            : enforcement === 'none'
            ? 'No enforcement on this turn — the call went straight to the model.'
            : be?.note}
          {lane ? ` · lane ${lane}` : ''}
        </p>
      )}
    </div>
  )
}

/** A scan verdict as a chip. Used for every MCP stage. */
function ScanChip({ t, label, scan }) {
  if (!scan) return null
  const bad = scan.action === 'block'
  const tone = scan.error ? t.warn : bad ? t.block : t.pass
  return (
    <span className="px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
          style={{ ...LBL, fontSize: 7.5, color: tone, background: `${tone}18`, border: `1px solid ${tone}44` }}>
      {label} {scan.error ? 'failed' : bad ? String(scan.category || 'blocked') : 'clean'}
    </span>
  )
}

/**
 * The MCP run, as evidence rather than as a story.
 *
 * The stream already renders the chain of thought; this is the same run read
 * as a security artefact — which servers were reached and over what route,
 * what the manifest scan said about the tool descriptions, and for every call
 * the two scans that bracket it. Stage 2 is the one worth pointing at: a tool
 * result is untrusted remote content and it is scanned before the model reads
 * it, which is the whole argument for scanning at the tool boundary.
 */
function McpBlock({ t, mcp }) {
  const steps = mcp?.steps ?? []
  if (!steps.length) return null

  const routeStep = steps.find((s) => s.kind === 'route')
  const discovered = steps.filter((s) => s.kind === 'discover')
  const toolSteps = steps.filter((s) => s.kind === 'tool')
  const stopped = steps.filter((s) => s.blocked || s.kind === 'blocked')
  const faults = steps.filter((s) => s.kind === 'error')
  const toolsOffered = discovered.reduce((a, s) => a + (s.toolNames?.length ?? 0), 0)

  return (
    <Block t={t} title="MCP tool calls" accent={stopped.length ? t.block : t.model}
           count={`${toolSteps.length} call${toolSteps.length === 1 ? '' : 's'}${stopped.length ? ` · ${stopped.length} stopped` : ''}`}>

      {/* the run, in four numbers */}
      <div className="grid grid-cols-4 gap-1.5 mb-2.5">
        {[[discovered.length === 1 ? 'server' : 'servers', discovered.length],
          [toolsOffered === 1 ? 'tool' : 'tools', toolsOffered],
          [mcp.rounds === 1 ? 'round' : 'rounds', mcp.rounds ?? '—'],
          [toolSteps.length === 1 ? 'call' : 'calls', toolSteps.length]].map(([k, v]) => (
          <div key={k} className="px-2 py-1.5 text-center" style={{ background: t.sunken, borderRadius: 12 }}>
            <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink, lineHeight: 1.1 }}>{v}</div>
            <div style={{ ...LBL, fontSize: 7, color: t.inkFaint, marginTop: 1 }}>{k}</div>
          </div>
        ))}
      </div>

      {/* routing — brokered through the gateway, or straight out */}
      {routeStep?.servers?.length > 0 && (
        <div className="mb-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Route size={11} style={{ color: t.inkDim }} />
            <span style={{ ...LBL, fontSize: 8, color: t.inkDim }}>Routing</span>
          </div>
          {routeStep.servers.map((s) => {
            const d = discovered.find((x) => x.server === s.id)
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-1.5 mb-1"
                   style={{ background: t.sunken, borderRadius: 12 }}>
                {s.brokered ? <Server size={11} style={{ color: t.pass, flexShrink: 0 }} />
                            : <Globe size={11} style={{ color: t.warn, flexShrink: 0 }} />}
                <span style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: t.ink }}>
                  {s.label}
                </span>
                <span className="flex items-center gap-1 flex-shrink-0">
                  <span className="px-1.5 py-0.5 rounded-full"
                        style={{ ...LBL, fontSize: 7, color: s.brokered ? t.pass : t.warn, background: `${s.brokered ? t.pass : t.warn}18` }}>
                    {s.brokered ? 'via AI-GW' : 'direct'}
                  </span>
                  <ScanChip t={t} label="manifest" scan={d?.scan} />
                </span>
              </div>
            )
          })}
          {discovered.some((d) => /withheld/.test(d.detail ?? '')) && (
            <p style={{ fontFamily: FONT.prose, fontSize: 10, color: t.inkFaint, marginTop: 2 }}>
              {discovered.find((d) => /withheld/.test(d.detail ?? '')).detail}
            </p>
          )}
        </div>
      )}

      {/* every call, with the scan that bracketed it on each side */}
      {toolSteps.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Wrench size={11} style={{ color: t.inkDim }} />
            <span style={{ ...LBL, fontSize: 8, color: t.inkDim }}>Calls</span>
          </div>
          {toolSteps.map((s, i) => {
            const bad = s.blocked
            return (
              <div key={i} className="px-2.5 py-2 mb-1.5"
                   style={{
                     background: bad ? `${t.block}0f` : t.sunken, borderRadius: 12,
                     border: `1px solid ${bad ? `${t.block}3a` : 'transparent'}`,
                   }}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span style={{ fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 600, color: bad ? t.block : t.ink }}>
                    {s.tool}
                  </span>
                  <span style={{ fontFamily: FONT.prose, fontSize: 9.5, color: t.inkFaint }}>
                    on {s.server}{s.round != null ? ` · round ${s.round}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-wrap mt-1.5">
                  <ScanChip t={t} label="params" scan={s.inputScan} />
                  <ScanChip t={t} label="result" scan={s.outputScan} />
                  {s.result != null && (
                    <span style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>
                      {s.result.length.toLocaleString()} chars returned
                    </span>
                  )}
                  {bad && (
                    <span className="px-1.5 py-0.5 rounded-full"
                          style={{ ...LBL, fontSize: 7.5, color: t.block, background: `${t.block}18`, border: `1px solid ${t.block}44` }}>
                      not executed
                    </span>
                  )}
                </div>
                {s.args && Object.keys(s.args).length > 0 && (
                  <div className="flex items-start gap-1.5 mt-1.5">
                    <CornerDownRight size={10} style={{ color: t.inkFaint, flexShrink: 0, marginTop: 2 }} />
                    {/* wrapped, not scrolled — a horizontal scrollbar inside a
                        300px pane hides the end of the arguments */}
                    <pre dir="ltr" className="flex-1 min-w-0"
                         style={{
                           fontFamily: FONT.mono, fontSize: 9.5, lineHeight: 1.45, color: t.inkDim, margin: 0,
                           whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                           display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                         }}>
                      {JSON.stringify(s.args).slice(0, 240)}
                    </pre>
                  </div>
                )}
                {s.error && (
                  <p style={{ fontFamily: FONT.prose, fontSize: 10, color: t.warn, marginTop: 3 }}>{s.error}</p>
                )}
              </div>
            )
          })}
        </>
      )}

      {faults.length > 0 && faults.map((f, i) => (
        <div key={i} className="flex items-start gap-1.5 px-2.5 py-2 mb-1.5" style={{ background: `${t.warn}14`, borderRadius: 12 }}>
          <AlertTriangle size={11} style={{ color: t.warn, flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim }}>
            <strong style={{ color: t.ink }}>{f.title}</strong>{f.detail ? ` — ${f.detail}` : ''}
          </span>
        </div>
      ))}

      {mcp.blocked && (
        <p style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: 1.45, color: t.block, marginTop: 2 }}>
          The run was stopped by a guardrail. A blocked manifest withholds that server's
          tools from the model entirely; a blocked call never executes.
        </p>
      )}
      {!toolSteps.length && (
        <p style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkFaint }}>
          Servers were reached and their manifests scanned, but the model answered
          without calling a tool.
        </p>
      )}
    </Block>
  )
}

/** Flatten report.data[].detection_results[] for one data_type. */
function readReport(scan, dataType) {
  const out = []
  for (const b of (scan?.report?.data ?? [])) {
    for (const r of (b.detection_results ?? [])) {
      if (!dataType || r.data_type === dataType) out.push(r)
    }
  }
  return out
}

const SVC = { agent_security: 'agent', dlp: 'dlp', pi: 'injection', tc: 'toxic', uf: 'url', malicious_code: 'code' }

// AIRS names the same six detectors in `prompt_detected` as the report does in
// `detection_results`, under different keys.
const DETECTED_TO_SVC = {
  agent: 'agent_security', dlp: 'dlp', injection: 'pi',
  toxic_content: 'tc', url_cats: 'uf', malicious_code: 'malicious_code',
}

/**
 * The AI-GW lane returns a guardrail hook verdict, not a `report.data[]`
 * breakdown — so there are no per-service results to read. But the detected map
 * carries all six detectors with a boolean each, which is enough to build the
 * same grid. Without this the gateway lane showed no detection at all.
 */
function resultsFromDetected(scan, dataType) {
  const map = dataType === 'response' ? scan?.response_detected : scan?.prompt_detected
  if (!map || !Object.keys(map).length) return []
  return Object.entries(map)
    .filter(([k]) => DETECTED_TO_SVC[k])
    .map(([k, fired]) => ({
      detection_service: DETECTED_TO_SVC[k],
      data_type: dataType,
      action: fired ? 'block' : 'allow',
      verdict: fired ? 'malicious' : 'benign',
      result_detail: {},
      _derived: true,
    }))
}

/**
 * `prompt_detection_details` / `response_detection_details` on the sync
 * response, rendered generically.
 *
 * AIRS puts sub-classification here — `toxic_content_details.toxic_categories`
 * is the one that matters most on stage — and it arrives on the scan itself,
 * without the separate report fetch. Walked generically rather than
 * cherry-picking known keys, so a detail type PA adds later shows up instead of
 * being silently dropped.
 */
function DetectionDetails({ t, details, where, skip = [] }) {
  const groups = Object.entries(details || {})
    .filter(([, v]) => v && Object.keys(v).length)
    .filter(([g]) => !skip.includes(g.replace(/_details$/, '')))
  if (!groups.length) return null
  return (
    <>
      {groups.map(([group, body]) => (
        <KV key={group + where} t={t} k={group.replace(/_details$/, '').replace(/_/g, ' ')} top>
          {Object.entries(body).map(([field, value]) => {
            const list = Array.isArray(value) ? value : [value]
            return (
              <div key={field} className="mb-1 last:mb-0">
                <div style={{ ...LBL, fontSize: 7, color: t.inkFaint, marginBottom: 3 }}>
                  {field.replace(/_/g, ' ')}{where === 'response' ? ' · response' : ''}
                </div>
                <div className="flex flex-wrap gap-1">
                  {list.filter(Boolean).map((v, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded"
                          style={{
                            ...LBL, fontSize: 7.5, color: t.block,
                            background: `${t.block}18`, border: `1px solid ${t.block}44`,
                          }}>
                      {typeof v === 'object' ? JSON.stringify(v).slice(0, 48) : String(v)}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </KV>
      ))}
    </>
  )
}

/**
 * Per-service sub-detail, for whichever services actually fired.
 *
 * Each AIRS detection service returns a differently shaped `result_detail`, and
 * the interesting part is service-specific: toxic content names its categories
 * and a confidence, URL filtering names the URL and its category, injection
 * returns the verbatim snippet. Collapsing all of that to "toxic ✕" throws away
 * the answer to the customer's next question. Shapes verified against live
 * responses, not guessed.
 */
function ServiceDetail({ t, result }) {
  const svc = result.detection_service
  const rd = result.result_detail || {}
  const mono = { fontFamily: FONT.mono, fontSize: 9.5, color: t.inkFaint }
  const Cat = ({ children, tone }) => (
    <span className="px-1.5 py-0.5 rounded"
          style={{ ...LBL, fontSize: 7.5, color: tone || t.block, background: `${tone || t.block}18`, border: `1px solid ${tone || t.block}44` }}>
      {children}
    </span>
  )
  const Snip = ({ text }) => (
    <p style={{
      fontFamily: FONT.mono, fontSize: 9.5, lineHeight: 1.45, color: t.inkDim, marginTop: 3,
      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
    }} title={text}>“{text}”</p>
  )

  if (svc === 'tc' && rd.tc_report) {
    const cats = rd.tc_report.toxic_categories ?? []
    return (
      <div>
        <div className="flex flex-wrap items-center gap-1">
          {rd.tc_report.confidence && <span style={mono}>confidence {rd.tc_report.confidence}</span>}
          {cats.map((c) => <Cat key={c}>{c}</Cat>)}
        </div>
        {(rd.tc_snippets ?? []).slice(0, 1).map((x, i) => <Snip key={i} text={x} />)}
      </div>
    )
  }

  if (svc === 'uf') {
    const rows = Array.isArray(rd.urlf_report) ? rd.urlf_report : []
    if (!rows.length) return null
    return (
      <div className="space-y-1.5">
        {rows.map((u, i) => (
          <div key={i}>
            <div className="break-all" style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.ink }}>{u.url}</div>
            <div className="flex flex-wrap items-center gap-1 mt-0.5">
              {(u.categories ?? []).map((c) => <Cat key={c}>{c}</Cat>)}
              {u.action && <span style={mono}>action {u.action}</span>}
              {u.risk_level && u.risk_level !== 'Not Given' && <span style={mono}>risk {u.risk_level}</span>}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (svc === 'pi') {
    return <>{(rd.pi_snippets ?? []).slice(0, 1).map((x, i) => <Snip key={i} text={x} />)}</>
  }

  if (svc === 'agent_security' && rd.agent_report) {
    const pats = rd.agent_report.agent_patterns ?? []
    return (
      <div className="flex flex-wrap items-center gap-1">
        {rd.agent_report.agent_framework && <span style={mono}>framework {rd.agent_report.agent_framework}</span>}
        {rd.agent_report.model_verdict && <span style={mono}>· verdict {rd.agent_report.model_verdict}</span>}
        {pats.map((x, i) => <Cat key={i}>{typeof x === 'string' ? x : JSON.stringify(x).slice(0, 40)}</Cat>)}
      </div>
    )
  }

  if (svc === 'malicious_code' && rd.mc_report) {
    const types = rd.mc_report.code_analysis_by_type ?? []
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span style={mono}>malware {rd.mc_report.malware_script_report?.verdict ?? '—'}</span>
        {types.map((x, i) => <Cat key={i}>{x?.type ?? JSON.stringify(x).slice(0, 30)}</Cat>)}
      </div>
    )
  }

  return null
}

/** Label/value line — keeps the telemetry column scannable. */
function KV({ t, k, children, top }) {
  return (
    <div className="flex gap-2.5 py-1" style={{ alignItems: top ? 'flex-start' : 'baseline' }}>
      <span className="flex-shrink-0" style={{ ...LBL, fontSize: 7.5, color: t.inkFaint, width: 58, paddingTop: top ? 2 : 0 }}>{k}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}


/**
 * Detection UI.
 *
 * The previous version was a cramped label/value sheet: six services crushed
 * into one chip row and every parameter as a mono key/value line. Readable if
 * you already knew the schema, useless across a room. This gives each layer its
 * own shape — a category banner, a service grid you can scan by colour, and one
 * card per service that actually fired carrying its own named parameters.
 */

const SERVICE_META = {
  agent_security: { name: 'Agent',     full: 'Agent security',   icon: Bot,       detail: 'toxic_content' },
  dlp:            { name: 'Data',      full: 'Data protection',  icon: FileLock2, detail: 'dlp' },
  pi:             { name: 'Injection', full: 'Prompt injection', icon: Syringe,   detail: 'injection' },
  tc:             { name: 'Toxic',     full: 'Toxic content',    icon: Biohazard, detail: 'toxic_content' },
  uf:             { name: 'URL',       full: 'URL filtering',    icon: Link2,     detail: 'url_cats' },
  malicious_code: { name: 'Code',      full: 'Malicious code',   icon: Code2,     detail: 'malicious_code' },
}

/** One tile in the service grid — scannable by colour before it is read. */
/**
 * One detection service.
 *
 * A tile that fired pulses for 3s when its scan lands, then settles into the
 * static red state. Six tiles share a shape and a size, so without the pulse
 * the audience reads all six to find the one that matters. `pulseKey` is the
 * scan id: selecting a different record replays the pulse, because React
 * reuses these components across records and `fired` alone would stay true
 * and never re-trigger.
 */
function ServiceTile({ t, svc, fired, pulseKey }) {
  const m = SERVICE_META[svc] ?? { name: svc, icon: Radar, blurb: '' }
  const Icon = m.icon
  const c = fired ? t.block : t.pass
  const [alert, setAlert] = useState(false)

  useEffect(() => {
    if (!fired) { setAlert(false); return }
    setAlert(true)
    const id = setTimeout(() => setAlert(false), 3000)
    return () => clearTimeout(id)
  }, [fired, pulseKey])

  const beat = { duration: 1, repeat: 2, ease: 'easeOut' }

  return (
    <motion.div
      className="relative px-2.5 py-2 overflow-hidden"
      style={{
        background: fired ? `${t.block}12` : t.sunken,
        borderRadius: 14,
        border: `1px solid ${fired ? `${t.block}3a` : 'transparent'}`,
      }}
      animate={alert
        ? { scale: [1, 1.03, 1], boxShadow: [`0 0 0 0 ${t.block}55`, `0 0 0 7px ${t.block}00`] }
        : { scale: 1, boxShadow: `0 0 0 0 ${t.block}00` }}
      transition={alert ? beat : { duration: 0.35 }}
    >
      {/* light sweep, one pass per beat */}
      {alert && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(100deg, ${t.block}00 32%, ${t.block}24 50%, ${t.block}00 68%)` }}
          initial={{ x: '-120%' }}
          animate={{ x: '120%' }}
          transition={{ duration: 1, repeat: 2, ease: 'easeInOut' }}
        />
      )}

      <div className="relative flex items-center gap-1.5">
        <Icon size={12} style={{ color: fired ? c : t.inkFaint, flexShrink: 0 }} />
        <motion.span
          className="rounded-full flex-shrink-0"
          style={{ width: 5, height: 5, background: c }}
          animate={alert ? { scale: [1, 1.6, 1], opacity: [1, 0.6, 1] } : { scale: 1, opacity: 1 }}
          transition={alert ? beat : { duration: 0.2 }}
        />
      </div>
      <div className="relative truncate" title={m.full || m.name}
           style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 700, color: t.ink, marginTop: 4 }}>
        {m.name}
      </div>
      <div className="relative" style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 600, color: fired ? c : t.inkDim }}>
        {fired ? 'blocked' : 'clean'}
      </div>
    </motion.div>
  )
}

/** Named parameter row inside a detail card. */
function Param({ t, k, children }) {
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <span className="flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 500, color: t.inkDim, width: 64 }}>{k}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function Tag({ t, children, tone }) {
  return (
    <span className="px-2 py-0.5 rounded-full inline-block"
          style={{
            fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600,
            color: tone || t.block, background: `${tone || t.block}1f`,
          }}>
      {children}
    </span>
  )
}

/**
 * One card per service that fired, carrying that service's own parameters.
 * Injection intentionally shows no snippet — the payload is already the bubble
 * two inches to the left, and repeating it wastes the column.
 */
function DetailCard({ t, result }) {
  const svc = result.detection_service
  const rd = result.result_detail || {}
  const m = SERVICE_META[svc] ?? { name: svc, icon: Radar }
  const Icon = m.icon
  const rows = []

  if (svc === 'tc' && rd.tc_report) {
    if (rd.tc_report.confidence) rows.push(['confidence', <Tag t={t}>{rd.tc_report.confidence}</Tag>])
    const cats = rd.tc_report.toxic_categories ?? []
    if (cats.length) rows.push(['categories', <div className="flex flex-wrap gap-1">{cats.map((c) => <Tag key={c} t={t}>{c}</Tag>)}</div>])
  } else if (svc === 'uf') {
    const urls = Array.isArray(rd.urlf_report) ? rd.urlf_report : []
    urls.forEach((u, i) => {
      rows.push([i === 0 ? 'url' : '', (
        <div>
          <div className="break-all" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.ink }}>{u.url}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {(u.categories ?? []).map((c) => <Tag key={c} t={t}>{c}</Tag>)}
            {u.action && <Tag t={t} tone={t.inkDim}>{u.action}</Tag>}
            {u.risk_level && u.risk_level !== 'Not Given' && <Tag t={t} tone={t.warn}>risk {u.risk_level}</Tag>}
          </div>
        </div>
      )])
    })
  } else if (svc === 'agent_security' && rd.agent_report) {
    if (rd.agent_report.agent_framework) rows.push(['framework', <Tag t={t} tone={t.inkDim}>{rd.agent_report.agent_framework}</Tag>])
    if (rd.agent_report.model_verdict) rows.push(['verdict', <Tag t={t}>{rd.agent_report.model_verdict}</Tag>])
    const pats = rd.agent_report.agent_patterns ?? []
    if (pats.length) rows.push(['patterns', <div className="flex flex-wrap gap-1">{pats.map((x, i) => <Tag key={i} t={t}>{typeof x === 'string' ? x : JSON.stringify(x).slice(0, 34)}</Tag>)}</div>])
  } else if (svc === 'malicious_code' && rd.mc_report) {
    rows.push(['malware', <Tag t={t} tone={rd.mc_report.malware_script_report?.verdict === 'benign' ? t.pass : t.block}>
      {rd.mc_report.malware_script_report?.verdict ?? '—'}
    </Tag>])
    const types = rd.mc_report.code_analysis_by_type ?? []
    if (types.length) rows.push(['analysis', <div className="flex flex-wrap gap-1">{types.map((x, i) => <Tag key={i} t={t}>{x?.type ?? JSON.stringify(x).slice(0, 28)}</Tag>)}</div>])
  }

  if (!rows.length) return null
  return (
    <div className="px-3 py-2.5 mb-1.5 last:mb-0" style={{ background: t.sunken, borderRadius: 16 }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={12} style={{ color: t.block }} />
        <span style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 700, color: t.ink }}>{m.full || m.name}</span>
      </div>
      {rows.map(([k, v], i) => <Param key={i} t={t} k={k}>{v}</Param>)}
    </div>
  )
}

export function EvidencePane({ t, message, scmUrl }) {
  const v = verdictOf(message)
  const meta = VERDICT_META[v]
  const up = message?.upload
  const tel = message?.telemetry
  const inScan = tel?.inputScan
  const outScan = tel?.outputScan

  if (!message) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-7 text-center" style={glass(t, { radius: 18 })}>
        <motion.div className="rounded-full flex items-center justify-center mb-4"
                    style={{ width: 56, height: 56, border: `1px solid ${t.hairline}` }}
                    animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.4, repeat: Infinity }}>
          <Radar size={22} style={{ color: t.inkFaint }} />
        </motion.div>
        <p style={{ ...LBL, fontSize: 10, color: t.inkDim }}>Standing by</p>
        <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkFaint, marginTop: 6, lineHeight: 1.55 }}>
          Fire a payload, or click any record to inspect what the gate did with it.
        </p>
      </div>
    )
  }

  const inKeys = detectorKeys(inScan?.prompt_detected)
  const outKeys = detectorKeys(outScan?.response_detected)
  const reported = [...readReport(inScan, 'prompt'), ...readReport(outScan, 'response')]
  // Fall back to the detected map when the gateway did not return a report.
  const allResults = reported.length
    ? reported
    : [...resultsFromDetected(inScan, 'prompt'), ...resultsFromDetected(outScan, 'response')]
  const firedCount = allResults.filter((r) => r.action === 'block' || r.verdict === 'malicious').length
  const dlpReport = readReport(inScan, 'prompt').find((r) => r.detection_service === 'dlp')?.result_detail?.dlp_report
  const dlpOutReport = readReport(outScan, 'response').find((r) => r.detection_service === 'dlp')?.result_detail?.dlp_report
  const patterns = [
    ...(dlpReport?.data_pattern_detection_offsets ?? []).map((p) => ({ ...p, where: 'prompt' })),
    ...(dlpOutReport?.data_pattern_detection_offsets ?? []).map((p) => ({ ...p, where: 'response' })),
  ]
  const maskedData = inScan?.prompt_masked_data ?? outScan?.response_masked_data
  // Detail groups already rendered as their own card, so the generic walker
  // does not repeat them.
  const coveredDetails = allResults
    .filter((r) => r.action === 'block' || r.verdict === 'malicious')
    .map((r) => SERVICE_META[r.detection_service]?.detail)
    .filter(Boolean)
    .concat('dlp')

  return (
    <div className="h-full overflow-y-auto" style={glass(t, { radius: 18 })}>
      {/* Verdict — the loudest thing in this column */}
      <div className="relative px-4 pt-4 pb-4 flex-shrink-0 overflow-hidden" style={{ borderBottom: `1px solid ${t.hairline}` }}>
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: `radial-gradient(120% 90% at 50% 0%, ${meta.color}26, transparent 70%)` }} />
        {v === 'blocked' && (
          <motion.div className="absolute inset-0 pointer-events-none"
                      style={{ background: `${t.block}18` }}
                      initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8 }} />
        )}
        <div className="relative">
          <div style={{ ...LBL, fontSize: 8.5, color: t.inkFaint }}>Verdict</div>
          <div className="flex items-center gap-2.5 mt-2">
            <motion.span className="flex items-center justify-center rounded-xl flex-shrink-0"
                         style={{
                           width: 38, height: 38, background: `${meta.color}1f`,
                           border: `1.5px solid ${meta.color}77`, boxShadow: bloom(meta.color, 0.9),
                         }}
                         initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
              {v === 'blocked' ? <ShieldX size={19} style={{ color: meta.color }} />
                : v === 'passed' ? <ShieldCheck size={19} style={{ color: meta.color }} />
                : <AlertTriangle size={19} style={{ color: meta.color }} />}
            </motion.span>
            <span style={{
              fontFamily: FONT.display, fontSize: 25, fontWeight: 700, letterSpacing: '-0.02em',
              color: meta.color, lineHeight: 1, textShadow: `0 0 24px ${meta.color}66`,
            }}>
              {meta.label}
            </span>
          </div>
          {up && (
            <div className="flex items-center gap-2 mt-2.5 px-2.5 py-2" style={{ background: t.sunken, borderRadius: 14 }}>
              <FileText size={13} style={{ color: v === 'blocked' ? t.block : t.pass, flexShrink: 0 }} />
              <span className="min-w-0">
                <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 700, color: t.ink }}>
                  {up.name}
                </span>
                <span className="block" style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkDim }}>
                  {[up.kind?.toUpperCase(), up.pages && `${up.pages}p`,
                    up.chars && `${up.chars.toLocaleString()} of ${(up.totalChars ?? up.chars).toLocaleString()} chars`,
                    up.chunks && `${up.chunks} chunk${up.chunks === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                </span>
              </span>
            </div>
          )}

          <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 8, lineHeight: 1.5 }}>
            {up
              ? (v === 'blocked'
                  ? 'Blocked on upload. The document was never attached, never sent to the model and is not stored anywhere — only this scan record exists.'
                  : v === 'unscanned'
                  ? 'AIRS was off. The file was not inspected before it became chat context.'
                  : 'Cleared on upload. The extracted text can be attached to a prompt.')
              : v === 'blocked'
              ? `Blocked by Prisma AIRS at the ${outScan?.action === 'block' ? 'output' : 'input'} scan. Nothing reached the user.`
              : v === 'unscanned'
              ? 'AIRS was off. Nothing was inspected — the clean look means nothing.'
              : v === 'error'
              ? (message.content || 'The call did not complete.')
              : 'Allowed by Prisma AIRS — cleared every scan on the line.'}
          </p>
        </div>
      </div>

      {up && (up.truncated || up.scanIncomplete) && (
        <div className="mx-3 mt-3 px-3 py-2.5 flex items-start gap-2"
             style={{ background: `${t.warn}14`, borderRadius: 16 }}>
          <AlertTriangle size={13} style={{ color: t.warn, flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.45, color: t.inkDim }}>
            {up.scanIncomplete
              ? 'A chunk failed to scan — do not read this verdict as a clean document.'
              : `Only the first ${up.chars?.toLocaleString()} characters were scanned of ${up.totalChars?.toLocaleString()}.`}
          </p>
        </div>
      )}

      {tel?.summary?.model && (
        <ModelCard t={t} label={tel.summary.model}
                   enforcement={tel.summary.enforcement} lane={tel.summary.lane}
                   tokensIn={tel?.llm?.tokens_in} tokensOut={tel?.llm?.tokens_out} />
      )}

      <Block t={t} title="Detection" count={`${firedCount} of ${allResults.length || 6}`}
             accent={firedCount ? t.block : t.pass}>

        {/* category — the headline decision */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 mb-2.5"
             style={{
               background: inScan?.action === 'block' ? `${t.block}12` : `${t.pass}12`,
               borderRadius: 16,
             }}>
          <span className="rounded-full flex-shrink-0"
                style={{ width: 8, height: 8, background: inScan?.action === 'block' ? t.block : t.pass }} />
          <span style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: inScan?.action === 'block' ? t.block : t.pass }}>
            {inScan?.category ?? '—'}
          </span>
          <span className="ml-auto" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
            {inScan?.action ?? '—'}
          </span>
        </div>

        {/* every service, as a scannable grid — only worth the space when
            something actually fired */}
        {allResults.length > 0 && firedCount > 0 ? (
          <>
            <div style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600, color: t.inkDim, marginBottom: 6 }}>Services run</div>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {allResults.map((r, i) => (
                <ServiceTile key={i} t={t} svc={r.detection_service}
                             fired={r.action === 'block' || r.verdict === 'malicious'}
                             pulseKey={inScan?.scan_id ?? message?.id} />
              ))}
            </div>
          </>
        ) : allResults.length > 0 ? (
          <p style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
            All {allResults.length} detection services ran and none matched.
          </p>
        ) : (
          <p style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
            No detection breakdown returned for this turn.
          </p>
        )}

        {/* parameters, per service that fired */}
        {allResults.filter((r) => r.action === 'block' || r.verdict === 'malicious').map((r, i) => (
          <DetailCard key={i} t={t} result={r} />
        ))}

        {allResults.some((r) => r._derived) && (
          <p style={{ fontFamily: FONT.prose, fontSize: 10, color: t.inkFaint, marginTop: 2 }}>
            {inScan?.reportPending || outScan?.reportPending
              // The report is fetched after the answer now, so for a moment
              // only the scan's own detector map is on screen.
              ? 'Verdicts from the scan. Per-service evidence is loading from the AIRS report…'
              : (inScan?.report?.error || outScan?.report?.error)
                // The reports endpoint has its own per-minute quota; a fast demo
                // can exhaust it. The verdict is unaffected — only the detail.
                ? `Verdicts from the scan. The AIRS report could not be fetched${/429|rate limit/i.test(inScan?.report?.error || outScan?.report?.error || '') ? ' — its per-minute quota was exhausted' : ''}, so per-service evidence is unavailable for this record.`
                : 'Verdicts from the in-gateway guardrail. Per-service parameters are only returned by the direct Runtime API.'}
          </p>
        )}

        {/* Anything the cards above did not already cover, rendered generically
            so a detail type PA adds later still surfaces. */}
        <DetectionDetails t={t} details={inScan?.prompt_detection_details} where="prompt" skip={coveredDetails} />
        <DetectionDetails t={t} details={outScan?.response_detection_details} where="response" skip={coveredDetails} />

        {/* DLP always shows — the profile in force matters even when it is clean */}
        {dlpReport?.dlp_profile_name && (
          <div className="px-3 py-2.5 mb-1.5" style={{ background: t.sunken, borderRadius: 16 }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileLock2 size={12} style={{ color: patterns.length ? t.block : t.inkFaint }} />
              <span style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, color: t.ink }}>Data protection</span>
            </div>
            <Param t={t} k="profile">
              <span style={{ fontFamily: FONT.mono, fontSize: 10, color: t.ink }}>{dlpReport.dlp_profile_name}</span>
            </Param>
            <Param t={t} k="rule 1">
              <Tag t={t} tone={dlpReport.data_pattern_rule1_verdict === 'MATCHED' ? t.block : t.pass}>
                {dlpReport.data_pattern_rule1_verdict || '—'}
              </Tag>
            </Param>
            {patterns.map((p, i) => {
              const tiers = [['high', p.high_confidence_detections], ['med', p.medium_confidence_detections], ['low', p.low_confidence_detections]]
                .filter(([, v]) => v?.length)
              return (
                <Param key={i} t={t} k={i === 0 ? 'matched' : ''}>
                  <div>
                    <span style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: t.block }}>{p.name}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Tag t={t} tone={t.inkDim}>{p.where}</Tag>
                      {p.version != null && <Tag t={t} tone={t.inkDim}>v{p.version}</Tag>}
                      {tiers.map(([k, v]) => <Tag key={k} t={t}>{k} · {v.length}</Tag>)}
                    </div>
                  </div>
                </Param>
              )
            })}
            {maskedData?.data && (
              <Param t={t} k="masked">
                <p style={{
                  fontFamily: FONT.mono, fontSize: 9.5, lineHeight: 1.45, color: t.pass,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{maskedData.data}</p>
              </Param>
            )}
          </div>
        )}
      </Block>

      {message.mcp?.steps?.length > 0 && <McpBlock t={t} mcp={message.mcp} />}

      {up?.blockedChunk && (
        <Block t={t} title="Where it tripped" accent={t.block}>
          <p style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim, marginBottom: 6 }}>
            Chunk {up.blockedChunk.index + 1} of {up.chunks}, from character {up.blockedChunk.start?.toLocaleString()}.
          </p>
          <pre className="whitespace-pre-wrap break-words px-3 py-2"
               style={{ background: t.codeBg, borderRadius: 12, fontFamily: FONT.mono, fontSize: 10, lineHeight: 1.5, color: t.ink, maxHeight: 180, overflow: 'auto' }}>
            {up.blockedChunk.excerpt}
          </pre>
        </Block>
      )}

      {inScan && (
        <Block t={t} title="Identifiers" defaultOpen={false}>
          <Row t={t} label="scan_id" value={inScan.scan_id} />
          <Row t={t} label="report" value={inScan.report_id} />
          <Row t={t} label="tr_id" value={inScan.tr_id} />
          <Row t={t} label="profile" value={inScan.profile_name} />
          <Row t={t} label="profile_id" value={inScan.profile_id} />
          <Row t={t} label="session" value={inScan.session_id} />
          <Row t={t} label="txn" value={inScan.rawResponse?.transaction_id} />
          <Row t={t} label="source" value={inScan.rawResponse?.source} />
          <Row t={t} label="trace" value={message.traceId} />
          {scmUrl && (
            <a href={scmUrl} target="_blank" rel="noreferrer"
               className="flex items-center justify-center gap-2 mt-3 px-3 py-2 rounded-xl transition-colors"
               style={{
                 ...LBL, fontSize: 9, color: t.block,
                 background: `${t.block}16`, border: `1px solid ${t.block}4d`, boxShadow: bloom(t.block, 0.35),
               }}>
              <ExternalLink size={11} /> Open in Strata Cloud Manager
            </a>
          )}
        </Block>
      )}

      {inScan?.rawResponse && (
        <Block t={t} title="Raw AIRS response" defaultOpen={false}>
          <pre className="px-2.5 py-2 rounded-lg overflow-auto whitespace-pre-wrap break-all"
               style={{ background: t.codeBg, fontFamily: FONT.mono, fontSize: 9.5, color: t.inkDim, maxHeight: 300, direction: 'ltr' }}>
            {JSON.stringify(outScan?.rawResponse ?? inScan.rawResponse, null, 2)}
          </pre>
        </Block>
      )}
    </div>
  )
}
