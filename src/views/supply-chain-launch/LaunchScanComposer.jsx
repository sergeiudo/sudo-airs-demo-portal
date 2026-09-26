import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link2, Upload, X, ScanSearch, Loader2, FileBox, Paperclip } from 'lucide-react'
import { FONT, glass } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { normalizeHfUri, fmtBytes } from '../model-scanning-2027/scanModel'

/**
 * LaunchScanComposer — the scan control, in the launch design: the runtime
 * console's chat composer, for models.
 *
 * Behaviour is ScanComposer's (the v1 console keeps it): a source toggle, one
 * input that takes whatever a presenter pastes — `org/model`, a huggingface.co
 * URL, a link into a file or branch — and shows the repo id it will actually
 * send, so a typo is visible before the scan rather than after a 400. Local
 * files come from the picker or a drop anywhere on the centre column.
 */

// The scanner reads Keras, TF, GGUF and joblib too; `accept` only filters the picker.
const ACCEPT = '.zip,.pkl,.pickle,.bin,.pt,.pth,.ckpt,.safetensors,.onnx,.h5,.keras,.pb,.gguf,.joblib,.npy,.npz,.msgpack,.tflite'

const SOURCES = [
  { id: 'huggingface', label: 'Hugging Face', icon: Link2, hint: 'AIRS reads the repo by URI — nothing is downloaded here' },
  { id: 'local',       label: 'Local file',   icon: Upload, hint: 'Scanned on this host — only file hashes and findings leave it' },
]
const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

export function LaunchScanComposer({ t, tone, mode, onMode, uri, onUri, file, onFile, onScan, busy, ready, lastGroup }) {
  const [focus, setFocus] = useState(false)
  const [hotScan, setHotScan] = useState(false)
  const fileRef = useRef(null)
  const hf = normalizeHfUri(uri)
  const isHf = mode === 'huggingface'
  const canScan = ready && !busy && (isHf ? hf.ok : !!file)
  const source = SOURCES.find((s) => s.id === mode) ?? SOURCES[0]

  const submit = (e) => {
    e?.preventDefault()
    if (!canScan) return
    onScan(isHf ? { source: 'huggingface', uri: hf.id } : { source: 'local', file })
  }

  // What the line under the box says: a problem first, then what will happen.
  const helper = !ready
    ? { text: 'Scanner unavailable — the library panel says why', tone: t.warn }
    : isHf && uri && !hf.ok && hf.error ? { text: hf.error, tone: t.warn }
    : isHf && hf.ok && hf.id !== uri.trim() ? { text: `will scan · ${hf.id}`, tone: t.inkDim, mono: true }
    : { text: isHf ? 'Enter to scan' : 'The file is deleted from this host when the scan returns', tone: t.inkDim }

  return (
    <div className="relative flex-shrink-0 mx-3 mb-3 mt-2">
      {/* ── source ── */}
      <div className="flex items-center gap-2 pb-2.5 px-1 flex-wrap">
        {SOURCES.map((s) => {
          const on = mode === s.id
          return (
            <button key={s.id} type="button" onClick={() => onMode(s.id)} aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 ${focusCls}`}
                    style={{
                      height: 30, fontFamily: FONT.prose, fontSize: 12, fontWeight: on ? 700 : 500,
                      color: on ? '#fff' : t.inkDim, background: on ? bandBg(tone) : t.panel,
                      border: `1px solid ${on ? 'transparent' : t.hairline}`,
                      boxShadow: on ? `0 4px 12px ${tone}40` : t.shadowSm,
                    }}>
              <s.icon size={13} aria-hidden="true" /> {s.label}
            </button>
          )
        })}
        <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, minWidth: 0 }}>{source.hint}</span>
      </div>

      {/* ── the box ── */}
      <form onSubmit={submit}
            style={{
              ...glass(t, { radius: 24 }),
              border: `1px solid ${focus ? `${tone}66` : t.glassEdge}`,
              boxShadow: focus ? `0 0 0 4px ${tone}1a, ${t.shadow}` : t.shadow,
              transition: 'border-color 160ms ease, box-shadow 200ms ease',
            }}>
        <div className="flex items-center gap-2 p-1.5">
          {isHf ? (
            <>
              <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
                    style={{ width: 38, height: 38, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
                <Link2 size={16} />
              </span>
              <input key="hf-uri"
                     ref={(el) => el?.style.setProperty('background-color', 'transparent', 'important')}
                     value={uri} onChange={(e) => onUri(e.target.value)}
                     onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
                     placeholder="org/model-name — or paste a huggingface.co link"
                     aria-label="Hugging Face model" spellCheck={false} dir="ltr"
                     className="flex-1 min-w-0 outline-none"
                     style={{ padding: '8px 4px', border: 'none', fontFamily: FONT.mono, fontSize: 13.5, color: t.ink }} />
            </>
          ) : (
            <>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                      aria-label="Choose a model file" title="Choose a model file — or drop one anywhere on this panel"
                      className={`grid place-items-center rounded-full flex-shrink-0 disabled:opacity-40 ${focusCls}`}
                      style={{ width: 38, height: 38, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = t.ink }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = t.inkDim }}>
                <Paperclip size={16} aria-hidden="true" />
              </button>
              <input key="local-file" ref={fileRef} type="file" className="hidden" accept={ACCEPT}
                     onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
              {file ? (
                <span className="flex-1 min-w-0 flex items-center gap-2.5 rounded-2xl px-2.5 py-1.5"
                      style={{ background: t.sunken, border: `1px solid ${t.live}33` }}>
                  <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 26, height: 26, background: `${t.live}17`, color: t.live }}>
                    <FileBox size={13} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{file.name}</span>
                    <span className="block" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim }}>{fmtBytes(file.size)} · ready to scan</span>
                  </span>
                  <button type="button" onClick={() => onFile(null)} title="Remove" aria-label="Remove the file" style={{ color: t.inkDim }}>
                    <X size={13} />
                  </button>
                </span>
              ) : (
                <span className="flex-1 min-w-0 truncate" style={{ padding: '8px 4px', fontFamily: FONT.prose, fontSize: 13.5, color: t.inkDim }}>
                  Drop a model file anywhere here — .pkl, .pt, .h5, .safetensors, .onnx, .gguf…
                </span>
              )}
            </>
          )}

          <motion.button type="submit" disabled={!canScan}
                         onMouseEnter={() => setHotScan(true)} onMouseLeave={() => setHotScan(false)}
                         whileTap={canScan ? { scale: 0.96 } : {}}
                         title={!ready ? 'Scanner unavailable' : busy ? 'A scan is already running' : 'Scan this model (Enter)'}
                         className={`inline-flex items-center gap-2 rounded-full px-5 flex-shrink-0 ${focusCls}`}
                         style={{
                           height: 38, fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, letterSpacing: '0.01em',
                           color: canScan ? '#fff' : t.inkDim,
                           background: canScan ? bandBg(tone) : t.sunken,
                           border: `1px solid ${canScan ? 'transparent' : t.hairline}`,
                           boxShadow: canScan ? `0 8px 20px ${tone}${hotScan ? '66' : '44'}` : 'none',
                           transition: 'box-shadow 180ms ease, color 160ms ease',
                           cursor: canScan ? 'pointer' : 'default',
                         }}>
            {busy
              ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              : <ScanSearch size={14} aria-hidden="true" style={{ color: canScan ? '#fff' : shade(tone) }} />}
            {busy ? 'Scanning…' : 'Scan'}
          </motion.button>
        </div>
      </form>

      <div className="flex items-center gap-3 mt-2 px-2 min-w-0">
        <span className="truncate" style={{ fontFamily: helper.mono ? FONT.mono : FONT.prose, fontSize: helper.mono ? 10.5 : 11, color: helper.tone === t.warn ? (t.isLight ? shade(t.warn, 0.38) : t.warn) : helper.tone }}>
          {helper.text}
        </span>
        {lastGroup && (
          <span className="ml-auto truncate flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, maxWidth: 260 }}>
            security group · <span style={{ fontFamily: FONT.mono, fontSize: 10.5 }}>{lastGroup}</span>
          </span>
        )}
      </div>
    </div>
  )
}
