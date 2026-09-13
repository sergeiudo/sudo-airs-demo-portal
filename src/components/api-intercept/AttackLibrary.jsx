import React, { useMemo, useState } from 'react'
import { BookOpen, Search, X } from 'lucide-react'
import { ATTACK_CATEGORIES } from '../../data/mockData'
import { AttackCategory } from './AttackCategory'
import { ModelSelector } from './ModelSelector'
import { McpServerPanel } from './McpServerPanel'
import { useProtectionTheme } from '../../hooks/useProtectionTheme'

export function AttackLibrary({ onSelectAttack, backend, model, onBackendChange, onModelChange, mcp, onMcpChange }) {
  const theme = useProtectionTheme()
  const [query, setQuery] = useState('')
  const totalAttacks = ATTACK_CATEGORIES.reduce(
    (a, c) => a + (c.attacks?.length ?? c.subCategories?.reduce((s, sc) => s + (sc.attacks?.length ?? 0), 0) ?? 0),
    0
  )

  // Search across both category shapes — most hold `attacks`, Jailbreak Bench
  // nests them under `subCategories`. Empty categories drop out, and matches
  // open automatically: clicking through ten accordions to find one payload is
  // the slowest thing in a live demo.
  const q = query.trim().toLowerCase()
  const categories = useMemo(() => {
    if (!q) return ATTACK_CATEGORIES
    const hit = (a) =>
      a.label?.toLowerCase().includes(q) ||
      a.id?.toLowerCase().includes(q) ||
      a.technique?.toLowerCase().includes(q) ||
      a.payload?.toLowerCase().includes(q)
    return ATTACK_CATEGORIES
      .map((c) => {
        if (Array.isArray(c.attacks)) {
          const attacks = c.attacks.filter(hit)
          return attacks.length ? { ...c, attacks } : null
        }
        const subCategories = (c.subCategories ?? [])
          .map((sc) => {
            const attacks = (sc.attacks ?? []).filter(hit)
            return attacks.length ? { ...sc, attacks } : null
          })
          .filter(Boolean)
        return subCategories.length ? { ...c, subCategories } : null
      })
      .filter(Boolean)
  }, [q])

  const shown = categories.reduce(
    (a, c) => a + (c.attacks?.length ?? c.subCategories?.reduce((s, sc) => s + (sc.attacks?.length ?? 0), 0) ?? 0),
    0
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
        <BookOpen size={14} className={theme.primaryText} />
        <span className="text-xs font-semibold text-slate-300">Attack Library</span>
        <span className="ml-auto text-[10px] text-slate-600">
          {q ? `${shown} of ${totalAttacks}` : `${totalAttacks} payloads`}
        </span>
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

      {/* Search — directly above the list it filters */}
      <div className="px-3 pt-3 flex-shrink-0">
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors ${theme.primaryBorder2} bg-black/20 dark:bg-black/20`}>
          <Search size={11} className="text-slate-500 flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search payloads, techniques, ids…"
            className="flex-1 bg-transparent outline-none text-[11px] text-slate-300 placeholder-slate-600 min-w-0"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-600 hover:text-slate-400 flex-shrink-0" title="Clear">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto px-3 pt-2.5 pb-4 space-y-2">
        {categories.length === 0 && (
          <p className="px-2 py-6 text-center text-[11px] text-slate-500">
            Nothing matches “{query}”. Try a technique, a payload id, or words from the payload.
          </p>
        )}
        {categories.map((cat) => (
          <AttackCategory
            key={cat.id + (q ? `-${q}` : '')}
            category={cat}
            onSelectAttack={onSelectAttack}
            defaultOpen={!!q}
          />
        ))}
      </div>
    </div>
  )
}
