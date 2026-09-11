/**
 * moh-probe.mjs — Hebrew vs English AIRS detection probe.
 *
 * Fires matched HE/EN payload pairs straight at the Prisma AIRS sync scan API
 * (same body shape as airscan() in server.js) and prints a coverage table.
 *
 * This answers the one open question behind the Ministry of Health demo:
 * does the AI Runtime API detect the same threats in Hebrew as in English?
 * PA documents "Multilingual Scanning Support" (June 2026) for AI Red Teaming
 * only — French, Japanese, Thai, Hindi. Hebrew is not on that list, and there
 * is no published claim about the runtime detectors. So we measure it.
 *
 *   node moh-probe.mjs                 # full run, writes moh-probe-results.json
 *   node moh-probe.mjs --only=pi-01    # single pair
 *   node moh-probe.mjs --lang=he       # one language only
 */
import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { PAIRS } from './moh-probe-pairs.js'

// Minimum spacing between scans. Below ~2s AIRS starts skipping DLP silently.
const SCAN_GAP_MS = Number(process.env.MOH_PROBE_GAP_MS) || 2200

// ─── AIRS call ────────────────────────────────────────────────────────────────

// Same override chain as moh-routes.js. The profile already honoured
// MOH_AIRS_PROFILE_NAME but the key and base URL did not, so on a host where
// the portal-wide AIRS_* point at one SCM tenant and MOH_AIRS_* at another —
// which is exactly the EC2 setup — this sent the *team* key with the
// *personal* profile and every scan came back "AI Profile not found". It only
// ever worked on a machine where both happened to be the same tenant.
const BASE = process.env.MOH_AIRS_BASE_URL || process.env.AIRS_BASE_URL
const KEY = process.env.MOH_AIRS_API_KEY || process.env.AIRS_API_KEY
const PROFILE = process.env.MOH_AIRS_PROFILE_NAME || process.env.AIRS_PROFILE_NAME

/**
 * `mcp` pairs are not prompts. Their payload is a tool DESCRIPTION inside a
 * tools/list manifest, so they have to go up as a tool_event or the
 * tool-poisoning detector never sees them and the row reports a false miss.
 *
 * For tools/list the output MUST be a bare mcp.Tool[] — wrapping it as
 * {"tools":[…]} is rejected with "cannot unmarshal object into Go value of
 * type []*mcp.Tool".
 */
function contentFor(text, mcp) {
  if (!mcp) return { prompt: text }
  const method = mcp.method || 'tools/list'
  return {
    tool_event: {
      metadata: {
        ecosystem: 'mcp',
        method,
        server_name: mcp.server || 'kupat-holim-connect',
        tool_invoked: mcp.tool,
      },
      input: JSON.stringify({ method }),
      output: method === 'tools/call'
        ? text
        : JSON.stringify([{ name: mcp.tool, description: text, inputSchema: mcp.inputSchema || { type: 'object' } }]),
    },
  }
}

async function scan(prompt, tag, mcp = null) {
  const body = {
    tr_id: `moh-probe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ai_profile: { profile_name: PROFILE },
    metadata: { app_name: 'MOH RFI Probe', ai_model: 'probe', app_user: 'moh-probe' },
    contents: [contentFor(prompt, mcp)],
  }
  const t0 = Date.now()
  const res = await fetch(`${BASE}/v1/scan/sync/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-pan-token': KEY },
    body: JSON.stringify(body),
  })
  const latencyMs = Date.now() - t0
  if (!res.ok) {
    return { tag, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`, latencyMs }
  }
  const data = await res.json()
  // tool_event scans report under tool_detected.*.detection_entries rather
  // than prompt_detected, so an MCP row would otherwise show BLOCK with no
  // detector next to it.
  const entries = [
    ...(data.tool_detected?.output_detected?.detection_entries || []),
    ...(data.tool_detected?.input_detected?.detection_entries || []),
  ]
  const detected = entries.length
    ? [...new Set(entries.flatMap((e) => Object.entries(e.detections || {}).filter(([, v]) => v).map(([k]) => k)))]
    : Object.entries(data.prompt_detected || {})
        .filter(([, v]) => v)
        .map(([k]) => k)
  return {
    tag,
    action: data.action,
    category: data.category,
    detected,
    scan_id: data.scan_id,
    latencyMs,
  }
}

// ─── Runner ───────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Sequential with spacing — deliberately NOT concurrent.
 *
 * AIRS silently skips DLP evaluation when scans arrive faster than roughly one
 * every two seconds: it returns dlp:false with timeout:false and error:false,
 * so there is no failure signal and the run reports gaps that do not exist. An
 * earlier 4-way concurrent version of this probe made six DLP categories look
 * flaky; at this pacing they are deterministic. Slower, but the numbers are
 * the whole point of the tool.
 */
async function pool(items, _size, fn, gapMs = SCAN_GAP_MS) {
  const out = []
  for (let i = 0; i < items.length; i++) {
    out[i] = await fn(items[i])
    if (i < items.length - 1) await sleep(gapMs)
  }
  return out
}

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', grey: '\x1b[90m',
}

function verdictCell(r, expect) {
  if (!r) return `${C.grey}—      ${C.reset}`
  if (r.error) return `${C.yellow}ERROR  ${C.reset}`
  const blocked = r.action === 'block'
  const correct = expect === 'block' ? blocked : !blocked
  const word = blocked ? 'BLOCK' : 'allow'
  const colour = correct ? C.green : C.red
  return `${colour}${word.padEnd(6)}${C.reset}`
}

async function main() {
  if (!BASE || !KEY || !PROFILE) {
    console.error(
      `${C.red}Missing AIRS config.${C.reset} Need AIRS_BASE_URL, AIRS_API_KEY and ` +
        `AIRS_PROFILE_NAME (or MOH_AIRS_PROFILE_NAME) in .env.\n` +
        `  AIRS_BASE_URL     = ${BASE || '(unset)'}\n` +
        `  AIRS_API_KEY      = ${KEY ? '(set)' : '(unset)'}\n` +
        `  profile           = ${PROFILE || '(unset)'}`
    )
    process.exit(1)
  }

  let pairs = PAIRS
  if (args.only) pairs = pairs.filter((p) => p.id === args.only)
  const langs = args.lang ? [args.lang] : ['en', 'he']

  console.log(`\n${C.bold}Prisma AIRS — Hebrew vs English detection probe${C.reset}`)
  const jobCount = pairs.length * langs.length
  console.log(`${C.dim}profile: ${PROFILE}   endpoint: ${BASE}   pairs: ${pairs.length}${C.reset}`)
  console.log(`${C.dim}${jobCount} scans, ${SCAN_GAP_MS}ms apart — about ${Math.ceil((jobCount * (SCAN_GAP_MS + 900)) / 60000)} min. Spacing is required: AIRS drops DLP under rapid calls.${C.reset}\n`)

  const jobs = []
  for (const p of pairs) for (const lang of langs) jobs.push({ p, lang })

  const raw = await pool(jobs, 4, async ({ p, lang }) => ({
    id: p.id,
    lang,
    ...(await scan(p[lang], `${p.id}/${lang}`, p.mcp || null)),
  }))

  const byId = {}
  for (const r of raw) (byId[r.id] ||= {})[r.lang] = r

  // Table
  const head =
    `${'ID'.padEnd(10)} ${'EXPECT'.padEnd(7)} ${'EN'.padEnd(6)} ${'HE'.padEnd(6)} ` +
    `${'EN category'.padEnd(22)} ${'HE category'.padEnd(22)} SCENARIO`
  console.log(`${C.bold}${head}${C.reset}`)
  console.log(C.grey + '─'.repeat(head.length + 8) + C.reset)

  const gaps = []
  for (const p of pairs) {
    const en = byId[p.id]?.en
    const he = byId[p.id]?.he
    console.log(
      `${p.id.padEnd(10)} ${p.expect.padEnd(7)} ` +
        `${verdictCell(en, p.expect)} ${verdictCell(he, p.expect)} ` +
        `${String(en?.category ?? en?.error ?? '—').slice(0, 21).padEnd(22)} ` +
        `${String(he?.category ?? he?.error ?? '—').slice(0, 21).padEnd(22)} ` +
        `${C.dim}${p.label}${C.reset}`
    )
    if (p.expect === 'block' && en?.action === 'block' && he?.action !== 'block') {
      gaps.push(p)
    }
  }

  // Summary
  const attacks = pairs.filter((p) => p.expect === 'block')
  const controls = pairs.filter((p) => p.expect === 'allow')
  const hit = (lang) => attacks.filter((p) => byId[p.id]?.[lang]?.action === 'block').length
  const falsePos = (lang) => controls.filter((p) => byId[p.id]?.[lang]?.action === 'block').length
  const avgMs = (lang) => {
    const v = raw.filter((r) => r.lang === lang && r.latencyMs).map((r) => r.latencyMs)
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0
  }

  console.log(`\n${C.bold}Summary${C.reset}`)
  for (const lang of langs) {
    const pct = attacks.length ? Math.round((hit(lang) / attacks.length) * 100) : 0
    console.log(
      `  ${lang.toUpperCase()}  detected ${C.bold}${hit(lang)}/${attacks.length}${C.reset} attacks (${pct}%)  ` +
        `false positives on controls: ${falsePos(lang)}/${controls.length}  ` +
        `${C.dim}avg ${avgMs(lang)}ms${C.reset}`
    )
  }

  if (gaps.length) {
    console.log(`\n${C.yellow}${C.bold}Hebrew gaps — blocked in English, allowed in Hebrew:${C.reset}`)
    for (const g of gaps) console.log(`  ${C.yellow}•${C.reset} ${g.id.padEnd(10)} ${g.label}`)
    console.log(
      `\n${C.dim}These are the payloads to either lead in English or surface honestly\n` +
        `in the Detection Matrix tab as a coverage question for the RFI.${C.reset}`
    )
  } else {
    console.log(`\n${C.green}No Hebrew-only gaps — Hebrew parity with English on this set.${C.reset}`)
  }

  const outFile = 'moh-probe-results.json'
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        profile: PROFILE,
        endpoint: BASE,
        pairs: pairs.map((p) => ({ ...p, results: byId[p.id] || {} })),
        summary: Object.fromEntries(
          langs.map((l) => [
            l,
            { detected: hit(l), of: attacks.length, falsePositives: falsePos(l), avgMs: avgMs(l) },
          ])
        ),
      },
      null,
      2
    )
  )
  console.log(`\n${C.dim}Full detail written to ${outFile}${C.reset}\n`)
}

main().catch((e) => {
  console.error(`${C.red}Probe failed:${C.reset}`, e)
  process.exit(1)
})
