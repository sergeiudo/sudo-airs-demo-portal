import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FONT, label as LBL, bloom, glass } from '../api-intercept-2027/tokens'
import { Box, Arrow, ColHead, useReducedMotion } from '../api-intercept-2027/InterceptLine'
import { ruleCounts, scanVerdict } from './scanModel'

/**
 * ScanLine — the live route at the top of the console once a scan exists.
 *
 * The runtime console's InterceptLine, in the same boxes and arrows, for a
 * different route: source → AIRS scan → security group → outcome. A block is
 * decided at the security group, so that is the box that takes the impact and
 * everything downstream goes dead.
 *
 * Honest about what it cannot know: `/scan-model` is one POST with no progress
 * events, so a scan in flight is shown as indeterminate motion. The previous
 * view ticked a random progress bar to 85% and lit four named phases on a
 * timer — a picture of progress the scanner never reported.
 */
export function ScanLine({ t, record }) {
  const reduced = useReducedMotion()
  const v = scanVerdict(record)
  const scanning = v === 'scanning'
  const blocked = v === 'blocked'
  const allowed = v === 'allowed'
  const fault = v === 'error'
  const { total, passed, failed } = ruleCounts(record?.result)
  const group = record?.result?.security_group_name
  const isLocal = record?.source === 'local'

  const headline = scanning ? 'SCANNING' : blocked ? 'BLOCKED' : allowed ? 'ALLOWED' : 'FAULT'
  const headColor = scanning ? t.live : blocked ? t.block : allowed ? t.pass : t.warn
  const srcColor = isLocal ? t.live : '#D9A400'
  const scanColor = fault ? t.warn : t.pass
  const groupColor = blocked ? t.block : t.pass

  return (
    <div className="relative flex-shrink-0 mx-3 mt-3 overflow-hidden" style={glass(t, { radius: 26 })}>
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: `linear-gradient(165deg, ${t.panel} 0%, ${t.sunken} 100%)` }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle, ${t.grid} 1.1px, transparent 1.1px)`,
        backgroundSize: '18px 18px',
      }} />

      {!reduced && [
        { c: scanning ? t.live : scanColor, left: '30%', delay: 0 },
        { c: blocked ? t.block : scanning ? t.live : t.pass, left: '62%', delay: 2.4 },
      ].map((b, i) => (
        <motion.div key={i} className="absolute pointer-events-none"
                    style={{
                      left: b.left, top: '-40%', width: 300, height: 300, borderRadius: '50%',
                      background: `radial-gradient(circle, ${b.c}2e, transparent 68%)`,
                      filter: 'blur(28px)', marginLeft: -150,
                    }}
                    animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.9, 1.1, 0.9] }}
                    transition={{ duration: 7, delay: b.delay, repeat: Infinity, ease: 'easeInOut' }} />
      ))}

      <AnimatePresence>
        {blocked && !reduced && (
          <motion.div key={`flash-${record?.id}`} className="absolute inset-0 pointer-events-none"
                      style={{ background: `radial-gradient(120% 100% at 50% 50%, ${t.block}22, transparent 70%)` }}
                      initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.35] }} transition={{ duration: 0.7 }} />
        )}
      </AnimatePresence>

      <div className="relative flex items-center justify-between px-5 pt-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <span style={{ ...LBL, color: t.inkDim }}>Supply-chain enforcement</span>
          <span className="truncate" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkFaint }}>
            every artifact is scanned before it can load
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.span key={headline}
                       initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                       className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
                       style={{
                         ...LBL, fontSize: 10, color: headColor,
                         background: `${headColor}1c`, border: `1px solid ${headColor}55`, boxShadow: bloom(headColor, 0.5),
                       }}>
            {scanning && (
              <motion.span className="rounded-full" style={{ width: 6, height: 6, background: headColor }}
                           animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity }} />
            )}
            {headline}
            {/* The rule count rides in the pill: under an arrow it was clipped
                by the boxes on either side at any normal pane width. */}
            {total > 0 && (blocked || allowed) && (
              <span style={{ fontFamily: FONT.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: 0, textTransform: 'none', opacity: 0.85 }}>
                · {blocked ? `${failed} of ${total} rules failed` : `${passed} of ${total} rules passed`}
              </span>
            )}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="relative flex items-end px-5 pt-2.5">
        <ColHead t={t} style={{ width: 138, flexShrink: 0 }}>Source</ColHead>
        <div className="flex-1 min-w-0" />
        <ColHead t={t} style={{ width: 138, flexShrink: 0 }}>Enforcement</ColHead>
        <div className="flex-1 min-w-0" />
        <ColHead t={t} style={{ width: 168, flexShrink: 0 }}>Policy</ColHead>
        <div className="flex-1 min-w-0" />
        <ColHead t={t} style={{ width: 138, flexShrink: 0 }}>Outcome</ColHead>
      </div>

      <div className="relative flex items-start px-5 pt-1.5">
        <Box t={t} title={isLocal ? 'LOCAL FILE' : 'HUGGING FACE'} sub={record?.target}
             color={srcColor} live={scanning} reduced={reduced} />

        <Arrow t={t} flex={1} color={scanning ? t.live : scanColor} flowing={scanning} reduced={reduced} />

        <Box t={t} title="AIRS · SCAN" sub="model security"
             color={scanning ? t.live : scanColor} struck={fault} live={scanning} reduced={reduced} enforce={!fault} />

        <Arrow t={t} flex={1} color={blocked ? t.block : scanning ? t.live : t.pass} dead={fault}
               flowing={scanning} reduced={reduced} knocking={blocked} />

        <Box t={t} wide title="SECURITY GROUP" sub={group ?? (scanning ? 'evaluating rules…' : '—')}
             color={scanning ? t.live : groupColor} dead={fault} impact={blocked} live={scanning} reduced={reduced} enforce={!fault} />

        <Arrow t={t} flex={1} color={t.pass} dead={!allowed} reduced={reduced} />

        <Box t={t} title={allowed ? 'CLEARED' : blocked ? 'NOT LOADED' : scanning ? 'LOAD' : 'NO VERDICT'}
             sub={allowed ? 'safe to load' : blocked ? 'blocked before load' : scanning ? 'held until verdict' : 'scan failed'}
             color={t.pass} dead={!allowed} reduced={reduced} />
      </div>

      <div className="relative px-5 pb-1 text-center">
        <span style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkFaint }}>
          code exec on load · runtime code exec · suspicious components · license · verified publisher · approved format
        </span>
      </div>
    </div>
  )
}
