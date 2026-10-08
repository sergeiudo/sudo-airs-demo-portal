import React, { useState } from 'react'
import { FileText, Sun, Moon } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { Tip } from './Tip'
import { AskAirsButton } from './askairs/AskAirs'
import { RegionsButton } from './RegionsPanel'
import { ServerStatusButton } from './ServerStatus'
import { FitCtx, useWidgetFit, useHeaderFit, pillBox, pillClass } from './headerFit'

/**
 * HeaderWidgets — the portal's widgets, the same five on every page, in the
 * same order and the same labelled-pill style:
 *
 *   Ask AIRS · AIRS regions · Server · ready · Release notes · Theme · dark
 *
 * `variant="bar"` sits on a light app bar (home, release notes, the top bar of
 * the pillars without a native header); `variant="band"` is white glass on a
 * pillar's coloured header (PillarHeader). `current="releaseNotes"` marks that
 * page's own pill instead of linking to itself.
 *
 * Fitting: five labelled pills plus a pillar's own controls outgrow a 1440px
 * header. Each header measures itself (`useHeaderFit`) and steps down only as
 * far as it must — 0 everything · 1 the TopBar's sub-label goes · 2 the brand
 * lockup goes · 3 the state words go ("· ready") · 4 the widgets become
 * icons, their Tips still saying what each one is. A header without a given
 * extra simply passes through that step.
 */

/** A labelled pill in either variant — the shape every header widget shares. */
export function HeaderPill({ t, variant = 'bar', icon: Icon, iconColor, label, state, onClick, current = false, ariaLabel, tip }) {
  const band = variant === 'band'
  const fit = useWidgetFit()
  const [hot, setHot] = useState(false)
  const iconOnly = fit >= 4
  const button = (
    <button type="button" onClick={current ? undefined : onClick} aria-label={ariaLabel ?? (iconOnly ? `${label}${state ? `: ${state}` : ''}` : undefined)} aria-current={current ? 'page' : undefined}
            onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className={pillClass(band)}
            style={{ ...pillBox({ t, band, iconOnly, active: current || hot, border: current ? `${t.live}66` : undefined }), cursor: current ? 'default' : 'pointer' }}>
      <Icon size={14} style={{ color: band ? '#fff' : iconColor ?? t.inkDim }} aria-hidden="true" />
      {!iconOnly && <span>{label}{state && fit < 3 && <span style={{ fontWeight: 500, color: band ? 'rgba(255,255,255,0.82)' : t.inkDim }}> · {state}</span>}</span>}
    </button>
  )
  return tip ? <Tip title={tip.title} text={tip.text}>{button}</Tip> : button
}

export function ReleaseNotesButton({ t, variant, current }) {
  const { dispatch } = useAppContext()
  return (
    <HeaderPill t={t} variant={variant} icon={FileText} iconColor={t.live} label="Release notes" current={current}
                onClick={() => dispatch({ type: 'SET_VIEW', payload: 'releaseNotes' })}
                tip={current ? null : { title: 'Release notes', text: 'Every Prisma AIRS feature and AI Gateway release, month by month — from docs.paloaltonetworks.com and the gateway changelog' }} />
  )
}

export function ThemeButton({ t, variant }) {
  const { state, dispatch } = useAppContext()
  const dark = state.isDark
  return (
    <HeaderPill t={t} variant={variant} icon={dark ? Moon : Sun} iconColor={dark ? '#9DB6FA' : '#E8A33D'} label="Theme" state={dark ? 'dark' : 'light'}
                onClick={() => dispatch({ type: 'TOGGLE_THEME' })} ariaLabel={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                tip={{ title: dark ? 'Dark theme' : 'Light theme', text: `Switch the whole portal to the ${dark ? 'light' : 'dark'} theme` }} />
  )
}

export function HeaderWidgets({ t, variant = 'bar', current = null, fit = 0 }) {
  return (
    <FitCtx.Provider value={fit}>
      <AskAirsButton t={t} variant={variant} />
      <RegionsButton t={t} variant={variant} />
      <ServerStatusButton t={t} variant={variant} />
      <ReleaseNotesButton t={t} variant={variant} current={current === 'releaseNotes'} />
      <ThemeButton t={t} variant={variant} />
    </FitCtx.Provider>
  )
}

export { useHeaderFit }
