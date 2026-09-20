interface IconProps {
  size?: number;
  style?: React.CSSProperties;
}

const svgProps = (size: number, style?: React.CSSProperties) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  style,
});

export const IconSun = ({ size = 22 }: IconProps) => (
  <svg {...svgProps(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const IconMap = ({ size = 22 }: IconProps) => (
  <svg {...svgProps(size)}>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
    <path d="M9 4v14m6-12v14" />
  </svg>
);

export const IconList = ({ size = 22 }: IconProps) => (
  <svg {...svgProps(size)}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="4" cy="6" r="0.5" fill="currentColor" />
    <circle cx="4" cy="12" r="0.5" fill="currentColor" />
    <circle cx="4" cy="18" r="0.5" fill="currentColor" />
  </svg>
);

export const IconGear = ({ size = 22 }: IconProps) => (
  <svg {...svgProps(size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
  </svg>
);

export const IconPlus = ({ size = 26 }: IconProps) => (
  <svg {...svgProps(size)} strokeWidth={2.5}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconBack = ({ size = 22 }: IconProps) => (
  <svg {...svgProps(size)}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const IconChevron = ({ size = 18, style }: IconProps) => (
  <svg {...svgProps(size, style)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconCamera = ({ size = 18 }: IconProps) => (
  <svg {...svgProps(size)}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export const IconTrash = ({ size = 18 }: IconProps) => (
  <svg {...svgProps(size)}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

export const IconTrendUp = ({ size = 18 }: IconProps) => (
  <svg {...svgProps(size)}>
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

export const IconTrendDown = ({ size = 18 }: IconProps) => (
  <svg {...svgProps(size)}>
    <path d="M7 7l10 10M17 9v8H9" />
  </svg>
);

export const IconInfo = ({ size = 18 }: IconProps) => (
  <svg {...svgProps(size)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4m0-4h.01" />
  </svg>
);

export const IconFilter = ({ size = 20 }: IconProps) => (
  <svg {...svgProps(size)}>
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </svg>
);
