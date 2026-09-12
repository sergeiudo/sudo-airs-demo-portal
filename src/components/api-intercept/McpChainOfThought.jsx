import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, Route, ListTree, Brain, Wrench, ShieldCheck, ShieldX,
  AlertTriangle, MessageSquare, Server, Globe,
} from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

/**
 * McpChainOfThought — the "how did it get that answer" panel for the SCM AI-GW
 * MCP lane.
 *
 * Collapsed by default. The whole point of the demo is that the answer came
 * from a real MCP server rather than the model's memory, so the trace has to be
 * inspectable — but expanded-by-default would bury the answer itself.
 *
 * Every step the server produced is rendered, including the AIRS verdicts on
 * the tool manifest and on both scan stages of each call. A step that AIRS
 * stopped is shown as a stop, not skipped.
 */

const KIND = {
  route:    { icon: Route,         label: 'ROUTE',    color: '#8B5CF6' },
  discover: { icon: ListTree,      label: 'DISCOVER', color: '#0EA5E9' },
  think:    { icon: Brain,         label: 'REASON',   color: '#A78BFA' },
  tool:     { icon: Wrench,        label: 'TOOL',     color: '#10B981' },
  answer:   { icon: MessageSquare, label: 'ANSWER',   color: '#64748B' },
  blocked:  { icon: ShieldX,       label: 'BLOCKED',  color: '#EF4444' },
  error:    { icon: AlertTriangle, label: 'ERROR',    color: '#F59E0B' },
}

/** AIRS verdict chip. `null` scan means AIRS was off — say so rather than implying clean. */
function ScanChip({ label, scan, C }) {
  if (!scan) return null
  if (scan.error) {
    return (
      <span className="px-1.5 py-[1px] rounded text-[8.5px] font-bold" style={{ background: `${C.amber}1f`, color: C.amber }}>
        {label}: SCAN FAILED
      </span>
    )
  }
  const blocked = scan.action === 'block'
  const col = blocked ? C.red : C.green
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded text-[8.5px] font-bold"
      style={{ background: `${col}1f`, color: col }}
      title={scan.scanId ? `AIRS scan_id ${scan.scanId}` : undefined}
    >
      {blocked ? <ShieldX size={8} /> : <ShieldCheck size={8} />}
      {label}: {blocked ? String(scan.category || 'blocked').toUpperCase() : 'CLEAN'}
    </span>
  )
}

export function McpChainOfThought({ mcp }) {
  const [open, setOpen] = useState(false)
  const { state } = useAppContext()
  const isLight = state.isDark === false
  const [showRaw, setShowRaw] = useState({})

  if (!mcp?.steps?.length) return null

  const C = {
    panel:  isLight ? '#f8fafc' : 'rgba(13,17,23,0.72)',
    border: isLight ? 'rgba(0,48,135,0.12)' : 'rgba(255,255,255,0.10)',
    rowBg:  isLight ? '#ffffff' : 'rgba(255,255,255,0.03)',
    text:   isLight ? '#1e293b' : '#e2e8f0',
    meta:   isLight ? '#64748b' : '#94a3b8',
    mono:   isLight ? '#475569' : '#9fb0c7',
    codeBg: isLight ? '#f1f5f9' : 'rgba(0,0,0,0.45)',
    green:  '#10B981',
    red:    '#EF4444',
    amber:  '#F59E0B',
  }

  const toolSteps = mcp.steps.filter((s) => s.kind === 'tool')
  const blockedCount = mcp.steps.filter((s) => s.blocked || s.kind === 'blocked').length

  return (
    <div className="w-full mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] font-semibold transition-colors"
        style={{ color: C.meta }}
      >
        <ChevronDown size={11} style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms' }} />
        <Brain size={11} />
        {open ? 'Hide' : 'Show'} reasoning
        <span style={{ color: C.mono }}>
          · {mcp.steps.length} step{mcp.steps.length === 1 ? '' : 's'}
          {toolSteps.length ? ` · ${toolSteps.length} tool call${toolSteps.length === 1 ? '' : 's'}` : ''}
        </span>
        {blockedCount > 0 && (
          <span className="px-1.5 py-[1px] rounded text-[8.5px] font-black" style={{ background: `${C.red}1f`, color: C.red }}>
            {blockedCount} BLOCKED
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border p-2.5 space-y-1.5" style={{ background: C.panel, borderColor: C.border }}>
              {mcp.steps.map((s, i) => {
                const k = KIND[s.kind] ?? KIND.answer
                const Icon = k.icon
                const key = `${i}-${s.kind}`
                return (
                  <div key={key} className="rounded-lg border px-2.5 py-2" style={{ background: C.rowBg, borderColor: C.border }}>
                    <div className="flex items-start gap-2">
                      <div
                        className="flex items-center justify-center rounded-md flex-shrink-0"
                        style={{ width: 18, height: 18, background: `${k.color}1f`, marginTop: 1 }}
                      >
                        <Icon size={10} style={{ color: k.color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[8.5px] font-black tracking-wider" style={{ color: k.color }}>{k.label}</span>
                          <span className="text-[11px] font-semibold" style={{ color: C.text }}>{s.title}</span>

                          {/* Brokered by the gateway, or called directly? That
                              distinction is the whole reason CoinGecko is here. */}
                          {s.brokered === true && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded text-[8.5px] font-bold"
                                  style={{ background: 'rgba(236,72,153,0.15)', color: '#EC4899' }}>
                              <Server size={8} /> VIA AI-GW
                            </span>
                          )}
                          {s.brokered === false && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded text-[8.5px] font-bold"
                                  style={{ background: `${C.amber}1f`, color: C.amber }}>
                              <Globe size={8} /> DIRECT
                            </span>
                          )}
                          {s.latencyMs != null && (
                            <span className="text-[8.5px] font-mono" style={{ color: C.mono }}>{s.latencyMs}ms</span>
                          )}
                          <ScanChip label="manifest" scan={s.scan} C={C} />
                          <ScanChip label="params" scan={s.inputScan} C={C} />
                          <ScanChip label="result" scan={s.outputScan} C={C} />
                        </div>

                        {s.detail && (
                          <p className="text-[10.5px] mt-1 leading-snug whitespace-pre-wrap" style={{ color: C.meta }}>
                            {s.detail}
                          </p>
                        )}

                        {s.servers?.length > 0 && (
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            {s.servers.map((sv) => (
                              <span key={sv.id} className="px-1.5 py-[1px] rounded text-[9px] font-semibold"
                                    style={{ background: C.codeBg, color: C.mono }}>
                                {sv.label}
                              </span>
                            ))}
                          </div>
                        )}

                        {s.toolNames?.length > 0 && (
                          <p className="text-[9px] font-mono mt-1 break-all" style={{ color: C.mono }}>
                            {s.toolNames.join(' · ')}
                          </p>
                        )}

                        {s.args && Object.keys(s.args).length > 0 && (
                          <pre className="text-[9.5px] font-mono mt-1 p-1.5 rounded overflow-x-auto"
                               style={{ background: C.codeBg, color: C.mono, direction: 'ltr' }}>
                            {JSON.stringify(s.args, null, 2).slice(0, 700)}
                          </pre>
                        )}

                        {s.error && (
                          <p className="text-[10px] mt-1 font-medium" style={{ color: s.blocked ? C.red : C.amber }}>
                            {s.error}
                          </p>
                        )}

                        {s.result != null && s.result !== '' && (
                          <div className="mt-1">
                            <button
                              onClick={() => setShowRaw((r) => ({ ...r, [key]: !r[key] }))}
                              className="text-[9px] font-semibold hover:underline"
                              style={{ color: C.meta }}
                            >
                              {showRaw[key] ? 'Hide' : 'Show'} raw result ({s.result.length.toLocaleString()} chars)
                            </button>
                            {showRaw[key] && (
                              <pre className="text-[9.5px] font-mono mt-1 p-1.5 rounded max-h-56 overflow-auto whitespace-pre-wrap break-all"
                                   style={{ background: C.codeBg, color: C.mono, direction: 'ltr' }}>
                                {s.result}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
