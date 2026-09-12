import React, { createContext, useContext, useReducer, useEffect } from 'react'

const AppContext = createContext(null)

const initialState = {
  isProtected: false,
  activeView: 'home',
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
