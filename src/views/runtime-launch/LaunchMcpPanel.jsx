import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plug, Server, Globe, Lock, Loader2, ChevronDown } from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'

/**
 * LaunchMcpPanel — the MCP tool-calling switch, as a category card.
 *
 * Same contract as McpServerPanel (which Classic and the v1 console keep):
 * only rendered on the SCM AI-GW backend, the switch and current routing stay
 * visible, the servers fold away. The switch is its own control beside the
 * disclosure, never nested inside it.
 *
 * Each server says how it is reached — brokered by the gateway, or direct,
 * where the AIRS tool_event scan is the only control — and whether its tools
 * are read-only.
 */

const PINK = '#EC4899'
const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

function Switch({ t, on, disabled, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label="MCP tool calling" disabled={disabled}
            onClick={() => onChange(!on)}
            className={`relative flex-shrink-0 rounded-full ${focusCls}`}
            style={{ width: 36, height: 21, background: on ? shade(PINK, 0.15) : t.isLight ? '#D4D4D8' : '#3F3F46', opacity: disabled ? 0.5 : 1, transition: 'background 160ms ease' }}>
      <motion.span className="absolute rounded-full" style={{ top: 2.5, width: 16, height: 16, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                   animate={{ left: on ? 17.5 : 2.5 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
    </button>
  )
}

export function LaunchMcpPanel({ t, enabled, server, onChange }) {
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [open, setOpen] = useState(false)
  const [hot, setHot] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/mcp/servers')
      .then((r) => r.json())
      .then((d) => { if (alive) { setServers(d.servers ?? []); setConfigured(!!d.configured) } })
      .catch(() => { if (alive) setServers([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const tools = servers.reduce((a, s) => a + (s.toolCount ?? 0), 0)
  const routing = server === 'auto' ? 'auto-route' : servers.find((s) => s.id === server)?.label ?? server
  const sub = !configured ? 'AIGW_API_KEY is not set'
    : !enabled ? 'Off — the model has no tools'
    : `${routing} · ${tools} tools`
  const chips = [{ id: 'auto', label: 'Auto', blurb: 'Route on the question wording' }, ...servers]
  const ink = t.isLight ? shade(PINK, 0.3) : PINK

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{
           background: t.panel,
           border: `1px solid ${open || hot ? `${PINK}55` : t.hairline}`,
           boxShadow: open ? `0 10px 24px ${PINK}1f` : hot ? t.shadowSm : 'none',
           transition: 'border-color 160ms ease, box-shadow 200ms ease',
         }}>
      <div className="flex items-center gap-2 pr-2.5" onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
                className={`flex-1 min-w-0 flex items-center gap-3 text-left ${focusCls}`} style={{ padding: '9px 0 9px 10px' }}>
          <span className="grid place-items-center rounded-xl flex-shrink-0"
                style={{ width: 34, height: 34, background: bandBg(PINK), opacity: enabled ? 1 : 0.55, boxShadow: enabled ? `0 5px 12px ${PINK}55` : 'none' }}>
            <Plug size={15} style={{ color: '#fff' }} aria-hidden="true" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink, lineHeight: 1.2 }}>MCP tool calling</span>
            <span className="block truncate" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, marginTop: 2 }}>{sub}</span>
          </span>
          {loading
            ? <Loader2 size={12} className="animate-spin flex-shrink-0" style={{ color: t.inkDim }} />
            : <ChevronDown size={13} className="flex-shrink-0" style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} aria-hidden="true" />}
        </button>
        <Switch t={t} on={enabled} disabled={!configured} onChange={(on) => onChange({ enabled: on, server })} />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }} className="overflow-hidden">
            <div className="px-3 pb-3 pt-2" style={{ borderTop: `1px solid ${t.hairline}` }}>
              <p style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.5, color: t.inkDim }}>
                {configured
                  ? 'Let the model reach live MCP servers and answer from real data. Every hop is AIRS-scanned.'
                  : 'AIGW_API_KEY is not set — MCP servers are unavailable.'}
              </p>

              {enabled && servers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5" role="radiogroup" aria-label="Route tool calls to">
                  {chips.map((s) => {
                    const on = server === s.id
                    return (
                      <button key={s.id} type="button" role="radio" aria-checked={on} title={s.blurb}
                              onClick={() => onChange({ enabled, server: s.id })}
                              className={`rounded-full px-3 ${focusCls}`}
                              style={{
                                height: 28, fontFamily: FONT.prose, fontSize: 11.5, fontWeight: on ? 700 : 500,
                                color: on ? '#fff' : t.inkDim, background: on ? bandBg(PINK) : t.sunken,
                                border: `1px solid ${on ? 'transparent' : t.hairline}`,
                              }}>
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {servers.length > 0 && (
                <div className="mt-2.5 space-y-0.5">
                  {servers.map((s) => {
                    const tone = s.brokered ? PINK : t.warn
                    return (
                      <div key={s.id} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5">
                        <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 26, height: 26, background: `${tone}18`, color: t.isLight ? shade(tone, 0.25) : tone }}>
                          {s.brokered ? <Server size={12} aria-hidden="true" /> : <Globe size={12} aria-hidden="true" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink }}>{s.label}</span>
                          <span className="block truncate" style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkDim }}>
                            {s.brokered ? 'via AI-GW' : 'direct'} · {s.host}
                          </span>
                        </span>
                        {s.readOnly && (
                          <span className="inline-flex items-center gap-1 rounded-full px-1.5 flex-shrink-0"
                                style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 600, color: t.isLight ? shade(t.pass, 0.2) : t.pass, background: `${t.pass}1a` }}>
                            <Lock size={9} aria-hidden="true" /> read-only
                          </span>
                        )}
                        <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }}>{s.toolCount}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              {enabled && <p className="mt-2" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: ink }}>Payloads now reach a model holding live tools.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
