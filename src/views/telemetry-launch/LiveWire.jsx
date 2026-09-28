import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Radio, ArrowUpRight, Trash2, Crosshair, Loader2 } from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots } from '../home-2027/band'
import {
  targetMeta, outcomeTone, OUTCOME_ICON, outcomeLine, FAMILY_SHORT, modelTail, relTime, clockTime, fmtMs, HEBREW, inkOn,
} from './telemetryModel'

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

/** "just now" stays true while the pane is open. */
export function useNow(ms = 15000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return now
}

/**
 * One trace as a row: outcome icon square, the attack's name (or the prompt
 * itself), a mono line saying where it ran, and prose pills for the outcome
 * and the detector families. `fresh` rows arrived live and flash in.
 */
export function TraceRow({ t, s, onOpen, onDelete, fresh, now, dense, selected }) {
  const reduce = useReducedMotion()
  const [hot, setHot] = useState(false)
  const tone = outcomeTone(t, s.outcome)
  const Icon = OUTCOME_ICON[s.outcome]
  const meta = targetMeta(s.target)
  const text = s.prompt?.replace(/\s+/g, ' ').trim() || '(empty prompt)'
  const title = s.attack || text
  const he = HEBREW.test(title)
  const heSub = HEBREW.test(text)
  return (
    <motion.div layout={!reduce ? 'position' : false}
                initial={fresh && !reduce ? { opacity: 0, y: -10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}
                className="relative group" onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}>
      {fresh && !reduce && (
        <motion.span aria-hidden="true" className="absolute inset-0 rounded-xl pointer-events-none"
                     initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.8, ease: 'easeOut' }}
                     style={{ background: `${tone}24`, boxShadow: `inset 0 0 0 1px ${tone}66` }} />
      )}
      <button type="button" onClick={() => onOpen(s.id)}
              className={`relative w-full flex items-start gap-2.5 rounded-xl text-left ${focusCls}`}
              style={{ padding: dense ? '8px 8px' : '9px 10px', paddingRight: onDelete ? 40 : undefined, background: selected ? `${tone}14` : hot ? `${tone}0d` : 'transparent', transition: 'background 140ms ease' }}>
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: dense ? 30 : 32, height: dense ? 30 : 32, background: `${tone}17`, color: tone, marginTop: 1 }}>
          <Icon size={dense ? 14 : 15} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2 min-w-0">
            <span className="truncate flex-1" dir={he ? 'rtl' : 'auto'}
                  style={{ fontFamily: he ? 'Heebo, sans-serif' : FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, textAlign: he ? 'right' : undefined }}>
              {title}
            </span>
            <span className="flex-shrink-0" title={new Date(s.at).toLocaleString()} style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkFaint }}>
              {dense ? relTime(s.at, now) : `${clockTime(s.at)} · ${relTime(s.at, now)}`}
            </span>
          </span>
          {s.attack && (
            <span className="block truncate" dir={heSub ? 'rtl' : 'auto'}
                  style={{ fontFamily: heSub ? 'Heebo, sans-serif' : FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1, textAlign: heSub ? 'right' : undefined }}>
              {text}
            </span>
          )}
          <span className="block truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, marginTop: 2 }}>
            <span style={{ color: inkOn(t, meta.tone, 0.3) }}>{meta.label}</span> · {modelTail(s.model)}
            {!dense && s.totalMs != null ? ` · ${fmtMs(s.totalMs)}` : ''}
            {s.scenario ? ` · ${s.scenario}` : ''}
          </span>
          <span className="flex items-center gap-1 mt-1.5 flex-wrap">
            <span className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600, lineHeight: '18px', color: inkOn(t, tone, 0.3), background: `${tone}1a` }}>
              {outcomeLine(s)}
            </span>
            {s.families.slice(0, dense ? 2 : 4).map((f) => (
              <span key={f} className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: '18px', color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
                {FAMILY_SHORT[f] ?? f}
              </span>
            ))}
            {s.severity && !dense && (
              <span className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: '18px', color: t.inkDim, background: t.sunken }}>{s.severity}</span>
            )}
          </span>
        </span>
        {!onDelete && (
          <span className="grid place-items-center rounded-full flex-shrink-0 self-center" aria-hidden="true"
                style={{ width: 26, height: 26, color: hot || selected ? '#fff' : t.inkDim, background: hot || selected ? shade(t.live) : t.sunken, transition: 'background 140ms ease' }}>
            <ArrowUpRight size={13} />
          </span>
        )}
      </button>
      {onDelete && (
        <button type="button" onClick={() => onDelete(s.id)} aria-label="Delete this trace" title="Delete this trace"
                className={`absolute top-1/2 -translate-y-1/2 right-2 grid place-items-center rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 ${focusCls}`}
                style={{ width: 28, height: 28, color: t.inkDim, background: t.sunken, transition: 'opacity 140ms ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = t.block }} onMouseLeave={(e) => { e.currentTarget.style.color = t.inkDim }}>
          <Trash2 size={13} aria-hidden="true" />
        </button>
      )}
    </motion.div>
  )
}

const STATUS = {
  live: { title: 'Live', sub: 'Every prompt the portal writes, the moment it lands' },
  connecting: { title: 'Connecting…', sub: 'Opening the live stream' },
  reconnecting: { title: 'Reconnecting…', sub: 'The stream dropped — it retries by itself' },
  paused: { title: 'Paused', sub: 'Resume from the header to follow traffic again' },
  unsupported: { title: 'No live stream', sub: 'This browser has no EventSource — refresh to update' },
}

/** The right-hand pane: the latest traces, newest first, arriving live. */
export function LiveWire({ t, wire, status, arrived, onOpen, openId, onGoRuntime }) {
  const reduce = useReducedMotion()
  const now = useNow()
  const tone = status === 'live' ? t.live : status === 'paused' ? t.idle : t.warn
  const st = STATUS[status] ?? STATUS.connecting
  return (
    <div className="flex flex-col h-full overflow-hidden" style={glass(t, { radius: 22 })}>
      <div className="relative flex-shrink-0 overflow-hidden" style={{ minHeight: 96, background: bandBg(tone) }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
        <Radio aria-hidden="true" strokeWidth={1.3}
               style={{ position: 'absolute', right: -24, bottom: -40, width: 150, height: 150, color: '#fff', opacity: 0.14, transform: 'rotate(-10deg)' }} />
        <div className="relative flex items-center gap-3 px-4 py-4">
          <span className="relative grid place-items-center rounded-2xl flex-shrink-0"
                style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
            {status === 'live' && !reduce && (
              <motion.span className="absolute inset-0 rounded-2xl" style={{ border: '2px solid rgba(255,255,255,0.5)' }}
                           animate={{ scale: [1, 1.25], opacity: [0.7, 0] }} transition={{ duration: 1.8, repeat: Infinity }} aria-hidden="true" />
            )}
            {status === 'connecting' || status === 'reconnecting'
              ? <Loader2 size={20} className="animate-spin" style={{ color: '#fff' }} aria-hidden="true" />
              : <Radio size={20} style={{ color: '#fff' }} aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>On the wire</div>
            <div style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.1, marginTop: 2 }} aria-live="polite">{st.title}</div>
            <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 2 }}>
              {arrived > 0 ? `${arrived} arrived while you watched` : st.sub}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
        {wire.loading && !wire.items.length ? (
          <div className="flex items-center gap-2 px-3 py-4" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>
            <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Loading the latest traces…
          </div>
        ) : wire.error ? (
          <p className="px-3 py-4" style={{ fontFamily: FONT.prose, fontSize: 12, color: inkOn(t, t.warn, 0.4) }}>Could not load traces: {wire.error}</p>
        ) : !wire.items.length ? (
          <div className="px-3 py-6 text-center">
            <p style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>Nothing on the wire yet</p>
            <p style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginTop: 4 }}>Fire a prompt in any pillar — it lands here as it happens.</p>
            <button type="button" onClick={onGoRuntime}
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3.5 ${focusCls}`}
                    style={{ height: 32, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 700, color: '#fff', background: bandBg(t.live), boxShadow: `0 4px 12px ${t.live}40` }}>
              <Crosshair size={13} aria-hidden="true" /> Open AIRS Runtime &amp; AI-GW
            </button>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {wire.items.map((s) => (
              <TraceRow key={s.id} t={t} s={s} onOpen={onOpen} fresh={wire.fresh.has(s.id)} now={now} dense selected={openId === s.id} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
