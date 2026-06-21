import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Wallet, RefreshCw, Play, AlertTriangle, RotateCcw, Zap } from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis,
  PieChart, Pie, Cell,
} from 'recharts'
import { useAppContext } from '../../context/AppContext'
import { FINOPS_RANGES, FINOPS_ATTR_KEYS } from '../../data/finopsConfig'

const ACCENT = '#ec4899'
const AMBER  = '#f59e0b'
const GREEN  = '#34d399'
const RED    = '#ef4444'
const MODEL_COLORS = ['#ec4899', '#38bdf8', '#fbbf24', '#a78bfa', '#475569']
const FMT_USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// ─── Setup screen ────────────────────────────────────────────────────────────
function SetupScreen({ isLight }) {
  const text  = isLight ? '#0f172a' : '#e2e8f0'
  const muted = isLight ? '#475569' : '#94a3b8'
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-xl p-6 rounded-2xl text-center"
           style={{ background: `${ACCENT}0f`, border: `1px solid ${ACCENT}66` }}>
        <Wallet size={32} style={{ color: ACCENT, margin: '0 auto 12px' }} />
        <h2 className="text-lg font-bold mb-2" style={{ color: text }}>
          Portkey Admin API key required
        </h2>
        <p className="text-[12px] mb-4" style={{ color: muted }}>
          The Budget &amp; FinOps tab reads cost analytics from the Portkey Admin API.
          Add your Admin key to{' '}
          <code className="px-1 rounded" style={{ background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>.env</code>{' '}
          as{' '}
          <code className="px-1 rounded" style={{ background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>PORTKEY_ADMIN_API_KEY</code>,
          then restart the dev server.
        </p>
        <a href="https://app.portkey.ai/api-keys" target="_blank" rel="noreferrer"
           className="inline-block px-4 py-2 rounded-lg text-[12px] font-bold"
           style={{ background: ACCENT, color: '#fff' }}>
          Open Portkey API Keys
        </a>
      </div>
    </div>
  )
}

// ─── Segment control ─────────────────────────────────────────────────────────
function SegmentControl({ options, value, onChange, isLight }) {
  const trackBg   = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)'
  const textMuted = isLight ? '#475569' : '#94a3b8'
  return (
    <div className="flex rounded-lg overflow-hidden text-[11px] font-semibold"
         style={{ border: `1px solid ${isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'}`, background: trackBg }}>
      {options.map(opt => {
        const active = opt.id === value
        return (
          <button key={opt.id}
                  onClick={() => onChange(opt.id)}
                  className="px-3 py-1.5 transition-colors"
                  style={{
                    background:  active ? ACCENT : 'transparent',
                    color:       active ? '#fff' : textMuted,
                    borderRight: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingPulse({ isLight, height = 80 }) {
  return (
    <div className="rounded-xl animate-pulse"
         style={{
           height,
           background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)',
         }} />
  )
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="text-[9px] font-bold uppercase tracking-widest mb-2"
         style={{ color: ACCENT }}>
      {children}
    </div>
  )
}

// ─── Panel shell ─────────────────────────────────────────────────────────────
function Panel({ children, isLight, style = {} }) {
  return (
    <div className="rounded-xl p-4"
         style={{
           background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.03)',
           border:     `1px solid ${isLight ? 'rgba(0,48,135,0.10)' : 'rgba(255,255,255,0.08)'}`,
           ...style,
         }}>
      {children}
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, isLight }) {
  const textPrimary   = isLight ? '#0f172a' : '#ffffff'
  const textSecondary = isLight ? '#64748b' : '#94a3b8'
  return (
    <div className="flex-1 rounded-xl p-3"
         style={{
           background: isLight ? '#fff' : 'rgba(255,255,255,0.04)',
           border:     `1px solid ${isLight ? 'rgba(0,48,135,0.10)' : 'rgba(255,255,255,0.08)'}`,
         }}>
      <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: textSecondary }}>{label}</div>
      <div className="text-[18px] font-extrabold leading-none mb-1" style={{ color: textPrimary }}>
        {value ?? <span style={{ opacity: 0.3 }}>—</span>}
      </div>
      {sub && <div className="text-[9px]" style={{ color: textSecondary }}>{sub}</div>}
    </div>
  )
}

// ─── SSE reader hook ──────────────────────────────────────────────────────────
// Returns { lines, running, error, start, abort }
// Each line is { event, data } (data already JSON-parsed if possible).
function useSse() {
  const [lines,   setLines]   = useState([])
  const [running, setRunning] = useState(false)
  const [error,   setError]   = useState(null)
  const abortRef = useRef(null)

  const abort = useCallback(() => {
    abortRef.current?.abort()
    setRunning(false)
  }, [])

  const start = useCallback(async (url, body = null) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLines([])
    setError(null)
    setRunning(true)

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    body ? JSON.stringify(body) : undefined,
        signal:  ctrl.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`)
      }
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const blocks = buf.split('\n\n')
        buf = blocks.pop() // keep incomplete last block
        for (const block of blocks) {
          if (!block.trim()) continue
          let event = 'message', data = ''
          for (const ln of block.split('\n')) {
            if (ln.startsWith('event:')) event = ln.slice(6).trim()
            else if (ln.startsWith('data:'))  data  = ln.slice(5).trim()
          }
          let parsed
          try { parsed = JSON.parse(data) } catch { parsed = data }
          setLines(prev => [...prev, { event, data: parsed }])
        }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        setError(e?.message || String(e))
      }
    } finally {
      setRunning(false)
    }
  }, [])

  return { lines, running, error, start, abort }
}

// ─── Main component ───────────────────────────────────────────────────────────
export function FinOpsTab() {
  const { state } = useAppContext()
  const isLight = !state.isDark

  const [range,    setRange]    = useState('30d')
  const [attr,     setAttr]     = useState('team')
  const [overview, setOverview] = useState(null)
  const [budget,   setBudget]   = useState(null)
  const [health,   setHealth]   = useState(null)
  const [loading,  setLoading]  = useState(true)

  // Generate traffic SSE
  const genSse     = useSse()
  const [genDone,  setGenDone]  = useState(false)

  // Enforce SSE
  const enfSse     = useSse()
  const [resetting, setResetting] = useState(false)
  const [resetMsg,  setResetMsg]  = useState(null)

  // ── Health probe (once on mount) ──────────────────────────────────────────
  useEffect(() => {
    fetch('/api/gateway/finops/health')
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false, adminKey: false, reachable: false }))
  }, [])

  // ── Data fetch (reruns on range / attr change) ────────────────────────────
  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/gateway/finops/overview?range=${range}&attr=${attr}`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/gateway/finops/budget')
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([o, b]) => {
      setOverview(o)
      setBudget(b)
      setLoading(false)
    })
  }, [range, attr])

  useEffect(() => { loadData() }, [loadData])

  // ── Generate traffic handler ──────────────────────────────────────────────
  async function handleGenerate() {
    setGenDone(false)
    await genSse.start('/api/gateway/finops/generate', { maxRequests: 12 })
    setGenDone(true)
    // Refresh data after stream ends
    setTimeout(loadData, 2500)
  }

  // Watch genSse lines for done event to trigger refresh mid-stream
  useEffect(() => {
    const last = genSse.lines[genSse.lines.length - 1]
    if (last?.event === 'done') {
      setTimeout(loadData, 2500)
    }
  }, [genSse.lines]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Enforce reset handler ─────────────────────────────────────────────────
  async function handleEnforceReset() {
    setResetting(true)
    setResetMsg(null)
    try {
      const res = await fetch('/api/gateway/finops/enforce/reset', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      setResetMsg(res.ok ? 'Reset — key deleted. Next "Fire requests" starts fresh.' : (json.error ?? 'Reset failed'))
      if (res.ok) loadData()
    } catch {
      setResetMsg('Network error — reset unavailable')
    } finally {
      setResetting(false)
    }
  }

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (health !== null && health.adminKey === false) {
    return <SetupScreen isLight={isLight} />
  }

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const textPrimary   = isLight ? '#0f172a' : '#e2e8f0'
  const textSecondary = isLight ? '#475569' : '#94a3b8'
  const borderColor   = isLight ? 'rgba(0,48,135,0.10)' : 'rgba(255,255,255,0.08)'
  const trackBg       = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'

  // ── KPI helpers ───────────────────────────────────────────────────────────
  const kpis = overview?.kpis ?? {}
  const spend    = kpis.spend     != null ? FMT_USD.format(kpis.spend) : null
  const requests = kpis.requests  != null ? kpis.requests.toLocaleString() : null
  const tokensIn  = kpis.tokensIn  != null ? `${(kpis.tokensIn  / 1e6).toFixed(1)}M` : null
  const tokensOut = kpis.tokensOut != null ? `${(kpis.tokensOut / 1e6).toFixed(1)}M` : null
  const budgetPct = budget?.pct != null ? `${budget.pct.toFixed(0)}%` : null
  const budgetSub = budget
    ? `${FMT_USD.format(budget.used ?? 0)} used · cap ${FMT_USD.format(budget.creditLimit ?? 0)}`
    : null

  // ── Attribution table ─────────────────────────────────────────────────────
  const attrRows  = overview?.attribution ?? []
  const maxCost   = attrRows.length ? Math.max(...attrRows.map(r => r.cost)) : 1
  const attrLabel = FINOPS_ATTR_KEYS.find(k => k.id === attr)?.label ?? 'Team'

  // ── Budget bar ────────────────────────────────────────────────────────────
  const budgetUsedPct  = Math.min(100, budget?.pct ?? 0)
  const budgetAlertPct = budget?.alertThreshold != null
    ? Math.min(100, (budget.alertThreshold / (budget.creditLimit || 1)) * 100)
    : 80
  // Color the bar based on utilization pct
  const budgetBarColor = (() => {
    if (budgetUsedPct >= 100) return RED
    if (budgetUsedPct >= 80)  return AMBER
    return GREEN
  })()

  // ── Savings estimates from real spend ─────────────────────────────────────
  const realSpend = kpis.spend ?? 0
  // Illustrative: ~18% cache savings, ~10% cheaper-model savings
  const cacheSavingsEst  = realSpend > 0 ? realSpend * 0.18 : null
  const modelSavingsEst  = realSpend > 0 ? realSpend * 0.10 : null
  const totalSavingsEst  = (cacheSavingsEst != null && modelSavingsEst != null)
    ? cacheSavingsEst + modelSavingsEst : null
  const totalSavedPct    = totalSavingsEst != null && realSpend > 0
    ? ((totalSavingsEst / (realSpend + totalSavingsEst)) * 100).toFixed(0) : null

  // ── Enforce SSE rendering helpers ─────────────────────────────────────────
  const enfLines = enfSse.lines
  const enfDone  = enfLines.some(l => l.event === 'done')
  const reqLines = enfLines.filter(l => l.event === 'req')

  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ color: textPrimary }}>
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-5">

        {/* ── Controls bar ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: textSecondary }}>Range:</span>
            <SegmentControl options={FINOPS_RANGES} value={range} onChange={setRange} isLight={isLight} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: textSecondary }}>Group by:</span>
            <SegmentControl options={FINOPS_ATTR_KEYS} value={attr} onChange={setAttr} isLight={isLight} />
          </div>
          <div className="flex-1" />
          <button onClick={loadData}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                  style={{ border: `1px solid ${borderColor}`, color: textSecondary }}
                  title="Refresh data">
            <RefreshCw size={12} />
            Refresh
          </button>
          {/* Generate traffic button */}
          <button onClick={handleGenerate}
                  disabled={genSse.running}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-opacity disabled:opacity-50"
                  style={{ background: ACCENT, color: '#fff' }}>
            <Zap size={12} />
            {genSse.running ? 'Generating…' : 'Generate traffic'}
          </button>
        </div>

        {/* Generate traffic SSE stream panel */}
        {(genSse.running || genSse.lines.length > 0 || genSse.error) && (
          <div className="rounded-xl p-3 text-[10px] font-mono"
               style={{
                 background: isLight ? '#f1f5f9' : '#0d1117',
                 border: `1px solid ${borderColor}`,
                 color: isLight ? '#334155' : '#94a3b8',
                 maxHeight: 140,
                 overflowY: 'auto',
               }}>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-1.5"
                 style={{ color: ACCENT, fontFamily: 'inherit' }}>
              Traffic generator
            </div>
            {genSse.error && (
              <div style={{ color: RED }}>{genSse.error}</div>
            )}
            {genSse.lines.map((ln, i) => {
              if (ln.event === 'step') {
                const d = ln.data
                return (
                  <div key={i} style={{ color: d.ok ? (isLight ? '#16a34a' : GREEN) : RED }}>
                    {d.ok
                      ? `req ${d.i}/${d.of} ✓  ${d.model?.split('/').pop() ?? ''} · team: ${d.team ?? ''}`
                      : `req ${d.i}/${d.of} ✗  ${d.error ?? 'error'}`
                    }
                  </div>
                )
              }
              if (ln.event === 'done') {
                return (
                  <div key={i} style={{ color: isLight ? '#0f172a' : '#e2e8f0', fontWeight: 700 }}>
                    Done — {ln.data.generated} requests fired. Refreshing data…
                  </div>
                )
              }
              return null
            })}
            {genSse.running && (
              <div style={{ color: textSecondary }}>…</div>
            )}
            <div className="text-[9px] mt-2" style={{ color: textSecondary }}>
              ⚠ This spends real money on your Vertex/Bedrock accounts.
            </div>
          </div>
        )}

        {/* ── ① KPI strip ──────────────────────────────────────────────── */}
        <div>
          <SectionLabel>① KPI strip</SectionLabel>
          {loading ? (
            <div className="flex gap-3">
              {[1,2,3,4].map(i => <LoadingPulse key={i} isLight={isLight} height={72} />)}
            </div>
          ) : (
            <div className="flex gap-3">
              <KpiCard label="Spend · this period" value={spend}    sub="from Portkey analytics"  isLight={isLight} />
              <KpiCard label="Requests"            value={requests} sub={null}                    isLight={isLight} />
              <KpiCard label="Tokens in / out"     value={tokensIn ? `${tokensIn} / ${tokensOut ?? '—'}` : '—'} sub="input / output tokens" isLight={isLight} />
              <KpiCard label="Budget used"         value={budgetPct} sub={budgetSub}              isLight={isLight} />
            </div>
          )}
        </div>

        {/* ── ② Spend over time + By model ─────────────────────────────── */}
        <div>
          <SectionLabel>② Spend over time · by model</SectionLabel>
          {loading ? (
            <LoadingPulse isLight={isLight} height={200} />
          ) : (
            <div className="flex gap-3">
              {/* Spend trend */}
              <Panel isLight={isLight} style={{ flex: 2 }}>
                <div className="text-[9px] font-semibold mb-2" style={{ color: textSecondary }}>
                  Spend over time
                </div>
                {(overview?.series ?? []).length > 0 ? (
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={overview.series}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#ec4899" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={v => {
                            const d = new Date(v)
                            return isNaN(d) ? v : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          }}
                          tick={{ fill: textSecondary, fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <Tooltip
                          contentStyle={{
                            background: isLight ? '#fff' : 'rgba(15,20,35,0.98)',
                            border: `1px solid ${isLight ? 'rgba(0,48,135,0.14)' : 'rgba(255,255,255,0.12)'}`,
                            borderRadius: 8,
                            fontSize: 11,
                            color: isLight ? '#1e293b' : '#e2e8f0',
                          }}
                          labelStyle={{ color: textSecondary, fontSize: 9 }}
                          labelFormatter={v => {
                            const d = new Date(v)
                            return isNaN(d) ? v : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          }}
                          formatter={v => [FMT_USD.format(v), 'Spend']}
                        />
                        <Area
                          type="monotone"
                          dataKey="cost"
                          stroke="#ec4899"
                          strokeWidth={2}
                          fill="url(#spendGrad)"
                          dot={false}
                          activeDot={{ r: 4, fill: '#ec4899' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-[10px]" style={{ height: 160, color: textSecondary }}>
                    No spend data for this range — try "Generate traffic"
                  </div>
                )}
                <div className="text-[9px] mt-1" style={{ color: textSecondary }}>
                  last {range} · cost per day
                </div>
              </Panel>

              {/* By model donut */}
              <Panel isLight={isLight} style={{ flex: 1 }}>
                <div className="text-[9px] font-semibold mb-2" style={{ color: textSecondary }}>
                  By model
                </div>
                {(() => {
                  const withCost = (overview?.byModel ?? []).filter(m => m.cost > 0)
                  if (withCost.length === 0) {
                    return (
                      <div className="flex flex-col gap-1.5">
                        {(overview?.byModel ?? []).slice(0, 5).map((m, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px]">
                            <span className="truncate max-w-[100px]" style={{ color: textPrimary }} title={m.model}>
                              {m.model.split('/').pop()}
                            </span>
                            <span style={{ color: textSecondary }}>—</span>
                          </div>
                        ))}
                        {(overview?.byModel ?? []).length === 0 && (
                          <div style={{ color: textSecondary }}>No model data</div>
                        )}
                      </div>
                    )
                  }
                  const sorted = [...withCost].sort((a, b) => b.cost - a.cost)
                  const top4   = sorted.slice(0, 4)
                  const others = sorted.slice(4)
                  const pieData = [
                    ...top4.map(m => ({ name: m.model.split('/').pop(), value: m.cost })),
                    ...(others.length > 0
                      ? [{ name: 'others', value: others.reduce((s, m) => s + m.cost, 0) }]
                      : []),
                  ]
                  const total = pieData.reduce((s, d) => s + d.value, 0)
                  return (
                    <div className="flex flex-col gap-2">
                      <div style={{ height: 90 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={26}
                              outerRadius={42}
                              paddingAngle={2}
                              dataKey="value"
                              startAngle={90}
                              endAngle={-270}
                            >
                              {pieData.map((_, i) => (
                                <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} fillOpacity={0.9} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: isLight ? '#fff' : 'rgba(15,20,35,0.98)',
                                border: `1px solid ${isLight ? 'rgba(0,48,135,0.14)' : 'rgba(255,255,255,0.12)'}`,
                                borderRadius: 8,
                                fontSize: 10,
                                color: isLight ? '#1e293b' : '#e2e8f0',
                              }}
                              formatter={v => [FMT_USD.format(v), 'Spend']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-1">
                        {pieData.map((d, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[9px]">
                            <span style={{
                              display: 'inline-block',
                              width: 8, height: 8,
                              borderRadius: 2,
                              background: MODEL_COLORS[i % MODEL_COLORS.length],
                              flexShrink: 0,
                            }} />
                            <span className="truncate" style={{ color: textPrimary, flex: 1 }} title={d.name}>{d.name}</span>
                            <span style={{ color: textSecondary, flexShrink: 0 }}>
                              {total > 0 ? `${((d.value / total) * 100).toFixed(0)}%` : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </Panel>
            </div>
          )}
        </div>

        {/* ── ③ Attribution table ───────────────────────────────────────── */}
        <div>
          <SectionLabel>③ Cost attribution — who's spending</SectionLabel>
          {loading ? (
            <LoadingPulse isLight={isLight} height={140} />
          ) : (
            <Panel isLight={isLight}>
              {attrRows.length > 0 ? (
                <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr>
                      {[attrLabel, 'Spend', 'Share', 'Requests', ''].map((h, i) => (
                        <th key={i} style={{
                          textAlign:      i === 4 ? 'right' : 'left',
                          padding:        '4px 8px',
                          borderBottom:   `1px solid ${borderColor}`,
                          color:          textSecondary,
                          fontSize:       9,
                          textTransform:  'uppercase',
                          letterSpacing:  '0.5px',
                          fontWeight:     700,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attrRows.map((row, i) => (
                      <tr key={i}>
                        {/* Name */}
                        <td style={{ padding: '5px 8px', color: textPrimary, borderBottom: `1px solid ${borderColor}` }}>
                          {row.name ?? '—'}
                        </td>
                        {/* Spend — FMT_USD */}
                        <td style={{ padding: '5px 8px', color: ACCENT, fontWeight: 700, borderBottom: `1px solid ${borderColor}` }}>
                          {FMT_USD.format(row.cost ?? 0)}
                        </td>
                        {/* Share % */}
                        <td style={{ padding: '5px 8px', color: textSecondary, borderBottom: `1px solid ${borderColor}` }}>
                          {row.share != null ? `${row.share}%` : '—'}
                        </td>
                        {/* Requests */}
                        <td style={{ padding: '5px 8px', color: textSecondary, borderBottom: `1px solid ${borderColor}` }}>
                          {row.requests?.toLocaleString() ?? '—'}
                        </td>
                        {/* Mini bar */}
                        <td style={{ padding: '5px 8px', width: 80, borderBottom: `1px solid ${borderColor}` }}>
                          <div style={{ background: trackBg, borderRadius: 3, height: 7, overflow: 'hidden' }}>
                            <div style={{
                              width:      `${Math.min(100, maxCost > 0 ? (row.cost / maxCost) * 100 : 0)}%`,
                              height:     '100%',
                              background: `${ACCENT}99`,
                              borderRadius: 3,
                            }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-[11px] text-center py-8 flex flex-col items-center gap-1.5"
                     style={{ color: textSecondary }}>
                  <span>No attribution data for this range / dimension.</span>
                  <span className="text-[10px]">
                    Hit <strong style={{ color: ACCENT }}>Generate traffic</strong> to seed real spend across teams.
                  </span>
                </div>
              )}
              <div className="text-[9px] mt-3" style={{ color: textSecondary }}>
                grouped by Portkey metadata — toggle: team · user · application
              </div>
            </Panel>
          )}
        </div>

        {/* ── ④ Budget + LIVE enforcement (hero) ───────────────────────── */}
        <div>
          <SectionLabel>
            ④ Budget caps + LIVE enforcement{' '}
            <span style={{ color: ACCENT }}>★ hero</span>
          </SectionLabel>
          {loading ? (
            <LoadingPulse isLight={isLight} height={160} />
          ) : (
            <Panel isLight={isLight} style={{ borderColor: `${ACCENT}55` }}>
              {budget ? (
                <div className="flex gap-6">

                  {/* Left: budget bar */}
                  <div style={{ flex: 2 }}>
                    <div className="text-[10px] mb-2" style={{ color: textPrimary }}>
                      {budget.periodicReset
                        ? budget.periodicReset.charAt(0).toUpperCase() + budget.periodicReset.slice(1)
                        : 'Monthly'}{' '}cap{' '}
                      <span className="font-bold" style={{ color: textPrimary }}>
                        {FMT_USD.format(budget.creditLimit ?? 0)}
                      </span>
                      {budget.alertThreshold != null && (
                        <> · alert at {((budget.alertThreshold / (budget.creditLimit || 1)) * 100).toFixed(0)}%{' '}
                        ({FMT_USD.format(budget.alertThreshold)})</>
                      )}
                      {budget.periodicReset && (
                        <> · resets {budget.periodicReset}</>
                      )}
                    </div>

                    {/* Utilization bar */}
                    <div className="rounded-full overflow-hidden" style={{ height: 12, background: trackBg }}>
                      <div style={{
                        width:      `${budgetUsedPct}%`,
                        height:     '100%',
                        background: budgetBarColor,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>

                    {/* Alert notch marker */}
                    <div style={{ position: 'relative', height: 4 }}>
                      <div style={{
                        position: 'absolute',
                        left:     `${budgetAlertPct}%`,
                        top:      0,
                        width:    1,
                        height:   4,
                        background: AMBER,
                        opacity:  0.7,
                      }} />
                    </div>

                    <div className="text-[9px] mt-1.5" style={{ color: textSecondary }}>
                      {FMT_USD.format(budget.used ?? 0)} used · {budgetUsedPct.toFixed(0)}%
                      {budget.creditLimit != null && (
                        <>
                          {' '}·{' '}
                          {budgetUsedPct >= 100
                            ? <span style={{ color: RED }}>🔴 cap exceeded</span>
                            : budgetUsedPct >= budgetAlertPct
                              ? <span style={{ color: AMBER }}>⚠ approaching limit</span>
                              : <span style={{ color: GREEN }}>within budget</span>
                          }
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: live enforcement demo */}
                  <div style={{
                    flex:        1,
                    borderLeft:  `1px solid ${borderColor}`,
                    paddingLeft: 16,
                    display:     'flex',
                    flexDirection: 'column',
                    gap:         8,
                  }}>
                    <div className="text-[9px]" style={{ color: textSecondary }}>
                      Live demo — dedicated key, isolated token cap
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => enfSse.start('/api/gateway/finops/enforce/run')}
                        disabled={enfSse.running || resetting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-opacity disabled:opacity-50"
                        style={{ background: ACCENT, color: '#fff' }}>
                        <Play size={11} />
                        {enfSse.running ? 'Running…' : '▶ Fire requests'}
                      </button>
                      <button
                        onClick={handleEnforceReset}
                        disabled={enfSse.running || resetting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-opacity disabled:opacity-50"
                        style={{
                          border:  `1px solid ${borderColor}`,
                          color:   textSecondary,
                          background: 'transparent',
                        }}>
                        <RotateCcw size={11} />
                        {resetting ? 'Resetting…' : '↺ Reset'}
                      </button>
                    </div>

                    {/* SSE log */}
                    {(enfSse.lines.length > 0 || enfSse.error || resetMsg) && (
                      <div className="rounded-lg px-2.5 py-2 text-[9px] font-mono"
                           style={{
                             background: isLight ? '#f1f5f9' : 'rgba(0,0,0,0.35)',
                             border:     `1px solid ${borderColor}`,
                             color:      textSecondary,
                             maxHeight:  110,
                             overflowY:  'auto',
                           }}>
                        {resetMsg && (
                          <div style={{ color: isLight ? '#0f172a' : '#e2e8f0', marginBottom: 2 }}>
                            {resetMsg}
                          </div>
                        )}
                        {enfSse.error && (
                          <div style={{ color: RED }}>{enfSse.error}</div>
                        )}
                        {reqLines.map((ln, i) => {
                          const d = ln.data
                          if (d.status === 'allowed') {
                            return (
                              <div key={i} style={{ color: isLight ? '#16a34a' : GREEN }}>
                                req {d.n} ✓ allowed
                              </div>
                            )
                          }
                          if (d.status === 'blocked') {
                            return (
                              <div key={i} style={{ color: RED, fontWeight: 700 }}>
                                🔴 req {d.n} BLOCKED · {d.code} budget exceeded
                              </div>
                            )
                          }
                          return (
                            <div key={i} style={{ color: AMBER }}>
                              req {d.n} ⚠ error {d.code ?? ''} {d.error ?? ''}
                            </div>
                          )
                        })}
                        {enfDone && !enfSse.running && (
                          <div style={{ color: textSecondary, marginTop: 2 }}>
                            — done —
                          </div>
                        )}
                        {enfSse.running && (
                          <div style={{ color: textSecondary }}>…</div>
                        )}
                      </div>
                    )}

                    <div className="text-[8px]" style={{ color: textSecondary, opacity: 0.8 }}>
                      real Portkey Admin API · isolated token-capped key
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[11px]" style={{ color: textSecondary }}>
                  <AlertTriangle size={14} style={{ color: AMBER }} />
                  Budget data unavailable — check{' '}
                  <code className="px-1 rounded" style={{ background: trackBg }}>
                    PORTKEY_ADMIN_API_KEY
                  </code>
                </div>
              )}
            </Panel>
          )}
        </div>

        {/* ── ⑤ Savings cards ──────────────────────────────────────────── */}
        <div>
          <SectionLabel>⑤ Optimization &amp; savings</SectionLabel>
          {loading ? (
            <LoadingPulse isLight={isLight} height={90} />
          ) : (
            <div className="flex gap-3">

              {/* Semantic caching */}
              <div className="flex-1 rounded-xl p-4"
                   style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.30)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="text-[9px]" style={{ color: isLight ? '#92400e' : '#cbd5e1' }}>
                    Semantic caching
                  </div>
                  <span className="text-[8px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: 'rgba(245,158,11,0.20)', color: AMBER, border: '1px solid rgba(245,158,11,0.40)' }}>
                    estimated
                  </span>
                </div>
                <div className="text-[16px] font-extrabold" style={{ color: AMBER }}>
                  {cacheSavingsEst != null ? FMT_USD.format(cacheSavingsEst) : '—'}
                </div>
                <div className="text-[9px] mt-1" style={{ color: textSecondary }}>
                  {cacheSavingsEst != null
                    ? '~18% of spend avoided · illustrative estimate'
                    : 'generate traffic to see estimate'}
                </div>
                <div className="text-[8px] mt-1" style={{ color: textSecondary, opacity: 0.7 }}>
                  estimated — illustrative
                </div>
              </div>

              {/* Cheaper-model routing */}
              <div className="flex-1 rounded-xl p-4"
                   style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.30)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="text-[9px]" style={{ color: isLight ? '#92400e' : '#cbd5e1' }}>
                    Cheaper-model routing
                  </div>
                  <span className="text-[8px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: 'rgba(245,158,11,0.20)', color: AMBER, border: '1px solid rgba(245,158,11,0.40)' }}>
                    estimated
                  </span>
                </div>
                <div className="text-[16px] font-extrabold" style={{ color: AMBER }}>
                  {modelSavingsEst != null ? FMT_USD.format(modelSavingsEst) : '—'}
                </div>
                <div className="text-[9px] mt-1" style={{ color: textSecondary }}>
                  simple calls → Haiku / Flash
                </div>
                <div className="text-[8px] mt-1" style={{ color: textSecondary, opacity: 0.7 }}>
                  estimated — illustrative
                </div>
              </div>

              {/* Total saved */}
              <div className="flex-1 rounded-xl p-4"
                   style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.30)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="text-[9px]" style={{ color: isLight ? '#065f46' : '#cbd5e1' }}>
                    Total saved this period
                  </div>
                  <span className="text-[8px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: 'rgba(52,211,153,0.20)', color: GREEN, border: '1px solid rgba(52,211,153,0.40)' }}>
                    estimated
                  </span>
                </div>
                <div className="text-[16px] font-extrabold" style={{ color: GREEN }}>
                  {totalSavingsEst != null ? FMT_USD.format(totalSavingsEst) : '—'}
                </div>
                <div className="text-[9px] mt-1" style={{ color: textSecondary }}>
                  {totalSavedPct != null
                    ? `~${totalSavedPct}% off the un-optimized bill`
                    : 'generate traffic to see estimate'}
                </div>
                <div className="text-[8px] mt-1" style={{ color: textSecondary, opacity: 0.7 }}>
                  estimated — illustrative
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
