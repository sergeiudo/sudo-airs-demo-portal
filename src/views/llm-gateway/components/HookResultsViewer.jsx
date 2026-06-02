import React, { useState } from 'react'
import { ChevronRight } from 'lucide-react'

export function HookResultsViewer({ hookResults, isLight }) {
  const [open, setOpen] = useState(false)
  if (!hookResults) return null
  const before = hookResults.before_request_hooks || []
  const after  = hookResults.after_request_hooks  || []
  const total = before.length + after.length
  if (total === 0) return null

  const bg       = isLight ? '#f1f5f9' : '#0d1117'
  const border   = isLight ? 'rgba(0,48,135,0.14)' : 'rgba(255,255,255,0.08)'
  const headText = isLight ? '#1e293b' : '#cbd5e1'
  const bodyText = isLight ? '#1e293b' : '#c9d1d9'

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: bg, border: `1px solid ${border}` }}>
      <button onClick={() => setOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold"
              style={{ color: headText }}>
        <ChevronRight size={12} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
        hook_results
        <span className="font-normal" style={{ color: isLight ? '#64748b' : '#64748b' }}>· {before.length} input · {after.length} output</span>
      </button>
      {open && (
        <pre className="px-3 pb-3 text-[10px] leading-relaxed overflow-x-auto" style={{ color: bodyText }}>
{JSON.stringify(hookResults, null, 2)}
        </pre>
      )}
    </div>
  )
}
