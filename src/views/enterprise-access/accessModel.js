import {
  LogIn, CornerDownLeft, ArrowLeftRight, BadgeCheck, Building2, KeyRound, Waypoints,
} from 'lucide-react'

/**
 * accessModel.js — what the Enterprise AI Access pillar knows beyond the API:
 * how to read a request's outcome, what each lifecycle step is called, what
 * the claims in the three tokens mean, and the same policy walk the server
 * does (so the sign-in page can simulate a standard user, an administrator
 * and the exempt account without signing anyone in).
 */

// Microsoft's tokens are drawn in Entra blue, the portal's credential in the
// pillar's colour: identity colours, never verdict colours.
export const ENTRA_BLUE = '#0078D4'

// A JWT's three segments. Structure, not state — so none of them is green,
// amber or vermilion, which already mean passed / fault / intercepted.
export const SEGMENT = { header: '#0891B2', payload: '#7C3AED', signature: '#C026D3' }

export const short = (v, head = 6, tail = 4) => {
  const s = String(v ?? '')
  return s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`
}

export const clock = (ms) => (ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—')
export const clockS = (s) => (s ? clock(s * 1000) : '—')

export function relative(ms) {
  const a = Math.abs(ms)
  const past = ms < 0
  const f = a < 60e3 ? `${Math.round(a / 1000)} s` : a < 3600e3 ? `${Math.round(a / 60e3)} min` : `${(a / 3600e3).toFixed(1)} h`
  return past ? `${f} ago` : `in ${f}`
}

/** Whole minutes left on a token, never negative. */
export const minsLeft = (expS, now = Date.now()) => (expS ? Math.max(0, Math.floor((expS * 1000 - now) / 60e3)) : null)

export const labelOf = (models, id) => models?.find((m) => m.id === id)?.label ?? id

/** The gateway's walk of a conditional config — first match wins, else default. Mirrors access-routes.js. */
export function resolvePolicy(policy, email, role) {
  if (!policy) return null
  const facts = { 'metadata.email': String(email || '').toLowerCase(), 'metadata.user_role': role }
  const target = (name) => policy.targets.find((t) => t.name === name)?.override_params?.model ?? null
  const conds = policy.strategy.conditions
  for (let i = 0; i < conds.length; i++) {
    const entries = Object.entries(conds[i].query)
    const hit = entries.every(([k, test]) => facts[k] === (k === 'metadata.email' ? String(test.$eq).toLowerCase() : test.$eq))
    if (hit) {
      const [key, test] = entries[0]
      return { rule: i + 1, target: conds[i].then, model: target(conds[i].then), why: key === 'metadata.email' ? 'exempt' : 'role', field: key.split('.')[1], value: test.$eq }
    }
  }
  const d = policy.strategy.default
  return { rule: 0, target: d, model: target(d), why: 'default', field: null, value: null }
}

/** One plain-language line per branch, in evaluation order. */
export function policyRows(policy, models) {
  if (!policy) return []
  const target = (name) => policy.targets.find((t) => t.name === name)?.override_params?.model ?? null
  const rows = policy.strategy.conditions.map((c, i) => {
    const [key, test] = Object.entries(c.query)[0]
    const model = target(c.then)
    return { n: i + 1, field: key.split('.')[1], value: test.$eq, target: c.then, model, modelLabel: model ? labelOf(models, model) : null }
  })
  const dm = target(policy.strategy.default)
  rows.push({ n: 0, fallback: true, target: policy.strategy.default, model: dm, modelLabel: dm ? labelOf(models, dm) : null })
  return rows
}

/**
 * The three people the sign-in page's diagram plays through. Everyone asks
 * for the same model, so the only thing that changes the answer is who they
 * are — the point of the demo. The exempt account exists only when the
 * config has an exempt address.
 */
export function scenarios(config) {
  if (!config?.policy) return []
  const models = config.models
  const pick = models.find((m) => /sonnet/i.test(m.label))?.id ?? models[0]?.id
  const exempt = config.policy.strategy.conditions.find((c) => c.query['metadata.email'])?.query['metadata.email'].$eq
  const people = [
    { key: 'user', tag: 'Standard user', who: 'bob@', email: 'bob@contoso.com', role: 'User' },
    { key: 'admin', tag: 'Administrator', who: 'alice@', email: 'alice@contoso.com', role: 'Admin' },
    ...(exempt ? [{ key: 'exempt', tag: 'Exempt account', who: `${exempt.split('@')[0]}@`, email: exempt, role: 'User' }] : []),
  ]
  return people.map((p) => {
    const r = resolvePolicy(config.policy, p.email, p.role)
    const winner = r.model ?? pick
    return { ...p, requested: pick, requestedLabel: labelOf(models, pick), winner, winnerLabel: labelOf(models, winner), rule: r }
  })
}

/** A request's outcome, in the colours the portal uses everywhere. */
export function callVerdict(call) {
  if (!call) return 'idle'
  if (call.pending) return 'pending'
  if (call.kind === 'tamper') return call.ok ? 'accepted' : call.refused ? 'refused' : 'fault'
  if (!call.ok) return 'fault'
  return call.overridden ? 'rerouted' : 'passed'
}

export const VERDICT = {
  passed:   { title: 'Sent as requested', tone: 'pass',  where: 'at the AI Gateway' },
  rerouted: { title: 'Rerouted by policy', tone: 'block', where: 'at the AI Gateway' },
  refused:  { title: 'Refused', tone: 'block', where: 'at the AI Gateway · credential check' },
  accepted: { title: 'Accepted a doctored token', tone: 'warn', where: 'the gateway did not refuse it' },
  fault:    { title: 'Fault', tone: 'warn', where: 'the call did not complete' },
  pending:  { title: 'On the line', tone: 'live', where: 'routing through the gateway' },
}
export const toneOf = (t, v) => t[VERDICT[v]?.tone ?? 'idle'] ?? t.idle

/** What a failed call most likely means — the standalone README's troubleshooting, attached to the error. */
export function gatewayHint(call) {
  const e = String(call?.error ?? '')
  if (call?.kind === 'tamper') return null
  if (/Error Code: 03|Invalid API Key/i.test(e) || call?.status === 401) {
    return 'The gateway could not verify the credential. In order of likelihood: the JWKS registered at the gateway does not match JWTGW_PRIVATE_KEY_PATH (a truncated n is the usual cause — it must be 342 characters); JWTGW_ORG_ID is wrong; or JWTGW_BASE_URL points at a different gateway than the one holding the JWKS.'
  }
  if (/model_not_allowed|not allowed/i.test(e) || call?.status === 412) {
    return 'The model is not provisioned on the provider integration, or belongs to a different integration. Enable it on the integration in the gateway console.'
  }
  if (/throughput|inference profile/i.test(e)) return 'Newer Anthropic models on Bedrock need a cross-region inference profile id (us.…).'
  if (/exp|expired/i.test(e)) return 'The credential has expired — it lives for 60 minutes and is not refreshed. Sign out and in again.'
  return null
}

// ─── the lifecycle ───────────────────────────────────────────────────────────

export const STEPS = [
  { id: 'authorize', n: 1, title: 'Authorize', icon: LogIn,          line: 'The browser is sent to Microsoft with a PKCE challenge and a nonce.' },
  { id: 'callback',  n: 2, title: 'Callback',  icon: CornerDownLeft, line: 'Microsoft sends back a single-use code, not a token.' },
  { id: 'exchange',  n: 3, title: 'Exchange',  icon: ArrowLeftRight, line: 'The server redeems the code with its secret and the PKCE verifier.' },
  { id: 'claims',    n: 4, title: 'Claims',    icon: BadgeCheck,     line: "The ID token is checked against Microsoft's keys; the role is read." },
  { id: 'graph',     n: 5, title: 'Graph',     icon: Building2,      line: 'Department is fetched from Microsoft Graph — it is not a token claim.' },
  { id: 'mint',      n: 6, title: 'Minting',   icon: KeyRound,       line: 'The portal signs its own RS256 credential with the claims sealed in.' },
  { id: 'gateway',   n: 7, title: 'Gateway',   icon: Waypoints,      line: 'Every prompt carries that credential as its API key.' },
]

/** What a claim is for. Unknown claims just show their value. */
export const CLAIM_NOTES = {
  iss: 'Issuer — who signed this token.',
  aud: 'Audience — who the token is for. Anyone else must reject it.',
  sub: 'Subject — a stable, per-application id for the user.',
  oid: 'Object id — the user in this directory, the same for every app.',
  tid: 'Tenant id — which directory authenticated the user.',
  iat: 'Issued at.',
  nbf: 'Not valid before.',
  exp: 'Expires at. No refresh here: sign in again after it.',
  nonce: 'Echo of the nonce this portal sent — proves the token answers our request.',
  name: 'Display name from the directory.',
  preferred_username: 'Sign-in name. The portal routes on it as the email.',
  email: 'Email address, when the directory has one.',
  upn: 'User principal name.',
  roles: 'App roles assigned under Enterprise applications. The portal reads Admin or User from here.',
  ver: 'Token format version.',
  rh: 'Internal to Entra — used to revalidate the token.',
  uti: 'Unique token id (Entra-internal).',
  sid: 'Session id of the sign-in.',
  aio: 'Internal to Entra.',
  scp: 'Delegated scopes granted — what the token may do at its audience.',
  amr: 'How the user authenticated (pwd, mfa, …).',
  appid: 'The client application that requested the token.',
  app_displayname: 'Name of the requesting application.',
  appidacr: 'How the client authenticated: 1 = client secret.',
  idtyp: 'Token type: user or app.',
  ipaddr: 'The address the user signed in from.',
  given_name: 'First name.',
  family_name: 'Last name.',
  unique_name: 'Human-readable name for the user.',
  wids: 'Directory role template ids held by the user.',
  acct: 'Account type: 0 = member, 1 = guest.',
  acr: 'Authentication context class.',
  xms_tcdt: 'When the tenant was created.',
  portkey_oid: 'Tells the gateway whose JWKS to verify this token against.',
  portkey_workspace: 'The gateway workspace the token is scoped to.',
  scope: 'What this credential may do at the gateway.',
  email_id: 'Who is calling — logged by the gateway with every request.',
  defaults: 'Settings the gateway applies to every request made with this token.',
  'defaults.config_id': 'The routing config, locked inside the signature — the caller cannot pick another.',
  'defaults.metadata': 'The facts the routing rules match on.',
  'defaults.metadata.email': 'Matched by the exemption rule.',
  'defaults.metadata.user_role': 'Matched by the role rules. From the Entra roles claim.',
  'defaults.metadata.department': 'From Microsoft Graph. Logged, not routed on.',
}

export const TIME_CLAIMS = new Set(['iat', 'nbf', 'exp', 'xms_tcdt', 'auth_time'])

/** Flattens a claims object into rows, one level into nested objects. */
export function claimRows(payload) {
  if (!payload) return []
  const out = []
  const walk = (obj, prefix, depth) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === 'object' && !Array.isArray(v) && depth < 2) {
        out.push({ key, depth, group: true })
        walk(v, key, depth + 1)
      } else out.push({ key, depth, value: v })
    }
  }
  walk(payload, '', 0)
  return out
}

/** The tamper experiments, as the rail lists them. The server builds the tokens. */
export const TAMPER_KINDS = [
  { kind: 'claims',   label: 'Edit a sealed claim',          what: 'flip user_role, keep the signature' },
  { kind: 'forged',   label: 'Sign with a different key',    what: 'role Admin, signed by a key the gateway never saw' },
  { kind: 'expired',  label: 'Replay an expired credential', what: 'correctly signed, exp an hour ago' },
  { kind: 'unsigned', label: 'Strip the signature',          what: 'alg: none, signature removed' },
]

/** One line per lifecycle step, from the values actually captured. */
export function journeyLines(session) {
  const L = session?.lifecycle ?? {}
  const calls = session?.calls ?? []
  const d = (k) => L[k]?.data
  const out = {}
  const au = d('authorize')
  if (au) out.authorize = au.live ? 'PKCE S256 · nonce · state · prompt=select_account' : 'The original request was not in memory'
  const cb = d('callback')
  if (cb) out.callback = cb.error ? `Microsoft answered ${cb.error}` : `code of ${cb.codeLength} chars · state ${cb.stateMatches ? 'matches' : 'unknown'} · ${cb.browserBound ? 'same browser' : 'browser not bound'}`
  const ex = d('exchange')
  if (ex) out.exchange = ex.error ? `${ex.error} · HTTP ${ex.status}` : `HTTP ${ex.status} · ID token + access token${ex.refreshTokenReturned ? ' · refresh token discarded' : ''}`
  const cl = d('claims')
  if (cl) {
    const sig = cl.verification?.checks?.find((c) => c.id === 'signature')
    out.claims = `${sig?.ok ? 'signature verified' : sig?.ok === false ? 'signature FAILED' : 'signature not checked'} · role ${cl.role} · ${cl.roles?.length ? `roles [${cl.roles.join(', ')}]` : 'no roles claim'}`
  }
  const gr = d('graph')
  if (gr) out.graph = gr.exception ? gr.exception : `HTTP ${gr.status} · department ${gr.departmentUsed}${gr.fellBack ? ' (fallback)' : ''}`
  const mi = d('mint')
  if (mi) out.mint = `RS256 · kid ${short(mi.kidInHeader, 6, 4)} · ${mi.jwt?.length} chars · ${mi.selfVerified ? 'verifies against the JWKS' : 'does NOT verify'}`
  if (L.mint) out.gateway = calls.length ? `${calls.length} request${calls.length === 1 ? '' : 's'} with this credential` : 'No request yet — send a prompt'
  return out
}
