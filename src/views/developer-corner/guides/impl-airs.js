import { Compass, Terminal, Waypoints, Cloud, Container, ClipboardList, Server, Layers, KeyRound, ScanSearch, Swords } from 'lucide-react'
import { pick } from './links'

/**
 * Prisma AIRS platform: how the pieces divide the work, network intercept in
 * the cloud, Kubernetes + microperimeter, and engagement scoping.
 *
 * Folded in from the community "Palo Alto Networks Implementation Guides"
 * (jollymahn.github.io/pan-implementation-guides — single author, not
 * official documentation, no licence file), rewritten and checked against the
 * AI Runtime Security admin guide (PDF, 2026-10-05) and pan.dev. Wherever the
 * two disagree, a `docs` callout names both sides. Nothing here was run from
 * this portal — no tab is marked `verified`.
 */

// ─── network intercept: cloud ──────────────────────────────────────────────

const DISCOVERY_TAGS_AWS = `# EC2 instances (AWS) or virtual machines (Azure) of firewalls SCM should discover
paloaltonetworks.com-monitored: enable
serialNumber: <serial-number>[,<serial-number>…]`

const DISCOVERY_TAGS_GCP = `# Compute Engine labels (GCP): underscore in the key, lowercase serial key
paloaltonetworks_com-monitored: enable
serialnumber: <serial-number>[,<serial-number>…]`

const TF_APPLY = `# The zip from SCM: architecture/{security_project,application_project}, modules/
unzip <template-name>.zip && cd architecture/security_project
terraform init && terraform plan && terraform apply
#   note lbs_external_ips and lbs_internal_ips from the output

cd ../application_project
terraform init && terraform plan && terraform apply
#   AWS: GWLB endpoints · Azure / GCP: peering with the security VNet / VPC`

const AZ_TERMS = `# Accept the Prisma AIRS image terms before terraform plan
# VERSION = vmseries_version in architecture/security_project/terraform.tfvars
az vm image accept-terms --urn paloaltonetworks:airs-flex:airs-byol:VERSION`

const INIT_CFG_SCM = `type=static
ip-address=192.0.2.10
default-gateway=192.0.2.1
netmask=255.255.255.0
hostname=airs-fw-01
panorama-server=cloud
plugin-op-commands=advance-routing:enable
dgname=<scm-folder>
dns-primary=<dns-1>
dns-secondary=<dns-2>
vm-series-auto-registration-pin-id=<pin-id>
vm-series-auto-registration-pin-value=<pin-value>`

const INIT_CFG_PANORAMA = `type=static
ip-address=192.0.2.10
default-gateway=192.0.2.1
netmask=255.255.255.0
hostname=airs-fw-01
panorama-server=<panorama-ip>
panorama-server-2=<panorama-ha-peer-ip>
vm-auth-key=<vm-auth-key>
plugin-op-commands=advance-routing:enable
dgname=<device-group>
tplname=<template-stack>
dns-primary=<dns-1>
vm-series-auto-registration-pin-id=<pin-id>
vm-series-auto-registration-pin-value=<pin-value>`

const BOOTSTRAP_TREE = `# Bootstrap folders, then build an ISO from them and attach it to the VM
mkdir -p content software plugins license config
printf '%s' '<auth-code>' > license/authcodes   # no spaces, no trailing newline
cp init-cfg.txt config/`

const FW_CHECKS = `> show system info
#   model: AI-Runtime-Security (PA-VM = VM-Series — wrong image or licence)
#   operational-mode: normal · device-certificate-status: Valid
#   private cloud: cloud-mode: non-cloud · advanced-routing: on
> show system bootstrap status
> request license info
> show running security-policy      # your AI rule is in the running config
> show session all                  # traffic is actually crossing the firewall`

// ─── Kubernetes + microperimeter ───────────────────────────────────────────

const HELM_VPC = `# Chart from the Terraform zip SCM generated (VPC-level protection)
cd <unzipped-folder>/architecture
helm install ai-runtime-security helm --namespace kube-system --values helm/values.yaml

# The DaemonSet is dormant until something is annotated
kubectl annotate namespace <namespace> paloaltonetworks.com/firewall=pan-fw
kubectl rollout restart deployment -n <namespace>   # existing pods pick it up on restart`

const HELM_NS = `# One chart per protected namespace (traffic steering inspection)
cd <unzipped-folder>/architecture
helm install ai-runtime-security helm-<app-name> --namespace kube-system --values helm-<app-name>/values.yaml

# Every pod needs the annotation; despite its value, it turns inspection ON
kubectl annotate pods --all -n <namespace> paloaltonetworks.com/subnetfirewall=ns-secure/bypassfirewall
kubectl rollout restart deployment -n <namespace>`

const HELM_OCP = `# OpenShift / Rancher: chart cloned from github.com/PaloAltoNetworks/prisma-airs-helm,
# Panorama-managed firewall, Multus as the meta-plugin
kubectl annotate namespace <namespace> k8s.v1.cni.cncf.io/networks=pan-cni
kubectl apply -f pan-cni-net-attach-def.yaml -n <namespace>   # in every app namespace`

const HELM_VERIFY = `helm list -A                                   # ai-runtime-security … deployed
kubectl get pods -A | grep pan-cni             # one Running pan-cni pod per node
kubectl get endpointslice -n kube-system | grep pan
#   internal LB IP, GWLB endpoint IPs or the firewall trust IP
kubectl get serviceaccounts,secrets,svc -n kube-system | grep pan
#   pan-cni-sa · pan-plugin-user-secret · pan-ngfw-svc
kubectl describe namespace <namespace> | grep paloaltonetworks.com`

const VALUES_AWS = `# GWLB endpoint IP per zone (VPC console → Endpoints → Subnets)
endpoints1: "<gwlb-endpoint-ip-zone-a>"
endpoints1zone: us-east-1a
endpoints2: "<gwlb-endpoint-ip-zone-b>"
endpoints2zone: us-east-1b
cniimage: gcr.io/pan-cn-series/airs/pan-cni:latest
namespace: kube-system
clusterid: 1          # 1–2048, unique per cluster; traffic objects reuse it`

const VALUES_ONPREM = `# Private cloud (OpenShift / Rancher): the firewall's trust interface
endpoints: <firewall-trust-ip>   # active firewall's trust IP in an HA pair
cniimage: gcr.io/pan-cn-series/airs/pan-cni:latest
fwtrustcidr: ""                  # optional: shortens east-west paths
namespace: kube-system
clusterid: 1`

const TAG_CLI = `# On the IP-tag collector deployed by the security_project Terraform
show system info | match tag-collector-mode          # tag-collector-mode: enabled
request plugins kubernetes set-tag-collector-config region            # list regions
request plugins kubernetes set-tag-collector-config region <scm-region>

configure
set deviceconfig plugins kubernetes setup cluster-credentials <cluster> \\
  api-server-address <api-endpoint> cluster-type EKS \\
  cluster-credential-file AWS-credentials-file <file> labels no-labels
set deviceconfig plugins kubernetes monitoring-definition <mon-def> \\
  cluster-credentials <cluster> enable yes          # one definition per cluster
set deviceconfig system service disable-userid-service no   # if User-ID is off
commit
exit
show plugins kubernetes status                       # Connected
show redistribution service client all               # the firewall, Redistribution ITUH

# On the AIRS firewall, after the DAG rule is pushed
show object registered-ip all                        # k8s.ns_<ns>, k8s.svc_<svc> tags`

const PANREDIRECT_LINUX = `# Package: Customer Support Portal → Updates → Software Updates → Traffic Redirector
chmod +x ./panredirect-installer && sudo ./panredirect-installer
panredirect version

# Firewall's dedicated data interface; exempt your own management source first
sudo panredirect configure --fwip <firewall-data-ip> --exception <mgmt-ip>
# Azure ILB with direct return: --fwip <ilb-frontend-ip> --fwsubnet <firewall-backend-cidr>

sudo panredirect enable <interface>     # creates pangnv0 (MTU 1440)
panredirect status                       # ACT = yes
panredirect health_check                 # OK, exit code 0 (1 = failed)

sudo systemctl enable --now panredirect  # survive reboots`

const PANREDIRECT_RULES = `panredirect rule list        # default: index 0 · any · any → redirect

# Keep SSH from the management range local — insert ahead of the catch-all
sudo panredirect rule insert --index 0 --interface <iface> --proto tcp \\
  --remoteip 10.0.0.0/8 --localport 22 --action pass

# Targeted model instead: delete the catch-all, add redirect rules for what needs inspection
sudo panredirect rule delete --index <n> --interface <iface>
sudo panredirect rule append --interface <iface> --proto tcp \\
  --remoteip <cidr> --localport <port> --action redirect
# First match wins, ascending index. With no catch-all, unmatched traffic stays local.`

const PANREDIRECT_WIN = `# panredirect.msi from the Customer Support Portal (GPO, Configuration Manager, Intune…)
# Needs a Prisma AIRS firewall on 12.1.5 or later
panredirect.exe configure --fwip <firewall-data-ip>
panredirect.exe enable "Ethernet" --commit
panredirect.exe status
panredirect.exe health_check
# Health-check tuning: --hc on|off, --hc_interval <s>, --hc_fail_count <n>`

const PANREDIRECT_DIAG = `sudo panredirect diag --out /tmp/microperimeter-diag.tar
#   fwdiag.pcap (10 s capture toward the firewall) · curl-test.out · ping-test.out
#   ip-rules.out · ip-show-routes.out · iptables-rules-t-filter.out
#   sysctl-all.out · package-list.out

# Uninstall (RHEL family; the docs give only dnf)
sudo panredirect stop
sudo panredirect disable <interface>
sudo systemctl disable panredirect
sudo dnf remove panredirect`

const HOST_FW = `# RHEL / Alma / Rocky with firewalld: open GENEVE before enabling redirection
sudo firewall-cmd --zone=public --add-port=6081/udp --permanent
sudo firewall-cmd --reload`

export const IMPL_AIRS = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'airs-platform',
    group: 'start',
    title: 'How the Prisma AIRS pieces divide the work',
    sub: 'Where each path inspects, what it can act on, and which console runs it',
    minutes: 8,
    level: 'Orientation',
    docs: pick('imAirsOverview', 'pdfRuntime', 'arPdfApiRegions', 'arPdfNetLimits', 'arNetVmFw', 'gwOverview'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Prisma AIRS is several products sharing one tenant and one console. **Choose your integration path** says what each one is; this guide is the layer above it — **where inspection actually happens**, **what each path can act on**, and **which console owns it**. It folds in a community implementation guide (one author, not official documentation), checked against the AI Runtime Security admin guide. Where the two disagree, a callout names both sides.',
          'Strata Cloud Manager is the control plane for all of it — licences, profiles, policy, logs — but it never sees traffic. Inspection happens in one of four places: a scan call from your code, an AI Gateway, a Prisma AIRS firewall, or a scanner in your pipeline.',
        ],
      },
      {
        type: 'table',
        title: 'Start from the question you can answer',
        columns: ['If…', 'Start with', 'Add later'],
        rows: [
          ['You own the app code and want the deepest coverage — grounding, custom topics, agent and tool-call checks', 'API intercept: scan calls around each model call', 'Model Security as a CI gate if you pull third-party models'],
          ['Many apps call LLMs and you need budgets, rate limits, model allow-lists and prompt logs in one place', 'AI Gateway, with the Prisma AIRS guardrail attached', 'API intercept inside apps that need agent or grounding checks'],
          ['You cannot change the apps (third-party, legacy) and they run as cloud VMs', 'Network intercept: an AIRS firewall in the path, from SCM-generated Terraform', 'Microperimeter for traffic that stays inside a subnet'],
          ['The AI workloads run on Kubernetes', 'Network intercept plus PAN-CNI (Helm)', 'IP-tag harvesting for label-based policy'],
          ['VMs talk to each other on one segment that never crosses a firewall', 'Microperimeter: the panredirect agent on each workload', '—'],
          ['You pull models from Hugging Face, object storage or a registry', 'AI Model Security in the pipeline', '—'],
          ['You need proof the controls work before go-live', 'AI Red Teaming against the protected app', 'A re-scan cadence'],
        ],
        note: 'Rebuilt as a table from the implementation guide\'s interactive "Integration Finder".',
      },
      {
        type: 'table',
        title: 'Where inspection actually happens',
        minWidth: 720,
        columns: ['Path', 'What you run', 'Where the verdict is made', 'Region'],
        rows: [
          ['API intercept', 'An HTTPS scan call from your code, the SDK, or a partner integration', 'Prisma AIRS cloud service', 'The deployment profile\'s region: US, EU (Germany), India or Singapore. Outside the US, URL categorisation runs out of region (Netherlands for EU, Singapore for India and Singapore).'],
          ['Network intercept', 'A Prisma AIRS firewall in your VPC/VNet, private cloud or cluster path', 'The firewall inspects L7 and forwards AI content to the AI security cloud service', 'Firewall: any cloud region. AI traffic: inspected in the US. Logs: the tenant\'s region (US, UK, India, Canada or Singapore).'],
          ['AI Gateway (SaaS)', 'Nothing — change the base URL and key', 'Palo Alto Networks-hosted data plane; the Prisma AIRS guardrail calls the Runtime API', 'Americas'],
          ['AI Gateway (hybrid)', 'The gateway data plane on your Kubernetes', 'Your cluster; SCM stays the control plane', 'Where you run it'],
          ['AI Model Security', 'The CLI or SDK in a pipeline', 'Model Security service', 'US, EU (Netherlands), Japan, Singapore'],
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Data residency: the sources agree only for the firewall',
        text: [
          'The implementation overview says AI content is inspected in the US whatever the path, API intercept included. The admin guide confirms it for network intercept ("All AI traffic is sent to the US region for threat inspection" — Runtime Firewall limitations). For API intercept it documents regional processing chosen with the deployment profile, with only URL categorisation leaving the region (API Intercept Supported Regions — a table that also lists Japan, which the pan.dev endpoint list does not).',
          'The overview also places Model Security in the US only; this portal\'s **Tenant, licence & credentials** lists US, EU (Netherlands), Japan and Singapore.',
        ],
      },
      {
        type: 'table',
        title: 'What each path can act on',
        minWidth: 820,
        columns: ['Threat or control', 'API intercept', 'Network intercept', 'AI Gateway', 'Model Security'],
        rows: [
          ['Prompt injection', 'Yes', 'Yes — AI model protection', 'Through the Prisma AIRS guardrail', '—'],
          ['Sensitive data (DLP)', 'Yes; masking with a basic DLP profile set to Block', 'Yes — DLP data rule', 'Through the AIRS guardrail — blocks, does not redact', '—'],
          ['Toxic content', 'Yes', 'Yes — per severity (Moderate, High)', 'Through the AIRS guardrail', '—'],
          ['Malicious URLs', 'Yes', 'Yes — URL security', 'Through the AIRS guardrail', '—'],
          ['AI-generated SQL', 'Yes (responses)', 'Yes — allow / alert / block per CRUD operation', 'Through the AIRS guardrail', '—'],
          ['Ungrounded answers', 'Yes, when you send `context`', 'No — the admin guide lists grounding as API-intercept only', 'Not documented', '—'],
          ['Custom topics', 'Yes', 'No option in the AI security profile', 'Through the AIRS guardrail', '—'],
          ['Agent and MCP tool threats', 'Yes — `tool_event`, AI agent protection', 'Not an AI security profile option; the admin guide\'s MCP detection procedure uses the scan API', 'No — MCP guardrails exclude partner checks', '—'],
          ['Which models may be called', '—', 'Model groups: Allow or Block', 'Model allow-lists, access policies', '—'],
          ['Budgets, rate limits', 'Quota-derived limits only', '—', 'Per workspace, key or policy', '—'],
          ['Pod-level Kubernetes policy', '—', 'PAN-CNI plus harvested IP tags', '—', '—'],
          ['Code in model files, backdoors, licences', '—', '—', '—', 'Yes'],
          ['Prompt content for audit', 'Scan logs and reports', 'AI security logs with snippets', 'Full prompt logs', '—'],
        ],
        note: 'From the admin guide\'s profile options and this portal\'s AI Gateway findings. The gateway\'s AIRS guardrail applies whatever the named profile enables, on the text of chat, messages and responses calls only. AI Red Teaming is not a control: it tests for every row before release.',
      },
      {
        type: 'callout', tone: 'docs', title: '"The AI Gateway has no injection or DLP detection"',
        text: 'The implementation overview scores the AI Gateway "none" for prompt injection, sensitive data, toxic content and URLs, and tells you to pair it with API intercept for any threat coverage. The AI Gateway admin guide says gateway guardrails block prompt injection, detect sensitive data and can invoke Prisma AIRS inspection; this portal measured the Prisma AIRS guardrail blocking the same injection on a Vertex and a Bedrock model. What holds: the gateway\'s own basic checks are not Prisma AIRS, the AIRS guardrail reads text only (no images, files or MCP tool calls), and it blocks rather than redacts.',
      },
      {
        type: 'callout', tone: 'docs', title: 'Database security on the firewall',
        text: 'The overview\'s coverage map marks AI-generated database queries as API-intercept-only. The same author\'s network intercept guide and the admin guide both put Database Security — allow, alert or block per Create, Read, Update and Delete — in the firewall\'s AI security profile under AI data protection, with its own log subtype `database-security`.',
      },
      {
        type: 'table',
        title: 'Which console runs what',
        columns: ['Task', 'Strata Cloud Manager', 'Panorama'],
        rows: [
          ['AI security profiles, policy, interfaces, zones and routing on AIRS firewalls', 'Yes', 'Yes — Panorama 11.2.5 or later with the CloudConnector plug-in 2.1.0'],
          ['Template stacks and device groups', '— (folders instead)', 'Yes'],
          ['AI security logs', 'Log Viewer → Firewall/AI Security', 'Monitor → Logs → Threat, subtype `ai-security`'],
          ['Cloud account onboarding, discovery, Terraform generation, autoscaling', 'Yes', 'No — generated in SCM even for Panorama-managed firewalls'],
          ['Licence activation, TSG, Strata Logging Service, deployment profiles', 'Hub and Customer Support Portal', 'No'],
          ['API intercept apps, keys and profiles; AI Gateway; Model Security; Red Teaming', 'Yes', 'No'],
        ],
      },
      {
        type: 'facts',
        min: 210,
        items: [
          { label: 'API intercept', value: 'allow · block', sub: 'Each enabled detector returns a boolean; one that fires with Block makes the scan `block`. Your code enforces it.' },
          { label: 'Network intercept', value: 'Allow · Alert · Block', sub: 'A block resets the session, or returns a custom HTTP error page (PAN-OS 11.2.11+). Past Max Inline Latency (1–300 s) the Inline Timeout Action decides.' },
          { label: 'AI Gateway', value: 'Guardrail verdict', sub: 'On the SCM tenant an AIRS block comes back as HTTP 200 with the content replaced; the docs say 446.' },
          { label: 'AI Model Security', value: 'ALLOWED · BLOCKED', sub: 'One failing **blocking** rule blocks the model; non-blocking rules only record findings.' },
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Two more places the overview drifts',
        text: [
          'It describes cloud network intercept as the `panredirect` agent on every Linux workload, tunnelled over GENEVE, and PAN-CNI as GENEVE too. The author\'s own cloud deployment guide and the admin guide steer cloud traffic with load balancers, GWLB endpoints, transit gateway or peering and route tables — no agent on the workload. `panredirect` (GENEVE, UDP 6081) is the microperimeter agent; PAN-CNI is CNI chaining that tunnels pod traffic out of the cluster.',
          'It names the Model Security result `aggregate_eval_outcome` with PASS / FAIL. The SDK and CLI this portal runs return `eval_outcome` with ALLOWED / BLOCKED (see **Scan a model**).',
        ],
      },
      {
        type: 'cards',
        items: [
          { icon: Compass, tone: '#0ea5e9', title: 'The five paths', kicker: 'Start here',
            text: 'What each product is, and how the runtime paths compare.', go: 'overview', goLabel: 'Choose your path' },
          { icon: Terminal, tone: '#f43f5e', title: 'API intercept', kicker: 'In your code',
            text: 'One scan call before the model and one after.', go: 'rt-first-scan', goLabel: 'First scan' },
          { icon: Waypoints, tone: '#EC4899', title: 'AI Gateway guardrail', kicker: 'In the traffic path',
            text: 'Attach Prisma AIRS to every request — and read a block correctly.', go: 'gw-guardrail', goLabel: 'The AIRS guardrail' },
          { icon: Cloud, tone: '#06b6d4', title: 'Network intercept in the cloud', kicker: 'AWS · Azure · GCP · private cloud',
            text: 'Licence to connected firewall to pushed AI security profile.', go: 'net-deploy-cloud', goLabel: 'Deploy' },
          { icon: Container, tone: '#06b6d4', title: 'Kubernetes and microperimeter', kicker: 'East-west, no code change',
            text: 'PAN-CNI for pods, panredirect for VMs.', go: 'net-deploy-k8s', goLabel: 'Protect east-west' },
          { icon: ClipboardList, tone: '#0ea5e9', title: 'Scope an engagement', kicker: 'Phases · prerequisites · people',
            text: 'A reusable plan for a multi-pillar rollout.', go: 'airs-planner', goLabel: 'Plan it' },
        ],
      },
      { type: 'links', title: 'Sources', items: pick('imAirsOverview', 'imAirsCoverage', 'imAirsResidency', 'imApiIntercept', 'arPdfApiRegions', 'arPdfNetLimits', 'gwOverview') },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'net-deploy-cloud',
    group: 'network',
    title: 'Network intercept on AWS, Azure and GCP',
    sub: 'From licence to a connected AIRS firewall and a pushed AI security profile',
    minutes: 15,
    level: 'Deploy',
    docs: pick('imNetIntercept', 'imCloudDeploy', 'arNetDeployCloud', 'arNetAutoExec', 'arNetDeployProfile', 'arNetCloudOnboard', 'arNetModels', 'pdfRuntime'),
    blocks: [
      {
        type: 'prose',
        text: [
          '**Network intercept — deployment options** lists the paths; this guide walks one end to end, following a community implementation guide (its core and cloud-deployment guides) checked against the AI Runtime Security admin guide. Order matters: licence and logging first, then cloud onboarding so SCM can see the workloads, then the firewall, then the AI security profile and policy.',
          'Two choices decide most of the work: the **deployment model** (who runs Terraform) and the **firewall type** — only the Prisma AIRS AI Runtime Firewall inspects AI traffic.',
        ],
      },
      {
        type: 'table',
        title: 'Six deployment models',
        minWidth: 680,
        columns: ['Model', 'Clouds', 'Managed by', 'Who runs Terraform', 'Pick it when'],
        rows: [
          ['SCM Terraform download', 'AWS, Azure, GCP', 'SCM or Panorama', 'You', 'You want full control of the infrastructure — the default path'],
          ['Auto-Execute', 'AWS, Azure', 'SCM only', 'SCM', 'Fastest: SCM builds the security VPC/VNet, firewalls, load balancers and routes; supports Cloud Mesh'],
          ['Panorama-managed', 'AWS, Azure, GCP', 'Panorama', 'You', 'Panorama already manages your firewalls'],
          ['VM-Series from SCM', 'AWS, Azure, GCP', 'SCM or Panorama', 'You', 'Non-AI workloads only — VM-Series does not inspect AI traffic'],
          ['Private cloud', 'ESXi, KVM (OpenShift, Rancher for containers)', 'SCM or Panorama', '— (ISO bootstrap)', 'On-premises apps calling public-cloud models'],
          ['Manual bootstrap', 'Any', 'SCM or Panorama', 'You', 'Brownfield networks the generated Terraform does not fit'],
        ],
      },
      {
        type: 'table',
        title: 'The firewall type decides what can be inspected',
        columns: ['Traffic', 'Prisma AIRS AI Runtime Firewall', 'VM-Series'],
        rows: [
          ['App → AI model', 'Yes', 'No'],
          ['Kubernetes namespaces and cluster traffic', 'Yes', 'No'],
          ['Other VPC / VNet traffic', 'Yes', 'Yes'],
        ],
        note: 'Selecting any namespace in the SCM wizard removes the VM-Series option. From PAN-OS 11.2.11 / 12.1.5 one universal image runs as either, depending on the licence (file name `PanOS_vm-X.X.X`), on x86 or ARM.',
      },
      {
        type: 'facts',
        min: 190,
        items: [
          { label: 'Licence', value: 'NGFW credits', sub: 'A deployment profile sets instances and vCPUs; capacity is 10,000 AI transactions per day per vCPU.' },
          { label: 'PAN-OS', value: '11.2.11 / 12.1.5+', sub: 'The profile wizard still says "PAN-OS 11.2.2 and above" — see below.' },
          { label: 'Panorama (if used)', value: '11.2.5+', sub: 'With the CloudConnector plug-in 2.1.0.' },
          { label: 'Terraform', value: '> 1.3, < 2.0', sub: 'For the download and Panorama-managed models.' },
          { label: 'Management plane', value: 'US · UK · IN · CA · SG', sub: 'SCM and TSG regions. Firewalls run in any cloud region; AI traffic is inspected in the US.' },
          { label: 'Cloud management', value: 'Support case', sub: 'Palo Alto Networks support enables it for network intercept: give them the TSG ID, tenant name and region.', accent: true },
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Which PAN-OS, how many vCPUs',
        text: 'The implementation guide gives PAN-OS 11.2.2 (the deployment-profile option) as the minimum and 4 vCPUs per instance as a licence rule. The admin guide\'s AIRS VM Firewall section now lists PAN-OS 11.2.11, 12.1.5 or later. The public-cloud wizard requires at least 4 vCPUs, but the private-cloud VM is documented at 2 CPUs and 4.5 GB, and the universal-image prerequisites at 2 vCPUs.',
      },
      {
        type: 'steps',
        title: 'Foundation: licence, logging, certificate, deployment profile',
        steps: [
          { title: 'Activate the licence', text: 'Open the activation link in the purchase email, sign in to the Hub with your Customer Support account and associate the Prisma AIRS AI Runtime Firewall subscription. A credit pool appears under Software/Cloud NGFW Credits.', path: ['Customer Support Portal', 'Products', 'Software/Cloud NGFW Credits'] },
          { title: 'Activate Strata Logging Service on the tenant', text: 'A new or existing TSG (one SLS instance per tenant) and a region. SLS must be active before cloud onboarding. An expired subscription has a 30-day grace period before logs are deleted.' },
          { title: 'Generate a device-certificate PIN', text: 'Save the PIN ID and PIN value immediately — the firewall needs both at bootstrap, and the PIN expires.', path: ['Customer Support Portal', 'Products', 'Device Certificates', 'Generate Registration PIN'] },
          { title: 'Create the deployment profile', text: 'Type Prisma AIRS: AI Runtime Security (Firewalls), "PAN-OS 11.2.2 and above", number of instances, vCPUs per instance. The deprecated AI Runtime Security (Instance) type can no longer be created.', path: ['Software/Cloud NGFW Credits', 'Create Deployment Profile'] },
          { title: 'Associate it with the TSG and record the auth code', text: 'Account, tenant (the one with SLS), region, profile; Cloud Identity Engine is recommended. Keep existing profiles checked — unchecking one breaks its association. Allow up to 30 minutes.', path: ['Credit pool', 'Finish Setup'] },
        ],
      },
      {
        type: 'steps',
        title: 'Onboard the cloud account so SCM can see the workloads',
        steps: [
          { title: 'Add the account', text: 'AWS account ID, Azure subscription ID or GCP project ID. SCM generates the access to create — an IAM role (CloudFormation or Terraform), a service principal or managed identity with at least Reader, or a service account. Apply it, then Validate.', path: ['AI Security', 'AI Runtime', 'AI Runtime Firewall', 'Cloud Account Manager', 'Add Cloud Account'] },
          { title: 'Define what counts as an application', text: 'The Application Definition criteria decide which workloads the deployment wizard offers later. Apps missing from the wizard usually mean these need editing.' },
          { title: 'Tag existing firewalls you want discovered', text: 'Only for firewalls you already run; the SCM-generated Terraform tags its own.', code: [
            { id: 'aws', label: 'AWS · Azure', lang: 'yaml', code: DISCOVERY_TAGS_AWS },
            { id: 'gcp', label: 'GCP', lang: 'yaml', code: DISCOVERY_TAGS_GCP },
          ] },
          { title: 'Read the Cloud Asset Map', text: 'Regions and VPCs/VNets show green (protected), orange (partial) or red (unprotected); the Models, Internet and Users views show which flows still need a firewall. Deleted assets can linger for 24 hours.' },
        ],
      },
      {
        type: 'steps',
        title: 'SCM Terraform download — the default path',
        steps: [
          { title: 'Start the wizard', text: 'Pick the cloud and the traffic to inspect: AI queries and responses, inbound to cloud apps, outbound from cloud apps, inter-VPC/VNet — or all of it. Choose **Download Terraform templates and execute on my own**.', path: ['AI Security', 'AI Runtime Firewall', 'Add Protections (+)'] },
          { title: 'Pick region, account and applications', text: 'AWS: per app, an availability zone and an unused CIDR inside the app VPC for the GWLB endpoint. Azure: undiscovered VNets by name, CIDR and resource group (plus cluster ID). GCP: an ephemeral or reserved public IP for the external load balancer; undiscovered VPCs can carry pod and service CIDRs.' },
          { title: 'Namespaces: inspect or bypass CIDRs', text: 'Container apps are fully inspected by default; up to 10 CIDRs per cluster can be inspected or bypassed. Select the namespace, not its parent VPC — one GWLB endpoint cannot serve both in the same zone.' },
          { title: 'Deployment parameters', text: 'Type AI Runtime Security; number of firewalls; zones covering every application zone; an instance type of at least 4 vCPUs; static or dynamic scaling. Dynamic adds a min–max count, a metric namespace, a 1–60 minute interval and thresholds on metrics such as dataplane CPU, packet buffer, active sessions or SSL proxy utilisation.' },
          { title: 'IP addressing', text: 'AWS: an unused CIDR for the security VPC and a new or existing transit gateway, optionally cross-zone load balancing. Azure: an unused security VNet CIDR. GCP: CIDRs for the untrust, trust and management VPCs.' },
          { title: 'Licensing and management', text: 'PAN-OS version, the auth code, the PIN ID and value; management CIDRs and an SSH public key; an SCM folder — or Panorama IPs, VM auth key, device group and template stack. AWS adds NAT gateway and overlay routing (PAN-OS 11.2.8+); see the table below.' },
          { title: 'Create and download the template', text: 'Lowercase letters, digits and hyphens, no hyphen at either end, under 19 characters. The zip holds `architecture/` — with `security_project` and `application_project` — and `modules/`.' },
          { title: 'Accept the marketplace terms, then apply', text: 'AWS: subscribe in AWS Marketplace to the same image you will use for the firewall and the tag collector. Azure: accept the image terms. Then the security project first, the application project second.', code: [
            { id: 'bash', label: 'Terraform', lang: 'bash', code: TF_APPLY },
            { id: 'az', label: 'Azure terms', lang: 'bash', code: AZ_TERMS },
          ], note: 'The security project also deploys the IP-tag collector used for Kubernetes label-based policy.' },
          { title: 'Azure: associate the route table', text: 'After the application project, attach the route table it created to each application subnet — the step people miss.', path: ['Virtual networks', '<app VNet>', 'Subnets', 'Route table'] },
          { title: 'Wait for Connected', text: 'Bootstrap takes several minutes; allow 15 before troubleshooting. Panorama-managed templates show "Not Deployed" in SCM by design — check the Managed By column.', path: ['Workflows', 'NGFW Setup', 'Device Management', 'Cloud Managed Devices'] },
        ],
      },
      {
        type: 'table',
        title: 'AWS egress: overlay routing × NAT gateway',
        columns: ['', 'Overlay routing on (PAN-OS 11.2.8+)', 'Overlay routing off'],
        rows: [
          ['NAT gateway off', 'Dual-arm (eth1/1 + eth1/2); eth1/2 has a public IP and egresses straight to the internet gateway — no NAT gateway cost', 'Single-arm (eth1/1)'],
          ['NAT gateway on', 'Dual-arm; eth1/2 is private and egresses through the NAT gateway — no public IP cost', 'Single-arm; all egress through the NAT gateway'],
        ],
      },
      {
        type: 'checklist',
        title: 'Auto-Execute: what changes',
        items: [
          'AWS and Azure only, Strata Cloud Manager only, AIRS firewalls only.',
          'Choose **Auto-Execute** in the wizard, or start from an unprotected app on the Cloud Asset Map (Add Protection).',
          'AWS needs an **existing** transit gateway — the wizard cannot create one — plus a new or existing Resource Access Manager share.',
          'Do not pre-create the GWLB endpoint subnets: SCM creates them from your CIDRs, and an existing subnet fails the pre-deployment check.',
          'Cloud Mesh (tunnels between firewalls across clouds and regions) needs an SCM folder that holds the Auto-VPN configuration.',
          'Follow progress on the Cloud Task log (shield icon); the implementation guide estimates 15–30 minutes.',
          'Decommission from the Terraform Templates tab after disabling and re-enabling the cloud account: firewalls and cloud resources go, credits return. Mesh deployments on AWS need `ec2:RevokeSecurityGroupIngress` in the IAM role first.',
        ],
      },
      {
        type: 'code',
        title: 'Private cloud and manual bootstrap',
        tabs: [
          { id: 'scm', label: 'init-cfg.txt · SCM', lang: 'bash', code: INIT_CFG_SCM, file: 'config/init-cfg.txt' },
          { id: 'panorama', label: 'init-cfg.txt · Panorama', lang: 'bash', code: INIT_CFG_PANORAMA, file: 'config/init-cfg.txt' },
          { id: 'iso', label: 'Bootstrap folders', lang: 'bash', code: BOOTSTRAP_TREE },
        ],
      },
      {
        type: 'table',
        title: 'init-cfg.txt keys that matter',
        columns: ['Key', 'Value', 'Notes'],
        rows: [
          ['`panorama-server`', '`cloud`, or a Panorama IP', '`cloud` registers the firewall with Strata Cloud Manager'],
          ['`plugin-op-commands`', '`advance-routing:enable`', 'Logical routers — the only option under SCM; Panorama can also use virtual routers (omit the key)'],
          ['`dgname`', 'SCM folder or device group', ''],
          ['`tplname`, `vm-auth-key`, `panorama-server-2`', 'Template stack, auth key, HA peer', 'Panorama only'],
          ['`vm-series-auto-registration-pin-id` / `-pin-value`', 'The device-certificate PIN', 'Missing or expired → certificate status None'],
          ['`mgmt-interface-swap`', '`enable`', 'Public cloud, firewall behind a load balancer'],
          ['`type`', '`static` or `dhcp-client`', 'Static needs `ip-address`, `default-gateway`, `netmask`; DHCP takes the four `dhcp-*` keys'],
        ],
        note: 'Private cloud: download the ESXi `.ova` or KVM `.qcow2` ("PAN-OS for AI Runtime Security … Base Images" under Customer Support Portal → Updates → Software Updates), create a VM with three interfaces (management, client side, server side), boot it with the ISO. Manual public-cloud deployments also need the tags `paloaltonetworks.com-trust` and `-occupied` (GCP: `paloaltonetworks_com-…`) with unique values, and a trust interface name ending in `-trust-vpc`.',
      },
      {
        type: 'steps',
        title: 'The AI security profile and the policy',
        steps: [
          { title: 'Create the AI security profile', text: 'Scope Global or a folder. In Panorama it lives under Objects → Security Profiles → AI Security — and deleting the default model group there makes the commit fail.', path: ['Configuration', 'NGFW and Prisma Access', 'Security Services', 'AI Security', 'Add Profile'] },
          { title: 'Configure model groups', text: 'Every profile starts with a default group that catches unlisted models. Add groups by target model — names match by prefix, so `gemini-1.5-pro` also covers `-001` and `-latest` — then set access to Allow or Block. Blocked models are denied and logged as `model-denied`.' },
          { title: 'Set request and response protections', text: 'Per model group, per direction — see the table below. SCM can copy settings between Request and Response.' },
          { title: 'Advanced settings', text: 'Max Inline Latency (1–300 s) and an Inline Timeout Action: Allow, Alert (keep detecting asynchronously) or Block. Custom Model Support forwards **all** traffic matching the profile to the AI security cloud, not only known model endpoints — scope the rule to your custom endpoints.', note: 'The implementation guide suggests starting at 5 s with Alert; the admin guide\'s medical-assistant use case also uses 5 s with asynchronous detection.' },
          { title: 'Decrypt', text: 'Prompts travel over TLS. Add an SSL Forward Proxy decryption rule and have the workloads trust the firewall\'s root CA, or there is no prompt to inspect.' },
          { title: 'Bundle, attach, push', text: 'Put the profile in a security profile group, reference the group in an Allow rule that matches the app → model zones (or a dynamic address group), and push — in Panorama, Commit and Push.' },
        ],
      },
      {
        type: 'table',
        title: 'Protections per model group',
        columns: ['Pillar', 'Request', 'Response'],
        rows: [
          ['AI model protection', 'Prompt injection: Alert or Block · Toxic content: per severity (Moderate, High)', 'Toxic content: per severity'],
          ['AI application protection', 'URL security: a default action plus per-category exceptions', 'The same'],
          ['AI data protection', 'DLP data rule — a predefined or custom Enterprise DLP profile', 'DLP data rule · Database security: Allow / Alert / Block per Create, Read, Update, Delete'],
        ],
        note: 'Keep High toxicity at least as strict as Moderate — the UI warns otherwise. Prompt injection and toxic content cover English, Spanish, Russian, German, French, Japanese, Portuguese, Italian and Simplified Chinese.',
      },
      {
        type: 'callout', tone: 'docs', title: 'Decryption is missing from the implementation guide',
        text: 'None of the community network-intercept guides mention decryption, so their validation tests can pass HTTPS traffic uninspected. The admin guide calls SSL/TLS decryption optional on one VM-workload page, but includes it in the post-deployment workflow "to detect and enforce AI security protection". For HTTPS model APIs, treat it as required.',
      },
      {
        type: 'code',
        title: 'Validate from the firewall CLI',
        tabs: [{ id: 'panos', label: 'PAN-OS CLI', lang: 'bash', code: FW_CHECKS }],
      },
      {
        type: 'table',
        title: 'What the logs call it',
        columns: ['Incident type', 'Subtype', 'Raised when'],
        rows: [
          ['`ai-model-protection`', '`prompt-injection`', 'Injection detected in a request'],
          ['`ai-app-protection`', '`url-security`', 'A URL category set to Alert or Block matched'],
          ['`ai-data-protection`', '`data-rule`', 'A DLP profile matched (the log names it)'],
          ['`ai-data-protection`', '`database-security`', 'An AI-generated Create, Read, Update or Delete query'],
          ['`model-denied`', '—', 'The model group\'s access is Block'],
          ['`latency-block`', '—', 'Inspection exceeded Max Inline Latency and the timeout action is Block'],
        ],
        note: 'With Strata Logging Service: Incidents and Alerts → Log Viewer → Firewall/AI Security. Without it (e.g. Panorama only): threat logs with subtype `ai-security`, named like "AI Prompt Injection: GCP - Gemini 1.5 Flash". Test with a benign prompt, an injection, a fake identifier and a known-bad URL — from a host whose route actually crosses the firewall.',
      },
      {
        type: 'table',
        title: 'When it does not work',
        columns: ['Symptom', 'Likely cause and fix'],
        rows: [
          ['Firewall never shows Connected', 'The management subnet lacks outbound HTTPS to `api.paloaltonetworks.com`, `api.sase.paloaltonetworks.com` and `*.gpcloudservice.com` (443–444); or a wrong auth code or PIN in the bootstrap'],
          ['Certificate Invalid or None', 'PIN expired or missing; OCSP / CRL on TCP 80 blocked'],
          ['`terraform plan` fails on the subscription', 'Marketplace terms not accepted'],
          ['Auto-Execute pre-deployment check fails', 'GWLB endpoint subnets already exist, or no transit gateway in the region'],
          ['No sessions at all', 'Routes do not send traffic through the firewall — on Azure, the route table is not associated'],
          ['Sessions but no AI security logs', 'The profile group is not on the matching rule, traffic is not decrypted, or the model is in no group and Custom Model Support is off'],
          ['`latency-block` logs', 'Raise Max Inline Latency, or switch the timeout action to Alert'],
          ['Transactions capped', '10,000 AI transactions per day per vCPU — add vCPUs to the deployment profile or narrow the rule'],
        ],
      },
      {
        type: 'cards',
        items: [
          { icon: Server, tone: '#06b6d4', title: 'All deployment options', kicker: 'Network intercept',
            text: 'The short overview, including Panorama and Managed AIRS for AWS.', go: 'ni-deploy', goLabel: 'Deployment options' },
          { icon: Container, tone: '#06b6d4', title: 'Kubernetes and microperimeter', kicker: 'Next',
            text: 'Bring pod and same-subnet traffic to the firewall you just deployed.', go: 'net-deploy-k8s', goLabel: 'Protect east-west' },
          { icon: Layers, tone: '#0ea5e9', title: 'How the pieces divide the work', kicker: 'Context',
            text: 'What the firewall covers that the API and gateway do not — and the reverse.', go: 'airs-platform', goLabel: 'Compare' },
        ],
      },
      { type: 'links', title: 'Sources', items: pick('imNetIntercept', 'imNetSecConfig', 'imNetValidation', 'imNetTrouble', 'imCloudDeploy', 'imCloudTerraform', 'imCloudAutoExec', 'imCloudPrivate', 'imCloudBootstrap', 'arNetDeployCloud', 'arNetAutoExec', 'arNetDeployProfile', 'arNetCloudOnboard', 'arNetModels', 'arPdfNetLimits', 'arPdfBootstrap', 'arPdfAiLogs') },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'net-deploy-k8s',
    group: 'network',
    title: 'Kubernetes protection and microperimeter',
    sub: 'PAN-CNI for pods, panredirect for VMs — east-west inspection without code changes',
    minutes: 14,
    level: 'Deploy',
    docs: pick('imK8s', 'imMicro', 'arNetK8s', 'arNetIpTags', 'arNetMicro', 'arPdfK8sBasics', 'arPdfMicroDeploy', 'pdfRuntime'),
    blocks: [
      {
        type: 'prose',
        text: [
          'Two mechanisms bring east-west traffic to a Prisma AIRS firewall without touching the application. **PAN-CNI** is a Helm-installed CNI plug-in chained after your cluster\'s own CNI; it tunnels annotated pods\' traffic out of the cluster to the firewall. **Microperimeter** is the `panredirect` agent, which hairpins a VM\'s traffic through the firewall over GENEVE and back.',
          'Both assume a connected AIRS firewall with an AI security profile — see **Network intercept on AWS, Azure and GCP**. The steps follow the community implementation guides for Kubernetes and microperimeter, checked against the admin guide.',
        ],
      },
      {
        type: 'table',
        title: 'Which one',
        columns: ['', 'PAN-CNI (Kubernetes)', 'Microperimeter (panredirect)'],
        rows: [
          ['Protects', 'Pods in annotated namespaces, or annotated pods', 'VM workloads, including same-subnet traffic that never crosses a firewall'],
          ['Installed as', 'A Helm chart → DaemonSet in `kube-system`', 'A package on each workload (Linux; a Windows `.msi` in a newer admin-guide section)'],
          ['Path to the firewall', 'CNI chaining to GWLB endpoints (AWS), the internal load balancer (Azure, GCP) or the firewall trust IP (private cloud)', 'GENEVE over UDP 6081 to a dedicated firewall interface, then back to the host'],
          ['Policy granularity', 'A zone per cluster (traffic objects); Kubernetes labels via harvested IP tags', 'Firewall policy on the microperimeter zone; pass / redirect rules on the agent'],
          ['Firewall', 'Prisma AIRS only', 'Prisma AIRS only'],
        ],
      },
      {
        type: 'table',
        title: 'Clusters and versions',
        columns: ['Item', 'Supported'],
        rows: [
          ['Kubernetes', '1.30 or later, CNI specification 0.4.0+'],
          ['Platforms', 'EKS, AKS, GKE Standard, Rancher / RKE2, OpenShift 4.18–4.21, self-managed — not GKE Autopilot (no changes allowed in `kube-system`)'],
          ['Primary CNI', 'Calico or Cilium (AWS, Azure, GCP, Rancher, self-managed); AWS VPC CNI; Azure default and overlay CNI; GCP Dataplane V2; OVN on OpenShift'],
          ['Container runtimes', 'Docker, containerd, CRI-O'],
          ['Private cloud (OpenShift, Rancher)', 'Panorama 11.2.5+, Kubernetes plug-in 3.0.4, Multus; chart from the prisma-airs-helm GitHub repository'],
          ['Tag harvesting', 'Kubernetes plug-in 3.1.0+ and Cloud Identity Engine; cluster scope disputed — see the callout below'],
          ['AKS', 'Azure CNI with "Bring your own Azure virtual network", so PAN-CNI can discover the VNets'],
        ],
      },
      {
        type: 'table',
        title: 'Firewall preparation differs per cloud',
        minWidth: 760,
        columns: ['Cloud', 'Interfaces', 'Routing', 'NAT'],
        rows: [
          ['AWS', 'Overlay routing: eth1/1 trust (untick the DHCP default route) + eth1/2 untrust. Otherwise eth1/1 only — the GWLB steers.', 'Trust router: 10/8, 172.16/12, 192.168/16 via the eth1/1 gateway, default to the untrust router; the untrust router sends RFC 1918 back', 'Source NAT trust → untrust on eth1/2, overlay only'],
          ['Azure', 'eth1/1 trust on `vr-private`, eth1/2 untrust on `vr-public`, a loopback with the internal LB IP and an HTTPS management profile', 'Two routers — one router breaks the Azure health probe `168.63.129.16/32`. App VNet, pod and service CIDRs and the probe route on both; default via `vr-public`', 'Inbound (to the app) and outbound (source NAT on eth1/2)'],
          ['GCP', 'eth1/1 trust and eth1/2 untrust (DHCP), a loopback with the internal LB IP', 'One logical router; routes for the LB IP and the pod and service CIDRs', 'Source NAT trust → untrust'],
        ],
        note: 'SCM: Configuration → NGFW and Prisma Access → Device Settings → Interfaces / Zones / Routing, and Network Policies → NAT. Panorama uses the same objects (routers `lr-private` / `lr-public`). Gather each cluster\'s pod and service CIDRs first, and let the cloud load balancer\'s health checks reach the internal LB IP.',
      },
      {
        type: 'code',
        title: 'Install PAN-CNI and turn it on',
        tabs: [
          { id: 'vpc', label: 'VPC-level', lang: 'bash', code: HELM_VPC },
          { id: 'ns', label: 'Namespace-level', lang: 'bash', code: HELM_NS },
          { id: 'ocp', label: 'OpenShift (Multus)', lang: 'bash', code: HELM_OCP },
          { id: 'verify', label: 'Verify', lang: 'bash', code: HELM_VERIFY },
        ],
      },
      {
        type: 'code',
        title: 'values.yaml',
        tabs: [
          { id: 'aws', label: 'AWS', lang: 'yaml', code: VALUES_AWS, file: 'architecture/helm/values.yaml' },
          { id: 'onprem', label: 'Private cloud', lang: 'yaml', code: VALUES_ONPREM, file: 'helm/values.yaml' },
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'The annotation that sounds like a bypass',
        text: [
          '`paloaltonetworks.com/subnetfirewall=ns-secure/bypassfirewall` reads like an exemption. The admin guide uses it for namespace-level security "with traffic steering inspection" and says every pod needs it to reach the protected state; the implementation guide agrees that it does not bypass anything. What is inspected or bypassed is set in the chart — the CIDRs chosen in the wizard, `FIREWALL` / `BYPASS` in its custom resource — not by this annotation.',
          'Azure and GCP charts need only `clusterid` and `namespace` checked. Namespace-level deployments get one chart per namespace; Helm release names must be unique in `kube-system`, so give each install its own name.',
        ],
      },
      {
        type: 'steps',
        title: 'Harvest Kubernetes labels as IP tags (SCM-managed)',
        steps: [
          { title: 'Configure the IP-tag collector', text: 'The security-project Terraform deploys a collector next to the firewall (it uses 1 vCPU). Confirm collector mode, set your SCM region, give it each cluster\'s credentials (copy the file with scp, or gzip + base64 it into the command) and one monitoring definition per cluster.', code: [{ id: 'panos', label: 'PAN-OS CLI', lang: 'bash', code: TAG_CLI }] },
          { title: 'Make the collector a redistribution agent', text: 'Host = the collector IP, port 5007 (the default), data type IP to Tag; save, push. If no client appears, enable the User-ID service on the collector.', path: ['Configuration', 'NGFW and Prisma Access', 'Identity Services', 'Identity Redistribution', 'Add Agent'] },
          { title: 'Build policy from the tags', text: 'A dynamic address group matching CIE tags such as `k8s.ns_<namespace>` and `k8s.svc_<service>`, used as the source of a rule with the AI security profile group. Push, then check registered IPs on the firewall.', path: ['Objects', 'Address', 'Address Groups', 'Dynamic', 'CIE'] },
        ],
      },
      {
        type: 'callout', tone: 'info', title: 'Panorama instead',
        text: 'Panorama → Plugins → Kubernetes: add the cluster (name up to 20 characters, cannot be changed; API server, type, credential file), a notify group of device groups and a monitoring definition; monitoring runs every 30–300 s (30 by default). Never register one cluster on two Panoramas.',
      },
      {
        type: 'callout', tone: 'docs', title: 'Which clusters can be harvested is contradictory',
        text: [
          'The admin guide\'s harvesting page is titled "public and hybrid Kubernetes clusters", but its body says that from PAN-OS 11.2.10-h2 the collector harvests only AWS and Azure **private** clusters — not public ones, not GCP — while the Runtime Firewall limitations page says tags come only from public and hybrid clusters on all three clouds. The implementation guide follows the body. Test on your release before promising label-based policy.',
          'The implementation overview also calls the collector a DaemonSet on the nodes; every procedure deploys it as a firewall-image instance outside the cluster.',
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'A standalone collector is not in the admin guide',
        text: 'For private clusters the implementation guide builds a separate collector from SCM (AI Runtime Firewall → + → Add Agent Deployment) with its own Terraform projects — `tgw_project`, `tc_project`, `tc_iam_project` on AWS; `tc_project`, `tc_peer_project` on Azure — wired up with transit-gateway attachments or VNet peering. The admin guide PDF does not describe that flow; check it against the current SCM wizard.',
      },
      {
        type: 'table',
        title: 'Traffic objects: a zone per cluster (optional)',
        columns: ['Field', 'Value'],
        rows: [
          ['Type', '`K8s Cluster ID` or `VPC Endpoint ID`'],
          ['ID', 'The chart\'s `clusterid` (1–2048, must match values.yaml) or a `vpce-…` endpoint ID'],
          ['Zone and logical router', 'The object becomes a sub-interface in that zone; reference the zone in rules'],
        ],
        note: 'SCM: Configuration → NGFW and Prisma Access → Objects → Traffic Objects. Panorama: Network → Traffic Objects.',
      },
      {
        type: 'steps',
        title: 'Microperimeter: prepare the firewall and the hosts',
        steps: [
          { title: 'Check the workloads', text: 'VMs or cloud instances on Ubuntu 22.04 / 24.04, RHEL, AlmaLinux or Rocky 8.x / 9.x, or openSUSE 15.6 — on ESXi, KVM, Nutanix, AWS, Azure or GCP. Not bare metal.' },
          { title: 'Open GENEVE', text: 'UDP 6081 in both directions between each workload and the firewall data interface: security groups, NACLs, NSGs and the host firewall.', code: [{ id: 'bash', lang: 'bash', code: HOST_FW }] },
          { title: 'Dedicate a firewall interface', text: 'Layer 3, a static IPv4 address (no IPv6), its own zone and virtual router, used for nothing else. Redirected traffic must not re-enter the firewall through another interface — double inspection blackholes it. Attach an interface management profile allowing HTTPS and ping.', path: ['Network', 'Interfaces', 'Layer3', 'Static IPv4'] },
          { title: 'Allow the redirected traffic and the health probe', text: 'A rule from the microperimeter zone to the same zone with your profile group, plus UDP from 169.254.1.1:45000 to 169.254.1.2:45000. Without that second rule `panredirect health_check` fails.' },
        ],
      },
      {
        type: 'code',
        title: 'Microperimeter: install, enable, steer',
        tabs: [
          { id: 'linux', label: 'Linux', lang: 'bash', code: PANREDIRECT_LINUX },
          { id: 'rules', label: 'Steering rules', lang: 'bash', code: PANREDIRECT_RULES },
          { id: 'windows', label: 'Windows', lang: 'bash', code: PANREDIRECT_WIN },
          { id: 'diag', label: 'Diagnose · remove', lang: 'bash', code: PANREDIRECT_DIAG },
        ],
      },
      {
        type: 'table',
        title: 'Steering-rule fields',
        columns: ['Flag', 'Matches'],
        rows: [
          ['`--proto`', '`tcp`, `udp`, a hex protocol number, or `any`'],
          ['`--remoteip` / `--remoteport`', 'Source CIDR (or `any`) / source port, TCP and UDP only'],
          ['`--localip` / `--localport`', 'Destination CIDR (or `any`) / destination port'],
          ['`--action`', '`pass` — route locally, skip the firewall · `redirect` — send to the firewall'],
        ],
        note: '`rule insert --index N` takes precedence over what is there; `rule append` goes last. The CLI help defines remote = source and local = destination; check direction with a test flow before relying on a rule.',
      },
      {
        type: 'callout', tone: 'warn', title: 'What enabling redirection changes on the host',
        text: 'Everything on the interface is redirected, SSH included — set the exception or a pass rule first. If you lock yourself out, a reboot clears it unless the systemd service is enabled. `pangnv0` runs at MTU 1440 and TSO, GSO and LRO are switched off on the interface; drop Docker bridge networks to 1440 (`"mtu": 1440` in `/etc/docker/daemon.json`) or containers lose large packets.',
      },
      {
        type: 'callout', tone: 'docs', title: 'Telemetry: harmless warning or hard requirement?',
        text: 'The implementation guide calls "Failed to send telemetry" warnings non-fatal. The admin guide\'s architecture page says the agent now requires telemetry reachability and stops redirecting if it cannot send telemetry to the firewall — which is why the redirect interface must belong to a Prisma AIRS firewall and carry an HTTPS management profile. (Its own sample log shows one telemetry warning at boot followed by "Started redirection".) Treat telemetry to the firewall as required.',
      },
      {
        type: 'callout', tone: 'docs', title: 'Windows and bare metal',
        text: 'The admin guide\'s prerequisites page and the implementation guide both say: no Windows, no bare metal. A newer section of the same admin guide documents a Windows agent — `panredirect.msi`, driven by `panredirect.exe`, on Prisma AIRS firewall 12.1.5 or later — with health-check tuning, `restart` and config export / import. The implementation overview, separately, suggests microperimeter for bare-metal hosts; neither its own guide nor the docs support that.',
      },
      {
        type: 'callout', tone: 'docs', title: 'The Azure load-balancer example',
        text: 'Behind an Azure internal load balancer, `--fwip` is the front-end IP and `--fwsubnet` the subnet the firewalls sit in. The admin guide\'s Linux example describes the backend on 10.0.4.0/24 but prints `--fwsubnet 10.0.3.0/24`, the front end\'s subnet; the implementation guide prints 10.0.4.0/24, and the Windows reference defines `--fwsubnet` as the firewall subnet for direct server return. Use the backend subnet.',
      },
      {
        type: 'table',
        title: 'When it does not work',
        columns: ['Symptom', 'Likely cause and fix'],
        rows: [
          ['`pan-cni` in CrashLoopBackOff', 'Wrong endpoint IPs or cluster ID in values.yaml — read the pod log, fix, `helm upgrade`'],
          ['`ImagePullBackOff`', 'Nodes cannot reach `gcr.io/pan-cn-series/airs/pan-cni`'],
          ['Annotated, but not inspected', 'Existing pods were not restarted after annotation'],
          ['Helm: release already exists', '`helm uninstall ai-runtime-security -n kube-system`, then reinstall'],
          ['Tags on the collector, not on the firewall', 'No redistribution agent, port 5007 blocked, or the User-ID service off'],
          ['Dynamic address group stays empty', 'Match criteria do not use the `k8s.ns_…` / `k8s.svc_…` format'],
          ['`health_check` returns 1', 'No rule for UDP 169.254.1.1:45000 → 169.254.1.2:45000, or UDP 6081 blocked on the path'],
          ['SSH lost after `enable`', 'Redirection on the management interface without an exception — reboot (if not persistent), add a pass rule'],
          ['Redirection gone after a reboot', 'The systemd service is not enabled'],
        ],
      },
      {
        type: 'cards',
        items: [
          { icon: Cloud, tone: '#06b6d4', title: 'Deploy the firewall first', kicker: 'Prerequisite',
            text: 'Licence, onboarding, Terraform and the AI security profile.', go: 'net-deploy-cloud', goLabel: 'Network intercept in the cloud' },
          { icon: Server, tone: '#06b6d4', title: 'All deployment options', kicker: 'Network intercept',
            text: 'The one-page overview of every path.', go: 'ni-deploy', goLabel: 'Deployment options' },
          { icon: Layers, tone: '#0ea5e9', title: 'How the pieces divide the work', kicker: 'Context',
            text: 'Where pod-level policy fits next to the API and the gateway.', go: 'airs-platform', goLabel: 'Compare' },
        ],
      },
      { type: 'links', title: 'Sources', items: pick('imK8s', 'imK8sHelm', 'imK8sTags', 'imMicro', 'imMicroSteering', 'imMicroCli', 'arNetK8s', 'arNetIpTags', 'arNetTrafficObj', 'arNetMicro', 'arNetMicroArch', 'arPdfK8sBasics', 'arPdfMicroDeploy', 'arPdfMicroWin', 'arPrismaAirsHelm') },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'airs-planner',
    group: 'start',
    title: 'Scoping a Prisma AIRS engagement',
    sub: 'Lifecycle, phase plan, prerequisites and people for a multi-pillar rollout',
    minutes: 9,
    level: 'Plan',
    docs: pick('imPlanner', 'imAirsOverview', 'pdfRuntime', 'docsHub'),
    blocks: [
      {
        type: 'prose',
        text: [
          'The community implementation site includes an **engagement planner**: pick the pillars in scope and it generates a phase plan, a prerequisites checklist for the customer and a staffing table. Here is its model as plain tables you can reuse without the tool — corrected where it disagrees with the official docs.',
          'The durations are one practitioner\'s estimates, not Palo Alto Networks guidance. Use them to sequence and to argue for time, not as a quote.',
        ],
      },
      {
        type: 'table',
        title: 'Ten stages, three bands',
        minWidth: 720,
        columns: ['Stage', 'Band', 'Owned by', 'Done when'],
        rows: [
          ['1 · Discovery and qualification', 'Sales', 'Account team, executive sponsor', 'A named sponsor and an agreed problem statement'],
          ['2 · Solution design and pillar scoping', 'Sales', 'Solutions architect, security and platform leads', 'Pillar scope, high-level architecture and a credit estimate the customer has seen'],
          ['3 · Commercial close and licensing', 'Sales', 'Account team, procurement, cloud owner', 'Licence activated, TSG provisioned, named admins can sign in'],
          ['4 · Internal kickoff', 'Mobilisation', 'Delivery lead, architect, PM', 'Deployment model signed off internally; prerequisites sent'],
          ['5 · Project kickoff', 'Mobilisation', 'PMs and all stakeholders', 'A RACI with real names, a schedule, written success criteria'],
          ['6 · Technical requirements: topology and control plane', 'Delivery', 'Architect, network and platform engineers', 'TRD signed off by the customer\'s architecture owner'],
          ['7 · Application breakdown', 'Delivery', 'PM, application owners, AI platform team', 'Every app has an owner, a pillar and an onboarding wave'],
          ['8 · Pillar integration and deployment', 'Delivery', 'Delivery engineers, app owners, cloud admins', 'Every in-scope app passes traffic through inspection'],
          ['9 · Validation and tuning', 'Delivery', 'Delivery engineers, security operations', 'Agreed test cases pass; the false-positive rate is accepted'],
          ['10 · Handover and expansion', 'Delivery', 'PM, security operations, account team', 'Runbooks handed over, support path tested, next wave scoped'],
        ],
        note: 'The planner generates stage 8. Stages 1–3 sit in the sales cycle but lock the decisions below.',
      },
      {
        type: 'table',
        title: 'Decisions that slip — and what it costs',
        columns: ['Decision', 'Settle it in', 'Cost of deferring'],
        rows: [
          ['Tenant region', 'Stage 2', 'Changing it after activation means a new tenant; residency makes it a compliance call'],
          ['Deployment model per pillar', 'Stage 2, confirmed in 4', 'It drives sizing and credit burn — the commercial numbers move with it'],
          ['Application ownership', 'Identified in 2, named in 7', 'The usual reason schedules slip — the security team often cannot say who owns each AI app'],
          ['Credit split across pillars', 'Stage 3', 'An underfunded pillar mid-delivery forces a procurement cycle'],
          ['Change-control windows', 'Stage 5', 'A two-week approval found in stage 8 adds two weeks per change'],
          ['Monitor vs block', 'Stage 7', 'Decided under stage-9 time pressure, it tends to stay in monitor mode for good'],
        ],
      },
      {
        type: 'table',
        title: 'Stage 8: phase plan per pillar',
        minWidth: 760,
        columns: ['Pillar', 'Phases (days)', 'Base'],
        rows: [
          ['Network intercept', 'Licence and kickoff (1) · traffic discovery and topology (3–4) · cloud onboarding and firewall deployment (4–5) · AI security profile and pilot (4) · full rollout and handover (2–3)', '14–17 days'],
          ['API intercept', 'Licence (1) · app inventory and integration plan (3–4) · integrate pilot apps (4–5) · profiles and pilot detection (4) · rollout and handover (2–3)', '14–17 days'],
          ['AI Model Security', 'Licence and egress check (1) · model landscape discovery (3–4) · CI/CD integration (4–5) · triage and gate strategy (4) · rollout and handover (2–3)', '14–17 days'],
          ['AI Red Teaming', 'Prerequisite gate (1) · target scoping (2) · baseline scan (4–5) · full assessment (5–6) · report, remediation plan, handover (2)', '14–16 days'],
          ['AI Gateway', 'Licence (1) · app inventory and provider credentials (3–4) · workspaces and wiring (4–5) · guardrails and pilot (4) · logging and handover (2–3)', '14–17 days'],
        ],
        note: 'Each phase ends at a gate — e.g. "pilot detection active, false-positive rate acceptable, policy approved". Red Teaming\'s first gate is strict: any missing prerequisite stops the engagement.',
      },
      {
        type: 'table',
        title: 'What moves the estimate',
        columns: ['Pillar', 'Scope driver', 'Adds'],
        rows: [
          ['Network intercept', 'Each firewall set beyond the first', '+3.6 days (30 % of the base)'],
          ['Network intercept', 'Each cloud provider beyond the first', '+14 days'],
          ['API intercept', 'Each integration point beyond 2', '+0.5 day'],
          ['API intercept', 'Each AI use case beyond 2', '+0.5 day'],
          ['AI Model Security', 'Each further 4 CI/CD pipelines (base 4)', '+1 day'],
          ['AI Model Security', 'Each further 2 runner environments (base 2)', '+0.5 day'],
          ['AI Red Teaming', 'Each AI target beyond 2', '+0.5 day'],
          ['AI Red Teaming', 'Each scan cycle beyond 2', '+0.5 day'],
        ],
        note: 'The planner counts a session as 4 hours — 3 on the call, 1 preparing — and two sessions as a day. The AI Gateway has no scope drivers in it.',
      },
      {
        type: 'checklist',
        title: 'Prerequisites to send the customer',
        items: [
          'All pillars: credits allocated per pillar (Red Teaming separately from runtime), the credit pool, the TSG, the region, and named admins with RBAC roles.',
          'Network intercept: cloud account and subscription IDs with regions; an IAM role (AWS) or app registration (Azure) SCM can use; network diagrams with VPCs, subnets and route tables; existing BGP / ECMP details; the AI app inventory with model endpoints; traffic volume; Panorama access if Panorama manages.',
          'API intercept: every AI app with the LLM providers it calls; where the scan call will live (app code, SDK, or a gateway that has an integration); request volume; egress or proxy settings to reach the regional Scan API.',
          'AI Model Security: outbound access to the scanning endpoints and any proxy; a model inventory with framework, registry and the pipelines that use each; CI/CD platforms; model sources (registries, Hugging Face org, vendors) and tokens; object-storage access.',
          'AI Red Teaming: target URLs (public, or reachable through a network channel); credentials per target; each target\'s rate limits (RPM, TPM); a successful test probe; WAF allow-listing or SSL inspection in the path; the frameworks to map to.',
          'AI Gateway: provider credentials for every provider in scope; the app inventory with models and volumes; token budgets per team; the model allow-list; Kubernetes details if the data plane will be hybrid.',
        ],
      },
      {
        type: 'table',
        title: 'Who must be in the room',
        minWidth: 720,
        columns: ['Role', 'Needed for', 'Decides', 'Without them'],
        rows: [
          ['Project sponsor', 'Every pillar', 'Scope, budget, policy trade-offs; authorises red-team testing', 'Scope creep; no one can authorise testing or mandate gates'],
          ['Security lead', 'Every pillar', 'Profiles, detection thresholds, gate policy, remediation SLAs', 'No inspection policy, no sign-off'],
          ['Network / infrastructure engineer', 'Network intercept', 'Topology, routing and firewall placement', 'No traffic steering, no firewall'],
          ['Cloud account admin', 'Network intercept; optional elsewhere', 'IAM roles and cloud onboarding', 'Accounts cannot be onboarded'],
          ['Kubernetes / platform engineer', 'K8s protection; hybrid gateway', 'CNI and data-plane deployment', 'The Kubernetes add-on stalls'],
          ['API platform team and app owners', 'API intercept', 'App inventory, integration point per app, latency budget', 'No inventory, no integration'],
          ['AI / ML model owner and CI/CD owner', 'Model Security', 'Model inventory, scan configuration, pipeline changes', 'No pipeline gate — blocks the pillar'],
          ['AI / ML technical lead; network or proxy lead; SOC', 'Red Teaming', 'Target details and scope; allow-listing; test timing', 'Targets cannot be configured or reached; the SOC treats the test as an incident'],
          ['AI / ML platform team', 'AI Gateway', 'Workspaces, provider credentials, app routing', 'Nothing routes through the gateway'],
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Regions are per product, not "Americas, EU or Singapore"',
        text: 'The planner offers one region choice — Americas, EU or Singapore — for every pillar. The admin guides differ by product: Strata Cloud Manager tenants for network intercept run in the US, UK, India, Canada or Singapore (with AI traffic inspected in the US); API intercept profiles in the US, EU (Germany), India or Singapore; Model Security in the US, EU, Japan or Singapore; Red Teaming in the Americas, EU or Singapore; the AI Gateway in the Americas. Settle the region per pillar in stage 2.',
      },
      {
        type: 'callout', tone: 'docs', title: 'API intercept has nothing to deploy',
        text: 'The planner\'s API intercept phases deploy "intercept agents" — sidecars and DaemonSets — and validate agent connectivity. In the official docs API intercept is an HTTPS scan call from your code or the SDK (or a partner integration such as LiteLLM, Kong or the AI Gateway): no agent, no infrastructure. Plan code changes and testing per app instead. Tenant constraint worth knowing: the admin guide requires a TSG with no AIOps subscription for API intercept onboarding (the implementation guide words it as "a dedicated SCM tenant").',
      },
      {
        type: 'callout', tone: 'docs', title: 'Network intercept is the AIRS firewall',
        text: 'The planner describes network intercept as "Cloud NGFW or VM-Series" firewalls. The admin guide and the author\'s own cloud guide say VM-Series cannot inspect AI traffic; network intercept is the Prisma AIRS AI Runtime Firewall (the universal image licensed as Prisma AIRS). A managed option — Managed AI Runtime Security for AWS, in preview — sits next to Cloud NGFW in SCM. Size and scope for the AIRS firewall.',
      },
      {
        type: 'cards',
        items: [
          { icon: KeyRound, tone: '#0ea5e9', title: 'Tenant, licence & credentials', kicker: 'Stage 3',
            text: 'Deployment profiles, roles, regions and egress per product.', go: 'prereqs', goLabel: 'Prerequisites' },
          { icon: Layers, tone: '#0ea5e9', title: 'Which pillars, and why', kicker: 'Stage 2',
            text: 'Where each path inspects and what it can act on.', go: 'airs-platform', goLabel: 'Compare the paths' },
          { icon: Cloud, tone: '#06b6d4', title: 'Network intercept build', kicker: 'Stage 8',
            text: 'The deployment the network phases describe.', go: 'net-deploy-cloud', goLabel: 'Deploy' },
          { icon: ScanSearch, tone: '#6366f1', title: 'Model Security in CI', kicker: 'Stage 8',
            text: 'The pipeline gate behind the triage phase.', go: 'ms-cicd', goLabel: 'CI gate' },
          { icon: Swords, tone: '#fb923c', title: 'Red Teaming targets', kicker: 'Stage 8',
            text: 'Endpoints, auth and private network channels.', go: 'rtm-targets', goLabel: 'Connect a target' },
          { icon: Waypoints, tone: '#EC4899', title: 'AI Gateway setup', kicker: 'Stage 8',
            text: 'Integrations, workspaces, configs and guardrails.', go: 'gw-overview', goLabel: 'Gateway overview' },
        ],
      },
      { type: 'links', title: 'Sources', items: pick('imPlanner', 'imAirsOverview', 'arPdfApiRegions', 'arPdfNetLimits') },
    ],
  },
]
