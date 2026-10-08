import { ScanSearch, Swords } from 'lucide-react'
import { pick } from './links'
import { aimsHistory } from '../snippets'

/**
 * AI Model Security (install, scan, CI gate, REST history, skills), AI Red
 * Teaming (targets, API) and network intercept.
 *
 * Every tab marked `verified` was run against a live tenant from this portal
 * on 2026-09-28 (model-security-client 1.1.2, Python 3.12). Scans run for the
 * record: google/timesfm-2.5-200m-pytorch → ALLOWED 11/11 in ~8 s;
 * opendiffusion/sentimentcheck → BLOCKED 7/11, CLI exit 1.
 */

const V = (tabs) => tabs.map((x) => ({ ...x, verified: true }))

const PYPI_SCRIPT = `#!/bin/bash
#
# Model Security Private PyPI Authentication Script
# Authenticates with SCM and retrieves PyPI repository URL
#

set -euo pipefail

# Check required environment variables
: "\${MODEL_SECURITY_CLIENT_ID:?Error: MODEL_SECURITY_CLIENT_ID not set}"
: "\${MODEL_SECURITY_CLIENT_SECRET:?Error: MODEL_SECURITY_CLIENT_SECRET not set}"
: "\${TSG_ID:?Error: TSG_ID not set}"

# Set default endpoints
API_ENDPOINT="\${MODEL_SECURITY_API_ENDPOINT:-https://api.sase.paloaltonetworks.com/aims}"
TOKEN_ENDPOINT="\${MODEL_SECURITY_TOKEN_ENDPOINT:-https://auth.apps.paloaltonetworks.com/oauth2/access_token}"

# Get SCM access token
TOKEN_RESPONSE=$(curl -sf -X POST "$TOKEN_ENDPOINT" \\
    -H "Content-Type: application/x-www-form-urlencoded" \\
    -u "$MODEL_SECURITY_CLIENT_ID:$MODEL_SECURITY_CLIENT_SECRET" \\
    -d "grant_type=client_credentials&scope=tsg_id:$TSG_ID") || {
    echo "Error: Failed to obtain SCM access token" >&2
    exit 1
}

SCM_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
if [[ -z "$SCM_TOKEN" || "$SCM_TOKEN" == "null" ]]; then
    echo "Error: Failed to extract access token from response" >&2
    exit 1
fi

# Get PyPI URL
PYPI_RESPONSE=$(curl -sf -X GET "$API_ENDPOINT/mgmt/v1/pypi/authenticate" \\
    -H "Authorization: Bearer $SCM_TOKEN") || {
    echo "Error: Failed to retrieve PyPI URL" >&2
    exit 1
}

PYPI_URL=$(echo "$PYPI_RESPONSE" | jq -r '.url')
if [[ -z "$PYPI_URL" || "$PYPI_URL" == "null" ]]; then
    echo "Error: Failed to extract PyPI URL from response" >&2
    exit 1
fi

echo "$PYPI_URL"`

const SCAN_APP = `# Execute scan based on source type
if source_type == ScanSourceType.HUGGINGFACE:
    # HuggingFace scan - pass URI directly to SDK
    try:
        result = client.scan(
            security_group_uuid=security_group,
            model_uri=hf_model_uri,
        )
        scan_dict = _process_scan_result(result)
        scan_dict["scan_source"] = "huggingface"
        scan_dict["model_uri"] = hf_model_uri
        return JSONResponse(scan_dict)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"HuggingFace model scan failed: {exc}")
else:
    # Local file scan - save to temp file, scan, then cleanup
    ...
    try:
        result = client.scan(
            security_group_uuid=security_group,
            model_path=tmp_path,
        )`

const AIMS_TOKEN = `const AIMS_BASE = 'https://api.sase.paloaltonetworks.com/aims'
const aimsToken = { value: null, expiresAt: 0 }

async function aimsAccessToken(force = false) {
  if (!force && aimsToken.value && aimsToken.expiresAt - 60_000 > Date.now()) return aimsToken.value
  const basic = Buffer.from(\`\${process.env.MODEL_SECURITY_CLIENT_ID}:\${process.env.MODEL_SECURITY_CLIENT_SECRET}\`).toString('base64')
  const r = await fetch('https://auth.apps.paloaltonetworks.com/oauth2/access_token', {
    method: 'POST',
    headers: { Authorization: \`Basic \${basic}\`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: \`tsg_id:\${process.env.TSG_ID}\` }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.access_token) throw new Error(\`token request failed (\${r.status})\`)
  aimsToken.value = d.access_token
  aimsToken.expiresAt = Date.now() + (d.expires_in ?? 900) * 1000
  return aimsToken.value
}

/**
 * GET on the data plane (or \`plane: 'mgmt'\` — security groups and their rule
 * instances live there); one retry with a fresh token on 401.
 */
async function aimsGet(path, params, plane = 'data') {
  const url = \`\${AIMS_BASE}/\${plane}\${path}\${params?.toString() ? \`?\${params}\` : ''}\`
  let r = await fetch(url, { headers: { Authorization: \`Bearer \${await aimsAccessToken()}\` } })
  if (r.status === 401) r = await fetch(url, { headers: { Authorization: \`Bearer \${await aimsAccessToken(true)}\` } })
  // …
}`

const RT_FETCH = `const RT_MGMT = 'https://api.sase.paloaltonetworks.com/ai-red-teaming/mgmt-plane'
const RT_DATA = 'https://api.sase.paloaltonetworks.com/ai-red-teaming/data-plane'
const _rtToken = { value: null, expiresAt: 0 }

async function getRedTeamToken() {
  const now = Date.now() / 1000
  if (_rtToken.value && _rtToken.expiresAt - 60 > now) return _rtToken.value

  const id  = process.env.MODEL_SECURITY_CLIENT_ID
  const sec = process.env.MODEL_SECURITY_CLIENT_SECRET
  const tsg = process.env.TSG_ID
  if (!id || !sec || !tsg) throw new Error('Missing MODEL_SECURITY_CLIENT_ID / CLIENT_SECRET / TSG_ID for Red Team API')

  const res = await fetch('https://auth.apps.paloaltonetworks.com/oauth2/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(\`\${id}:\${sec}\`).toString('base64'),
    },
    body: \`grant_type=client_credentials&scope=tsg_id:\${tsg}\`,
  })
  if (!res.ok) throw new Error(\`Red Team token error (\${res.status}): \${await res.text()}\`)
  const d = await res.json()
  _rtToken.value     = d.access_token
  _rtToken.expiresAt = now + (d.expires_in || 900)
  return d.access_token
}

async function rtFetch(base, path, method = 'GET', body = null, params = {}) {
  const token = await getRedTeamToken()
  const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''
  const res = await fetch(\`\${base}\${path}\${qs}\`, {
    method,
    headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  // …
}`

export const MODELS = [
  {
    id: 'ms-setup',
    group: 'models',
    title: 'Install the Model Security SDK and CLI',
    sub: 'One package, a private index, a service account',
    minutes: 8,
    level: 'Setup',
    docs: pick('msInstall', 'msSdk', 'pdfSupply', 'scmTokens'),
    blocks: [
      {
        type: 'prose',
        text: 'AI Model Security ships as one Python package, `model-security-client`, which contains both the SDK (`model_security_client`) and the `model-security` CLI. It is not on public PyPI: you fetch a private index URL with your service account, then install from it. The client manages its own OAuth token from environment variables.',
      },
      {
        type: 'facts',
        items: [
          { label: 'Python', value: '3.11 or 3.12', sub: 'Linux, macOS 11+, or Windows with WSL2' },
          { label: 'Also needs', value: '`jq`', sub: 'The index-URL script parses JSON with it', mono: true },
          { label: 'Scanner host', value: '2 CPU · 2 GB', sub: '4 + 4 recommended; a scan can use up to 4 GB. Disk: 2× the model for local scans' },
          { label: 'Version used here', value: '1.1.2', sub: 'Needs 1.1.0+ for cloud-storage and local fingerprinting', accent: true },
        ],
      },
      {
        type: 'steps',
        steps: [
          { title: 'A deployment profile and a service account', text: 'Create an **AI Model Security** deployment profile and associate it with your tenant (see "Tenant, licence & credentials"). Then create a service account whose role has the API permissions `ai_ms_pypi_auth`, `ai_ms.scans` and `ai_ms.security_groups`. Store the client secret straight away — it cannot be shown again.', path: ['Common Services', 'Identity & Access', 'Service Accounts'] },
          { title: 'Set the environment', text: 'All four are required. The client ID looks like `name@<tsg>.iam.panserviceaccount.com`.',
            code: [{ id: 'bash', lang: 'bash', code: `export MODEL_SECURITY_CLIENT_ID=<your-client-id>
export MODEL_SECURITY_CLIENT_SECRET=<your-client-secret>
export TSG_ID=<your-tsg-id>
export MODEL_SECURITY_API_ENDPOINT="https://api.sase.paloaltonetworks.com/aims"   # regional endpoint if not US` }] },
          { title: 'Get the private index URL', text: 'The official script: a client-credentials token, then `GET /aims/mgmt/v1/pypi/authenticate`, which returns the index URL.',
            code: [{ id: 'bash', lang: 'bash', file: 'get_pypi_url.sh', code: PYPI_SCRIPT }] },
          { title: 'Install', text: 'Extras pull in the storage SDK you need: `aws`, `gcp`, `azure`, `artifactory`, `gitlab` or `all`.',
            code: [
              { id: 'bash', label: 'pip', lang: 'bash', code: `chmod +x get_pypi_url.sh
python3.12 -m venv .venv && . .venv/bin/activate
pip install "model-security-client[all]==1.1.2" --extra-index-url "$(./get_pypi_url.sh)"` },
              { id: 'uv', label: 'uv', lang: 'bash', code: `uv add "model-security-client[all]==1.1.2" --index "$(./get_pypi_url.sh)"` },
            ] },
          { title: 'Check it works', text: 'Listing scans exercises the token, the endpoint and the permissions without scanning anything.',
            code: V([
              { id: 'python', lang: 'python', file: 'check.py', code: `from model_security_client.api import ModelSecurityAPIClient

client = ModelSecurityAPIClient(base_url="https://api.sase.paloaltonetworks.com/aims")
result = client.list_scans(limit=3)
for scan in result.scans:
    print(scan.eval_outcome, scan.model_uri)` },
              { id: 'bash', label: 'CLI', lang: 'bash', code: `model-security --version
model-security list-scans --limit 3` },
            ]) },
        ],
      },
      {
        type: 'callout', tone: 'warn', title: 'Pin the version — a placeholder with the same name is on public PyPI',
        text: [
          'Public PyPI has a third-party package called `model-security-client` (0.0.1, "Placeholder package", uploaded January 2026). Because the official install uses `--extra-index-url`, pip resolves the name across **both** indexes and takes the highest version — the classic dependency-confusion setup.',
          'Today 0.0.1 loses to the real version, but do not rely on that: pin an exact version (`==1.1.2`), use `--require-hashes` in CI, and check that `pip show model-security-client` reports the summary "Python SDK for the Prisma AIRS Model Security API". This is our advice, not Palo Alto Networks guidance.',
        ],
      },
      {
        type: 'callout', tone: 'observed', title: 'Behind TLS inspection',
        text: 'Corporate TLS inspection makes the client fail with `CERTIFICATE_VERIFY_FAILED`. Point Python at a bundle that includes your inspection CA: `export SSL_CERT_FILE=/path/to/corp-ca-bundle.pem`.',
      },
      {
        type: 'table',
        title: 'Credentials for object stores',
        columns: ['Source', 'How the client authenticates'],
        rows: [
          ['S3', 'boto3 and its normal credential chain (env, profile, instance role)'],
          ['GCS', 'google-cloud-storage with Application Default Credentials'],
          ['Azure Blob', 'azure-storage-blob with Entra ID'],
          ['JFrog Artifactory', '`ARTIFACTORY_USERNAME` + `ARTIFACTORY_TOKEN` (basic auth; identity tokens not supported)'],
          ['GitLab Model Registry', '`GITLAB_TOKEN` (OAuth not supported)'],
          ['Hugging Face', 'Nothing — public repositories only; download a private one and scan it locally'],
        ],
      },
    ],
  },

  {
    id: 'ms-scan',
    group: 'models',
    title: 'Scan a model',
    sub: 'Hugging Face, local files and object storage — SDK or CLI',
    minutes: 7,
    level: 'Build',
    docs: pick('msScanning', 'msSdk', 'pdfSupply'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Every scan is evaluated against a **security group** — a set of rules for one source type (Hugging Face, local, S3…). Each tenant starts with a default group per source; the group\'s source must match the model\'s, and it is fixed when the group is created.',
          'The two interfaces decide differently: **the SDK returns the outcome and your code enforces it; the CLI exits non-zero** when a blocking rule fails. Either way the scan lands in Strata Cloud Manager.',
        ],
      },
      {
        type: 'code', title: 'Hugging Face',
        tabs: V([
          { id: 'python', lang: 'python', file: 'scan_hf.py', code: `import os

from model_security_client.api import ModelSecurityAPIClient

client = ModelSecurityAPIClient(base_url="https://api.sase.paloaltonetworks.com/aims")

result = client.scan(
    security_group_uuid=os.environ["SECURITY_GROUP_UUID"],   # a HUGGING_FACE group
    model_uri="https://huggingface.co/google/timesfm-2.5-200m-pytorch",
    labels={"env": "demo"},
)
print(f"Scan completed: {result.eval_outcome}")   # ALLOWED / BLOCKED — the SDK does not enforce it
print(result.uuid, result.eval_summary)` },
          { id: 'bash', label: 'CLI', lang: 'bash', code: `model-security scan \\
  --security-group-uuid "$SECURITY_GROUP_UUID" \\
  --model-uri "https://huggingface.co/opendiffusion/sentimentcheck" \\
  -l env=ci
echo "exit code: $?"      # 1 — "Scan failed because it failed your organization's security policies"` },
        ]),
      },
      {
        type: 'code', title: 'Local files and object storage',
        tabs: [
          { id: 'bash', label: 'CLI', lang: 'bash', code: `# Local directory or file (a LOCAL security group). No --model-uri means local disk.
model-security scan \\
  --security-group-uuid "$LOCAL_GROUP_UUID" \\
  --model-path ./models/classifier \\
  -l env=production

# Object storage: the client downloads the model, then scans it (an S3 group here)
model-security scan \\
  --security-group-uuid "$S3_GROUP_UUID" \\
  --model-uri "s3://ml-artifacts/classifier/v2/" \\
  --model-name "production-classifier" \\
  --model-author "ml-team" \\
  --model-version "v2.1" \\
  --cleanup-download-dir` },
          { id: 'python', lang: 'python', file: 'scan_storage.py', code: `from model_security_client.api import ModelSecurityAPIClient

# Download settings belong to the client; polling settings to scan()
client = ModelSecurityAPIClient(
    base_url="https://api.sase.paloaltonetworks.com/aims",
    download_timeout_secs=1800,
    download_dir="/scratch/airsms",
    cleanup_download_dir=True,
)

result = client.scan(
    security_group_uuid=S3_GROUP_UUID,
    model_uri="s3://ml-artifacts/classifier/v2/",
    model_name="production-classifier",
    poll_interval_secs=10,
    poll_timeout_secs=900,
)

local = client.scan(security_group_uuid=LOCAL_GROUP_UUID, model_path="./models/classifier")` },
        ],
      },
      {
        type: 'table',
        title: 'Model URI formats',
        columns: ['Source', 'URI'],
        rows: [
          ['Hugging Face', '`https://huggingface.co/<org>/<model>` — pin a revision with `--model-version <git sha>`'],
          ['Amazon S3', '`s3://bucket/path/`'],
          ['Google Cloud Storage', '`gs://bucket/path/`'],
          ['Azure Blob', '`https://<account>.blob.core.windows.net/...`'],
          ['JFrog Artifactory', '`https://<instance>.jfrog.io/...`'],
          ['GitLab Model Registry', '`https://<gitlab>/-/ml/models/...`'],
        ],
      },
      {
        type: 'table',
        title: 'Options worth knowing',
        columns: ['CLI flag', 'SDK', 'What it does'],
        rows: [
          ['`-l key=value`', '`labels={...}`', 'Up to 50 labels per scan; filter history with `--labels-query "env:production AND team:ml"`'],
          ['`--allow-patterns` / `--ignore-patterns`', 'same names', 'File filters for remote scans (not local); must not overlap'],
          ['`--poll-interval-secs` / `--poll-timeout-secs`', 'on `scan()`', 'Defaults 5 s / 600 s; interval ≤ 0 returns right after submitting'],
          ['`--block-on-errors`', '—', 'Treat a scan **error** as a block (fail closed)'],
          ['`--report-only`', '—', 'Record the scan but never block — for a rollout phase'],
          ['`--dry-run`', '`dry_run=True`', 'Run the scan locally without posting results to the API'],
        ],
      },
      {
        type: 'callout', tone: 'docs',
        text: 'Up to 1,000 files per scan, and **scans cannot be deleted**. Only public Hugging Face repositories can be scanned by URI. A model fails if any rule set to *blocking* fails; non-blocking rules only record findings.',
      },
      {
        type: 'callout', tone: 'observed', title: 'What these commands returned against a live tenant',
        text: '`google/timesfm-2.5-200m-pytorch` → **ALLOWED**, 11/11 rules, in about 8 seconds. `opendiffusion/sentimentcheck` → **BLOCKED**, 7 of 11 rules failed (Keras code execution on load, unapproved formats, publisher and licence rules), CLI exit code **1**, the full scan JSON on stdout and the policy message on stderr. `eval_outcome` is a string enum, so `result.eval_outcome == "BLOCKED"` works.',
      },
      { type: 'repo', title: 'The scanner behind the AI Supply Chain pillar', file: 'scanner_app.py', lines: '1343-1372', lang: 'python', code: SCAN_APP, why: 'The same two `client.scan` calls — `model_uri` for Hugging Face, `model_path` for an uploaded file.' },
      {
        type: 'cards',
        items: [
          { icon: ScanSearch, tone: '#6366f1', title: 'Scan real models in this portal', kicker: 'AI Supply Chain pillar',
            text: 'A library of models with measured verdicts — a clean control, code-on-load, pickle bombs, and threat-free models blocked on policy alone.', go: 'pillar:modelScanning', goLabel: 'Open AI Supply Chain' },
        ],
      },
    ],
  },

  {
    id: 'ms-cicd',
    group: 'models',
    title: 'Gate a pipeline on a model scan',
    sub: 'GitHub Actions, GitLab CI or any shell',
    minutes: 6,
    level: 'Build',
    docs: pick('ghIntegrations', 'msScanning', 'msInstall'),
    blocks: [
      {
        type: 'prose',
        text: 'Because the CLI exits non-zero on a blocked model, a pipeline step that runs `model-security scan` is already a gate. Add `--block-on-errors` so a scan that fails to complete does not pass by default. Palo Alto Networks publishes GitHub Actions and Jenkins examples in `prisma-airs-integrations`.',
      },
      {
        type: 'code', title: 'Pipeline step',
        tabs: [
          { id: 'yaml', label: 'GitHub Actions', lang: 'yaml', file: '.github/workflows/model-scan.yml', code: `name: Scan model before deploy
on:
  workflow_dispatch:
    inputs:
      model_uri:
        description: "Model to scan"
        default: "https://huggingface.co/google/timesfm-2.5-200m-pytorch"

jobs:
  scan:
    runs-on: ubuntu-latest
    env:
      MODEL_SECURITY_CLIENT_ID: \${{ secrets.MODEL_SECURITY_CLIENT_ID }}
      MODEL_SECURITY_CLIENT_SECRET: \${{ secrets.MODEL_SECURITY_CLIENT_SECRET }}
      TSG_ID: \${{ secrets.TSG_ID }}
      MODEL_SECURITY_API_ENDPOINT: https://api.sase.paloaltonetworks.com/aims
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Private index URL
        id: pypi
        run: echo "url=$(bash scripts/get_pypi_url.sh)" >> "$GITHUB_OUTPUT"
      - name: Install the Model Security client
        run: pip install "model-security-client[all]==1.1.2" --extra-index-url "\${{ steps.pypi.outputs.url }}"
      - name: Scan — a blocked model fails the job
        run: |
          model-security scan \\
            --security-group-uuid "\${{ vars.SECURITY_GROUP_UUID }}" \\
            --model-uri "\${{ inputs.model_uri }}" \\
            --block-on-errors \\
            -l pipeline=github -l run=\${{ github.run_id }}` },
          { id: 'gitlab', label: 'GitLab CI', lang: 'yaml', file: '.gitlab-ci.yml', code: `model-scan:
  stage: test
  image: python:3.12-slim
  variables:
    MODEL_SECURITY_API_ENDPOINT: https://api.sase.paloaltonetworks.com/aims
    MODEL_URI: s3://ml-artifacts/classifier/v2/
  before_script:
    - apt-get update && apt-get install -y --no-install-recommends curl jq
    - pip install "model-security-client[aws]==1.1.2" --extra-index-url "$(bash scripts/get_pypi_url.sh)"
  script:
    # MODEL_SECURITY_CLIENT_ID / _SECRET and TSG_ID come from masked CI/CD variables
    - model-security scan --security-group-uuid "$SECURITY_GROUP_UUID" --model-uri "$MODEL_URI"
        --model-name classifier --block-on-errors -l pipeline=gitlab -l commit=$CI_COMMIT_SHORT_SHA` },
          { id: 'python', lang: 'python', file: 'scan_gate.py', code: `"""Fail closed: anything other than ALLOWED stops the pipeline."""
import os
import sys

from model_security_client.api import ModelSecurityAPIClient

client = ModelSecurityAPIClient(base_url=os.environ["MODEL_SECURITY_API_ENDPOINT"])
result = client.scan(
    security_group_uuid=os.environ["SECURITY_GROUP_UUID"],
    model_uri=sys.argv[1],
    labels={"pipeline": "ci"},
)
print(f"{result.eval_outcome} · {result.eval_summary} · scan {result.uuid}")
sys.exit(0 if result.eval_outcome == "ALLOWED" else 1)` },
        ],
      },
      {
        type: 'callout', tone: 'tip', title: 'Roll it out without breaking builds',
        text: 'Start with `--report-only` so scans are recorded and visible in Strata Cloud Manager while nothing blocks; review what would have failed; then drop the flag. Labels such as `pipeline`, `commit` or `team` make those scans easy to find later.',
      },
      {
        type: 'callout', tone: 'info',
        text: 'The pipeline files above are templates built from the documented commands; the individual commands were run against a live tenant, the workflow files themselves were not run in GitHub or GitLab.',
      },
    ],
  },

  {
    id: 'ms-api',
    group: 'models',
    title: 'Read scan results over REST',
    sub: 'The AIMS data API — history, violations, files',
    minutes: 5,
    level: 'Build',
    live: 'ms.scans',
    docs: pick('msApi', 'msListScans', 'msErrors', 'scmTokens'),
    blocks: [
      {
        type: 'prose',
        text: 'Every scan — from the SDK, the CLI, the console or the Hugging Face integration — is readable through the AIMS data API at `https://api.sase.paloaltonetworks.com/aims/data`. Use it for dashboards, audit exports or to check a model\'s last verdict before loading it. Auth is the same OAuth client-credentials token; it lives 15 minutes.',
      },
      { type: 'code', build: () => V(aimsHistory()) },
      { type: 'live', title: 'Fetch this tenant\'s latest scans', text: 'The portal requests a token and lists the three most recent scans — the same two calls.' },
      {
        type: 'table',
        title: 'Endpoints',
        columns: ['Plane', 'Path', 'Returns'],
        rows: [
          ['data', '`GET /v1/scans`', 'Scans; `limit` (≤100), `skip`, `sort_order`, `search_query`, `eval_outcomes`, `source_types`, `start_time` + `end_time`, `labels_query`'],
          ['data', '`GET /v1/scans/{uuid}`', 'One scan: outcome, rule summary, formats, file counts, labels'],
          ['data', '`GET /v1/scans/{uuid}/rule-violations`', 'Every violation with rule, threat id (e.g. `PAIT-PKL-100`), file and description'],
          ['data', '`GET /v1/scans/{uuid}/evaluations` · `/files`', 'Per-rule results; the scanned file tree'],
          ['data', '`POST /v1/scans`', 'Create a scan record (`model_uri`, `security_group_uuid`)'],
          ['data', '`GET /v1/models` · `/v1/model-versions/{uuid}`', 'The model registry built from content fingerprints'],
          ['mgmt', '`GET /v1/security-groups` · `/{uuid}/rule-instances`', 'Security groups and their rule settings'],
          ['mgmt', '`/v1/custom-rules`', 'Custom rules combining labels and rule results'],
        ],
      },
      {
        type: 'callout', tone: 'observed', title: 'Two things the reference does not tell you',
        text: [
          '`search_query` is a **prefix** match on `model_uri`: `sentimentcheck` finds nothing, `https://huggingface.co/opendiffusion` finds every scan of that organisation.',
          '`start_time` needs `end_time`. The documented `list_scans(start_time=…)` sample returns HTTP 400 "Both start_time and end_time must be specified".',
        ],
      },
      { type: 'repo', title: 'Token cache and data-plane reads', file: 'server.js', lines: '1986-2023', lang: 'javascript', code: AIMS_TOKEN, why: 'Powers the AI Supply Chain pillar\'s SCM history on EC2, without the Python scanner.' },
    ],
  },

  {
    id: 'ms-skills',
    group: 'models',
    title: 'AI Skill Security (Preview)',
    sub: 'Scan agent skill bundles before anyone installs them',
    minutes: 3,
    level: 'Setup',
    docs: pick('pdfSupply'),
    blocks: [
      {
        type: 'prose',
        text: 'Agent skills — a `SKILL.md` plus scripts an agent can run — are code you are about to hand to an autonomous system. AI Skill Security scans a skill bundle against seven rules and records a verdict per bundle fingerprint.',
      },
      {
        type: 'facts',
        items: [
          { label: 'Status', value: 'Preview', sub: 'No licence needed during the preview; US region only' },
          { label: 'Interface', value: 'Strata Cloud Manager', sub: 'No API or CLI is documented for skill scans yet' },
          { label: 'Package', value: 'ZIP', sub: '≤ 100 MB compressed, ≤ 500 MB unpacked, ≤ 100 skills per archive' },
        ],
      },
      {
        type: 'table',
        title: 'The seven rules',
        columns: ['Rule', 'Looks for'],
        rows: [
          ['Prompt Integrity', 'Instructions in the skill that try to steer the agent against its user'],
          ['Arbitrary Code Execution', 'Scripts that run untrusted or downloaded code'],
          ['Secrets Disclosure', 'Hard-coded credentials, or code that reads and exposes them'],
          ['Data Exfiltration', 'Sending data to places the skill has no reason to talk to'],
          ['Obfuscated Behavior', 'Encoded or hidden logic'],
          ['Behavior Integrity', 'A skill that does something other than what its description says'],
          ['Excessive Permissions', 'More access (tools, MCP, file system) than the task needs'],
        ],
      },
      {
        type: 'steps',
        steps: [
          { title: 'Activate', text: 'Create an **AI Skill Security** deployment profile and associate it with a US tenant. Superuser, or a custom role with AI Skill Security.' },
          { title: 'Package the skill', text: '`SKILL.md` must sit at the skill root with `name` and `description` in its front matter. In a batch archive, each skill directory sits at the root of the ZIP.',
            code: [{ id: 'bash', lang: 'bash', code: `cd my-skill
zip -r ../my-skill.zip . \\
  -x ".git/*" "__pycache__/*" "*.pyc" ".venv/*" "venv/*" "node_modules/*"` }] },
          { title: 'Scan it', text: 'Upload the ZIP (optionally with its Git URL, recorded as metadata). A scan takes seconds, up to about five minutes.', path: ['AI Security', 'AI Supply Chain Security', 'Skill Scans', 'New Analysis'] },
        ],
      },
    ],
  },
]

export const REDTEAM = [
  {
    id: 'rtm-targets',
    group: 'redteam',
    title: 'Connect a target to AI Red Teaming',
    sub: 'Models, apps and agents — public or private',
    minutes: 8,
    level: 'Setup',
    docs: pick('pdfRedTeam', 'rtmCreateTgt', 'rtmChannels', 'ghRtClient'),
    blocks: [
      {
        type: 'prose',
        text: [
          'AI Red Teaming attacks an endpoint you point it at: a **model**, an **application** built on one, or an **agent** with tools. It sends attack prompts, reads the answers, and scores what got through. Every request it sends carries an `x-airs-red-teaming-trace-id` header, so you can find red-team traffic in your own logs.',
          'Scans come in three kinds: the **attack library** (curated prompts across security, safety, brand and compliance categories), **agent** scans (an attacking agent profiles the target and pursues up to 10 goals over many turns), and **custom prompt sets** you upload as CSV.',
        ],
      },
      {
        type: 'table',
        title: 'Ways to connect',
        columns: ['Connection', 'Targets', 'Notes'],
        rows: [
          ['OpenAI · Hugging Face', 'Model, app, agent', 'Endpoint, API key, model name, streaming toggle'],
          ['AWS Bedrock', 'Model, app, agent', 'Region and IAM credentials'],
          ['Databricks', 'Model, app, agent', 'Personal access token or OAuth service principal'],
          ['REST · Streaming · WebSocket', 'Model, app, agent', 'Any endpoint, from a cURL command or by hand'],
          ['Microsoft Copilot Studio', 'Agent', 'Entra app with delegated `CopilotStudio.Copilots.Invoke`'],
          ['n8n', 'Agent', 'The workflow\'s **production** webhook URL (not `/webhook-test/`)'],
          ['Gemini Agent Studio', 'Agent', 'GCP service-account impersonation — no keys exchanged'],
          ['Custom adapter', 'Model, app, agent', 'Your Python, running in a sidecar next to the network-channel client'],
        ],
      },
      {
        type: 'code', title: 'REST targets: mark where the attack goes, and where the answer comes back',
        text: 'Import the target from a cURL command and replace the user prompt with `{INPUT}`. Then paste a real response and replace the model\'s answer with `{RESPONSE}` — that is how the service knows what to score.',
        tabs: [
          { id: 'curl', label: 'Request template', lang: 'curl', code: `curl -X POST https://chat.example.com/v1/chat/completions \\
  -H "Authorization: Bearer <api_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      { "role": "system", "content": "You are a helpful assistant." },
      { "role": "user", "content": "{INPUT}" }
    ],
    "temperature": 0.7
  }'` },
          { id: 'json', label: 'Response template', lang: 'json', code: `{
  "id": "",
  "object": "chat.completion",
  "model": "meta-llama-3.1",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "{RESPONSE}" },
      "finish_reason": "stop"
    }
  ]
}` },
        ],
      },
      {
        type: 'steps',
        title: 'Private endpoints: a network channel',
        steps: [
          { title: 'Create a channel', text: 'A channel lets the service reach a target inside your network over an **outbound** WebSocket — no inbound ports. Clients on one channel are load-balanced.', path: ['AI Security', 'AI Red Teaming', 'Network Channels'] },
          { title: 'Install the client on Kubernetes', text: 'Needs Helm 3 and a service account with `airt.network_channels_client`. Egress to `api.sase.paloaltonetworks.com`, `auth.apps.paloaltonetworks.com` and `registry.ai-red-teaming.paloaltonetworks.com`.',
            code: [{ id: 'bash', lang: 'bash', code: `kubectl create secret docker-registry airs-pull-secret \\
  --docker-server=registry.ai-red-teaming.paloaltonetworks.com \\
  --docker-username=<registry-user> --docker-password=<registry-password>

helm registry login registry.ai-red-teaming.paloaltonetworks.com \\
  --username=<registry-user> --password=<registry-password>

helm install panw-network-client \\
  oci://registry.ai-red-teaming.paloaltonetworks.com/pairs-redteam-prd-fckx/red-teaming-onprem/charts/panw-network-client:<version> \\
  --set config.clientId=<CLIENT_ID> \\
  --set config.clientSecret=<CLIENT_SECRET> \\
  --set config.channelId=<CHANNEL_ID>` }] },
          { title: 'Or with Docker Compose', text: 'An installer script for hosts without Kubernetes.',
            code: [{ id: 'bash', lang: 'bash', code: `curl -fLO https://github.com/PaloAltoNetworks/ai-redteam-network-client-docker/releases/latest/download/setup-panw-network-client.sh
chmod +x setup-panw-network-client.sh
./setup-panw-network-client.sh` }] },
          { title: 'Validate', text: 'The client logs "Connected to the server", or use **Validate Channel**. Then create the target with the private endpoint and pick the channel.' },
        ],
      },
      {
        type: 'code', title: 'Targets behind OAuth 2.0',
        text: 'Client-credentials only. The service fetches and refreshes the token itself (before expiry, and again on a 401/403) and injects it into each request.',
        tabs: [{ id: 'json', lang: 'json', code: `{
  "oauth2_token_url": "https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token",
  "oauth2_expiry_minutes": 60,
  "oauth2_headers": { "Content-Type": "application/x-www-form-urlencoded" },
  "oauth2_body_params": {
    "grant_type": "client_credentials",
    "client_id": "<CLIENT_ID>",
    "client_secret": "<CLIENT_SECRET>",
    "scope": "<RESOURCE>/.default"
  },
  "oauth2_token_response_key": "access_token",
  "oauth2_inject_header": { "Authorization": "Bearer {TOKEN}" }
}` }],
      },
      {
        type: 'code', title: 'Anything else: a custom target adapter',
        text: 'When the target speaks a protocol no template fits, write two Python functions. They run in a sidecar next to the network-channel client (chart 1.4.0+, `adapterSidecar.enabled=true`), with Python 3.12, `httpx` and `websockets` available.',
        tabs: [{ id: 'python', lang: 'python', file: 'adapter.py', code: `def pre_process(context, inference_input):
    return PreProcessResult(
        url=context.vars["endpoint"],
        headers={"Authorization": f"Bearer {context.secrets['api_key']}"},
        json_body={"message": inference_input.prompt},
    )


def post_process(context, raw_response):
    if raw_response.status_code == 429:
        raise_rate_limited(retry_after=int(raw_response.headers.get("Retry-After", 30)))
    if raw_response.status_code == 401:
        raise_auth_error("token expired")
    body = raw_response.json_body or {}
    if body.get("error", {}).get("code") == "content_filter":
        raise_content_filtered("blocked by safety filter")
    return PostProcessResult(output=body["reply"])` }],
      },
      {
        type: 'cards',
        items: [
          { icon: Swords, tone: '#fb923c', title: 'Run a campaign in this portal', kicker: 'Red Teaming pillar',
            text: 'Create a target, launch an attack-library campaign, read the report, and send a successful attack straight to the runtime console.', go: 'pillar:redTeaming', goLabel: 'Open Red Teaming' },
        ],
      },
    ],
  },

  {
    id: 'rtm-api',
    group: 'redteam',
    title: 'Drive red teaming from code',
    sub: 'Targets, scans and reports over the API',
    minutes: 6,
    level: 'Build',
    docs: pick('rtmIntro', 'rtmOverview', 'rtmCreateTgt', 'rtmCreateScan', 'rtmErrors'),
    blocks: [
      {
        type: 'prose',
        text: 'Everything in the console is available over REST, which is how you put red teaming into a release pipeline: create or reuse a target, start a scan, poll until it completes, then read the score and the recommended runtime profile. Auth is the same Strata Cloud Manager OAuth token as Model Security.',
      },
      {
        type: 'facts', min: 240,
        items: [
          { label: 'Management plane · targets', value: '/ai-red-teaming/mgmt-plane', mono: true, sub: 'On `api.sase.paloaltonetworks.com`' },
          { label: 'Data plane · scans and reports', value: '/ai-red-teaming/data-plane', mono: true, sub: 'Plus `/network-broker` for channels' },
          { label: 'Auth', value: 'Bearer token', sub: 'Client credentials, `scope=tsg_id:<TSG>`, 15 minutes' },
        ],
      },
      {
        type: 'code', title: 'List targets, start a scan, read the report',
        tabs: [
          { id: 'curl', lang: 'curl', code: `TOKEN=$(curl -sS -X POST https://auth.apps.paloaltonetworks.com/oauth2/access_token \\
  -u "$CLIENT_ID:$CLIENT_SECRET" \\
  -H 'Content-Type: application/x-www-form-urlencoded' \\
  -d "grant_type=client_credentials&scope=tsg_id:$TSG_ID" | jq -r .access_token)
MP=https://api.sase.paloaltonetworks.com/ai-red-teaming/mgmt-plane
DP=https://api.sase.paloaltonetworks.com/ai-red-teaming/data-plane

# 1 — targets
curl -sS "$MP/v1/target?limit=10&skip=0" -H "Authorization: Bearer $TOKEN" | jq '.data[] | {uuid, name, target_type}'

# 2 — start an attack-library scan against one (this consumes scan quota)
JOB=$(curl -sS -X POST "$DP/v1/scan" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
  "name": "release-candidate-42",
  "target": { "uuid": "'"$TARGET_UUID"'" },
  "job_type": "STATIC",
  "job_metadata": {
    "categories": { "SECURITY": ["JAILBREAK", "PROMPT_INJECTION", "SYSTEM_PROMPT_LEAK"] },
    "rate_limit_enabled": false,
    "content_filter_enabled": false
  }
}' | jq -r .uuid)

# 3 — poll: QUEUED → RUNNING → COMPLETED (or PARTIALLY_COMPLETE / FAILED / ABORTED)
curl -sS "$DP/v1/scan/$JOB" -H "Authorization: Bearer $TOKEN" | jq '{status, total, score, asr}'

# 4 — the report and the runtime profile it recommends
curl -sS "$DP/v1/report/static/$JOB/report" -H "Authorization: Bearer $TOKEN" | jq '{score, asr, severity_report}'
curl -sS "$DP/v1/report/static/$JOB/runtime-policy-config" -H "Authorization: Bearer $TOKEN"` },
          { id: 'python', lang: 'python', file: 'redteam_gate.py', code: `import os
import sys
import time

import requests

AUTH = "https://auth.apps.paloaltonetworks.com/oauth2/access_token"
DP = "https://api.sase.paloaltonetworks.com/ai-red-teaming/data-plane"

tok = requests.post(
    AUTH,
    auth=(os.environ["CLIENT_ID"], os.environ["CLIENT_SECRET"]),
    data={"grant_type": "client_credentials", "scope": f"tsg_id:{os.environ['TSG_ID']}"},
    timeout=10,
).json()["access_token"]
H = {"Authorization": f"Bearer {tok}"}

job = requests.post(f"{DP}/v1/scan", headers=H, timeout=30, json={
    "name": f"ci-{os.environ.get('GITHUB_RUN_ID', 'local')}",
    "target": {"uuid": os.environ["TARGET_UUID"]},
    "job_type": "STATIC",
    "job_metadata": {"categories": {"SECURITY": ["JAILBREAK", "PROMPT_INJECTION"]},
                     "rate_limit_enabled": False, "content_filter_enabled": False},
}).json()

while True:                                   # a typical scan takes minutes to hours
    s = requests.get(f"{DP}/v1/scan/{job['uuid']}", headers=H, timeout=30).json()
    if s["status"] in ("COMPLETED", "PARTIALLY_COMPLETE", "FAILED", "ABORTED"):
        break                                 # every end state, or a partial run loops forever
    time.sleep(60)                            # the token lives 15 minutes — refresh it in a long loop

print(s["status"], "risk score", s.get("score"), "ASR", s.get("asr"))
sys.exit(0 if s["status"] == "COMPLETED" and (s.get("asr") or 0) < 5 else 1)   # a partial run fails the gate` },
        ],
      },
      {
        type: 'callout', tone: 'observed', title: 'What came back from a live tenant',
        text: 'The read calls above (targets, scan list, scan detail, report, runtime-policy-config) were run from this portal. A completed attack-library scan reported `score` 3.34, `asr` 2.15 (38 of 1,796 attempts succeeded) and a `severity_report` split by severity; `runtime-policy-config` returned a `runtime_security_profile`. The scan-creation call was not re-run for this page — it consumes quota — but it is the same body the Red Teaming pillar sends. The ASR threshold in the Python gate is an example, not a Palo Alto Networks recommendation.',
      },
      {
        type: 'table',
        title: 'Endpoints you will use',
        columns: ['Plane', 'Path', 'Purpose'],
        rows: [
          ['mgmt', '`GET` / `POST /v1/target`', 'List or create targets (`?validate=true` probes the endpoint first)'],
          ['mgmt', '`POST /v1/target/probe` · `/validate-auth`', 'Check connectivity and credentials'],
          ['data', '`POST /v1/scan` · `GET /v1/scan/{id}`', 'Start a scan (`STATIC`, `DYNAMIC`, `CUSTOM`); status and score'],
          ['data', '`POST /v1/scan/{id}/abort`', 'Stop a running scan'],
          ['data', '`GET /v1/report/static/{id}/report` · `/list-attacks`', 'Attack-library report and every attack'],
          ['data', '`GET /v1/report/dynamic/{id}/report` · `/list-goals`', 'Agent-scan report and goals'],
          ['data', '`GET /v1/report/{static|dynamic}/{id}/runtime-policy-config`', 'The recommended runtime security profile'],
          ['data', '`GET /v1/report/{id}/download`', 'CSV/PDF export for a completed scan'],
          ['data', '`GET /v1/categories`', 'Attack categories and sub-categories'],
        ],
        note: 'Errors worth handling: 400 `QUOTA_EXCEEDED` (monthly scans used up) and 403 when the EULA has not been accepted in the console.',
      },
      { type: 'repo', title: 'Token and request helper', file: 'server.js', lines: '1478-1518', lang: 'javascript', code: RT_FETCH, why: 'Every Red Teaming pillar call goes through these two functions.' },
    ],
  },
]

export const NETWORK = [
  {
    id: 'ni-deploy',
    group: 'network',
    title: 'Network intercept — deployment options',
    sub: 'Prisma AIRS firewalls in cloud, private cloud and Kubernetes',
    minutes: 6,
    level: 'Setup',
    docs: pick('pdfRuntime', 'docsHub'),
    blocks: [
      {
        type: 'prose',
        text: 'Network intercept puts a Prisma AIRS firewall in the path of AI traffic — app to model, user to app, app to internet, and east-west between Kubernetes workloads — so nothing in the application changes. It understands the Bedrock (Invoke and Converse), Vertex, Azure and OpenAI chat formats, and any custom endpoint that speaks the OpenAI format. It is managed from Strata Cloud Manager or Panorama.',
      },
      {
        type: 'table',
        title: 'Deployment options',
        columns: ['Option', 'How'],
        rows: [
          ['Public cloud (AWS, Azure, GCP)', 'Strata Cloud Manager discovers the workloads and generates **Terraform**: AI Security → AI Runtime Firewall → Add Protections; then `terraform init / plan / apply`'],
          ['Auto-execute (AWS, Azure)', 'SCM provisions the security VPC/VNet, firewalls, load balancers and routes for you'],
          ['Without discovery', 'Skip cloud-account onboarding and download the Terraform directly'],
          ['Kubernetes', 'The PAN-CNI plug-in chained after your CNI steers pod traffic to the firewall (EKS, AKS, GKE, OpenShift, Rancher; not GKE Autopilot)'],
          ['Private cloud', 'VM images for ESXi and KVM (OpenShift and Rancher too)'],
          ['Panorama-managed', 'The same firewalls, managed from Panorama with the CloudConnector plug-in'],
          ['Managed AIRS for AWS', 'Private preview — Cloud NGFW based, pay-as-you-go on AWS Marketplace'],
        ],
      },
      {
        type: 'code', title: 'Kubernetes: chain PAN-CNI and choose what is inspected',
        tabs: [{ id: 'bash', lang: 'bash', code: `# From the Helm chart SCM generates with your Terraform
helm install ai-runtime-security helm --namespace kube-system --values helm/values.yaml

# VPC-level security: send a namespace's traffic through the firewall…
kubectl annotate namespace payments paloaltonetworks.com/firewall=pan-fw

# …or namespace-level security with traffic steering. Despite the name, this
# puts every pod in the protected state; which CIDRs are inspected or bypassed
# is set in the custom resource (FIREWALL / BYPASS), not by this annotation
kubectl annotate pods --all paloaltonetworks.com/subnetfirewall=ns-secure/bypassfirewall` }],
      },
      {
        type: 'steps',
        title: 'Enforcement, once the firewall is in the path',
        steps: [
          { title: 'Decrypt', text: 'Prompts travel over TLS, so an SSL Forward Proxy decryption rule is required, with the firewall\'s root CA trusted by the workloads.' },
          { title: 'An AI security profile', text: 'Choose protections per model group: prompt injection, toxic content, URL security, a DLP data rule, database security (per CRUD type), and allow/block access to models.' },
          { title: 'Attach and push', text: 'Add the profile to a security profile group, reference it in a security policy rule, and push the configuration.' },
          { title: 'Tune latency', text: 'Set the maximum inline latency (1–300 s) and what happens on timeout — allow, alert, or block.' },
        ],
      },
      {
        type: 'callout', tone: 'docs',
        text: 'Capacity is documented as up to **10,000 AI transactions per day per vCPU** of network intercept. Detections appear in the Threat log under subtype `ai-security` (for example `ai-prompt-injection`, `ai-data-leakage`, `ai-url-security`).',
      },
      {
        type: 'callout', tone: 'info',
        text: 'This portal does not run network intercept — its demos use the API and the gateway. The AI Runtime Security guide (PDF) covers every deployment path step by step.',
      },
    ],
  },
]
