import type { Order, Ticket } from '../../generated/prisma/client.js';
import { Form } from '../../ui/builders/modal.js';
import { discordTime, formatMoney, formatOrderId, parseDate, parseMoney } from '../../utils/format.js';
import { UserError } from '../../core/errors.js';
import { answersOf } from '../tickets/forms.js';
import { DEFAULT_INVOICE_DAYS } from './constants.js';

const dateHint = 'dd.mm.rrrr, dd.mm albo +14 (za 14 dni)';
const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

export function orderCreateModal(ticket: Ticket) {
  const answers = answersOf(ticket.formData);
  const pick = (label: string) => answers.find((a) => a.label === label)?.value;
  const budget = pick('Budżet');
  return new Form(`order:create:${ticket.id}`, 'Nowe zlecenie')
    .info(
      `Zlecenie dla <@${ticket.userId}>${budget ? ` • budżet klienta: **${budget}**` : ''}. Cenę i termin możesz ustawić później.`,
    )
    .text({
      id: 'title',
      label: 'Tytuł zlecenia',
      max: 120,
      value: pick('Projekt') ?? ticket.subject ?? undefined,
    })
    .text({
      id: 'description',
      label: 'Zakres prac',
      paragraph: true,
      required: false,
      max: 2000,
      value: pick('Opis') ?? pick('Problem'),
    })
    .text({ id: 'price', label: 'Cena (zł)', required: false, max: 12, placeholder: 'np. 450 albo 450,50' })
    .text({ id: 'deadline', label: 'Termin', required: false, max: 12, placeholder: dateHint })
    .build();
}

export function orderEditModal(order: Order) {
  return new Form(`order:editSubmit:${order.id}`, `Edycja ${formatOrderId(order.id)}`)
    .text({ id: 'title', label: 'Tytuł', max: 120, value: order.title })
    .text({
      id: 'description',
      label: 'Zakres prac',
      paragraph: true,
      required: false,
      max: 2000,
      value: order.description ?? undefined,
    })
    .text({
      id: 'price',
      label: 'Cena (zł) – puste = do wyceny',
      required: false,
      max: 12,
      value: order.price !== null ? String(order.price) : undefined,
    })
    .text({
      id: 'deadline',
      label: 'Termin – puste = brak',
      required: false,
      max: 12,
      value: order.deadline ? fmtDate(order.deadline) : undefined,
      placeholder: dateHint,
    })
    .text({
      id: 'repo',
      label: 'Repozytorium (link)',
      required: false,
      max: 200,
      value: order.repoUrl ?? undefined,
    })
    .build();
}

export function tasksModal(order: Order) {
  return new Form(`order:tasksSubmit:${order.id}`, `Zadania • ${formatOrderId(order.id)}`)
    .info('Każde zadanie w nowej linii. Pojawią się jako checklista w panelu zlecenia.')
    .text({
      id: 'tasks',
      label: 'Zadania',
      paragraph: true,
      max: 2000,
      placeholder: 'System ticketów\nPanel konfiguracji\nTesty na serwerze klienta',
    })
    .build();
}

export function paymentModal(order: Order, due: number | null) {
  return new Form(`order:paymentSubmit:${order.id}`, `Wpłata • ${formatOrderId(order.id)}`)
    .info(due !== null ? `Pozostało do zapłaty: **${formatMoney(due)}**` : 'Zlecenie nie ma jeszcze ceny.')
    .text({ id: 'amount', label: 'Kwota (zł)', max: 12, value: due && due > 0 ? String(due) : undefined })
    .text({ id: 'note', label: 'Notatka', required: false, max: 200, placeholder: 'np. przelew 18.11, BLIK' })
    .build();
}

export function invoiceModal(order: Order, due: number | null) {
  return new Form(`order:invoiceSubmit:${order.id}`, `Proforma • ${formatOrderId(order.id)}`)
    .info('Klient dostanie dokument z danymi do przelewu (`/config platnosci`) w tickecie i w DM.')
    .text({
      id: 'amount',
      label: 'Kwota (zł)',
      required: false,
      max: 12,
      placeholder: due !== null ? `puste = pozostała kwota (${due})` : 'kwota proformy',
    })
    .text({
      id: 'days',
      label: 'Termin płatności (dni)',
      required: false,
      max: 3,
      value: String(DEFAULT_INVOICE_DAYS),
    })
    .build();
}

export function discountModal(order: Order) {
  return new Form(`order:discountSubmit:${order.id}`, `Rabat • ${formatOrderId(order.id)}`)
    .text({ id: 'code', label: 'Kod rabatowy', max: 30 })
    .build();
}

/** Odczyt ceny z pola modala ("" = brak). */
export function readPrice(raw: string): number | null {
  if (!raw.trim()) return null;
  const v = parseMoney(raw);
  if (v === null) throw new UserError(`Nie rozumiem kwoty „${raw}”. Wpisz np. \`450\` albo \`450,50\`.`);
  return v;
}

export function readDeadline(raw: string): Date | null {
  if (!raw.trim()) return null;
  const d = parseDate(raw);
  if (!d) throw new UserError(`Nie rozumiem daty „${raw}”. Użyj formatu: ${dateHint}.`);
  if (d.getTime() < Date.now()) throw new UserError(`Termin ${discordTime(d, 'D')} jest w przeszłości.`);
  return d;
}

export function readUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\/\S+$/i.test(v))
    throw new UserError('Link do repozytorium musi zaczynać się od http:// lub https://');
  return v;
}
