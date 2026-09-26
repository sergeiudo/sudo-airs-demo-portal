import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { useScannerHealth, scmScanUrl, recordFromScm, scanDisplayName } from './scanModel'

/**
 * useScanSession — the AI Supply Chain console's session logic, without its
 * look.
 *
 * Shared by the two New-design consoles for the pillar (ModelScanning2027, now
 * at /?scan=v1, and the launch-design SupplyChainLaunch) so they cannot drift:
 * firing a scan, library picks, rescans, opening a scan from the SCM history,
 * the selected record, the SCM deep link, and dropping a file on the centre
 * column. Every data path is the existing one — POST /scan-model (the Python
 * scanner) and /api/supply-chain/* (Express).
 */

/**
 * The session outlives the view. The old pillar kept its history in component
 * state, so a trip to Home and back threw every scan away mid-demo. Module
 * scope rather than storage: a page refresh still starts clean, and a scan
 * that finishes while the view is unmounted still lands in the record.
 */
let SESSION = []

export function useScanSession() {
  const { dispatch } = useAppContext()
  const health = useScannerHealth()
  const ready = health.state === 'live'

  const [records, setRecords] = useState(SESSION)
  const [selectedId, setSelectedId] = useState(null)
  const [mode, setMode] = useState('huggingface')
  const [uri, setUri] = useState('')
  const [file, setFile] = useState(null)
  const [railTab, setRailTab] = useState('library')
  const [tsg, setTsg] = useState(null)
  const [openingId, setOpeningId] = useState(null)

  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const commit = useCallback((fn) => {
    SESSION = fn(SESSION)
    if (mounted.current) setRecords(SESSION)
  }, [])

  const busy = records.some((r) => r.status === 'scanning')

  const run = useCallback(async ({ source, uri: target, file: f, preset = null }) => {
    const id = `scan-${Date.now()}`
    commit((rs) => [...rs, {
      id, source, preset, target: source === 'huggingface' ? target : f.name,
      size: f?.size ?? null, startedAt: Date.now(), status: 'scanning',
    }])
    setSelectedId(null)

    const fd = new FormData()
    fd.append('source_type', source)
    if (source === 'huggingface') fd.append('hf_model_uri', target)
    else fd.append('file', f)

    let patch
    try {
      const res = await fetch('/scan-model', { method: 'POST', body: fd })
      const text = await res.text()
      let json = null
      try { json = JSON.parse(text) } catch { /* an HTML error page from a proxy */ }
      if (res.ok && json) {
        patch = { status: 'done', result: json }
      } else {
        const d = json?.detail
        const message = typeof d === 'string' ? d
          : d ? JSON.stringify(d)
          : text && !text.trim().startsWith('<') ? text.slice(0, 300)
          : res.statusText || 'No response from the scanner'
        patch = { status: 'error', error: { status: res.status, message } }
      }
    } catch (e) {
      patch = { status: 'error', error: { status: 0, message: e.message } }
    }
    commit((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    if (source === 'local') setFile(null)
  }, [commit])

  const pick = useCallback((item) => {
    setMode('huggingface')
    setUri(item.uri)
    run({ source: 'huggingface', uri: item.uri, preset: item.id })
  }, [run])

  const rescan = useCallback((rec) => {
    run({ source: 'huggingface', uri: rec.target, preset: rec.preset })
  }, [run])

  /**
   * Open a scan from the SCM history as a record. Already on screen → just
   * select it (a scan fired here and then clicked in the history is the same
   * scan, not two). Otherwise pull the scan and its violations and append it.
   */
  const openScm = useCallback(async (scan) => {
    const existing = SESSION.find((r) => r.result?.uuid === scan.uuid)
    if (existing) { setSelectedId(existing.id); return }
    setOpeningId(scan.uuid)
    try {
      const r = await fetch(`/api/supply-chain/scans/${scan.uuid}`)
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw Object.assign(new Error(d.error || `HTTP ${r.status}`), { status: r.status })
      const rec = recordFromScm(d)
      commit((rs) => [...rs.filter((x) => x.id !== rec.id), rec])
      setSelectedId(rec.id)
    } catch (e) {
      const id = `scm-err-${scan.uuid}-${Date.now()}`
      commit((rs) => [...rs, {
        id, source: scan.source_type === 'HUGGING_FACE' ? 'huggingface' : 'local', target: scanDisplayName(scan),
        startedAt: Date.now(), status: 'error', fromScm: true,
        error: { status: e.status ?? 0, message: `Could not load this scan from SCM: ${e.message}` },
      }])
      setSelectedId(id)
    } finally {
      setOpeningId(null)
    }
  }, [commit])

  // A scan fired here lands in the tenant too; refresh the history when one
  // finishes so the list never lags the console.
  const finished = records.filter((r) => !r.fromScm && r.status !== 'scanning').length

  const clear = useCallback(() => { commit(() => []); setSelectedId(null) }, [commit])

  // The rail follows the newest scan unless the operator pins an older one.
  const selected = useMemo(
    () => records.find((r) => r.id === selectedId) ?? records[records.length - 1] ?? null,
    [records, selectedId]
  )

  // The SCM Console link follows the selected scan, and is cleared on the way
  // out so the runtime pillar never inherits a model-scan link.
  const scm = scmScanUrl(selected?.result)
  useEffect(() => { dispatch({ type: 'SET_SCM_URL', payload: scm }) }, [scm, dispatch])
  useEffect(() => () => dispatch({ type: 'SET_SCM_URL', payload: null }), [dispatch])

  // Drop a model file anywhere on the centre column. Counted by depth because
  // dragenter/dragleave fire per child element and a naive flag flickers.
  const [dropDepth, setDropDepth] = useState(0)
  const dropHandlers = {
    onDragEnter: (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDropDepth((d) => d + 1) } },
    onDragOver: (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault() },
    onDragLeave: () => setDropDepth((d) => Math.max(0, d - 1)),
    onDrop: (e) => {
      e.preventDefault()
      setDropDepth(0)
      const f = e.dataTransfer?.files?.[0]
      if (f && !busy) { setMode('local'); setFile(f) }
    },
  }

  const lastGroup = [...records].reverse().find((r) => r.source === mode && r.result?.security_group_name)?.result.security_group_name

  return {
    health, ready, records, selected, selectedId, setSelectedId,
    mode, setMode, uri, setUri, file, setFile,
    railTab, setRailTab, tsg, setTsg, openingId,
    busy, run, pick, rescan, openScm, finished, clear,
    dropDepth, dropHandlers, lastGroup,
  }
}
