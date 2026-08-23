import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Expense, Photo, Trip, TripInput } from '../shared/types.js';

interface TripRow {
  id: string;
  name: string;
  start_date: string;
  days: number;
  daily_budget_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

interface ExpenseRow {
  id: string;
  trip_id: string;
  date: string;
  amount_cents: number;
  title: string | null;
  category: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface PhotoRow {
  id: string;
  expense_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

let db: Database.Database | null = null;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE trips (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    days INTEGER NOT NULL,
    daily_budget_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE expenses (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    title TEXT,
    category TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_expenses_trip ON expenses(trip_id, date);
  CREATE TABLE photos (
    id TEXT PRIMARY KEY,
    expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    filename TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_photos_expense ON photos(expense_id);
  `,
];

export function initDb(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(path.join(dataDir, 'app.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  const row = db.prepare(`SELECT value FROM _meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined;
  const current = row ? Number(row.value) : 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    const apply = db.transaction(() => {
      db!.exec(MIGRATIONS[v]!);
      db!
        .prepare(
          `INSERT INTO _meta (key, value) VALUES ('schema_version', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .run(String(v + 1));
    });
    apply();
  }
}

function check(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initDb() first');
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}

const nowIso = () => new Date().toISOString();

function mapTrip(r: TripRow): Trip {
  return {
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    days: r.days,
    dailyBudgetCents: r.daily_budget_cents,
    currency: r.currency,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapPhoto(r: PhotoRow): Photo {
  return {
    id: r.id,
    expenseId: r.expense_id,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    url: `/photos/${r.filename}`,
    createdAt: r.created_at,
  };
}

function mapExpense(r: ExpenseRow, photos: PhotoRow[]): Expense {
  return {
    id: r.id,
    tripId: r.trip_id,
    date: r.date,
    amountCents: r.amount_cents,
    title: r.title,
    category: r.category,
    note: r.note,
    photos: photos.filter((p) => p.expense_id === r.id).map(mapPhoto),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ---- trips ----

export function insertTrip(input: TripInput): Trip {
  const t: TripRow = {
    id: randomUUID(),
    name: input.name,
    start_date: input.startDate,
    days: input.days,
    daily_budget_cents: input.dailyBudgetCents,
    currency: input.currency,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  check()
    .prepare(
      `INSERT INTO trips (id, name, start_date, days, daily_budget_cents, currency, created_at, updated_at)
       VALUES (@id, @name, @start_date, @days, @daily_budget_cents, @currency, @created_at, @updated_at)`,
    )
    .run(t);
  return mapTrip(t);
}

export function listTrips(): Trip[] {
  const rows = check()
    .prepare(`SELECT * FROM trips ORDER BY created_at DESC, rowid DESC`)
    .all() as TripRow[];
  return rows.map(mapTrip);
}

export function getTrip(id: string): Trip | null {
  const row = check().prepare(`SELECT * FROM trips WHERE id = ?`).get(id) as TripRow | undefined;
  return row ? mapTrip(row) : null;
}

export function updateTrip(id: string, patch: Partial<TripInput>): Trip | null {
  const existing = getTrip(id);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  check()
    .prepare(
      `UPDATE trips SET name = ?, start_date = ?, days = ?, daily_budget_cents = ?, currency = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(next.name, next.startDate, next.days, next.dailyBudgetCents, next.currency, nowIso(), id);
  return getTrip(id);
}

export interface CleanupFile {
  path: string;
}

/** Deletes a trip and returns photo filenames whose files should be unlinked. */
export function deleteTrip(id: string): string[] {
  const filenames = (
    check()
      .prepare(
        `SELECT p.filename FROM photos p JOIN expenses e ON e.id = p.expense_id WHERE e.trip_id = ?`,
      )
      .all(id) as { filename: string }[]
  ).map((r) => r.filename);
  check().prepare(`DELETE FROM trips WHERE id = ?`).run(id);
  return filenames;
}

// ---- expenses ----

function photosByExpenseIds(ids: string[]): Map<string, PhotoRow[]> {
  const map = new Map<string, PhotoRow[]>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => '?').join(',');
  const rows = check()
    .prepare(`SELECT * FROM photos WHERE expense_id IN (${placeholders}) ORDER BY created_at ASC`)
    .all(...ids) as PhotoRow[];
  for (const r of rows) {
    const list = map.get(r.expense_id) ?? [];
    list.push(r);
    map.set(r.expense_id, list);
  }
  return map;
}

export function insertExpense(
  tripId: string,
  input: { date: string; amountCents: number; title?: string | null; category?: string | null; note?: string | null },
): Expense {
  const row: ExpenseRow = {
    id: randomUUID(),
    trip_id: tripId,
    date: input.date,
    amount_cents: input.amountCents,
    title: input.title ?? null,
    category: input.category ?? null,
    note: input.note ?? null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  check()
    .prepare(
      `INSERT INTO expenses (id, trip_id, date, amount_cents, title, category, note, created_at, updated_at)
       VALUES (@id, @trip_id, @date, @amount_cents, @title, @category, @note, @created_at, @updated_at)`,
    )
    .run(row);
  return mapExpense(row, []);
}

export function listExpensesByTrip(tripId: string): Expense[] {
  const rows = check()
    .prepare(`SELECT * FROM expenses WHERE trip_id = ? ORDER BY date DESC, created_at DESC`)
    .all(tripId) as ExpenseRow[];
  const photos = photosByExpenseIds(rows.map((r) => r.id));
  return rows.map((r) => mapExpense(r, photos.get(r.id) ?? []));
}

export function getExpense(id: string): Expense | null {
  const row = check().prepare(`SELECT * FROM expenses WHERE id = ?`).get(id) as
    | ExpenseRow
    | undefined;
  if (!row) return null;
  return mapExpense(row, photosByExpenseIds([row.id]).get(row.id) ?? []);
}

export function updateExpense(
  id: string,
  patch: Partial<{ date: string; amountCents: number; title?: string | null; category?: string | null; note?: string | null }>,
): Expense | null {
  const existing = getExpense(id);
  if (!existing) return null;
  const next = {
    date: patch.date ?? existing.date,
    amountCents: patch.amountCents ?? existing.amountCents,
    title: patch.title !== undefined ? patch.title : existing.title,
    category: patch.category !== undefined ? patch.category : existing.category,
    note: patch.note !== undefined ? patch.note : existing.note,
  };
  check()
    .prepare(
      `UPDATE expenses SET date = ?, amount_cents = ?, title = ?, category = ?, note = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(next.date, next.amountCents, next.title, next.category, next.note, nowIso(), id);
  return getExpense(id);
}

/** Deletes an expense and returns photo filenames whose files should be unlinked. */
export function deleteExpense(id: string): string[] {
  const filenames = (
    check().prepare(`SELECT filename FROM photos WHERE expense_id = ?`).all(id) as {
      filename: string;
    }[]
  ).map((r) => r.filename);
  check().prepare(`DELETE FROM expenses WHERE id = ?`).run(id);
  return filenames;
}

// ---- photos ----

export function insertPhoto(
  expenseId: string,
  meta: { filename: string; mimeType: string; sizeBytes: number },
): Photo {
  const row: PhotoRow = {
    id: randomUUID(),
    expense_id: expenseId,
    filename: meta.filename,
    mime_type: meta.mimeType,
    size_bytes: meta.sizeBytes,
    created_at: nowIso(),
  };
  check()
    .prepare(
      `INSERT INTO photos (id, expense_id, filename, mime_type, size_bytes, created_at)
       VALUES (@id, @expense_id, @filename, @mime_type, @size_bytes, @created_at)`,
    )
    .run(row);
  return mapPhoto(row);
}

export function getPhoto(id: string): Photo | null {
  const row = check().prepare(`SELECT * FROM photos WHERE id = ?`).get(id) as PhotoRow | undefined;
  return row ? mapPhoto(row) : null;
}

/** Deletes a photo row and returns the filename whose file should be unlinked. */
export function deletePhoto(id: string): string | null {
  const photo = getPhoto(id);
  if (!photo) return null;
  check().prepare(`DELETE FROM photos WHERE id = ?`).run(id);
  return photo.filename;
}
