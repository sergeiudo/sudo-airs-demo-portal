import React, { useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Sparkles, Pause, Play } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'

/**
 * WhatsNew — every NEW highlight across the portal, as a slow marquee.
 *
 * The list is rendered twice and the track slides by exactly half its width,
 * so the loop has no seam. Moving text is only acceptable if people can stop
 * it, so:
 *   • it pauses in place on hover and on keyboard focus (play-state, not a
 *     reset, so it never jumps back to the start);
 *   • a visible pause/play button holds it still;
 *   • under prefers-reduced-motion it does not move at all and becomes an
 *     ordinary horizontally scrollable row;
 *   • the duplicate copy is aria-hidden and out of the tab order, so screen
 *     readers and Tab see each item once.
 */

const SPEED = 42 // px per second — slow enough to read a chip as it passes

function Chip({ t, pillar, text, onOpen, hidden }) {
  return (
    <button type="button" onClick={() => onOpen(pillar.id)} tabIndex={hidden ? -1 : 0}
            className="inline-flex items-center gap-2 flex-shrink-0 rounded-full px-3.5 py-1.5 whitespace-nowrap"
            style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink, background: t.panel, border: `1px solid ${t.hairline}` }}>
      <span className="rounded-full" style={{ width: 7, height: 7, background: pillar.accent }} aria-hidden="true" />
      <span style={{ color: t.inkDim }}>{pillar.title}</span> · {text}
    </button>
  )
}

export function WhatsNew({ t, items, onOpen }) {
  const reduce = useReducedMotion()
  const setRef = useRef(null)
  const [duration, setDuration] = useState(40)
  const [held, setHeld] = useState(false)     // the pause button
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)

  // Duration follows the content, so speed stays constant however many NEW
  // highlights the pillars carry.
  useLayoutEffect(() => {
    const w = setRef.current?.offsetWidth
    if (w) setDuration(Math.max(18, w / SPEED))
  }, [items])

  if (!items.length) return null
  const running = !held && !hover && !focus

  return (
    <section aria-label="What's new" className="mt-8 flex items-center gap-3">
      <style>{'@keyframes whatsnew-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }'}</style>

      <span className="inline-flex items-center gap-1.5 flex-shrink-0 rounded-full px-3 py-1.5"
            style={{ ...LBL, fontSize: 10.5, color: t.panel, background: t.ink }}>
        <Sparkles size={12} aria-hidden="true" /> What's new
      </span>

      {!reduce && (
        <button type="button" onClick={() => setHeld((h) => !h)} aria-pressed={held}
                aria-label={held ? 'Resume the what’s new ticker' : 'Pause the what’s new ticker'}
                title={held ? 'Resume' : 'Pause'}
                className="grid place-items-center rounded-full flex-shrink-0"
                style={{ width: 30, height: 30, color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
          {held ? <Play size={12} /> : <Pause size={12} />}
        </button>
      )}

      {reduce ? (
        <div className="flex-1 min-w-0 flex gap-3 overflow-x-auto pb-1">
          {items.map(({ pillar, text }) => <Chip key={pillar.id + text} t={t} pillar={pillar} text={text} onOpen={onOpen} />)}
        </div>
      ) : (
        <div className="relative flex-1 min-w-0 overflow-hidden"
             onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
             onFocus={() => setFocus(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false) }}
             style={{
               maskImage: 'linear-gradient(90deg, transparent, #000 48px, #000 calc(100% - 48px), transparent)',
               WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 48px, #000 calc(100% - 48px), transparent)',
             }}>
          <div className="flex w-max py-0.5"
               style={{
                 animation: `whatsnew-marquee ${duration}s linear infinite`,
                 animationPlayState: running ? 'running' : 'paused',
               }}>
            {/* Two identical halves; each carries its own trailing gap so the
                half-width shift lands exactly on the start of the copy. */}
            <div ref={setRef} className="flex gap-3 pr-3">
              {items.map(({ pillar, text }) => <Chip key={pillar.id + text} t={t} pillar={pillar} text={text} onOpen={onOpen} />)}
            </div>
            <div className="flex gap-3 pr-3" aria-hidden="true">
              {items.map(({ pillar, text }) => <Chip key={`dup-${pillar.id}${text}`} t={t} pillar={pillar} text={text} onOpen={onOpen} hidden />)}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
