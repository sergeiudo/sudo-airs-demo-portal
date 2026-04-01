import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Code2, Globe, FileCode, BookOpen, Terminal,
  ChevronRight, Shield, AlertTriangle, CheckCircle2,
  ArrowRight, Copy, Check, Package, Key, Server,
} from 'lucide-react'
import { CodeBlock } from '../components/shared/CodeBlock'

// ─── Content data ─────────────────────────────────────────────────────────────

const PYTHON_SYNC = `import os
import aisecurity
from aisecurity.scan.inline.scanner import Scanner
from aisecurity.scan.models.content import Content
from aisecurity.generated_openapi_client.models.ai_profile import AiProfile

# ── Step 1: Initialize with your API key ──────────────────────────
aisecurity.init(api_key=os.getenv("PANW_AI_SEC_API_KEY"))  # ← set this env var

# ── Step 2: Reference your AI Security Profile ────────────────────
ai_profile = AiProfile(profile_name="your-profile-name")   # ← set this
scanner = Scanner()

def secure_llm_call(user_prompt: str) -> str:
    # ── Step 3: Scan prompt BEFORE sending to LLM ─────────────────
    input_scan = scanner.sync_scan(
        ai_profile=ai_profile,
        content=Content(prompt=user_prompt),
    )
    if input_scan.action == "block":
        return f"Request blocked: {input_scan.category}"
        # input_scan.prompt_detected.injection → True if injection found
        # input_scan.prompt_detected.dlp       → True if sensitive data
        # input_scan.scan_id                   → UUID for audit trail
        # input_scan.report_id                 → links to Strata Cloud Manager

    # ── Step 4: Call your LLM ─────────────────────────────────────
    llm_response = your_llm_client.generate(user_prompt)

    # ── Step 5: Scan response BEFORE returning to user ────────────
    output_scan = scanner.sync_scan(
        ai_profile=ai_profile,
        content=Content(
            prompt=user_prompt,
            response=llm_response,   # ← include both for output scan
        ),
    )
    if output_scan.action == "block":
        return f"Response blocked: {output_scan.category}"
        # output_scan.response_detected.dlp      → sensitive data in response
        # output_scan.response_detected.url_cats → malicious URL in response
        # output_scan.response_detected.ungrounded → hallucination detected

    return llm_response  # ✓ Safe to return to user`

const PYTHON_ASYNC = `import asyncio
import aisecurity
from aisecurity.scan.asyncio.scanner import Scanner  # asyncio variant
from aisecurity.scan.models.content import Content
from aisecurity.generated_openapi_client.models.ai_profile import AiProfile
from aisecurity.generated_openapi_client import (
    AsyncScanObject, ScanRequest, ScanRequestContentsInner
)

aisecurity.init(api_key=os.getenv("PANW_AI_SEC_API_KEY"))
scanner = Scanner()
ai_profile = AiProfile(profile_name="your-profile-name")

async def batch_scan():
    # Submit up to 25 scan objects in one API call
    scan_objects = [
        AsyncScanObject(
            req_id=1,
            scan_req=ScanRequest(
                ai_profile=ai_profile,
                contents=[ScanRequestContentsInner(
                    prompt="First user prompt to scan",
                )],
            ),
        ),
        AsyncScanObject(
            req_id=2,
            scan_req=ScanRequest(
                ai_profile=ai_profile,
                contents=[ScanRequestContentsInner(
                    prompt="Second prompt",
                    response="LLM response to validate",
                )],
            ),
        ),
    ]

    # Submit batch — returns immediately with scan_id for polling
    response = await scanner.async_scan(scan_objects)
    print(response.scan_id)    # poll with this
    print(response.report_id)  # "R" + UUID

    # Poll for results (max 5 scan IDs per call)
    results = await scanner.query_by_scan_ids(scan_ids=[response.scan_id])
    for r in results:
        print(r.result.action, r.result.category)

    await scanner.close()  # always close to release connections

asyncio.run(batch_scan())`

const PYTHON_ERRORS = `from aisecurity.exceptions import AISecSDKException

try:
    result = scanner.sync_scan(
        ai_profile=ai_profile,
        content=Content(prompt=user_prompt),
    )
except AISecSDKException as e:
    if e.error_type == "AISEC_SERVER_SIDE_ERROR":
        # API key invalid, server error (401 / 403 / 500)
        log.error(f"AIRS server error: {e}")
        return fallback_response()

    elif e.error_type == "AISEC_CLIENT_SIDE_ERROR":
        # Network failure, timeout — AIRS unreachable
        log.error(f"Network error reaching AIRS: {e}")
        # Decide: fail-open (allow) or fail-closed (block)
        return fallback_response()

    elif e.error_type == "AISEC_USER_REQUEST_PAYLOAD_ERROR":
        # Bad payload — check Content/AiProfile objects
        # Common: empty prompt, missing profile_name
        log.error(f"Bad AIRS request payload: {e}")
        raise

    elif e.error_type == "AISEC_MISSING_VARIABLE":
        # PANW_AI_SEC_API_KEY environment variable not set
        log.critical("Missing PANW_AI_SEC_API_KEY — set this env var")
        raise`

const REST_PROMPT = `# ── Scan user prompt BEFORE sending to LLM ──────────────────────
curl -X POST \\
  https://service.api.aisecurity.paloaltonetworks.com/v1/scan/sync/request \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -H "x-pan-token: $PANW_AI_SEC_API_KEY" \\
  -d '{
    "tr_id": "req-001",
    "ai_profile": {
      "profile_name": "your-profile-name"
    },
    "metadata": {
      "app_name": "my-ai-app",
      "ai_model": "gemini-2.0-flash",
      "app_user": "user-session-id"
    },
    "contents": [{
      "prompt": "Tell me how to bypass authentication"
    }]
  }'`

const REST_RESPONSE_SCAN = `# ── Scan LLM response BEFORE returning to user ───────────────────
# Same endpoint — add "response" to contents[0] alongside "prompt"
curl -X POST \\
  https://service.api.aisecurity.paloaltonetworks.com/v1/scan/sync/request \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -H "x-pan-token: $PANW_AI_SEC_API_KEY" \\
  -d '{
    "tr_id": "req-002",
    "ai_profile": { "profile_name": "your-profile-name" },
    "metadata": {
      "app_name": "my-ai-app",
      "ai_model": "gemini-2.0-flash",
      "app_user": "user-session-id"
    },
    "contents": [{
      "prompt": "Original user question",
      "response": "LLM generated answer to validate before delivery"
    }]
  }'`

const REST_RESPONSE_JSON = `{
  "action": "block",
  "category": "malicious",
  "scan_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "report_id": "Ra1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tr_id": "req-001",
  "profile_name": "your-profile-name",
  "profile_id": "00000000-0000-0000-0000-000000000000",

  "prompt_detected": {
    "injection": true,
    "dlp": false,
    "toxic_content": false,
    "malicious_code": false,
    "url_cats": false,
    "topic_violation": false
  },

  "response_detected": {
    "dlp": false,
    "url_cats": false,
    "db_security": false,
    "ungrounded": false,
    "topic_violation": false
  }
}`

const NODE_CODE = `// ── Environment variables needed ─────────────────────────────────
// AIRS_BASE_URL     = https://service.api.aisecurity.paloaltonetworks.com
// AIRS_API_KEY      = your x-pan-token value  (PANW_AI_SEC_API_KEY)
// AIRS_PROFILE_NAME = your AI security profile name

// ── airscan() — reusable AIRS scan function ───────────────────────
async function airscan(prompt, response = null, modelName = 'unknown') {
  const body = {
    tr_id: \`app-\${Date.now()}\`,               // unique per call
    ai_profile: {
      profile_name: process.env.AIRS_PROFILE_NAME,
    },
    metadata: {
      app_name: 'my-ai-app',
      ai_model: modelName,
      app_user: 'user-session-id',
    },
    contents: [{
      prompt,
      // Include "response" only for output scans (after LLM):
      ...(response != null ? { response } : {}),
    }],
  }

  const res = await fetch(
    \`\${process.env.AIRS_BASE_URL}/v1/scan/sync/request\`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-pan-token': process.env.AIRS_API_KEY,  // ← auth header
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) throw new Error(\`AIRS scan failed (\${res.status})\`)

  const data = await res.json()
  // data.action   → "allow" | "block"
  // data.category → "benign" | "malicious"
  // data.scan_id  → UUID for audit trail
  return data
}

// ── Route handler: dual-scan pattern ─────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, modelId } = req.body

  // 1. Intercept prompt before LLM
  const inputScan = await airscan(message, null, modelId)
  if (inputScan.action === 'block') {
    return res.json({ blocked: true, category: inputScan.category })
  }

  // 2. Call LLM (only reaches here if AIRS allowed it)
  const llmText = await callYourLLM(message, modelId)

  // 3. Intercept LLM response before returning
  const outputScan = await airscan(message, llmText, modelId)
  if (outputScan.action === 'block') {
    return res.json({ blocked: true, category: outputScan.category })
  }

  // 4. Safe to return
  res.json({ reply: llmText })
})`

const LIVE_CODE = `// ── server.js — actual code running in this demo ─────────────────

async function airscan(prompt, response = null, model = 'unknown') {
  const body = {
    tr_id: \`citadel-\${Date.now()}\`,
    ai_profile: { profile_name: process.env.AIRS_PROFILE_NAME },
    metadata: {
      app_name: 'SUDO AIRS Demo',
      ai_model: model,
      app_user: 'demo-user',
    },
    contents: [{ prompt, ...(response != null ? { response } : {}) }],
  }

  const t0 = Date.now()
  const res = await fetch(
    \`\${process.env.AIRS_BASE_URL}/v1/scan/sync/request\`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-pan-token': process.env.AIRS_API_KEY,
      },
      body: JSON.stringify(body),
    }
  )
  const data = await res.json()
  return { data, latencyMs: Date.now() - t0 }
}

// ── /api/chat handler (abbreviated) ──────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, airsEnabled, modelId } = req.body

  if (airsEnabled) {
    const airsPromptScan = await airscan(message, null, modelLabel)

    if (airsPromptScan.data.action === 'block') {
      const telemetry = buildTelemetry({ airsPromptScan, ... })
      return res.json(telemetry)         // blocked — no LLM call
    }
  }

  const llmResult = await callVertexAI(message, modelId)  // or Bedrock

  if (airsEnabled) {
    const airsResponseScan = await airscan(message, llmResult.text, modelLabel)
    const telemetry = buildTelemetry({ airsPromptScan, airsResponseScan, ... })
    return res.json(telemetry)
  }

  res.json({ chatResponse: { content: llmResult.text } })
})`

// ─── Nav sections ─────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'quickstart', label: 'Quick Start',   icon: Zap,      color: '#f59e0b' },
  { id: 'python',     label: 'Python SDK',    icon: Code2,    color: '#3b82f6' },
  { id: 'rest',       label: 'REST API',      icon: Globe,    color: '#10b981' },
  { id: 'nodejs',     label: 'Node.js',       icon: Server,   color: '#f97316' },
  { id: 'live',       label: 'Live Demo Code',icon: Terminal, color: '#8b5cf6' },
  { id: 'reference',  label: 'API Reference', icon: BookOpen, color: '#06b6d4' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title, subtitle, color }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}22` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <h2 className="text-xl font-bold text-slate-100">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-slate-500 ml-12">{subtitle}</p>}
    </div>
  )
}

function InfoCard({ icon: Icon, color, title, children }) {
  return (
    <div className="flex gap-3 p-3 rounded-xl border" style={{ background: `${color}0d`, borderColor: `${color}33` }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${color}22` }}>
        <Icon size={13} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold mb-0.5" style={{ color }}>{title}</div>
        <div className="text-[11px] text-slate-400 leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

function Callout({ color = '#3b82f6', icon: Icon = Shield, label, children }) {
  return (
    <div className="flex gap-3 p-3 rounded-xl border-l-2" style={{ borderLeftColor: color, background: `${color}0a` }}>
      <Icon size={14} style={{ color }} className="flex-shrink-0 mt-0.5" />
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color }}>{label}</div>
        <div className="text-[11px] text-slate-400 leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

function SubTabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 mb-4 p-1 rounded-lg border border-white/10 bg-black/20 w-fit">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className="px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all"
          style={active === t.id
            ? { background: 'rgba(99,102,241,0.25)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.4)' }
            : { color: '#64748b' }
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Table({ headers, rows }) {
  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <table className="w-full text-[11px]">
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {headers.map(h => (
              <th key={h} className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-[10px]" style={{ color: '#475569' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #f1f5f9' }}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 font-mono" style={{ color: '#334155' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Flow diagram ─────────────────────────────────────────────────────────────

function FlowDiagram() {
  const steps = [
    { label: 'User', sub: 'prompt', color: '#94a3b8' },
    { label: 'Your App', sub: 'backend', color: '#94a3b8' },
    { label: 'AIRS Scan', sub: 'input', color: '#10b981' },
    { label: 'LLM', sub: 'inference', color: '#3b82f6' },
    { label: 'AIRS Scan', sub: 'output', color: '#10b981' },
    { label: 'User', sub: 'safe response', color: '#94a3b8' },
  ]
  return (
    <div className="flex items-center gap-1 flex-wrap py-3">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center">
            <div className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-center" style={{ background: `${s.color}18`, border: `1px solid ${s.color}40`, color: s.color }}>
              {s.label}
            </div>
            <div className="text-[9px] text-slate-600 mt-0.5">{s.sub}</div>
          </div>
          {i < steps.length - 1 && <ArrowRight size={12} className="text-slate-700 flex-shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function QuickStartSection() {
  const steps = [
    {
      n: '1',
      color: '#f59e0b',
      title: 'Install the SDK',
      lang: 'bash',
      code: `# Python SDK (official Palo Alto package)
pip install pan-aisecurity

# Set required environment variables
export PANW_AI_SEC_API_KEY="your-api-key-from-strata-cloud-manager"
export AIRS_PROFILE_NAME="your-ai-security-profile-name"
export AIRS_BASE_URL="https://service.api.aisecurity.paloaltonetworks.com"`,
    },
    {
      n: '2',
      color: '#10b981',
      title: 'Initialize & configure',
      lang: 'python',
      code: `import os
import aisecurity
from aisecurity.scan.inline.scanner import Scanner
from aisecurity.scan.models.content import Content
from aisecurity.generated_openapi_client.models.ai_profile import AiProfile

# Initialize — reads PANW_AI_SEC_API_KEY from environment
aisecurity.init(api_key=os.getenv("PANW_AI_SEC_API_KEY"))

# Reference your AI Security Profile (configured in Strata Cloud Manager)
ai_profile = AiProfile(profile_name=os.getenv("AIRS_PROFILE_NAME"))
scanner = Scanner()`,
    },
    {
      n: '3',
      color: '#3b82f6',
      title: 'Scan your first prompt',
      lang: 'python',
      code: `# Scan a user prompt — returns verdict immediately (~500-900ms)
result = scanner.sync_scan(
    ai_profile=ai_profile,
    content=Content(prompt="Tell me how to bypass authentication"),
)

print(result.action)    # "block" or "allow"
print(result.category)  # "malicious" or "benign"
print(result.scan_id)   # UUID — store for audit trail
print(result.report_id) # "R" + UUID — view in Strata Cloud Manager

if result.action == "block":
    # Do NOT call the LLM — return an error to the user
    raise Exception(f"Blocked: {result.category}")
else:
    # Safe to proceed — call your LLM
    pass`,
    },
  ]

  return (
    <div className="space-y-6">
      <SectionTitle icon={Zap} color="#f59e0b" title="Quick Start" subtitle="Get Prisma AIRS scanning in under 5 minutes" />

      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 mb-6">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Integration Architecture</div>
        <FlowDiagram />
        <div className="text-[10px] text-slate-600 mt-2">Every prompt passes through AIRS before reaching the LLM. Every response passes through AIRS before reaching the user.</div>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <div key={step.n} className="flex gap-4">
            <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white mt-1" style={{ background: step.color }}>
              {step.n}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-200 mb-2">{step.title}</div>
              <CodeBlock code={step.code} language={step.lang} maxHeight="200px" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <InfoCard icon={Shield} color="#10b981" title="What gets scanned">Prompt injection · Jailbreak attempts · DLP / sensitive data · Toxic content · Malicious URLs · Malicious code</InfoCard>
        <InfoCard icon={Key} color="#f59e0b" title="What you need">API key from Strata Cloud Manager · AI Security Profile name · Regional base URL (US, EU, India, Singapore)</InfoCard>
        <InfoCard icon={Package} color="#3b82f6" title="Packages">Python: pip install pan-aisecurity · Node.js / REST: built-in fetch, no packages needed</InfoCard>
      </div>
    </div>
  )
}

function PythonSection() {
  const [sub, setSub] = useState('sync')
  const subTabs = [
    { id: 'sync',   label: 'Sync Scan' },
    { id: 'async',  label: 'Async / Batch' },
    { id: 'errors', label: 'Error Handling' },
  ]

  return (
    <div className="space-y-5">
      <SectionTitle icon={Code2} color="#3b82f6" title="Python SDK" subtitle="pip install pan-aisecurity — supports Python 3.9–3.13" />

      <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
        <Package size={14} className="text-blue-400 flex-shrink-0" />
        <code className="text-[12px] font-mono text-blue-300">pip install pan-aisecurity</code>
        <span className="text-[10px] text-slate-600 ml-auto">Supported: Python 3.9, 3.10, 3.11, 3.12, 3.13</span>
      </div>

      <SubTabBar tabs={subTabs} active={sub} onChange={setSub} />

      {sub === 'sync' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Callout color="#10b981" icon={CheckCircle2} label="Input scan">Call before the LLM. Catches injection, jailbreak, DLP, toxic content. If action is "block" — do NOT call the LLM.</Callout>
            <Callout color="#3b82f6" icon={Shield} label="Output scan">Call after the LLM with both prompt and response. Catches data leakage, malicious URLs, database attacks, hallucinations.</Callout>
          </div>
          <CodeBlock code={PYTHON_SYNC} language="python" maxHeight="420px" />
        </div>
      )}

      {sub === 'async' && (
        <div className="space-y-4">
          <Callout color="#8b5cf6" icon={Zap} label="When to use async">Use for batch processing, high-throughput pipelines, or when you can tolerate slight delay. Submit up to 25 scan objects per batch. Poll results with query_by_scan_ids().</Callout>
          <CodeBlock code={PYTHON_ASYNC} language="python" maxHeight="420px" />
        </div>
      )}

      {sub === 'errors' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InfoCard icon={AlertTriangle} color="#ef4444" title="AISEC_SERVER_SIDE_ERROR">API key invalid, server 500. Log and decide: fail-open (allow) or fail-closed (block).</InfoCard>
            <InfoCard icon={AlertTriangle} color="#f97316" title="AISEC_CLIENT_SIDE_ERROR">Network failure, AIRS unreachable. Consider retry with backoff.</InfoCard>
            <InfoCard icon={AlertTriangle} color="#f59e0b" title="AISEC_USER_REQUEST_PAYLOAD_ERROR">Bad payload — empty prompt, missing profile_name. Fix the request.</InfoCard>
            <InfoCard icon={AlertTriangle} color="#8b5cf6" title="AISEC_MISSING_VARIABLE">PANW_AI_SEC_API_KEY env var not set. Fix deployment config.</InfoCard>
          </div>
          <CodeBlock code={PYTHON_ERRORS} language="python" maxHeight="320px" />
        </div>
      )}
    </div>
  )
}

function RestSection() {
  const [sub, setSub] = useState('prompt')
  const subTabs = [
    { id: 'prompt',   label: 'Prompt Scan' },
    { id: 'response', label: 'Response Scan' },
    { id: 'json',     label: 'API Response' },
  ]

  const regions = [
    ['US (default)', 'service.api.aisecurity.paloaltonetworks.com'],
    ['EU — Germany', 'service-de.api.aisecurity.paloaltonetworks.com'],
    ['India', 'service-in.api.aisecurity.paloaltonetworks.com'],
    ['Singapore', 'service-sg.api.aisecurity.paloaltonetworks.com'],
  ]

  return (
    <div className="space-y-5">
      <SectionTitle icon={Globe} color="#10b981" title="REST API" subtitle="Language-agnostic — works with any stack via HTTP POST" />

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Authentication</div>
          <code className="text-[11px] font-mono text-emerald-400">x-pan-token: {'<your-API-key>'}</code>
          <div className="text-[10px] text-slate-600 mt-1">Or: Authorization: Bearer {'<oauth-token>'} for RBAC</div>
        </div>
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Endpoint</div>
          <code className="text-[11px] font-mono text-blue-400">POST /v1/scan/sync/request</code>
          <div className="text-[10px] text-slate-600 mt-1">Max payload: 2MB · Rate: standard · Latency: ~500-900ms</div>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Regional Endpoints</div>
        <Table
          headers={['Region', 'Base URL']}
          rows={regions}
        />
      </div>

      <SubTabBar tabs={subTabs} active={sub} onChange={setSub} />

      {sub === 'prompt' && (
        <div className="space-y-3">
          <Callout color="#10b981" icon={Shield} label="Input interception">Send this request BEFORE calling your LLM. If action is "block", do not forward to the LLM.</Callout>
          <CodeBlock code={REST_PROMPT} language="bash" maxHeight="340px" />
        </div>
      )}
      {sub === 'response' && (
        <div className="space-y-3">
          <Callout color="#3b82f6" icon={Shield} label="Output interception">Send this AFTER your LLM responds. Include both "prompt" and "response" in contents[0]. If action is "block", suppress the response.</Callout>
          <CodeBlock code={REST_RESPONSE_SCAN} language="bash" maxHeight="340px" />
        </div>
      )}
      {sub === 'json' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <InfoCard icon={CheckCircle2} color="#10b981" title="action">The enforcement decision: "allow" or "block". Always check this first.</InfoCard>
            <InfoCard icon={Shield} color="#f59e0b" title="scan_id">UUID for this scan. Store for audit trail and correlation with your logs.</InfoCard>
            <InfoCard icon={BookOpen} color="#3b82f6" title="report_id">"R" + UUID. Use to fetch full detection report from Strata Cloud Manager.</InfoCard>
          </div>
          <CodeBlock code={REST_RESPONSE_JSON} language="json" maxHeight="360px" />
        </div>
      )}
    </div>
  )
}

function NodeSection() {
  return (
    <div className="space-y-5">
      <SectionTitle icon={Server} color="#f97316" title="Node.js / Express" subtitle="No SDK needed — use built-in fetch with the REST API directly" />

      <div className="grid grid-cols-3 gap-3">
        <InfoCard icon={Key} color="#f97316" title="AIRS_BASE_URL">https://service.api.aisecurity.paloaltonetworks.com (or regional equivalent)</InfoCard>
        <InfoCard icon={Key} color="#f59e0b" title="AIRS_API_KEY">Your x-pan-token value from Strata Cloud Manager</InfoCard>
        <InfoCard icon={Key} color="#10b981" title="AIRS_PROFILE_NAME">Name of your AI Security Profile</InfoCard>
      </div>

      <Callout color="#f97316" icon={Code2} label="Pattern">Create a reusable airscan() function. Call it twice in your route handler: once before the LLM (input), once after (output). Block on action === "block".</Callout>

      <CodeBlock code={NODE_CODE} language="javascript" maxHeight="560px" />
    </div>
  )
}

function LiveDemoSection() {
  const annotations = [
    { color: '#10b981', icon: Shield, label: '① Prompt intercepted here', body: 'airscan(message, null, modelLabel) — scans prompt-only. If blocked, LLM is never called. Latency measured with Date.now().' },
    { color: '#f59e0b', icon: Zap, label: '② AIRS scan API called', body: 'POST /v1/scan/sync/request with x-pan-token header. Body includes tr_id, ai_profile, metadata, and contents[0].prompt.' },
    { color: '#ef4444', icon: AlertTriangle, label: '③ Verdict enforced', body: 'data.action === "block" → return immediately without calling LLM. buildTelemetry() packages the scan result for the frontend.' },
    { color: '#8b5cf6', icon: Shield, label: '④ Response validated', body: 'airscan(message, llmText, modelLabel) — second scan with both prompt and response. Catches DLP leaks, malicious URLs, hallucinations in the LLM output.' },
  ]

  return (
    <div className="space-y-5">
      <SectionTitle icon={Terminal} color="#8b5cf6" title="Live Demo Code" subtitle="Actual server.js code running in this demo portal right now" />

      <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse flex-shrink-0" />
        <span className="text-[12px] text-purple-300 font-medium">This is the real integration — not a mock. Every chat message in the API Intercept view goes through this exact code path.</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {annotations.map((a, i) => (
          <Callout key={i} color={a.color} icon={a.icon} label={a.label}>{a.body}</Callout>
        ))}
      </div>

      <CodeBlock code={LIVE_CODE} language="javascript" maxHeight="500px" />
    </div>
  )
}

function ReferenceSection() {
  return (
    <div className="space-y-6">
      <SectionTitle icon={BookOpen} color="#06b6d4" title="API Reference" subtitle="Complete field reference for the Prisma AIRS Scan API" />

      <div>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Scan Endpoints</div>
        <Table
          headers={['Method', 'Path', 'Description', 'Max Payload']}
          rows={[
            ['POST', '/v1/scan/sync/request',  'Synchronous scan — returns immediately', '2 MB'],
            ['POST', '/v1/scan/async/request', 'Async batch scan (up to 25 requests)',   '5 MB'],
            ['GET',  '/v1/scan/results',       'Poll async results by scan_id (max 5)',  '—'],
            ['GET',  '/v1/scan/reports',       'Get full detection reports (max 5)',      '—'],
          ]}
        />
      </div>

      <div>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Request Body Fields</div>
        <Table
          headers={['Field', 'Type', 'Required', 'Description']}
          rows={[
            ['tr_id',                    'string', 'No',  'Caller-supplied transaction ID for correlation'],
            ['ai_profile.profile_name',  'string', 'Yes', 'AI Security Profile name (or profile_id)'],
            ['ai_profile.profile_id',    'UUID',   'Yes', 'Profile UUID (alternative to profile_name)'],
            ['metadata.app_name',        'string', 'No',  'Your application name for logging'],
            ['metadata.ai_model',        'string', 'No',  'AI model name for logging'],
            ['metadata.app_user',        'string', 'No',  'End-user identifier for logging'],
            ['contents[].prompt',        'string', 'No',  'User prompt text to scan'],
            ['contents[].response',      'string', 'No',  'LLM response text to scan (output scan)'],
            ['contents[].context',       'string', 'No',  'RAG context (for contextual grounding)'],
            ['contents[].code_response', 'string', 'No',  'Code snippet to scan for malware'],
          ]}
        />
      </div>

      <div>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Response Fields</div>
        <Table
          headers={['Field', 'Type', 'Values / Notes']}
          rows={[
            ['action',                  'string',  '"allow" | "block"'],
            ['category',                'string',  '"benign" | "malicious"'],
            ['scan_id',                 'UUID',    'Store for audit trail'],
            ['report_id',               'string',  '"R" + UUID — view in Strata Cloud Manager'],
            ['tr_id',                   'string',  'Echoed from request'],
            ['profile_name',            'string',  'Profile used for this scan'],
            ['prompt_detected.injection',    'boolean', 'Prompt injection detected'],
            ['prompt_detected.dlp',          'boolean', 'Sensitive data in prompt'],
            ['prompt_detected.toxic_content','boolean', 'Toxic / harmful content'],
            ['prompt_detected.malicious_code','boolean','Malware in code_response'],
            ['prompt_detected.url_cats',     'boolean', 'Malicious URL in prompt'],
            ['prompt_detected.topic_violation','boolean','Custom topic guardrail triggered'],
            ['response_detected.dlp',        'boolean', 'Sensitive data in response'],
            ['response_detected.url_cats',   'boolean', 'Malicious URL in response'],
            ['response_detected.db_security','boolean', 'Database attack in response'],
            ['response_detected.ungrounded', 'boolean', 'Hallucination detected (RAG grounding)'],
            ['response_detected.topic_violation','boolean','Custom topic in response'],
          ]}
        />
      </div>

      <div>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">HTTP Status Codes</div>
        <Table
          headers={['Code', 'Meaning', 'Action']}
          rows={[
            ['200', 'Success',            'Parse action field'],
            ['400', 'Bad Request',        'Fix request payload'],
            ['401', 'Unauthenticated',    'Check x-pan-token header'],
            ['403', 'Forbidden',          'API key invalid or revoked'],
            ['413', 'Payload Too Large',  'Reduce request size (max 2MB sync)'],
            ['429', 'Rate Limited',       'Back off and retry'],
            ['500', 'Server Error',       'Retry with backoff; consider fail-open policy'],
          ]}
        />
      </div>

      <div>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Detection Services (in full reports)</div>
        <Table
          headers={['Service Key', 'Name', 'Detects']}
          rows={[
            ['pi',                   'Prompt Injection',      'Direct injection, jailbreak, role confusion'],
            ['dlp',                  'Data Loss Prevention',  'PII, credentials, financial data, secrets'],
            ['uf',                   'URL Filtering',         'Malicious, phishing, C2 URLs'],
            ['tc',                   'Toxic Content',         'Violence, hate speech, self-harm'],
            ['dbs',                  'Database Security',     'SQL injection, destructive queries in response'],
            ['malicious_code',       'Malicious Code',        'Malware, backdoors, EICAR test files'],
            ['agent_security',       'Agent Security',        'Memory manipulation, tool misuse in AI agents'],
            ['contextual_grounding', 'Contextual Grounding',  'Hallucinations (response not grounded in context)'],
            ['topic_guardrails',     'Topic Guardrails',      'Custom blocked/allowed topic violations'],
          ]}
        />
      </div>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function DeveloperCornerView() {
  const [activeSection, setActiveSection] = useState('quickstart')

  const renderSection = () => {
    switch (activeSection) {
      case 'quickstart': return <QuickStartSection />
      case 'python':     return <PythonSection />
      case 'rest':       return <RestSection />
      case 'nodejs':     return <NodeSection />
      case 'live':       return <LiveDemoSection />
      case 'reference':  return <ReferenceSection />
      default:           return <QuickStartSection />
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hero */}
      <div className="flex-shrink-0 px-8 py-5 flex-shrink-0" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)' }}>
            <Code2 size={20} style={{ color: '#818cf8' }} />
          </div>
          <div>
            <h1 className="text-lg font-black" style={{ color: '#0f172a' }}>Prisma AIRS Integration Guide</h1>
            <p className="text-[12px]" style={{ color: '#64748b' }}>Everything your team needs to add AI Runtime Security to any application</p>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {[
              { label: 'Python SDK', val: 'pan-aisecurity', color: '#3b82f6' },
              { label: 'Endpoint', val: '/v1/scan/sync/request', color: '#10b981' },
              { label: 'Auth', val: 'x-pan-token', color: '#f59e0b' },
            ].map(b => (
              <div key={b.label} className="text-right">
                <div className="text-[9px] text-slate-600 uppercase tracking-wider">{b.label}</div>
                <code className="text-[11px] font-mono" style={{ color: b.color }}>{b.val}</code>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body: left nav + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left nav */}
        <div className="flex-shrink-0 w-48 overflow-y-auto py-4 px-2" style={{ background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>
          {SECTIONS.map(s => {
            const Icon = s.icon
            const isActive = activeSection === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1 transition-all text-left"
                style={isActive
                  ? { background: `${s.color}15`, border: `1px solid ${s.color}35` }
                  : { border: '1px solid transparent' }
                }
              >
                <Icon size={14} style={{ color: isActive ? s.color : '#475569', flexShrink: 0 }} />
                <span className="text-[12px] font-semibold" style={{ color: isActive ? s.color : '#64748b' }}>
                  {s.label}
                </span>
                {isActive && <ChevronRight size={10} style={{ color: s.color, marginLeft: 'auto' }} />}
              </button>
            )
          })}
        </div>

        {/* Content pane */}
        <div className="flex-1 overflow-y-auto p-8" style={{ background: '#ffffff' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
