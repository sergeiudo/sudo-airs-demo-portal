import React, { useEffect, useState } from 'react'
import { Plug, Server, Globe, Lock, Loader2, ChevronDown } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

/**
 * McpServerPanel — the MCP tool-calling switch for the SCM AI-GW backend.
 *
 * Off by default and only rendered on that backend. Turning it on gives the
 * model live tools, which changes what every payload in the attack library
 * does — that is a deliberate choice the operator makes, not a default.
 *
 * The routing chips let a demo pin one server. "Auto" keyword-routes on the
 * question, which is what you want when taking questions from the room.
 */
export function McpServerPanel({ enabled, server, onChange }) {
  const { state } = useAppContext()
  const isLight = state.isDark === false
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/mcp/servers')
      .then((r) => r.json())
      .then((d) => { if (alive) { setServers(d.servers ?? []); setConfigured(!!d.configured) } })
      .catch(() => { if (alive) setServers([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const C = {
    panel:  isLight ? 'rgba(236,72,153,0.05)' : 'rgba(236,72,153,0.07)',
    border: isLight ? 'rgba(236,72,153,0.24)' : 'rgba(236,72,153,0.26)',
    text:   isLight ? '#0f172a' : '#e2e8f0',
    meta:   isLight ? '#64748b' : '#94a3b8',
    chipBg: isLight ? '#ffffff' : 'rgba(255,255,255,0.05)',
    chipBr: isLight ? 'rgba(0,48,135,0.14)' : 'rgba(255,255,255,0.12)',
  }
  const PINK = '#EC4899'

  const [open, setOpen] = useState(false)

  const chips = [{ id: 'auto', label: 'Auto', blurb: 'Route on the question wording' }, ...servers]

  return (
    <div className="rounded-xl border p-2.5" style={{ background: C.panel, borderColor: C.border }}>
      {/* Collapsed by default. The switch and the current routing stay visible
          — both are live demo controls — but the explanation and the server
          inventory fold away, because at full height this panel was taking a
          third of the left rail before the attack library even started. */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange({ enabled: e.target.checked, server })}
          disabled={!configured}
          className="accent-pink-500 flex-shrink-0 cursor-pointer"
          style={{ width: 13, height: 13 }}
        />
        <Plug size={11} style={{ color: PINK, flexShrink: 0 }} />
        <span className="text-[10.5px] font-bold flex-shrink-0" style={{ color: PINK }}>MCP tool calling</span>
        {loading && <Loader2 size={9} className="animate-spin" style={{ color: C.meta }} />}
        {enabled && servers.length > 0 && !open && (
          <span className="text-[9px] truncate" style={{ color: C.meta }}>
            · {server === 'auto' ? 'auto-route' : servers.find((s) => s.id === server)?.label ?? server}
            {' · '}{servers.reduce((a, s) => a + (s.toolCount ?? 0), 0)} tools
          </span>
        )}
        <button onClick={() => setOpen((o) => !o)} className="ml-auto flex-shrink-0 p-0.5"
                title={open ? 'Hide servers' : 'Show servers'}>
          <ChevronDown size={11} style={{
            color: C.meta, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms',
          }} />
        </button>
      </div>

      {open && (
        <p className="text-[9.5px] mt-1.5 leading-snug" style={{ color: C.meta }}>
          {configured
            ? 'Let the model reach live MCP servers and answer from real data. Every hop is AIRS-scanned.'
            : 'AIGW_API_KEY is not set — MCP servers are unavailable.'}
        </p>
      )}

      {open && enabled && servers.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1 mt-2">
            {chips.map((s) => {
              const on = server === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => onChange({ enabled, server: s.id })}
                  title={s.blurb}
                  className="px-1.5 py-1 rounded-lg border text-[9.5px] font-semibold transition-colors"
                  style={{
                    background: on ? `${PINK}1f` : C.chipBg,
                    borderColor: on ? `${PINK}66` : C.chipBr,
                    color: on ? PINK : C.meta,
                  }}
                >
                  {s.label}
                </button>
              )
            })}
          </div>

          <div className="mt-2 space-y-1">
            {servers.map((s) => (
              <div key={s.id} className="flex items-center gap-1.5 text-[9px]" style={{ color: C.meta }}>
                {/* Brokered by the SCM AI Gateway, or reached directly? The
                    gateway has no visibility into a direct server, so the only
                    control there is the AIRS tool_event scan. */}
                {s.brokered
                  ? <Server size={9} style={{ color: PINK, flexShrink: 0 }} />
                  : <Globe size={9} style={{ color: '#F59E0B', flexShrink: 0 }} />}
                <span className="font-semibold" style={{ color: C.text }}>{s.label}</span>
                <span className="font-mono opacity-70 truncate">{s.host}</span>
                <span className="ml-auto flex items-center gap-1 flex-shrink-0">
                  {s.readOnly && (
                    <span className="inline-flex items-center gap-0.5 px-1 rounded font-bold"
                          style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                      <Lock size={7} /> READ-ONLY
                    </span>
                  )}
                  <span>{s.toolCount} tools</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
