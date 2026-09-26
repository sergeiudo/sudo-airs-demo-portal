import React, { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { ago } from './homeData'
import { shade, bandBg, bandDots } from './band'

/**
 * LauncherTile / LauncherRow — the pillars on the launcher home.
 *
 * Built like app cards rather than web-page cards: each carries a coloured
 * band in its pillar's hue — step number, a large icon, a watermark — so the
 * run of show reads across a room before a word is read. Detail is one click
 * down (the details sheet); Launch is always visible.
 *
 * Same interaction contract as PillarTile: the whole tile is a button that
 * opens details, Launch sits above it (stretched-button pattern — nothing
 * interactive nested inside another interactive element), and hover and
 * keyboard focus earn the same highlight.
 *
 * The band itself (colour, texture, contrast rule) lives in band.js, shared
 * with the pillar consoles.
 */

const focusRing = (t) => `0 0 0 2px ${t.panel}, 0 0 0 4px ${t.live}`

function useHot() {
  const [hot, setHot] = useState(false)
  return [hot, {
    onMouseEnter: () => setHot(true),
    onMouseLeave: () => setHot(false),
    onFocus: () => setHot(true),
    onBlur: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHot(false) },
  }]
}

function DetailsButton({ t, pillar, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(pillar.id)} aria-label={`Details: ${pillar.title}`}
            className="absolute inset-0 z-0 focus-visible:outline-none"
            style={{ borderRadius: 'inherit', cursor: 'pointer', background: 'transparent' }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = `inset ${focusRing(t)}` }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none' }} />
  )
}

function BandPill({ children, color, solid }) {
  return (
    <span className="rounded-full px-2 py-0.5"
          style={{ ...LBL, fontSize: 9, color: solid ? color : '#fff', background: solid ? '#fff' : 'rgba(255,255,255,0.18)', border: solid ? 'none' : '1px solid rgba(255,255,255,0.35)' }}>
      {children}
    </span>
  )
}

export function LauncherTile({ t, pillar, index = 0, onOpen, onLaunch, lastOpened }) {
  const reduce = useReducedMotion()
  const [hot, hotProps] = useHot()
  const Icon = pillar.icon
  const legacy = !!pillar.legacy
  const tone = legacy ? '#94a3b8' : pillar.accent
  const sh = shade(tone)
  const opened = ago(lastOpened)
  const news = pillar.news.slice(0, 2)

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: hot && !reduce ? -6 : 0 }}
      transition={{
        opacity: { delay: reduce ? 0 : 0.05 * index, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
        y: { type: 'spring', stiffness: 380, damping: 28 },
      }}
      {...hotProps}
      className="relative flex flex-col overflow-hidden h-full"
      style={{
        background: t.panel, borderRadius: 24,
        border: `1px solid ${hot ? `${tone}70` : t.glassEdge}`,
        boxShadow: hot ? `0 24px 50px ${tone}3a, 0 0 0 1px ${tone}2e, ${t.shadowSm}` : t.shadow,
        transition: 'border-color 200ms ease, box-shadow 220ms ease',
        zIndex: hot ? 3 : 'auto',
      }}
    >
      <DetailsButton t={t} pillar={pillar} onOpen={onOpen} />

      {/* the band — the tile's identity */}
      {/* Sizes scale with the viewport so a 1080p projector gets bigger
          tiles rather than empty margins. */}
      <div className="relative flex-shrink-0 overflow-hidden pointer-events-none" style={{ height: 'clamp(138px, 17vh, 196px)', background: bandBg(tone) }}>
        <div aria-hidden="true" className="absolute inset-0" style={bandDots} />
        <div aria-hidden="true" className="absolute inset-0"
             style={{ background: 'radial-gradient(circle at 85% 10%, rgba(255,255,255,0.28), transparent 60%)', opacity: hot ? 1 : 0.35, transition: 'opacity 240ms ease' }} />
        <Icon aria-hidden="true" strokeWidth={1.4}
              style={{
                position: 'absolute', right: -26, bottom: -34, width: 'clamp(150px, 19vh, 210px)', height: 'clamp(150px, 19vh, 210px)', color: '#fff', opacity: 0.17,
                transform: hot && !reduce ? 'rotate(-4deg) scale(1.07)' : 'rotate(-10deg)', transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
              }} />

        <div className="relative h-full flex flex-col p-4">
          <div className="flex items-start gap-2">
            {pillar.run && (
              <div className="leading-none">
                <div style={{ ...LBL, fontSize: 9, color: 'rgba(255,255,255,0.8)' }}>Step</div>
                <div style={{ fontFamily: FONT.display, fontSize: 'clamp(34px, 4.2vh, 46px)', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', marginTop: 3 }}>
                  {String(pillar.run).padStart(2, '0')}
                </div>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {legacy && <BandPill>Legacy</BandPill>}
              {pillar.news.length > 0 && <BandPill solid color={sh}>{pillar.news.length} new</BandPill>}
            </div>
          </div>
          <span className="mt-auto grid place-items-center rounded-2xl"
                style={{ width: 'clamp(46px, 5.4vh, 56px)', height: 'clamp(46px, 5.4vh, 56px)', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)', backdropFilter: 'blur(6px)' }}>
            <Icon style={{ color: '#fff', width: '44%', height: '44%' }} aria-hidden="true" />
          </span>
        </div>
      </div>

      {/* the body */}
      <div className="relative z-[1] flex-1 flex flex-col pointer-events-none" style={{ padding: '15px 18px 18px' }}>
        <span className="truncate" style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>{pillar.area}</span>
        <h3 style={{ fontFamily: FONT.display, fontSize: 'clamp(19px, 2.2vh, 23px)', fontWeight: 700, letterSpacing: '-0.015em', color: t.ink, lineHeight: 1.15, marginTop: 5, textWrap: 'balance' }}>
          {pillar.title}
        </h3>
        <p style={{
          fontFamily: FONT.prose, fontSize: 'clamp(13px, 1.45vh, 14.5px)', lineHeight: 1.5, color: t.inkDim, marginTop: 6,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {pillar.summary}
        </p>

        {news.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {news.map((n) => (
              <li key={n} className="flex items-start gap-2">
                <span className="flex-shrink-0 rounded px-1 mt-[1px]" style={{ ...LBL, fontSize: 8, color: t.isLight ? '#3461D9' : '#86A4F7', background: `${t.live}17` }}>New</span>
                <span style={{
                  fontFamily: FONT.prose, fontSize: 'clamp(12px, 1.3vh, 13.5px)', lineHeight: 1.4, color: t.ink,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{n}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-4 flex items-center gap-2 flex-wrap">
          {pillar.stats[0] && (
            <span className="rounded-full px-2.5 py-1 whitespace-nowrap"
                  style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
              {pillar.stats[0]}
            </span>
          )}
          {opened && <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>opened {opened}</span>}
        </div>

        <button type="button" onClick={() => onLaunch(pillar.id)} aria-label={`Launch ${pillar.title}`}
                className="pointer-events-auto mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-full active:scale-[0.98] focus-visible:outline-none"
                style={{
                  height: 38, fontFamily: FONT.prose, fontSize: 13, fontWeight: 700,
                  // Soft at rest — five solid black pills in a row read as a
                  // form; the tile under the pointer fills with its own hue.
                  color: hot ? '#fff' : t.ink, background: hot ? sh : t.sunken,
                  border: `1px solid ${hot ? sh : t.hairline}`,
                  transition: 'background 180ms ease, color 180ms ease, border-color 180ms ease, transform 120ms ease', cursor: 'pointer',
                }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = focusRing(t) }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = 'none' }}>
          Launch <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </div>
    </motion.article>
  )
}

export function LauncherRow({ t, pillar, index = 0, onOpen, onLaunch, lastOpened }) {
  const reduce = useReducedMotion()
  const [hot, hotProps] = useHot()
  const Icon = pillar.icon
  const tone = pillar.legacy ? '#94a3b8' : pillar.accent
  const sh = shade(tone)
  const opened = ago(lastOpened)

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: hot && !reduce ? -3 : 0 }}
      transition={{
        opacity: { delay: reduce ? 0 : 0.25 + 0.04 * index, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
        y: { type: 'spring', stiffness: 380, damping: 28 },
      }}
      {...hotProps}
      className="relative flex items-center gap-3 overflow-hidden"
      style={{
        background: t.panel, borderRadius: 18, padding: '12px 12px 12px 12px',
        border: `1px solid ${hot ? `${tone}70` : t.glassEdge}`,
        boxShadow: hot ? `0 14px 32px ${tone}33, ${t.shadowSm}` : t.shadowSm,
        transition: 'border-color 200ms ease, box-shadow 220ms ease',
      }}
    >
      <DetailsButton t={t} pillar={pillar} onOpen={onOpen} />
      <span className="relative grid place-items-center rounded-xl flex-shrink-0 pointer-events-none overflow-hidden"
            style={{ width: 44, height: 44, background: bandBg(tone), boxShadow: hot ? `0 6px 14px ${tone}55` : 'none', transition: 'box-shadow 200ms ease' }}>
        <Icon size={19} style={{ color: '#fff' }} aria-hidden="true" />
      </span>
      <div className="relative min-w-0 flex-1 pointer-events-none">
        <h3 style={{ fontFamily: FONT.display, fontSize: 14.5, fontWeight: 700, color: t.ink, lineHeight: 1.2, textWrap: 'balance' }}>{pillar.title}</h3>
        <p style={{
          fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.4, color: t.inkDim, marginTop: 2,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {opened ? `Opened ${opened} · ${pillar.area}` : pillar.summary}
        </p>
      </div>
      <button type="button" onClick={() => onLaunch(pillar.id)} aria-label={`Launch ${pillar.title}`} title={`Launch ${pillar.title}`}
              className="relative z-[2] grid place-items-center rounded-full flex-shrink-0 active:scale-[0.95] focus-visible:outline-none"
              style={{
                width: 34, height: 34, color: hot ? '#fff' : t.ink, background: hot ? sh : t.sunken,
                border: `1px solid ${hot ? sh : t.hairline}`, transition: 'background 180ms ease, color 180ms ease', cursor: 'pointer',
              }}
              onFocus={(e) => { e.currentTarget.style.boxShadow = focusRing(t) }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = 'none' }}>
        <ArrowUpRight size={15} aria-hidden="true" />
      </button>
    </motion.article>
  )
}
