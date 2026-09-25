import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, RefreshCw, ExternalLink, AlertTriangle, Loader2, Link2, FileBox } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { scanDisplayName, relTime, scmModelScansUrl, isLocalHost } from './scanModel'
import { Copyable } from '../api-intercept-2027/RecordStream'

/**
 * ScanHistory — every model scan in the SCM tenant, not just this session's.
 *
 * Backed by the documented AIMS list endpoint through Express
 * (`/api/supply-chain/scans`), so it works on hosts where the scanner process
 * does not run. Opening a row pulls the full scan and its rule violations and
 * drops it into the console as a record — same stream card, same evidence
 * rail — so a scan someone ran from the CLI last week is as inspectable as the
 * one just fired.
 */

const PAGE = 25

const OUTCOMES = [
  { id: '', label: 'All' },
  { id: 'BLOCKED', label: 'Blocked' },
  { id: 'ALLOWED', label: 'Allowed' },
]
const SOURCES = [
  { id: '', label: 'Any source' },
  { id: 'HUGGING_FACE', label: 'Hugging Face' },
  { id: 'LOCAL', label: 'Local' },
]

function Seg({ t, items, value, onChange }) {
  return (
    <div className="flex p-0.5 rounded-full" style={{ background: t.sunken, border: `1px solid ${t.hairline}` }}>
      {items.map((it) => {
        const on = value === it.id
        return (
          <button key={it.id || 'all'} type="button" onClick={() => onChange(it.id)}
                  className="px-2.5 py-0.5 rounded-full transition-colors"
                  style={{
                    fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600,
                    color: on ? t.ink : t.inkFaint, background: on ? t.panel : 'transparent',
                    boxShadow: on ? t.shadowSm : 'none',
                  }}>
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

function Row({ t, scan, onOpen, opening, active }) {
  const blocked = scan.eval_outcome === 'BLOCKED'
  const allowed = scan.eval_outcome === 'ALLOWED'
  const tone = blocked ? t.block : allowed ? t.pass : t.warn
  const s = scan.eval_summary ?? {}
  const hf = scan.source_type === 'HUGGING_FACE'
  return (
    <button type="button" onClick={() => onOpen(scan)} disabled={opening}
            className="w-full text-left px-3 py-2 transition-colors"
            style={{
              background: active ? `${tone}0f` : t.panel,
              border: `1px solid ${active ? `${tone}55` : t.glassEdge}`,
              borderRadius: 14, boxShadow: t.shadowSm,
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = `${tone}40` }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = t.glassEdge }}>
      <div className="flex items-center gap-2">
        <span className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, background: tone }} />
        {hf ? <Link2 size={11} style={{ color: t.inkFaint, flexShrink: 0 }} /> : <FileBox size={11} style={{ color: t.inkFaint, flexShrink: 0 }} />}
        <span className="flex-1 min-w-0 truncate" dir="ltr" title={scan.model_uri}
              style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, color: t.ink }}>
          {scanDisplayName(scan)}
        </span>
        {opening
          ? <Loader2 size={11} className="animate-spin flex-shrink-0" style={{ color: t.live }} />
          : <span className="flex-shrink-0" style={{ ...LBL, fontSize: 7.5, color: tone }}>{String(scan.eval_outcome || '—').toLowerCase()}</span>}
      </div>
      <div className="flex items-center gap-2 mt-1 pl-[15px]">
        <span className="whitespace-nowrap flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>
          {s.total_rules ? (blocked ? `${s.rules_failed} of ${s.total_rules} failed` : `${s.rules_passed} of ${s.total_rules} passed`) : scan.error_message ? 'error' : '—'}
        </span>
        <span className="truncate" style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>· {scan.security_group_name ?? ''}</span>
        <span className="ml-auto flex-shrink-0" title={scan.created_at} style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>
          {relTime(scan.created_at)}
        </span>
      </div>
    </button>
  )
}

export function ScanHistory({ t, onOpen, openingId, activeUuid, refreshKey, onTenant }) {
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
      <div className="mx-3 mt-3 px-3 py-2.5" style={{ background: `${t.warn}10`, border: `1px solid ${t.warn}40`, borderRadius: 16 }}>
        <div className="flex items-center gap-1.5 mb-1">
          <AlertTriangle size={12} style={{ color: t.warn }} />
          <span style={{ ...LBL, fontSize: 8.5, color: t.warn }}>SCM history unavailable on this host</span>
        </div>
        <p style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.5, color: t.inkDim }}>
          The history reads your tenant with the Model Security service account. Set
          <span style={{ fontFamily: FONT.mono }}> MODEL_SECURITY_CLIENT_ID</span>,
          <span style={{ fontFamily: FONT.mono }}> MODEL_SECURITY_CLIENT_SECRET</span> and
          <span style={{ fontFamily: FONT.mono }}> TSG_ID</span> in this host's .env and restart Express.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="px-3 pt-3 space-y-2">
        <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: t.sunken, border: `1px solid ${t.hairline}`, borderRadius: 999 }}>
          <Search size={12} style={{ color: t.inkFaint, flexShrink: 0 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} spellCheck={false} dir="ltr"
                 ref={(el) => el?.style.setProperty('background-color', 'transparent', 'important')}
                 placeholder="org or org/model — prefix match"
                 className="flex-1 min-w-0 bg-transparent outline-none"
                 style={{ fontFamily: FONT.mono, fontSize: 11, color: t.ink }} />
          <button type="button" onClick={() => load(0)} title="Refresh from SCM" style={{ color: t.inkFaint }}>
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Seg t={t} items={OUTCOMES} value={outcome} onChange={setOutcome} />
          <Seg t={t} items={SOURCES} value={source} onChange={setSource} />
        </div>
        <div className="flex items-center gap-2 px-1">
          <span style={{ fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>
            {meta.total != null ? `${meta.total} scan${meta.total === 1 ? '' : 's'}` : '…'}{meta.tsg ? ` · tenant ${meta.tsg}` : ''}
          </span>
          <a href={scmModelScansUrl(meta.tsg)} target="_blank" rel="noreferrer"
             className="ml-auto inline-flex items-center gap-1" style={{ ...LBL, fontSize: 8, color: t.live }}>
            SCM <ExternalLink size={9} />
          </a>
        </div>
      </div>

      {error?.stale ? (
        <div className="mx-3 mt-2 px-3 py-2.5" style={{ background: `${t.warn}10`, border: `1px solid ${t.warn}40`, borderRadius: 16 }}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={12} style={{ color: t.warn }} />
            <span style={{ ...LBL, fontSize: 8.5, color: t.warn }}>Restart the server to load SCM history</span>
          </div>
          <p style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.5, color: t.inkDim }}>
            The page is newer than the running Express process, which does not have the history route yet.
          </p>
          <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-xl" style={{ background: t.codeBg, border: `1px solid ${t.hairline}` }}>
            <span className="flex-1 min-w-0" style={{ fontFamily: FONT.mono, fontSize: 11, color: t.ink }}>
              {isLocalHost() ? 'npm run dev' : 'pm2 restart airs-server'}
            </span>
            <Copyable t={t} text={isLocalHost() ? 'npm run dev' : 'pm2 restart airs-server'} />
          </div>
          {isLocalHost() && (
            <p style={{ fontFamily: FONT.prose, fontSize: 10, color: t.inkFaint, marginTop: 5 }}>Stop the running one first (Ctrl+C), then start it again.</p>
          )}
        </div>
      ) : error ? (
        <p className="mx-3 mt-2 px-3 py-2 rounded-xl" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, background: `${t.warn}12`, overflowWrap: 'anywhere' }}>
          {error}
        </p>
      ) : null}

      <div className="px-3 pt-2 space-y-1.5">
        {scans.map((s, i) => (
          <motion.div key={s.uuid} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.02 }}>
            <Row t={t} scan={s} onOpen={onOpen} opening={openingId === s.uuid} active={activeUuid === s.uuid} />
          </motion.div>
        ))}
        {!loading && !error && scans.length === 0 && (
          <p className="px-1 py-3" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint }}>
            No scans match. The search is a prefix match on the model URI — try just the organisation.
          </p>
        )}
        {scans.length > 0 && meta.total != null && scans.length < meta.total && (
          <button type="button" onClick={() => load(scans.length)} disabled={loading}
                  className="w-full py-2 rounded-xl disabled:opacity-50"
                  style={{ ...LBL, fontSize: 8.5, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
            {loading ? 'Loading…' : `Load ${Math.min(PAGE, meta.total - scans.length)} more`}
          </button>
        )}
      </div>
    </div>
  )
}
