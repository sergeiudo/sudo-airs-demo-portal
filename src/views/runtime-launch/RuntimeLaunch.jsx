import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'
import { useAppContext } from '../../context/AppContext'
import { PromptTelemetryDrawer } from '../../components/api-intercept/PromptTelemetryDrawer'
import { tokens, glass } from '../api-intercept-2027/tokens'
import { InterceptLine } from '../api-intercept-2027/InterceptLine'
import { RecordStream } from '../api-intercept-2027/RecordStream'
import { EvidencePane } from '../api-intercept-2027/EvidencePane'
import { SessionArchitecture } from '../api-intercept-2027/SessionArchitecture'
import { Handle } from '../api-intercept-2027/PaneHandle'
import { useInterceptSession } from '../api-intercept-2027/useInterceptSession'
import { HOME_PILLARS } from '../home-2027/homeData'
import { PillarHeader } from '../../components/layout/PillarHeader'
import { SessionActions } from './SessionActions'
import { LaunchLibrary } from './LaunchLibrary'
import { LaunchComposer } from './LaunchComposer'
import { EvidenceEmpty } from './EvidenceEmpty'

/**
 * RuntimeLaunch — AIRS Runtime & AI-GW in the launcher home's design.
 *
 * The home tile opens into this console: its rose band becomes the pillar's
 * one header (PillarHeader — the portal top bar and the pillar band unified,
 * so MainLayout drops its TopBar here), the four targets are colour-banded cards and the attack
 * categories app-style rows (LaunchLibrary), the message box a chat composer
 * (LaunchComposer). The transcript, evidence pane, intercept line and
 * architecture diagrams are the 2027 console's
 * own components, and the session logic is the shared useInterceptSession —
 * so this is a new look over the same behaviour, not a second implementation.
 *
 * The session strip is gone: "New session" lives on the header
 * (SessionActions), which gives the transcript that height back.
 *
 * The previous New console (ApiIntercept2027) stays reachable at
 * /?runtime=v1; Classic behind the Design switch.
 */

export function RuntimeLaunch() {
  const { state, dispatch } = useAppContext()
  const theme = useProtectionTheme()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const isProtected = theme.isProtected
  const pillar = HOME_PILLARS.find((p) => p.id === 'apiIntercept')

  const [leftW, setLeftW] = useState(344)
  const [rightW, setRightW] = useState(352)
  const [dragL, setDragL] = useState(false)
  const [dragR, setDragR] = useState(false)

  const {
    backend, model, setModel, mcp, setMcp, modelLabel,
    messages, isLoading, newSession,
    changeBackend, fire, send, resend, translate, translating,
    setUploadScan, selected, setSelectedId, traceDrawer, setTraceDrawer,
    paneMessage, phase, verdict, blockedStage, hasRecords,
  } = useInterceptSession()


  return (
    <div className="relative flex flex-col h-full overflow-hidden"
         style={{ background: t.ground, cursor: dragL || dragR ? 'col-resize' : 'default', userSelect: dragL || dragR ? 'none' : 'auto' }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
        backgroundSize: '44px 44px',
      }} />
      {isProtected && (
        <motion.div
          className="absolute inset-y-0 pointer-events-none"
          style={{ width: 260, background: `linear-gradient(90deg, transparent, ${t.pass}0a, transparent)` }}
          animate={{ left: ['-20%', '110%'] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
        />
      )}

      <PillarHeader
        pillarId="apiIntercept" warn={!isProtected}
        actions={(
          <SessionActions
            t={t} tone={pillar.accent} isProtected={isProtected}
            onToggleProtection={() => dispatch({ type: 'SET_PROTECTION', payload: !isProtected })}
            onNewSession={newSession}
          />
        )}
      />

      <div className="relative flex-1 min-h-0 flex">
        <div className="relative flex-shrink-0 overflow-hidden py-3 pl-3" style={{ width: leftW }}>
          <div className="h-full overflow-hidden" style={glass(t, { radius: 22 })}>
            <LaunchLibrary
              t={t} onFire={fire}
              backend={backend} model={model}
              onBackendChange={changeBackend} onModelChange={setModel}
              mcp={mcp} onMcpChange={setMcp}
            />
          </div>
        </div>
        <Handle t={t} side="left" dragging={dragL} onDrag={{ width: leftW, setWidth: setLeftW, setDragging: setDragL }} />

        <div className="relative flex-1 min-w-0 flex flex-col pt-1">
          {hasRecords && (
            <InterceptLine
              t={t} phase={phase} verdict={verdict} isProtected={isProtected} backend={backend}
              timing={selected?.telemetry?.timing} blockedStage={blockedStage} modelLabel={modelLabel}
            />
          )}

          <RecordStream
            t={t}
            messages={messages}
            isLoading={isLoading}
            onSelect={(m) => setSelectedId(m?.id ?? null)}
            selectedId={selected?.id}
            onOpenTrace={setTraceDrawer}
            onResend={resend}
            onTranslate={translate}
            translating={translating}
            backend={backend}
            variant="band"
            empty={<SessionArchitecture t={t} backend={backend} model={modelLabel} modelId={model}
                                        isProtected={isProtected} mcpEnabled={mcp.enabled} />}
          />

          <LaunchComposer
            t={t} tone={pillar.accent} isProtected={isProtected} isLoading={isLoading}
            onSend={send} onScan={setUploadScan}
          />
        </div>

        <Handle t={t} side="right" dragging={dragR} onDrag={{ width: rightW, setWidth: setRightW, setDragging: setDragR }} />
        <div className="relative flex-shrink-0 overflow-hidden py-3 pr-3" style={{ width: rightW }}>
          <EvidencePane t={t} message={paneMessage} scmUrl={state.scmUrl} variant="band" onOpenTrace={setTraceDrawer}
                        empty={<EvidenceEmpty t={t} backend={backend} isProtected={isProtected} />} />
        </div>
      </div>

      {traceDrawer && (
        <PromptTelemetryDrawer traceId={traceDrawer} onClose={() => setTraceDrawer(null)} variant="band" />
      )}
    </div>
  )
}
