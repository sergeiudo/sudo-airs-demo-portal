import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Radio } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { tokens, glass, FONT } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandGlass } from '../home-2027/band'
import { HOME_PILLARS } from '../home-2027/homeData'
import { Handle } from '../api-intercept-2027/PaneHandle'
import { PillarHeader } from '../../components/layout/PillarHeader'
import { GROUPS, SECTIONS, BRIEF, AS_OF } from './content'
import { focusCls } from './parts'
import { LiveRecord, useRecord } from './LiveRecord'
import { Glance, Questions, Safe, Compromise, Scope, Production, Objections, Strengths, Discovery, Coexist, Claims, MathSection, Sources } from './sections'

/**
 * VsLitellm — the AI-GW vs LiteLLM deep dive, in the launch design.
 *
 *   left   the brief's sections, then how to sell it, then the proof
 *   middle the section: a band, then cards — every figure with its source
 *          and its status from the claim check
 *   right  the live record: LiteLLM's CVEs and releases and the gateway
 *          core's, read from OSV, PyPI and npm today
 *
 * Content is data (content.js), built from the October 2026 competitive brief
 * and checked against primary sources; see its header for the rules.
 */

const SECTION_KEY = 'sudo-airs.vs.section'
const DEV_GUIDE_KEY = 'sudo-airs.dev.guide'
const BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]))
const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]))
const VIEWS = { overview: Glance, questions: Questions, safe: Safe, compromise: Compromise, scope: Scope, production: Production, objections: Objections, strengths: Strengths, discovery: Discovery, coexist: Coexist, claims: Claims, math: MathSection, sources: Sources }

const stored = () => { try { const v = localStorage.getItem(SECTION_KEY); return BY_ID[v] ? v : 'overview' } catch { return 'overview' } }

// ─── header: the live record's state ─────────────────────────────────────────
function RecordPill({ t }) {
  const { data, loading, error } = useRecord()
  const dot = loading && !data ? 'rgba(255,255,255,0.55)' : data?.litellm ? t.pass : t.warn
  const text = loading && !data ? 'Reading the record…' : data?.litellm ? `Live record · ${data.litellm.cves} LiteLLM CVEs today` : error ? 'Live record unavailable' : 'Live record'
  return (
    <span className="hidden xl:inline-flex items-center gap-2 rounded-full px-3 flex-shrink-0 whitespace-nowrap" style={{ height: 30, ...bandGlass, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600 }}>
      <Radio size={13} aria-hidden="true" style={{ opacity: 0.85 }} />
      <span className="rounded-full" style={{ width: 7, height: 7, background: dot }} aria-hidden="true" />
      {text}
    </span>
  )
}

// ─── rail ────────────────────────────────────────────────────────────────────
function SectionRow({ t, s, group, index, active, onPick }) {
  const [hot, setHot] = useState(false)
  const tone = group.tone
  const Icon = s.icon
  return (
    <button type="button" onClick={() => onPick(s.id)} aria-current={active ? 'page' : undefined}
            onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className={`w-full flex items-start gap-2.5 rounded-xl text-left ${focusCls}`}
            style={{ padding: '7px 8px', background: active ? `${tone}17` : hot ? t.sunken : 'transparent', transition: 'background 140ms' }}>
      <span className="grid place-items-center rounded-lg flex-shrink-0"
            style={{ width: 24, height: 24, marginTop: 1, color: active ? '#fff' : (t.isLight ? shade(tone, 0.3) : tone), background: active ? bandBg(tone) : `${tone}14`, boxShadow: active ? `0 3px 8px ${tone}44` : 'none' }}>
        <Icon size={12} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: active ? 700 : 600, color: active && t.isLight ? shade(tone, 0.35) : t.ink, lineHeight: 1.3 }}>{s.title}</span>
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }}>{s.sub}</span>
      </span>
      <span className="sr-only">{index + 1}</span>
    </button>
  )
}

function Rail({ t, active, onPick }) {
  return (
    <div className="h-full flex flex-col overflow-hidden" style={glass(t, { radius: 22 })}>
      <div className="px-4 pt-3.5 pb-2 flex-shrink-0">
        <div style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>{BRIEF.title}</div>
        <div style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim, marginTop: 1 }}>Brief · {BRIEF.date} · claims traced {AS_OF}</div>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3 space-y-2" aria-label="Sections">
        {GROUPS.map((g) => {
          const Icon = g.icon
          const items = SECTIONS.filter((s) => s.group === g.id)
          return (
            <div key={g.id} className="rounded-2xl overflow-hidden" style={{ background: t.panel, border: `1px solid ${items.some((s) => s.id === active) ? `${g.tone}55` : t.hairline}` }}>
              <div className="flex items-center gap-3" style={{ padding: '9px 10px' }}>
                <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: bandBg(g.tone) }}>
                  <Icon size={14} style={{ color: '#fff' }} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink, lineHeight: 1.2 }}>{g.title}</span>
                  <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }}>{g.sub}</span>
                </span>
                <span className="rounded-full px-1.5 flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 600, color: t.inkDim, background: t.sunken }}>{items.length}</span>
              </div>
              <div className="px-1.5 pb-1.5 pt-1 space-y-0.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
                {items.map((s, i) => <SectionRow key={s.id} t={t} s={s} group={g} index={i} active={s.id === active} onPick={onPick} />)}
              </div>
            </div>
          )
        })}
      </nav>
    </div>
  )
}

function PrevNext({ t, id, onPick }) {
  const i = SECTIONS.findIndex((s) => s.id === id)
  const card = (s, dir) => {
    if (!s) return <span className="flex-1" />
    const g = GROUP_BY_ID[s.group]
    return (
      <button type="button" onClick={() => onPick(s.id)}
              className={`flex-1 min-w-0 flex items-center gap-3 rounded-2xl ${focusCls}`}
              style={{ padding: '12px 14px', background: t.panel, border: `1px solid ${t.hairline}`, flexDirection: dir === 'prev' ? 'row' : 'row-reverse', textAlign: dir === 'prev' ? 'left' : 'right' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${g.tone}66` }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.hairline }}>
        <span className="grid place-items-center rounded-full flex-shrink-0" style={{ width: 30, height: 30, background: `${g.tone}17`, color: t.isLight ? shade(g.tone, 0.3) : g.tone }}>
          {dir === 'prev' ? <ArrowLeft size={14} aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />}
        </span>
        <span className="min-w-0">
          <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{dir === 'prev' ? 'Previous' : 'Next'} · {g.title}</span>
          <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: t.ink }}>{s.title}</span>
        </span>
      </button>
    )
  }
  return <div className="flex gap-3">{card(SECTIONS[i - 1], 'prev')}{card(SECTIONS[i + 1], 'next')}</div>
}

// ─── shell ───────────────────────────────────────────────────────────────────
export function VsLitellm() {
  const { state, dispatch } = useAppContext()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const accent = HOME_PILLARS.find((p) => p.id === 'vsLitellm')?.accent ?? GROUPS[0].tone
  const reduce = useReducedMotion()

  const [section, setSection] = useState(stored)
  const [focus, setFocus] = useState(null)          // a claim to open at
  const scrollRef = useRef(null)
  const ledgerRef = useRef(null)
  const pending = useRef(null)                       // 'ledger' | `claim-${id}` | null

  const pick = useCallback((id) => {
    if (!BY_ID[id]) return
    setSection(id)
    setFocus(null)
    pending.current = null
    try { localStorage.setItem(SECTION_KEY, id) } catch { /* private mode */ }
  }, [])

  const go = useCallback((target) => {
    if (typeof target !== 'string') return
    if (target.startsWith('pillar:')) return dispatch({ type: 'SET_VIEW', payload: target.slice(7) })
    if (target.startsWith('guide:')) {
      // The Developer Corner opens the guide it finds in its stored key.
      try { localStorage.setItem(DEV_GUIDE_KEY, target.slice(6)) } catch { /* private mode */ }
      return dispatch({ type: 'SET_VIEW', payload: 'developerCorner' })
    }
    if (target.startsWith('claim:')) {
      const id = target.slice(6)
      pick('claims'); setFocus(id); pending.current = `claim-${id}`
      return
    }
    if (target === 'ledger') { pick('safe'); pending.current = 'ledger'; return }
    pick(target)
  }, [dispatch, pick])

  // A new section starts at the top — unless a jump asked for a spot in it.
  useEffect(() => {
    const want = pending.current
    if (!want) { scrollRef.current?.scrollTo({ top: 0 }); return }
    const id = requestAnimationFrame(() => {
      const el = want === 'ledger' ? ledgerRef.current : document.getElementById(want)
      el?.scrollIntoView({ block: want === 'ledger' ? 'start' : 'center', behavior: reduce ? 'auto' : 'smooth' })
      pending.current = null
    })
    return () => cancelAnimationFrame(id)
  }, [section, focus, reduce])

  const View = VIEWS[section] ?? Glance
  const [leftW, setLeftW] = useState(290)
  const [rightW, setRightW] = useState(360)
  const [dragL, setDragL] = useState(false)
  const [dragR, setDragR] = useState(false)

  return (
    <div className="relative flex flex-col h-full overflow-hidden"
         style={{ background: t.ground, cursor: dragL || dragR ? 'col-resize' : 'default', userSelect: dragL || dragR ? 'none' : 'auto' }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
        backgroundSize: '44px 44px',
      }} />
      <PillarHeader pillarId="vsLitellm" actions={<RecordPill t={t} />} />
      <div className="relative flex-1 min-h-0 flex">
        <div className="relative flex-shrink-0 overflow-hidden py-3 pl-3" style={{ width: leftW }}>
          <Rail t={t} active={section} onPick={pick} />
        </div>
        <Handle t={t} side="left" dragging={dragL} onDrag={{ width: leftW, setWidth: setLeftW, setDragging: setDragL }} />
        <div ref={scrollRef} className="relative flex-1 min-w-0 overflow-y-auto">
          <motion.article key={section} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
                          className="mx-auto px-5 py-4 space-y-6" style={{ maxWidth: 940 }}>
            <View t={t} onGo={go} focus={focus} ledgerRef={ledgerRef} />
            <PrevNext t={t} id={section} onPick={pick} />
            <div style={{ height: 12 }} />
          </motion.article>
        </div>
        <Handle t={t} side="right" dragging={dragR} onDrag={{ width: rightW, setWidth: setRightW, setDragging: setDragR }} />
        <div className="relative flex-shrink-0 overflow-hidden py-3 pr-3" style={{ width: rightW }}>
          <LiveRecord t={t} accent={accent} onGo={go} />
        </div>
      </div>
    </div>
  )
}
