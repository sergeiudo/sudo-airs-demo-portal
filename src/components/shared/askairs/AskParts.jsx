import React, { useCallback, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Search, Loader2, BookOpen, Eye, ExternalLink, AlertTriangle, Sparkles, Globe, FileText, ChevronDown, Brain } from 'lucide-react'
import { FONT } from '../../../views/api-intercept-2027/tokens'
import { shade } from '../../../views/home-2027/band'
import { Markdown } from '../../../views/api-intercept-2027/Markdown'

/**
 * The pieces of an Ask AIRS answer, shared by the drawer and the Developer
 * Corner's full view. Answers are model output: rendered by Markdown as React
 * nodes, never HTML. Citations are source ids from the research ([S3]); [K]
 * marks the model's own knowledge, [P] a field note, [C] a known conflict
 * between doc pages.
 */

export const ASK_TONE = '#EC4899'
export const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
export const inkOn = (t, c, k = 0.3) => (t.isLight ? shade(c, k) : c)
const num = (id) => String(id).replace(/^S/, '')

export function CiteChip({ t, id, source }) {
  if (!source) return <span style={{ color: t.inkFaint }}>[{id}]</span>
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer"
       title={`${source.title}${source.heading && source.heading !== source.title ? ` › ${source.heading}` : ''} — ${source.source}`}
       className="inline-grid place-items-center rounded-md"
       style={{ minWidth: 18, height: 18, padding: '0 4px', margin: '0 1px', verticalAlign: 'text-top', fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 700, lineHeight: 1, color: inkOn(t, ASK_TONE, 0.3), background: `${ASK_TONE}1a`, textDecoration: 'none' }}>
      {num(id)}
    </a>
  )
}

function TagChip({ t, color, icon: Icon, label, title }) {
  return (
    <span title={title} className="inline-flex items-center gap-0.5 rounded-md"
          style={{ height: 18, padding: '0 5px', margin: '0 1px', verticalAlign: 'text-top', fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 700, lineHeight: '18px', color: inkOn(t, color, color === t.warn ? 0.42 : 0.25), background: `${color}1c` }}>
      <Icon size={10} aria-hidden="true" /> {label}
    </span>
  )
}

/** The answer text, with [S3] / [K] / [P] / [C] rendered as chips. */
export function AnswerBody({ t, item, size = 14 }) {
  const cite = useCallback((n) => {
    if (n === 'K') return <TagChip t={t} color={t.warn} icon={Brain} label="model knowledge" title="From the model's own knowledge — not found in the official docs it read. Verify before relying on it." />
    if (n === 'P') return <TagChip t={t} color={t.warn} icon={Eye} label="field note" title="Observed on a live SCM AI Gateway tenant — not in the official docs" />
    if (n === 'C') return <TagChip t={t} color={t.live} icon={BookOpen} label="docs conflict" title="A known contradiction between two official doc pages — both sides are stated" />
    const id = /^\d+$/.test(n) ? `S${n}` : n
    return <CiteChip t={t} id={id} source={item.sources?.find((s) => s.id === id)} />
  }, [t, item.sources])
  return <div style={{ fontFamily: FONT.prose, fontSize: size, lineHeight: 1.65, color: t.ink }}><Markdown text={item.answer} t={t} cite={cite} /></div>
}

const STEP_ICON = { search: Search, read: FileText, fetch: Globe, think: Sparkles }
const STEP_VERB = { search: 'Searched', read: 'Read', fetch: 'Fetched', think: '' }
const STEP_ACTIVE = { search: 'Searching', read: 'Reading', fetch: 'Fetching', think: '' }

/** The research as it happens — then folded into one line under the answer. */
export function ResearchSteps({ t, item }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const steps = item.steps ?? []
  const live = item.pending
  const counts = steps.reduce((m, s) => ({ ...m, [s.kind]: (m[s.kind] ?? 0) + 1 }), {})
  const summary = [counts.search && `${counts.search} search${counts.search > 1 ? 'es' : ''}`, counts.read && `${counts.read} page${counts.read > 1 ? 's' : ''} read`, counts.fetch && `${counts.fetch} live page${counts.fetch > 1 ? 's' : ''}`].filter(Boolean).join(' · ')
  const list = (
    <div className="space-y-1">
      {steps.map((s, i) => {
        const Icon = STEP_ICON[s.kind] ?? Sparkles
        const active = live && i === steps.length - 1
        return (
          <motion.div key={i} initial={reduce ? false : { opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2" style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.45, color: t.inkDim }}>
            {active ? <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: ASK_TONE, marginTop: 2 }} aria-hidden="true" /> : <Icon size={13} className="flex-shrink-0" style={{ marginTop: 2 }} aria-hidden="true" />}
            <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>
              {STEP_VERB[s.kind] && <span style={{ color: t.ink, fontWeight: 600 }}>{active ? STEP_ACTIVE[s.kind] : STEP_VERB[s.kind]} </span>}
              {s.kind === 'search' ? `“${s.label}”` : s.label}
              {s.product && <span style={{ color: t.inkFaint }}> · {s.product}</span>}
            </span>
          </motion.div>
        )
      })}
      {live && (steps.length === 0 || steps[steps.length - 1].kind !== 'think') && (
        <div className="flex items-center gap-2" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>
          <Loader2 size={13} className="animate-spin" style={{ color: ASK_TONE }} aria-hidden="true" />
          {steps.length ? 'Thinking about what it found…' : 'Planning the research…'}
        </div>
      )}
    </div>
  )
  if (live) return list
  if (!steps.length) return null
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
              className={`inline-flex items-center gap-1.5 rounded-full ${focusCls}`} style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.inkDim }}>
        <Search size={12} aria-hidden="true" /> Researched: {summary || `${steps.length} steps`}
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} aria-hidden="true" />
      </button>
      {open && <div className="mt-1.5 pl-1">{list}</div>}
    </div>
  )
}

/** Under an answer: model and time — or why there is no answer. */
export function AnswerFoot({ t, item }) {
  if (item.verdict === 'answered') {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
        <span>{item.sources?.length ?? 0} sources</span>
        {item.model && <span>{item.model}</span>}
        {item.elapsedMs != null && <span>{(item.elapsedMs / 1000).toFixed(1)} s</span>}
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ background: `${t.warn}12`, border: `1px solid ${t.warn}55` }}>
      <AlertTriangle size={15} style={{ color: inkOn(t, t.warn, 0.42), flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
      <span style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.ink, overflowWrap: 'anywhere' }}>
        The answer did not come back{item.error ? `: ${item.error}` : ''}.{item.sources?.length ? ' The sources it found are listed — open them directly.' : ''}
      </span>
    </div>
  )
}

export function SourceRow({ t, s, compact = false }) {
  const [hot, setHot] = useState(false)
  return (
    <a href={s.url} target="_blank" rel="noopener noreferrer" onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
       className={`flex items-start gap-2.5 rounded-xl ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'} ${focusCls}`}
       style={{ background: hot ? t.sunken : t.panel, border: `1px solid ${hot ? `${ASK_TONE}66` : t.hairline}`, textDecoration: 'none', transition: 'background 140ms, border-color 140ms' }}>
      <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: compact ? 22 : 24, height: compact ? 22 : 24, fontFamily: FONT.display, fontSize: 11.5, fontWeight: 700, color: inkOn(t, ASK_TONE, 0.3), background: `${ASK_TONE}1a` }}>{num(s.id)}</span>
      <span className="min-w-0 flex-1">
        <span className="block" style={{ fontFamily: FONT.prose, fontSize: compact ? 12 : 12.5, fontWeight: 650, lineHeight: 1.35, color: t.ink }}>
          {s.title}{s.heading && s.heading !== s.title ? <span style={{ fontWeight: 500, color: t.inkDim }}> › {s.heading}</span> : null}
        </span>
        <span className="block mt-0.5" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkFaint }}>
          {s.source}{s.product && s.product !== s.source ? ` · ${s.product}` : ''}
        </span>
      </span>
      <ExternalLink size={12} style={{ color: t.inkFaint, flexShrink: 0, marginTop: 3 }} aria-hidden="true" />
    </a>
  )
}

export const plainAnswer = (item) => {
  const refs = (item.sources ?? []).map((s) => `[${num(s.id)}] ${s.title}${s.heading && s.heading !== s.title ? ` › ${s.heading}` : ''} — ${s.url}`).join('\n')
  return `Q: ${item.question}\n\n${String(item.answer ?? '').replace(/\[S(\d+)\]/g, '[$1]')}${refs ? `\n\nSources:\n${refs}` : ''}`
}
