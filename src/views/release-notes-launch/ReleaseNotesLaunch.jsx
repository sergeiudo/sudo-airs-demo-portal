import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Search, X, Sun, Moon, Megaphone, CalendarDays, Layers, SlidersHorizontal, Loader2, ExternalLink, Users, Sparkles, Check, AlertTriangle } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { tokens, FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots } from '../home-2027/band'
import { deepBand } from '../runtime-launch/diagramKit'
import { useReleaseFeed, NEUTRAL } from '../home-2027/useReleaseFeed'
import { RefreshTile, useJustRefreshed, fetchedLabel, spanLabel } from '../home-2027/ReleaseWire'
import { DesignSwitch } from '../../components/shared/DesignSwitch'
import { Tip } from '../../components/shared/Tip'
import { ReleaseCard } from './ReleaseCard'
import { GatewayNotesDrawer } from './GatewayNotes'
import { VisitorsDrawer } from './ServerHealth'
import { ServerStatusButton } from '../../components/shared/ServerStatus'
import airsLogo from '../../../prisma-AIRS_RGB_logo_Lockup_Negative.png'

/**
 * ReleaseNotesLaunch — What's new in Prisma AIRS, in the launch design.
 *
 * The same feed the home page's release wire reads (useReleaseFeed: one
 * module cache and a localStorage copy, so coming from the wire paints at
 * once), laid out as a page you can work through: a band that says what the
 * feed is and when it was read, a rail to jump between months and filter by
 * product area, and the releases as cards in their pillar's colour — each one
 * saying where the portal demos its product area and linking to its own docs
 * page. Server status sits in the app bar (as on the home page); the
 * visitor log stays at the foot.
 *
 * Two sources, one feed: PA's by-date docs and the AI Gateway (Portkey
 * Enterprise Gateway) changelog, whose releases sit in their month under the
 * product area "AI Gateway" and open their full notes in a drawer.
 *
 * Classic (ReleaseNotesView) is kept behind the Design switch.
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
const SERVER_TTL_MS = 24 * 60 * 60 * 1000

function RailCard({ t, icon: Icon, title, children }) {
  return (
    <div className="rounded-[20px] overflow-hidden" style={{ background: t.panel, border: `1px solid ${t.glassEdge}`, boxShadow: t.shadowSm }}>
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-1.5">
        <Icon size={13} style={{ color: t.inkDim }} aria-hidden="true" />
        <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>{title}</span>
      </div>
      <div className="px-1.5 pb-1.5">{children}</div>
    </div>
  )
}

function RailRow({ t, active, tone, onClick, children, count, disabled, role = 'button', checked }) {
  const [hot, setHot] = useState(false)
  return (
    <button type="button" onClick={onClick} disabled={disabled} role={role === 'button' ? undefined : role}
            aria-checked={role === 'button' ? undefined : checked} aria-current={role === 'button' && active ? 'true' : undefined}
            onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1 text-left disabled:opacity-45 ${focusCls}`}
            style={{ minHeight: 34, background: active ? `${tone}17` : hot && !disabled ? t.sunken : 'transparent', transition: 'background 140ms ease' }}>
      {children}
      {count != null && (
        <span className="ml-auto flex-shrink-0 rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, lineHeight: '19px', color: active ? (t.isLight ? shade(tone, 0.3) : tone) : t.inkDim, background: active ? `${tone}1f` : t.sunken }}>{count}</span>
      )}
    </button>
  )
}

function Check2({ t, on, tone }) {
  return (
    <span className="grid place-items-center rounded-md flex-shrink-0" aria-hidden="true"
          style={{ width: 17, height: 17, background: on ? shade(tone, 0.15) : 'transparent', border: `1.5px solid ${on ? 'transparent' : t.inkFaint}` }}>
      {on && <Check size={11} strokeWidth={3} style={{ color: '#fff' }} />}
    </span>
  )
}

function GlassStat({ label, value, sub }) {
  return (
    <div className="rounded-2xl px-3.5 py-2.5 min-w-0" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.22)' }}>
      <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>{label}</div>
      <div className="truncate" style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.15, marginTop: 2 }}>{value}</div>
      {sub && <div className="truncate" title={sub} style={{ fontFamily: FONT.prose, fontSize: 10.5, color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

export function ReleaseNotesLaunch() {
  const { state, dispatch } = useAppContext()
  const reduce = useReducedMotion()
  const base = useMemo(() => tokens(state.isDark === false), [state.isDark])
  // Secondary text sits on the grey ground — the launcher's darker dim.
  const t = useMemo(() => (base.isLight ? { ...base, inkDim: '#55555D' } : base), [base])
  const { feed, refresh, refreshing, refreshError, loadError } = useReleaseFeed()
  const justRefreshed = useJustRefreshed(refreshing, refreshError)
  const [q, setQ] = useState('')
  const [area, setArea] = useState('')
  const [onlyNew, setOnlyNew] = useState(false)
  const [onlyDemo, setOnlyDemo] = useState(false)
  const [activeMonth, setActiveMonth] = useState(null)
  const [visitors, setVisitors] = useState(false)
  const [notes, setNotes] = useState(null)
  const sections = useRef(new Map())

  // globals.css locks #root; this page scrolls.
  useEffect(() => {
    const root = document.getElementById('root')
    const prev = root?.style.overflow || ''
    if (root) root.style.overflow = 'auto'
    return () => { if (root) root.style.overflow = prev }
  }, [])

  const areas = useMemo(() => {
    if (!feed) return []
    const m = new Map()
    for (const i of feed.items) {
      const a = m.get(i.category) ?? { name: i.category, count: 0, tone: i.tone, pillar: i.pillar }
      a.count += 1
      m.set(i.category, a)
    }
    return [...m.values()].sort((a, b) => (!!b.pillar - !!a.pillar) || b.count - a.count)
  }, [feed])

  const needle = q.trim().toLowerCase()
  const filtered = useMemo(() => (feed?.items ?? []).filter((i) =>
    (!area || i.category === area)
    && (!onlyNew || i.fresh)
    && (!onlyDemo || i.pillar)
    && (!needle || i.haystack.includes(needle))), [feed, area, onlyNew, onlyDemo, needle])

  const groups = useMemo(() => {
    if (!feed) return []
    return feed.months.map((m) => ({ ...m, items: filtered.filter((i) => i.slug === m.slug) })).filter((g) => g.items.length)
  }, [feed, filtered])
  const filtering = !!(area || onlyNew || onlyDemo || needle)
  const clear = () => { setQ(''); setArea(''); setOnlyNew(false); setOnlyDemo(false) }

  // Scroll spy: the month whose section is nearest the top.
  useEffect(() => {
    const els = [...sections.current.values()]
    if (!els.length) return undefined
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) setActiveMonth(vis[0].target.dataset.slug)
    }, { rootMargin: '-96px 0px -55% 0px' })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [groups])

  const jump = (slug) => {
    const el = sections.current.get(slug)
    if (el) { el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); setActiveMonth(slug) }
  }
  const bind = (slug) => (el) => { if (el) sections.current.set(slug, el); else sections.current.delete(slug) }
  const demo = useCallback((id) => dispatch({ type: 'SET_VIEW', payload: id }), [dispatch])
  const closeVisitors = useCallback(() => setVisitors(false), [])
  const closeNotes = useCallback(() => setNotes(null), [])

  const demoCount = feed?.items.filter((i) => i.pillar).length ?? 0
  const latest = feed?.months[0]
  const fetched = feed ? fetchedLabel(feed.fetchedAt) : null
  const nextFetch = feed?.fetchedAt ? new Date(new Date(feed.fetchedAt).getTime() + SERVER_TTL_MS) : null
  const gw = feed?.gateway

  return (
    <div className="relative min-h-screen w-full flex flex-col" style={{ background: t.ground, overflowX: 'clip' }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
        backgroundSize: '44px 44px',
      }} />

      {/* ── app bar ── */}
      <header className="sticky top-0 z-30 flex-shrink-0" style={{ background: t.isLight ? 'rgba(233,233,235,0.86)' : 'rgba(21,21,23,0.86)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: `1px solid ${t.hairline}` }}>
        <div className="mx-auto flex items-center gap-4 px-6 lg:px-10" style={{ maxWidth: 1560, height: 62 }}>
          <button type="button" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'home' })}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 flex-shrink-0 ${focusCls}`}
                  style={{ height: 36, fontFamily: FONT.prose, fontSize: 13, fontWeight: 600, color: t.ink, background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm }}>
            <ArrowLeft size={14} aria-hidden="true" /> Home
          </button>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <span className="grid place-items-center rounded-xl" style={{ width: 36, height: 36, background: bandBg(t.live), boxShadow: `0 5px 12px ${t.live}44` }}>
              <Megaphone size={16} style={{ color: '#fff' }} aria-hidden="true" />
            </span>
            <div className="leading-none hidden sm:block">
              <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink }}>Release notes</div>
              <div style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 3 }}>What’s new in Prisma AIRS</div>
            </div>
          </div>

          <label className="hidden md:flex items-center gap-2.5 mx-auto rounded-full px-4"
                 style={{ height: 40, flex: '0 1 460px', minWidth: 180, background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm }}>
            <Search size={15} style={{ color: t.inkDim, flexShrink: 0 }} aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search releases — titles, text, product areas…" aria-label="Search releases"
                   ref={(el) => el?.style.setProperty('background-color', 'transparent', 'important')}
                   className="flex-1 min-w-0 outline-none" style={{ fontFamily: FONT.prose, fontSize: 13.5, color: t.ink, border: 'none' }} />
            {q && (
              <>
                <span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, whiteSpace: 'nowrap' }}>{filtered.length} found</span>
                <button type="button" onClick={() => setQ('')} aria-label="Clear the search" className={`rounded-full ${focusCls}`}><X size={14} style={{ color: t.inkDim }} /></button>
              </>
            )}
          </label>

          <div className="ml-auto md:ml-0 flex items-center gap-2 flex-shrink-0">
            <ServerStatusButton t={t} />
            <DesignSwitch />
            <Tip title={state.isDark ? 'Light mode' : 'Dark mode'} text={`Switch the whole portal to the ${state.isDark ? 'light' : 'dark'} theme`}>
              <button type="button" onClick={() => dispatch({ type: 'TOGGLE_THEME' })} aria-label={state.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                      className={`grid place-items-center rounded-full flex-shrink-0 ${focusCls}`}
                      style={{ width: 38, height: 38, color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
                {state.isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </Tip>
            <span className="hidden xl:inline-flex items-center rounded-xl px-3" style={{ height: 38, background: t.isLight ? '#1f2430' : 'transparent' }}>
              <img src={airsLogo} alt="Prisma AIRS" style={{ height: 22 }} />
            </span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full flex-1 px-6 lg:px-10 py-6" style={{ maxWidth: 1560 }}>
        {/* ── the band ── */}
        <section aria-label="About this feed" className="relative overflow-hidden rounded-[24px]" style={{ background: deepBand(t.live), boxShadow: `0 16px 36px ${t.live}33` }}>
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 90% 0%, rgba(255,255,255,0.18), transparent 50%)' }} />
          <Megaphone aria-hidden="true" strokeWidth={1.2} style={{ position: 'absolute', right: -30, bottom: -60, width: 250, height: 250, color: '#fff', opacity: 0.1, transform: 'rotate(-10deg)' }} />
          <div className="relative flex items-center gap-5 px-6 py-5 flex-wrap">
            <div className="flex items-center gap-4 min-w-0 flex-1" style={{ minWidth: 320 }}>
              {feed
                ? <RefreshTile fetchedAt={feed.fetchedAt} failedMonths={feed.failedMonths} refreshing={refreshing} refreshError={refreshError}
                               done={justRefreshed} fresh={feed.fresh} reduce={reduce} onRefresh={refresh} onPeek={() => {}} />
                : <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 52, height: 48, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: '#fff' }} aria-hidden="true" />
                  </span>}
              <div className="min-w-0">
                <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>From docs.paloaltonetworks.com{gw?.count ? ' and the AI Gateway changelog' : ''}</div>
                <h1 style={{ fontFamily: FONT.display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.1, marginTop: 3 }}>What’s new in Prisma AIRS</h1>
                <p style={{ fontFamily: FONT.prose, fontSize: 13, color: 'rgba(255,255,255,0.92)', marginTop: 5 }} aria-live="polite">
                  {feed
                    ? <>
                        {feed.total} releases · {spanLabel(feed)}
                        {refreshing ? ' · re-reading every month page (10–20 s)…' : fetched ? ` · read ${fetched}` : ''}
                        {!refreshing && nextFetch && ` · refreshes daily — click the tile to read it now`}
                      </>
                    : loadError ? `Could not reach the release notes: ${loadError}` : 'Reading the release notes — 10 to 20 seconds on a cold server…'}
                </p>
                {(refreshError || feed?.failedMonths?.length > 0) && !refreshing && (
                  <p className="inline-flex items-center gap-1.5 mt-2 rounded-full px-2.5" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: '24px', color: '#fff', background: 'rgba(0,0,0,0.24)' }}>
                    <AlertTriangle size={12} style={{ color: '#FCD34D' }} aria-hidden="true" />
                    {refreshError ? `The last refresh failed — showing the previous fetch (${refreshError})` : `${feed.failedMonths.join(', ')} did not answer — retried automatically`}
                  </p>
                )}
                {gw?.error && !refreshing && (
                  <p className="inline-flex items-center gap-1.5 mt-2 rounded-full px-2.5" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: '24px', color: '#fff', background: 'rgba(0,0,0,0.24)' }} title={gw.error}>
                    <AlertTriangle size={12} style={{ color: '#FCD34D' }} aria-hidden="true" />
                    {gw.count ? `The AI Gateway changelog did not answer — showing the last read (${fetchedLabel(gw.fetchedAt)})` : 'The AI Gateway changelog did not answer — retried automatically'}
                  </p>
                )}
              </div>
            </div>
            {feed && (
              <div className="grid gap-2 flex-shrink-0" style={{ gridTemplateColumns: 'repeat(3, minmax(128px, 1fr))' }}>
                <GlassStat label="Latest month" value={latest.label.split(' ')[0]} sub={`${latest.count} release${latest.count === 1 ? '' : 's'}`} />
                <GlassStat label="New since your last visit" value={feed.fresh} sub={feed.fresh ? 'marked “new” below' : 'nothing new yet'} />
                <GlassStat label="In areas this portal demos" value={`${demoCount} of ${feed.total}`} sub={`across ${areas.filter((a) => a.pillar).length} product areas`} />
              </div>
            )}
          </div>
        </section>

        {feed && (
          <div className="grid gap-6 mt-6 items-start grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)]">
            {/* ── rail ── */}
            <aside className="sticky space-y-3 hidden lg:block" style={{ top: 78 }} aria-label="Browse">
              <RailCard t={t} icon={CalendarDays} title="Months">
                {feed.months.map((m, i) => (
                  <RailRow key={m.slug} t={t} tone={t.live} active={activeMonth === m.slug} onClick={() => jump(m.slug)}
                           count={groups.find((g) => g.slug === m.slug)?.items.length ?? 0} disabled={!groups.some((g) => g.slug === m.slug)}>
                    <span style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{m.label}</span>
                    {i === 0 && <span className="rounded-full px-1.5" style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 700, lineHeight: '16px', color: '#fff', background: t.live }}>latest</span>}
                  </RailRow>
                ))}
              </RailCard>
              <RailCard t={t} icon={Layers} title="Product area">
                <div role="radiogroup" aria-label="Product area">
                  <RailRow t={t} tone={t.live} role="radio" checked={!area} active={!area} onClick={() => setArea('')} count={feed.total}>
                    <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: t.inkFaint }} aria-hidden="true" />
                    <span style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>Every area</span>
                  </RailRow>
                  {areas.map((a) => {
                    const Icon = a.pillar?.icon ?? Sparkles
                    return (
                      <RailRow key={a.name} t={t} tone={a.tone} role="radio" checked={area === a.name} active={area === a.name}
                               onClick={() => setArea(area === a.name ? '' : a.name)} count={a.count}>
                        <span className="grid place-items-center rounded-md flex-shrink-0" style={{ width: 20, height: 20, background: a.pillar ? bandBg(a.tone) : `${NEUTRAL}24` }} aria-hidden="true">
                          <Icon size={11} style={{ color: a.pillar ? '#fff' : t.inkDim }} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{a.name}</span>
                          {a.pillar && <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim }}>demo in {a.pillar.run ? `step ${String(a.pillar.run).padStart(2, '0')}` : a.pillar.title}</span>}
                        </span>
                      </RailRow>
                    )
                  })}
                </div>
              </RailCard>
              <RailCard t={t} icon={SlidersHorizontal} title="Show only">
                <RailRow t={t} tone={t.live} role="checkbox" checked={onlyNew} active={onlyNew} onClick={() => setOnlyNew((v) => !v)} count={feed.fresh} disabled={!feed.fresh && !onlyNew}>
                  <Check2 t={t} on={onlyNew} tone={t.live} />
                  <span style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>New since my last visit</span>
                </RailRow>
                <RailRow t={t} tone={t.live} role="checkbox" checked={onlyDemo} active={onlyDemo} onClick={() => setOnlyDemo((v) => !v)} count={demoCount}>
                  <Check2 t={t} on={onlyDemo} tone={t.live} />
                  <span style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>Areas this portal demos</span>
                </RailRow>
              </RailCard>
              <p className="px-2" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.5, color: t.inkFaint }}>
                Each release is filed under its product area. The pillar named is where the portal demos that area — not a claim that it demos this exact feature.
              </p>
            </aside>

            {/* ── releases ── */}
            <div className="min-w-0 space-y-7">
              {filtering && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>{filtered.length} of {feed.total} releases</span>
                  <button type="button" onClick={clear} className={`inline-flex items-center gap-1 rounded-full px-2.5 ${focusCls}`}
                          style={{ height: 26, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
                    <X size={12} aria-hidden="true" /> Clear filters
                  </button>
                </div>
              )}
              {groups.length === 0 && (
                <div className="rounded-[22px] px-6 py-10 text-center" style={{ background: t.panel, border: `1px solid ${t.glassEdge}` }}>
                  <p style={{ fontFamily: FONT.display, fontSize: 16, fontWeight: 700, color: t.ink }}>No releases match</p>
                  <p style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, marginTop: 4 }}>Try another word, or clear the filters.</p>
                </div>
              )}
              {groups.map((g, gi) => (
                <section key={g.slug} ref={bind(g.slug)} data-slug={g.slug} aria-labelledby={`m-${g.slug}`} style={{ scrollMarginTop: 84 }}>
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <h2 id={`m-${g.slug}`} style={{ fontFamily: FONT.display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: t.ink }}>{g.label}</h2>
                    <span className="rounded-full px-2.5" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, lineHeight: '22px', color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
                      {g.items.length}{filtering && g.items.length !== g.count ? ` of ${g.count}` : ''} release{g.count === 1 ? '' : 's'}
                    </span>
                    {feed.months[0].slug === g.slug && <span className="rounded-full px-2.5" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 700, lineHeight: '22px', color: '#fff', background: bandBg(t.live) }}>latest</span>}
                    {g.url && (
                      <a href={g.url} target="_blank" rel="noopener noreferrer" className={`ml-auto inline-flex items-center gap-1 rounded-full px-3 ${focusCls}`}
                         style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.isLight ? shade(t.live, 0.2) : '#9DB6FA', background: `${t.live}12`, border: `1px solid ${t.live}33` }}>
                        {g.label} on docs <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  <div className="grid gap-3 items-stretch" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 400px), 1fr))' }}>
                    {g.items.map((item, i) => <ReleaseCard key={item.key} t={t} item={item} onDemo={demo} onNotes={setNotes} index={gi === 0 ? i : 0} />)}
                  </div>
                </section>
              ))}

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 px-1">
                  <span style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkFaint }}>
                    Read from <a href={feed.indexUrl || 'https://docs.paloaltonetworks.com/ai-runtime-security/new-features/by-date/prisma-airs'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>docs.paloaltonetworks.com</a>
                    {gw?.url && <> and the <a href={gw.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>AI Gateway changelog</a>{gw.latest ? ` (latest ${gw.latest})` : ''}</>}
                    {' '}· cached a day on the server{nextFetch ? ` · next automatic read after ${nextFetch.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}` : ''}
                  </span>
                  {/* The visitor log is the portal owner's — kept as quiet as it was. */}
                  <button type="button" onClick={() => setVisitors(true)} aria-label="Visitors"
                          className={`ml-auto grid place-items-center rounded-full ${focusCls}`}
                          style={{ width: 28, height: 28, color: t.inkFaint, opacity: 0.35 }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.35' }}>
                    <Users size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <VisitorsDrawer t={t} open={visitors} onClose={closeVisitors} />
      <GatewayNotesDrawer t={t} item={notes} onClose={closeNotes} onDemo={demo} />
    </div>
  )
}
