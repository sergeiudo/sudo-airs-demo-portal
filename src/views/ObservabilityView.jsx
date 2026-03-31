// src/views/ObservabilityView.jsx
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, Activity, Crosshair, Trash2, Wifi, Loader2 } from 'lucide-react'
import { useObservability } from '../hooks/useObservability'
import { useAppContext } from '../context/AppContext'
import { KpiStrip } from '../components/observability/KpiStrip'
import { LatencyChart } from '../components/observability/LatencyChart'
import { VolumeChart } from '../components/observability/VolumeChart'
import { DetectionDonut } from '../components/observability/DetectionDonut'
import { ProviderChart } from '../components/observability/ProviderChart'
import { P95Gauge } from '../components/observability/P95Gauge'
import { BlockedStageBar } from '../components/observability/BlockedStageBar'
import { FilterBar } from '../components/observability/FilterBar'
import { TraceTable } from '../components/observability/TraceTable'
import { TraceDrawer } from '../components/observability/TraceDrawer'

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart2 },
  { id: 'traces',   label: 'Prompt History Log',   icon: Activity },
]

function AirsProbeCard() {
  const [state, setState] = useState('idle') // idle | running | done | error
  const [result, setResult] = useState(null)

  const run = async () => {
    setState('running')
    setResult(null)
    try {
      const r = await fetch('/api/airs-probe')
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setResult(data)
      setState('done')
    } catch (err) {
      setResult({ error: err.message })
      setState('error')
    }
  }

  const latencyColor = result?.avg_ms
    ? result.avg_ms < 400 ? 'text-emerald-500' : result.avg_ms < 800 ? 'text-orange-400' : 'text-red-400'
    : 'text-slate-300'

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi size={14} className="text-blue-400" />
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Live AIRS Latency Probe</span>
        </div>
        <button
          onClick={run}
          disabled={state === 'running'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === 'running'
            ? <><Loader2 size={11} className="animate-spin" /> Probing…</>
            : <><Wifi size={11} /> Run Probe</>}
        </button>
      </div>

      {state === 'idle' && (
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Fires 3 real scan requests to <span className="font-mono text-[9px] text-slate-400">service.api.aisecurity.paloaltonetworks.com</span> from this server and measures actual round-trip latency.
        </p>
      )}

      {state === 'running' && (
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <Loader2 size={12} className="animate-spin text-blue-400" />
          Sending 3 probe requests to AIRS endpoint…
        </div>
      )}

      {state === 'done' && result && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Min', value: result.min_ms },
              { label: 'Avg', value: result.avg_ms },
              { label: 'Max', value: result.max_ms },
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
                <div className={`text-lg font-black font-mono ${latencyColor}`}>{value.toLocaleString()}<span className="text-[10px] font-normal text-slate-500 ml-0.5">ms</span></div>
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {result.samples.map((ms, i) => (
              <div key={i} className="flex-1 text-center">
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className={`h-full rounded-full ${ms < 400 ? 'bg-emerald-500' : ms < 800 ? 'bg-orange-400' : 'bg-red-500'}`}
                    style={{ width: `${Math.min((ms / 1500) * 100, 100)}%` }} />
                </div>
                <div className="text-[8px] text-slate-600 mt-0.5">#{i+1} {ms}ms</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">
            Measured from <span className="font-semibold text-slate-400">this server</span> → AIRS cloud.
            {result.avg_ms < 400 ? ' Excellent — likely co-located.' : result.avg_ms < 800 ? ' Normal for cross-region deployment.' : ' High — cross-continent or cold endpoint.'}
          </p>
        </div>
      )}

      {state === 'error' && (
        <p className="text-[10px] text-red-400">Probe failed: {result?.error}</p>
      )}
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">{title}</div>
      {children}
    </div>
  )
}

function EmptyState({ dispatch }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center py-24">
      <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
        <BarChart2 size={32} className="text-slate-700" />
      </div>
      <div>
        <p className="text-base font-semibold text-slate-400">No traces yet</p>
        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed max-w-xs">Send your first prompt in API Intercept to start capturing live telemetry</p>
      </div>
      <button
        onClick={() => dispatch({ type: 'SET_VIEW', payload: 'apiIntercept' })}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 text-sm font-semibold hover:bg-teal-500/20 transition-colors"
      >
        <Crosshair size={14} /> Go to API Intercept
      </button>
    </div>
  )
}

export function ObservabilityView() {
  const [activeTab, setActiveTab]       = useState('overview')
  const [selectedTraceId, setSelectedTraceId] = useState(null)
  const { metrics, traces, loading, filters, setFilters, since, setSince, refresh } = useObservability()
  const { dispatch, state } = useAppContext()

  // If a trace was pre-selected from the TelemetrySidebar, open it
  React.useEffect(() => {
    if (state.selectedTraceId) {
      setSelectedTraceId(state.selectedTraceId)
      setActiveTab('traces')
      dispatch({ type: 'SET_SELECTED_TRACE', payload: null })
    }
  }, [state.selectedTraceId, dispatch])

  const isEmpty = !loading && metrics?.total_requests === 0

  return (
    <div className="flex flex-col h-full overflow-hidden bg-base-950">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.08] flex-shrink-0">
        <BarChart2 size={16} className="text-teal-400" />
        <span className="text-sm font-semibold text-slate-300">LLM Telemetry</span>

        {/* Tab switcher */}
        <div className="flex gap-1 ml-4 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-teal-500/20 border border-teal-500/30 text-teal-400'
                  : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <tab.icon size={11} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Time range + live indicator */}
        <div className="ml-auto flex items-center gap-3">
          {/* RPM */}
          {metrics?.rpm != null && (
            <span className="text-[10px] text-slate-500 font-mono">
              <span className="text-teal-400 font-bold">{metrics.rpm}</span> req/min
            </span>
          )}
          {/* Time range toggle */}
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            {['20m', '1h', '24h', 'all'].map(t => (
              <button
                key={t}
                onClick={() => setSince(t)}
                className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all duration-150 ${
                  since === t
                    ? 'bg-teal-500/20 border border-teal-500/30 text-teal-400'
                    : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
            Live
          </div>
        </div>
      </div>

      {/* Body */}
      {isEmpty ? (
        <EmptyState dispatch={dispatch} />
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Overview tab */}
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <KpiStrip metrics={metrics} />
              <div className="grid grid-cols-2 gap-4">
                <ChartCard title="Latency over time (ms)">
                  <LatencyChart data={metrics?.latency_series ?? []} />
                </ChartCard>
                <ChartCard title="Request volume">
                  <VolumeChart data={metrics?.volume_series ?? []} />
                </ChartCard>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <ChartCard title="Detection breakdown">
                  <DetectionDonut breakdown={metrics?.detection_breakdown ?? {}} />
                </ChartCard>
                <ChartCard title="LLM provider distribution">
                  <ProviderChart breakdown={metrics?.provider_breakdown ?? {}} />
                </ChartCard>
                <ChartCard title="Blocked — where in pipeline?">
                  <BlockedStageBar
                    blockedAtInput={metrics?.blocked_at_input ?? 0}
                    blockedAtOutput={metrics?.blocked_at_output ?? 0}
                  />
                </ChartCard>
              </div>
              <AirsProbeCard />
            </motion.div>
          )}

          {/* Traces tab */}
          {activeTab === 'traces' && (
            <motion.div key="traces" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1"><FilterBar filters={filters} setFilters={setFilters} /></div>
                {traces.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete all ${traces.length} traces? This cannot be undone.`)) return
                      await fetch('/api/traces', { method: 'DELETE' })
                      setSelectedTraceId(null)
                      refresh()
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 bg-red-500/[0.06] hover:bg-red-500/20 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={12} /> Clear All
                  </button>
                )}
              </div>
              <TraceTable
                traces={traces}
                selectedId={selectedTraceId}
                onSelect={setSelectedTraceId}
                onDelete={async (id) => {
                  await fetch(`/api/traces/${id}`, { method: 'DELETE' })
                  if (selectedTraceId === id) setSelectedTraceId(null)
                  refresh()
                }}
              />
            </motion.div>
          )}
        </div>
      )}

      {/* Slide-out drawer */}
      <TraceDrawer traceId={selectedTraceId} onClose={() => setSelectedTraceId(null)} />
    </div>
  )
}
