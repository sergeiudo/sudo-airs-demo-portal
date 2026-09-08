/**
 * theme.js — Briut.AI visual tokens.
 *
 * Calm clinical rather than the security-console red/black the rest of the
 * portal uses: this screen is meant to look like something a health ministry
 * would actually ship to citizens, so the threat story lands harder when it
 * breaks. Every token is returned for both themes because the portal's
 * `html.light` override sheet forces `bg-base-9xx` classes to white — inline
 * styles are the only reliable way to control these surfaces.
 */

export const MOH_ACCENT = '#0d9488' // teal-600 — the Briut.AI brand
export const MOH_ACCENT_SOFT = '#14b8a6'
export const MOH_SKY = '#0ea5e9' // pillar/nav accent (nav colour key: 'sky')

export function mohTheme(isLight) {
  return {
    isLight,
    accent: MOH_ACCENT,
    accentSoft: MOH_ACCENT_SOFT,

    // Page + surfaces
    pageBg: isLight
      ? 'linear-gradient(180deg, #f2f8f8 0%, #f7fafc 40%, #ffffff 100%)'
      : 'linear-gradient(180deg, #0a1420 0%, #0b1220 45%, #0d1117 100%)',
    surface: isLight ? '#ffffff' : 'rgba(17,26,43,0.92)',
    surfaceMuted: isLight ? '#f1f6f8' : 'rgba(255,255,255,0.04)',
    border: isLight ? 'rgba(13,148,136,0.16)' : 'rgba(255,255,255,0.09)',
    borderStrong: isLight ? 'rgba(13,148,136,0.28)' : 'rgba(255,255,255,0.16)',

    // Type
    text: isLight ? '#0f172a' : '#e2e8f0',
    textMuted: isLight ? '#5b6b7c' : '#94a3b8',
    textFaint: isLight ? '#8b9aa8' : '#64748b',

    // Header
    headerBg: isLight
      ? 'linear-gradient(135deg, #0d9488 0%, #0e7490 55%, #0369a1 100%)'
      : 'linear-gradient(135deg, #0b3b38 0%, #0c3a45 55%, #0a2f4d 100%)',
    // Unprotected lane. The calm clinical teal is the point of this screen, so
    // the strongest way to show AIRS being switched off is to take it away:
    // the whole chrome goes red, readable from the back of a room, instead of
    // one small badge changing wording. Same 135deg / three-stop shape as the
    // protected gradient so it reads as the same UI in a different state.
    headerBgUnprotected: isLight
      ? 'linear-gradient(135deg, #b91c1c 0%, #a41d1d 55%, #8b1a2b 100%)'
      : 'linear-gradient(135deg, #4a1216 0%, #45141a 55%, #3d1220 100%)',
    headerShadow: '0 2px 18px rgba(6,60,66,0.28)',
    headerShadowUnprotected: '0 2px 18px rgba(120,20,20,0.38)',
    headerText: '#ffffff',
    headerSub: 'rgba(255,255,255,0.72)',

    // Bubbles
    userBubble: isLight
      ? 'linear-gradient(135deg, #0d9488 0%, #0e7490 100%)'
      : 'linear-gradient(135deg, #0f766e 0%, #0e5f74 100%)',
    userText: '#ffffff',
    asstBubble: isLight ? '#ffffff' : 'rgba(255,255,255,0.055)',
    asstBorder: isLight ? 'rgba(13,148,136,0.18)' : 'rgba(255,255,255,0.09)',

    // Verdict states
    blocked: '#ef4444',
    blockedBg: isLight ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.10)',
    blockedBorder: isLight ? 'rgba(239,68,68,0.30)' : 'rgba(239,68,68,0.35)',
    flagged: '#f59e0b',
    flaggedBg: isLight ? 'rgba(245,158,11,0.07)' : 'rgba(245,158,11,0.10)',
    flaggedBorder: isLight ? 'rgba(245,158,11,0.32)' : 'rgba(245,158,11,0.38)',
    allowed: '#10b981',
    allowedBg: isLight ? 'rgba(16,185,129,0.07)' : 'rgba(16,185,129,0.10)',
    allowedBorder: isLight ? 'rgba(16,185,129,0.28)' : 'rgba(16,185,129,0.32)',

    // Code / JSON viewers stay dark in both themes (syntax-highlighted only)
    codeBg: '#0d1117',
    codeText: '#c9d1d9',

    shadow: isLight ? '0 8px 28px rgba(13,80,90,0.10)' : '0 8px 28px rgba(0,0,0,0.45)',
    shadowSm: isLight ? '0 2px 10px rgba(13,80,90,0.07)' : '0 2px 10px rgba(0,0,0,0.30)',
  }
}

/** Risk pill colours for retrieved documents. */
export const MOH_RISK_COLORS = {
  benign: '#10b981',
  phi: '#f97316',
  injection: '#ef4444',
  malicious_url: '#a855f7',
  dosage_poison: '#dc2626',
  authority_spoof: '#eab308',
}

/** Theme-adapting dropdown/popover surface — the portal's usual breakage point. */
export function mohPopover(isLight) {
  return isLight
    ? {
        background: '#ffffff',
        border: '1px solid rgba(13,148,136,0.18)',
        boxShadow: '0 8px 24px rgba(13,80,90,0.12)',
        color: '#1e293b',
      }
    : {
        background: 'rgba(15,23,38,0.98)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(16px)',
        color: '#e2e8f0',
      }
}
