import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Cpu, ChevronDown, Search, X, RefreshCw, Loader2, Check, ArrowUpRight, AlertCircle, Building2, KeyRound, Copy } from 'lucide-react'
import { FONT } from '../api-intercept-2027/tokens'
import { shade, bandBg } from '../home-2027/band'
import { useModelCatalog } from '../api-intercept-2027/useModelLabel'

/**
 * LaunchModelPicker — the model picker in the attack library's language.
 *
 * The closed control is a category card: a gradient icon in the target's
 * colour, the model as the title, its tier and vendor under it. Opened, the
 * providers are cards like the attack categories and the models rows like the
 * payloads — a tier dot where a payload has its severity dot, an arrow that
 * fills on hover, a check on the one in use.
 *
 * Behaviour is ModelSelector's (which Classic and the v1 console keep): the
 * catalogue comes from /api/models/<backend>, providers start closed with the
 * one in use marked, a filter opens every group, and a selection the server
 * does not serve heals to the first selectable model.
 */

// Tier is the point of the curated list: which models resist an injection and
// which comply. `weak` is the one that makes AIRS visible on stage; `denied`
// is an org policy (an AWS SCP, or vertexai.allowedModels), not this app.
const TIER = {
  frontier: { label: 'Frontier', color: '#0EA5E9' },
  fast:     { label: 'Fast',     color: '#06B6D4' },
  mid:      { label: 'Mid',      color: '#8C8C95' },
  weak:     { label: 'Weak',     color: '#E8A33D' },
  denied:   { label: 'Policy denied', color: '#E0553A' },
}

// On the AI-GW backend a group is an integration, i.e. a cloud: say so, and
// show the cloud's own logo rather than a monogram.
const INTEGRATION = {
  '@sudo-bedrock':  { name: 'AWS Bedrock',      hue: '#FF9900', logo: '/logo-aws.png', chip: 'AWS' },
  '@sudo-vertexai': { name: 'Google Vertex AI', hue: '#4285F4', logo: '/logo-gcp.png', chip: 'GCP' },
}

// Vendor colours for the monogram icons. Anything unlisted gets a stable hue
// from the palette, so a new vendor still looks deliberate.
const VENDOR_HUE = {
  anthropic: '#D97757', openai: '#10A37F', meta: '#0668E1', 'mistral ai': '#FA520F', mistral: '#FA520F',
  google: '#4285F4', amazon: '#FF9900', nvidia: '#76B900', deepseek: '#4D6BFE', qwen: '#615CED',
  alibaba: '#615CED', xai: '#6B7280', moonshot: '#475569', 'moonshot ai': '#475569', writer: '#7C3AED',
  'z.ai': '#2563EB', microsoft: '#0078D4', cohere: '#39594D', ai21: '#E91E63',
}
const PALETTE = ['#EF4444', '#F97316', '#A855F7', '#14B8A6', '#EC4899', '#0EA5E9', '#84CC16']
const hueOf = (name) => {
  const k = String(name || '').toLowerCase()
  if (VENDOR_HUE[k]) return VENDOR_HUE[k]
  let h = 0
  for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

const slugOf = (s) => /(@[\w-]+)/.exec(String(s || ''))?.[1] ?? null
const ADC_LOGIN_CMD = 'gcloud auth application-default login'
const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

// ─── pieces ──────────────────────────────────────────────────────────────────

/** The gradient app icon: a cloud logo on white, or the vendor's initial. */
function GroupIcon({ group, size = 32 }) {
  const integ = INTEGRATION[slugOf(group.key)]
  if (integ) {
    return (
      <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: size, height: size, background: '#fff', boxShadow: `inset 0 0 0 1px ${integ.hue}40` }}>
        <img src={integ.logo} alt="" style={{ height: Math.round(size * 0.45), width: 'auto' }} />
      </span>
    )
  }
  const hue = hueOf(group.key)
  return (
    <span className="grid place-items-center rounded-xl flex-shrink-0" style={{ width: size, height: size, background: bandBg(hue) }} aria-hidden="true">
      <span style={{ fontFamily: FONT.display, fontSize: Math.round(size * 0.44), fontWeight: 700, color: '#fff', lineHeight: 1 }}>
        {(group.key || 'M').trim().charAt(0).toUpperCase()}
      </span>
    </span>
  )
}

function ModelRow({ t, m, grouped, selected, tone, onPick, index }) {
  const reduce = useReducedMotion()
  const [hot, setHot] = useState(false)
  const tier = TIER[m.tier]
  const denied = m.tier === 'denied'
  const shownId = grouped ? m.id.replace(/^@[\w-]+\//, '') : m.id
  const dot = tier?.color ?? (m.status === 'available' ? t.pass : t.idle)
  const fill = shade(tone)
  return (
    <motion.button type="button" onClick={() => onPick(m.id)} aria-pressed={selected}
                   initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: denied ? 0.6 : 1, x: 0 }}
                   transition={{ delay: Math.min(index * 0.02, 0.24), duration: 0.18 }}
                   onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
                   title={m.id}
                   className={`w-full flex items-start gap-2.5 rounded-xl text-left ${focusCls}`}
                   style={{ padding: '7px 8px 7px 10px', background: selected ? `${tone}14` : hot ? `${tone}0d` : 'transparent', transition: 'background 140ms ease' }}>
      <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: dot, marginTop: 7 }} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: selected ? 700 : 600, color: t.ink }}>{m.label ?? m.id}</span>
          {m.verified === false && !denied && (
            <span className="rounded-full px-1.5 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 600, color: t.isLight ? '#6D28D9' : '#C4B5FD', background: 'rgba(139,92,246,0.14)' }}>
              unverified
            </span>
          )}
        </span>
        <span className="block truncate" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, marginTop: 1 }}>
          {tier && <span style={{ textTransform: 'uppercase', color: t.isLight ? shade(tier.color, 0.35) : tier.color }}>{tier.label}</span>}
          {tier ? ' · ' : ''}{shownId}
        </span>
        {m.note && (
          <span className="block" style={{
            fontFamily: FONT.prose, fontSize: 10.5, lineHeight: 1.4, color: t.inkDim, marginTop: 2,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{m.note}</span>
        )}
      </span>
      <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
            style={{
              width: 26, height: 26, marginTop: 1,
              color: selected || hot ? '#fff' : t.inkDim,
              background: selected || hot ? fill : t.sunken,
              transition: 'background 140ms ease, color 140ms ease',
            }}>
        {selected ? <Check size={13} strokeWidth={3} /> : <ArrowUpRight size={13} />}
      </span>
    </motion.button>
  )
}

function GroupCard({ t, group, open, onToggle, inUse, children }) {
  const [hot, setHot] = useState(false)
  const integ = INTEGRATION[slugOf(group.key)]
  const hue = integ?.hue ?? hueOf(group.key)
  return (
    <div className="rounded-2xl overflow-hidden"
         style={{
           background: t.panel,
           border: `1px solid ${open || hot ? `${hue}55` : t.hairline}`,
           boxShadow: open ? `0 10px 24px ${hue}1f` : hot ? t.shadowSm : 'none',
           transition: 'border-color 160ms ease, box-shadow 200ms ease',
         }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
              onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
              className={`w-full flex items-center gap-3 text-left ${focusCls}`} style={{ padding: '8px 10px' }}>
        <GroupIcon group={group} size={30} />
        <span className="flex-1 min-w-0">
          <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink, lineHeight: 1.2 }}>
            {integ?.name ?? (group.key || 'Models')}
          </span>
          {integ && <span className="block truncate" style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkDim, marginTop: 1 }}>{slugOf(group.key)}</span>}
        </span>
        {inUse && (
          <span className="rounded-full px-2 py-0.5 flex-shrink-0" style={{ fontFamily: FONT.prose, fontSize: 10, fontWeight: 700, color: t.isLight ? shade(hue, 0.3) : hue, background: `${hue}1c` }}>
            in use
          </span>
        )}
        <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim }}>{group.models.length}</span>
        <ChevronDown size={13} className="flex-shrink-0" style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }} className="overflow-hidden">
            <div className="px-1.5 pb-1.5 pt-0.5" style={{ borderTop: `1px solid ${t.hairline}` }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * A footnote row under the picker — collapsed to one line, because it is a
 * footnote until the moment it is the whole problem.
 */
function Footnote({ t, icon: Icon, tone, title, children }) {
  const [open, setOpen] = useState(false)
  const ink = t.isLight ? shade(tone, 0.3) : tone
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: `${tone}0d`, border: `1px solid ${tone}33` }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className={`w-full flex items-center gap-2 text-left ${focusCls}`} style={{ padding: '6px 8px' }}>
        <span className="grid place-items-center rounded-lg flex-shrink-0" style={{ width: 22, height: 22, background: `${tone}1f`, color: ink }}>
          <Icon size={12} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0 truncate" style={{ fontFamily: FONT.prose, fontSize: 11.5, fontWeight: 600, color: ink }}>{title}</span>
        <ChevronDown size={12} className="flex-shrink-0" style={{ color: ink, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="px-2.5 pb-2.5" style={{ fontFamily: FONT.prose, fontSize: 11.5, lineHeight: 1.5, color: t.inkDim }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CopyCmd({ t, cmd }) {
  const [done, setDone] = useState(false)
  return (
    <div className="flex items-center gap-2 mt-1.5 rounded-lg px-2.5 py-1.5" style={{ background: t.codeBg, border: `1px solid ${t.hairline}` }}>
      <code className="flex-1 min-w-0 break-all" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.ink, userSelect: 'all' }}>{cmd}</code>
      <button type="button" title="Copy" aria-label="Copy command"
              onClick={() => { navigator.clipboard?.writeText(cmd); setDone(true); setTimeout(() => setDone(false), 1200) }}
              style={{ color: done ? t.pass : t.inkDim, flexShrink: 0 }}>
        {done ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  )
}

// ─── the picker ──────────────────────────────────────────────────────────────

export function LaunchModelPicker({ t, backend, model, onModelChange, target }) {
  const { models, loading, error, reload } = useModelCatalog(backend)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [openGroups, setOpenGroups] = useState({})
  const [hot, setHot] = useState(false)
  const ref = useRef(null)
  const tone = target?.tone ?? t.live

  // Self-heal a selection the server does not serve (a retired id, a model
  // dropped from the curated set): the control would show a raw id and the
  // first fire would fail.
  useEffect(() => {
    if (loading || !models.length) return
    if (models.some((m) => m.id === model)) return
    const fallback = models.find((m) => m.status !== 'unavailable') ?? models[0]
    if (fallback && fallback.id !== model) onModelChange(fallback.id)
  }, [models, loading, model, onModelChange])

  useEffect(() => {
    if (!open) return
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const key = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])

  // A new target is a new list: forget the filter and which groups were open.
  useEffect(() => { setFilter(''); setOpenGroups({}); setOpen(false) }, [backend])

  const q = filter.trim().toLowerCase()
  const filtered = useMemo(() => (q
    ? models.filter((m) => [m.label, m.id, m.provider].some((v) => v?.toLowerCase().includes(q)))
    : models), [models, q])

  const groups = useMemo(() => {
    const out = []
    const by = new Map()
    for (const m of filtered) {
      const key = m.provider || ''
      if (!by.has(key)) { const g = { key, models: [] }; by.set(key, g); out.push(g) }
      by.get(key).models.push(m)
    }
    return out
  }, [filtered])
  const grouped = groups.length > 1

  const active = models.find((m) => m.id === model)
  const activeTier = TIER[active?.tier]
  const activeSlug = slugOf(/^(@[\w-]+)\//.exec(String(model || ''))?.[1])
  const integ = INTEGRATION[activeSlug]
  const pick = (id) => { onModelChange(id); setOpen(false); setFilter('') }

  return (
    <div className="relative" ref={ref}>
      {/* ── closed control: a category card ── */}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox"
              onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
              className={`w-full flex items-center gap-3 rounded-2xl text-left ${focusCls}`}
              style={{
                padding: '9px 10px', background: t.panel,
                border: `1px solid ${open || hot ? `${tone}66` : t.hairline}`,
                boxShadow: open ? `0 10px 24px ${tone}24` : hot ? t.shadowSm : 'none',
                transition: 'border-color 160ms ease, box-shadow 200ms ease',
              }}>
        <span className="grid place-items-center rounded-xl flex-shrink-0"
              style={{ width: 34, height: 34, background: bandBg(tone), boxShadow: open || hot ? `0 5px 12px ${tone}55` : 'none', transition: 'box-shadow 180ms ease' }}>
          <Cpu size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block truncate" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink, lineHeight: 1.2 }}>
            {active?.label ?? (loading ? 'Loading models…' : String(model || '').split('/').pop())}
          </span>
          <span className="flex items-center gap-1.5 truncate" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, marginTop: 2 }}>
            {activeTier && <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: activeTier.color }} aria-hidden="true" />}
            <span className="truncate">
              {['Model', activeTier?.label, integ ? integ.chip : active?.provider].filter(Boolean).join(' · ')}
            </span>
          </span>
        </span>
        {loading
          ? <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: t.inkDim }} />
          : <ChevronDown size={13} className="flex-shrink-0" style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} aria-hidden="true" />}
      </button>

      {/* ── which tenant / how it authenticates ── */}
      {backend === 'aigw' && (
        <div className="mt-2">
          {/* The AI-GW route logs to the personal tenant; without this line an
              audience looks in the team console and concludes nothing was scanned. */}
          <Footnote t={t} icon={Building2} tone="#EC4899" title="Logs → SUDO-Personal · TSG 1698236796">
            Same tenant as Ministry of Health. Vertex, Bedrock and Azure log to the team tenant instead —
            an AI-GW scan will not appear in their console.
          </Footnote>
        </div>
      )}
      {backend === 'vertex' && (
        <div className="mt-2">
          <Footnote t={t} icon={KeyRound} tone="#4285F4" title="Auth → keyless ADC · renew if FAULT">
            No service-account key: corp policy caps them at 30 days. Local uses an Application Default
            Credentials login; EC2 uses Workload Identity Federation off its instance role and never expires.
            <CopyCmd t={t} cmd={ADC_LOGIN_CMD} />
            <span className="block mt-1.5" style={{ fontSize: 10.5 }}>Then restart the Express server — GoogleAuth caches its client.</span>
          </Footnote>
        </div>
      )}

      {/* ── the list: provider cards, model rows ── */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15 }} role="listbox"
                      className="absolute left-0 right-0 z-50 flex flex-col overflow-hidden"
                      style={{
                        top: 'calc(100% + 6px)', maxHeight: 'min(560px, 66vh)', minWidth: 280,
                        background: t.isLight ? '#FAFAFB' : t.raised, borderRadius: 22,
                        border: `1px solid ${tone}40`, boxShadow: t.isLight ? '0 18px 44px rgba(18,18,22,0.16)' : '0 18px 44px rgba(0,0,0,0.55)',
                      }}>
            <div className="flex-shrink-0 flex items-center gap-2 px-3 pt-3 pb-2">
              <label className="flex-1 flex items-center gap-2 rounded-full px-3.5" style={{ height: 34, background: t.panel, border: `1px solid ${t.hairline}` }}>
                <Search size={13} style={{ color: t.inkDim }} className="flex-shrink-0" aria-hidden="true" />
                <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)}
                       placeholder={`Filter ${target?.label ?? ''} models…`} aria-label="Filter models"
                       ref={(el) => el?.style.setProperty('background-color', 'transparent', 'important')}
                       className="flex-1 min-w-0 outline-none" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink, border: 'none' }} />
                {filter && (
                  <button type="button" onClick={() => setFilter('')} aria-label="Clear filter" style={{ color: t.inkDim }}><X size={13} /></button>
                )}
              </label>
              <button type="button" onClick={reload} disabled={loading} title="Refresh the catalogue" aria-label="Refresh the catalogue"
                      className={`grid place-items-center rounded-full flex-shrink-0 ${focusCls}`}
                      style={{ width: 34, height: 34, background: t.panel, border: `1px solid ${t.hairline}`, color: t.inkDim, opacity: loading ? 0.5 : 1 }}>
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-2">
              {loading && !filtered.length ? (
                <div className="flex items-center justify-center gap-2 py-8" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>
                  <Loader2 size={13} className="animate-spin" /> Loading models…
                </div>
              ) : error && !filtered.length ? (
                <div className="px-3 py-6 text-center">
                  <AlertCircle size={18} className="mx-auto mb-1.5" style={{ color: t.block }} />
                  <p style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>{error}</p>
                  <button type="button" onClick={reload} className="mt-2 underline" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.ink }}>Retry</button>
                </div>
              ) : !filtered.length ? (
                <p className="py-8 text-center" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>No models match “{filter}”.</p>
              ) : grouped ? (
                groups.map((g) => (
                  <GroupCard key={g.key || 'all'} t={t} group={g}
                             open={q ? true : !!openGroups[g.key]} inUse={g.models.some((m) => m.id === model)}
                             onToggle={() => setOpenGroups((s) => ({ ...s, [g.key]: !s[g.key] }))}>
                    {g.models.map((m, i) => (
                      <ModelRow key={m.id} t={t} m={m} grouped selected={m.id === model} tone={tone} onPick={pick} index={i} />
                    ))}
                  </GroupCard>
                ))
              ) : (
                <div className="rounded-2xl p-1.5" style={{ background: t.panel, border: `1px solid ${t.hairline}` }}>
                  {filtered.map((m, i) => (
                    <ModelRow key={m.id} t={t} m={m} grouped={false} selected={m.id === model} tone={tone} onPick={pick} index={i} />
                  ))}
                </div>
              )}
            </div>

            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2" style={{ borderTop: `1px solid ${t.hairline}` }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>
                {q ? `${filtered.length} of ${models.length}` : models.length} model{models.length === 1 ? '' : 's'}
              </span>
              <span className="flex items-center gap-2" style={{ fontFamily: FONT.prose, fontSize: 10.5, color: t.inkDim }}>
                {['frontier', 'weak', 'denied'].map((k) => (
                  <span key={k} className="inline-flex items-center gap-1">
                    <span className="rounded-full" style={{ width: 6, height: 6, background: TIER[k].color }} aria-hidden="true" />{TIER[k].label}
                  </span>
                ))}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
