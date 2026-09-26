import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAttackSimulator } from '../../hooks/useAttackSimulator'
import { useAppContext } from '../../context/AppContext'
import { verdictOf } from './tokens'
import { useModelLabel } from './useModelLabel'

/**
 * useInterceptSession — the runtime console's session logic, without its look.
 *
 * Shared by the two New-design consoles for AIRS Runtime & AI-GW
 * (ApiIntercept2027 and the launcher-style RuntimeLaunch) so they cannot drift:
 * target switching, firing, translate-then-fire, the upload-scan turn, the
 * selected record, and the values the intercept line and evidence pane read.
 * Every data path is the existing one — useAttackSimulator, /api/chat,
 * /api/airs/report.
 */

export const DEFAULT_MODELS = {
  // Note the `google/` prefix and that this is a global-region model — it is
  // reached through the OpenAI-compatible endpoint, not the Vertex SDK, so the
  // catalogue id is not interchangeable with a bare `gemini-…` one.
  vertex:  'google/gemini-3.5-flash',
  bedrock: 'anthropic.claude-haiku-4-5-20251001-v1:0',
  azure:   'gpt-5.4-nano',
  aigw:    '@sudo-bedrock/us.anthropic.claude-sonnet-5',
}

export function useInterceptSession() {
  const { dispatch } = useAppContext()
  const [backend, setBackend] = useState('bedrock')
  const [model, setModel] = useState(DEFAULT_MODELS.bedrock)
  const [mcp, setMcp] = useState({ enabled: true, server: 'auto' })
  const [selectedId, setSelectedId] = useState(null)
  const [traceDrawer, setTraceDrawer] = useState(null)

  const { messages, isLoading, sendAttack, sendMessage, clearChat } = useAttackSimulator()

  const mcpActive = backend === 'aigw' && mcp.enabled ? mcp : null
  // The picker's label, not the routing id — see useModelLabel.
  const modelLabel = useModelLabel(backend, model)

  /**
   * Every backend opens protected.
   *
   * This used to be AI-GW only, on the argument that the API-layer lanes are
   * best demoed by watching an attack land first. In practice the console was
   * opening on VULNERABLE and a payload that sailed through read as a broken
   * demo rather than as the point. Protected is the honest default state of
   * the product; turning AIRS off is now the deliberate move, in either
   * direction, from the pill in the top bar or the sidebar toggle.
   */
  useEffect(() => { dispatch({ type: 'SET_PROTECTION', payload: true }) }, [dispatch])

  /**
   * Changing target starts a fresh session.
   *
   * A transcript belongs to the thing that produced it. Carrying records across
   * a switch left the column holding answers from a target that is no longer
   * selected, the SCM deep link pointing at the previous tenant's console, and
   * the diagram describing a route none of the visible records took. Clearing
   * also puts the architecture back on screen, which is the right moment to
   * explain the new shape.
   *
   * Re-clicking the target already selected is not a switch and leaves the
   * session alone.
   */
  const changeBackend = (b) => {
    if (b === backend) return
    clearChat()
    setSelectedId(null)
    setUploadScan(null)
    dispatch({ type: 'SET_SCM_URL', payload: null })
    setBackend(b)
    setModel(DEFAULT_MODELS[b])
    dispatch({ type: 'SET_PROTECTION', payload: true })
  }

  const [translating, setTranslating] = useState(null)
  const [uploadScan, setUploadScan] = useState(null)

  const fire = useCallback((attack) => sendAttack(attack, backend, model, mcpActive), [sendAttack, backend, model, mcpActive])
  const send = useCallback((text, doc) => sendMessage(text, backend, model, doc, mcpActive), [sendMessage, backend, model, mcpActive])

  const resend = useCallback((text) => sendMessage(text, backend, model, null, mcpActive), [sendMessage, backend, model, mcpActive])

  /**
   * Translate a payload for a non-English audience. Deliberately unprotected:
   * the point is to read the payload, and scanning the translation request
   * itself would just block it and teach the room nothing.
   */
  const translate = useCallback(async (text, language) => {
    setTranslating(text)
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Translate the following text to ${language}. Return ONLY the translated text, nothing else:\n\n${text}`,
          airsEnabled: false, backend, modelId: model,
        }),
      })
      const d = await r.json()
      // Fire the translation as a new payload, the way the original console
      // did. The point of translating an attack is to see whether the
      // detectors hold in that language — dropping the text into an alert box
      // ends the demo one step early.
      const translated = d.chatResponse?.content?.trim() || text
      send(translated)
    } catch {
      // The translation hop is unprotected and off to the side; if it fails,
      // fire the original rather than stalling on an error dialog.
      send(text)
    } finally {
      setTranslating(null)
    }
  }, [backend, model, send])

  // The rail follows the newest turn unless the operator has pinned an older
  // one by clicking it.
  const lastAssistant = useMemo(() => [...messages].reverse().find((m) => m.role === 'assistant'), [messages])
  const selected = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? lastAssistant ?? null,
    [messages, selectedId, lastAssistant]
  )
  useEffect(() => { setSelectedId(null) }, [messages.length])

  // A file scan is shown in the telemetry pane as its own turn, using the same
  // renderers as a chat turn, until the next message supersedes it.
  const uploadTurn = useMemo(() => {
    if (!uploadScan?.scanDetail) return null
    const d = uploadScan.scanDetail
    return {
      id: 'upload-scan',
      blocked: !!uploadScan.blocked,
      verdict: uploadScan.blocked ? 'BLOCKED' : uploadScan.airsEnabled === false ? 'DIRECT' : 'ALLOWED',
      content: uploadScan.blockReason ?? null,
      upload: uploadScan,
      telemetry: {
        summary: { model: `upload · ${uploadScan.name}` },
        inputScan: d,
        outputScan: null,
        timing: { airs_input_scan_ms: d.latency_ms ?? uploadScan.latencyMs, llm_ms: null, airs_output_scan_ms: null, total_ms: uploadScan.latencyMs },
        llm: {},
      },
    }
  }, [uploadScan])

  useEffect(() => { setUploadScan(null) }, [messages.length])

  // The upload route answers before the deciding chunk's AIRS report is
  // fetched; pull it in when it lands so the pane gets its per-service detail.
  // The server joins its own in-flight fetch — AIRS is not called twice.
  useEffect(() => {
    const d = uploadScan?.scanDetail
    if (!d?.reportPending || !d.report_id) return
    let live = true
    fetch(`/api/airs/report?id=${encodeURIComponent(d.report_id)}`)
      .then((r) => r.json())
      .catch((err) => ({ data: null, error: err.message }))
      .then((report) => {
        if (!live) return
        setUploadScan((cur) => (cur?.scanDetail?.report_id === d.report_id
          ? { ...cur, scanDetail: { ...cur.scanDetail, report, reportPending: false } }
          : cur))
      })
    return () => { live = false }
  }, [uploadScan?.scanDetail?.report_id, uploadScan?.scanDetail?.reportPending])

  const paneMessage = uploadTurn ?? selected
  const phase = isLoading ? 'inflight' : selected ? 'resolved' : 'idle'
  const verdict = verdictOf(selected)
  const blockedStage = selected?.telemetry?.outputScan?.action === 'block' ? 'output' : 'input'
  const hasRecords = messages.some((m) => m.role === 'user')

  const newSession = useCallback(() => { clearChat(); setSelectedId(null); setUploadScan(null) }, [clearChat])

  return {
    backend, model, setModel, mcp, setMcp, modelLabel,
    messages, isLoading, clearChat, newSession,
    changeBackend, fire, send, resend, translate, translating,
    uploadScan, setUploadScan, selected, setSelectedId, traceDrawer, setTraceDrawer,
    paneMessage, phase, verdict, blockedStage, hasRecords,
  }
}
