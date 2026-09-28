import React, { createContext, useContext, useReducer, useEffect } from 'react'

const AppContext = createContext(null)

/**
 * Design mode — 'new' (the 2027 design system everywhere) or 'classic' (the
 * portal as it was). One switch for the whole portal: the home page, the two
 * rebuilt consoles, the shell, and the theme layer that restyles every other
 * pillar (src/styles/ui-new.css, active under html.ui-new).
 *
 * Remembered per browser. URL overrides, which also persist: ?ui=new|classic,
 * plus the older spellings ?ui=legacy and ?home=v2|classic|new so links that
 * were already shared keep working. A choice saved by the earlier home-only
 * switch is honoured.
 */
export const UI_KEY = 'sudo-airs.ui'
const LEGACY_HOME_KEY = 'sudo-airs.home.version'

function initialUiMode() {
  const q = new URLSearchParams(window.location.search)
  const ui = q.get('ui'), home = q.get('home')
  const fromUrl = ui === 'new' ? 'new'
    : ui === 'classic' || ui === 'legacy' ? 'classic'
    : home === 'new' || home === '2027' ? 'new'
    : home === 'classic' || home === 'v2' ? 'classic'
    : null
  try {
    if (fromUrl) { localStorage.setItem(UI_KEY, fromUrl); return fromUrl }
    const saved = localStorage.getItem(UI_KEY) ?? localStorage.getItem(LEGACY_HOME_KEY)
    if (saved === 'new' || saved === 'classic') return saved
  } catch { /* private mode */ }
  return 'new'
}

/**
 * /?view=<pillarId> opens that pillar instead of the home. The portal has no
 * router, so this is how a redirect lands inside a pillar — Entra's sign-in
 * callback returns to /?view=enterpriseAccess. The parameter is removed from
 * the address bar once read, so a refresh does not keep re-entering.
 */
function initialView() {
  try {
    const url = new URL(window.location.href)
    const v = url.searchParams.get('view')
    if (!v || !/^[A-Za-z]{3,40}$/.test(v)) return 'home'
    url.searchParams.delete('view')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    return v
  } catch {
    return 'home'
  }
}

const initialState = {
  uiMode: initialUiMode(),
  isProtected: false,
  activeView: initialView(),
  scmUrl: null,
  isDark: false,
  selectedTraceId: null,
}

function appReducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_PROTECTION':
      return { ...state, isProtected: !state.isProtected }
    // Explicit setter, not a conditional TOGGLE from a caller — two dispatches
    // in the same render (e.g. a backend switch during mount) would cancel out.
    case 'SET_PROTECTION':
      return { ...state, isProtected: !!action.payload }
    case 'SET_VIEW':
      return { ...state, activeView: action.payload }
    case 'SET_SCM_URL':
      return { ...state, scmUrl: action.payload }
    case 'TOGGLE_THEME':
      return { ...state, isDark: !state.isDark }
    case 'SET_UI_MODE':
      try { localStorage.setItem(UI_KEY, action.payload) } catch { /* private mode */ }
      return { ...state, uiMode: action.payload === 'classic' ? 'classic' : 'new' }
    case 'SET_SELECTED_TRACE':
      return { ...state, selectedTraceId: action.payload }
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Fire-and-forget activity log on every view change (except home)
  useEffect(() => {
    if (state.activeView === 'home') return
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        view: state.activeView,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen_res: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language,
      }),
    }).catch(() => {})
  }, [state.activeView])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
