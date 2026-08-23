import type { Expense } from '../../../shared/types.js';
import { computeTripView } from '../../../shared/budget.js';
import { useStore, useToday } from '../store';
import { categoryColor, dateLabel, formatMoney } from '../format';
import { ProgressRing } from '../components/ProgressRing';
import { EmptyState } from '../components/ui';
import { IconInfo, IconTrendDown, IconTrendUp } from '../components/icons';

export function TodayTab({
  onEdit,
}: {
  onEdit: (e: Expense) => void;
}) {
  const { trip, expenses } = useStore();
  const today = useToday();

  if (!trip) return null;
  const view = computeTripView(trip, expenses, today);
  const cur = trip.currency;

  // Before or after the trip
  if (!view.today) {
    const dayIdx = Math.round(
      (Date.parse(`${today}T12:00:00`) - Date.parse(`${trip.startDate}T12:00:00`)) / 86_400_000,
    );
    const before = dayIdx < 1;
    return (
      <div className="page">
        <div className="card hero">
          <div className="big">{before ? 'Not started yet' : 'Trip ended'}</div>
          <div className="sub">
            {before
              ? `Starts in ${-dayIdx} day${-dayIdx === 1 ? '' : 's'} · ${dateLabel(trip.startDate)}`
              : `Ended ${dayIdx - trip.days} day${dayIdx - trip.days === 1 ? '' : 's'} ago`}
          </div>
        </div>
        <StatsGrid />
      </div>
    );
  }

  const t = view.today;
  const remaining = t.remainingCents;
  const ratio = remaining / Math.max(t.allocatedCents, 1);
  const ringColor = remaining < 0 ? 'var(--bad)' : ratio < 0.25 ? 'var(--warn)' : 'var(--accent)';

  const todayExpenses = expenses
    .filter((e) => e.date === today)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="page">
      <div className="card hero">
        <ProgressRing progress={ratio} color={ringColor}>
          <span className="sub">{remaining < 0 ? 'Over by' : 'Left today'}</span>
          <span className="big amount" style={{ color: ringColor }}>
            {formatMoney(Math.abs(remaining), cur)}
          </span>
          <span className="sub amount">of {formatMoney(t.allocatedCents, cur)}</span>
        </ProgressRing>
        <div className="chip">{dateLabel(today)}</div>
      </div>

      <RedistributionNotice />

      <div className="stat-row">
        <div className="stat">
          <div className="label">Spent today</div>
          <div className="value amount">{formatMoney(t.spentCents, cur)}</div>
        </div>
        <div className="stat">
          <div className="label">Daily budget</div>
          <div className="value amount">{formatMoney(t.allocatedCents, cur)}</div>
        </div>
        <div className="stat">
          <div className="label">vs base</div>
          <div className="value amount" style={{ color: t.deltaFromBaseCents >= 0 ? 'var(--good)' : 'var(--bad)' }}>
            {t.deltaFromBaseCents === 0
              ? '—'
              : `${t.deltaFromBaseCents > 0 ? '+' : '−'}${formatMoney(Math.abs(t.deltaFromBaseCents), cur)}`}
          </div>
        </div>
      </div>

      <div className="section-title">Today's expenses</div>
      <div className="card" style={{ padding: '4px 14px' }}>
        {todayExpenses.length === 0 && (
          <EmptyState headline="Nothing logged today">Tap + to add your first expense of the day.</EmptyState>
        )}
        {todayExpenses.map((e) => (
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
        ))}
      </div>
    </div>
  );
}

export function RedistributionNotice() {
  const { trip, expenses } = useStore();
  const today = useToday();
  if (!trip) return null;
  const view = computeTripView(trip, expenses, today);
  const t = view.today;
  if (!t || t.deltaFromBaseCents === 0) return null;

  const up = t.deltaFromBaseCents > 0;
  const perDay = formatMoney(Math.abs(t.deltaFromBaseCents), trip.currency);
  return (
    <div className={`notice ${up ? 'up' : 'down'}`}>
      {up ? <IconTrendUp /> : <IconTrendDown />}
      <span>
        Past days ran {up ? 'under budget' : 'over budget'} — following days are adjusted by{' '}
        <strong>{perDay}/day</strong> (base {formatMoney(trip.dailyBudgetCents, trip.currency)}).
      </span>
    </div>
  );
}

function StatsGrid() {
  const { trip, expenses } = useStore();
  if (!trip) return null;
  const spent = expenses.reduce((a, e) => a + e.amountCents, 0);
  const total = trip.days * trip.dailyBudgetCents;
  return (
    <>
      <InfoBanner text="Adjustments only apply between days — while a day is running it cannot shift other days." />
      <div className="stat-row">
        <div className="stat">
          <div className="label">Total budget</div>
          <div className="value amount">{formatMoney(total, trip.currency)}</div>
        </div>
        <div className="stat">
          <div className="label">Spent</div>
          <div className="value amount">{formatMoney(spent, trip.currency)}</div>
        </div>
        <div className="stat">
          <div className="label">Remaining</div>
          <div className="value amount" style={{ color: total - spent >= 0 ? undefined : 'var(--bad)' }}>
            {formatMoney(total - spent, trip.currency)}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoBanner({ text }: { text: string }) {
  return (
    <div className="notice" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
      <IconInfo />
      <span>{text}</span>
    </div>
  );
}
