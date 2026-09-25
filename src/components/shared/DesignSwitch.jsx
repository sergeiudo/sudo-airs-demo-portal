import React from 'react'
import { LayoutGrid, LayoutDashboard } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

/**
 * DesignSwitch — Classic | New, for the whole portal.
 *
 * Rendered in both home headers and in the pillar top bar, so the design can
 * be changed from anywhere without hunting for the control. It reads and
 * writes the global `uiMode` (AppContext), which is remembered per browser.
 *
 * It lives in headers rather than floating: a fixed pill covered tile Launch
 * buttons as the home page scrolled, and a fixed control must never hide
 * interactive content. Inline colours, because it has to sit correctly on
 * surfaces from both designs.
 */

const OPTIONS = [
  { id: 'classic', label: 'Classic', icon: LayoutGrid },
  { id: 'new', label: 'New', icon: LayoutDashboard },
]

export function DesignSwitch({ compact = false }) {
  const { state, dispatch } = useAppContext()
  const value = state.uiMode
  const c = state.isDark
    ? { bg: 'rgba(32,32,36,0.92)', border: 'rgba(255,255,255,0.12)', text: '#A0A0AA', on: '#F3F3F5', onBg: 'rgba(255,255,255,0.12)' }
    : { bg: 'rgba(255,255,255,0.94)', border: 'rgba(20,20,24,0.10)', text: '#55555D', on: '#131316', onBg: 'rgba(20,20,24,0.07)' }

  return (
    <div role="radiogroup" aria-label="Portal design"
         className="inline-flex items-center gap-0.5 rounded-full flex-shrink-0"
         style={{ padding: 3, background: c.bg, border: `1px solid ${c.border}` }}>
      {!compact && (
        <span className="px-2.5 select-none" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.text }}>
          Design
        </span>
      )}
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const on = value === id
        return (
          <button key={id} type="button" role="radio" aria-checked={on}
                  onClick={() => dispatch({ type: 'SET_UI_MODE', payload: id })}
                  title={`${label} design`}
                  className="inline-flex items-center gap-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  style={{
                    height: compact ? 26 : 30, padding: compact ? '0 9px' : '0 11px',
                    fontFamily: 'Inter, system-ui, sans-serif', fontSize: compact ? 11.5 : 12.5, fontWeight: on ? 700 : 500,
                    color: on ? c.on : c.text, background: on ? c.onBg : 'transparent', cursor: 'pointer',
                  }}>
            <Icon size={compact ? 12 : 13} aria-hidden="true" /> {label}
          </button>
        )
      })}
    </div>
  )
}
