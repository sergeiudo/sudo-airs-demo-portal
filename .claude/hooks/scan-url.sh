#!/bin/bash

# Prisma AIRS URL Security Scanner Hook for Claude Code
# Receives JSON input via stdin from Claude Code hooks

# Load .env from project root if PRISMA_AIRS vars are not already set
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
if [[ -f "$ENV_FILE" && ( -z "$PRISMA_AIRS_API_KEY" || -z "$PRISMA_AIRS_PROFILE_NAME" ) ]]; then
    while IFS='=' read -r key value; do
        [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
        case "$key" in
            AIRS_API_KEY)      export PRISMA_AIRS_API_KEY="${PRISMA_AIRS_API_KEY:-$value}" ;;
            AIRS_PROFILE_NAME) export PRISMA_AIRS_PROFILE_NAME="${PRISMA_AIRS_PROFILE_NAME:-$value}" ;;
            AIRS_BASE_URL)     export PRISMA_AIRS_URL="${PRISMA_AIRS_URL:-$value}" ;;
        esac
    done < "$ENV_FILE"
fi

# Configuration with environment variable support
LOG_FILE="${SECURITY_LOG_PATH:-$PROJECT_ROOT/.claude/hooks/security.log}"
AIRS_BASE_URL="${PRISMA_AIRS_URL:-https://service.api.aisecurity.paloaltonetworks.com}"
AIRS_API_URL="${AIRS_BASE_URL%/}/v1/scan/sync/request"
AIRS_API_KEY="${PRISMA_AIRS_API_KEY}"
PROFILE_NAME="${PRISMA_AIRS_PROFILE_NAME}"

# Create log file if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

# Check if required environment variables are configured
if [[ -z "$AIRS_API_KEY" ]]; then
    echo "[$(date)] ERROR: PRISMA_AIRS_API_KEY environment variable not set" >> "$LOG_FILE"
    exit 0  # Allow but log error
fi

if [[ -z "$PROFILE_NAME" ]]; then
    echo "[$(date)] ERROR: PRISMA_AIRS_PROFILE_NAME environment variable not set" >> "$LOG_FILE"
    exit 0  # Allow but log error
fi

# Read JSON input from stdin
INPUT_JSON=$(cat)

# Parse the hook input
TOOL_NAME=$(echo "$INPUT_JSON" | jq -r '.tool_name // "unknown"')
URL=$(echo "$INPUT_JSON" | jq -r '.url // empty')

# If no URL found, exit (nothing to scan)
if [[ -z "$URL" ]]; then
    exit 0  # Allow if no URL found
fi

echo "[$(date)] 🌐 $TOOL_NAME: $URL" >> "$LOG_FILE"

# Create JSON payload for URL scanning
PAYLOAD=$(cat << EOF
{
  "tr_id": "url-scan-$(date +%s)",
  "ai_profile": {
    "profile_name": "$PROFILE_NAME"
  },
  "metadata": {
    "app_user": "claude-code-user",
    "tool_name": "$TOOL_NAME",
    "source": "pre-tool-use"
  },
  "contents": [
    {
      "prompt": "$URL"
    }
  ]
}
EOF
)

# Call Prisma AIRS API
SCAN_RESULT=$(curl -s -L "$AIRS_API_URL" \
  -H "Content-Type: application/json" \
  -H "x-pan-token: $AIRS_API_KEY" \
  -d "$PAYLOAD")

ACTION=$(echo "$SCAN_RESULT" | jq -r '.action // "unknown"')
CATEGORY=$(echo "$SCAN_RESULT" | jq -r '.category // "unknown"')
SCAN_ID=$(echo "$SCAN_RESULT" | jq -r '.scan_id // "unknown"')

# Extract ALL detection details dynamically
URL_DETECTIONS=""
DETECTED_CATEGORIES=$(echo "$SCAN_RESULT" | jq -r '.prompt_detected | to_entries | map(select(.value == true)) | map(.key) | .[]' 2>/dev/null)

while IFS= read -r category; do
    [[ -z "$category" ]] && continue
    URL_DETECTIONS="${URL_DETECTIONS}$category,"
done <<< "$DETECTED_CATEGORIES"

URL_DETECTIONS=$(echo "$URL_DETECTIONS" | sed 's/,$//')

# Handle the scan result
if [[ "$ACTION" == "block" ]]; then
    if [[ -n "$URL_DETECTIONS" ]]; then
        echo "[$(date)] 🚫 BLOCKED: $URL ($CATEGORY) - detected: [$URL_DETECTIONS] [scan:$SCAN_ID]" >> "$LOG_FILE"
    else
        echo "[$(date)] 🚫 BLOCKED: $URL ($CATEGORY) [scan:$SCAN_ID]" >> "$LOG_FILE"
    fi
    echo "🚫 BLOCKED: URL contains malicious content ($CATEGORY)" >&2
    exit 2  # Block the tool execution
elif [[ "$ACTION" != "allow" && "$ACTION" != "unknown" ]]; then
    if [[ -n "$URL_DETECTIONS" ]]; then
        echo "[$(date)] ⚠️  WARNING: $URL - $ACTION/$CATEGORY - detected: [$URL_DETECTIONS] [scan:$SCAN_ID]" >> "$LOG_FILE"
    else
        echo "[$(date)] ⚠️  WARNING: $URL - $ACTION/$CATEGORY [scan:$SCAN_ID]" >> "$LOG_FILE"
    fi
else
    if [[ -n "$URL_DETECTIONS" ]]; then
        echo "[$(date)] ✅ ALLOWED: $URL - detected: [$URL_DETECTIONS] [scan:$SCAN_ID]" >> "$LOG_FILE"
    else
        echo "[$(date)] ✅ ALLOWED: $URL [scan:$SCAN_ID]" >> "$LOG_FILE"
    fi
fi

exit 0