import { useState, useCallback } from 'react'
import { useAppContext } from '../context/AppContext'

const SCM_BASE = 'https://stratacloudmanager.paloaltonetworks.com/ai-security/runtime/ai-sessions'
const SCM_TSG_ID = '1986626000'
// The AI-GW route is enforced by a guardrail on the SUDO-Personal tenant, so
// its scans are not in the team console — deep-linking there shows an empty
// list and reads as "nothing was scanned".
const SCM_TSG_ID_AIGW = '1698236796'

function buildScmUrl(inputScan, backend) {
  if (!inputScan?.scan_id) return null
  const tsg = backend === 'aigw' ? SCM_TSG_ID_AIGW : SCM_TSG_ID
  return `${SCM_BASE}?tsg_id=${tsg}`
}

function makeErrorMessage(blockReason) {
  return {
    id: `msg-${Date.now()}-err`,
    role: 'assistant',
    content: null,
    blocked: true,
    blockReason,
    verdict: 'ERROR',
    riskScore: null,
    timestamp: new Date().toISOString(),
  }
}

const WELCOME = {
  id: 'welcome',
  role: 'system',
  content: 'SUDO AIRS Demo — Intercept Console ready. Type a message or select an attack payload from the library.',
  timestamp: new Date().toISOString(),
}

export function useAttackSimulator() {
  const { state, dispatch } = useAppContext()
  const { isProtected } = state
  const [messages, setMessages] = useState([WELCOME])
  const [activeTelemetry, setActiveTelemetry] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const send = useCallback(async ({ payload, attackMeta = null, backend = 'vertex', modelId = null, document = null, mcpEnabled = false, mcpServer = 'auto' }) => {
    const userMsg = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: payload,
      attackMeta,
      // Card metadata only — the extracted text is never held on the message.
      attachment: document ? { name: document.name, kind: document.kind, pages: document.pages, chars: document.chars } : null,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setActiveTelemetry(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: payload,
          document: document ? { name: document.name, text: document.text } : null,
          backend,
          modelId,
          airsEnabled: isProtected,
          attackMeta: attackMeta ?? null,
          mcpEnabled,
          mcpServer,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages(prev => [...prev, makeErrorMessage(`Server error: ${data.error ?? res.statusText}`)])
        return
      }

      const { chatResponse, ...telemetry } = data

      // verdict: BLOCKED | ALLOWED (AIRS) | DIRECT (no protection)
      const verdict = telemetry.summary
        ? telemetry.summary.verdict
        : 'DIRECT'

      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: chatResponse?.content ?? null,
        blocked: chatResponse?.blocked ?? false,
        blockReason: chatResponse?.block_reason ?? null,
        verdict,
        riskScore: null,
        tokensIn: data.llm?.tokens_in ?? null,
        tokensOut: data.llm?.tokens_out ?? null,
        timestamp: new Date().toISOString(),
        traceId: data.trace_id ?? null,
        // The MCP step trace rides on the message rather than only on
        // activeTelemetry, so scrolling back through a demo keeps each trace
        // attached to the turn that produced it.
        mcp: data.mcp ?? null,
        telemetry: { ...telemetry, chatResponse, prompt: payload, attackMeta },
      }])
      setActiveTelemetry({ ...telemetry, chatResponse })

      const url = buildScmUrl(telemetry.inputScan, backend)
      if (url) dispatch({ type: 'SET_SCM_URL', payload: url })
    } catch (err) {
      setMessages(prev => [...prev, makeErrorMessage(`Connection error: ${err.message}. Is the proxy server running?`)])
    } finally {
      setIsLoading(false)
    }
  }, [isProtected])

  // MCP attacks route through /api/mcp/invoke → real MCP server + real AIRS two-stage scan
  const sendMcpAttack = useCallback(async (attack, backend, modelId) => {
    const attackMeta = { label: attack.label, severity: attack.severity, technique: attack.technique }
    const userMsg = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: attack.payload,
      attackMeta,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setActiveTelemetry(null)

    try {
      const t0 = Date.now()
      const res = await fetch('/api/mcp/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: attack.mcpTool, params: attack.mcpParams, airsEnabled: isProtected }),
      })
      const data = await res.json()
      const roundTripMs = Date.now() - t0

      const blocked  = data.blocked ?? false
      const stage1   = data.stage1  ?? null
      const stage2   = data.stage2  ?? null
      const blockStage = data.blockStage ?? null

      // Derive verdict label
      const verdict = blocked ? 'BLOCKED' : stage1 ? 'ALLOWED' : 'DIRECT'

      // Build human-readable content for the bubble
      let content = null
      let blockReason = null
      if (blocked) {
        const stage = blockStage === 2 ? 'Stage 2 (output scan)' : 'Stage 1 (input scan)'
        blockReason = `MCP tool "${attack.mcpTool}" blocked by Prisma AIRS at ${stage}. Tool ${blockStage === 2 ? 'executed but output was suppressed' : 'never reached the MCP server'}.`
      } else if (data.toolResult) {
        // Summarise the tool output
        const result = data.toolResult
        if (result.content != null)       content = `Tool output:\n${String(result.content).slice(0, 400)}${String(result.content).length > 400 ? '…' : ''}`
        else if (result.stdout != null)   content = `Code executed:\nstdout: ${result.stdout}\nstderr: ${result.stderr ?? ''}\nexit: ${result.returncode}`
        else if (result.found != null)    content = `Memory lookup: found=${result.found}${result.value != null ? `, value="${result.value}"` : ''}`
        else if (result.stored != null)   content = `Memory write: stored=${result.stored}`
        else                              content = JSON.stringify(result, null, 2).slice(0, 400)
      }

      if (data.error) {
        blockReason = `MCP tool error: ${data.error}`
      }

      // Build telemetry in the same shape PipelineTrace expects for MCP
      const telemetry = {
        stage1, stage2,
        tool: attack.mcpTool,
        params: attack.mcpParams,
        toolResult: data.toolResult,
        blocked, blockStage,
        prompt: attack.payload,
        attackMeta,
        isMcpInvoke: true,   // flag so PipelineTrace uses the MCP-native shape
        // Map stage1/stage2 into inputScan/outputScan shape for SCM URL + sidebar compat
        inputScan: stage1 ? { scan_id: stage1.scan_id, tr_id: stage1.trId, action: stage1.action, category: stage1.category, prompt_detected: stage1.prompt_detected, latency_ms: stage1.latencyMs, requestBody: stage1.requestBody } : null,
        outputScan: stage2 ? { scan_id: stage2.scan_id, tr_id: stage2.trId, action: stage2.action, category: stage2.category, response_detected: stage2.response_detected, latency_ms: stage2.latencyMs, requestBody: stage2.requestBody } : null,
        summary: { verdict, category: (stage1 ?? stage2)?.category ?? 'unknown', threats_detected: Object.entries((stage1?.prompt_detected ?? stage2?.response_detected) ?? {}).filter(([,v]) => v).map(([k]) => k) },
        timing: { airs_input_scan_ms: stage1?.latencyMs ?? null, airs_output_scan_ms: stage2?.latencyMs ?? null, total_ms: roundTripMs },
        llm: {},
      }

      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content,
        blocked,
        blockReason,
        verdict,
        riskScore: null,
        tokensIn: null,
        tokensOut: null,
        timestamp: new Date().toISOString(),
        traceId: null,
        telemetry,
      }])
      setActiveTelemetry(telemetry)

      const url = buildScmUrl(telemetry.inputScan)
      if (url) dispatch({ type: 'SET_SCM_URL', payload: url })
    } catch (err) {
      setMessages(prev => [...prev, makeErrorMessage(`MCP error: ${err.message}`)])
    } finally {
      setIsLoading(false)
    }
  }, [isProtected, dispatch])

  // Called from attack library — MCP attacks use real /api/mcp/invoke, others use /api/chat
  const sendAttack = useCallback((attack, backend, modelId, mcp = null) => {
    if (attack.mcpTool) return sendMcpAttack(attack, backend, modelId)
    send({
      payload: attack.payload,
      attackMeta: { label: attack.label, severity: attack.severity, technique: attack.technique },
      backend, modelId,
      mcpEnabled: !!mcp?.enabled, mcpServer: mcp?.server ?? 'auto',
    })
  }, [send, sendMcpAttack])

  // Called from free chat input
  const sendMessage = useCallback((text, backend, modelId, document = null, mcp = null) => {
    send({
      payload: text, attackMeta: null, backend, modelId, document,
      mcpEnabled: !!mcp?.enabled, mcpServer: mcp?.server ?? 'auto',
    })
  }, [send])

  const clearChat = useCallback(() => {
    setMessages([{ ...WELCOME, timestamp: new Date().toISOString() }])
    setActiveTelemetry(null)
  }, [])

  return { messages, activeTelemetry, isLoading, sendAttack, sendMessage, clearChat }
}
