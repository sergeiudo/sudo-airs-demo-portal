// src/components/observability/P95Gauge.jsx
import React from 'react'

export function P95Gauge({ p95Ms = 0, avgMs = 0 }) {
  const MAX = 3000
  const pct = Math.min(p95Ms / MAX, 1)
  const RADIUS = 60
  const STROKE = 10
  const cx = 80
  const cy = 80
  const startAngle = -220
  const sweepDeg = 260
  const endAngle = startAngle + sweepDeg * pct

  function polarToXY(angleDeg, r) {
    const rad = (angleDeg * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  function arcPath(fromDeg, toDeg, r) {
    const start = polarToXY(fromDeg, r)
    const end   = polarToXY(toDeg, r)
    const large = toDeg - fromDeg > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`
  }

  const color = p95Ms > 2000 ? '#ef4444' : p95Ms > 1000 ? '#f97316' : '#34d399'

  return (
    <div className="flex flex-col items-center justify-center">
      <svg width={160} height={140} viewBox="0 0 160 140">
        <path d={arcPath(startAngle, startAngle + sweepDeg, RADIUS)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE} strokeLinecap="round" />
        {pct > 0 && (
          <path d={arcPath(startAngle, endAngle, RADIUS)} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={22} fontWeight="bold" fontFamily="monospace">
          {p95Ms > 0 ? `${p95Ms}` : '—'}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#475569" fontSize={10}>ms P95</text>
        <text x={cx} y={cy + 28} textAnchor="middle" fill="#334155" fontSize={9}>avg {avgMs}ms</text>
      </svg>
    </div>
  )
}
