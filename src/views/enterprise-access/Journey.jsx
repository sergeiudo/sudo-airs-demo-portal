import React from 'react'
import { ChevronRight } from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade } from '../home-2027/band'
import { clock, journeyLines, STEPS } from './accessModel'

/**
 * Journey — the sign-in, step by step, with the values actually captured.
 * Lives in the evidence pane before the first prompt, where the pane would
 * otherwise only describe what is coming; each step opens the lifecycle
 * drawer at that step. Summaries wrap to two lines — the pane is narrow and
 * the value is the point.
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

export function Journey({ t, tone, session, onOpen }) {
  const lines = journeyLines(session)
  const L = session?.lifecycle ?? {}
  const ink = t.isLight ? shade(tone, 0.2) : tone
  return (
    <section>
      <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Your sign-in, step by step</div>
      <p style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, margin: '4px 0 6px' }}>
        Real values from this session, not examples. Open a step for its artifacts.
      </p>
      <ol>
        {STEPS.map((st) => {
          const Icon = st.icon
          const at = L[st.id]?.at
          return (
            <li key={st.id}>
              <button type="button" onClick={() => onOpen(st.id)}
                      className={`w-full flex items-start gap-2.5 rounded-xl text-left ${focusCls}`}
                      style={{ padding: '7px 6px', borderTop: `1px solid ${t.hairline}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = `${tone}0f` }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <span className="relative grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${tone}14`, color: ink }}>
                  <Icon size={14} aria-hidden="true" />
                  <span className="absolute grid place-items-center rounded-full"
                        style={{ right: -4, top: -4, width: 15, height: 15, fontFamily: FONT.mono, fontSize: 8.5, fontWeight: 700, color: '#fff', background: ink, border: `2px solid ${t.panel}` }}>
                    {st.n}
                  </span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="flex-1" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{st.title}</span>
                    {at && <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkFaint }}>{clock(at)}</span>}
                  </span>
                  <span className="block" title={lines[st.id]}
                        style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.4, color: t.inkDim, marginTop: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {lines[st.id] ?? st.line}
                  </span>
                </span>
                <ChevronRight size={14} style={{ color: t.inkFaint, flexShrink: 0, marginTop: 8 }} aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
