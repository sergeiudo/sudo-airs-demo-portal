import { useCallback, useEffect, useState } from 'react'
import { SIGNAL } from '../api-intercept-2027/tokens'

/**
 * scanModel.js — everything the model-scanning console knows about a scan,
 * kept out of the components so each one reads the same shapes.
 *
 * Every field name below was read off real `/scan-model` responses, not the
 * SDK docs: `eval_outcome`, `eval_summary`, `security_group_name`,
 * `model_formats`, `total_files_scanned`, and a `violations[]` whose entries
 * carry `rule_instance_uuid`, `threat` (a `PAIT-…` code or a policy tag),
 * `file`, `hash`, `remediation.steps`, `threat_kb_url` and `insights_url`.
 */

/**
 * The curated library. The expected verdicts were MEASURED against the
 * personal tenant's `Default HUGGING_FACE` security group on 2026-09-25 — the
 * previous "Clean Demo" (`google/flan-t5-small`) had silently become a policy
 * block when that group's approved-format list tightened, and the view went on
 * labelling it SAFE. The scan is the source of truth; these labels are a
 * prediction, and the library says so on screen.
 */
export const LIBRARY = [
  {
    id: 'clean',
    uri: 'google/timesfm-2.5-200m-pytorch',
    title: 'Clean model',
    kind: 'clean',
    story: 'Approved publisher, Apache-2.0, safetensors only. The control case — it should pass every rule.',
    expect: 'ALLOWED',
    measured: '11 of 11 rules passed',
  },
  {
    id: 'malware',
    uri: 'opendiffusion/sentimentcheck',
    title: 'Code execution on load',
    kind: 'threat',
    story: 'A Keras model whose metadata calls exec, os and requests the moment it is loaded.',
    expect: 'BLOCKED',
    measured: '7 of 11 rules failed',
  },
  {
    id: 'format',
    uri: 'google/flan-t5-small',
    title: 'Unapproved file formats',
    kind: 'policy',
    story: 'A trusted publisher and no malware — but it ships pickle-based PyTorch .bin and Keras .h5 weights.',
    expect: 'BLOCKED',
    measured: '1 of 11 rules failed',
  },
  {
    id: 'org',
    uri: 'HuggingFaceTB/SmolLM2-135M',
    title: 'Publisher not approved',
    kind: 'policy',
    story: 'Clean safetensors from an organisation this security group has not approved.',
    expect: 'BLOCKED',
    measured: '1 of 11 rules failed',
  },

  // ── From insights-db.paloaltonetworks.com — Palo Alto's public verdicts on
  //    Hugging Face models. Its "Safe" means no threat was found; your security
  //    group ALSO enforces license, publisher and format policy, so a model can
  //    be Safe there and Blocked here. Both halves of that were measured on
  //    2026-09-25 and it is the most useful distinction in the pillar.
  {
    id: 'ins-picklebomb',
    group: 'insights',
    insights: 'Unsafe',
    uri: 'drhyrum/bert-tiny-torch-picklebomb',
    title: 'Pickle bomb in PyTorch weights',
    kind: 'threat',
    story: 'A tiny BERT whose PyTorch checkpoint carries a pickle payload that runs on torch.load().',
    expect: 'BLOCKED',
    measured: '3 of 11 failed · PAIT-PKL-100',
  },
  {
    id: 'ins-distilbert',
    group: 'insights',
    insights: 'Unsafe',
    uri: 'lxyuan/distilbert-base-multilingual-cased-sentiments-student',
    title: 'A popular-looking model, flagged',
    kind: 'threat',
    story: 'A widely used sentiment model with a PyTorch load-time threat — reputation is not a scan.',
    expect: 'BLOCKED',
    measured: '3 of 11 failed · PAIT-PYTCH-100',
  },
  {
    id: 'ins-minilm',
    group: 'insights',
    insights: 'Safe',
    uri: 'sentence-transformers/all-MiniLM-L6-v2',
    title: 'Safe on Insights DB, blocked by you',
    kind: 'policy',
    story: 'No threats at all — yet your group blocks it: unapproved publisher and pickle-based formats.',
    expect: 'BLOCKED',
    measured: '2 of 11 failed · no threats',
  },
  {
    id: 'ins-clip',
    group: 'insights',
    insights: 'Safe',
    uri: 'openai/clip-vit-base-patch32',
    title: 'No license on file',
    kind: 'policy',
    story: 'A famous publisher and no threats, but the repo declares no license your group can approve.',
    expect: 'BLOCKED',
    measured: '3 of 11 failed · no threats',
  },
]

export const INSIGHTS_URL = 'https://insights-db.paloaltonetworks.com/'

export const KIND_TONE = { clean: SIGNAL.pass, threat: SIGNAL.block, policy: SIGNAL.warn }

/**
 * `org/model`, a huggingface.co URL, or a URL into a file or branch — all
 * reduced to the repo id the scanner accepts. Validation mirrors the backend's
 * `HF_SHORT_PATTERN`, so a bad id is caught before a round trip rather than
 * coming back as a 400.
 */
export function normalizeHfUri(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return { ok: false, id: '', error: null }
  const path = raw.replace(/^https?:\/\/(www\.)?huggingface\.co\//i, '').replace(/[?#].*$/, '')
  const segs = path.split('/').filter(Boolean)
  const id = segs.slice(0, 2).join('/')
  if (segs.length < 2 || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(id)) {
    return { ok: false, id, error: 'Expected org/model-name or a huggingface.co URL' }
  }
  return { ok: true, id, error: null }
}

export function scanVerdict(rec) {
  if (!rec) return 'idle'
  if (rec.status === 'scanning') return 'scanning'
  if (rec.status === 'error') return 'error'
  const o = String(rec.result?.eval_outcome ?? '').toUpperCase()
  if (o.includes('BLOCK')) return 'blocked'
  if (o.includes('ALLOW') || o.includes('PASS')) return 'allowed'
  // ERROR / PENDING / anything new. The previous view read every non-ALLOW
  // outcome as "Model Blocked", which turned a failed scan into a verdict.
  return 'error'
}

export const SCAN_META = {
  allowed:  { label: 'ALLOWED',  color: SIGNAL.pass,  note: 'cleared every rule in the security group' },
  blocked:  { label: 'BLOCKED',  color: SIGNAL.block, note: 'stopped before the model could load' },
  scanning: { label: 'SCANNING', color: SIGNAL.live,  note: 'waiting for Prisma AIRS Model Security' },
  error:    { label: 'FAULT',    color: SIGNAL.warn,  note: 'the scan did not complete' },
  idle:     { label: 'STANDBY',  color: SIGNAL.idle,  note: '' },
}

export function ruleCounts(result) {
  const s = result?.eval_summary ?? {}
  const r = result?.rules_summary ?? {}
  const total = s.total_rules ?? r.total ?? 0
  const passed = s.rules_passed ?? r.passed ?? 0
  const failed = s.rules_failed ?? r.failed ?? 0
  return { total, passed, failed }
}

/** A PAIT code is a detected threat; everything else is a policy rule. */
export function violationKind(v) {
  if (/^PAIT-/i.test(v?.threat ?? '')) return 'threat'
  if (/code execution|suspicious|backdoor|malware/i.test(v?.rule_name ?? '')) return 'threat'
  return 'policy'
}

/**
 * Violations grouped by the rule that produced them.
 *
 * The API returns one entry per *finding*, so a single rule firing on six
 * operators arrives as six cards — the malicious demo showed "13 BLOCKING"
 * beside "7 / 11 rules failed", and the two numbers looked like they
 * disagreed. Grouped, they agree: seven rules, thirteen findings.
 */
export function groupViolations(violations = []) {
  const map = new Map()
  for (const v of violations) {
    const key = v.rule_instance_uuid || v.rule_name || 'rule'
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: v.rule_name || 'Unnamed rule',
        description: v.rule_description,
        state: String(v.rule_instance_state || 'OTHER').toUpperCase(),
        origin: v.rule_origin,
        kind: violationKind(v),
        threat: v.threat && v.threat !== 'UNAPPROVED_FORMATS' ? v.threat : null,
        kbUrl: v.threat_kb_url,
        insightsUrl: v.insights_url,
        remediation: v.remediation,
        items: [],
      })
    }
    map.get(key).items.push(v)
  }
  const rank = (g) => (g.kind === 'threat' ? 0 : 1) * 10 + (g.state === 'BLOCKING' ? 0 : 1)
  return [...map.values()].sort((a, b) => rank(a) - rank(b))
}

/**
 * What a threat finding actually found, as short chips: `exec`, `os`,
 * `Lambda layer`, `custom layer __main__`. The description strings are the
 * only place PA names them.
 */
export function threatSignals(items = []) {
  const seen = new Map()
  for (const v of items) {
    const d = String(v.description ?? '')
    let m
    // Hugging Face findings name operators bare (`operator exec from module
    // keras`); local-scan findings wrap them in backticks. Accept both.
    if ((m = d.match(/operator\s+`?([^\s`]+)`?\s+from module\s+`?([\w.]+)`?/i))) seen.set(m[1], { label: m[1], module: m[2] })
    else if ((m = d.match(/contains\s+(\w+)\s+layer from module\s+([\w.]+)/i))) seen.set(`${m[1]} layer`, { label: `${m[1]} layer`, module: m[2] })
    else if ((m = d.match(/custom layer:\s*(\S+?)\.?$/i))) seen.set(`custom ${m[1]}`, { label: `custom layer ${m[1]}`, module: null })
  }
  return [...seen.values()]
}

/** Formats a format-rule violation names as unapproved. */
export function unapprovedFormats(violations = []) {
  const out = new Set()
  for (const v of violations) {
    const m = String(v.description ?? '').match(/unapproved format:\s*\*\*(.+?)\*\*/i)
    if (m) out.add(m[1])
  }
  return out
}

/** Every file that carries a finding, with its hash and the rules that hit it. */
export function filesWithFindings(violations = []) {
  const map = new Map()
  for (const v of violations) {
    if (!v.file) continue
    if (!map.has(v.file)) map.set(v.file, { file: v.file, hash: v.hash, rules: new Set(), count: 0, threat: false })
    const f = map.get(v.file)
    f.rules.add(v.rule_name)
    f.count++
    if (violationKind(v) === 'threat') f.threat = true
  }
  return [...map.values()].sort((a, b) => Number(b.threat) - Number(a.threat) || b.count - a.count)
}

/**
 * A local upload is scanned from a temp copy (`tmpn0yndlpr.pkl`), and that is
 * the name every finding carries. The findings stay verbatim — they are
 * evidence — but the UI says which upload the temp name stands for.
 */
export const isTempCopy = (file) => /^tmp[\w-]{6,}\.[\w.]+$/.test(String(file ?? '').split('/').pop())

/** `https://huggingface.co/google/flan-t5-small` → { org, name, id } */
export function parseTarget(rec) {
  const r = rec?.result
  if (rec?.source === 'local') return { org: null, name: r?.original_filename ?? rec?.target, id: rec?.target }
  const id = String(r?.model_uri ?? rec?.target ?? '').replace(/^https?:\/\/huggingface\.co\//, '')
  const [org, ...rest] = id.split('/')
  return { org: rest.length ? org : null, name: rest.join('/') || id, id }
}

/**
 * Deep link into the scan's own tenant. `tsg_id` comes from the response, not
 * a constant — the scanner authenticates against whatever TSG is in `.env`,
 * and a link without it opens whichever tenant the browser last used and
 * shows an empty scan list, the same trap the runtime pillar hit.
 */
export function scmScanUrl(result) {
  if (!result?.uuid) return null
  const tsg = result.tsg_id ? `?tsg_id=${encodeURIComponent(result.tsg_id)}` : ''
  return `https://stratacloudmanager.paloaltonetworks.com/ai-security/model-security/scans/${result.uuid}/overview${tsg}#timeRange%5Bvalue%5D=past-30-days`
}

/**
 * A scan from the SCM history, as a console record. The detail route returns
 * the same shape as POST /scan-model, so every renderer works unchanged.
 */
export function recordFromScm(result) {
  const hf = result.scan_source === 'huggingface'
  const uri = String(result.model_uri ?? '')
  return {
    id: `scm-${result.uuid}`,
    source: hf ? 'huggingface' : 'local',
    target: hf ? uri.replace(/^https?:\/\/huggingface\.co\//, '') : uri.split(/[\\/]/).pop(),
    preset: null,
    size: null,
    startedAt: Date.parse(result.created_at) || Date.now(),
    status: 'done',
    result,
    fromScm: true,
  }
}

/** A list row's display name — `org/model`, or a local file's basename. */
export function scanDisplayName(scan) {
  const uri = String(scan?.model_uri ?? '')
  return scan?.source_type === 'HUGGING_FACE'
    ? uri.replace(/^https?:\/\/huggingface\.co\//, '')
    : uri.split(/[\\/]/).pop()
}

export function relTime(iso) {
  const t = Date.parse(iso)
  if (!t) return ''
  const s = (Date.now() - t) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/**
 * SCM pages. The model-scans list path is the scan-detail path the console
 * already deep-links to, minus the scan id. AI Skill Security has no
 * documented deep link, so it opens the tenant and the panel names the menu
 * path from the docs instead.
 */
export const scmModelScansUrl = (tsg) =>
  `https://stratacloudmanager.paloaltonetworks.com/ai-security/model-security/scans${tsg ? `?tsg_id=${encodeURIComponent(tsg)}` : ''}`
export const scmHomeUrl = (tsg) =>
  `https://stratacloudmanager.paloaltonetworks.com/${tsg ? `?tsg_id=${encodeURIComponent(tsg)}` : ''}`

export function fmtBytes(n) {
  if (n == null) return null
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

export const isLocalHost = () =>
  typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)

/**
 * Why a scan could not run, and the exact fix — host-aware, like the runtime
 * console's FaultNotice. The scanner is a laptop-only process (`npm run dev`
 * starts it; PM2 on EC2 does not), so on a deployed host the honest remedy is
 * "not deployed here", not a command that would do nothing.
 */
export function scanFault({ status, message, health } = {}) {
  const msg = String(message ?? '')
  const local = isLocalHost()
  const notDeployed = {
    why: 'Model scanning is not deployed on this host — the scanner (port 8001) only runs under `npm run dev` on the laptop.',
    cmd: null,
    after: null,
  }

  if (status === 503 || /not configured/i.test(msg) || health === 'stub') {
    return {
      title: 'Scanner is running in stub mode',
      ...(local
        ? {
            why: 'The scanner started without Model Security credentials or without the SDK, so it answers every scan with 503.',
            cmd: 'bash setup-scanner.sh',
            after: 'Then restart `npm run dev` — the scanner checks its credentials once, at start.',
          }
        : notDeployed),
    }
  }
  if (status === 0 || status === 502 || status === 504 || /failed to fetch|ECONNREFUSED|NetworkError/i.test(msg) || health === 'offline') {
    return {
      title: 'Scanner is not reachable',
      ...(local
        ? {
            why: 'Nothing answered on port 8001. Running Vite on its own leaves /scan-model with nothing behind it.',
            cmd: 'npm run dev',
            after: 'It starts all four processes. If it still fails, clear stale ports first (see CLAUDE.md → Commands).',
          }
        : notDeployed),
    }
  }
  // First scan of a repo AIRS has not indexed yet: it fetches the files
  // asynchronously and refuses the scan until they land. Measured on two
  // insights-db repos — not a failure, just not ready.
  if (/pending scan data retrieval/i.test(msg)) {
    return {
      title: 'AIRS is still fetching this repo',
      why: 'The first scan of a repository triggers Prisma AIRS to retrieve its files, and the scan is refused until they are in. Nothing is wrong with the model or the portal.',
      cmd: null,
      after: 'Scan it again in a few minutes — larger repos take longer.',
    }
  }
  if (status === 400 || status === 422) return { title: 'The scan request was rejected', why: null, cmd: null, after: null }
  return { title: 'The scan did not complete', why: null, cmd: null, after: null }
}

/**
 * Scanner health, re-checked while it is down.
 *
 * `npm run dev` boots Vite in a second and the Python scanner in several, so a
 * one-shot check on mount reported OFFLINE for a scanner that came up moments
 * later and stayed wrong until a reload. `state` distinguishes a stub (running
 * but unconfigured — it answers `/` with 200 too) from a process that is down.
 */
export function useScannerHealth() {
  const [health, setHealth] = useState({ state: 'checking', reason: null })

  const check = useCallback(async () => {
    try {
      const d = await fetch('/api/scanner/health').then((r) => r.json())
      const state = !d.running ? 'offline' : d.configured === false ? 'stub' : 'live'
      setHealth({ state, reason: d.reason ?? null })
      return state
    } catch {
      setHealth({ state: 'offline', reason: null })
      return 'offline'
    }
  }, [])

  useEffect(() => {
    let live = true
    let id
    const loop = async () => {
      const s = await check()
      if (live && s !== 'live') id = setTimeout(loop, 8000)
    }
    loop()
    return () => { live = false; clearTimeout(id) }
  }, [check])

  return { ...health, recheck: () => { setHealth((h) => ({ ...h, state: 'checking' })); check() } }
}
