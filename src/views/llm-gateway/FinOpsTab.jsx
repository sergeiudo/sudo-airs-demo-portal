import React, { useEffect, useState, useCallback } from 'react'
import { Wallet, RefreshCw, Play, AlertTriangle } from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis,
  PieChart, Pie, Cell,
} from 'recharts'
import { useAppContext } from '../../context/AppContext'
import { FINOPS_RANGES, FINOPS_ATTR_KEYS } from '../../data/finopsConfig'

const ACCENT = '#ec4899'
const AMBER  = '#f59e0b'
const MODEL_COLORS = ['#ec4899', '#38bdf8', '#fbbf24', '#a78bfa', '#475569']
const FMT_USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// ─── Setup screen ────────────────────────────────────────────────────────────
function SetupScreen({ isLight }) {
  const bg   = isLight ? '#fff'     : 'rgba(15,20,35,0.98)'
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
  const trackBg  = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)'
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
  const [generating, setGenerating] = useState(false)
  const [genMsg,   setGenMsg]   = useState(null)

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

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Generate traffic ──────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true)
    setGenMsg(null)
    try {
      const res = await fetch('/api/gateway/finops/generate', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      setGenMsg(res.ok
        ? `Fired ${json.sent ?? '?'} requests — refresh in a moment`
        : (json.error ?? 'Traffic generation failed'))
      if (res.ok) setTimeout(loadData, 3000)
    } catch {
      setGenMsg('Network error — traffic generator unavailable')
    } finally {
      setGenerating(false)
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

  // ── KPI helpers ───────────────────────────────────────────────────────────
  const kpis = overview?.kpis ?? {}
  const spend    = kpis.spend     != null ? `$${kpis.spend.toFixed(2)}` : null
  const requests = kpis.requests  != null ? kpis.requests.toLocaleString() : null
  const tokensIn  = kpis.tokensIn  != null ? `${(kpis.tokensIn  / 1e6).toFixed(1)}M` : null
  const tokensOut = kpis.tokensOut != null ? `${(kpis.tokensOut / 1e6).toFixed(1)}M` : null
  const budgetPct = budget?.pct != null ? `${budget.pct.toFixed(0)}%` : null
  const budgetSub = budget
    ? `$${(budget.used ?? 0).toFixed(2)} used · cap $${(budget.creditLimit ?? 0).toFixed(2)}`
    : null

  // ── Attribution table ─────────────────────────────────────────────────────
  const attrRows  = overview?.attribution ?? []
  const maxCost   = attrRows.length ? Math.max(...attrRows.map(r => r.cost)) : 1
  const attrLabel = FINOPS_ATTR_KEYS.find(k => k.id === attr)?.label ?? 'Team'

  // ── By-model list ─────────────────────────────────────────────────────────
  const byModel = overview?.byModel ?? []

  // ── Budget bar ────────────────────────────────────────────────────────────
  const budgetUsedPct  = Math.min(100, budget?.pct ?? 0)
  const budgetAlertPct = budget?.alertThreshold != null
    ? Math.min(100, (budget.alertThreshold / (budget.creditLimit || 1)) * 100)
    : 80
  const budgetBarColor = budgetUsedPct >= budgetAlertPct
    ? 'linear-gradient(90deg,#fbbf24,#ef4444)'
    : 'linear-gradient(90deg,#34d399,#fbbf24)'

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
          <button onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-opacity disabled:opacity-50"
                  style={{ background: ACCENT, color: '#fff' }}>
            <Play size={12} />
            {generating ? 'Generating…' : 'Generate traffic'}
          </button>
        </div>

        {/* Generate feedback */}
        {genMsg && (
          <div className="text-[11px] rounded-lg px-3 py-2 flex items-center gap-2"
               style={{
                 background: genMsg.toLowerCase().includes('error') || genMsg.toLowerCase().includes('fail')
                   ? 'rgba(239,68,68,0.10)' : 'rgba(52,211,153,0.10)',
                 border: `1px solid ${genMsg.toLowerCase().includes('error') || genMsg.toLowerCase().includes('fail')
                   ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.3)'}`,
                 color: genMsg.toLowerCase().includes('error') || genMsg.toLowerCase().includes('fail')
                   ? '#ef4444' : '#34d399',
               }}>
            {genMsg}
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
              {/* Spend trend — recharts AreaChart */}
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

              {/* By model — recharts Pie donut */}
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

        {/* ── ③ Attribution ────────────────────────────────────────────── */}
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
                          textAlign: i === 4 ? 'right' : 'left',
                          padding: '4px 8px',
                          borderBottom: `1px solid ${borderColor}`,
                          color: textSecondary,
                          fontSize: 9,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attrRows.map((row, i) => (
                      <tr key={i}>
                        <td style={{ padding: '5px 8px', color: textPrimary, borderBottom: `1px solid ${borderColor}` }}>
                          {row.name}
                        </td>
                        <td style={{ padding: '5px 8px', color: ACCENT, fontWeight: 700, borderBottom: `1px solid ${borderColor}` }}>
                          ${row.cost.toFixed(2)}
                        </td>
                        <td style={{ padding: '5px 8px', color: textSecondary, borderBottom: `1px solid ${borderColor}` }}>
                          {row.share != null ? `${(row.share * 100).toFixed(0)}%` : '—'}
                        </td>
                        <td style={{ padding: '5px 8px', color: textSecondary, borderBottom: `1px solid ${borderColor}` }}>
                          {row.requests?.toLocaleString() ?? '—'}
                        </td>
                        <td style={{ padding: '5px 8px', width: 80, borderBottom: `1px solid ${borderColor}` }}>
                          <div style={{ background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', borderRadius: 3, height: 7, overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, (row.cost / maxCost) * 100)}%`,
                              height: '100%',
                              background: 'rgba(236,72,153,0.6)',
                              borderRadius: 3,
                            }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-[11px] text-center py-6" style={{ color: textSecondary }}>
                  No attribution data for this range / dimension.
                  <br />
                  <span className="text-[10px]">Try "Generate traffic" to seed some data.</span>
                </div>
              )}
              <div className="text-[9px] mt-3" style={{ color: textSecondary }}>
                grouped by Portkey metadata — toggle: team · user · application
              </div>
            </Panel>
          )}
        </div>

        {/* ── ④ Budget + enforcement (hero) ────────────────────────────── */}
        <div>
          <SectionLabel>④ Budget caps + enforcement</SectionLabel>
          {loading ? (
            <LoadingPulse isLight={isLight} height={120} />
          ) : (
            <Panel isLight={isLight} style={{ borderColor: `${ACCENT}55` }}>
              {budget ? (
                <div className="flex gap-6">
                  {/* Budget bar */}
                  <div style={{ flex: 2 }}>
                    <div className="text-[10px] mb-2" style={{ color: textPrimary }}>
                      Monthly cap{' '}
                      <span className="font-bold">${(budget.creditLimit ?? 0).toFixed(2)}</span>
                      {budget.alertThreshold != null && (
                        <> · alert at {((budget.alertThreshold / (budget.creditLimit || 1)) * 100).toFixed(0)}%</>
                      )}
                      {budget.periodicReset && <> · resets {budget.periodicReset}</>}
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 12, background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
                      <div style={{
                        width:      `${budgetUsedPct}%`,
                        height:     '100%',
                        background: budgetBarColor,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <div className="text-[9px] mt-2" style={{ color: textSecondary }}>
                      ${(budget.used ?? 0).toFixed(4)} used · {budgetUsedPct.toFixed(0)}%
                      {budget.creditLimit != null && (
                        <> · {budgetUsedPct >= budgetAlertPct
                          ? <span style={{ color: '#ef4444' }}>⚠ approaching limit</span>
                          : <span style={{ color: '#34d399' }}>within budget</span>}
                        </>
                      )}
                    </div>
                  </div>
                  {/* Live enforcement note — Task 8 will wire the demo */}
                  <div style={{
                    flex: 1,
                    borderLeft: `1px solid ${borderColor}`,
                    paddingLeft: 16,
                  }}>
                    <div className="text-[9px] mb-2" style={{ color: textSecondary }}>
                      Live enforcement demo — Task 8
                    </div>
                    <div className="text-[10px]" style={{ color: textPrimary }}>
                      Fire requests against the isolated demo key until the budget cap is hit.
                      Requests beyond the cap are blocked by Portkey in real time.
                    </div>
                    <div className="text-[9px] mt-2" style={{ color: textSecondary }}>
                      real Portkey Admin API · isolated key · $0.50 cap
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[11px]" style={{ color: textSecondary }}>
                  <AlertTriangle size={14} style={{ color: AMBER }} />
                  Budget data unavailable — check <code className="px-1 rounded"
                    style={{ background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>PORTKEY_ADMIN_API_KEY</code>
                </div>
              )}
            </Panel>
          )}
        </div>

        {/* ── ⑤ Savings ────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>⑤ Optimization &amp; savings</SectionLabel>
          {loading ? (
            <LoadingPulse isLight={isLight} height={90} />
          ) : (
            <div className="flex gap-3">
              {/* Semantic caching */}
              <div className="flex-1 rounded-xl p-4"
                   style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.30)' }}>
                <div className="text-[9px] mb-1" style={{ color: isLight ? '#92400e' : '#cbd5e1' }}>
                  Semantic caching
                </div>
                <div className="text-[16px] font-extrabold" style={{ color: AMBER }}>—</div>
                <div className="text-[9px] mt-1" style={{ color: textSecondary }}>cache hits · spend avoided</div>
              </div>
              {/* Cheaper-model routing */}
              <div className="flex-1 rounded-xl p-4"
                   style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.30)' }}>
                <div className="text-[9px] mb-1" style={{ color: isLight ? '#92400e' : '#cbd5e1' }}>
                  Cheaper-model routing
                </div>
                <div className="text-[16px] font-extrabold" style={{ color: AMBER }}>—</div>
                <div className="text-[9px] mt-1" style={{ color: textSecondary }}>simple calls → Haiku / Flash</div>
              </div>
              {/* Total saved */}
              <div className="flex-1 rounded-xl p-4"
                   style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.30)' }}>
                <div className="text-[9px] mb-1" style={{ color: isLight ? '#065f46' : '#cbd5e1' }}>
                  Total saved this period
                </div>
                <div className="text-[16px] font-extrabold" style={{ color: '#34d399' }}>—</div>
                <div className="text-[9px] mt-1" style={{ color: textSecondary }}>optimization data · Task 8</div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
