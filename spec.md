# Andes Checklist — Cross-Device Persistence Spec

## Problem

Checklist data currently lives in `localStorage`, which is per-browser and per-device. The GitHub API sync requires a PAT injected at build time and is fragile. We need a simple backend so the checklist persists across sessions and devices.

## Architecture

```
Browser (React SPA)  ──HTTP──▶  Express server  ──▶  data.json on disk
```

Single-file Node.js/Express backend. No database — data is a JSON file.

## Backend

**Stack:** Node.js + Express, single file `server.js`.

**Endpoints:**

| Method | Path         | Auth     | Description              |
|--------|--------------|----------|--------------------------|
| GET    | `/api/tasks` | Password | Return current task data  |
| PUT    | `/api/tasks` | Password | Replace task data         |
| GET    | `/`          | None     | Serve `index.html`       |

**Auth:** `Authorization: Bearer bolivar` header on API routes. Returns 401 if missing/wrong.

**Storage:** Read/write `data.json` in the project root. If missing, seed from `INITIAL_TASKS` embedded in the frontend (the first PUT from a client creates it).

**CORS:** Not needed — frontend served from same origin.

## Frontend Changes

1. **Remove GitHub API sync** — replaced entirely by the backend API.
2. **On mount:** `GET /api/tasks` with the password from the session. If server returns data, use it. Otherwise fall back to localStorage / initial tasks.
3. **On every change:** Save to localStorage immediately (offline buffer), then debounced `PUT /api/tasks` to the server (2s debounce, same as current).
4. **Conflict resolution:** Server is the source of truth. On mount, server data wins. Between mounts, last-write-wins (single user).
5. **Password:** Already entered at the gate. Reuse it as the API bearer token instead of checking a hex hash client-side. The server validates it.

## File Changes

| File           | Change                                            |
|----------------|---------------------------------------------------|
| `server.js`    | New — Express server, serves static + API         |
| `index.html`   | Remove GitHub sync, add backend sync, fix pw gate |
| `package.json` | New — express dependency                          |
| `data.json`    | Now written by the server, not GitHub API          |

## Non-Goals

- Multi-user support
- Conflict merging (last-write-wins is fine for single user)
- HTTPS (handled by reverse proxy in production)
