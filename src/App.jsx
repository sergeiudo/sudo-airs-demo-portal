import React, { useEffect } from 'react'
import { AppProvider, useAppContext } from './context/AppContext'
import { MainLayout } from './components/layout/MainLayout'
import { ApiInterceptView } from './views/ApiInterceptView'
import { ModelScanningView } from './views/ModelScanningView'
import { RedTeamingView } from './views/RedTeamingView'
import { ClaudeHooksView } from './views/ClaudeHooksView'
import { HomeView } from './views/HomeView'
import { HomeViewV2 } from './views/HomeViewV2'
import { ObservabilityView } from './views/ObservabilityView'
import { DeveloperCornerView } from './views/DeveloperCornerView'
import { ReleaseNotesView } from './views/ReleaseNotesView'
import { McpSecurityView } from './views/McpSecurityView'

function AppContent() {
  const { state } = useAppContext()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.isDark)
    document.documentElement.classList.toggle('light', !state.isDark)
  }, [state.isDark])

  if (state.activeView === 'home') return <HomeViewV2 />
  if (state.activeView === 'releaseNotes') return <ReleaseNotesView />

  const renderView = () => {
    switch (state.activeView) {
      case 'apiIntercept':   return <ApiInterceptView />
      case 'modelScanning':  return <ModelScanningView />
      case 'redTeaming':     return <RedTeamingView />
      case 'claudeHooks':    return <ClaudeHooksView />
      case 'observability':     return <ObservabilityView />
      case 'developerCorner':  return <DeveloperCornerView />
      case 'mcpSecurity':      return <McpSecurityView />
      default:                 return <ApiInterceptView />
    }
  }

  return (
    <MainLayout viewKey={state.activeView}>
      {renderView()}
    </MainLayout>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
