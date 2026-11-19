export const FAQ_GROUPS: { title: string; items: { id: string; question: string; answer: string }[] }[] = [
  {
    title: 'Zamówienie i płatności',
    items: [
      {
        id: 'jak-zamowic',
        question: 'Jak złożyć zamówienie?',
        answer:
          'Stronę internetową najłatwiej zamówić przez formularz wyceny na zxcode.pl/zamow – nie potrzebujesz konta na Discordzie. Bota zamawiasz przez ticket na naszym serwerze Discord. W obu przypadkach dopytamy o szczegóły i przygotujemy bezpłatną wycenę.',
      },
      {
        id: 'ile-kosztuje',
        question: 'Ile to kosztuje?',
        answer:
          'To zależy od zakresu. Wycena jest bezpłatna i dostajesz ją, zanim cokolwiek zapłacisz. Orientacyjne ceny pakietów stron i botów znajdziesz w cenniku.',
      },
      {
        id: 'platnosc',
        question: 'Jak wygląda płatność?',
        answer:
          'Po akceptacji wyceny dostajesz proformę z danymi do przelewu. Szczegóły (np. zaliczka przy większych projektach) ustalamy przed rozpoczęciem prac.',
      },
      {
        id: 'czas',
        question: 'Ile trwa realizacja?',
        answer:
          'Wizytówka lub prosty bot to zwykle kilka dni, strona firmowa 1–3 tygodnie, sklepy i rozbudowane systemy – kilka tygodni. Termin podajemy razem z wyceną.',
      },
    ],
  },
  {
    title: 'Strony internetowe',
    items: [
      {
        id: 'www-edycja',
        question: 'Czy będę mógł sam zmieniać treści na stronie?',
        answer:
          'Tak, jeśli wybierzesz panel do edycji treści – teksty, zdjęcia, wpisy na blogu czy produkty zmieniasz sam, bez znajomości kodu. Przy prostych wizytówkach drobne zmiany robimy za Ciebie.',
      },
      {
        id: 'www-domena',
        question: 'Czy pomożecie z domeną i hostingiem?',
        answer:
          'Tak. Doradzimy, jaką domenę kupić, podepniemy ją i uruchomimy stronę na szybkim serwerze z certyfikatem SSL. Jeśli masz już hosting, wdrożymy stronę u Ciebie.',
      },
      {
        id: 'www-telefony',
        question: 'Czy strona będzie działać na telefonach?',
        answer:
          'Zawsze. Każdą stronę projektujemy najpierw z myślą o telefonach i testujemy na różnych urządzeniach i przeglądarkach przed oddaniem.',
      },
      {
        id: 'www-seo',
        question: 'Czy strona będzie widoczna w Google?',
        answer:
          'Dbamy o techniczne SEO: szybkość, poprawną strukturę, opisy, mapę strony i dane dla wyszukiwarek. Pozycja zależy też od treści i konkurencji – doradzimy, co jeszcze możesz zrobić.',
      },
      {
        id: 'www-rodo',
        question: 'A co z RODO i plikami cookies?',
        answer:
          'Przygotujemy stronę zgodnie z przepisami: politykę prywatności, informację o cookies i – jeśli korzystasz z analityki lub reklam – baner zgody.',
      },
      {
        id: 'www-kod',
        question: 'Czy strona będzie moja?',
        answer:
          'Tak. Po pełnej zapłacie przekazujemy Ci stronę, dostęp do panelu i – zgodnie z ustaleniami w wycenie – kod źródłowy.',
      },
    ],
  },
  {
    title: 'Boty Discord',
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
        answer:
          'Tak – uruchamiamy i utrzymujemy boty oraz strony. Możesz też mieć własny hosting i domenę: wtedy pomożemy we wdrożeniu i konfiguracji.',
      },
      {
        id: 'awaria',
        question: 'Co jeśli bot albo strona przestanie działać?',
        answer:
          'Boty i strony naszych klientów są monitorowane co minutę, a przy stronach pilnujemy też certyfikatu SSL. Przy awarii dostajemy alert i od razu się tym zajmujemy.',
      },
      {
        id: 'kontakt',
        question: 'Jak się z wami skontaktować?',
        answer: 'Przez formularz wyceny na stronie, ticket na naszym serwerze Discord albo e-mail: kontakt@zxcode.pl.',
      },
    ],
  },
];
