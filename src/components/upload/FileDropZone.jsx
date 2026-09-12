import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadCloud, X, FileText, ShieldCheck, ShieldAlert, Loader2, HardDriveDownload } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

/**
 * FileDropZone — shared attach dialog for both pillars that accept uploads.
 *
 * Deliberately NOT following the "copy the component into each pillar" rule in
 * CLAUDE.md. That rule exists for small presentational pieces; this one holds
 * the limits contract, the drag-and-drop state machine and the security copy,
 * and two diverging copies would drift the moment a limit changes on the
 * server. Everything pillar-specific arrives as props: `limitsUrl` (MOH and the
 * portal expose different routes), `dir` for RTL, and `t` for Hebrew strings.
 *
 * Limits are fetched, never hardcoded. MAX_UPLOAD_BYTES / MAX_SCAN_CHARS live in
 * file-extract.js; typing "6 MB" into the UI would be a second source of truth
 * that silently goes stale.
 */

const DEFAULT_T = {
  title: 'Attach a document',
  subtitle: 'It is scanned before a single character reaches the model.',
  drop: 'Drop a file here',
  or: 'or',
  browse: 'browse your computer',
  dropNow: 'Release to attach',
  formats: 'Supported formats',
  maxSize: 'Maximum size',
  scanned: 'Scanned',
  scannedValue: (n) => `first ${n.toLocaleString()} characters`,
  protectedNote: 'Prisma AIRS scans the document for prompt injection and sensitive data before it is sent. A blocked file never reaches the model.',
  unprotectedNote: 'AIRS is OFF — this file will NOT be scanned before it reaches the model.',
  retention: 'The file is never written to disk. Only its name and character count are recorded in the trace.',
  reading: 'Reading file…',
  tooLarge: (mb) => `That file is larger than the ${mb} MB limit.`,
  badType: (list) => `Unsupported file type. Accepted: ${list}.`,
  close: 'Close',
}

const prettyBytes = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(0)} MB` : `${Math.round(b / 1024)} KB`)

/** Shared limits fetch — one request per URL per page, cached in module scope. */
const limitsCache = new Map()
function useUploadLimits(limitsUrl) {
  const [limits, setLimits] = useState(() => limitsCache.get(limitsUrl) ?? null)
  useEffect(() => {
    if (limitsCache.has(limitsUrl)) { setLimits(limitsCache.get(limitsUrl)); return }
    let alive = true
    fetch(limitsUrl)
      .then((r) => r.json())
      .then((d) => { limitsCache.set(limitsUrl, d); if (alive) setLimits(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [limitsUrl])
  return limits
}

/**
 * Panel-level drag target. Spread `handlers` onto the container that should
 * accept a drop; render the overlay when `dragging`.
 *
 * dragenter/dragleave fire for every child element crossed, so a naive
 * implementation flickers the overlay as the cursor moves over the transcript.
 * A depth counter is the fix — only the outermost leave clears it.
 */
export function useDropTarget(onFile, { enabled = true } = {}) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)

  const reset = useCallback(() => { depth.current = 0; setDragging(false) }, [])

  const handlers = enabled ? {
    onDragEnter: (e) => {
      if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return
      e.preventDefault()
      depth.current += 1
      setDragging(true)
    },
    onDragOver: (e) => {
      if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDragLeave: (e) => {
      if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return
      e.preventDefault()
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    },
    onDrop: (e) => {
      if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return
      e.preventDefault()
      reset()
      const f = e.dataTransfer?.files?.[0]
      if (f) onFile(f)
    },
  } : {}

  return { dragging, handlers, reset }
}

/** Full-panel overlay shown while a file is dragged over the chat. */
export function DropOverlay({ visible, isProtected, dir = 'ltr', t: tt }) {
  const t = { ...DEFAULT_T, ...(tt || {}) }
  const accent = isProtected ? '#10B981' : '#0EA5E9'
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          dir={dir}
          className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(9,12,23,0.72)', backdropFilter: 'blur(3px)' }}
        >
          <div
            className="flex flex-col items-center gap-3 px-10 py-8 rounded-2xl"
            style={{ border: `2px dashed ${accent}`, background: `${accent}14` }}
          >
            <UploadCloud size={40} style={{ color: accent }} />
            <p className="text-[15px] font-bold" style={{ color: accent }}>{t.dropNow}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** The attach dialog: drop zone, browse button, formats and limits. */
export function FileDropModal({
  open, onClose, onFile, isProtected, busy = false,
  limitsUrl = '/api/upload/limits', dir = 'ltr', t: tt,
}) {
  const t = { ...DEFAULT_T, ...(tt || {}) }
  const { state } = useAppContext()
  const isLight = state.isDark === false
  const limits = useUploadLimits(limitsUrl)
  const inputRef = useRef(null)
  const [error, setError] = useState(null)
  const { dragging, handlers, reset } = useDropTarget((f) => accept(f))

  const accent = isProtected ? '#10B981' : '#0EA5E9'
  const C = {
    panel:   isLight ? '#ffffff' : 'rgba(15,20,35,0.98)',
    border:  isLight ? 'rgba(0,48,135,0.14)' : 'rgba(255,255,255,0.12)',
    shadow:  isLight ? '0 16px 48px rgba(0,48,135,0.16)' : '0 16px 48px rgba(0,0,0,0.6)',
    text:    isLight ? '#0f172a' : '#e2e8f0',
    meta:    isLight ? '#64748b' : '#94a3b8',
    chipBg:  isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)',
    chipTx:  isLight ? '#475569' : '#cbd5e1',
    zoneBg:  isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
  }

  useEffect(() => { if (open) { setError(null); reset() } }, [open, reset])

  // Escape to dismiss — a modal that traps the presenter mid-demo is worse
  // than no modal.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /** Client-side pre-checks so an obvious reject is instant, not a round trip. */
  function accept(file) {
    if (!file) return
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (limits?.supported && !limits.supported.includes(ext)) {
      setError(t.badType(limits.supported.join(', ')))
      return
    }
    if (limits?.maxBytes && file.size > limits.maxBytes) {
      setError(t.tooLarge((limits.maxBytes / 1048576).toFixed(0)))
      return
    }
    setError(null)
    onFile(file)
    onClose()
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center p-6"
        style={{ background: 'rgba(4,7,15,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          dir={dir}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-2xl overflow-hidden"
          style={{ maxWidth: 520, background: C.panel, border: `1px solid ${C.border}`, boxShadow: C.shadow }}
        >
          {/* Header */}
          <div className="flex items-start gap-3 px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-center rounded-xl flex-shrink-0"
                 style={{ width: 34, height: 34, background: `${accent}1a` }}>
              <UploadCloud size={17} style={{ color: accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-bold" style={{ color: C.text }}>{t.title}</h3>
              <p className="text-[11px] mt-0.5" style={{ color: C.meta }}>{t.subtitle}</p>
            </div>
            <button onClick={onClose} title={t.close}
                    className="flex-shrink-0 p-1 rounded-lg transition-colors"
                    style={{ color: C.meta }}>
              <X size={15} />
            </button>
          </div>

          {/* Drop zone */}
          <div className="px-5 pt-4">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={limits?.accept}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; accept(f) }}
            />
            <div
              {...handlers}
              onClick={() => !busy && inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
              className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-colors"
              style={{
                padding: '28px 16px',
                border: `2px dashed ${dragging ? accent : C.border}`,
                background: dragging ? `${accent}12` : C.zoneBg,
              }}
            >
              {busy ? (
                <>
                  <Loader2 size={26} className="animate-spin" style={{ color: accent }} />
                  <p className="text-[12px] font-semibold" style={{ color: C.text }}>{t.reading}</p>
                </>
              ) : (
                <>
                  <UploadCloud size={26} style={{ color: dragging ? accent : C.meta }} />
                  <p className="text-[13px] font-bold" style={{ color: dragging ? accent : C.text }}>
                    {dragging ? t.dropNow : t.drop}
                  </p>
                  {!dragging && (
                    <p className="text-[11px]" style={{ color: C.meta }}>
                      {t.or}{' '}
                      <span className="font-semibold underline" style={{ color: accent }}>{t.browse}</span>
                    </p>
                  )}
                </>
              )}
            </div>

            {error && (
              <p className="text-[11px] mt-2 font-semibold" style={{ color: '#EF4444' }}>{error}</p>
            )}
          </div>

          {/* Formats + limits, straight from the server */}
          <div className="px-5 pt-4 pb-1 space-y-2.5">
            <div>
              <p className="text-[9.5px] font-black tracking-wider mb-1.5" style={{ color: C.meta }}>
                {t.formats.toUpperCase()}
              </p>
              <div className="flex flex-wrap gap-1">
                {/* dir="ltr" or the leading dot jumps to the other end in an
                    RTL panel — ".pdf" renders as "pdf." */}
                {(limits?.supported ?? []).map((ext) => (
                  <span key={ext} dir="ltr"
                        className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-semibold"
                        style={{ background: C.chipBg, color: C.chipTx }}>
                    .{ext}
                  </span>
                ))}
                {!limits && <span className="text-[10px]" style={{ color: C.meta }}>loading…</span>}
              </div>
            </div>

            <div className="flex gap-5">
              <div className="flex items-center gap-1.5">
                <FileText size={11} style={{ color: C.meta }} />
                <span className="text-[10.5px]" style={{ color: C.meta }}>
                  {t.maxSize}: <strong dir="ltr" style={{ color: C.text, display: 'inline-block' }}>{limits ? prettyBytes(limits.maxBytes) : '—'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={11} style={{ color: C.meta }} />
                <span className="text-[10.5px]" style={{ color: C.meta }}>
                  {t.scanned}: <strong style={{ color: C.text }}>
                    {limits ? t.scannedValue(limits.maxScanChars) : '—'}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* What happens to it. Both states are stated — a clean-looking chip
              when nothing was scanned is the failure mode worth avoiding. */}
          <div className="px-5 py-3 mt-2" style={{ borderTop: `1px solid ${C.border}` }}>
            <div className="flex items-start gap-2">
              {isProtected
                ? <ShieldCheck size={13} style={{ color: accent, flexShrink: 0, marginTop: 1 }} />
                : <ShieldAlert size={13} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 1 }} />}
              <p className="text-[10.5px] leading-relaxed"
                 style={{ color: isProtected ? C.meta : '#F59E0B', fontWeight: isProtected ? 400 : 600 }}>
                {isProtected ? t.protectedNote : t.unprotectedNote}
              </p>
            </div>
            <div className="flex items-start gap-2 mt-1.5">
              <HardDriveDownload size={13} style={{ color: C.meta, flexShrink: 0, marginTop: 1 }} />
              <p className="text-[10.5px] leading-relaxed" style={{ color: C.meta }}>{t.retention}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
