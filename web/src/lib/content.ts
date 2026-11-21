import 'server-only';
import { draftMode } from 'next/headers';
import type { CmsField, CmsSection } from './cms';
import { env } from './env';
import { FAQ_GROUPS } from './faq';

const ICONS = ['idea', 'partnership', 'store', 'code', 'laptop', 'mobile', 'lightning', 'documentation', 'lock', 'checklist', 'coins', 'tools', 'server', 'rocket', 'shield_check', 'support', 'bot', 'cart', 'star'];
const iconOpt = { options: ICONS.map((i) => ({ value: i, label: i })) };
const GRAD = 'Fragment w {nawiasach klamrowych} dostaje niebieski gradient.';

const text = (key: string, label: string, def: string, extra: Partial<CmsField> = {}): CmsField => ({ key, type: 'text', label, default: def, maxLength: 200, ...extra });
const area = (key: string, label: string, def: string, extra: Partial<CmsField> = {}): CmsField => ({ key, type: 'textarea', label, default: def, maxLength: 1000, ...extra });
const steps = (key: string, def: { title: string; text: string }[]): CmsField => ({
  key,
  type: 'list',
  label: 'Kroki współpracy',
  maxItems: 6,
  default: def.map((s) => ({ tytul: s.title, opis: s.text })),
  fields: [text('tytul', 'Tytuł', '', { required: true, maxLength: 60 }), area('opis', 'Opis', '', { maxLength: 300 })],
});
const faqList = (id: string, label: string): CmsField => ({
  key: id,
  type: 'list',
  label,
  maxItems: 30,
  default: (FAQ_GROUPS.find((g) => g.id === id)?.items ?? []).map((q) => ({ pytanie: q.question, odpowiedz: q.answer })),
  fields: [text('pytanie', 'Pytanie', '', { required: true, maxLength: 200 }), { key: 'odpowiedz', type: 'richtext', label: 'Odpowiedź', maxLength: 3000, required: true }],
});

export const SELF_SCHEMA: { sections: CmsSection[] } = {
  sections: [
    {
      key: 'glowna',
      label: 'Strona główna',
      description: 'Krótki hub na start – nagłówek, hasła i opisy kafelków',
      fields: [
        text('etykieta', 'Etykieta nad nagłówkiem', 'NOWE', { maxLength: 20, description: 'Puste = bez plakietki' }),
        text('plakietka', 'Tekst plakietki', 'Robimy też strony internetowe', { maxLength: 80 }),
        text('plakietkaLink', 'Link plakietki', '/strony-internetowe', { maxLength: 200 }),
        area('hasla', 'Hasła pisane na żywo', 'strony internetowe\nboty Discord\nsklepy online\naplikacje WWW\nlanding page', { description: 'Jedno w linii – zmieniają się po słowie „Tworzymy”', maxLength: 300 }),
        area('podtytul', 'Opis pod nagłówkiem', 'Projektujemy, kodujemy i utrzymujemy szybkie strony internetowe i boty Discord – dopracowane w każdym szczególe i pod stałą opieką.', { maxLength: 400 }),
        text('przycisk', 'Główny przycisk', 'Bezpłatna wycena', { maxLength: 40 }),
        text('kafelekStrony', 'Kafelek „Strony” – opis', 'Wizytówki, strony firmowe, sklepy i aplikacje WWW', { maxLength: 100 }),
        text('kafelekBoty', 'Kafelek „Boty” – opis', 'Tickety, ekonomia, RP, moderacja i integracje', { maxLength: 100 }),
      ],
    },
    {
      key: 'strony',
      label: 'Strony internetowe',
      description: 'Podstrona /strony-internetowe',
      fields: [
        text('naglowek', 'Nagłówek', 'Strony, które {robią wrażenie} i sprzedają', { description: GRAD }),
        area('opis', 'Opis', 'Projektujemy i kodujemy nowoczesne strony od zera – szybkie, piękne na każdym ekranie i przygotowane pod Google. Bez gotowych szablonów.', { maxLength: 400 }),
        text('rodzajeNaglowek', 'Rodzaje stron – nagłówek', 'Strona dopasowana {do Twojego celu}', { description: GRAD }),
        area('rodzajeOpis', 'Rodzaje stron – opis', 'Niezależnie od tego, czy potrzebujesz prostej wizytówki, czy rozbudowanej aplikacji – zaprojektujemy i zbudujemy ją od zera.', { maxLength: 400 }),
        {
          key: 'rodzaje',
          type: 'list',
          label: 'Rodzaje stron',
          maxItems: 8,
          default: [
            { ikona: 'idea', tytul: 'Wizytówka i landing page', opis: 'Jedna, dopracowana strona, która przedstawia Twoją firmę lub produkt i zbiera zapytania.' },
            { ikona: 'partnership', tytul: 'Strona firmowa', opis: 'Kilka podstron, oferta, realizacje, blog i kontakt. Treści zmieniasz sam w panelu.' },
            { ikona: 'store', tytul: 'Sklep internetowy', opis: 'Produkty, koszyk, płatności online i panel zamówień – gotowe do sprzedaży od pierwszego dnia.' },
            { ikona: 'code', tytul: 'Aplikacje i panele WWW', opis: 'Panele klienta, systemy rezerwacji, dashboardy i integracje – także z Discordem.' },
          ],
          fields: [{ key: 'ikona', type: 'select', label: 'Ikona', ...iconOpt }, text('tytul', 'Tytuł', '', { required: true, maxLength: 60 }), area('opis', 'Opis', '', { maxLength: 300 })],
        },
        text('standardNaglowek', 'W standardzie – nagłówek', 'Wszystko, czego potrzebuje {nowoczesna strona}', { description: GRAD }),
        {
          key: 'standard',
          type: 'list',
          label: 'W standardzie',
          maxItems: 12,
          default: [
            ['mobile', 'Responsywność', 'idealny wygląd na telefonach, tabletach i komputerach'],
            ['lightning', 'Szybkość', 'wynik 90+ w Google PageSpeed i lekki kod'],
            ['documentation', 'SEO od podstaw', 'meta, mapa strony, dane strukturalne, podgląd w social media'],
            ['lock', 'HTTPS i bezpieczeństwo', 'certyfikat SSL, aktualne biblioteki, ochrona formularzy'],
            ['checklist', 'RODO i cookies', 'polityka prywatności i informacja o plikach cookies'],
            ['coins', 'Analityka', 'statystyki odwiedzin, żeby wiedzieć, co działa'],
            ['tools', 'Panel do edycji', 'treści, zdjęcia, cenniki i ogłoszenia zmieniasz sam w panelu zxCode'],
            ['server', 'Monitoring i opieka', 'pilnujemy, żeby strona działała, a certyfikat był ważny'],
          ].map(([ikona, tytul, opis]) => ({ ikona, tytul, opis })),
          fields: [{ key: 'ikona', type: 'select', label: 'Ikona', ...iconOpt }, text('tytul', 'Tytuł', '', { required: true, maxLength: 60 }), text('opis', 'Opis', '', { maxLength: 160 })],
        },
        text('krokiNaglowek', 'Proces – nagłówek', 'Jak powstaje {Twoja strona}', { description: GRAD }),
        steps('kroki', [
          { title: 'Brief i wycena', text: 'Poznajemy Twoją firmę, cele i konkurencję. Dostajesz zakres, cenę i termin.' },
          { title: 'Projekt graficzny', text: 'Projektujemy wygląd strony na komputery i telefony. Wprowadzamy poprawki, aż będzie idealnie.' },
          { title: 'Kodowanie i testy', text: 'Zamieniamy projekt w szybką stronę, dodajemy treści i testujemy na różnych urządzeniach.' },
          { title: 'Start i opieka', text: 'Podpinamy domenę, SSL i analitykę. Pilnujemy, żeby strona działała i była aktualna.' },
        ]),
        text('ctaNaglowek', 'Zachęta na dole – nagłówek', 'Gotowy na nową stronę? {Porozmawiajmy.}', { description: GRAD }),
        area('ctaOpis', 'Zachęta na dole – opis', 'Opisz swój pomysł w krótkim formularzu – odezwiemy się z bezpłatną wyceną.', { maxLength: 300 }),
      ],
    },
    {
      key: 'boty',
      label: 'Boty Discord',
      description: 'Podstrona /boty-discord',
      fields: [
        text('naglowek', 'Nagłówek', 'Boty, które {pracują za Ciebie}', { description: GRAD }),
        area('opis', 'Opis', 'Tickety, ekonomia, RP, moderacja i integracje. Projektujemy, piszemy i utrzymujemy boty dla Twojej społeczności – a ustawienia zmieniasz sam w panelu.', { maxLength: 400 }),
        text('uslugiNaglowek', 'Usługi – nagłówek', 'Wszystko, czego potrzebuje {Twój serwer}', { description: GRAD }),
        area('uslugiOpis', 'Usługi – opis', 'Od pomysłu, przez kod, po wdrożenie i opiekę. Dostajesz gotowego bota, panel do jego ustawień i pewność, że ktoś pilnuje, żeby działał.', { maxLength: 400 }),
        area('funkcje', 'Przykładowe funkcje', 'Tickety\nEkonomia\nSerwery RP\nModeracja\nWeryfikacja\nGiveaway\nAnkiety\nStatystyki\nLogi\nSklep\nPoziomy', { description: 'Jedna w linii – pokazują się jako plakietki', maxLength: 600 }),
        text('krokiNaglowek', 'Proces – nagłówek', 'Od pomysłu do działającego bota {w 4 krokach}', { description: GRAD }),
        steps('kroki', [
          { title: 'Ticket na Discordzie', text: 'Opisujesz, czego potrzebujesz. Dopytamy o szczegóły i zaproponujemy rozwiązanie.' },
          { title: 'Wycena i termin', text: 'Dostajesz konkretną cenę, zakres i termin. Zaczynamy po akceptacji.' },
          { title: 'Realizacja', text: 'Postęp widzisz w panelu zlecenia. Testujesz bota na swoim serwerze przed odbiorem.' },
          { title: 'Wdrożenie i opieka', text: 'Uruchamiamy bota, dajemy dostęp do panelu i pilnujemy, żeby działał.' },
        ]),
        text('ctaNaglowek', 'Zachęta na dole – nagłówek', 'Masz pomysł na bota? {Zróbmy go razem.}', { description: GRAD }),
        area('ctaOpis', 'Zachęta na dole – opis', 'Opisz pomysł w tickecie na Discordzie – przygotujemy bezpłatną wycenę.', { maxLength: 300 }),
      ],
    },
    {
      key: 'faq',
      label: 'Pytania (FAQ)',
      description: 'Strona /faq – odpowiedzi z formatowaniem',
      fields: [
        area('opis', 'Opis pod nagłówkiem', 'Nie ma tu Twojego pytania? Napisz przez formularz wyceny, na Discordzie albo na kontakt@zxcode.pl.', { maxLength: 300 }),
        faqList('zamowienie', 'Zamówienie i płatności'),
        faqList('strony', 'Strony internetowe'),
        faqList('boty', 'Boty Discord'),
        faqList('hosting', 'Hosting i wsparcie'),
      ],
    },
    {
      key: 'stopka',
      label: 'Stopka',
      fields: [area('opis', 'Opis w stopce', 'Strony internetowe i boty Discord. Projekt, kod, wdrożenie i opieka – w jednym miejscu.', { maxLength: 300 })],
    },
  ],
};

type Step = { tytul: string; opis: string };
type Item = { ikona: string; tytul: string; opis: string };
type Faq = { pytanie: string; odpowiedz: string };

export interface SiteContent {
  glowna: { etykieta: string; plakietka: string; plakietkaLink: string; hasla: string; podtytul: string; przycisk: string; kafelekStrony: string; kafelekBoty: string };
  strony: {
    naglowek: string;
    opis: string;
    rodzajeNaglowek: string;
    rodzajeOpis: string;
    rodzaje: Item[];
    standardNaglowek: string;
    standard: Item[];
    krokiNaglowek: string;
    kroki: Step[];
    ctaNaglowek: string;
    ctaOpis: string;
  };
  boty: { naglowek: string; opis: string; uslugiNaglowek: string; uslugiOpis: string; funkcje: string; krokiNaglowek: string; kroki: Step[]; ctaNaglowek: string; ctaOpis: string };
  faq: { opis: string; zamowienie: Faq[]; strony: Faq[]; boty: Faq[]; hosting: Faq[] };
  stopka: { opis: string };
}

export interface SiteState {
  announcement: { text: string; link: string; linkLabel: string; tone: 'info' | 'success' | 'warning' | 'promo'; dismissible: boolean; version: number } | null;
}

const DEFAULTS = Object.fromEntries(SELF_SCHEMA.sections.map((s) => [s.key, Object.fromEntries(s.fields.map((f) => [f.key, f.default ?? (f.type === 'list' ? [] : '')]))])) as unknown as SiteContent;

let registered: Promise<void> | null = null;
export function register() {
  if (registered) return registered;
  if (!process.env.INTERNAL_API_SECRET) return null;
  registered = fetch(`${env.internalUrl}/internal/cms/self/schema`, {
    method: 'PUT',
    headers: { 'x-internal-secret': env.internalSecret, 'content-type': 'application/json' },
    body: JSON.stringify({ schema: SELF_SCHEMA }),
    signal: AbortSignal.timeout(5000),
  })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
    })
    .catch((err) => {
      registered = null;
      throw err;
    });
  return registered;
}

export async function getContent(): Promise<SiteContent> {
  let draft = false;
  try {
    draft = (await draftMode()).isEnabled;
  } catch {}
  register()?.catch(() => undefined);
  try {
    const res = await fetch(`${env.internalUrl}/internal/cms/self/content${draft ? '?draft=1' : ''}`, {
      headers: { 'x-internal-secret': env.internalSecret },
      ...(draft ? { cache: 'no-store' as const } : { next: { revalidate: 60, tags: ['zxcode-content'] } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return DEFAULTS;
    const data = (await res.json()) as { content: Partial<SiteContent> };
    if (!data.content || !('glowna' in data.content)) {
      registered = null;
      register()?.catch(() => undefined);
    }
    const out = { ...DEFAULTS } as Record<string, Record<string, unknown>>;
    for (const [k, v] of Object.entries(data.content ?? {})) out[k] = { ...(out[k] ?? {}), ...(v as Record<string, unknown>) };
    return out as unknown as SiteContent;
  } catch {
    return DEFAULTS;
  }
}

export async function getSiteState(): Promise<SiteState> {
  try {
    const res = await fetch(`${env.internalUrl}/internal/cms/self/state`, {
      headers: { 'x-internal-secret': env.internalSecret },
      next: { revalidate: 60, tags: ['zxcode-content'] },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { announcement: null };
    return (await res.json()) as SiteState;
  } catch {
    return { announcement: null };
  }
}

export const lines = (v: string) =>
  v
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
