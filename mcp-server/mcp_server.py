"""
Prisma AIRS MCP Security Demo — MCP Tool Server
FastAPI on port 8002 (default). Sandboxed to demo-workspace/.

Tools:
  - read_file(path)              Read a file from the sandbox
  - web_fetch(url)               Fetch a URL (real HTTP, truncated)
  - execute_code(code)           Run Python code in subprocess
  - get_memory(key)              Read from in-memory KV store
  - set_memory(key, value)       Write to in-memory KV store
"""

import os
import sys
import subprocess
import textwrap
import httpx
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

PORT = int(os.environ.get("MCP_SERVER_PORT", 8002))

# Sandbox: resolve to absolute path next to this file
WORKSPACE = (Path(__file__).parent / "demo-workspace").resolve()

# In-memory store (resets on server restart)
_memory: dict[str, str] = {
    "session_id": "sess_8f2a91bc4d",
    "current_user": "demo-operator",
    "last_query": "show all customer records",
}

app = FastAPI(title="AIRS MCP Demo Server", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request models ─────────────────────────────────────────────────────────────

class ReadFileRequest(BaseModel):
    path: str

class WebFetchRequest(BaseModel):
    url: str

class ExecuteCodeRequest(BaseModel):
    code: str

class GetMemoryRequest(BaseModel):
    key: str

class SetMemoryRequest(BaseModel):
    key: str
    value: str


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "workspace": str(WORKSPACE), "tools": ["read_file", "web_fetch", "execute_code", "get_memory", "set_memory"]}


# ── Tool: read_file ────────────────────────────────────────────────────────────

@app.post("/tools/read_file")
def read_file(req: ReadFileRequest):
    """Read a file from the sandboxed demo-workspace directory."""
    # Resolve path relative to workspace and check it stays inside
    try:
        target = (WORKSPACE / req.path).resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")

    if not str(target).startswith(str(WORKSPACE)):
        # Path traversal detected — return an error (AIRS should have blocked this already)
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: path '{req.path}' is outside the sandbox workspace"
        )

    if not target.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {req.path}")

    if not target.is_file():
        raise HTTPException(status_code=400, detail=f"Not a file: {req.path}")

    content = target.read_text(errors="replace")
    return {
        "tool": "read_file",
        "path": req.path,
        "resolved_path": str(target.relative_to(WORKSPACE)),
        "size_bytes": target.stat().st_size,
        "content": content,
    }


# ── Tool: web_fetch ────────────────────────────────────────────────────────────

@app.post("/tools/web_fetch")
def web_fetch(req: WebFetchRequest):
    """Fetch a URL and return the first 3000 chars of the response body."""
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    try:
        with httpx.Client(timeout=8.0, follow_redirects=True) as client:
            r = client.get(url, headers={"User-Agent": "AIRS-MCP-Demo/1.0"})
        body = r.text[:3000]
        return {
            "tool": "web_fetch",
            "url": url,
            "status_code": r.status_code,
            "content_type": r.headers.get("content-type", "unknown"),
            "body_preview": body,
            "truncated": len(r.text) > 3000,
        }
    except httpx.ConnectError as e:
        return {
            "tool": "web_fetch",
            "url": url,
            "status_code": None,
            "error": f"Connection failed: {str(e)}",
            "body_preview": "",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fetch error: {str(e)}")


# ── Tool: execute_code ─────────────────────────────────────────────────────────

@app.post("/tools/execute_code")
def execute_code(req: ExecuteCodeRequest):
    """Execute Python code in a sandboxed subprocess (5s timeout)."""
    code = req.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="No code provided")

    try:
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=5,
            # No shell=True — explicit argv prevents shell injection
        )
        return {
            "tool": "execute_code",
            "code": textwrap.shorten(code, width=200),
            "stdout": result.stdout[:2000],
            "stderr": result.stderr[:500],
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {
            "tool": "execute_code",
            "code": textwrap.shorten(code, width=200),
            "stdout": "",
            "stderr": "Execution timed out (5s limit)",
            "returncode": -1,
        }


# ── Tool: get_memory ───────────────────────────────────────────────────────────

@app.post("/tools/get_memory")
def get_memory(req: GetMemoryRequest):
    """Retrieve a value from the in-memory key-value store."""
    value = _memory.get(req.key)
    if value is None:
        return {"tool": "get_memory", "key": req.key, "found": False, "value": None}
    return {"tool": "get_memory", "key": req.key, "found": True, "value": value}


# ── Tool: set_memory ───────────────────────────────────────────────────────────

@app.post("/tools/set_memory")
def set_memory(req: SetMemoryRequest):
    """Store a value in the in-memory key-value store."""
    _memory[req.key] = req.value
    return {"tool": "set_memory", "key": req.key, "value": req.value, "stored": True}


if __name__ == "__main__":
    import uvicorn
    print(f"[MCP Server] Starting on port {PORT}")
    print(f"[MCP Server] Workspace: {WORKSPACE}")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="warning")
