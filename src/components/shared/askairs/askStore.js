import { useEffect, useState } from 'react'

/**
 * The one Ask AIRS state, shared by the drawer on every pillar and the
 * Developer Corner's full view: whether the drawer is open, the conversation
 * and the docs index status. A module store with listeners, so every surface
 * shows the same thread.
 *
 * Nothing is kept: the conversation lives in this tab's memory only — it
 * follows you from pillar to pillar and is gone on reload. It is a shared demo
 * portal; one presenter's questions must not greet the next. (The server keeps
 * nothing either: no database, no file, no log of questions.)
 */

// Earlier builds saved the last 20 questions in localStorage — remove them.
try { localStorage.removeItem('sudo-airs.ask'); localStorage.removeItem('sudo-airs.dev.ask') } catch { /* private mode */ }

let state = { open: false, items: [], selected: null, status: null }
const listeners = new Set()
const set = (patch) => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; listeners.forEach((l) => l(state)) }

let polling = null
async function pollStatus() {
  if (polling) return
  polling = true
  try {
    for (;;) {
      const s = await fetch('/api/assist/status').then((r) => r.json()).catch(() => null)
      set({ status: s })
      if (s?.state === 'ready') break
      await new Promise((r) => setTimeout(r, s ? 3000 : 15000))
    }
  } finally { polling = null }
}

export function openAskAirs() { set({ open: true }); pollStatus() }

// "Full view": the Developer Corner may not be mounted yet when it is asked
// for, so the request waits in a flag it reads on mount (and an event if it is).
let wantView = false
export function requestAskView() { wantView = true; window.dispatchEvent(new CustomEvent('sudo-airs:open-ask')) }
// Read without clearing (StrictMode runs state initializers twice); clear after mount.
export function peekAskView() { return wantView }
export function takeAskView() { const w = wantView; wantView = false; return w }
export function closeAskAirs() { set({ open: false }) }

/**
 * Ask one question. The server streams server-sent events while Claude
 * researches (assist-agent.js): each research step, the sources so far, then
 * the answer — the item updates live as they arrive.
 */
export async function askAirs(question) {
  const q = String(question || '').trim()
  if (!q) return
  const id = `${Date.now()}`
  set((s) => ({ items: [{ id, question: q, pending: true, steps: [], sources: [], at: new Date().toISOString() }, ...s.items], selected: id }))
  const update = (patch) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...(typeof patch === 'function' ? patch(i) : patch) } : i)) }))
  try {
    const r = await fetch('/api/assist/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) })
    if (!r.ok || !r.body || !String(r.headers.get('content-type')).includes('text/event-stream')) {
      const j = await r.json().catch(() => ({}))
      if (j.status) set({ status: j.status })
      update({ pending: false, verdict: 'error', error: j.error || `HTTP ${r.status}` })
      return
    }
    const reader = r.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let k
      while ((k = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, k).split('\n').find((l) => l.startsWith('data: '))
        buf = buf.slice(k + 2)
        if (!line) continue
        const e = JSON.parse(line.slice(6))
        if (e.type === 'status') set({ status: e.status })
        else if (e.type === 'step') update((i) => ({ steps: [...(i.steps ?? []), { kind: e.kind, label: e.label, product: e.product ?? null }] }))
        else if (e.type === 'sources') update({ sources: e.sources })
        else if (e.type === 'answer') update({ answer: e.text, model: e.model, usage: e.usage, elapsedMs: e.elapsedMs, calls: e.calls, verdict: 'answered', pending: false })
        else if (e.type === 'error') update({ error: e.error, verdict: 'error', pending: false })
      }
    }
    update((i) => (i.pending ? { pending: false, verdict: i.answer ? 'answered' : 'error', error: i.error ?? (i.answer ? null : 'The answer stream ended early.') } : {}))
  } catch (e) {
    update({ pending: false, verdict: 'error', error: e.message })
  }
}

export function removeAsk(id) { set((s) => ({ items: s.items.filter((i) => i.id !== id) })) }
export function clearAsks() { set({ items: [], selected: null }) }
export function selectAsk(id) { set({ selected: id }) }

export function useAskStore() {
  const [snap, setSnap] = useState(state)
  useEffect(() => { listeners.add(setSnap); if (!state.status) pollStatus(); return () => listeners.delete(setSnap) }, [])
  const current = snap.items.find((i) => i.id === snap.selected) ?? snap.items[0] ?? null
  return { ...snap, current, pending: snap.items.some((i) => i.pending) }
}

export const indexLine = (s) => {
  if (!s) return 'Checking the docs index…'
  if (s.state === 'building') {
    const busy = (s.collections ?? []).filter((c) => c.progress)
    return busy.length ? `Indexing the docs — ${busy.map((c) => `${c.label} ${c.progress.done}/${c.progress.total}`).join(' · ')}` : 'Indexing the docs…'
  }
  if (s.state !== 'ready') return 'Docs index unavailable'
  return `${s.pages.toLocaleString()} pages · ${s.passages.toLocaleString()} passages`
}
