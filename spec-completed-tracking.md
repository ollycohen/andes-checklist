# Spec: `completedAt` tracking on tasks

## Field contract

| Field | Type | Set when | Cleared when |
|-------|------|----------|--------------|
| `completedAt` | ISO 8601 string \| `null` | `done` flips `false -> true` | `done` flips `true -> false` |

Applies to both top-level items (`tasks[].items[]`) and subtasks (`tasks[].items[].subtasks[]`).

## Frontend behavior (`index.html`)

- `toggleTask` / `toggleSubtask` set `completedAt = new Date().toISOString()` when checking, and `null` when unchecking.
- On initial load, after resolving local vs remote data, a `backfillCompletedAt` pass stamps `completedAt = now` on any `done: true` item missing the field. This handles legacy data and ensures the server is updated via the normal debounced push.

## Server behavior (`server.js`)

- `migrateCompletedAt()` runs once at startup. It walks all items/subtasks in `data.json` and stamps `completedAt = now` on any `done: true` item without it.
- The migration is idempotent: items that already have `completedAt` are skipped.

## Email usage (`scripts/daily-email.js`)

- The "Completed (last 7 days)" section filters for items where `done === true` and `completedAt` is within the last 7 days.
- Items without `completedAt` are excluded (should not happen after backfill).

## Limitations

- Backfilled items get `completedAt = now` (the real completion date is unknown). This means all legacy done items appear as "just completed" in the first email after migration.
