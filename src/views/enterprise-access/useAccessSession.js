import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * useAccessSession — the Enterprise AI Access pillar's state: the pre-flight
 * configuration, the signed-in session (identity, credential, the captured
 * lifecycle, every call), and the actions on it.
 *
 * The session itself lives server side behind an HttpOnly cookie; this hook
 * only mirrors it. Sign-in is a top-level navigation to /api/access/login, so
 * the browser leaves the portal for Microsoft and comes back with the session
 * already built — the hook just reads it on mount.
 */

async function json(url, opts) {
  const r = await fetch(url, opts)
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
  return body
}

const post = (url, body) => json(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })

export function useAccessSession() {
  const [config, setConfig] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [pending, setPending] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const alive = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [c, s] = await Promise.all([json('/api/access/config'), json('/api/access/session')])
      if (!alive.current) return
      setConfig(c)
      setSession(s)
      const last = s.calls?.[s.calls.length - 1]
      if (last) setSelectedId(last.id)
    } catch (err) {
      if (alive.current) setLoadError(err.message)
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    load()
    return () => { alive.current = false }
  }, [load])

  const append = useCallback((call) => {
    setSession((s) => ({ ...s, calls: [...(s?.calls ?? []), call] }))
    setSelectedId(call.id)
  }, [])

  const run = useCallback(async (placeholder, url, body) => {
    setPending(placeholder)
    setSelectedId(null)
    try {
      const { call } = await post(url, body)
      append(call)
    } catch (err) {
      // Not signed in any more (the server restarted, or the session aged out).
      if (/not signed in/i.test(err.message)) { await load(); return }
      append({ ...placeholder, id: `local-${Date.now()}`, pending: false, ok: false, error: err.message, status: 0 })
    } finally {
      setPending(null)
    }
  }, [append, load])

  const send = useCallback((prompt, { modelId, system, contextWindow, requestedLabel }) => run(
    { kind: 'chat', pending: true, at: Date.now(), prompt, requested: { id: modelId, label: requestedLabel } },
    '/api/access/chat', { prompt, modelId, system, contextWindow },
  ), [run])

  const tamper = useCallback((kind, meta) => run(
    { kind: 'tamper', pending: true, at: Date.now(), prompt: 'Reply with one word: ok', tamper: { kind, ...meta } },
    '/api/access/tamper', { kind },
  ), [run])

  const clear = useCallback(async () => {
    try {
      setSession(await post('/api/access/clear'))
      setSelectedId(null)
    } catch {
      // The server no longer knows this session (restart, or it aged out) — show what it does know.
      await load()
    }
  }, [load])

  // Start the sign-in on the host Entra will send the browser back to. /login
  // sets the cookie that binds the sign-in to this browser; opened from another
  // host (EC2's bare IP instead of its domain) that cookie would not come back
  // with the callback, and the sign-in would be refused as a different browser.
  const signIn = useCallback(() => {
    let target = '/api/access/login'
    try {
      const back = new URL(config?.entra?.redirectUri)
      if (back.origin !== window.location.origin) target = `${back.origin}/api/access/login`
    } catch { /* no absolute redirect URI — stay on this host */ }
    window.location.assign(target)
  }, [config])

  const signOut = useCallback(async () => {
    try { await post('/api/access/logout') } catch { /* the cookie is cleared either way */ }
    setSession({ signedIn: false })
    setSelectedId(null)
    load()
  }, [load])

  const calls = session?.calls ?? []
  const selected = calls.find((c) => c.id === selectedId) ?? null

  return {
    config, session, loading, loadError, reload: load,
    calls, pending, selected, select: setSelectedId,
    send, tamper, clear, signIn, signOut,
  }
}
