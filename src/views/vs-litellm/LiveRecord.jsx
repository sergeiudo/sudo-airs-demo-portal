import React, { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Radio, ShieldAlert, Package, Boxes, ExternalLink, Loader2, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots, bandGlass } from '../home-2027/band'
import { BRIEF, SIDE } from './content'
import { focusCls, inkOn, SideTag, HoverNote } from './parts'

/**
 * LiveRecord — the right-hand pane: LiteLLM's security and release record and
 * the AIRS AI Gateway core's, read from OSV.dev, PyPI and npm through
 * /api/competitive/litellm/record (cached six hours on the server). The brief
 * printed a snapshot; this is the same measurement taken today.
 *
 * One module store, so the pane and the full ledger in section 01 share a
 * single request.
 */

let snap = { data: null, loading: false, error: null }
const listeners = new Set()
const set = (patch) => { snap = { ...snap, ...patch }; listeners.forEach((l) => l(snap)) }

export async function loadRecord(refresh = false) {
  if (snap.loading) return
  set({ loading: true, error: null })
  try {
    const r = await fetch(`/api/competitive/litellm/record${refresh ? '?refresh=1' : ''}`)
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
    set({ data: d, loading: false })
  } catch (e) {
    set({ loading: false, error: e.message })
  }
}

export function useRecord() {
  const [s, setS] = useState(snap)
  useEffect(() => {
    listeners.add(setS)
    if (!snap.data && !snap.loading) loadRecord()
    return () => listeners.delete(setS)
  }, [])
  return s
}

const SEV_ORDER = ['critical', 'high', 'moderate', 'low']
const SEV_WORD = { critical: 'Critical', high: 'High', moderate: 'Moderate', low: 'Low', unrated: 'Unrated' }

// "LiteLLM: Authenticated SSRF…" → "Authenticated SSRF…". Only a "LiteLLM:"
// label goes; "LiteLLM Proxy has…" is a sentence and stays whole.
const tidy = (s) => s.replace(/^(BerriAI\s+)?LiteLLM:\s*/i, '').replace(/^./, (c) => c.toUpperCase())

function ago(iso) {
  if (!iso) return ''
  const s = (Date.now() - Date.parse(iso)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

/**
 * CVEs by severity as one bar per level — a single series, so one colour
 * (LiteLLM's); the level is carried by the word and the order, never by hue.
 * (The portal's severity palette fails the dataviz validator as categories:
 * high and moderate are ΔE 8.5 apart even with full colour vision.)
 */
export function SeverityBars({ t, bySeverity, total }) {
  const [hot, setHot] = useState(null)
  const max = Math.max(1, ...SEV_ORDER.map((k) => bySeverity?.[k] ?? 0))
  const tone = SIDE.litellm.tone
  return (
    <div className="space-y-1.5" role="list" aria-label="LiteLLM CVEs by severity">
      {SEV_ORDER.map((k) => {
        const n = bySeverity?.[k] ?? 0
        return (
          <div key={k} role="listitem" className="relative flex items-center gap-2.5" style={{ minHeight: 22 }}
               onMouseEnter={() => setHot(k)} onMouseLeave={() => setHot(null)}>
            <span style={{ width: 66, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink }}>{SEV_WORD[k]}</span>
            <span className="flex-1 relative" style={{ height: 22 }}>
              <span className="absolute left-0 top-1/2 -translate-y-1/2" style={{ height: 10, width: `${(n / max) * 100}%`, minWidth: n ? 4 : 0, background: tone, borderRadius: '0 4px 4px 0', opacity: hot && hot !== k ? 0.45 : 1, transition: 'opacity 120ms' }} />
            </span>
            <span style={{ width: 26, textAlign: 'right', fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{n}</span>
            <HoverNote t={t} show={hot === k}>
              <b>{n} {SEV_WORD[k].toLowerCase()}</b> of {total} CVEs — {total ? Math.round((n / total) * 100) : 0}%
            </HoverNote>
          </div>
        )
      })}
    </div>
  )
}

function PaneCard({ t, icon: Icon, tone, title, side, href, children }) {
  return (
    <div className="rounded-2xl" style={{ background: t.panel, border: `1px solid ${t.hairline}`, padding: '12px 13px' }}>
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 28, height: 28, background: `${tone}17`, color: inkOn(t, tone, 0.25) }}>
          <Icon size={14} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{title}</span>
          {side && <SideTag t={t} side={side} small />}
        </span>
        {href && (
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${title} at the source`}
             className={`grid place-items-center rounded-full flex-shrink-0 ${focusCls}`} style={{ width: 26, height: 26, color: t.inkDim, background: t.sunken }}>
            <ExternalLink size={12} />
          </a>
        )}
      </div>
      {children}
    </div>
  )
}

function Fact({ t, label, value, mono, tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1" style={{ borderTop: `1px solid ${t.hairline}` }}>
      <span style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>{label}</span>
      <span style={{ fontFamily: mono ? FONT.mono : FONT.prose, fontSize: mono ? 11.5 : 12.5, fontWeight: 650, color: tone ?? t.ink, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export function LiveRecord({ t, accent, onGo }) {
  const { data, loading, error } = useRecord()
  const ll = data?.litellm
  const gw = data?.gateway
  const latest = useMemo(() => (ll?.items ?? []).filter((x) => x.cve).slice(0, 4), [ll])
  const malware = (ll?.items ?? []).filter((x) => x.malware).length
  const errs = Object.entries(data?.errors ?? {})
  const thisYear = String(new Date().getFullYear())

  return (
    <div className="h-full flex flex-col overflow-hidden" style={glass(t, { radius: 22 })}>
      <div className="relative flex-shrink-0 overflow-hidden" style={{ background: bandBg(accent), minHeight: 92 }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
        <Radio aria-hidden="true" strokeWidth={1.3} style={{ position: 'absolute', right: -22, bottom: -38, width: 140, height: 140, color: '#fff', opacity: 0.14, transform: 'rotate(-10deg)' }} />
        <div className="relative flex items-start gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.86)' }}>Live record · OSV · PyPI · npm</div>
            <div style={{ fontFamily: FONT.display, fontSize: 19, fontWeight: 700, color: '#fff', lineHeight: 1.15, marginTop: 3 }}>The record, read today</div>
            <div style={{ fontFamily: FONT.prose, fontSize: 11.5, color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
              {loading && !data ? 'Reading the sources…' : data?.fetchedAt ? `Read ${ago(data.fetchedAt)}${data.cached ? ' · from the server cache' : ''}` : error ? 'Could not read the sources' : ''}
            </div>
          </div>
          <button type="button" onClick={() => loadRecord(true)} disabled={loading} aria-label="Read the sources again"
                  className="grid place-items-center rounded-full flex-shrink-0 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  style={{ width: 30, height: 30, ...bandGlass }}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
        {error && !data && (
          <div className="rounded-2xl flex gap-2.5" style={{ padding: '10px 12px', background: `${t.warn}12`, border: `1px solid ${t.warn}40` }}>
            <AlertTriangle size={15} style={{ color: inkOn(t, t.warn, 0.45), flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <div style={{ fontFamily: FONT.prose, fontSize: 12, color: t.ink, lineHeight: 1.5 }}>
              The live sources did not answer ({error}). Every figure in the sections still carries its date and source; the claim check was run on 2026-10-13.
            </div>
          </div>
        )}

        <PaneCard t={t} icon={ShieldAlert} tone={SIDE.litellm.tone} title="LiteLLM on OSV.dev" side="litellm" href={ll?.url}>
          {ll ? (
            <>
              <div className="flex items-end gap-3 mb-2">
                <span style={{ fontFamily: FONT.display, fontSize: 40, fontWeight: 700, color: t.ink, lineHeight: 0.95, letterSpacing: '-0.03em' }}>{ll.cves}</span>
                <span className="pb-0.5" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, lineHeight: 1.35 }}>
                  unique CVEs<br />{ll.byYear?.[thisYear] ?? 0} filed in {thisYear}
                </span>
              </div>
              <SeverityBars t={t} bySeverity={ll.bySeverity} total={ll.cves} />
              <div className="rounded-xl mt-2.5" style={{ padding: '7px 9px', background: t.sunken }}>
                <div style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, lineHeight: 1.5 }}>
                  The brief ({BRIEF.snapshot}): <b style={{ color: t.ink }}>27</b> · 5 critical · 16 high · 13 that year.{' '}
                  {ll.other > 0 && <>Plus {ll.other} advisories with no CVE{malware ? `, ${malware} of them the March malware` : ''}.</>}
                </div>
              </div>
              <div className="mt-2.5 space-y-0.5">
                {latest.map((x) => (
                  <a key={x.id} href={x.url} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-2 rounded-lg ${focusCls}`} style={{ padding: '5px 4px' }}
                     onMouseEnter={(e) => { e.currentTarget.style.background = t.sunken }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink }}>{tidy(x.summary)}</span>
                      <span className="block truncate" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, marginTop: 1 }}>{x.cve} · {(x.severity ?? 'unrated').toUpperCase()} · {x.published}</span>
                    </span>
                  </a>
                ))}
              </div>
              <button type="button" onClick={() => onGo('ledger')} className={`mt-1.5 w-full inline-flex items-center justify-center gap-1.5 rounded-full ${focusCls}`}
                      style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: inkOn(t, t.live, 0.2), background: `${t.live}12` }}>
                The full ledger in section 01 <ArrowRight size={12} aria-hidden="true" />
              </button>
            </>
          ) : <Skeleton t={t} loading={loading} />}
        </PaneCard>

        <PaneCard t={t} icon={ShieldAlert} tone={SIDE.airs.tone} title="Gateway core on OSV.dev" side="airs" href={gw?.items?.[0]?.url ?? gw?.url}>
          {gw ? (
            <>
              <div className="flex items-end gap-3 mb-1.5">
                <span style={{ fontFamily: FONT.display, fontSize: 40, fontWeight: 700, color: t.ink, lineHeight: 0.95 }}>{gw.cves}</span>
                <span className="pb-0.5" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, lineHeight: 1.35 }}>{gw.cves === 1 ? 'advisory' : 'advisories'} for<br /><code style={{ fontFamily: FONT.mono, fontSize: 11 }}>@portkey-ai/gateway</code></span>
              </div>
              {gw.items.filter((x) => x.cve).map((x) => (
                <div key={x.id} style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, lineHeight: 1.5 }}>
                  <b style={{ color: t.ink }}>{x.cve}</b> · {x.severity} · {x.summary.replace(/^Portkey\.ai Gateway:\s*/i, '')}{x.fixed ? ` — fixed in ${x.fixed}` : ''}
                </div>
              ))}
            </>
          ) : <Skeleton t={t} loading={loading} />}
        </PaneCard>

        <PaneCard t={t} icon={Package} tone={SIDE.litellm.tone} title="litellm on PyPI" side="litellm" href={data?.pypi?.url}>
          {data?.pypi ? (
            <div>
              <Fact t={t} label="Latest release" value={data.pypi.latest} mono />
              <Fact t={t} label="Releases, last 30 days" value={data.pypi.last30} />
              <Fact t={t} label="Days with a release, last 90" value={`${data.pypi.releaseDays90} of 90`} />
              {data.pypi.malicious.map((m) => (
                <Fact key={m.version} t={t} label={<>Malicious <code style={{ fontFamily: FONT.mono, fontSize: 11 }}>{m.version}</code></>}
                      value={<span className="inline-flex items-center gap-1">{m.state === 'present' ? <AlertTriangle size={12} aria-hidden="true" /> : <CheckCircle2 size={12} aria-hidden="true" />}{m.state === 'removed' ? 'removed from PyPI' : m.state}</span>}
                      tone={inkOn(t, m.state === 'present' ? t.warn : t.pass, 0.3)} />
              ))}
              {data.pypi.firstAfterIncident && <Fact t={t} label="Next release after the incident" value={`${data.pypi.firstAfterIncident.version} · ${data.pypi.firstAfterIncident.at}`} />}
              <Fact t={t} label="Licence" value={data.pypi.license} />
            </div>
          ) : <Skeleton t={t} loading={loading} />}
        </PaneCard>

        <PaneCard t={t} icon={Boxes} tone={SIDE.airs.tone} title="Gateway core on npm" side="airs" href={data?.npm?.url}>
          {data?.npm ? (
            <div>
              <Fact t={t} label="Latest" value={`${data.npm.latest} · ${data.npm.published}`} mono />
              <Fact t={t} label="Declared dependencies" value={data.npm.dependencies.length} />
              <Fact t={t} label="Built on Hono" value={data.npm.usesHono ? 'yes' : 'no'} />
              <div className="flex flex-wrap gap-1 pt-2" style={{ borderTop: `1px solid ${t.hairline}` }}>
                {data.npm.dependencies.map((d) => (
                  <span key={d} className="rounded-md px-1.5" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>{d}</span>
                ))}
              </div>
            </div>
          ) : <Skeleton t={t} loading={loading} />}
        </PaneCard>

        {errs.length > 0 && data && (
          <div style={{ fontFamily: FONT.prose, fontSize: 11, color: inkOn(t, t.warn, 0.45), lineHeight: 1.5, padding: '0 4px' }}>
            Not read this time: {errs.map(([k, v]) => `${k} (${v})`).join(' · ')}
          </div>
        )}
        <p style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint, lineHeight: 1.5, padding: '0 4px', margin: 0 }}>
          Read on the server from public, keyless APIs and kept for six hours. A CVE is counted once however many databases list it, the way the brief counted.
        </p>
      </div>
    </div>
  )
}

function Skeleton({ t, loading }) {
  return (
    <div className="flex items-center gap-2" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, padding: '6px 2px' }}>
      {loading ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Reading…</> : 'Not available right now.'}
    </div>
  )
}
