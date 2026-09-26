import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { tokens, FONT, glass } from '../api-intercept-2027/tokens'
import { Handle } from '../api-intercept-2027/PaneHandle'
import { HOME_PILLARS } from '../home-2027/homeData'
import { PillarHeader } from '../../components/layout/PillarHeader'
import { ScanLine } from '../model-scanning-2027/ScanLine'
import { ScanStream } from '../model-scanning-2027/ScanStream'
import { useScanSession } from '../model-scanning-2027/useScanSession'
import { ScanActions } from './ScanActions'
import { LaunchScanLibrary } from './LaunchScanLibrary'
import { LaunchScanComposer } from './LaunchScanComposer'
import { LaunchScanEvidence } from './LaunchScanEvidence'
import { LaunchScanArchitecture } from './LaunchScanArchitecture'

/**
 * SupplyChainLaunch — AI Supply Chain in the launch design.
 *
 * The home tile opens into this console the way it opens into RuntimeLaunch:
 * the pillar's indigo band is its one header (PillarHeader — MainLayout drops
 * its TopBar here), carrying the scanner's health and New session
 * (ScanActions). The rail, composer, architecture and evidence pane are
 * launch-design components; the transcript is the v1 console's ScanStream in
 * its band variant; the session logic is the shared useScanSession — a new
 * look over the same behaviour, not a second implementation.
 *
 * The previous New console (ModelScanning2027) stays reachable at /?scan=v1;
 * Classic behind the Design switch.
 */

export function SupplyChainLaunch() {
  const { state } = useAppContext()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const pillar = HOME_PILLARS.find((p) => p.id === 'modelScanning')
  const tone = pillar.accent

  const {
    health, ready, records, selected, setSelectedId,
    mode, setMode, uri, setUri, file, setFile,
    railTab, setRailTab, tsg, setTsg, openingId,
    busy, run, pick, rescan, openScm, finished, clear,
    dropDepth, dropHandlers, lastGroup,
  } = useScanSession()

  const [leftW, setLeftW] = useState(344)
  const [rightW, setRightW] = useState(360)
  const [dragL, setDragL] = useState(false)
  const [dragR, setDragR] = useState(false)
  const down = health.state === 'stub' || health.state === 'offline'

  return (
    <div className="relative flex flex-col h-full overflow-hidden"
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

      <PillarHeader
        pillarId="modelScanning" warn={down}
        actions={<ScanActions t={t} tone={tone} health={health} busy={busy} onNewSession={clear} />}
      />

      <div className="relative flex-1 min-h-0 flex">
        <div className="relative flex-shrink-0 overflow-hidden py-3 pl-3" style={{ width: leftW }}>
          <div className="h-full overflow-hidden" style={glass(t, { radius: 22 })}>
            <LaunchScanLibrary t={t} tone={tone} health={health} onPick={pick} busy={busy} activeUri={selected?.target}
                               tab={railTab} onTab={setRailTab} tsg={tsg} onTenant={setTsg}
                               history={{ onOpen: openScm, openingId, activeUuid: selected?.result?.uuid, refreshKey: finished }} />
          </div>
        </div>
        <Handle t={t} side="left" dragging={dragL} onDrag={{ width: leftW, setWidth: setLeftW, setDragging: setDragL }} />

        <div className="relative flex-1 min-w-0 flex flex-col pt-1" {...dropHandlers}>
          {records.length > 0 && <ScanLine t={t} record={selected} />}

          <ScanStream
            variant="band"
            t={t} records={records} selectedId={selected?.id}
            onSelect={setSelectedId} onRescan={rescan} busy={busy}
            empty={<LaunchScanArchitecture t={t} tone={tone} mode={mode} ready={ready} />}
          />

          <LaunchScanComposer
            t={t} tone={tone} mode={mode} onMode={setMode}
            uri={uri} onUri={setUri} file={file} onFile={setFile}
            onScan={run} busy={busy} ready={ready} lastGroup={lastGroup}
          />

          <AnimatePresence>
            {dropDepth > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="absolute inset-3 z-20 flex flex-col items-center justify-center pointer-events-none"
                          style={{ background: `${t.panel}e6`, border: `2px dashed ${tone}`, borderRadius: 24, boxShadow: `0 12px 32px ${tone}33` }}>
                <span className="grid place-items-center rounded-2xl" style={{ width: 52, height: 52, background: `${tone}17`, color: tone }}>
                  <Upload size={24} aria-hidden="true" />
                </span>
                <p style={{ fontFamily: FONT.display, fontSize: 16, fontWeight: 700, color: t.ink, marginTop: 12 }}>Drop to load a model file</p>
                <p style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginTop: 4 }}>
                  Scanned on this host — only file hashes and findings leave it.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Handle t={t} side="right" dragging={dragR} onDrag={{ width: rightW, setWidth: setRightW, setDragging: setDragR }} />
        <div className="relative flex-shrink-0 overflow-hidden py-3 pr-3" style={{ width: rightW }}>
          <LaunchScanEvidence t={t} record={selected} ready={ready} />
        </div>
      </div>
    </div>
  )
}
