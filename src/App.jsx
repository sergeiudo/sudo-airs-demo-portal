import React, { useEffect } from 'react'
import { AppProvider, useAppContext } from './context/AppContext'
import { MainLayout } from './components/layout/MainLayout'
import { ApiIntercept2027 } from './views/api-intercept-2027/ApiIntercept2027'
import { RuntimeLaunch } from './views/runtime-launch/RuntimeLaunch'
import { ModelScanning2027 } from './views/model-scanning-2027/ModelScanning2027'
import { SupplyChainLaunch } from './views/supply-chain-launch/SupplyChainLaunch'
import { RedTeamLaunch } from './views/red-team-launch/RedTeamLaunch'
import { ClaudeHooksView } from './views/ClaudeHooksView'
import { HomeView2027 } from './views/home-2027/HomeView2027'
import { HomeLauncher } from './views/home-2027/HomeLauncher'
import { TelemetryLaunch } from './views/telemetry-launch/TelemetryLaunch'
import { DeveloperCorner } from './views/developer-corner/DeveloperCorner'
import { ReleaseNotesLaunch } from './views/release-notes-launch/ReleaseNotesLaunch'
import { AskAirsDrawer } from './components/shared/askairs/AskAirs'
import { McpSecurityView } from './views/McpSecurityView'
import { RagSecurityView } from './views/RagSecurityView'
import { LlmGatewayView } from './views/LlmGatewayView'
import { MinistryHealthView } from './views/MinistryHealthView'
import { BriutStandalone } from './views/moh/BriutApp'
import { EnterpriseAccess } from './views/enterprise-access/EnterpriseAccess'

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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.isDark)
    document.documentElement.classList.toggle('light', !state.isDark)
  }, [state.isDark])

  // The theme layer (src/styles/ui-new.css) keys off this class, so every
  // pillar that has not been rebuilt natively still takes the design. Since
  // the Classic design was retired (2026-10-08) it is always on.
  useEffect(() => { document.documentElement.classList.add('ui-new') }, [])

  // Elements, not components defined here: a component created inside this
  // function would get a new identity every render and remount the console —
  // wiping its transcript on any context change, even an AIRS toggle.
  const intercept = RUNTIME_V1 ? <ApiIntercept2027 /> : <RuntimeLaunch />
  const modelScanning = SCAN_V1 ? <ModelScanning2027 /> : <SupplyChainLaunch />
  const redTeaming = <RedTeamLaunch />
  const developerCorner = <DeveloperCorner />
  const observability = <TelemetryLaunch />

  // Must come before every other branch: this window has no sidebar, no
  // top bar and no MainLayout at all.
  if (STANDALONE_APP === 'briut') return <BriutStandalone />

  if (state.activeView === 'home') return HOME_HERO ? <HomeView2027 /> : <HomeLauncher />
  if (state.activeView === 'releaseNotes') return <ReleaseNotesLaunch />

  const renderView = () => {
    switch (state.activeView) {
      case 'apiIntercept':   return intercept
      case 'modelScanning':  return modelScanning
      case 'redTeaming':     return redTeaming
      case 'claudeHooks':    return <ClaudeHooksView />
      case 'observability':    return observability
      case 'developerCorner':  return developerCorner
      case 'mcpSecurity':      return <McpSecurityView />
      case 'ragSecurity':      return <RagSecurityView />
      case 'llmGateway':       return <LlmGatewayView />
      case 'ministryHealth':   return <MinistryHealthView />
      case 'enterpriseAccess': return <EnterpriseAccess />
      default:                 return intercept
    }
  }

  // Views that render their own unified header (PillarHeader). Add a pillar
  // here when its launch-design console lands.
  const unifiedHeader = (
    (state.activeView === 'apiIntercept' && !RUNTIME_V1) ||
    (state.activeView === 'modelScanning' && !SCAN_V1) ||
    state.activeView === 'redTeaming' ||
    state.activeView === 'enterpriseAccess' ||
    state.activeView === 'developerCorner' ||
    state.activeView === 'observability'
  )

  return (
    <MainLayout viewKey={state.activeView} hideTopBar={unifiedHeader}>
      {renderView()}
    </MainLayout>
  )
}

// Ask AIRS — the sidekick drawer, once for the whole portal (home and release
// notes render outside MainLayout, so it cannot live there).

export default function App() {
  return (
    <AppProvider>
      <AppContent />
      <AskAirsDrawer />
    </AppProvider>
  )
}
