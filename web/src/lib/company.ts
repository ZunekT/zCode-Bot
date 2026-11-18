/**
 * Dane usługodawcy do regulaminu, polityki prywatności i stopki.
 * UZUPEŁNIJ przed publikacją – pola z „[…]” są widoczne na stronie jako brakujące.
 *
 * Działalność nierejestrowana: zostaw nip/regon puste, w `form` wpisz „działalność nierejestrowana”.
 */
export const company = {
  /** Nazwa marki. */
  brand: 'zxCode',
  /** Imię i nazwisko albo nazwa firmy (administrator danych). */
  name: 'Dorian Kaczyński',
  /** Forma działalności, np. „jednoosobowa działalność gospodarcza” albo „działalność nierejestrowana”. */
  form: 'działalność nierejestrowana (art. 5 ustawy Prawo przedsiębiorców)',
  /** Adres korespondencyjny (ulica, kod, miasto) – puste = nie pokazujemy. */
  address: '',
  nip: '',
  regon: '',
  /** E-mail kontaktowy (też dla spraw RODO i reklamacji). */
  email: 'kontakt@zxcode.pl',
  /** Adres strony. */
  website: 'https://zxcode.pl',
  /** Data wejścia w życie dokumentów. */
  documentsDate: '18 listopada 2026',
  /** Hosting serwera (podmiot przetwarzający). */
  hosting: 'MatHost (mathost.eu)',
};

export const isPlaceholder = (v: string) => v.startsWith('[');
