import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppContext } from '../../context/AppContext'
import { tokens, glass } from '../api-intercept-2027/tokens'
import { Handle } from '../api-intercept-2027/PaneHandle'
import { HOME_PILLARS } from '../home-2027/homeData'
import { PillarHeader } from '../../components/layout/PillarHeader'
import { useRedTeamSession } from './useRedTeamSession'
import { CampaignActions } from './CampaignActions'
import { LaunchCampaignRail } from './LaunchCampaignRail'
import { CampaignStream } from './CampaignStream'
import { CampaignEvidence } from './CampaignEvidence'
import { CampaignReportDrawer } from './CampaignReportDrawer'
import { LaunchRedTeamArchitecture } from './LaunchRedTeamArchitecture'

/**
 * RedTeamLaunch — Red Teaming in the launch design.
 *
 * Same shape as the other launch consoles: the pillar's orange band is the
 * one header (PillarHeader, with CampaignActions), then three panes with
 * draggable edges — the campaign rail (build · history), the campaign itself
 * (architecture when empty, live progress and the attack feed once open), and
 * the evidence pane (verdict, weak spots, red team → runtime) — and the
 * campaign report drawer for everything else.
 *
 * Classic (RedTeamingView) is untouched and stays behind the Design switch.
 */

export function RedTeamLaunch() {
  const { state, dispatch } = useAppContext()
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const tone = HOME_PILLARS.find((p) => p.id === 'redTeaming').accent
  const s = useRedTeamSession()

  const [leftW, setLeftW] = useState(344)
  const [rightW, setRightW] = useState(372)
  const [dragL, setDragL] = useState(false)
  const [dragR, setDragR] = useState(false)

  // Where the report drawer is open: { tab, sub?, attack?, goal?, n } | null.
  const [report, setReport] = useState(null)
  const openReport = useCallback((o) => setReport({ ...o, n: Date.now() }), [])
  const closeReport = useCallback(() => setReport(null), [])
  useEffect(() => { setReport(null) }, [s.campaignId])
  const launchRuntime = useCallback(() => { setReport(null); dispatch({ type: 'SET_VIEW', payload: 'apiIntercept' }) }, [dispatch])

  return (
    <div className="relative flex flex-col h-full overflow-hidden"
         style={{ background: t.ground, cursor: dragL || dragR ? 'col-resize' : 'default', userSelect: dragL || dragR ? 'none' : 'auto' }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
        backgroundSize: '44px 44px',
      }} />
      {/* The sweep runs while a campaign is in flight — powered-on, not decorated. */}
      {s.running && (
        <motion.div className="absolute inset-y-0 pointer-events-none"
                    style={{ width: 260, background: `linear-gradient(90deg, transparent, ${t.live}12, transparent)` }}
                    animate={{ left: ['-20%', '110%'] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }} />
      )}

      <PillarHeader pillarId="redTeaming" actions={<CampaignActions t={t} tone={tone} s={s} />} />

      <div className="relative flex-1 min-h-0 flex">
        <div className="relative flex-shrink-0 overflow-hidden py-3 pl-3" style={{ width: leftW }}>
          <div className="h-full overflow-hidden" style={glass(t, { radius: 22 })}>
            <LaunchCampaignRail t={t} tone={tone} s={s} />
          </div>
        </div>
        <Handle t={t} side="left" dragging={dragL} onDrag={{ width: leftW, setWidth: setLeftW, setDragging: setDragL }} />

        <div className="relative flex-1 min-w-0 flex flex-col pt-1">
          <CampaignStream t={t} tone={tone} s={s}
                          empty={<LaunchRedTeamArchitecture t={t} tone={tone} target={s.target} jobType={s.jobType} />}
                          onOpenAttack={(a) => openReport({ tab: 'attacks', attack: a })}
                          onOpenGoal={(g) => openReport({ tab: 'goals', goal: g })} />
        </div>

        <Handle t={t} side="right" dragging={dragR} onDrag={{ width: rightW, setWidth: setRightW, setDragging: setDragR }} />
        <div className="relative flex-shrink-0 overflow-hidden py-3 pr-3" style={{ width: rightW }}>
          <CampaignEvidence t={t} tone={tone} s={s} onOpenReport={openReport} />
        </div>
      </div>

      <CampaignReportDrawer job={s.job} open={report} onClose={closeReport} onLaunchRuntime={launchRuntime} />
    </div>
  )
}
