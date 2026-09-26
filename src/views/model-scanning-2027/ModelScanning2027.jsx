import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import { useScanSession } from './useScanSession'

/**
 * ModelScanning2027 — the model-scanning pillar in the runtime console's
 * design system: same tokens, same three resizable panes, same rhythm of
 * architecture → live line → record stream → evidence.
 *
 * Presentation only; the session logic is the shared useScanSession, so this
 * console (now at /?scan=v1) and the launch-design SupplyChainLaunch cannot
 * drift. The data path is the one the old view used — POST `/scan-model`
 * (Vite → the Python scanner on 8001) and GET `/api/scanner/health`.
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

export function ModelScanning2027() {
  const { state } = useAppContext()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const {
    health, ready, records, selected, setSelectedId,
    mode, setMode, uri, setUri, file, setFile,
    railTab, setRailTab, tsg, setTsg, openingId,
    busy, run, pick, rescan, openScm, finished, clear,
    dropDepth, dropHandlers, lastGroup,
  } = useScanSession()

  const [leftW, setLeftW] = useState(330)
  const [rightW, setRightW] = useState(360)
  const [dragL, setDragL] = useState(false)
  const [dragR, setDragR] = useState(false)

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
