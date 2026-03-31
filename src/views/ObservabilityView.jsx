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

function latencyColor(ms) {
  if (ms == null) return { text: 'text-slate-400', bar: 'bg-slate-400' }
  if (ms < 400)  return { text: 'text-emerald-500', bar: 'bg-emerald-500' }
  if (ms < 800)  return { text: 'text-orange-400',  bar: 'bg-orange-400' }
  return { text: 'text-red-400', bar: 'bg-red-500' }
}

function latencyLabel(ms) {
  if (ms == null) return 'Unreachable'
  if (ms < 400)  return 'Excellent'
  if (ms < 800)  return 'Normal'
  return 'High'
}

function RegionCard({ region, activeEndpoint }) {
  const isActive = activeEndpoint?.includes(
    region.id === 'us' ? 'service.api' :
    region.id === 'eu' ? 'service-de' :
    region.id === 'in' ? 'service-in' : 'service-sg'
  )
  const clr = latencyColor(region.avg_ms)

  return (
    <div className={`p-4 rounded-xl border flex flex-col gap-2 ${isActive ? 'border-teal-500/40 bg-teal-500/[0.06]' : 'border-white/[0.08] bg-white/[0.03]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{region.flag}</span>
          <div>
            <div className="text-xs font-bold text-slate-300">{region.label}</div>
            {isActive && <div className="text-[8px] text-teal-400 font-semibold uppercase tracking-wider">● Active endpoint</div>}
          </div>
        </div>
        {region.avg_ms != null
          ? <span className={`text-xl font-black font-mono ${clr.text}`}>{region.avg_ms}<span className="text-[10px] font-normal text-slate-500 ml-0.5">ms</span></span>
          : <span className="text-[10px] text-slate-600">Unreachable</span>
        }
      </div>

      {/* Min/Max */}
      {region.avg_ms != null && (
        <div className="flex items-center gap-3 text-[9px] text-slate-500">
          <span>min <span className="font-mono font-semibold text-slate-400">{region.min_ms}ms</span></span>
          <span>max <span className="font-mono font-semibold text-slate-400">{region.max_ms}ms</span></span>
          <span className={`ml-auto font-semibold text-[9px] ${clr.text}`}>{latencyLabel(region.avg_ms)}</span>
        </div>
      )}

      {/* Sample bars */}
      {region.samples && (
        <div className="flex gap-1 mt-0.5">
          {region.samples.map((ms, i) => (
            <div key={i} className="flex-1">
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                {ms != null && <div className={`h-full rounded-full ${latencyColor(ms).bar} opacity-80`}
                  style={{ width: `${Math.min((ms / 1500) * 100, 100)}%` }} />}
              </div>
              <div className="text-[7px] text-slate-600 mt-0.5 text-center">#{i+1}{ms ? ` ${ms}ms` : ' ✗'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AirsProbeCard({ probeState, probeResult, onRun }) {
  const state = probeState
  const result = probeResult

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.03] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi size={14} className="text-blue-400" />
          <div>
            <span className="text-[12px] font-bold text-slate-300">Live AIRS Regional Latency Probe</span>
            <p className="text-[10px] text-slate-500 mt-0.5">Fires 3 real scan requests to each regional endpoint from this server simultaneously.</p>
          </div>
        </div>
        <button
          onClick={onRun}
          disabled={state === 'running'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ml-4"
        >
          {state === 'running'
            ? <><Loader2 size={11} className="animate-spin" /> Probing all regions…</>
            : <><Wifi size={11} /> Run Probe</>}
        </button>
      </div>

      {/* Running state */}
      {state === 'running' && (
        <div className="grid grid-cols-4 gap-3">
          {['🇺🇸 US', '🇩🇪 EU', '🇮🇳 IN', '🇸🇬 SG'].map(r => (
            <div key={r} className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center gap-2 text-[11px] text-slate-500">
              <Loader2 size={11} className="animate-spin text-blue-400" />{r}
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {state === 'done' && result?.regions && (
        <div className="grid grid-cols-4 gap-3">
          {result.regions.map(region => (
            <RegionCard key={region.id} region={region} activeEndpoint={result.active_endpoint} />
          ))}
        </div>
      )}

      {state === 'error' && (
        <p className="text-[10px] text-red-400">Probe failed: {probeResult?.error}</p>
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
  const [probeState, setProbeState]     = useState('idle')
  const [probeResult, setProbeResult]   = useState(null)
  const { metrics, traces, loading, filters, setFilters, since, setSince, refresh } = useObservability()
  const { dispatch, state } = useAppContext()

  const runProbe = async () => {
    setProbeState('running')
    setProbeResult(null)
    setActiveTab('overview')
    try {
      const r = await fetch('/api/airs-probe')
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setProbeResult(data)
      setProbeState('done')
    } catch (err) {
      setProbeResult({ error: err.message })
      setProbeState('error')
    }
  }

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

        {/* AIRS probe button */}
        <button
          onClick={runProbe}
          disabled={probeState === 'running'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {probeState === 'running'
            ? <><Loader2 size={11} className="animate-spin" /> Probing…</>
            : <><Wifi size={11} /> Probe AIRS Latency</>}
        </button>

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
              <AirsProbeCard probeState={probeState} probeResult={probeResult} onRun={runProbe} />
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
