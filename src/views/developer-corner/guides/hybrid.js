import { Braces, Megaphone, Plug, ScrollText } from 'lucide-react'
import { pick } from './links'

/**
 * Hybrid AI Gateway — the data plane on your own Kubernetes, with the airs-gw
 * Helm chart (github.com/Portkey-AI/airs-gw-helm), and how to upgrade it.
 *
 * Read on 2026-10-08: chart 1.2.0 (its values.yaml, templates and docs/), the
 * self-hosting pages of the AI Gateway developer docs, and the Enterprise
 * Gateway changelog. There is no Helm upgrade page in the chart or the docs
 * (only the ECS Terraform page has "Version Pinning and Upgrades") — the Helm
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
    MCP_GATEWAY_BASE_URL: "https://mcp.example.com"   # required for "all" / "mcp"; include the protocol
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
NEW="<new chart version>"      # one of the versions listed above

# What the new chart changes in its defaults, and in the rendered manifests
helm show values airs-gw/airs-gw --version "$NEW" > "values-$NEW.default.yaml"
diff <(helm show values airs-gw/airs-gw --version 1.2.0) "values-$NEW.default.yaml"
helm diff upgrade airs-gw airs-gw/airs-gw --version "$NEW" -f values.yaml -n airs-gw   # helm-diff plugin

helm upgrade airs-gw airs-gw/airs-gw --version "$NEW" -f values.yaml -n airs-gw
kubectl rollout status deployment/airs-gw -n airs-gw`

const TRUSTED_HOSTS = `# values.yaml — the list REPLACES the defaults, so re-add the local names you still need
environment:
  data:
    TRUSTED_CUSTOM_HOSTS: "localhost,127.0.0.1,::1,host.docker.internal,*.corp.example.net"

# Read at startup only: roll the pods, then check what the container actually has
kubectl rollout restart deployment/airs-gw -n airs-gw
kubectl exec -n airs-gw deploy/airs-gw -- printenv TRUSTED_CUSTOM_HOSTS`

const ROLLBACK = `helm history airs-gw -n airs-gw
helm rollback airs-gw <revision> -n airs-gw
kubectl rollout status deployment/airs-gw -n airs-gw`

export const AIGW_HYBRID = [
  {
    id: 'gw-hybrid',
    group: 'gateway',
    title: 'Hybrid deployment: the data plane on your Kubernetes',
    sub: 'Install the airs-gw Helm chart — and upgrade it when a gateway release ships',
    minutes: 15,
    level: 'Setup',
    live: 'helm.versions',
    docs: pick('agGwRegister', 'agHybridArch', 'agCacheBehave', 'ghAirsGwHelm', 'ghAirsGwValues', 'ghAirsGwRel', 'agChangelog', 'agDsChangelog',
      'ghAirsGwLogs', 'ghAirsGwRedis', 'ghAirsGwSecrets', 'ghAirsGwResil', 'ghAirsGwBedrock', 'ghAirsGwVertex', 'ghAirsGwOutbound', 'agPrivateNet',
      'agPrometheus', 'agEks', 'agGke', 'agAks', 'agEcs', 'agAca', 'ghGwInfra', 'ghGwInfraBedrock', 'gwDeploy', 'ghGwDocker'),
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
          ['Dashboard, configs, keys, guardrails, analytics', 'Strata Cloud Manager', 'The SCM API gateway is the only authentication authority. The data plane never connects to the management plane\'s MySQL, but it writes request metrics and guardrail results **directly** to its ClickHouse (outbound HTTPS, bypassing the backend).'],
        ],
      },
      {
        type: 'table',
        title: 'What crosses the boundary',
        columns: ['Flow', 'Direction', 'Detail'],
        minWidth: 640,
        rows: [
          ['Config sync', 'Gateway → SCM', 'A delta sync every minute; changed entries are dropped from cache and re-fetched on next use. Cache TTL 7 days.'],
          ['Usage counters', 'Gateway → SCM', 'A resync every minute pushes **token and cost** counters only — for API keys, virtual keys, integration workspaces and usage-limit policies. Rate-limit counters stay in your local Redis. Configs, prompts, guardrails and responses are never pushed back.'],
          ['Metrics', 'Gateway → SCM ClickHouse', 'Always: model, provider, tokens, cost, latency, cache status, trace ids, guardrail results and a pointer to the log body.'],
          ['Full request logs', 'Wherever `LOG_STORE` points', 'The chart default `control_plane` encrypts and forwards them to SCM — no inbound connection needed. Point it at your own bucket and they stay in your account, but then the management plane **requests a log from the gateway** when someone opens it, so it needs inbound reach to the data plane (the architecture page\'s "Option A").'],
          ['Model traffic', 'Gateway → your providers', 'Direct from your cluster. A Prisma AIRS guardrail still sends the prompt and response to the AIRS API for scanning — that is its job.'],
        ],
        note: 'Egress: the deployment pages list only `https://aigw.portkey.ai` and `https://albus.portkey.ai`, with images from Docker Hub. Chart 1.2.0 instead defaults to `mp.us.prod.airs-gw.portkey.ai` and pulls from `registry.portkey.ai` — allow the hosts your values actually use, plus your providers (see the last table). Inbound only if the management plane must reach the data plane — logs in your own bucket — and the IPs come from Palo Alto Networks.',
      },
      {
        type: 'table',
        title: 'Where the data plane can run',
        columns: ['Target', 'How', 'Notes from the docs'],
        minWidth: 680,
        rows: [
          ['EKS · AKS (Helm)', 'This guide: the `airs-gw` chart', 'EKS: `t4g.medium` nodes, two or more across two AZs; IRSA or EKS Pod Identity; `service.containerPort` must equal `PORT`. AKS: `B2ms` nodes, Azure Managed Redis, Blob with workload identity.'],
          ['GKE (Helm)', 'The same chart', 'A `REGIONAL_MANAGED_PROXY` subnet and the HTTP Load Balancing add-on first; ingress health check on `/v1/health`; nodes with 2 vCPU / 4 GiB or more, two or more across zones.'],
          ['ECS (Terraform)', 'Module `portkey-gateway-infrastructure//terraform/ecs`, pinned with `?ref=`', 'Secrets Manager holds the registry login and client auth — the module takes their **ARNs**. `server_mode` `gateway`, `mcp` or `all`; `all` needs `mcp_gateway_base_url` and ALB host routing. 1 vCPU / 2 GiB per task. The only target with a documented upgrade procedure.'],
          ['Azure Container Apps (Terraform)', 'Module `…//terraform/aca`', 'Key Vault secret **names**. `server_mode: all` deploys separate gateway and MCP apps. The examples pin image tag `2.2.2` — far behind the changelog.'],
          ['Docker Compose on a VM', '`setup-panw-ai-gateway.sh --from-values values.yaml` (the `airs-ai-gateway-docker` repo)', 'Settings live in three files — `values.yaml`, `.env`, `.env.runtime` — each with its own syntax. Apply with `docker compose up -d --force-recreate`; a plain restart does not reload the environment.'],
        ],
        note: 'The architecture page adds Kubernetes 1.20+ with Helm 3.x, and 1–2 cores / 2–4 GB per gateway instance. The EKS, GKE and AKS pages install the legacy chart — see the last table.',
      },
      { type: 'links', title: 'Deployment pages', items: pick('agEks', 'agGke', 'agAks', 'agEcs', 'agAca', 'agPrivateNet', 'ghGwDocker', 'ghGwInfra') },
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
            text: [
              'Start from the downloaded file and add what your cluster needs. A production-shaped example follows.',
              '`SERVER_MODE` `all` or `mcp` needs `MCP_GATEWAY_BASE_URL` — the URL clients use to reach the MCP gateway, with `http://` or `https://`. The EKS page allows leaving it out of the first install: set it once the MCP load balancer has a hostname, then upgrade again.',
            ],
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
          ['Amazon Bedrock — same account', 'The pod\'s role (IRSA or EKS Pod Identity), or the instance/task role (IMDS)', 'Auth type **AWS Service Role** — no ARN, no key. Named in the ECS Terraform module\'s Bedrock doc and on the Bedrock Mantle and Claude Platform pages; the Bedrock page itself lists only Access Key, Assumed Role and Bedrock API Key.'],
          ['Amazon Bedrock — cross account', 'Credentials that may assume the role: an assumed-role access key (`AWS_ASSUME_ROLE_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` / `_REGION`), IRSA or IMDS', 'Auth type **AWS Assumed Role**: role ARN, External ID and region.'],
          ['Google Vertex AI', '`GCP_AUTH_MODE: workload`, the service account annotated `iam.gke.io/gcp-service-account`. From EKS: `GCP_WIF_AUDIENCE`, plus `GCP_WIF_SERVICE_ACCOUNT_EMAIL` to impersonate, and `sts:GetCallerIdentity` on the gateway role', 'Auth type **Workload Identity Federation** (the docs\' label), project id, no service-account JSON. The Google SA needs `roles/aiplatform.user`; the Kubernetes SA binding `roles/iam.workloadIdentityUser`.'],
          ['Azure OpenAI · Foundry', 'Managed identity (IMDS), AKS workload identity (the `AZURE_*` variables the webhook injects), or AWS → Entra federation', '`azureAuthMode` `managed`, `workload` or `entraFederated` — all three hybrid-only. Role on the resource: Cognitive Services OpenAI User.'],
        ],
        note: 'Bedrock permissions: `GetInferenceProfile` alone does not make `us.*` profiles work — `InvokeModel` and `InvokeModelWithResponseStream` must also allow the inference-profile ARN and the foundation-model ARN in every region the profile routes to. The EKS and ECS example policies scope Invoke to one regional foundation model, which would refuse a `us.*` call. And set `serviceAccount.automount: true` for any pod identity — the chart defaults to false.',
      },
      {
        type: 'table',
        title: 'Private upstreams: TRUSTED_CUSTOM_HOSTS',
        columns: ['Rule', 'Detail'],
        rows: [
          ['Why', 'A self-hosted gateway refuses private IP ranges and internal hostnames (SSRF protection). The log line: "Outbound request rejected by SSRF policy: <host> resolves to <ip>, which is blocked"; MCP clients may see only "Failed to restore session".'],
          ['Match the hostname', 'The list is checked against the **hostname in the URL**, not the IP it resolves to. `*.example.net` covers subdomains; a bare `example.net` does not.'],
          ['It replaces the defaults', 'Comma-separated, no spaces. With `NODE_ENV=production` the default list is empty, so re-add `localhost,127.0.0.1,::1,host.docker.internal` if you need them.'],
          ['Restart to apply', 'Read at startup only — roll the pods (Compose: `--force-recreate`).'],
          ['Never trusted', 'Cloud metadata endpoints, suffixes such as `cluster.local`, and non-HTTP ports like `5432` — even when listed.'],
          ['Hybrid only', 'On SaaS, upstream URLs must be publicly reachable. Since 2.23.0 Azure Storage and Key Vault Private Link domains are trusted by default.'],
        ],
      },
      { type: 'code', tabs: [{ id: 'bash', lang: 'bash', code: TRUSTED_HOSTS }] },
      {
        type: 'table',
        title: 'Prometheus metrics',
        columns: ['Setting', 'Default', 'Effect'],
        minWidth: 640,
        rows: [
          ['`GET /metrics`', 'on', 'Prometheus text format. The page calls it "typically open" and names no port — keep it on your monitoring network.'],
          ['`ENABLE_PROMETHEUS`', '`true`', '`false` removes the metrics middleware; `/metrics` then returns 404.'],
          ['Labels on every metric', '—', '`app` (`SERVICE_NAME`), `env` (`NODE_ENV`), `method`, `endpoint`, `code`, `provider`, `source`, `stream`, `cacheStatus`.'],
          ['`PROMETHEUS_INCLUDE_MODEL_LABEL`', '`false`', 'Adds `model` — high cardinality.'],
          ['`PROMETHEUS_INCLUDE_METADATA_LABELS` + `PROMETHEUS_LABELS_METADATA_ALLOWED_KEYS`', 'off', 'Allow-listed `x-portkey-metadata` keys become `metadata_<key>` labels.'],
          ['`PROMETHEUS_INCLUDE_CONFIG_NAME_LABEL` · `PROMETHEUS_INCLUDE_API_KEY_NAME_LABEL`', '`false`', '`config_name` and `api_key_name` (2.22.0). The same page\'s configuration section names `PROMETHEUS_EXTRA_LABELS=apiKeyName,configName` instead.'],
          ['`providerSlug` label', 'opt-in', 'The Model Catalog provider that served the request — changelog 2.23.0; the metrics page does not mention it or its switch.'],
        ],
        note: 'Metrics: `request_count` (counter); `llm_cost_sum` and `llm_token_sum` (gauges); histograms `http_request_duration_seconds`, `llm_request_duration_milliseconds`, `portkey_request_duration_milliseconds`, `portkey_processing_time_excluding_last_byte_ms`, `llm_last_byte_diff_duration_milliseconds`, `authentication_duration_milliseconds`, `api_key_rate_limit_check_duration_milliseconds`, `pre_request_processing_duration_milliseconds`, `post_request_processing_duration_milliseconds`, `llm_cache_processing_duration_milliseconds`, `grpc_req_conversion_duration_milliseconds`; plus Node runtime `node_*` metrics.',
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
          { title: 'Upgrade and verify', text: 'As above, with the new chart\'s `--version`.' },
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
          'There is no Helm upgrade page in the chart or in the developer docs; the commands above are standard Helm and kubectl, and the chart\'s docs only re-run `helm upgrade --install`. The one documented upgrade procedure is the ECS page\'s **Version Pinning and Upgrades**: pin the Terraform module with `?ref=`, read the module\'s releases, run `terraform init -upgrade`, `terraform plan`, `terraform apply`; roll back by reverting `ref` and applying again.',
          'Leave `dataservice` on its own tag: blanked, it falls back to the chart\'s `appVersion` — a gateway version number. Data service 1.7.0 and later need gateway 2.8.0 or later.',
          'When the management plane is unreachable the gateway keeps serving from cache — routing, rate limits, guardrails, response caching and log writes. ("Queues analytics" is in the chart\'s resiliency doc, not the AIGW pages.) New or changed integrations, keys, configs and prompts wait until it is back.',
          'The cache is **lazy**: an object enters it the first time a request uses it. So a key, config or provider used for the first time during a management-plane outage cannot be served — warm the paths you depend on. (Since 2.24.0, disabled MCP tools, resources and prompts stay disabled when the management plane is briefly unreachable; before, they became callable again for up to 5 minutes.)',
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
          ['Management-plane hosts and images', 'Allow `https://aigw.portkey.ai` and `https://albus.portkey.ai`; images from Docker Hub. One EKS example points `ALBUS_BASEPATH`, `CONTROL_PLANE_BASEPATH`, `SOURCE_SYNC_API_BASEPATH` and `CONFIG_READER_PATH` at `aws-cp.portkey.ai`', 'Defaults to `mp.us.prod.airs-gw.portkey.ai`, a host no doc page names; images from `registry.portkey.ai`'],
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
          { icon: Plug, tone: '#EC4899', title: 'Every auth type, SaaS vs hybrid', kicker: 'Model providers',
            text: 'Bedrock, Vertex, Azure and Claude Platform on AWS — which credentials each accepts, and which need your own data plane.', go: 'gw-providers' },
          { icon: Braces, tone: '#d946ef', title: 'Register a data plane from code', kicker: 'Admin API',
            text: '`POST /deployments` returns the client auth key; `GET /deployments/{id}/ping` checks the connection.', go: 'gw-admin-api' },
        ],
      },
    ],
  },
]
