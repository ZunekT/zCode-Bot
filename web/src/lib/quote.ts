export const SITE_TYPES = [
  { value: 'wizytowka', label: 'Wizytówka / landing page', hint: 'Jedna dopracowana strona', icon: 'idea' },
  { value: 'firmowa', label: 'Strona firmowa', hint: 'Kilka podstron, oferta, kontakt', icon: 'partnership' },
  { value: 'sklep', label: 'Sklep internetowy', hint: 'Produkty, koszyk, płatności', icon: 'store' },
  { value: 'aplikacja', label: 'Aplikacja / panel WWW', hint: 'System szyty na miarę', icon: 'code' },
  { value: 'inne', label: 'Inne / przebudowa', hint: 'Odświeżenie istniejącej strony', icon: 'tools' },
] as const;

export const SITE_BUDGETS = [
  { value: 'do1000', label: 'do 1000 zł' },
  { value: '1000-2500', label: '1000–2500 zł' },
  { value: '2500-5000', label: '2500–5000 zł' },
  { value: '5000+', label: 'powyżej 5000 zł' },
  { value: 'wycena', label: 'Nie wiem – proszę o wycenę' },
] as const;

export const DEADLINES = [
  { value: 'luz', label: 'Bez pośpiechu' },
  { value: '2tyg', label: 'Do 2 tygodni' },
  { value: '1tyg', label: 'Do tygodnia' },
  { value: 'pilne', label: 'Pilne – kilka dni' },
] as const;
