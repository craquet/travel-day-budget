import { useState } from 'react';
import type { Expense } from '../../../shared/types.js';
import { useStore, useToday } from '../store';
import { formatMoney } from '../format';
import { IconGear, IconList, IconMap, IconPlus, IconSun } from '../components/icons';
import { ExpenseSheet, type ExpenseDraftTarget } from '../components/ExpenseSheet';
import { TodayTab } from './TodayTab';
import { TripTab } from './TripTab';
import { ExpensesTab } from './ExpensesTab';
import { SettingsTab } from './SettingsTab';

type Tab = 'today' | 'trip' | 'expenses' | 'settings';

const TABS: { id: Tab; label: string; icon: (size?: number) => React.ReactNode }[] = [
  { id: 'today', label: 'Today', icon: () => <IconSun /> },
  { id: 'trip', label: 'Trip', icon: () => <IconMap /> },
  { id: 'expenses', label: 'Expenses', icon: () => <IconList /> },
  { id: 'settings', label: 'Settings', icon: () => <IconGear /> },
];

export function TripScreen({ onBack }: { onBack: () => void }) {
  const { trip } = useStore();
  const today = useToday();
  const [tab, setTab] = useState<Tab>('today');
  const [sheetTarget, setSheetTarget] = useState<ExpenseDraftTarget | null>(null);

  if (!trip) return null;

  const openNewExpense = () => setSheetTarget({ expense: null, defaultDate: today });
  const openEditExpense = (expense: Expense) => setSheetTarget({ expense, defaultDate: today });

  return (
    <div className="app">
      <header className="topbar">
        <button className="iconbtn" onClick={onBack} aria-label="All trips">
          ‹
        </button>
        <h1>{trip.name}</h1>
        <OverallChip />
      </header>

      {tab === 'today' && <TodayTab onEdit={openEditExpense} />}
      {tab === 'trip' && <TripTab onEdit={openEditExpense} />}
      {tab === 'expenses' && <ExpensesTab onEdit={openEditExpense} />}
      {tab === 'settings' && <SettingsTab />}

      <button className="fab" onClick={openNewExpense} aria-label="Add expense">
        <IconPlus />
      </button>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.icon()}
            {t.label}
          </button>
        ))}
      </nav>

      {sheetTarget && <ExpenseSheet target={sheetTarget} onClose={() => setSheetTarget(null)} />}
    </div>
  );
}

function OverallChip() {
  const { trip, expenses } = useStore();
  if (!trip) return null;
  const spent = expenses.reduce((a, e) => a + e.amountCents, 0);
  const remaining = trip.days * trip.dailyBudgetCents - spent;
  const cls = remaining >= 0 ? 'good' : 'bad';
  return (
    <span className={`chip ${cls} amount`} title="Total budget remaining">
      {formatMoney(remaining, trip.currency)}
    </span>
  );
}
