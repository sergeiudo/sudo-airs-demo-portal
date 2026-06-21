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

// Curated models for the Budget tab's developer chat — each gets its own token
// budget. One expensive (Opus), one cheap Bedrock (Haiku), one Vertex (Gemini).
export const BUDGET_MODELS = [
  { id: '@sudo-bedrock/us.anthropic.claude-opus-4-8',          label: 'Claude Opus 4.8',       vendor: 'Bedrock' },
  { id: '@sudo-bedrock/anthropic.claude-3-haiku-20240307-v1:0', label: 'Claude 3 Haiku',        vendor: 'Bedrock' },
  { id: '@sudo-vertexai/gemini-3.1-flash-lite',                label: 'Gemini 3.1 Flash Lite', vendor: 'Vertex' },
]

// Mirror of the backend default (FINOPS_BUDGET_TOKEN_CAP) for display fallback;
// the backend returns the authoritative `cap` in each devchat response.
export const BUDGET_TOKEN_CAP = 8000
