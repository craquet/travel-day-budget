import { useState } from 'react';
import type { Expense } from '../../../shared/types.js';
import { computeTripView } from '../../../shared/budget.js';
import { useStore, useToday } from '../store';
import { categoryColor, dayLabel, formatMoney, tripRangeLabel } from '../format';
import { EmptyState } from '../components/ui';
import { IconChevron, IconTrendDown, IconTrendUp } from '../components/icons';

export function TripTab({ onEdit }: { onEdit: (e: Expense) => void }) {
  const { trip, expenses } = useStore();
  const today = useToday();
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!trip) return null;
  const view = computeTripView(trip, expenses, today);
  const cur = trip.currency;
  const total = view.totals.budgetCents;
  const spent = view.totals.spentCents;
  const saved = view.totals.pastSavedCents;
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;

  return (
    <div className="page">
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <strong>{tripRangeLabel(trip)}</strong>
          <span className="small muted">
            {formatMoney(spent, cur)}/{formatMoney(total, cur)} · {Math.round(pct)}%
          </span>
        </div>
        <div className="progressbar">
          <div
            style={{
              width: `${pct}%`,
              background: spent > total ? 'var(--bad)' : pct > 85 ? 'var(--warn)' : 'var(--accent)',
            }}
          />
        </div>
        <div className="stat-row">
          <div className="stat">
            <div className="label">Spent</div>
            <div className="value amount">{formatMoney(spent, cur)}</div>
          </div>
          <div className="stat">
            <div className="label">Remaining</div>
            <div
              className="value amount"
              style={{ color: total - spent >= 0 ? undefined : 'var(--bad)' }}
            >
              {formatMoney(total - spent, cur)}
            </div>
          </div>
          <div className="stat">
            <div className="label">{saved >= 0 ? 'Saved' : 'Overspent'}</div>
            <div className="value amount" style={{ color: saved >= 0 ? 'var(--good)' : 'var(--bad)' }}>
              {formatMoney(Math.abs(saved), cur)}
            </div>
          </div>
        </div>
      </div>

      <div className="section-title">Days</div>
      <div className="daylist">
        {view.days.map((d) => {
          const dayExpenses = expenses.filter((e) => e.date === d.date);
          const isOpen = expanded === d.index;
          const railClass =
            d.kind === 'today' ? 'today' : d.kind === 'future' ? 'future' : d.remainingCents >= 0 ? 'past-ok' : 'past-over';
          const deltaUp = d.deltaFromBaseCents > 0;
          return (
            <div key={d.index} className="dayrow">
              <button
                className="head"
                onClick={() => setExpanded(isOpen ? null : d.index)}
                aria-expanded={isOpen}
              >
                <span className={`rail ${railClass}`} aria-hidden />
                <span className="title">
                  <span className="day-label">
                    {d.kind === 'today' ? 'Today · ' : ''}
                    {dayLabel(d.index, d.date)}
                  </span>
                  <span className="day-sub">
                    {d.kind === 'past'
                      ? `Settled`
                      : d.kind === 'today'
                        ? `${formatMoney(Math.max(d.remainingCents, 0), cur)} left today`
                        : 'Planned'}
                  </span>
                </span>
                <span className="nums amount">
                  <div className="spent" style={d.spentCents > d.allocatedCents ? { color: 'var(--bad)' } : undefined}>
                    {formatMoney(d.spentCents, cur)}
                  </div>
                  <div className="alloc">of {formatMoney(d.allocatedCents, cur)}</div>
                </span>
                {d.deltaFromBaseCents !== 0 && (
                  <span className={`delta-badge ${deltaUp ? 'up' : 'down'}`} title="Redistribution vs base budget">
                    {deltaUp ? <IconTrendUp size={12} /> : <IconTrendDown size={12} />}
                  </span>
                )}
                <IconChevron style={{ transform: isOpen ? 'rotate(90deg)' : undefined }} />
              </button>

              {isOpen && (
                <div className="body">
                  {d.deltaFromBaseCents !== 0 && (
                    <p className="small muted" style={{ margin: '6px 2px 10px' }}>
                      {deltaUp ? 'Boosted' : 'Reduced'} by{' '}
                      <strong className="amount">{formatMoney(Math.abs(d.deltaFromBaseCents), cur)}</strong> per day from
                      redistribution ({d.kind === 'past' ? 'as settled that day' : 'current projection'}).
                    </p>
                  )}
                  {dayExpenses.length === 0 ? (
                    <EmptyState headline="No expenses">Nothing logged for this day.</EmptyState>
                  ) : (
                    dayExpenses.map((e) => (
                      <button key={e.id} className="exprow" onClick={() => onEdit(e)}>
                        <span className="catdot" style={{ background: categoryColor(e.category) }} />
                        <span className="mid">
                          <span className="exp-title">{e.title || e.category || 'Expense'}</span>
                          {e.note && <span className="exp-sub">{e.note}</span>}
                        </span>
                        <span className="amount" style={{ fontWeight: 700 }}>
                          {formatMoney(e.amountCents, cur)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
