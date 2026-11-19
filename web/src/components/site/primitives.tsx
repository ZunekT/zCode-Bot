import type { CSSProperties, ReactNode } from 'react';

export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'li' | 'article' | 'section';
}) {
  return (
    <Tag
      data-reveal=""
      className={className}
      style={delay ? ({ '--d': `${Math.round(delay * 1000)}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

export function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`Ocena ${n} na 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 20 20"
          fill={i < n ? 'currentColor' : 'rgba(255,255,255,.15)'}
          aria-hidden
        >
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

export const Arrow = () => (
  <svg className="arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Check = () => (
  <span className="check" aria-hidden>
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);
