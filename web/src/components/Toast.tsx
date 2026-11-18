'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ToastMsg {
  id: number;
  ok: boolean;
  text: string;
}
type Show = (ok: boolean, text: string) => void;

const Ctx = createContext<Show | null>(null);
let seq = 0;

/** Stos powiadomień dla całego panelu (prawy dolny róg, pasek czasu, zamykanie kliknięciem). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastMsg[]>([]);
  const remove = useCallback((id: number) => setList((l) => l.filter((t) => t.id !== id)), []);
  const show = useCallback<Show>(
    (ok, text) => {
      const id = ++seq;
      setList((l) => [...l.slice(-3), { id, ok, text }]);
      setTimeout(() => remove(id), 4200);
    },
    [remove],
  );
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <button key={t.id} className={`toast2 ${t.ok ? 'ok' : 'err'}`} onClick={() => remove(t.id)}>
            <Icon name={t.ok ? 'verified' : 'shield_x'} size={20} />
            <span>{t.text}</span>
            <i className="toast2-timer" aria-hidden />
          </button>
        ))}
      </div>
    </Ctx.Provider>
  );
}

/** Zgodne z dotychczasowym API: { show, node } (node nie jest już potrzebny). */
export function useToast() {
  const show = useContext(Ctx);
  return { show: show ?? (() => undefined), node: null as ReactNode };
}
