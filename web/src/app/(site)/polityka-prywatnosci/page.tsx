import type { Metadata } from 'next';
import Link from 'next/link';
import { Addr, C, LegalPage, Mail, type LegalSection } from '@/components/site/Legal';

export const metadata: Metadata = {
  title: 'Polityka prywatności',
  description: 'Jak zxCode przetwarza dane osobowe (RODO).',
};

const sections: LegalSection[] = [
  {
    id: 'administrator',
    title: 'Administrator danych',
    body: (
      <>
        <p>
          Administratorem danych osobowych jest <C k="name" /> (<C k="form" />
          )<Addr />{' '}– dalej „Administrator”, działający pod marką zxCode.
        </p>
        <p>
          W sprawach danych osobowych możesz pisać na adres <Mail /> albo w tickecie na serwerze Discord zxCode.
        </p>
      </>
    ),
  },
  {
    id: 'dane',
    title: 'Jakie dane przetwarzamy',
    body: (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Kiedy</th>
              <th>Dane</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Logowanie do panelu (Discord)</td>
              <td>ID konta Discord, nazwa użytkownika, wyświetlana nazwa, avatar. Nie otrzymujemy hasła ani e-maila.</td>
            </tr>
            <tr>
              <td>Formularz wyceny strony</td>
              <td>
                Imię, e-mail, opis projektu oraz – jeśli je podasz – nazwa firmy, adres obecnej strony i nick na Discordzie. Do
                ochrony przed spamem zapisujemy też skrót (hash) adresu IP, z którego nie da się odczytać samego adresu.
              </td>
            </tr>
            <tr>
              <td>Zamówienie i realizacja</td>
              <td>Treść ticketów, ustalenia, dane do rachunku (imię i nazwisko lub firma, adres, NIP), historia wpłat.</td>
            </tr>
            <tr>
              <td>Panel i boty</td>
              <td>Ustawienia botów, lista serwerów, kanałów i ról, na których działa bot, dziennik zmian ustawień.</td>
            </tr>
            <tr>
              <td>Monitoring stron klientów</td>
              <td>Adres strony, dostępność, czas odpowiedzi i data ważności certyfikatu SSL.</td>
            </tr>
            <tr>
              <td>Serwer Discord zxCode</td>
              <td>
                Aktywność na serwerze obsługiwana przez bota zxCode: tickety, weryfikacja, opinie, logi moderacyjne (np. usunięte
                lub edytowane wiadomości), statystyki.
              </td>
            </tr>
            <tr>
              <td>Korzystanie ze strony</td>
              <td>Adres IP, data i godzina, adres podstrony, przeglądarka – w logach serwera.</td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: 'cele',
    title: 'Cele i podstawy prawne',
    body: (
      <ul>
        <li>
          <b>Działania przed zawarciem umowy na Twoje żądanie</b> (przygotowanie wyceny, w tym z formularza na stronie) oraz{' '}
          <b>zawarcie i wykonanie umowy</b> (realizacja, hosting, monitoring, panel, wsparcie) – art. 6 ust. 1 lit. b RODO.
        </li>
        <li>
          <b>Obowiązki prawne</b>, w szczególności podatkowe (m.in. prowadzenie uproszczonej ewidencji sprzedaży) – art. 6 ust. 1 lit. c RODO.
        </li>
        <li>
          <b>Prawnie uzasadniony interes Administratora</b> – art. 6 ust. 1 lit. f RODO: bezpieczeństwo strony i serwera
          Discord (logi, ochrona przed nadużyciami), obsługa zgłoszeń, ustalenie i dochodzenie roszczeń, publikacja opinii i
          portfolio, statystyki.
        </li>
      </ul>
    ),
  },
  {
    id: 'odbiorcy',
    title: 'Komu przekazujemy dane',
    body: (
      <>
        <p>Dane mogą być przekazywane podmiotom, które pomagają nam świadczyć usługi – wyłącznie w niezbędnym zakresie:</p>
        <ul>
          <li>
            dostawca serwerów: <C k="hosting" /> – na podstawie umowy powierzenia przetwarzania,
          </li>
          <li>Discord Inc. – platforma, na której działają boty i logowanie (zasady Discorda dotyczą Twojego konta Discord),</li>
          <li>biuro rachunkowe i podmioty obsługujące płatności – jeśli z nich korzystamy,</li>
          <li>organy publiczne – gdy wymagają tego przepisy.</li>
        </ul>
        <p>
          Discord Inc. ma siedzibę w USA. Przekazanie danych do USA odbywa się na podstawie mechanizmów przewidzianych w RODO
          (m.in. EU-U.S. Data Privacy Framework lub standardowych klauzul umownych).
        </p>
      </>
    ),
  },
  {
    id: 'okres',
    title: 'Jak długo przechowujemy dane',
    body: (
      <ul>
        <li>dane związane z umową – przez czas jej wykonywania, a potem do upływu terminów przedawnienia roszczeń,</li>
        <li>zapytania z formularza wyceny – do 12 miesięcy od ostatniej zmiany, potem są automatycznie usuwane,</li>
        <li>dokumenty księgowe – przez okres wymagany przepisami podatkowymi (zwykle 5 lat od końca roku podatkowego),</li>
        <li>sesja logowania na stronie – do 7 dni albo do wylogowania,</li>
        <li>logi serwera i logi moderacyjne – nie dłużej niż jest to potrzebne do celów bezpieczeństwa,</li>
        <li>dane przetwarzane na podstawie uzasadnionego interesu – do skutecznego sprzeciwu.</li>
      </ul>
    ),
  },
  {
    id: 'prawa',
    title: 'Twoje prawa',
    body: (
      <>
        <p>Masz prawo do:</p>
        <ul>
          <li>dostępu do swoich danych i otrzymania ich kopii,</li>
          <li>sprostowania danych,</li>
          <li>usunięcia danych lub ograniczenia ich przetwarzania,</li>
          <li>przenoszenia danych (gdy przetwarzamy je na podstawie umowy),</li>
          <li>sprzeciwu wobec przetwarzania opartego na uzasadnionym interesie,</li>
          <li>
            wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl).
          </li>
        </ul>
        <p>
          Aby skorzystać z praw, napisz na <Mail /> lub w tickecie. Odpowiemy w ciągu miesiąca.
        </p>
      </>
    ),
  },
  {
    id: 'dobrowolnosc',
    title: 'Czy musisz podać dane',
    body: (
      <p>
        Podanie danych jest dobrowolne, ale bez nich nie możemy przygotować wyceny, zrealizować zamówienia ani wystawić rachunku.
        Logowanie przez Discord jest potrzebne tylko do korzystania z panelu klienta.
      </p>
    ),
  },
  {
    id: 'automatyzacja',
    title: 'Zautomatyzowane decyzje',
    body: (
      <p>
        Nie podejmujemy decyzji wywołujących skutki prawne wyłącznie w sposób zautomatyzowany, w tym nie profilujemy. Automatyczne
        mechanizmy bota (np. ochrona przed rajdem, weryfikacja) służą bezpieczeństwu serwera; od ich działania możesz się odwołać
        w tickecie.
      </p>
    ),
  },
  {
    id: 'cookies',
    title: 'Pliki cookies',
    body: (
      <p>
        Strona używa wyłącznie niezbędnych plików cookies (sesja logowania). Szczegóły: <Link href="/cookies">Pliki cookies</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Dokumenty"
      title="Polityka prywatności"
      lead="Jakie dane przetwarzamy, po co, komu je przekazujemy i jakie masz prawa (RODO)."
      sections={sections}
    />
  );
}
