import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Info, AlertTriangle, BookOpen, FlaskConical, GitBranch, ArrowRight, ExternalLink, ChevronDown, CheckCircle2, Eye, Search, X,
} from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { CodeTabs } from './CodeTabs'

/**
 * Blocks — what a Developer Corner guide is made of. Content lives in plain
 * data (guides/*.js); these components render it. Inline markup is parsed
 * into React nodes, never set as HTML.
 *
 *   prose · steps · code · callout · table · facts · cards · links · repo · checklist · live · catalog
 *
 * A code block may carry `build(vars)` instead of `tabs`: the snippet is then
 * generated from the live panel's current inputs, so the code on the left is
 * the request the panel on the right sends.
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

// ─── inline markup: **bold**, `code`, [text](url) ───────────────────────────
export function Inline({ t, text }) {
  const s = String(text ?? '')
  const out = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m
  let i = 0
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) out.push(<b key={i++} style={{ color: t.ink, fontWeight: 650 }}>{tok.slice(2, -2)}</b>)
    else if (tok.startsWith('`')) {
      out.push(<code key={i++} dir="ltr" className="rounded-md px-1.5 py-px"
                     style={{ fontFamily: FONT.mono, fontSize: '0.86em', color: t.ink, background: t.sunken, border: `1px solid ${t.hairline}`, wordBreak: 'break-word' }}>{tok.slice(1, -1)}</code>)
    } else {
      const [, label, url] = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)
      out.push(<a key={i++} href={url} target="_blank" rel="noopener noreferrer"
                  className="underline decoration-1 underline-offset-2" style={{ color: t.isLight ? shade(t.live, 0.2) : '#8fb0ff', fontWeight: 600 }}>{label}</a>)
    }
    last = m.index + tok.length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}

function Para({ t, children, size = 14 }) {
  return <p style={{ fontFamily: FONT.prose, fontSize: size, lineHeight: 1.7, color: t.inkDim, margin: 0 }}>{children}</p>
}

// ─── prose ──────────────────────────────────────────────────────────────────
function Prose({ t, block }) {
  const paras = Array.isArray(block.text) ? block.text : [block.text]
  return (
    <div className="space-y-3">
      {block.title && <h3 style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 700, color: t.ink, margin: 0 }}>{block.title}</h3>}
      {paras.map((p, i) => <Para key={i} t={t}><Inline t={t} text={p} /></Para>)}
    </div>
  )
}

// ─── numbered steps ─────────────────────────────────────────────────────────
function Steps({ t, tone, block }) {
  const ink = t.isLight ? shade(tone, 0.25) : tone
  return (
    <div>
      {block.title && <h3 style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 700, color: t.ink, margin: '0 0 12px' }}>{block.title}</h3>}
      <ol className="space-y-5">
        {block.steps.map((st, i) => (
          <li key={i} className="flex gap-3.5">
            <div className="flex flex-col items-center flex-shrink-0">
              <span className="grid place-items-center rounded-full" style={{ width: 28, height: 28, fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: '#fff', background: bandBg(tone), boxShadow: `0 4px 10px ${tone}44` }}>
                {i + 1}
              </span>
              {i < block.steps.length - 1 && <span className="flex-1 mt-1.5" style={{ width: 2, minHeight: 16, background: `${tone}2a`, borderRadius: 2 }} />}
            </div>
            <div className="flex-1 min-w-0 space-y-2.5 pb-1">
              <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink, lineHeight: 1.35, paddingTop: 3 }}>
                <Inline t={t} text={st.title} />
              </div>
              {st.text && (Array.isArray(st.text) ? st.text : [st.text]).map((p, j) => <Para key={j} t={t} size={13.5}><Inline t={t} text={p} /></Para>)}
              {st.path && (
                <div className="inline-flex flex-wrap items-center gap-1 rounded-xl px-2.5 py-1.5" style={{ background: `${tone}10`, border: `1px solid ${tone}30` }}>
                  {st.path.map((p, j) => (
                    <React.Fragment key={j}>
                      {j > 0 && <ArrowRight size={11} style={{ color: ink }} aria-hidden="true" />}
                      <span style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: ink }}>{p}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}
              {st.code && <CodeTabs tabs={st.code} title={st.codeTitle} />}
              {st.note && <Callout t={t} block={{ tone: 'info', text: st.note }} compact />}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ─── callouts ───────────────────────────────────────────────────────────────
const CALLOUT = {
  info:     { icon: Info, key: 'live', title: null },
  warn:     { icon: AlertTriangle, key: 'warn', title: null },
  tip:      { icon: CheckCircle2, key: 'pass', title: null },
  observed: { icon: Eye, key: 'warn', title: 'Observed in this portal — not in the official docs' },
  docs:     { icon: BookOpen, key: 'live', title: 'From the official docs' },
}

export function Callout({ t, block, compact = false }) {
  const kind = CALLOUT[block.tone] ?? CALLOUT.info
  const c = t[kind.key]
  const ink = t.isLight ? shade(c, kind.key === 'warn' ? 0.42 : 0.28) : c
  const Icon = kind.icon
  const title = block.title ?? kind.title
  return (
    <div className="flex gap-3 rounded-2xl" style={{ padding: compact ? '9px 12px' : '12px 14px', background: `${c}10`, border: `1px solid ${c}38` }}>
      <Icon size={compact ? 14 : 16} style={{ color: ink, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <div style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: ink }}>{title}</div>}
        {(Array.isArray(block.text) ? block.text : [block.text]).filter(Boolean).map((p, i) => (
          <div key={i} style={{ fontFamily: FONT.prose, fontSize: compact ? 12.5 : 13, lineHeight: 1.6, color: t.ink }}><Inline t={t} text={p} /></div>
        ))}
      </div>
    </div>
  )
}

// ─── "in this portal": real code from this repo ─────────────────────────────
function Repo({ t, block }) {
  const [open, setOpen] = useState(block.open ?? false)
  const tone = t.pass
  const ink = t.isLight ? shade(tone, 0.3) : tone
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: t.panel, border: `1px solid ${tone}40` }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className={`w-full flex items-center gap-3 text-left ${focusCls}`} style={{ padding: '10px 12px' }}>
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: bandBg(tone) }}>
          <GitBranch size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>In this portal · {block.title}</span>
          <span className="block truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11, color: ink, marginTop: 1 }}>{block.file}{block.lines ? `:${block.lines}` : ''}</span>
        </span>
        <span className="rounded-full px-2 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, color: ink, background: `${tone}17` }}>runs today</span>
        <ChevronDown size={14} style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-2.5">
              {block.why && <Para t={t} size={13}><Inline t={t} text={block.why} /></Para>}
              <CodeTabs tabs={[{ id: block.lang ?? 'javascript', lang: block.lang ?? 'javascript', code: block.code, file: block.file }]} compact maxHeight={420} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── tables ─────────────────────────────────────────────────────────────────
function Table({ t, block }) {
  return (
    <div>
      {block.title && <h3 style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 700, color: t.ink, margin: '0 0 10px' }}>{block.title}</h3>}
      <div className="rounded-2xl overflow-x-auto" style={{ border: `1px solid ${t.hairline}`, background: t.panel }}>
        <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: block.minWidth ?? 520 }}>
          <thead>
            <tr style={{ background: t.sunken }}>
              {block.columns.map((c) => (
                <th key={c} className="text-left px-3 py-2" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 700, color: t.inkDim, borderBottom: `1px solid ${t.hairline}`, whiteSpace: 'nowrap' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={i} style={{ borderTop: i ? `1px solid ${t.hairline}` : 'none' }}>
                {r.map((cell, j) => (
                  <td key={j} className="px-3 py-2 align-top" style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: j === 0 ? t.ink : t.inkDim, fontWeight: j === 0 ? 600 : 400 }}>
                    <Inline t={t} text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {block.note && <div className="mt-2"><Para t={t} size={12}><Inline t={t} text={block.note} /></Para></div>}
    </div>
  )
}

// ─── fact tiles ─────────────────────────────────────────────────────────────
function Facts({ t, tone, block }) {
  const ink = t.isLight ? shade(tone, 0.25) : tone
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${block.min ?? 170}px, 1fr))` }}>
      {block.items.map((f) => (
        <div key={f.label} className="rounded-2xl px-3.5 py-3 min-w-0" style={{ background: t.panel, border: `1px solid ${t.glassEdge}`, boxShadow: t.shadowSm }}>
          <div className="truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.inkDim }}>{f.label}</div>
          <div className="break-words" dir={f.mono ? 'ltr' : undefined} style={{ fontFamily: f.mono ? FONT.mono : FONT.display, fontSize: f.mono ? 13 : 19, fontWeight: 700, color: f.accent ? ink : t.ink, lineHeight: 1.25, marginTop: 4 }}>{f.value}</div>
          {f.sub && <div style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, marginTop: 3 }}><Inline t={t} text={f.sub} /></div>}
        </div>
      ))}
    </div>
  )
}

// ─── decision cards ─────────────────────────────────────────────────────────
function Cards({ t, block, onGo }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${block.min ?? 250}px, 1fr))` }}>
      {block.items.map((c) => <DecisionCard key={c.title} t={t} card={c} onGo={onGo} />)}
    </div>
  )
}

function DecisionCard({ t, card, onGo }) {
  const [hot, setHot] = useState(false)
  const Icon = card.icon
  const tone = card.tone
  return (
    <div onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
         className="rounded-3xl p-4 flex flex-col min-w-0"
         style={{ background: t.panel, border: `1px solid ${hot ? `${tone}66` : t.glassEdge}`, boxShadow: hot ? `0 12px 26px ${tone}22` : t.shadowSm, transition: 'border-color 160ms, box-shadow 200ms' }}>
      <div className="flex items-center gap-3">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 38, height: 38, background: bandBg(tone), boxShadow: `0 5px 12px ${tone}44` }}>
          <Icon size={17} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink, lineHeight: 1.2 }}>{card.title}</div>
          {card.kicker && <div style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>{card.kicker}</div>}
        </div>
      </div>
      <div className="mt-2.5 flex-1"><Para t={t} size={13}><Inline t={t} text={card.text} /></Para></div>
      {card.bullets && (
        <ul className="mt-2.5 space-y-1">
          {card.bullets.map((b) => (
            <li key={b} className="flex gap-2" style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.5, color: t.inkDim }}>
              <span className="rounded-full flex-shrink-0" style={{ width: 5, height: 5, marginTop: 7, background: tone }} aria-hidden="true" />
              <span><Inline t={t} text={b} /></span>
            </li>
          ))}
        </ul>
      )}
      {card.go && (
        <button type="button" onClick={() => onGo(card.go)}
                className={`mt-3 self-start inline-flex items-center gap-1.5 rounded-full px-3 ${focusCls}`}
                style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: hot ? '#fff' : (t.isLight ? shade(tone, 0.3) : tone), background: hot ? bandBg(tone) : `${tone}14`, transition: 'background 140ms, color 140ms' }}>
          {card.goLabel ?? 'Open the guide'} <ArrowRight size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

// ─── official doc links ─────────────────────────────────────────────────────
const SOURCE = {
  docs:   { label: 'docs.paloaltonetworks.com', key: 'live' },
  pandev: { label: 'pan.dev', key: 'live' },
  aigw:   { label: 'portkey.ai/docs', key: 'live' },
  pypi:   { label: 'PyPI', key: 'pass' },
  npm:    { label: 'npm', key: 'pass' },
  github: { label: 'GitHub', key: 'idle' },
  scm:    { label: 'Strata Cloud Manager', key: 'warn' },
  other:  { label: 'reference', key: 'idle' },
}

export function DocLinks({ t, block, dense = false }) {
  return (
    <div>
      {block.title && <h3 style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 700, color: t.ink, margin: '0 0 10px' }}>{block.title}</h3>}
      <div className={dense ? 'space-y-1' : 'grid gap-2'} style={dense ? undefined : { gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {block.items.map((l) => <DocLink key={l.url} t={t} link={l} dense={dense} />)}
      </div>
    </div>
  )
}

function DocLink({ t, link, dense }) {
  const [hot, setHot] = useState(false)
  const src = SOURCE[link.source] ?? SOURCE.other
  const c = t[src.key]
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
       className={`flex items-start gap-3 rounded-2xl text-left ${focusCls}`}
       style={{ padding: dense ? '7px 8px' : '10px 12px', background: hot ? `${c}0f` : dense ? 'transparent' : t.panel, border: dense ? '1px solid transparent' : `1px solid ${hot ? `${c}55` : t.hairline}`, transition: 'background 140ms, border-color 140ms' }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: dense ? 26 : 30, height: dense ? 26 : 30, background: `${c}16`, color: c }}>
        <BookOpen size={dense ? 12 : 14} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontFamily: FONT.prose, fontSize: dense ? 12.5 : 13, fontWeight: 650, color: t.ink, lineHeight: 1.35 }}>{link.title}</span>
        {link.what && !dense && <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>{link.what}</span>}
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600, color: t.isLight ? shade(c, 0.3) : c, marginTop: 2 }}>{src.label}</span>
      </span>
      <ExternalLink size={13} className="flex-shrink-0" style={{ color: hot ? t.ink : t.inkFaint, marginTop: 3 }} aria-hidden="true" />
    </a>
  )
}

// ─── checklist ──────────────────────────────────────────────────────────────
function Checklist({ t, tone, block }) {
  return (
    <div className="rounded-2xl p-3.5" style={{ background: t.panel, border: `1px solid ${t.glassEdge}` }}>
      {block.title && <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, marginBottom: 8 }}>{block.title}</div>}
      <ul className="space-y-2">
        {block.items.map((it) => (
          <li key={it} className="flex gap-2.5" style={{ fontFamily: FONT.prose, fontSize: 13, lineHeight: 1.55, color: t.ink }}>
            <CheckCircle2 size={15} style={{ color: tone, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <span><Inline t={t} text={it} /></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── catalog: every page of a doc set, grouped and filterable ──────────────
// block.catalog = { source, pages, generatedAt, groups: [{ title, area, pages: [[title, path, what, sub]] }] }
const AREAS = [['', 'Everything'], ['product', 'Product'], ['api', 'API reference'], ['integrations', 'Integrations'], ['ops', 'Self-hosting'], ['docs', 'Start · changelog']]

function Catalog({ t, tone, block }) {
  const c = block.catalog
  const [q, setQ] = useState('')
  const [area, setArea] = useState('')
  const [open, setOpen] = useState(() => new Set())
  const needle = q.trim().toLowerCase()
  const groups = useMemo(() => c.groups
    .filter((g) => !area || g.area === area)
    .map((g) => ({ ...g, hits: needle ? g.pages.filter((p) => `${p[0]} ${p[2]} ${p[3]} ${p[1]}`.toLowerCase().includes(needle)) : g.pages }))
    .filter((g) => g.hits.length), [c, area, needle])
  const shown = groups.reduce((n, g) => n + g.hits.length, 0)
  const urlOf = (p) => (p.startsWith('/docs') ? `https://portkey.ai${p}` : `${c.source}${p}`)
  const ink = t.isLight ? shade(tone, 0.25) : tone
  const toggle = (title) => setOpen((s) => { const n = new Set(s); n.has(title) ? n.delete(title) : n.add(title); return n })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl px-3" style={{ height: 40, background: t.panel, border: `1px solid ${t.hairline}` }}>
        <Search size={15} style={{ color: t.inkDim, flexShrink: 0 }} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filter ${c.pages} pages — titles and descriptions`} aria-label="Filter the doc pages"
               ref={(el) => el?.style.setProperty('background-color', 'transparent', 'important')}
               className="flex-1 min-w-0 outline-none" style={{ fontFamily: FONT.prose, fontSize: 13, color: t.ink, border: 'none' }} />
        {q && <button type="button" onClick={() => setQ('')} aria-label="Clear the filter" className={`grid place-items-center rounded-full ${focusCls}`} style={{ width: 22, height: 22, color: t.inkDim }}><X size={13} /></button>}
        <span className="flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>{shown} of {c.pages}</span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Area">
        {AREAS.map(([id, label]) => {
          const on = area === id
          return (
            <button key={id || 'all'} type="button" role="radio" aria-checked={on} onClick={() => setArea(id)}
                    className={`rounded-full px-3 ${focusCls}`}
                    style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: on ? '#fff' : t.inkDim, background: on ? bandBg(tone) : t.panel, border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 4px 12px ${tone}40` : 'none' }}>
              {label}
            </button>
          )
        })}
      </div>
      {groups.length === 0 && <p className="px-2 py-4" style={{ fontFamily: FONT.prose, fontSize: 13, color: t.inkDim }}>No page title or description matches “{q}”. Ask the docs instead — top of the rail.</p>}
      <div className="space-y-2">
        {groups.map((g) => {
          const isOpen = !!needle || open.has(g.title)
          return (
            <div key={g.title} className="rounded-2xl overflow-hidden" style={{ background: t.panel, border: `1px solid ${isOpen ? `${tone}55` : t.hairline}` }}>
              <button type="button" onClick={() => toggle(g.title)} aria-expanded={isOpen} className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left ${focusCls}`}>
                <span className="min-w-0 flex-1 truncate" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{g.title}</span>
                <span className="rounded-full px-2 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 11, fontWeight: 600, lineHeight: '20px', color: isOpen ? ink : t.inkDim, background: isOpen ? `${tone}17` : t.sunken }}>{needle ? `${g.hits.length} of ${g.pages.length}` : g.pages.length}</span>
                <ChevronDown size={14} style={{ color: t.inkDim, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} aria-hidden="true" />
              </button>
              {isOpen && (
                <div className="px-1.5 pb-1.5">
                  {g.hits.map(([title, path, what, sub]) => (
                    <a key={path} href={urlOf(path)} target="_blank" rel="noopener noreferrer"
                       className={`flex items-start gap-2.5 rounded-xl px-2.5 py-1.5 ${focusCls}`}
                       onMouseEnter={(e) => { e.currentTarget.style.background = t.sunken }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                      <span className="min-w-0 flex-1">
                        <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 650, color: t.ink, lineHeight: 1.35 }}>
                          {title}{sub ? <span style={{ fontWeight: 500, color: t.inkFaint }}> · {sub}</span> : null}
                        </span>
                        {what && <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim }}>{what}</span>}
                      </span>
                      <ExternalLink size={12} style={{ color: t.inkFaint, flexShrink: 0, marginTop: 3 }} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkFaint }}>Read from the official llms.txt indexes on {c.generatedAt}; descriptions are one line each. Regenerate with <code style={{ fontFamily: FONT.mono }}>node scripts/gen-aigw-catalog.mjs</code>.</p>
    </div>
  )
}

// ─── a runnable marker: points at the live panel ────────────────────────────
function LiveHint({ t, block, onRun }) {
  const tone = t.live
  return (
    <button type="button" onClick={() => onRun?.(block.preset)}
            className={`w-full flex items-center gap-3 rounded-2xl text-left ${focusCls}`}
            style={{ padding: '10px 12px', background: `linear-gradient(120deg, ${tone}17, ${tone}08), ${t.panel}`, border: `1px solid ${tone}55` }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: bandBg(tone) }}>
        <FlaskConical size={15} style={{ color: '#fff' }} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{block.title ?? 'Run this for real'}</span>
        <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>{block.text ?? 'Sends this exact request from the portal and shows what came back.'}</span>
      </span>
      <ArrowRight size={15} style={{ color: tone, flexShrink: 0 }} aria-hidden="true" />
    </button>
  )
}

export function Block({ t, tone, block, onGo, onRun, vars }) {
  switch (block.type) {
    case 'prose': return <Prose t={t} block={block} />
    case 'steps': return <Steps t={t} tone={tone} block={block} />
    case 'code': return (
      <div className="space-y-2">
        {block.title && <h3 style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 700, color: t.ink, margin: 0 }}>{block.title}</h3>}
        {block.text && <Para t={t} size={13.5}><Inline t={t} text={block.text} /></Para>}
        <CodeTabs tabs={block.build ? block.build(vars ?? {}) : block.tabs} title={block.file} />
      </div>
    )
    case 'callout': return <Callout t={t} block={block} />
    case 'repo': return <Repo t={t} block={block} />
    case 'table': return <Table t={t} block={block} />
    case 'facts': return <Facts t={t} tone={tone} block={block} />
    case 'cards': return <Cards t={t} block={block} onGo={onGo} />
    case 'links': return <DocLinks t={t} block={block} />
    case 'checklist': return <Checklist t={t} tone={tone} block={block} />
    case 'live': return <LiveHint t={t} block={block} onRun={onRun} />
    case 'catalog': return <Catalog t={t} tone={tone} block={block} />
    default: return null
  }
}

