/**
 * access-routes.js — the Enterprise AI Access pillar (/api/access).
 *
 * Employees reach LLMs without ever holding an API key. They sign in with
 * Microsoft Entra ID; this server reads their app role and department, seals
 * those facts into a short-lived RS256 JWT, and sends that token to the SCM AI
 * Gateway as the API key. The gateway verifies the signature against a JWKS
 * registered at the organisation, reads the claims it now trusts, and routes
 * the request with a conditional config — so the model you get is decided by
 * who you are, server side, not by the model you picked.
 *
 * Ported from the standalone Streamlit app (github.com/sergeiudo/AI-Gateway-JWT-Demo)
 * with the same token shape, config and model list, so the JWKS already
 * registered at the gateway keeps working. What the port adds:
 *   • PKCE (S256) and a nonce on the authorize request, and the ID token's
 *     signature verified against Microsoft's published keys — the standalone
 *     leaned on MSAL and did not show either.
 *   • The authorize request is bound to the browser that started it (cookie),
 *     so a callback cannot be replayed into someone else's session.
 *   • /tamper: the same credential with one thing broken — a claim edited, a
 *     forged signature, an expired token, alg:none — sent to the gateway for
 *     real, so "the claims are sealed" is demonstrated rather than asserted.
 *
 * Everything that moves is recorded per session so the UI can show the real
 * artifacts. Two things never are: the client secret (it only travels in the
 * back-channel POST) and the refresh token (not even kept — nothing uses it).
 * Nothing here is written to traces.db: a session holds live bearer tokens.
 *
 * Sessions live in memory, so a restart signs everyone out. That is the right
 * failure for a demo: sign in again and a fresh lifecycle is captured.
 */
import express from 'express'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { performance } from 'perf_hooks'

const router = express.Router()

const expandHome = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p)
// Relative key paths resolve against the portal's folder.
const keyFile = (p) => (p ? path.resolve(expandHome(p)) : '')
const env = (name) => String(process.env[name] ?? '').trim()

/**
 * Every setting is namespaced JWTGW_*. The standalone app's own names must NOT
 * be reused here: the Portkey Node SDK falls back to readEnv('PORTKEY_BASE_URL')
 * whenever a client is built without a baseURL — as the legacy gateway pillar
 * and the Budget tab build theirs — so a PORTKEY_BASE_URL pointing at
 * aigw.portkey.ai would silently re-point them. AZURE_* is avoided for the
 * same reason next to the Azure backend's AZURE_OPENAI_*.
 */
export const ACCESS_ENV = {
  tenant:       env('JWTGW_AZURE_TENANT_ID'),
  clientId:     env('JWTGW_AZURE_CLIENT_ID'),
  clientSecret: env('JWTGW_AZURE_CLIENT_SECRET'),
  // Entra compares this as an exact string with the app registration's Web
  // redirect URI. Locally the browser is on Vite (5173), which proxies /api.
  redirectUri:  env('JWTGW_REDIRECT_URI') || 'http://localhost:5173/api/access/callback',
  orgId:        env('JWTGW_ORG_ID'),
  workspace:    env('JWTGW_WORKSPACE_SLUG'),
  provider:     env('JWTGW_PROVIDER') || '@sudo-bedrock',
  configId:     env('JWTGW_CONFIG_ID'),
  exemptEmail:  env('JWTGW_EXEMPT_EMAIL'),
  baseUrl:      (env('JWTGW_BASE_URL') || 'https://aigw.portkey.ai/v1').replace(/\/+$/, ''),
  keyPath:      keyFile(env('JWTGW_PRIVATE_KEY_PATH')),
  jwksPath:     keyFile(env('JWTGW_JWKS_PATH')),
}
const ENV = ACCESS_ENV

const SCOPES = 'openid profile offline_access User.Read'
const CREDENTIAL_LIFE_S = 3600
const SESSION_TTL_MS = 12 * 3600e3
const MAX_SESSIONS = 200
const SID_COOKIE = 'eaa_sid'
const BIND_COOKIE = 'eaa_auth'
const COOKIE_PATH = '/api/access'
const RETURN_TO = '/?view=enterpriseAccess'

// ─── models and the routing policy ───────────────────────────────────────────
// The standalone's list, unchanged: ids for the Bedrock integration named in
// JWTGW_PROVIDER. Newer Anthropic and Meta models are only invocable through a
// cross-region inference profile, hence the us. ids.
export const ACCESS_MODELS = [
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5',  vendor: 'Anthropic' },
  { id: 'us.anthropic.claude-sonnet-5',                label: 'Claude Sonnet 5',   vendor: 'Anthropic' },
  { id: 'us.anthropic.claude-opus-4-8',                label: 'Claude Opus 4.8',   vendor: 'Anthropic' },
  { id: 'us.meta.llama4-maverick-17b-instruct-v1:0',   label: 'Llama 4 Maverick',  vendor: 'Meta' },
  { id: 'mistral.mistral-large-3-675b-instruct',       label: 'Mistral Large 3',   vendor: 'Mistral AI' },
  { id: 'zai.glm-5',                                   label: 'GLM 5',             vendor: 'Z.ai' },
  { id: 'minimax.minimax-m2.5',                        label: 'MiniMax M2.5',      vendor: 'MiniMax' },
  { id: 'us.amazon.nova-micro-v1:0',                   label: 'Nova Micro',        vendor: 'Amazon' },
  { id: 'nvidia.nemotron-nano-12b-v2',                 label: 'Nemotron Nano 12B', vendor: 'NVIDIA' },
]
const MODEL_BY_ID = new Map(ACCESS_MODELS.map((m) => [m.id, m]))

/**
 * The exact JSON held under JWTGW_CONFIG_ID. Keep it in step with the gateway:
 * the gateway enforces routing; this copy is what the portal explains, and
 * what it uses to predict the answer so the UI can show whether the gateway
 * agreed. One address may be exempt; unset, that branch does not exist.
 */
function buildPolicy() {
  const exempt = ENV.exemptEmail
  return {
    strategy: {
      mode: 'conditional',
      conditions: [
        ...(exempt ? [{ query: { 'metadata.email': { $eq: exempt } }, then: 'unrestricted' }] : []),
        { query: { 'metadata.user_role': { $eq: 'Admin' } }, then: 'admin-opus' },
        { query: { 'metadata.user_role': { $eq: 'User' } }, then: 'user-haiku' },
      ],
      default: 'user-haiku',
    },
    targets: [
      ...(exempt ? [{ name: 'unrestricted', provider: ENV.provider }] : []),
      { name: 'admin-opus', provider: ENV.provider, override_params: { model: 'us.anthropic.claude-opus-4-8' } },
      { name: 'user-haiku', provider: ENV.provider, override_params: { model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0' } },
    ],
  }
}
export const ACCESS_POLICY = buildPolicy()

const targetModel = (name) => ACCESS_POLICY.targets.find((t) => t.name === name)?.override_params?.model ?? null

/** Walks the conditions in the gateway's order: first match wins, else default. */
export function resolvePolicy(email, role) {
  const facts = { 'metadata.email': String(email || '').toLowerCase(), 'metadata.user_role': role }
  const conds = ACCESS_POLICY.strategy.conditions
  for (let i = 0; i < conds.length; i++) {
    const q = conds[i].query
    const hit = Object.entries(q).every(([k, test]) => {
      const want = k === 'metadata.email' ? String(test.$eq).toLowerCase() : test.$eq
      return facts[k] === want
    })
    if (hit) {
      const [key, test] = Object.entries(q)[0]
      return {
        rule: i + 1, target: conds[i].then, model: targetModel(conds[i].then),
        why: key === 'metadata.email' ? 'exempt' : 'role', field: key.split('.')[1], value: test.$eq,
      }
    }
  }
  const d = ACCESS_POLICY.strategy.default
  return { rule: 0, target: d, model: targetModel(d), why: 'default', field: null, value: null }
}

// ─── configuration state ─────────────────────────────────────────────────────

const REQUIRED = [
  ['JWTGW_AZURE_TENANT_ID', () => ENV.tenant],
  ['JWTGW_AZURE_CLIENT_ID', () => ENV.clientId],
  ['JWTGW_AZURE_CLIENT_SECRET', () => ENV.clientSecret],
  ['JWTGW_ORG_ID', () => ENV.orgId],
  ['JWTGW_WORKSPACE_SLUG', () => ENV.workspace],
  ['JWTGW_CONFIG_ID', () => ENV.configId],
  ['JWTGW_PRIVATE_KEY_PATH', () => ENV.keyPath],
  ['JWTGW_JWKS_PATH', () => ENV.jwksPath],
]
const missingVars = () => REQUIRED.filter(([, get]) => !get()).map(([k]) => k)

const short = (v, head = 6, tail = 4) => {
  const s = String(v ?? '')
  return s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`
}

// ─── JWT helpers (node:crypto — no JWT library needed for RS256) ──────────────

const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const decodeSeg = (seg) => JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'))

/** Breaks a JWT into the parts a verifier works with. Tolerates opaque tokens. */
export function splitJwt(token) {
  if (!token || typeof token !== 'string') return null
  const segs = token.split('.')
  if (segs.length !== 3) return { opaque: true, raw: token, length: token.length }
  const [h, p, s] = segs
  let header = null
  let payload = null
  try { header = decodeSeg(h) } catch { /* not JSON */ }
  try { payload = decodeSeg(p) } catch { /* not JSON */ }
  return {
    header, payload,
    headerB64: h, payloadB64: p, signatureB64: s,
    signingInputLength: h.length + 1 + p.length,
    signatureBytes: s ? Buffer.from(s, 'base64url').length : 0,
    raw: token, length: token.length,
  }
}

function signRs256(header, payload, privateKey) {
  const input = `${b64u(header)}.${b64u(payload)}`
  // An RSA key with sha256 signs RSASSA-PKCS1-v1_5 — that is exactly RS256.
  const sig = crypto.sign('sha256', Buffer.from(input), privateKey)
  return `${input}.${sig.toString('base64url')}`
}

function verifyRs256(token, publicKey) {
  const [h, p, s] = String(token).split('.')
  if (!s) return false
  try { return crypto.verify('sha256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url')) } catch { return false }
}

// The signing key is read lazily and never at import: a missing file must
// leave this pillar on its setup screen, not take the whole server down with
// it (the lesson the upload libraries taught — see CLAUDE.md).
let KEYS = null
export function signingKeys() {
  if (KEYS) return KEYS
  if (!ENV.keyPath || !ENV.jwksPath) return { ok: false, error: 'JWTGW_PRIVATE_KEY_PATH and JWTGW_JWKS_PATH are not set' }
  try {
    const privateKey = crypto.createPrivateKey(fs.readFileSync(ENV.keyPath, 'utf8'))
    const doc = JSON.parse(fs.readFileSync(ENV.jwksPath, 'utf8'))
    const jwk = doc.keys?.[0]
    if (!jwk?.kid || !jwk.n) throw new Error('jwks.json holds no RSA key with a kid')
    const publicKey = crypto.createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' })
    // The two halves must be one pair, or every request 401s with the gateway's
    // unspecific "Error Code: 03". Checked once here so pre-flight can say so.
    const pairMatches = verifyRs256(signRs256({ alg: 'RS256', kid: jwk.kid }, { probe: 1 }, privateKey), publicKey)
    KEYS = { ok: true, privateKey, publicKey, jwk, kid: jwk.kid, modulusLength: jwk.n.length, pairMatches }
    return KEYS
  } catch (err) {
    return { ok: false, error: err.code === 'ENOENT' ? `File not found: ${err.path}` : err.message }
  }
}

/** The credential the gateway routes on — same payload as the standalone app. Exported for scripts. */
export function mintCredential({ email, sub, role, department }, keys, overrides = {}) {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    portkey_oid: ENV.orgId,
    portkey_workspace: ENV.workspace,
    scope: ['completions.write', 'logs.view'],
    email_id: email,
    sub,
    iat: now,
    exp: now + CREDENTIAL_LIFE_S,
    defaults: {
      // Locks the routing config inside the signed token: the caller cannot
      // pick a different one, and cannot edit the metadata it is matched on.
      config_id: ENV.configId,
      metadata: { email, user_role: role, department },
    },
    ...overrides,
  }
  return signRs256({ alg: 'RS256', typ: 'JWT', kid: keys.kid }, payload, keys.privateKey)
}

// ─── Microsoft's signing keys, for the ID token ──────────────────────────────

let MS_KEYS = { at: 0, url: null, keys: [] }
async function microsoftKeys(force = false) {
  if (!force && MS_KEYS.keys.length && Date.now() - MS_KEYS.at < 3600e3) return MS_KEYS
  const url = `https://login.microsoftonline.com/${ENV.tenant}/discovery/v2.0/keys`
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!r.ok) throw new Error(`JWKS answered ${r.status}`)
  const j = await r.json()
  MS_KEYS = { at: Date.now(), url, keys: j.keys ?? [] }
  return MS_KEYS
}

/**
 * Checks an ID token the way an OIDC relying party should. The token came
 * straight from Microsoft's token endpoint over TLS, which the spec accepts in
 * place of a signature check — so an unreachable JWKS is recorded and allowed,
 * but a signature that actively fails, or any failing claim, stops the sign-in.
 */
async function verifyIdToken(token, nonce) {
  const parts = splitJwt(token)
  const p = parts?.payload ?? {}
  const kid = parts?.header?.kid
  const now = Math.floor(Date.now() / 1000)
  const skew = 300
  let signature = { ok: null, detail: '' }
  let jwksUrl = null
  try {
    let ms = await microsoftKeys()
    let jwk = ms.keys.find((k) => k.kid === kid)
    if (!jwk) { ms = await microsoftKeys(true); jwk = ms.keys.find((k) => k.kid === kid) }
    jwksUrl = ms.url
    if (!jwk) signature = { ok: false, detail: `kid ${short(kid, 8, 4)} is not in Microsoft's published keys` }
    else {
      const pub = crypto.createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' })
      const ok = verifyRs256(token, pub)
      signature = { ok, detail: ok ? `${parts.header.alg} · kid ${short(kid, 8, 4)} · verified against Microsoft's published key` : 'the signature does not verify' }
    }
  } catch (err) {
    signature = { ok: null, detail: `not checked — Microsoft's JWKS was unreachable (${err.message}); the token came straight from the token endpoint over TLS` }
  }
  const expectedIss = `https://login.microsoftonline.com/${ENV.tenant}/v2.0`
  const checks = [
    { id: 'signature', label: 'Signature', ...signature },
    { id: 'iss', label: 'Issuer', ok: p.iss === expectedIss, detail: p.iss === expectedIss ? 'your tenant, v2.0 endpoint' : `expected ${expectedIss}` },
    { id: 'aud', label: 'Audience', ok: p.aud === ENV.clientId, detail: p.aud === ENV.clientId ? "this app's client id — the token was issued to us" : 'issued to a different application' },
    { id: 'tid', label: 'Tenant', ok: p.tid === ENV.tenant, detail: p.tid === ENV.tenant ? 'matches JWTGW_AZURE_TENANT_ID' : 'a different directory' },
    { id: 'exp', label: 'Not expired', ok: typeof p.exp === 'number' && p.exp > now - skew, detail: 'exp is in the future' },
    { id: 'nbf', label: 'Not before', ok: !p.nbf || p.nbf <= now + skew, detail: 'nbf is in the past' },
    { id: 'nonce', label: 'Nonce', ok: p.nonce === nonce, detail: p.nonce === nonce ? 'matches the one sent in step 1 — not a replayed token' : 'does not match the authorize request' },
  ]
  return { ok: checks.every((c) => c.ok !== false), checks, jwksUrl, kid, alg: parts?.header?.alg }
}

// ─── sessions ────────────────────────────────────────────────────────────────

const SESSIONS = new Map()
// state → the authorize request that minted it (url, PKCE verifier, nonce,
// browser binding). The redirect to Microsoft and back is a full navigation,
// so this has to live server side.
const AUTH_REQUESTS = new Map()

function parseCookies(req) {
  const out = {}
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function cookie(req, name, value, maxAgeS) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https'
  return `${name}=${encodeURIComponent(value)}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${secure ? '; Secure' : ''}`
}

function prune() {
  const now = Date.now()
  for (const [id, s] of SESSIONS) if (now - s.lastSeen > SESSION_TTL_MS) SESSIONS.delete(id)
  while (SESSIONS.size > MAX_SESSIONS) SESSIONS.delete(SESSIONS.keys().next().value)
  for (const [k, a] of AUTH_REQUESTS) if (now - a.at > 15 * 60e3) AUTH_REQUESTS.delete(k)
}

function sessionOf(req) {
  const s = SESSIONS.get(parseCookies(req)[SID_COOKIE])
  if (s) s.lastSeen = Date.now()
  return s ?? null
}

/** The session as the browser sees it. Tokens shown are the user's own; the refresh token and secret never exist here. */
function publicSession(s) {
  if (!s) return { signedIn: false }
  const cred = s.jwt ? splitJwt(s.jwt) : null
  return {
    signedIn: !!s.user,
    error: s.error ?? null,
    user: s.user ?? null,
    credential: cred && {
      alg: cred.header.alg, kid: cred.header.kid, iat: cred.payload.iat, exp: cred.payload.exp,
      payload: cred.payload, length: cred.length,
    },
    policy: s.user ? resolvePolicy(s.user.email, s.user.role) : null,
    lifecycle: s.lifecycle,
    calls: s.calls,
  }
}

// ─── Entra error codes worth a sentence ──────────────────────────────────────

const AADSTS_HINTS = {
  50105: 'Your account is not assigned to this application. Assign it an App role under Enterprise applications → Users and groups.',
  65001: 'The app has not been consented. Grant admin consent for User.Read under API permissions.',
  7000215: 'The client secret is wrong. Copy the secret Value (not the Secret ID) into JWTGW_AZURE_CLIENT_SECRET.',
  7000222: 'The client secret has expired. Create a new one and update JWTGW_AZURE_CLIENT_SECRET.',
  50011: 'The redirect URI does not match the app registration. Add JWTGW_REDIRECT_URI as a Web redirect URI, character for character.',
  700054: 'response_type is not enabled for this app — the registration must be a Web platform, not a single-page application.',
  54005: 'This authorization code was already redeemed. Sign in again.',
  70008: 'The authorization code expired before it was redeemed. Sign in again.',
  501481: 'The PKCE code verifier did not match. Sign in again.',
}
function aadHint(text) {
  const m = String(text || '').match(/AADSTS(\d+)/)
  return m ? { code: `AADSTS${m[1]}`, hint: AADSTS_HINTS[m[1]] ?? null } : { code: null, hint: null }
}

// ─── routes ──────────────────────────────────────────────────────────────────

/** Pre-flight: what the portal will send, read from configuration — set, not probed. */
router.get('/config', (req, res) => {
  const k = signingKeys()
  const s = sessionOf(req)
  res.json({
    configured: missingVars().length === 0 && k.ok,
    missing: missingVars(),
    gateway: { baseUrl: ENV.baseUrl, host: ENV.baseUrl.replace(/^https?:\/\//, ''), orgShort: ENV.orgId ? short(ENV.orgId) : null, workspace: ENV.workspace || null },
    provider: ENV.provider,
    configId: ENV.configId || null,
    entra: { tenantShort: ENV.tenant ? short(ENV.tenant) : null, clientIdShort: ENV.clientId ? short(ENV.clientId) : null, redirectUri: ENV.redirectUri, scopes: SCOPES },
    key: k.ok
      ? { ok: true, alg: 'RS256', kid: k.kid, kidShort: short(k.kid), modulusLength: k.modulusLength, pairMatches: k.pairMatches, jwk: k.jwk }
      : { ok: false, error: k.error },
    models: ACCESS_MODELS,
    policy: ACCESS_POLICY,
    rules: ACCESS_POLICY.strategy.conditions.length + 1,
    credentialLifeMin: CREDENTIAL_LIFE_S / 60,
    signedIn: !!s?.user,
    checkedAt: new Date().toISOString(),
  })
})

router.get('/session', (req, res) => { res.json(publicSession(sessionOf(req))) })

/** Starts the authorization code flow. A top-level navigation, not a fetch. */
router.get('/login', (req, res) => {
  if (!ENV.tenant || !ENV.clientId || !ENV.clientSecret) {
    return res.status(503).type('text').send('Entra ID is not configured on this host: set JWTGW_AZURE_TENANT_ID, JWTGW_AZURE_CLIENT_ID and JWTGW_AZURE_CLIENT_SECRET.')
  }
  prune()
  const state = crypto.randomBytes(16).toString('base64url')
  const nonce = crypto.randomBytes(16).toString('base64url')
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const bind = crypto.randomBytes(16).toString('base64url')
  const params = {
    client_id: ENV.clientId,
    response_type: 'code',
    redirect_uri: ENV.redirectUri,
    response_mode: 'query',
    scope: SCOPES,
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }
  const url = `https://login.microsoftonline.com/${ENV.tenant}/oauth2/v2.0/authorize?${new URLSearchParams(params)}`
  AUTH_REQUESTS.set(state, { url, params, nonce, verifier, bind, at: Date.now() })
  res.setHeader('Set-Cookie', cookie(req, BIND_COOKIE, bind, 900))
  res.redirect(302, url)
})

/** Microsoft sends the browser back here with a single-use code. */
router.get('/callback', async (req, res) => {
  const q = req.query
  const origin = AUTH_REQUESTS.get(q.state) ?? null
  AUTH_REQUESTS.delete(q.state)
  const cookies = parseCookies(req)

  const s = { id: crypto.randomBytes(24).toString('base64url'), createdAt: Date.now(), lastSeen: Date.now(), lifecycle: {}, calls: [], messages: [] }
  const stage = (key, data, t0) => { s.lifecycle[key] = { at: Date.now(), ms: t0 == null ? null : Math.round(performance.now() - t0), data } }

  const finish = () => {
    prune()
    const old = SESSIONS.get(cookies[SID_COOKIE])
    if (old) SESSIONS.delete(old.id)
    SESSIONS.set(s.id, s)
    res.setHeader('Set-Cookie', [cookie(req, SID_COOKIE, s.id, SESSION_TTL_MS / 1000), cookie(req, BIND_COOKIE, '', 0)])
    res.redirect(302, RETURN_TO)
  }
  const fail = (step, message, detail) => {
    s.error = { step, message, detail: detail ?? null, ...aadHint(message) }
    console.warn(`[access] sign-in failed at ${step}: ${String(message).split('\n')[0]}`)
    finish()
  }

  // 1 · the authorize request that started this, looked up by its state.
  stage('authorize', origin
    ? { live: true, url: origin.url, params: origin.params, startedAt: origin.at }
    : { live: false, url: null, params: null })

  // 2 · what Microsoft handed back on the redirect.
  const browserBound = !!origin && cookies[BIND_COOKIE] === origin.bind
  stage('callback', {
    redirectUrl: `${ENV.redirectUri}?${new URLSearchParams(q)}`,
    code: q.code ?? null,
    codeLength: q.code ? String(q.code).length : 0,
    state: q.state ?? null,
    stateMatches: !!origin,
    browserBound,
    sessionState: q.session_state ?? null,
    error: q.error ?? null,
    errorDescription: q.error_description ?? null,
  })
  if (q.error) return fail('callback', q.error_description || q.error)
  if (!origin) return fail('callback', 'This sign-in began before the portal restarted, so its PKCE verifier is gone. Sign in again.')
  if (!browserBound) return fail('callback', 'The sign-in came back to a different browser than the one that started it, so the code was not redeemed.')

  // 3 · redeem the code, server side, with the secret and the PKCE verifier.
  const tokenUrl = `https://login.microsoftonline.com/${ENV.tenant}/oauth2/v2.0/token`
  const form = {
    client_id: ENV.clientId,
    scope: SCOPES,
    code: String(q.code),
    redirect_uri: ENV.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: origin.verifier,
    client_secret: ENV.clientSecret,
  }
  let tok = {}
  let status = 0
  let headers = {}
  const t3 = performance.now()
  try {
    const r = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(15000),
    })
    status = r.status
    headers = Object.fromEntries(r.headers)
    tok = await r.json().catch(() => ({}))
  } catch (err) {
    tok = { error: 'network', error_description: err.message }
  }
  stage('exchange', {
    url: tokenUrl,
    status,
    requestFields: {
      ...form,
      code: `${short(form.code, 10, 6)} (${form.code.length} chars)`,
      code_verifier: `${origin.verifier.slice(0, 6)}… (${origin.verifier.length} chars — proves this server started the sign-in)`,
      client_secret: '(sent — never recorded)',
    },
    responseHeaders: pick(headers, ['date', 'content-type', 'x-ms-request-id', 'x-ms-ests-server', 'x-ms-clitelem', 'cache-control', 'strict-transport-security']),
    keysReturned: Object.keys(tok).sort(),
    tokenType: tok.token_type ?? null,
    expiresIn: tok.expires_in ?? null,
    extExpiresIn: tok.ext_expires_in ?? null,
    scope: tok.scope ?? null,
    refreshTokenReturned: !!tok.refresh_token,
    idToken: splitJwt(tok.id_token),
    accessToken: splitJwt(tok.access_token),
    error: tok.error ?? null,
    errorDescription: tok.error_description ?? null,
    errorCodes: tok.error_codes ?? null,
  }, t3)
  if (!tok.id_token || !tok.access_token) return fail('exchange', tok.error_description || `The token endpoint answered ${status}`)

  // 4 · check the ID token, then decide the role from its claims.
  const t4 = performance.now()
  const verification = await verifyIdToken(tok.id_token, origin.nonce)
  const claims = splitJwt(tok.id_token).payload ?? {}
  const emailFrom = ['preferred_username', 'email', 'upn'].find((c) => claims[c]) ?? null
  const email = emailFrom ? claims[emailFrom] : null
  const roles = Array.isArray(claims.roles) ? claims.roles : []
  const role = roles.includes('Admin') ? 'Admin' : 'User'
  stage('claims', {
    verification,
    emailResolvedFrom: emailFrom,
    email,
    sub: claims.sub ?? null,
    oid: claims.oid ?? null,
    name: claims.name ?? null,
    rolesClaimPresent: 'roles' in claims,
    roles,
    role,
    issuedAt: claims.iat ?? null,
    expiresAt: claims.exp ?? null,
    audience: claims.aud ?? null,
    issuer: claims.iss ?? null,
    all: claims,
  }, t4)
  if (!verification.ok) {
    const failed = verification.checks.filter((c) => c.ok === false).map((c) => c.label).join(', ')
    return fail('claims', `The ID token did not pass verification (${failed}).`)
  }
  if (!email) return fail('claims', 'The ID token carries no email, preferred_username or upn claim to route on.')

  // 5 · department is not a token claim, so it costs a Graph round trip.
  const graphUrl = 'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,department,jobTitle,officeLocation'
  let department = 'General'
  let profile = null
  const graph = { requestUrl: graphUrl, requestHeaders: { Authorization: `Bearer ${tok.access_token}` } }
  const t5 = performance.now()
  try {
    const r = await fetch(graphUrl, { headers: { Authorization: `Bearer ${tok.access_token}` }, signal: AbortSignal.timeout(8000) })
    graph.status = r.status
    graph.responseHeaders = pick(Object.fromEntries(r.headers), ['date', 'content-type', 'request-id', 'client-request-id', 'x-ms-ags-diagnostic', 'x-ms-resource-unit'])
    const body = (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.text()
    graph.responseBody = body
    if (r.ok && body && typeof body === 'object') { profile = body; department = body.department || 'General' }
  } catch (err) {
    graph.exception = `${err.name}: ${err.message}`
  }
  graph.departmentUsed = department
  graph.fellBack = department === 'General' && !profile?.department
  stage('graph', graph, t5)

  // 6 · mint the credential the gateway will route on.
  const keys = signingKeys()
  if (!keys.ok) return fail('mint', `The signing key could not be loaded: ${keys.error}`)
  const t6 = performance.now()
  const jwt = mintCredential({ email, sub: claims.sub, role, department }, keys)
  const minted = splitJwt(jwt)
  stage('mint', {
    jwt: minted,
    jwks: keys.jwk,
    kidInHeader: minted.header.kid,
    kidInJwks: keys.jwk.kid,
    kidMatch: minted.header.kid === keys.jwk.kid,
    modulusLength: keys.modulusLength,
    selfVerified: verifyRs256(jwt, keys.publicKey),
    privateKeyFile: path.basename(ENV.keyPath),
  }, t6)

  s.jwt = jwt
  s.user = {
    name: claims.name || profile?.displayName || email,
    email,
    role,
    roleLabel: role === 'Admin' ? 'Administrator' : 'Standard user',
    roles,
    department,
    jobTitle: profile?.jobTitle ?? null,
    officeLocation: profile?.officeLocation ?? null,
    tenantId: claims.tid ?? null,
    oid: claims.oid ?? null,
  }
  console.log(`[access] signed in ${email} · role=${role} · department=${department}`)
  finish()
})

router.post('/logout', (req, res) => {
  const s = sessionOf(req)
  if (s) SESSIONS.delete(s.id)
  res.setHeader('Set-Cookie', cookie(req, SID_COOKIE, '', 0))
  // The portal's sign-out ends its own session only. This ends Microsoft's too.
  const entraLogout = ENV.tenant ? `https://login.microsoftonline.com/${ENV.tenant}/oauth2/v2.0/logout` : null
  res.json({ ok: true, entraLogout })
})

router.post('/clear', (req, res) => {
  const s = sessionOf(req)
  if (!s?.user) return res.status(401).json({ error: 'Not signed in' })
  s.messages = []
  s.calls = []
  res.json(publicSession(s))
})

function pick(obj, keys) {
  const out = {}
  for (const k of keys) if (obj?.[k] != null) out[k] = obj[k]
  return out
}

const stripSlug = (id) => String(id ?? '').replace(/^@[^/]+\//, '')

/** Reads the useful part of a gateway error body, whatever shape it came in. */
function errorText(body, status) {
  if (!body) return `HTTP ${status}`
  if (typeof body === 'string') return body.slice(0, 400)
  return body.error?.message || body.message || body.error || JSON.stringify(body).slice(0, 400)
}

/**
 * One call to the gateway with a given credential. Plain fetch rather than the
 * Portkey SDK, so the exact headers that went out and came back can be shown.
 * Exported for scripts.
 */
export async function callGateway({ token, modelId, messages, maxTokens = 512 }) {
  const body = { model: `${ENV.provider}/${modelId}`, messages, max_tokens: maxTokens }
  const requestHeaders = {
    'Content-Type': 'application/json',
    'x-portkey-api-key': token,
    'x-portkey-provider': ENV.provider,
    // Lets hook_results through on an allowed response, if the config has guardrails.
    'x-portkey-strict-open-ai-compliance': 'false',
  }
  const url = `${ENV.baseUrl}/chat/completions`
  const t0 = performance.now()
  let status = 0
  let responseHeaders = {}
  let json = null
  let text = null
  let network = null
  try {
    const r = await fetch(url, { method: 'POST', headers: requestHeaders, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })
    status = r.status
    responseHeaders = Object.fromEntries(r.headers)
    text = await r.text()
    try { json = JSON.parse(text) } catch { /* not JSON */ }
  } catch (err) {
    network = `${err.name}: ${err.message}`
  }
  const elapsedMs = Math.round(performance.now() - t0)
  const ok = status >= 200 && status < 300 && !!json?.choices
  const served = ok ? stripSlug(json.model) : null
  // The gateway names the conditional target it used ("config.targets[2]") —
  // its own account of the routing decision, not an inference from the model.
  const idx = String(responseHeaders['x-portkey-last-used-option-index'] ?? '').match(/targets\[(\d+)\]/)
  const gatewayTarget = idx ? { index: Number(idx[1]), name: ACCESS_POLICY.targets[Number(idx[1])]?.name ?? null, raw: idx[0] } : null
  return {
    url, status, ok, elapsedMs, requestHeaders, requestBody: body, responseHeaders, gatewayTarget,
    responseBody: json ?? (text ? text.slice(0, 2000) : null),
    served,
    reply: ok ? (json.choices?.[0]?.message?.content ?? '') : null,
    finishReason: ok ? json.choices?.[0]?.finish_reason ?? null : null,
    usage: json?.usage ?? null,
    responseId: json?.id ?? null,
    hookResults: json?.hook_results ?? null,
    error: network ?? (ok ? null : errorText(json ?? text, status)),
  }
}

const label = (id) => MODEL_BY_ID.get(id)?.label ?? id

router.post('/chat', async (req, res) => {
  const s = sessionOf(req)
  if (!s?.user || !s.jwt) return res.status(401).json({ error: 'Not signed in' })
  const prompt = String(req.body?.prompt ?? '').trim()
  const modelId = String(req.body?.modelId ?? '')
  const system = String(req.body?.system ?? '').trim()
  const window = Math.max(2, Math.min(30, Number(req.body?.contextWindow) || 10))
  if (!prompt) return res.status(400).json({ error: 'Empty prompt' })
  if (!MODEL_BY_ID.has(modelId)) return res.status(400).json({ error: `Unknown model ${modelId}` })

  s.messages.push({ role: 'user', content: prompt })
  const messages = [...(system ? [{ role: 'system', content: system }] : []), ...s.messages.slice(-window)]
  const predicted = resolvePolicy(s.user.email, s.user.role)
  const g = await callGateway({ token: s.jwt, modelId, messages })
  const expectedServe = predicted.model ?? modelId

  const call = {
    id: crypto.randomBytes(6).toString('hex'),
    n: s.calls.length + 1,
    kind: 'chat',
    at: Date.now(),
    prompt,
    requested: { id: modelId, label: label(modelId) },
    served: g.served ? { id: g.served, label: label(g.served) } : null,
    overridden: !!g.served && g.served !== modelId,
    predicted: { ...predicted, serve: expectedServe, serveLabel: label(expectedServe) },
    // The portal's copy of the policy predicted one model; did the gateway agree?
    agreed: g.served ? g.served === expectedServe : null,
    credentialExp: splitJwt(s.jwt).payload.exp,
    ...g,
  }
  if (g.ok) s.messages.push({ role: 'assistant', content: g.reply })
  else s.messages.pop() // a failed turn must not leave a dangling user message in the history
  s.calls.push(call)
  res.json({ call })
})

/**
 * The credential, broken on purpose, sent to the gateway for real. Each case
 * would route somewhere more privileged if the gateway trusted it.
 */
const TAMPER = {
  claims: {
    label: 'Edit a sealed claim',
    what: 'user_role flipped in the payload; the original signature kept',
  },
  forged: {
    label: 'Sign with a different key',
    what: 'the same payload with the role set to Admin, signed by a freshly generated RSA key under the registered kid',
  },
  expired: {
    label: 'Replay an expired credential',
    what: 'a correctly signed token whose exp passed an hour ago',
  },
  unsigned: {
    label: 'Strip the signature',
    what: 'alg set to none and the signature removed',
  },
}

router.post('/tamper', async (req, res) => {
  const s = sessionOf(req)
  if (!s?.user || !s.jwt) return res.status(401).json({ error: 'Not signed in' })
  const kind = String(req.body?.kind ?? '')
  if (!TAMPER[kind]) return res.status(400).json({ error: `Unknown experiment ${kind}` })
  const keys = signingKeys()
  if (!keys.ok) return res.status(503).json({ error: keys.error })

  const orig = splitJwt(s.jwt)
  const payload = structuredClone(orig.payload)
  const toRole = s.user.role === 'Admin' ? 'User' : 'Admin'
  let token
  const changes = []
  if (kind === 'claims') {
    payload.defaults.metadata.user_role = toRole
    token = `${orig.headerB64}.${b64u(payload)}.${orig.signatureB64}`
    changes.push({ path: 'defaults.metadata.user_role', from: s.user.role, to: toRole })
  } else if (kind === 'forged') {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    payload.defaults.metadata.user_role = 'Admin'
    token = signRs256({ alg: 'RS256', typ: 'JWT', kid: keys.kid }, payload, privateKey)
    if (s.user.role !== 'Admin') changes.push({ path: 'defaults.metadata.user_role', from: s.user.role, to: 'Admin' })
    changes.push({ path: 'signature', from: 'your private key', to: 'a key the gateway has never seen' })
  } else if (kind === 'expired') {
    const now = Math.floor(Date.now() / 1000)
    token = mintCredential({ email: s.user.email, sub: payload.sub, role: s.user.role, department: s.user.department }, keys, { iat: now - 2 * CREDENTIAL_LIFE_S, exp: now - CREDENTIAL_LIFE_S })
    changes.push({ path: 'exp', from: payload.exp, to: now - CREDENTIAL_LIFE_S })
  } else {
    payload.defaults.metadata.user_role = 'Admin'
    token = `${b64u({ alg: 'none', typ: 'JWT' })}.${b64u(payload)}.`
    changes.push({ path: 'header.alg', from: 'RS256', to: 'none' })
    if (s.user.role !== 'Admin') changes.push({ path: 'defaults.metadata.user_role', from: s.user.role, to: 'Admin' })
    changes.push({ path: 'signature', from: `${orig.signatureBytes} bytes`, to: 'empty' })
  }

  // Ask for the most privileged model, so an accepted forgery would be visible in what answers.
  const modelId = 'us.anthropic.claude-opus-4-8'
  const g = await callGateway({ token, modelId, messages: [{ role: 'user', content: 'Reply with one word: ok' }], maxTokens: 16 })
  const call = {
    id: crypto.randomBytes(6).toString('hex'),
    n: s.calls.length + 1,
    kind: 'tamper',
    at: Date.now(),
    prompt: 'Reply with one word: ok',
    tamper: { kind, ...TAMPER[kind], changes, token: splitJwt(token) },
    requested: { id: modelId, label: label(modelId) },
    served: g.served ? { id: g.served, label: label(g.served) } : null,
    overridden: !!g.served && g.served !== modelId,
    refused: !g.ok && (g.status === 401 || g.status === 403),
    ...g,
  }
  s.calls.push(call)
  console.log(`[access] tamper ${kind} → HTTP ${g.status}`)
  res.json({ call })
})

export default router
