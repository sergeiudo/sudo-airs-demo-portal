import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { tokens, glass, FONT } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { Handle } from '../api-intercept-2027/PaneHandle'
import { HOME_PILLARS } from '../home-2027/homeData'
import { PillarHeader } from '../../components/layout/PillarHeader'
import { useAccessSession } from './useAccessSession'
import { AccessActions } from './AccessActions'
import { AccessLanding } from './AccessLanding'
import { IdentityRail } from './IdentityRail'
import { RequestStream } from './RequestStream'
import { RequestEvidence } from './RequestEvidence'
import { LifecycleDrawer } from './LifecycleDrawer'
import { labelOf, minsLeft, short } from './accessModel'

/**
 * EnterpriseAccess — the Enterprise AI Access pillar: employees reach LLMs
 * through the SCM AI Gateway without an API key, and the model they get is
 * decided by who they are.
 *
 * Signed out, it is the standalone app's sign-in page in the launch design.
 * Signed in, it is a launch console: the identity rail (directory, credential,
 * policy, model, tamper tests), the requests, the evidence pane, and the
 * token lifecycle drawer holding every artifact the sign-in produced.
 *
 * A new pillar with no Classic predecessor: under the Classic design it keeps
 * this body and drops only the unified header, so MainLayout's TopBar shows.
 */

const DEFAULT_SYSTEM = 'You are a helpful, secure enterprise AI assistant.'

function Centered({ children }) {
  return <div className="flex-1 min-h-0 grid place-items-center p-6">{children}</div>
}

function LoadError({ t, message, onRetry }) {
  const ink = t.isLight ? shade(t.warn, 0.4) : t.warn
  const stale = /404/.test(message)
  return (
    <div className="max-w-md w-full p-5" style={glass(t, { radius: 22 })}>
      <div className="flex items-center gap-3">
        <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 40, height: 40, background: bandBg(t.warn) }}>
          <AlertTriangle size={18} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: t.ink }}>The pillar's API did not answer</div>
      </div>
      <p className="break-words" style={{ fontFamily: FONT.mono, fontSize: 11.5, color: ink, margin: '10px 0 0' }}>{message}</p>
      <p style={{ fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.inkDim, margin: '8px 0 0' }}>
        {stale ? 'These routes are new — restart Express (npm run dev locally, pm2 restart airs-server on EC2) so it loads access-routes.js.' : 'Check that Express is running and reachable through /api.'}
      </p>
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full px-3 mt-3"
              style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, background: t.sunken, border: `1px solid ${t.hairline}` }}>
        <RefreshCw size={13} aria-hidden="true" /> Try again
      </button>
    </div>
  )
}

export function EnterpriseAccess() {
  const { state } = useAppContext()
  const isNew = state.uiMode === 'new'
  const t = useMemo(() => tokens(state.isDark === false), [state.isDark])
  const tone = HOME_PILLARS.find((p) => p.id === 'enterpriseAccess').accent
  const a = useAccessSession()

  const [now, setNow] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(id) }, [])

  const [drawer, setDrawer] = useState(null)
  const openLifecycle = useCallback((step, callId) => setDrawer({ step: step ?? 'overview', callId: callId ?? null, n: Date.now() }), [])
  const closeLifecycle = useCallback(() => setDrawer(null), [])

  // Sonnet by default: the diagram's scenarios all ask for it, and for a
  // standard user it is the model the policy replaces — the demo in one click.
  const models = a.config?.models ?? []
  const [model, setModel] = useState(null)
  useEffect(() => {
    if (!model && models.length) setModel(models.find((m) => /sonnet/i.test(m.label))?.id ?? models[0].id)
  }, [models, model])
  const [system, setSystem] = useState(DEFAULT_SYSTEM)
  const [ctx, setCtx] = useState(10)

  const [leftW, setLeftW] = useState(344)
  const [rightW, setRightW] = useState(360)
  const [dragL, setDragL] = useState(false)
  const [dragR, setDragR] = useState(false)

  const s = a.session
  const signedIn = !!s?.signedIn
  const exp = s?.credential?.exp
  const expired = signedIn && !!exp && exp * 1000 <= now
  const policy = s?.policy

  const live = signedIn && model ? {
    key: 'you', tag: 'You', who: 'you', email: s.user.email, role: s.user.role,
    tenant: `tenant ${short(s.user.tenantId)}`, department: s.user.department,
    requested: model, requestedLabel: labelOf(models, model),
    winner: policy?.model ?? model, winnerLabel: labelOf(models, policy?.model ?? model), rule: policy,
  } : null

  const reqLabel = labelOf(models, model)
  const helper = expired ? 'Your credential has expired — it is not refreshed. Sign out and in again.'
    : !policy ? ''
    : policy.model && policy.model !== model ? `Asking for ${reqLabel} → the gateway will answer with ${labelOf(models, policy.model)} (rule ${policy.rule || 'default'})`
    : policy.model ? `Asking for ${reqLabel} — the model your role is pinned to`
    : `Asking for ${reqLabel} — ${policy.why === 'exempt' ? 'exempt' : 'not pinned'}, sent as requested · ${minsLeft(exp, now)} min left on the credential`

  const send = useCallback((prompt) => a.send(prompt, { modelId: model, system, contextWindow: ctx, requestedLabel: labelOf(models, model) }), [a, model, system, ctx, models])

  let content
  if (a.loading && !a.config) content = <Centered><Loader2 size={22} className="animate-spin" style={{ color: tone }} aria-label="Loading" /></Centered>
  else if (a.loadError && !a.config) content = <Centered><LoadError t={t} message={a.loadError} onRetry={a.reload} /></Centered>
  else if (!signedIn) content = <AccessLanding t={t} tone={tone} a={a} onOpenLifecycle={() => openLifecycle('overview')} />
  else {
    content = (
      <div className="relative flex-1 min-h-0 flex">
        <div className="relative flex-shrink-0 overflow-hidden py-3 pl-3" style={{ width: leftW }}>
          <div className="h-full overflow-hidden" style={glass(t, { radius: 22 })}>
            <IdentityRail t={t} tone={tone} a={a} now={now} model={model} onModel={setModel}
                          system={system} onSystem={setSystem} ctx={ctx} onCtx={setCtx} onOpenLifecycle={openLifecycle} />
          </div>
        </div>
        <Handle t={t} side="left" dragging={dragL} onDrag={{ width: leftW, setWidth: setLeftW, setDragging: setDragL }} />
        <div className="relative flex-1 min-w-0 flex flex-col pt-1">
          <RequestStream t={t} tone={tone} a={a} live={live} expired={expired} helper={helper} onSend={send} onOpenLifecycle={openLifecycle} />
        </div>
        <Handle t={t} side="right" dragging={dragR} onDrag={{ width: rightW, setWidth: setRightW, setDragging: setDragR }} />
        <div className="relative flex-shrink-0 overflow-hidden py-3 pr-3" style={{ width: rightW }}>
          <RequestEvidence t={t} tone={tone} a={a} expired={expired} onOpenLifecycle={openLifecycle} />
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-full overflow-hidden"
         style={{ background: t.ground, cursor: dragL || dragR ? 'col-resize' : 'default', userSelect: dragL || dragR ? 'none' : 'auto' }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
        backgroundSize: '44px 44px',
      }} />
      {isNew && (
        <PillarHeader pillarId="enterpriseAccess" warn={expired}
                      actions={<AccessActions t={t} tone={tone} a={a} now={now} onOpenLifecycle={openLifecycle} />} />
      )}
      {content}
      <LifecycleDrawer t={t} tone={tone} a={a} open={drawer} onClose={closeLifecycle} />
    </div>
  )
}
