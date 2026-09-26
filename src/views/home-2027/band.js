/**
 * band.js — the coloured-band language of the launcher home, shared so a
 * pillar's header, its target cards and the home tile that opened it are
 * built from the same pieces.
 *
 * White text only ever sits on the band's darkened end: every accent mixed
 * 42% toward black measures ≥ 5:1 against white, where several raw accents
 * (sky, amber, orange, rose) are under 4.5:1.
 */

/** The accent mixed toward black — the band's text side and the hover fill. */
export function shade(hex, k = 0.42) {
  const n = parseInt(hex.slice(1, 7), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - k)))
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export const bandBg = (tone) => `linear-gradient(125deg, ${shade(tone)} 0%, ${shade(tone)} 24%, ${tone} 100%)`

/** Dot texture, fading in toward the band's bright end. */
export const bandDots = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1.4px)',
  backgroundSize: '13px 13px',
  WebkitMaskImage: 'linear-gradient(120deg, transparent 20%, #000 90%)',
  maskImage: 'linear-gradient(120deg, transparent 20%, #000 90%)',
}

/** Glass chip that reads on any part of a band: dark glass, white text. */
export const bandGlass = {
  color: '#fff',
  background: 'rgba(0,0,0,0.22)',
  border: '1px solid rgba(255,255,255,0.24)',
}
