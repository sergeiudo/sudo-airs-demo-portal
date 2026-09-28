import React, { createContext, useContext, useMemo, useState } from 'react'
import { Copy, Check, FileCode2, BadgeCheck } from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { tokenize, TOKEN_COLOR } from './highlight'

/**
 * CodeTabs — the Developer Corner's code viewer. Language tabs (cURL · Python ·
 * Node …), a file label, a copy button, and highlighted code on a forced-dark
 * panel (syntax-highlighted code stays dark in both themes — CLAUDE.md).
 *
 * The chosen language is shared across every block on the page through
 * LangPref, the way API docs usually behave: pick Python once, see Python
 * everywhere that offers it.
 */

export const LangPref = createContext({ lang: 'curl', setLang: () => {} })

const LANG_LABEL = { curl: 'cURL', bash: 'Shell', python: 'Python', node: 'Node.js', javascript: 'JavaScript', typescript: 'TypeScript', go: 'Go', java: 'Java', json: 'JSON', yaml: 'YAML', http: 'HTTP' }
const HL_LANG = { curl: 'bash', bash: 'bash', python: 'python', node: 'javascript', javascript: 'javascript', typescript: 'javascript', go: 'go', java: 'java', json: 'json', yaml: 'yaml', http: 'bash' }

function Highlighted({ code, lang }) {
  const tokens = useMemo(() => tokenize(code, HL_LANG[lang] ?? lang), [code, lang])
  return tokens.map((tk, i) => <span key={i} style={{ color: TOKEN_COLOR[tk.kind] ?? TOKEN_COLOR.plain }}>{tk.text}</span>)
}

export function CopyIcon({ text, light = false, size = 13 }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" aria-label="Copy code" title="Copy"
            onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1300) }}
            className="grid place-items-center rounded-lg flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
            style={{ width: 28, height: 28, color: done ? '#3fb950' : light ? '#6A6A73' : '#8b949e', background: done ? 'rgba(63,185,80,0.12)' : 'transparent' }}
            onMouseEnter={(e) => { if (!done) e.currentTarget.style.background = light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)' }}
            onMouseLeave={(e) => { if (!done) e.currentTarget.style.background = 'transparent' }}>
      {done ? <Check size={size} /> : <Copy size={size} />}
    </button>
  )
}

/**
 * `tabs`: [{ id, lang, code, label?, file?, verified? }]. `id` is what LangPref
 * matches (curl, python, node…). A single tab renders without a tab bar.
 *
 * `verified` means this exact snippet was run against a live tenant from this
 * portal. When some tabs of a block are verified and the active one is not,
 * the bar says so rather than letting it borrow the others' credibility.
 */
const VERIFIED_TIP = 'Run against a live Prisma AIRS tenant from this portal on 2026-09-28 — placeholders aside, this is the code that worked.'
const UNRUN_TIP = 'Not run from this portal. Built from the same request as the verified tabs in this block.'

function RunBadge({ verified }) {
  return (
    <span title={verified ? VERIFIED_TIP : UNRUN_TIP}
          className="inline-flex items-center gap-1 rounded-full px-2 flex-shrink-0"
          style={{ height: 20, fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600,
                   color: verified ? '#3fb950' : '#8b949e', background: verified ? 'rgba(63,185,80,0.12)' : 'rgba(139,148,158,0.12)',
                   border: `1px solid ${verified ? 'rgba(63,185,80,0.35)' : 'rgba(139,148,158,0.3)'}` }}>
      {verified && <BadgeCheck size={11} aria-hidden="true" />}
      {verified ? 'verified' : 'not run here'}
    </span>
  )
}
export function CodeTabs({ tabs, title, maxHeight = 520, compact = false }) {
  const { lang, setLang } = useContext(LangPref)
  const list = (tabs ?? []).filter((x) => x && x.code != null)
  const [local, setLocal] = useState(null)
  if (!list.length) return null
  const active = list.find((x) => x.id === local) ?? list.find((x) => x.id === lang) ?? list[0]
  const pick = (id) => { setLocal(id); if (['curl', 'python', 'node', 'javascript', 'typescript', 'go', 'java'].includes(id)) setLang(id) }
  const code = String(active.code).replace(/\s+$/, '')

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #30363d', boxShadow: '0 8px 22px rgba(0,0,0,0.18)' }}>
      <div className="flex items-center gap-1 px-2" style={{ minHeight: 40, background: '#161b22', borderBottom: '1px solid #30363d' }}>
        {title && (
          <span className="flex items-center gap-1.5 pl-1.5 pr-2 mr-1 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: '#c9d1d9' }}>
            <FileCode2 size={13} style={{ color: '#8b949e' }} aria-hidden="true" /> {title}
          </span>
        )}
        {list.length > 1 && (
          <div role="tablist" className="flex items-center gap-0.5 overflow-x-auto">
            {list.map((x) => {
              const on = x.id === active.id
              return (
                <button key={x.id} type="button" role="tab" aria-selected={on} onClick={() => pick(x.id)}
                        className="rounded-lg px-2.5 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
                        style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? '#f0f6fc' : '#8b949e', background: on ? '#30363d' : 'transparent' }}>
                  {x.label ?? LANG_LABEL[x.id] ?? x.id}
                </button>
              )
            })}
          </div>
        )}
        {list.length === 1 && !title && (
          <span className="pl-1.5" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: '#8b949e' }}>{active.label ?? LANG_LABEL[active.id] ?? active.id}</span>
        )}
        <span className="flex-1" />
        {(active.verified || list.some((x) => x.verified)) && <RunBadge verified={!!active.verified} />}
        {active.file && <span className="truncate mr-1" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: '#8b949e', maxWidth: 220 }}>{active.file}</span>}
        <CopyIcon text={code} />
      </div>
      {/* inline background: ui-new.css repaints any <pre> without one in the theme's (light) code colour */}
      <pre dir="ltr" className="overflow-auto" style={{ background: '#0d1117', margin: 0, padding: compact ? '10px 14px' : '14px 16px', maxHeight, fontFamily: FONT.mono, fontSize: 12, lineHeight: 1.65, whiteSpace: 'pre', tabSize: 2 }}>
        <code><Highlighted code={code} lang={active.lang ?? active.id} /></code>
      </pre>
    </div>
  )
}
