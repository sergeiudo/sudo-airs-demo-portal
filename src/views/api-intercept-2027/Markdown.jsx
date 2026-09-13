import React from 'react'
import { FONT } from './tokens'

/**
 * Markdown → React for model answers.
 *
 * Models reply in markdown and the console was rendering it as pre-wrapped
 * plain text, so a tool-calling answer arrived as a wall of `|` and `**`. The
 * pillar already owns a smaller version of this (`MarkdownLite` in BriutApp);
 * this one adds the two constructs that actually broke on screen — tables and
 * fenced code — and follows the same hard rule: build React nodes, never
 * `dangerouslySetInnerHTML`. Model output is the untrusted input this whole
 * demo is about, and an HTML sink here would be the joke writing itself.
 *
 * Deliberately not a library. Six constructs, no dependency, and it renders
 * inside a chat bubble whose type scale is already set by the caller.
 */

/** **bold**, *italic*, `code`, [text](url) — flat, non-nesting, good enough. */
function inline(text, t, keyBase) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|(?<!\*)\*[^*\n]+\*(?!\*)|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean)
  return parts.map((p, i) => {
    const k = `${keyBase}-${i}`
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={k} style={{ fontWeight: 700, color: t.ink }}>{p.slice(2, -2)}</strong>
    if (/^\*[^*]+\*$/.test(p)) return <em key={k}>{p.slice(1, -1)}</em>
    if (/^`[^`]+`$/.test(p)) {
      return (
        <code key={k} dir="ltr" style={{
          fontFamily: FONT.mono, fontSize: '0.86em', background: t.codeBg,
          padding: '1px 5px', borderRadius: 5, color: t.ink,
        }}>{p.slice(1, -1)}</code>
      )
    }
    const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      return (
        <a key={k} href={link[2]} target="_blank" rel="noreferrer"
           style={{ color: t.live, textDecoration: 'underline', textUnderlineOffset: 2 }}>
          {link[1]}
        </a>
      )
    }
    return <React.Fragment key={k}>{p}</React.Fragment>
  })
}

const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l)
const isDivider  = (l) => /^\s*\|?[\s:-]*-{2,}[\s:|-]*\|?\s*$/.test(l) && l.includes('-')
const cells      = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

function Table({ rows, t }) {
  const [head, ...body] = rows
  return (
    <div className="my-2 overflow-x-auto" style={{ borderRadius: 12, border: `1px solid ${t.hairline}` }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.92em' }}>
        <thead>
          <tr style={{ background: t.codeBg }}>
            {head.map((c, i) => (
              <th key={i} style={{
                textAlign: 'left', padding: '7px 10px', whiteSpace: 'nowrap',
                fontFamily: FONT.display, fontWeight: 700, fontSize: '0.92em', color: t.ink,
                borderBottom: `1px solid ${t.hairline}`,
              }}>{inline(c, t, `th${i}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} style={{ background: ri % 2 ? t.codeBg : 'transparent' }}>
              {r.map((c, ci) => (
                <td key={ci} style={{
                  padding: '6px 10px', verticalAlign: 'top', color: ci === 0 ? t.ink : t.inkDim,
                  borderTop: `1px solid ${t.hairline}`,
                }}>{inline(c, t, `td${ri}-${ci}`)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const Markdown = React.memo(function Markdown({ text, t }) {
  const lines = String(text ?? '').split('\n')
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trimEnd()

    // fenced code
    if (/^\s*```/.test(line)) {
      const lang = line.replace(/^\s*```/, '').trim()
      const buf = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++ }
      i++
      out.push(
        <div key={`c-${i}`} className="my-2" style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.hairline}` }}>
          {lang && (
            <div style={{
              fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: t.inkFaint, background: t.codeBg, padding: '4px 10px', borderBottom: `1px solid ${t.hairline}`,
            }}>{lang}</div>
          )}
          <pre dir="ltr" className="overflow-x-auto" style={{
            margin: 0, padding: '9px 11px', background: t.codeBg,
            fontFamily: FONT.mono, fontSize: '0.84em', lineHeight: 1.5, color: t.ink,
          }}>{buf.join('\n')}</pre>
        </div>
      )
      continue
    }

    // table — a header row, a divider, then body rows
    if (isTableRow(line) && isDivider(lines[i + 1] ?? '')) {
      const rows = [cells(line)]
      i += 2
      while (i < lines.length && isTableRow(lines[i])) { rows.push(cells(lines[i])); i++ }
      out.push(<Table key={`t-${i}`} rows={rows} t={t} />)
      continue
    }

    if (!line.trim()) { out.push(<div key={`sp-${i}`} style={{ height: 8 }} />); i++; continue }

    // horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push(<div key={`hr-${i}`} style={{ height: 1, background: t.hairline, margin: '10px 0' }} />)
      i++
      continue
    }

    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      out.push(
        <div key={`h-${i}`} style={{
          fontFamily: FONT.display, fontWeight: 700, color: t.ink,
          fontSize: h[1].length <= 2 ? '1.12em' : '1.02em',
          margin: out.length ? '10px 0 4px' : '0 0 4px',
        }}>{inline(h[2], t, `h${i}`)}</div>
      )
      i++
      continue
    }

    // blockquote
    const q = line.match(/^\s*>\s?(.*)$/)
    if (q) {
      out.push(
        <div key={`q-${i}`} style={{
          borderLeft: `2px solid ${t.hairline}`, paddingLeft: 10, margin: '4px 0', color: t.inkDim,
        }}>{inline(q[1], t, `q${i}`)}</div>
      )
      i++
      continue
    }

    const bullet = line.match(/^(\s*)[-*•]\s+(.*)$/)
    const num    = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/)
    if (bullet || num) {
      const indent = ((bullet ? bullet[1] : num[1]).length >= 2) ? 16 : 0
      out.push(
        <div key={`li-${i}`} style={{ display: 'flex', gap: 8, margin: '2px 0', paddingLeft: indent }}>
          <span style={{ color: t.inkFaint, flexShrink: 0, fontWeight: 700, minWidth: num ? 14 : 6 }}>
            {num ? `${num[2]}.` : '•'}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>{inline(bullet ? bullet[2] : num[3], t, `li${i}`)}</span>
        </div>
      )
      i++
      continue
    }

    out.push(<div key={`p-${i}`} style={{ margin: '1px 0' }}>{inline(line, t, `p${i}`)}</div>)
    i++
  }

  return <>{out}</>
})
