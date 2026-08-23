import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import type { Expense, ExpensePatch, Trip, TripInput } from '../../shared/types.js';
import { todayISO } from '../../shared/dates.js';

export interface ToastMessage {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

interface StoreValue {
  trips: Trip[];
  trip: Trip | null;
  expenses: Expense[];
  ready: boolean;
  toasts: ToastMessage[];
  notify: (text: string, kind?: 'info' | 'error') => void;
  dismissToast: (id: number) => void;
  reloadTrips: () => Promise<void>;
  selectTrip: (id: string | null) => void;
  createTrip: (input: TripInput) => Promise<void>;
  updateTrip: (id: string, patch: Partial<TripInput>) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  exportTrip: (trip: Trip) => Promise<void>;
  createExpense: (
    input: { date: string; amountCents: number; title?: string | null; category?: string | null; note?: string | null },
    photos: File[],
  ) => Promise<void>;
  updateExpense: (id: string, patch: ExpensePatch, newPhotos: File[], removedPhotoIds: string[]) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

let toastSeq = 1;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<string | null>(() => localStorage.getItem('tdb.tripId'));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, kind: 'info' | 'error' = 'info') => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5200 : 3200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const reloadExpenses = useCallback(async (id: string) => {
    setExpenses(await api.listExpenses(id));
  }, []);

  const reloadTrips = useCallback(async () => {
    setTrips(await api.listTrips());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await reloadTrips();
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Failed to load', 'error');
      } finally {
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trip = useMemo(() => trips.find((t) => t.id === tripId) ?? null, [trips, tripId]);

  useEffect(() => {
    if (tripId && trips.some((t) => t.id === tripId)) {
      reloadExpenses(tripId).catch(() => notify('Failed to load expenses', 'error'));
    }
  }, [tripId, trips, reloadExpenses, notify]);

  const selectTrip = useCallback((id: string | null) => {
    localStorage.setItem('tdb.tripId', id ?? '');
    setTripId(id);
    setExpenses([]);
  }, []);

  const guard = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Something went wrong', 'error');
        throw err;
      }
    },
    [notify],
  );

  const value: StoreValue = useMemo(
    () => ({
      trips,
      trip,
      expenses,
      ready,
      toasts,
      notify,
      dismissToast,
      reloadTrips,
      selectTrip,
      createTrip: (input) =>
        guard(async () => {
          const created = await api.createTrip(input);
          await reloadTrips();
          selectTrip(created.id);
          notify(`Trip “${created.name}” created`);
        }),
      updateTrip: (id, patchInput) =>
        guard(async () => {
          await api.updateTrip(id, patchInput);
          await reloadTrips();
          notify('Trip updated');
        }),
      deleteTrip: (id) =>
        guard(async () => {
          await api.deleteTrip(id);
          selectTrip(null);
          await reloadTrips();
          notify('Trip deleted');
        }),
      exportTrip: (t) =>
        guard(async () => {
          const bundle = await api.exportTrip(t.id);
          const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tdb-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }),
      createExpense: (input, photos) =>
        guard(async () => {
          if (!tripId) throw new Error('No trip selected');
          let expense = await api.createExpense(tripId, input);
          if (photos.length > 0) {
            expense = await uploadAll(expense.id, photos);
          }
          await reloadExpenses(tripId);
          notify('Expense saved');
        }),
      updateExpense: (id, patchInput, newPhotos, removedPhotoIds) =>
        guard(async () => {
          await api.updateExpense(id, patchInput);
          for (const pid of removedPhotoIds) await api.deletePhoto({ id: pid });
          if (newPhotos.length > 0) await uploadAll(id, newPhotos);
          if (tripId) await reloadExpenses(tripId);
          notify('Expense updated');
        }),
      deleteExpense: (id) =>
        guard(async () => {
          await api.deleteExpense(id);
          if (tripId) await reloadExpenses(tripId);
          notify('Expense deleted');
        }),
    }),
    [
      trips,
      trip,
      expenses,
      ready,
      toasts,
      notify,
      dismissToast,
      reloadTrips,
      reloadExpenses,
      selectTrip,
      guard,
      tripId,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

async function uploadAll(expenseId: string, files: File[]): Promise<Expense> {
  return api.addPhotos(expenseId, files);
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside provider');
  return ctx;
}

/** Live "today" that re-evaluates when the tab regains focus after midnight. */
export function useToday(): string {
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    const check = () => setToday(todayISO());
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}
