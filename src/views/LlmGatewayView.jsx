import React, { useState } from 'react'
import { Waypoints, Zap, ListTree, BookOpen } from 'lucide-react'
import { LiveDemoTab } from './llm-gateway/LiveDemoTab'
import { ShowcaseTab } from './llm-gateway/ShowcaseTab'
import { GuideTab } from './llm-gateway/GuideTab'
import { PortkeyStatusStrip } from './llm-gateway/components/PortkeyStatusStrip'

const ACCENT = '#ec4899'

const TABS = [
  { id: 'live',     label: 'Live Demo',          icon: Zap },
  { id: 'showcase', label: 'Detection Showcase', icon: ListTree },
  { id: 'guide',    label: 'Integration Guide',  icon: BookOpen },
]

export function LlmGatewayView() {
  const [tab, setTab] = useState('live')

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

      {/* Body */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {tab === 'live'     && <LiveDemoTab />}
        {tab === 'showcase' && <ShowcaseTab />}
        {tab === 'guide'    && <GuideTab />}
      </div>
    </div>
  )
}
