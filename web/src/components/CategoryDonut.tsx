import type { ReactNode } from 'react';

/**
 * Multi-segment donut chart built from stacked SVG circle strokes.
 * Segments start at the top and run clockwise; tiny gaps separate them.
 */
export function CategoryDonut({
  segments,
  size = 132,
  stroke = 24,
  children,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!(total > 0)) return null;

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = 1.5;
  let start = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const frac = s.value / total;
      const arc = {
        color: s.color,
        len: Math.max(frac * c - gap, 0),
        offset: -start,
      };
      start += frac * c;
      return arc;
    });

  return (
    <div
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
      role="img"
      aria-label="Expenses by category"
    >
      <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.len} ${c - arc.len}`}
            strokeDashoffset={arc.offset}
          />
        ))}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
}