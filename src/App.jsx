import React, { useEffect } from 'react'
import { AppProvider, useAppContext } from './context/AppContext'
import { MainLayout } from './components/layout/MainLayout'
import { ApiInterceptView } from './views/ApiInterceptView'
import { ApiIntercept2027 } from './views/api-intercept-2027/ApiIntercept2027'
import { RuntimeLaunch } from './views/runtime-launch/RuntimeLaunch'
import { ModelScanningView } from './views/ModelScanningView'
import { ModelScanning2027 } from './views/model-scanning-2027/ModelScanning2027'
import { SupplyChainLaunch } from './views/supply-chain-launch/SupplyChainLaunch'
import { RedTeamingView } from './views/RedTeamingView'
import { ClaudeHooksView } from './views/ClaudeHooksView'
import { HomeViewV2 } from './views/HomeViewV2'
import { HomeView2027 } from './views/home-2027/HomeView2027'
import { HomeLauncher } from './views/home-2027/HomeLauncher'
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
// The New home is the launcher; the earlier landing-page version stays
// reachable at /?home=hero so the two can be compared.
const HOME_HERO = new URLSearchParams(window.location.search).get('home') === 'hero'
// Same for the runtime console: the launcher-style one by default, the
// previous New console at /?runtime=v1.
const RUNTIME_V1 = new URLSearchParams(window.location.search).get('runtime') === 'v1'
// And the AI Supply Chain console: launch design by default, the previous New
// console at /?scan=v1.
const SCAN_V1 = new URLSearchParams(window.location.search).get('scan') === 'v1'

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
  const intercept = !isNew ? <ApiInterceptView /> : RUNTIME_V1 ? <ApiIntercept2027 /> : <RuntimeLaunch />
  const modelScanning = !isNew ? <ModelScanningView /> : SCAN_V1 ? <ModelScanning2027 /> : <SupplyChainLaunch />

  // Must come before every other branch: this window has no sidebar, no
  // top bar and no MainLayout at all.
  if (STANDALONE_APP === 'briut') return <BriutStandalone />

  if (state.activeView === 'home') {
    if (!isNew) return <HomeViewV2 homeSwitch={<DesignSwitch />} />
    return HOME_HERO ? <HomeView2027 homeSwitch={<DesignSwitch />} /> : <HomeLauncher homeSwitch={<DesignSwitch />} />
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

  // Views that render their own unified header (PillarHeader) in the New
  // design. Add a pillar here when its launch-design console lands.
  const unifiedHeader = isNew && (
    (state.activeView === 'apiIntercept' && !RUNTIME_V1) ||
    (state.activeView === 'modelScanning' && !SCAN_V1)
  )

  return (
    <MainLayout viewKey={state.activeView} hideTopBar={unifiedHeader}>
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
