import React from 'react'
import { BookOpen, Zap } from 'lucide-react'
import { ATTACK_CATEGORIES } from '../../data/mockData'
import { AttackCategory } from './AttackCategory'
import { ModelSelector } from './ModelSelector'
import { McpServerPanel } from './McpServerPanel'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'

export function AttackLibrary({ onSelectAttack, backend, model, onBackendChange, onModelChange, mcp, onMcpChange }) {
  const theme = useProtectionTheme()
  const totalAttacks = ATTACK_CATEGORIES.reduce(
    (a, c) => a + (c.attacks?.length ?? c.subCategories?.reduce((s, sc) => s + (sc.attacks?.length ?? 0), 0) ?? 0),
    0
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
        <BookOpen size={14} className={theme.primaryText} />
        <span className="text-xs font-semibold text-slate-300">Attack Library</span>
        <span className="ml-auto text-[10px] text-slate-600">{totalAttacks} payloads</span>
      </div>

      {/* Model selector */}
      <div className="px-3 pt-3 flex-shrink-0">
        <div className="text-[9px] font-semibold tracking-[0.15em] text-slate-600 uppercase mb-2 px-1">
          Target Backend
        </div>
        <ModelSelector
          backend={backend}
          model={model}
          onBackendChange={onBackendChange}
          onModelChange={onModelChange}
        />

        {/* MCP is only wired on the AI-GW lane — the other three backends are
            direct provider calls with no gateway to broker a tool server. */}
        {backend === 'aigw' && (
          <div className="mt-2">
            <McpServerPanel enabled={mcp.enabled} server={mcp.server} onChange={onMcpChange} />
          </div>
        )}
      </div>

      {/* Quick fire hint */}
      <div className={`mx-3 mt-3 flex items-center gap-2 p-2 rounded-lg border ${theme.primaryBorder2} ${theme.primaryBg2} flex-shrink-0`}>
        <Zap size={10} className={theme.primaryText} />
        <span className="text-[10px] text-slate-400">Click any payload to inject into chat</span>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4 space-y-2">
        {ATTACK_CATEGORIES.map((cat, i) => (
          <AttackCategory
            key={cat.id}
            category={cat}
            onSelectAttack={onSelectAttack}
            defaultOpen={false}
          />
        ))}
      </div>
    </div>
  )
}
