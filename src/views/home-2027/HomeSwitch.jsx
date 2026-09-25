import React from 'react'
import { LayoutGrid, LayoutDashboard } from 'lucide-react'

/**
 * HomeSwitch — choose between the classic home and the 2027 one.
 *
 * Both homes stay first-class; each renders this control in its own header,
 * so switching never depends on which one you are looking at. (It first
 * floated bottom-right, and covered tile Launch buttons as the page scrolled —
 * a fixed control must not hide interactive content.) The choice is
 * remembered per browser (App.jsx owns the state and storage), and
 * Classic is the default for anyone who has not chosen — a colleague opening
 * the portal sees the home they already know.
 *
 * Styled with inline colours rather than the 2027 tokens: it has to sit
 * correctly on both homes, and the classic one does not use those tokens.
 */

export const HOME_VERSIONS = [
  { id: 'classic', label: 'Classic', icon: LayoutGrid },
  { id: 'new', label: 'New', icon: LayoutDashboard },
]

export function HomeSwitch({ value, onChange, isDark }) {
  const c = isDark
    ? { bg: 'rgba(32,32,36,0.92)', border: 'rgba(255,255,255,0.12)', text: '#A0A0AA', on: '#F3F3F5', onBg: 'rgba(255,255,255,0.12)', shadow: '0 10px 30px rgba(0,0,0,0.45)' }
    : { bg: 'rgba(255,255,255,0.94)', border: 'rgba(20,20,24,0.10)', text: '#55555D', on: '#131316', onBg: 'rgba(20,20,24,0.07)', shadow: '0 10px 30px rgba(18,18,22,0.12)' }

  return (
    <div role="radiogroup" aria-label="Home page layout"
         className="inline-flex items-center gap-0.5 rounded-full flex-shrink-0"
         style={{ padding: 3, background: c.bg, border: `1px solid ${c.border}` }}>
      <span className="px-2.5 select-none" style={{ fontFamily: '"Space Grotesk", Inter, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.text }}>
        Home
      </span>
      {HOME_VERSIONS.map(({ id, label, icon: Icon }) => {
        const on = value === id
        return (
          <button key={id} type="button" role="radio" aria-checked={on}
                  onClick={() => onChange(id)}
                  className="inline-flex items-center gap-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  style={{
                    height: 30, padding: '0 11px',
                    fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12.5, fontWeight: on ? 700 : 500,
                    color: on ? c.on : c.text, background: on ? c.onBg : 'transparent', cursor: 'pointer',
                  }}>
            <Icon size={13} aria-hidden="true" /> {label}
          </button>
        )
      })}
    </div>
  )
}
