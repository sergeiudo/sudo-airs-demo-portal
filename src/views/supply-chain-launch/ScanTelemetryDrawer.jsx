import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw, Loader2, ShieldCheck, ShieldX, AlertTriangle, ExternalLink, Activity } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { tokens, FONT, label as LBL } from '../api-intercept-2027/tokens'
import { bandBg, bandDots, bandGlass } from '../home-2027/band'
import { TelemetryLook, CopyButton, Note } from '../../components/api-intercept/telemetry/primitives'
import { scanVerdict, parseTarget, scmScanUrl } from '../model-scanning-2027/scanModel'
import { useScanTelemetry, mergeRules, stamp, relative } from './scanTelemetry'
import { OverviewTab, RulesTab, FilesTab, ModelTab, RawTab } from './ScanTelemetryTabs'

/**
 * ScanTelemetryDrawer — everything about one model scan, in the runtime
 * console's telemetry-drawer shape: the verdict as a band with the scan time
 * and id on it, tabs as pills in the verdict colour, resizable from its left
 * edge, Esc to close.
 *
 * The evidence pane keeps the verdict and the failed rules; the detail lives
 * here — every rule including the ones that passed, the scanned file tree,
 * provenance, and the raw payloads. It renders from the console's record at
 * once and fills in as /api/supply-chain/scans/:uuid/telemetry answers; a
 * host without Model Security credentials still gets the record's half.
 */

const MIN_W = 540
const MAX_W = 1200
const WIDTH_KEY = 'airs.scanTelemetry.width'
const TITLE = { allowed: 'Allowed', blocked: 'Blocked', error: 'Fault', scanning: 'Scanning' }

export function ScanTelemetryDrawer({ record, focus, focusKey, onClose }) {
  const { state } = useAppContext()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const r = record?.result
  const uuid = r?.uuid ?? null
  const tel = useScanTelemetry(uuid)
  const [tab, setTab] = useState(focus ? 'rules' : 'overview')
  const [now, setNow] = useState(Date.now())
  const [width, setWidth] = useState(() => {
    const saved = Number(typeof localStorage !== 'undefined' && localStorage.getItem(WIDTH_KEY))
    return saved >= MIN_W && saved <= MAX_W ? saved : 780
  })
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)
  const bodyRef = useRef(null)

  // A rule picked inside the drawer (the rule map) — the pane's `focus` wins
  // whenever it changes.
  const [jump, setJump] = useState(null)

  // Opened at a rule (from the evidence pane) → the Rules tab.
  useEffect(() => { setJump(null); if (focus) setTab('rules') }, [focus, focusKey])
  useEffect(() => { setJump(null); if (!focus) setTab('overview') }, [uuid]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!record) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [record, onClose])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!dragging) return undefined
    const move = (e) => {
      const max = Math.min(MAX_W, window.innerWidth - 80)
      setWidth(Math.max(MIN_W, Math.min(max, drag.current.w + (drag.current.x - e.clientX))))
    }
    const up = () => setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging])
  useEffect(() => { if (!dragging) localStorage.setItem(WIDTH_KEY, String(width)) }, [dragging, width])

  // A tab switch starts at the top.
  useEffect(() => { if (tab !== 'rules' || !focus) bodyRef.current?.scrollTo(0, 0) }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const rules = useMemo(
    () => mergeRules({ evaluations: tel.data?.evaluations, rules: tel.data?.rules, violations: r?.violations }),
    [tel.data, r?.violations],
  )

  const v = record ? scanVerdict(record) : 'idle'
  const color = v === 'blocked' ? t.block : v === 'allowed' ? t.pass : t.warn
  const Icon = v === 'blocked' ? ShieldX : v === 'allowed' ? ShieldCheck : v === 'idle' ? Activity : AlertTriangle
  const when = stamp(r?.time_started ?? r?.created_at)
  const target = record ? parseTarget(record) : null
  const scm = scmScanUrl(r)
  const failed = rules.list.filter((x) => x.result === 'FAILED').length
  const glassBtn = { width: 30, height: 30, color: '#fff', background: bandGlass.background, border: bandGlass.border }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'rules', label: 'Rules', count: rules.list.length || null, alert: failed > 0 },
    { id: 'files', label: 'Files', count: r?.total_files_scanned ?? null },
    { id: 'model', label: 'Model & group' },
    { id: 'raw', label: 'Raw' },
  ]

  // Why the extra half is missing, said once under the tabs.
  const gap = tel.error
    ? (tel.error.configured === false
        ? 'Model Security credentials are not set on this host, so per-rule evaluations, the file tree and provenance are not available. The scan record below is complete.'
        : `The extra scan detail did not load (${tel.error.message}). The scan record below is complete.`)
    : tel.data?.errors && Object.keys(tel.data.errors).length
      ? `Some detail did not load: ${Object.entries(tel.data.errors).map(([k, e]) => `${k} (${e})`).join(' · ')}.`
      : null

  return (
    <AnimatePresence>
      {record && r && (
        <motion.aside
          key="scan-telemetry-drawer"
          role="dialog" aria-label="Scan telemetry"
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
          style={{ width, background: t.ground, borderLeft: `1px solid ${t.hairline}`, boxShadow: '-18px 0 48px rgba(0,0,0,0.18)', userSelect: dragging ? 'none' : 'auto' }}
        >
          <div onMouseDown={(e) => { drag.current = { x: e.clientX, w: width }; setDragging(true) }}
               className="absolute top-0 bottom-0 group" style={{ left: -5, width: 10, cursor: 'col-resize', zIndex: 2 }} title="Drag to resize">
            <div className="absolute top-0 bottom-0" style={{ left: 4, width: 2, background: dragging ? t.live : 'transparent', transition: 'background .15s' }} />
            <div className="absolute flex flex-col gap-[3px] opacity-60 group-hover:opacity-100" style={{ top: '50%', left: 3, transform: 'translateY(-50%)' }}>
              {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 3, height: 3, borderRadius: 3, background: dragging ? t.live : t.inkFaint }} />)}
            </div>
          </div>

          <header className="flex-shrink-0" style={{ background: t.panel, borderBottom: `1px solid ${t.hairline}` }}>
            <div className="relative overflow-hidden" style={{ background: bandBg(color) }}>
              <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
              <Icon aria-hidden="true" strokeWidth={1.3}
                    style={{ position: 'absolute', right: 90, bottom: -46, width: 160, height: 160, color: '#fff', opacity: 0.14, transform: 'rotate(-10deg)', pointerEvents: 'none' }} />
              <div className="relative flex items-start gap-3 px-5 pt-4 pb-4">
                <span className="grid place-items-center rounded-2xl flex-shrink-0"
                      style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
                  <Icon size={21} style={{ color: '#fff' }} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap" style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>
                    <span>Scan telemetry · Prisma AIRS Model Security</span>
                    {record.fromScm && <span className="rounded-full px-2 py-0.5" style={{ ...bandGlass, fontSize: 8.5 }}>from SCM history</span>}
                  </div>
                  <div style={{ fontFamily: FONT.display, fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.1, marginTop: 3 }}>
                    {TITLE[v] ?? 'Scan'}
                  </div>
                  <div className="truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 12, color: '#fff', marginTop: 3 }} title={target?.id}>
                    {target?.id}
                    <span style={{ fontFamily: FONT.prose, opacity: 0.85 }}> · {r.security_group_name ?? 'security group'}</span>
                  </div>
                  {when && (
                    <div className="flex flex-wrap items-baseline gap-x-2 mt-1" style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>
                      <span style={{ fontWeight: 600 }}>{when.date}</span>
                      <span style={{ fontFamily: FONT.mono }}>{when.time}</span>
                      <span style={{ opacity: 0.8 }}>{when.tz} · {relative(now - when.ms)}</span>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-1 mt-2 rounded-full pl-2.5 pr-1 max-w-full" style={{ height: 24, ...bandGlass }}>
                    <span style={{ fontFamily: FONT.prose, fontSize: 10.5, opacity: 0.85 }}>scan</span>
                    <span className="truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>{uuid}</span>
                    <CopyButton t={{ ...t, inkFaint: 'rgba(255,255,255,0.8)', inkDim: '#fff' }} text={uuid} size={10} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {scm && (
                    <a href={scm} target="_blank" rel="noreferrer" title="Open in Strata Cloud Manager" aria-label="Open in Strata Cloud Manager"
                       className="rounded-full grid place-items-center" style={glassBtn}>
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button type="button" onClick={tel.reload} title="Reload" aria-label="Reload" className="rounded-full grid place-items-center" style={glassBtn}>
                    {tel.loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  </button>
                  <button type="button" onClick={onClose} title="Close (Esc)" aria-label="Close" className="rounded-full grid place-items-center" style={glassBtn}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
            <nav className="flex gap-1.5 px-4 py-2.5 overflow-x-auto" aria-label="Scan telemetry sections">
              {tabs.map((x) => {
                const on = tab === x.id
                return (
                  <button key={x.id} type="button" onClick={() => setTab(x.id)} aria-pressed={on}
                          className="px-3.5 rounded-full whitespace-nowrap inline-flex items-center gap-1.5"
                          style={{
                            height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: on ? 700 : 500,
                            color: on ? '#fff' : t.inkDim, background: on ? bandBg(color) : t.sunken,
                            border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 4px 12px ${color}40` : 'none',
                          }}>
                    {x.alert && <span style={{ width: 6, height: 6, borderRadius: 6, background: on ? '#fff' : t.block }} />}
                    {x.label}
                    {x.count != null && <span style={{ opacity: 0.7, fontFamily: FONT.mono, fontSize: 11 }}>{x.count}</span>}
                  </button>
                )
              })}
              {tel.loading && (
                <span className="ml-auto inline-flex items-center gap-1.5 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
                  <Loader2 size={12} className="animate-spin" /> loading detail
                </span>
              )}
            </nav>
          </header>

          <TelemetryLook.Provider value="launch">
            <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-4">
              {gap && <div className="mb-3"><Note t={t}>{gap}</Note></div>}
              {tab === 'overview' && <OverviewTab t={t} record={record} tel={tel.data} rules={rules} now={now} onRule={(id) => { setTab('rules'); setJump({ id, n: Date.now() }) }} />}
              {tab === 'rules' && <RulesTab t={t} record={record} rules={rules} focus={jump?.id ?? focus} focusKey={jump?.n ?? focusKey} />}
              {tab === 'files' && <FilesTab t={t} record={record} tel={tel.data} telError={tel.error?.message} />}
              {tab === 'model' && <ModelTab t={t} record={record} tel={tel.data} rules={rules} now={now} />}
              {tab === 'raw' && <RawTab t={t} record={record} tel={tel.data} />}
            </div>
          </TelemetryLook.Provider>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
