import { useMemo, useState } from 'react';
import type { Expense } from '../../../shared/types.js';
import { computeTripView } from '../../../shared/budget.js';
import { useStore, useToday } from '../store';
import { categoryColor, dateLabel, formatMoney } from '../format';
import { EmptyState, PersonAvatar } from '../components/ui';
import { PhotoLightbox } from '../components/PhotoLightbox';
import { IconCamera } from '../components/icons';

export function ExpensesTab({ onEdit }: { onEdit: (e: Expense) => void }) {
  const { trip, expenses, members } = useStore();
  const today = useToday();
  const [query, setQuery] = useState('');
  const [lightbox, setLightbox] = useState<{ expenseId: string; index: number } | null>(null);

  const view = useMemo(
    () => (trip ? computeTripView(trip, expenses, today) : null),
    [trip, expenses, today],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter((e) =>
      [e.title, e.category, e.note].some((s) => s && s.toLowerCase().includes(q)),
    );
  }, [expenses, query]);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const personTotals = useMemo(() => {
    const totals = new Map<string, number>();
    let unassigned = 0;
    for (const e of expenses) {
      if (e.personId) totals.set(e.personId, (totals.get(e.personId) ?? 0) + e.amountCents);
      else unassigned += e.amountCents;
    }
    return { totals, unassigned };
  }, [expenses]);

  if (!trip || !view) return null;
  const cur = trip.currency;

  // group by date
  const groups: { date: string; items: Expense[] }[] = [];
  for (const e of filtered) {
    const g = groups.at(-1);
    if (g && g.date === e.date) g.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }

  const lightboxExpense = lightbox && expenses.find((e) => e.id === lightbox.expenseId);
  const whoPaid = (e: Expense) => (e.personId ? memberById.get(e.personId) : null);

  return (
    <div className="page">
      <div className="searchbar">
        <input
          placeholder="Search title, category or note…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search expenses"
        />
      </div>

      {(members.length > 0 || personTotals.unassigned > 0) && (
        <div className="card members-summary">
          {members.map((m) => {
            const total = personTotals.totals.get(m.id) ?? 0;
            return (
              <div className="member-row" key={m.id}>
                <PersonAvatar name={m.name} color={m.color} />
                <span className="mid">
                  <span className="exp-title">{m.name}</span>
                </span>
                <span className="amount" style={{ fontWeight: 700 }}>
                  {formatMoney(total, cur)}
                </span>
              </div>
            );
          })}
          {personTotals.unassigned > 0 && (
            <div className="member-row">
              <span className="avatar unassigned" aria-hidden>
                ?
              </span>
              <span className="mid">
                <span className="exp-title">Unassigned</span>
              </span>
              <span className="amount" style={{ fontWeight: 700, color: 'var(--muted)' }}>
                {formatMoney(personTotals.unassigned, cur)}
              </span>
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 && (
        <EmptyState icon={<IconCamera size={34} />} headline={query ? 'No matches' : 'No expenses yet'}>
          {query ? 'Try a different search.' : 'Log your first expense with the + button.'}
        </EmptyState>
      )}

      {groups.map((g) => {
        const dayView = view.days.find((d) => d.date === g.date);
        const daySpent = g.items.reduce((a, e) => a + e.amountCents, 0);
        return (
          <div key={g.date}>
            <div className="group-date">
              <span>{dateLabel(g.date)}</span>
              <span className="amount" style={{ color: dayView && daySpent > dayView.allocatedCents ? 'var(--bad)' : undefined }}>
                {formatMoney(daySpent, cur)}
                {dayView ? ` / ${formatMoney(dayView.allocatedCents, cur)}` : ''}
              </span>
            </div>
            <div className="card" style={{ padding: '4px 14px' }}>
              {g.items.map((e) => (
                <button key={e.id} className="exprow" onClick={() => onEdit(e)}>
                  <span className="catdot" style={{ background: categoryColor(e.category) }} />
                  {whoPaid(e) && (
                    <PersonAvatar name={whoPaid(e)!.name} color={whoPaid(e)!.color} size={18} />
                  )}
                  <span className="mid">
                    <span className="exp-title">{e.title || e.category || 'Expense'}</span>
                    <span className="exp-sub">{e.category ?? 'Uncategorized'}</span>
                  </span>
                  {e.photos.length > 0 && (
                    <span className="thumbs" onClick={(ev) => { ev.stopPropagation(); setLightbox({ expenseId: e.id, index: 0 }); }}>
                      {e.photos.slice(0, 3).map((p) => (
                        <img key={p.id} src={p.url} alt="" loading="lazy" />
                      ))}
                    </span>
                  )}
                  <span className="amount" style={{ fontWeight: 700 }}>
                    {formatMoney(e.amountCents, cur)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {lightbox && lightboxExpense && (
        <PhotoLightbox
          photos={lightboxExpense.photos}
          index={lightbox.index}
          onIndex={(i) => setLightbox({ expenseId: lightboxExpense.id, index: i })}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
