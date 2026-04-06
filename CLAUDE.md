# Andes Checklist

## Critical: single-file storage

All persistent state lives in one JSON file (`data.json`). Every API endpoint that writes must read-merge-write via `readData()`/`writeData()` to avoid clobbering sibling fields. Never construct a fresh object and overwrite the file.

## DNS & deployment

- `plan.ollycohen.com` points to Fly.io (not GitHub Pages) — the Express backend serves both the API and the static frontend
- The Dockerfile only copies `server.js` and `index.html` — if you add new server-side files, update the Dockerfile
- Deploy backend: `fly deploy` (needs `FLY_API_TOKEN` env var)
- Deploy frontend: push to `main` triggers GitHub Pages deploy, but this is secondary — the primary frontend is served by Fly.io
