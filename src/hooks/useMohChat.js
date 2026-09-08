import { useCallback, useRef, useState } from 'react'

/**
 * useMohChat — SSE client for /api/moh/chat, plus the non-streaming /rag and
 * /agent scenario calls, kept in one message list so the citizen app renders
 * runtime chat, document retrieval and tool calls as one conversation.
 *
 * Adapted from usePortkeyChat (same hand-rolled SSE reader and the same
 * hook_results → hookResults normalisation), with three additions the MOH
 * demo needs:
 *   • `flagged` — AIRS returned verdict:false but the gateway served the
 *     request anyway (the tenant's guardrail runs in flag-only mode). Without
 *     this the UI would show a caught attack as a clean pass.
 *   • citations — RAG answers carry the retrieved documents
 *   • stage1/stage2 — direct AIRS tool_event scans for agent scenarios
 */

const EMPTY_META = {
  model: null, latencyMs: null, tokens: 0, tokensIn: null,
  hookResults: null, inputScan: null, outputScan: null,
  traceId: null, portkeyTraceId: null, cache: null,
  inputScanDone: false, outputScanDone: false,
  flagged: false, laneMode: null, replayed: false,
  blockReason: null, blockStage: null,
  citations: null, stage1: null, stage2: null, toolResult: null,
  scenario: null, family: null,
}

export function useMohChat() {
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const abortRef = useRef(null)

  const clear = useCallback(() => setMessages([]), [])
  const abort = useCallback(() => abortRef.current?.abort(), [])

  /** Append the user turn + a placeholder assistant turn; return the ids. */
  const openTurn = useCallback((prompt, attackMeta, seed = {}) => {
    const at = Date.now()
    const userId = `u-${at}`
    const asstId = `a-${at}`
    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', content: prompt, attackMeta: attackMeta || null, at },
      { id: asstId, role: 'assistant', content: '', status: 'streaming', at, metadata: { ...EMPTY_META, ...seed } },
    ])
    return { userId, asstId }
  }, [])

  const patch = useCallback((id, p) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, ...p, metadata: { ...m.metadata, ...(p.metadata || {}) } } : m
      )
    )
  }, [])

  // ── Streaming runtime chat ──────────────────────────────────────────────────
  const send = useCallback(
    async ({ prompt, model, lang = 'he', airsEnabled = true, scenario, family = 'runtime', system, attackMeta }) => {
      const { asstId } = openTurn(prompt, attackMeta, { model, scenario, family })
      setBusy(true)
      const controller = new AbortController()
      abortRef.current = controller

      // Token batching. Bedrock delivers ~150 frames of ~3 chars for a short
      // answer, in bursts with sub-millisecond gaps. One setState per frame
      // meant 150 full re-renders — each one re-parsing the whole markdown
      // string and firing a smooth-scroll — which is what made a 13s stream
      // look like it was being typed. Coalescing to ~20fps cuts that to ~15
      // renders with no visible change to the streaming effect.
      let pending = ''
      let flushTimer = null
      const flushTokens = () => {
        flushTimer = null
        if (!pending) return
        const chunk = pending
        pending = ''
        setMessages((prev) =>
          prev.map((m) => (m.id === asstId ? { ...m, content: m.content + chunk } : m))
        )
      }
      const queueToken = (text) => {
        pending += text
        if (flushTimer == null) flushTimer = setTimeout(flushTokens, 50)
      }
      /** Drain the buffer before any terminal state so nothing is dropped. */
      const settle = () => {
        if (flushTimer != null) { clearTimeout(flushTimer); flushTimer = null }
        flushTokens()
      }

      let buf = ''
      try {
        const resp = await fetch('/api/moh/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model, lang, airsEnabled, scenario, family, system,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        })
        if (!resp.ok || !resp.body) {
          const err = await resp.text().catch(() => resp.statusText)
          patch(asstId, { status: 'error', content: `${resp.status}: ${err}` })
          return
        }

        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let currentEvent = null

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim()
              continue
            }
            if (line.trim() === '') {
              currentEvent = null
              continue
            }
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (!raw) continue
            let parsed
            try { parsed = JSON.parse(raw) } catch { continue }

            if (currentEvent === 'metadata') {
              settle()
              const { hook_results, tokensOut, ...rest } = parsed
              patch(asstId, {
                status: parsed.flagged ? 'flagged' : 'done',
                metadata: { ...rest, hookResults: hook_results || null, tokens: tokensOut ?? 0 },
              })
              currentEvent = null
            } else if (currentEvent === 'hooks') {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== asstId) return m
                  const hr = m.metadata.hookResults || {}
                  const merged = {
                    before_request_hooks: [...(hr.before_request_hooks || []), ...(parsed.hook_results?.before_request_hooks || [])],
                    after_request_hooks: [...(hr.after_request_hooks || []), ...(parsed.hook_results?.after_request_hooks || [])],
                  }
                  return {
                    ...m,
                    metadata: {
                      ...m.metadata,
                      hookResults: merged,
                      [parsed.phase === 'input' ? 'inputScan' : 'outputScan']: parsed.scan ?? m.metadata[parsed.phase === 'input' ? 'inputScan' : 'outputScan'],
                      [parsed.phase === 'input' ? 'inputScanDone' : 'outputScanDone']: true,
                    },
                  }
                })
              )
              currentEvent = null
            } else if (currentEvent === 'blocked') {
              settle()
              patch(asstId, {
                status: 'blocked',
                content: '',
                metadata: {
                  hookResults: parsed.hook_results ?? null,
                  inputScan: parsed.inputScan ?? null,
                  outputScan: parsed.outputScan ?? null,
                  blockReason: parsed.reason ?? null,
                  blockStage: parsed.outputScan?.action === 'block' ? 'output' : 'input',
                  latencyMs: parsed.latencyMs ?? null,
                  traceId: parsed.traceId ?? null,
                  portkeyTraceId: parsed.portkeyTraceId ?? null,
                  inputScanDone: true,
                },
              })
              currentEvent = null
            } else if (currentEvent === 'error') {
              settle()
              patch(asstId, { status: 'error', content: parsed.message || 'Stream error' })
              currentEvent = null
            } else if (parsed.type === 'token') {
              queueToken(parsed.text)
            }
          }
        }
      } catch (e) {
        if (e?.name !== 'AbortError') patch(asstId, { status: 'error', content: String(e?.message || e) })
      } finally {
        settle()
        setBusy(false)
        abortRef.current = null
      }
    },
    [openTurn, patch]
  )

  // ── RAG scenario (non-streaming: we need citations + both scan stages) ──────
  const runRag = useCallback(
    async ({ query, model, lang = 'he', airsEnabled = true, scenario, forceDocIds, attackMeta }) => {
      const { asstId } = openTurn(query, attackMeta, { model, scenario, family: 'rag' })
      setBusy(true)
      try {
        const resp = await fetch('/api/moh/rag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, model, lang, airsEnabled, scenario, forceDocIds }),
        })
        const d = await resp.json()
        patch(asstId, {
          status: d.blocked ? 'blocked' : d.error ? 'error' : d.flagged ? 'flagged' : 'done',
          content: d.blocked ? '' : d.answer || d.error || '',
          metadata: {
            model: d.model, latencyMs: d.latencyMs,
            hookResults: d.hookResults, inputScan: d.upstreamScan, outputScan: d.downstreamScan,
            inputScanDone: !!d.upstreamScan, outputScanDone: !!d.downstreamScan,
            citations: d.retrievedDocs || null,
            blockReason: d.blockReason, blockStage: d.blockStage,
            flagged: !!d.flagged, laneMode: d.laneMode, replayed: !!d.replayed,
            traceId: d.traceId, augmentedPrompt: d.augmentedPrompt,
            providerFiltered: !!d.providerFiltered, finishReason: d.finishReason,
          },
        })
      } catch (e) {
        patch(asstId, { status: 'error', content: String(e?.message || e) })
      } finally {
        setBusy(false)
      }
    },
    [openTurn, patch]
  )

  // ── Agent scenario (hybrid: direct AIRS tool_event + gateway narration) ─────
  const runAgent = useCallback(
    async ({ prompt, tool, params, model, lang = 'he', airsEnabled = true, scenario, attackMeta }) => {
      const { asstId } = openTurn(prompt || `${tool}(${JSON.stringify(params)})`, attackMeta, {
        model, scenario, family: 'agent',
      })
      setBusy(true)
      try {
        const resp = await fetch('/api/moh/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool, params, prompt, model, lang, airsEnabled, scenario }),
        })
        const d = await resp.json()
        patch(asstId, {
          status: d.blocked ? 'blocked' : d.error ? 'error' : d.flagged ? 'flagged' : 'done',
          content: d.blocked ? '' : d.answer || d.error || '',
          metadata: {
            model: d.model, latencyMs: d.latencyMs,
            // The agent turn now passes through the AI-GW guardrail before the
            // tool runs, so it reports gateway scans as well as tool scans —
            // the console renders both, which is what makes it visible whether
            // a block came from the prompt or from the tool.
            inputScan: d.inputScan, outputScan: d.outputScan,
            stage1: d.stage1, stage2: d.stage2, toolResult: d.toolResult,
            tool: d.tool, params: d.params, memory: d.memory,
            hookResults: d.hookResults,
            blockReason: d.blockReason, blockStage: d.blockStage,
            flagged: !!d.flagged, laneMode: d.laneMode, replayed: !!d.replayed,
            traceId: d.traceId,
          },
        })
      } catch (e) {
        patch(asstId, { status: 'error', content: String(e?.message || e) })
      } finally {
        setBusy(false)
      }
    },
    [openTurn, patch]
  )

  /** Route a catalogue scenario to the right transport. */
  const runScenario = useCallback(
    (attack, { model, lang, airsEnabled }) => {
      const common = {
        model, lang, airsEnabled, scenario: attack.id,
        attackMeta: {
          id: attack.id, family: attack.family, severity: attack.severity,
          technique: attack.technique, owasp: attack.owasp, label: attack.label,
          why: attack.why, expect: attack.expect,
        },
      }
      const text = attack.payload?.[lang] ?? attack.payload?.en ?? ''
      if (attack.family === 'rag') return runRag({ ...common, query: text, forceDocIds: attack.docIds })
      if (attack.family === 'agent') return runAgent({ ...common, prompt: text, tool: attack.tool, params: attack.params })
      return send({ ...common, prompt: text, family: attack.family })
    },
    [runRag, runAgent, send]
  )

  return { messages, busy, send, runRag, runAgent, runScenario, clear, abort }
}
