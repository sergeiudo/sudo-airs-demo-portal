import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { shade } from '../home-2027/band'
import { CopyCmd } from '../runtime-launch/LaunchModelPicker'

/** A problem worth stopping for, with the fix: the supply-chain console's notice card. */
export function Notice({ t, title, children, cmd, after, tone }) {
  const c = tone ?? t.warn
  const ink = t.isLight ? shade(c, 0.38) : c
  return (
    <div className="rounded-2xl px-3 py-3" style={{ background: `${c}0f`, border: `1px solid ${c}40` }}>
      <div className="flex items-start gap-2.5">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 28, height: 28, background: `${c}1f`, color: ink }}>
          <AlertTriangle size={14} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink, lineHeight: 1.3 }}>{title}</div>
          {children && <div style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.5, color: t.inkDim, marginTop: 2 }}>{children}</div>}
        </div>
      </div>
      {cmd && <CopyCmd t={t} cmd={cmd} />}
      {after && <p style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: 1.5, color: t.inkDim, marginTop: 6 }}>{after}</p>}
    </div>
  )
}
