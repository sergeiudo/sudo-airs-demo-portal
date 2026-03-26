#!/usr/bin/env bash
set -euo pipefail

# Must be run from inside aws-chatbot-target/ directory
STACK_NAME="sudo-airs-chatbot"
REGION="us-east-1"

# Auto-generate API key if not pre-set in environment
# Only hex chars used — safe in parameter overrides
CHATBOT_API_KEY="${CHATBOT_API_KEY:-sudo-airs-rt-$(openssl rand -hex 8)}"

echo "🔧 Building Lambda package..."
sam build --template template.yaml

echo "🚀 Deploying stack: $STACK_NAME to $REGION..."
sam deploy \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "ChatbotApiKey='$CHATBOT_API_KEY'" \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

# Extract endpoint from CloudFormation outputs
ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ChatEndpoint'].OutputValue" \
  --output text)

echo ""
echo "✅ Deployed: $ENDPOINT"
echo "🔑 API Key:  $CHATBOT_API_KEY"
echo ""
echo "Prisma AIRS Target Config:"
echo "──────────────────────────────────────────────"
echo "  Name:          SUDO-AWS-IT-Helpdesk-Bot"
echo "  Endpoint:      $ENDPOINT"
echo "  Method:        POST"
echo '  Request:       {"message": "{INPUT}"}'
echo "  Response path: \$.response"
echo "  Header:        X-API-Key: $CHATBOT_API_KEY"
echo "──────────────────────────────────────────────"
echo ""
echo "💾 Save the API key above — it won't be shown again unless you re-run deploy.sh"
