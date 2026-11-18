import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Mail, type LegalSection } from '@/components/site/Legal';

export const metadata: Metadata = { title: 'Pliki cookies', description: 'Jakich plików cookies używa strona zxcode.pl.' };

const sections: LegalSection[] = [
  {
    id: 'czym-sa',
    title: 'Czym są pliki cookies',
    body: (
      <p>
        Cookies to małe pliki zapisywane w przeglądarce. Pozwalają stronie rozpoznać, że jesteś zalogowany, i zapamiętać krótkie
        informacje między kolejnymi wizytami.
      </p>
    ),
  },
  {
    id: 'jakich-uzywamy',
    title: 'Jakich cookies używamy',
    body: (
      <>
        <p>Używamy wyłącznie plików niezbędnych do działania logowania i panelu klienta:</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Cel</th>
                <th>Ważność</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>zx_session</code>
                </td>
                <td>Sesja po zalogowaniu przez Discord (podpisana, bez hasła i tokenu Discorda).</td>
                <td>7 dni lub do wylogowania</td>
              </tr>
              <tr>
                <td>
                  <code>zx_oauth_state</code>
                </td>
                <td>Zabezpieczenie procesu logowania przed atakami (CSRF).</td>
                <td>10 minut</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Nie używamy cookies analitycznych, reklamowych ani śledzących i nie korzystamy z narzędzi firm trzecich, które
          zapisywałyby takie pliki. Dlatego strona nie wyświetla baneru zgody – na niezbędne cookies zgoda nie jest wymagana.
        </p>
      </>
    ),
  },
  {
    id: 'zarzadzanie',
    title: 'Jak zarządzać cookies',
    body: (
      <p>
        Możesz usunąć lub zablokować cookies w ustawieniach przeglądarki. Zablokowanie plików niezbędnych uniemożliwi logowanie do
        panelu klienta; reszta strony będzie działać normalnie.
      </p>
    ),
  },
  {
    id: 'kontakt',
    title: 'Kontakt',
    body: (
      <p>
        Pytania o cookies i dane osobowe: <Mail />. Więcej w <Link href="/polityka-prywatnosci">Polityce prywatności</Link>.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      kicker="Dokumenty"
      title="Pliki cookies"
      lead="Strona zxcode.pl używa tylko niezbędnych plików cookies – bez analityki i reklam."
      sections={sections}
    />
  );
}
