# Andes Checklist

## Architecture

Single-file React SPA (index.html, no build step) + Express backend (server.js).

**All persistent state lives in one JSON file** (`data.json`) on a Fly.io persistent volume at `/data`. The file stores `tasks`, `emails`, `updatedAt`, and any future top-level fields. Every API endpoint that writes must read-merge-write via `readData()`/`writeData()` to avoid clobbering sibling fields. Never construct a fresh object and overwrite the file.

- **Frontend**: React 18 via CDN, no JSX — uses `React.createElement` directly
- **Backend**: Express on Fly.io (`andes-plan` app), persistent volume at `/data`
- **Auth**: Bearer token via `PASSWORD` env var (default: `bolivar`), stored in `sessionStorage`
- **Sync**: Frontend debounces `PUT /api/tasks` (2s). Server is source of truth; `updatedAt` timestamps resolve conflicts.
- **Domain**: plan.ollycohen.com (DNS points to Fly.io)

## Deployment

- `fly deploy` — deploys backend to Fly.io (requires `FLY_API_TOKEN` env var)
- Push to `main` — triggers GitHub Pages deploy (frontend only, via `.github/workflows/deploy.yml`)
- Both must be done when frontend + backend changes are made together

## Daily Email

GitHub Actions workflow (`.github/workflows/daily-email.yml`) runs at 7am PT. Fetches tasks + recipient list from the Fly.io API, sends via Resend. Recipients are managed in-app via the envelope icon in the header.
