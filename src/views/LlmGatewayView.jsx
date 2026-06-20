import React, { useEffect, useState } from 'react'
import { Waypoints, Zap, BookOpen, LayoutDashboard, Columns3, Boxes } from 'lucide-react'
import { OverviewTab } from './llm-gateway/OverviewTab'
import { ScenariosTab } from './llm-gateway/ScenariosTab'
import { LiveDemoTab } from './llm-gateway/LiveDemoTab'
import { McpRegistryTab } from './llm-gateway/McpRegistryTab'
import { GuideTab } from './llm-gateway/GuideTab'
import { PortkeyStatusStrip } from './llm-gateway/components/PortkeyStatusStrip'

const ACCENT = '#ec4899'

const TABS = [
  { id: 'overview',  label: 'Overview',          icon: LayoutDashboard },
  { id: 'scenarios', label: 'Scenarios',         icon: Columns3 },
  { id: 'live',      label: 'Live Demo',         icon: Zap },
  { id: 'mcp',       label: 'MCP Registry',      icon: Boxes },
  { id: 'guide',     label: 'Integration Guide', icon: BookOpen },
]

export function LlmGatewayView() {
  const [tab, setTab] = useState('overview')
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch('/api/gateway/health')
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false, status: 'down', reachable: false, modelCount: 0, missing: ['network'] }))
  }, [])

  if (health && health.status === 'unconfigured') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-xl p-6 rounded-2xl text-center"
             style={{ background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.4)' }}>
          <Waypoints size={32} style={{ color: ACCENT, margin: '0 auto 12px' }} />
          <h2 className="text-lg font-bold text-white mb-2">Configure Portkey to use this pillar</h2>
          <p className="text-[12px] text-slate-400 mb-4">
            Drop your Portkey API key into <code className="px-1 rounded bg-white/5">.env</code> as <code className="px-1 rounded bg-white/5">PORTKEY_API_KEY</code>, then restart the dev server.
            See <code className="px-1 rounded bg-white/5">.env.example</code> for the full list of variables.
          </p>
          <a href="https://app.portkey.ai" target="_blank" rel="noreferrer"
             className="inline-block px-4 py-2 rounded-lg text-[12px] font-bold"
             style={{ background: ACCENT, color: '#fff' }}>
            Open Portkey console
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full bg-base-950">
      {/* Header strip */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-base-900/60">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
             style={{ background: `${ACCENT}1a`, border: `1px solid ${ACCENT}55` }}>
          <Waypoints size={18} style={{ color: ACCENT }} />
        </div>
        <div className="flex flex-col leading-tight">
          <div className="text-sm font-bold text-white">AI/LLM Gateway</div>
          <div className="text-[11px] text-slate-500">Portkey routes · AIRS guardrail · multi-model</div>
        </div>
        <div className="flex-1" />
        <PortkeyStatusStrip />
      </div>

      {/* Tab bar */}
      <div className="flex-shrink-0 flex items-center gap-1 px-6 border-b border-white/10 bg-base-900/40">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id}
                    onClick={() => setTab(t.id)}
                    className="flex items-center gap-2 px-4 py-3 text-[12px] font-semibold transition-colors"
                    style={{
                      color: active ? ACCENT : 'rgba(148,163,184,0.85)',
                      borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
                    }}>
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Degraded banner — surfaces missing env vars */}
      {health?.status === 'degraded' && (
        <div className="flex-shrink-0 px-6 py-2 text-[11px]"
             style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', borderBottom: '1px solid rgba(245,158,11,0.3)' }}>
          ⚠ Some Portkey configs are missing — affected controls are disabled. Missing: <span className="font-mono">{(health.missing || []).join(', ')}</span>
        </div>
      )}

      {/* Body — all tabs stay mounted so switching away and back doesn't
          destroy the Live Demo conversation or scenario results mid-demo */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex-col min-h-0 overflow-hidden" style={{ display: tab === 'overview' ? 'flex' : 'none' }}>
          <OverviewTab />
        </div>
        <div className="flex-1 flex-col min-h-0 overflow-hidden" style={{ display: tab === 'scenarios' ? 'flex' : 'none' }}>
          <ScenariosTab />
        </div>
        <div className="flex-1 flex-col min-h-0 overflow-hidden" style={{ display: tab === 'live' ? 'flex' : 'none' }}>
          <LiveDemoTab />
        </div>
        <div className="flex-1 flex-col min-h-0 overflow-hidden" style={{ display: tab === 'mcp' ? 'flex' : 'none' }}>
          <McpRegistryTab />
        </div>
        <div className="flex-1 flex-col min-h-0 overflow-hidden" style={{ display: tab === 'guide' ? 'flex' : 'none' }}>
          <GuideTab />
        </div>
      </div>
    </div>
  )
}
