// src/components/observability/VolumeChart.jsx
import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export function VolumeChart({ data = [] }) {
  if (!data.length) return <div className="flex items-center justify-center h-40 text-slate-700 text-sm">No data yet</div>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#94a3b8' }}
        />
        <Legend wrapperStyle={{ fontSize: 10, color: '#64748b' }} />
        <Bar dataKey="allowed" stackId="a" fill="#34d399" fillOpacity={0.8} name="Allowed" radius={[0,0,0,0]} />
        <Bar dataKey="blocked" stackId="a" fill="#ef4444" fillOpacity={0.8} name="Blocked" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
