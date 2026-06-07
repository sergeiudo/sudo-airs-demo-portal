#!/bin/bash
# ─── AIRS Release-Notes → Slack notifier installer ───────────────────────────
# Creates an isolated venv for airs-slack-notify.py and prints the cron line to
# schedule the daily check. Run once on the host that will post (e.g. EC2).
#
# Usage:
#   bash setup-slack-notify.sh                 # create venv + print cron instructions
#   bash setup-slack-notify.sh --dry-run       # also run a no-post scrape to verify
#   bash setup-slack-notify.sh --install-cron  # install the weekly cron job idempotently
#
# Schedule + timezone are overridable:
#   NOTIFY_TZ=America/New_York CRON_SCHEDULE="0 9 * * 1" bash setup-slack-notify.sh --install-cron
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$REPO_DIR/.venv-slack-notify"
PY="$VENV/bin/python"

# Schedule: every Sunday at 10:00 in the user's timezone (CRON_TZ handles DST automatically,
# so it stays correct even though EC2 runs in UTC). dow 0 = Sunday.
NOTIFY_TZ="${NOTIFY_TZ:-Asia/Jerusalem}"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 10 * * 0}"

DRY_RUN=false
INSTALL_CRON=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --install-cron) INSTALL_CRON=true ;;
    *) echo "Unknown flag: $arg" ; exit 1 ;;
  esac
done

# Load .env so we can sanity-check the webhook is configured.
if [ -f "$REPO_DIR/.env" ]; then
  export $(grep -v '^#' "$REPO_DIR/.env" | grep -v '^$' | xargs) >/dev/null 2>&1 || true
fi

if [ -z "${SLACK_WEBHOOK_URL:-}" ]; then
  echo "⚠  SLACK_WEBHOOK_URL is not set in .env — the notifier cannot post until you add it."
  echo "   Add a line like:  SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ"
else
  echo "✓ SLACK_WEBHOOK_URL is set."
fi

echo "→ Creating venv at $VENV ..."
if [ ! -d "$VENV" ]; then
  python3 -m venv "$VENV"
fi
"$PY" -m pip install --quiet --upgrade pip
"$PY" -m pip install --quiet requests beautifulsoup4 python-dotenv
echo "✓ Dependencies installed (requests, beautifulsoup4, python-dotenv)."

if $DRY_RUN; then
  echo "→ Dry-run scrape (will NOT post — answering 'n')..."
  echo "n" | "$PY" "$REPO_DIR/airs-slack-notify.py" || true
fi

# Self-contained, idempotent cron block (delimited by markers so re-running replaces it).
CRON_CMD="cd $REPO_DIR && $PY airs-slack-notify.py --yes >> $REPO_DIR/airs-slack-notify.log 2>&1"
CRON_BLOCK="# >>> airs-slack-notify >>>
CRON_TZ=$NOTIFY_TZ
$CRON_SCHEDULE $CRON_CMD
# <<< airs-slack-notify <<<"

if $INSTALL_CRON; then
  echo "→ Installing weekly cron (Sunday 10:00 $NOTIFY_TZ)..."
  ( crontab -l 2>/dev/null | sed '/# >>> airs-slack-notify >>>/,/# <<< airs-slack-notify <<</d'; echo "$CRON_BLOCK" ) | crontab -
  echo "✓ Cron installed:"
  crontab -l | sed -n '/# >>> airs-slack-notify >>>/,/# <<< airs-slack-notify <<</p' | sed 's/^/    /'
fi

echo ""
echo "──────────────────────────────────────────────────────────────────────────"
echo "Setup complete."
echo "Schedule: every Sunday at 10:00 ($NOTIFY_TZ) — posts only when new features appear."
echo ""
if ! $INSTALL_CRON; then
  echo "Install the cron job:   bash setup-slack-notify.sh --install-cron"
  echo ""
  echo "...or add this block manually (crontab -e):"
  echo ""
  echo "$CRON_BLOCK" | sed 's/^/    /'
  echo ""
fi
echo "Verify:     crontab -l"
echo "Test now:   $PY $REPO_DIR/airs-slack-notify.py --yes     # posts only if new features"
echo "Force post: $PY $REPO_DIR/airs-slack-notify.py --force"
echo "──────────────────────────────────────────────────────────────────────────"
