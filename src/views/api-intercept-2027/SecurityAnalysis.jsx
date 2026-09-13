import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { FONT, label as LBL } from './tokens'

/**
 * SecurityAnalysis — everything AIRS decided, in as little vertical space as
 * it can honestly be said.
 *
 * This sits inside a chat transcript, so it is a dense label/value sheet rather
 * than a stack of nested cards. An earlier version gave each of the six
 * detection services its own tall row with an icon and a description; that is
 * six lines to say "three fired", and it pushed the conversation off screen.
 * The services are now one wrapped row of chips — same information, one line.
 *
 * Every field is read off the live AIRS response
 * (`report.data[].detection_results[].result_detail.*`), not invented.
 */

// Short names, because the long ones were doing no work in a chip row.
const SERVICE = {
  agent_security: 'agent',
  dlp:            'dlp',
  pi:             'injection',
  tc:             'toxic',
  uf:             'url',
  malicious_code: 'code',
}

function Tiny({ t, text }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1100) }}
      className="inline-flex items-center gap-1 align-middle"
      style={{ color: done ? t.pass : t.inkFaint }} title="Copy"
    >
      {done ? <Check size={9} /> : <Copy size={9} />}
    </button>
  )
}

/** One label/value line. The label column keeps the sheet scannable. */
function Line({ t, k, children, top }) {
  return (
    <div className="flex gap-2.5 py-1" style={{ alignItems: top ? 'flex-start' : 'baseline' }}>
      <span className="flex-shrink-0" style={{ ...LBL, fontSize: 7.5, color: t.inkFaint, width: 62, paddingTop: top ? 3 : 0 }}>{k}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function readReport(scan, dataType) {
  const out = []
  for (const b of (scan?.report?.data ?? [])) {
    for (const r of (b.detection_results ?? [])) {
      if (!dataType || r.data_type === dataType) out.push(r)
    }
  }
  return out
}

/** Highlight the exact spans AIRS flagged, at its own offsets. */
function Marked({ text, ranges, tone }) {
  const sorted = [...(ranges || [])].filter((r) => Array.isArray(r) && r.length === 2).sort((a, b) => a[0] - b[0])
  if (!text) return null
  if (!sorted.length) return <>{text}</>
  const out = []
  let cur = 0
  sorted.forEach(([s, e], i) => {
    if (s > cur) out.push(<span key={`p${i}`}>{text.slice(cur, s)}</span>)
    out.push(<mark key={`m${i}`} style={{ background: `${tone}2e`, color: tone, borderRadius: 3, padding: '0 2px' }}>{text.slice(s, e)}</mark>)
    cur = Math.max(cur, e)
  })
  if (cur < text.length) out.push(<span key="t">{text.slice(cur)}</span>)
  return <>{out}</>
}

export function SecurityAnalysis({ t, telemetry, promptText, responseText }) {
  const inScan = telemetry?.inputScan
  const outScan = telemetry?.outputScan
  if (!inScan) return null

  const results = [...readReport(inScan, 'prompt'), ...readReport(outScan, 'response')]
  const fired = results.filter((r) => r.action === 'block' || r.verdict === 'malicious').length

  const dlpIn = readReport(inScan, 'prompt').find((r) => r.detection_service === 'dlp')?.result_detail?.dlp_report
  const dlpOut = readReport(outScan, 'response').find((r) => r.detection_service === 'dlp')?.result_detail?.dlp_report
  const patterns = [
    ...(dlpIn?.data_pattern_detection_offsets ?? []).map((p) => ({ ...p, where: 'prompt' })),
    ...(dlpOut?.data_pattern_detection_offsets ?? []).map((p) => ({ ...p, where: 'response' })),
  ]
  const snippets = readReport(inScan, 'prompt').find((r) => r.detection_service === 'pi')?.result_detail?.pi_snippets ?? []
  const masked = inScan.prompt_masked_data
  const maskedOut = outScan?.response_masked_data

  const mono = { fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }

  return (
    <div className="px-0.5" style={{ fontFamily: FONT.prose }}>
      <Line t={t} k="Profile">
        <span style={{ ...mono, color: t.ink }}>{inScan.profile_name}</span> <Tiny t={t} text={inScan.profile_name || ''} />
        <span style={{ ...mono, marginLeft: 8 }}>
          {inScan.action} · {inScan.category}
        </span>
        {dlpIn?.dlp_profile_name && (
          <span style={{ ...mono, marginLeft: 8 }}>· dlp {dlpIn.dlp_profile_name}</span>
        )}
      </Line>

      {/* Six services, one line. */}
      <Line t={t} k={`${fired}/${results.length} fired`}>
        <div className="flex flex-wrap gap-1">
          {results.map((r, i) => {
            const bad = r.action === 'block' || r.verdict === 'malicious'
            const c = bad ? t.block : t.pass
            return (
              <span key={i} className="px-1.5 py-0.5 rounded"
                    title={`${r.detection_service} · ${r.verdict} · ${r.data_type}`}
                    style={{
                      ...LBL, fontSize: 7.5, color: c,
                      background: bad ? `${c}1f` : 'transparent',
                      border: `1px solid ${bad ? `${c}55` : t.hairline}`,
                      opacity: bad ? 1 : 0.6,
                    }}>
                {bad ? '✕' : '✓'} {SERVICE[r.detection_service] ?? r.detection_service}
                {r.data_type === 'response' ? '↩' : ''}
              </span>
            )
          })}
        </div>
      </Line>

      {snippets.length > 0 && (
        <Line t={t} k="Matched" top>
          {snippets.map((sn, i) => (
            <p key={i} style={{
              ...mono, color: t.ink, lineHeight: 1.45,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }} title={sn}>
              “{sn}”
            </p>
          ))}
        </Line>
      )}

      {patterns.length > 0 && (
        <Line t={t} k="Patterns" top>
          <div className="space-y-0.5">
            {patterns.map((p, i) => {
              const tiers = [['hi', p.high_confidence_detections], ['med', p.medium_confidence_detections], ['low', p.low_confidence_detections]]
                .filter(([, v]) => v?.length).map(([k, v]) => `${k} ${v.length}`).join(' · ')
              return (
                <div key={i} className="flex items-baseline gap-2 flex-wrap">
                  <span style={{ fontFamily: FONT.display, fontSize: 11, fontWeight: 700, color: t.block }}>{p.name}</span>
                  <span style={{ ...mono, fontSize: 9.5 }}>
                    {p.where}{p.version != null ? ` · v${p.version}` : ''}{tiers ? ` · ${tiers}` : ''}
                  </span>
                  {p.data_pattern_id && <Tiny t={t} text={p.data_pattern_id} />}
                </div>
              )
            })}
            {dlpIn?.data_pattern_rule1_verdict && (
              <div style={{ ...mono, fontSize: 9.5, color: t.inkFaint }}>
                rule 1 {dlpIn.data_pattern_rule1_verdict}
                {dlpIn.data_pattern_rule2_verdict ? ` · rule 2 ${dlpIn.data_pattern_rule2_verdict}` : ''}
              </div>
            )}
          </div>
        </Line>
      )}

      {(masked?.data || maskedOut?.data) && (
        <Line t={t} k="Masked" top>
          {[[masked, promptText, 'prompt'], [maskedOut, responseText, 'response']]
            .filter(([m]) => m?.data)
            .map(([m, original, which]) => (
              <div key={which} className="mb-1.5 last:mb-0">
                {original && (
                  <p style={{ ...mono, fontSize: 10, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    <Marked text={original} tone={t.block} ranges={(m.pattern_detections ?? []).flatMap((d) => d.locations ?? [])} />
                  </p>
                )}
                <p style={{ ...mono, fontSize: 10, lineHeight: 1.45, color: t.pass, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {m.data}
                </p>
                {(m.pattern_detections ?? []).length > 0 && (
                  <span style={{ fontSize: 9.5, color: t.inkFaint }}>
                    {m.pattern_detections.map((d) => d.pattern).join(' · ')} redacted in the {which}
                  </span>
                )}
              </div>
            ))}
        </Line>
      )}

      <Line t={t} k="Scan">
        <span style={{ ...mono, fontSize: 9.5 }}>{inScan.scan_id}</span> <Tiny t={t} text={inScan.scan_id || ''} />
      </Line>
    </div>
  )
}
