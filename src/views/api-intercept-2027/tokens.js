/**
 * tokens.js — soft-surface visual system for the intercept console.
 *
 * Direction taken from a fitness-app reference the user picked: white cards
 * floating on a warm grey ground, very large corner radii, diffuse low-contrast
 * shadows, one warm accent, and big bold numerals. Translated rather than
 * copied — that reference is a three-element mobile screen and this is a dense
 * three-pane console, so the language carries over but the layout does not.
 *
 * Two rules hold it together:
 *   • DEPTH COMES FROM SHADOW, NOT BORDERS. Surfaces are separated by soft
 *     elevation, so hairlines are almost absent and the screen stays calm.
 *   • ONE THING SHOUTS. Vermilion is reserved for interception. Everything
 *     else — model, timing, pass — is charcoal, green or grey.
 *
 * Both themes are first-class; the light one is the reference, the dark one is
 * derived from it rather than being the old neon scheme.
 */

export const SIGNAL = {
  block:  '#E0553A', // vermilion — the accent, and the alarm. Only interception uses it.
  pass:   '#2E9E7B', // muted green — cleared
  warn:   '#E8A33D', // amber — unscanned / bypassed
  model:  '#2C2C30', // charcoal — compute, never a verdict
  live:   '#4A76F0', // blue — in flight
  idle:   '#9A9AA2',
}

export const SEVERITY = {
  critical: '#E0553A',
  high:     '#EE8352',
  medium:   '#E8A33D',
  low:      '#8C8C95',
}

export function tokens(isLight) {
  const light = {
    isLight: true,
    ground:     '#E9E9EB',
    groundFlat: '#E9E9EB',
    panel:      '#FFFFFF',
    panelSolid: '#FFFFFF',
    raised:     '#FFFFFF',
    sunken:     '#F1F1F3',
    glassEdge:  'rgba(20,20,24,0.05)',
    glassTop:   'none',
    hairline:   'rgba(20,20,24,0.07)',
    ink:        '#131316',
    inkDim:     '#6A6A73',
    inkFaint:   '#9A9AA3',
    railBed:    'rgba(20,20,24,0.10)',
    codeBg:     '#F4F4F6',
    grid:       'rgba(20,20,24,0.028)',
    // Two-layer diffuse elevation — the thing that makes the reference read as
    // physical rather than flat.
    shadow:     '0 10px 30px rgba(18,18,22,0.07), 0 2px 6px rgba(18,18,22,0.05)',
    shadowSm:   '0 3px 10px rgba(18,18,22,0.06)',
  }
  const dark = {
    isLight: false,
    ground:     '#151517',
    groundFlat: '#151517',
    panel:      '#202024',
    panelSolid: '#202024',
    raised:     '#26262B',
    sunken:     '#1A1A1E',
    glassEdge:  'rgba(255,255,255,0.06)',
    glassTop:   'none',
    hairline:   'rgba(255,255,255,0.07)',
    ink:        '#F3F3F5',
    inkDim:     '#A0A0AA',
    inkFaint:   '#6E6E78',
    railBed:    'rgba(255,255,255,0.10)',
    codeBg:     '#141417',
    grid:       'rgba(255,255,255,0.022)',
    shadow:     '0 10px 30px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.35)',
    shadowSm:   '0 3px 10px rgba(0,0,0,0.35)',
  }
  return { ...(isLight ? light : dark), ...SIGNAL }
}

export const FONT = {
  display: '"Space Grotesk", Inter, system-ui, sans-serif',
  mono:    '"JetBrains Mono", Menlo, monospace',
  prose:   'Inter, system-ui, sans-serif',
}

/**
 * A raised surface. Named `glass` for continuity with the call sites, but it is
 * now a soft card: no blur, no neon edge, depth from shadow and a generous
 * radius.
 */
export function glass(t, { radius = 24, edge } = {}) {
  return {
    background: t.panel,
    border: `1px solid ${edge || t.glassEdge}`,
    borderRadius: radius,
    boxShadow: t.shadow,
  }
}

/**
 * Emphasis for a live or alarmed element. Previously a neon halo; now a soft
 * coloured elevation, which is what carries weight on a light ground.
 */
export function bloom(color, strength = 1) {
  if (!strength) return 'none'
  return `0 ${5 * strength}px ${18 * strength}px ${color}2e`
}

/** Small tracked label. */
export const label = {
  fontFamily: FONT.display,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

export function verdictOf(message) {
  if (!message) return 'idle'
  if (message.verdict === 'ERROR') return 'error'
  if (message.blocked) return 'blocked'
  if (message.verdict === 'DIRECT') return 'unscanned'
  return 'passed'
}

export const VERDICT_META = {
  passed:    { label: 'PASSED',      color: SIGNAL.pass,  note: 'cleared every scan' },
  blocked:   { label: 'INTERCEPTED', color: SIGNAL.block, note: 'stopped at the scan' },
  unscanned: { label: 'UNSCANNED',   color: SIGNAL.warn,  note: 'AIRS was off — nothing inspected' },
  error:     { label: 'FAULT',       color: SIGNAL.warn,  note: 'the call did not complete' },
  idle:      { label: 'STANDBY',     color: SIGNAL.idle,  note: '' },
}
