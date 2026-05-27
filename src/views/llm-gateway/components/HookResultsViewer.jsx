import React, { useState } from 'react'
import { ChevronRight } from 'lucide-react'

export function HookResultsViewer({ hookResults }) {
  const [open, setOpen] = useState(false)
  if (!hookResults) return null
  const before = hookResults.before_request_hooks || []
  const after  = hookResults.after_request_hooks  || []
  const total = before.length + after.length
  if (total === 0) return null

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)' }}>
      <button onClick={() => setOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-300 hover:bg-white/5">
        <ChevronRight size={12} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
        hook_results
        <span className="text-slate-500 font-normal">· {before.length} input · {after.length} output</span>
      </button>
      {open && (
        <pre className="px-3 pb-3 text-[10px] leading-relaxed overflow-x-auto" style={{ color: '#c9d1d9' }}>
{JSON.stringify(hookResults, null, 2)}
        </pre>
      )}
    </div>
  )
}
