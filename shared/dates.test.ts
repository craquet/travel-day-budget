import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, diffDays, isISODate, todayISO } from './dates.js';

test('isISODate', () => {
  assert.ok(isISODate('2026-02-28'));
  assert.ok(!isISODate('2026-02-30'));
  assert.ok(!isISODate('2026-2-8'));
  assert.ok(!isISODate('2026-02-28T00:00:00Z'));
  assert.ok(!isISODate(42));
});

test('diffDays / addDays are DST-safe (UTC anchored)', () => {
  assert.equal(diffDays('2026-08-01', '2026-08-10'), 9);
  assert.equal(diffDays('2026-10-25', '2026-10-26'), 1); // EU DST ends this night
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});

test('todayISO uses local calendar parts', () => {
  const d = new Date(2026, 7, 23, 23, 59); // local Aug 23
  assert.equal(todayISO(d), '2026-08-23');
});
