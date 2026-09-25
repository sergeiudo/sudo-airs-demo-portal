import React, { useEffect, useState } from 'react'
import { AppProvider, useAppContext } from './context/AppContext'
import { MainLayout } from './components/layout/MainLayout'
import { ApiInterceptView } from './views/ApiInterceptView'
import { ApiIntercept2027 } from './views/api-intercept-2027/ApiIntercept2027'

// On the redesign branch the new console is the default; ?ui=legacy brings the
// current one back so the two can be compared without a rebuild.
const LEGACY_UI = new URLSearchParams(window.location.search).get('ui') === 'legacy'
const Intercept = () => (LEGACY_UI ? <ApiInterceptView /> : <ApiIntercept2027 />)
import { ModelScanningView } from './views/ModelScanningView'
import { ModelScanning2027 } from './views/model-scanning-2027/ModelScanning2027'
// Same switch for the model-scanning pillar: the redesign by default, the
// original view under ?ui=legacy.
const ModelScanning = () => (LEGACY_UI ? <ModelScanningView /> : <ModelScanning2027 />)
import { RedTeamingView } from './views/RedTeamingView'
import { ClaudeHooksView } from './views/ClaudeHooksView'
import { HomeView } from './views/HomeView'
import { HomeViewV2 } from './views/HomeViewV2'
import { HomeView2027 } from './views/home-2027/HomeView2027'
import { HomeSwitch } from './views/home-2027/HomeSwitch'

/**
 * Two homes, both kept: Classic (HomeViewV2) and New (HomeView2027), switched
 * from a pill on either page. The choice is remembered per browser; Classic is
 * the default for anyone who has not chosen. ?home=classic|new (or the older
 * ?home=v2) picks one for this link and remembers it.
 */
const HOME_KEY = 'sudo-airs.home.version'
function initialHome() {
  const q = new URLSearchParams(window.location.search).get('home')
  const fromUrl = q === 'new' || q === '2027' ? 'new' : q === 'classic' || q === 'v2' ? 'classic' : null
  if (fromUrl) {
    try { localStorage.setItem(HOME_KEY, fromUrl) } catch { /* private mode */ }
    return fromUrl
  }
  try { return localStorage.getItem(HOME_KEY) === 'new' ? 'new' : 'classic' } catch { return 'classic' }
}
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
  const [homeVersion, setHomeVersion] = useState(initialHome)
  const switchHome = (v) => {
    setHomeVersion(v)
    try { localStorage.setItem(HOME_KEY, v) } catch { /* private mode */ }
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.isDark)
    document.documentElement.classList.toggle('light', !state.isDark)
  }, [state.isDark])

  // Must come before every other branch: this window has no sidebar, no
  // top bar and no MainLayout at all.
  if (STANDALONE_APP === 'briut') return <BriutStandalone />

  if (state.activeView === 'home') {
    return (
      homeVersion === 'new'
        ? <HomeView2027 homeSwitch={<HomeSwitch value={homeVersion} onChange={switchHome} isDark={state.isDark} />} />
        : <HomeViewV2 homeSwitch={<HomeSwitch value={homeVersion} onChange={switchHome} isDark={state.isDark} />} />
    )
  }
  if (state.activeView === 'releaseNotes') return <ReleaseNotesView />

  const renderView = () => {
    switch (state.activeView) {
      case 'apiIntercept':   return <Intercept />
      case 'modelScanning':  return <ModelScanning />
      case 'redTeaming':     return <RedTeamingView />
      case 'claudeHooks':    return <ClaudeHooksView />
      case 'observability':     return <ObservabilityView />
      case 'developerCorner':  return <DeveloperCornerView />
      case 'mcpSecurity':      return <McpSecurityView />
      case 'ragSecurity':      return <RagSecurityView />
      case 'llmGateway':       return <LlmGatewayView />
      case 'ministryHealth':   return <MinistryHealthView />
      default:                 return <Intercept />
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
