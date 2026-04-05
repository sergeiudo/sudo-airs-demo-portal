import React from 'react'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { BarChart3 } from 'lucide-react'

const SEV_COLORS = {
  CRITICAL: { bar: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', text: '#ef4444' },
  HIGH:     { bar: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)', text: '#f97316' },
  MEDIUM:   { bar: '#facc15', bg: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.25)', text: '#facc15' },
  LOW:      { bar: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.25)', text: '#60a5fa' },
}
const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export function RedTeamReport({ report }) {
  if (!report) return null

  const sevStats = report.severity_report?.stats ?? {}
  const sevTotal = Object.values(sevStats).reduce((a, b) => a + b, 0)

  // Build donut data in fixed order, skip zeros
  const donutData = SEV_ORDER
    .filter(s => sevStats[s] > 0)
    .map(s => ({ name: s, value: sevStats[s], color: SEV_COLORS[s]?.bar ?? '#64748b' }))

  const compliance = report.compliance_report ?? []
  // Normalise compliance score: if score is 0–1 float, convert to 0–100
  const normalise = (v) => {
    if (v == null) return 0
    return v <= 1 ? Math.round(v * 100) : Math.round(v)
  }

  const isLight = document.documentElement.classList.contains('light')
  const cardBg = isLight ? 'rgba(0,48,135,0.03)' : 'rgba(255,255,255,0.02)'
  const cardBorder = isLight ? 'rgba(0,48,135,0.10)' : 'rgba(255,255,255,0.08)'
  const textPrimary = isLight ? '#0f172a' : '#e2e8f0'
  const textMuted = '#64748b'

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderBottom: `1px solid ${cardBorder}`,
        padding: '14px 20px',
        flexShrink: 0,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <BarChart3 size={12} color={textMuted} />
        <span style={{ fontSize: 11, fontWeight: 700, color: textPrimary, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Campaign Report
        </span>
        {report.asr != null && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 600,
            color: report.asr > 50 ? '#ef4444' : report.asr > 20 ? '#facc15' : '#34d399',
          }}>
            ASR {report.asr.toFixed(1)}%
          </span>
        )}
        {report.score != null && (
          <span style={{ fontSize: 10, color: textMuted }}>
            Score {report.score.toFixed(1)}
          </span>
        )}
      </div>

      {/* 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Left: Severity donut */}
        <div style={{
          background: cardBg, border: `1px solid ${cardBorder}`,
          borderRadius: 12, padding: '12px 8px 4px',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: textMuted, textTransform: 'uppercase', textAlign: 'center', marginBottom: 4 }}>
            Severity Breakdown
          </div>
          {donutData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%" cy="50%"
                    innerRadius={32} outerRadius={52}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((d, i) => (
                      <Cell key={i} fill={d.color} fillOpacity={0.9} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8, fontSize: 11,
                    }}
                    formatter={(val) => [`${val} (${sevTotal ? ((val / sevTotal) * 100).toFixed(0) : 0}%)`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', justifyContent: 'center', paddingBottom: 8 }}>
                {donutData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: textMuted }}>{d.name} {d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: textMuted }}>
              No severity data
            </div>
          )}
        </div>

        {/* Right: Compliance bars */}
        <div style={{
          background: cardBg, border: `1px solid ${cardBorder}`,
          borderRadius: 12, padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: textMuted, textTransform: 'uppercase', marginBottom: 10 }}>
            Compliance Scores
          </div>
          {compliance.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'center' }}>
              {compliance.map(c => {
                const pct = normalise(c.score)
                const barColor = pct >= 70 ? '#34d399' : pct >= 40 ? '#facc15' : '#ef4444'
                return (
                  <div key={c.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: textPrimary }}>{c.id}</span>
                      <span style={{ fontSize: 10, color: barColor, fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                        style={{ height: '100%', borderRadius: 99, background: barColor }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: textMuted }}>
              No compliance data
            </div>
          )}
        </div>

      </div>
    </motion.div>
  )
}
