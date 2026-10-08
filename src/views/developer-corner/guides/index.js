import { Compass, Terminal, Network, Waypoints, Landmark, Plug, ScanSearch, Swords, Server, Library } from 'lucide-react'
import { START } from './start'
import { RUNTIME, AGENTS } from './runtime'
import { GATEWAY, INTEGRATIONS } from './gateway'
import { AIGW_GATEWAY, AIGW_GOVERNANCE } from './aigw'
import { AIGW_HYBRID } from './hybrid'
import { MODELS, REDTEAM, NETWORK } from './models'
import { LIBRARY } from './library'

/**
 * The Developer Corner's table of contents. Rail order = reading order: start,
 * the three runtime paths (code, gateway, network), agents, the two
 * pre-production products, then reference.
 */

export const GROUPS = [
  { id: 'start',        title: 'Start here',          sub: 'Paths, tenant, credentials',     icon: Compass,    tone: '#0ea5e9' },
  { id: 'runtime',      title: 'AIRS Runtime API',     sub: 'API intercept, in your code',    icon: Terminal,   tone: '#f43f5e' },
  { id: 'agents',       title: 'Agents & MCP',         sub: 'Tool calls and MCP servers',     icon: Network,    tone: '#2dd4bf' },
  { id: 'gateway',      title: 'SCM AI Gateway',       sub: 'Guardrails in the traffic path', icon: Waypoints,  tone: '#EC4899' },
  { id: 'gwgov',        title: 'AI Gateway governance', sub: 'Keys, budgets, identity, admin', icon: Landmark,  tone: '#d946ef' },
  { id: 'integrations', title: 'Integrations',         sub: 'Gateways, frameworks, clouds',   icon: Plug,       tone: '#f59e0b' },
  { id: 'models',       title: 'AI Model Security',    sub: 'Scan before a model is loaded',  icon: ScanSearch, tone: '#6366f1' },
  { id: 'redteam',      title: 'AI Red Teaming',       sub: 'Attack before you ship',         icon: Swords,     tone: '#fb923c' },
  { id: 'network',      title: 'Network intercept',    sub: 'Inline firewalls, no code',      icon: Server,     tone: '#06b6d4' },
  { id: 'library',      title: 'Library',              sub: 'Every doc, errors, this portal', icon: Library,    tone: '#64748b' },
]

// The gateway guides come from two files; this is their reading order, which
// is also what Previous / Next follows.
const GATEWAY_ORDER = [
  'gw-overview', 'gw-connect', 'gw-universal', 'gw-routing', 'gw-guardrail', 'gw-guardrails',
  'gw-observability', 'gw-mcp', 'gw-agents', 'gw-coding', 'gw-hybrid',
  'gw-governance', 'gw-jwt', 'gw-admin',
]
const gatewayPool = Object.fromEntries([...GATEWAY, ...AIGW_GATEWAY, ...AIGW_HYBRID, ...AIGW_GOVERNANCE].map((g) => [g.id, g]))
const GATEWAY_ALL = GATEWAY_ORDER.map((id) => gatewayPool[id])

export const GUIDES = [...START, ...RUNTIME, ...AGENTS, ...GATEWAY_ALL, ...INTEGRATIONS, ...MODELS, ...REDTEAM, ...NETWORK, ...LIBRARY]

export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]))
export const GUIDE_BY_ID = Object.fromEntries(GUIDES.map((g) => [g.id, g]))

/** Lowercased searchable text per guide: titles, prose, table cells, code. Functions (build) and icons drop out of JSON. */
export function guideHaystack(g) {
  let body = ''
  try { body = JSON.stringify(g.blocks) } catch { /* ignore */ }
  return `${g.title} ${g.sub} ${GROUP_BY_ID[g.group]?.title ?? ''} ${body} ${(g.docs ?? []).map((d) => d.title).join(' ')}`.toLowerCase()
}
