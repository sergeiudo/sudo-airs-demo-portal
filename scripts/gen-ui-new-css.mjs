#!/usr/bin/env node
/**
 * gen-ui-new-css.mjs — generate the class-level half of the New design layer.
 *
 * The classic pillars express colour as Tailwind classes (text-slate-400,
 * bg-red-500/10, border-white/10 …). The New design restyles them without
 * touching the pillars, by overriding each class under `html.ui-new`.
 *
 * Why generated rather than hand-written or wildcarded:
 *   • hand-written lists miss variants — there are ~320 distinct colour
 *     classes in use;
 *   • wildcard selectors like [class*="bg-red-500/"] also match
 *     `hover:bg-red-500/20`, which would paint a hover colour permanently.
 * So this scans the source for the exact classes in use and emits one exact
 * rule per class, with hover/group-hover/focus variants scoped to their state.
 *
 * Mapping, in one line each:
 *   neutrals (white/black/slate/gray/base) → the 2027 surface + ink tokens
 *   red/rose → block · emerald/green → pass · amber/yellow → warn · blue → live
 *   identity hues (pink, purple, cyan, sky …) keep their hue; in light mode
 *   their text shades are darkened for AA contrast.
 *
 * Re-run after adding colour classes to a classic pillar:
 *   node scripts/gen-ui-new-css.mjs
 * Output: src/styles/ui-new.generated.css (the hand-written half, tokens and
 * structure, is src/styles/ui-new.css).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const OUT = join(SRC, 'styles', 'ui-new.generated.css')
// Surfaces that already speak the 2027 design natively.
const SKIP = ['api-intercept-2027', 'model-scanning-2027', 'home-2027']

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (SKIP.some((s) => p.includes(s))) continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(jsx?|tsx?)$/.test(name)) out.push(p)
  }
  return out
}

const TOKEN = /(?<![\w:-])((?:hover:|group-hover:|focus:)?)(bg|text|border|divide)-(white|black|slate|gray|zinc|base|red|rose|emerald|green|amber|yellow|blue|orange|pink|purple|violet|indigo|cyan|teal|sky)(?:-(\d{2,3}))?(?:\/(\[[0-9.]+\]|\d+))?(?![\w-])/g

const found = new Map()
for (const f of walk(SRC)) {
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(TOKEN)) {
    const [cls, variant, prop, hue, shade, alphaRaw] = m
    if (!found.has(cls)) found.set(cls, { cls, variant, prop, hue, shade: shade ? +shade : null, alpha: alphaRaw == null ? null : alphaRaw.startsWith('[') ? +alphaRaw.slice(1, -1) : +alphaRaw / 100, files: new Set() })
    found.get(cls).files.add(relative(ROOT, f))
  }
}

const SEM = { red: 'block', rose: 'block', emerald: 'pass', green: 'pass', amber: 'warn', yellow: 'warn', blue: 'live' }
// Light-mode text shades for identity hues, picked for ≥4.5:1 on white.
const ID_LIGHT = { orange: '#c2410c', pink: '#be185d', purple: '#7e22ce', violet: '#6d28d9', indigo: '#4338ca', cyan: '#0e7490', teal: '#0f766e', sky: '#0369a1' }
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const esc = (s) => s.replace(/([:/.[\]])/g, '\\$1')

function selector({ cls, variant }) {
  const base = `.${esc(cls)}`
  if (variant === 'hover:') return `${base}:hover`
  if (variant === 'focus:') return `${base}:focus`
  if (variant === 'group-hover:') return `.group:hover ${base}`
  return base
}

/** Declarations for one class, or null to leave it alone. */
function decl(t) {
  const { prop, hue, shade, alpha } = t
  const sem = SEM[hue]
  const neutral = ['white', 'black', 'slate', 'gray', 'zinc', 'base'].includes(hue)

  if (prop === 'text') {
    if (neutral) {
      if (hue === 'black' || hue === 'base') return null
      if (hue === 'white') return 'color: var(--n-ink) !important;'
      if (shade == null || shade >= 800) return null
      if (shade <= 200) return 'color: var(--n-ink) !important;'
      if (shade === 300) return 'color: var(--n-ink2) !important;'
      if (shade <= 500) return 'color: var(--n-dim) !important;'
      return 'color: var(--n-faint) !important;'
    }
    if (sem) return shade == null || shade <= 700 ? `color: var(--n-${sem}) !important;` : null
    return null // identity hues handled in the light-only block
  }

  if (prop === 'bg') {
    // A state variant (hover/focus) on a neutral surface is a hover tint, not
    // a card — otherwise every hoverable row would light up as a white card.
    if (t.variant && (hue === 'white' || hue === 'black' || hue === 'slate' || hue === 'gray')) {
      return 'background-color: var(--n-hover) !important;'
    }
    if (hue === 'white') {
      if (alpha == null) return null                       // solid white chips/knobs stay white
      return alpha <= 0.1 ? 'background-color: var(--n-card) !important;' : 'background-color: var(--n-hover-strong) !important;'
    }
    if (hue === 'black') return alpha != null && alpha >= 0.3 ? 'background-color: var(--n-code) !important;' : 'background-color: var(--n-sunken) !important;'
    if (hue === 'base') {
      if (shade >= 950) return 'background-color: var(--n-ground) !important;'
      if (shade >= 800) return 'background-color: var(--n-panel) !important;'
      return 'background-color: var(--n-raised) !important;'
    }
    if (hue === 'slate' || hue === 'gray' || hue === 'zinc') {
      if (shade == null) return null
      if (shade >= 900) return 'background-color: var(--n-panel) !important;'
      if (shade >= 700) return 'background-color: var(--n-raised) !important;'
      return null // mid slates are dots, rails and knobs — leave them
    }
    if (sem) {
      if (alpha != null) return `background-color: rgba(var(--n-${sem}-rgb), ${clamp(alpha, 0.06, 0.35).toFixed(2)}) !important;`
      if (shade == null) return null
      if (shade >= 400 && shade <= 700) return `background-color: var(--n-${sem}-solid) !important;`
      return `background-color: rgba(var(--n-${sem}-rgb), 0.14) !important;`
    }
    return null
  }

  if (prop === 'border' || prop === 'divide') {
    const target = prop === 'divide' ? 'border-color' : 'border-color'
    if (neutral) {
      if (hue === 'black' || hue === 'base') return `${target}: var(--n-hair) !important;`
      if (hue === 'white') return `${target}: ${alpha != null && alpha >= 0.2 ? 'var(--n-hair-strong)' : 'var(--n-hair)'} !important;`
      if (shade != null && shade >= 600) return `${target}: var(--n-hair-strong) !important;`
      return null
    }
    if (sem) return `${target}: rgba(var(--n-${sem}-rgb), ${alpha != null ? clamp(alpha + 0.1, 0.28, 0.6).toFixed(2) : '0.45'}) !important;`
    return null
  }
  return null
}

const rules = []
const light = []
const sorted = [...found.values()].sort((a, b) => a.cls.localeCompare(b.cls))
for (const t of sorted) {
  const sel = selector(t)
  const d = decl(t)
  if (d) {
    if (t.prop === 'divide') rules.push(`html.ui-new ${sel} > * + * { ${d} }`)
    else rules.push(`html.ui-new ${sel} { ${d} }`)
  }
  // Card-on-ground vs block-inside-a-panel: a translucent white surface is a
  // white card on the page, but a sunken block when it sits inside a panel.
  if (t.prop === 'bg' && t.hue === 'white' && t.alpha != null && t.alpha <= 0.1 && !t.variant) {
    rules.push(`html.ui-new :is([class*="bg-base-9"], [class*="bg-base-8"], .glass-card, [class*="bg-white/"]) ${sel} { background-color: var(--n-sunken) !important; }`)
  }
  if (t.prop === 'text' && ID_LIGHT[t.hue] && (t.shade == null || t.shade <= 500)) {
    light.push(`html.ui-new.light ${sel} { color: ${ID_LIGHT[t.hue]} !important; }`)
  }
}

const css = `/* GENERATED by scripts/gen-ui-new-css.mjs — do not edit by hand.
 * ${found.size} colour classes found in the classic pillars; ${rules.length + light.length} rules.
 * Tokens (--n-*) are defined in ui-new.css. */

${rules.join('\n')}

/* identity hues — darker text in light mode for AA contrast */
${light.join('\n')}
`
writeFileSync(OUT, css)
console.log(`ui-new.generated.css: ${found.size} classes → ${rules.length} rules + ${light.length} light-mode rules`)
