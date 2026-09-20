import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import fs from 'node:fs';
import path from 'node:path';
import helmet from 'helmet';
import * as db from './db.js';
import {
  AppError,
  expenseInputSchema,
  expensePatchSchema,
  memberInputSchema,
  memberPatchSchema,
  parseBody,
  tripInputSchema,
  tripPatchSchema,
} from './validate.js';
import { makeUploadMiddleware, unlinkQuietly } from './uploads.js';
import { addDays, diffDays, isISODate } from '../shared/dates.js';
import type { Expense, Trip, TripMember } from '../shared/types.js';

export interface AppConfig {
  dataDir: string;
  maxUploadMb: number;
}

/** Sync handlers keep better-sqlite3 ergonomic; this wrapper routes throws to the error handler. */
function h(fn: (req: Request, res: Response) => void): RequestHandler {
  return (req, res, next) => {
    try {
      fn(req, res);
    } catch (err) {
      next(err);
    }
  };
}

function ensureDateInTrip(trip: Trip, date: string): void {
  const idx = diffDays(trip.startDate, date) + 1;
  if (idx < 1 || idx > trip.days) {
    throw new AppError(
      400,
      `date must be within the trip (${trip.startDate} to ${addDays(trip.startDate, trip.days - 1)})`,
    );
  }
}

function tripOr404(id: string): Trip {
  const trip = db.getTrip(id);
  if (!trip) throw new AppError(404, 'Trip not found');
  return trip;
}

function expenseOr404(id: string): Expense {
  const expense = db.getExpense(id);
  if (!expense) throw new AppError(404, 'Expense not found');
  return expense;
}

function memberOr404(id: string): TripMember {
  const member = db.getMember(id);
  if (!member) throw new AppError(404, 'Member not found');
  return member;
}

/** Throws 400 if personId is set but does not belong to the given trip. */
function ensurePersonInTrip(trip: Trip, personId: string | null | undefined): void {
  if (!personId) return;
  const member = db.getMember(personId!);
  if (!member || member.tripId !== trip.id) {
    throw new AppError(400, 'personId must reference a member of this trip');
  }
}

export function buildExpressApp(config: AppConfig): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: '256kb' }));

  // Receipt photos: immutable static files.
  app.use(
    '/photos',
    express.static(path.join(config.dataDir, 'uploads'), {
      index: false,
      maxAge: '30d',
      immutable: true,
      fallthrough: false,
    }),
  );

  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ---- trips ----

  api.get('/trips', h((_req, res) => res.json(db.listTrips())));

  api.post(
    '/trips',
    h((req, res) => {
      const input = parseBody(tripInputSchema, req.body);
      res.status(201).json(db.insertTrip(input));
    }),
  );

  api.get(
    '/trips/:id',
    h((req, res) => res.json(tripOr404(req.params.id!))),
  );

  api.patch(
    '/trips/:id',
    h((req, res) => {
      const patch = parseBody(tripPatchSchema, req.body);
      if ('startDate' in patch && !isISODate(patch.startDate)) {
        throw new AppError(400, 'Invalid startDate');
      }
      const updated = db.updateTrip(req.params.id!, patch);
      if (!updated) throw new AppError(404, 'Trip not found');
      res.json(updated);
    }),
  );

  api.delete(
    '/trips/:id',
    h((req, res) => {
      tripOr404(req.params.id!);
      const files = db.deleteTrip(req.params.id!);
      for (const f of files) unlinkQuietly(path.join(config.dataDir, 'uploads', f));
      res.status(204).end();
    }),
  );

  api.get(
    '/trips/:id/export',
    h((req, res) => {
      const trip = tripOr404(req.params.id!);
      res.json({ trip, members: db.listMembersByTrip(trip.id), expenses: db.listExpensesByTrip(trip.id) });
    }),
  );

  // ---- members ----

  api.get(
    '/trips/:id/members',
    h((req, res) => {
      const trip = tripOr404(req.params.id!);
      res.json(db.listMembersByTrip(trip.id));
    }),
  );

  api.post(
    '/trips/:id/members',
    h((req, res) => {
      const trip = tripOr404(req.params.id!);
      const input = parseBody(memberInputSchema, req.body);
      res.status(201).json(db.insertMember(trip.id, input));
    }),
  );

  api.patch(
    '/trips/:id/members/:memberId',
    h((req, res) => {
      tripOr404(req.params.id!);
      const member = memberOr404(req.params.memberId!);
      if (member.tripId !== req.params.id) throw new AppError(404, 'Member not found');
      const patch = parseBody(memberPatchSchema, req.body);
      res.json(db.updateMember(member.id, patch));
    }),
  );

  api.delete(
    '/trips/:id/members/:memberId',
    h((req, res) => {
      tripOr404(req.params.id!);
      const member = memberOr404(req.params.memberId!);
      if (member.tripId !== req.params.id) throw new AppError(404, 'Member not found');
      db.deleteMember(member.id);
      res.status(204).end();
    }),
  );

  // ---- expenses ----

  api.get(
    '/trips/:id/expenses',
    h((req, res) => {
      tripOr404(req.params.id!);
      res.json(db.listExpensesByTrip(req.params.id!));
    }),
  );

  api.post(
    '/trips/:id/expenses',
    h((req, res) => {
      const trip = tripOr404(req.params.id!);
      const input = parseBody(expenseInputSchema, req.body);
      ensureDateInTrip(trip, input.date);
      ensurePersonInTrip(trip, input.personId);
      res.status(201).json(db.insertExpense(trip.id, input));
    }),
  );

  api.get(
    '/expenses/:id',
    h((req, res) => res.json(expenseOr404(req.params.id!))),
  );

  api.patch(
    '/expenses/:id',
    h((req, res) => {
      const existing = expenseOr404(req.params.id!);
      const trip = tripOr404(existing.tripId);
      const patch = parseBody(expensePatchSchema, req.body);
      if (patch.date !== undefined) ensureDateInTrip(trip, patch.date);
      ensurePersonInTrip(trip, patch.personId);
      res.json(db.updateExpense(existing.id, patch));
    }),
  );

  api.delete(
    '/expenses/:id',
    h((req, res) => {
      expenseOr404(req.params.id!);
      const files = db.deleteExpense(req.params.id!);
      for (const f of files) unlinkQuietly(path.join(config.dataDir, 'uploads', f));
      res.status(204).end();
    }),
  );

  // ---- photos ----

  const upload = makeUploadMiddleware(config);

  api.post('/expenses/:id/photos', upload, (req, res, next) => {
    try {
      const expense = expenseOr404(req.params.id!);
      const bag = req as Request & { files?: unknown };
      const files = Array.isArray(bag.files) ? (bag.files as UploadedFile[]) : [];
      if (files.length === 0) throw new AppError(400, "No files uploaded under field name 'files'");
      for (const f of files) {
        db.insertPhoto(expense.id, {
          filename: path.basename(f.filename),
          mimeType: f.mimetype,
          sizeBytes: f.size,
        });
      }
      res.status(201).json(db.getExpense(expense.id));
    } catch (err) {
      next(err);
    }
  });

  api.delete(
    '/photos/:id',
    h((req, res) => {
      const photo = db.getPhoto(req.params.id!);
      if (!photo) throw new AppError(404, 'Photo not found');
      db.deletePhoto(photo.id);
      unlinkQuietly(path.join(config.dataDir, 'uploads', photo.filename));
      res.status(204).end();
    }),
  );

  app.use('/api', api);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // ---- errors ----

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof SyntaxError && 'body' in (err as object)) {
      res.status(400).json({ error: 'Malformed JSON body' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  });

  return app;
}

interface UploadedFile {
  filename: string;
  mimetype: string;
  size: number;
}

/**
 * Serves a built SPA (dist/web) with an HTML fallback for client-side navigation.
 * No-op when the directory does not exist (e.g. API-only dev mode).
 */
export function serveSpa(app: express.Express, dir: string): void {
  if (!fs.existsSync(path.join(dir, 'index.html'))) return;

  const hour = 3_600_000;
  const year = 365 * 24 * hour;

  // Vite emits content-hashed filenames → cache aggressively.
  app.use(
    '/assets',
    express.static(path.join(dir, 'assets'), {
      immutable: true,
      maxAge: year,
      fallthrough: false,
    }),
  );
  app.use(express.static(dir, { maxAge: hour, index: 'index.html' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/photos/')) return next();
    res.sendFile(path.join(dir, 'index.html'));
  });
}
