import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, RefreshCw, ExternalLink, Loader2, Link2, FileBox, ArrowUpRight } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { scanDisplayName, relTime, scmModelScansUrl, isLocalHost } from '../model-scanning-2027/scanModel'
import { Notice } from './Notice'

/**
 * LaunchScanHistory — every model scan in the SCM tenant, in the launch design.
 *
 * Same data path and behaviour as ScanHistory (the v1 console keeps it): the
 * documented AIMS list endpoint through Express, a debounced prefix search,
 * outcome and source filters, paging, and opening a row drops the full scan
 * into the console as a record. Works on hosts where the scanner does not run.
 */

const PAGE = 25
const OUTCOMES = [{ id: '', label: 'All' }, { id: 'BLOCKED', label: 'Blocked' }, { id: 'ALLOWED', label: 'Allowed' }]
const SOURCES = [{ id: '', label: 'Any source' }, { id: 'HUGGING_FACE', label: 'Hugging Face' }, { id: 'LOCAL', label: 'Local' }]
const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

function Pills({ t, tone, items, value, onChange, label }) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
      {items.map((it) => {
        const on = value === it.id
        return (
          <button key={it.id || 'all'} type="button" role="radio" aria-checked={on} onClick={() => onChange(it.id)}
                  className={`rounded-full px-2.5 ${focusCls}`}
                  style={{
                    height: 26, fontFamily: FONT.prose, fontSize: 11.5, fontWeight: on ? 700 : 500,
                    color: on ? '#fff' : t.inkDim, background: on ? bandBg(tone) : t.sunken,
                    border: `1px solid ${on ? 'transparent' : t.hairline}`,
                  }}>
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

function ScanRow({ t, scan, onOpen, opening, active, index }) {
  const [hot, setHot] = useState(false)
  const blocked = scan.eval_outcome === 'BLOCKED'
  const allowed = scan.eval_outcome === 'ALLOWED'
  const tone = blocked ? t.block : allowed ? t.pass : t.warn
  const ink = t.isLight ? shade(tone, 0.25) : tone
  const s = scan.eval_summary ?? {}
  const hf = scan.source_type === 'HUGGING_FACE'
  const Icon = hf ? Link2 : FileBox
  const rules = s.total_rules
    ? (blocked ? `${s.rules_failed} of ${s.total_rules} failed` : `${s.rules_passed} of ${s.total_rules} passed`)
    : scan.error_message ? 'error' : null
  return (
    <motion.button type="button" onClick={() => onOpen(scan)} disabled={opening}
                   initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 12) * 0.02 }}
                   onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
                   title={scan.model_uri}
                   className={`w-full flex items-center gap-2.5 rounded-xl text-left ${focusCls}`}
                   style={{ padding: '7px 8px', background: active ? `${tone}14` : hot ? `${tone}0d` : 'transparent', transition: 'background 140ms ease' }}>
      <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 26, height: 26, background: `${tone}17`, color: ink }}>
        <Icon size={12} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11.5, fontWeight: 600, color: t.ink }}>
          {scanDisplayName(scan)}
        </span>
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim, marginTop: 1 }}>
          {[rules, scan.security_group_name, relTime(scan.created_at)].filter(Boolean).join(' · ')}
        </span>
      </span>
      {opening ? (
        <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: t.live }} aria-label="Opening" />
      ) : (
        <>
          <span className="rounded-full px-2 flex-shrink-0"
                style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600, lineHeight: '18px', color: ink, background: `${tone}17` }}>
            {String(scan.eval_outcome || 'no verdict').toLowerCase()}
          </span>
          <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
                style={{ width: 24, height: 24, color: hot ? '#fff' : t.inkDim, background: hot ? shade(tone) : t.sunken, transition: 'background 140ms ease, color 140ms ease' }}>
            <ArrowUpRight size={12} />
          </span>
        </>
      )}
    </motion.button>
  )
}

export function LaunchScanHistory({ t, tone, onOpen, openingId, activeUuid, refreshKey, onTenant }) {
  const [outcome, setOutcome] = useState('')
  const [source, setSource] = useState('')
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  const [scans, setScans] = useState([])
  const [meta, setMeta] = useState({ total: null, tsg: null, configured: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const req = useRef(0)

  // Debounce the search box — the list call is a round trip to SCM.
  useEffect(() => { const id = setTimeout(() => setQ(query.trim()), 400); return () => clearTimeout(id) }, [query])

  const load = useCallback(async (skip = 0) => {
    const mine = ++req.current
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: String(PAGE), skip: String(skip) })
      if (outcome) params.set('outcome', outcome)
      if (source) params.set('source', source)
      if (q) params.set('q', q)
      const r = await fetch(`/api/supply-chain/scans?${params}`)
      // Our route always answers JSON. An HTML 404 means the Express process
      // predates the route — it has to be restarted, not debugged.
      const d = await r.json().catch(() => ({ error: `HTTP ${r.status}`, stale: r.status === 404 }))
      if (mine !== req.current) return
      setMeta({ total: d.total ?? null, tsg: d.tsg ?? null, configured: d.configured !== false })
      if (d.tsg) onTenant?.(d.tsg)
      if (!r.ok) { setError(d.stale ? { stale: true } : (d.error || `HTTP ${r.status}`)); if (!skip) setScans([]); return }
      setScans((cur) => (skip ? [...cur, ...d.scans] : d.scans))
    } catch (e) {
      if (mine === req.current) setError(e.message)
    } finally {
      if (mine === req.current) setLoading(false)
    }
  }, [outcome, source, q, onTenant])

  useEffect(() => { load(0) }, [load, refreshKey])

  if (!meta.configured) {
    return (
      <div className="px-3 pt-3.5">
        <Notice t={t} title="SCM history is unavailable on this host">
          The history reads your tenant with the Model Security service account. Set{' '}
          <span style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>MODEL_SECURITY_CLIENT_ID</span>,{' '}
          <span style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>MODEL_SECURITY_CLIENT_SECRET</span> and{' '}
          <span style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>TSG_ID</span> in this host's .env and restart Express.
        </Notice>
      </div>
    )
  }

  const restart = isLocalHost() ? 'npm run dev' : 'pm2 restart airs-server'

  return (
    <div className="px-3 pt-3.5 pb-3">
      <div className="flex items-center px-1 mb-2">
        <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Scans in your tenant</span>
        <a href={scmModelScansUrl(meta.tsg)} target="_blank" rel="noreferrer"
           className="ml-auto inline-flex items-center gap-1" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.live }}>
          Open in SCM <ExternalLink size={11} aria-hidden="true" />
        </a>
      </div>

      <label className="flex items-center gap-2 rounded-full px-3.5" style={{ height: 36, background: t.sunken, border: `1px solid ${t.hairline}` }}>
        <Search size={13} style={{ color: t.inkDim }} className="flex-shrink-0" aria-hidden="true" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} spellCheck={false} dir="ltr"
               aria-label="Search scans by model URI prefix"
               ref={(el) => el?.style.setProperty('background-color', 'transparent', 'important')}
               placeholder="org or org/model — prefix match"
               className="flex-1 min-w-0 outline-none" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink, border: 'none' }} />
        <button type="button" onClick={() => load(0)} title="Refresh from SCM" aria-label="Refresh from SCM" style={{ color: t.inkDim }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </label>

      <div className="flex flex-col gap-1.5 mt-2.5">
        <Pills t={t} tone={tone} items={OUTCOMES} value={outcome} onChange={setOutcome} label="Outcome" />
        <Pills t={t} tone={tone} items={SOURCES} value={source} onChange={setSource} label="Source" />
      </div>

      <div className="px-1 mt-2.5 mb-1.5" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
        {meta.total != null ? `${meta.total} scan${meta.total === 1 ? '' : 's'}` : 'Loading…'}
        {meta.tsg ? <> · tenant <span style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>{meta.tsg}</span></> : null}
      </div>

      {error?.stale ? (
        <Notice t={t} title="Restart the server to load SCM history" cmd={restart}
                after={isLocalHost() ? 'Stop the running one first (Ctrl+C), then start it again.' : null}>
          The page is newer than the running Express process, which does not have the history route yet.
        </Notice>
      ) : error ? (
        <Notice t={t} title="Could not read the history">
          <span style={{ fontFamily: FONT.mono, fontSize: 10.5, overflowWrap: 'anywhere' }}>{error}</span>
        </Notice>
      ) : null}

      {scans.length > 0 && (
        <div className="rounded-2xl p-1.5" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
          {scans.map((s, i) => (
            <ScanRow key={s.uuid} t={t} scan={s} index={i} onOpen={onOpen} opening={openingId === s.uuid} active={activeUuid === s.uuid} />
          ))}
        </div>
      )}
      {!loading && !error && scans.length === 0 && (
        <p className="px-1 py-3" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
          No scans match. The search is a prefix match on the model URI — try just the organisation.
        </p>
      )}
      {scans.length > 0 && meta.total != null && scans.length < meta.total && (
        <button type="button" onClick={() => load(scans.length)} disabled={loading}
                className={`w-full mt-2 rounded-full disabled:opacity-50 ${focusCls}`}
                style={{ height: 32, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink, background: t.sunken, border: `1px solid ${t.hairline}` }}>
          {loading ? 'Loading…' : `Load ${Math.min(PAGE, meta.total - scans.length)} more`}
        </button>
      )}
    </div>
  )
}
