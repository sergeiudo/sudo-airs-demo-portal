import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { KeyRound, LogOut, LogIn, RotateCcw } from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { shade, bandGlass } from '../home-2027/band'
import { minsLeft } from './accessModel'

/**
 * AccessActions — the pillar's controls on the unified header. The white pill
 * reports the credential (it does not toggle — there is no AIRS switch here:
 * the gateway routes on identity whatever the portal does), then the way into
 * the lifecycle, Clear session (requests and conversation go, the sign-in and
 * its credential stay) and Sign out; before sign-in, the configuration state
 * and Sign in.
 */

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

function GlassButton({ onClick, disabled, icon: Icon, children, title }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 whitespace-nowrap disabled:opacity-50 ${focus}`}
            style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, ...bandGlass, transition: 'background 160ms ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.34)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = bandGlass.background }}>
      <Icon size={13} aria-hidden="true" /> {children}
    </button>
  )
}

export function AccessActions({ t, tone, a, now, onOpenLifecycle }) {
  const reduce = useReducedMotion()
  const s = a.session
  const exp = s?.credential?.exp
  const mins = minsLeft(exp, now)
  const expired = exp && exp * 1000 <= now
  const signedIn = !!s?.signedIn
  const label = a.loading ? 'Reading configuration…'
    : signedIn ? (expired ? 'Credential expired' : `Credential verified · ${mins} min`)
    : a.config?.configured ? 'Not signed in' : 'Setup needed'
  const dot = signedIn ? (expired || mins <= 15 ? t.warn : t.pass) : a.config?.configured ? t.idle : t.warn
  const live = signedIn && !expired

  return (
    <>
      <span role="status" className="inline-flex flex-shrink-0 items-center gap-2 rounded-full pl-2.5 pr-3 whitespace-nowrap"
            style={{ height: 30, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 700, color: shade(tone), background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.18)' }}>
        <span className="relative flex" style={{ width: 8, height: 8 }} aria-hidden="true">
          {live && !reduce && (
            <motion.span className="absolute inset-0 rounded-full" style={{ background: dot }}
                         animate={{ scale: [1, 2.3], opacity: [0.55, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />
          )}
          <span className="relative rounded-full" style={{ width: 8, height: 8, background: dot }} />
        </span>
        {label}
      </span>
      {signedIn ? (
        <>
          <GlassButton icon={KeyRound} onClick={() => onOpenLifecycle('overview')} title="Every artifact from this sign-in">Token lifecycle</GlassButton>
          <GlassButton icon={RotateCcw} onClick={a.clear} disabled={!a.calls.length || !!a.pending}
                       title={a.calls.length ? 'Clear the requests and the conversation history — you stay signed in, the credential is kept' : 'Nothing to clear yet'}>
            Clear session
          </GlassButton>
          <GlassButton icon={LogOut} onClick={a.signOut} title="End this portal's session">Sign out</GlassButton>
        </>
      ) : (
        <GlassButton icon={LogIn} onClick={a.signIn} disabled={!a.config?.configured}
                     title={a.config?.configured ? 'Sign in with Microsoft Entra ID' : 'Finish setting up this host first'}>
          Sign in
        </GlassButton>
      )}
    </>
  )
}
