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
      user_agent TEXT
    );
  `)
  return _db
}

export function insertTrace(t) {
  const id = t.id ?? `trace_${randomUUID()}`
  db().prepare(`
    INSERT INTO traces (id, created_at, prompt, response, backend, model, verdict, category,
      threats_detected, airs_enabled, total_ms, airs_input_ms, llm_ms, airs_output_ms,
      tokens_in, tokens_out, profile, attack_label, attack_severity)
    VALUES (@id, @created_at, @prompt, @response, @backend, @model, @verdict, @category,
      @threats_detected, @airs_enabled, @total_ms, @airs_input_ms, @llm_ms, @airs_output_ms,
      @tokens_in, @tokens_out, @profile, @attack_label, @attack_severity)
  `).run({
    ...t,
    id,
    created_at: new Date().toISOString(),
    threats_detected: JSON.stringify(t.threats_detected ?? []),
    airs_enabled: t.airs_enabled ? 1 : 0,
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
  return rows.map(r => ({ ...r, threats_detected: JSON.parse(r.threats_detected || '[]'), airs_enabled: !!r.airs_enabled }))
}

export function getTrace(id) {
  const trace = db().prepare('SELECT * FROM traces WHERE id = ?').get(id)
  if (!trace) return null
  const spans = db().prepare('SELECT * FROM spans WHERE trace_id = ? ORDER BY start_ms ASC').all(id)
  return {
    ...trace,
    threats_detected: JSON.parse(trace.threats_detected || '[]'),
    airs_enabled: !!trace.airs_enabled,
    spans: spans.map(s => ({ ...s, metadata: s.metadata ? JSON.parse(s.metadata) : null })),
  }
}

export function deleteTrace(id) {
  const d = db()
  d.prepare('DELETE FROM spans WHERE trace_id = ?').run(id)
  d.prepare('DELETE FROM traces WHERE id = ?').run(id)
}

export function insertActivity({ view, ip, user_agent }) {
  db().prepare(
    `INSERT INTO activity_log (ts, view, ip, user_agent) VALUES (?, ?, ?, ?)`
  ).run(new Date().toISOString(), view, ip ?? null, user_agent ?? null)
}

export function getActivity({ limit = 100 } = {}) {
  return db().prepare(`
    SELECT
      ip,
      MAX(ts) as last_seen,
      COUNT(*) as visits,
      MAX(user_agent) as user_agent
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
