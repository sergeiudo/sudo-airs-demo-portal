import React, { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink, RefreshCw } from 'lucide-react'

const ACCENT = '#ec4899'

export function PortkeyStatusStrip() {
  const [health, setHealth] = useState(null)
  const [configs, setConfigs] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [hRes, cRes] = await Promise.all([
        fetch('/api/gateway/health').then(r => r.json()),
        fetch('/api/gateway/configs').then(r => r.json()).catch(() => ({ configs: [] })),
      ])
      setHealth(hRes)
      setConfigs(cRes.configs || [])
    } catch (e) {
      setHealth({ ok: false, status: 'down', reachable: false, modelCount: 0, missing: ['network'] })
      setConfigs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading || !health) {
    return <div className="text-[11px] text-slate-500">Checking Portkey…</div>
  }

  const statusColor =
    health.status === 'healthy'    ? '#22c55e' :
    health.status === 'degraded'   ? '#f59e0b' :
    /* down/unconfigured */        '#ef4444'

  const Icon =
    health.status === 'healthy'    ? CheckCircle2 :
    health.status === 'degraded'   ? AlertTriangle :
                                     XCircle

  const totalConfigs = configs?.length || 4
  const wired = (configs || []).filter(c => c.ready).length

  return (
    <div className="flex items-center gap-3 text-[11px]">
      <div className="flex items-center gap-1.5" style={{ color: statusColor }}>
        <Icon size={13} />
        <span className="font-semibold uppercase tracking-wider">{health.status}</span>
      </div>
      <span className="text-slate-500">·</span>
      <span className="text-slate-400"><span className="text-slate-200 font-mono">{health.modelCount}</span> models</span>
      <span className="text-slate-500">·</span>
      <span className="text-slate-400"><span className="text-slate-200 font-mono">{wired}/{totalConfigs}</span> configs wired</span>
      <button onClick={load} title="Refresh"
              className="ml-1 p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300">
        <RefreshCw size={11} />
      </button>
      <a href="https://app.portkey.ai" target="_blank" rel="noreferrer"
         className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold"
         style={{ background: `${ACCENT}1f`, border: `1px solid ${ACCENT}66`, color: ACCENT }}>
        Open Portkey console <ExternalLink size={10} />
      </a>
    </div>
  )
}
