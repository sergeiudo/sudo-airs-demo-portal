#!/bin/bash
# Kill any stale processes on all four ports
lsof -ti tcp:3001 | xargs kill -9 2>/dev/null   # Express proxy
lsof -ti tcp:5173 | xargs kill -9 2>/dev/null   # Vite frontend
lsof -ti tcp:8001 | xargs kill -9 2>/dev/null   # Python scanner
lsof -ti tcp:8002 | xargs kill -9 2>/dev/null   # MCP server
echo "Ports cleared — starting SUDO AIRS Demo..."
npm run dev
