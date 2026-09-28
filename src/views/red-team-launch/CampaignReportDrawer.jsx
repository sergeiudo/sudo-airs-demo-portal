import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw, Loader2, ExternalLink } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { tokens, FONT, label as LBL } from '../api-intercept-2027/tokens'
import { bandBg, bandDots, bandGlass } from '../home-2027/band'
import { TelemetryLook, CopyButton, Note } from '../../components/api-intercept/telemetry/primitives'
import { stamp, relative } from '../supply-chain-launch/scanTelemetry'
import { JOB_TYPE, TERMINAL, scmCampaignUrl, useCampaignTelemetry } from './redTeamModel'
import { campaignVerdict } from './CampaignEvidence'
import { OverviewTab, CategoriesTab, ComplianceTab, AttacksTab, GoalsTab, RemediationTab, RawTab } from './CampaignReportTabs'

/**
 * CampaignReportDrawer — everything about one red-team campaign, in the shape
 * of the other launch drawers: the verdict as a band with the start time and
 * the campaign id on it, tabs as pills in the verdict colour, resizable from
 * its left edge, Esc to close.
 *
 * `open` = { tab, sub?, subLabel?, attack?, goal?, n } — where to open it.
 * The pane opens it at the overview, a weak category (its attacks), an attack
 * from the feed (pinned and expanded), a goal, or the remediation tab.
 */

const MIN_W = 560
const MAX_W = 1200
const WIDTH_KEY = 'airs.campaignReport.width'

export function CampaignReportDrawer({ job, open, onClose, onLaunchRuntime }) {
  const { state } = useAppContext()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const tel = useCampaignTelemetry(open && job ? job.uuid : null, job?.status)
  const [tab, setTab] = useState(open?.tab ?? 'overview')
  const [focus, setFocus] = useState(open)
  const [now, setNow] = useState(Date.now())
  const [width, setWidth] = useState(() => {
    const saved = Number(typeof localStorage !== 'undefined' && localStorage.getItem(WIDTH_KEY))
    return saved >= MIN_W && saved <= MAX_W ? saved : 800
  })
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)
  const bodyRef = useRef(null)

  useEffect(() => { if (open) { setTab(open.tab ?? 'overview'); setFocus(open) } }, [open?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bodyRef.current?.scrollTo(0, 0) }, [tab, focus?.n])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(id) }, [])

  useEffect(() => {
    if (!dragging) return undefined
    const move = (e) => setWidth(Math.max(MIN_W, Math.min(Math.min(MAX_W, window.innerWidth - 80), drag.current.w + (drag.current.x - e.clientX))))
    const up = () => setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging])
  useEffect(() => { if (!dragging) localStorage.setItem(WIDTH_KEY, String(width)) }, [dragging, width])

  const live = tel.data?.job ?? job
  const report = tel.data?.report ?? null
  const v = campaignVerdict(t, live, report)
  const Icon = v.icon
  const dynamic = live?.job_type === 'DYNAMIC'
  const when = stamp(live?.created_at)
  const scm = scmCampaignUrl(live)
  const glassBtn = { width: 30, height: 30, color: '#fff', background: bandGlass.background, border: bandGlass.border }
  const hasCompliance = (report?.compliance_report ?? []).some((f) => f.techniques?.some((x) => x.total))
  const hasFix = (tel.data?.policy?.length ?? 0) + (tel.data?.remediations?.length ?? 0) > 0

  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...(!dynamic && report ? [{ id: 'categories', label: 'Categories' }] : []),
    ...(hasCompliance ? [{ id: 'compliance', label: 'Compliance' }] : []),
    dynamic ? { id: 'goals', label: 'Goals', count: tel.data?.goals?.total ?? null, alert: report?.goals_achieved > 0 }
            : { id: 'attacks', label: 'Attacks', alert: (report?.asr ?? live?.asr) > 0 },
    ...(hasFix ? [{ id: 'remediation', label: 'Remediation' }] : []),
    { id: 'raw', label: 'Raw' },
  ]

  return (
    <AnimatePresence>
      {open && job && (
        <motion.aside key="campaign-report-drawer" role="dialog" aria-label="Campaign report"
                      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                      className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
                      style={{ width, background: t.ground, borderLeft: `1px solid ${t.hairline}`, boxShadow: '-18px 0 48px rgba(0,0,0,0.18)', userSelect: dragging ? 'none' : 'auto' }}>
          <div onMouseDown={(e) => { drag.current = { x: e.clientX, w: width }; setDragging(true) }}
               className="absolute top-0 bottom-0 group" style={{ left: -5, width: 10, cursor: 'col-resize', zIndex: 2 }} title="Drag to resize">
            <div className="absolute top-0 bottom-0" style={{ left: 4, width: 2, background: dragging ? t.live : 'transparent', transition: 'background .15s' }} />
            <div className="absolute flex flex-col gap-[3px] opacity-60 group-hover:opacity-100" style={{ top: '50%', left: 3, transform: 'translateY(-50%)' }}>
              {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 3, height: 3, borderRadius: 3, background: dragging ? t.live : t.inkFaint }} />)}
            </div>
          </div>

          <header className="flex-shrink-0" style={{ background: t.panel, borderBottom: `1px solid ${t.hairline}` }}>
            <div className="relative overflow-hidden" style={{ background: bandBg(v.tone) }}>
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
              <Icon aria-hidden="true" strokeWidth={1.3}
                    style={{ position: 'absolute', right: 90, bottom: -46, width: 160, height: 160, color: '#fff', opacity: 0.14, transform: 'rotate(-10deg)', pointerEvents: 'none' }} />
              <div className="relative flex items-start gap-3 px-5 pt-4 pb-4">
                <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
                  <Icon size={21} className={v.spin ? 'animate-spin' : ''} style={{ color: '#fff' }} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Campaign report · Prisma AIRS Red Teaming</div>
                  <div style={{ fontFamily: FONT.display, fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.1, marginTop: 3 }}>{v.title}</div>
                  <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: '#fff', marginTop: 3 }}>
                    {live?.target?.name ?? live?.name}<span style={{ opacity: 0.85 }}> · {JOB_TYPE[live?.job_type]?.label ?? 'campaign'} · {v.why}</span>
                  </div>
                  {when && (
                    <div className="flex flex-wrap items-baseline gap-x-2 mt-1" style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>
                      <span style={{ fontWeight: 600 }}>{when.date}</span>
                      <span style={{ fontFamily: FONT.mono }}>{when.time}</span>
                      <span style={{ opacity: 0.8 }}>{when.tz} · {relative(now - when.ms)}</span>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-1 mt-2 rounded-full pl-2.5 pr-1 max-w-full" style={{ height: 24, ...bandGlass }}>
                    <span style={{ fontFamily: FONT.prose, fontSize: 10.5, opacity: 0.85 }}>campaign</span>
                    <span className="truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>{live?.uuid}</span>
                    <CopyButton t={{ ...t, inkFaint: 'rgba(255,255,255,0.8)', inkDim: '#fff' }} text={live?.uuid} size={10} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {scm && <a href={scm} target="_blank" rel="noreferrer" title="Open in Strata Cloud Manager" aria-label="Open in Strata Cloud Manager" className="rounded-full grid place-items-center" style={glassBtn}><ExternalLink size={13} /></a>}
                  <button type="button" onClick={tel.reload} title="Reload" aria-label="Reload" className="rounded-full grid place-items-center" style={glassBtn}>
                    {tel.loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  </button>
                  <button type="button" onClick={onClose} title="Close (Esc)" aria-label="Close" className="rounded-full grid place-items-center" style={glassBtn}><X size={14} /></button>
                </div>
              </div>
            </div>
            <nav className="flex gap-1.5 px-4 py-2.5 overflow-x-auto" aria-label="Campaign report sections">
              {tabs.map((x) => {
                const on = tab === x.id
                return (
                  <button key={x.id} type="button" onClick={() => { setTab(x.id); if (x.id !== 'attacks' && x.id !== 'goals') setFocus(null) }} aria-pressed={on}
                          className="px-3.5 rounded-full whitespace-nowrap inline-flex items-center gap-1.5"
                          style={{
                            height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: on ? 700 : 500,
                            color: on ? '#fff' : t.inkDim, background: on ? bandBg(v.tone) : t.sunken,
                            border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 4px 12px ${v.tone}40` : 'none',
                          }}>
                    {x.alert && <span style={{ width: 6, height: 6, borderRadius: 6, background: on ? '#fff' : t.block }} />}
                    {x.label}
                    {x.count != null && <span style={{ opacity: 0.7, fontFamily: FONT.mono, fontSize: 11 }}>{x.count}</span>}
                  </button>
                )
              })}
              {tel.loading && (
                <span className="ml-auto inline-flex items-center gap-1.5 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
                  <Loader2 size={12} className="animate-spin" /> loading report
                </span>
              )}
            </nav>
          </header>

          <TelemetryLook.Provider value="launch">
            <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-4">
              {tel.error && <div className="mb-3"><Note t={t}>The report did not load ({tel.error}). The campaign record below is what the console already has.</Note></div>}
              {tel.data?.endpointErrors && Object.keys(tel.data.endpointErrors).length > 0 && (
                <div className="mb-3"><Note t={t}>Some detail did not load: {Object.entries(tel.data.endpointErrors).map(([k, e]) => `${k} (${e})`).join(' · ')}.</Note></div>
              )}
              {!TERMINAL.has(live?.status) && <div className="mb-3"><Note t={t}>This campaign is still running — the report, categories and remediation appear when it completes.</Note></div>}
              {tab === 'overview' && <OverviewTab t={t} job={live} tel={tel.data} now={now} />}
              {tab === 'categories' && <CategoriesTab t={t} tel={tel.data} onSub={(s) => { setFocus({ sub: s.id, subLabel: s.display_name, n: Date.now() }); setTab('attacks') }} />}
              {tab === 'compliance' && <ComplianceTab t={t} tel={tel.data} />}
              {tab === 'attacks' && <AttacksTab key={focus?.n ?? 'all'} t={t} job={live} focus={focus} onClearSub={() => setFocus(null)} />}
              {tab === 'goals' && <GoalsTab key={focus?.n ?? 'all'} t={t} tel={tel.data} focus={focus} />}
              {tab === 'remediation' && <RemediationTab t={t} tel={tel.data} onLaunchRuntime={onLaunchRuntime} />}
              {tab === 'raw' && <RawTab t={t} job={live} tel={tel.data} />}
            </div>
          </TelemetryLook.Provider>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
