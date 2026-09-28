import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Route, ChevronDown, ArrowDown, Copy, Check } from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { policyRows } from './accessModel'

/**
 * PolicyPanel — the conditional config the gateway enforces, as a sentence
 * per branch in evaluation order, then the JSON itself. Derived from the
 * config the server reports, so the explanation cannot drift from what the
 * portal predicts. `match` highlights the branch a given caller lands on.
 */

export function Code({ t, children }) {
  return (
    <code dir="ltr" className="rounded-md px-1.5 py-px" style={{ fontFamily: FONT.mono, fontSize: 11.5, color: t.ink, background: t.sunken, border: `1px solid ${t.hairline}` }}>
      {children}
    </code>
  )
}

export function PolicyRules({ t, tone, config, match }) {
  const rows = useMemo(() => policyRows(config?.policy, config?.models), [config])
  const ink = t.isLight ? shade(tone, 0.25) : tone
  return (
    <ol className="space-y-1">
      {rows.map((r) => {
        const on = match != null && r.n === match
        return (
          <li key={r.fallback ? 'default' : r.n} className="flex items-start gap-2.5 rounded-xl"
              style={{ padding: '6px 8px', background: on ? `${tone}14` : 'transparent', border: `1px solid ${on ? `${tone}44` : 'transparent'}` }}>
            <span className="grid place-items-center rounded-lg flex-shrink-0"
                  style={{ width: 22, height: 22, marginTop: 1, fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 700, color: on ? '#fff' : ink, background: on ? bandBg(tone) : `${tone}17` }}>
              {r.fallback ? <ArrowDown size={11} aria-hidden="true" /> : r.n}
            </span>
            <span className="flex-1 min-w-0" style={{ fontFamily: FONT.prose, fontSize: 13, lineHeight: 1.6, color: t.inkDim }}>
              {r.fallback
                ? <>Anything that matches nothing falls through to <Code t={t}>{r.target}</Code>, so an unknown caller gets the most restricted route rather than the most permissive one.</>
                : <>When <Code t={t}>{r.field}</Code> is <Code t={t}>{r.value}</Code>, the gateway{' '}
                    {r.model ? <>replaces the request with <b style={{ color: ink }}>{r.modelLabel}</b>.</> : <>forwards whichever model was requested.</>}</>}
            </span>
            {on && <span className="rounded-full px-2 flex-shrink-0" style={{ height: 20, lineHeight: '20px', marginTop: 2, fontFamily: FONT.prose, fontSize: 11, fontWeight: 700, color: '#fff', background: bandBg(tone) }}>you</span>}
          </li>
        )
      })}
    </ol>
  )
}

export function JsonBlock({ t, value, maxHeight = 420 }) {
  const [done, setDone] = useState(false)
  const text = useMemo(() => JSON.stringify(value, null, 2), [value])
  return (
    <div className="relative">
      <button type="button" aria-label="Copy JSON" title="Copy"
              onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200) }}
              className="absolute grid place-items-center rounded-full" style={{ top: 8, right: 8, width: 26, height: 26, color: done ? t.pass : t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
        {done ? <Check size={12} /> : <Copy size={12} />}
      </button>
      <pre dir="ltr" className="overflow-auto rounded-xl" style={{ margin: 0, padding: '12px 14px', maxHeight, background: t.codeBg, border: `1px solid ${t.hairline}`, fontFamily: FONT.mono, fontSize: 11.5, lineHeight: 1.6, color: t.inkDim, whiteSpace: 'pre' }}>
        {text}
      </pre>
    </div>
  )
}

export function PolicyPanel({ t, tone, config, match, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const [hot, setHot] = useState(false)
  if (!config?.policy) return null
  return (
    <section className="rounded-3xl overflow-hidden" style={{
      background: t.panel, border: `1px solid ${open || hot ? `${tone}55` : t.glassEdge}`,
      boxShadow: open ? `0 10px 24px ${tone}1f` : t.shadowSm, transition: 'border-color 160ms ease, box-shadow 200ms ease',
    }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
              className="w-full flex items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              style={{ padding: '12px 14px' }}>
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 34, height: 34, background: bandBg(tone), boxShadow: open || hot ? `0 5px 12px ${tone}55` : 'none' }}>
          <Route size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block" style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink }}>The routing policy the gateway enforces</span>
          <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim, marginTop: 1 }}>
            {config.rules} rules · first match wins · <span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>{config.configId ?? 'config not set'}</span>
          </span>
        </span>
        <ChevronDown size={15} style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${t.hairline}`, paddingTop: 12 }}>
              <PolicyRules t={t} tone={tone} config={config} match={match} />
              <p style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.6, color: t.inkDim, margin: 0 }}>
                Conditions are evaluated top to bottom and the first match wins, which is why the address exemption sits above the role rules.
                The claims being matched arrive inside the signed token, so a browser cannot alter them.
              </p>
              <JsonBlock t={t} value={config.policy} />
              <p style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.6, color: t.inkDim, margin: 0 }}>
                Stored in the gateway as <Code t={t}>{config.configId ?? '—'}</Code>. Every request carries this id inside its signed token,
                so the policy travels with the caller instead of being chosen by them. The gateway enforces; this copy only explains.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
