import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'
import { useAppContext } from '../../context/AppContext'
import { PromptTelemetryDrawer } from '../../components/api-intercept/PromptTelemetryDrawer'
import { tokens, label as LBL, glass, bloom } from './tokens'
import { InterceptLine } from './InterceptLine'
import { AttackLibrary } from '../../components/api-intercept/AttackLibrary'
import { RecordStream } from './RecordStream'
import { EvidencePane } from './EvidencePane'
import { Composer } from './Composer'
import { SessionArchitecture } from './SessionArchitecture'
import { Handle } from './PaneHandle'
import { useInterceptSession } from './useInterceptSession'

/**
 * ApiIntercept2027 — the console shell.
 *
 * Presentation only. Every data path is the existing one: useAttackSimulator,
 * /api/chat, /api/models/*, /api/mcp/servers, /api/upload/*. Nothing on the
 * server changed for this redesign, which is what makes it safe to run beside
 * the current view rather than instead of it.
 */

export function ApiIntercept2027() {
  const { state } = useAppContext()
  const theme = useProtectionTheme()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const isProtected = theme.isProtected

  const [leftW, setLeftW] = useState(330)
  const [rightW, setRightW] = useState(352)
  const [dragL, setDragL] = useState(false)
  const [dragR, setDragR] = useState(false)

  const {
    backend, model, setModel, mcp, setMcp, modelLabel,
    messages, isLoading, clearChat,
    changeBackend, fire, send, resend, translate, translating,
    setUploadScan, selected, setSelectedId, traceDrawer, setTraceDrawer,
    paneMessage, phase, verdict, blockedStage, hasRecords,
  } = useInterceptSession()

  return (
    <div className="relative flex h-full overflow-hidden"
         style={{ background: t.ground, cursor: dragL || dragR ? 'col-resize' : 'default', userSelect: dragL || dragR ? 'none' : 'auto' }}>

      {/* Ambient ground — grid + a slow sweep. Powered-on, not decorated. */}
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

      <div className="relative flex-shrink-0 overflow-hidden py-3 pl-3" style={{ width: leftW }}>
        <div className="h-full overflow-hidden" style={glass(t, { radius: 18 })}>
          <AttackLibrary
            onSelectAttack={fire}
            backend={backend} model={model}
            onBackendChange={changeBackend} onModelChange={setModel}
            mcp={mcp} onMcpChange={setMcp}
          />
        </div>
      </div>
      <Handle t={t} side="left" dragging={dragL} onDrag={{ width: leftW, setWidth: setLeftW, setDragging: setDragL }} />

      <div className="relative flex-1 min-w-0 flex flex-col">
        {/* The line describes a turn; with no turns yet it is an empty rail
            taking the room's attention away from the architecture. */}
        {hasRecords && (
        <InterceptLine
          t={t}
          phase={phase}
          verdict={verdict}
          isProtected={isProtected}
          backend={backend}
          timing={selected?.telemetry?.timing}
          blockedStage={blockedStage}
          modelLabel={modelLabel}
        />
        )}

        {/* Session strip */}
        <div className="flex items-center gap-3 px-6 py-2 flex-shrink-0 mx-3 mt-2 rounded-xl"
             style={{ background: t.sunken, border: `1px solid ${t.hairline}` }}>
          <span style={{ ...LBL, fontSize: 8, color: t.inkFaint }}>
            {hasRecords ? `${messages.filter((m) => m.role === 'user').length} records this session` : 'no records yet'}
          </span>
          {/* Carries the same blue as the outgoing bubble and the CLIENT node:
              it is an action the operator takes, and at hairline-on-white it
              was invisible against the strip. */}
          <button
            onClick={() => { clearChat(); setSelectedId(null); setUploadScan(null) }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
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
            title="Clear the transcript and start a fresh session">
            <Plus size={11} /> New session
          </button>
        </div>

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
          empty={<SessionArchitecture t={t} backend={backend} model={modelLabel} modelId={model}
                                      isProtected={isProtected} mcpEnabled={mcp.enabled} />}
        />

        <Composer
          t={t} isProtected={isProtected} isLoading={isLoading}
          onSend={send} backend={backend} model={model} onScan={setUploadScan}
        />
      </div>

      <Handle t={t} side="right" dragging={dragR} onDrag={{ width: rightW, setWidth: setRightW, setDragging: setDragR }} />
      <div className="relative flex-shrink-0 overflow-hidden py-3 pr-3" style={{ width: rightW }}>
        <EvidencePane t={t} message={paneMessage} scmUrl={state.scmUrl} />
      </div>

      {traceDrawer && (
        <PromptTelemetryDrawer traceId={traceDrawer} onClose={() => setTraceDrawer(null)} />
      )}
    </div>
  )
}
