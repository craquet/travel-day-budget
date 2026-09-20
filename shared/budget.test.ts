import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTripView, dayIndexOf } from './budget.js';
import type { Expense, Trip } from './types.js';

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Test',
    startDate: '2026-08-01',
    days: 10,
    dailyBudgetCents: 10_000,
    currency: 'EUR',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function exp(date: string, amountCents: number): Pick<Expense, 'date' | 'amountCents'> {
  return { date, amountCents };
}

test('untouched trip: every day allocated the base budget', () => {
  const v = computeTripView(trip(), [], '2026-07-15'); // before start
  assert.equal(v.days.length, 10);
  for (const d of v.days) {
    assert.equal(d.allocatedCents, 10_000);
    assert.equal(d.kind, 'future');
    assert.equal(d.deltaFromBaseCents, 0);
  }
  assert.equal(v.today, null);
});

test('day index mapping incl. boundaries', () => {
  const t = trip();
  assert.equal(dayIndexOf(t, '2026-07-31'), 0);
  assert.equal(dayIndexOf(t, '2026-08-01'), 1);
  assert.equal(dayIndexOf(t, '2026-08-05'), 5);
  assert.equal(dayIndexOf(t, '2026-08-10'), 10);
  assert.equal(dayIndexOf(t, '2026-08-11'), 11);
});

test('underspend spreads positively across all following days once the day passed', () => {
  // Day 1 spent nothing; viewing on day 2 → pool 100_000 over 9 days → +1_111 each
  const v2 = computeTripView(trip(), [], '2026-08-02');
  assert.equal(v2.days[0]!.kind, 'past');
  assert.equal(v2.days[1]!.allocatedCents, 11_111);
  assert.equal(v2.days[9]!.allocatedCents, 11_111);
  assert.equal(v2.totals.remainingCents, 100_000);
});

test("today's spend does not leak into future allocations until the day passed", () => {
  // Viewing ON day 1 with a huge overspend: today remaining negative,
  // but future days still project base (adjustment visible only tomorrow).
  const v = computeTripView(trip(), [exp('2026-08-01', 40_000)], '2026-08-01');
  assert.equal(v.today!.kind, 'today');
  assert.equal(v.today!.remainingCents, -30_000);
  for (let k = 1; k <= 9; k++) {
    assert.equal(v.days[k]!.allocatedCents, 10_000, `future day ${k + 1}`);
    assert.equal(v.days[k]!.kind, 'future');
  }
  // Same data, viewed tomorrow: days 2..10 reduced by 30_000/9 ≈ 3333
  const v2 = computeTripView(trip(), [exp('2026-08-01', 40_000)], '2026-08-02');
  assert.equal(v2.days[1]!.allocatedCents, 6667); // round(700_00/9)
  assert.equal(v2.days[1]!.deltaFromBaseCents, -3333);
  assert.equal(v2.days[9]!.allocatedCents, 6667);
});

test('overspend then underspend compound correctly', () => {
  // base 100/day, 10 days, pool 1000
  // day1 spends 130 (over by 30), viewed on day3:
  const v = computeTripView(
    trip({ dailyBudgetCents: 10_000 }),
    [exp('2026-08-01', 13_000), exp('2026-08-02', 8_500)],
    '2026-08-03',
  );
  // after day1: pool = 1000 − 130 = 870 over 9 days → day2 alloc = round(8700/9)=967? No—
  // sequential: alloc[1]=100; pool=1000−130=870; alloc[2]=round(8700/9)... wait cents: 87_000/9=9666.67→9667
  // day2 spends 85 → pool=870−85=785; alloc[3..]=round(78_500/8)=9812.5→9813? 78_500/8=9812.5 → Math.round=9813? JS rounds .5 up → 9813? Actually 78500/8=9812.5 exactly.
  assert.equal(v.days[0]!.allocatedCents, 10_000);
  assert.equal(v.days[1]!.allocatedCents, 9667);
  assert.equal(v.days[2]!.kind, 'today');
  assert.equal(v.days[2]!.allocatedCents, 9813);
  assert.equal(v.days[9]!.allocatedCents, 9813);
});

test('no cent drift; futures pinned to the settled rate', () => {
  // awkward numbers: 3 days, base 1 cent → pool 3
  const t = trip({ days: 3, dailyBudgetCents: 1 });
  let v = computeTripView(t, [], '2026-07-31'); // before start: everything base
  assert.deepEqual(v.days.map((d) => d.allocatedCents), [1, 1, 1]);
  // viewed on day 1 with zero spend: today base, futures still base (nothing settled yet)
  v = computeTripView(t, [], '2026-08-01');
  assert.deepEqual(v.days.map((d) => d.allocatedCents), [1, 1, 1]);
  // viewed on day 2 (day 1 settled with zero spend): +1 cent surplus over 2 days → round(1.5)=2? pool=3, dl=2 → round(1.5)=2
  const v2 = computeTripView(t, [], '2026-08-02');
  assert.equal(v2.days[0]!.allocatedCents, 1);
  assert.equal(v2.days[1]!.allocatedCents, 2);
  assert.equal(v2.days[2]!.allocatedCents, 2);
  // 10 days base 999: chronic underspend escalates, final day absorbs exact remainder
  const t2 = trip({ days: 10, dailyBudgetCents: 999 });
  const v3 = computeTripView(t2, [], '2026-08-11'); // after end, all settled zero-spend
  assert.ok(v3.days.every((d) => d.kind === 'past'));
  assert.equal(v3.days[9]!.allocatedCents, 9_990); // entire pool lands on the last day
});

test('massive overspend drives future projections negative', () => {
  const t = trip({ days: 4, dailyBudgetCents: 10_000 });
  const v = computeTripView(t, [exp('2026-08-01', 100_000)], '2026-08-02');
  // remaining pool 40_000 − 100_000 = −60_000 over 3 days → −20_000 each
  assert.equal(v.days[1]!.allocatedCents, -20_000);
  assert.ok(v.days.every((d) => d.index === 1 || d.allocatedCents < 0));
  assert.equal(v.totals.remainingCents, 40_000 - 100_000);
});

test('expenses logged on FUTURE dates count against totals immediately', () => {
  const v = computeTripView(trip(), [exp('2026-08-09', 5_000)], '2026-08-01');
  assert.equal(v.totals.spentCents, 5_000);
  assert.equal(v.totals.remainingCents, 95_000);
  // but do not shift any allocation yet (day not passed, and even when passed they
  // settle in order — here check pre-pass state):
  for (const d of v.days) assert.equal(d.allocatedCents, 10_000);
  // once we reach that day it settles normally. Note: 8 consecutive underspent days
  // legitimately inflate later allocations — the whole pool (100_000) sits unspent.
  const v2 = computeTripView(trip(), [exp('2026-08-09', 5_000)], '2026-08-10');
  assert.equal(v2.days[8]!.spentCents, 5_000);
  assert.equal(v2.days[8]!.remainingCents, 45_000); // was offered 50_000 historically
  // final day absorbs the exact remainder of the pool
  assert.equal(v2.days[9]!.allocatedCents, 95_000);
  assert.equal(v2.days[9]!.remainingCents, 95_000);
});

test('expenses outside range are ignored for allocation but counted in totals only if inside', () => {
  const v = computeTripView(trip(), [exp('2025-01-01', 5_000), exp('2030-01-01', 7_000)], '2026-08-01');
  assert.equal(v.totals.spentCents, 0);
  assert.ok(v.days.every((d) => d.spentCents === 0));
});

test('after the trip ended, everything is past', () => {
  const v = computeTripView(trip(), [exp('2026-08-03', 12_000)], '2026-09-01');
  assert.equal(v.today, null);
  assert.ok(v.days.every((d) => d.kind === 'past'));
});

test('past-day savings aggregate signed, using settled allocations', () => {
  // base 100/day, 10 days, viewed on day 3 (days 1–2 settled)
  const v = computeTripView(
    trip({ dailyBudgetCents: 10_000 }),
    [exp('2026-08-01', 8_000), exp('2026-08-02', 12_000)],
    '2026-08-03',
  );
  // day 1: allocated 10_000 − spent 8_000 = +2_000
  // day 2: allocated 10_222 (surplus redistributed) − spent 12_000 = −1_778
  assert.equal(v.days[0]!.allocatedCents, 10_000);
  assert.equal(v.days[1]!.allocatedCents, 10_222);
  assert.equal(v.totals.pastSavedCents, 222);
  assert.equal(v.days[2]!.kind, 'today'); // today is NOT counted
});

test('past-day savings turns negative on settled overspend', () => {
  const v = computeTripView(trip(), [exp('2026-08-01', 30_000)], '2026-08-02');
  assert.equal(v.days[0]!.kind, 'past');
  assert.equal(v.totals.pastSavedCents, -20_000);
});

test('no settled days yet: past-day savings is zero', () => {
  const v = computeTripView(trip(), [exp('2026-08-01', 5_000)], '2026-08-01');
  assert.equal(v.totals.pastSavedCents, 0);
});
