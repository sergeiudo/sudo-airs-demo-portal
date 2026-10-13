import {
  BookOpen, Target, ShieldAlert, Siren, Layers, Gauge, MessagesSquare, Trophy, Radar, Handshake, ListChecks, Calculator, Library,
  Waypoints, ShieldCheck, Fingerprint, Network, ScanSearch, Boxes, Swords, Laptop, Globe,
} from 'lucide-react'

/**
 * content.js — the AI-GW vs LiteLLM pillar, as data.
 *
 * Built from the competitive brief "AIRS AI Gateway and LiteLLM" (October
 * 2026, gateway.airs-demo.com/competitive/litellm — the seller's web page,
 * which carries the objections and the "cheap gateway" guidance its customer
 * PDF hides), then every claim was traced to its primary source on AS_OF:
 * OSV.dev, PyPI, npm, LiteLLM's own docs and Helm chart, the AI Gateway docs
 * this portal indexes. Where the brief and the source disagree, the source
 * wins and CLAIMS says so — a seller caught on one stale number loses the
 * room, so the brief's figures are never shown without their status.
 *
 * Inline markup: **bold**, `code`, [text](url) — rendered by Blocks' Inline
 * as React nodes, never as HTML.
 */

export const AS_OF = '2026-10-13'
export const BRIEF = {
  title: 'AIRS AI Gateway and LiteLLM',
  subtitle: 'Security record, platform scope and gateway architecture',
  date: 'October 2026',
  snapshot: '2026-08-28',
  url: 'https://gateway.airs-demo.com/competitive/litellm/',
}

// Identity colours for the two sides: the AI-GW pink the rest of the portal
// uses, and cyan for LiteLLM. Never vermilion — in this portal it means "AIRS
// intercepted something", not "the rival". The pair passes the dataviz
// validator in both themes (worst CVD ΔE 8.1, protan); slate, the first
// choice, failed it (ΔE 2.5 against the pink, and it reads as grey).
export const SIDE = {
  airs: { label: 'AIRS AI Gateway', short: 'AIRS AI-GW', tone: '#EC4899' },
  litellm: { label: 'LiteLLM', short: 'LiteLLM', tone: '#0891B2' },
}

// ─── the rail ────────────────────────────────────────────────────────────────
export const GROUPS = [
  { id: 'brief', title: 'The brief', sub: 'Three questions, in the brief\'s order', tone: '#B7862F', icon: BookOpen },
  { id: 'sell', title: 'Sell it', sub: 'Objections, concessions, discovery, the land play', tone: '#8B5CF6', icon: MessagesSquare },
  { id: 'proof', title: 'Proof', sub: 'Every claim traced, the math, the sources', tone: '#2E9E7B', icon: ListChecks },
]

export const SECTIONS = [
  { id: 'overview', group: 'brief', icon: Target, title: 'At a glance', sub: 'Where AI-GW is better — one page' },
  { id: 'questions', group: 'brief', icon: BookOpen, title: 'The three questions', sub: 'How to open: safety first, not features' },
  { id: 'safe', group: 'brief', icon: ShieldAlert, title: '01 · Safe in the request path', sub: 'CVEs, dependency surface, exposure' },
  { id: 'compromise', group: 'brief', icon: Siren, title: 'The March 2026 compromise', sub: 'Unpinned scanner to malicious PyPI release' },
  { id: 'scope', group: 'brief', icon: Layers, title: '02 · What else it secures', sub: 'Nine control points, one policy' },
  { id: 'production', group: 'brief', icon: Gauge, title: '03 · In production', sub: '13 rows: architecture, performance, features' },
  { id: 'objections', group: 'sell', icon: MessagesSquare, title: 'Objections you will hear', sub: 'Each with its follow-up question' },
  { id: 'strengths', group: 'sell', icon: Trophy, title: 'Where LiteLLM is strong', sub: 'Concede early, then the cheap-gateway test' },
  { id: 'discovery', group: 'sell', icon: Radar, title: 'Discovery questions', sub: 'What to ask, and the question to leave' },
  { id: 'coexist', group: 'sell', icon: Handshake, title: 'Already on LiteLLM?', sub: 'Land Prisma AIRS inside it today' },
  { id: 'claims', group: 'proof', icon: ListChecks, title: 'Claim check', sub: 'Every number in the brief, traced' },
  { id: 'math', group: 'proof', icon: Calculator, title: 'Do the math', sub: 'Tail latency and Postgres connections' },
  { id: 'sources', group: 'proof', icon: Library, title: 'Sources', sub: 'Primary sources, each opened on ' + AS_OF },
]

// ─── claim check ─────────────────────────────────────────────────────────────
// key → theme token: pass (holds), warn (needs care), idle (not checked here).
export const STATUS = {
  verified:   { label: 'Verified', key: 'pass', note: 'Matches the primary source today.' },
  reproduced: { label: 'Reproduced', key: 'pass', note: 'Reproduced for the brief\'s snapshot; today\'s figure differs.' },
  consistent: { label: 'Consistent', key: 'pass', note: 'Primary sources agree with the brief.' },
  close:      { label: 'Close', key: 'pass', note: 'Re-measured here; same order of magnitude.' },
  selective:  { label: 'Selective', key: 'warn', note: 'True as quoted, but the same source shows a better number.' },
  overstated: { label: 'Overstated', key: 'warn', note: 'Partly true; say it more narrowly.' },
  outdated:   { label: 'Out of date', key: 'warn', note: 'The competitor has changed since the brief.' },
  field:      { label: 'Field note', key: 'warn', note: 'Documented, but behaves differently on the SCM tenant.' },
  brief:      { label: 'Not checked here', key: 'idle', note: 'From the brief\'s cited source; quote it with that source.' },
  vendor:     { label: 'Vendor figure', key: 'idle', note: 'Our own claim; not in the indexed docs, not measured here.' },
}

export const CLAIMS = [
  {
    id: 'cves', status: 'reproduced', section: 'safe', side: 'litellm',
    claim: '27 CVEs filed against LiteLLM since April 2024: 5 critical, 16 high, 13 of them this year.',
    finding: [
      'OSV reproduces the brief\'s 27 / 5 / 16 / 13 for its 2026-08-28 snapshot once two sets are left out: nine low and moderate CVEs dated 2026-06-21, whose PyPI advisories were only added on 2026-10-01 (most likely not in OSV yet when the brief was counted), and CVE-2026-37004 (critical, 2026-08-27).',
      'On ' + AS_OF + ' OSV lists **39 unique CVEs: 6 critical, 16 high, 25 of them in 2026**, plus advisories without a CVE (the two malware records among them). The brief now understates the record. Quote the live count in the right-hand pane, with its date.',
    ],
    sources: ['osvLitellm'],
  },
  {
    id: 'gwAdvisory', status: 'verified', section: 'safe', side: 'airs',
    claim: 'The AIRS AI Gateway core has one advisory in the same period.',
    finding: [
      'One: **CVE-2025-66405** (GHSA-hhh5-2cvx-vmfp, moderate), server-side request forgery through the `x-portkey-custom-host` header, fixed in 1.14.0. Show it rather than hide it — "one, moderate, fixed" is a stronger line than "none".',
    ],
    sources: ['osvGateway'],
  },
  {
    id: 'packages', status: 'close', section: 'safe', side: 'litellm',
    claim: 'pip install litellm[proxy] resolves 107 packages from 88 declared ones.',
    finding: [
      'Re-resolved here on ' + AS_OF + ' (pip 26.2.1, a metadata-only dry run — nothing installed, no package code run) for `litellm[proxy]==1.98.0`: **111 packages** on macOS arm64 with Python 3.12 and with 3.13. The count moves with platform and with the transitive versions current on the day; the order of magnitude does not.',
      '"88 declared" is litellm 1.98.0\'s whole requirement list, every optional extra included. The proxy needs **45** of them directly (14 base + 31 for the `proxy` extra). Say "over a hundred packages" and you are safe on any platform.',
    ],
    sources: ['pypiLitellm'],
  },
  {
    id: 'deps15', status: 'verified', section: 'safe', side: 'airs',
    claim: 'The AIRS AI Gateway core declares 15 dependencies. TypeScript on Hono.',
    finding: [
      '`@portkey-ai/gateway` 1.15.2 (2026-01-12) declares 15 runtime dependencies, `hono` among them — 15 since 1.14. This is the open-source core on npm, the package the brief names. It is not a statement about the AIRS data-plane image (the `airs-gw` Helm chart, gateway 2.x): this check covers the npm package only.',
    ],
    sources: ['npmGateway', 'ghGateway'],
  },
  {
    id: 'exposure', status: 'brief', section: 'safe', side: 'litellm',
    claim: '2,500+ organisations exposed in the campaign; 153 GB of stolen credentials surfaced in August; two alleged TeamPCP members arrested on 2026-08-27.',
    finding: ['From Hudson Rock via Help Net Security, and Hackread (2026-08-13 and 08-27), as the brief cites them. Not independently checked here — quote the figures with their source.'],
    sources: [],
  },
  {
    id: 'timeline', status: 'consistent', section: 'compromise', side: 'litellm',
    claim: 'On 2026-03-24 litellm 1.82.7 (10:39 UTC) and 1.82.8 (10:52) were published with LiteLLM\'s real credentials; PyPI quarantined the project about three hours later.',
    finding: [
      'OSV\'s MAL-2026-2144 (published 11:15 UTC, from OpenSSF Package Analysis) and PYSEC-2026-2 (15:35 UTC) name exactly 1.82.7 and 1.82.8. Both versions are gone from PyPI today; the next release is 1.83.0, on 2026-03-31. The upload minutes and the quarantine time come from the brief — PyPI no longer lists the files.',
    ],
    sources: ['osvMalware', 'pypiLitellm', 'litellmBlog'],
  },
  {
    id: 'trivy', status: 'consistent', section: 'compromise', side: 'litellm',
    claim: 'An unpinned Trivy scanner in LiteLLM\'s CI leaked its PyPI publishing token.',
    finding: [
      'GHSA-5mg7-485q-xm76 (critical) opens with "After an API Token exposure from an exploited trivy dependency…". The Trivy side is on record as GHSA-69fq-xp46-6x23 / CVE-2026-33634, "Trivy ecosystem supply chain was briefly compromised" (2026-03-24).',
    ],
    sources: ['osvMalware', 'osvTrivy', 'wizTeampcp'],
  },
  {
    id: 'namedCves', status: 'verified', section: 'scope', side: 'litellm',
    claim: 'CVE-2026-40217 escaped the custom-guardrail sandbox; CVE-2026-59821 bypassed its safety checks; CVE-2026-42271 allowed command execution through MCP stdio test endpoints; CVE-2026-59822 bypassed MCP authentication.',
    finding: [
      'All four exist and say what the brief says. Severities as rated: 40217 **high**, 42271 **high**, 59822 **high** — and 59821 **low**. Don\'t inflate the last one.',
    ],
    sources: ['osv40217', 'osv42271', 'osv59821', 'osv59822'],
  },
  {
    id: 'pace', status: 'verified', section: 'strengths', side: 'litellm',
    claim: 'New releases most days.',
    finding: ['PyPI on ' + AS_OF + ': 47–48 releases in the last 30 days, on 54 of the last 90 days (live in the right-hand pane). It is a strength and a patching load at the same time.'],
    sources: ['pypiLitellm'],
  },
  {
    id: 'latency', status: 'selective', section: 'production', side: 'litellm',
    claim: 'LiteLLM adds 12 ms median, 29 ms at p95 and 43 ms at p99 in its own published benchmark.',
    finding: [
      'Those are the **2-instance** column of LiteLLM\'s short-prompt test (1,035.7 requests per second). The same table\'s **4-instance** column — LiteLLM\'s headline, "1,170 requests per second with 8 ms p95 gateway overhead" — is **2 ms p50, 8 ms p95, 13 ms p99**: lower than the brief\'s own AIRS figure of 15–20 ms at p99.',
      'A LiteLLM seller will show that page. Don\'t lead with latency; if it comes up, ask how many instances, at what load and with which features on — their 3,000 RPS run used 33 pods of 4 vCPU and 16 GiB each.',
    ],
    sources: ['llBenchmarks'],
  },
  {
    id: 'airsLatency', status: 'vendor', section: 'production', side: 'airs',
    claim: 'AIRS AI Gateway adds under 1 ms at p50 and 15–20 ms at p99.',
    finding: ['The brief\'s figure. It is not in the AI Gateway docs this portal indexes, and this portal does not measure it (the SaaS gateway sits behind a network hop).'],
    sources: [],
  },
  {
    id: 'workers', status: 'verified', section: 'production', side: 'litellm',
    claim: 'LiteLLM\'s docs recommend one worker per pod.',
    finding: ['The production guide: "run one Uvicorn worker per pod and scale horizontally", with 1 vCPU and 4Gi per worker as a floor ("4Gi is a floor rather than a target").'],
    sources: ['llProd'],
  },
  {
    id: 'pgConnections', status: 'verified', section: 'production', side: 'litellm',
    claim: 'The Helm chart\'s default maxReplicas: 100 with a pool of 10 asks Postgres for about 1,000 connections; the production guide warns about it.',
    finding: [
      'The production guide says it in nearly those words: "The litellm-helm chart defaults autoscaling.maxReplicas and keda.maxReplicas to 100, so a deployment that scales out fully asks for roughly 1000 connections at the default pool limit of 10."',
      'Since the brief, the chart has gained an optional in-pod PgBouncer (`db.connectionPool`, **off by default**, 20 upstream connections per pod when on). Autoscaling itself is off by default too — the 100 is the ceiling it scales to once enabled.',
    ],
    sources: ['llProd', 'llHelm'],
  },
  {
    id: 'semantic', status: 'outdated', section: 'production', side: 'litellm',
    claim: 'LiteLLM\'s routing docs list no semantic routing or ensemble.',
    finding: [
      'Semantic routing: **out of date.** LiteLLM\'s "[Beta] Auto Routing" — "complexity, semantic, and adaptive routing" — ships in v1.94.x (first dev release 2026-07-14); the older Semantic Auto Router is deprecated but still works.',
      'Ensemble: still holds — the word appears nowhere in the routing docs or LiteLLM\'s full docs index (`llms.txt`).',
    ],
    sources: ['llAutoRouting'],
  },
  {
    id: 'budget', status: 'outdated', section: 'production', side: 'litellm',
    claim: 'LiteLLM tracks budgets and spend. It does not fail over on budget.',
    finding: [
      '**Out of date.** LiteLLM\'s Budget Routing sets provider, deployment and tag budgets; the router "skips providers that have exceeded their budget" and raises an error only when all of them have.',
      'The distinction that holds is narrower: in the AIRS AI Gateway, budget is decided in the same policy check as identity, model access, guardrails and routing, and inherits down an org → department → team hierarchy (the brief).',
    ],
    sources: ['llBudget'],
  },
  {
    id: 'guardrailsPaid', status: 'overstated', section: 'scope', side: 'litellm',
    claim: 'LiteLLM\'s guardrail suite is a paid Enterprise feature.',
    finding: [
      'LiteLLM\'s open-source tier includes the guardrail framework, custom guardrails, Presidio PII masking and third-party providers — **Prisma AIRS among them**. Enterprise is needed for seven built-in moderation callbacks (`llmguard_moderations`, `llamaguard_moderations`, `hide_secrets`, `openai_moderations`, `google_text_moderation`, `lakera_prompt_injection`, `aporia_prompt_injection`) and for guardrails per key or team.',
      'Say "several built-in guardrails and per-team guardrails are Enterprise", not "the guardrail suite".',
    ],
    sources: ['llEnterprise'],
  },
  {
    id: 'sso', status: 'verified', section: 'production', side: 'litellm',
    claim: 'SSO is free up to five users, then Enterprise. SCIM, RBAC and audit logs are Enterprise too.',
    finding: ['"SSO is free for up to 5 users; beyond that, an Enterprise license is required." SSO and SCIM, audit logs, and org and team admins are listed under "What you get on top of open source".'],
    sources: ['llEnterprise'],
  },
  {
    id: 'prometheus', status: 'outdated', section: 'production', side: 'litellm',
    claim: 'Prometheus metrics and audit logs are Enterprise.',
    finding: ['Audit logs: Enterprise (verified). Prometheus: **out of date** — LiteLLM\'s Prometheus page has no Enterprise label today; a single batch-cost metric is marked "Enterprise only".'],
    sources: ['llPrometheus', 'llEnterprise'],
  },
  {
    id: 'support', status: 'consistent', section: 'production', side: 'litellm',
    claim: 'Support is GitHub issues unless you buy Enterprise.',
    finding: ['Enterprise adds a dedicated Slack or Teams channel, and optional 24/7 SLAs: 1 hour for Sev 0, **72 hours for security patches**. Open source is community support.'],
    sources: ['llEnterprise'],
  },
  {
    id: 'python', status: 'verified', section: 'production', side: 'litellm',
    claim: 'Python on uvicorn, plus PostgreSQL for keys and budgets.',
    finding: [
      'True of the proxy that ships today (`uvicorn`, `gunicorn` and `granian` are all in the resolved tree; Postgres holds keys and spend).',
      '**Watch:** LiteLLM\'s repository carries a componentized Rust gateway — `litellm-rust/`, Helm chart `helm/litellm` 0.1.0, image `ghcr.io/berriai/litellm-gateway` — which its README starts with `cargo run`. When it ships, the dependency argument weakens for the data path. The CVE record and March 2026 do not change.',
    ],
    sources: ['ghLitellmRust', 'llHelm'],
  },
  {
    id: 'statusCodes', status: 'field', section: 'production', side: 'airs',
    claim: 'A hard budget breach returns HTTP 412, a rate limit 429, a guardrail block 446 and a warn-only guardrail 246.',
    finding: [
      '446, 246 and 412 are all in the AI Gateway docs (Guardrails, Errors). On the SCM tenant this portal runs on, a guardrail block comes back as **HTTP 200** with the reply replaced and `hook_results…verdict: false` — the `soft_deny_200` behaviour added in gateway 2.14.0.',
      'If a prospect tests for a 446 on SCM, show them the hook verdict in AIRS Runtime & AI-GW\'s Prompt Telemetry.',
    ],
    sources: ['aigwErrors', 'aigwChangelog'],
    portal: 'apiIntercept',
  },
  {
    id: 'airsCatalog', status: 'vendor', section: 'production', side: 'airs',
    claim: '1,600+ models across 50+ providers; full logs kept for a year; 40+ metrics.',
    finding: ['The brief\'s figures for the AIRS AI Gateway. Not re-counted here.'],
    sources: [],
  },
]
export const CLAIM_BY_ID = Object.fromEntries(CLAIMS.map((c) => [c.id, c]))

// ─── at a glance — the landing ───────────────────────────────────────────────
// Only the points where the AIRS AI Gateway comes out ahead once the claim
// check is applied — short enough to read across a room. Where LiteLLM is
// stronger or even (breadth, time to first call, release pace, routing,
// latency) stays off this table and is named in one line under it. `litellm`
// may be a function of the live record, so the CVE count is today's.
export const GLANCE = {
  title: 'Where AIRS AI Gateway beats LiteLLM',
  sub: 'Both route LLM traffic. One is part of a security platform; the other is a Python proxy you run, patch and secure yourself.',
  score: [
    { label: 'CVEs on OSV', airs: (r) => r?.gateway?.cves ?? 1, litellm: (r) => r?.litellm?.cves ?? 39, note: (r) => `LiteLLM: ${r?.litellm?.bySeverity?.critical ?? 6} critical · read live from OSV`, claim: 'cves' },
    { label: 'Packages to run it', airs: () => 15, litellm: () => 111, note: () => 'gateway core vs litellm[proxy]', claim: 'packages' },
    { label: 'Control points secured', airs: () => 9, litellm: () => 1, note: () => 'one policy, one console', claim: null },
  ],
  groups: [
    {
      title: 'Safe in the request path',
      rows: [
        { topic: 'Security record', airs: 'One advisory in the gateway core — moderate, fixed', litellm: (r) => `${r?.litellm?.cves ?? 39} CVEs, ${r?.litellm?.bySeverity?.critical ?? 6} critical` },
        { topic: 'Supply chain', airs: 'No malicious release on record', litellm: 'Shipped credential-stealing malware on PyPI, March 2026' },
        { topic: 'What it runs on', airs: '15 dependencies, TypeScript on Hono', litellm: '100+ Python packages, plus Postgres' },
        { topic: 'Custom guardrails', airs: 'Run outside the gateway, over a webhook', litellm: 'Your Python inside the proxy — its sandbox was escaped' },
        { topic: 'MCP gateway', airs: 'Registry with tool-level access control', litellm: 'Auth-bypass and command-execution CVEs' },
      ],
    },
    {
      title: 'What else it secures',
      rows: [
        { topic: 'Coverage', airs: 'Nine control points under one policy and one console', litellm: 'One — the gateway' },
        { topic: 'Beyond the gateway', airs: 'Model scanning, red teaming, agent, endpoint and browser security', litellm: 'None — a separate product for each' },
      ],
    },
    {
      title: 'In production',
      rows: [
        { topic: 'Who runs it', airs: 'Control plane managed in Strata Cloud Manager; data plane in your VPC', litellm: 'You run and patch all of it — a release most days' },
        { topic: 'Policy', airs: 'Org → department → team → user, inherited', litellm: 'Keys and teams; no department level' },
        { topic: 'Scale', airs: 'Stateless — no database on the request path', litellm: 'Postgres on the path; the default chart can ask for ~1,000 connections' },
        { topic: 'Enterprise identity', airs: 'SSO, SCIM and role mapping through Strata Cloud Manager', litellm: 'SSO free for 5 users; SCIM, audit logs and admin roles are paid' },
        { topic: 'Support', airs: 'One Palo Alto Networks contract', litellm: 'Community, unless you buy Enterprise' },
      ],
    },
  ],
  concede: 'LiteLLM is stronger on provider breadth, time to first call and release pace, and even on routing — concede those. Don\'t lead with latency: its own four-instance benchmark beats our quoted p99.',
}

// ─── the customer overview — the pillar's front page ─────────────────────────
// The answer to "why AIRS AI Gateway and not LiteLLM?" for a customer, on one
// or two screens: three numbers drawn as marks (one dot per real CVE, one
// square per real package), one story, one checklist, one question. Only what
// survived the claim check — no latency, no routing, no "guardrails are paid".
// The CVE marks are read live; the rest was measured or verified on AS_OF.
export const PITCH = {
  eyebrow: 'Why AIRS AI Gateway · vs LiteLLM',
  title: 'Both route your AI traffic. Only one is built to be trusted with it.',
  sub: 'An AI gateway sits in front of every agent, every model and every provider key. If it is compromised, so is everything behind it — so the first question is not features. It is whether it is safe to put there.',
  sides: {
    airs: 'Part of the Prisma AIRS security platform',
    litellm: 'An open-source Python proxy you run, patch and secure yourself',
  },
  reasons: {
    safe: {
      n: '01', eyebrow: 'Safe in the request path', unit: 'CVEs on record',
      take: 'And in March 2026 LiteLLM published credential-stealing malware to PyPI — under its own name.',
      foot: 'Every dot is one CVE, live from OSV.dev',
      // Shown only when OSV cannot be reached — OSV on AS_OF, by severity.
      snapshot: { litellm: { critical: 6, high: 16, moderate: 8, low: 9 }, gateway: { moderate: 1 } },
    },
    lean: {
      n: '02', eyebrow: 'Small by design', unit: 'packages it runs on',
      take: 'Every package is someone else\'s code in your request path. The size of that tree is an architecture decision, not bad luck.',
      foot: 'Every square is one package (npm · pip)',
    },
    broad: {
      n: '03', eyebrow: 'Secures more than the gateway', unit: 'AI control points',
      take: 'LiteLLM covers one of them: the gateway. Every other layer is another product to buy, run and patch.',
      foot: 'One policy, one console. Click one to see it live.',
    },
  },
  story: {
    eyebrow: 'March 2026',
    title: 'The day the gateway was the attack',
    sub: 'LiteLLM\'s own release pipeline, turned against everyone who installed it.',
    steps: [
      { when: 'Mar 19', title: 'Attackers poison Trivy', text: 'A security scanner LiteLLM\'s build pipeline ran unpinned.' },
      { when: 'Mar 24 · 10:39', title: 'litellm 1.82.7 goes live on PyPI', text: 'Published with LiteLLM\'s own stolen token. It looked like any release.', hot: true },
      { when: '13 min later', title: '1.82.8 follows', text: 'Runs a credential stealer every time Python starts.', hot: true },
      { when: '~3 hours later', title: 'PyPI quarantines the project', text: 'Harvested by then: SSH keys, cloud tokens, Kubernetes secrets.' },
      { when: 'August', title: '153 GB of stolen credentials surface', text: '2,500+ organisations exposed across the campaign (Hudson Rock).' },
    ],
    quote: 'Anyone who has installed and run the project should assume any credentials available to litellm environment may have been exposed.',
    quoteBy: 'PYSEC-2026-2, the official advisory',
    quoteSource: 'osvMalware',
  },
  ready: {
    title: 'Ready for enterprise production',
    sub: 'What a security team asks for on day one.',
    // mark: how LiteLLM's side reads — 'no' (missing) or 'paid' (Enterprise licence).
    rows: [
      { topic: 'Who runs it', airs: 'Managed control plane; prompts stay in your VPC', litellm: 'You run and patch all of it', mark: 'no' },
      { topic: 'SSO, SCIM, audit logs', airs: 'Built in (Strata Cloud Manager)', litellm: 'SSO free for 5 users, then paid', mark: 'paid' },
      { topic: 'Policy by department', airs: 'Org → department → team → user', litellm: 'Keys and teams only', mark: 'no' },
      { topic: 'Stateless at scale', airs: 'No database on the request path', litellm: 'Postgres on the request path', mark: 'no' },
      { topic: 'Custom guardrails', airs: 'Run outside the gateway (webhook)', litellm: 'Run inside the proxy — sandbox escaped', mark: 'no' },
      { topic: 'Support', airs: 'One Palo Alto Networks contract', litellm: 'Community, unless you pay', mark: 'paid' },
    ],
  },
  close: {
    eyebrow: 'The question that decides it',
    q: 'What happens to our company if your gateway is compromised — and what else do you secure?',
    note: 'Ask it of any AI gateway vendor.',
    fair: 'LiteLLM is excellent at provider breadth and a ten-minute start. The question is what you put in front of every agent.',
    already: 'Prisma AIRS plugs into it today, through LiteLLM\'s native guardrail. That protects the traffic — nothing in it protects LiteLLM itself.',
  },
}

// ─── the three questions (the brief's overview) ──────────────────────────────
export const OVERVIEW = {
  lead: 'LiteLLM is the most widely used open-source AI gateway. In March 2026 it also published credential-stealing malware to PyPI under its own name. **Lead with that, not with features:** a gateway sits in front of every agent and every provider key a customer has, so the first question is whether it is safe to put there.',
  customer: 'LiteLLM began as a Python SDK that wraps provider APIs, and grew a proxy server on top. Installing the proxy (`pip install litellm[proxy]`) pulls in over a hundred packages, and dozens of CVEs have been filed against it since April 2024. In March 2026 an attacker used a compromised scanner in LiteLLM\'s CI pipeline to steal its PyPI token and publish two malicious releases. An AI gateway sits in front of your coding agents, your enterprise agents and the data they reach. If the gateway is compromised, so is everything behind it.',
  questions: [
    { n: '01', q: 'Is it safe in the request path?', litellm: 'Dozens of CVEs since April 2024 — 39 on OSV today — and a malicious PyPI release in March 2026.', go: 'safe' },
    { n: '02', q: 'What else does it secure?', litellm: 'One of the nine control points Prisma AIRS runs under one policy: the gateway.', go: 'scope' },
    { n: '03', q: 'How does it hold up in production?', litellm: 'You patch it yourself, its own benchmark shows a 43 ms p99 at two instances, and SCIM and audit logs cost extra.', go: 'production' },
  ],
  closing: 'What happens to our company if your gateway is compromised, and what else do you secure?',
  howTo: [
    { icon: BookOpen, title: 'The brief, section by section', text: 'The three questions in the order to ask them — each claim with its source and its status from the claim check.', go: 'safe' },
    { icon: MessagesSquare, title: 'Sell it', text: 'Objections with follow-ups, what to concede, discovery questions, and the land play for a customer already on LiteLLM.', go: 'objections' },
    { icon: ListChecks, title: 'Before you quote a number', text: 'Five of the brief\'s claims are out of date, selective or overstated. The claim check says which, and what to say instead.', go: 'claims' },
  ],
}

// ─── 01 · safe in the request path ───────────────────────────────────────────
export const STATS = [
  { value: '27', live: 'cves', label: 'CVEs filed against LiteLLM', text: 'Since April 2024: 5 critical, 16 high, 13 of them this year (the brief, 2026-08-28). The AIRS AI Gateway core has one advisory in the same period.', source: 'OSV.dev · PyPI litellm, npm @portkey-ai/gateway', claim: 'cves' },
  { value: '107', label: 'Packages installed with the proxy', text: '`pip install litellm[proxy]` resolves 107 packages (the brief, litellm 1.98.0); 111 when re-resolved here. The AIRS AI Gateway core declares 15.', source: 'pip resolution report · litellm 1.98.0', claim: 'packages' },
  { value: '2,500+', label: 'Organisations exposed in the campaign', text: '153 GB of stolen credentials surfaced in August, traced to NVIDIA, Microsoft, Volkswagen, FedEx, Deloitte and others. Two alleged TeamPCP members were arrested on 2026-08-27.', source: 'Hudson Rock via Help Net Security · Hackread', claim: 'exposure' },
]

// The CVE classes that matter when the box holds every provider key. Every
// entry is an OSV record (severity as rated there), read on AS_OF.
export const CVE_CLASSES = [
  {
    title: 'Authentication bypass', why: 'Whoever gets past the gateway\'s auth reaches every provider key and every model behind it.',
    items: [
      ['CVE-2026-35030', 'critical', 'Authentication bypass via OIDC userinfo cache key collision'],
      ['CVE-2026-49468', 'critical', 'Authentication bypass via Host header injection'],
      ['CVE-2026-59822', 'high', 'MCP authentication bypass via OAuth2 passthrough fallback'],
      ['CVE-2026-12773', 'moderate', 'MCP proxy has improper authentication'],
    ],
  },
  {
    title: 'Code and command execution', why: 'Code running inside the proxy runs next to the keys, the prompts and the database credentials.',
    items: [
      ['CVE-2026-37004', 'critical', 'Server-side template injection in the /prompts/test endpoint'],
      ['CVE-2026-42271', 'high', 'Authenticated command execution via MCP stdio test endpoints'],
      ['CVE-2026-40217', 'high', 'Sandbox escape in the custom-code guardrail'],
      ['CVE-2024-5751', 'critical', 'Remote code execution through unsafe eval'],
    ],
  },
  {
    title: 'Credential and data exposure', why: 'The gateway is where the provider keys live; these leak them or the data behind them.',
    items: [
      ['CVE-2026-42208', 'critical', 'SQL injection in proxy API key verification'],
      ['CVE-2026-84377', 'moderate', 'Authenticated SSRF and provider-credential exfiltration'],
      ['CVE-2025-0330', 'high', 'Leakage of Langfuse API keys'],
      ['CVE-2024-9606', 'high', 'Portion of an API key revealed in a log file'],
    ],
  },
  {
    title: 'Privilege escalation', why: 'An ordinary user who can become an admin can mint keys and rewrite routing.',
    items: [
      ['CVE-2026-35029', 'high', 'Privilege escalation via the unrestricted proxy configuration endpoint'],
      ['CVE-2026-47102', 'high', 'A user can modify their own user_role via /user/update'],
      ['CVE-2026-47101', 'high', 'An internal_user can create API keys for routes their role does not permit'],
    ],
  },
]

// The open-source gateway core's declared runtime dependencies (npm, 1.15.2).
export const GATEWAY_DEPS = ['@aws-crypto/sha256-js', '@cfworker/json-schema', '@hono/node-server', '@hono/node-ws', '@portkey-ai/mustache', '@smithy/signature-v4', '@types/mustache', 'async-retry', 'avsc', 'hono', 'ioredis', 'jose', 'patch-package', 'ws', 'zod']

// litellm[proxy]==1.98.0 resolved here on AS_OF — pip 26.2.1, Python 3.12,
// macOS arm64, `pip install --dry-run --only-binary=:all: --report`.
export const RESOLVED = {
  spec: 'litellm[proxy]==1.98.0', pip: '26.2.1', python: '3.12 and 3.13', platform: 'macOS arm64',
  packages: ['aiohappyeyeballs', 'aiohttp', 'aiosignal', 'annotated-doc', 'annotated-types', 'anyio', 'apscheduler', 'attrs', 'azure-core', 'azure-identity', 'azure-storage-blob', 'backoff', 'boto3', 'botocore', 'certifi', 'cffi', 'charset-normalizer', 'click', 'croniter', 'cryptography', 'distro', 'dnspython', 'email-validator', 'expression', 'fastapi', 'fastapi-sso', 'fastuuid', 'filelock', 'frozenlist', 'fsspec', 'granian', 'gunicorn', 'h11', 'hf-xet', 'hiredis', 'httpcore', 'httpcore2', 'httpx', 'httpx-sse', 'httpx2', 'huggingface_hub', 'idna', 'importlib_metadata', 'inquirerpy', 'isodate', 'jinja2', 'jiter', 'jmespath', 'jsonschema', 'jsonschema-specifications', 'litellm', 'litellm-enterprise', 'litellm-proxy-extras', 'markdown-it-py', 'markupsafe', 'mcp', 'mdurl', 'msal', 'msal-extensions', 'multidict', 'numpy', 'oauthlib', 'openai', 'opentelemetry-api', 'orjson', 'packaging', 'pfzy', 'polars', 'polars-runtime-32', 'prompt_toolkit', 'propcache', 'pycparser', 'pydantic', 'pydantic-settings', 'pydantic_core', 'pygments', 'pyjwt', 'pynacl', 'pyroscope-io', 'python-dateutil', 'python-dotenv', 'python-multipart', 'pyyaml', 'redis', 'referencing', 'regex', 'requests', 'restrictedpython', 'rich', 'rpds-py', 'rq', 's3transfer', 'six', 'sniffio', 'soundfile', 'sse-starlette', 'starlette', 'tiktoken', 'tokenizers', 'tqdm', 'truststore', 'typing-inspection', 'typing_extensions', 'tzlocal', 'urllib3', 'uvicorn', 'uvloop', 'wcwidth', 'websockets', 'yarl', 'zipp'],
}

// ─── the March 2026 compromise ───────────────────────────────────────────────
// `src` says where each line comes from: the brief, or a primary record.
export const TIMELINE = [
  { when: 'Mar 19', title: 'TeamPCP moves the Git tags of `trivy-action`', text: 'The tags point to a malicious v0.69.4 that harvests credentials from whatever CI runner executes it.', src: 'brief' },
  { when: 'Mar 24 · 10:39 UTC', title: 'litellm 1.82.7 is published to PyPI', text: 'LiteLLM\'s CI runs Trivy without a pinned version. The harvester takes the `PYPI_PUBLISH` and GitHub tokens from the runner; the release carries a payload in `proxy_server.py`.', src: 'brief', hot: true },
  { when: 'Mar 24 · 10:52 UTC', title: '1.82.8 follows 13 minutes later', text: 'It adds `litellm_init.pth`, which runs every time the Python interpreter starts — whether or not LiteLLM is imported.', src: 'brief', hot: true },
  { when: 'Mar 24 · 11:15 UTC', title: 'OSV publishes MAL-2026-2144', text: 'OpenSSF Package Analysis flags 1.82.8 as malicious: "The package executes one or more commands associated with malicious behavior."', src: 'osv' },
  { when: 'Mar 24 · ~13:38 UTC', title: 'PyPI quarantines the project', text: 'About three hours after the first release. Both versions were published with LiteLLM\'s real credentials and looked like normal releases.', src: 'brief' },
  { when: 'Mar 24 · 15:35 UTC', title: 'PYSEC-2026-2: rotate every credential', text: '"Anyone who has installed and run the project should assume any credentials available to litellm environment may have been exposed."', src: 'osv' },
  { when: 'Mar 31', title: 'litellm 1.83.0 — the next release on PyPI', text: '1.82.7 and 1.82.8 are no longer listed; the version history jumps from 1.82.6 (Mar 22) to 1.83.0.', src: 'pypi' },
  { when: 'Aug 13', title: '153 GB appears publicly', text: 'Stolen cloud credentials, SSH keys and Kubernetes secrets. The payload ran in three stages: harvest credentials, move into the cluster, leave a persistent backdoor.', src: 'brief' },
  { when: 'Aug 27', title: 'Two alleged TeamPCP members arrested', text: 'Reported by Hackread.', src: 'brief' },
]
export const TIMELINE_SRC = {
  brief: { label: 'the brief', tone: '#B7862F' },
  osv: { label: 'OSV advisory', tone: '#2E9E7B' },
  pypi: { label: 'PyPI history', tone: '#2E9E7B' },
}

// What PYSEC-2026-2 says the payload did — paraphrased, domains defanged as
// the advisory prints them.
export const PAYLOAD = [
  { stage: 'Harvest', text: 'Scanned the file system and environment for private SSH keys, Git and Docker credentials, `.env` files, Kubernetes service-account tokens, database and LDAP configuration, shell history and crypto-wallet keys; asked cloud metadata servers for access tokens and read AWS Secrets Manager.' },
  { stage: 'Exfiltrate', text: 'Sent everything to `models.litellm[.]cloud` — a look-alike of the project\'s own name.' },
  { stage: 'Persist', text: 'Installed a systemd unit masquerading as "System Telemetry Service"; in Kubernetes, created a new pod. The persistence script polled `checkmarx[.]zone` for instructions.' },
]

// ─── 02 · what else it secures ───────────────────────────────────────────────
// `portal`: where this portal demonstrates it; `rel` says how closely.
export const CONTROLS = [
  { title: 'AI Gateway', short: 'AI Gateway', status: 'GA', icon: Waypoints, airs: 'Identity, budget, model access, guardrails and routing are decided in one policy check on every request.', litellm: 'This is the one it covers.', covered: true, portal: 'apiIntercept', rel: 'demo', relText: 'The SCM AI Gateway target fronts Bedrock and Vertex with one guardrail' },
  { title: 'Runtime Guardrails', short: 'Runtime guardrails', status: 'GA', icon: ShieldCheck, airs: '50+ checks on input and output, including prompt injection, DLP, toxicity and hallucination. Each can block, redact, log or fall back.', litellm: 'Several built-in guardrails and per-team guardrails are Enterprise. CVE-2026-40217 was a sandbox escape in its custom guardrails.', claim: 'guardrailsPaid', portal: 'apiIntercept', rel: 'demo', relText: 'Fire the 142-payload library with AIRS on and off' },
  { title: 'Agent Identity', short: 'Agent identity', status: 'Coming', icon: Fingerprint, airs: 'Inventory agent identities, assign owners and enforce least privilege, so an agent holds only the access its task needs.', litellm: 'No agent identity model. Virtual keys only.', portal: 'enterpriseAccess', rel: 'closest', relText: 'User identity, not agent identity: Entra ID → signed JWT → routing' },
  { title: 'Agent & MCP Gateway', short: 'Agents & MCP', status: 'GA registry', icon: Network, airs: 'Agent Registry with A2A, MCP Registry with tool-level access control, and full logs of agent and MCP calls.', litellm: 'Has an MCP gateway. CVE-2026-42271 allowed authenticated command execution through its MCP stdio test endpoints, and CVE-2026-59822 bypassed MCP authentication.', portal: 'apiIntercept', rel: 'demo', relText: 'MCP tool calls through the SCM AI Gateway' },
  { title: 'AI Model Security', short: 'Model security', status: 'GA', icon: ScanSearch, airs: 'Scans model files for backdoors, arbitrary code execution and vulnerable libraries before they reach production.', litellm: 'None.', portal: 'modelScanning', rel: 'demo', relText: 'Real model scans, and your SCM scan history' },
  { title: 'AI Artifact Scanning', short: 'Artifact scanning', status: 'GA', icon: Boxes, airs: 'Scans the agent codebase (skills, tools, MCP servers, orchestration) for attack chains that cross component boundaries.', litellm: 'None.', portal: 'modelScanning', rel: 'closest', relText: 'Skill scans, as seen in SCM' },
  { title: 'AI Red Teaming', short: 'Red teaming', status: 'GA', icon: Swords, airs: 'Profiles the target, then runs attacks written for it against models, apps and agent tool calls. Runs continuously rather than as a one-off test.', litellm: 'None.', portal: 'redTeaming', rel: 'demo', relText: 'Live campaigns and reports' },
  { title: 'Agent Endpoint Security', short: 'Agent endpoints', status: 'GA', icon: Laptop, airs: 'Koi. Finds and governs agents, skills, MCP servers, extensions and models on the laptops where Claude Code and Cursor run.', litellm: 'None. This layer catches a poisoned package before it reaches a runner.', portal: 'claudeHooks', rel: 'related', relText: 'AIRS hooks in Claude Code — related, but not the Koi product' },
  { title: 'Browser for Agentic AI', short: 'Agentic browser', status: 'GA', icon: Globe, airs: 'Governs agents that work in the browser: the permissions they inherit, unsafe actions against enterprise systems, and commands run without approval.', litellm: 'None.' },
]

// ─── 03 · in production ──────────────────────────────────────────────────────
// edge: who the row favours once the claim check is applied — airs | litellm | even | contested.
export const PRODUCTION = [
  {
    group: 'Architecture',
    rows: [
      {
        topic: 'Deployment model', edge: 'airs',
        airs: 'Control plane in Strata Cloud Manager, data plane in your cloud via Helm. Prompts stay in your VPC.',
        litellm: 'Self-hosted in full. You patch it, and 13 CVEs had been filed against it this year by the brief\'s count — 25 on OSV today.',
        deeper: 'Both keep prompts in the customer\'s network; the difference is who carries the control plane and the patching. LiteLLM supports "the four most recent stable minor lines" and ships a release most days, so staying current is a weekly job for whoever runs it.',
        say: 'Both run in your VPC. With AIRS, the control plane and its patching are ours; with LiteLLM, all of it is yours.',
        claims: ['cves'],
      },
      {
        topic: 'Policy hierarchy', edge: 'airs',
        airs: 'Organisation, department, team, then user or app. Policies, quotas and permissions inherit downward, with overrides allowed at each level.',
        litellm: 'Keys, teams and global roles. There is no department level to enforce policy at.',
        deeper: 'Org and team admins are themselves an Enterprise feature in LiteLLM ("Org and team admins" under what Enterprise adds).',
        say: 'Ask where they would set a policy for one department. If the answer is "on every team", that is the gap.',
        claims: ['sso'],
      },
      {
        topic: 'Dependency surface', edge: 'airs',
        airs: 'TypeScript on Hono. 15 declared dependencies in the gateway core and one published advisory.',
        litellm: 'Python on uvicorn. Over a hundred packages for `litellm[proxy]` (107 in the brief, 111 re-resolved here), plus PostgreSQL for keys and budgets.',
        deeper: 'This is the architectural answer to "it could happen to anyone": the size of the tree is a design decision. Watch the componentized Rust gateway in LiteLLM\'s repository — it would change this row for the data path when it ships.',
        say: 'The size of the dependency tree is an architecture decision, not bad luck.',
        claims: ['packages', 'deps15', 'python'],
      },
      {
        topic: 'Custom guardrails', edge: 'airs',
        airs: 'Guardrails run as policy in the request chain. Your own detectors plug in over a webhook.',
        litellm: 'Custom guardrails run your Python inside the proxy. CVE-2026-40217 escaped that sandbox (high), and CVE-2026-59821 bypassed the safety checks (low).',
        deeper: 'A webhook keeps customer code out of the gateway process; in-process code shares the process with every provider key.',
        say: 'Where does your custom guardrail code run — next to your provider keys?',
        claims: ['namedCves'],
      },
    ],
  },
  {
    group: 'Performance',
    rows: [
      {
        topic: 'Added latency', edge: 'contested',
        airs: 'Under 1 ms at p50, 15–20 ms at p99 (the brief\'s figure).',
        litellm: 'LiteLLM\'s own table: 12 / 29 / 43 ms (p50 / p95 / p99) on two instances — and 2 / 8 / 13 ms on four.',
        deeper: 'Agents make many calls per task, so the tail is what users feel — but LiteLLM\'s tail shrinks with capacity, and at four instances it beats our quoted p99. Use the calculator in Do the math, and keep latency out of the opening.',
        say: 'Latency depends on how much you run. Ask what their number costs to run, and who patches those pods.',
        claims: ['latency', 'airsLatency'], math: 'tail',
      },
      {
        topic: 'Caching', edge: 'airs',
        airs: 'Simple and semantic caching. Prompt-cache writes and reads are recorded as separate line items at their correct prices.',
        litellm: 'Has caching. Cache-token pricing is where cache-heavy agent workloads overspend unnoticed.',
        deeper: 'Both cache (LiteLLM\'s repository even has semantic-cache crates). The brief\'s point is accounting: cache writes and reads priced separately.',
        say: 'Both cache. Ask how their bill shows prompt-cache writes versus reads.',
      },
      {
        topic: 'Resilience', edge: 'even',
        airs: 'Ordered fallback, weighted load balancing, retries with exponential backoff (up to five), circuit breaking, conditional routing and canary splits.',
        litellm: 'Fallback, retries, load balancing, budget routing — and since v1.94.x a beta Auto Routing that includes semantic routing. No ensemble in its docs.',
        deeper: 'The brief said "no semantic routing"; that is out of date. Don\'t fight this row.',
        say: 'Routing is table stakes on both. The question is what decides the route — one policy, or settings spread across keys and teams.',
        claims: ['semantic', 'budget'],
      },
      {
        topic: 'Scale footprint', edge: 'airs',
        airs: 'Stateless data plane with no database on the request path.',
        litellm: 'One worker per pod. The Helm chart\'s default `maxReplicas: 100` with a pool of 10 asks Postgres for about 1,000 connections — more than a stock Postgres accepts. Their production guide warns about it.',
        deeper: 'PostgreSQL\'s default `max_connections` is typically 100. The chart now offers an optional in-pod PgBouncer (off by default); above roughly 1,000 RPS the guide adds a Redis transaction buffer. Their 3,000 RPS benchmark ran 33 pods of 4 vCPU / 16 GiB.',
        say: 'At full scale, how many connections does your gateway ask your database for?',
        claims: ['workers', 'pgConnections'], math: 'pg',
      },
    ],
  },
  {
    group: 'Production features',
    rows: [
      {
        topic: 'Enforcement', edge: 'even',
        airs: 'A hard budget breach returns HTTP 412, a rate limit 429, a guardrail block 446 and a warn-only guardrail 246. Budget state feeds routing, so an exhausted budget falls back to a cheaper model instead of failing.',
        litellm: 'Tracks budgets and spend, and its Budget Routing skips providers, deployments or tags that crossed their budget (errors only when all have).',
        deeper: 'Field note: on the SCM tenant a guardrail block is HTTP 200 with the reply replaced (soft deny), not 446 — read the hook verdict. The brief\'s "does not fail over on budget" is out of date.',
        say: 'Both can route around a spent budget. Ours decides it in the same check as identity and guardrails.',
        claims: ['budget', 'statusCodes'], portal: 'apiIntercept',
      },
      {
        topic: 'Identity', edge: 'airs',
        airs: 'SAML 2.0 and OIDC SSO, SCIM 2.0 provisioning and custom role mapping through Strata Cloud Manager. Service identities over mTLS, short-lived JWTs and OAuth2 client credentials.',
        litellm: 'SSO is free up to five users, then Enterprise. SCIM, org and team admins and audit logs are Enterprise too.',
        deeper: 'Short-lived JWTs as gateway credentials are demonstrated live in this portal: Entra ID sign-in, a portal-minted RS256 token, identity-based routing on the AI Gateway.',
        say: 'Count the users. Past five, SSO is a licence line item.',
        claims: ['sso'], portal: 'enterpriseAccess',
      },
      {
        topic: 'Catalog and access', edge: 'litellm',
        airs: '1,600+ models across 50+ providers, allowlists per config target, version pinning, and custom hosts for private and on-prem models.',
        litellm: '100+ providers behind one OpenAI-compatible API. This is LiteLLM\'s strongest area.',
        deeper: 'Concede it. A new provider usually lands in LiteLLM within a week of its launch.',
        say: 'They are excellent at breadth. Our catalog covers what enterprises run, with allowlists and pinning on top.',
        claims: ['airsCatalog'],
      },
      {
        topic: 'Observability', edge: 'airs',
        airs: 'Full prompt and response logs kept for a year, distributed tracing, 40+ metrics, native OpenTelemetry export, and cost by request, agent, team, provider and model.',
        litellm: 'Callbacks to many logging tools and a Prometheus endpoint. Audit logs are Enterprise.',
        deeper: 'The brief listed Prometheus as Enterprise; LiteLLM\'s Prometheus page no longer says so. Keep the point to audit logs and retention.',
        say: 'Ask how long they keep full prompt logs, and where the audit trail lives.',
        claims: ['prometheus'],
      },
      {
        topic: 'Management', edge: 'airs',
        airs: 'Runs in Strata Cloud Manager with every other Prisma AIRS control point: one console, one policy model, one support contract.',
        litellm: 'Its own console, identity and audit trail. Community support unless you buy Enterprise (a dedicated channel; security patches within 72 hours on the 24/7 SLA).',
        deeper: 'This row is where the platform argument (02) lands in daily operations.',
        say: 'How many consoles will your AI security team log into?',
        claims: ['support'],
      },
    ],
  },
]
export const EDGE = {
  airs: { label: 'AIRS ahead', key: 'pass' },
  litellm: { label: 'LiteLLM ahead', key: 'idle' },
  even: { label: 'Even', key: 'idle' },
  contested: { label: 'Contested', key: 'warn' },
}

// ─── objections ──────────────────────────────────────────────────────────────
// from: 'brief' — the seller page's own; 'research' — raised by what the
// primary sources show LiteLLM can now say back.
export const OBJECTIONS = [
  {
    from: 'brief', q: 'It was a supply chain attack. That could happen to anyone.',
    a: 'True, and worth agreeing with. Then ask why it worked. A proxy that needs over a hundred packages, built by a CI pipeline running its scanner unpinned, has more ways in than a gateway core with 15 dependencies.',
    punch: 'The size of the dependency tree is an architecture decision.',
    follow: 'How many packages does your gateway image resolve, and who reviews them?',
  },
  {
    from: 'brief', q: 'It\'s popular, free and MIT-licensed.',
    a: 'Popularity is what made it worth attacking. The free tier also stops short of what an enterprise needs.',
    punch: 'SSO is free for five users; SCIM, audit logs, org and team admins, and several built-in guardrails are paid Enterprise features.',
    follow: 'How many people will sign in to it, and which of those features does your security team require?',
    careful: 'The brief says "the full guardrail suite" is paid. It isn\'t: the open-source tier has the guardrail framework, custom guardrails, Presidio and third-party providers. Say "several built-in guardrails".',
  },
  {
    from: 'brief', q: 'We\'ll pin versions and scan our own supply chain.',
    a: 'That is the right practice, and LiteLLM was already running a scanner.',
    punch: 'The tool that compromised them was Trivy.',
    follow: 'Pinning lowers the risk. Does it change the hundred-plus packages the proxy loads to answer a request?',
  },
  {
    from: 'research', q: 'LiteLLM is faster — look at their benchmark.',
    a: 'Their own page shows 2 ms p50 and 13 ms p99 gateway overhead at four instances, and 12 / 43 ms at two. Agree that it can be fast when it is provisioned for it.',
    punch: 'Their 3,000 requests-per-second run used 33 pods of 4 vCPU and 16 GiB each.',
    follow: 'At what load, on how many instances, with which features on — and who patches those pods?',
  },
  {
    from: 'research', q: 'They have semantic routing and budget routing now.',
    a: 'Correct: Auto Routing (beta since v1.94.x) includes semantic routing, and Budget Routing skips providers over budget. Concede it — the brief is out of date there.',
    punch: 'The difference is not whether a route can change, but where the decision is made.',
    follow: 'Do budget, identity, guardrails and routing sit in one policy that inherits from organisation to department to team?',
  },
  {
    from: 'research', q: 'Their images are signed and they\'re SOC 2 Type II now.',
    a: 'Both are real improvements, and worth acknowledging.',
    punch: 'A signature tells you who published an image, not what is inside it — and the proxy inside still resolves over a hundred Python packages.',
    follow: 'Who patches the next CVE, and how fast? Their paid 24/7 SLA lists 72 hours for security patches.',
  },
  {
    from: 'research', q: 'We already run Prisma AIRS inside LiteLLM.',
    a: 'Good — keep it. LiteLLM\'s native `panw_prisma_airs` guardrail scans prompts, responses and MCP tool calls with the customer\'s own security profile.',
    punch: 'That protects what passes through the gateway. Nothing in it protects the gateway itself.',
    follow: 'What covers the other eight control points — models, agents, MCP servers, red teaming, endpoints, the browser?',
    go: 'coexist',
  },
  {
    from: 'research', q: 'We self-host so prompts never leave our VPC.',
    a: 'So does the AIRS AI Gateway: the data plane runs in your cloud via Helm, and prompts stay in your VPC. The control plane is in Strata Cloud Manager.',
    punch: 'Self-hosting decides where prompts flow. It also decides who patches.',
    follow: 'Do you want to run the control plane and its patch cycle, or only the data plane?',
  },
]

// ─── where LiteLLM is strong ─────────────────────────────────────────────────
export const STRENGTHS = [
  { title: 'Time to first call', text: '`pip install`, one YAML file, and it is running in ten minutes. Nothing in AIRS is faster to try.', counter: 'Agree. Then move the conversation from "try" to "run in front of every agent".' },
  { title: 'Provider breadth in one import', text: '100+ providers behind an OpenAI-compatible API, MIT-licensed, with no procurement step.', counter: 'Agree. Our catalog covers what enterprises run — with allowlists, pinning and custom hosts for private models.' },
  { title: 'Release pace', text: 'New releases most days. A new provider usually lands within a week of its launch.', counter: 'Agree — and note the other side: a release most days is also a patch cycle most days for whoever runs it.', live: 'pace' },
]
export const CHEAP_PATHS = [
  { tone: 'pass', label: 'Path 1 · Winnable', title: 'They don\'t yet see the gateway as critical infrastructure.', text: 'Spend the meeting on section 01: this box sits in front of every agent and every credential they own.' },
  { tone: 'warn', label: 'Path 2 · Deprioritise', title: 'They see it, and still want cheap.', text: 'Security is not their priority, and the deal is unlikely to pass their own security review.' },
]

// ─── discovery ───────────────────────────────────────────────────────────────
export const DISCOVERY = [
  { area: 'Safety', q: 'Did any host install litellm 1.82.7 or 1.82.8 on 24 March 2026?', why: 'PYSEC-2026-2: anyone who installed and ran them should treat every credential in that environment as exposed. A yes ends the feature comparison.' },
  { area: 'Safety', q: 'Who patches your gateway, and how long did the last CVE take to reach production?', why: 'Self-hosted in full means the patch cycle is theirs — and there is a release most days.' },
  { area: 'Safety', q: 'How many packages does your gateway image resolve, and who reviews them?', why: 'Over a hundred for `litellm[proxy]`; 15 declared in the AIRS gateway core.' },
  { area: 'Scope', q: 'What secures your models, agents, MCP servers and coding assistants today — and in how many consoles?', why: 'The gateway is one of nine control points. Each one LiteLLM lacks is another product to buy and run.' },
  { area: 'Production', q: 'Where would you set a policy for one department?', why: 'LiteLLM has keys, teams and global roles — no department level.' },
  { area: 'Production', q: 'At full scale, how many connections does your gateway ask your database for?', why: 'The default chart\'s ceiling asks for about 1,000; a stock Postgres typically accepts 100.' },
  { area: 'Production', q: 'How many people will sign in, and is SSO, SCIM and audit logging in your current licence?', why: 'SSO is free for five users; SCIM and audit logs are Enterprise.' },
  { area: 'Production', q: 'Where does your custom guardrail code run?', why: 'In LiteLLM, inside the proxy — CVE-2026-40217 was a sandbox escape there.' },
]

// ─── already on LiteLLM? ─────────────────────────────────────────────────────
export const COEXIST = {
  intro: 'Many customers will already run LiteLLM. LiteLLM ships a native Prisma AIRS guardrail (`guardrail: panw_prisma_airs`), so AIRS runtime scanning can go in today — with the customer\'s own Strata Cloud Manager security profile — without touching their gateway choice.',
  modes: [
    ['pre_call', 'Before the LLM call', 'The prompt'],
    ['during_call', 'In parallel with the LLM call', 'The prompt'],
    ['post_call', 'After the LLM call', 'The response'],
    ['pre_mcp_call', 'Before an MCP tool runs', 'Tool name and arguments'],
    ['during_mcp_call', 'In parallel with an MCP tool', 'Tool name and arguments'],
    ['post_mcp_call', 'After an MCP tool runs', 'What the tool returned'],
  ],
  features: [
    'Prompt injection and malicious URL detection, before or after the LLM call',
    'DLP — block, or mask PII, card numbers and SSNs instead of blocking',
    'MCP tool scanning — the call\'s arguments and, with `post_mcp_call`, what the tool returned',
    'Fail-open or fail-closed, chosen per deployment',
    'Regional endpoints: US, EU (Germany), India, Singapore',
  ],
  config: `guardrails:
  - guardrail_name: "panw-prisma-airs-guardrail"
    litellm_params:
      guardrail: panw_prisma_airs
      mode: "pre_call"
      api_key: os.environ/PANW_PRISMA_AIRS_API_KEY
      profile_name: os.environ/PANW_PRISMA_AIRS_PROFILE_NAME
      api_base: "https://service.api.aisecurity.paloaltonetworks.com"  # US — use your region`,
  play: [
    { title: 'Land', text: 'AIRS scanning inside their LiteLLM, on their own security profile. Detections show in Strata Cloud Manager from day one.' },
    { title: 'Expand', text: 'The control points LiteLLM does not cover: model scanning, red teaming, agent and MCP security, endpoints, the browser.' },
    { title: 'Consolidate', text: 'When the gateway itself comes up for review — a CVE, an audit, a scale wall — the AIRS AI Gateway is already in the same console.' },
  ],
  caveat: 'The community implementation guide says there is no `post_mcp_call` mode; LiteLLM\'s own page now documents one (it needs `default_on: true` and a release that contains the fix — the Developer Corner guide has the detail). And the guardrail protects what passes through LiteLLM — not LiteLLM itself.',
  guide: 'int-gateways',
}

// ─── do the math ─────────────────────────────────────────────────────────────
export const MATH = {
  tail: {
    title: 'Why p99 is the figure that matters for agents',
    text: 'If one gateway call in a hundred lands in the p99 tail, the chance that a task of N calls hits it at least once is 1 − 0.99ᴺ. Agents make many calls per task, so the tail stops being rare.',
    series: [
      { id: 'll2', label: 'LiteLLM · 2 instances', p50: 12, p95: 29, p99: 43, src: 'LiteLLM benchmarks, short-prompt test', side: 'litellm' },
      { id: 'll4', label: 'LiteLLM · 4 instances', p50: 2, p95: 8, p99: 13, src: 'LiteLLM benchmarks, short-prompt test', side: 'litellm' },
      { id: 'airs', label: 'AIRS AI Gateway', p50: 1, p95: null, p99: 20, src: 'the brief: under 1 ms p50, 15–20 ms p99 (upper bound shown)', side: 'airs' },
    ],
  },
  pg: {
    title: 'How many Postgres connections does LiteLLM ask for?',
    text: 'Connections = replicas × workers per pod × pool limit — or replicas × the PgBouncer cap when the chart\'s optional in-pod pool is on. The production guide\'s own formula; the instance count is maxReplicas once an autoscaler owns it.',
    defaults: { replicas: 100, workers: 1, pool: 10, pgbouncer: false, bouncerCap: 20, maxConnections: 100 },
  },
}

// ─── sources ─────────────────────────────────────────────────────────────────
// Every URL here was opened on AS_OF (npmjs.com answers browsers, not curl).
export const SOURCES = {
  brief: { group: 'The brief', title: 'AIRS AI Gateway and LiteLLM — competitive brief (October 2026)', url: BRIEF.url },
  osvLitellm: { group: 'Security record', title: 'OSV.dev — every advisory for PyPI litellm', url: 'https://osv.dev/list?ecosystem=PyPI&q=litellm' },
  osvGateway: { group: 'Security record', title: 'OSV.dev — GHSA-hhh5-2cvx-vmfp (CVE-2025-66405), the gateway core\'s one advisory', url: 'https://osv.dev/vulnerability/GHSA-hhh5-2cvx-vmfp' },
  osvMalware: { group: 'March 2026', title: 'OSV.dev — PYSEC-2026-2: two litellm versions containing credential-harvesting malware', url: 'https://osv.dev/vulnerability/PYSEC-2026-2' },
  osvTrivy: { group: 'March 2026', title: 'OSV.dev — GHSA-69fq-xp46-6x23: Trivy ecosystem supply chain briefly compromised', url: 'https://osv.dev/vulnerability/GHSA-69fq-xp46-6x23' },
  litellmBlog: { group: 'March 2026', title: 'LiteLLM — Security update, March 2026', url: 'https://docs.litellm.ai/blog/security-update-march-2026' },
  litellmIssue: { group: 'March 2026', title: 'BerriAI/litellm issue #24518', url: 'https://github.com/BerriAI/litellm/issues/24518' },
  futuresearch: { group: 'March 2026', title: 'FutureSearch — LiteLLM PyPI supply chain attack', url: 'https://futuresearch.ai/blog/litellm-pypi-supply-chain-attack/' },
  wizTeampcp: { group: 'March 2026', title: 'Wiz — "Three\'s a crowd": TeamPCP trojanizes LiteLLM', url: 'https://www.wiz.io/blog/threes-a-crowd-teampcp-trojanizes-litellm-in-continuation-of-campaign' },
  osv40217: { group: 'Security record', title: 'CVE-2026-40217 — sandbox escape in custom-code guardrail', url: 'https://osv.dev/vulnerability/GHSA-wxxx-gvqv-xp7p' },
  osv42271: { group: 'Security record', title: 'CVE-2026-42271 — command execution via MCP stdio test endpoints', url: 'https://osv.dev/vulnerability/GHSA-v4p8-mg3p-g94g' },
  osv59821: { group: 'Security record', title: 'CVE-2026-59821 — custom-code guardrail endpoints bypass safety checks', url: 'https://osv.dev/vulnerability/GHSA-72m8-9m7m-h278' },
  osv59822: { group: 'Security record', title: 'CVE-2026-59822 — MCP authentication bypass via OAuth2 passthrough', url: 'https://osv.dev/vulnerability/GHSA-7488-6r32-c95q' },
  pypiLitellm: { group: 'Packages', title: 'PyPI — litellm release history', url: 'https://pypi.org/project/litellm/#history' },
  npmGateway: { group: 'Packages', title: 'npm — @portkey-ai/gateway', url: 'https://www.npmjs.com/package/@portkey-ai/gateway' },
  ghGateway: { group: 'Packages', title: 'GitHub — Portkey-AI/gateway (the open-source core)', url: 'https://github.com/Portkey-AI/gateway' },
  llBenchmarks: { group: 'LiteLLM docs', title: 'LiteLLM — Benchmarks', url: 'https://docs.litellm.ai/docs/benchmarks' },
  llProd: { group: 'LiteLLM docs', title: 'LiteLLM — Production guide (workers, connections, sizing)', url: 'https://docs.litellm.ai/docs/proxy/prod' },
  llEnterprise: { group: 'LiteLLM docs', title: 'LiteLLM — Enterprise (SSO, SCIM, audit logs, licensed guardrails, SLAs)', url: 'https://docs.litellm.ai/docs/enterprise' },
  llBudget: { group: 'LiteLLM docs', title: 'LiteLLM — Budget Routing', url: 'https://docs.litellm.ai/docs/proxy/provider_budget_routing' },
  llAutoRouting: { group: 'LiteLLM docs', title: 'LiteLLM — [Beta] Auto Routing', url: 'https://docs.litellm.ai/docs/proxy/auto_routing' },
  llPrometheus: { group: 'LiteLLM docs', title: 'LiteLLM — Prometheus metrics', url: 'https://docs.litellm.ai/docs/proxy/prometheus' },
  llPanw: { group: 'LiteLLM docs', title: 'LiteLLM — PANW Prisma AIRS guardrail', url: 'https://docs.litellm.ai/docs/proxy/guardrails/panw_prisma_airs' },
  llHelm: { group: 'LiteLLM repository', title: 'BerriAI/litellm — helm/litellm-helm/values.yaml', url: 'https://github.com/BerriAI/litellm/blob/main/helm/litellm-helm/values.yaml' },
  ghLitellmRust: { group: 'LiteLLM repository', title: 'BerriAI/litellm — litellm-rust (componentized gateway)', url: 'https://github.com/BerriAI/litellm/tree/main/litellm-rust' },
  aigwErrors: { group: 'AI Gateway docs', title: 'AI Gateway — Errors (412 budget exhausted, 446 guardrail deny)', url: 'https://portkey.ai/docs/aigw/api-reference/inference-api/error-codes' },
  aigwChangelog: { group: 'AI Gateway docs', title: 'AI Gateway changelog — 2.14.0 adds soft_deny_200', url: 'https://portkey.ai/docs/changelog/enterprise' },
  pgDocs: { group: 'Reference', title: 'PostgreSQL — max_connections (default 100)', url: 'https://www.postgresql.org/docs/current/runtime-config-connection.html' },
}
export const SOURCE_GROUPS = ['The brief', 'Security record', 'March 2026', 'Packages', 'LiteLLM docs', 'LiteLLM repository', 'AI Gateway docs', 'Reference']
