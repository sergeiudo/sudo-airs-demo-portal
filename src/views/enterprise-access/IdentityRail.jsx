import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Fingerprint, UserCog, Building2, Briefcase, Globe2, KeyRound, Timer, Lock, Route, ListOrdered, ShieldCheck, ShieldAlert,
  Cpu, ChevronDown, Check, ArrowUpRight, MessageSquareText, SlidersHorizontal, FlaskConical, Eraser, LogOut, Loader2, ArrowRight,
} from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots } from '../home-2027/band'
import { ENTRA_BLUE, short, clockS, minsLeft, labelOf, TAMPER_KINDS } from './accessModel'

/**
 * IdentityRail — the signed-in session as rows you can point at during a
 * demo: who the directory says you are, the credential this portal minted for
 * you and how long it has left, which rule of the policy you land on, then
 * the controls — the model you ask for (and what the gateway will answer
 * with instead), the conversation settings, and the tamper experiments.
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

function Eyebrow({ t, children }) {
  return <div className="px-1 pt-4 pb-1.5" style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>{children}</div>
}

function RailRow({ t, icon: Icon, tone, title, sub, mono, onClick, right, wash }) {
  const [hot, setHot] = useState(false)
  const c = tone || t.live
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
         onMouseEnter={onClick ? () => setHot(true) : undefined} onMouseLeave={onClick ? () => setHot(false) : undefined}
         className={`w-full flex items-center gap-2.5 rounded-xl text-left ${onClick ? focusCls : ''}`}
         style={{ padding: '7px 8px', background: wash ? `${c}12` : hot ? t.sunken : 'transparent', border: `1px solid ${wash ? `${c}33` : 'transparent'}`, transition: 'background 140ms ease' }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${c}14`, color: c }}>
        <Icon size={14} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate" dir={mono ? 'ltr' : undefined} title={typeof title === 'string' ? title : undefined}
              style={{ fontFamily: mono ? FONT.mono : FONT.prose, fontSize: mono ? 11.5 : 12.5, fontWeight: mono ? 500 : 650, color: wash ? (t.isLight ? shade(c, 0.3) : c) : t.ink }}>
          {title}
        </span>
        {sub && <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }} title={typeof sub === 'string' ? sub : undefined}>{sub}</span>}
      </span>
      {right}
      {onClick && <ArrowUpRight size={13} className="flex-shrink-0" style={{ color: hot ? t.ink : t.inkFaint }} aria-hidden="true" />}
    </Tag>
  )
}

function IdentityBand({ t, tone, user }) {
  const initials = String(user.name || user.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  return (
    <div className="relative overflow-hidden flex-shrink-0" style={{ minHeight: 100, background: bandBg(tone) }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
      <Fingerprint aria-hidden="true" strokeWidth={1.3}
                   style={{ position: 'absolute', right: -26, bottom: -42, width: 150, height: 150, color: '#fff', opacity: 0.14, transform: 'rotate(-10deg)' }} />
      <div className="relative flex items-center gap-3 px-4 py-4">
        <span className="grid place-items-center rounded-2xl flex-shrink-0"
              style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)', fontFamily: FONT.display, fontSize: 16, fontWeight: 700, color: '#fff' }}>
          {initials}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5" style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>
            <img src="/logo-entra.png" alt="" style={{ width: 11, height: 11 }} /> Signed in · Microsoft Entra ID
          </div>
          <div className="truncate" style={{ fontFamily: FONT.display, fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 3 }}>{user.name}</div>
          <div className="truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11, color: 'rgba(255,255,255,0.92)', marginTop: 1 }}>{user.email}</div>
        </div>
      </div>
    </div>
  )
}

/** The model you ask for — a card that opens onto the list. */
function ModelPicker({ t, tone, models, value, onChange, policy }) {
  const [open, setOpen] = useState(false)
  const [hot, setHot] = useState(false)
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const sel = models.find((m) => m.id === value)
  const targets = new Map((policy?.targets ?? []).filter((x) => x.override_params?.model).map((x) => [x.override_params.model, x.name]))
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div ref={ref} className="rounded-2xl overflow-hidden" style={{
      background: t.panel, border: `1px solid ${open || hot ? `${tone}55` : t.hairline}`,
      boxShadow: open ? `0 10px 24px ${tone}1f` : hot ? t.shadowSm : 'none', transition: 'border-color 160ms ease, box-shadow 200ms ease',
    }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox"
              onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
              className={`w-full flex items-center gap-3 text-left ${focusCls}`} style={{ padding: '9px 10px' }}>
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 34, height: 34, background: bandBg(tone), boxShadow: open || hot ? `0 5px 12px ${tone}55` : 'none' }}>
          <Cpu size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>{sel?.label ?? 'Pick a model'}</span>
          <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }}>You ask for · {sel?.vendor ?? '—'}</span>
        </span>
        <ChevronDown size={14} style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }} className="overflow-hidden">
            <div role="listbox" aria-label="Requested model" className="px-1.5 pb-1.5 pt-0.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
              {models.map((m, i) => {
                const on = m.id === value
                const target = targets.get(m.id)
                return (
                  <motion.button key={m.id} type="button" role="option" aria-selected={on}
                                 initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.02, 0.2), duration: 0.18 }}
                                 onClick={() => { onChange(m.id); setOpen(false) }}
                                 className={`w-full flex items-center gap-2.5 rounded-xl text-left ${focusCls}`}
                                 style={{ padding: '6px 8px', background: on ? `${tone}14` : 'transparent' }}
                                 onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = t.sunken }}
                                 onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent' }}>
                    <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: target ? tone : t.inkFaint }} aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{m.label}</span>
                        {target && <span className="rounded-full px-1.5 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 600, color: t.isLight ? shade(tone, 0.3) : tone, background: `${tone}17` }}>policy · {target}</span>}
                      </span>
                      <span className="block truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkDim, marginTop: 1 }}>{m.vendor.toUpperCase()} · {m.id}</span>
                    </span>
                    <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
                          style={{ width: 24, height: 24, color: on ? '#fff' : t.inkDim, background: on ? shade(tone) : t.sunken }}>
                      {on ? <Check size={12} strokeWidth={3} /> : <ArrowRight size={12} />}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function LedgerRow({ t, k, v, color, struck, bg }) {
  return (
    <div className="px-3 py-2" style={{ background: bg }}>
      <div style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600, color: t.inkDim }}>{k}</div>
      <div style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color, textDecoration: struck ? 'line-through' : 'none', marginTop: 1 }}>{v}</div>
    </div>
  )
}

/** Asked for vs what the policy will answer with — the portal's prediction; the evidence pane shows what actually answered. */
function Ledger({ t, models, requested, policy }) {
  const pinned = policy?.model
  const reqLabel = labelOf(models, requested)
  const passInk = t.isLight ? shade(t.pass, 0.3) : t.pass
  const blockInk = t.isLight ? shade(t.block, 0.25) : t.block
  let body
  let note
  if (!pinned) {
    body = <LedgerRow t={t} k="Sent as requested" v={reqLabel} color={passInk} bg={`${t.pass}12`} />
    note = policy?.why === 'exempt' ? 'This account is exempt from model routing. Everyone else is still pinned by role.' : 'Your route does not pin a model, so the gateway forwards whichever one you pick.'
  } else if (pinned === requested) {
    body = <LedgerRow t={t} k="Requested and enforced" v={reqLabel} color={passInk} bg={`${t.pass}12`} />
    note = 'Your choice already matches the model your role is pinned to.'
  } else {
    body = (
      <>
        <LedgerRow t={t} k="You ask for" v={reqLabel} color={t.inkFaint} struck />
        <LedgerRow t={t} k="The gateway will answer with" v={labelOf(models, pinned)} color={blockInk} bg={`${t.block}10`} />
      </>
    )
    note = 'The rule is sealed inside your signed token, so this cannot be changed from the browser.'
  }
  return (
    <div className="rounded-2xl overflow-hidden mt-2" style={{ border: `1px solid ${t.hairline}`, background: t.panel }}>
      {body}
      <div className="px-3 py-2" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.45, color: t.inkDim, borderTop: `1px solid ${t.hairline}` }}>{note}</div>
    </div>
  )
}

function TamperCard({ t, tone, busy, onRun }) {
  const [open, setOpen] = useState(true)
  const c = t.block
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: t.panel, border: `1px solid ${open ? `${c}40` : t.hairline}` }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className={`w-full flex items-center gap-3 text-left ${focusCls}`} style={{ padding: '9px 10px' }}>
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 34, height: 34, background: bandBg(tone) }}>
          <FlaskConical size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block" style={{ fontFamily: FONT.display, fontSize: 13.5, fontWeight: 700, color: t.ink }}>Try to cheat the gateway</span>
          <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }}>Your credential, doctored — sent for real</span>
        </span>
        <ChevronDown size={14} style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="px-1.5 pb-1.5 pt-0.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
              {TAMPER_KINDS.map((k) => (
                <button key={k.kind} type="button" disabled={!!busy} onClick={() => onRun(k.kind, k)}
                        className={`w-full flex items-center gap-2.5 rounded-xl text-left disabled:opacity-50 ${focusCls}`}
                        style={{ padding: '6px 8px' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = `${c}10` }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  <ShieldAlert size={13} style={{ color: c, flexShrink: 0 }} aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{k.label}</span>
                    <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim, marginTop: 1 }}>{k.what}</span>
                  </span>
                  <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true" style={{ width: 24, height: 24, color: t.inkDim, background: t.sunken }}>
                    {busy === k.kind ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                  </span>
                </button>
              ))}
              <p className="px-2 pt-1.5 pb-1" style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: 1.45, color: t.inkDim, margin: 0 }}>
                Each one asks for Claude Opus 4.8. If the gateway trusted the token, Opus would answer.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function IdentityRail({ t, tone, a, now, model, onModel, system, onSystem, ctx, onCtx, onOpenLifecycle }) {
  const s = a.session
  const u = s.user
  const cred = s.credential
  const policy = s.policy
  const models = a.config?.models ?? []
  const graph = s.lifecycle?.graph?.data
  const mins = minsLeft(cred?.exp, now)
  const expired = cred?.exp && cred.exp * 1000 <= now
  const lifeTone = expired ? t.warn : mins <= 15 ? t.warn : t.pass
  const busyTamper = a.pending?.kind === 'tamper' ? a.pending.tamper?.kind : a.pending ? 'other' : null
  const sealed = cred?.payload?.defaults ? ['email', 'user_role', 'department', 'config_id'] : []
  const pinned = policy?.model
  const effectTone = pinned ? t.block : t.pass

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <IdentityBand t={t} tone={tone} user={u} />
      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3">
        <Eyebrow t={t}>Model you ask for</Eyebrow>
        <ModelPicker t={t} tone={tone} models={models} value={model} onChange={onModel} policy={a.config?.policy} />
        <Ledger t={t} models={models} requested={model} policy={policy} />

        <Eyebrow t={t}>Directory</Eyebrow>
        <RailRow t={t} icon={UserCog} tone={tone} title={u.roleLabel}
                 sub={u.roles?.length ? `App role · roles claim [${u.roles.join(', ')}]` : 'App role · no roles claim → User'} onClick={() => onOpenLifecycle('claims')} />
        <RailRow t={t} icon={Building2} tone={ENTRA_BLUE} title={u.department}
                 sub={graph?.fellBack ? 'Department · Graph had none — fallback' : 'Department · Microsoft Graph'} onClick={() => onOpenLifecycle('graph')} />
        {u.jobTitle && <RailRow t={t} icon={Briefcase} tone={ENTRA_BLUE} title={u.jobTitle} sub="Job title · Microsoft Graph" />}
        <RailRow t={t} icon={Globe2} tone={ENTRA_BLUE} title={short(u.tenantId, 8, 4)} mono sub="Tenant · tid claim" />

        <Eyebrow t={t}>Credential</Eyebrow>
        <RailRow t={t} icon={KeyRound} tone={tone} title={`${cred?.alg} · kid ${short(cred?.kid, 8, 4)}`} mono sub="Signed by this portal — no API key" onClick={() => onOpenLifecycle('mint')} />
        <RailRow t={t} icon={Timer} tone={lifeTone} title={expired ? 'Expired' : `${mins} min left`} wash={expired || mins <= 15}
                 sub={expired ? 'Sign out and in again — there is no refresh' : `Expires ${clockS(cred?.exp)}`} />
        <RailRow t={t} icon={Lock} tone={tone} title={`${sealed.length} claims sealed`} sub={sealed.join(' · ')} onClick={() => onOpenLifecycle('mint')} />

        <Eyebrow t={t}>Policy</Eyebrow>
        <RailRow t={t} icon={Route} tone={tone} title={a.config?.configId} mono sub="Routing config, locked in the token" />
        <RailRow t={t} icon={ListOrdered} tone={tone}
                 title={policy?.rule ? `Rule ${policy.rule} · ${policy.field} = ${policy.value}` : 'Default route'}
                 sub={policy?.why === 'exempt' ? 'Matched on email address' : policy?.why === 'role' ? 'Matched on app role' : 'Nothing matched'} />
        <RailRow t={t} icon={pinned ? Lock : ShieldCheck} tone={effectTone} wash
                 title={pinned ? `Pinned to ${labelOf(models, pinned)}` : policy?.why === 'exempt' ? 'Exempt — your choice is sent through' : 'Not pinned to one model'}
                 sub="What the gateway does with your requests" />

        <Eyebrow t={t}>Conversation</Eyebrow>
        <div className="rounded-2xl p-2.5" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
          <label className="flex items-center gap-1.5" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.inkDim }}>
            <MessageSquareText size={12} aria-hidden="true" /> System instructions
          </label>
          <textarea value={system} onChange={(e) => onSystem(e.target.value)} rows={2}
                    ref={(el) => el?.style.setProperty('background-color', t.sunken, 'important')}
                    className="w-full resize-y rounded-xl mt-1.5 outline-none"
                    style={{ padding: '7px 9px', fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.45, color: t.ink, border: `1px solid ${t.hairline}` }} />
          <div className="flex items-center justify-between mt-2.5" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.inkDim }}>
            <span className="flex items-center gap-1.5"><SlidersHorizontal size={12} aria-hidden="true" /> Context window</span>
            <span style={{ fontFamily: FONT.mono, color: t.ink }}>{ctx} messages</span>
          </div>
          <input type="range" min={2} max={30} step={2} value={ctx} onChange={(e) => onCtx(Number(e.target.value))}
                 aria-label="Context window" className="w-full mt-1" style={{ accentColor: tone }} />
          <div style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim }}>How many recent messages travel with each request.</div>
        </div>

        <Eyebrow t={t}>Prove the seal</Eyebrow>
        <TamperCard t={t} tone={tone} busy={busyTamper} onRun={a.tamper} />

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button type="button" onClick={a.clear} disabled={!a.calls.length || !!a.pending}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-full disabled:opacity-50 ${focusCls}`}
                  style={{ height: 32, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, background: t.sunken, border: `1px solid ${t.hairline}` }}>
            <Eraser size={13} aria-hidden="true" /> Clear
          </button>
          <button type="button" onClick={a.signOut}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-full ${focusCls}`}
                  style={{ height: 32, fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, background: t.sunken, border: `1px solid ${t.hairline}` }}>
            <LogOut size={13} aria-hidden="true" /> Sign out
          </button>
        </div>
        <p className="px-1 pt-2" style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: 1.45, color: t.inkDim, margin: 0 }}>
          Sign out ends this portal's session only; Microsoft still remembers you, which is why the account picker is forced on every sign-in.
        </p>
      </div>
    </div>
  )
}

