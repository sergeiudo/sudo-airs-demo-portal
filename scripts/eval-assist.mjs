#!/usr/bin/env node
/**
 * eval-assist.mjs — does Ask AIRS find the right page? Retrieval only (no model):
 * each question is sent to /api/assist/search with the pillar it would be asked
 * on, and passes when one of the top 8 passages (what the model would see)
 * matches its expectation.
 *
 *   node scripts/eval-assist.mjs                      # against http://localhost:3001
 *   node scripts/eval-assist.mjs --base http://host   # another server
 *   node scripts/eval-assist.mjs --verbose            # print the top hits of every question
 *
 * Add a question whenever Ask AIRS misses one in real use.
 */
const args = process.argv.slice(2)
const BASE = (args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://localhost:3001').replace(/\/+$/, '')
const VERBOSE = args.includes('--verbose')

// [pillar, question, expectation] — expectation fields are all optional, every given one must match one hit.
const GOLDEN = [
  ['apiIntercept', 'Which fields does the synchronous scan request body take?', { title: /Schema ScanRequest|POST \/v1\/scan\/sync\/request/ }],
  ['apiIntercept', 'What error is returned when the AIRS API rate limit is exceeded?', { product: /Runtime/, text: /429|rate/i }],
  ['apiIntercept', 'How do I create an API security profile?', { source: /Runtime Security guide/ }],
  ['apiIntercept', 'What does the prompt injection detection catch?', { product: /Runtime/, text: /prompt injection/i }],
  ['apiIntercept', 'How do I scan a prompt and the model response together?', { product: /Runtime/ }],
  ['home', 'How do I deploy the network intercept VM-Series firewall?', { source: /Runtime Security guide/, heading: /firewall|vm-series/i }],
  ['apiIntercept', 'What HTTP status does an AI Gateway guardrail deny return?', { source: /AI Gateway/, text: /446/ }],
  ['llmGateway', 'How do I configure a fallback between two providers?', { title: /Fallback/i }],
  ['developerCorner', 'How does the circuit breaker work?', { title: /Circuit Breaker/ }],
  ['enterpriseAccess', 'How do I rotate an AI Gateway API key?', { title: /Rotation|rotate/i }],
  ['enterpriseAccess', 'Which JWT claims does the gateway require?', { text: /portkey_oid|portkey_workspace/ }],
  ['developerCorner', 'How do I deploy the AI Gateway data plane on Kubernetes with Helm?', { text: /helm/i }],
  ['mcpSecurity', 'How does the MCP Gateway authenticate users to MCP servers?', { title: /MCP|OAuth|Authentication/i, source: /AI Gateway/ }],
  ['modelScanning', 'Which model file formats can AI Model Security scan?', { product: /Supply Chain/ }],
  ['modelScanning', 'How do security groups and rules decide a model scan verdict?', { product: /Supply Chain/, text: /rule/i }],
  ['modelScanning', 'How do I scan a model from Hugging Face?', { product: /Supply Chain/, text: /hugging ?face/i }],
  ['modelScanning', 'How do I list model scans with the API?', { product: /Supply Chain/, text: /scans/i }],
  ['redTeaming', 'How do I add a target for AI Red Teaming?', { source: /Red Teaming guide/, heading: /target/i }],
  ['redTeaming', 'How do network channels reach a private target?', { product: /Red Teaming/, text: /channel/i }],
  ['redTeaming', 'What is an agent scan in AI Red Teaming?', { product: /Red Teaming/, text: /agent/i }],
  ['redTeaming', 'How do I start a red teaming scan with the API?', { product: /Red Teaming/, title: /scan/i }],
  ['mcpSecurity', 'What is the Prisma AIRS MCP server?', { text: /MCP server/i }],
  ['mcpSecurity', 'How do I demo MCP security in this portal?', { url: /^portal:\/\/pillar\/mcpSecurity/ }],
  ['developerCorner', 'Which guide in this portal shows my first runtime scan?', { url: /^portal:\/\/guide\// }],
  ['home', 'What is new in AI Red Teaming recently?', { source: /Release notes/ }],
  ['releaseNotes', 'Which AI Gateway release added soft deny?', { source: /Release notes/, text: /soft_deny_200|soft deny/i }],
]

const matches = (h, e) => (!e.title || e.title.test(h.title + ' ' + (h.heading ?? '')))
  && (!e.heading || e.heading.test(h.heading ?? ''))
  && (!e.source || e.source.test(h.source ?? ''))
  && (!e.product || e.product.test(h.product ?? ''))
  && (!e.url || e.url.test(h.url ?? ''))
  && (!e.text || e.text.test(h.snippet ?? ''))

let pass = 0
const fails = []
for (const [pillar, q, expect] of GOLDEN) {
  const r = await fetch(`${BASE}/api/assist/search?k=8&q=${encodeURIComponent(q)}&pillar=${pillar}`).then((x) => x.json())
  if (r.status?.state !== 'ready') { console.error(`docs index not ready on ${BASE}: ${r.status?.state}`); process.exit(2) }
  // /search returns 260-character snippets; a text expectation is checked against those.
  const hit = r.hits.findIndex((h) => matches(h, expect))
  if (hit >= 0) pass++
  else fails.push([pillar, q, r.hits])
  if (VERBOSE || hit < 0) {
    console.log(`${hit >= 0 ? 'PASS' : 'MISS'} [${pillar}] ${q}${hit >= 0 ? `  (rank ${hit + 1})` : ''}`)
    if (hit < 0 || VERBOSE) for (const h of r.hits.slice(0, 8)) console.log(`       ${h.source} · ${h.title}${h.heading && h.heading !== h.title ? ` › ${h.heading}` : ''}`)
  }
}
console.log(`\n${pass} of ${GOLDEN.length} questions find their page in the top 8 (${Math.round((pass / GOLDEN.length) * 100)}%)`)
process.exit(fails.length ? 1 : 0)
