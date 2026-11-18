'use client';

import type { ValidationError } from './types';

export interface SaveResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  errors?: ValidationError[];
}

/** Zapis z panelu do API strony (cookie sesji idzie automatycznie). */
export const put = <T,>(url: string, body: unknown) => send<T>('PUT', url, body);
export const post = <T,>(url: string, body: unknown) => send<T>('POST', url, body);

async function send<T>(method: 'PUT' | 'POST', url: string, body: unknown): Promise<SaveResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; errors?: ValidationError[] };
    if (res.status === 401) {
      window.location.href = `/api/auth/login?next=${encodeURIComponent(window.location.pathname)}`;
      return { ok: false, error: 'Sesja wygasła.' };
    }
    if (!res.ok) {
      return {
        ok: false,
        errors: data.errors,
        error: data.error === 'validation' ? 'Popraw zaznaczone pola.' : (data.error ?? 'Nie udało się zapisać.'),
      };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Brak połączenia. Spróbuj ponownie.' };
  }
}
