import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link2, Upload, X, ScanSearch, Loader2, FileBox, ShieldCheck, AlertTriangle } from 'lucide-react'
import { FONT, label as LBL, glass, bloom } from '../api-intercept-2027/tokens'
import { normalizeHfUri, fmtBytes } from './scanModel'

/**
 * ScanComposer — the firing control, shaped like the runtime console's
 * composer: a source toggle, one pill-shaped input, one accent button.
 *
 * The input takes whatever a presenter is likely to paste — `org/model`, a
 * huggingface.co URL, a link into a file or a branch — and shows the repo id
 * it will actually send, so a typo is visible before the scan rather than
 * after a 400.
 */

// Wider than the old list: the scanner reads Keras, TF, GGUF and joblib too,
// and `accept` only filters the picker — it was hiding formats that scan fine.
const ACCEPT = '.zip,.pkl,.pickle,.bin,.pt,.pth,.ckpt,.safetensors,.onnx,.h5,.keras,.pb,.gguf,.joblib,.npy,.npz,.msgpack,.tflite'

const SOURCES = [
  { id: 'huggingface', label: 'Hugging Face', icon: Link2 },
  { id: 'local',       label: 'Local file',   icon: Upload },
]

const HINT = {
  huggingface: 'AIRS reads the repo by URI — nothing is downloaded here',
  local: 'scanned on this host — only file hashes and findings leave it',
}

export function ScanComposer({ t, mode, onMode, uri, onUri, file, onFile, onScan, busy, ready, lastGroup }) {
  const [focus, setFocus] = useState(false)
  const fileRef = useRef(null)
  const hf = normalizeHfUri(uri)
  const isHf = mode === 'huggingface'
  const canScan = ready && !busy && (isHf ? hf.ok : !!file)
  const ring = focus ? t.block : t.glassEdge

  const submit = (e) => {
    e?.preventDefault()
    if (!canScan) return
    onScan(isHf ? { source: 'huggingface', uri: hf.id } : { source: 'local', file })
  }

  return (
    <div className="relative flex-shrink-0 m-3 mt-2 p-3" style={glass(t, { radius: 26 })}>
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <div className="flex p-0.5 rounded-full" style={{ background: t.sunken, border: `1px solid ${t.hairline}` }}>
          {SOURCES.map((s) => {
            const on = mode === s.id
            return (
              <button key={s.id} type="button" onClick={() => onMode(s.id)}
                      className="relative flex items-center gap-1.5 px-3 py-1 rounded-full"
                      style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: on ? t.ink : t.inkFaint }}>
                {on && (
                  <motion.span layoutId="ms-source-pill" className="absolute inset-0 rounded-full"
                               style={{ background: t.panel, boxShadow: t.shadowSm }}
                               transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
                )}
                <s.icon size={12} className="relative" />
                <span className="relative">{s.label}</span>
              </button>
            )
          })}
        </div>
        <span style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkFaint }}>{HINT[mode]}</span>
      </div>

      <form onSubmit={submit}>
        <div className="flex items-center gap-2.5 px-2.5 py-2 transition-all"
             style={{
               background: t.sunken, border: `1px solid ${ring}`, borderRadius: 999,
               boxShadow: focus ? bloom(t.block, 0.7) : 'none',
             }}>
          {isHf ? (
            <>
              <span className="flex-shrink-0 grid place-items-center"
                    style={{ width: 32, height: 32, borderRadius: 999, background: t.panel, boxShadow: t.shadowSm }}>
                <Link2 size={14} style={{ color: t.inkDim }} />
              </span>
              <input
                key="hf-uri"
                // globals.css paints every light-mode input white with
                // !important, which an inline style cannot beat — and a white
                // slab inside the grey pill reads as a second field.
                ref={(el) => el?.style.setProperty('background-color', 'transparent', 'important')}
                value={uri}
                onChange={(e) => onUri(e.target.value)}
                onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
                placeholder="org/model-name — or paste a huggingface.co link"
                spellCheck={false} dir="ltr"
                className="flex-1 bg-transparent outline-none min-w-0 py-1"
                style={{ fontFamily: FONT.mono, fontSize: 12.5, color: t.ink }}
              />
            </>
          ) : (
            <>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 disabled:opacity-40"
                      style={{ ...LBL, fontSize: 9, color: t.inkDim, background: t.panel, boxShadow: t.shadowSm, borderRadius: 999 }}>
                <Upload size={12} /> Choose file
              </button>
              <input key="local-file" ref={fileRef} type="file" className="hidden" accept={ACCEPT}
                     onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
              {file ? (
                <span className="flex-1 min-w-0 flex items-center gap-2">
                  <FileBox size={13} style={{ color: t.live, flexShrink: 0 }} />
                  <span className="truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 12.5, color: t.ink }}>{file.name}</span>
                  <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkFaint }}>{fmtBytes(file.size)}</span>
                  <button type="button" onClick={() => onFile(null)} title="Remove" style={{ color: t.inkFaint }}>
                    <X size={12} />
                  </button>
                </span>
              ) : (
                <span className="flex-1 min-w-0 truncate" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkFaint }}>
                  Drop a model file anywhere on this panel — .pkl, .pt, .h5, .safetensors, .onnx, .gguf…
                </span>
              )}
            </>
          )}

          <motion.button
            type="submit" disabled={!canScan}
            whileHover={canScan ? { scale: 1.03 } : {}} whileTap={canScan ? { scale: 0.97 } : {}}
            title={!ready ? 'Scanner unavailable' : busy ? 'A scan is already running' : 'Scan this model'}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 transition-colors disabled:opacity-30"
            style={{
              ...LBL, fontSize: 10, borderRadius: 999,
              color: canScan ? '#fff' : t.inkFaint,
              background: canScan ? t.block : 'transparent',
              boxShadow: canScan ? bloom(t.block, 1) : 'none',
            }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ScanSearch size={13} />}
            {busy ? 'Scanning' : 'Scan'}
          </motion.button>
        </div>
      </form>

      <div className="flex items-center gap-3 mt-2 px-1 min-w-0">
        {isHf && uri && !hf.ok && hf.error ? (
          <span style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.warn }}>{hf.error}</span>
        ) : isHf && hf.ok && hf.id !== uri.trim() ? (
          <span className="truncate" style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkFaint }}>will scan · {hf.id}</span>
        ) : (
          <span style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkFaint }}>
            {isHf ? 'enter to scan' : 'the file is deleted from this host when the scan returns'}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full flex-shrink-0"
              style={{
                ...LBL, fontSize: 8.5, color: ready ? t.pass : t.warn,
                background: `${ready ? t.pass : t.warn}16`, border: `1px solid ${ready ? t.pass : t.warn}44`,
              }}>
          {ready ? <ShieldCheck size={10} /> : <AlertTriangle size={10} />}
          {ready ? 'scanner live' : 'scanner unavailable'}
        </span>
        {lastGroup && (
          <span className="truncate" style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkFaint, maxWidth: 220 }}>
            group · {lastGroup}
          </span>
        )}
      </div>
    </div>
  )
}
