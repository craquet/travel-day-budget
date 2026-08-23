# Travel Day Budget — Specification

Single-user, self-hosted mobile web app to track holiday spending against a daily budget,
with automatic forward redistribution of over/underspend.

## Product rules

1. A **trip** has: name, start date, number of days `N` (1..366), daily base budget, currency.
2. Total pool = `N × dailyBase`.
3. Each day's allocated budget is computed by sequential re-settlement:

   ```
   pool = N * base; daysLeft = N; rate = round(pool / daysLeft)   # == base
   for k in 1..N:
     alloc[k] = rate
     if k is strictly BEFORE today:          # only elapsed days settle & move the rate
       pool -= spent[k]
       daysLeft -= 1
       rate = round(pool / daysLeft)         # daysLeft==0 → rate = pool (exact remainder)
     # today never settles into the pool; future days stay pinned to `rate`
   ```

   Consequences:
   - Over/underspend of a finished day spreads evenly across all following days. ✔
   - Today's running spend does NOT yet shift future allocations; it only reduces
     today's live remaining. Redistribution becomes visible once the day has passed. ✔
   - Future days all show the same projected allocation (they are interchangeable). ✔
   - Chronic underspending legitimately grows later allocations (the unspent pool
     must live somewhere); money is conserved exactly, last day absorbs remainders. ✔
4. Past day rows show settled result vs their allocation. Future rows show the current
   projection. Negative projections are allowed and rendered in red.
5. Expenses can be logged for any date within the trip (including future/prepaid items).
6. Receipt photos can be attached to expenses; they are stored as-is, never processed.
7. Multiple trips supported; one selected at a time.

## Money & dates

- All amounts are **integer cents** (`amountCents`). Never floats in domain logic/API.
- Dates are local calendar dates as `YYYY-MM-DD` strings. The server never converts
  timezones; "today" is computed client-side and sent where needed.

## Shared types (`shared/types.ts`) — source of truth

```ts
interface Trip {
  id: string; name: string;
  startDate: string;          // YYYY-MM-DD, first day of trip
  days: number;               // 1..366
  dailyBudgetCents: number;   // > 0
  currency: string;           // ISO 4217, default "EUR"
  createdAt: string; updatedAt: string; // ISO 8601
}
interface Photo { id: string; expenseId: string; filename: string; mimeType: string; sizeBytes: number; url: string; createdAt: string }
interface Expense {
  id: string; tripId: string;
  date: string;                // YYYY-MM-DD within [startDate, startDate+days)
  amountCents: number;         // > 0
  title?: string | null;       // short label
  category?: string | null;    // free text; UI offers presets
  note?: string | null;
  photos: Photo[];
  createdAt: string; updatedAt: string;
}
```

Budget view (`shared/budget.ts`):

```ts
type DayKind = 'past' | 'today' | 'future';
interface DayView {
  index: number;              // 1-based
  date: string;
  kind: DayKind;
  allocatedCents: number;     // projection for today/future, settled value for past
  spentCents: number;
  remainingCents: number;     // allocated − spent (today: live remaining)
  baseCents: number;
  deltaFromBaseCents: number; // allocated − base (redistribution effect)
}
interface TripView {
  days: DayView[];
  totals: { budgetCents: number; spentCents: number; remainingCents: number };
  today: DayView | null;      // null before start / after end
}
function computeTripView(trip: Trip, expenses: Expense[], todayISO: string): TripView;
```

## HTTP API (all under `/api`, JSON)

Errors: `{ "error": "<message>" }`, correct status codes (400 validation, 404 missing, 413 too large, 415 wrong type).

| Method | Path | Body / notes |
|---|---|---|
| GET | `/api/health` | `{ok:true}` |
| GET | `/api/trips` | list, newest first |
| POST | `/api/trips` | `{name,startDate,days,dailyBudgetCents,currency}` |
| GET | `/api/trips/:id` | 404 if unknown |
| PATCH | `/api/trips/:id` | partial update, same validation |
| DELETE | `/api/trips/:id` | 204, cascades expenses + photo files |
| GET | `/api/trips/:id/expenses` | includes `photos[]`, newest date first |
| POST | `/api/trips/:id/expenses` | `{date,amountCents,title?,category?,note?}` |
| GET | `/api/expenses/:id` | includes `photos[]` |
| PATCH | `/api/expenses/:id` | partial update (date validated against trip range) |
| DELETE | `/api/expenses/:id` | 204, cascades photo files |
| POST | `/api/expenses/:id/photos` | multipart, field `files` (repeatable); ≤5 MB/file; mime image/jpeg,png,webp,gif,heic; magic-byte sniffed |
| DELETE | `/api/photos/:id` | 204, removes file |
| GET | `/photos/<filename>` | static, immutable cache (NOT under /api) |
| GET | `/api/trips/:id/export` | `{trip,expenses}` JSON bundle |

Validation: ISO date strings strictly formatted; expense date within trip range; amountCents integer 1..10^9; days 1..366; dailyBudgetCents 1..10^10.

## Architecture

Monorepo, single npm root:

```
shared/   types.ts dates.ts budget.ts (+ tests)   ← pure, no deps, imported by server AND web
server/   Express 4 + better-sqlite3 + multer + zod + helmet; tests via node:test+tsx
web/      React 18 + Vite + TS, vanilla CSS design system, no UI kit, no router lib
dist/     build output: dist/server (tsc), dist/web (vite)
data/     runtime volume: SQLite db + uploads/   (gitignored)
```

- Dev: `npm run dev:api` (:3000) + `npm run dev:web` (:5173, proxies `/api`,`/photos`).
- Prod: one process serves API + `dist/web` statics. Env: `PORT` (3000), `DATA_DIR` (`./data`), `MAX_UPLOAD_MB` (5).
- PWA-lite: manifest + SVG icon + tiny service worker (static assets cache-first, `/api`+`/photos` network-only).

## Non-goals

Auth (document reverse-proxy/Tailscale instead), multi-user, OCR/receipt parsing, offline write queue.
