/** Pure date helpers for local calendar dates ("YYYY-MM-DD" strings).
 *  All math is done on UTC-anchored dates to be DST-safe. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function toUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days from a to b (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  return fromUTC(toUTC(iso) + n * 86_400_000);
}

/** Today in the viewer's local timezone as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "Day 3 of 10 · Mon 24 Aug" style helpers live in the UI; this gives weekday/Mon names via Intl. */
export function formatHuman(iso: string, locale = undefined as string | undefined): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
