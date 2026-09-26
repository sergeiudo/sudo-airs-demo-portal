import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Search, X, ChevronDown, ShieldCheck, Check, ArrowUpRight, Zap, Terminal, Scissors, Database, AlertTriangle, Wrench, Skull } from 'lucide-react'
import { ATTACK_CATEGORIES } from '../../data/mockData'
import { LaunchModelPicker } from './LaunchModelPicker'
import { LaunchMcpPanel } from './LaunchMcpPanel'
import { FONT, label as LBL, SEVERITY } from '../api-intercept-2027/tokens'
import { shade, bandBg, bandDots } from '../home-2027/band'

/**
 * LaunchLibrary — the runtime console's left rail, in the launcher's language.
 *
 * Replaces the shared AttackLibrary for this console only (Classic still uses
 * it): the four targets become colour-banded cards — the selected one takes
 * its cloud's band, the others sit as soft cards — and each attack category is
 * an app-style row with a gradient icon. The model picker and MCP panel are
 * drawn the same way (LaunchModelPicker, LaunchMcpPanel); Classic and the v1
 * console keep the shared ModelSelector and McpServerPanel.
 *
 * Search and firing behave exactly as before: search spans both category
 * shapes (flat `attacks`, Jailbreak Bench's nested `subCategories`), matches
 * open automatically, and clicking a payload fires it.
 */

export const TARGETS = [
  { id: 'vertex', label: 'Vertex AI', cloud: 'Google Cloud', how: 'API-layer scan', logo: '/logo-gcp.png', tone: '#4285F4' },
  { id: 'bedrock', label: 'Bedrock', cloud: 'AWS', how: 'API-layer scan', logo: '/logo-aws.png', tone: '#FF9900' },
  { id: 'azure', label: 'Azure OpenAI', cloud: 'Microsoft', how: 'API-layer scan', logo: '/logo-azure.png', tone: '#0078D4' },
  // A route, not a vendor: the guardrail runs inside the SCM AI Gateway.
  { id: 'aigw', label: 'SCM AI-GW', cloud: 'Bedrock + Vertex', how: 'in-gateway', logo: null, tone: '#EC4899' },
]

const ICONS = { Syringe: Zap, Terminal, Scissors, Database, AlertTriangle, Wrench, Skull }
const HUES = { red: '#EF4444', orange: '#F97316', yellow: '#EAB308', purple: '#A855F7', pink: '#EC4899', teal: '#14B8A6' }
const focusCls = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

const countOf = (c) => c.attacks?.length ?? c.subCategories?.reduce((s, sc) => s + (sc.attacks?.length ?? 0), 0) ?? 0

// ─── targets ─────────────────────────────────────────────────────────────────

function TargetCard({ t, target, active, onPick }) {
  const [hot, setHot] = useState(false)
  const sh = shade(target.tone)
  return (
    <button type="button" onClick={() => onPick(target.id)} aria-pressed={active}
            onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
            className={`relative flex items-center gap-2.5 text-left overflow-hidden rounded-2xl ${focusCls}`}
            style={{
              height: 62, padding: '0 10px',
              background: active ? bandBg(target.tone) : t.panel,
              border: `1px solid ${active ? 'transparent' : hot ? `${target.tone}88` : t.hairline}`,
              boxShadow: active ? `0 8px 20px ${target.tone}44` : hot ? `0 8px 18px ${target.tone}26` : 'none',
              transition: 'border-color 160ms ease, box-shadow 200ms ease',
            }}>
      {active && <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={bandDots} />}
      <span className="relative grid place-items-center rounded-xl flex-shrink-0"
            style={{ width: 32, height: 32, background: active ? '#fff' : t.sunken, border: active ? 'none' : `1px solid ${t.hairline}` }}>
        {target.logo
          ? <img src={target.logo} alt="" style={{ height: 15, width: 'auto', filter: active || hot ? 'none' : 'grayscale(35%)', opacity: active || hot ? 1 : 0.8 }} />
          : <ShieldCheck size={16} style={{ color: active || hot ? target.tone : t.inkDim }} aria-hidden="true" />}
      </span>
      <span className="relative min-w-0 flex flex-col leading-tight">
        <span className="truncate" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: active ? '#fff' : t.ink }}>{target.label}</span>
        <span className="truncate" style={{ fontFamily: FONT.mono, fontSize: 9.5, color: active ? 'rgba(255,255,255,0.85)' : t.inkDim, marginTop: 2 }}>{target.how}</span>
      </span>
      {active && (
        <span className="absolute grid place-items-center rounded-full" style={{ top: 6, right: 6, width: 16, height: 16, background: '#fff', color: sh }} aria-hidden="true">
          <Check size={10} strokeWidth={3} />
        </span>
      )}
    </button>
  )
}

// ─── attacks ─────────────────────────────────────────────────────────────────

function AttackRow({ t, attack, hue, onFire, index }) {
  const reduce = useReducedMotion()
  const [hot, setHot] = useState(false)
  const sev = SEVERITY[attack.severity] ?? t.idle
  return (
    <motion.button type="button" onClick={() => onFire(attack)}
                   initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: Math.min(index * 0.025, 0.3), duration: 0.2 }}
                   onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
                   title={attack.payload?.slice(0, 280)}
                   className={`w-full flex items-center gap-2.5 rounded-xl text-left ${focusCls}`}
                   style={{ padding: '7px 8px 7px 10px', background: hot ? `${hue}12` : 'transparent', transition: 'background 140ms ease' }}>
      <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: sev }} title={attack.severity} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate" style={{ fontFamily: FONT.prose, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{attack.label}</span>
        <span className="block truncate" style={{ fontFamily: FONT.mono, fontSize: 10, color: t.inkDim, marginTop: 1 }}>
          {attack.severity && <span style={{ textTransform: 'uppercase' }}>{attack.severity}</span>}
          {attack.technique ? ` · ${attack.technique}` : ''}
        </span>
      </span>
      <span className="grid place-items-center rounded-full flex-shrink-0" aria-hidden="true"
            style={{ width: 26, height: 26, color: hot ? '#fff' : t.inkDim, background: hot ? shade(hue) : t.sunken, transition: 'background 140ms ease, color 140ms ease' }}>
        <ArrowUpRight size={13} />
      </span>
    </motion.button>
  )
}

function Group({ t, label, count, hue, open, onToggle, children, small }) {
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open}
              className={`w-full flex items-center gap-2 rounded-lg text-left ${focusCls}`}
              style={{ padding: small ? '6px 8px' : '8px 10px', background: open ? `${hue}0d` : 'transparent' }}>
        <span className="flex-1 truncate" style={{ fontFamily: FONT.prose, fontSize: 12, fontWeight: 600, color: open ? t.ink : t.inkDim }}>{label}</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>{count}</span>
        <ChevronDown size={12} style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }} className="overflow-hidden">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CategoryCard({ t, category, onFire, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const [hot, setHot] = useState(false)
  const [subOpen, setSubOpen] = useState(() => (defaultOpen ? Object.fromEntries((category.subCategories ?? []).map((s) => [s.id, true])) : {}))
  const Icon = ICONS[category.icon] ?? Zap
  const hue = HUES[category.color] ?? HUES.red
  const nested = Array.isArray(category.subCategories)

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{
           background: t.panel,
           border: `1px solid ${open ? `${hue}55` : hot ? `${hue}55` : t.hairline}`,
           boxShadow: open ? `0 10px 24px ${hue}1f` : hot ? t.shadowSm : 'none',
           transition: 'border-color 160ms ease, box-shadow 200ms ease',
         }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
              className={`w-full flex items-center gap-3 text-left ${focusCls}`} style={{ padding: '9px 10px' }}>
        <span className="relative grid place-items-center rounded-xl flex-shrink-0 overflow-hidden"
              style={{ width: 34, height: 34, background: bandBg(hue), boxShadow: open || hot ? `0 5px 12px ${hue}55` : 'none', transition: 'box-shadow 180ms ease' }}>
          <Icon size={15} style={{ color: '#fff' }} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0" style={{ fontFamily: FONT.display, fontSize: 13, fontWeight: 700, color: t.ink, lineHeight: 1.2 }}>
          {category.label}
        </span>
        {category.badge && (
          <span className="rounded px-1.5 py-0.5 flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 9, fontWeight: 700, color: shade(hue, 0.3), background: `${hue}18` }}>
            {category.badge}
          </span>
        )}
        <span className="flex-shrink-0" style={{ fontFamily: FONT.mono, fontSize: 11, color: t.inkDim }}>{countOf(category)}</span>
        <ChevronDown size={13} className="flex-shrink-0" style={{ color: t.inkDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} aria-hidden="true" />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }} className="overflow-hidden">
            <div className="px-1.5 pb-1.5 pt-0.5" style={{ borderTop: `1px solid ${t.hairline}` }}>
              {nested
                ? category.subCategories.map((sc) => (
                    <Group key={sc.id} t={t} label={sc.label} count={sc.attacks?.length ?? 0} hue={hue} small
                           open={!!subOpen[sc.id]} onToggle={() => setSubOpen((s) => ({ ...s, [sc.id]: !s[sc.id] }))}>
                      <div className="pl-2">
                        {sc.attacks?.map((a, i) => <AttackRow key={a.id} t={t} attack={a} hue={hue} onFire={onFire} index={i} />)}
                      </div>
                    </Group>
                  ))
                : category.attacks?.map((a, i) => <AttackRow key={a.id} t={t} attack={a} hue={hue} onFire={onFire} index={i} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── the rail ────────────────────────────────────────────────────────────────

export function LaunchLibrary({ t, onFire, backend, model, onBackendChange, onModelChange, mcp, onMcpChange }) {
  const [query, setQuery] = useState('')
  const total = useMemo(() => ATTACK_CATEGORIES.reduce((a, c) => a + countOf(c), 0), [])
  const q = query.trim().toLowerCase()
  const categories = useMemo(() => {
    if (!q) return ATTACK_CATEGORIES
    const hit = (a) => [a.label, a.id, a.technique, a.payload].some((v) => v?.toLowerCase().includes(q))
    return ATTACK_CATEGORIES.map((c) => {
      if (Array.isArray(c.attacks)) {
        const attacks = c.attacks.filter(hit)
        return attacks.length ? { ...c, attacks } : null
      }
      const subCategories = (c.subCategories ?? []).map((sc) => {
        const attacks = (sc.attacks ?? []).filter(hit)
        return attacks.length ? { ...sc, attacks } : null
      }).filter(Boolean)
      return subCategories.length ? { ...c, subCategories } : null
    }).filter(Boolean)
  }, [q])
  const shown = categories.reduce((a, c) => a + countOf(c), 0)

  return (
    <div className="flex flex-col h-full">
      {/* ── target ── */}
      <div className="flex-shrink-0 px-3 pt-3.5">
        <div className="flex items-center px-1 mb-2">
          <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Target</span>
          <span className="ml-auto" style={{ fontFamily: FONT.mono, fontSize: 9.5, color: t.inkDim }}>switching starts a new session</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TARGETS.map((tg) => <TargetCard key={tg.id} t={t} target={tg} active={backend === tg.id} onPick={onBackendChange} />)}
        </div>
        <div className="mt-2">
          <LaunchModelPicker t={t} backend={backend} model={model} onModelChange={onModelChange}
                             target={TARGETS.find((tg) => tg.id === backend)} />
        </div>
        {/* MCP is only wired on the AI-GW lane — the other three are direct
            provider calls with no gateway to broker a tool server. */}
        {backend === 'aigw' && (
          <div className="mt-2">
            <LaunchMcpPanel t={t} enabled={mcp.enabled} server={mcp.server} onChange={onMcpChange} />
          </div>
        )}
      </div>

      {/* ── attack library ── */}
      <div className="flex-shrink-0 px-3 pt-4 mt-3" style={{ borderTop: `1px solid ${t.hairline}` }}>
        <div className="flex items-center px-1 mb-2">
          <span style={{ ...LBL, fontSize: 9.5, color: t.inkDim }}>Attack library</span>
          <span className="ml-auto" style={{ fontFamily: FONT.mono, fontSize: 10.5, color: t.inkDim }}>
            {q ? `${shown} of ${total}` : `${total} payloads`}
          </span>
        </div>
        <label className="flex items-center gap-2 rounded-full px-3.5" style={{ height: 36, background: t.sunken, border: `1px solid ${t.hairline}` }}>
          <Search size={13} style={{ color: t.inkDim }} className="flex-shrink-0" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search payloads, techniques, ids…"
                 aria-label="Search the attack library"
                 ref={(el) => el?.style.setProperty('background-color', 'transparent', 'important')}
                 className="flex-1 min-w-0 outline-none" style={{ fontFamily: FONT.prose, fontSize: 12.5, color: t.ink, border: 'none' }} />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="flex-shrink-0" style={{ color: t.inkDim }}>
              <X size={13} />
            </button>
          )}
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-2.5 pb-3 space-y-2">
        {categories.length === 0 && (
          <p className="px-2 py-6 text-center" style={{ fontFamily: FONT.prose, fontSize: 12, color: t.inkDim }}>
            Nothing matches “{query}”. Try a technique, a payload id, or words from the payload.
          </p>
        )}
        {categories.map((c) => (
          <CategoryCard key={c.id + (q ? `-${q}` : '')} t={t} category={c} onFire={onFire} defaultOpen={!!q} />
        ))}
      </div>
    </div>
  )
}
