import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Shield, ShieldCheck, Search, Sun, Moon, FileText, Play } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { tokens, FONT, label as LBL } from '../api-intercept-2027/tokens'
import airsLogo from '../../../prisma-AIRS_RGB_logo_Lockup_Negative.png'
import { HOME_PILLARS, RUN_OF_SHOW, DEEP_DIVES, OPERATE, readLastOpened, markOpened } from './homeData'
import { ReadinessPill } from './Preflight'
import { DetailsSheet, CommandPalette } from './overlays'
import { LauncherTile, LauncherRow } from './LauncherTile'

/**
 * HomeLauncher — the New home as an app launcher.
 *
 * The earlier New home (HomeView2027, still reachable at ?home=hero) was built
 * like a public landing page: a marketing headline, CTA pills, a social-proof
 * number, a news ticker, and the pillars below the fold. Here the pillars ARE
 * the page and the whole thing fits the first screen:
 *
 *   • an app bar — search, readiness, design switch, theme;
 *   • a short intro — what Prisma AIRS is, what this portal shows — beside
 *     the author credit, then the run-of-show hint;
 *   • five large tiles, 01–05, each with a coloured band in its pillar's hue;
 *   • the deep dives and tools as a compact row underneath.
 *
 * What's new is carried by the tiles themselves (a count on the band, the NEW
 * lines in the body) rather than a scrolling strip. Live numbers are left to
 * LLM Telemetry. Classic (HomeViewV2) is kept beside it via the Design switch.
 */

function IconButton({ t, label, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
            className="grid place-items-center rounded-full transition-colors flex-shrink-0"
            style={{ width: 38, height: 38, color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
      {children}
    </button>
  )
}

export function HomeLauncher({ homeSwitch }) {
  const { state, dispatch } = useAppContext()
  const base = useMemo(() => tokens(state.isDark === false), [state.isDark])
  // Secondary text sits on the grey ground here, where the console's inkDim
  // measures ~4.4:1 in light mode — a darker dim for this page only.
  const t = useMemo(() => (base.isLight ? { ...base, inkDim: '#55555D' } : base), [base])
  const [sheet, setSheet] = useState(null)
  const [palette, setPalette] = useState(false)
  const [lastOpened] = useState(readLastOpened)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  const kbd = isMac ? '⌘K' : 'Ctrl K'

  const launch = useCallback((id) => {
    markOpened(id)
    dispatch({ type: 'SET_VIEW', payload: id })
  }, [dispatch])
  const closeSheet = useCallback(() => setSheet(null), [])
  const closePalette = useCallback(() => setPalette(false), [])

  // ⌘K / Ctrl+K anywhere; "/" when not typing.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p) }
      else if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName ?? '')) { e.preventDefault(); setPalette(true) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // globals.css locks #root; on a short screen the page scrolls.
  useEffect(() => {
    const root = document.getElementById('root')
    const prev = root?.style.overflow || ''
    if (root) root.style.overflow = 'auto'
    return () => { if (root) root.style.overflow = prev }
  }, [])

  const actions = useMemo(() => [
    { id: 'start', label: 'Start the demo — step 1', icon: Play, run: () => launch(RUN_OF_SHOW[0].id) },
    { id: 'theme', label: state.isDark ? 'Switch to light theme' : 'Switch to dark theme', icon: state.isDark ? Sun : Moon, run: () => dispatch({ type: 'TOGGLE_THEME' }) },
    { id: 'notes', label: 'Prisma AIRS release notes', icon: FileText, run: () => dispatch({ type: 'SET_VIEW', payload: 'releaseNotes' }) },
  ], [launch, dispatch, state.isDark])

  const sheetPillar = HOME_PILLARS.find((p) => p.id === sheet) ?? null

  return (
    <div className="relative min-h-screen w-full flex flex-col" style={{ background: t.ground, overflowX: 'hidden' }}>
      <a href="#run-of-show" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:px-3 focus:py-2 focus:rounded-lg"
         style={{ background: t.panel, color: t.ink }}>Skip to the pillars</a>

      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
        backgroundSize: '44px 44px',
      }} />

      {/* ── app bar ── */}
      <header className="relative z-30 flex-shrink-0" style={{ borderBottom: `1px solid ${t.hairline}` }}>
        <div className="mx-auto flex items-center gap-4 px-6 lg:px-10" style={{ maxWidth: 1560, height: 62 }}>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <span className="grid place-items-center rounded-xl" style={{ width: 36, height: 36, background: `${t.pass}18`, border: `1px solid ${t.pass}40` }}>
              <Shield size={18} style={{ color: t.pass }} aria-hidden="true" />
            </span>
            <div className="leading-none">
              <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink }}>SUDO AIRS Demo</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim, marginTop: 3 }}>Prisma AIRS · demo portal</div>
            </div>
          </div>

          <button type="button" onClick={() => setPalette(true)}
                  className="hidden md:flex items-center gap-2.5 mx-auto rounded-full px-4 transition-colors"
                  style={{ height: 40, flex: '0 1 420px', minWidth: 160, background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm, color: t.inkDim }}
                  aria-label="Jump to a pillar">
            <Search size={15} className="flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 min-w-0 truncate text-left" style={{ fontFamily: FONT.prose, fontSize: 13.5 }}>Jump to a pillar…</span>
            <kbd style={{ fontFamily: FONT.mono, fontSize: 11, border: `1px solid ${t.hairline}`, borderRadius: 6, padding: '1px 6px' }}>{kbd}</kbd>
          </button>

          <div className="ml-auto md:ml-0 flex items-center gap-2 flex-shrink-0">
            <ReadinessPill t={t} />
            {homeSwitch}
            <IconButton t={t} label="Prisma AIRS release notes" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'releaseNotes' })}>
              <FileText size={15} />
            </IconButton>
            <IconButton t={t} label={state.isDark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => dispatch({ type: 'TOGGLE_THEME' })}>
              {state.isDark ? <Sun size={15} /> : <Moon size={15} />}
            </IconButton>
            {/* The lockup is white — on the light ground it needs a dark plate. */}
            <span className="hidden xl:inline-flex items-center rounded-xl px-3" style={{ height: 38, background: t.isLight ? '#1f2430' : 'transparent' }}>
              <img src={airsLogo} alt="Prisma AIRS" style={{ height: 22 }} />
            </span>
          </div>
        </div>
      </header>

      {/* The block centres itself in spare height (a 1080p projector) rather
          than leaving the bottom of the screen empty. */}
      <main className="relative mx-auto w-full flex-1 flex flex-col justify-center px-6 lg:px-10 py-6" style={{ maxWidth: 1560 }}>
        {/* ── intro — a short brief, deliberately small: the tiles stay the
            page. The author credit sits beside it, the one place Palo Alto
            Networks orange appears. ── */}
        <section aria-labelledby="intro-title" className="grid gap-6 items-center lg:grid-cols-[1fr_auto] mb-7">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1"
                  style={{ ...LBL, fontSize: 10.5, color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
              <span className="rounded-full" style={{ width: 7, height: 7, background: t.pass }} aria-hidden="true" />
              Prisma AIRS · live demo portal
            </span>
            <h1 id="intro-title" style={{
              fontFamily: FONT.display, fontWeight: 700, letterSpacing: '-0.025em', color: t.ink,
              fontSize: 'clamp(28px, 2.5vw, 40px)', lineHeight: 1.1, marginTop: 12, textWrap: 'balance',
            }}>
              Real AI attacks, live models — <span className="whitespace-nowrap" style={{ color: t.block }}>stopped by Prisma AIRS.</span>
            </h1>
            <p style={{ fontFamily: FONT.prose, fontSize: 15, lineHeight: 1.6, color: t.inkDim, marginTop: 10, maxWidth: 860 }}>
              Prisma AIRS is Palo Alto Networks’ platform for securing AI — apps, agents, models and data. It scans models before
              they load, red-teams them before release, and inspects every prompt, response and tool call at runtime. This portal
              fires real attacks at live models on AWS Bedrock, Google Vertex AI, Azure OpenAI and the SCM AI Gateway.
            </p>
            <ul className="flex flex-wrap gap-2 mt-3.5" aria-label="What this portal demonstrates">
              {['Runtime security', 'AI Gateway', 'Model & skill scanning', 'Red teaming', 'Agent & MCP security'].map((c) => (
                <li key={c} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
                    style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink, background: t.panel, border: `1px solid ${t.hairline}` }}>
                  <ShieldCheck size={13} style={{ color: t.pass }} aria-hidden="true" /> {c}
                </li>
              ))}
            </ul>
          </div>

          <div className="inline-flex items-center gap-4 self-center justify-self-start lg:justify-self-end rounded-full"
               style={{ padding: '8px 26px 8px 8px', background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadow }}>
            <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
                  style={{
                    width: 54, height: 54, background: 'linear-gradient(145deg, #FA582D 0%, #D9401A 100%)',
                    boxShadow: '0 6px 18px rgba(250,88,45,0.35)', fontFamily: FONT.display, fontSize: 19, fontWeight: 700, color: '#fff',
                  }}>
              SU
            </span>
            <span className="flex flex-col leading-tight">
              <span style={{ ...LBL, fontSize: 10, color: t.inkDim }}>Built by</span>
              <span style={{ fontFamily: FONT.display, fontSize: 19, fontWeight: 700, color: t.ink, marginTop: 2 }}>Sergei (SUDO) Udovenko</span>
              <span style={{ fontFamily: FONT.prose, fontSize: 13, color: t.inkDim, marginTop: 2 }}>Systems Engineer · Palo Alto Networks</span>
            </span>
          </div>
        </section>

        {/* ── the run of show heading ── */}
        <div className="flex items-baseline gap-3 flex-wrap mb-4">
          <h2 id="run-of-show" style={{ fontFamily: FONT.display, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: t.ink }}>Run of show</h2>
          <p style={{ fontFamily: FONT.prose, fontSize: 13, color: t.inkDim }}>
            Start at 01 and follow the numbers. Click a tile for its story, or press{' '}
            <kbd style={{ fontFamily: FONT.mono, fontSize: 11, border: `1px solid ${t.hairline}`, borderRadius: 5, padding: '0 5px' }}>/</kbd>{' '}
            to jump anywhere.
          </p>
        </div>

        {/* ── the run of show ── */}
        <section aria-labelledby="run-of-show" className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
                 style={{ gridAutoRows: 'minmax(clamp(400px, 46vh, 580px), auto)' }}>
          {RUN_OF_SHOW.map((p, i) => (
            <LauncherTile key={p.id} t={t} pillar={p} index={i} onOpen={setSheet} onLaunch={launch} lastOpened={lastOpened[p.id]} />
          ))}
        </section>

        {/* ── go deeper ── */}
        <section aria-label="Deep dives and tools" className="mt-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <h2 className="hidden xl:block xl:col-span-3 -mb-2" style={{ ...LBL, fontSize: 10, color: t.inkDim }}>Deep dives</h2>
            <h2 className="hidden xl:block xl:col-span-2 -mb-2" style={{ ...LBL, fontSize: 10, color: t.inkDim }}>Operate &amp; integrate</h2>
            {[...DEEP_DIVES, ...OPERATE].map((p, i) => (
              <LauncherRow key={p.id} t={t} pillar={p} index={i} onOpen={setSheet} onLaunch={launch} lastOpened={lastOpened[p.id]} />
            ))}
          </div>
        </section>
      </main>

      <DetailsSheet t={t} pillar={sheetPillar} onClose={closeSheet} onLaunch={launch} />
      <CommandPalette t={t} open={palette} onClose={closePalette} pillars={HOME_PILLARS} onLaunch={launch} actions={actions} />
    </div>
  )
}
