import { pick } from './links'
import { runtimeScan, twoScans, asyncFlow, toolEvent, BASE } from '../snippets'

/**
 * AIRS Runtime API (API intercept) — from an API key to production.
 * Code marked `build` is generated from the live panel's inputs.
 */

const AIRSFETCH = `/**
 * Two different 429s, measured: "Requests per second exceeded limit" (no
 * retry_after — clears in well under a second, so retry) and the reports
 * endpoint's per-minute quota, \`retry_after: {interval: 1, unit: "minute"}\`
 * (retrying in seconds only burns more of the quota, so stop and report it).
 */
export async function airsFetch(url, init, delays) {
  for (let i = 0; ; i++) {
    const res = await fetch(url, init)
    if (res.status !== 429) return res
    const text = await res.text().catch(() => '')
    let waitMs = 0
    try {
      const ra = JSON.parse(text)?.error?.retry_after
      if (ra?.interval) waitMs = ra.interval * ({ second: 1e3, minute: 6e4, hour: 36e5 }[ra.unit] ?? 1e3)
    } catch { /* not JSON */ }
    if (i >= delays.length || waitMs > 5000) return new Response(text, { status: 429, headers: res.headers })
    await new Promise((r) => setTimeout(r, Math.max(delays[i], waitMs)))
  }
}
export const SCAN_RETRY_MS = [250, 600]          // enforcement path: short
export const REPORT_RETRY_MS = [500, 1200, 2500] // background: patient`

const AIRSCAN = `export async function airscan(prompt, response = null, model = 'unknown', { deferReport = false, skipReport = false } = {}) {
  const body = {
    tr_id: \`citadel-\${Date.now()}\`,
    ai_profile: { profile_name: process.env.AIRS_PROFILE_NAME },
    metadata: { app_name: 'SUDO AIRS Demo', ai_model: model, app_user: 'demo-user' },
    contents: [{ prompt, ...(response != null ? { response } : {}) }],
  }
  const url = \`\${process.env.AIRS_BASE_URL}/v1/scan/sync/request\`
  let res, data
  const scan = await captureHttp(async () => {
    res = await airsFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-pan-token': process.env.AIRS_API_KEY,
      },
      body: JSON.stringify(body),
    }, SCAN_RETRY_MS)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(\`AIRS scan failed (\${res.status}): \${text}\`)
    }
    data = await res.json()
  })
  // deferReport: answer now, fetch the per-service report in the background
  if (deferReport || skipReport) {
    return { data, requestBody: body, requestUrl: url, report: null,
      reportPromise: deferReport && data?.report_id ? startReportFetch(data.report_id) : null,
      requestId: res.headers.get('x-request-id') }
  }
  // …otherwise fetch the report inline (best effort)
}`

const CHAT_FLOW = `// /api/chat, protected path — the verdict gates the model call
const airsPromptScan = await airscan(llmInput, null, modelLabel, { deferReport: true })
if (airsPromptScan.data.action === 'block') {
  res.json({ ...telemetry, trace_id })        // answer the user now; the model is never called
  void finishDeferredReports(/* … */)
  return
}
const llmText = await callModel(llmInput)
const airsResponseScan = await airscan(message, llmText, modelLabel, { deferReport: true })`

export const RUNTIME = [
  {
    id: 'rt-setup',
    group: 'runtime',
    title: 'Get an API key and a security profile',
    sub: 'The two things every Runtime API call needs',
    minutes: 5,
    level: 'Setup',
    docs: pick('pdfRuntime', 'rtOverview', 'mgmtApi', 'scanOauth'),
    blocks: [
      {
        type: 'prose',
        text: 'A scan call carries an **API key** (who is calling, and whose quota) and names a **security profile** (which detection services run, and whether each one blocks or allows). Both live in Strata Cloud Manager under AI Security.',
      },
      {
        type: 'steps',
        steps: [
          { title: 'Open API Applications', text: 'You need the Runtime API deployment profile associated with your tenant first — see "Tenant, licence & credentials".', path: ['Strata Cloud Manager', 'AI Security', 'API Applications'] },
          { title: 'Create a security profile', text: 'Turn on the detection services you want and set each to **Allow** or **Block**. You reference the profile by **name** (edits take effect without a code change) or by **ID** — editing a profile gives it a new ID, so names are usually the better choice.', path: ['Manage', 'Security Profiles', 'Create Security Profile'] },
          { title: 'Add an application and generate an API key', text: 'Name the app, pick the cloud provider and environment (and the agent framework, if it is an agent), then **Generate API Key**. Choose a rotation period (1, 3 or 6 months). Copy the key and the Code Template — the key is shown once.', path: ['Manage', 'Applications', 'Onboard API Account', 'Input API Details', 'Generate API Key'] },
          { title: 'Keep the key out of source control', text: 'Put it in a secret store and expose it to the app as an environment variable. The snippets in this hub use `PANW_AI_SEC_API_KEY` and `PANW_AI_PROFILE_NAME` — the names the official Python SDK reads.',
            code: [{ id: 'bash', lang: 'bash', code: `export PANW_AI_SEC_API_KEY="<the key from Strata Cloud Manager>"
export PANW_AI_PROFILE_NAME="<your security profile name>"
# Only for a non-US region (see API reference → Regions):
export PANW_AI_SEC_API_ENDPOINT="https://service-de.api.aisecurity.paloaltonetworks.com"` }] },
        ],
      },
      {
        type: 'table',
        title: 'Detection services you can enable',
        columns: ['Service', 'What it catches', 'Response field'],
        rows: [
          ['Prompt injection', 'Attempts to override instructions or guardrails. 9 languages (EN, ES, RU, DE, FR, JA, PT, IT, zh-CN).', '`prompt_detected.injection`'],
          ['AI agent protection', 'Leaking tool schemas, invoking tools directly, manipulating agent memory.', '`prompt_detected.agent`'],
          ['Sensitive data (DLP)', 'Card numbers, bank accounts, credentials… predefined or your Enterprise DLP profile. Optional masking.', '`prompt_detected.dlp` / `response_detected.dlp`'],
          ['Malicious URLs', 'URLs in malicious categories (basic), or per-category actions (advanced).', '`url_cats`'],
          ['Toxic content', 'Hate, sexual, violence, self-harm, criminal, regulated substances…', '`toxic_content`'],
          ['Malicious code', 'Malware in code (JS, Python, VBScript, PowerShell, Batch, Shell, Perl) — send it as `code_prompt` / `code_response`.', '`malicious_code`'],
          ['Database security', 'AI-generated SQL — allow or block per Create / Read / Update / Delete.', '`response_detected.db_security`'],
          ['Contextual grounding', 'Answers not supported by the `context` you send (response only).', '`response_detected.ungrounded`'],
          ['Custom topic guardrails', 'Allowed and blocked topics you define (English only; up to 20 per profile).', '`topic_violation`'],
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'OAuth instead of a raw key',
        text: 'The Scan API also accepts `Authorization: Bearer <token>`. Generate a token in SCM (API Keys → Generate Token, 1 hour to 30 days) or from code with the management API `POST https://api.sase.paloaltonetworks.com/aisec/v1/mgmt/oauth/client_credential/accesstoken`. The same quota applies, and scans are still logged against the key.',
      },
    ],
  },

  {
    id: 'rt-first-scan',
    group: 'runtime',
    title: 'Your first scan in 5 minutes',
    sub: 'One HTTPS call — and how to read the verdict',
    minutes: 5,
    level: 'Build',
    live: 'runtime.scan',
    docs: pick('rtSync', 'rtUseCases', 'rtErrors'),
    blocks: [
      {
        type: 'prose',
        text: 'Send the text to `POST /v1/scan/sync/request` with your key in `x-pan-token`. The verdict comes back in the same response — typically well under a second. The code below is exactly what the **Run it live** panel sends; change the prompt there and every language here follows.',
      },
      { type: 'code', build: (v) => runtimeScan(v).map((x) => ({ ...x, verified: true })) },
      { type: 'live', title: 'Run this exact request', text: 'Pick a preset on the right — benign, prompt injection, sensitive data or a malicious URL — and see the real verdict.' },
      {
        type: 'table',
        title: 'Reading the response',
        columns: ['Field', 'Meaning'],
        rows: [
          ['`action`', '`block` or `allow` — what your security profile says to do. **This is the field your code branches on.**'],
          ['`category`', '`malicious`, `benign`, `error` or `timeout`.'],
          ['`prompt_detected` / `response_detected`', 'One boolean per detection service that ran, e.g. `injection: true`, `dlp: true`, `url_cats: true`.'],
          ['`scan_id`, `report_id`', 'Keep both. The report (`R` + scan id) has per-service detail — see "Async scans, results and reports".'],
          ['`tr_id`, `session_id`', 'Your correlation ids, echoed back. Send the same `tr_id` for a prompt and its answer.'],
          ['`*_masked_data`', 'With DLP masking on, the text with matches replaced by X — safe to log or forward.'],
          ['`error`, `errors[]`', 'A detector that failed or timed out — decide whether that fails open or closed.'],
        ],
      },
      {
        type: 'callout', tone: 'tip',
        text: 'Branch on `action`, not on `category`: the profile decides whether a detection blocks. A `malicious` category with `action: allow` means the profile is set to alert-only for that service.',
      },
    ],
  },

  {
    id: 'rt-python',
    group: 'runtime',
    title: 'Python SDK (pan-aisecurity)',
    sub: 'The official SDK — sync, asyncio, errors',
    minutes: 6,
    level: 'Build',
    live: 'runtime.scan',
    docs: pick('pypiSdk', 'sdkOverview', 'sdkUsage', 'sdkAsyncio', 'ghSdk'),
    blocks: [
      {
        type: 'facts',
        items: [
          { label: 'Package', value: 'pan-aisecurity', mono: true, sub: 'Import name `aisecurity`' },
          { label: 'Latest', value: '0.11.0', sub: 'Released 2026-05-15' },
          { label: 'Python', value: '3.10+', sub: 'PyPI metadata; older pages still say 3.9–3.13' },
          { label: 'Reads', value: 'PANW_AI_SEC_API_KEY', mono: true, sub: 'plus `PANW_AI_SEC_API_ENDPOINT`, `PANW_AI_SEC_API_TOKEN`' },
        ],
      },
      {
        type: 'steps',
        steps: [
          { title: 'Install into a virtual environment', code: [{ id: 'bash', lang: 'bash', code: `python3 -m venv .venv && source .venv/bin/activate
python3 -m pip install "pan-aisecurity==0.11.0"` }] },
          { title: 'Scan a prompt', text: 'Verified against the live API from this portal — it is the same call the Run it live panel makes over REST.', code: null },
        ],
      },
      { type: 'code', build: (v) => runtimeScan(v, { langs: ['python'], sdk: true }).map((x) => ({ ...x, verified: true })) },
      {
        type: 'code', title: 'asyncio variant', text: 'Same methods on `aisecurity.scan.asyncio.scanner.Scanner`, awaited. Close the pool when you are done.',
        tabs: [{ id: 'python', lang: 'python', file: 'scan_async.py', code: `import asyncio
import os

import aisecurity
from aisecurity.generated_openapi_client.models.ai_profile import AiProfile
from aisecurity.scan.asyncio.scanner import Scanner      # ← asyncio flavour
from aisecurity.scan.models.content import Content

aisecurity.init(api_key=os.getenv("PANW_AI_SEC_API_KEY"))
profile = AiProfile(profile_name=os.getenv("PANW_AI_PROFILE_NAME"))


async def main():
    scanner = Scanner()
    try:
        result = await scanner.sync_scan(ai_profile=profile, content=Content(prompt="Hello"))
        print(result.action, result.category)
    finally:
        await scanner.close()            # always close the aiohttp pool


asyncio.run(main())
` }],
      },
      {
        type: 'code', title: 'Errors', text: 'Every SDK error is an `AISecSDKException`; the message starts with the error type.',
        tabs: [{ id: 'python', lang: 'python', file: 'errors.py', code: `from aisecurity.exceptions import AISecSDKException

try:
    result = scanner.sync_scan(ai_profile=profile, content=Content(prompt=user_prompt))
except AISecSDKException as e:
    # AISEC_SERVER_SIDE_ERROR · AISEC_CLIENT_SIDE_ERROR · AISEC_USER_REQUEST_PAYLOAD_ERROR
    # AISEC_MISSING_VARIABLE · AISEC_SDK_ERROR
    log.warning("AIRS scan failed: %s", e)
    result = None          # decide: fail open (allow) or fail closed (refuse)
` }],
      },
      {
        type: 'callout', tone: 'observed', title: 'Behind TLS inspection',
        text: 'On a corporate network that re-signs TLS, the SDK fails with `CERTIFICATE_VERIFY_FAILED` (it uses the certifi bundle, not the OS trust store). Point `SSL_CERT_FILE` at your corporate CA bundle — that is what it took to run these snippets from a Palo Alto Networks laptop.',
      },
      {
        type: 'callout', tone: 'warn', title: 'Two doc slips to avoid',
        text: ['Some pan.dev inline (non-asyncio) samples end with `await scanner.close()` at module level — a SyntaxError in plain Python. Only the asyncio scanner needs `close()`.', 'The pan.dev landing-page snippet passes plain dicts as `content`; the SDK expects `Content(...)` objects. Use the code above.'],
      },
    ],
  },

  {
    id: 'rt-rest',
    group: 'runtime',
    title: 'Any language over REST',
    sub: 'Node, Go, Java — no SDK needed',
    minutes: 4,
    level: 'Build',
    live: 'runtime.scan',
    docs: pick('rtSync', 'scanSpec', 'rtOverview'),
    blocks: [
      {
        type: 'prose',
        text: 'Python is the only official SDK. Everything else calls the REST API directly — it is one POST with three headers, so a wrapper is a few lines. The OpenAPI spec on GitHub can generate a typed client if you prefer.',
      },
      { type: 'code', build: (v) => runtimeScan(v, { langs: ['node', 'go', 'java', 'curl'] }).map((x) => ({ ...x, verified: x.id === 'node' || x.id === 'curl' })) },
      {
        type: 'callout', tone: 'info',
        text: 'The Node and cURL versions were run against the live API from this portal. The Go and Java versions are reference code — standard-library only (Go 1.18+, Java 15+) — but were not executed here.',
      },
      {
        type: 'table',
        title: 'Headers',
        columns: ['Header', 'Value'],
        rows: [
          ['`x-pan-token`', 'Your API key — or use `Authorization: Bearer <OAuth token>` instead'],
          ['`Content-Type`', '`application/json` (a missing or different value returns 415)'],
          ['`Accept`', '`application/json`'],
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Community SDKs',
        text: 'There is no official TypeScript, Go or Java SDK. A community TypeScript package (`@cdot65/prisma-airs-sdk`) exists under a personal npm scope — useful, but not a Palo Alto Networks deliverable.',
      },
    ],
  },

  {
    id: 'rt-two-scans',
    group: 'runtime',
    title: 'Scan the prompt and the answer',
    sub: 'The two-scan pattern around every model call',
    minutes: 5,
    level: 'Build',
    live: 'runtime.response',
    docs: pick('rtSync', 'rtUseCases'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Scan **before** the model to stop malicious prompts (injection, jailbreaks, tool abuse) from ever reaching it — and to save the tokens. Scan **after** the model, with the prompt and the response together, to stop data leaks, malicious links, unsafe code or ungrounded answers from reaching the user.',
          'Use the same `tr_id` for both scans: Strata Cloud Manager then shows them as one exchange.',
        ],
      },
      { type: 'code', build: (v) => twoScans(v) },
      { type: 'live', title: 'Try an answer that leaks', text: 'The preset "Answer leaks data" has a harmless prompt and a response that returns a card number — the response scan catches it.' },
      {
        type: 'table',
        title: 'Optional content fields',
        columns: ['Field', 'Use it for'],
        rows: [
          ['`response`', 'The model output — scanned together with `prompt`'],
          ['`context`', 'The grounding documents (RAG) — enables contextual grounding (`ungrounded`). Up to 100,000 characters.'],
          ['`code_prompt` / `code_response`', 'Code to check for malware — one language per call'],
          ['`tool_event`', 'An agent tool call — see "Scan every tool call"'],
        ],
        note: '`contents` is an array: the last element is scanned, earlier ones are context.',
      },
      { type: 'repo', title: 'The protected chat path', file: 'server.js', lines: '1222-1278', lang: 'javascript', code: CHAT_FLOW, why: 'How the AIRS Runtime & AI-GW pillar gates every model call on Vertex, Bedrock and Azure: the prompt scan decides whether the model is called at all; the response scan runs on the answer.' },
    ],
  },

  {
    id: 'rt-async',
    group: 'runtime',
    title: 'Async scans, results and reports',
    sub: 'Batch scanning and per-service detail',
    minutes: 5,
    level: 'Build',
    live: 'runtime.report',
    docs: pick('rtAsync', 'rtResults', 'rtReports', 'rtErrors'),
    blocks: [
      {
        type: 'prose',
        text: 'Use the **async** endpoint for batch or offline work (logs, datasets, back-office checks), and the **reports** endpoint whenever you want to know *why* — which service fired, the snippet that tripped it, the URL categories, the SQL it saw.',
      },
      { type: 'code', build: (v) => asyncFlow(v) },
      { type: 'live', title: 'Scan, then fetch the report', text: 'The panel runs a scan, takes its `report_id`, and fetches the report — both calls are shown.' },
      {
        type: 'table',
        title: 'Endpoints and limits',
        columns: ['Call', 'Limit'],
        rows: [
          ['`POST /v1/scan/async/request`', 'Body is an **array** of `{req_id, scan_req}` · 5 MB · the API documents up to 25 per batch; the Python SDK caps a batch at 5'],
          ['`GET /v1/scan/results?scan_ids=`', 'Up to 5 ids · `status` is `pending` or `complete` · 10 requests per minute'],
          ['`GET /v1/scan/reports?report_ids=`', 'Up to 5 ids · report id = `R` + scan id · 10 requests per minute'],
        ],
      },
      {
        type: 'table',
        title: 'Report service codes',
        columns: ['`detection_service`', 'Service'],
        rows: [['`pi`', 'Prompt injection'], ['`dlp`', 'Sensitive data'], ['`uf`', 'URL filtering (malicious URLs)'], ['`tc`', 'Toxic content'], ['`dbs`', 'Database security'], ['`malicious_code`', 'Malicious code'], ['`agent_security`', 'AI agent protection'], ['`contextual_grounding`', 'Contextual grounding']],
        note: '`result_detail` carries e.g. `pi_snippets`, `dlp_snippets`, `urlf_report`, `dbs_snippets` — at most 10 snippets of 1,000 characters each.',
      },
      {
        type: 'callout', tone: 'observed', title: 'Keep the report off the critical path',
        text: 'The verdict is in the sync response; the report is detail. Measured on 18 protected chats in this portal, fetching it inline added 0.6–2.0 s per block (46–75% of the request). The portal answers first and fetches the report in the background.',
      },
    ],
  },

  {
    id: 'rt-production',
    group: 'runtime',
    title: 'Production checklist',
    sub: 'Timeouts, 429s, correlation, fail-open vs fail-closed',
    minutes: 7,
    level: 'Operate',
    docs: pick('rtErrors', 'pdfRuntime', 'rtOverview'),
    blocks: [
      {
        type: 'checklist',
        title: 'Before you go live',
        items: [
          '**Decide fail-open or fail-closed per path.** A timeout or 5xx on the prompt scan of a public chatbot may be fail-closed; an internal assistant may fail open. Make it a setting, not an accident.',
          '**Set a client timeout** (a few seconds) and a latency threshold on the security profile (Allow or Block when exceeded).',
          '**Retry 429s briefly, and only the right ones** — see below. Spread traffic evenly: bursts are throttled even under the average limit.',
          '**Correlate.** Send the same `tr_id` for a prompt and its answer, a `session_id` per conversation, and `metadata.app_user` for the end user. Strata Cloud Manager groups and filters by them.',
          '**Name the app and model** in `metadata.app_name` / `ai_model` — new app names appear automatically in SCM.',
          '**Reference profiles by name** so profile edits apply without a deploy (a profile edit changes its ID).',
          '**Rotate keys** (1, 3 or 6 months) and prefer OAuth tokens for short-lived workloads.',
          '**Forward logs** to your SIEM — each Prisma AIRS API log carries a `session_URL` straight to the session in SCM.',
          '**Mind the monthly token quota** (1 token ≈ 4 characters of everything you scan).',
        ],
      },
      {
        type: 'table',
        title: 'Rate limits (per tenant)',
        columns: ['Monthly quota', 'Requests / s', 'Tokens / min'],
        rows: [['≤ 5 billion tokens', '50', '2.5 M'], ['each +1 billion', '+5', '+0.5 M'], ['cap', '150', '15 M']],
        note: 'Exceeding either returns HTTP 429. Results and reports have their own limit: 10 requests per minute. Above the cap, open a support case.',
      },
      { type: 'repo', title: '429 handling that has held up', file: 'telemetry.js', lines: '302-334', lang: 'javascript', code: AIRSFETCH, why: 'Short retries for the per-second limit; stop immediately on a per-minute quota (retrying in seconds only burns more of it).', open: true },
      { type: 'repo', title: 'The scan function behind the runtime pillar', file: 'server.js', lines: '169-237', lang: 'javascript', code: AIRSCAN, why: 'Throws on a non-2xx (so a misconfiguration is loud), keeps the verdict synchronous, and defers the report.' },
      {
        type: 'table',
        title: 'Errors you will actually see',
        columns: ['Status', 'Cause', 'Fix'],
        rows: [
          ['400 `AI Profile not found`', 'The profile name does not exist for this key\'s tenant — often a key from one tenant with a profile from another.', 'Check the profile and key belong to the same TSG and region'],
          ['401', 'No `x-pan-token` / bearer token', 'Send the header'],
          ['403', 'Invalid, revoked or expired key', 'Regenerate the key; update the secret'],
          ['413', 'Over 2 MB (sync) or 5 MB (async)', 'Chunk large documents'],
          ['415', 'Missing or wrong `Content-Type`', '`application/json`'],
          ['429', 'Rate limit, or too many concurrent scans', 'Back off; spread traffic'],
        ],
      },
      {
        type: 'callout', tone: 'observed', title: 'Pace bulk DLP scans',
        text: 'When this portal scanned faster than about one request every two seconds from one key, AIRS returned `dlp: false` with no error flag — the DLP check was skipped silently. For bulk document scanning, pace requests (the portal waits 2.2 s between chunks) or use the async endpoint.',
      },
    ],
  },

  {
    id: 'rt-reference',
    group: 'runtime',
    title: 'API reference',
    sub: 'Endpoints, fields, detections, regions, limits',
    minutes: 8,
    level: 'Reference',
    docs: pick('rtOverview', 'rtSync', 'rtAsync', 'rtResults', 'rtReports', 'rtErrors', 'scanSpec'),
    blocks: [
      {
        type: 'table',
        title: 'Endpoints',
        columns: ['Method', 'Path', 'Purpose'],
        rows: [
          ['POST', '`/v1/scan/sync/request`', 'Scan one prompt / response / tool event; the verdict comes back in the response'],
          ['POST', '`/v1/scan/async/request`', 'Batch scan — array of `{req_id, scan_req}`; returns `scan_id`, `report_id`'],
          ['GET', '`/v1/scan/results?scan_ids=`', 'Verdicts for up to 5 scan ids'],
          ['GET', '`/v1/scan/reports?report_ids=`', 'Per-service reports for up to 5 report ids'],
        ],
      },
      {
        type: 'table',
        title: 'Regions',
        columns: ['Region', 'Base URL'],
        rows: [
          ['US', `\`${BASE}\``],
          ['EU (Germany)', '`https://service-de.api.aisecurity.paloaltonetworks.com`'],
          ['India', '`https://service-in.api.aisecurity.paloaltonetworks.com`'],
          ['Singapore', '`https://service-sg.api.aisecurity.paloaltonetworks.com`'],
        ],
        note: 'Use the region of your deployment profile. For EU, India and Singapore, URL categorisation and contextual grounding run out of region.',
      },
      {
        type: 'table',
        title: 'Request body',
        columns: ['Field', 'Notes'],
        rows: [
          ['`ai_profile`', '**Required.** `{ "profile_name": "…" }` or `{ "profile_id": "<uuid>" }` — one of the two'],
          ['`contents[]`', '**Required.** Each item: `prompt`, `response`, `context`, `code_prompt`, `code_response`, `tool_event`. The last item is scanned; earlier ones are context.'],
          ['`tr_id`', 'Your id for a prompt/response pair (≤ 100 chars), echoed back'],
          ['`session_id`', 'Conversation id (≤ 100 chars). If you send both, `tr_id` echoes the `session_id`.'],
          ['`transaction_id`', 'Groups related calls in the Sessions view (≤ 100 chars); generated with a `pan_` prefix if omitted'],
          ['`metadata`', '`app_name`, `app_user`, `ai_model`, `user_ip`, `agent_meta { agent_id, agent_version, agent_arn }`'],
        ],
      },
      {
        type: 'table',
        title: 'Response body',
        columns: ['Field', 'Notes'],
        rows: [
          ['`action`', '`block` | `allow` — per your profile'],
          ['`category`', '`malicious` | `benign` | `error` | `timeout`'],
          ['`scan_id`, `report_id`', 'Report id is `R` + scan id'],
          ['`prompt_detected`', '`injection`, `agent`, `dlp`, `url_cats`, `toxic_content`, `malicious_code`, `topic_violation`'],
          ['`response_detected`', '`dlp`, `url_cats`, `db_security`, `toxic_content`, `malicious_code`, `agent`, `ungrounded`, `topic_violation`'],
          ['`tool_detected`', '`verdict`, `summary`, `input_detected` / `output_detected` `.detection_entries[] { tool_invoked, detections, threats[], masked_data }`'],
          ['`prompt_masked_data` / `response_masked_data`', '`{ data, pattern_detections: [{ pattern, locations }] }`'],
          ['`prompt_detection_details` / `response_detection_details`', 'Topic guardrail and toxic-content categories'],
          ['`source`', '`AI-Runtime-API` (or `AI-Runtime-MCP-Server` for the hosted MCP server)'],
          ['`timeout`, `error`, `errors[]`', 'Per-detector failures: `{ content_type, feature, status }`'],
          ['`tr_id`, `session_id`, `transaction_id`, `profile_id`, `profile_name`, `created_at`, `completed_at`', 'Echoes and timestamps'],
        ],
      },
      {
        type: 'table',
        title: 'Limits',
        columns: ['Limit', 'Value'],
        rows: [
          ['Sync payload', '2 MB, up to 100 URLs'],
          ['Async payload', '5 MB, up to 100 URLs; up to 25 requests per batch (the Python SDK allows 5)'],
          ['Results / reports', '5 ids per call, 10 requests per minute'],
          ['Contextual grounding', 'context ≤ 100,000 chars, prompt ≤ 10,000, response ≤ 20,000'],
          ['Throughput', '50–150 requests/s and 2.5–15 M tokens/min, by monthly quota'],
          ['Apps per deployment profile', '20'],
        ],
      },
      {
        type: 'table',
        title: 'Language support',
        columns: ['Service', 'Languages'],
        rows: [
          ['Prompt injection, toxic content', 'English, Spanish, Russian, German, French, Japanese, Portuguese, Italian, Simplified Chinese'],
          ['Contextual grounding', 'The same, without Chinese'],
          ['Custom topic guardrails', 'English only'],
        ],
      },
    ],
  },
]

export const AGENTS = [
  {
    id: 'mcp-tool-events',
    group: 'agents',
    title: 'Scan every tool call',
    sub: 'tool_event: parameters before, output after, manifests too',
    minutes: 7,
    level: 'Build',
    live: 'runtime.tool',
    docs: pick('rtSync', 'pdfRuntime', 'scanSpec'),
    blocks: [
      {
        type: 'prose',
        text: [
          'An agent is attacked through its tools as much as through its prompt: a poisoned tool **description** steers the model, a crafted **parameter** exfiltrates data, a tool **result** carries an injection the model then obeys. The scan API takes a `tool_event` so each of those can be checked with the same profile as your prompts.',
          'Scan in two stages around every call: the **input** before you execute the tool, the **output** before the model reads it. Stage 2 matters most — a tool result is untrusted remote content.',
        ],
      },
      { type: 'code', build: (v) => toolEvent(v).map((x) => ({ ...x, verified: true })) },
      { type: 'live', title: 'Scan a poisoned tool result', text: 'Pick "Poisoned tool output" on the right: the input is clean, the output tries to redirect the agent.' },
      {
        type: 'table',
        title: 'The tool_event object',
        columns: ['Field', 'Notes'],
        rows: [
          ['`metadata.ecosystem`', '**Required** — `"mcp"`'],
          ['`metadata.method`', '**Required** — `"tools/call"` for a call, `"tools/list"` for a manifest'],
          ['`metadata.server_name`', '**Required** — which MCP server'],
          ['`metadata.tool_invoked`', 'The tool name'],
          ['`input`', 'The parameters — a **string** (stringify JSON)'],
          ['`output`', 'The result — a **string**. At least one of `input` / `output` is required.'],
        ],
      },
      {
        type: 'callout', tone: 'tip', title: 'Where the verdict lives',
        text: 'For a tool event, `prompt_detected` and `response_detected` stay empty. Read `tool_detected.input_detected` / `output_detected` `.detection_entries[]` — each has `detections`, `threats` (e.g. "context poisoning", "credential leakage") and optional `masked_data`.',
      },
      {
        type: 'code', title: 'Scan a manifest (tools/list) for tool poisoning',
        text: 'Send the server\'s tool list as the output of a `tools/list` event. The `agent` detector reads every description.',
        tabs: [{ id: 'node', lang: 'node', file: 'scanManifest.mjs', code: `const tools = await mcp.listTools()              // [{ name, description, inputSchema }, …]

const res = await fetch('https://service.api.aisecurity.paloaltonetworks.com/v1/scan/sync/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-pan-token': process.env.PANW_AI_SEC_API_KEY },
  body: JSON.stringify({
    ai_profile: { profile_name: process.env.PANW_AI_PROFILE_NAME },
    contents: [{
      tool_event: {
        metadata: { ecosystem: 'mcp', method: 'tools/list', server_name: 'vendor-server', tool_invoked: tools[0]?.name ?? 'tools/list' },
        input: JSON.stringify({ method: 'tools/list' }),
        // A BARE array of tools — not { tools: [...] }
        output: JSON.stringify(tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))),
      },
    }],
  }),
})
const verdict = await res.json()
if (verdict.action === 'block') {
  // withhold this server's tools from the model
}` }],
      },
      {
        type: 'callout', tone: 'observed', title: 'A bare array, or HTTP 400',
        text: 'For `tools/list`, the `output` must be a bare `Tool[]` JSON array. Wrapping it as `{"tools":[…]}` fails the whole scan with `failed to parse tools list: json: cannot unmarshal object into Go value of type []*mcp.Tool`. The official docs only show `tools/call`.',
      },
      {
        type: 'callout', tone: 'docs', title: 'Profile settings for MCP',
        text: 'Enable a protection type (AI Model, AI Application or AI Agent Protection) **plus Database Security** for context poisoning, and **Sensitive Data Detection** for credential leakage. Contextual grounding is not supported for tool events.',
      },
    ],
  },

  {
    id: 'mcp-server',
    group: 'agents',
    title: 'Prisma AIRS MCP server & relay',
    sub: 'Security as MCP tools — hosted, or as a local proxy',
    minutes: 5,
    level: 'Build',
    docs: pick('pdfAgentId', 'pypiRelay', 'ghRelay', 'ghSdk'),
    blocks: [
      {
        type: 'prose',
        text: 'Two ready-made ways to bring Prisma AIRS into an MCP-based agent without writing scan calls yourself.',
      },
      {
        type: 'steps',
        title: 'Option A — the hosted Prisma AIRS MCP server',
        steps: [
          { title: 'Add it to your MCP client', text: 'Streamable HTTP at `https://service.api.aisecurity.paloaltonetworks.com/mcp` (SSE: `/mcp/sse`; regional hosts `service-de`, `service-in`, `service-sg`). Authenticate with your API key; name the profile with `x-pan-profile` (optional if the key has a linked profile).',
            code: [{ id: 'json', lang: 'json', file: 'mcp.json', code: `{
  "servers": {
    "prisma-airs": {
      "type": "http",
      "url": "https://service.api.aisecurity.paloaltonetworks.com/mcp",
      "headers": {
        "x-pan-token": "<your API key>",
        "x-pan-profile": "<your profile name or id>"
      }
    }
  }
}` }] },
          { title: 'Tell the agent to use it', text: 'The server exposes `pan_inline_scan` (prompt and/or response). An MCP server cannot force a model to call it — instruct the agent in its system prompt to scan user input and its own output with the tool before acting. Scans from this server report `source: "AI-Runtime-MCP-Server"`.' },
        ],
      },
      {
        type: 'steps',
        title: 'Option B — pan-mcp-relay, a local security proxy',
        steps: [
          { title: 'Install', text: 'The relay sits between your MCP client and your real MCP servers and scans every tool description, call and result through the AIRS API.',
            code: [{ id: 'bash', lang: 'bash', code: `uv tool install pan-mcp-relay@latest     # Python 3.12+ · 0.0.5b1 (beta)
pan-mcp-relay --help` }] },
          { title: 'Configure it with your servers', code: [{ id: 'yaml', lang: 'yaml', file: 'mcp-relay.yaml', code: `mcpRelay:
  apiKey: |
    \${PRISMA_AIRS_API_KEY}
  aiProfile: |
    your-ai-profile-name-or-id
  # endpoint: https://service.api.aisecurity.paloaltonetworks.com
mcpServers:
  fetch:
    command: uvx
    args:
      - mcp-server-fetch` }] },
          { title: 'Point your MCP client at the relay only', text: 'The relay should be the **only** MCP server in the client configuration — otherwise the other servers bypass it.' },
        ],
      },
      {
        type: 'callout', tone: 'info',
        text: 'The Python SDK also ships an example MCP server (`examples/model_context_protocol/server.py`) exposing `pan_inline_scan`, `pan_batch_scan`, `pan_get_scan_results` and `pan_get_scan_reports` — a starting point if you want your own.',
      },
    ],
  },
]
