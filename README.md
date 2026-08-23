# Travel Day Budget

A self-hosted, mobile-first web app for tracking holiday expenses against a **daily budget that
self-balances**: overspending one day evenly reduces the following days; underspending spreads
the surplus forward. Attach receipt photos as-is — nothing is processed or analyzed.

Single container, single SQLite file, no external services.

## The budget model

Total pool = `days × daily budget`. Walking the trip day by day, each day's allocation is
*what remains of the pool ÷ days remaining*. Crucially, a day's spending is only settled into
the pool once the day is **over**:

- While today runs over budget, you see your live remaining shrink — but future days are not
  touched until tomorrow (no clutter while the day is still changeable).
- From tomorrow on, yesterday's over/underspend is spread evenly across all following days.
- Money is conserved exactly; the last day absorbs any rounding remainder.
- Chronic underspending legitimately grows later allocations (your unspent money has to live
  somewhere) and overspending can drive projections negative — both render clearly.

Example: 10 days × €100. Day 1 spends €130 → days 2–10 show €96.67. Day 2 then spends only €50 →
its €46.67 surplus joins the pool, so days 3–10 rise again to ~€102.08.

## Deploy (dedicated server)

```bash
docker compose up -d --build        # serves on :8080
```

- Data lives in the named volume `app-data` (`/data` inside the container:
  SQLite DB + `uploads/`). Back it up by copying the volume.
- Change the port via `TDB_PORT=9090 docker compose up -d`.
- Update: `git pull && docker compose up -d --build`. The schema migrates automatically.

> **Access control:** the app has intentionally *no authentication* (single-user tool).
> Do not expose it raw to the internet — put it behind your reverse proxy with basic auth,
> WireGuard/Tailscale, or similar.

## Development

```bash
npm install
npm run dev:api     # API + photo serving on :3000
npm run dev:web     # Vite dev server on :5173 (proxies /api & /photos)
```

```bash
npm test            # unit tests (budget engine, date utils, full API suite)
npm run typecheck   # strict TS across web + server + shared
npm run build       # compile server → dist/server, bundle SPA → dist/web
npm start           # production process serving both from dist/ (DATA_DIR=./data)
```

## Stack

| Layer    | Choice                                                        |
|----------|---------------------------------------------------------------|
| Frontend | React 18 + Vite, hand-rolled CSS design system, PWA manifest + service worker (installable, offline shell) |
| Backend  | Express 4, better-sqlite3 (WAL), multer uploads with magic-byte sniffing, zod validation, helmet |
| Storage  | One SQLite file + image files in `DATA_DIR`                    |
| Money    | Integer cents everywhere, `Intl.NumberFormat` rendering        |
| Dates    | `YYYY-MM-DD` strings; "today" always computed client-side (timezone-safe, DST-safe math) |

## API sketch

All under `/api`, JSON errors as `{ "error": "..." }`.

```
GET    /api/health
GET    /api/trips                 POST /api/trips
GET    /api/trips/:id             PATCH /api/trips/:id      DELETE /api/trips/:id
GET    /api/trips/:id/export      GET /api/trips/:id/expenses
POST   /api/trips/:id/expenses
GET    /api/expenses/:id          PATCH /api/expenses/:id   DELETE /api/expenses/:id
POST   /api/expenses/:id/photos   (multipart field `files`, images ≤5 MB)
DELETE /api/photos/:id
GET    /photos/<file>             (static, immutable)
```

Validation: expense dates must fall within the trip range, amounts are positive integer cents,
uploads are checked against real file signatures (JPEG/PNG/WebP/GIF/HEIC).

## Layout

```
shared/   pure domain core: types, date utils, budget engine (+ tests) — used by both sides
server/   Express app, SQLite layer, uploads, tests
web/      React app + PWA assets
docs/     SPEC.md — product rules & contracts
```
