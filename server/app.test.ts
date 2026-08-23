import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { buildExpressApp } from './app.js';
import { closeDb, initDb } from './db.js';

// 1x1 transparent PNG
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let baseUrl = '';
let dataDir = '';
let serverRef: import('node:http').Server | undefined;

async function api(
  method: string,
  urlPath: string,
  body?: unknown,
): Promise<{ status: number; json: any; headers: Headers }> {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return {
    status: res.status,
    json: text.length ? JSON.parse(text) : null,
    headers: res.headers,
  };
}

async function uploadPhotos(
  expenseId: string,
  files: { name: string; type: string; data: Buffer }[],
): Promise<{ status: number; json: any }> {
  const form = new FormData();
  for (const f of files) {
    form.append('files', new Blob([new Uint8Array(f.data)], { type: f.type }), f.name);
  }
  const res = await fetch(`${baseUrl}/api/expenses/${expenseId}/photos`, {
    method: 'POST',
    body: form,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdb-test-'));
  initDb(dataDir);
  const app = buildExpressApp({ dataDir, maxUploadMb: 5 });
  const server = app.listen(0);
  serverRef = server;
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => serverRef?.close(() => resolve()));
  closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('health', () => {
  it('responds ok', async () => {
    const r = await api('GET', '/api/health');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true });
  });
});

describe('trips', () => {
  const validTrip = {
    name: 'Portugal',
    startDate: '2026-09-01',
    days: 7,
    dailyBudgetCents: 5_000,
    currency: 'EUR',
  };

  it('creates a trip (currency defaults to EUR)', async () => {
    const r = await api('POST', '/api/trips', { name: 'Portugal', startDate: '2026-09-01', days: 7, dailyBudgetCents: 5000 });
    assert.equal(r.status, 201);
    assert.equal(r.json.currency, 'EUR');
  });

  it('lists newest first and gets by id', async () => {
    const created = await api('POST', '/api/trips', { ...validTrip, name: 'Older' });
    const list = await api('GET', '/api/trips');
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.json) && list.json.length >= 2);
    const got = await api('GET', `/api/trips/${created.json.id}`);
    assert.equal(got.json.name, 'Older');
  });

  it('rejects invalid trips with 400 + message', async () => {
    for (const bad of [
      { ...validTrip, days: 0 },
      { ...validTrip, days: 400 },
      { ...validTrip, startDate: '2026-13-01' },
      { ...validTrip, startDate: 'not-a-date' },
      { ...validTrip, dailyBudgetCents: 0 },
      { ...validTrip, dailyBudgetCents: 10.5 },
      { ...validTrip, currency: 'euro' },
      { ...validTrip, name: '' },
    ]) {
      const r = await api('POST', '/api/trips', bad);
      assert.equal(r.status, 400, JSON.stringify(bad));
      assert.ok(typeof r.json.error === 'string' && r.json.error.length > 0);
    }
  });

  it('patches partially', async () => {
    const t = (await api('GET', '/api/trips')).json[0];
    const r = await api('PATCH', `/api/trips/${t.id}`, { days: 10 });
    assert.equal(r.status, 200);
    assert.equal(r.json.days, 10);
    assert.equal(r.json.dailyBudgetCents, t.dailyBudgetCents);
  });

  it('404s unknown trip', async () => {
    assert.equal((await api('GET', '/api/trips/nope')).status, 404);
  });
});

describe('expenses', () => {
  let tripId = '';

  before(async () => {
    const r = await api('POST', '/api/trips', {
      name: 'Italy',
      startDate: '2026-08-01',
      days: 5,
      dailyBudgetCents: 10_000,
    });
    tripId = r.json.id;
  });

  it('creates expenses within range', async () => {
    const r = await api('POST', `/api/trips/${tripId}/expenses`, {
      date: '2026-08-02',
      amountCents: 1250,
      title: 'Pizza',
      category: 'Food',
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.photos.length, 0);
  });

  it('sorts by date desc', async () => {
    await api('POST', `/api/trips/${tripId}/expenses`, { date: '2026-08-04', amountCents: 300 });
    const list = await api('GET', `/api/trips/${tripId}/expenses`);
    assert.equal(list.json[0].date, '2026-08-04');
  });

  it('rejects dates outside the trip', async () => {
    for (const date of ['2026-07-31', '2026-08-06', 'garbage']) {
      const r = await api('POST', `/api/trips/${tripId}/expenses`, { date, amountCents: 100 });
      assert.equal(r.status, 400, date);
    }
  });

  it('rejects bad amounts', async () => {
    for (const amountCents of [0, -5, 1.25]) {
      const r = await api('POST', `/api/trips/${tripId}/expenses`, { date: '2026-08-01', amountCents });
      assert.equal(r.status, 400);
    }
  });

  it('patches an expense incl. moving its date within range', async () => {
    const list = await api('GET', `/api/trips/${tripId}/expenses`);
    const id = list.json.at(-1).id;
    const r = await api('PATCH', `/api/expenses/${id}`, { date: '2026-08-03', amountCents: 999 });
    assert.equal(r.status, 200);
    assert.equal(r.json.amountCents, 999);
    const bad = await api('PATCH', `/api/expenses/${id}`, { date: '2026-09-03' });
    assert.equal(bad.status, 400);
  });

  it('exports the full bundle', async () => {
    const r = await api('GET', `/api/trips/${tripId}/export`);
    assert.equal(r.status, 200);
    assert.ok(r.json.trip && Array.isArray(r.json.expenses));
  });
});

describe('photos', () => {
  let tripId = '';
  let expenseId = '';

  before(async () => {
    const t = await api('POST', '/api/trips', {
      name: 'Uploads',
      startDate: '2026-08-01',
      days: 3,
      dailyBudgetCents: 1000,
    });
    tripId = t.json.id;
    const e = await api('POST', `/api/trips/${tripId}/expenses`, {
      date: '2026-08-01',
      amountCents: 250,
    });
    expenseId = e.json.id;
  });

  it('uploads a real png and serves it back', async () => {
    const up = await uploadPhotos(expenseId, [
      { name: 'receipt.png', type: 'image/png', data: Buffer.from(PNG_B64, 'base64') },
    ]);
    assert.equal(up.status, 201);
    assert.equal(up.json.photos.length, 1);
    const photo = up.json.photos[0];
    assert.match(photo.url, /^\/photos\/.+\.png$/);

    const served = await fetch(`${baseUrl}${photo.url}`);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/png');
    const buf = Buffer.from(await served.arrayBuffer());
    assert.ok(buf.equals(Buffer.from(PNG_B64, 'base64')));
  });

  it('rejects mislabeled content with 415 and leaves nothing behind', async () => {
    const uploadsBefore = fs.readdirSync(path.join(dataDir, 'uploads')).length;
    const up = await uploadPhotos(expenseId, [
      { name: 'fake.png', type: 'image/png', data: Buffer.from('hello world, not an image!!') },
    ]);
    assert.equal(up.status, 415);
    assert.equal(fs.readdirSync(path.join(dataDir, 'uploads')).length, uploadsBefore);
    const e = await api('GET', `/api/expenses/${expenseId}`);
    assert.equal(e.json.photos.length, 1); // untouched
  });

  it('rejects unknown expense id', async () => {
    const up = await uploadPhotos('no-such-expense', [
      { name: 'x.png', type: 'image/png', data: Buffer.from(PNG_B64, 'base64') },
    ]);
    assert.equal(up.status, 404);
  });

  it('deleting the expense removes photo rows and files', async () => {
    const uploadsBefore = fs.readdirSync(path.join(dataDir, 'uploads')).length;
    const del = await api('DELETE', `/api/expenses/${expenseId}`);
    assert.equal(del.status, 204);
    assert.equal(fs.readdirSync(path.join(dataDir, 'uploads')).length, uploadsBefore - 1);
    assert.equal((await api('GET', `/api/expenses/${expenseId}`)).status, 404);
  });

  it('deleting the trip cascades expenses and photos', async () => {
    const e = await api('POST', `/api/trips/${tripId}/expenses`, { date: '2026-08-02', amountCents: 100 });
    await uploadPhotos(e.json.id, [{ name: 'r.png', type: 'image/png', data: Buffer.from(PNG_B64, 'base64') }]);
    const uploadsBefore = fs.readdirSync(path.join(dataDir, 'uploads')).length;
    assert.equal((await api('DELETE', `/api/trips/${tripId}`)).status, 204);
    assert.equal(fs.readdirSync(path.join(dataDir, 'uploads')).length, uploadsBefore - 1);
  });
});

describe('protocol edge cases', () => {
  it('malformed JSON → 400', async () => {
    const res = await fetch(`${baseUrl}/api/trips`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{oops',
    });
    assert.equal(res.status, 400);
  });

  it('unknown api route → 404 json', async () => {
    const r = await api('GET', '/api/definitely-not-a-thing');
    assert.equal(r.status, 404);
    assert.ok(r.json.error);
  });
});
