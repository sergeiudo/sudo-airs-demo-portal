import { useCallback, useRef, useState } from 'react'

// Parses an SSE stream produced by /api/gateway/chat.
// Returns: { messages, send, abort, streaming, clear }
export function usePortkeyChat() {
  const [messages, setMessages] = useState([])
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef(null)

  const send = useCallback(async ({ model, configId, prompt, cacheEnabled, system }) => {
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: prompt, status: 'done' }
    const asstId = `a-${Date.now()}`
    const asstMsg = {
      id: asstId, role: 'assistant', content: '',
      status: 'streaming',
      metadata: { model, configId, cache: cacheEnabled ? 'MISS' : 'disabled', latencyMs: null, tokens: 0, fallbackUsed: false, hookResults: null, traceId: null },
    }
    setMessages(prev => [...prev, userMsg, asstMsg])
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    const payloadMessages = []
    if (system) payloadMessages.push({ role: 'system', content: system })
    payloadMessages.push({ role: 'user', content: prompt })

    let buf = ''

    function patchAsst(patch) {
      setMessages(prev => prev.map(m => m.id === asstId ? { ...m, ...patch, metadata: { ...m.metadata, ...(patch.metadata || {}) } } : m))
    }

    try {
      const resp = await fetch('/api/gateway/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, configId, messages: payloadMessages, cacheEnabled }),
        signal: controller.signal,
      })
      if (!resp.ok || !resp.body) {
        const err = await resp.text().catch(() => resp.statusText)
        patchAsst({ status: 'error', content: `Error ${resp.status}: ${err}` })
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
          } else if (line.startsWith('data:')) {
            const data = line.slice(5).trim()
            if (!data) continue
            let parsed
            try { parsed = JSON.parse(data) } catch { parsed = null }
            if (!parsed) continue
            if (currentEvent === 'metadata') {
              // Normalize Portkey's snake_case hook_results -> camelCase for frontend consumers
              const { hook_results, tokensOut, ...rest } = parsed
              patchAsst({ status: 'done', metadata: { ...rest, hookResults: hook_results || null, tokens: tokensOut ?? rest.tokens ?? 0 } })
              currentEvent = null
            } else if (currentEvent === 'blocked') {
              patchAsst({ status: 'blocked', content: 'Blocked by guardrail', metadata: { hookResults: parsed.hook_results, blockReason: parsed.reason } })
              currentEvent = null
            } else if (currentEvent === 'error') {
              patchAsst({ status: 'error', content: parsed.message || 'Stream error' })
              currentEvent = null
            } else if (parsed.type === 'token') {
              setMessages(prev => prev.map(m => m.id === asstId ? { ...m, content: m.content + parsed.text } : m))
            }
          } else if (line.trim() === '') {
            currentEvent = null
          }
        }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        patchAsst({ status: 'error', content: String(e?.message || e) })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clear = useCallback(() => setMessages([]), [])

  return { messages, send, abort, streaming, clear }
}
