import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Search, X, Clock, FlaskConical, ArrowLeft, ArrowRight, BookOpen, ExternalLink, ChevronDown } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { tokens, glass, FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots, bandGlass } from '../home-2027/band'
import { Handle } from '../api-intercept-2027/PaneHandle'
import { PillarHeader } from '../../components/layout/PillarHeader'
import { LangPref } from './CodeTabs'
import { Block, DocLinks } from './Blocks'
import { LivePanel, useDevStatus } from './LivePanel'
import { GROUPS, GUIDES, GROUP_BY_ID, GUIDE_BY_ID, guideHaystack } from './guides'
import { useAskDocs, AskRailCard, AskView, AskSources } from './AskDocs'
import { peekAskView, takeAskView } from '../../components/shared/askairs/askStore'

/**
 * DeveloperCorner — the integration hub, in the launch design.
 *
 *   left   the guide rail: search, then every guide grouped by product
 *   middle the guide: a band, then prose, steps, code, tables and callouts
 *   right  "Run it live": the guide's API call sent for real from this portal
 *          (/api/dev/*), request and response shown — or its references
 *
 * "Ask the AI Gateway docs" (AskDocs.jsx) takes over the middle and right
 * panes: a question answered from the official docs, with its sources.
 *
 * Content is data (guides/*.js); code blocks can be built from the live
 * panel's inputs, so the snippet on the left is the request on the right.
 * Classic keeps DeveloperCornerView.
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
const GUIDE_KEY = 'sudo-airs.dev.guide'
const LANG_KEY = 'sudo-airs.dev.lang'
const TONE = '#0ea5e9'

const stored = (k, fallback) => { try { return localStorage.getItem(k) || fallback } catch { return fallback } }
const store = (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

// ─── header: what this host can run live ─────────────────────────────────────
function LiveReadiness({ t, status }) {
  const items = [
    { key: 'runtime', label: 'Runtime API' },
    { key: 'gateway', label: 'AI Gateway' },
    { key: 'modelSecurity', label: 'Model Security' },
  ]
  return (
    <div className="hidden xl:inline-flex items-center gap-2.5 rounded-full px-3 flex-shrink-0" title="Live calls this host is configured to run"
         style={{ height: 30, ...bandGlass, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600 }}>
      <FlaskConical size={13} aria-hidden="true" style={{ opacity: 0.85 }} />
      {items.map((it) => {
        const ready = status?.[it.key]?.ready
        return (
          <span key={it.key} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="rounded-full" style={{ width: 7, height: 7, background: status == null ? 'rgba(255,255,255,0.5)' : ready ? t.pass : t.warn }} aria-hidden="true" />
            {it.label}
            <span className="sr-only">{status == null ? 'checking' : ready ? 'ready' : 'not configured'}</span>
          </span>
        )
      })}
    </div>
  )
}

// ─── left rail ───────────────────────────────────────────────────────────────
const OPEN_KEY = 'sudo-airs.dev.open'
const readOpen = () => { try { const v = JSON.parse(localStorage.getItem(OPEN_KEY) || 'null'); return Array.isArray(v) ? v : null } catch { return null } }

function GuideRow({ t, guide, group, index, active, onPick }) {
  const [hot, setHot] = useState(false)
  const ref = useRef(null)
  // Keep the open guide in view — it may sit far down the rail (a restored
  // guide, a card link, next/previous).
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: 'nearest' }) }, [active])
  const tone = group.tone
  const ink = t.isLight ? shade(tone, 0.3) : tone
  return (
    <button ref={ref} type="button" onClick={() => onPick(guide.id)} aria-current={active ? 'page' : undefined}
            onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className={`relative w-full flex items-start gap-2.5 rounded-xl text-left ${focusCls}`}
            style={{ padding: '7px 8px', background: active ? `${tone}17` : hot ? t.sunken : 'transparent', transition: 'background 140ms' }}>
      <span className="grid place-items-center rounded-lg flex-shrink-0"
            style={{ width: 22, height: 22, marginTop: 1, fontFamily: FONT.mono, fontSize: 10, fontWeight: 700,
                     color: active ? '#fff' : ink, background: active ? bandBg(tone) : `${tone}14`, boxShadow: active ? `0 3px 8px ${tone}44` : 'none' }}>
        {index + 1}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: active ? 700 : 600, color: active ? (t.isLight ? shade(tone, 0.35) : t.ink) : t.ink, lineHeight: 1.3 }}>{guide.title}</span>
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }}>{guide.sub}</span>
      </span>
      {guide.live && (
        <span className="inline-flex items-center gap-1 rounded-full px-1.5 flex-shrink-0" title="Has a live call" style={{ height: 18, marginTop: 2, fontFamily: FONT.prose, fontSize: 10, fontWeight: 700, color: active ? ink : t.isLight ? shade(t.live, 0.2) : t.live, background: `${t.live}14` }}>
          <FlaskConical size={10} aria-hidden="true" /> live
        </span>
      )}
    </button>
  )
}

/** One product group as a category card — the attack library's shape. */
function GroupCard({ t, group, items, total, open, onToggle, activeId, onPick, searching }) {
  const [hot, setHot] = useState(false)
  const Icon = group.icon
  const hue = group.tone
  const here = items.some((x) => x.id === activeId)
  return (
    <div className="rounded-2xl overflow-hidden"
         style={{
           background: t.panel,
           border: `1px solid ${open || hot ? `${hue}55` : t.hairline}`,
           boxShadow: open ? `0 10px 24px ${hue}1a` : hot ? t.shadowSm : 'none',
           transition: 'border-color 160ms ease, box-shadow 200ms ease',
         }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
              onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
              className={`w-full flex items-center gap-3 text-left ${focusCls}`} style={{ padding: '9px 10px' }}>
        <span className="relative grid place-items-center rounded-xl flex-shrink-0"
              style={{ width: 34, height: 34, background: bandBg(hue), boxShadow: open || hot ? `0 5px 12px ${hue}55` : 'none', transition: 'box-shadow 180ms ease' }}>
          <Icon size={15} style={{ color: '#fff' }} aria-hidden="true" />
          {here && !open && (
            <span className="absolute rounded-full" title="The open guide is in here"
                  style={{ top: -3, right: -3, width: 10, height: 10, background: t.live, border: `2px solid ${t.panel}` }} aria-hidden="true" />
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink, lineHeight: 1.2 }}>{group.title}</span>
          <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }}>
            {group.sub}
          </span>
        </span>
        <span className="rounded-full px-1.5 flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 600, color: t.inkDim, background: t.sunken }}>
          {searching ? `${items.length}/${total}` : total}
        </span>
        <ChevronDown size={13} className="flex-shrink-0" style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }} className="overflow-hidden">
            <div className="px-1.5 pb-1.5 pt-1 space-y-0.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
              {items.map((x, i) => <GuideRow key={x.id} t={t} guide={x} group={group} index={i} active={x.id === activeId} onPick={onPick} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GuideRail({ t, activeId, onPick, query, setQuery, matches, ask }) {
  const inputRef = useRef(null)
  const counts = useMemo(() => Object.fromEntries(GROUPS.map((g) => [g.id, GUIDES.filter((x) => x.group === g.id).length])), [])
  const visible = GROUPS.map((g) => ({ g, items: GUIDES.filter((x) => x.group === g.id && (!matches || matches.has(x.id))) })).filter((x) => x.items.length)
  const liveTotal = useMemo(() => GUIDES.filter((x) => x.live).length, [])

  // Which groups are open — remembered per browser; first visit opens the
  // open guide's group only, so the rail starts as a short table of contents.
  const [openSet, setOpenSet] = useState(() => new Set(readOpen() ?? [GUIDE_BY_ID[activeId]?.group ?? 'start']))
  const save = (next) => { try { localStorage.setItem(OPEN_KEY, JSON.stringify([...next])) } catch { /* private mode */ } return next }
  const toggle = (id) => setOpenSet((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return save(n) })
  // Opening a guide from anywhere (a card, next/previous) opens its group.
  useEffect(() => {
    const g = GUIDE_BY_ID[activeId]?.group
    if (g) setOpenSet((s) => (s.has(g) ? s : save(new Set([...s, g]))))
  }, [activeId])
  const allOpen = GROUPS.every((g) => openSet.has(g.id))
  const setAll = () => setOpenSet(save(new Set(allOpen ? [] : GROUPS.map((g) => g.id))))

  // "/" focuses the search, like the home palette.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault(); inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="h-full flex flex-col overflow-hidden" style={glass(t, { radius: 22 })}>
      <div className="p-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 rounded-xl px-2.5" style={{ height: 36, background: t.sunken, border: `1px solid ${t.hairline}` }}>
          <Search size={14} style={{ color: t.inkDim, flexShrink: 0 }} aria-hidden="true" />
          <input ref={(el) => { inputRef.current = el; el?.style.setProperty('background-color', 'transparent', 'important') }}
                 value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guides, code and docs"
                 aria-label="Search the Developer Corner"
                 className="flex-1 min-w-0 outline-none" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink, border: 'none' }} />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className={`grid place-items-center rounded-full ${focusCls}`} style={{ width: 20, height: 20, color: t.inkDim }}>
              <X size={13} />
            </button>
          ) : (
            <kbd className="rounded-md px-1.5" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkFaint, border: `1px solid ${t.hairline}` }}>/</kbd>
          )}
        </div>
        <div className="flex items-center gap-2" style={{ margin: '8px 4px 0' }}>
          <span className="flex-1 min-w-0 truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>
            {matches ? `${matches.size} ${matches.size === 1 ? 'guide mentions' : 'guides mention'} “${query}”` : `${GUIDES.length} guides · ${liveTotal} run live`}
          </span>
          {!matches && (
            <button type="button" onClick={setAll} className={`rounded-full px-2 flex-shrink-0 ${focusCls}`}
                    style={{ height: 22, fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: t.isLight ? shade(t.live, 0.2) : t.live, background: `${t.live}12` }}>
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3 space-y-2" aria-label="Guides">
        <AskRailCard t={t} active={ask.active} status={ask.status} query={query} onOpen={ask.open} onAskQuery={ask.askQuery} />
        {visible.length === 0 && <p className="px-2 py-6 text-center" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>Nothing matches. Try “oauth”, “429” or “helm”.</p>}
        {visible.map(({ g, items }) => (
          <GroupCard key={g.id} t={t} group={g} items={items} total={counts[g.id]} searching={!!matches}
                     // A search opens every group it matches, without touching the saved state.
                     open={!!matches || openSet.has(g.id)} onToggle={() => toggle(g.id)}
                     activeId={activeId} onPick={onPick} />
        ))}
      </nav>
    </div>
  )
}

// ─── the guide ───────────────────────────────────────────────────────────────
function GuideBand({ t, guide, group, status, onRun }) {
  const Icon = group.icon
  const live = guide.live
  const ready = live ? status?.[live.split('.')[0] === 'ms' ? 'modelSecurity' : live.split('.')[0]]?.ready : null
  return (
    <div className="relative overflow-hidden rounded-3xl" style={{ background: bandBg(group.tone), boxShadow: `0 14px 32px ${group.tone}2e` }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
      <Icon aria-hidden="true" strokeWidth={1.2} style={{ position: 'absolute', right: -26, bottom: -48, width: 190, height: 190, color: '#fff', opacity: 0.13, transform: 'rotate(-10deg)' }} />
      <div className="relative flex items-start gap-4 px-5 py-5">
        <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
          <Icon size={22} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div style={{ ...LBL, fontSize: 10, color: 'rgba(255,255,255,0.86)' }}>{group.title} · {guide.level}</div>
          <h1 style={{ fontFamily: FONT.display, fontSize: 25, fontWeight: 700, color: '#fff', lineHeight: 1.18, margin: '4px 0 0' }}>{guide.title}</h1>
          <p style={{ fontFamily: FONT.prose, fontSize: 13.5, color: 'rgba(255,255,255,0.92)', margin: '5px 0 0' }}>{guide.sub}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5" style={{ height: 26, ...bandGlass, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600 }}>
              <Clock size={12} aria-hidden="true" /> {guide.minutes} min
            </span>
            {guide.docs?.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5" style={{ height: 26, ...bandGlass, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600 }}>
                <BookOpen size={12} aria-hidden="true" /> {guide.docs.length} official {guide.docs.length === 1 ? 'doc' : 'docs'}
              </span>
            )}
            {live && (
              <button type="button" onClick={() => onRun(null)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                      style={{ height: 26, fontFamily: FONT.prose, fontSize: 12, fontWeight: 700, color: shade(group.tone, 0.45), background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.18)' }}>
                <FlaskConical size={12} aria-hidden="true" /> {ready === false ? 'Live call — not configured here' : 'Runs live from this page'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const LANGS = [
  { id: 'curl', label: 'cURL' },
  { id: 'python', label: 'Python' },
  { id: 'node', label: 'Node.js' },
  { id: 'go', label: 'Go' },
  { id: 'java', label: 'Java' },
]

function LangPicker({ t, lang, setLang }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginRight: 2 }}>Show code in</span>
      <div role="radiogroup" aria-label="Preferred code language" className="flex flex-wrap gap-1">
        {LANGS.map((l) => {
          const on = l.id === lang
          return (
            <button key={l.id} type="button" role="radio" aria-checked={on} onClick={() => setLang(l.id)}
                    className={`rounded-full px-2.5 ${focusCls}`}
                    style={{ height: 26, fontFamily: FONT.prose, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? '#fff' : t.ink, background: on ? bandBg(TONE) : t.sunken, border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 4px 12px ${TONE}40` : 'none' }}>
              {l.label}
            </button>
          )
        })}
      </div>
      <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkFaint, marginLeft: 4 }}>where a block offers it</span>
    </div>
  )
}

function PrevNextCard({ t, guide, dir, onPick }) {
  if (!guide) return <span className="flex-1" />
  const g = GROUP_BY_ID[guide.group]
  return (
    <button type="button" onClick={() => onPick(guide.id)}
            className={`flex-1 min-w-0 flex items-center gap-3 rounded-2xl ${focusCls}`}
            style={{ padding: '12px 14px', background: t.panel, border: `1px solid ${t.hairline}`, flexDirection: dir === 'prev' ? 'row' : 'row-reverse', textAlign: dir === 'prev' ? 'left' : 'right' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${g.tone}66` }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.hairline }}>
      <span className="grid place-items-center rounded-full flex-shrink-0" style={{ width: 30, height: 30, background: `${g.tone}17`, color: t.isLight ? shade(g.tone, 0.3) : g.tone }}>
        {dir === 'prev' ? <ArrowLeft size={14} aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />}
      </span>
      <span className="min-w-0">
        <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{dir === 'prev' ? 'Previous' : 'Next'} · {g.title}</span>
        <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>{guide.title}</span>
      </span>
    </button>
  )
}

function PrevNext({ t, prev, next, onPick }) {
  return (
    <div className="flex gap-3">
      <PrevNextCard t={t} guide={prev} dir="prev" onPick={onPick} />
      <PrevNextCard t={t} guide={next} dir="next" onPick={onPick} />
    </div>
  )
}

function GuideView({ t, guide, status, vars, onGo, onRun, lang, setLang }) {
  const group = GROUP_BY_ID[guide.group]
  const scrollRef = useRef(null)
  const reduce = useReducedMotion()
  const idx = GUIDES.findIndex((g) => g.id === guide.id)
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [guide.id])
  const hasCode = guide.blocks.some((b) => b.type === 'code' || b.type === 'steps')

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <motion.article key={guide.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
                      className="mx-auto px-5 py-4 space-y-6" style={{ maxWidth: 900 }}>
        <GuideBand t={t} guide={guide} group={group} status={status} onRun={onRun} />
        {hasCode && <LangPicker t={t} lang={lang} setLang={setLang} />}
        {guide.blocks.map((b, i) => (
          <Block key={`${guide.id}-${i}`} t={t} tone={group.tone} block={b} vars={vars} onGo={onGo} onRun={onRun} />
        ))}
        {guide.docs?.length > 0 && (
          <div className="rounded-3xl p-4" style={{ background: t.panel, border: `1px solid ${t.glassEdge}` }}>
            <div className="flex items-center gap-2 mb-3">
              <ExternalLink size={14} style={{ color: t.inkDim }} aria-hidden="true" />
              <span style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink }}>Official documentation for this guide</span>
            </div>
            <DocLinks t={t} block={{ items: guide.docs }} />
          </div>
        )}
        <PrevNext t={t} prev={GUIDES[idx - 1]} next={GUIDES[idx + 1]} onPick={(id) => onGo(id)} />
        <div style={{ height: 12 }} />
      </motion.article>
    </div>
  )
}

// ─── shell ───────────────────────────────────────────────────────────────────
export function DeveloperCorner() {
  const { state, dispatch } = useAppContext()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const status = useDevStatus()

  const [guideId, setGuideId] = useState(() => {
    const id = stored(GUIDE_KEY, 'overview')
    return GUIDE_BY_ID[id] ? id : 'overview'
  })
  const guide = GUIDE_BY_ID[guideId]
  const [lang, setLangState] = useState(() => stored(LANG_KEY, 'curl'))
  const setLang = useCallback((l) => { setLangState(l); store(LANG_KEY, l) }, [])
  const langValue = useMemo(() => ({ lang, setLang }), [lang, setLang])

  const [vars, setVars] = useState({})
  const [preset, setPreset] = useState(null)
  const [query, setQuery] = useState('')

  const haystacks = useMemo(() => Object.fromEntries(GUIDES.map((g) => [g.id, guideHaystack(g)])), [])
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    const words = q.split(/\s+/)
    return new Set(GUIDES.filter((g) => words.every((w) => haystacks[g.id].includes(w))).map((g) => g.id))
  }, [query, haystacks])

  const [mode, setMode] = useState(() => (peekAskView() ? 'ask' : 'guide')) // guide | ask
  useEffect(() => { takeAskView() }, [])
  const askDocs = useAskDocs()
  const pick = useCallback((id) => {
    if (!GUIDE_BY_ID[id]) return
    setGuideId(id); store(GUIDE_KEY, id); setVars({}); setPreset(null); setMode('guide')
  }, [])
  // Ask AIRS elsewhere in the portal can open the full view or a cited guide here.
  useEffect(() => {
    const onAsk = () => { takeAskView(); setMode('ask') }
    const onGuide = (e) => pick(e.detail)
    window.addEventListener('sudo-airs:open-ask', onAsk)
    window.addEventListener('sudo-airs:open-guide', onGuide)
    return () => { window.removeEventListener('sudo-airs:open-ask', onAsk); window.removeEventListener('sudo-airs:open-guide', onGuide) }
  }, [pick])
  const railAsk = useMemo(() => ({
    active: mode === 'ask', status: askDocs.status,
    open: () => setMode('ask'),
    askQuery: (q) => { setMode('ask'); setQuery(''); askDocs.ask(q) },
  }), [mode, askDocs.status, askDocs.ask])
  const go = useCallback((target) => {
    if (typeof target === 'string' && target.startsWith('pillar:')) dispatch({ type: 'SET_VIEW', payload: target.slice(7) })
    else if (target === 'ask') setMode('ask')
    else pick(target)
  }, [dispatch, pick])
  const run = useCallback((presetId) => setPreset({ id: presetId ?? null, n: Date.now() }), [])

  const [leftW, setLeftW] = useState(300)
  const [rightW, setRightW] = useState(420)
  const [dragL, setDragL] = useState(false)
  const [dragR, setDragR] = useState(false)

  return (
    <LangPref.Provider value={langValue}>
      <div className="relative flex flex-col h-full overflow-hidden"
           style={{ background: t.ground, cursor: dragL || dragR ? 'col-resize' : 'default', userSelect: dragL || dragR ? 'none' : 'auto' }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
          backgroundSize: '44px 44px',
        }} />
        <PillarHeader pillarId="developerCorner" actions={<LiveReadiness t={t} status={status} />} />
        <div className="relative flex-1 min-h-0 flex">
          <div className="relative flex-shrink-0 overflow-hidden py-3 pl-3" style={{ width: leftW }}>
            <GuideRail t={t} activeId={mode === 'guide' ? guideId : null} onPick={pick} query={query} setQuery={setQuery} matches={matches} ask={railAsk} />
          </div>
          <Handle t={t} side="left" dragging={dragL} onDrag={{ width: leftW, setWidth: setLeftW, setDragging: setDragL }} />
          <div className="relative flex-1 min-w-0">
            {mode === 'ask'
              ? <AskView t={t} ask={askDocs} onGo={go} />
              : <GuideView t={t} guide={guide} status={status} vars={vars} onGo={go} onRun={run} lang={lang} setLang={setLang} />}
          </div>
          <Handle t={t} side="right" dragging={dragR} onDrag={{ width: rightW, setWidth: setRightW, setDragging: setDragR }} />
          <div className="relative flex-shrink-0 overflow-hidden py-3 pr-3" style={{ width: rightW }}>
            {mode === 'ask'
              ? <AskSources t={t} ask={askDocs} />
              : <LivePanel t={t} guide={guide} status={status} preset={preset} onVars={setVars} onGo={go} />}
          </div>
        </div>
      </div>
    </LangPref.Provider>
  )
}
