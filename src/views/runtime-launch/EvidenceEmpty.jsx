import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Radar, ShieldCheck, ListChecks, FileText, ExternalLink, Network } from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'
import { bandBg, bandDots } from '../home-2027/band'

/**
 * EvidenceEmpty — the evidence pane before the first fire.
 *
 * The 2027 console showed a pulsing radar and one line. Before anything has
 * been fired is exactly when an audience asks what the right-hand pane is for,
 * so this says it: a small band in the protection state's colour (green while
 * AIRS inspects, amber when it is off and nothing will be inspected), then the
 * four things that land here after each fire — five on the gateway lane,
 * where tool calls are scanned too.
 */
export function EvidenceEmpty({ t, backend, isProtected }) {
  const reduce = useReducedMotion()
  const tone = isProtected ? t.pass : t.warn
  const rows = [
    { icon: ShieldCheck, title: 'Verdict', text: 'Passed or intercepted — and at which scan it stopped.' },
    { icon: ListChecks, title: 'Detectors', text: 'Which AIRS detection services fired, and which stayed quiet.' },
    { icon: FileText, title: 'Per-service detail', text: 'The AIRS report: findings, masked data, the profile that decided.' },
    ...(backend === 'aigw' ? [{ icon: Network, title: 'Tool calls', text: 'The MCP manifest scan, then parameters and result for every call.' }] : []),
    { icon: ExternalLink, title: 'SCM deep link', text: 'The same event in Strata Cloud Manager, by its tr_id.' },
  ]
  return (
    <div className="flex flex-col h-full overflow-hidden" style={glass(t, { radius: 22 })}>
      <div className="relative flex-shrink-0 overflow-hidden" style={{ height: 96, background: bandBg(tone) }}>
        <div aria-hidden="true" className="absolute inset-0" style={bandDots} />
        <Radar aria-hidden="true" strokeWidth={1.3}
               style={{ position: 'absolute', right: -24, bottom: -40, width: 150, height: 150, color: '#fff', opacity: 0.15, transform: 'rotate(-10deg)' }} />
        <div className="relative h-full flex items-center gap-3 px-4">
          <motion.span className="grid place-items-center rounded-2xl flex-shrink-0"
                       animate={reduce ? undefined : { scale: [1, 1.06, 1] }} transition={{ duration: 2.4, repeat: Infinity }}
                       style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
            <Radar size={20} style={{ color: '#fff' }} aria-hidden="true" />
          </motion.span>
          <div className="min-w-0">
            <div style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>Evidence</div>
            <div style={{ fontFamily: FONT.display, fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 2 }}>
              {isProtected ? 'Standing by' : 'AIRS is off'}
            </div>
            <div style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>
              {isProtected ? 'Ready for the first fire' : 'Nothing will be inspected'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, marginBottom: 10 }}>What lands here after each fire</div>
        <ul className="space-y-3">
          {rows.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: `${t.live}14`, color: t.live }}>
                <Icon size={15} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{title}</span>
                <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.45, color: t.inkDim, marginTop: 1 }}>{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 pt-3" style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.inkDim, borderTop: `1px solid ${t.hairline}` }}>
          Fire a payload from the library, or click any record to inspect what the gate did with it.
        </p>
      </div>
    </div>
  )
}
