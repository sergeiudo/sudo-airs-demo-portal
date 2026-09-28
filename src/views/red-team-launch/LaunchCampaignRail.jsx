import React, { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Swords, History, Plus, X, Check, ChevronDown, RefreshCw, Play, Square, Loader2, Target, AlertTriangle,
  ArrowUpRight, Info, Bot,
} from 'lucide-react'
import { FONT, label as LBL } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots } from '../home-2027/band'
import { Footnote } from '../runtime-launch/LaunchModelPicker'
import {
  catMeta, targetMeta, JOB_TYPE, statusMeta, riskLevel, riskTone, fmtPct, fmtNum, relTime, pretty, useCategories, apiMessage,
} from './redTeamModel'

/**
 * LaunchCampaignRail — the Red Teaming console's left rail.
 *
 *   New campaign  target cards (the chosen one is a band in the pillar's
 *                 colour), a new-target form, the campaign type, and the
 *                 categories as cards of chips — then Launch in the band.
 *   History       every campaign on the tenant, newest first; one click opens
 *                 its live view or its finished report.
 *
 * The Classic view's "AIRS Protection Active" note is not carried over: the
 * portal-wide AIRS toggle has no effect on a red-team campaign. Whether AIRS
 * guards a target is a property of the target itself (a "Protected Bedrock
 * App" routes through AIRS Runtime), and the rail says so instead.
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

// ─── targets ─────────────────────────────────────────────────────────────────

function TargetRow({ t, target, active, tone, onPick }) {
  const [hot, setHot] = useState(false)
  const meta = targetMeta(target.target_type)
  const Icon = meta.icon
  const ok = target.status === 'ACTIVE' || target.active
  return (
    <button type="button" onClick={() => onPick(target.uuid)} aria-pressed={active}
            onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className={`relative w-full flex items-center gap-2.5 text-left overflow-hidden rounded-2xl ${focusCls}`}
            style={{
              padding: '9px 10px', minHeight: 56,
              background: active ? bandBg(tone) : t.panel,
              border: `1px solid ${active ? 'transparent' : hot ? `${tone}88` : t.hairline}`,
              boxShadow: active ? `0 8px 20px ${tone}44` : hot ? `0 8px 18px ${tone}22` : 'none',
              transition: 'border-color 160ms ease, box-shadow 200ms ease',
            }}>
      {active && <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />}
      <span className="relative grid place-items-center rounded-xl flex-shrink-0"
            style={{ width: 32, height: 32, background: active ? '#fff' : t.sunken, border: active ? 'none' : `1px solid ${t.hairline}` }}>
        <Icon size={15} style={{ color: active ? shade(tone) : hot ? shade(tone, 0.15) : t.inkDim }} aria-hidden="true" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate" title={target.name} style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: active ? '#fff' : t.ink }}>{target.name}</span>
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: active ? 'rgba(255,255,255,0.88)' : t.inkDim, marginTop: 1 }}>
          {meta.label} · {pretty(target.connection_type)}{target.validated ? ' · validated' : ''}
        </span>
      </span>
      {active ? (
        <span className="relative grid place-items-center rounded-full flex-shrink-0" style={{ width: 18, height: 18, background: '#fff', color: shade(tone) }} aria-hidden="true">
          <Check size={11} strokeWidth={3} />
        </span>
      ) : (
        <span className="relative rounded-full px-2 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600, lineHeight: '18px', color: ok ? (t.isLight ? shade(t.pass, 0.25) : t.pass) : t.inkDim, background: ok ? `${t.pass}17` : t.sunken }}>
          {ok ? 'active' : pretty(target.status)}
        </span>
      )}
    </button>
  )
}

const PRESETS = {
  OPENAI: { apiEndpoint: 'https://api.openai.com/v1/chat/completions', requestJson: '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"{INPUT}"}]}', responseKey: 'choices[0].message.content' },
  REST:   { apiEndpoint: '', requestJson: '{"messages":[{"role":"user","content":"{INPUT}"}]}', responseKey: 'choices[0].message.content' },
}

function Field({ t, label, hint, children }) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-2 mb-1">
        <span style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.ink }}>{label}</span>
        {hint && <span style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim }}>{hint}</span>}
      </span>
      {children}
    </label>
  )
}

/** The Classic view's target form, same request body, in the launch look. */
function CreateTarget({ t, tone, onCreated, onCancel }) {
  const [form, setForm] = useState({ name: '', connectionType: 'OPENAI', authHeader: '', apiKey: '', modelName: '', ...PRESETS.OPENAI, apiEndpoint: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const input = (mono) => ({
    className: `w-full rounded-xl px-3 outline-none ${focusCls}`,
    style: { height: 34, fontFamily: mono ? FONT.mono : FONT.prose, fontSize: mono ? 11 : 12.5, color: t.ink, border: `1px solid ${t.hairline}` },
    ref: (el) => el?.style.setProperty('background-color', t.sunken, 'important'),
  })

  const create = async () => {
    setErr(''); setSaving(true)
    try {
      let requestJson
      try { requestJson = JSON.parse(form.requestJson) } catch { throw new Error('The request template is not valid JSON') }
      const headers = { 'Content-Type': 'application/json' }
      if (form.authHeader) headers.Authorization = form.authHeader
      const body = {
        name: form.name || 'SUDO AIRS Demo Target',
        target_type: 'MODEL', connection_type: form.connectionType, api_endpoint_type: 'PUBLIC', response_mode: 'REST', session_supported: false,
        connection_params: {
          api_endpoint: form.apiEndpoint, request_headers: headers, request_json: requestJson, response_key: form.responseKey,
          ...(form.connectionType === 'OPENAI' && form.apiKey ? { target_connection_config: { api_key: form.apiKey, model_name: form.modelName } } : {}),
        },
        target_metadata: { rate_limit_enabled: false, content_filter_enabled: false },
      }
      const res = await fetch('/api/redteam/targets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(apiMessage(data) || 'Create failed')
      onCreated(data)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-3 space-y-2.5"
                style={{ background: t.panel, border: `1px solid ${tone}55`, boxShadow: `0 10px 24px ${tone}1c` }}>
      <div className="flex items-center gap-2">
        <span className="grid place-items-center rounded-lg" style={{ width: 26, height: 26, background: bandBg(tone) }}><Plus size={13} style={{ color: '#fff' }} aria-hidden="true" /></span>
        <span className="flex-1" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>New target</span>
        <button type="button" onClick={onCancel} aria-label="Cancel new target" className="grid place-items-center rounded-full" style={{ width: 24, height: 24, color: t.inkDim, background: t.sunken }}><X size={12} /></button>
      </div>
      <Field t={t} label="Name"><input {...input(false)} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="SUDO AIRS Demo Target" /></Field>
      <div className="flex gap-1.5" role="radiogroup" aria-label="Connection type">
        {['OPENAI', 'REST'].map((c) => {
          const on = form.connectionType === c
          return (
            <button key={c} type="button" role="radio" aria-checked={on} onClick={() => setForm((f) => ({ ...f, connectionType: c, ...PRESETS[c] }))}
                    className={`flex-1 rounded-full ${focusCls}`}
                    style={{ height: 30, fontFamily: FONT.prose, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? '#fff' : t.inkDim, background: on ? bandBg(tone) : t.sunken, border: `1px solid ${on ? 'transparent' : t.hairline}` }}>
              {c === 'OPENAI' ? 'OpenAI-compatible' : 'Custom REST'}
            </button>
          )
        })}
      </div>
      <Field t={t} label="Endpoint"><input {...input(true)} value={form.apiEndpoint} onChange={(e) => set('apiEndpoint', e.target.value)} placeholder="https://api.openai.com/v1/chat/completions" /></Field>
      <Field t={t} label="Authorization" hint="header value"><input {...input(true)} value={form.authHeader} onChange={(e) => set('authHeader', e.target.value)} placeholder="Bearer sk-…" /></Field>
      <Field t={t} label="Request template" hint={'{INPUT} is replaced by each attack'}>
        <textarea value={form.requestJson} onChange={(e) => set('requestJson', e.target.value)} rows={3}
                  ref={(el) => el?.style.setProperty('background-color', t.sunken, 'important')}
                  className={`w-full rounded-xl px-3 py-2 outline-none resize-none ${focusCls}`}
                  style={{ fontFamily: FONT.mono, fontSize: 11, color: t.ink, border: `1px solid ${t.hairline}` }} />
      </Field>
      <Field t={t} label="Response path"><input {...input(true)} value={form.responseKey} onChange={(e) => set('responseKey', e.target.value)} placeholder="choices[0].message.content" /></Field>
      {err && <p className="rounded-xl px-3 py-2" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.ink, background: `${t.warn}17` }}>{err}</p>}
      <button type="button" onClick={create} disabled={saving || !form.apiEndpoint}
              className={`w-full inline-flex items-center justify-center gap-1.5 rounded-full disabled:opacity-50 ${focusCls}`}
              style={{ height: 36, fontFamily: FONT.prose, fontSize: 13, fontWeight: 700, color: '#fff', background: bandBg(tone), cursor: saving || !form.apiEndpoint ? 'not-allowed' : 'pointer' }}>
        {saving ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : 'Create and validate target'}
      </button>
    </motion.div>
  )
}

// ─── categories ──────────────────────────────────────────────────────────────

function CategoryCard({ t, cat, selected, onToggle, onAll }) {
  const [open, setOpen] = useState(false)
  const [hot, setHot] = useState(false)
  const reduce = useReducedMotion()
  const meta = catMeta(cat.id)
  const hue = meta.hue
  const Icon = meta.icon
  const n = selected?.length ?? 0
  const all = n === cat.subs.length
  const ink = t.isLight ? shade(hue, 0.15) : hue
  return (
    <div className="rounded-2xl overflow-hidden" style={{
      background: t.panel, border: `1px solid ${open || hot || n ? `${hue}55` : t.hairline}`,
      boxShadow: open ? `0 10px 24px ${hue}1f` : 'none', transition: 'border-color 160ms ease, box-shadow 200ms ease',
    }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
              className={`w-full flex items-center gap-3 text-left ${focusCls}`} style={{ padding: '9px 10px' }}>
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 34, height: 34, background: bandBg(hue), boxShadow: hot || open ? `0 5px 12px ${hue}55` : 'none' }}>
          <Icon size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink, lineHeight: 1.2 }}>{cat.label}</span>
          <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }}>{meta.sub || cat.description}</span>
        </span>
        <span className="rounded-full px-2 flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 10.5, lineHeight: '19px', color: n ? ink : t.inkDim, background: n ? `${hue}17` : t.sunken }}>
          {n} of {cat.subs.length}
        </span>
        <ChevronDown size={13} style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="px-2.5 pb-2.5 pt-2" style={{ borderTop: `1px solid ${t.hairline}` }}>
              <div className="flex items-center mb-2">
                <span style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>Click to include</span>
                <button type="button" onClick={() => onAll(cat)} className="ml-auto" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.live }}>
                  {all ? 'Clear' : 'Select all'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cat.subs.map((s) => {
                  const on = selected?.includes(s.id)
                  return (
                    <button key={s.id} type="button" onClick={() => onToggle(cat.id, s.id)} aria-pressed={on} title={s.description ?? undefined}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 ${focusCls}`}
                            style={{
                              height: 26, fontFamily: FONT.prose, fontSize: 11.5, fontWeight: on ? 600 : 500,
                              color: on ? '#fff' : t.inkDim, background: on ? shade(hue, 0.1) : t.sunken,
                              border: `1px solid ${on ? 'transparent' : t.hairline}`, transition: 'background 140ms ease, color 140ms ease',
                            }}>
                      {on && <Check size={11} strokeWidth={3} aria-hidden="true" />}{s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── the builder ─────────────────────────────────────────────────────────────

function Builder({ t, tone, s }) {
  const [creating, setCreating] = useState(false)
  const cats = useCategories()
  const total = Object.values(s.categories).flat().length

  const toggle = (cat, sub) => s.setCategories((prev) => {
    const next = { ...prev }
    const cur = next[cat] ?? []
    next[cat] = cur.includes(sub) ? cur.filter((x) => x !== sub) : [...cur, sub]
    if (!next[cat].length) delete next[cat]
    return next
  })
  const toggleAll = (cat) => s.setCategories((prev) => {
    const next = { ...prev }
    if ((next[cat.id]?.length ?? 0) === cat.subs.length) delete next[cat.id]
    else next[cat.id] = cat.subs.map((x) => x.id)
    return next
  })

  return (
    <div className="px-3 pt-3.5 pb-3 space-y-4">
      <section>
        <div className="flex items-center px-1 mb-2">
          <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Target</span>
          <button type="button" onClick={() => setCreating((c) => !c)} className="ml-auto inline-flex items-center gap-1"
                  style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: creating ? t.inkDim : t.live }}>
            {creating ? <><X size={11} /> Cancel</> : <><Plus size={11} /> New target</>}
          </button>
        </div>
        {creating ? (
          <CreateTarget t={t} tone={tone} onCancel={() => setCreating(false)} onCreated={(x) => { s.addTarget(x); setCreating(false) }} />
        ) : s.targets.loading ? (
          <div className="flex items-center gap-2 px-2 py-3" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>
            <Loader2 size={13} className="animate-spin" /> Loading targets…
          </div>
        ) : s.targets.error ? (
          <div className="rounded-2xl px-3 py-3" style={{ background: `${t.warn}12`, border: `1px solid ${t.warn}44` }}>
            <div className="flex items-center gap-2" style={{ fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: t.ink }}>
              <AlertTriangle size={14} style={{ color: t.warn }} aria-hidden="true" /> Targets did not load
            </div>
            <p style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, marginTop: 4 }}>{s.targets.error}</p>
            <button type="button" onClick={s.reloadTargets} className="mt-2 inline-flex items-center gap-1" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.live }}>
              <RefreshCw size={11} /> Try again
            </button>
          </div>
        ) : s.targets.list.length === 0 ? (
          <div className="rounded-2xl px-3 py-4 text-center" style={{ background: t.sunken }}>
            <Target size={20} style={{ color: t.inkFaint, margin: '0 auto 6px' }} aria-hidden="true" />
            <p style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>No targets yet — create one here or in SCM.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {s.targets.list.map((x) => (
              <TargetRow key={x.uuid} t={t} tone={tone} target={x} active={x.uuid === s.targetId} onPick={s.setTargetId} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="px-1 mb-2" style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Campaign type</div>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Campaign type">
          {Object.entries(JOB_TYPE).map(([id, jt]) => {
            const on = s.jobType === id
            return (
              <button key={id} type="button" role="radio" aria-checked={on} onClick={() => s.setJobType(id)}
                      className={`relative text-left rounded-2xl overflow-hidden ${focusCls}`}
                      style={{
                        padding: '9px 10px', background: on ? bandBg(tone) : t.panel,
                        border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 6px 16px ${tone}3d` : 'none',
                      }}>
                {on && <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />}
                <span className="relative flex items-center gap-1.5" style={{ fontFamily: FONT.display, fontSize: 12.5, fontWeight: 700, color: on ? '#fff' : t.ink }}>
                  {id === 'STATIC' ? <Swords size={13} aria-hidden="true" /> : <Bot size={13} aria-hidden="true" />} {jt.label}
                </span>
                <span className="relative block" style={{ fontFamily: FONT.prose, fontSize: 10.5, lineHeight: 1.35, color: on ? 'rgba(255,255,255,0.9)' : t.inkDim, marginTop: 3 }}>{jt.sub}</span>
              </button>
            )
          })}
        </div>
      </section>

      {s.jobType === 'STATIC' ? (
        <section>
          <div className="flex items-center px-1 mb-2">
            <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Attack categories</span>
            <span className="ml-auto" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: total ? t.ink : t.warn }}>{total} selected</span>
          </div>
          {!cats ? (
            <div className="flex items-center gap-2 px-2 py-2" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}><Loader2 size={13} className="animate-spin" /> Loading categories…</div>
          ) : (
            <div className="space-y-2">
              {cats.list.map((c) => <CategoryCard key={c.id} t={t} cat={c} selected={s.categories[c.id]} onToggle={toggle} onAll={toggleAll} />)}
            </div>
          )}
          {cats && !cats.live && (
            <p className="px-1 mt-2" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>PA's category catalogue did not answer — showing the built-in list.</p>
          )}
        </section>
      ) : (
        <div className="rounded-2xl px-3 py-3" style={{ background: t.sunken }}>
          <p style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.ink }}>
            The agent profiles the target, generates attack goals for its use case, then runs multi-turn conversations to reach them.
          </p>
          <p style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.inkDim, marginTop: 4 }}>Configure goal categories in SCM before launching.</p>
        </div>
      )}

      <Footnote t={t} icon={Info} tone={t.live} title="Is the target behind AIRS?">
        The portal's AIRS switch does not reach a red-team campaign — the campaign calls the target as it is deployed. A target that routes through
        AIRS Runtime (the "Protected Bedrock App" targets) shows what AIRS stops; an unprotected one shows the model on its own. Run both and compare.
      </Footnote>
    </div>
  )
}

/** Launch in the pillar band; Abort while a campaign runs. */
function LaunchBar({ t, tone, s }) {
  const staticEmpty = s.jobType === 'STATIC' && Object.values(s.categories).flat().length === 0
  const disabled = s.running ? s.aborting : !s.target || s.launching || staticEmpty
  const why = !s.target ? 'Pick a target first' : staticEmpty ? 'Pick at least one attack category' : null
  const label = s.running
    ? (s.aborting ? 'Aborting…' : 'Abort campaign')
    : s.launching ? 'Launching…' : 'Launch campaign'
  const bg = s.running ? bandBg(t.warn) : bandBg(tone)
  return (
    <div className="flex-shrink-0 px-3 pt-2.5 pb-3" style={{ borderTop: `1px solid ${t.hairline}` }}>
      {s.launchError && (
        <p className="rounded-xl px-3 py-2 mb-2" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.45, color: t.ink, background: `${t.warn}17`, border: `1px solid ${t.warn}44` }}>
          <span style={{ fontWeight: 700 }}>Launch failed. </span>{s.launchError}
        </p>
      )}
      <motion.button type="button" whileTap={disabled ? undefined : { scale: 0.98 }}
                     onClick={() => (s.running ? s.abort() : s.launch())} disabled={disabled} title={why ?? undefined}
                     className={`relative w-full inline-flex items-center justify-center gap-2 rounded-2xl overflow-hidden disabled:opacity-50 ${focusCls}`}
                     style={{ height: 46, fontFamily: FONT.display, fontSize: 14.5, fontWeight: 700, color: '#fff', background: bg, boxShadow: disabled ? 'none' : `0 10px 24px ${s.running ? t.warn : tone}40`, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
        <span className="relative inline-flex items-center gap-2">
          {s.launching || s.aborting ? <Loader2 size={15} className="animate-spin" /> : s.running ? <Square size={14} /> : <Play size={15} />}
          {label}
        </span>
      </motion.button>
      <p style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.45, color: t.inkDim, marginTop: 7 }}>
        {why ?? (s.running
          ? 'The campaign keeps running in Prisma AIRS if you leave — reopen it from History.'
          : 'Runs for minutes to hours and counts toward the tenant’s red-teaming quota. You can leave; reopen it from History.')}
      </p>
    </div>
  )
}

// ─── history ─────────────────────────────────────────────────────────────────

function CampaignRow({ t, tone, job, active, onOpen, index }) {
  const reduce = useReducedMotion()
  const [hot, setHot] = useState(false)
  const st = statusMeta(job.status)
  const level = riskLevel(job.report_stats?.report_summary)
  const done = job.status === 'COMPLETED'
  const pillTone = done ? riskTone(t, level) : t[st.tone] ?? t.idle
  const ink = t.isLight ? shade(pillTone, 0.28) : pillTone
  const TIcon = targetMeta(job.target_type ?? job.target?.target_type).icon
  const running = !['COMPLETED', 'FAILED', 'ABORTED'].includes(job.status)
  return (
    <motion.button type="button" onClick={() => onOpen(job.uuid)}
                   initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: Math.min(index * 0.025, 0.3), duration: 0.2 }}
                   onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
                   className={`w-full flex items-start gap-2.5 rounded-xl text-left ${focusCls}`}
                   style={{ padding: '8px 8px 8px 10px', background: active ? `${tone}17` : hot ? `${tone}0f` : 'transparent', transition: 'background 140ms ease' }}>
      <span className="relative grid place-items-center rounded-lg flex-shrink-0" style={{ width: 26, height: 26, marginTop: 1, background: `${pillTone}17`, color: ink }}>
        <TIcon size={13} aria-hidden="true" />
        {running && <span className="absolute rounded-full animate-pulse" style={{ top: -2, right: -2, width: 8, height: 8, background: t.live, border: `2px solid ${t.panel}` }} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block" title={job.name} style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{job.target?.name ?? job.name}</span>
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim, marginTop: 1 }}>
          {JOB_TYPE[job.job_type]?.label ?? pretty(job.job_type)} · {fmtNum(job.completed)} of {fmtNum(job.total)} · {relTime(job.created_at)}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="rounded-full px-2" style={{ fontFamily: FONT.prose, fontSize: 10.5, fontWeight: 600, lineHeight: '18px', color: ink, background: `${pillTone}17` }}>
          {done ? (level ? `${level} risk` : 'completed') : st.label.toLowerCase()}
        </span>
        {done && job.asr != null && <span style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim }}>ASR {fmtPct(job.asr)}</span>}
      </span>
      <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
            style={{ width: 24, height: 24, marginTop: 1, color: active || hot ? '#fff' : t.inkDim, background: active || hot ? shade(tone) : t.sunken, transition: 'background 140ms ease, color 140ms ease' }}>
        {active ? <Check size={12} strokeWidth={3} /> : <ArrowUpRight size={12} />}
      </span>
    </motion.button>
  )
}

function HistoryTab({ t, tone, s }) {
  const h = s.history
  return (
    <div className="px-3 pt-3.5 pb-3">
      <div className="flex items-center px-1 mb-2">
        <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Campaigns on this tenant</span>
        <span className="ml-auto inline-flex items-center gap-2">
          {h.total != null && <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>{h.total}</span>}
          <button type="button" onClick={h.reload} title="Refresh" aria-label="Refresh campaigns" style={{ color: t.inkDim }}>
            <RefreshCw size={12} className={h.loading ? 'animate-spin' : ''} />
          </button>
        </span>
      </div>
      {h.error && (
        <p className="rounded-xl px-3 py-2 mb-2" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.ink, background: `${t.warn}17` }}>History did not load: {h.error}</p>
      )}
      {!h.loaded && h.loading && (
        <div className="flex items-center gap-2 px-2 py-3" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}><Loader2 size={13} className="animate-spin" /> Loading campaigns…</div>
      )}
      <div className="rounded-2xl p-1" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
        {h.list.map((j, i) => <CampaignRow key={j.uuid} t={t} tone={tone} job={j} index={i} active={j.uuid === s.campaignId} onOpen={s.openCampaign} />)}
        {h.loaded && !h.list.length && !h.error && (
          <p className="px-3 py-4 text-center" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>No campaigns on this tenant yet.</p>
        )}
      </div>
      {h.more && (
        <button type="button" onClick={h.more} disabled={h.loading} className="w-full mt-2 rounded-full"
                style={{ height: 32, fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: t.ink, background: t.sunken, border: `1px solid ${t.hairline}` }}>
          {h.loading ? 'Loading…' : `Load ${h.total - h.list.length} more`}
        </button>
      )}
      <p className="px-1 mt-3" style={{ fontFamily: FONT.prose, fontSize: 11, lineHeight: 1.5, color: t.inkDim }}>
        Risk level is Prisma AIRS’ own, read from each campaign’s report summary. ASR counts attack attempts that landed.
      </p>
    </div>
  )
}

export function LaunchCampaignRail({ t, tone, s }) {
  const tabs = [{ id: 'build', label: 'New campaign', icon: Swords }, { id: 'history', label: 'History', icon: History }]
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex gap-1.5 px-3 pt-3.5 flex-shrink-0" role="tablist" aria-label="Red Teaming">
        {tabs.map((x) => {
          const on = s.railTab === x.id
          return (
            <button key={x.id} type="button" role="tab" aria-selected={on} onClick={() => s.setRailTab(x.id)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full whitespace-nowrap ${focusCls}`}
                    style={{
                      height: 32, fontFamily: FONT.prose, fontSize: 12, fontWeight: on ? 700 : 500,
                      color: on ? '#fff' : t.inkDim, background: on ? bandBg(tone) : t.sunken,
                      border: `1px solid ${on ? 'transparent' : t.hairline}`, boxShadow: on ? `0 4px 12px ${tone}40` : 'none',
                    }}>
              <x.icon size={13} aria-hidden="true" /> {x.label}
            </button>
          )
        })}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {s.railTab === 'history' ? <HistoryTab t={t} tone={tone} s={s} /> : <Builder t={t} tone={tone} s={s} />}
      </div>
      {s.railTab === 'build' && <LaunchBar t={t} tone={tone} s={s} />}
    </div>
  )
}

