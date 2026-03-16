# SUDO AIRS Demo — AWS EC2 Deployment Guide

This guide deploys the full SUDO AIRS demo portal on a single EC2 instance accessible to a team via IP allowlist.

---

## Architecture

```
Browser (team VPN)
       ↓ port 80
    Nginx
    ├── /          → serves React SPA from dist/
    ├── /api/*     → proxy → Express server (port 3001)
    └── /scan-model → proxy → Python FastAPI scanner (port 8001)

PM2 manages:
  ├── airs-server   (Node.js / server.js)
  └── airs-scanner  (Python / scanner_server.py)

IAM role provides Bedrock access — no AWS keys needed in .env
```

---

## Prerequisites

- AWS account with Bedrock enabled in `us-west-2`
- An EC2 key pair already created in the target region
- Your VPN / team IP CIDR ranges (for security group allowlist)
- Credentials ready (see checklist at the bottom)

---

## Phase 1 — AWS Infrastructure (CloudShell)

Open **AWS CloudShell** in the target region and run the following steps.

### Step 1 — Set variables

```bash
export AWS_DEFAULT_REGION=us-west-2
export VPC_ID=vpc-051ec53567ee31eae
export SUBNET_ID=subnet-036bac4d456ad76c9
export KEY_NAME=sud-aws-airs-us-w2
```

### Step 2 — Create IAM role with Bedrock access

```bash
cat > /tmp/ec2-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ec2.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name sudo-airs-demo-role \
  --assume-role-policy-document file:///tmp/ec2-trust.json

aws iam attach-role-policy \
  --role-name sudo-airs-demo-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess

aws iam create-instance-profile \
  --instance-profile-name sudo-airs-demo-profile

aws iam add-role-to-instance-profile \
  --instance-profile-name sudo-airs-demo-profile \
  --role-name sudo-airs-demo-role

echo "IAM role ready"
```

> **Note:** If deploying a second instance, the IAM role and instance profile already exist — skip this step.

### Step 3 — Create security group

Replace the CIDRs below with your team's VPN IP ranges.

```bash
SG_ID=$(aws ec2 create-security-group \
  --group-name sudo-airs-demo-sg \
  --description "SUDO AIRS Demo portal" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

echo "Security Group: $SG_ID"

# HTTP access
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 80 --cidr 202.181.131.0/24
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 80 --cidr 44.207.86.0/24

# SSH access
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr 202.181.131.0/24
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr 44.207.86.0/24

echo "Security group configured"
```

### Step 4 — Get latest Amazon Linux 2023 AMI

```bash
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters \
    "Name=name,Values=al2023-ami-2023*-x86_64" \
    "Name=state,Values=available" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)

echo "AMI: $AMI_ID"
```

### Step 5 — Launch EC2 instance

```bash
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t3.medium \
  --key-name $KEY_NAME \
  --subnet-id $SUBNET_ID \
  --security-group-ids $SG_ID \
  --iam-instance-profile Name=sudo-airs-demo-profile \
  --associate-public-ip-address \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=sudo-airs-demo}]" \
  --query 'Instances[0].InstanceId' --output text)

echo "Instance launched: $INSTANCE_ID"
```

### Step 6 — Wait for public IP

```bash
echo "Waiting for instance..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "Public IP: $PUBLIC_IP"
echo "SSH: ssh -i ~/.ssh/$KEY_NAME.pem ec2-user@$PUBLIC_IP"
```

---

## Phase 2 — Server Setup (SSH)

SSH in from your local terminal (not CloudShell — you need the PEM key):

```bash
ssh -i ~/.ssh/sud-aws-airs-us-w2.pem ec2-user@<PUBLIC_IP>
```

> If permission denied: `chmod 400 ~/.ssh/sud-aws-airs-us-w2.pem`

### Step 1 — Install dependencies

```bash
sudo dnf update -y
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs python3.11 python3.11-pip nginx git
sudo npm install -g pm2
echo "Node: $(node -v) | Python: $(python3.11 --version)"
```

### Step 2 — Clone repo and install npm packages

```bash
sudo mkdir -p /opt/sudo-airs-demo
sudo chown ec2-user:ec2-user /opt/sudo-airs-demo
git clone https://github.com/sergeiudo/sudo-airs-local-demo-vertex-bedrock.git /opt/sudo-airs-demo
cd /opt/sudo-airs-demo
npm install
```

### Step 3 — Set up Python scanner venv

```bash
cd /opt/sudo-airs-demo
python3.11 -m venv airs-model-scanner-main/.venv
airs-model-scanner-main/.venv/bin/pip install fastapi "uvicorn[standard]" requests python-dotenv python-multipart
```

### Step 4 — Create .env file

```bash
nano /opt/sudo-airs-demo/.env
```

Paste and fill in your credentials (remove all comment lines — lines starting with `#`):

```env
AIRS_API_KEY=
AIRS_PROFILE_NAME=
AIRS_BASE_URL=https://service.api.aisecurity.paloaltonetworks.com

GCP_PROJECT_ID=
GCP_REGION=us-central1
VERTEX_MODEL=gemini-2.0-flash-001
GOOGLE_APPLICATION_CREDENTIALS=/opt/sudo-airs-demo/gcp-key.json

AWS_REGION=us-west-2
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6-20250514-v1:0

MODEL_SECURITY_CLIENT_ID=
MODEL_SECURITY_CLIENT_SECRET=
TSG_ID=
LOCAL_SCAN_GROUP_UUID=
HF_SCAN_GROUP_UUID=

PROXY_PORT=3001
```

> **Important:** Do not include `#` comment lines — they cause `setup-scanner.sh` to fail.

### Step 5 — Upload GCP service account key

From a **new local terminal tab**:

```bash
scp -i ~/.ssh/sud-aws-airs-us-w2.pem ~/path/to/gcp-key.json ec2-user@<PUBLIC_IP>:/opt/sudo-airs-demo/gcp-key.json
```

### Step 6 — Run Model Scanner SDK setup

```bash
cd /opt/sudo-airs-demo
bash setup-scanner.sh
```

### Step 7 — Build React frontend

```bash
cd /opt/sudo-airs-demo
npm run build
```

### Step 8 — Configure Nginx

```bash
printf 'server {\n    listen 80;\n    server_name _;\n\n    root /opt/sudo-airs-demo/dist;\n    index index.html;\n\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n\n    location /api/ {\n        proxy_pass http://127.0.0.1:3001;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n    }\n\n    location /scan-model {\n        proxy_pass http://127.0.0.1:8001;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_read_timeout 300;\n        client_max_body_size 500M;\n    }\n}\n' | sudo tee /etc/nginx/conf.d/sudo-airs-demo.conf

sudo nginx -t && sudo systemctl enable nginx && sudo systemctl start nginx
```

### Step 9 — Create PM2 config

```bash
F=/opt/sudo-airs-demo/ecosystem.config.cjs
echo 'module.exports = {' > $F
echo '  apps: [' >> $F
echo '    {' >> $F
echo '      name: "airs-server",' >> $F
echo '      script: "server.js",' >> $F
echo '      cwd: "/opt/sudo-airs-demo",' >> $F
echo '      env_file: "/opt/sudo-airs-demo/.env",' >> $F
echo '    },' >> $F
echo '    {' >> $F
echo '      name: "airs-scanner",' >> $F
echo '      script: "/opt/sudo-airs-demo/airs-model-scanner-main/.venv/bin/python3.11",' >> $F
echo '      args: "scanner_server.py",' >> $F
echo '      cwd: "/opt/sudo-airs-demo",' >> $F
echo '      interpreter: "none",' >> $F
echo '      env_file: "/opt/sudo-airs-demo/.env",' >> $F
echo '    }' >> $F
echo '  ]' >> $F
echo '}' >> $F
```

### Step 10 — Start services and save PM2 config

```bash
cd /opt/sudo-airs-demo
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user | tail -1 | sudo bash
```

### Step 11 — Verify everything is healthy

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/scanner/health
curl -s -o /dev/null -w "Nginx: %{http_code}\n" http://localhost:80
pm2 status
```

The demo is live at **http://\<PUBLIC_IP\>**

---

## Updating Credentials

To swap to a different SCM tenant or update any credential:

```bash
nano /opt/sudo-airs-demo/.env
pm2 restart all
curl -s http://localhost:3001/api/health
```

No reboot required.

---

## Updating the App (after a git push)

```bash
cd /opt/sudo-airs-demo
git pull
npm install
npm run build
pm2 restart airs-server
```

The scanner only needs restarting if `scanner_server.py` changed:
```bash
pm2 restart airs-scanner
```

---

## Credentials Checklist

| Credential | Source |
|---|---|
| `AIRS_API_KEY` | SCM → AI Security → API Applications |
| `AIRS_PROFILE_NAME` | SCM → AI Security → Security Profiles |
| `AIRS_BASE_URL` | Your AIRS region endpoint |
| `GCP_PROJECT_ID` | Google Cloud Console |
| `GOOGLE_APPLICATION_CREDENTIALS` | GCP Service Account JSON key file |
| `MODEL_SECURITY_CLIENT_ID` | SCM → Model Security |
| `MODEL_SECURITY_CLIENT_SECRET` | SCM → Model Security |
| `TSG_ID` | SCM tenant settings |
| `LOCAL_SCAN_GROUP_UUID` | SCM → Model Security → Scan Groups |
| `HF_SCAN_GROUP_UUID` | SCM → Model Security → Scan Groups |

Bedrock credentials are **not needed** — the EC2 IAM role (`sudo-airs-demo-role`) provides access automatically.

---

## Known Gotchas

| Issue | Fix |
|---|---|
| `setup-scanner.sh` export errors | Remove `#` comment lines from `.env` before running |
| `ecosystem.config.js` ESM error | Use `.cjs` extension — `package.json` sets `"type": "module"` |
| Scanner `RuntimeError: event loop` | Run `python3.11 scanner_server.py` directly, not via `python -m uvicorn` |
| Heredoc `EOF not found` | Paste issues add leading spaces — use `printf` or `echo >>` instead |
| `base64: invalid input` | Long base64 strings wrap when pasted — use `echo >>` line by line instead |
