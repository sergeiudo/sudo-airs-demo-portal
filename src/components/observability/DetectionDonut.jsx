// src/components/observability/DetectionDonut.jsx
import React from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#ef4444', '#f97316', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24']

export function DetectionDonut({ breakdown = {} }) {
  const data = Object.entries(breakdown).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
  if (!data.length) return <div className="flex items-center justify-center h-40 text-slate-700 text-sm">No detections yet</div>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />)}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
        />
        <Legend wrapperStyle={{ fontSize: 10, color: '#64748b' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
