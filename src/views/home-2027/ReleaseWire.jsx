import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Megaphone, Pause, Play, ArrowUpRight, Sparkles, RefreshCw, Check, AlertTriangle } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { deepBand } from '../runtime-launch/diagramKit'
import { shade, bandBg, bandDots } from './band'

/**
 * ReleaseWire — Prisma AIRS release notes as a news wire docked to the bottom
 * of the launcher home.
 *
 * Docked, not placed in the page: the tiles are the page, and a strip above
 * them would push the run of show down and compete with it. At the bottom it
 * reads like a broadcast chyron — ambient, always in view, never in the way.
 * It is sticky inside #root, so it overlays nothing when the page fits and
 * stays in view when a short screen scrolls.
 *
 * Every release carries the colour and icon of the pillar that demos its
 * product area (useReleaseFeed's AREA_PILLAR). Hovering one previews it above
 * the wire and lifts that pillar's tile — the product news and the run of show
 * are one picture. Click opens the release sheet.
 *
 * Motion rules, same as WhatsNew: pauses in place on hover, a visible pause
 * button, static under prefers-reduced-motion. The moving copy is aria-hidden
 * with no tab stops — focusing a moving item makes the browser scroll the
 * clipped track out from under the animation. Keyboard and screen-reader users
 * get the label button instead, which opens the sheet where ←/→ browse every
 * release.
 *
 * Freshness lives in the band's left tile, where the icon would be: a refresh
 * icon over the time the server last read docs.paloaltonetworks.com ("13:30").
 * The tile is the refresh button (a forced re-read, ~10–20s; the server also
 * re-reads once a day). A refresh that fails keeps the last complete fetch; the
 * tile turns amber and its tooltip says why — or which month was missing.
 */

const SPEED = 36          // px per second
const PREVIEW_W = 384
const EASE = [0.22, 1, 0.36, 1]

const pad = (n) => String(n).padStart(2, '0')
const shortMonth = (label) => { const [m, y] = label.split(' '); return { m: m.slice(0, 3), y } }

export function spanLabel(feed) {
  const a = shortMonth(feed.oldest), b = shortMonth(feed.latest)
  return a.y === b.y ? `${a.m} – ${b.m} ${b.y}` : `${a.m} ${a.y} – ${b.m} ${b.y}`
}

/** "Demo the product area in step 05 · Red Teaming" — or null when no pillar shows it. */
export function demoLine(item) {
  const p = item.pillar
  if (!p) return null
  return p.run ? `step ${pad(p.run)} · ${p.title}` : p.title
}

/** A release's gradient app icon: its pillar's, or a neutral sparkle. */
export function ReleaseIcon({ item, size = 26, radius = 8 }) {
  const Icon = item.pillar?.icon ?? Sparkles
  return (
    <span className="grid place-items-center flex-shrink-0" aria-hidden="true"
          style={{ width: size, height: size, borderRadius: radius, background: bandBg(item.tone) }}>
      <Icon style={{ width: size * 0.5, height: size * 0.5, color: '#fff' }} />
    </span>
  )
}

function Item({ t, item, idx, active, focusable, onEnter, onOpen }) {
  const liveText = t.isLight ? shade(t.live, 0.25) : '#9DB6FA'
  return (
    // The moving copies never take focus, even from a click: focus would come
    // back to an aria-hidden button when the sheet closes.
    <button type="button" tabIndex={focusable ? 0 : -1} aria-haspopup={focusable ? 'dialog' : undefined}
            onClick={() => onOpen(idx)} onMouseEnter={(e) => onEnter(idx, e.currentTarget)}
            onMouseDown={focusable ? undefined : (e) => e.preventDefault()}
            onFocus={focusable ? (e) => { e.currentTarget.style.boxShadow = `inset 0 0 0 2px ${t.live}`; onEnter(idx, e.currentTarget) } : undefined}
            onBlur={focusable ? (e) => { e.currentTarget.style.boxShadow = 'none' } : undefined}
            className="relative inline-flex items-center gap-2.5 flex-shrink-0 whitespace-nowrap rounded-xl focus-visible:outline-none"
            style={{
              height: 44, padding: '0 14px 0 8px', cursor: 'pointer',
              background: active ? t.sunken : 'transparent', transition: 'background 160ms ease',
            }}>
      <ReleaseIcon item={item} />
      <span className="flex flex-col text-left" style={{ lineHeight: 1.2 }}>
        <span style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim }}>
          {item.category}{item.pillar?.run ? ` · step ${pad(item.pillar.run)}` : ''}
        </span>
        <span style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 600, color: t.ink, marginTop: 1 }}>{item.title}</span>
      </span>
      {item.fresh && (
        <span className="rounded-full px-2 py-0.5" style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600, color: liveText, background: `${t.live}1f` }}>new</span>
      )}
    </button>
  )
}

function MonthMark({ t, label, count, onEnter }) {
  return (
    <span onMouseEnter={onEnter} className="inline-flex items-center gap-1.5 flex-shrink-0 rounded-full whitespace-nowrap"
          style={{ ...LBL, fontSize: 9.5, color: t.panel, background: t.ink, padding: '5px 11px', margin: '0 10px 0 14px' }}>
      {label}
      <span style={{ opacity: 0.55 }}>· {count}</span>
    </span>
  )
}

const Dot = ({ t }) => (
  <span aria-hidden="true" className="rounded-full flex-shrink-0" style={{ width: 4, height: 4, margin: '0 4px', background: t.inkFaint, opacity: 0.7 }} />
)

function Preview({ t, item, x, w }) {
  const left = Math.max(12, Math.min(x - PREVIEW_W / 2, w - PREVIEW_W - 12))
  const Icon = item.pillar?.icon ?? Sparkles
  const demo = demoLine(item)
  const tone = item.tone
  return (
    <motion.div role="tooltip" className="absolute pointer-events-none"
                initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18, ease: EASE }}
                style={{ left, bottom: 'calc(100% + 12px)', width: PREVIEW_W, zIndex: 2 }}>
      <div className="overflow-hidden" style={{ borderRadius: 20, background: t.panel, border: `1px solid ${tone}55`, boxShadow: `0 20px 44px ${tone}38, ${t.shadow}` }}>
        <div className="relative overflow-hidden" style={{ background: deepBand(tone), padding: '14px 16px 15px' }}>
          <div aria-hidden="true" className="absolute inset-0" style={bandDots} />
          <Icon aria-hidden="true" strokeWidth={1.4}
                style={{ position: 'absolute', right: -18, bottom: -34, width: 118, height: 118, color: '#fff', opacity: 0.14, transform: 'rotate(-10deg)' }} />
          <div className="relative" style={{ ...LBL, fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>{item.category} · {item.month}</div>
          <div className="relative" style={{
            fontFamily: FONT.display, fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.25, marginTop: 5, maxWidth: '90%',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{item.title}</div>
        </div>
        {item.summary && (
          <p style={{
            padding: '12px 16px 0', fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.inkDim,
            display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{item.summary}</p>
        )}
        <div className="flex items-center gap-2" style={{ padding: '12px 16px 14px' }}>
          {demo ? (
            <>
              <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 22, height: 22, background: `${tone}1c` }}>
                <Icon size={12} style={{ color: t.isLight ? shade(tone, 0.25) : tone }} aria-hidden="true" />
              </span>
              <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.ink }}>Demo the area in {demo}</span>
            </>
          ) : (
            <span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>Not part of this portal’s demos</span>
          )}
          <span className="ml-auto flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkFaint }}>click to open</span>
        </div>
      </div>
      {/* the nub, pointing at the release it describes */}
      <span aria-hidden="true" className="absolute"
            style={{ left: x - left - 7, bottom: -6, width: 14, height: 14, background: t.panel, transform: 'rotate(45deg)',
                     borderRight: `1px solid ${tone}55`, borderBottom: `1px solid ${tone}55` }} />
    </motion.div>
  )
}

/** "today 12:15" · "yesterday 18:02" · "Sep 21, 09:30" — when the docs were last read. */
function fetchedLabel(iso) {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return null
  const now = new Date()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  if (d.toDateString() === now.toDateString()) return `today ${time}`
  if (d.toDateString() === new Date(now.getTime() - 86400000).toDateString()) return `yesterday ${time}`
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`
}

/** The tile's two lines: { day: "Sep 28", time: "13:30" }. */
function tileStamp(iso) {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return null
  return {
    day: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
  }
}

const FULL = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' }
const SERVER_TTL_MS = 24 * 60 * 60 * 1000   // server.js RN_TTL_MS
const PARTIAL_TTL_MS = 10 * 60 * 1000       // a fetch with a month missing is retried sooner

/** True for a moment after a refresh that worked — the tile's check and the "up to date" line. */
function useJustRefreshed(refreshing, refreshError) {
  const [done, setDone] = useState(false)
  const prev = useRef(refreshing)
  useEffect(() => {
    const finished = prev.current && !refreshing
    prev.current = refreshing
    if (!finished || refreshError) return undefined
    setDone(true)
    const id = setTimeout(() => setDone(false), 2600)
    return () => clearTimeout(id)
  }, [refreshing, refreshError])
  return done
}

/**
 * The band's left tile: a refresh icon over the date and time of the latest
 * fetch. It is the refresh button; hovering or focusing it opens FetchCard.
 */
function RefreshTile({ fetchedAt, failedMonths, refreshing, refreshError, done, fresh, reduce, onRefresh, onPeek }) {
  const partial = failedMonths?.length > 0
  const warn = !refreshing && !done && (refreshError || partial)
  const Icon = refreshing ? RefreshCw : done ? Check : warn ? AlertTriangle : RefreshCw
  const st = tileStamp(fetchedAt)
  const line1 = refreshing ? 'fetching' : refreshError ? 'failed' : st?.day ?? 'fetch'
  const line2 = refreshing ? '···' : st?.time ?? 'now'
  const when = fetchedLabel(fetchedAt)
  return (
    <button type="button" onClick={onRefresh} disabled={refreshing}
            aria-label={refreshing ? 'Fetching the release notes' : `Refresh the release notes${when ? ` — last fetched ${when}` : ''}`}
            aria-describedby="release-fetch-card"
            onMouseEnter={(e) => { onPeek(e.currentTarget); if (!refreshing) e.currentTarget.style.background = 'rgba(255,255,255,0.28)' }}
            onMouseLeave={(e) => { onPeek(null); e.currentTarget.style.background = 'rgba(255,255,255,0.16)' }}
            onFocus={(e) => { e.currentTarget.style.outline = '2px solid #fff'; e.currentTarget.style.outlineOffset = '2px'; onPeek(e.currentTarget) }}
            onBlur={(e) => { e.currentTarget.style.outline = 'none'; onPeek(null) }}
            className="relative flex flex-col items-center justify-center rounded-xl flex-shrink-0 transition-colors focus-visible:outline-none"
            style={{ width: 52, height: 48, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)', cursor: refreshing ? 'progress' : 'pointer' }}>
      <Icon size={13} strokeWidth={2.4} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" style={{ color: warn ? '#FCD34D' : '#fff' }} />
      <span style={{ fontFamily: FONT.mono, fontSize: 9, fontWeight: 600, lineHeight: 1, marginTop: 4, color: warn ? '#FCD34D' : 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}>{line1}</span>
      <span style={{ fontFamily: FONT.mono, fontSize: 9.5, fontWeight: 700, lineHeight: 1, marginTop: 2, color: warn ? '#FCD34D' : '#fff', whiteSpace: 'nowrap' }}>{line2}</span>
      {fresh > 0 && (
        <span aria-hidden="true" className="absolute" style={{ top: -3, right: -3, width: 10, height: 10 }}>
          {!reduce && <span className="absolute inset-0 rounded-full" style={{ background: '#fff', animation: 'release-ping 1.8s ease-out infinite' }} />}
          <span className="absolute inset-0 rounded-full" style={{ background: '#fff', border: '2px solid rgba(20,40,110,0.9)' }} />
        </span>
      )}
    </button>
  )
}

/**
 * The latest fetch, in full: the timestamp, where it came from, and when the
 * next automatic fetch happens — the server re-reads the docs on the first
 * request after its cache is a day old (ten minutes after a partial fetch),
 * and 2 s after it starts. Rendered at the wire's level: the band clips.
 */
function FetchCard({ t, x, feed, refreshing, refreshError }) {
  const d = feed.fetchedAt ? new Date(feed.fetchedAt) : null
  const valid = d && !Number.isNaN(d.getTime())
  const partial = feed.failedMonths?.length > 0
  const next = valid ? new Date(d.getTime() + (partial ? PARTIAL_TTL_MS : SERVER_TTL_MS)) : null
  const tone = refreshError || partial ? t.warn : t.live
  const rows = [
    ['Source', `docs.paloaltonetworks.com · ${feed.months.length} months · ${feed.total} releases`],
    ['Auto-refresh', next
      ? `${partial ? 'in 10 minutes' : 'daily'} — next on the first visit after ${next.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}`
      : 'daily, on the first visit'],
    partial ? ['Missing', `${feed.failedMonths.join(', ')} did not answer — retried automatically`] : null,
    refreshError ? ['Last try', `failed — ${refreshError}`] : null,
  ].filter(Boolean)
  return (
    <motion.div id="release-fetch-card" role="tooltip" className="absolute pointer-events-none"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.16, ease: EASE }}
                style={{ left: Math.max(10, x), bottom: 'calc(100% + 12px)', width: 320, zIndex: 3 }}>
      <div className="overflow-hidden" style={{ borderRadius: 18, background: t.panel, border: `1px solid ${tone}55`, boxShadow: `0 18px 40px ${tone}30, ${t.shadow}` }}>
        <div className="relative overflow-hidden" style={{ background: deepBand(tone), padding: '12px 14px' }}>
          <div aria-hidden="true" className="absolute inset-0" style={bandDots} />
          <div className="relative" style={{ ...LBL, fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>{refreshing ? 'Fetching now…' : 'Latest fetch'}</div>
          <div className="relative" style={{ fontFamily: FONT.display, fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 4, lineHeight: 1.25 }}>
            {valid ? d.toLocaleString([], FULL) : 'Not fetched yet'}
          </div>
        </div>
        <div style={{ padding: '6px 14px 10px' }}>
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-3 py-1.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
              <span className="flex-shrink-0" style={{ width: 78, fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.inkDim }}>{k}</span>
              <span style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: k === 'Missing' || k === 'Last try' ? (t.isLight ? shade(t.warn, 0.4) : t.warn) : t.ink }}>{v}</span>
            </div>
          ))}
          <div style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 4 }}>
            {refreshing ? 'Reading every month page again — 10 to 20 seconds.' : 'Click the tile to fetch now · takes 10–20 s.'}
          </div>
        </div>
      </div>
      <span aria-hidden="true" className="absolute" style={{ left: 20, bottom: -6, width: 12, height: 12, background: t.panel, transform: 'rotate(45deg)', borderRight: `1px solid ${tone}55`, borderBottom: `1px solid ${tone}55` }} />
    </motion.div>
  )
}

export function ReleaseWire({ t, feed, onOpen, onSpot, onAll, paused = false, onRefresh, refreshing = false, refreshError = null }) {
  const reduce = useReducedMotion()
  const rootRef = useRef(null)
  const setRef = useRef(null)
  const [duration, setDuration] = useState(300)
  const [held, setHeld] = useState(false)
  const [hover, setHover] = useState(false)
  const [preview, setPreview] = useState(null)   // { idx, x, w }
  const [allHot, setAllHot] = useState(false)
  const [labelHot, setLabelHot] = useState(false)
  const justRefreshed = useJustRefreshed(refreshing, refreshError)
  const [peek, setPeek] = useState(null)   // x of the refresh tile while hovered/focused
  const peekAt = (el) => {
    if (!el) { setPeek(null); return }
    const root = rootRef.current?.getBoundingClientRect()
    if (root) setPeek(el.getBoundingClientRect().left - root.left)
  }


  // Duration follows the content, so the speed stays constant as PA publishes.
  useLayoutEffect(() => {
    const w = setRef.current?.offsetWidth
    if (w) setDuration(Math.max(30, w / SPEED))
  }, [feed.items])

  const groups = useMemo(() => {
    const out = []
    feed.items.forEach((item, idx) => {
      let g = out[out.length - 1]
      if (!g || g.slug !== item.slug) { g = { slug: item.slug, month: item.month, entries: [] }; out.push(g) }
      g.entries.push({ item, idx })
    })
    return out
  }, [feed.items])

  const enter = (idx, el) => {
    const root = rootRef.current?.getBoundingClientRect()
    if (!root) return
    const r = el.getBoundingClientRect()
    setPreview({ idx, x: r.left + r.width / 2 - root.left, w: root.width })
    onSpot(feed.items[idx].pillar?.id ?? null)
  }
  const clear = () => { setPreview(null); onSpot(null) }
  const open = (idx) => { clear(); setHover(false); onOpen(idx) }

  const running = !held && !hover && !paused
  const liveDark = shade(t.live)

  const copy = (focusable) => groups.map((g) => (
    <React.Fragment key={g.slug}>
      <MonthMark t={t} label={g.month} count={g.entries.length} onEnter={clear} />
      {g.entries.map(({ item, idx }, i) => (
        <React.Fragment key={item.key}>
          {i > 0 && <Dot t={t} />}
          <Item t={t} item={item} idx={idx} active={preview?.idx === idx} focusable={focusable} onEnter={enter} onOpen={open} />
        </React.Fragment>
      ))}
    </React.Fragment>
  ))

  return (
    <motion.section ref={rootRef} aria-label="What's new in Prisma AIRS"
                    initial={reduce ? false : { y: 76, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.55, ease: EASE }}
                    className="sticky bottom-0 z-20 flex-shrink-0"
                    style={{
                      background: t.isLight ? 'rgba(255,255,255,0.9)' : 'rgba(32,32,36,0.9)',
                      backdropFilter: 'blur(14px) saturate(1.15)', WebkitBackdropFilter: 'blur(14px) saturate(1.15)',
                      borderTop: `1px solid ${t.hairline}`,
                      boxShadow: t.isLight ? '0 -10px 30px rgba(18,18,22,0.07)' : '0 -10px 30px rgba(0,0,0,0.4)',
                    }}>
      <style>{`
        @keyframes release-wire { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes release-shine { from { transform: translateX(-120%) skewX(-18deg) } to { transform: translateX(260%) skewX(-18deg) } }
        @keyframes release-ping { 0% { transform: scale(1); opacity: .7 } 80%, 100% { transform: scale(2.6); opacity: 0 } }
      `}</style>

      <div className="relative flex items-stretch" style={{ height: 62 }}>
        {/* ── the band: the refresh tile (with the fetch time), then the label —
            the keyboard's way into the releases. Siblings, never a button in a button. ── */}
        <div className="relative flex items-center gap-3 flex-shrink-0 overflow-hidden pl-4 lg:pl-8"
             onMouseEnter={() => setLabelHot(true)} onMouseLeave={() => setLabelHot(false)}
             style={{ background: deepBand(t.live), paddingRight: 44, zIndex: 1, clipPath: 'polygon(0 0, 100% 0, calc(100% - 22px) 100%, 0 100%)' }}>
          <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
          <span aria-hidden="true" className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 92% 20%, rgba(255,255,255,0.3), transparent 62%)', opacity: labelHot ? 1 : 0.45, transition: 'opacity 220ms ease' }} />
          {!reduce && (
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1/3 pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)', animation: 'release-shine 1.6s 1.1s ease-out both' }} />
          )}
          <Megaphone aria-hidden="true" strokeWidth={1.4}
                     style={{ position: 'absolute', right: 26, bottom: -30, width: 92, height: 92, color: '#fff', opacity: 0.13, pointerEvents: 'none', transform: labelHot && !reduce ? 'rotate(-4deg) scale(1.06)' : 'rotate(-10deg)', transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)' }} />

          {onRefresh && (
            <RefreshTile fetchedAt={feed.fetchedAt} failedMonths={feed.failedMonths} refreshing={refreshing}
                         refreshError={refreshError} done={justRefreshed} fresh={feed.fresh} reduce={reduce} onRefresh={onRefresh} onPeek={peekAt} />
          )}

          <button type="button" onClick={() => open(0)}
                  aria-label={`What's new in Prisma AIRS: ${feed.total} releases, ${spanLabel(feed)}${feed.fresh ? `, ${feed.fresh} new since your last visit` : ''}. Open to browse.`}
                  onFocus={(e) => { e.currentTarget.style.outline = '2px solid #fff'; e.currentTarget.style.outlineOffset = '4px' }}
                  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
                  className="relative hidden sm:flex flex-col text-left rounded-lg focus-visible:outline-none" style={{ cursor: 'pointer', lineHeight: 1 }}>
            <span style={{ ...LBL, fontSize: 9, color: 'rgba(255,255,255,0.8)' }}>From the release notes</span>
            <span style={{ fontFamily: FONT.display, fontSize: 14.5, fontWeight: 700, color: '#fff', marginTop: 5, letterSpacing: '-0.01em' }}>What’s new in Prisma AIRS</span>
            <span style={{ fontFamily: FONT.prose, fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>
              {feed.fresh > 0 ? `${feed.fresh} new since your last visit` : `${feed.total} releases · ${spanLabel(feed)}`}
            </span>
          </button>
        </div>

        {/* ── the wire ── */}
        {reduce ? (
          <div className="flex-1 min-w-0 flex items-center overflow-x-auto" onScroll={clear} onMouseLeave={clear}>
            <div className="flex items-center w-max pr-3">{copy(true)}</div>
          </div>
        ) : (
          <div aria-hidden="true" className="relative flex-1 min-w-0 overflow-hidden"
               onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); clear() }}
               style={{
                 marginLeft: -22,   // the wire runs in under the label's slant
                 maskImage: 'linear-gradient(90deg, transparent, #000 40px, #000 calc(100% - 48px), transparent)',
                 WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 40px, #000 calc(100% - 48px), transparent)',
               }}>
            <div className="flex items-center h-full w-max"
                 style={{
                   // Longhands only: React warns when a shorthand and
                   // animationPlayState change in the same render.
                   animationName: 'release-wire', animationDuration: `${duration}s`, animationTimingFunction: 'linear',
                   animationIterationCount: 'infinite', animationPlayState: running ? 'running' : 'paused',
                 }}>
              {/* Two identical halves, each with its own trailing gap, so the
                  half-width shift lands exactly on the start of the copy. */}
              <div ref={setRef} className="flex items-center h-full pl-6 pr-2">{copy(false)}</div>
              <div className="flex items-center h-full pl-6 pr-2">{copy(false)}</div>
            </div>
          </div>
        )}

        {/* ── controls ── */}
        <div className="flex items-center gap-2 flex-shrink-0 pl-3 pr-4 lg:pr-8" style={{ borderLeft: `1px solid ${t.hairline}` }}>
          {!reduce && (
            <button type="button" onClick={() => setHeld((h) => !h)} aria-pressed={held}
                    aria-label={held ? 'Resume the release wire' : 'Pause the release wire'} title={held ? 'Resume' : 'Pause'}
                    className="grid place-items-center rounded-full flex-shrink-0"
                    style={{ width: 32, height: 32, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
              {held ? <Play size={12} /> : <Pause size={12} />}
            </button>
          )}
          <button type="button" onClick={onAll}
                  onMouseEnter={() => setAllHot(true)} onMouseLeave={() => setAllHot(false)}
                  className="hidden md:inline-flex items-center gap-1.5 rounded-full whitespace-nowrap"
                  style={{
                    height: 34, padding: '0 14px', fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600,
                    color: allHot ? '#fff' : t.ink, background: allHot ? liveDark : t.sunken,
                    border: `1px solid ${allHot ? liveDark : t.hairline}`, transition: 'background 160ms ease, color 160ms ease',
                  }}>
            All {feed.total} releases <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {peek != null && <FetchCard key="fetch" t={t} x={peek} feed={feed} refreshing={refreshing} refreshError={refreshError} />}
      </AnimatePresence>
      <AnimatePresence>
        {preview && feed.items[preview.idx] && (
          <Preview key={preview.idx} t={t} item={feed.items[preview.idx]} x={preview.x} w={preview.w} />
        )}
      </AnimatePresence>
    </motion.section>
  )
}
