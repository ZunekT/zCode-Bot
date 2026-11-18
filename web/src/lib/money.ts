export const pln = (v: number | null | undefined, dash = '—') =>
  v === null || v === undefined
    ? dash
    : `${v.toLocaleString('pl-PL', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })} zł`;

export const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Kolor pigułki statusu zlecenia. */
export const statusTone = (s: string) =>
  s === 'COMPLETED' || s === 'DELIVERED'
    ? 'pill-ok'
    : s === 'CANCELLED'
      ? 'pill-err'
      : s === 'AWAITING_PAYMENT'
        ? 'pill-warn'
        : s === 'QUOTE'
          ? 'pill-muted'
          : 'pill-info';
