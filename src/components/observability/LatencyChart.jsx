// src/components/observability/LatencyChart.jsx
import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export function LatencyChart({ data = [] }) {
  if (!data.length) return <div className="flex items-center justify-center h-40 text-slate-700 text-sm">No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} unit="ms" width={48} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#94a3b8' }}
        />
        <Legend wrapperStyle={{ fontSize: 10, color: '#64748b' }} />
        <Line type="monotone" dataKey="total_ms" stroke="#94a3b8" strokeWidth={2} dot={false} name="Total" />
        <Line type="monotone" dataKey="llm_ms"   stroke="#60a5fa" strokeWidth={2} dot={false} name="LLM" />
        <Line type="monotone" dataKey="airs_ms"  stroke="#34d399" strokeWidth={2} dot={false} name="AIRS" />
      </LineChart>
    </ResponsiveContainer>
  )
}
