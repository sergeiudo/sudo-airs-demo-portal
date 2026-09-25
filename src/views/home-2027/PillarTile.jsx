import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, X } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { ago } from './homeData'

/**
 * PillarTile — one pillar on the home page, in three sizes.
 *
 *   featured  2×2 — the main demo, with a live route glyph
 *   tile      1×1 — the rest of the run of show
 *   compact   row — deep dives and tools
 *
 * Interaction, for every size: the whole tile opens the details sheet, and a
 * separate Launch button — always visible, never hover-only — enters the
 * pillar in one click. The old grid had a "Launch" button that opened a modal,
 * so entering a pillar always took two clicks.
 *
 * The tile is not itself a button. A full-bleed <button> sits underneath the
 * content (the "stretched link" pattern) and Launch sits above it, so there is
 * no interactive element nested inside another one.
 */

const focusRing = (t) => `0 0 0 2px ${t.panel}, 0 0 0 4px ${t.live}`

function RunBadge({ t, n, accent }) {
  return (
    <span className="inline-grid place-items-center rounded-lg flex-shrink-0"
          style={{
            minWidth: 26, height: 22, padding: '0 6px',
            fontFamily: FONT.mono, fontSize: 11, fontWeight: 700, color: t.ink,
            background: `${accent}1f`, border: `1px solid ${accent}40`,
          }}
          aria-label={`Step ${n}`}>
      {String(n).padStart(2, '0')}
    </span>
  )
}

function LegacyChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{ ...LBL, fontSize: 9, color: '#64748b', background: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.35)' }}>
      <X size={9} strokeWidth={3} /> Legacy
    </span>
  )
}

function Stat({ t, children }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 whitespace-nowrap"
          style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
      {children}
    </span>
  )
}

function LaunchButton({ t, pillar, onLaunch, size = 'md', solid }) {
  const big = size === 'lg'
  return (
    <button type="button" onClick={() => onLaunch(pillar.id)}
            aria-label={`Launch ${pillar.title}`}
            className="relative z-[2] inline-flex items-center justify-center gap-1.5 rounded-full transition-transform active:scale-[0.97] focus-visible:outline-none"
            style={{
              height: big ? 40 : 34, padding: big ? '0 18px' : solid ? '0 14px' : 0, width: big || solid ? 'auto' : 34,
              fontFamily: FONT.prose, fontSize: 13, fontWeight: 600,
              color: solid || big ? t.panel : t.ink,
              background: solid || big ? t.ink : t.sunken,
              border: `1px solid ${solid || big ? t.ink : t.hairline}`,
              cursor: 'pointer',
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = focusRing(t) }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none' }}>
      {(big || solid) && <span>Launch</span>}
      <ArrowUpRight size={big ? 16 : 15} />
    </button>
  )
}

/**
 * The route every AIRS Runtime session takes, drawn small: the one animated
 * element on the page. Static under reduced motion.
 */
function RouteGlyph({ t }) {
  const reduce = useReducedMotion()
  const PINK = '#EC4899'
  const nodes = [
    { x: 40, label: 'CLIENT', c: t.live },
    { x: 190, label: 'AIRS', c: PINK },
    { x: 340, label: 'MODEL', c: t.inkDim },
    { x: 490, label: 'ANSWER', c: t.pass },
  ]
  return (
    <svg viewBox="0 0 530 92" width="100%" height="92" aria-hidden="true" style={{ display: 'block' }}>
      <line x1={40} y1={40} x2={490} y2={40} stroke={t.railBed} strokeWidth={2} strokeDasharray="4 5" />
      {/* the short circuit: a blocked prompt returns from AIRS to the client */}
      <path d="M190,58 C190,86 40,86 40,58" fill="none" stroke={t.block} strokeWidth={1.6} strokeDasharray="4 3" opacity={0.8} />
      <text x={115} y={90} textAnchor="middle" fontFamily={FONT.mono} fontSize={9} fontWeight={700} fill={t.block}>BLOCKED → back</text>
      {nodes.map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy={40} r={15} fill={t.panel} stroke={n.c} strokeWidth={2} />
          <circle cx={n.x} cy={40} r={5} fill={n.c} />
          <text x={n.x} y={16} textAnchor="middle" fontFamily={FONT.mono} fontSize={9.5} fontWeight={700} fill={t.inkDim}>{n.label}</text>
        </g>
      ))}
      {!reduce && (
        <circle r={4.5} fill={PINK}>
          <animateMotion path="M40,40 L490,40" dur="3.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;1;0" dur="3.6s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  )
}

export function PillarTile({ t, pillar, variant = 'tile', onOpen, onLaunch, lastOpened, index = 0 }) {
  const reduce = useReducedMotion()
  const Icon = pillar.icon
  const featured = variant === 'featured'
  const compact = variant === 'compact'
  const opened = ago(lastOpened)
  const legacy = !!pillar.legacy

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : 0.04 * index, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -2 }}
      className={`group relative flex flex-col overflow-hidden ${featured ? 'md:col-span-2 xl:row-span-2' : ''}`}
      style={{
        background: t.panel, borderRadius: featured ? 28 : 22,
        border: `1px solid ${t.glassEdge}`, boxShadow: t.shadow,
        padding: featured ? 28 : compact ? 18 : 20,
        minHeight: compact ? 0 : 220,
      }}
    >
      {/* accent wash, top corner — colour as identity, not as text */}
      <div aria-hidden="true" className="absolute pointer-events-none"
           style={{
             right: -60, top: -60, width: featured ? 280 : 180, height: featured ? 280 : 180, borderRadius: '50%',
             background: `radial-gradient(circle, ${legacy ? '#94a3b8' : pillar.accent}${featured ? '26' : '1c'}, transparent 70%)`,
           }} />

      {/* the whole tile opens details */}
      <button type="button" onClick={() => onOpen(pillar.id)}
              aria-label={`Details: ${pillar.title}`}
              className="absolute inset-0 z-0 focus-visible:outline-none"
              style={{ borderRadius: 'inherit', cursor: 'pointer', background: 'transparent' }}
              onFocus={(e) => { e.currentTarget.style.boxShadow = `inset ${focusRing(t)}` }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = 'none' }} />

      <div className="relative z-[1] flex flex-col h-full pointer-events-none">
        <div className="flex items-center gap-2">
          {pillar.run && <RunBadge t={t} n={pillar.run} accent={legacy ? '#94a3b8' : pillar.accent} />}
          <span className="truncate" style={{ ...LBL, fontSize: 10.5, color: t.inkDim }}>{pillar.area}</span>
          {legacy && <LegacyChip />}
          {pillar.news.length > 0 && (
            <span className="rounded-full px-1.5 py-0.5 flex-shrink-0"
                  style={{ ...LBL, fontSize: 9, color: '#fff', background: legacy ? '#94a3b8' : pillar.accent }}>
              {pillar.news.length} new
            </span>
          )}
          <span className="ml-auto grid place-items-center rounded-xl flex-shrink-0"
                style={{
                  width: featured ? 44 : 36, height: featured ? 44 : 36,
                  background: `${legacy ? '#94a3b8' : pillar.accent}1a`, border: `1px solid ${legacy ? '#94a3b8' : pillar.accent}33`,
                }}>
            <Icon size={featured ? 21 : 17} style={{ color: legacy ? '#64748b' : pillar.accent }} aria-hidden="true" />
          </span>
        </div>

        <h3 style={{
          fontFamily: FONT.display, fontWeight: 700, letterSpacing: '-0.02em', color: t.ink,
          fontSize: featured ? 32 : compact ? 16 : 19, lineHeight: 1.1, marginTop: featured ? 18 : 12,
        }}>
          {pillar.title}
        </h3>

        <p style={{
          fontFamily: FONT.prose, color: t.inkDim, lineHeight: 1.5,
          fontSize: featured ? 15 : 13, marginTop: 6, maxWidth: featured ? 560 : undefined,
          display: '-webkit-box', WebkitLineClamp: featured ? 3 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {pillar.summary}
        </p>

        {featured && (
          <div className="mt-5 px-3 py-2 rounded-2xl" style={{ background: t.sunken, border: `1px solid ${t.hairline}` }}>
            <RouteGlyph t={t} />
          </div>
        )}

        {featured && pillar.news.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {pillar.news.map((n) => (
              <li key={n} className="flex items-start gap-2" style={{ fontFamily: FONT.prose, fontSize: 13, color: t.ink }}>
                <span className="mt-[7px] rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: pillar.accent }} />
                {n}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-4 flex items-center gap-2 flex-wrap">
          {pillar.stats.slice(0, featured ? 3 : 1).map((s) => <Stat key={s} t={t}>{s}</Stat>)}
          {opened && !featured && (
            <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>opened {opened}</span>
          )}
          <span className="ml-auto pointer-events-auto">
            <LaunchButton t={t} pillar={pillar} onLaunch={onLaunch} size={featured ? 'lg' : 'md'} />
          </span>
        </div>
      </div>
    </motion.article>
  )
}
