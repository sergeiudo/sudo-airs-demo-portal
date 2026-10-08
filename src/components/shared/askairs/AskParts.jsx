import React, { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Search, Loader2, BookOpen, Eye, ExternalLink, ArrowUpRight, AlertTriangle, Sparkles } from 'lucide-react'
import { useAppContext } from '../../../context/AppContext'
import { FONT } from '../../../views/api-intercept-2027/tokens'
import { shade } from '../../../views/home-2027/band'
import { Markdown } from '../../../views/api-intercept-2027/Markdown'

/**
 * The pieces of an Ask AIRS answer, shared by the drawer and the Developer
 * Corner's full view. Answers are model output: rendered by Markdown as React
 * nodes, never HTML; citation chips open the cited page — or, for this
 * portal's own guides and pillars (portal://…), navigate inside the portal.
 */

export const ASK_TONE = '#EC4899'
export const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
export const inkOn = (t, c, k = 0.3) => (t.isLight ? shade(c, k) : c)

/** portal://guide/<id> and portal://pillar/<id> → in-app navigation. */
export function usePortalNav() {
  const { dispatch } = useAppContext()
  return useCallback((url) => {
    const m = String(url).match(/^portal:\/\/(guide|pillar)\/(.+)$/)
    if (!m) return false
    if (m[1] === 'guide') {
      try { localStorage.setItem('sudo-airs.dev.guide', m[2]) } catch { /* private mode */ }
      window.dispatchEvent(new CustomEvent('sudo-airs:open-guide', { detail: m[2] }))
      dispatch({ type: 'SET_VIEW', payload: 'developerCorner' })
    } else {
      dispatch({ type: 'SET_VIEW', payload: m[2] })
    }
    return true
  }, [dispatch])
}

const isPortal = (url) => /^portal:\/\//.test(String(url))

export function CiteChip({ t, n, source }) {
  const nav = usePortalNav()
  if (!source) return <span style={{ color: t.inkFaint }}>[{n}]</span>
  const style = { minWidth: 18, height: 18, padding: '0 4px', margin: '0 1px', verticalAlign: 'text-top', fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 700, lineHeight: 1, color: inkOn(t, ASK_TONE, 0.3), background: `${ASK_TONE}1a`, textDecoration: 'none', border: 'none', cursor: 'pointer' }
  const title = `${source.title}${source.heading && source.heading !== source.title ? ` › ${source.heading}` : ''} — ${source.source}`
  return isPortal(source.url)
    ? <button type="button" onClick={(e) => { e.stopPropagation(); nav(source.url) }} title={title} className="inline-grid place-items-center rounded-md" style={style}>{n}</button>
    : <a href={source.url} target="_blank" rel="noopener noreferrer" title={title} className="inline-grid place-items-center rounded-md" style={style}>{n}</a>
}

function TagChip({ t, color, icon: Icon, label, title }) {
  return (
    <span title={title} className="inline-flex items-center gap-0.5 rounded-md"
          style={{ height: 18, padding: '0 5px', margin: '0 1px', verticalAlign: 'text-top', fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 700, lineHeight: '18px', color: inkOn(t, color, color === t.warn ? 0.42 : 0.25), background: `${color}1c` }}>
      <Icon size={10} aria-hidden="true" /> {label}
    </span>
  )
}

/** The answer text, with [n] / [P] / [C] rendered as chips. */
export function AnswerBody({ t, item, size = 14 }) {
  const cite = useCallback((n) => (
    n === 'P' ? <TagChip t={t} color={t.warn} icon={Eye} label="observed" title="Observed on this portal's AI Gateway tenant — not in the official docs" />
      : n === 'C' ? <TagChip t={t} color={t.live} icon={BookOpen} label="docs conflict" title="A known contradiction between two official doc pages — both sides are stated" />
        : <CiteChip t={t} n={n} source={item.sources?.[Number(n) - 1]} />
  ), [t, item.sources])
  return <div style={{ fontFamily: FONT.prose, fontSize: size, lineHeight: 1.65, color: t.ink }}><Markdown text={item.answer} t={t} cite={cite} /></div>
}

export function Pending({ t, status }) {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(0)
  useEffect(() => { const id = setTimeout(() => setStep(1), 600); return () => clearTimeout(id) }, [])
  const rows = [
    { icon: Search, text: `Ranking passages across ${status?.pages?.toLocaleString() ?? 'the'} pages` },
    { icon: Sparkles, text: 'Writing the answer from the best eight' },
  ]
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <motion.div key={i} initial={reduce ? false : { opacity: 0, x: -4 }} animate={{ opacity: i <= step ? 1 : 0.35, x: 0 }} transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-2" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>
          {i === step ? <Loader2 size={13} className="animate-spin" style={{ color: ASK_TONE }} aria-hidden="true" /> : <r.icon size={13} aria-hidden="true" />}
          {r.text}
        </motion.div>
      ))}
    </div>
  )
}

/** Under an answer: where it came from in one line — or why there is none. */
export function AnswerFoot({ t, item }) {
  if (item.verdict === 'answered') {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
        <span>{item.sources?.length ?? 0} passages</span>
        {item.model && <span>{item.model}</span>}
        {item.elapsedMs != null && <span>{(item.elapsedMs / 1000).toFixed(1)} s</span>}
      </div>
    )
  }
  const text = item.verdict === 'no-sources'
    ? 'Nothing in the docs matches this question. Try other words — names of features, settings or endpoints work best.'
    : `The answer did not come back${item.error ? `: ${item.error}` : ''}. The matching pages are listed — open them directly.`
  return (
    <div className="flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ background: `${t.warn}12`, border: `1px solid ${t.warn}55` }}>
      <AlertTriangle size={15} style={{ color: inkOn(t, t.warn, 0.42), flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
      <span style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.ink, overflowWrap: 'anywhere' }}>{text}</span>
    </div>
  )
}

export function SourceRow({ t, s, compact = false }) {
  const nav = usePortalNav()
  const [hot, setHot] = useState(false)
  const portal = isPortal(s.url)
  const body = (
    <>
      <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: compact ? 22 : 24, height: compact ? 22 : 24, fontFamily: FONT.display, fontSize: 11.5, fontWeight: 700, color: inkOn(t, ASK_TONE, 0.3), background: `${ASK_TONE}1a` }}>{s.n}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block" style={{ fontFamily: FONT.prose, fontSize: compact ? 12 : 12.5, fontWeight: 650, lineHeight: 1.35, color: t.ink }}>
          {s.title}{s.heading && s.heading !== s.title ? <span style={{ fontWeight: 500, color: t.inkDim }}> › {s.heading}</span> : null}
        </span>
        <span className="flex items-center gap-1.5 mt-0.5 min-w-0 flex-wrap">
          <span style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkFaint }}>{s.source}{s.product && s.product !== s.source ? ` · ${s.product}` : ''}</span>
          {s.deprecated && <span className="rounded-full px-1.5" style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 700, lineHeight: '16px', color: inkOn(t, t.warn, 0.42), background: `${t.warn}1f` }}>deprecated</span>}
          {portal && <span className="rounded-full px-1.5" style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 700, lineHeight: '16px', color: inkOn(t, t.live, 0.25), background: `${t.live}17` }}>in this portal</span>}
        </span>
      </span>
      {portal ? <ArrowUpRight size={12} style={{ color: t.inkFaint, flexShrink: 0, marginTop: 3 }} aria-hidden="true" /> : <ExternalLink size={12} style={{ color: t.inkFaint, flexShrink: 0, marginTop: 3 }} aria-hidden="true" />}
    </>
  )
  const style = { background: hot ? t.sunken : t.panel, border: `1px solid ${hot ? `${ASK_TONE}66` : t.hairline}`, textDecoration: 'none', width: '100%', transition: 'background 140ms, border-color 140ms' }
  const cls = `flex items-start gap-2.5 rounded-xl ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'} ${focusCls}`
  return portal
    ? <button type="button" onClick={() => nav(s.url)} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} className={cls} style={style}>{body}</button>
    : <a href={s.url} target="_blank" rel="noopener noreferrer" onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} className={cls} style={style}>{body}</a>
}

export const plainAnswer = (item) => {
  const refs = (item.sources ?? []).map((s) => `[${s.n}] ${s.title}${s.heading && s.heading !== s.title ? ` › ${s.heading}` : ''} — ${s.url}`).join('\n')
  return `Q: ${item.question}\n\n${item.answer ?? ''}${refs ? `\n\nSources:\n${refs}` : ''}`
}
