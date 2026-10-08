import { Megaphone, ScrollText } from 'lucide-react'
import { pick } from './links'

/**
 * Hybrid AI Gateway — the data plane on your own Kubernetes, with the airs-gw
 * Helm chart (github.com/Portkey-AI/airs-gw-helm), and how to upgrade it.
 *
 * Read on 2026-10-08: chart 1.2.0 (its values.yaml, templates and docs/), the
 * self-hosting pages of the AI Gateway developer docs, and the Enterprise
 * Gateway changelog. Neither the chart nor the docs has an upgrade page — the
 * upgrade commands here are standard Helm and kubectl, and the guide says so.
 * Where the chart and the docs disagree, the table at the end names it.
 */

const HELM_SECRET = `kubectl create namespace airs-gw

# The two values the chart refuses to render without — from the values.yaml
# that Gateway Registration downloads. Kept in a Secret, not in the file.
kubectl create secret generic airs-gw-env -n airs-gw \\
  --from-literal=PORTKEY_CLIENT_AUTH='<client auth key>' \\
  --from-literal=ORGANISATIONS_TO_SYNC='<organisation id>'`

const HELM_VALUES = `images:
  gatewayImage:
    tag: "2.21.0"              # pin it; an upgrade is changing this line

imageCredentials:              # registry.portkey.ai needs a username and password
  - name: airs-gw-registry
    create: true
    registry: https://registry.portkey.ai
    username: "<registry user>"
    password: "<registry password>"

environment:
  create: false
  existingSecret: airs-gw-env
  secretKeys:                  # these come from the Secret...
    - PORTKEY_CLIENT_AUTH
    - ORGANISATIONS_TO_SYNC
  data:                        # ...everything else from here
    SERVICE_NAME: airsgateway
    PORT: "8787"
    SERVER_MODE: "all"         # gateway + MCP gateway on 8788
    MCP_PORT: "8788"
    LOG_STORE: s3_assume       # keep full logs in your bucket
    LOG_STORE_REGION: us-west-2
    LOG_STORE_GENERATIONS_BUCKET: my-airs-gw-logs

serviceAccount:
  create: true
  automount: true              # the chart default is false; IRSA needs the token
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::<account-id>:role/airs-gw-logs

redis:
  external:                    # only this stops the bundled Redis StatefulSet
    enabled: true
    existingSecretName: airs-gw-redis   # redis_connection_url, redis_tls_enabled, redis_mode, redis_store

# Upgrades without downtime (all off by default)
replicaCount: 2
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
pdb:
  enabled: true
  minAvailable: 1`

const HELM_INSTALL = `helm repo add airs-gw https://portkey-ai.github.io/airs-gw-helm
helm repo update

helm upgrade --install airs-gw airs-gw/airs-gw \\
  --version 1.2.0 \\
  -f ./values.yaml \\
  -n airs-gw --create-namespace`

const HELM_VERIFY = `kubectl get pods -n airs-gw
kubectl rollout status deployment/airs-gw -n airs-gw

kubectl port-forward deployment/airs-gw -n airs-gw 8787:8787 &
curl -s http://127.0.0.1:8787/v1/health

# One real request through your data plane — then find it in SCM → Logs
curl -s http://127.0.0.1:8787/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "x-portkey-api-key: $PORTKEY_API_KEY" \\
  -d '{"model": "@<your-integration>/<model>", "messages": [{"role": "user", "content": "ping"}]}'`

const UPGRADE_APP = `# 1. values.yaml — the only line that changes
#    images:
#      gatewayImage:
#        tag: "2.27.0"

# 2. Optional: confirm the tag exists before you roll
docker login registry.portkey.ai
docker manifest inspect registry.portkey.ai/airsgw/gateway_enterprise:2.27.0 > /dev/null && echo "tag exists"

# 3. Upgrade, holding the chart where it is
helm upgrade airs-gw airs-gw/airs-gw --version 1.2.0 -f values.yaml -n airs-gw
kubectl rollout status deployment/airs-gw -n airs-gw

# 4. Read the running version from the pod spec — the
#    app.kubernetes.io/version label keeps the chart's appVersion
kubectl get deployment airs-gw -n airs-gw \\
  -o jsonpath='{.spec.template.spec.containers[0].image}{"\\n"}'`

const UPGRADE_CHART = `helm repo update
helm search repo airs-gw/airs-gw --versions

# What the new chart changes in its defaults, and in the rendered manifests
helm show values airs-gw/airs-gw --version <new> > values-<new>.default.yaml
diff <(helm show values airs-gw/airs-gw --version 1.2.0) values-<new>.default.yaml
helm diff upgrade airs-gw airs-gw/airs-gw --version <new> -f values.yaml -n airs-gw   # helm-diff plugin

helm upgrade airs-gw airs-gw/airs-gw --version <new> -f values.yaml -n airs-gw
kubectl rollout status deployment/airs-gw -n airs-gw`

const ROLLBACK = `helm history airs-gw -n airs-gw
helm rollback airs-gw <revision> -n airs-gw
kubectl rollout status deployment/airs-gw -n airs-gw`

export const AIGW_HYBRID = [
  {
    id: 'gw-hybrid',
    group: 'gateway',
    title: 'Hybrid deployment: the data plane on your Kubernetes',
    sub: 'Install the airs-gw Helm chart — and upgrade it when a gateway release ships',
    minutes: 12,
    level: 'Setup',
    live: 'helm.versions',
    docs: pick('agGwRegister', 'agHybridArch', 'agCacheBehave', 'ghAirsGwHelm', 'ghAirsGwValues', 'ghAirsGwRel', 'agChangelog', 'agDsChangelog',
      'ghAirsGwLogs', 'ghAirsGwRedis', 'ghAirsGwSecrets', 'ghAirsGwResil', 'ghAirsGwBedrock', 'ghAirsGwVertex', 'ghAirsGwOutbound', 'agPrivateNet', 'gwDeploy', 'ghGwDocker'),
    blocks: [
      {
        type: 'prose',
        text: [
          'In a hybrid deployment the **data plane** — the gateway every LLM request passes through — runs in your Kubernetes cluster, and the **management plane** stays in Strata Cloud Manager: the dashboard, integrations, configs, keys, guardrail definitions and analytics. The gateway pulls its configuration from SCM and serves requests from its own cache; model traffic goes from your cluster straight to your providers.',
          'It ships as one Helm chart, `airs-gw`. Two version numbers matter, and they move at different speeds: the **chart** (`1.2.0` — templates and defaults) and the **gateway** it runs (`2.21.0` — the `gateway_enterprise` image, one entry in the Enterprise Gateway changelog). Most upgrades are a new gateway on the same chart.',
        ],
      },
      {
        type: 'table',
        title: 'What runs where',
        columns: ['Component', 'Where', 'Notes'],
        minWidth: 640,
        rows: [
          ['Gateway', 'Your cluster', '`registry.portkey.ai/airsgw/gateway_enterprise`. Port 8787; the MCP gateway on 8788 when `SERVER_MODE` is `all` or `mcp`. Health at `/v1/health`.'],
          ['Cache store', 'Your cluster', 'A bundled Redis StatefulSet (persistence off by default), or your own Redis 6.2+, ElastiCache, Azure Redis or Memorystore.'],
          ['Data service', 'Your cluster — optional', 'Fine-tuning, batches, data exports. Its own image and tag (`data-service:1.9.0`).'],
          ['MinIO + Milvus', 'Your cluster — optional', 'Only for the semantic cache.'],
          ['Dashboard, configs, keys, guardrails, analytics', 'Strata Cloud Manager', 'The SCM API gateway is the only authentication authority; the data plane never touches its databases.'],
        ],
      },
      {
        type: 'table',
        title: 'What crosses the boundary',
        columns: ['Flow', 'Direction', 'Detail'],
        minWidth: 640,
        rows: [
          ['Config sync', 'Gateway → SCM', 'A delta sync every minute; changed entries are dropped from cache and re-fetched on next use. Cache TTL 7 days.'],
          ['Usage counters', 'Gateway → SCM', 'Pushed back for budgets and rate limits. Configs, prompts and responses are not.'],
          ['Metrics', 'Gateway → SCM', 'Tokens, cost, latency, model — always.'],
          ['Full request logs', 'Wherever `LOG_STORE` points', 'The chart default `control_plane` encrypts and forwards them to SCM. Point it at your own bucket and they stay in your account; SCM fetches one when someone opens it.'],
          ['Model traffic', 'Gateway → your providers', 'Direct from your cluster. A Prisma AIRS guardrail still sends the prompt and response to the AIRS API for scanning — that is its job.'],
        ],
        note: 'Egress to allow: `aigw.portkey.ai`, `mp.us.prod.airs-gw.portkey.ai` (the chart\'s default management-plane URL), `albus.portkey.ai` (named by the docs, and the data service\'s fallback), `registry.portkey.ai`, and your providers. Inbound only if the management plane must reach the data plane — the IPs come from Palo Alto Networks.',
      },
      {
        type: 'steps',
        title: 'Install',
        steps: [
          {
            title: 'Register the gateway in SCM',
            text: 'Give it a name and a type (Production or Non Production), and choose which workspaces it serves — all, or specific ones. Then **download values.yaml**.',
            path: ['AI Gateway', 'Admin Settings', 'Gateway Registration', 'Register New Gateway'],
            note: 'The page warns the file cannot be downloaded again once you leave it. It holds the client auth key — store it in a secret manager, not in git.',
          },
          {
            title: 'Get registry access',
            text: [
              '`registry.portkey.ai` is private (basic auth). The deployment guides say Palo Alto Networks shares the registry username and password together with the client auth key. Give them to the chart as `imageCredentials` (it creates the pull secret), or point `imagePullSecrets` at a secret you already have.',
            ],
          },
          {
            title: 'Keep the two required values in a Secret',
            text: '`PORTKEY_CLIENT_AUTH` (the client auth key) and `ORGANISATIONS_TO_SYNC` (the organisation id from the SCM URL) are mandatory — the chart fails to render without them. List them in `secretKeys` and they come from `existingSecret`; every other key still comes from `environment.data`.',
            code: [{ id: 'bash', lang: 'bash', code: HELM_SECRET }],
          },
          {
            title: 'Choose where logs and cache live',
            text: 'Logs: `s3_assume` with IRSA on EKS, `azure` with workload / managed / Entra auth, `gcs_assume` with GKE workload identity (or `gcs` with HMAC keys), `s3_custom` for S3-compatible stores. Cache: bundled Redis for a trial; for production an external one — and only `redis.external.enabled` stops the bundled StatefulSet (a `REDIS_URL` alone does not).',
          },
          {
            title: 'Write values.yaml',
            text: 'Start from the downloaded file and add what your cluster needs. A production-shaped example:',
            code: [{ id: 'yaml', lang: 'yaml', code: HELM_VALUES, file: 'values.yaml' }],
          },
          {
            title: 'Install the chart',
            text: 'Pin the chart with `--version` so a later `helm repo update` cannot change what a re-run installs.',
            code: [{ id: 'bash', lang: 'bash', code: HELM_INSTALL }],
          },
          {
            title: 'Verify',
            text: 'Pods ready, health answering, one request visible in SCM → Logs. The registration page shows the gateway **active** after Verify Connection, with its last sync time.',
            code: [{ id: 'bash', lang: 'bash', code: HELM_VERIFY }],
          },
        ],
      },
      {
        type: 'table',
        title: 'Provider credentials without static keys',
        columns: ['Provider', 'On the gateway', 'On the integration in SCM'],
        minWidth: 660,
        rows: [
          ['Amazon Bedrock', 'An assumed-role access key (`AWS_ASSUME_ROLE_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` / `_REGION`), IRSA, or the instance profile (IMDS)', 'Role ARN, External ID and region. The role needs `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` — plus `bedrock:GetInferenceProfile` for `us.*` profiles.'],
          ['Google Vertex AI', '`GCP_AUTH_MODE: workload`, the service account annotated `iam.gke.io/gcp-service-account` (`GCP_WIF_AUDIENCE` outside GKE)', 'Auth type **workload**, service-account JSON left empty. The Google SA needs `roles/aiplatform.user`; the Kubernetes SA binding `roles/iam.workloadIdentityUser`.'],
        ],
        note: 'Either way, set `serviceAccount.automount: true` — the chart defaults to false, and both identities need the projected token.',
      },
      {
        type: 'prose',
        title: 'Upgrading',
        text: [
          'The image the chart runs is `images.gatewayImage.tag`, falling back to the chart\'s `appVersion`. Gateway releases ship about weekly; chart releases far less often. So there are two kinds of upgrade: **a new gateway on the same chart** (change one line), and **a new chart** (new templates and defaults — read them first).',
        ],
      },
      { type: 'live', preset: 'check', title: 'Is the chart behind the gateway?', text: 'Reads the chart index and the changelog now, and lists every gateway release newer than the latest chart\'s default — with any upgrade warning.' },
      {
        type: 'table',
        title: 'Chart releases so far',
        columns: ['Chart', 'Released', 'Installs', 'What changed'],
        minWidth: 640,
        rows: [
          ['1.0.0', '15 Jul 2026', 'gateway 2.11.1', 'First release. Log and analytics stores default to `control_plane`.'],
          ['1.1.0', '16 Jul 2026', 'gateway 2.15.0', 'Fixed the management-plane URLs; data service 1.9.0. Its `appVersion` still says 2.11.1 — the tag is what runs.'],
          ['1.2.0', '9 Sep 2026', 'gateway 2.21.0', '`pullPolicy` is now `IfNotPresent`; Redis settings in `environment.data` or the secret override the chart\'s instead of duplicating; Vertex workload-identity doc.'],
        ],
        note: 'values.yaml says the minimum supported gateway is 2.15.0. The live check above lists what has shipped since.',
      },
      {
        type: 'steps',
        title: 'A new gateway release, same chart',
        steps: [
          { title: 'Read the releases you are skipping', text: 'Every changelog entry between your version and the target. Look for new environment variables and warnings: 2.14.0 rejects configs above new target limits unless you raise `MAX_ROOT_CONFIG_TARGETS` and friends **before** upgrading; none of 2.15.0–2.27.0 carries such a warning. This portal\'s Release notes list every gateway release under **AI Gateway**, with the full notes.' },
          { title: 'Pin the new tag in values.yaml', text: 'Change `images.gatewayImage.tag` and commit the file. Never reuse or float a tag: with `IfNotPresent` a node that already has the image will not pull it again.' },
          { title: 'Upgrade with the chart version held', text: 'Same chart, new image — the Deployment rolls one pod at a time if `strategy` and the PDB are set (they are not by default).', code: [{ id: 'bash', lang: 'bash', code: UPGRADE_APP }] },
          { title: 'Check it took', text: 'Read the image from the pod spec, not the `app.kubernetes.io/version` label (that is always the chart\'s `appVersion`). Then `/v1/health`, a request in SCM → Logs, and a recent last sync on the registration page.' },
        ],
      },
      {
        type: 'steps',
        title: 'A new chart release',
        steps: [
          { title: 'See what changed', text: 'The release notes on GitHub, then a diff of the defaults and of the rendered manifests (`helm diff` is a plugin).', code: [{ id: 'bash', lang: 'bash', code: UPGRADE_CHART }] },
          { title: 'Decide on the tag', text: 'A tag pinned in your values.yaml overrides the new chart\'s `appVersion`. Raise the pin, or remove it to take the chart\'s default.' },
          { title: 'Upgrade and verify', text: 'As above, with `--version <new>`.' },
        ],
      },
      {
        type: 'callout', tone: 'warn', title: 'Not every change rolls the pods',
        text: [
          'A new image tag always does. A change to `environment.data` does only when the chart owns the config (`environment.create: true`, which adds a checksum annotation). With `existingSecret`, editing the Secret changes nothing until you run `kubectl rollout restart deployment/airs-gw -n airs-gw` — or set `autoRestart: true` to restart on every upgrade.',
        ],
      },
      { type: 'code', title: 'Roll back', tabs: [{ id: 'bash', lang: 'bash', code: ROLLBACK }] },
      {
        type: 'callout', tone: 'docs', title: 'What the docs leave out',
        text: [
          'There is no upgrade page in the chart or in the developer docs; the commands above are standard Helm and kubectl. The chart\'s docs only re-run `helm upgrade --install`.',
          'Leave `dataservice` on its own tag: blanked, it falls back to the chart\'s `appVersion` — a gateway version number. Data service 1.7.0 and later need gateway 2.8.0 or later.',
          'When the management plane is unreachable the gateway keeps serving from cache — routing, rate limits, guardrails, response caching and log writes — and queues analytics. New or changed integrations, keys, configs and prompts wait until it is back.',
        ],
      },
      {
        type: 'table',
        title: 'Where the docs and chart 1.2.0 disagree',
        columns: ['Topic', 'Docs', 'Chart 1.2.0'],
        minWidth: 680,
        rows: [
          ['EKS / GKE / AKS guides', 'Install `portkey-ai/gateway` from the Portkey Helm repo with `docker.io/portkeyai` images', 'That is the legacy chart. Use `airs-gw/airs-gw` and `registry.portkey.ai/airsgw/*`'],
          ['`SERVER_MODE: unified`', 'Added in gateway 2.20.0', 'The templates know only `""`, `all` and `mcp` — with ingress on, `unified` fails to render'],
          ['MCP by default', 'Gateway only; `all` needs host-based ingress', '`SERVER_MODE: "all"` and path-based ingress (`hostBased: false`)'],
          ['Log residency', 'Resiliency page: logs never leave your VPC', '`LOG_STORE` defaults to `control_plane` — logs go to SCM until you set a store'],
          ['Sync interval', '30 s (resiliency page)', '1 minute (architecture and cache pages)'],
          ['Service account token', 'Every IRSA / workload identity example sets `automount: true`', 'Defaults to `automount: false`'],
          ['Configuration.md', 'Registry `registry.airs-gw.portkey.ai`, tag 1.15.8, `NodePort`', 'Stale — values.yaml is the reference'],
          ['Linked pages', 'The chart README links CacheStore.md and DataService.md', 'Neither file exists — Redis.md covers the cache'],
        ],
      },
      {
        type: 'cards',
        min: 260,
        items: [
          { icon: Megaphone, tone: '#EC4899', title: 'Every gateway release', kicker: 'Release notes · AI Gateway',
            text: 'The Enterprise Gateway changelog, read live — each release with its features, provider updates and fixes.', go: 'pillar:releaseNotes', goLabel: 'Open the release notes' },
          { icon: ScrollText, tone: '#EC4899', title: 'Org settings for hybrid', kicker: 'Governance',
            text: 'Gateway URLs, registration and the rest of the admin side.', go: 'gw-admin' },
        ],
      },
    ],
  },
]
