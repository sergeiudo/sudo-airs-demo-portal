// Shared FinOps constants for the Budget tab (frontend).
// The backend (portkey-finops.js) keeps its own copy of the team/model sets to
// avoid a cross-bundle import — keep the two in sync if you change them.

export const FINOPS_RANGES = [
  { id: '24h', label: '24h', days: 1 },
  { id: '7d',  label: '7d',  days: 7 },
  { id: '30d', label: '30d', days: 30 },
]

// Metadata dimensions the attribution table can group by (Portkey metadata keys).
export const FINOPS_ATTR_KEYS = [
  { id: 'team',  label: 'Team' },
  { id: '_user', label: 'User' },
  { id: 'app',   label: 'App' },
]

// Teams the traffic generator rotates through (real Portkey metadata values).
export const FINOPS_TEAMS = ['Platform', 'Support bot', 'Data Science', 'Marketing', 'Sandbox']
