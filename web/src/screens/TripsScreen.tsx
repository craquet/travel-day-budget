import { useState } from 'react';
import type { Trip, TripInput } from '../../../shared/types.js';
import { todayISO } from '../../../shared/dates.js';
import { useStore } from '../store';
import { formatMoney, tripRangeLabel, CURRENCIES } from '../format';
import { Sheet } from '../components/ProgressRing';
import { EmptyState, Spinner } from '../components/ui';

export function TripsScreen() {
  const { trips, ready, selectTrip, createTrip } = useStore();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Travel Day Budget</h1>
        <button className="btn primary" style={{ minHeight: 38 }} onClick={() => setShowCreate(true)}>
          New trip
        </button>
      </header>
      <div className="page">
        {!ready && <Spinner />}
        {ready && trips.length === 0 && (
          <EmptyState headline="No trips yet">
            Create your first trip to start tracking your daily budget.
          </EmptyState>
        )}
        {ready && trips.length > 0 && (
          <>
            <div className="section-title">Your trips</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {trips.map((t) => (
                  <button key={t.id} className="tripcard" onClick={() => selectTrip(t.id)}>
                    <span className="name">
                      {t.name}
                      <span className="chip accent">{t.currency}</span>
                    </span>
                    <span className="meta">
                      {tripRangeLabel(t)} · {t.days} days · {formatMoney(t.dailyBudgetCents, t.currency)}/day
                    </span>
                    <span className="meta amount">
                      Total budget {formatMoney(t.dailyBudgetCents * t.days, t.currency)}
                    </span>
                  </button>
              ))}
            </div>
          </>
        )}
      </div>
      {showCreate && (
        <TripFormSheet
          onClose={() => setShowCreate(false)}
          onSubmit={async (input) => {
            await createTrip(input);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

export function TripFormSheet({
  existing,
  onClose,
  onSubmit,
}: {
  existing?: Trip;
  onClose: () => void;
  onSubmit: (input: TripInput) => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? todayISO());
  const [days, setDays] = useState(String(existing?.days ?? 7));
  const [budgetRaw, setBudgetRaw] = useState(existing ? (existing.dailyBudgetCents / 100).toFixed(2) : '');
  const [currency, setCurrency] = useState(existing?.currency ?? 'EUR');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    name.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    Number(days) >= 1 &&
    Number(days) <= 366 &&
    Number.isFinite(Number(budgetRaw)) &&
    Number(budgetRaw) > 0;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        startDate,
        days: Math.round(Number(days)),
        dailyBudgetCents: Math.round(Number(budgetRaw.replace(',', '.')) * 100),
        currency,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setBusy(false);
    }
  };

  return (
    <Sheet title={existing ? 'Edit trip' : 'New trip'} onClose={onClose}>
      <div className="field">
        <label htmlFor="trip-name">Trip name</label>
        <input
          id="trip-name"
          className="input"
          placeholder="e.g. Portugal summer"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="trip-start">First day</label>
          <input id="trip-start" className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="trip-days">Number of days</label>
          <input
            id="trip-days"
            className="input"
            type="number"
            min={1}
            max={366}
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="trip-budget">Daily budget</label>
          <input
            id="trip-budget"
            className="input"
            inputMode="decimal"
            placeholder="50.00"
            value={budgetRaw}
            onChange={(e) => setBudgetRaw(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="trip-currency">Currency</label>
          <select id="trip-currency" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="small" style={{ color: 'var(--bad)' }}>{error}</p>}
      <button type="button" className="btn primary block" onClick={submit} disabled={!valid || busy}>
        {busy ? 'Saving…' : existing ? 'Save changes' : 'Create trip'}
      </button>
    </Sheet>
  );
}
