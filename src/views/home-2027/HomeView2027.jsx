import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Shield, Search, Sun, Moon, FileText, ArrowRight, Play } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { tokens, FONT, label as LBL } from '../api-intercept-2027/tokens'
import airsLogo from '../../../prisma-AIRS_RGB_logo_Lockup_Negative.png'
import { HOME_PILLARS, RUN_OF_SHOW, DEEP_DIVES, OPERATE, WHATS_NEW, PAYLOADS, MOH_SCENARIOS, readLastOpened, markOpened } from './homeData'
import { PillarTile } from './PillarTile'
import { Preflight } from './Preflight'
import { DetailsSheet, CommandPalette } from './overlays'
import { WhatsNew } from './WhatsNew'

/**
 * HomeView2027 — the portal's front door, rebuilt for ten pillars.
 *
 * The old home gave ten pillars equal weight: ten cards, each carrying its
 * full paragraph and bullet list, in two rows of five — a wall of text with no
 * entry point, and a "Launch" button that opened a modal. This one is built
 * around what a presenter actually does on it:
 *
 *   • start the demo  — one button, pillar 1;
 *   • follow the run of show — the running order is explicit (01–05) and the
 *     main demo is the one large tile, a bento grid rather than equal cards;
 *   • jump anywhere — ⌘K / Ctrl+K / "/", because typing "moh" beats scanning;
 *   • check readiness — a pre-flight card from config-only /api/health;
 *   • see what changed — every NEW highlight in one strip.
 *
 * Detail is one level down (a side sheet), never on the grid. Same token set
 * as the runtime console, so the front door looks like the rooms behind it.
 * Classic (HomeViewV2) is kept beside it; the global Design switch (Classic | New) picks one.
 */

function IconButton({ t, label, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
            className="grid place-items-center rounded-full transition-colors"
            style={{ width: 38, height: 38, color: t.inkDim, background: t.sunken, border: `1px solid ${t.hairline}` }}>
      {children}
    </button>
  )
}

function SectionHead({ t, id, title, sub, right }) {
  return (
    <div className="flex items-end gap-4 mb-4">
      <div className="min-w-0">
        <h2 id={id} style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-0.01em', color: t.ink }}>{title}</h2>
        {sub && <p style={{ fontFamily: FONT.prose, fontSize: 13.5, color: t.inkDim, marginTop: 2 }}>{sub}</p>}
      </div>
      {right && <div className="ml-auto flex-shrink-0">{right}</div>}
    </div>
  )
}

export function HomeView2027({ homeSwitch }) {
  const { state, dispatch } = useAppContext()
  const base = useMemo(() => tokens(state.isDark === false), [state.isDark])
  // Secondary text sits directly on the grey ground here, where the console's
  // inkDim measures ~4.4:1 in light mode — just under WCAG AA. A darker dim
  // for this page only; panels keep the shared token.
  const t = useMemo(() => (base.isLight ? { ...base, inkDim: '#55555D' } : base), [base])
  const reduce = useReducedMotion()
  const [sheet, setSheet] = useState(null)
  const [palette, setPalette] = useState(false)
  const [lastOpened] = useState(readLastOpened)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

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

  // globals.css locks #root; the home page scrolls.
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
  const kbd = isMac ? '⌘K' : 'Ctrl K'

  return (
    <div className="relative min-h-screen w-full" style={{ background: t.ground, overflowX: 'hidden' }}>
      <a href="#run-of-show" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:px-3 focus:py-2 focus:rounded-lg"
         style={{ background: t.panel, color: t.ink }}>Skip to the pillars</a>

      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
        backgroundSize: '44px 44px',
      }} />

      {/* ── top bar ── */}
      <header className="sticky top-0 z-30" style={{ background: t.isLight ? 'rgba(233,233,235,0.82)' : 'rgba(21,21,23,0.82)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${t.hairline}` }}>
        <div className="mx-auto flex items-center gap-4 px-6 lg:px-10" style={{ maxWidth: 1480, height: 64 }}>
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
                  style={{ height: 40, width: 'min(420px, 38vw)', background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSm, color: t.inkDim }}
                  aria-label="Jump to a pillar">
            <Search size={15} aria-hidden="true" />
            <span className="flex-1 text-left" style={{ fontFamily: FONT.prose, fontSize: 13.5 }}>Jump to a pillar…</span>
            <kbd style={{ fontFamily: FONT.mono, fontSize: 11, border: `1px solid ${t.hairline}`, borderRadius: 6, padding: '1px 6px' }}>{kbd}</kbd>
          </button>

          <div className="ml-auto md:ml-0 flex items-center gap-2 flex-shrink-0">
            {homeSwitch}
            <button type="button" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'releaseNotes' })}
                    className="hidden sm:inline-flex items-center gap-2 rounded-full px-3.5"
                    style={{ height: 38, fontFamily: FONT.prose, fontSize: 13, fontWeight: 600, color: t.ink, background: t.panel, border: `1px solid ${t.hairline}` }}>
              <FileText size={14} aria-hidden="true" /> Release notes
            </button>
            <IconButton t={t} label={state.isDark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => dispatch({ type: 'TOGGLE_THEME' })}>
              {state.isDark ? <Sun size={15} /> : <Moon size={15} />}
            </IconButton>
            {/* The lockup is white — on the light ground it needs a dark plate. */}
            <span className="hidden lg:inline-flex items-center rounded-xl px-3" style={{ height: 38, background: t.isLight ? '#1f2430' : 'transparent' }}>
              <img src={airsLogo} alt="Prisma AIRS" style={{ height: 22 }} />
            </span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto px-6 lg:px-10 pb-16" style={{ maxWidth: 1480 }}>
        {/* ── hero ── */}
        <section className="grid gap-6 pt-10 lg:grid-cols-[1.3fr_1fr]" aria-labelledby="hero-title">
          <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                      className="flex flex-col justify-center py-2">
            <span className="inline-flex items-center gap-2 self-start rounded-full px-3 py-1"
                  style={{ ...LBL, fontSize: 10.5, color: t.inkDim, background: t.panel, border: `1px solid ${t.hairline}` }}>
              <span className="rounded-full" style={{ width: 7, height: 7, background: t.pass }} aria-hidden="true" />
              Prisma AIRS · live demo portal
            </span>
            <h1 id="hero-title" style={{ fontFamily: FONT.display, fontWeight: 700, letterSpacing: '-0.03em', color: t.ink, fontSize: 'clamp(34px, 3.6vw, 52px)', lineHeight: 1.04, marginTop: 18 }}>
              Real AI attacks, live models —<br />
              <span style={{ color: t.block }}>stopped by Prisma AIRS.</span>
            </h1>
            <p style={{ fontFamily: FONT.prose, fontSize: 16, lineHeight: 1.6, color: t.inkDim, marginTop: 16, maxWidth: 640 }}>
              Ten pillars across the AI attack surface — runtime and gateway enforcement, the AI supply chain, red teaming,
              agents and MCP — against live models on AWS Bedrock, Google Vertex AI, Azure OpenAI and the SCM AI Gateway.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-7">
              <button type="button" onClick={() => launch(RUN_OF_SHOW[0].id)}
                      className="inline-flex items-center gap-2 rounded-full px-6 transition-transform active:scale-[0.98]"
                      style={{ height: 48, fontFamily: FONT.prose, fontSize: 15, fontWeight: 700, color: t.panel, background: t.ink, boxShadow: t.shadowSm }}>
                <Play size={15} aria-hidden="true" /> Start the demo
              </button>
              <button type="button" onClick={() => setPalette(true)}
                      className="inline-flex items-center gap-2 rounded-full px-5"
                      style={{ height: 48, fontFamily: FONT.prose, fontSize: 15, fontWeight: 600, color: t.ink, background: t.panel, border: `1px solid ${t.hairline}` }}>
                <Search size={15} aria-hidden="true" /> Jump to a pillar
                <kbd style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim, border: `1px solid ${t.hairline}`, borderRadius: 6, padding: '1px 6px' }}>{kbd}</kbd>
              </button>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-9">
              {[[HOME_PILLARS.length, 'pillars'], [PAYLOADS, 'attack payloads'], [4, 'live targets'], [MOH_SCENARIOS, 'MOH scenarios']].map(([v, k]) => (
                <div key={k}>
                  <dt className="sr-only">{k}</dt>
                  <dd style={{ fontFamily: FONT.display, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: t.ink, lineHeight: 1 }}>{v}</dd>
                  <dd style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim, marginTop: 5 }} aria-hidden="true">{k}</dd>
                </div>
              ))}
            </dl>
            {/* The author credit — a card, not a footnote. The initials badge
                carries Palo Alto Networks orange, the one place that colour
                appears on the page. */}
            <div className="inline-flex items-center gap-4 self-start mt-8 rounded-full"
                 style={{ padding: '8px 26px 8px 8px', background: t.panel, border: `1px solid ${t.hairline}`, boxShadow: t.shadow }}>
              <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
                    style={{
                      width: 56, height: 56,
                      background: 'linear-gradient(145deg, #FA582D 0%, #D9401A 100%)',
                      boxShadow: '0 6px 18px rgba(250,88,45,0.35)',
                      fontFamily: FONT.display, fontSize: 19, fontWeight: 700, color: '#fff', letterSpacing: '0.02em',
                    }}>
                SU
              </span>
              <span className="flex flex-col">
                <span style={{ ...LBL, fontSize: 10.5, color: t.inkDim }}>Built by</span>
                <span style={{ fontFamily: FONT.display, fontSize: 21, fontWeight: 700, letterSpacing: '-0.01em', color: t.ink, lineHeight: 1.15, marginTop: 2 }}>
                  Sergei (SUDO) Udovenko
                </span>
                <span style={{ fontFamily: FONT.prose, fontSize: 14, color: t.inkDim, marginTop: 2 }}>
                  Systems Engineer · Palo Alto Networks
                </span>
              </span>
            </div>
          </motion.div>

          <Preflight t={t} />
        </section>

        {/* ── what's new ── */}
        <WhatsNew t={t} items={WHATS_NEW} onOpen={setSheet} />

        {/* ── run of show ── */}
        <section className="mt-10" aria-labelledby="run-of-show">
          <SectionHead t={t} id="run-of-show" title="The demo, in running order"
                       sub="Start at 01 and follow the numbers — or launch any step directly."
                       right={<span className="hidden md:inline" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>Click a tile for the full story</span>} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" style={{ gridAutoRows: 'minmax(230px, auto)' }}>
            {RUN_OF_SHOW.map((p, i) => (
              <PillarTile key={p.id} t={t} pillar={p} index={i} variant={p.run === 1 ? 'featured' : 'tile'}
                          onOpen={setSheet} onLaunch={launch} lastOpened={lastOpened[p.id]} />
            ))}
          </div>
        </section>

        {/* ── go deeper ── */}
        <section className="mt-12" aria-labelledby="go-deeper">
          <SectionHead t={t} id="go-deeper" title="Go deeper"
                       sub="Focused deep dives on one attack surface, and the tools around the demo." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <p className="hidden xl:block xl:col-span-3" style={{ ...LBL, fontSize: 10.5, color: t.inkDim }}>Runtime deep dives</p>
            <p className="hidden xl:block xl:col-span-2" style={{ ...LBL, fontSize: 10.5, color: t.inkDim }}>Operate &amp; integrate</p>
            {[...DEEP_DIVES, ...OPERATE].map((p, i) => (
              <PillarTile key={p.id} t={t} pillar={p} index={i + 5} variant="compact"
                          onOpen={setSheet} onLaunch={launch} lastOpened={lastOpened[p.id]} />
            ))}
          </div>
        </section>

        <footer className="mt-14 flex flex-wrap items-center gap-3" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>
          <Shield size={12} aria-hidden="true" />
          <span>Palo Alto Networks · Prisma AIRS demo portal</span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            Press <kbd style={{ fontFamily: FONT.mono, fontSize: 11, border: `1px solid ${t.hairline}`, borderRadius: 6, padding: '0 5px' }}>/</kbd> anywhere to jump
            <ArrowRight size={12} aria-hidden="true" />
          </span>
        </footer>
      </main>

      <DetailsSheet t={t} pillar={sheetPillar} onClose={closeSheet} onLaunch={launch} />
      <CommandPalette t={t} open={palette} onClose={closePalette} pillars={HOME_PILLARS} onLaunch={launch} actions={actions} />
    </div>
  )
}
