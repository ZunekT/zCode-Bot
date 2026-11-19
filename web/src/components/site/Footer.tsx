import Link from 'next/link';
import { Icon } from '../Icon';

export function Footer() {
  return (
    <footer className="sfooter">
      <div className="wrap">
        <div className="sfooter-grid">
          <div style={{ maxWidth: 320 }}>
            <Link href="/" className="brand" style={{ marginBottom: 12, display: 'inline-flex' }}>
              <Icon name="logo_round" size={32} />
              <span>
                zx<b>Code</b>
              </span>
            </Link>
            <p>Strony internetowe i boty Discord. Projekt, kod, wdrożenie i opieka – w jednym miejscu.</p>
            <a href="mailto:kontakt@zxcode.pl" className="sfooter-mail">
              kontakt@zxcode.pl
            </a>
          </div>
          <nav aria-label="Stopka">
            <div>
              <b>Usługi</b>
              <Link href="/strony-internetowe">Strony internetowe</Link>
              <Link href="/boty-discord">Boty Discord</Link>
              <Link href="/cennik">Cennik</Link>
              <Link href="/realizacje">Realizacje</Link>
            </div>
            <div>
              <b>Klient</b>
              <Link href="/zamow">Bezpłatna wycena</Link>
              <Link href="/opinie">Opinie</Link>
              <Link href="/faq">FAQ</Link>
              <Link href="/panel" prefetch={false}>
                Panel klienta
              </Link>
            </div>
            <div>
              <b>Informacje</b>
              <Link href="/regulamin">Regulamin</Link>
              <Link href="/polityka-prywatnosci">Polityka prywatności</Link>
              <Link href="/cookies">Pliki cookies</Link>
            </div>
          </nav>
        </div>
        <div className="sfooter-bottom">
          <span>© {new Date().getFullYear()} zxCode</span>
          <span>Strona używa tylko niezbędnych plików cookies (logowanie). Nie jesteśmy powiązani z Discord Inc.</span>
        </div>
      </div>
    </footer>
  );
}
