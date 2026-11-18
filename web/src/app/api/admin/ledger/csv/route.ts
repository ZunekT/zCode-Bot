import { api } from '@/lib/api';
import { getSession } from '@/lib/session';

// Tekst zaczynający się od =, +, -, @, tab lub CR Excel potraktowałby jak formułę (CSV injection) – poprzedzamy go apostrofem.
const csv = (v: string | number) => {
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(,\d+)?$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response('Zaloguj się.', { status: 401 });
  const url = new URL(request.url);
  const year = url.searchParams.get('year') ?? undefined;
  const quarter = url.searchParams.get('quarter') ?? undefined;
  let l;
  try {
    l = await api.ledger(session.id, year, quarter);
  } catch {
    return new Response('Nie znaleziono.', { status: 404 });
  }
  const money = (v: number) => v.toFixed(2).replace('.', ',');
  const lines = [
    ['Lp.', 'Data', 'Kwota (zł)', 'Nr zlecenia', 'Zlecenie', 'Klient', 'Uwagi'].map(csv).join(';'),
    ...l.rows.map((r) =>
      [r.lp, new Date(r.date).toLocaleDateString('pl-PL'), money(r.amount), r.order.number, r.order.title, r.client.name, r.note ?? ''].map(csv).join(';'),
    ),
    '',
    ['Dzień', 'Suma dzienna (zł)'].map(csv).join(';'),
    ...l.days.map((d) => [new Date(d.date).toLocaleDateString('pl-PL'), money(d.amount)].map(csv).join(';')),
    '',
    [`Razem Q${l.quarter} ${l.year}`, money(l.total)].map(csv).join(';'),
  ];
  return new Response('﻿' + lines.join('\r\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="ewidencja-${l.year}-Q${l.quarter}.csv"`,
      'cache-control': 'private, no-store',
    },
  });
}
