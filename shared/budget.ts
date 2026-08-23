import type { Expense, Trip } from './types.js';
import { addDays, diffDays } from './dates.js';

/**
 * The budget engine.
 *
 * Sequential re-settlement: walking the trip day by day, each day's allocation is
 * "what's left of the pool divided by the days that remain (including this one)".
 * A day's spending is only settled into the pool once that day is strictly over —
 * so today's running spend never leaks into future projections until tomorrow.
 *
 *   pool = N * base;  daysLeft = N
 *   for k in 1..N:
 *     alloc[k] = round(pool / daysLeft)     // last day gets exactly `pool`
 *     daysLeft -= 1
 *     pool -= spent_effective[k]            // 0 for today & future days
 */
export type DayKind = 'past' | 'today' | 'future';

export interface DayView {
  index: number; // 1-based
  date: string;
  kind: DayKind;
  allocatedCents: number;
  spentCents: number;
  remainingCents: number;
  baseCents: number;
  deltaFromBaseCents: number;
}

export interface TripView {
  days: DayView[];
  totals: {
    budgetCents: number;
    spentCents: number;
    remainingCents: number;
  };
  today: DayView | null;
}

/** 1-based day index of `todayISO` within the trip; 0 = before start, N+1 = after end. */
export function dayIndexOf(trip: Pick<Trip, 'startDate' | 'days'>, todayISO: string): number {
  return diffDays(trip.startDate, todayISO) + 1;
}

function roundDiv(pool: number, daysLeft: number): number {
  return Math.round(pool / daysLeft);
}

export function computeTripView(
  trip: Pick<Trip, 'id' | 'startDate' | 'days' | 'dailyBudgetCents'>,
  expenses: Pick<Expense, 'date' | 'amountCents'>[],
  todayISO: string,
): TripView {
  const n = trip.days;
  const base = trip.dailyBudgetCents;
  const t = dayIndexOf(trip, todayISO); // settled days are 1..t-1

  const spentByDay = new Array<number>(n + 1).fill(0);
  let totalSpent = 0;
  for (const e of expenses) {
    const idx = dayIndexOf(trip, e.date);
    if (idx >= 1 && idx <= n) {
      spentByDay[idx] += e.amountCents;
      totalSpent += e.amountCents;
    }
  }

  const days: DayView[] = [];
  let pool = base * n;
  let daysLeft = n;
  // Rate before any settlement happens equals the base budget.
  let rate = roundDiv(pool, Math.max(daysLeft, 1));

  for (let k = 1; k <= n; k++) {
    const spent = spentByDay[k];
    const kind: DayKind = k < t ? 'past' : k === t ? 'today' : 'future';

    let allocated: number;
    if (kind === 'future') {
      // Future days are interchangeable: they all show the CURRENT projected rate.
      // Their own (unknown) future settlements must not be simulated here.
      allocated = rate;
    } else {
      allocated = rate;
      if (kind === 'past') {
        // Only elapsed days settle their spend into the pool and move the rate.
        // Today never leaks into the projection — it settles tomorrow.
        pool -= spent;
        daysLeft -= 1;
        // When a single day remains it absorbs the exact remainder — no cent drift.
        rate = daysLeft >= 1 ? roundDiv(pool, daysLeft) : pool;
      }
    }

    days.push({
      index: k,
      date: addDays(trip.startDate, k - 1),
      kind,
      allocatedCents: allocated,
      spentCents: spent,
      remainingCents: allocated - spent,
      baseCents: base,
      deltaFromBaseCents: allocated - base,
    });
  }

  const today = days.find((d) => d.kind === 'today') ?? null;

  return {
    days,
    totals: {
      budgetCents: base * n,
      spentCents: totalSpent,
      remainingCents: base * n - totalSpent,
    },
    today,
  };
}
