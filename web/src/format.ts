import { CATEGORIES } from '../../shared/types.js';
import type { Trip } from '../../shared/types.js';
import { addDays } from '../../shared/dates.js';

export { CATEGORIES };

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: Math.abs(cents) % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "12,50" / "12.5" / "13" → cents; null when invalid or ≤ 0. */
export function parseAmountInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.').replace(/[^\d.]/g, '');
  if (!normalized || /\..*\./.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

const CAT_COLORS: Record<string, string> = {
  Food: '#f59e0b',
  Drinks: '#a855f7',
  Transport: '#3b82f6',
  Accommodation: '#14b8a6',
  Activities: '#ef4444',
  Shopping: '#ec4899',
  Other: '#8b98ab',
};

export function categoryColor(category?: string | null): string {
  if (!category) return CAT_COLORS.Other!;
  const preset = CATEGORIES.find((c) => c.toLowerCase() === category.toLowerCase());
  return CAT_COLORS[preset ?? 'Other'] ?? CAT_COLORS.Other!;
}

export function dayLabel(index: number, date: string, locale?: string): string {
  const human = new Date(`${date}T12:00:00`).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `Day ${index} · ${human}`;
}

export function dateLabel(date: string, locale?: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export const CURRENCIES = [
  'EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF',
  'JPY', 'THB', 'AUD', 'CAD', 'NZD', 'SGD',
];

export function tripRangeLabel(trip: Trip, locale?: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  return `${fmt(trip.startDate)} – ${fmt(addDays(trip.startDate, trip.days - 1))}`;
}
