import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Upload } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { tokens, FONT, label as LBL, glass, bloom } from '../api-intercept-2027/tokens'
import { ScanLibrary } from './ScanLibrary'
import { ScanLine } from './ScanLine'
import { ScanStream } from './ScanStream'
import { ScanComposer } from './ScanComposer'
import { ScanEvidence } from './ScanEvidence'
import { ScanArchitecture } from './ScanArchitecture'
import { useScannerHealth, scmScanUrl, recordFromScm, scanDisplayName } from './scanModel'

/**
 * ModelScanning2027 — the model-scanning pillar in the runtime console's
 * design system: same tokens, same three resizable panes, same rhythm of
 * architecture → live line → record stream → evidence.
 *
 * Presentation only. The data path is the one the old view used — POST
 * `/scan-model` (Vite → the Python scanner on 8001) and GET
 * `/api/scanner/health` — so `?ui=legacy` can bring the old view back without
 * a rebuild, exactly as the runtime pillar does.
 */

const LIMITS = { left: [264, 520], right: [300, 620] }

/** Draggable pane edge — the runtime console's, verbatim. */
function Handle({ t, onDrag, dragging, side }) {
  const startX = useRef(0)
  const startW = useRef(0)

  const down = (e) => {
    e.preventDefault()
    startX.current = e.clientX
    startW.current = onDrag.width
    onDrag.setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const move = (e) => {
      const delta = side === 'left' ? e.clientX - startX.current : startX.current - e.clientX
      const [min, max] = LIMITS[side]
      onDrag.setWidth(Math.min(max, Math.max(min, startW.current + delta)))
    }
    const up = () => onDrag.setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging, side, onDrag])

  return (
    <div onMouseDown={down} className="relative flex-shrink-0 group" style={{ width: 1, cursor: 'col-resize' }}>
      <div className="absolute inset-y-0 -left-2 -right-2 z-10" />
      <div className="h-full w-full transition-colors" style={{ background: dragging ? t.block : t.hairline }} />
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col justify-center gap-1 pointer-events-none">
        {[0, 1, 2].map((i) => (
          <span key={i} className="rounded-full" style={{ width: 2, height: 2, background: dragging ? t.block : t.inkFaint, opacity: dragging ? 1 : 0.5 }} />
        ))}
      </div>
    </div>
  )
}

/**
 * The session outlives the view. The old pillar kept its history in component
 * state, so a trip to Home and back threw every scan away mid-demo. Module
 * scope rather than storage: a page refresh still starts clean, and a scan
 * that finishes while the view is unmounted still lands in the record.
 */
let SESSION = []

export function ModelScanning2027() {
  const { state, dispatch } = useAppContext()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const health = useScannerHealth()
  const ready = health.state === 'live'

  const [records, setRecords] = useState(SESSION)
  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('huggingface')
  const [uri, setUri] = useState('')
  const [file, setFile] = useState(null)
  const [railTab, setRailTab] = useState('library')
  const [tsg, setTsg] = useState(null)
  const [openingId, setOpeningId] = useState(null)

  const [leftW, setLeftW] = useState(330)
  const [rightW, setRightW] = useState(360)
  const [dragL, setDragL] = useState(false)
  const [dragR, setDragR] = useState(false)

  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const commit = useCallback((fn) => {
    SESSION = fn(SESSION)
    if (mounted.current) setRecords(SESSION)
  }, [])

  const busy = records.some((r) => r.status === 'scanning')

  const run = useCallback(async ({ source, uri: target, file: f, preset = null }) => {
    const id = `scan-${Date.now()}`
    commit((rs) => [...rs, {
      id, source, preset, target: source === 'huggingface' ? target : f.name,
      size: f?.size ?? null, startedAt: Date.now(), status: 'scanning',
    }])
    setSelectedId(null)

    const fd = new FormData()
    fd.append('source_type', source)
    if (source === 'huggingface') fd.append('hf_model_uri', target)
    else fd.append('file', f)

    let patch
    try {
      const res = await fetch('/scan-model', { method: 'POST', body: fd })
      const text = await res.text()
      let json = null
      try { json = JSON.parse(text) } catch { /* an HTML error page from a proxy */ }
      if (res.ok && json) {
        patch = { status: 'done', result: json }
      } else {
        const d = json?.detail
        const message = typeof d === 'string' ? d
          : d ? JSON.stringify(d)
          : text && !text.trim().startsWith('<') ? text.slice(0, 300)
          : res.statusText || 'No response from the scanner'
        patch = { status: 'error', error: { status: res.status, message } }
      }
    } catch (e) {
      patch = { status: 'error', error: { status: 0, message: e.message } }
    }
    commit((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    if (source === 'local') setFile(null)
  }, [commit])

  const pick = useCallback((item) => {
    setMode('huggingface')
    setUri(item.uri)
    run({ source: 'huggingface', uri: item.uri, preset: item.id })
  }, [run])

  const rescan = useCallback((rec) => {
    run({ source: 'huggingface', uri: rec.target, preset: rec.preset })
  }, [run])

  /**
   * Open a scan from the SCM history as a record. Already on screen → just
   * select it (a scan fired here and then clicked in the history is the same
   * scan, not two). Otherwise pull the scan and its violations and append it.
   */
  const openScm = useCallback(async (scan) => {
    const existing = SESSION.find((r) => r.result?.uuid === scan.uuid)
    if (existing) { setSelectedId(existing.id); return }
    setOpeningId(scan.uuid)
    try {
      const r = await fetch(`/api/supply-chain/scans/${scan.uuid}`)
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw Object.assign(new Error(d.error || `HTTP ${r.status}`), { status: r.status })
      const rec = recordFromScm(d)
      commit((rs) => [...rs.filter((x) => x.id !== rec.id), rec])
      setSelectedId(rec.id)
    } catch (e) {
      const id = `scm-err-${scan.uuid}-${Date.now()}`
      commit((rs) => [...rs, {
        id, source: scan.source_type === 'HUGGING_FACE' ? 'huggingface' : 'local', target: scanDisplayName(scan),
        startedAt: Date.now(), status: 'error', fromScm: true,
        error: { status: e.status ?? 0, message: `Could not load this scan from SCM: ${e.message}` },
      }])
      setSelectedId(id)
    } finally {
      setOpeningId(null)
    }
  }, [commit])

  // A scan fired here lands in the tenant too; refresh the history when one
  // finishes so the list never lags the console.
  const finished = records.filter((r) => !r.fromScm && r.status !== 'scanning').length

  const clear = () => { commit(() => []); setSelectedId(null) }

  // The rail follows the newest scan unless the operator pins an older one.
  const selected = useMemo(
    () => records.find((r) => r.id === selectedId) ?? records[records.length - 1] ?? null,
    [records, selectedId]
  )

  // The top bar's SCM Console link follows the selected scan, and is cleared on
  // the way out so the runtime pillar never inherits a model-scan link.
  const scm = scmScanUrl(selected?.result)
  useEffect(() => { dispatch({ type: 'SET_SCM_URL', payload: scm }) }, [scm, dispatch])
  useEffect(() => () => dispatch({ type: 'SET_SCM_URL', payload: null }), [dispatch])

  // Drop a model file anywhere on the centre column. Counted by depth because
  // dragenter/dragleave fire per child element and a naive flag flickers.
  const [dropDepth, setDropDepth] = useState(0)
  const dropHandlers = {
    onDragEnter: (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDropDepth((d) => d + 1) } },
    onDragOver: (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault() },
    onDragLeave: () => setDropDepth((d) => Math.max(0, d - 1)),
    onDrop: (e) => {
      e.preventDefault()
      setDropDepth(0)
      const f = e.dataTransfer?.files?.[0]
      if (f && !busy) { setMode('local'); setFile(f) }
    },
  }

  const lastGroup = [...records].reverse().find((r) => r.source === mode && r.result?.security_group_name)?.result.security_group_name

  return (
    <div className="relative flex h-full overflow-hidden"
         style={{ background: t.ground, cursor: dragL || dragR ? 'col-resize' : 'default', userSelect: dragL || dragR ? 'none' : 'auto' }}>

      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
        backgroundSize: '44px 44px',
      }} />
      {/* The sweep runs while a scan is in flight — powered-on, not decorated. */}
      {busy && (
        <motion.div className="absolute inset-y-0 pointer-events-none"
                    style={{ width: 260, background: `linear-gradient(90deg, transparent, ${t.live}12, transparent)` }}
                    animate={{ left: ['-20%', '110%'] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }} />
      )}

      <div className="relative flex-shrink-0 overflow-hidden py-3 pl-3" style={{ width: leftW }}>
        <div className="h-full overflow-hidden" style={glass(t, { radius: 18 })}>
          <ScanLibrary t={t} health={health} onPick={pick} busy={busy} activeUri={selected?.target}
                       tab={railTab} onTab={setRailTab} tsg={tsg} onTenant={setTsg}
                       history={{ onOpen: openScm, openingId, activeUuid: selected?.result?.uuid, refreshKey: finished }} />
        </div>
      </div>
      <Handle t={t} side="left" dragging={dragL} onDrag={{ width: leftW, setWidth: setLeftW, setDragging: setDragL }} />

      <div className="relative flex-1 min-w-0 flex flex-col" {...dropHandlers}>
        {records.length > 0 && <ScanLine t={t} record={selected} />}

        <div className="flex items-center gap-3 px-6 py-2 flex-shrink-0 mx-3 mt-2 rounded-xl"
             style={{ background: t.sunken, border: `1px solid ${t.hairline}` }}>
          <span style={{ ...LBL, fontSize: 8, color: t.inkFaint }}>
            {records.length ? `${records.length} scan${records.length === 1 ? '' : 's'} this session` : 'no scans yet'}
          </span>
          <button
            onClick={clear}
            disabled={busy}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all disabled:opacity-40"
            style={{
              ...LBL, fontSize: 9, color: t.live,
              background: t.isLight ? 'rgba(74,118,240,0.10)' : 'rgba(74,118,240,0.18)',
              border: `1px solid ${t.isLight ? 'rgba(74,118,240,0.32)' : 'rgba(74,118,240,0.40)'}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = t.isLight ? 'rgba(74,118,240,0.18)' : 'rgba(74,118,240,0.28)'
              e.currentTarget.style.boxShadow = bloom(t.live, 0.5)
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = t.isLight ? 'rgba(74,118,240,0.10)' : 'rgba(74,118,240,0.18)'
              e.currentTarget.style.boxShadow = 'none'
            }}
            title="Clear the scan history and start a fresh session">
            <Plus size={11} /> New session
          </button>
        </div>

        <ScanStream
          t={t} records={records} selectedId={selected?.id}
          onSelect={setSelectedId} onRescan={rescan} busy={busy}
          empty={<ScanArchitecture t={t} mode={mode} ready={ready} />}
        />

        <ScanComposer
          t={t} mode={mode} onMode={setMode}
          uri={uri} onUri={setUri} file={file} onFile={setFile}
          onScan={run} busy={busy} ready={ready} lastGroup={lastGroup}
        />

        <AnimatePresence>
          {dropDepth > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-3 z-20 flex flex-col items-center justify-center pointer-events-none"
                        style={{ background: `${t.panel}e6`, border: `2px dashed ${t.live}`, borderRadius: 24, boxShadow: bloom(t.live, 1) }}>
              <Upload size={26} style={{ color: t.live }} />
              <p style={{ fontFamily: FONT.display, fontSize: 16, fontWeight: 700, color: t.ink, marginTop: 10 }}>Drop to load a model file</p>
              <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 4 }}>
                Scanned on this host — only file hashes and findings leave it.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Handle t={t} side="right" dragging={dragR} onDrag={{ width: rightW, setWidth: setRightW, setDragging: setDragR }} />
      <div className="relative flex-shrink-0 overflow-hidden py-3 pr-3" style={{ width: rightW }}>
        <ScanEvidence t={t} record={selected} />
      </div>
    </div>
  )
}
