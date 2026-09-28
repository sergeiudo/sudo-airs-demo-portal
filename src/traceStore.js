// src/traceStore.js
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'traces.db')

let _db = null

/**
 * Every write to the store, as an event — the Telemetry pillar's live stream
 * (/api/telemetry/stream) listens here. One process writes every trace
 * (insertTrace is the only path in), so an in-process emitter sees them all.
 */
export const traceEvents = new EventEmitter()
traceEvents.setMaxListeners(200)

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
  traceEvents.emit('trace', id)
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
  traceEvents.emit('delete', id)
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
  // "Today" = since 00:00 UTC — created_at is stored in UTC ISO form.
  const today = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`
  const row = d.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN verdict='BLOCKED' THEN 1 ELSE 0 END) as blocked, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as today, MAX(created_at) as last FROM traces`).get(today)
  return { total: row.total ?? 0, blocked: row.blocked ?? 0, today: row.today ?? 0, last: row.last ?? null }
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
  traceEvents.emit('reset')
}

/**
 * created_at is stored as ISO-8601 ('2026-09-28T09:50:24.979Z'). SQLite's
 * datetime('now', …) returns '2026-09-28 17:07:40' — and because 'T' sorts
 * after ' ', comparing the two put every trace since midnight UTC inside
 * "the last 20 minutes". Cut-offs are ISO strings computed here instead.
 */
const isoAgo = (ms) => new Date(Date.now() - ms).toISOString()
const SQLITE_OFFSET_MS = { minutes: 60_000, hours: 3_600_000, days: 86_400_000, years: 365 * 86_400_000 }
function cutoffFromOffset(offset) {
  const m = /^-(\d+) (minutes|hours|days|years)$/.exec(String(offset))
  return m ? isoAgo(Number(m[1]) * SQLITE_OFFSET_MS[m[2]]) : isoAgo(20 * 60_000)
}

export function getMetrics(since = '-20 minutes') {
  const d = db()
  const cutoff = cutoffFromOffset(since)
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

  const rpm = d.prepare(`SELECT COUNT(*) as n FROM traces WHERE created_at >= ?`).get(isoAgo(60_000)).n

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
    WHERE created_at >= ?
    GROUP BY strftime('%Y-%m-%d %H:%M', created_at)
    ORDER BY MIN(created_at) ASC
  `).all(cutoff)

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

// ─── Telemetry pillar: where each prompt actually went ──────────────────────
//
// Every trace is classified by the path it took, from the evidence it carries:
//   stopped   — AIRS (or a gateway guardrail) blocked it. `stage` says where:
//               input (the model was never called), output (the answer was
//               withheld), tool (a tool call or its result), native (a
//               non-AIRS guardrail — the legacy gateway's own checks).
//   cleared   — inspected and allowed (a flag-only hit is cleared + `flagged`).
//   unscanned — nothing inspected it. `gap`: off (AIRS switched off) or
//               failopen (a guardrail check errored and let it through).
// Traces that carry `detail` are classified from the recorded scans. Older
// rows fall back to their summary columns — see stageFallback().

const GATEWAY_TARGETS = new Set(['aigw', 'moh-aigw', 'portkey'])
const API_TARGETS = new Set(['bedrock', 'vertex', 'azure'])

const DETECTOR_FAMILIES = [
  ['injection', 'Prompt injection', /inject|jailbreak/i],
  ['agent', 'Agent threats', /agent|tool/i],
  ['dlp', 'Sensitive data (DLP)', /dlp|data_leak/i],
  ['toxic', 'Toxic content', /toxic/i],
  ['url', 'Malicious URL', /url/i],
  ['code', 'Malicious code', /malicious_code/i],
  ['source', 'Source code', /source_code/i],
  ['db', 'Database security', /db_sec/i],
  ['ungrounded', 'Ungrounded answer', /ungrounded/i],
  ['topic', 'Topic violation', /topic/i],
]
const detectorFamily = (key) => DETECTOR_FAMILIES.find(([, , re]) => re.test(String(key)))?.[0] ?? null
export const FAMILY_LABELS = Object.fromEntries(DETECTOR_FAMILIES.map(([k, l]) => [k, l]))

// Only what classification needs, pulled out of `detail` by SQLite — a list
// never parses tens of KB of forensics per row. Guarded by json_valid so one
// corrupt row cannot fail the whole query.
const J = (expr) => `CASE WHEN json_valid(detail) THEN ${expr} END`
const SUMMARY_COLUMNS = `
  id, created_at, backend, model, verdict, category, threats_detected, airs_enabled,
  total_ms, airs_input_ms, llm_ms, airs_output_ms, tokens_in, tokens_out,
  attack_label, attack_severity, substr(prompt, 1, 280) AS prompt_head, length(prompt) AS prompt_len,
  (response IS NOT NULL AND response != '') AS has_response,
  detail IS NOT NULL AS measured,
  ${J(`json_extract(detail, '$.airs.input.action')`)} AS in_action,
  ${J(`json_extract(detail, '$.airs.output.action')`)} AS out_action,
  ${J(`json_extract(detail, '$.airs.input.latencyMs')`)} AS in_scan_ms,
  ${J(`json_extract(detail, '$.airs.output.latencyMs')`)} AS out_scan_ms,
  ${J(`json_extract(detail, '$.enforcement')`)} AS enforcement,
  ${J(`(SELECT group_concat(key) FROM json_each(detail, '$.airs.input.prompt_detected') WHERE value = 1)`)} AS det_in,
  ${J(`(SELECT group_concat(key) FROM json_each(detail, '$.airs.output.response_detected') WHERE value = 1)`)} AS det_out,
  ${J(`(SELECT group_concat(key) FROM json_each(detail, '$.airs.input.tool_detected') WHERE value = 1)`)} AS det_tool,
  ${J(`EXISTS (SELECT 1 FROM json_each(detail, '$.mcp.steps') WHERE json_extract(value, '$.blocked') = 1 OR json_extract(value, '$.kind') = 'blocked')`)} AS tool_block,
  ${J(`EXISTS (SELECT 1 FROM json_each(detail, '$.gateway.hooks') h, json_each(h.value, '$.checks') c WHERE json_extract(c.value, '$.error') IS NOT NULL)`)} AS guardrail_error
`

export const targetOf = (backend) => String(backend || 'unknown').split('/')[0]

/** Where a block happened, for a row without recorded scans. */
function stageFallback(r, target) {
  // The gateway lanes record the whole gateway call as llm_ms — guardrail
  // included — so llm_ms cannot tell an input block from an output one there.
  // A block that produced no model output was stopped before the model.
  if (GATEWAY_TARGETS.has(target)) return (r.tokens_out > 0 || r.has_response) ? 'output' : 'input'
  return r.llm_ms > 0 ? 'output' : 'input'
}

function summarize(r) {
  const target = targetOf(r.backend)
  let detectors = []
  try { detectors = JSON.parse(r.threats_detected || '[]') } catch { /* malformed row */ }
  // Gateway blocks often arrive with an empty threats column; the recorded
  // scans still name the detectors.
  if (!detectors.length) {
    detectors = [
      ...String(r.det_in || '').split(',').filter(Boolean).map((k) => `prompt:${k}`),
      ...String(r.det_out || '').split(',').filter(Boolean).map((k) => `response:${k}`),
      ...String(r.det_tool || '').split(',').filter(Boolean).map((k) => `tool:${k}`),
    ]
  }
  const families = [...new Set(detectors.map(detectorFamily).filter(Boolean))]

  let outcome, stage = null, gap = null
  const airs = !!r.airs_enabled
  if (r.verdict === 'BLOCKED') {
    outcome = 'stopped'
    if (!airs) stage = 'native'
    else if (r.in_action === 'block') stage = 'input'
    else if (r.out_action === 'block') stage = 'output'
    else if (r.tool_block) stage = 'tool'
    else stage = stageFallback(r, target)
  } else if (!airs) {
    outcome = 'unscanned'; gap = 'off'
  } else if (r.guardrail_error) {
    outcome = 'unscanned'; gap = 'failopen'
  } else {
    outcome = 'cleared'
  }

  // Internal ids (MOH "ag-01", gateway lane "defaults") are not attack names.
  const human = r.attack_label && /\s/.test(r.attack_label) && !/^[a-z]{1,4}-\d+$/i.test(r.attack_label)
  return {
    id: r.id,
    at: r.created_at,
    target,
    model: r.model,
    verdict: r.verdict,
    outcome, stage, gap,
    flagged: r.verdict === 'FLAGGED',
    airs,
    families,
    detectors,
    attack: human ? r.attack_label : null,
    scenario: !human && r.attack_label ? r.attack_label : null,
    severity: r.attack_severity || null,
    prompt: r.prompt_head ?? '',
    promptLen: r.prompt_len ?? 0,
    totalMs: r.total_ms ?? null,
    scanMs: r.airs_input_ms ?? r.in_scan_ms ?? null,
    outScanMs: r.airs_output_ms ?? r.out_scan_ms ?? null,
    llmMs: r.llm_ms ?? null,
    tokensIn: r.tokens_in ?? null,
    tokensOut: r.tokens_out ?? null,
    measured: !!r.measured,
    enforcement: r.enforcement || (GATEWAY_TARGETS.has(target) ? 'gateway' : API_TARGETS.has(target) ? 'api' : null),
  }
}

export function traceSummary(id) {
  const r = db().prepare(`SELECT ${SUMMARY_COLUMNS} FROM traces WHERE id = ?`).get(id)
  return r ? summarize(r) : null
}

const OUTCOME_SQL = {
  stopped: `verdict = 'BLOCKED'`,
  cleared: `verdict IN ('ALLOWED', 'FLAGGED') AND airs_enabled = 1`,
  unscanned: `verdict != 'BLOCKED' AND (airs_enabled = 0 OR ${J(`EXISTS (SELECT 1 FROM json_each(detail, '$.gateway.hooks') h, json_each(h.value, '$.checks') c WHERE json_extract(c.value, '$.error') IS NOT NULL)`)})`,
}

/**
 * The prompt log and the live wire's history: newest first, paged by a
 * created_at cursor so a trace arriving mid-scroll never shifts a page.
 */
// A family filter matches the detector keys wherever they were recorded — the
// summary column, or the scans in detail (gateway blocks often have only the
// latter). SQLite lets WHERE name the SELECT's aliases (det_in …).
const FAMILY_TERMS = {
  injection: ['inject', 'jailbreak'], agent: ['agent'], dlp: ['dlp', 'data_leak'], toxic: ['toxic'], url: ['url'],
  code: ['malicious_code'], source: ['source_code'], db: ['db_sec'], ungrounded: ['ungrounded'], topic: ['topic'],
}

export function traceFeed({ limit = 50, before, target, outcome, q, family } = {}) {
  const where = ['1=1']
  const params = []
  if (FAMILY_TERMS[family]) {
    const cols = ['threats_detected', 'det_in', 'det_out', 'det_tool']
    where.push(`(${FAMILY_TERMS[family].flatMap((term) => cols.map((c) => { params.push(`%${term}%`); return `${c} LIKE ?` })).join(' OR ')})`)
  }
  if (before) { where.push('created_at < ?'); params.push(String(before)) }
  if (target) { where.push(`(backend = ? OR backend LIKE ?)`); params.push(target, `${target}/%`) }
  if (OUTCOME_SQL[outcome]) where.push(`(${OUTCOME_SQL[outcome]})`)
  if (q) {
    where.push('(prompt LIKE ? OR model LIKE ? OR attack_label LIKE ? OR threats_detected LIKE ?)')
    params.push(...Array(4).fill(`%${q}%`))
  }
  const n = Math.min(Math.max(Number(limit) || 50, 1), 200)
  const rows = db().prepare(`SELECT ${SUMMARY_COLUMNS} FROM traces WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).all(...params, n + 1)
  const more = rows.length > n
  // A cleared-looking row whose guardrail failed open is not cleared. The SQL
  // filter above keeps those out of "cleared" already; this keeps the page honest.
  const items = rows.slice(0, n).map(summarize).filter((s) => !outcome || s.outcome === outcome)
  return { items, more, cursor: more ? rows[n - 1].created_at : null }
}

// ─── overview ────────────────────────────────────────────────────────────────

export const TELEMETRY_WINDOWS = { '20m': 20 * 60_000, '1h': 3_600_000, '24h': 86_400_000, '7d': 7 * 86_400_000, all: null }

const NICE_BUCKETS = [60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000, 3_600_000, 7_200_000, 10_800_000,
  21_600_000, 43_200_000, 86_400_000, 2 * 86_400_000, 7 * 86_400_000, 14 * 86_400_000, 30 * 86_400_000]
const bucketFor = (spanMs) => NICE_BUCKETS.find((b) => spanMs / b <= 48) ?? NICE_BUCKETS.at(-1)

function quantile(values, q) {
  const v = values.filter((x) => x != null && Number.isFinite(x) && x > 0).sort((a, b) => a - b)
  if (!v.length) return null
  const i = (v.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return Math.round(v[lo] + (v[hi] - v[lo]) * (i - lo))
}
const dist = (values) => {
  const v = values.filter((x) => x != null && Number.isFinite(x) && x > 0)
  return { n: v.length, p50: quantile(v, 0.5), p95: quantile(v, 0.95) }
}

function tally(list) {
  const t = { traces: list.length, inspected: 0, stopped: 0, cleared: 0, unscanned: 0, flagged: 0,
    off: 0, failopen: 0, stages: { input: 0, output: 0, tool: 0, native: 0 }, measured: 0 }
  for (const s of list) {
    t[s.outcome] += 1
    if (s.outcome === 'stopped' && s.stage) t.stages[s.stage] += 1
    if (s.gap) t[s.gap] += 1
    if (s.flagged) t.flagged += 1
    if (s.measured) t.measured += 1
  }
  // "Inspected" = AIRS returned a verdict: cleared, or stopped by AIRS (a
  // native-guardrail block was not an AIRS inspection).
  t.inspected = t.cleared + t.stopped - t.stages.native
  return t
}

/**
 * Everything the Telemetry overview draws, for one window and (optionally)
 * one target. Aggregates are computed here over the window's rows — the
 * whole store is ~1k rows, so a pass in JS is cheaper than getting the SQL
 * percentile and bucketing right.
 */
export function traceOverview({ window = '24h', target = '' } = {}) {
  const d = db()
  const span = TELEMETRY_WINDOWS[window] === undefined ? TELEMETRY_WINDOWS['24h'] : TELEMETRY_WINDOWS[window]
  const cutoff = span ? isoAgo(span) : null
  const where = []
  const params = []
  if (cutoff) { where.push('created_at >= ?'); params.push(cutoff) }
  if (target) { where.push('(backend = ? OR backend LIKE ?)'); params.push(target, `${target}/%`) }
  const rows = d.prepare(`SELECT ${SUMMARY_COLUMNS} FROM traces ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at ASC`).all(...params)
  const list = rows.map(summarize)
  // All-time totals for the same target — the "show all time" offer must
  // count what it would actually show.
  const all = target
    ? d.prepare(`SELECT COUNT(*) AS n, MIN(created_at) AS first, MAX(created_at) AS last FROM traces WHERE backend = ? OR backend LIKE ?`).get(target, `${target}/%`)
    : d.prepare(`SELECT COUNT(*) AS n, MIN(created_at) AS first, MAX(created_at) AS last FROM traces`).get()

  const totals = tally(list)

  // What AIRS caught — each family once per stopped trace, split by stage.
  const fam = {}
  let unattributed = 0
  for (const s of list) {
    if (s.outcome !== 'stopped' || s.stage === 'native') continue
    if (!s.families.length) { unattributed += 1; continue }
    for (const f of s.families) {
      fam[f] ??= { key: f, label: FAMILY_LABELS[f], count: 0, stages: { input: 0, output: 0, tool: 0 } }
      fam[f].count += 1
      fam[f].stages[s.stage] = (fam[f].stages[s.stage] ?? 0) + 1
    }
  }
  const families = Object.values(fam).sort((a, b) => b.count - a.count)

  // Per target — the enforcement points compared.
  const byTarget = {}
  for (const s of list) (byTarget[s.target] ??= []).push(s)
  const targets = Object.entries(byTarget).map(([id, l]) => ({
    id,
    ...tally(l),
    scan: dist(l.map((s) => s.scanMs)),
    total: dist(l.filter((s) => s.outcome === 'cleared').map((s) => s.totalMs)),
    model: dist(l.filter((s) => s.outcome !== 'stopped' || s.stage !== 'input').map((s) => s.llmMs)),
    last: l.at(-1)?.at ?? null,
  })).sort((a, b) => b.traces - a.traces)

  // Traffic over time, in buckets sized to the span actually covered.
  const t0 = cutoff ? Date.parse(cutoff) : (list[0] ? Date.parse(list[0].at) : Date.now())
  const bucketMs = bucketFor(Math.max(60_000, Date.now() - t0))
  const start = Math.floor(t0 / bucketMs) * bucketMs
  const count = Math.max(1, Math.ceil((Date.now() - start) / bucketMs))
  const buckets = Array.from({ length: count }, (_, i) => ({ t: new Date(start + i * bucketMs).toISOString(), stopped: 0, cleared: 0, unscanned: 0 }))
  for (const s of list) {
    const i = Math.floor((Date.parse(s.at) - start) / bucketMs)
    if (buckets[i]) buckets[i][s.outcome] += 1
  }

  // The cost of protection, measured. API-layer only: there the two scans and
  // the model call are separate, timed hops. On the gateway lanes the
  // guardrail runs inside the gateway call, so its time is not separable
  // from the model's in the summary columns.
  const api = list.filter((s) => API_TARGETS.has(s.target))
  const answered = api.filter((s) => s.outcome === 'cleared' && s.llmMs > 0)
  const direct = api.filter((s) => s.outcome === 'unscanned' && s.gap === 'off' && s.llmMs > 0)
  const promptBlocks = api.filter((s) => s.outcome === 'stopped' && s.stage === 'input')
  const latency = {
    answered: { n: answered.length, scanIn: dist(answered.map((s) => s.scanMs)), model: dist(answered.map((s) => s.llmMs)), scanOut: dist(answered.map((s) => s.outScanMs)), total: dist(answered.map((s) => s.totalMs)) },
    direct: { n: direct.length, total: dist(direct.map((s) => s.totalMs)) },
    promptBlocks: { n: promptBlocks.length, total: dist(promptBlocks.map((s) => s.totalMs)), scan: dist(promptBlocks.map((s) => s.scanMs)) },
    gateway: (() => {
      const g = list.filter((s) => GATEWAY_TARGETS.has(s.target) && s.measured)
      return { n: g.length, guardrailIn: dist(g.map((s) => s.scanMs)), guardrailOut: dist(g.map((s) => s.outScanMs)) }
    })(),
  }

  return {
    window, target: target || null, since: cutoff, generatedAt: new Date().toISOString(),
    first: list[0]?.at ?? null, last: list.at(-1)?.at ?? null,
    allTime: { traces: all.n ?? 0, first: all.first, last: all.last },
    totals, families, unattributed, targets,
    series: { bucketMs, buckets },
    latency,
    // Tokens the input-stage blocks never spent are not knowable (the model
    // was never asked), so they are counted as calls, not estimated tokens.
    modelCallsAvoided: totals.stages.input,
    tokens: {
      in: list.reduce((a, s) => a + (s.tokensIn || 0), 0),
      out: list.reduce((a, s) => a + (s.tokensOut || 0), 0),
    },
  }
}
