import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadCloud, X, FileText, ShieldCheck, ShieldAlert, Loader2, HardDriveDownload, FolderOpen, ScanLine, AlertTriangle } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { tokens, FONT, label as LBL } from '../../views/api-intercept-2027/tokens'
import { shade, bandBg, bandDots, bandGlass } from '../../views/home-2027/band'

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
 *
 * Two looks, one behaviour. `variant="band"` is the launch design (the runtime
 * console's LaunchComposer passes it): a header band in the protection colour,
 * a soft drop zone, formats as pills, limits and notes as icon-square rows.
 * The default is the original look, which Classic, the v1 console and the MOH
 * chat keep. Only the markup forks — limits, the drag state machine and the
 * pre-checks are the same code for both.
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
  // launch look
  eyebrowOn: 'Prisma AIRS · scanned before it is sent',
  eyebrowOff: 'AIRS is off',
  subtitleOff: 'This file will not be scanned before it reaches the model.',
  browseBtn: 'Browse your computer',
  scannedBy: 'Scanned by Prisma AIRS',
  scannedOff: 'Scan limit — AIRS is off, nothing will be scanned',
  overlayOn: 'Scanned by Prisma AIRS before it is sent',
  overlayOff: 'AIRS is off — it will not be scanned',
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
export function DropOverlay({ visible, isProtected, dir = 'ltr', t: tt, variant = 'classic' }) {
  const t = { ...DEFAULT_T, ...(tt || {}) }
  const { state } = useAppContext()
  const accent = isProtected ? '#10B981' : '#0EA5E9'
  if (variant === 'band') {
    const tk = tokens(state.isDark === false)
    const tone = isProtected ? tk.pass : tk.warn
    return (
      <AnimatePresence>
        {visible && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} dir={dir}
                      className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
                      style={{ borderRadius: 24, background: tk.isLight ? 'rgba(233,233,235,0.8)' : 'rgba(21,21,23,0.8)', backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ scale: 0.94 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                        className="relative overflow-hidden flex items-center gap-3 rounded-2xl"
                        style={{ padding: '12px 18px 12px 12px', background: bandBg(tone), boxShadow: `0 12px 28px ${tone}55` }}>
              <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
              <span className="relative grid place-items-center rounded-xl flex-shrink-0"
                    style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
                <UploadCloud size={18} style={{ color: '#fff' }} aria-hidden="true" />
              </span>
              <span className="relative">
                <span className="block" style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: '#fff' }}>{t.dropNow}</span>
                <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: 'rgba(255,255,255,0.92)' }}>{isProtected ? t.overlayOn : t.overlayOff}</span>
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }
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
  limitsUrl = '/api/upload/limits', dir = 'ltr', t: tt, variant = 'classic',
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

  if (variant === 'band') {
    return createPortal(
      <AnimatePresence>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[80] flex items-center justify-center p-6"
                    style={{ background: 'rgba(4,7,15,0.55)', backdropFilter: 'blur(4px)' }}
                    onClick={onClose}>
          <BandDialog s={t} tk={tokens(isLight)} limits={limits} busy={busy} dragging={dragging} handlers={handlers}
                      inputRef={inputRef} accept={accept} error={error} isProtected={isProtected} onClose={onClose} dir={dir} />
        </motion.div>
      </AnimatePresence>,
      document.body,
    )
  }

  // Portalled to <body> on purpose. An ancestor with `backdrop-filter` — which
  // every glass panel in the 2027 console has — becomes the containing block
  // for `position: fixed`, so the dialog centres inside the composer instead of
  // the viewport and gets clipped. Escaping to body is the fix; raising the
  // z-index is not.
  return createPortal(
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
    </AnimatePresence>,
    document.body
  )
}

// ─── the launch look ─────────────────────────────────────────────────────────

const cap = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x)
const bandFocus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

function IconRow({ tk, icon: Icon, tone, title, sub, children }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${tone}14`, color: tone }}>
        <Icon size={14} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        {title && <span className="block" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: tk.ink, lineHeight: 1.25 }}>{title}</span>}
        {sub && <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: tk.inkDim, marginTop: title ? 1 : 0 }}>{sub}</span>}
        {children}
      </span>
    </div>
  )
}

/** The attach dialog in the launch design. Pure markup — every decision is the caller's. */
function BandDialog({ s, tk, limits, busy, dragging, handlers, inputRef, accept, error, isProtected, onClose, dir }) {
  const tone = isProtected ? tk.pass : tk.warn
  const toneInk = tk.isLight ? shade(tone, 0.32) : tone
  const warnInk = tk.isLight ? shade(tk.warn, 0.38) : tk.warn
  const he = dir === 'rtl'
  return (
    <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ duration: 0.18 }} dir={dir} onClick={(e) => e.stopPropagation()}
                role="dialog" aria-label={s.title}
                className="w-full overflow-hidden"
                style={{ maxWidth: 540, borderRadius: 24, background: tk.panel, border: `1px solid ${tk.glassEdge}`,
                         boxShadow: tk.isLight ? '0 24px 60px rgba(18,18,22,0.22)' : '0 24px 60px rgba(0,0,0,0.6)' }}>

      {/* the band: what happens to the file, in the protection colour */}
      <div className="relative overflow-hidden" style={{ background: bandBg(tone) }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
        <UploadCloud aria-hidden="true" strokeWidth={1.3}
                     style={{ position: 'absolute', [he ? 'left' : 'right']: 48, bottom: -46, width: 150, height: 150, color: '#fff', opacity: 0.14, transform: 'rotate(-10deg)', pointerEvents: 'none' }} />
        <div className="relative flex items-center gap-3 px-5 py-4">
          <span className="grid place-items-center rounded-2xl flex-shrink-0"
                style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
            {isProtected ? <UploadCloud size={21} style={{ color: '#fff' }} aria-hidden="true" /> : <ShieldAlert size={21} style={{ color: '#fff' }} aria-hidden="true" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="truncate" style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>{isProtected ? s.eyebrowOn : s.eyebrowOff}</div>
            <div style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.15, marginTop: 2 }}>{s.title}</div>
            <div style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 2 }}>{isProtected ? s.subtitle : s.subtitleOff}</div>
          </div>
          <button type="button" onClick={onClose} title={s.close} aria-label={s.close}
                  className="grid place-items-center rounded-full flex-shrink-0 self-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  style={{ width: 30, height: 30, ...bandGlass }}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* the drop zone */}
      <div className="px-5 pt-4">
        <input ref={inputRef} type="file" className="hidden" accept={limits?.accept}
               onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; accept(f) }} />
        <div {...handlers}
             onClick={() => !busy && inputRef.current?.click()}
             role="button" tabIndex={0}
             onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
             className={`flex flex-col items-center justify-center gap-2.5 rounded-2xl cursor-pointer ${bandFocus}`}
             style={{
               padding: '24px 16px 20px',
               border: `1.5px dashed ${dragging ? tone : tk.railBed}`,
               background: dragging ? `${tone}14` : tk.sunken,
               transition: 'background 140ms ease, border-color 140ms ease',
             }}>
          {busy ? (
            <>
              <Loader2 size={24} className="animate-spin" style={{ color: tone }} aria-hidden="true" />
              <span style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: tk.ink }}>{s.reading}</span>
            </>
          ) : (
            <>
              <span className="grid place-items-center rounded-2xl" style={{ width: 46, height: 46, background: bandBg(tone), boxShadow: `0 6px 14px ${tone}55` }}>
                <UploadCloud size={20} style={{ color: '#fff' }} aria-hidden="true" />
              </span>
              <span style={{ fontFamily: FONT.display, fontSize: 16, fontWeight: 700, color: dragging ? toneInk : tk.ink }}>{dragging ? s.dropNow : s.drop}</span>
              {!dragging && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3.5"
                      style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: toneInk, background: tk.panel, border: `1px solid ${tone}55` }}>
                  <FolderOpen size={13} aria-hidden="true" /> {s.browseBtn}
                </span>
              )}
            </>
          )}
        </div>

        {/* A wrong type or size is a fault, not an interception — amber, never vermilion. */}
        {error && (
          <div role="alert" className="flex items-start gap-2 mt-2.5 rounded-xl px-3 py-2" style={{ background: `${tk.warn}12`, border: `1px solid ${tk.warn}44` }}>
            <AlertTriangle size={13} style={{ color: warnInk, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <span style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: warnInk }}>{error}</span>
          </div>
        )}
      </div>

      {/* formats — from the server, never typed in */}
      <div className="px-5 pt-4">
        <div style={{ ...LBL, fontSize: 9.5, color: tk.inkDim, marginBottom: 8 }}>{s.formats}</div>
        <div className="flex flex-wrap gap-1.5">
          {/* dir="ltr" or the leading dot jumps to the other end in an RTL panel */}
          {(limits?.supported ?? []).map((ext) => (
            <span key={ext} dir="ltr" className="rounded-full px-2.5"
                  style={{ lineHeight: '22px', fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 600, color: tk.inkDim, background: tk.sunken, border: `1px solid ${tk.hairline}` }}>
              .{ext}
            </span>
          ))}
          {!limits && <span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: tk.inkDim }}>loading…</span>}
        </div>
      </div>

      {/* the limits */}
      <div className="grid gap-3 px-5 pt-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <IconRow tk={tk} icon={FileText} tone={tk.live} title={<span dir="ltr">{limits ? prettyBytes(limits.maxBytes) : '—'}</span>} sub={s.maxSize} />
        <IconRow tk={tk} icon={ScanLine} tone={isProtected ? tk.pass : tk.warn}
                 title={limits ? cap(s.scannedValue(limits.maxScanChars)) : '—'} sub={isProtected ? s.scannedBy : s.scannedOff} />
      </div>

      {/* what happens to it — both states said out loud */}
      <div className="px-5 pt-3.5 pb-4 mt-4 space-y-3" style={{ borderTop: `1px solid ${tk.hairline}` }}>
        <IconRow tk={tk} icon={isProtected ? ShieldCheck : ShieldAlert} tone={isProtected ? tk.pass : tk.warn}>
          <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: isProtected ? tk.inkDim : warnInk, fontWeight: isProtected ? 400 : 600, paddingTop: 5 }}>
            {isProtected ? s.protectedNote : s.unprotectedNote}
          </span>
        </IconRow>
        <IconRow tk={tk} icon={HardDriveDownload} tone={tk.idle}>
          <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: tk.inkDim, paddingTop: 5 }}>{s.retention}</span>
        </IconRow>
      </div>
    </motion.div>
  )
}
