import React, { useEffect } from 'react'
import { AppProvider, useAppContext } from './context/AppContext'
import { MainLayout } from './components/layout/MainLayout'
import { ApiInterceptView } from './views/ApiInterceptView'
import { ApiIntercept2027 } from './views/api-intercept-2027/ApiIntercept2027'
import { ModelScanningView } from './views/ModelScanningView'
import { ModelScanning2027 } from './views/model-scanning-2027/ModelScanning2027'
import { RedTeamingView } from './views/RedTeamingView'
import { ClaudeHooksView } from './views/ClaudeHooksView'
import { HomeViewV2 } from './views/HomeViewV2'
import { HomeView2027 } from './views/home-2027/HomeView2027'
import { DesignSwitch } from './components/shared/DesignSwitch'
import { ObservabilityView } from './views/ObservabilityView'
import { DeveloperCornerView } from './views/DeveloperCornerView'
import { ReleaseNotesView } from './views/ReleaseNotesView'
import { McpSecurityView } from './views/McpSecurityView'
import { RagSecurityView } from './views/RagSecurityView'
import { LlmGatewayView } from './views/LlmGatewayView'
import { MinistryHealthView } from './views/MinistryHealthView'
import { BriutStandalone } from './views/moh/BriutApp'

// The portal has no router, so the chrome-free citizen app is selected by
// query string instead: /?app=briut. Keeping the path at "/" means nothing
// changes for the Vite dev server or the Express static build.
const STANDALONE_APP = new URLSearchParams(window.location.search).get('app')

function AppContent() {
  const { state } = useAppContext()
  const isNew = state.uiMode === 'new'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.isDark)
    document.documentElement.classList.toggle('light', !state.isDark)
  }, [state.isDark])

  // The theme layer (src/styles/ui-new.css) keys off this class, so every
  // pillar that has not been rebuilt natively still takes the new design.
  useEffect(() => {
    document.documentElement.classList.toggle('ui-new', isNew)
  }, [isNew])

  // One Design switch decides every surface that exists in two versions.
  // Elements, not components defined here: a component created inside this
  // function would get a new identity every render and remount the console —
  // wiping its transcript on any context change, even an AIRS toggle.
  const intercept = isNew ? <ApiIntercept2027 /> : <ApiInterceptView />
  const modelScanning = isNew ? <ModelScanning2027 /> : <ModelScanningView />

  // Must come before every other branch: this window has no sidebar, no
  // top bar and no MainLayout at all.
  if (STANDALONE_APP === 'briut') return <BriutStandalone />

  if (state.activeView === 'home') {
    return isNew ? <HomeView2027 homeSwitch={<DesignSwitch />} /> : <HomeViewV2 homeSwitch={<DesignSwitch />} />
  }
  if (state.activeView === 'releaseNotes') return <ReleaseNotesView />

  const renderView = () => {
    switch (state.activeView) {
      case 'apiIntercept':   return intercept
      case 'modelScanning':  return modelScanning
      case 'redTeaming':     return <RedTeamingView />
      case 'claudeHooks':    return <ClaudeHooksView />
      case 'observability':     return <ObservabilityView />
      case 'developerCorner':  return <DeveloperCornerView />
      case 'mcpSecurity':      return <McpSecurityView />
      case 'ragSecurity':      return <RagSecurityView />
      case 'llmGateway':       return <LlmGatewayView />
      case 'ministryHealth':   return <MinistryHealthView />
      default:                 return intercept
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
