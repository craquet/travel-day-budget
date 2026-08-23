import { z } from 'zod';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'must be a real calendar date');

export const tripInputSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(80),
  startDate: isoDate,
  days: z.number().int().min(1, 'days must be at least 1').max(366),
  dailyBudgetCents: z
    .number()
    .int('dailyBudgetCents must be an integer (amount in cents)')
    .min(1)
    .max(10_000_000_000),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO code like EUR')
    .default('EUR'),
});

export const tripPatchSchema = tripInputSchema.partial();

export const expenseInputSchema = z.object({
  date: isoDate,
  amountCents: z
    .number()
    .int('amountCents must be an integer (amount in cents)')
    .min(1, 'amount must be greater than zero')
    .max(1_000_000_000),
  title: z.string().trim().max(80).nullish(),
  category: z.string().trim().max(40).nullish(),
  note: z.string().trim().max(500).nullish(),
});

export const expensePatchSchema = expenseInputSchema.partial();

/** Parse with zod or throw AppError(400) with the first issue message. */
export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join('.')}: ` : '';
    throw new AppError(400, `Invalid input — ${where}${issue?.message ?? 'validation failed'}`);
  }
  return result.data;
}
