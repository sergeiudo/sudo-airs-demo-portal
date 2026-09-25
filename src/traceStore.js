// src/traceStore.js
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'traces.db')

let _db = null

function db() {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.exec(`
    CREATE TABLE IF NOT EXISTS traces (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      prompt TEXT,
      response TEXT,
      backend TEXT,
      model TEXT,
      verdict TEXT,
      category TEXT,
      threats_detected TEXT,
      airs_enabled INTEGER,
      total_ms INTEGER,
      airs_input_ms INTEGER,
      llm_ms INTEGER,
      airs_output_ms INTEGER,
      tokens_in INTEGER,
      tokens_out INTEGER,
      profile TEXT,
      attack_label TEXT,
      attack_severity TEXT
    );
    CREATE TABLE IF NOT EXISTS spans (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL,
      status TEXT NOT NULL,
      metadata TEXT
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      view TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      username TEXT,
      country TEXT,
      city TEXT,
      region TEXT,
      timezone TEXT,
      screen_res TEXT,
      language TEXT
    );
  `)
  // Migrate existing installs — add columns if missing
  const cols = _db.prepare(`PRAGMA table_info(activity_log)`).all().map(c => c.name)
  for (const col of [['username','TEXT'],['country','TEXT'],['city','TEXT'],['region','TEXT'],['timezone','TEXT'],['screen_res','TEXT'],['language','TEXT']]) {
    if (!cols.includes(col[0])) _db.exec(`ALTER TABLE activity_log ADD COLUMN ${col[0]} ${col[1]}`)
  }
  // `detail` holds the full measured telemetry for a trace (timeline, AIRS scans
  // and reports, provider and gateway metadata). Older rows have none, and the
  // drawer falls back to the summary columns for them.
  const traceCols = _db.prepare(`PRAGMA table_info(traces)`).all().map(c => c.name)
  if (!traceCols.includes('detail')) _db.exec(`ALTER TABLE traces ADD COLUMN detail TEXT`)
  return _db
}

export function insertTrace(t) {
  const id = t.id ?? `trace_${randomUUID()}`
  db().prepare(`
    INSERT INTO traces (id, created_at, prompt, response, backend, model, verdict, category,
      threats_detected, airs_enabled, total_ms, airs_input_ms, llm_ms, airs_output_ms,
      tokens_in, tokens_out, profile, attack_label, attack_severity, detail)
    VALUES (@id, @created_at, @prompt, @response, @backend, @model, @verdict, @category,
      @threats_detected, @airs_enabled, @total_ms, @airs_input_ms, @llm_ms, @airs_output_ms,
      @tokens_in, @tokens_out, @profile, @attack_label, @attack_severity, @detail)
  `).run({
    ...t,
    id,
    created_at: t.created_at ?? new Date().toISOString(),
    threats_detected: JSON.stringify(t.threats_detected ?? []),
    airs_enabled: t.airs_enabled ? 1 : 0,
    detail: t.detail ? JSON.stringify(t.detail) : null,
  })
  return id
}

export function insertSpan(s) {
  db().prepare(`
    INSERT INTO spans (id, trace_id, name, start_ms, end_ms, latency_ms, status, metadata)
    VALUES (@id, @trace_id, @name, @start_ms, @end_ms, @latency_ms, @status, @metadata)
  `).run({
    ...s,
    id: `span_${randomUUID()}`,
    metadata: s.metadata ? JSON.stringify(s.metadata) : null,
  })
}

export function getTraces({ status, model, category, search, limit = 50, offset = 0 } = {}) {
  let where = '1=1'
  const params = []
  if (status)  { where += ' AND verdict = ?';                params.push(status) }
  if (model)   { where += ' AND backend LIKE ?';             params.push(`%${model}%`) }
  if (category) { where += ' AND category = ?';              params.push(category) }
  if (search)  { where += ' AND (prompt LIKE ? OR model LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
  const rows = db().prepare(
    `SELECT * FROM traces WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset)
  // `detail` is per-trace forensics — tens of KB — and a list never renders it.
  return rows.map(({ detail, ...r }) => ({ ...r, threats_detected: JSON.parse(r.threats_detected || '[]'), airs_enabled: !!r.airs_enabled, has_detail: !!detail }))
}

export function getTrace(id) {
  const trace = db().prepare('SELECT * FROM traces WHERE id = ?').get(id)
  if (!trace) return null
  const spans = db().prepare('SELECT * FROM spans WHERE trace_id = ? ORDER BY start_ms ASC').all(id)
  let detail = null
  try { detail = trace.detail ? JSON.parse(trace.detail) : null } catch { /* corrupt row — fall back */ }
  return {
    ...trace,
    detail,
    threats_detected: JSON.parse(trace.threats_detected || '[]'),
    airs_enabled: !!trace.airs_enabled,
    spans: spans.map(s => ({ ...s, metadata: s.metadata ? JSON.parse(s.metadata) : null })),
  }
}

/** Read-modify-write a trace's detail — used when a deferred AIRS report lands. */
export function updateTraceDetail(id, mutate) {
  const d = db()
  const row = d.prepare('SELECT detail FROM traces WHERE id = ?').get(id)
  if (!row?.detail) return false
  const next = mutate(JSON.parse(row.detail))
  d.prepare('UPDATE traces SET detail = ? WHERE id = ?').run(JSON.stringify(next), id)
  return true
}

export function deleteTrace(id) {
  const d = db()
  d.prepare('DELETE FROM spans WHERE trace_id = ?').run(id)
  d.prepare('DELETE FROM traces WHERE id = ?').run(id)
}

export function insertActivity({ view, ip, user_agent, username, country, city, region, timezone, screen_res, language }) {
  db().prepare(
    `INSERT INTO activity_log (ts, view, ip, user_agent, username, country, city, region, timezone, screen_res, language)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(new Date().toISOString(), view, ip ?? null, user_agent ?? null,
    username ?? null, country ?? null, city ?? null, region ?? null,
    timezone ?? null, screen_res ?? null, language ?? null)
}

// Detector keys arrive in several spellings (injection, prompt:injection,
// toxic content, url_cats …); the home page shows six families a customer
// recognises. First match wins, so order matters.
const FAMILIES = [
  ['injection', 'Prompt injection', /inject|jailbreak/i],
  ['data', 'Sensitive data (DLP)', /dlp|data/i],
  ['toxic', 'Toxic content', /toxic/i],
  ['url', 'Malicious URL', /url/i],
  ['code', 'Malicious code', /code|malicious/i],
  ['agent', 'Agent / tool misuse', /agent|tool/i],
]
function familyOf(key) {
  const hit = FAMILIES.find(([, , re]) => re.test(String(key)))
  return hit ? { key: hit[0], label: hit[1] } : null
}

/**
 * Evidence for the home page hero: what AIRS actually stopped on this portal.
 * "Before the model" uses the same test as the Telemetry pillar's "Blocked at
 * Input Scan" (no LLM time recorded), so the two pages never disagree. The
 * latest intercepts carry the attack's library label or its detector family —
 * never the prompt text, which is raw test traffic.
 */
export function homeProof({ latest = 4 } = {}) {
  const d = db()
  const agg = d.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN airs_enabled=1 THEN 1 ELSE 0 END) as scanned,
           SUM(CASE WHEN verdict='BLOCKED' THEN 1 ELSE 0 END) as blocked,
           SUM(CASE WHEN verdict='BLOCKED' AND (llm_ms IS NULL OR llm_ms=0) THEN 1 ELSE 0 END) as before_model,
           MIN(created_at) as first, MAX(created_at) as last
    FROM traces`).get()

  const counts = {}
  for (const r of d.prepare(`SELECT threats_detected FROM traces WHERE verdict='BLOCKED' AND threats_detected != '[]'`).all()) {
    let keys = []
    try { keys = JSON.parse(r.threats_detected) } catch { /* malformed row */ }
    // Count each family once per request, however many spellings fired.
    for (const f of new Set(keys.map(familyOf).filter(Boolean).map((x) => x.key))) counts[f] = (counts[f] ?? 0) + 1
  }
  const families = FAMILIES.map(([key, label]) => ({ key, label, count: counts[key] ?? 0 }))
    .filter((f) => f.count > 0).sort((a, b) => b.count - a.count)

  const rows = d.prepare(`
    SELECT created_at, attack_label, backend, model, threats_detected, llm_ms
    FROM traces WHERE verdict='BLOCKED' ORDER BY created_at DESC LIMIT ?`).all(latest)
  const recent = rows.map((r) => {
    let keys = []
    try { keys = JSON.parse(r.threats_detected || '[]') } catch { /* malformed row */ }
    const fam = keys.map(familyOf).find(Boolean)
    // Some labels are internal ids (MOH "ag-01", gateway lane "defaults");
    // only a label that reads like words is shown as-is.
    const human = r.attack_label && /\s/.test(r.attack_label) && !/^[a-z]{1,4}-\d+$/i.test(r.attack_label)
    const origin = { 'moh-aigw': 'Ministry of Health scenario', portkey: 'Gateway guardrail block', aigw: 'AI Gateway guardrail block' }[String(r.backend).split('/')[0]]
    return {
      at: r.created_at,
      label: (human && r.attack_label) || fam?.label || origin || 'Blocked by policy',
      family: fam?.label ?? null,
      backend: r.backend ? String(r.backend).split('/')[0] : null,
      beforeModel: !r.llm_ms,
    }
  })

  return {
    total: agg.total ?? 0, scanned: agg.scanned ?? 0, blocked: agg.blocked ?? 0,
    beforeModel: agg.before_model ?? 0, first: agg.first, last: agg.last,
    families, recent,
  }
}

/** Cheap totals for the home page's pre-flight card — one indexed COUNT each. */
export function countTraces() {
  const d = db()
  const row = d.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN verdict='BLOCKED' THEN 1 ELSE 0 END) as blocked, MAX(created_at) as last FROM traces`).get()
  return { total: row.total ?? 0, blocked: row.blocked ?? 0, last: row.last ?? null }
}

export function getActivity({ limit = 100 } = {}) {
  return db().prepare(`
    SELECT
      ip,
      MAX(ts) as last_seen,
      COUNT(*) as visits,
      MAX(user_agent) as user_agent,
      MAX(username) as username,
      MAX(country) as country,
      MAX(city) as city,
      MAX(region) as region,
      MAX(timezone) as timezone,
      MAX(screen_res) as screen_res,
      MAX(language) as language
    FROM activity_log
    GROUP BY ip
    ORDER BY last_seen DESC
    LIMIT ?
  `).all(limit)
}

export function deleteAllTraces() {
  const d = db()
  d.prepare('DELETE FROM spans').run()
  d.prepare('DELETE FROM traces').run()
}

export function getMetrics(since = '-20 minutes') {
  const d = db()
  const total = d.prepare('SELECT COUNT(*) as n FROM traces').get().n
  if (total === 0) return { total_requests: 0, blocked_count: 0, allowed_count: 0, block_rate_pct: 0, avg_total_ms: 0, p95_total_ms: 0, avg_llm_ms: 0, avg_airs_input_ms: 0, avg_airs_output_ms: 0, detection_breakdown: {}, provider_breakdown: {}, latency_series: [], volume_series: [] }

  const agg = d.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN verdict='BLOCKED' THEN 1 ELSE 0 END) as blocked,
      SUM(CASE WHEN verdict='ALLOWED' THEN 1 ELSE 0 END) as allowed,
      SUM(CASE WHEN airs_enabled=1 THEN 1 ELSE 0 END) as protected,
      AVG(total_ms) as avg_total,
      AVG(llm_ms) as avg_llm,
      AVG(airs_input_ms) as avg_airs_in,
      AVG(airs_output_ms) as avg_airs_out,
      AVG((airs_input_ms + airs_output_ms) * 1.0 / NULLIF(total_ms, 0)) * 100 as avg_airs_overhead_pct,
      AVG(tokens_in + tokens_out) as avg_tokens_per_request,
      SUM(CASE WHEN verdict='BLOCKED' AND (llm_ms IS NULL OR llm_ms=0) THEN 1 ELSE 0 END) as blocked_at_input,
      SUM(CASE WHEN verdict='BLOCKED' AND llm_ms > 0 THEN 1 ELSE 0 END) as blocked_at_output
    FROM traces
  `).get()

  const rpm = d.prepare(`SELECT COUNT(*) as n FROM traces WHERE created_at >= datetime('now', '-1 minute')`).get().n

  // P95 latency
  const allLatencies = d.prepare('SELECT total_ms FROM traces WHERE total_ms IS NOT NULL ORDER BY total_ms ASC').all().map(r => r.total_ms)
  const p95idx = Math.floor(allLatencies.length * 0.95)
  const p95 = allLatencies[p95idx] ?? 0

  // Detection breakdown — threats_detected is JSON array per row
  const threatRows = d.prepare('SELECT threats_detected FROM traces WHERE threats_detected != ?').all('[]')
  const detection_breakdown = {}
  for (const row of threatRows) {
    const threats = JSON.parse(row.threats_detected)
    for (const t of threats) {
      detection_breakdown[t] = (detection_breakdown[t] ?? 0) + 1
    }
  }

  // Provider breakdown (backend field, e.g. "vertex/gemini-2.0-flash-001" → "vertex")
  const providerRows = d.prepare('SELECT backend, COUNT(*) as n FROM traces GROUP BY backend').all()
  const provider_breakdown = {}
  for (const r of providerRows) provider_breakdown[r.backend ?? 'unknown'] = r.n

  // Time series — configurable window
  const seriesRows = d.prepare(`
    SELECT
      strftime('%H:%M', created_at) as time,
      AVG(total_ms) as total_ms,
      AVG(llm_ms) as llm_ms,
      AVG(airs_input_ms + airs_output_ms) as airs_ms,
      SUM(CASE WHEN verdict='ALLOWED' THEN 1 ELSE 0 END) as allowed,
      SUM(CASE WHEN verdict='BLOCKED' THEN 1 ELSE 0 END) as blocked
    FROM traces
    WHERE created_at >= datetime('now', ?)
    GROUP BY strftime('%H:%M', created_at)
    ORDER BY time ASC
  `).all(since)

  const latency_series = seriesRows.map(r => ({ time: r.time, total_ms: Math.round(r.total_ms ?? 0), llm_ms: Math.round(r.llm_ms ?? 0), airs_ms: Math.round(r.airs_ms ?? 0) }))
  const volume_series  = seriesRows.map(r => ({ time: r.time, allowed: r.allowed, blocked: r.blocked }))

  return {
    total_requests: agg.total,
    blocked_count: agg.blocked,
    allowed_count: agg.allowed,
    protected_count: agg.protected ?? 0,
    direct_count: (agg.total - (agg.protected ?? 0)),
    block_rate_pct: agg.total > 0 ? Math.round((agg.blocked / agg.total) * 1000) / 10 : 0,
    avg_total_ms: Math.round(agg.avg_total ?? 0),
    p95_total_ms: p95,
    avg_llm_ms: Math.round(agg.avg_llm ?? 0),
    avg_airs_input_ms: Math.round(agg.avg_airs_in ?? 0),
    avg_airs_output_ms: Math.round(agg.avg_airs_out ?? 0),
    avg_airs_overhead_pct: agg.avg_airs_overhead_pct != null ? Math.round(agg.avg_airs_overhead_pct * 10) / 10 : null,
    avg_tokens_per_request: agg.avg_tokens_per_request != null ? Math.round(agg.avg_tokens_per_request) : null,
    blocked_at_input: agg.blocked_at_input ?? 0,
    blocked_at_output: agg.blocked_at_output ?? 0,
    rpm,
    detection_breakdown,
    provider_breakdown,
    latency_series,
    volume_series,
  }
}
