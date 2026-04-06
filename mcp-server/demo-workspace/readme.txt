AIRS MCP Demo Workspace
=======================

This is the sandboxed working directory for the Prisma AIRS MCP Security demo.

The MCP server tools (read_file, web_fetch, execute_code, memory) operate within
this directory. File access is restricted to this folder only.

Files in this workspace:
- readme.txt         This file
- config.json        Application configuration (contains API keys for DLP demo)
- data/users.csv     Sample user data (contains PII for DLP demo)

These files are intentionally seeded with sensitive-looking data to demonstrate
how Prisma AIRS detects and blocks data exfiltration attempts at Stage 2.
