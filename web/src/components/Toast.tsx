'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

export interface ToastMsg {
  id: number;
  ok: boolean;
  text: string;
}

export function useToast() {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const show = (ok: boolean, text: string) => setToast({ id: Date.now(), ok, text });
  const node = toast ? (
    <div key={toast.id} className={`toast notice ${toast.ok ? 'notice-ok' : 'notice-err'}`} role="status">
      <Icon name={toast.ok ? 'verified' : 'shield_x'} />
      <p>{toast.text}</p>
    </div>
  ) : null;
  return { show, node };
}
