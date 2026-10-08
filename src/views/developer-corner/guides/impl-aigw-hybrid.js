import { Boxes, CloudCog, Plug, Waypoints } from 'lucide-react'
import { pick } from './links'

/**
 * Hybrid AI Gateway, per platform — the cloud work around the airs-gw install
 * (gw-hybrid): EKS, AKS and GKE with Helm; ECS and Azure Container Apps with
 * the Terraform modules.
 *
 * Built on 2026-10-08 from the community "Palo Alto Networks Implementation
 * Guides" (jollymahn.github.io/pan-implementation-guides — single author, not
 * official documentation, no licence file): their order, sizing and practical
 * steps, rewritten, every value re-checked against the official EKS / AKS /
 * GKE / ECS / ACA pages, the airs-gw 1.2.0 chart (values.yaml and templates)
 * and the portkey-gateway-infrastructure module source and release notes
 * (tags v1.0.0 … v3.0.0). The community guides follow the legacy
 * portkey-ai/gateway chart; everything Kubernetes here targets airs-gw.
 * Where a source is wrong, the guide's last table says which and why.
 */

// ─── EKS · AKS · GKE ────────────────────────────────────────────────────────

const K8S_CLUSTER_EKS = `CLUSTER=aigw-cluster
REGION="<aws-region>"
K8S_VERSION="<a Kubernetes version EKS supports>"

# Two managed t4g.medium nodes (2 vCPU, 4 GiB, Arm) spread across AZs, plus the
# IAM OIDC provider that IRSA needs. Takes 15-20 minutes; do not interrupt it.
eksctl create cluster \\
  --name "$CLUSTER" \\
  --region "$REGION" \\
  --version "$K8S_VERSION" \\
  --nodegroup-name aigw-nodes \\
  --node-type t4g.medium \\
  --nodes 2 --nodes-min 2 --nodes-max 4 \\
  --with-oidc \\
  --managed

aws eks update-kubeconfig --name "$CLUSTER" --region "$REGION"
kubectl get nodes -L topology.kubernetes.io/zone,node.kubernetes.io/instance-type`

const K8S_CLUSTER_AKS = `RG=aigw-rg
CLUSTER=aigw-cluster
LOCATION="<azure-region>"

az group create --name "$RG" --location "$LOCATION"

# Two B2ms nodes (2 vCPU, 8 GiB) in two zones, with the OIDC issuer and workload
# identity on from the start. Drop --zones in a region without availability zones.
az aks create \\
  --resource-group "$RG" \\
  --name "$CLUSTER" \\
  --node-count 2 \\
  --node-vm-size Standard_B2ms \\
  --zones 1 2 \\
  --enable-oidc-issuer \\
  --enable-workload-identity \\
  --generate-ssh-keys

az aks get-credentials --resource-group "$RG" --name "$CLUSTER"
kubectl get nodes -L topology.kubernetes.io/zone,node.kubernetes.io/instance-type`

const K8S_CLUSTER_GKE = `PROJECT_ID="<project-id>"
REGION="<gcp-region>"
CLUSTER=aigw-cluster

gcloud services enable container.googleapis.com compute.googleapis.com \\
  iam.googleapis.com storage.googleapis.com

# Regional cluster: --num-nodes counts per zone, so a three-zone region gives
# three e2-standard-2 nodes. --workload-pool turns on Workload Identity Federation.
gcloud container clusters create "$CLUSTER" \\
  --location="$REGION" \\
  --workload-pool="$PROJECT_ID.svc.id.goog" \\
  --machine-type=e2-standard-2 \\
  --num-nodes=1 \\
  --enable-ip-alias

# kubectl needs gke-gcloud-auth-plugin: gcloud components install gke-gcloud-auth-plugin
gcloud container clusters get-credentials "$CLUSTER" --location="$REGION"
kubectl get nodes -L topology.kubernetes.io/zone,node.kubernetes.io/instance-type`

const K8S_PREREQ_EKS = `# IRSA trusts the cluster's OIDC issuer (--with-oidc registered it; this checks)
OIDC=$(aws eks describe-cluster --name "$CLUSTER" --region "$REGION" \\
  --query "cluster.identity.oidc.issuer" --output text | sed -e 's~https://~~')
aws iam list-open-id-connect-providers | grep "$OIDC" \\
  || eksctl utils associate-iam-oidc-provider --cluster "$CLUSTER" --region "$REGION" --approve

# Both ingress options need the AWS Load Balancer Controller — install it from the
# AWS docs if this finds nothing, and tag the subnets it should place load balancers in
kubectl get deployment -n kube-system aws-load-balancer-controller`

const K8S_PREREQ_AKS = `# The issuer URL the federated credential in step 4 trusts
OIDC_ISSUER=$(az aks show --resource-group "$RG" --name "$CLUSTER" \\
  --query "oidcIssuerProfile.issuerUrl" -o tsv)
echo "$OIDC_ISSUER"

# Managed NGINX through the application routing add-on, without a default controller...
az aks approuting enable --resource-group "$RG" --name "$CLUSTER" --nginx None

# ...then one internal controller with a private IP
kubectl apply -f - <<'EOF'
apiVersion: approuting.kubernetes.azure.com/v1alpha1
kind: NginxIngressController
metadata:
  name: nginx-internal
spec:
  ingressClassName: nginx-internal
  controllerNamePrefix: nginx-internal
  loadBalancerAnnotations:
    service.beta.kubernetes.io/azure-load-balancer-internal: "true"
EOF
kubectl get nginxingresscontroller`

const K8S_PREREQ_GKE = `VPC=default        # the VPC the cluster runs in

# Load balancers need an ACTIVE proxy-only subnet in the cluster's region; without
# it the Ingress never gets an address and nothing in the Helm output says why
gcloud compute networks subnets create aigw-proxy-only \\
  --purpose=REGIONAL_MANAGED_PROXY \\
  --role=ACTIVE \\
  --region="$REGION" \\
  --network="$VPC" \\
  --range="<unused /23 inside the VPC>"

gcloud compute networks subnets list \\
  --filter="purpose=REGIONAL_MANAGED_PROXY AND region:$REGION" \\
  --format="table(name,ipCidrRange,role)"

# Workload Identity on the cluster: prints <project-id>.svc.id.goog
gcloud container clusters describe "$CLUSTER" --location="$REGION" \\
  --format="value(workloadIdentityConfig.workloadPool)"`

const K8S_STORES_EKS = `BUCKET="<log-bucket-name>"

# In us-east-1, leave out --create-bucket-configuration
aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \\
  --create-bucket-configuration LocationConstraint="$REGION"
aws s3api put-public-access-block --bucket "$BUCKET" \\
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# ElastiCache (Redis OSS or Valkey) in the cluster's VPC: let the nodes reach it
aws ec2 authorize-security-group-ingress \\
  --group-id "<elasticache-security-group-id>" \\
  --protocol tcp --port 6379 \\
  --source-group "<eks-node-security-group-id>"`

const K8S_STORES_AKS = `STORAGE="<storageaccountname>"      # 3-24 lowercase letters and digits, globally unique
CONTAINER=airs-gw-logs

az storage account create --name "$STORAGE" --resource-group "$RG" \\
  --sku Standard_LRS --min-tls-version TLS1_2 --allow-blob-public-access false
az storage container create --name "$CONTAINER" --account-name "$STORAGE" --auth-mode login

# Azure Managed Redis in the cluster's VNet (or behind a private endpoint). Create it
# with Microsoft Entra authentication on if the pods will use workload identity —
# the chart's Redis doc makes that a prerequisite. It listens on port 10000.`

const K8S_STORES_GKE = `BUCKET="<log-bucket-name>"

gcloud storage buckets create "gs://$BUCKET" \\
  --project="$PROJECT_ID" --location="$REGION" \\
  --uniform-bucket-level-access --public-access-prevention

# Memorystore in the cluster's VPC. With in-transit encryption on, hand the gateway
# the instance's server CA — values.yaml mounts it in step 5
kubectl create namespace airs-gw
kubectl create secret generic memorystore-tls-certs --from-file=server-ca.pem -n airs-gw`

const K8S_IDENTITY_EKS = `NS=airs-gw
SA=airs-gw-sa                       # must equal serviceAccount.name in values.yaml
ROLE=airs-gw-logs
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

cat > trust.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::$ACCOUNT:oidc-provider/$OIDC" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": { "StringEquals": {
      "$OIDC:aud": "sts.amazonaws.com",
      "$OIDC:sub": "system:serviceaccount:$NS:$SA"
    } }
  }]
}
EOF
aws iam create-role --role-name "$ROLE" --assume-role-policy-document file://trust.json

cat > s3.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject"],
    "Resource": ["arn:aws:s3:::$BUCKET/*"]
  }]
}
EOF
aws iam put-role-policy --role-name "$ROLE" --policy-name airs-gw-s3 --policy-document file://s3.json

# The ARN goes into values.yaml
aws iam get-role --role-name "$ROLE" --query Role.Arn --output text`

const K8S_IDENTITY_AKS = `NS=airs-gw
SA=airs-gw-sa                       # must equal serviceAccount.name in values.yaml
IDENTITY=airs-gw-identity

az identity create --name "$IDENTITY" --resource-group "$RG"
CLIENT_ID=$(az identity show --name "$IDENTITY" --resource-group "$RG" --query clientId -o tsv)
PRINCIPAL_ID=$(az identity show --name "$IDENTITY" --resource-group "$RG" --query principalId -o tsv)

# The pod's service-account token stands in for the identity; the subject must match exactly
az identity federated-credential create \\
  --name airs-gw-federated \\
  --identity-name "$IDENTITY" \\
  --resource-group "$RG" \\
  --issuer "$OIDC_ISSUER" \\
  --subject "system:serviceaccount:$NS:$SA" \\
  --audiences api://AzureADTokenExchange

# Write access to the one log container
STORAGE_ID=$(az storage account show --name "$STORAGE" --resource-group "$RG" --query id -o tsv)
az role assignment create \\
  --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \\
  --role "Storage Blob Data Contributor" \\
  --scope "$STORAGE_ID/blobServices/default/containers/$CONTAINER"

# A data access policy on Azure Managed Redis (az extension: redisenterprise)
az redisenterprise database access-policy-assignment create \\
  --access-policy-assignment-name airsGatewayRedisAccess \\
  --cluster-name "<redis-name>" --database-name default \\
  --resource-group "$RG" --access-policy-name default \\
  --object-id "$PRINCIPAL_ID"

echo "$CLIENT_ID"                   # goes into values.yaml`

const K8S_IDENTITY_GKE = `NS=airs-gw
KSA=airs-gw-sa                      # must equal serviceAccount.name in values.yaml
GSA=airs-gw
GSA_EMAIL="$GSA@$PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create "$GSA" --display-name="AIRS AI Gateway data plane"

# The Kubernetes service account may act as the Google one
gcloud iam service-accounts add-iam-policy-binding "$GSA_EMAIL" \\
  --role roles/iam.workloadIdentityUser \\
  --member "serviceAccount:$PROJECT_ID.svc.id.goog[$NS/$KSA]"

# Logs: on this one bucket, not the whole project. objectAdmin can also delete; a custom
# role with storage.objects.create + storage.objects.get is the tighter documented option.
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \\
  --member="serviceAccount:$GSA_EMAIL" --role=roles/storage.objectAdmin

# Only if the gateway calls Vertex AI with this identity
gcloud projects add-iam-policy-binding "$PROJECT_ID" \\
  --member="serviceAccount:$GSA_EMAIL" --role=roles/aiplatform.user`

const K8S_VALUES_EKS = `# Merge into the values.yaml Gateway Registration gave you: add the keys under its
# existing environment.data, and leave PORTKEY_CLIENT_AUTH / ORGANISATIONS_TO_SYNC alone
serviceAccount:
  create: true
  automount: true                     # the chart default is false; IRSA needs the token
  name: airs-gw-sa
  annotations:
    eks.amazonaws.com/role-arn: "<role ARN from step 4>"   # leave out for EKS Pod Identity

environment:
  data:
    SERVER_MODE: ""                   # gateway only; "all" adds the MCP gateway (step 6)
    LOG_STORE: s3_assume
    LOG_STORE_REGION: "<bucket region>"
    LOG_STORE_GENERATIONS_BUCKET: "<log bucket>"
    CACHE_STORE: aws-elastic-cache
    REDIS_URL: "redis://<primary endpoint, or configuration endpoint in cluster mode>:6379"
    REDIS_TLS_ENABLED: "true"
    REDIS_PASSWORD: "<auth token>"    # or AWS_REDIS_AUTH_MODE: iam + AWS_REDIS_CLUSTER_NAME + REDIS_USERNAME
    # REDIS_MODE: cluster             # only with cluster mode enabled

redis:
  external:
    enabled: true                     # the only switch that stops the bundled Redis`

const K8S_VALUES_AKS = `# Merge into the values.yaml Gateway Registration gave you: add the keys under its
# existing environment.data, and leave PORTKEY_CLIENT_AUTH / ORGANISATIONS_TO_SYNC alone
serviceAccount:
  create: true
  automount: true                     # the chart default is false; workload identity needs the token
  name: airs-gw-sa
  annotations:
    azure.workload.identity/client-id: "<identity client ID from step 4>"

podLabels:
  azure.workload.identity/use: "true" # without it the webhook injects nothing and auth fails quietly

environment:
  data:
    SERVER_MODE: ""                   # gateway only; "all" adds the MCP gateway (step 6)
    LOG_STORE: azure
    AZURE_STORAGE_ACCOUNT: "<storage account>"
    AZURE_STORAGE_CONTAINER: airs-gw-logs
    AZURE_AUTH_MODE: workload
    CACHE_STORE: azure-redis
    REDIS_URL: "redis://<azure managed redis host>:10000"
    REDIS_TLS_ENABLED: "true"
    AZURE_REDIS_AUTH_MODE: workload
    # REDIS_MODE: cluster             # only with the OSS cluster policy

redis:
  external:
    enabled: true                     # the only switch that stops the bundled Redis`

const K8S_VALUES_GKE = `# Merge into the values.yaml Gateway Registration gave you: add the keys under its
# existing environment.data, and leave PORTKEY_CLIENT_AUTH / ORGANISATIONS_TO_SYNC alone
serviceAccount:
  create: true
  automount: true                     # the chart default is false; workload identity needs the token
  name: airs-gw-sa
  annotations:
    iam.gke.io/gcp-service-account: "airs-gw@<project-id>.iam.gserviceaccount.com"

environment:
  data:
    SERVER_MODE: ""                   # gateway only; "all" adds the MCP gateway (step 6)
    LOG_STORE: gcs_assume
    GCP_AUTH_MODE: workload
    LOG_STORE_REGION: "<bucket region>"
    LOG_STORE_GENERATIONS_BUCKET: "<log bucket>"
    CACHE_STORE: gcp-memory-store
    REDIS_URL: "redis://<memorystore IP>:<port>"
    REDIS_TLS_ENABLED: "true"
    REDIS_TLS_CERTS: /etc/ssl/certs/server-ca.pem
    REDIS_PASSWORD: "<AUTH string>"   # or GCP_REDIS_AUTH_MODE: workload + roles/redis.dbConnectionUser

volumes:
  - name: memorystore-tls-certs
    secret:
      secretName: memorystore-tls-certs
volumeMounts:
  - name: memorystore-tls-certs
    mountPath: /etc/ssl/certs/server-ca.pem
    subPath: server-ca.pem

redis:
  external:
    enabled: true                     # the only switch that stops the bundled Redis`

const K8S_EXPOSE_EKS = `service:
  type: ClusterIP                     # the chart default; the ALB targets pod IPs

ingress:
  enabled: true
  ingressClassName: alb               # the chart default "nginx" is not what EKS runs
  hostname: gateway.example.com
  annotations:
    alb.ingress.kubernetes.io/scheme: internal
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /v1/health
    alb.ingress.kubernetes.io/inbound-cidrs: "<your application CIDRs>"
    alb.ingress.kubernetes.io/manage-backend-security-group-rules: "true"
    alb.ingress.kubernetes.io/certificate-arn: "<ACM certificate ARN>"
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'          # no plain-HTTP listener at all
    alb.ingress.kubernetes.io/load-balancer-attributes: idle_timeout.timeout_seconds=900`

const K8S_EXPOSE_AKS = `service:
  type: ClusterIP                     # the chart default; NGINX fronts it

ingress:
  enabled: true
  ingressClassName: nginx-internal    # the controller from step 2; the chart default "nginx" is not one
  hostname: gateway.example.com
  annotations:
    cert-manager.io/cluster-issuer: "<your ClusterIssuer>"   # or create the TLS Secret yourself
    nginx.ingress.kubernetes.io/proxy-read-timeout: "900"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "900"
  tls:
    - secretName: airs-gw-tls
      hosts:
        - gateway.example.com         # must match hostname, or NGINX serves its default certificate`

const K8S_EXPOSE_GKE = `service:
  type: ClusterIP
  annotations:
    cloud.google.com/neg: '{"ingress": true}'                       # container-native load balancing
    cloud.google.com/backend-config: '{"default": "airs-gw-backend"}'

ingress:
  enabled: true
  ingressClassName: gce-internal      # equal to the annotation, as on the GKE page; the chart default is "nginx"
  hostname: gateway.example.com
  annotations:
    kubernetes.io/ingress.class: gce-internal
  tls:                                # Google-managed certificates work on external load balancers only
    - secretName: airs-gw-tls
      hosts:
        - gateway.example.com`

const K8S_BACKENDCONFIG = `kubectl apply -f - <<'EOF'
apiVersion: cloud.google.com/v1
kind: BackendConfig
metadata:
  name: airs-gw-backend
  namespace: airs-gw
spec:
  timeoutSec: 900                     # streamed generations outlive the default backend timeout
  healthCheck:
    type: HTTP
    requestPath: /v1/health
    port: 8787
EOF`

const K8S_VERIFY = `NS=airs-gw
kubectl get pods -n "$NS" -o wide
kubectl get svc -n "$NS"              # TYPE ClusterIP, no EXTERNAL-IP, no node port

# The gateway pod itself: the bundled Redis carries the same selector labels, so
# deployment/airs-gw and svc/airs-gw can resolve to the Redis pod instead
GW_POD=$(kubectl get pods -n "$NS" \\
  -l 'app.kubernetes.io/name=airs-gw,app.kubernetes.io/instance=airs-gw,!app.kubernetes.io/component' \\
  -o jsonpath='{.items[0].metadata.name}')
kubectl logs -n "$NS" "$GW_POD" --tail=50

# 1. The pod
kubectl port-forward -n "$NS" "pod/$GW_POD" 8787:8787 &
PF=$!
sleep 2
curl -s http://127.0.0.1:8787/v1/health
kill "$PF"

# 2. The front door — a workspace key and an integration you created in SCM
curl -s https://gateway.example.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "x-portkey-api-key: $PORTKEY_API_KEY" \\
  -d '{"model": "@<your-integration>/<model>", "messages": [{"role": "user", "content": "ping"}]}'

# 3. SCM: the request under Logs, and a recent Last Sync on Gateway Registration`

const K8S_RESILIENCE = `# The chart's probes check /v1/health every 60 s and give up after 3 failures:
# a wedged pod keeps taking traffic for minutes. The check is local, so poll it often.
livenessProbe:
  httpGet:
    path: /v1/health                  # port left out: the chart fills in the active server port
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /v1/health
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  successThreshold: 1
  failureThreshold: 3
startupProbe:                         # a cold image pull or a slow first sync is not a liveness failure
  httpGet:
    path: /v1/health
  periodSeconds: 5
  failureThreshold: 30

resources:                            # none by default; an HPA needs requests to compute utilisation
  requests:
    cpu: "1"
    memory: 2Gi
  limits:
    memory: 4Gi

replicaCount: 2
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
pdb:
  enabled: true
  minAvailable: 1

topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels:
        app.kubernetes.io/name: airs-gw
        app.kubernetes.io/instance: airs-gw
      matchExpressions:
        - key: app.kubernetes.io/component    # leaves out the bundled Redis and the data service
          operator: DoesNotExist`

const K8S_NETPOL = `kubectl apply -f - <<'EOF'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: airs-gw-egress
  namespace: airs-gw
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/instance: airs-gw
  policyTypes: ["Egress"]
  egress:
    - ports:                          # cluster DNS
        - { protocol: UDP, port: 53 }
        - { protocol: TCP, port: 53 }
    - ports:                          # registry, management plane, providers, the AIRS API
        - { protocol: TCP, port: 443 }
    - ports:                          # your cache: 6379, 10000 on Azure Managed Redis, Memorystore's TLS port
        - { protocol: TCP, port: 6379 }
    # add 8081 if you enable the data service
EOF`

const K8S_TEARDOWN_EKS = `helm uninstall airs-gw -n airs-gw
kubectl delete namespace airs-gw

# The cluster bills by the hour whether or not it serves anything — delete it,
# do not scale it to zero (control plane, load balancer and cache keep charging)
eksctl delete cluster --name "$CLUSTER" --region "$REGION"

aws iam delete-role-policy --role-name "$ROLE" --policy-name airs-gw-s3
aws iam delete-role --role-name "$ROLE"
aws s3 rb "s3://$BUCKET" --force      # deletes every stored log
# ...and the ElastiCache cluster, if you created one for this`

const K8S_TEARDOWN_AKS = `helm uninstall airs-gw -n airs-gw

# Everything in this guide lives in one resource group: cluster, storage account,
# identity, Redis. This deletes all of it, logs included.
az group delete --name "$RG" --yes --no-wait`

const K8S_TEARDOWN_GKE = `helm uninstall airs-gw -n airs-gw

gcloud container clusters delete "$CLUSTER" --location="$REGION" --quiet
gcloud storage rm --recursive "gs://$BUCKET"          # deletes every stored log
gcloud iam service-accounts delete "$GSA_EMAIL" --quiet
gcloud compute networks subnets delete aigw-proxy-only --region="$REGION" --quiet
# ...and the Memorystore instance, if you created one for this`

// ─── ECS · Azure Container Apps ─────────────────────────────────────────────

const ECS_SECRETS = `PROJECT=portkey-gateway
ENVIRONMENT=dev
AWS_REGION=us-east-1                  # the module example's region; change it everywhere at once
KMS_KEY="<customer-managed KMS key id>"

# Files, not --secret-string on the command line: shell history and the process
# table keep arguments
umask 077
cat > docker-credentials.json <<'JSON'
{"username":"<registry username>","password":"<registry password>"}
JSON
cat > client-org.json <<'JSON'
{"PORTKEY_CLIENT_AUTH":"<client auth key>","ORGANISATIONS_TO_SYNC":"<organisation id>"}
JSON

aws secretsmanager create-secret --name "$PROJECT/$ENVIRONMENT/docker-credentials" \\
  --region "$AWS_REGION" --kms-key-id "$KMS_KEY" --secret-string file://docker-credentials.json
aws secretsmanager create-secret --name "$PROJECT/$ENVIRONMENT/client-org" \\
  --region "$AWS_REGION" --kms-key-id "$KMS_KEY" --secret-string file://client-org.json
rm -f docker-credentials.json client-org.json

# The two ARNs go into main.tf — the module takes ARNs, never values
aws secretsmanager list-secrets --region "$AWS_REGION" \\
  --query "SecretList[?starts_with(Name, '$PROJECT/$ENVIRONMENT')].[Name,ARN]" --output table`

const ECS_STATE = `ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
STATE_BUCKET="portkey-tfstate-$ACCOUNT"
LOG_BUCKET="portkey-logs-$ACCOUNT"

for B in "$STATE_BUCKET" "$LOG_BUCKET"; do
  # us-east-1; elsewhere add --create-bucket-configuration LocationConstraint=<region>
  aws s3api create-bucket --bucket "$B" --region us-east-1
  aws s3api put-public-access-block --bucket "$B" \\
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  aws s3api put-bucket-encryption --bucket "$B" --server-side-encryption-configuration \\
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"},"BucketKeyEnabled":true}]}'
done
aws s3api put-bucket-versioning --bucket "$STATE_BUCKET" --versioning-configuration Status=Enabled

cat > backend.config <<EOF
bucket = "$STATE_BUCKET"
key    = "portkey-gateway/dev.tfstate"
region = "us-east-1"
EOF`

const ECS_MAIN = `terraform {
  required_version = ">= 1.13"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  backend "s3" {
    use_lockfile = true
  }
}

provider "aws" {
  region = "us-east-1"
}

module "portkey_gateway" {
  # One tag series for the whole repository. The ECS page pins v2.0.0, whose default
  # image tag is "latest"; v3.0.0 defaults to gateway 2.16.0. Pin a ref and a tag.
  source = "github.com/Portkey-AI/portkey-gateway-infrastructure//terraform/ecs?ref=v3.0.0"

  project_name = "portkey-gateway"
  environment  = "dev"
  aws_region   = "us-east-1"

  docker_cred_secret_arn = "<docker-credentials secret ARN>"

  create_new_vpc     = true
  vpc_cidr           = "10.0.0.0/16"
  num_az             = 2
  single_nat_gateway = true

  create_cluster   = true             # an EC2 Auto Scaling capacity provider, not Fargate
  instance_type    = "t4g.medium"
  min_asg_size     = 2
  max_asg_size     = 4
  desired_asg_size = 2

  server_mode = "gateway"             # "all": ALB host routing + mcp_gateway_base_url

  gateway_image = {
    image = "portkeyai/gateway_enterprise"
    tag   = "<gateway version from the changelog>"
  }

  gateway_config = {
    desired_task_count     = 2
    cpu                    = 1024     # the documented floor: 1 vCPU
    memory                 = 2048     # and 2 GiB per task
    gateway_port           = 8787
    mcp_port               = 8788
    enable_execute_command = true     # v3.0.0 defaults it to false; step 4 uses ECS Exec
  }

  redis_configuration = {             # built-in Redis task: no TLS, no password, no failover
    redis_type = "redis"
    cpu        = 256
    memory     = 512
    endpoint   = ""
    tls        = false
    mode       = "standalone"
  }

  object_storage = {
    log_store_bucket = "portkey-logs-<account-id>"
    bucket_region    = "us-east-1"
  }

  create_lb           = true
  internal_lb         = true
  lb_type             = "application"
  tls_certificate_arn = "<ACM certificate ARN>"
  allowed_lb_cidrs    = ["10.0.0.0/16"] # empty means the VPC CIDR when internal, 0.0.0.0/0 when not

  environment_variables = {
    gateway = {
      SERVICE_NAME    = "gateway"
      ANALYTICS_STORE = "control_plane"
      LOG_STORE       = "s3_assume"
    }
  }

  secrets = {                         # Secrets Manager ARNs: both keys live in the one client-org secret
    gateway = {
      PORTKEY_CLIENT_AUTH   = "<client-org secret ARN>"
      ORGANISATIONS_TO_SYNC = "<client-org secret ARN>"
    }
  }
}

output "load_balancer_dns_name" {
  value = module.portkey_gateway.load_balancer_dns_name
}`

const ECS_APPLY = `terraform init -backend-config=backend.config
terraform plan        # read every IAM policy, and anything marked "must be replaced"
terraform apply

# The module names the cluster "<project_name>-cluster" and the service "gateway"
CLUSTER=portkey-gateway-cluster
aws ecs describe-services --cluster "$CLUSTER" --services gateway --region us-east-1 \\
  --query "services[0].{running:runningCount,desired:desiredCount,status:status}"

# RUNNING proves scheduling, not serving. Ask the process — needs enable_execute_command
# and the Session Manager plugin; otherwise read the target group's health check
TASK=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name gateway --region us-east-1 \\
  --query "taskArns[0]" --output text)
aws ecs execute-command --cluster "$CLUSTER" --task "$TASK" --container gateway \\
  --interactive --region us-east-1 \\
  --command "curl -s -o /dev/null -w '%{http_code}' http://localhost:8787/v1/health"

# Streamed generations outlive the ALB's idle timeout; raise it on the created load balancer
aws elbv2 modify-load-balancer-attributes --load-balancer-arn "<ALB ARN>" \\
  --attributes Key=idle_timeout.timeout_seconds,Value=900`

const ECS_PROD = `# Arguments inside module "portkey_gateway", replacing the ones from step 3.
# ElastiCache instead of the built-in Redis task — same VPC, in-transit encryption, AUTH token:
redis_configuration = {
  redis_type = "aws-elastic-cache"    # not "elasticache"
  cpu        = 256                    # ignored for ElastiCache
  memory     = 512                    # ignored for ElastiCache
  endpoint   = "master.<name>.<id>.use1.cache.amazonaws.com:6379"   # host:port, no scheme
  tls        = true
  mode       = "standalone"           # "cluster" with cluster mode enabled
}

secrets = {
  gateway = {
    PORTKEY_CLIENT_AUTH   = "<client-org secret ARN>"
    ORGANISATIONS_TO_SYNC = "<client-org secret ARN>"
    REDIS_PASSWORD        = "<secret ARN holding JSON with a REDIS_PASSWORD key>"
  }
  # the data-service block needs the same three when the data service runs
}

# Task autoscaling and the Auto Scaling group are separate limits: raise both,
# or new tasks wait in PROVISIONING with no instance to land on
gateway_autoscaling = {
  enable_autoscaling        = true
  autoscaling_min_capacity  = 3
  autoscaling_max_capacity  = 20
  target_cpu_utilization    = 70
  target_memory_utilization = 80
  scale_in_cooldown         = 120
  scale_out_cooldown        = 60
}
min_asg_size     = 2
max_asg_size     = 6
desired_asg_size = 2`

const ACA_KV = `RG=portkey-rg
LOCATION=eastus
KV="portkey-kv-<unique suffix>"       # global names, held for 90 days after deletion

az group create --name "$RG" --location "$LOCATION"
az keyvault create --name "$KV" --resource-group "$RG" --location "$LOCATION" \\
  --enable-rbac-authorization true

# You write the secrets; the module's own identity reads them at runtime. The ACA
# page grants Key Vault Administrator — Secrets Officer is enough to write them.
KV_ID=$(az keyvault show --name "$KV" --query id -o tsv)
az role assignment create --role "Key Vault Secrets Officer" \\
  --assignee "$(az ad signed-in-user show --query id -o tsv)" --scope "$KV_ID"

# The names the module looks up — keep them exactly. (A role assignment takes a
# minute to apply: a Forbidden on the first write usually means wait and retry.)
az keyvault secret set --vault-name "$KV" --name docker-username       --value "<registry username>"
az keyvault secret set --vault-name "$KV" --name docker-password       --value "<registry password>"
az keyvault secret set --vault-name "$KV" --name portkey-client-auth   --value "<client auth key>"
az keyvault secret set --vault-name "$KV" --name organisations-to-sync --value "<organisation id>"
az keyvault secret list --vault-name "$KV" --query "[].name" -o tsv`

const ACA_STATE = `RG=portkey-rg
SA="portkeytfstate<suffix>"           # 3-24 lowercase letters and digits, globally unique

az storage account create --name "$SA" --resource-group "$RG" --location eastus \\
  --sku Standard_LRS --min-tls-version TLS1_2 --allow-blob-public-access false
az storage container create --name tfstate --account-name "$SA" --auth-mode login

# use_azuread_auth: whoever runs Terraform needs a blob data role on this account
cat > backend.config <<EOF
resource_group_name  = "$RG"
storage_account_name = "$SA"
container_name       = "tfstate"
key                  = "portkey-gateway/dev.tfstate"
EOF`

const ACA_MAIN = `terraform {
  required_version = ">= 1.5"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
  backend "azurerm" {
    use_azuread_auth = true
  }
}

provider "azurerm" {
  features {}
}

module "portkey_gateway" {
  # The ACA page pins v1.1.3, which ignores gateway_image changes after the first
  # apply (fixed in v1.1.4). Same tag series as the ECS module.
  source = "github.com/Portkey-AI/portkey-gateway-infrastructure//terraform/aca?ref=v3.0.0"

  project_name        = "portkey-gateway"
  environment         = "dev"
  resource_group_name = "portkey-rg"

  registry_type = "dockerhub"         # the module pulls from docker.io
  docker_credentials = {
    key_vault_name  = "portkey-kv-<unique suffix>"
    key_vault_rg    = "portkey-rg"
    username_secret = "docker-username"
    password_secret = "docker-password"
  }

  # Decide both now: changing either later recreates the environment and every app in it.
  # The ACA page's lab shape is "none" + public; no published example uses false.
  network_mode   = "new"
  vnet_cidr      = "10.0.0.0/16"
  ingress_type   = "aca"
  public_ingress = false

  server_mode = "gateway"             # "all" deploys a separate MCP app

  gateway_image = {
    image = "portkeyai/gateway_enterprise"
    tag   = "<gateway version from the changelog>"   # the ACA page's example pins 2.2.2
  }

  gateway_config = {
    cpu          = 1                  # the documented floor: 1 vCPU
    memory       = "2Gi"              # and 2 GiB per replica
    min_replicas = 2                  # one replica turns every restart into an outage
    max_replicas = 10
  }

  redis_config = {
    redis_type = "redis"              # built-in app, no TLS or password; azure-redis for production
  }

  storage_config = {
    container_name = "portkey-log-store"   # created for you, and deleted by terraform destroy
  }

  environment_variables = {
    gateway = {
      NODE_ENV              = "production"   # the page's "development" trusts localhost by default
      LOG_LEVEL             = "info"
      ANALYTICS_STORE       = "control_plane"
      AZURE_MANAGED_VERSION = "2019-08-01"
    }
  }

  secrets = {                         # Key Vault secret NAMES, not values
    gateway = {
      PORTKEY_CLIENT_AUTH   = "portkey-client-auth"
      ORGANISATIONS_TO_SYNC = "organisations-to-sync"
    }
  }

  secrets_key_vault = {
    name           = "portkey-kv-<unique suffix>"
    resource_group = "portkey-rg"
  }
}

output "gateway_name" {
  value = module.portkey_gateway.gateway_name
}`

const ACA_APPLY = `terraform init -backend-config=backend.config
terraform plan        # read every role assignment, and anything marked "must be replaced"
terraform apply

az containerapp show --name "$(terraform output -raw gateway_name)" --resource-group portkey-rg \\
  --query "{state:properties.runningStatus,fqdn:properties.configuration.ingress.fqdn}" -o table

# With public_ingress = false, run this from inside the VNet — and confirm from outside
# that the FQDN does not answer
curl -s "https://<gateway FQDN from above>/v1/health"`

const ACA_PROD = `# Arguments inside module "portkey_gateway", replacing the ones from step 3.
# Application Gateway in front (needs a VNet): WAF, your certificate, host routing
ingress_type = "application_gateway"
app_gateway_config = {
  sku_name     = "WAF_v2"
  sku_tier     = "WAF_v2"
  capacity     = 2
  enable_waf   = true
  public       = false
  routing_mode = "host"
  gateway_host = "gateway.example.com"
  mcp_host     = "mcp.example.com"    # only with server_mode = "all"
}

# A managed Redis instead of the built-in app: "azure-redis" takes standalone or
# cluster mode (the ACA page's example is an Azure Cache for Redis endpoint on 6380);
# "azure-managed-redis" is standalone only
redis_config = {
  redis_type = "azure-redis"
  endpoint   = "rediss://<name>.redis.cache.windows.net:6380"
  tls        = true
  mode       = "standalone"
}
# ...plus REDIS_PASSWORD = "<Key Vault secret name>" in secrets.gateway

# Logs in a storage account you already run, through the module's managed identity
storage_config = {
  resource_group = "<storage account resource group>"
  auth_mode      = "managed"
  account_name   = "<storage account>"
  container_name = "<container>"
}`

const ACA_TIMEOUT = `# Application Gateway's backend request timeout is shorter than a long streamed
# generation, and app_gateway_config has no field for it — raise it after apply
az network application-gateway http-settings update \\
  --gateway-name "<app gateway name>" --resource-group portkey-rg \\
  --name "<http setting name>" --timeout 900`

const CLOUD_TABS = (eks, aks, gke, lang = 'bash') => [
  { id: 'eks', label: 'EKS', lang, code: eks },
  { id: 'aks', label: 'AKS', lang, code: aks },
  { id: 'gke', label: 'GKE', lang, code: gke },
]

export const IMPL_AIGW_HYBRID = [
  {
    id: 'gw-hybrid-k8s',
    group: 'gateway',
    title: 'Hybrid on EKS, AKS or GKE, step by step',
    sub: 'Cluster, stores, workload identity, values.yaml, TLS ingress and checks for the airs-gw chart — a tab per cloud',
    minutes: 25,
    level: 'Setup',
    docs: pick('imHybK8s', 'imHybK8sIdentity', 'imHybK8sIngress', 'imHybridInfra', 'imHybInfraSizing', 'imHybInfraOnPrem', 'agEks', 'agAks', 'agGke',
      'ghAirsGwHelm', 'ghAirsGwValues', 'ghAirsGwIngress', 'ghAirsGwRedisSts', 'ghAirsGwLogs', 'ghAirsGwRedis', 'ghAirsGwVertex', 'ghAirsGwBedrock', 'agHybridArch'),
    blocks: [
      {
        type: 'prose',
        text: [
          'This is the cloud work around the install in **Hybrid deployment**: a cluster that meets the floor, the add-ons ingress depends on, a log bucket and a cache, an identity for the pods, the values that point the chart at them, a TLS front door, and the checks. Each step has a tab per cloud.',
          'The order and the cloud commands follow a community implementation guide — one author, not Palo Alto Networks documentation — checked against the official EKS, AKS and GKE pages. That guide installs the legacy `portkey-ai/gateway` chart, as those pages do. Everything here targets `airs-gw` 1.2.0: release `airs-gw` in namespace `airs-gw`, values merged into the file Gateway Registration gave you.',
        ],
      },
      {
        type: 'table',
        title: 'The three platforms at a glance',
        columns: ['What', 'EKS', 'AKS', 'GKE'],
        minWidth: 760,
        rows: [
          ['Node floor', '`t4g.medium` (2 vCPU, 4 GiB) × 2, one per AZ', '`Standard_B2ms` (2 vCPU, 8 GiB) × 2 across zones', '2 vCPU / 4 GiB or more × 2 across zones'],
          ['Extra tooling', '`eksctl`', '—', '`gke-gcloud-auth-plugin` — kubectl fails confusingly without it'],
          ['Ingress prerequisite', 'AWS Load Balancer Controller, tagged subnets', 'Application routing add-on (managed NGINX)', 'HTTP Load Balancing add-on and an ACTIVE `REGIONAL_MANAGED_PROXY` subnet'],
          ['Ingress class', '`alb`', '`nginx-internal` — one you create', '`gce-internal` (or `gce`)'],
          ['Pod identity', 'IRSA (role-ARN annotation) or EKS Pod Identity (no annotation)', 'Workload identity: client-ID annotation plus the `azure.workload.identity/use` pod label', 'Workload Identity Federation: `iam.gke.io/gcp-service-account` annotation'],
          ['Log store', '`s3_assume`', '`azure`, `AZURE_AUTH_MODE: workload`', '`gcs_assume`, `GCP_AUTH_MODE: workload`'],
          ['Cache store', '`aws-elastic-cache`', '`azure-redis`', '`gcp-memory-store`'],
          ['TLS at the front door', 'ACM certificate on the ALB, by annotation', 'cert-manager, or your own Secret in `ingress.tls`', 'Your own Secret in `ingress.tls` — Google-managed certificates are external-only'],
        ],
        note: 'The chart renders `ingress.tls` straight into the Ingress spec (templates/ingress.yaml) — the community guide left that as an open question.',
      },
      {
        type: 'callout', tone: 'warn', title: 'One chart, one data plane per registration',
        text: 'Do not install the legacy chart and `airs-gw` side by side — that is two data planes syncing one organisation. If an earlier attempt used the other chart, `helm list -A` finds it: uninstall it first.',
      },
      {
        type: 'steps',
        title: 'Build it',
        steps: [
          {
            title: 'Create the cluster',
            text: 'Two worker nodes is the floor on all three pages, one per zone. Already have a cluster? Check it meets that with the last command, and turn on what these commands set at creation — the OIDC provider (EKS), OIDC issuer and workload identity (AKS), the workload pool (GKE).',
            code: CLOUD_TABS(K8S_CLUSTER_EKS, K8S_CLUSTER_AKS, K8S_CLUSTER_GKE),
          },
          {
            title: 'Turn on what ingress and identity depend on',
            text: 'EKS: without the AWS Load Balancer Controller an Ingress or LoadBalancer Service is accepted and no load balancer ever appears. AKS: the OIDC issuer URL for step 4, and an internal NGINX controller. GKE: the proxy-only subnet — missing, the Ingress silently never gets an address.',
            code: CLOUD_TABS(K8S_PREREQ_EKS, K8S_PREREQ_AKS, K8S_PREREQ_GKE),
          },
          {
            title: 'Create the log bucket and the cache',
            text: 'Block public access on the bucket, and keep the cache in the cluster\'s VPC or VNet — the deployment pages make that a requirement. The bundled Redis works for a first install, but it has no password, no persistence by default and nothing to monitor.',
            code: CLOUD_TABS(K8S_STORES_EKS, K8S_STORES_AKS, K8S_STORES_GKE),
            note: 'ElastiCache: the Configuration endpoint with cluster mode on, the Primary endpoint without it — the wrong one connects and then fails on the first keyspace operation. Size the bucket at about 10 kB per request, uncompressed, times retention.',
          },
          {
            title: 'Give the pods an identity',
            text: [
              'One Kubernetes service account, `airs-gw-sa` in `airs-gw`, bound to a cloud identity that may write the bucket. The name must match in the trust or federation subject, in `serviceAccount.name` and in the namespace — a mismatch fails at runtime, not at install.',
              'Grant Bedrock, Vertex AI or Azure OpenAI rights to this identity only if the gateway calls them with it (Model providers covers each auth type).',
            ],
            code: CLOUD_TABS(K8S_IDENTITY_EKS, K8S_IDENTITY_AKS, K8S_IDENTITY_GKE),
            note: 'EKS Pod Identity instead of IRSA: install the Pod Identity Agent add-on, trust `pods.eks.amazonaws.com` with `sts:AssumeRole` and `sts:TagSession`, run `aws eks create-pod-identity-association` for namespace `airs-gw` and service account `airs-gw-sa`, and leave the annotation out of step 5.',
          },
          {
            title: 'Point the chart at them',
            text: 'Add these to the downloaded values.yaml — keys under its existing `environment.data`, never a second `environment:` block, the two identity keys untouched. `automount: true` matters: the chart defaults it to false and every workload-identity path needs the token. Only `redis.external.enabled: true` stops the bundled Redis.',
            code: CLOUD_TABS(K8S_VALUES_EKS, K8S_VALUES_AKS, K8S_VALUES_GKE, 'yaml'),
          },
          {
            title: 'Install, then put TLS in front',
            text: [
              'Install with the pinned command from Hybrid deployment, add the block below, and upgrade again. Keep the Service `ClusterIP` (the chart default, port 8787): the pod speaks plain HTTP and every request carries a bearer key.',
              'For the MCP gateway as well: `SERVER_MODE: "all"`, `ingress.hostBased: true` with an `mcpHostname`, and `MCP_GATEWAY_BASE_URL` set to that host with `https://`. The URL exists only once the load balancer does, so it takes a second upgrade.',
            ],
            code: CLOUD_TABS(K8S_EXPOSE_EKS, K8S_EXPOSE_AKS, K8S_EXPOSE_GKE, 'yaml'),
            note: 'GKE: the Service annotation names a BackendConfig — apply the one below before you upgrade.',
          },
          {
            title: 'Verify: the pod, the front door, then SCM',
            text: 'Each hop isolates a different failure. No answer from the pod: image or config. A pod that answers behind a silent load balancer: the controller, the health check or the source range. A request that works but never reaches SCM Logs: the outbound path or the sync.',
            code: [{ id: 'bash', lang: 'bash', code: K8S_VERIFY }],
          },
        ],
      },
      { type: 'code', title: 'GKE: the BackendConfig the Service names', tabs: [{ id: 'bash', label: 'GKE', lang: 'bash', code: K8S_BACKENDCONFIG }] },
      {
        type: 'table',
        title: 'Restrict who can reach it',
        columns: ['Platform', 'Ingress path', 'Service (layer 4) path'],
        minWidth: 680,
        rows: [
          ['EKS', '`alb.ingress.kubernetes.io/inbound-cidrs` with your application CIDRs, scheme `internal`', 'An internal NLB with `service.beta.kubernetes.io/load-balancer-source-ranges` in `service.annotations` — the chart does not render `spec.loadBalancerSourceRanges`'],
          ['AKS', 'The internal NGINX controller, plus NSG rules on the subnet', '`service.beta.kubernetes.io/azure-allowed-ip-ranges` — the AKS page\'s `0.0.0.0/0` admits everything that can route to it'],
          ['GKE', '`gce-internal` plus a VPC firewall rule; Cloud Armor on an external Ingress', 'Internal L4 (`networking.gke.io/load-balancer-type: "Internal"`) plus firewall rules — the GKE page\'s `spec.loadBalancerSourceRanges` annotation is not an annotation, and the chart\'s gateway Service does not render that field'],
        ],
        note: 'Admit your applications and nothing else. Streamed completions hold the connection for the whole generation, so raise the front door\'s timeout too: the ALB `idle_timeout.timeout_seconds` attribute, NGINX `proxy-read-timeout` and `proxy-send-timeout`, a GKE BackendConfig `timeoutSec` — a cut stream looks like a truncated model answer.',
      },
      {
        type: 'table',
        title: 'Chart defaults worth changing before real traffic',
        columns: ['Setting', 'Chart 1.2.0', 'Change it to'],
        minWidth: 660,
        rows: [
          ['Liveness and readiness', '`/v1/health` every 60 s, 3 failures', 'Every 10 s. A wedged pod otherwise keeps taking traffic for minutes; the check is local and cheap.'],
          ['Startup probe', 'none', 'One on `/v1/health` with a high `failureThreshold`, so a cold image pull or a slow first sync is not a liveness restart. The chart fills in the port.'],
          ['Resources', 'none', 'Requests near the architecture page\'s 1–2 cores / 2–4 GB per instance. An HPA cannot compute utilisation without requests.'],
          ['Replicas · strategy · PDB', '1 · Kubernetes default · off', '2 or more, `maxUnavailable: 0`, a PDB with `minAvailable: 1`.'],
          ['Autoscaling', 'off (2–20 replicas at 60 % CPU and memory when on)', 'On, once requests are set.'],
          ['Topology spread', 'none', 'Across zones — and match only pods without a component label, or the bundled Redis and the data service count as gateways.'],
        ],
      },
      { type: 'code', title: 'values.yaml — resilience', tabs: [{ id: 'yaml', lang: 'yaml', code: K8S_RESILIENCE, file: 'values.yaml' }] },
      {
        type: 'prose',
        title: 'Locking down egress',
        text: [
          'Kubernetes allows all egress until a NetworkPolicy says otherwise, and the deployment pages\' example policy allows `0.0.0.0/0`. A NetworkPolicy matches addresses and ports, not hostnames: the policy below narrows the gateway to DNS, HTTPS and the cache port, and pinning the actual hosts (Hybrid deployment lists them) takes an FQDN-aware CNI or an egress proxy. It only takes effect if your CNI enforces NetworkPolicy.',
        ],
      },
      { type: 'code', tabs: [{ id: 'bash', lang: 'bash', code: K8S_NETPOL }] },
      {
        type: 'table',
        title: 'Snippets to fix before you paste them',
        columns: ['Snippet', 'Where', 'Instead'],
        minWidth: 720,
        rows: [
          ['`portkey-ai/gateway` from `portkey-ai.github.io/helm`, `docker.io/portkeyai` images, tag `latest`', 'EKS, AKS and GKE pages; the community K8s guide', '`airs-gw/airs-gw` from `portkey-ai.github.io/airs-gw-helm`, images from `registry.portkey.ai/airsgw`, a pinned tag'],
          ['`CACHE_STORE: redis` with `REDIS_URL: redis://redis:6379`', 'Built-in Redis on all three pages', 'Leave both out. The chart wires its bundled Redis (`redis://airs-gw-redis:6379`), and a `REDIS_URL` in `environment.data` overrides that'],
          ['`SERVER_MODE: "mcp/all"`', 'EKS page', 'Not a value: `""` (gateway), `mcp` or `all`'],
          ['`spec.loadBalancerSourceRanges` under `service.annotations`', 'GKE page, copied by the community guide', 'It is a Service field, which the chart\'s gateway Service does not render; use an internal load balancer and firewall rules'],
          ['`azure-load-balancer-health-probe-request-path` on the Ingress', 'AKS page, copied by the community guide', '`service.beta.kubernetes.io/*` annotations are read from Services — on app routing they belong in the controller\'s `loadBalancerAnnotations`'],
          ['`service.type` defaults to `NodePort`', 'Community K8s guide; the chart\'s stale Configuration.md', 'True of the legacy chart. `airs-gw` 1.2.0 defaults to `ClusterIP` on 8787 — keep it'],
          ['`http://airs-gw.airs-gw.svc.cluster.local:80`', 'Community deployment guide, "with the defaults"', '`service.port` is 8787: `http://<release>.<namespace>.svc.cluster.local:8787`'],
          ['`kubectl port-forward svc/airs-gw` · `kubectl logs deployment/airs-gw`', 'Common practice; the community guide hit the first', 'With the bundled Redis these can resolve to the Redis pod (same selector labels). Select the pod as in step 7'],
        ],
      },
      {
        type: 'code',
        title: 'Tear down a lab',
        tabs: CLOUD_TABS(K8S_TEARDOWN_EKS, K8S_TEARDOWN_AKS, K8S_TEARDOWN_GKE),
      },
      {
        type: 'callout', tone: 'info',
        text: 'Then delete the gateway under Gateway Registration in SCM — the community guide notes that this, not `helm uninstall`, is what invalidates its client auth key.',
      },
      {
        type: 'cards',
        min: 260,
        items: [
          { icon: Waypoints, tone: '#EC4899', title: 'Install and upgrade the chart', kicker: 'Hybrid deployment',
            text: 'Registration, the two required values, the pinned install, egress hosts, upgrades and rollback.', go: 'gw-hybrid' },
          { icon: CloudCog, tone: '#EC4899', title: 'No Kubernetes?', kicker: 'ECS · Container Apps',
            text: 'The same gateway from the Terraform modules — and the version traps in their pins.', go: 'gw-hybrid-serverless' },
          { icon: Plug, tone: '#EC4899', title: 'Provider credentials from the pod', kicker: 'Model providers',
            text: 'Bedrock through the pod\'s role, Vertex through workload identity, Azure OpenAI through managed identity.', go: 'gw-providers' },
        ],
      },
      { type: 'links', title: 'Community guides behind this page', items: pick('imHybK8s', 'imHybK8sIdentity', 'imHybK8sIngress', 'imHybridInfra', 'imHybInfraOnPrem', 'imHybPhase2') },
    ],
  },
  {
    id: 'gw-hybrid-serverless',
    group: 'gateway',
    title: 'Hybrid on ECS or Azure Container Apps',
    sub: 'The Terraform modules, step by step — secrets by reference, the front door, production changes, and the version traps',
    minutes: 20,
    level: 'Setup',
    docs: pick('imHybServerless', 'imHybServerlessSecrets', 'imHybServerlessFargate', 'imHybInfraSizing', 'agEcs', 'agAca', 'ghGwInfra', 'ghGwInfraRel',
      'ghGwInfraMigr3', 'ghGwInfraEcs', 'ghGwInfraAca', 'ghGwInfraAcaVars', 'ghGwInfraCfn', 'ghGwInfraBedrock', 'agPrivateNet', 'agChangelog'),
    blocks: [
      {
        type: 'prose',
        text: [
          'ECS and Azure Container Apps run the same gateway without Kubernetes. One Terraform module call from `Portkey-AI/portkey-gateway-infrastructure` builds the network, the runtime, the cache, the log store and the load balancer, and reads the registry login and client auth key from Secrets Manager or Key Vault **by reference**, which keeps the client auth key out of Terraform state.',
          'The ECS and ACA pages have you request the registry login and client auth key from Palo Alto Networks against your organisation id. The modules pull `portkeyai/gateway_enterprise` from Docker Hub; the Gateway Registration file targets `registry.portkey.ai` — whether its credentials work here is not documented. The order and hardening below follow a community implementation guide (not PANW documentation); the values come from the official pages and the module source.',
        ],
      },
      {
        type: 'table',
        title: 'ECS and Container Apps at a glance',
        columns: ['What', 'Amazon ECS', 'Azure Container Apps'],
        minWidth: 700,
        rows: [
          ['Module · Terraform', '`//terraform/ecs` · 1.13 or later', '`//terraform/aca` · 1.5 or later'],
          ['Secrets', 'Secrets Manager — the module takes **ARNs**', 'Key Vault — the module takes secret **names**: `docker-username`, `docker-password`, `portkey-client-auth`, `organisations-to-sync`'],
          ['Compute', 'An EC2 Auto Scaling capacity provider (`create_cluster = true`)', 'Managed replicas'],
          ['Sizing floor', '1 vCPU (1024 units) and 2 GiB per task, across AZs, autoscaling on', '1 vCPU and 2 GiB per replica, autoscaling across zones'],
          ['Network', 'A new or existing VPC', '`network_mode` `none`, `new` or `existing` — a VNet is needed for zone redundancy, Application Gateway and Private Link'],
          ['Front door', 'ALB (TLS with ACM, WAF, host routing) or NLB (layer 4, no host routing)', 'Built-in ingress with a managed HTTPS FQDN, or Application Gateway (WAF_v2, your certificate)'],
          ['MCP (`server_mode` `all`)', 'Needs an ALB with host routing and `mcp_gateway_base_url`', 'Deploys a separate MCP app'],
          ['Cache', 'Built-in Redis task, or ElastiCache (`aws-elastic-cache`)', 'Built-in Redis app, `azure-redis` (standalone or cluster) or `azure-managed-redis` (standalone)'],
          ['Log store', 'An S3 bucket you name; the task role gets `s3:PutObject` and `s3:GetObject` on it', 'A storage account and container created for you, unless you name one'],
          ['Rollouts', 'Rolling, blue/green, canary, linear', 'Container Apps revisions'],
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Module versions: one tag series, and the docs pin two old ones',
        text: [
          'Tags in `portkey-gateway-infrastructure` cover the whole repository — v1.0.0 through **v3.0.0** (29 Jul 2026) — so one `?ref=` pins ECS and ACA alike. The community guide\'s advice that each module carries its own version tags does not match the repository.',
          'The ECS page pins `v2.0.0`, whose default gateway image tag is `latest`. The ACA page pins `v1.1.3`, which ignores `gateway_image` changes after the first apply — an upgrade there silently does nothing (fixed in v1.1.4). v3.0.0 pins gateway `2.16.0` and data service `1.9.0` by default, makes ECS Exec opt-in, and breaks ACA Private Link: a new FQDN, `private.azure-cp.portkey.ai`, and a recreated endpoint PANW must approve again. Read its migration guide before moving an existing ACA stack.',
        ],
      },
      {
        type: 'steps',
        title: 'Amazon ECS',
        steps: [
          {
            title: 'Put the two secrets in Secrets Manager',
            text: 'Registry credentials in one secret; the client auth key and organisation id as two JSON keys in another. Write them from files, encrypt them with your own KMS key, and give `secretsmanager:GetSecretValue` to the task execution role and the few people who need it.',
            code: [{ id: 'bash', lang: 'bash', code: ECS_SECRETS }],
            note: 'The repository\'s `cloudformation/secrets.yaml` creates the same two secrets from parameters and outputs `DockerCredentialsSecretArn` and `ClientOrgSecretNameArn`. `create-secret` is not re-runnable — on a name that exists, write a new version with `put-secret-value`.',
          },
          {
            title: 'Create the state and log buckets',
            text: 'Remote state from the first apply, so an interrupted run can resume; state holds identifiers and configuration, so keep the bucket private and encrypted. The log bucket holds every prompt and completion body — the module grants the task role access but does not harden the bucket.',
            code: [{ id: 'bash', lang: 'bash', code: ECS_STATE }],
          },
          {
            title: 'Write main.tf',
            text: [
              'Choose the load balancer first: changing `lb_type` or `internal_lb` later replaces it, DNS name and all. ALB for TLS, WAF and host routing (required for `all`); NLB for plain layer 4 — and an NLB\'s TCP idle timeout cannot be raised.',
              '`allowed_lb_cidrs` is the input with a security consequence: left empty, the module uses the VPC CIDR for an internal load balancer and `0.0.0.0/0` for an internet-facing one. The listener port is not a module input — read it from the created listener before writing firewall rules.',
            ],
            code: [{ id: 'hcl', label: 'Terraform', lang: 'hcl', code: ECS_MAIN, file: 'main.tf' }],
          },
          {
            title: 'Apply and check the service',
            text: 'Tasks cycling right after apply almost always means the image pull: the stopped-task reason names an authentication failure, which points back at the registry secret.',
            code: [{ id: 'bash', lang: 'bash', code: ECS_APPLY }],
          },
          {
            title: 'Before real traffic',
            text: 'The built-in Redis task holds every synced config, rate-limit and budget counter, with no TLS, password or failover — move to ElastiCache in the same VPC (its security group must admit the gateway and data service tasks on 6379), in a quiet window, since the cutover drops the counters. Then scale.',
            code: [{ id: 'hcl', label: 'Terraform', lang: 'hcl', code: ECS_PROD }],
          },
        ],
      },
      {
        type: 'steps',
        title: 'Azure Container Apps',
        steps: [
          {
            title: 'Create the Key Vault and the four secrets',
            text: 'RBAC authorisation on, the four names exactly as the module expects them. Before applying, turn on purge protection and restrict the vault\'s network access to your ranges and the deployment network.',
            code: [{ id: 'bash', lang: 'bash', code: ACA_KV }],
            note: 'Up to v1.1.3 the module read the registry username through a data source as whoever runs Terraform, so that principal kept needing read access on the vault (the community guide verified this on v1.1.3). v3.0.0 reworked the registry credential handling and moved the module identity to per-secret grants — read the plan.',
          },
          {
            title: 'Remote state',
            text: 'The ACA page\'s examples use local state; a storage account from the first apply saves moving it later.',
            code: [{ id: 'bash', lang: 'bash', code: ACA_STATE }],
          },
          {
            title: 'Write main.tf',
            text: [
              'Set `NODE_ENV` to `production`: the page\'s example ships `development`, under which the gateway\'s private-network guard trusts `localhost`, `127.0.0.1`, `::1` and `host.docker.internal` by default.',
              'For scaling on concurrent requests rather than CPU, the docs set `cpu_scale_threshold = null`. The module types it `optional(number, 70)`, and Terraform applies an optional attribute\'s default when the value is null — check that `terraform plan` shows an `http_scale_rule` before relying on it.',
            ],
            code: [{ id: 'hcl', label: 'Terraform', lang: 'hcl', code: ACA_MAIN, file: 'main.tf' }],
          },
          {
            title: 'Apply and check the app',
            text: 'An unauthorised image pull means the registry secrets did not resolve: check that `secrets_key_vault` and `docker_credentials` name the vault from step 1 before suspecting the password.',
            code: [{ id: 'bash', lang: 'bash', code: ACA_APPLY }],
          },
          {
            title: 'Before real traffic',
            text: 'Application Gateway for WAF and your own certificate, a managed Redis over TLS, and — if you want logs in an account you already run — your storage account through the module\'s managed identity. Each is a set of arguments inside the module block.',
            code: [
              { id: 'hcl', label: 'Terraform', lang: 'hcl', code: ACA_PROD },
              { id: 'bash', label: 'App Gateway timeout', lang: 'bash', code: ACA_TIMEOUT },
            ],
          },
        ],
      },
      {
        type: 'callout', tone: 'warn', title: 'Rebuilds, not edits',
        text: [
          'ECS: a different `lb_type` or `internal_lb` replaces the load balancer and its DNS name. ACA: a different `network_mode` or `public_ingress` recreates the environment and every app in it — the built-in Redis, and the auto-created storage account with every log written to it. Look for "must be replaced" in the plan.',
          '`terraform destroy` deletes a bucket or storage account the module created, with its logs; secrets and stores you created yourself survive. Then delete the gateway in SCM, and purge the Key Vault if you want its name back within 90 days.',
        ],
      },
      {
        type: 'callout', tone: 'docs', title: 'Fargate is not a documented option',
        text: 'With `create_cluster = true`, every published example, the ECS module registers a single EC2 Auto Scaling capacity provider — the instance-type and ASG-size inputs exist because tasks run on instances you own. The task definition does declare `EC2` and `FARGATE` compatibility with `awsvpc` networking, so `create_cluster = false` plus your own Fargate cluster and `capacity_provider_name` looks possible from the source; the community guide flags that as unvalidated, and no PANW or Portkey page describes it.',
      },
      {
        type: 'table',
        title: 'Upgrades',
        columns: ['Change', 'ECS', 'Container Apps'],
        minWidth: 640,
        rows: [
          ['A new gateway release', 'Set `gateway_image.tag`; the plan shows a new task definition; the rollout follows `gateway_deployment_configuration`', 'Set `gateway_image.tag` — ignored by v1.1.3 and older, a new revision from v1.1.4'],
          ['A new module release', 'Change `?ref=`, `terraform init -upgrade`, read the plan, apply to non-production first', 'The same; for v3.0.0, first `terraform state rm` the old Private Link resources, as the migration guide says'],
          ['Roll back', 'Revert the ref or tag and apply', 'Revert the ref or tag and apply'],
        ],
        note: 'The ECS page\'s Version Pinning and Upgrades section is the only documented upgrade procedure on any hybrid target. Nothing publishes which module versions go with which gateway versions — keep a non-production stack on the same pins as production so upgrades have somewhere to fail first.',
      },
      {
        type: 'table',
        title: 'Where the sources disagree',
        columns: ['Topic', 'Docs · community guide', 'Module source and releases'],
        minWidth: 720,
        rows: [
          ['ECS outputs', 'The community guide\'s main.tf exports `cluster_name` and `service_name` from the module and reads them in its checks', 'The ECS module has no such outputs (v2.0.0 or v3.0.0) — that plan fails. The cluster is `<project_name>-cluster`, the service `gateway`'],
          ['Version tags', 'Community guide: each module has its own tags; do not copy a `ref` between them', 'One repository-wide series, v1.0.0 to v3.0.0'],
          ['Default image', 'ECS page sets none; ACA page pins `2.2.2`', 'v2.0.0 defaults to `latest`; v3.0.0 to `2.16.0`; v1.1.3 ignores later tag changes'],
          ['ACA Private Link FQDN', 'Community guide, on module v1.1.3: zone `privatelink-az.portkey.ai`, record `azure-cp`, base paths on `private.azure-cp.portkey.ai`', 'v1.1.3 creates `azure-cp.privatelink-az.portkey.ai`; `private.azure-cp.portkey.ai` arrives with v3.0.0'],
          ['ACA Redis', 'ACA page: heading "Azure Managed Redis", example endpoint on `redis.cache.windows.net:6380` (Azure Cache for Redis)', '`azure-redis` takes standalone or cluster; `azure-managed-redis` standalone only (v1.1.3 release note)'],
          ['`NODE_ENV`', 'ACA page example: `development`', 'Not set by the module; the private-network page: only `production` empties the trusted-host defaults'],
          ['Inbound access', 'ECS and ACA pages: allow-list the management plane\'s IPs inbound (`allowed_lb_cidrs`)', 'Community guide: PANW said on 2026-09-27 that SCM is outbound-only — keep `allowed_lb_cidrs` to your applications. Unconfirmed in official docs'],
        ],
      },
      {
        type: 'cards',
        min: 260,
        items: [
          { icon: Waypoints, tone: '#EC4899', title: 'The Helm path and the shared facts', kicker: 'Hybrid deployment',
            text: 'Registration, egress hosts, residency, and where docs and chart disagree.', go: 'gw-hybrid' },
          { icon: Boxes, tone: '#EC4899', title: 'On Kubernetes instead', kicker: 'EKS · AKS · GKE',
            text: 'Cluster, stores, workload identity and a TLS front door for the airs-gw chart.', go: 'gw-hybrid-k8s' },
          { icon: Plug, tone: '#EC4899', title: 'Bedrock from the task role', kicker: 'Model providers',
            text: 'AWS Service Role on the integration, `gateway_task_role_policy_arns` on the module — no static key.', go: 'gw-providers' },
        ],
      },
      { type: 'links', title: 'Community guides behind this page', items: pick('imHybServerless', 'imHybServerlessSecrets', 'imHybServerlessFargate', 'imHybridInfra', 'imHybInfraTeardown') },
    ],
  },
]
