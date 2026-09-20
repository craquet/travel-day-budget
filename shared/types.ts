/** Core domain types. Money is ALWAYS integer cents. Dates are `YYYY-MM-DD`. */

export interface Trip {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD, first day of the trip
  days: number; // 1..366
  dailyBudgetCents: number; // > 0
  currency: string; // ISO 4217, e.g. "EUR"
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface TripMember {
  id: string;
  tripId: string;
  name: string;
  color: string; // hex, e.g. "#ef4444"
  createdAt: string;
}

export interface Photo {
  id: string;
  expenseId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string; // e.g. "/photos/abc.jpg"
  createdAt: string;
}

export interface Expense {
  id: string;
  tripId: string;
  date: string; // YYYY-MM-DD, within trip range
  amountCents: number; // > 0
  title?: string | null;
  category?: string | null;
  note?: string | null;
  photos: Photo[];
  /** Member who paid (trip people list); null = unassigned. */
  personId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TripInput = Pick<Trip, 'name' | 'startDate' | 'days' | 'dailyBudgetCents' | 'currency'>;

export type TripMemberInput = { name: string; color?: string };

export type ExpenseInput = Pick<Expense, 'date' | 'amountCents' | 'personId'> & {
  title?: string | null;
  category?: string | null;
  note?: string | null;
};

export type ExpensePatch = Partial<ExpenseInput>;

export const CATEGORIES = [
  'Food',
  'Drinks',
  'Transport',
  'Accommodation',
  'Activities',
  'Shopping',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Stable palette used to auto-assign a member's avatar color (server-side on create). */
export const MEMBER_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#3b82f6',
  '#14b8a6',
  '#a855f7',
  '#ec4899',
  '#22c55e',
  '#8b98ab',
] as const;
