import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useStore } from '../store';

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function EmptyState({
  icon,
  headline,
  children,
}: {
  icon?: ReactNode;
  headline: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <div className="headline">{headline}</div>
      <div className="small">{children}</div>
    </div>
  );
}

/** Two-step destructive confirmation button. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      className={`btn danger block${armed ? ' armed' : ''}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast${t.kind === 'error' ? ' error' : ''}`}
          role={t.kind === 'error' ? 'alert' : 'status'}
          onClick={() => dismissToast(t.id)}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
