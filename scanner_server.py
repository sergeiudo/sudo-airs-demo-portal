"""
SUDO AIRS Demo — Model Scanner gateway
Starts the Prisma AIRS Model Security FastAPI app if credentials and SDK are
available; otherwise starts a minimal stub that returns helpful 503 errors so
npm run dev doesn't break when the scanner isn't configured.
"""
import os
import sys

# Load .env so variables are available before any imports
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

PORT = int(os.getenv("MODEL_SCANNER_PORT", 8001))


# Everything that starts a server lives behind the main guard. The Model
# Security SDK runs a local scan in a child process, and macOS starts children
# with `spawn`, which re-imports this file: without the guard the child re-ran
# uvicorn.run() on the same port, died on "address already in use", and every
# local-file scan came back "Model scan failed with no result". Hugging Face
# scans never spawn a child, which is why only local uploads were broken.
def main():
    # ─── Check prerequisites ──────────────────────────────────────────────────────
    missing_creds = not all([
        os.getenv("MODEL_SECURITY_CLIENT_ID"),
        os.getenv("MODEL_SECURITY_CLIENT_SECRET"),
        os.getenv("TSG_ID"),
        os.getenv("LOCAL_SCAN_GROUP_UUID"),
    ])

    sdk_missing = False
    try:
        from model_security_client.api import ModelSecurityAPIClient  # noqa: F401
    except ImportError:
        sdk_missing = True

    if missing_creds or sdk_missing:
        reason = []
        if sdk_missing:
            reason.append("model-security-client SDK not installed (run: bash setup-scanner.sh)")
        if missing_creds:
            reason.append("missing credentials in .env (MODEL_SECURITY_CLIENT_ID / CLIENT_SECRET / TSG_ID / LOCAL_SCAN_GROUP_UUID)")

        print(f"\n  [scanner] Starting in STUB mode — {'; '.join(reason)}")

        # ── Stub server ───────────────────────────────────────────────────────────
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.responses import JSONResponse
        import uvicorn

        stub = FastAPI(title="SUDO AIRS Demo Model Scanner — Stub")
        stub.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

        @stub.get("/")
        async def stub_health():
            return {"status": "stub", "reason": reason}

        @stub.post("/scan-model")
        async def stub_scan():
            return JSONResponse(
                status_code=503,
                content={"detail": "Model scanner not configured. " + " | ".join(reason)},
            )

        uvicorn.run(stub, host="0.0.0.0", port=PORT, log_level="warning")

    else:
        # ── Real app ──────────────────────────────────────────────────────────────
        print(f"\n  [scanner] Starting Prisma AIRS Model Security scanner on port {PORT}")
        import uvicorn
        from scanner_app import app  # noqa: E402
        uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")


if __name__ == "__main__":
    main()
