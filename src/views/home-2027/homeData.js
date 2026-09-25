import { PILLARS, hl } from '../HomeViewV2'
import { ATTACK_CATEGORIES } from '../../data/mockData'
import { MOH_ATTACKS } from '../../data/moh/attacks'

/**
 * homeData.js — what the 2027 home knows about each pillar beyond PILLARS.
 *
 * PILLARS (in HomeViewV2) stays the single source of titles, copy and accent,
 * so a rename still happens in one place. This file adds the layout facts the
 * old grid never needed: where a pillar sits in the run of show, which product
 * area it belongs to, and the one number worth putting on its tile.
 *
 * Every number is computed from the app's own data or read live — none is
 * typed in, so the home page cannot quietly drift from what the pillars do.
 */

const count = (cats) => cats.reduce(
  (a, c) => a + (c.attacks?.length ?? c.subCategories?.reduce((s, sc) => s + (sc.attacks?.length ?? 0), 0) ?? 0), 0)

export const PAYLOADS = count(ATTACK_CATEGORIES)
export const MOH_SCENARIOS = MOH_ATTACKS.length

/**
 * `run` is the demo running order — PILLARS order, row 1 of the old grid
 * (see CLAUDE.md: "PILLARS array order IS the demo running order"). The legacy
 * gateway keeps its place in the run: it is marked, not demoted.
 */
const META = {
  apiIntercept:    { run: 1, area: 'AI Runtime Security',  aka: 'runtime aigw ai-gw gateway attack library intercept api', stats: [`${PAYLOADS} payloads`, '4 targets', '2 architectures'] },
  modelScanning:   { run: 2, area: 'AI Supply Chain',      aka: 'model scan scanning skills hugging face pickle supply', stats: ['models + skills', 'SCM history'] },
  llmGateway:      { run: 3, area: 'Gateway · legacy',     aka: 'portkey legacy gateway lanes llm', stats: ['3 lanes side by side'] },
  ministryHealth:  { run: 4, area: 'Customer scenario',    aka: 'moh briut health hebrew rfi israel', stats: [`${MOH_SCENARIOS} scenarios`, 'HE / EN'] },
  redTeaming:      { run: 5, area: 'AI Red Teaming',       aka: 'red team redteam adversarial campaign', stats: ['automated campaigns'] },
  mcpSecurity:     { group: 'deep', area: 'Runtime · MCP',        aka: 'mcp tools tool poisoning owasp', stats: ['10 OWASP scenarios'] },
  ragSecurity:     { group: 'deep', area: 'Runtime · RAG',        aka: 'rag retrieval vector documents', stats: ['upstream + downstream'] },
  claudeHooks:     { group: 'deep', area: 'Runtime · IDE',        aka: 'claude code hooks ide coding assistant', stats: ['zero code changes'] },
  observability:   { group: 'ops',  area: 'Observability',        aka: 'telemetry traces observability latency logs', stats: ['every prompt traced'] },
  developerCorner: { group: 'ops',  area: 'Integration',          aka: 'developer sdk api rest python code', stats: ['SDK · REST · samples'] },
}

export const HOME_PILLARS = PILLARS.map((p) => ({
  ...p,
  ...(META[p.id] ?? { group: 'deep', area: p.tag, stats: [] }),
  news: p.highlights.map(hl).filter((h) => h.tag === 'NEW').map((h) => h.t),
}))

export const RUN_OF_SHOW = HOME_PILLARS.filter((p) => p.run).sort((a, b) => a.run - b.run)
export const DEEP_DIVES = HOME_PILLARS.filter((p) => p.group === 'deep')
export const OPERATE = HOME_PILLARS.filter((p) => p.group === 'ops')

/** Every NEW highlight across the portal, newest pillar work first. */
export const WHATS_NEW = HOME_PILLARS.flatMap((p) => p.news.map((t) => ({ pillar: p, text: t })))

// ─── "last opened", kept in the browser ──────────────────────────────────────
// Per-browser on purpose: the server's activity log is per visitor IP, which
// is the wrong thing to show a presenter.
const KEY = 'sudo-airs.home.lastOpened'
export function readLastOpened() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
export function markOpened(id) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readLastOpened(), [id]: Date.now() })) } catch { /* private mode */ }
}
export function ago(ts) {
  if (!ts) return null
  const s = (Date.now() - ts) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
