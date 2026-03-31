// src/components/observability/ProviderChart.jsx
import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const PROVIDER_COLORS = { vertex: '#60a5fa', bedrock: '#f97316', azure: '#a78bfa', direct: '#94a3b8' }

export function ProviderChart({ breakdown = {} }) {
  const data = Object.entries(breakdown).map(([name, value]) => ({ name, value }))
  if (!data.length) return <div className="flex items-center justify-center h-40 text-slate-700 text-sm">No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Requests">
          {data.map((entry, i) => <Cell key={i} fill={PROVIDER_COLORS[entry.name] ?? '#64748b'} fillOpacity={0.85} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
