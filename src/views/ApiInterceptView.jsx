import React, { useState, useRef, useCallback, useEffect } from 'react'
import { AttackLibrary } from '../components/api-intercept/AttackLibrary'
import { ChatCenter } from '../components/api-intercept/ChatCenter'
import { TelemetrySidebar } from '../components/api-intercept/TelemetrySidebar'
import { useAttackSimulator } from '../hooks/useAttackSimulator'
import { useProtectionTheme } from '../hooks/useProtectionTheme'
import { PromptTelemetryDrawer } from '../components/api-intercept/PromptTelemetryDrawer'

const DEFAULT_MODELS = {
  vertex:  'gemini-2.0-flash-001',
  bedrock: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  azure:   'gpt-5.4-nano',
}

const MIN_SIDEBAR  = 220
const MAX_SIDEBAR  = 600
const DEFAULT_RIGHT = 320

const MIN_LIBRARY  = 216
const MAX_LIBRARY  = 576
const DEFAULT_LEFT  = 312

export function ApiInterceptView() {
  const [backend, setBackend] = useState('vertex')
  const [model, setModel] = useState(DEFAULT_MODELS.vertex)

  // Right telemetry sidebar
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_RIGHT)
  const [isDragging, setIsDragging] = useState(false)
  const [telemetryDrawer, setTelemetryDrawer] = useState(null)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  // Left attack library
  const [libraryWidth, setLibraryWidth] = useState(DEFAULT_LEFT)
  const [isLibDragging, setIsLibDragging] = useState(false)
  const libDragStartX = useRef(0)
  const libDragStartWidth = useRef(0)

  const theme = useProtectionTheme()

  const { messages, activeTelemetry, isLoading, sendAttack, sendMessage, clearChat } = useAttackSimulator()

  const handleBackendChange = (b) => {
    setBackend(b)
    setModel(DEFAULT_MODELS[b])
  }

  const handleSelectAttack = (attack) => {
    sendAttack(attack, backend, model)
  }

  // Right handle
  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    dragStartX.current = e.clientX
    dragStartWidth.current = sidebarWidth
    setIsDragging(true)
  }, [sidebarWidth])

  useEffect(() => {
    if (!isDragging) return
    const onMouseMove = (e) => {
      const delta = dragStartX.current - e.clientX
      setSidebarWidth(Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, dragStartWidth.current + delta)))
    }
    const onMouseUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [isDragging])

  // Left handle
  const onLibMouseDown = useCallback((e) => {
    e.preventDefault()
    libDragStartX.current = e.clientX
    libDragStartWidth.current = libraryWidth
    setIsLibDragging(true)
  }, [libraryWidth])

  useEffect(() => {
    if (!isLibDragging) return
    const onMouseMove = (e) => {
      const delta = e.clientX - libDragStartX.current
      setLibraryWidth(Math.min(MAX_LIBRARY, Math.max(MIN_LIBRARY, libDragStartWidth.current + delta)))
    }
    const onMouseUp = () => setIsLibDragging(false)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [isLibDragging])

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ cursor: isDragging || isLibDragging ? 'col-resize' : 'default', userSelect: isDragging || isLibDragging ? 'none' : 'auto' }}
    >
      {/* Left: Attack Library — resizable */}
      <div className="flex-shrink-0 border-r border-white/10 overflow-hidden" style={{ width: libraryWidth }}>
        <AttackLibrary
          onSelectAttack={handleSelectAttack}
          backend={backend}
          model={model}
          onBackendChange={handleBackendChange}
          onModelChange={setModel}
        />
      </div>

      {/* Left resize handle */}
      <div
        onMouseDown={onLibMouseDown}
        className="relative flex-shrink-0 w-1 group cursor-col-resize"
      >
        <div className="absolute inset-y-0 -left-1.5 -right-1.5 z-10" />
        <div className={`h-full w-full transition-colors duration-150 ${
          isLibDragging
            ? theme.isProtected ? 'bg-emerald-500/60' : 'bg-red-500/60'
            : 'bg-white/10 group-hover:' + (theme.isProtected ? 'bg-emerald-500/40' : 'bg-red-500/40')
        }`} />
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1 pointer-events-none">
          {[0,1,2].map(i => <div key={i} className="w-0.5 h-0.5 rounded-full bg-white/20" />)}
        </div>
      </div>

      {/* Center: Chat — flex-1 */}
      <div className="flex-1 min-w-0 overflow-hidden bg-base-950/50">
        <ChatCenter
          messages={messages}
          isLoading={isLoading}
          onSendMessage={sendMessage}
          onClear={clearChat}
          backend={backend}
          model={model}
          onOpenTelemetry={setTelemetryDrawer}
        />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        className="relative flex-shrink-0 w-1 group cursor-col-resize"
      >
        {/* Invisible wider hit area */}
        <div className="absolute inset-y-0 -left-1.5 -right-1.5 z-10" />
        {/* Visible track */}
        <div className={`h-full w-full transition-colors duration-150 ${
          isDragging
            ? theme.isProtected ? 'bg-emerald-500/60' : 'bg-red-500/60'
            : 'bg-white/10 group-hover:' + (theme.isProtected ? 'bg-emerald-500/40' : 'bg-red-500/40')
        }`} />
        {/* Center grip dots */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1 pointer-events-none">
          {[0,1,2].map(i => (
            <div
              key={i}
              className={`w-0.5 h-0.5 rounded-full transition-colors duration-150 ${
                isDragging || false
                  ? theme.isProtected ? 'bg-emerald-400' : 'bg-red-400'
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Right: Telemetry — resizable */}
      <div
        className="flex-shrink-0 overflow-hidden bg-base-900/30"
        style={{ width: sidebarWidth }}
      >
        <TelemetrySidebar telemetry={activeTelemetry} />
      </div>

      {/* Prompt Telemetry Drawer */}
      <PromptTelemetryDrawer
        telemetry={telemetryDrawer}
        onClose={() => setTelemetryDrawer(null)}
      />
    </div>
  )
}
