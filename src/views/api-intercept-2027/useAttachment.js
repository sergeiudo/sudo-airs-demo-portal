import { useCallback, useState } from 'react'

/**
 * useAttachment — the composer's upload behaviour, shared by both runtime
 * consoles' composers so the correctness properties cannot drift:
 *
 *   • the file is scanned before it can become context (/api/upload/scan);
 *   • a blocked file is never sent — `doc` is null for it;
 *   • send is held while a scan is in flight (`pending`);
 *   • the scan is pushed to the evidence pane (`onScan`), so a blocked upload
 *     is as inspectable as a blocked prompt.
 */
export function useAttachment({ isProtected, onScan }) {
  const [attachment, setAttachment] = useState(null)
  const [busy, setBusy] = useState(false)

  const uploadFile = useCallback(async (file) => {
    setBusy(true)
    setAttachment({ name: file.name, status: 'scanning' })
    try {
      const b64 = await new Promise((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(String(fr.result).split(',')[1])
        fr.onerror = rej
        fr.readAsDataURL(file)
      })
      const r = await fetch('/api/upload/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, dataBase64: b64, airsEnabled: isProtected }),
      })
      const d = await r.json()
      setAttachment({ ...d, status: d.error ? 'error' : d.blocked ? 'blocked' : d.airsEnabled === false ? 'unscanned' : 'clean' })
      onScan?.(d)
    } catch (e) {
      setAttachment({ name: file.name, status: 'error', error: String(e?.message || e).slice(0, 120) })
    } finally {
      setBusy(false)
    }
  // onScan is a state setter from the shell — stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProtected])

  const pending = busy || attachment?.status === 'scanning'
  const doc = (attachment?.status === 'clean' || attachment?.status === 'unscanned') && attachment.text
    ? {
        name: attachment.name, text: attachment.text, kind: attachment.kind,
        pages: attachment.pages, chars: attachment.chars,
        scanned: attachment.status === 'clean', scanId: attachment.scanId ?? null,
      }
    : null
  const clear = useCallback(() => setAttachment(null), [])

  return { attachment, busy, pending, doc, uploadFile, clear }
}
