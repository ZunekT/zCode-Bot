import type { Metadata } from 'next';
import Link from 'next/link';
import { Addr, C, LegalPage, Mail, type LegalSection } from '@/components/site/Legal';

export const metadata: Metadata = { title: 'Regulamin', description: 'Regulamin świadczenia usług zxCode.' };

const sections: LegalSection[] = [
  {
    id: 'postanowienia',
    title: 'Postanowienia ogólne',
    body: (
      <ol>
        <li>
          Regulamin określa zasady świadczenia usług przez <C k="name" /> (<C k="form" />
          )<Addr />{' '}– dalej „Usługodawca” – działającego pod marką zxCode, za pośrednictwem strony zxcode.pl oraz serwera Discord zxCode.
        </li>
        <li>
          Kontakt z Usługodawcą: ticket na serwerze Discord zxCode albo e-mail: <Mail />.
        </li>
        <li>Przed złożeniem zamówienia Klient zapoznaje się z Regulaminem. Złożenie zamówienia oznacza jego akceptację.</li>
      </ol>
    ),
  },
  {
    id: 'definicje',
    title: 'Definicje',
    body: (
      <ul>
        <li>
          <b>Klient</b> – osoba fizyczna, prawna lub jednostka organizacyjna zamawiająca Usługę.
        </li>
        <li>
          <b>Konsument</b> – Klient będący osobą fizyczną, zawierający umowę niezwiązaną bezpośrednio z jego działalnością
          gospodarczą lub zawodową.
        </li>
        <li>
          <b>Usługa</b> – wykonanie bota Discord albo strony internetowej (w tym sklepu internetowego i aplikacji WWW) lub ich
          modyfikacji (Dzieło), a także usługi dodatkowe: hosting, konfiguracja domeny, monitoring, opieka techniczna i dostęp do
          Panelu.
        </li>
        <li>
          <b>Panel</b> – panel klienta na zxcode.pl, w którym Klient widzi postęp zleceń i płatności, zarządza ustawieniami swoich
          botów i sprawdza stan swoich stron.
        </li>
        <li>
          <b>Wycena</b> – indywidualna oferta określająca zakres, cenę i termin realizacji.
        </li>
      </ul>
    ),
  },
  {
    id: 'zamowienie',
    title: 'Zamówienie i zawarcie umowy',
    body: (
      <ol>
        <li>
          Zamówienie składa się przez formularz wyceny na zxcode.pl, ticket na serwerze Discord zxCode albo e-mailem: <Mail />,
          opisując oczekiwany zakres prac.
        </li>
        <li>
          Usługodawca przygotowuje bezpłatną Wycenę. Ceny na stronie zxcode.pl są orientacyjne i nie stanowią oferty w rozumieniu
          Kodeksu cywilnego.
        </li>
        <li>Umowa zostaje zawarta z chwilą akceptacji Wyceny przez Klienta w tickecie lub e-mailem (forma dokumentowa).</li>
        <li>Zmiana zakresu po zawarciu umowy wymaga nowej Wyceny lub aneksu uzgodnionego w tickecie lub e-mailem.</li>
      </ol>
    ),
  },
  {
    id: 'platnosci',
    title: 'Ceny i płatności',
    body: (
      <ol>
        <li>Ceny podawane są w złotych polskich (PLN) i są cenami końcowymi.</li>
        <li>
          Płatność odbywa się przelewem na podstawie proformy. Po zapłacie Klient może otrzymać rachunek. Przy większych projektach Usługodawca może wymagać
          zaliczki – jej wysokość podaje w Wycenie.
        </li>
        <li>Usługi cykliczne (np. hosting, opieka nad stroną) opłaca się z góry za dany okres rozliczeniowy.</li>
        <li>
          Opłaty zewnętrznych dostawców (np. rejestracja i odnowienie domeny, płatne wtyczki, bramki płatności) nie są wliczone w
          cenę Usługi, chyba że Wycena stanowi inaczej.
        </li>
        <li>Brak płatności za usługę cykliczną może skutkować wstrzymaniem jej świadczenia po wcześniejszym powiadomieniu.</li>
      </ol>
    ),
  },
  {
    id: 'realizacja',
    title: 'Realizacja i odbiór',
    body: (
      <ol>
        <li>Termin realizacji podawany jest w Wycenie i liczy się od dnia zaksięgowania płatności (lub zaliczki).</li>
        <li>Klient współpracuje przy realizacji – w szczególności udziela informacji i dostępów niezbędnych do wykonania Usługi.</li>
        <li>
          Przed odbiorem Klient może przetestować bota na swoim serwerze lub stronę w wersji testowej i zgłosić uwagi. Usługodawca
          wprowadza poprawki mieszczące się w uzgodnionym zakresie.
        </li>
        <li>
          Odbiór następuje przez potwierdzenie w tickecie lub e-mailem. Brak zgłoszenia uwag w ciągu 7 dni od udostępnienia Dzieła
          do odbioru oznacza jego odebranie.
        </li>
        <li>Przez 30 dni od odbioru Usługodawca bezpłatnie usuwa błędy w działaniu Dzieła w uzgodnionym zakresie.</li>
      </ol>
    ),
  },
  {
    id: 'strony',
    title: 'Strony internetowe',
    body: (
      <ol>
        <li>
          Klient dostarcza treści (teksty, zdjęcia, logo, dane firmy) i odpowiada za to, że ma do nich prawa oraz że są zgodne z
          prawem. Usługodawca może użyć licencjonowanych zdjęć, ikon i fontów, jeśli Wycena tak przewiduje.
        </li>
        <li>
          Domena i hosting mogą być zarejestrowane na Klienta albo – na jego prośbę – utrzymywane przez Usługodawcę. Na żądanie
          Klienta Usługodawca przekazuje dostęp do domeny i strony, o ile Usługa została w pełni opłacona.
        </li>
        <li>
          Strona jest testowana w aktualnych wersjach popularnych przeglądarek (m.in. Chrome, Safari, Firefox, Edge) na komputerach i
          urządzeniach mobilnych.
        </li>
        <li>
          Usługodawca przygotowuje stronę zgodnie z wymaganiami technicznymi (m.in. HTTPS, informacja o plikach cookies). Za treść
          dokumentów prawnych działalności Klienta (np. regulaminu sklepu, polityki prywatności) odpowiada Klient, chyba że Wycena
          obejmuje ich przygotowanie – przygotowane wzory nie stanowią porady prawnej.
        </li>
        <li>
          Pozycja strony w wyszukiwarkach zależy od czynników niezależnych od Usługodawcy (algorytmy, konkurencja, treści), dlatego
          Usługodawca nie gwarantuje określonej pozycji.
        </li>
      </ol>
    ),
  },
  {
    id: 'prawa',
    title: 'Prawa do Dzieła i kodu',
    body: (
      <ol>
        <li>
          Z chwilą zapłaty pełnej ceny Klient otrzymuje niewyłączną, nieograniczoną czasowo licencję na korzystanie z Dzieła – bota
          na swoich serwerach Discord lub strony internetowej w ramach swojej działalności – chyba że Wycena stanowi inaczej (np.
          przeniesienie autorskich praw majątkowych do kodu i projektu graficznego).
        </li>
        <li>
          Biblioteki i elementy wspólne używane w wielu projektach (w tym pakiety zxcode-sdk i zxcode-heartbeat) pozostają
          własnością Usługodawcy; Klient może z nich korzystać w ramach swojego Dzieła.
        </li>
        <li>
          Usługodawca może umieścić Dzieło w portfolio (opis, zrzuty ekranu, a w przypadku strony – link), chyba że Klient się temu
          sprzeciwi.
        </li>
      </ol>
    ),
  },
  {
    id: 'panel',
    title: 'Panel klienta, hosting i monitoring',
    body: (
      <ol>
        <li>Logowanie do Panelu odbywa się przez konto Discord. Klient odpowiada za bezpieczeństwo swojego konta Discord.</li>
        <li>
          Zmiany wprowadzone w Panelu są stosowane w bocie automatycznie. Klient odpowiada za ustawienia, które wprowadził – także
          przez osoby, którym udostępnił bota w Panelu.
        </li>
        <li>
          Usługodawca dokłada starań, aby hosting i Panel działały nieprzerwanie, jednak nie odpowiada za przerwy wynikające z
          awarii Discorda, rejestratorów domen, dostawców infrastruktury lub siły wyższej. Planowane prace serwisowe ogłaszane są z
          wyprzedzeniem.
        </li>
        <li>
          Monitoring polega na automatycznym sprawdzaniu działania bota lub strony (w tym ważności certyfikatu SSL) i powiadamianiu
          o awariach.
        </li>
      </ol>
    ),
  },
  {
    id: 'reklamacje',
    title: 'Reklamacje',
    body: (
      <ol>
        <li>
          Reklamacje można składać w tickecie albo e-mailem: <Mail />. Reklamacja powinna opisywać problem i oczekiwany sposób
          rozwiązania.
        </li>
        <li>Usługodawca rozpatruje reklamację w ciągu 14 dni od jej otrzymania i odpowiada tą samą drogą.</li>
        <li>Konsumentowi przysługują uprawnienia z tytułu niezgodności usługi lub treści cyfrowej z umową na zasadach ustawowych.</li>
      </ol>
    ),
  },
  {
    id: 'odstapienie',
    title: 'Odstąpienie od umowy (konsumenci)',
    body: (
      <ol>
        <li>Konsument może odstąpić od umowy zawartej na odległość w terminie 14 dni bez podawania przyczyny.</li>
        <li>
          Prawo odstąpienia nie przysługuje, jeśli Usługodawca wykonał w pełni usługę za wyraźną zgodą Konsumenta, który został
          poinformowany przed rozpoczęciem świadczenia, że po jego wykonaniu utraci prawo odstąpienia (art. 38 ust. 1 pkt 1
          ustawy o prawach konsumenta), oraz w przypadku treści cyfrowych dostarczanych na zamówienie Konsumenta według jego
          specyfikacji (art. 38 ust. 1 pkt 3).
        </li>
        <li>
          Jeśli Konsument na swoje żądanie zlecił rozpoczęcie prac przed upływem terminu na odstąpienie, a następnie od umowy
          odstąpi, płaci za świadczenia spełnione do chwili odstąpienia.
        </li>
        <li>
          Oświadczenie o odstąpieniu można złożyć w tickecie lub e-mailem: <Mail />.
        </li>
        <li>
          Postanowienia dotyczące Konsumentów stosuje się także do przedsiębiorców zawierających umowę o charakterze
          niezawodowym, na zasadach ustawowych.
        </li>
      </ol>
    ),
  },
  {
    id: 'odpowiedzialnosc',
    title: 'Odpowiedzialność',
    body: (
      <ol>
        <li>Klient korzysta z Dzieła zgodnie z prawem, a z bota – także zgodnie z Warunkami korzystania z usług Discord.</li>
        <li>
          Usługodawca nie odpowiada za skutki zmian w Discordzie (API, zasady platformy), które uniemożliwią działanie funkcji
          bota – w takim przypadku zaproponuje dostosowanie bota na podstawie odrębnej Wyceny, o ile nie dotyczy to okresu
          bezpłatnych poprawek.
        </li>
        <li>
          Wobec Klientów niebędących Konsumentami odpowiedzialność Usługodawcy ograniczona jest do wysokości wynagrodzenia
          zapłaconego za Usługę, której dotyczy szkoda.
        </li>
      </ol>
    ),
  },
  {
    id: 'koncowe',
    title: 'Postanowienia końcowe',
    body: (
      <ol>
        <li>
          Zasady przetwarzania danych osobowych opisuje <Link href="/polityka-prywatnosci">Polityka prywatności</Link>.
        </li>
        <li>
          Usługodawca może zmienić Regulamin z ważnych przyczyn (np. zmiana przepisów lub zakresu usług). Zmiany nie dotyczą umów
          zawartych przed ich wejściem w życie.
        </li>
        <li>
          Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji, m.in. pomocy miejskiego lub powiatowego
          rzecznika konsumentów.
        </li>
        <li>W sprawach nieuregulowanych stosuje się przepisy prawa polskiego.</li>
      </ol>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Dokumenty"
      title="Regulamin"
      lead="Zasady zamawiania stron internetowych i botów, płatności, odbioru, reklamacji i korzystania z panelu klienta."
      sections={sections}
    />
  );
}
