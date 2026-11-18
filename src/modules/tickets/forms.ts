import type { Attachment, ModalSubmitInteraction } from 'discord.js';
import type { TicketCategory } from '../../generated/prisma/client.js';
import { Form } from '../../ui/builders/modal.js';
import { CATEGORIES } from './constants.js';

/** Pole formularza zapisane w Ticket.formData (kolejność = kolejność wyświetlania). */
export interface FormAnswer {
  label: string;
  value: string;
}

export interface ParsedForm {
  subject: string;
  answers: FormAnswer[];
  files: Attachment[];
}

const BUDGETS = [
  { value: 'do100', label: 'do 100 zł' },
  { value: '100-300', label: '100–300 zł' },
  { value: '300-700', label: '300–700 zł' },
  { value: '700+', label: 'powyżej 700 zł' },
  { value: 'wycena', label: 'Nie wiem – proszę o wycenę' },
];

const DEADLINES = [
  { value: 'luz', label: 'Bez pośpiechu' },
  { value: '2tyg', label: 'Do 2 tygodni' },
  { value: '1tyg', label: 'Do tygodnia' },
  { value: 'pilne', label: 'Pilne – kilka dni' },
];

const labelOf = (list: { value: string; label: string }[], value: string | undefined) =>
  list.find((o) => o.value === value)?.label ?? value ?? '—';

/** prefill – wstępnie wypełnione pola formularza zamówienia (np. z cennika). */
export function ticketForm(category: TicketCategory, prefill: { name?: string; description?: string } = {}) {
  const def = CATEGORIES[category];
  const form = new Form(`ticket:create:${category}`, def.label);

  switch (category) {
    case 'ORDER':
      return form
        .text({
          id: 'name',
          label: 'Nazwa / temat projektu',
          max: 80,
          placeholder: 'np. Bot do ticketów dla serwera RP',
          value: prefill.name,
        })
        .text({
          id: 'description',
          label: 'Opis – co bot ma robić?',
          description: 'Im więcej szczegółów, tym dokładniejsza wycena',
          paragraph: true,
          min: 20,
          max: 2000,
          value: prefill.description,
        })
        .select({ id: 'budget', label: 'Budżet', options: BUDGETS, placeholder: 'Wybierz przedział' })
        .select({ id: 'deadline', label: 'Termin', options: DEADLINES, placeholder: 'Na kiedy?' })
        .files({
          id: 'files',
          label: 'Załączniki',
          description: 'Makiety, specyfikacja, screeny (opcjonalnie)',
        })
        .build();

    case 'SUPPORT':
      return form
        .text({
          id: 'bot',
          label: 'Którego bota dotyczy?',
          max: 80,
          placeholder: 'nazwa bota lub numer zlecenia, np. ZX-0042',
        })
        .text({ id: 'description', label: 'Opis problemu', paragraph: true, min: 10, max: 2000 })
        .text({
          id: 'steps',
          label: 'Jak wywołać błąd?',
          description: 'Kroki, komenda, treść błędu',
          paragraph: true,
          required: false,
          max: 1000,
        })
        .files({ id: 'files', label: 'Screeny / logi', description: 'Opcjonalnie' })
        .build();

    case 'PARTNERSHIP':
      return form
        .text({ id: 'server', label: 'Nazwa serwera / projektu', max: 100 })
        .text({
          id: 'invite',
          label: 'Link do serwera / strony',
          max: 200,
          placeholder: 'https://discord.gg/…',
        })
        .text({ id: 'members', label: 'Liczba członków', required: false, max: 20 })
        .text({ id: 'description', label: 'Propozycja współpracy', paragraph: true, min: 20, max: 2000 })
        .build();

    case 'QUESTION':
      return form
        .text({ id: 'subject', label: 'Temat', max: 100 })
        .text({ id: 'description', label: 'Twoje pytanie', paragraph: true, min: 5, max: 2000 })
        .build();

    case 'COMPLAINT':
      return form
        .text({ id: 'order', label: 'Numer zlecenia / nazwa bota', max: 80, placeholder: 'np. ZX-0042' })
        .text({ id: 'description', label: 'Co jest nie tak?', paragraph: true, min: 10, max: 2000 })
        .text({ id: 'expected', label: 'Jak powinno działać?', paragraph: true, required: false, max: 1000 })
        .files({ id: 'files', label: 'Dowody (screeny, nagrania)', description: 'Opcjonalnie' })
        .build();
  }
}

function text(i: ModalSubmitInteraction, id: string): string {
  try {
    return i.fields.getTextInputValue(id).trim();
  } catch {
    return '';
  }
}

function files(i: ModalSubmitInteraction): Attachment[] {
  try {
    return [...(i.fields.getUploadedFiles('files', false)?.values() ?? [])];
  } catch {
    return [];
  }
}

function select(i: ModalSubmitInteraction, id: string): string | undefined {
  try {
    return i.fields.getStringSelectValues(id)[0];
  } catch {
    return undefined;
  }
}

/** Odczytuje odpowiedzi z modala danej kategorii. */
export function parseTicketForm(category: TicketCategory, i: ModalSubmitInteraction): ParsedForm {
  const a = (label: string, value: string): FormAnswer | null => (value ? { label, value } : null);
  const clean = (list: (FormAnswer | null)[]) => list.filter((x): x is FormAnswer => x !== null);

  switch (category) {
    case 'ORDER':
      return {
        subject: text(i, 'name'),
        answers: clean([
          a('Projekt', text(i, 'name')),
          a('Opis', text(i, 'description')),
          a('Budżet', labelOf(BUDGETS, select(i, 'budget'))),
          a('Termin', labelOf(DEADLINES, select(i, 'deadline'))),
        ]),
        files: files(i),
      };
    case 'SUPPORT':
      return {
        subject: `Wsparcie: ${text(i, 'bot')}`,
        answers: clean([
          a('Bot', text(i, 'bot')),
          a('Problem', text(i, 'description')),
          a('Jak wywołać', text(i, 'steps')),
        ]),
        files: files(i),
      };
    case 'PARTNERSHIP':
      return {
        subject: `Współpraca: ${text(i, 'server')}`,
        answers: clean([
          a('Serwer / projekt', text(i, 'server')),
          a('Link', text(i, 'invite')),
          a('Członkowie', text(i, 'members')),
          a('Propozycja', text(i, 'description')),
        ]),
        files: [],
      };
    case 'QUESTION':
      return {
        subject: text(i, 'subject'),
        answers: clean([a('Temat', text(i, 'subject')), a('Pytanie', text(i, 'description'))]),
        files: [],
      };
    case 'COMPLAINT':
      return {
        subject: `Reklamacja: ${text(i, 'order')}`,
        answers: clean([
          a('Dotyczy', text(i, 'order')),
          a('Problem', text(i, 'description')),
          a('Oczekiwane działanie', text(i, 'expected')),
        ]),
        files: files(i),
      };
  }
}

/** Bezpieczny odczyt formData z bazy. */
export function answersOf(formData: unknown): FormAnswer[] {
  if (!Array.isArray(formData)) return [];
  return formData.filter(
    (x): x is FormAnswer => typeof x === 'object' && x !== null && 'label' in x && 'value' in x,
  );
}
