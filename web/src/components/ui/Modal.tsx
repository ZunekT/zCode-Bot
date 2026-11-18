'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', esc);
    ref.current?.querySelector<HTMLElement>('[autofocus],button,input,select,textarea')?.focus();
    return () => {
      window.removeEventListener('keydown', esc);
      prev?.focus();
    };
  }, [open, busy, onClose]);
  if (!open) return null;
  // Portal do <body>: okno nie dziedziczy warstw (z-index, transform) karty, w której je otwarto.
  return createPortal(
    <div className="modal-back2" role="presentation" onClick={() => !busy && onClose()}>
      <div ref={ref} className="modal2 glass" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}
