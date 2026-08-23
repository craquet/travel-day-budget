import { useEffect } from 'react';

export function ProgressRing({
  progress,
  size = 168,
  stroke = 12,
  color,
  trackColor = 'var(--surface2)',
  children,
}: {
  /** 0..1 (clamped); negative → treated as empty red ring */
  progress: number;
  size?: number;
  stroke?: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div style={{ position: 'relative', width: size, height: size }} role="img">
      <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Bottom sheet with backdrop; closes on backdrop click or Escape. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grabber" aria-hidden />
        {title && (
          <h2>
            <span>{title}</span>
            <button className="iconbtn" onClick={onClose} aria-label="Close" type="button">
              ✕
            </button>
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
