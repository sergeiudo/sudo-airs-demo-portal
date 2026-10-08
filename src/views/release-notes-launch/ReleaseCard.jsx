import React, { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, ChevronDown, ExternalLink } from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { shade } from '../home-2027/band'
import { ReleaseIcon } from '../home-2027/ReleaseWire'
import { GatewayHighlights } from './GatewayNotes'

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
const pad = (n) => String(n).padStart(2, '0')

/** Tag segments that add something the card does not already say. */
function extraTags(item) {
  const skip = new Set(['Prisma AIRS', item.category, item.month])
  return [...new Set((item.tags ?? []).flat().filter((seg) => seg && !skip.has(seg) && !/^\w+ 20\d\d$/.test(seg)))]
}

/**
 * One release, in the launch look: its pillar's gradient app icon, the title,
 * the product area in the pillar's colour, the first paragraph (all of them on
 * "Read more"), and a footer that says where the portal demos the product area
 * — never that it demos this exact feature — plus the feature's own docs page.
 *
 * An AI Gateway release (source 'gateway') is a whole gateway version: the
 * body lists its highlights and counts, and `onNotes` opens its full notes.
 */
export function ReleaseCard({ t, item, onDemo, onNotes, index = 0 }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [hot, setHot] = useState(false)
  const [demoHot, setDemoHot] = useState(false)
  const tone = item.tone
  const ink = t.isLight ? shade(tone, 0.3) : tone
  const paras = item.paragraphs?.length ? item.paragraphs : item.summary ? [item.summary] : []
  const more = paras.length > 1 || (paras[0]?.length ?? 0) > 260
  const tags = extraTags(item)
  const updated = item.lastUpdated && item.lastUpdated !== item.releaseDate ? item.lastUpdated : null
  const p = item.pillar
  const gateway = item.source === 'gateway'

  return (
    <motion.article initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
                    className="flex flex-col rounded-[20px] overflow-hidden min-w-0"
                    style={{
                      background: t.panel, border: `1px solid ${hot ? `${tone}66` : t.glassEdge}`,
                      boxShadow: hot ? `0 12px 28px ${tone}22` : t.shadowSm, transition: 'border-color 180ms ease, box-shadow 220ms ease',
                    }}>
      <div className="flex items-start gap-3 px-4 pt-4">
        <ReleaseIcon item={item} size={36} radius={12} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, lineHeight: '19px', color: ink, background: `${tone}17` }}>
              {item.category}
            </span>
            {item.fresh && (
              <span className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, lineHeight: '19px', color: '#fff', background: t.live }}>new</span>
            )}
            {updated && <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint }}>updated {updated}</span>}
            {gateway && item.releaseDate && <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{item.releaseDate}</span>}
          </div>
          <h3 style={{ fontFamily: FONT.display, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3, color: t.ink, marginTop: 6 }}>{gateway ? `AI Gateway ${item.version}` : item.title}</h3>
        </div>
      </div>

      {gateway && <GatewayHighlights t={t} item={item} onNotes={onNotes} />}

      {!gateway && paras.length > 0 && (
        <div className="px-4 pt-2">
          <p style={{
            fontFamily: FONT.prose, fontSize: 13, lineHeight: 1.6, color: t.inkDim,
            ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
          }}>{paras[0]}</p>
          <AnimatePresence initial={false}>
            {open && paras.length > 1 && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }} className="overflow-hidden">
                {paras.slice(1).map((x, i) => (
                  <p key={i} style={{ fontFamily: FONT.prose, fontSize: 13, lineHeight: 1.6, color: t.inkDim, marginTop: 8 }}>{x}</p>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {more && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
                    className={`inline-flex items-center gap-1 mt-1.5 rounded-full ${focusCls}`}
                    style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.isLight ? shade(t.live, 0.2) : '#9DB6FA' }}>
              {open ? 'Show less' : paras.length > 1 ? `Read more · ${paras.length - 1} more paragraph${paras.length > 2 ? 's' : ''}` : 'Read more'}
              <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-2.5">
          {tags.map((x) => (
            <span key={x} className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: '19px', color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>{x}</span>
          ))}
        </div>
      )}

      <div className="flex-1" />
      <div className="flex items-center gap-2 px-3 py-2.5 mt-3" style={{ borderTop: `1px solid ${t.hairline}` }}>
        {p ? (
          <button type="button" onClick={() => onDemo(p.id)} onMouseEnter={() => setDemoHot(true)} onMouseLeave={() => setDemoHot(false)}
                  className={`flex items-center gap-2 min-w-0 flex-1 rounded-xl px-1.5 py-1 text-left ${focusCls}`}
                  style={{ background: demoHot ? `${tone}12` : 'transparent', transition: 'background 140ms ease' }}>
            <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 26, height: 26, background: `${tone}1c`, color: ink }}>
              <p.icon size={13} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink }}>Demo the product area</span>
              <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{p.run ? `step ${pad(p.run)} · ` : ''}{p.title}</span>
            </span>
            <span className="grid place-items-center rounded-full flex-shrink-0 ml-auto" aria-hidden="true"
                  style={{ width: 24, height: 24, color: demoHot ? '#fff' : t.inkDim, background: demoHot ? shade(tone) : t.sunken, transition: 'background 140ms ease' }}>
              <ArrowUpRight size={12} />
            </span>
          </button>
        ) : (
          <span className="flex-1 px-1.5" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkFaint }}>Not part of this portal’s demos</span>
        )}
        <a href={item.url} target="_blank" rel="noopener noreferrer"
           className={`inline-flex items-center gap-1 rounded-full px-2.5 flex-shrink-0 ${focusCls}`}
           style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}
           onMouseEnter={(e) => { e.currentTarget.style.color = t.ink }} onMouseLeave={(e) => { e.currentTarget.style.color = t.inkDim }}>
          {gateway ? 'Changelog' : 'Docs'} <ExternalLink size={11} aria-hidden="true" />
        </a>
      </div>
    </motion.article>
  )
}
