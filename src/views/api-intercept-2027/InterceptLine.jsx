import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FONT, label as LBL, bloom, glass } from './tokens'

/**
 * InterceptLine — the live architecture diagram at the top of the console.
 *
 * Drawn in the same language as the Ministry of Health architecture panel:
 * named boxes with a sub-label, labelled columns, an amber dot marking every
 * AIRS enforcement point. The difference is that this one is not a picture —
 * it is wired to the request in flight and repaints per turn.
 *
 * What it encodes that a static diagram cannot:
 *   • the connector widths are the REAL measured durations once a turn
 *     resolves, so a slow model is visibly slow;
 *   • packets flow while a request is in flight and a refused payload sits
 *     knocking against the box that refused it;
 *   • a failed verdict visibly stops there — everything downstream goes dashed
 *     and dim, which is exactly what the legend claims happens.
 *
 * It stays honest about what it cannot know: /api/chat is one POST with no
 * intermediate events, so in-flight motion is indeterminate rather than a faked
 * stage-by-stage sequence that would desync the moment Bedrock is slow.
 */

const MIN_SEG = 0.12

function useReducedMotion() {
  const [r, setR] = useState(false)
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setR(q.matches)
    on(); q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return r
}

/** A labelled box. `enforce` adds the amber dot the legend refers to. */
function Box({ t, title, sub, color, dead, struck, impact, live, reduced, enforce, wide }) {
  const [hover, setHover] = useState(false)
  return (
    <div className="relative flex-shrink-0" style={{ width: wide ? 168 : 138 }}
         onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {impact && !reduced && [0, 0.22].map((d) => (
        <motion.span key={d} className="absolute inset-0 rounded-xl pointer-events-none"
                     style={{ border: `2px solid ${color}` }}
                     initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 1.18, opacity: 0 }}
                     transition={{ duration: 1.1, delay: d, repeat: Infinity, repeatDelay: 1.1, ease: 'easeOut' }} />
      ))}

      <motion.div
        className="relative px-3 py-2.5 text-center"
        style={{
          borderRadius: 18,
          background: dead ? t.panel : `linear-gradient(160deg, ${color}1e, ${color}08), ${t.panel}`,
          border: `1px ${struck ? 'dashed' : 'solid'} ${dead ? t.hairline : `${color}55`}`,
          boxShadow: dead ? t.shadowSm : bloom(color, impact ? 1.6 : live ? 1.1 : 0.7),
        }}
        animate={{
          y: hover && !dead ? -3 : 0,
          ...(impact && !reduced ? { x: [0, -3, 3, -2, 2, 0] } : {}),
        }}
        transition={{ y: { type: 'spring', stiffness: 420, damping: 26 }, x: { duration: 0.45 } }}
      >
        {enforce && !dead && (
          <span className="absolute rounded-full"
                style={{ top: -4, right: -4, width: 9, height: 9, background: t.warn, boxShadow: bloom(t.warn, 1) }} />
        )}
        <div className="truncate" style={{ fontFamily: FONT.mono, fontSize: 11.5, fontWeight: 700, color: dead ? t.inkFaint : color, letterSpacing: '0.02em' }}>
          {title}
        </div>
        {sub && (
          <div className="truncate" title={String(sub)}
               style={{ fontFamily: FONT.prose, fontSize: 9.5, color: t.inkDim, marginTop: 2 }}>
            {sub}
          </div>
        )}
      </motion.div>
    </div>
  )
}

/** Connector with an arrowhead. Flowing when live, dashed when nothing passed. */
function Arrow({ t, flex, color, dead, flowing, reduced, knocking, note }) {
  return (
    <div className="relative flex-1 min-w-0 self-start" style={{ flexGrow: flex, height: 58 }}>
      <div className="absolute left-0 right-3 rounded-full"
           style={{
             top: 25, height: 2.5,
             background: dead
               ? `repeating-linear-gradient(90deg, ${t.railBed} 0 5px, transparent 5px 11px)`
               : `linear-gradient(90deg, ${color}33, ${color}cc)`,
             boxShadow: dead ? 'none' : `0 0 10px ${color}55`,
           }} />
      {/* arrowhead */}
      <span className="absolute" style={{
        top: 20, right: 0, width: 0, height: 0,
        borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
        borderLeft: `8px solid ${dead ? t.railBed : color}`,
      }} />

      {flowing && !reduced && [0, 0.45, 0.9].map((d) => (
        <motion.span key={d} className="absolute rounded-full pointer-events-none"
                     style={{ top: 22, width: 8, height: 8, background: color, boxShadow: bloom(color, 1.2) }}
                     initial={{ left: '-4%', opacity: 0 }}
                     animate={{ left: ['-4%', '98%'], opacity: [0, 1, 1, 0] }}
                     transition={{ duration: 1.3, delay: d, repeat: Infinity, ease: 'linear' }} />
      ))}

      {knocking && !reduced && (
        <motion.span className="absolute rounded-full pointer-events-none"
                     style={{ top: 20.5, width: 11, height: 11, background: color, boxShadow: bloom(color, 1.6) }}
                     animate={{ left: ['78%', '88%', '78%'] }}
                     transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} />
      )}

      {note && (
        <div className="absolute left-0 right-3 text-center truncate"
             style={{ top: 38, fontFamily: FONT.mono, fontSize: 9, color: t.inkFaint }}>
          {note}
        </div>
      )}
    </div>
  )
}

function ColHead({ t, children, style }) {
  return <div className="text-center" style={{ ...LBL, fontSize: 8.5, color: t.inkFaint, ...style }}>{children}</div>
}

export function InterceptLine({ t, phase, verdict, isProtected, backend, timing, blockedStage, modelLabel }) {
  const reduced = useReducedMotion()
  const inflight = phase === 'inflight'
  const idle = phase === 'idle'
  const resolved = phase === 'resolved'
  const isAigw = backend === 'aigw'

  const blocked = verdict === 'blocked'
  const unscanned = verdict === 'unscanned'
  const stopIn = blocked && blockedStage !== 'output'
  const stopOut = blocked && blockedStage === 'output'

  // `timing` no longer prints anywhere: it only sets how wide each leg of the
  // line is drawn. Latency numbers were pulled from the whole console on
  // purpose — a 22s model turn invites a question the demo is not about.
  const flex = useMemo(() => {
    const i = timing?.airs_input_scan_ms, m = timing?.llm_ms, o = timing?.airs_output_scan_ms
    if (!i && !m && !o) return { a: 1, b: 1.4, c: 1, d: 0.8 }
    const total = (i || 0) + (m || 0) + (o || 0) || 1
    return {
      a: Math.max(MIN_SEG, (i || 0) / total),
      b: Math.max(MIN_SEG, (m || 0) / total),
      c: Math.max(MIN_SEG, (o || 0) / total),
      d: 0.7,
    }
  }, [timing])

  const headline = inflight ? 'IN FLIGHT' : idle ? 'ARMED' : blocked ? 'INTERCEPTED' : unscanned ? 'NOT INSPECTED' : 'DELIVERED'
  const headColor = inflight ? t.live : idle ? t.inkDim : blocked ? t.block : unscanned ? t.warn : t.pass
  const scanColor = unscanned ? t.warn : t.pass

  return (
    <div className="relative flex-shrink-0 mx-3 mt-3 overflow-hidden" style={glass(t, { radius: 26 })}>
      {/* ── the stage: gradient wash, dot grid, drifting blooms, slow sheen.
             The blooms sit behind the enforcement points and take the verdict
             colour, so the whole surface reacts when something is stopped. ── */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: `linear-gradient(165deg, ${t.panel} 0%, ${t.sunken} 100%)` }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle, ${t.grid} 1.1px, transparent 1.1px)`,
        backgroundSize: '18px 18px',
      }} />

      {!reduced && [
        { c: blocked ? t.block : scanColor, left: '22%', delay: 0 },
        { c: t.model, left: '52%', delay: 2.4 },
        { c: blocked ? t.block : t.pass, left: '80%', delay: 4.8 },
      ].map((b, i) => (
        <motion.div key={i} className="absolute pointer-events-none"
                    style={{
                      left: b.left, top: '-40%', width: 300, height: 300, borderRadius: '50%',
                      background: `radial-gradient(circle, ${b.c}2e, transparent 68%)`,
                      filter: 'blur(28px)', marginLeft: -150,
                    }}
                    animate={{ opacity: idle ? [0.22, 0.38, 0.22] : [0.4, 0.8, 0.4], scale: [0.9, 1.1, 0.9] }}
                    transition={{ duration: 7, delay: b.delay, repeat: Infinity, ease: 'easeInOut' }} />
      ))}

      {!reduced && (
        <motion.div className="absolute inset-y-0 pointer-events-none"
                    style={{
                      width: '22%',
                      background: 'linear-gradient(90deg, transparent, #ffffff, transparent)',
                      opacity: t.isLight ? 0.55 : 0.04,
                    }}
                    animate={{ left: ['-25%', '115%'] }}
                    transition={{ duration: 11, repeat: Infinity, ease: 'linear' }} />
      )}

      <AnimatePresence>
        {blocked && !reduced && (
          <motion.div key="flash" className="absolute inset-0 pointer-events-none"
                      style={{ background: `radial-gradient(120% 100% at 50% 50%, ${t.block}22, transparent 70%)` }}
                      initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.35] }} transition={{ duration: 0.7 }} />
        )}
      </AnimatePresence>

      {/* header */}
      <div className="relative flex items-center justify-between px-5 pt-3">
        <div className="flex items-baseline gap-3">
          <span style={{ ...LBL, color: t.inkDim }}>
            {isAigw ? 'Gateway enforcement' : 'API-layer enforcement'}
          </span>
          <span style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkFaint }}>
            {isAigw ? 'guardrail runs inside the SCM AI-GW' : 'every prompt and every response is scanned'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            <motion.span key={headline}
                         initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                         className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                         style={{
                           ...LBL, fontSize: 10, color: headColor,
                           background: `${headColor}1c`, border: `1px solid ${headColor}55`,
                           boxShadow: idle ? 'none' : bloom(headColor, 0.5),
                         }}>
              {inflight && (
                <motion.span className="rounded-full" style={{ width: 6, height: 6, background: headColor }}
                             animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity }} />
              )}
              {headline}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* column headers, positioned over the stages they name */}
      <div className="relative flex items-end px-5 pt-2.5" style={{ gap: 0 }}>
        <div style={{ width: 138, flexShrink: 0 }} />
        <div className="flex-1 min-w-0" style={{ flexGrow: flex.a }} />
        <ColHead t={t} style={{ width: isAigw ? 168 : 138, flexShrink: 0 }}>Enforcement</ColHead>
        <div className="flex-1 min-w-0" style={{ flexGrow: flex.b }} />
        <ColHead t={t} style={{ width: 138, flexShrink: 0 }}>Execution</ColHead>
        {!isAigw && (
          <>
            <div className="flex-1 min-w-0" style={{ flexGrow: flex.c }} />
            <ColHead t={t} style={{ width: 138, flexShrink: 0 }}>Enforcement</ColHead>
          </>
        )}
        <div className="flex-1 min-w-0" style={{ flexGrow: flex.d }} />
        <div style={{ width: 138, flexShrink: 0 }} />
      </div>

      {/* the flow */}
      <div className="relative flex items-start px-5 pt-1.5">
        <Box t={t} title="CLIENT" sub="attack library · chat" color={t.live}
             dead={idle} live={inflight} reduced={reduced} />

        <Arrow t={t} flex={flex.a} color={isProtected ? scanColor : t.warn} dead={idle}
               flowing={inflight} reduced={reduced} knocking={stopIn} />

        {isAigw ? (
          <>
            <Box t={t} wide
                 title={isProtected ? 'SCM AI-GW' : 'SCM AI-GW'}
                 sub={isProtected ? '+ AIRS guardrail' : 'guardrail bypassed'}
                 color={blocked ? t.block : scanColor}
                 dead={idle} struck={unscanned} impact={blocked} live={inflight} reduced={reduced}
                 enforce={isProtected} />
            <Arrow t={t} flex={flex.b} color={t.model} dead={idle || blocked} flowing={inflight && !blocked} reduced={reduced} />
            <Box t={t} title="BEDROCK" sub={modelLabel} color={t.model}
                 dead={idle || blocked} live={inflight && !blocked} reduced={reduced} />
          </>
        ) : (
          <>
            <Box t={t}
                 title={isProtected ? 'AIRS · SCAN' : 'SCAN OFF'}
                 sub={isProtected ? 'request' : 'bypassed'}
                 color={stopIn ? t.block : scanColor}
                 dead={idle} struck={unscanned} impact={stopIn} live={inflight} reduced={reduced}
                 enforce={isProtected} />
            <Arrow t={t} flex={flex.b} color={t.model} dead={idle || stopIn} flowing={inflight && !stopIn} reduced={reduced} />
            <Box t={t} title="MODEL" sub={modelLabel} color={t.model}
                 dead={idle || stopIn} live={inflight && !stopIn} reduced={reduced} />
            <Arrow t={t} flex={flex.c} color={stopOut ? t.block : scanColor} dead={idle || stopIn}
                   flowing={false} reduced={reduced} knocking={stopOut} />
            <Box t={t}
                 title={isProtected ? 'AIRS · SCAN' : 'SCAN OFF'}
                 sub={isProtected ? 'response' : 'bypassed'}
                 color={stopOut ? t.block : scanColor}
                 dead={idle || stopIn} struck={unscanned} impact={stopOut} reduced={reduced}
                 enforce={isProtected} />
          </>
        )}

        <Arrow t={t} flex={flex.d} color={blocked ? t.block : t.pass} dead={idle || blocked} flowing={false} reduced={reduced} />

        <Box t={t} title={blocked ? 'WITHHELD' : 'ANSWER'} sub={blocked ? 'never sent' : 'to the user'}
             color={blocked ? t.block : t.pass} dead={idle || blocked} reduced={reduced} />
      </div>

      {/* what the enforcement points look for */}
      <div className="relative px-5 pb-0.5 text-center">
        <span style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkFaint }}>
          injection · PII / DLP · toxic · malicious URL · malicious code · agent misuse
        </span>
      </div>

    </div>
  )
}
