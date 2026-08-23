import type { Expense, ExpensePatch, Photo, Trip, TripInput } from '../../shared/types.js';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: init?.body ? { 'content-type': 'application/json' } : undefined,
      ...init,
    });
  } catch {
    throw new Error('Network error — are you online?');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error((json && json.error) || `Request failed (${res.status})`);
  }
  return json as T;
}

const post = <T>(path: string, body: unknown) =>
  req<T>(path, { method: 'POST', body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  req<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const api = {
  listTrips: () => req<Trip[]>('/api/trips'),
  createTrip: (input: TripInput) => post<Trip>('/api/trips', input),
  updateTrip: (id: string, patchBody: Partial<TripInput>) =>
    patch<Trip>(`/api/trips/${id}`, patchBody),
  deleteTrip: (id: string) => req<void>(`/api/trips/${id}`, { method: 'DELETE' }),
  exportTrip: (id: string) => req<{ trip: Trip; expenses: Expense[] }>(`/api/trips/${id}/export`),

  listExpenses: (tripId: string) => req<Expense[]>(`/api/trips/${tripId}/expenses`),
  createExpense: (
    tripId: string,
    input: { date: string; amountCents: number; title?: string | null; category?: string | null; note?: string | null },
  ) => post<Expense>(`/api/trips/${tripId}/expenses`, input),
  getExpense: (id: string) => req<Expense>(`/api/expenses/${id}`),
  updateExpense: (id: string, patchBody: ExpensePatch) => patch<Expense>(`/api/expenses/${id}`, patchBody),
  deleteExpense: (id: string) => req<void>(`/api/expenses/${id}`, { method: 'DELETE' }),

  addPhotos: async (expenseId: string, files: File[]): Promise<Expense> => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    const res = await fetch(`/api/expenses/${expenseId}/photos`, { method: 'POST', body: form });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new Error((j && j.error) || `Upload failed (${res.status})`);
    }
    return res.json();
  },
  deletePhoto: (photo: Pick<Photo, 'id'>) => req<void>(`/api/photos/${photo.id}`, { method: 'DELETE' }),
};
