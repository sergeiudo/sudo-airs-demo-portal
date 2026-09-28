import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  FlaskConical, Play, Loader2, ShieldCheck, ShieldX, AlertTriangle, ChevronDown, Lock, ArrowUpRight, Terminal, Waypoints, Boxes, Wrench, FileSearch,
} from 'lucide-react'
import { FONT, label as LBL, glass } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots } from '../home-2027/band'
import { CodeTabs, CopyIcon } from './CodeTabs'
import { Inline, DocLinks } from './Blocks'
import { LIVE, curlFor } from './live'
import { GUIDES, GROUP_BY_ID } from './guides'

/**
 * LivePanel — "Run it live". The right-hand pane of the Developer Corner: the
 * active guide's call, sent for real from this portal (/api/dev/*), with the
 * exact request and response shown. Keys never reach the browser; the echo
 * masks them. A guide without a runnable call gets its references instead.
 */

const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
const ICON = { 'runtime.scan': Terminal, 'runtime.response': Terminal, 'runtime.report': FileSearch, 'runtime.tool': Wrench, 'gateway.chat': Waypoints, 'ms.scans': Boxes }

function Band({ t, tone, icon: Icon, eyebrow, title, sub }) {
  return (
    <div className="relative overflow-hidden flex-shrink-0" style={{ minHeight: 96, background: bandBg(tone) }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
      <Icon aria-hidden="true" strokeWidth={1.3} style={{ position: 'absolute', right: -22, bottom: -40, width: 140, height: 140, color: '#fff', opacity: 0.14, transform: 'rotate(-10deg)' }} />
      <div className="relative flex items-center gap-3 px-4 py-4">
        <span className="grid place-items-center rounded-2xl flex-shrink-0" style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
          <Icon size={20} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="truncate" style={{ ...LBL, fontSize: 9.5, color: 'rgba(255,255,255,0.85)' }}>{eyebrow}</div>
          <div className="break-words" dir="ltr" style={{ fontFamily: FONT.display, fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 2 }}>{title}</div>
          {sub && <div style={{ fontFamily: FONT.prose, fontSize: 11.5, color: 'rgba(255,255,255,0.92)', marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

function Section({ t, title, sub, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className={`w-full flex items-center gap-2 text-left ${focusCls}`} style={{ padding: '9px 12px' }}>
        <span className="flex-1 min-w-0">
          <span className="block" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink }}>{title}</span>
          {sub && <span className="block truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim, marginTop: 1 }}>{sub}</span>}
        </span>
        <ChevronDown size={14} style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="px-2 pb-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Json({ value }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return <CodeTabs tabs={[{ id: 'json', lang: 'json', code: text }]} compact maxHeight={360} />
}

function Verdict({ t, spec, result }) {
  const v = spec.verdict(result)
  const tone = v.tone === 'block' ? t.block : v.tone === 'pass' ? t.pass : v.tone === 'warn' ? t.warn : t.live
  const Icon = v.tone === 'block' ? ShieldX : v.tone === 'pass' ? ShieldCheck : AlertTriangle
  const reduce = useReducedMotion()
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl" style={{ background: bandBg(tone) }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />
      <div className="relative flex items-center gap-3 px-3.5 py-3">
        <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)' }}>
          <Icon size={17} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{v.title}</div>
          <div className="break-words" style={{ fontFamily: FONT.prose, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 1 }}>{v.sub}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div style={{ fontFamily: FONT.display, fontSize: 16, fontWeight: 700, color: '#fff' }}>{result.elapsedMs} ms</div>
          <div style={{ fontFamily: FONT.prose, fontSize: 10.5, color: 'rgba(255,255,255,0.85)' }}>HTTP {result.response?.status || '—'} · measured</div>
        </div>
      </div>
    </motion.div>
  )
}

function Runner({ t, spec, status, preset, onVars }) {
  const [presetIdx, setPresetIdx] = useState(0)
  const [vars, setVars] = useState(() => ({ ...(spec.presets?.[0]?.vars ?? {}) }))
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState(null)
  const [steps, setSteps] = useState([])

  // A guide can ask for a preset by id (a "run this" hint in the text).
  // `preset` is { id, n } so asking for the same preset twice still lands.
  useEffect(() => {
    if (!preset?.id) return
    const i = (spec.presets ?? []).findIndex((p) => p.id === preset.id)
    if (i >= 0) { setPresetIdx(i); setVars({ ...spec.presets[i].vars }); setResult(null); setSteps([]) }
  }, [preset]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onVars?.(vars) }, [vars]) // eslint-disable-line react-hooks/exhaustive-deps

  const ready = spec.ready(status)
  const run = async () => {
    setBusy(true); setErr(null); setResult(null); setSteps([])
    try {
      const out = await spec.run(vars, (s) => setSteps((x) => [...x, s]))
      setResult(out)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {!ready && (
        <div className="flex gap-2.5 rounded-2xl px-3 py-2.5" style={{ background: `${t.warn}12`, border: `1px solid ${t.warn}44` }}>
          <AlertTriangle size={14} style={{ color: t.isLight ? shade(t.warn, 0.4) : t.warn, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div style={{ fontFamily: FONT.prose, fontSize: 12, lineHeight: 1.5, color: t.ink }}>
            Not configured on this host: <Inline t={t} text={spec.needs} />. The code on the left still works in your own environment.
          </div>
        </div>
      )}

      {spec.presets?.length > 1 && (
        <div>
          <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, marginBottom: 6 }}>Try</div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Preset">
            {spec.presets.map((p, i) => {
              const on = i === presetIdx
              const c = p.tone === 'attack' ? t.block : p.tone === 'data' ? t.warn : t.pass
              return (
                <button key={p.id} type="button" role="radio" aria-checked={on}
                        onClick={() => { setPresetIdx(i); setVars({ ...p.vars }); setResult(null); setSteps([]) }}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 ${focusCls}`}
                        style={{ height: 28, fontFamily: FONT.prose, fontSize: 12, fontWeight: on ? 700 : 500, color: on ? '#fff' : t.ink, background: on ? bandBg(c) : t.sunken, border: `1px solid ${on ? 'transparent' : t.hairline}` }}>
                  <span className="rounded-full" style={{ width: 6, height: 6, background: on ? '#fff' : c }} aria-hidden="true" />
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {(spec.fields ?? []).map((f) => (
        f.type === 'toggle' ? (
          <label key={f.key} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
            <span className="min-w-0">
              <span className="block" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{f.label}</span>
              {f.hint && <span className="block" style={{ fontFamily: FONT.prose, fontSize: 11, color: t.inkDim }}>{f.hint(vars[f.key])}</span>}
            </span>
            <button type="button" role="switch" aria-checked={!!vars[f.key]} aria-label={f.label}
                    onClick={() => setVars((v) => ({ ...v, [f.key]: !v[f.key] }))}
                    className={`relative flex-shrink-0 rounded-full ${focusCls}`}
                    style={{ width: 36, height: 21, background: vars[f.key] ? shade(t.pass, 0.15) : t.isLight ? '#D4D4D8' : '#3F3F46' }}>
              <motion.span className="absolute rounded-full" style={{ top: 2.5, width: 16, height: 16, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                           animate={{ left: vars[f.key] ? 17.5 : 2.5 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
            </button>
          </label>
        ) : (
          <div key={f.key}>
            <div className="flex items-baseline justify-between" style={{ marginBottom: 5 }}>
              <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>{f.label}</span>
              {f.optional && <span style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkFaint }}>optional</span>}
            </div>
            <textarea value={vars[f.key] ?? ''} rows={f.rows ?? 3} dir="auto"
                      onChange={(e) => setVars((v) => ({ ...v, [f.key]: e.target.value }))}
                      ref={(el) => el?.style.setProperty('background-color', t.sunken, 'important')}
                      className="w-full resize-y rounded-xl outline-none"
                      style={{ padding: '8px 10px', fontFamily: f.mono ? FONT.mono : FONT.prose, fontSize: f.mono ? 11.5 : 13, lineHeight: 1.5, color: t.ink, border: `1px solid ${t.hairline}` }} />
          </div>
        )
      ))}

      <button type="button" onClick={run} disabled={busy || !ready || !spec.canRun(vars)}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-full disabled:opacity-50 ${focusCls}`}
              style={{ height: 40, fontFamily: FONT.display, fontSize: 14, fontWeight: 700, color: '#fff', background: bandBg(t.live), boxShadow: `0 8px 20px ${t.live}44` }}>
        {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
        {busy ? 'Calling the real API…' : spec.runLabel ?? 'Run it'}
      </button>

      {err && (
        <div className="rounded-2xl px-3 py-2.5" style={{ background: `${t.warn}12`, border: `1px solid ${t.warn}44`, fontFamily: FONT.prose, fontSize: 12.5, color: t.ink }}>{err}</div>
      )}

      {steps.map((s, i) => (
        <div key={i} className="space-y-2">
          <Verdict t={t} spec={s.spec} result={s.result} />
          <Exchange t={t} result={s.result} />
        </div>
      ))}

      {result && (
        <div className="space-y-2">
          <Verdict t={t} spec={spec} result={result} />
          {spec.explain && <div className="rounded-2xl px-3 py-2.5" style={{ background: t.sunken, fontFamily: FONT.prose, fontSize: 12.5, lineHeight: 1.55, color: t.inkDim }}><Inline t={t} text={spec.explain(result)} /></div>}
          <Exchange t={t} result={result} />
        </div>
      )}
    </div>
  )
}

function Exchange({ t, result }) {
  const req = result.request
  return (
    <>
      <Section t={t} title="Response" sub={`HTTP ${result.response?.status} · ${Object.keys(result.response?.headers ?? {}).length} headers kept`} defaultOpen>
        <div className="space-y-2">
          {Object.keys(result.response?.headers ?? {}).length > 0 && <Json value={result.response.headers} />}
          <Json value={result.response?.body ?? result.error} />
        </div>
      </Section>
      <Section t={t} title="Request, exactly as sent" sub={`${req.method} ${req.url}`}>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="flex items-center gap-1.5" style={{ fontFamily: FONT.prose, fontSize: 11.5, color: t.inkDim }}>
              <Lock size={12} aria-hidden="true" /> Keys are masked — they never leave the server
            </span>
            <span className="flex items-center gap-1" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: t.inkDim }}>
              Copy as cURL <CopyIcon text={curlFor(req)} light={t.isLight} size={12} />
            </span>
          </div>
          <Json value={req.headers} />
          {req.body !== undefined && <Json value={req.body} />}
        </div>
      </Section>
      {result.tokenStep && (
        <Section t={t} title="Before it: the OAuth token request" sub={`${result.tokenStep.method} ${result.tokenStep.url}`}>
          <Json value={result.tokenStep} />
        </Section>
      )}
    </>
  )
}

// A reading guide has nothing to send — so its pane points at the ones that do.
function LiveGuideRow({ t, guide, status, onGo }) {
  const g = GROUP_BY_ID[guide.group]
  const spec = LIVE[guide.live]
  const ready = spec?.ready(status)
  const Icon = ICON[guide.live] ?? FlaskConical
  return (
    <button type="button" onClick={() => onGo?.(guide.id)}
            className={`w-full flex items-center gap-2.5 rounded-xl text-left ${focusCls}`} style={{ padding: '8px 8px' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = t.sunken }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: 30, height: 30, background: `${g.tone}17`, color: t.isLight ? shade(g.tone, 0.3) : g.tone }}>
        <Icon size={14} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{guide.title}</span>
        <span className="block truncate" dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, marginTop: 1 }}>{spec?.endpoint}</span>
      </span>
      <span className="rounded-full flex-shrink-0" title={ready ? 'Configured on this host' : 'Not configured on this host'}
            style={{ width: 7, height: 7, background: status == null ? t.inkFaint : ready ? t.pass : t.warn }} aria-hidden="true" />
    </button>
  )
}

export function LivePanel({ t, guide, status, preset, onVars, onGo }) {
  const spec = guide?.live ? LIVE[guide.live] : null
  // A "run this" hint in the guide flashes the panel, so the eye follows.
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (!preset?.n) return undefined
    setFlash(true)
    const id = setTimeout(() => setFlash(false), 1100)
    return () => clearTimeout(id)
  }, [preset])
  if (!guide) return null
  if (!spec) {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={glass(t, { radius: 22 })}>
        <Band t={t} tone={t.idle} icon={ArrowUpRight} eyebrow="References" title="Official docs for this guide" sub="Nothing to run here — this guide is set-up or reading" />
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
          {guide.docs?.length ? <DocLinks t={t} block={{ items: guide.docs }} dense /> : <p style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.inkDim }}>See the Docs library in the rail.</p>}
          <div className="pt-3" style={{ borderTop: `1px solid ${t.hairline}` }}>
            <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, margin: '0 0 2px 4px' }}>Guides with a live call</div>
            <p style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.5, color: t.inkDim, margin: '0 4px 6px' }}>Each sends its request for real from this portal and shows exactly what went out and what came back.</p>
            {GUIDES.filter((x, i, all) => x.live && all.findIndex((y) => y.live === x.live) === i).map((x) => <LiveGuideRow key={x.id} t={t} guide={x} status={status} onGo={onGo} />)}
          </div>
        </div>
      </div>
    )
  }
  const Icon = ICON[guide.live] ?? FlaskConical
  return (
    <div className="flex flex-col h-full overflow-hidden"
         style={{ ...glass(t, { radius: 22 }), boxShadow: flash ? `0 0 0 3px ${t.live}66, 0 14px 34px ${t.live}33` : glass(t, { radius: 22 }).boxShadow, transition: 'box-shadow 260ms' }}>
      <Band t={t} tone={t.live} icon={Icon} eyebrow="Run it live · real call from this portal" title={spec.endpoint} sub={spec.sub} />
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        <Runner key={guide.id} t={t} spec={spec} status={status} preset={preset} onVars={onVars} />
        {guide.docs?.length > 0 && (
          <div className="pt-3" style={{ borderTop: `1px solid ${t.hairline}` }}>
            <div style={{ ...LBL, fontSize: 9.5, color: t.inkDim, margin: '0 0 6px 4px' }}>Official docs</div>
            <DocLinks t={t} block={{ items: guide.docs }} dense />
          </div>
        )}
      </div>
    </div>
  )
}

export function useDevStatus() {
  const [status, setStatus] = useState(null)
  useEffect(() => {
    let alive = true
    fetch('/api/dev/status').then((r) => r.json()).then((d) => { if (alive) setStatus(d) }).catch(() => { if (alive) setStatus({}) })
    return () => { alive = false }
  }, [])
  return status
}

