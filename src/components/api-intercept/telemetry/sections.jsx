/**
 * Overview · Timeline · Model · Network · Raw — the non-security tabs of the
 * Prompt Telemetry drawer. Every figure comes from `trace.detail`, which the
 * server measured on the request; nothing here is a typed-in estimate.
 */
import React, { useState } from 'react'
import { ExternalLink, ChevronDown, Route, ShieldX, ListChecks, AlertTriangle, ShieldCheck } from 'lucide-react'
import { Card, KV, Chip, Stat, IdValue, Note, Empty, CopyButton, FONT, LBL, fmtMs, fmtNum, pct, modelColor, IconSquare, useLaunch } from './primitives'
import { Waterfall, Legend, coveredMs, kindMs } from './Waterfall'
import { McpChainOfThought } from '../McpChainOfThought'

const SCM_BASE = 'https://stratacloudmanager.paloaltonetworks.com/ai-security/runtime/ai-sessions'

const BACKEND = {
  vertex: 'Google Vertex AI', bedrock: 'AWS Bedrock', azure: 'Azure OpenAI', aigw: 'SCM AI Gateway',
  'moh-aigw': 'SCM AI Gateway · Ministry of Health', portkey: 'Legacy LLM Gateway · api.portkey.ai',
}

const ENFORCEMENT = {
  'api-layer': 'Scanned by this app through the Prisma AIRS API — the prompt before the model is called, the response before it is returned.',
  'ai-gateway-guardrail': 'Enforced inside the SCM AI Gateway by its Prisma AIRS guardrail. This app never calls AIRS itself on this lane.',
  'ai-gateway-guardrail + tool_event': 'The gateway guardrail scans every model turn; this app scans every MCP event directly — the manifest, each call’s parameters and each result.',
  'legacy-gateway-airs-guardrail': 'Enforced inside the legacy LLM Gateway (api.portkey.ai) by its Prisma AIRS guardrail. This app never calls AIRS itself on this lane.',
  'portkey-native-guardrail': 'Enforced by Portkey\u2019s own native guardrail inside the legacy gateway (PII, code and word checks) \u2014 not by Prisma AIRS.',
  none: 'Prisma AIRS was off. Nothing was inspected in either direction.',
}

export const allHttp = (spans) => spans.flatMap((s) => (s.http || []).map((h) => ({ ...h, span: s.label })))

/**
 * Guardrail checks that ERRORED. A fail-open guardrail reports the hook as
 * passed even when its check could not run — measured on the legacy gateway,
 * whose AIRS check gets HTTP 403 and lets every prompt through unscanned. An
 * "ALLOWED" verdict there is not a clean scan, and must not read like one.
 */
export function guardrailErrors(detail) {
  return (detail.gateway?.hooks || []).flatMap((h) => (h.checks || [])
    .filter((c) => c.error)
    .map((c) => ({ phase: h.phase, hook: h.id, check: c.id, message: c.error?.message || JSON.stringify(c.error), hookVerdict: h.verdict })))
}

/** Which stage decided a block. */
function decidingStage(d) {
  if (d.verdict !== 'BLOCKED') return null
  const gw = d.airs?.input?.via === 'ai-gateway-guardrail' || d.airs?.output?.via === 'ai-gateway-guardrail'
  if (d.airs?.input?.action === 'block') return gw ? 'Gateway input guardrail (prompt) — the model was never called' : 'AIRS prompt scan — the model was never called'
  if (d.airs?.output?.action === 'block') return gw ? 'Gateway output guardrail (response)' : 'AIRS response scan — the answer was withheld'
  const st = (d.mcp?.steps || []).find((s) => s.blocked || s.kind === 'blocked')
  return st ? st.title : 'a guardrail stage'
}

/** A row in the launch look's verdict card: icon square, title, text. */
function StoryRow({ t, icon, tone, title, children }) {
  return (
    <div className="flex items-start gap-3">
      <IconSquare t={t} icon={icon} tone={tone} size={32} />
      <div className="min-w-0 flex-1">
        <div style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{title}</div>
        <div style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.5, color: t.inkDim, marginTop: 1 }}>{children}</div>
      </div>
    </div>
  )
}

function TextBlock({ t, label, text, dir }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  const long = text.length > 420
  return (
    <KV t={t} k={label} top>
      <div
        dir={dir || 'auto'}
        className="whitespace-pre-wrap break-words"
        style={{ fontFamily: FONT.mono, fontSize: 10.5, lineHeight: 1.5, color: t.ink, maxHeight: open ? 'none' : 120, overflow: 'hidden' }}
      >
        {text}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {long && (
          <button type="button" onClick={() => setOpen(!open)} style={{ ...LBL, fontSize: 8, color: t.live }}>
            {open ? 'collapse' : `show all · ${fmtNum(text.length)} chars`}
          </button>
        )}
        <CopyButton t={t} text={text} size={10} />
      </div>
    </KV>
  )
}

// ─── Overview ───────────────────────────────────────────────────────────────

export function OverviewTab({ t, trace, detail, verdictMeta }) {
  const spans = detail.timeline?.spans || []
  const total = detail.timeline?.totalMs
  const airsMs = kindMs(spans, ['airs'])
  const reportMs = kindMs(spans, ['report'])                           // on the critical path (older traces)
  const reportBgMs = kindMs(spans, ['report'], { background: true })   // deferred, after or alongside
  const modelMs = detail.llm?.meta?.providerMs ?? detail.llm?.latencyMs ?? kindMs(spans, ['model'])
  const serverMs = detail.llm?.meta?.serverLatencyMs
  const tk = detail.llm?.tokens || {}
  const blockedBy = decidingStage(detail)
  const tsg = detail.airs?.tsg
  const gwHeaders = detail.gateway?.headers || {}

  const launch = useLaunch()
  const errs = guardrailErrors(detail)

  return (
    <div className="space-y-3">
      {/* Launch look: the drawer's band already says the verdict, so this card
          explains it instead — how it was enforced, where it stopped, what
          fired — as rows in the evidence pane's style. */}
      {launch ? (
        <Card t={t} tone={verdictMeta.color}>
          <div className="space-y-3.5 pt-4">
            <StoryRow t={t} icon={Route} title="How it was enforced">{ENFORCEMENT[detail.enforcement] ?? detail.enforcement}</StoryRow>
            {blockedBy && (
              <StoryRow t={t} icon={ShieldX} tone={t.block} title="Stopped at">
                <span style={{ color: t.block, fontWeight: 600 }}>{blockedBy}</span>
              </StoryRow>
            )}
            {!blockedBy && trace.verdict !== 'BLOCKED' && detail.airsEnabled && !errs.length && (
              <StoryRow t={t} icon={ShieldCheck} tone={t.pass} title="Cleared">Every scan on the line allowed it{trace.category ? ` · ${trace.category}` : ''}.</StoryRow>
            )}
            {trace.threats_detected?.length > 0 && (
              <StoryRow t={t} icon={ListChecks} tone={t.block} title="Detected">
                <span className="flex flex-wrap gap-1 mt-0.5">
                  {trace.threats_detected.map((x) => <Chip key={x} t={t} tone={t.block}>{String(x).replace(/_/g, ' ')}</Chip>)}
                </span>
              </StoryRow>
            )}
            {errs.length > 0 && (
              <StoryRow t={t} icon={AlertTriangle} tone={t.warn} title="Not actually scanned">
                The guardrail check errored ({[...new Set(errs.map((e) => e.message))].join('; ')})
                {errs.some((e) => e.hookVerdict !== false) ? ' and failed open — the request went through without an AIRS verdict.' : '.'}
              </StoryRow>
            )}
          </div>
        </Card>
      ) : (
      <Card t={t} tone={verdictMeta.color}>
        <div className="flex items-start gap-3 pt-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontFamily: FONT.display, fontSize: 24, fontWeight: 700, color: verdictMeta.color, letterSpacing: '0.02em' }}>{verdictMeta.label}</span>
              {trace.category && detail.airsEnabled && <Chip t={t} tone={verdictMeta.color}>{trace.category}</Chip>}
            </div>
            <p style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.5, color: t.inkDim, marginTop: 4 }}>
              {ENFORCEMENT[detail.enforcement] ?? detail.enforcement}
            </p>
            {blockedBy && <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.block, marginTop: 4 }}>Stopped at: <b>{blockedBy}</b></p>}
            {guardrailErrors(detail).length > 0 && (
              <div className="mt-2 px-3 py-2" style={{ background: `${t.warn}18`, border: `1px solid ${t.warn}55`, borderRadius: 12, fontFamily: FONT.prose, fontSize: 11.5, color: t.ink }}>
                <b style={{ color: t.warn }}>Not actually scanned.</b> The guardrail check errored
                ({[...new Set(guardrailErrors(detail).map((e) => e.message))].join('; ')})
                {guardrailErrors(detail).some((e) => e.hookVerdict !== false) ? ' and the guardrail failed open — the request went through without an AIRS verdict.' : '.'}
              </div>
            )}
            {trace.threats_detected?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {trace.threats_detected.map((x) => <Chip key={x} t={t} tone={t.block}>{String(x).replace(/_/g, ' ')}</Chip>)}
              </div>
            )}
          </div>
        </div>
      </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Stat t={t} label="Server total · wall clock" value={fmtMs(total)} sub={`request in → response ready · ${spans.filter((s) => !s.parent).length} measured steps`} />
        <Stat t={t} label="Prisma AIRS" value={detail.airsEnabled ? fmtMs(airsMs) : 'off'}
          tone={!detail.airsEnabled || guardrailErrors(detail).length ? t.warn : trace.verdict === 'BLOCKED' ? t.block : t.pass}
          sub={guardrailErrors(detail).length ? 'check errored — no verdict returned' : detail.airsEnabled
            ? `${pct(airsMs, total)} of total${reportMs ? ` · +${fmtMs(reportMs)} report fetch` : ''}${reportBgMs ? ` · report fetched off the critical path` : ''}`
            : 'nothing scanned'} />
        {detail.llm ? (
          <Stat t={t} label={detail.llm?.meta?.providerMs != null ? 'Provider (inside gateway)' : 'Model call'} value={fmtMs(modelMs)} tone={modelColor(t)}
            sub={serverMs != null ? `provider-reported ${fmtMs(serverMs)} · ${fmtMs(Math.max(0, (detail.llm?.latencyMs ?? 0) - serverMs))} outside the model` : `${pct(modelMs, total)} of total`} />
        ) : (
          <Stat t={t} label="Model call" value="not called" tone={t.inkDim} sub="stopped before the model — no tokens spent" />
        )}
        <Stat t={t} label="Tokens" value={tk.input != null || tk.output != null ? `${fmtNum(tk.input)} → ${fmtNum(tk.output)}` : '—'}
          sub={[tk.cached ? `${fmtNum(tk.cached)} cached` : null, tk.reasoning ? `${fmtNum(tk.reasoning)} reasoning` : null, detail.mcp?.turns?.length ? `${detail.mcp.turns.length} model turns` : null, detail.llm?.meta?.ttftMs != null ? `first token ${fmtMs(detail.llm.meta.ttftMs)}` : null].filter(Boolean).join(' · ') || 'input → output'} />
      </div>

      <Card t={t} title="Timeline">
        <Waterfall t={t} spans={spans} totalMs={total} compact />
      </Card>

      <Card t={t} title="Where it ran">
        <KV t={t} k="Target">{BACKEND[detail.backend] ?? detail.backend}{detail.llm?.meta?.region ? ` · ${detail.llm.meta.region}` : ''}</KV>
        <KV t={t} k="Model"><IdValue t={t} value={detail.modelId} /></KV>
        {detail.llm?.meta?.path && <KV t={t} k="Call path">{detail.llm.meta.path}</KV>}
        <KV t={t} k="AIRS profile"><span dir="ltr">{detail.airsEnabled ? (detail.airs?.profile ?? '—') : 'off'}</span></KV>
        {detail.airsEnabled && <KV t={t} k="AIRS endpoint"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>{detail.airs?.host ?? '—'}</span></KV>}
        {detail.airsEnabled && tsg && (
          <KV t={t} k="SCM tenant">
            <span className="inline-flex items-center gap-2 flex-wrap">
              <IdValue t={t} value={tsg} />
              <a href={`${SCM_BASE}?tsg_id=${tsg}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ ...LBL, fontSize: 8, color: t.live }}>
                Open AI sessions <ExternalLink size={10} />
              </a>
            </span>
          </KV>
        )}
        <KV t={t} k="Server"><span style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>{detail.host?.server ?? '—'}{detail.host?.via ? ` · via ${detail.host.via}` : ''}{detail.host?.node ? ` · node ${detail.host.node}` : ''}</span></KV>
      </Card>

      <Card t={t} title="Identifiers">
        <KV t={t} k="Trace id"><IdValue t={t} value={trace.id} /></KV>
        {detail.airs?.input?.scan_id && <KV t={t} k="Prompt scan id"><IdValue t={t} value={detail.airs.input.scan_id} /></KV>}
        {detail.airs?.output?.scan_id && <KV t={t} k="Response scan id"><IdValue t={t} value={detail.airs.output.scan_id} /></KV>}
        {gwHeaders['trace-id'] && gwHeaders['trace-id'] === detail.airs?.input?.tr_id ? (
          // Measured: the gateway hands its own trace id to AIRS as tr_id, so one
          // id finds this request in the Portkey logs AND in SCM AI sessions.
          <KV t={t} k="Trace = AIRS session" top>
            <IdValue t={t} value={gwHeaders['trace-id']} />
            <div style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkFaint, marginTop: 2 }}>
              The gateway passes its trace id to AIRS as the session id — search this one value in the Portkey logs and in SCM AI sessions.
            </div>
          </KV>
        ) : (
          <>
            {detail.airs?.input?.tr_id && <KV t={t} k="AIRS session" hint="tr_id — search for it in SCM AI sessions"><IdValue t={t} value={detail.airs.input.tr_id} /></KV>}
            {gwHeaders['trace-id'] && <KV t={t} k="Portkey trace id" hint="x-portkey-trace-id — find it in the gateway logs"><IdValue t={t} value={gwHeaders['trace-id']} /></KV>}
          </>
        )}
        {detail.airs?.input?.requestId && <KV t={t} k="AIRS request id"><IdValue t={t} value={detail.airs.input.requestId} /></KV>}
        {detail.llm?.meta?.requestId && <KV t={t} k="Provider request"><IdValue t={t} value={detail.llm.meta.requestId} /></KV>}
        {detail.llm?.meta?.responseId && <KV t={t} k="Response id"><IdValue t={t} value={detail.llm.meta.responseId} /></KV>}
        {detail.gateway?.configId && <KV t={t} k="Gateway config"><IdValue t={t} value={detail.gateway.configId} /></KV>}
      </Card>

      <Card t={t} title="Exchange">
        <TextBlock t={t} label="Prompt" text={trace.prompt} />
        {detail.attachment && <KV t={t} k="Attachment">{detail.attachment.name} · {fmtNum(detail.attachment.chars)} chars · text not stored</KV>}
        <TextBlock t={t} label="Response" text={trace.response} />
        {!trace.response && trace.verdict === 'BLOCKED' && <KV t={t} k="Response"><span style={{ color: t.block }}>withheld — blocked</span></KV>}
        {trace.attack_label && <KV t={t} k="Attack">{trace.attack_label}{trace.attack_severity ? ` · ${trace.attack_severity}` : ''}</KV>}
      </Card>
    </div>
  )
}

// ─── Timeline ───────────────────────────────────────────────────────────────

export function TimelineTab({ t, detail }) {
  const spans = detail.timeline?.spans || []
  const total = detail.timeline?.totalMs || 0
  const covered = Math.round(coveredMs(spans, total))
  const own = Math.max(0, total - covered)
  const hasDerived = spans.some((s) => s.derived)
  const bg = spans.filter((s) => s.background || s.attrs?.background)
  const bedrock = detail.backend === 'bedrock'
  return (
    <div className="space-y-3">
      <Card t={t} title={`Waterfall · ${fmtMs(total)}`} right={<span style={{ fontFamily: FONT.prose, fontSize: 10, color: t.inkFaint }}>click a row for detail</span>}>
        <Waterfall t={t} spans={spans} totalMs={total} />
        <Legend t={t} spans={spans} />
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Stat t={t} label="Measured steps" value={fmtMs(covered)} sub={`${pct(covered, total)} of the request`} />
          <Stat t={t} label="This server, between steps" value={fmtMs(own)} sub="routing · JSON · trace write" />
          <Stat t={t} label="Started" value={new Date(detail.timeline?.startedAt).toLocaleTimeString([], { hour12: false })}
            sub={new Date(detail.timeline?.startedAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })} />
        </div>
      </Card>
      <Card t={t} title="How these numbers were measured">
        <Note t={t}>
          Every step is timed on one monotonic clock from the moment the request reached this server, so offsets are real and
          parallel work overlaps. Under each bar, the HTTP requests made inside that step are split into <b>connect</b> (only when
          a new TCP+TLS connection was opened), <b>wait</b> (time to first byte) and <b>download</b>.
        </Note>
        <Note t={t}>
          <b>Wait</b> is network round trip plus the remote service's processing, reported as one number. Neither AIRS nor the model
          providers return their own processing time, so no split is invented here.
          {bedrock && ' The AWS SDK does not use fetch, so Bedrock calls show no HTTP phases — instead Bedrock reports its own server-side model time (Model tab).'}
        </Note>
        {bg.length > 0 && (
          <Note t={t}>
            The AIRS report fetch{bg.length > 1 ? 'es' : ''} ({bg.map((s) => fmtMs(s.ms)).join(' + ')}) ran off the critical path — the verdict comes from
            the scan itself, so the report is fetched alongside the model call or after the response went out, and fills in the
            per-service evidence when it lands. It used to run inline and cost 0.6–2.0s on every block.
          </Note>
        )}
        {hasDerived && (
          <Note t={t}>
            Rows marked ≈ sit inside the AI-GW call. Their order and durations come from the gateway's own hook timestamps; only their
            position within the round trip is centred, because the split of network time before and after cannot be seen from here.
          </Note>
        )}
      </Card>
    </div>
  )
}

// ─── Model ──────────────────────────────────────────────────────────────────

function BreakdownBar({ t, b }) {
  const parts = [
    ['Input guardrail', b.inputGuardrailMs, t.pass],
    ['Provider', b.providerMs, modelColor(t)],
    ['Output guardrail', b.outputGuardrailMs, t.pass],
    ['Outside the gateway', b.outsideMs, t.idle],
  ].filter(([, v]) => v != null && v > 0)
  const sum = parts.reduce((n, [, v]) => n + v, 0) || 1
  return (
    <div>
      <div className="flex h-3 overflow-hidden" style={{ borderRadius: 6, background: t.sunken }}>
        {parts.map(([k, v, c], i) => <span key={k} title={`${k} ${fmtMs(v)}`} style={{ width: `${(v / sum) * 100}%`, background: c, opacity: i === 3 ? 0.5 : 1, borderRight: `2px solid ${t.panel}` }} />)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
        {parts.map(([k, v, c]) => (
          <span key={k} style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: c, marginRight: 4 }} />{k} {fmtMs(v)} · {pct(v, sum)}
          </span>
        ))}
      </div>
      {b.blockedAtInput && <p style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.block, marginTop: 4 }}>Blocked at the input guardrail — the provider was never called.</p>}
    </div>
  )
}

export function ModelTab({ t, detail }) {
  const l = detail.llm
  const m = l?.meta || {}
  const tk = l?.tokens || {}
  const gw = detail.gateway
  const hdr = gw?.headers || {}
  // An MCP loop's wall clock includes tool execution and scans — throughput is
  // measured over the model turns alone.
  const turnMs = detail.mcp?.turns?.length ? detail.mcp.turns.reduce((n, x) => n + (x.ms || 0), 0) : null
  const provMs = m.providerMs ?? m.serverLatencyMs ?? turnMs ?? null
  const tps = tk.output && (provMs || l?.latencyMs) ? Math.round((tk.output / (provMs || l.latencyMs)) * 1000) : null
  return (
    <div className="space-y-3">
      {!l ? (
        <Card t={t} title="Model"><Empty t={t}>The model was never called — the request was stopped before it.</Empty></Card>
      ) : (
        <Card t={t} title="Model call">
          <KV t={t} k="Requested"><IdValue t={t} value={l.modelId} /></KV>
          {m.invokedId && m.invokedId !== l.modelId && (
            <KV t={t} k="Invoked as" top>
              <IdValue t={t} value={m.invokedId} />
              {m.profileRetry && <div style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.warn, marginTop: 2 }}>The bare id was refused ("on-demand throughput not supported") and retried as a cross-region inference profile. The server now remembers this id and goes straight to the profile on later calls.</div>}
              {m.profileKnown && <div style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkFaint, marginTop: 2 }}>Sent straight to the cross-region inference profile — this model refuses its bare id, so the server skips it.</div>}
            </KV>
          )}
          {m.servedModel && m.servedModel !== l.modelId && <KV t={t} k="Served model"><IdValue t={t} value={m.servedModel} /></KV>}
          <KV t={t} k="Call path">{m.path ?? BACKEND[l.backend] ?? l.backend}{m.region ? ` · ${m.region}` : ''}{m.endpointHost ? ` · ${m.endpointHost}` : ''}</KV>
          {m.provider && <KV t={t} k="Provider">{m.provider}</KV>}
          <KV t={t} k="Measured">{fmtMs(l.latencyMs)} <span style={{ color: t.inkFaint }}>· from this server, including network</span></KV>
          {m.serverLatencyMs != null && (
            <KV t={t} k="Provider-reported">{fmtMs(m.serverLatencyMs)} <span style={{ color: t.inkFaint }}>· Bedrock's own metrics.latencyMs — {fmtMs(Math.max(0, l.latencyMs - m.serverLatencyMs))} of the call was outside the model</span></KV>
          )}
          {m.providerMs != null && <KV t={t} k="Provider share">{fmtMs(m.providerMs)} <span style={{ color: t.inkFaint }}>· inside the gateway, between the two guardrails</span></KV>}
          {m.ttftMs != null && <KV t={t} k="First token">{fmtMs(m.ttftMs)} <span style={{ color: t.inkFaint }}>· from sending the request — what a chat user waits before anything appears</span></KV>}
          {m.streamMs != null && <KV t={t} k="Streaming">{fmtMs(m.streamMs)} <span style={{ color: t.inkFaint }}>· first token to last{tk.output ? ` · ${Math.round(tk.output / (m.streamMs / 1000))} tok/s while streaming` : ''}</span></KV>}
          {m.authMs != null && <KV t={t} k="Credential fetch">{fmtMs(m.authMs)} <span style={{ color: t.inkFaint }}>· Google ADC access token, before the call</span></KV>}
          <KV t={t} k="Finish reason">{l.finishReason ?? '—'}</KV>
          <KV t={t} k="Tokens">
            {fmtNum(tk.input)} in · {fmtNum(tk.output)} out{tk.total != null ? ` · ${fmtNum(tk.total)} total` : ''}
            {tk.cached ? ` · ${fmtNum(tk.cached)} cached` : ''}{tk.cacheWrite ? ` · ${fmtNum(tk.cacheWrite)} cache write` : ''}{tk.reasoning ? ` · ${fmtNum(tk.reasoning)} reasoning` : ''}
          </KV>
          {tps != null && <KV t={t} k="Throughput">{tps} tok/s <span style={{ color: t.inkFaint }}>· over {turnMs != null && provMs === turnMs ? `${detail.mcp.turns.length} model turns (${fmtMs(turnMs)}), not tool time` : provMs ? 'provider time' : 'measured time'}</span></KV>}
          {(m.transientRetries > 0 || m.sdkAttempts > 1) && <KV t={t} k="Retries"><span style={{ color: t.warn }}>{m.transientRetries} capacity retries · {m.sdkAttempts} SDK attempts · {fmtMs(m.sdkRetryDelayMs)} backoff</span></KV>}
          {m.requestId && <KV t={t} k="Request id"><IdValue t={t} value={m.requestId} /></KV>}
          {m.responseId && <KV t={t} k="Response id"><IdValue t={t} value={m.responseId} /></KV>}
          {m.systemFingerprint && <KV t={t} k="Fingerprint"><IdValue t={t} value={m.systemFingerprint} /></KV>}
          {m.providerFilter && (
            <KV t={t} k="Provider filter" top>
              <div style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim, marginBottom: 2 }}>The provider's own content filter — it runs whatever AIRS decides.</div>
              <pre className="whitespace-pre-wrap break-all" style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkDim }}>{JSON.stringify(m.providerFilter, null, 1).slice(0, 1200)}</pre>
            </KV>
          )}
        </Card>
      )}

      {gw && (
        <Card t={t} title="SCM AI Gateway">
          {gw.breakdown && <div className="pt-1 pb-2"><BreakdownBar t={t} b={gw.breakdown} /></div>}
          <KV t={t} k="Endpoint"><span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>{gw.baseUrl}</span></KV>
          <KV t={t} k="Config">{gw.configId ? <IdValue t={t} value={gw.configId} /> : 'workspace default'} <span style={{ color: t.inkFaint }}>· {gw.lane} lane</span></KV>
          {hdr['trace-id'] && <KV t={t} k="Portkey trace id"><IdValue t={t} value={hdr['trace-id']} /></KV>}
          {hdr.provider && <KV t={t} k="Routed to">{hdr.provider}{gw.servedModel ? ` · ${gw.servedModel}` : ''}</KV>}
          {hdr['cache-status'] && <KV t={t} k="Cache" hint="x-portkey-cache-status">{hdr['cache-status']}{hdr['cache-status'] === 'REFRESH' ? ' · fresh upstream call, cache bypassed' : ''}</KV>}
          {hdr['retry-attempt-count'] != null && <KV t={t} k="Gateway retries">{hdr['retry-attempt-count']}</KV>}
          {gw.completionId && <KV t={t} k="Completion id"><IdValue t={t} value={gw.completionId} /></KV>}
          {(gw.hooks || []).map((h, i) => (
            <KV key={i} t={t} k={`${h.phase} guardrail`} top>
              <span className="inline-flex items-center gap-2 flex-wrap">
                <IdValue t={t} value={h.id} />
                <Chip t={t} tone={h.verdict === false ? t.block : t.pass}>{h.verdict === false ? 'failed' : 'passed'}</Chip>
                <span style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }}>{fmtMs(h.execMs)}</span>
              </span>
              {(h.checks || []).map((c, j) => (
                <div key={j} style={{ fontFamily: FONT.mono, fontSize: 10, color: c.error ? t.warn : t.inkFaint, marginTop: 2 }}>
                  {c.id} · {c.error ? `ERROR ${c.error?.message || ''}` : `${c.scan?.action ?? (c.verdict ? 'pass' : 'fail')} · ${c.scan?.category ?? '—'}`} · {fmtMs(c.execMs)}
                </div>
              ))}
            </KV>
          ))}
        </Card>
      )}

      {detail.mcp && (
        <Card t={t} title={detail.mcp.kind === 'agent' ? 'Agent · in-process tool call' : `MCP loop · ${detail.mcp.rounds} round${detail.mcp.rounds === 1 ? '' : 's'} · ${detail.mcp.toolCalls} tool call${detail.mcp.toolCalls === 1 ? '' : 's'}`}>
          <KV t={t} k="Routing">{detail.mcp.route ?? '—'}</KV>
          {(detail.mcp.turns || []).length > 0 && (
            <div className="mt-1 overflow-x-auto">
              <table className="w-full" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ ...LBL, fontSize: 7.5, color: t.inkFaint, textAlign: 'left' }}>
                    {['turn', 'tokens in', 'out', 'tool calls', 'guardrail in', 'guardrail out', 'duration', 'finish'].map((h) => <th key={h} className="py-1 pr-2 font-bold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {detail.mcp.turns.map((x) => (
                    <tr key={x.round} style={{ borderTop: `1px solid ${t.hairline}` }}>
                      <td className="py-1 pr-2" style={{ color: t.ink }}>{x.round}</td>
                      <td className="pr-2">{fmtNum(x.tokensIn)}</td>
                      <td className="pr-2">{fmtNum(x.tokensOut)}</td>
                      <td className="pr-2">{x.toolCalls}</td>
                      <td className="pr-2">{fmtMs(x.guardrailInMs)}</td>
                      <td className="pr-2">{fmtMs(x.guardrailOutMs)}</td>
                      <td className="pr-2" style={{ color: t.ink }}>{fmtMs(x.ms)}</td>
                      <td>{x.finish ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Note t={t}>Each turn re-sends the whole conversation, including tool results, so input tokens grow round by round.</Note>
            </div>
          )}
          {(detail.mcp.steps || []).length > 0 && <div className="mt-2"><McpChainOfThought mcp={{ steps: detail.mcp.steps }} /></div>}
        </Card>
      )}
    </div>
  )
}

// ─── Network ────────────────────────────────────────────────────────────────

export function NetworkTab({ t, detail }) {
  const rows = allHttp(detail.timeline?.spans || [])
  const fresh = rows.filter((h) => h.reused === false)
  const connectTotal = fresh.reduce((n, h) => n + (h.connectMs || 0), 0)
  const hosts = [...new Set(rows.map((h) => h.host))]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat t={t} label="HTTP requests" value={rows.length} sub={`${hosts.length} host${hosts.length === 1 ? '' : 's'}`} />
        <Stat t={t} label="New connections" value={fresh.length} sub={fresh.length ? `${fmtMs(connectTotal)} spent connecting` : 'all reused (keep-alive)'} />
        <Stat t={t} label="Waiting on remote" value={fmtMs(rows.reduce((n, h) => n + (h.waitMs || 0), 0))} sub="sum of time to first byte" />
      </div>
      <Card t={t} title="Requests" pad={false}>
        {!rows.length ? <div className="px-4 pb-3"><Empty t={t}>No fetch-based HTTP requests were recorded for this trace.</Empty></div> : (
          <div className="overflow-x-auto px-4 pb-3">
            <table className="w-full" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ ...LBL, fontSize: 7.5, color: t.inkFaint, textAlign: 'left' }}>
                  {['+at', 'request', 'status', 'connection', 'wait', 'download', 'total'].map((h) => <th key={h} className="py-1 pr-2 font-bold whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((h, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${t.hairline}`, verticalAlign: 'top' }}>
                    <td className="py-1 pr-2 whitespace-nowrap">{fmtMs(h.start)}</td>
                    <td className="py-1 pr-2" dir="ltr">
                      <div style={{ color: t.ink }} className="break-all">{h.method} {h.host}{h.path}</div>
                      <div style={{ color: t.inkFaint, fontFamily: FONT.prose, fontSize: 9.5 }}>{h.span}</div>
                    </td>
                    <td className="pr-2" style={{ color: h.status >= 400 ? t.block : t.pass }}>{h.status ?? '—'}{h.httpVersion ? <span style={{ color: t.inkFaint }}> {h.httpVersion}</span> : null}</td>
                    <td className="pr-2 whitespace-nowrap">{h.reused ? 'reused' : `new · ${fmtMs(h.connectMs)}`}</td>
                    <td className="pr-2 whitespace-nowrap" style={{ color: t.ink }}>{fmtMs(h.waitMs)}</td>
                    <td className="pr-2 whitespace-nowrap">{fmtMs(h.downloadMs)}</td>
                    <td className="whitespace-nowrap">{fmtMs(h.totalMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Note t={t}>
        Captured from Node's own HTTP client (undici diagnostics channels) for every fetch this request made. A new connection
        includes DNS, TCP and TLS; a reused one skipped all three. <b>Wait</b> is round trip plus remote processing — not separable
        from here.{detail.backend === 'bedrock' ? ' Bedrock calls go through the AWS SDK’s own HTTP stack and are not listed.' : ''}
      </Note>
    </div>
  )
}

// ─── Raw ────────────────────────────────────────────────────────────────────

export function RawTab({ t, trace }) {
  const json = JSON.stringify(trace, null, 2)
  return (
    <Card t={t} title={`Raw trace · ${fmtNum(json.length)} chars`} right={<CopyButton t={t} text={json} />}>
      <pre className="overflow-auto" dir="ltr"
        style={{ maxHeight: '62vh', background: t.codeBg, color: t.ink, borderRadius: 12, padding: 12, fontFamily: FONT.mono, fontSize: 10, lineHeight: 1.45 }}>
        {json}
      </pre>
    </Card>
  )
}

// ─── Older traces (recorded before measured telemetry) ───────────────────────

export function LegacyView({ t, trace, verdictMeta }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-3">
      <Card t={t} tone={verdictMeta.color}>
        <div className="pt-3">
          <span style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 700, color: verdictMeta.color }}>{verdictMeta.label}</span>
          <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 4 }}>{trace.backend} · {trace.model}{trace.profile ? ` · ${trace.profile}` : ''}</p>
        </div>
      </Card>
      <Note t={t}>
        This trace was recorded before measured telemetry, or by a pillar that does not record it yet (Ministry of Health, legacy
        LLM Gateway). Its total was computed by adding the parts, and its steps were laid end to end — treat the numbers as approximate.
      </Note>
      <div className="grid grid-cols-3 gap-2">
        <Stat t={t} label="Total (sum)" value={fmtMs(trace.total_ms)} />
        <Stat t={t} label="AIRS scans" value={fmtMs((trace.airs_input_ms || 0) + (trace.airs_output_ms || 0) || null)} />
        <Stat t={t} label="Model" value={fmtMs(trace.llm_ms)} sub={trace.tokens_in != null ? `${trace.tokens_in} → ${trace.tokens_out} tokens` : undefined} />
      </div>
      <Card t={t} title="Exchange">
        <TextBlock t={t} label="Prompt" text={trace.prompt} />
        <TextBlock t={t} label="Response" text={trace.response} />
      </Card>
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1" style={{ ...LBL, fontSize: 8, color: t.inkDim }}>
        <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none' }} /> raw
      </button>
      {open && <RawTab t={t} trace={trace} />}
    </div>
  )
}
