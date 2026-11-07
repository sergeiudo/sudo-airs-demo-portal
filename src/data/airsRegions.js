/**
 * Prisma AIRS product availability by region — a hand-kept snapshot of what is
 * generally available TODAY, shown in the AIRS regions header panel.
 *
 * Current state only, on purpose: no roadmap, no dates, no candidate regions.
 * A region appears only once at least one AIRS product is GA there. Anything
 * not GA reads "not available today" — it does not say whether it is coming.
 *
 *   ga      — generally available, full feature set
 *   partial — generally available, some features missing (`note` says which)
 *   (absent) — not generally available in the region today
 *
 * Refresh by hand: update SNAPSHOT and the cells together.
 */

export const SNAPSHOT = '2026-11-05'

export const PRODUCTS = [
  { id: 'rsApi',    name: 'Runtime Security API',      short: ['Runtime', 'API'] },
  { id: 'rsFw',     name: 'Runtime Security Firewall', short: ['Runtime', 'Firewall'] },
  { id: 'redTeam',  name: 'AI Red Teaming',            short: ['Red', 'Teaming'] },
  { id: 'modelSec', name: 'AI Model Security',         short: ['Model', 'Security'] },
  { id: 'gateway',  name: 'AI Gateway',                short: ['AI', 'Gateway'] },
  { id: 'identity', name: 'AI Identity Security',      short: ['Identity', 'Security'] },
]

const URL_FILTERING = 'Missing URL Filtering'

// `probe` links a row to the latency probe's region id (/api/airs-probe).
export const REGIONS = [
  { id: 'us',     flag: '🇺🇸', name: 'United States',       probe: 'us',
    cells: { rsApi: 'ga', rsFw: 'ga', redTeam: 'ga', modelSec: 'ga', gateway: 'ga', identity: 'ga' } },
  { id: 'fedramp', flag: '🇺🇸', name: 'US FedRAMP Moderate',
    cells: { rsApi: 'ga' } },
  { id: 'de',     flag: '🇩🇪', name: 'Germany (EU)',        probe: 'eu',
    cells: { rsApi: 'partial', rsFw: 'partial', redTeam: 'ga', gateway: 'ga' }, note: URL_FILTERING },
  { id: 'nl',     flag: '🇳🇱', name: 'Netherlands (EU)',
    cells: { redTeam: 'ga', modelSec: 'ga' } },
  { id: 'in',     flag: '🇮🇳', name: 'India',               probe: 'in',
    cells: { rsApi: 'partial', rsFw: 'partial', redTeam: 'ga', modelSec: 'ga' }, note: URL_FILTERING },
  { id: 'sg',     flag: '🇸🇬', name: 'Singapore',           probe: 'sg',
    cells: { rsApi: 'ga', rsFw: 'ga', redTeam: 'ga', modelSec: 'ga' } },
  { id: 'jp',     flag: '🇯🇵', name: 'Japan',
    cells: { rsApi: 'ga', redTeam: 'ga', modelSec: 'ga' } },
]
