import type { ReactNode } from 'react';
import { Icon } from '../Icon';

export function EmptyState({
  icon,
  title,
  text,
  children,
  compact = false,
}: {
  icon: string;
  title: string;
  text?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'empty-sm' : 'card empty'}>
      <span className="empty-art" aria-hidden>
        <Icon name={icon} size={compact ? 24 : 40} />
      </span>
      {compact ? <div className="empty-title">{title}</div> : <h2>{title}</h2>}
      {text && <p>{text}</p>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}
