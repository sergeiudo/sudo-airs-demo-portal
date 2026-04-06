#!/usr/bin/env bash
# setup-mcp.sh — One-time setup for the Prisma AIRS MCP Demo Server
# Run once after cloning or pulling on a new machine (local or EC2).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$SCRIPT_DIR/mcp-server"
VENV_DIR="$MCP_DIR/.venv"

echo "==> Setting up MCP Demo Server..."

# Find Python 3
PYTHON=$(command -v python3 || command -v python)
if [ -z "$PYTHON" ]; then
  echo "ERROR: Python 3 not found. Install Python 3.9+ and retry."
  exit 1
fi

PY_VERSION=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "==> Using Python $PY_VERSION at $PYTHON"

# Create venv
if [ ! -d "$VENV_DIR" ]; then
  echo "==> Creating virtual environment at $VENV_DIR"
  "$PYTHON" -m venv "$VENV_DIR"
else
  echo "==> Virtual environment already exists, skipping creation"
fi

# Install dependencies
echo "==> Installing dependencies from requirements.txt"
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet -r "$MCP_DIR/requirements.txt"

echo ""
echo "✓ MCP Demo Server setup complete."
echo ""
echo "To start manually:"
echo "  $VENV_DIR/bin/python3 $MCP_DIR/mcp_server.py"
echo ""
echo "To add to PM2 (EC2):"
echo "  pm2 start \"$VENV_DIR/bin/python3 $MCP_DIR/mcp_server.py\" --name mcp-server"
echo "  pm2 save"
