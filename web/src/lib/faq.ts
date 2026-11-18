export const FAQ_GROUPS: { title: string; items: { id: string; question: string; answer: string }[] }[] = [
  {
    title: 'Zamówienie i płatności',
    items: [
      {
        id: 'jak-zamowic',
        question: 'Jak zamówić bota?',
        answer:
          'Dołącz do naszego serwera Discord i otwórz ticket „Zamówienie”. Opisz, czego potrzebujesz – dopytamy o szczegóły i przygotujemy wycenę.',
      },
      {
        id: 'ile-kosztuje',
        question: 'Ile kosztuje bot?',
        answer:
          'To zależy od zakresu. Wycena jest bezpłatna i dostajesz ją, zanim cokolwiek zapłacisz. Orientacyjne ceny pakietów znajdziesz w cenniku.',
      },
      {
        id: 'platnosc',
        question: 'Jak wygląda płatność?',
        answer:
          'Po akceptacji wyceny dostajesz proformę z danymi do przelewu. Szczegóły (np. zaliczka przy większych projektach) ustalamy w tickecie przed rozpoczęciem prac.',
      },
      {
        id: 'czas',
        question: 'Ile trwa realizacja?',
        answer: 'Prostsze boty zwykle kilka dni, rozbudowane systemy – kilka tygodni. Termin podajemy razem z wyceną.',
      },
    ],
  },
  {
    title: 'Bot i panel',
    items: [
      {
        id: 'panel',
        question: 'Czy mogę sam zmieniać ustawienia bota?',
        answer:
          'Tak. Po wdrożeniu logujesz się na zxcode.pl przez Discord i w panelu zmieniasz kanały, role, teksty, moduły oraz uprawnienia komend. Zmiany działają od razu.',
      },
      {
        id: 'poprawki',
        question: 'Co jeśli coś będzie działać inaczej, niż chciałem?',
        answer: 'Przed odbiorem testujesz bota na swoim serwerze i zgłaszasz poprawki. Po odbiorze obowiązuje okres poprawek opisany w regulaminie.',
      },
      {
        id: 'kod',
        question: 'Czy dostanę kod źródłowy?',
        answer: 'Zależy od ustaleń w zamówieniu – zakres praw do kodu określamy w wycenie, zanim zaczniemy pracę.',
      },
    ],
  },
  {
    title: 'Hosting i wsparcie',
    items: [
      {
        id: 'hosting',
        question: 'Czy zajmujecie się hostingiem?',
        answer: 'Tak, możemy uruchomić i utrzymywać bota na naszym serwerze. Możesz też hostować go samodzielnie – wtedy pomożemy we wdrożeniu.',
      },
      {
        id: 'awaria',
        question: 'Co jeśli bot przestanie działać?',
        answer:
          'Boty naszych klientów są monitorowane co minutę. Przy awarii dostajemy alert i od razu się tym zajmujemy, a Ty dostajesz informację na Discordzie.',
      },
      {
        id: 'kontakt',
        question: 'Jak się z wami skontaktować?',
        answer: 'Najszybciej przez ticket na naszym serwerze Discord.',
      },
    ],
  },
];
