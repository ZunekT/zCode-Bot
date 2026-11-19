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
            <p>Programowanie botów Discord. Projekt, kod, wdrożenie i opieka – w jednym miejscu.</p>
          </div>
          <nav aria-label="Stopka">
            <div>
              <b>Oferta</b>
              <Link href="/realizacje">Realizacje</Link>
              <Link href="/cennik">Cennik</Link>
              <Link href="/opinie">Opinie</Link>
              <Link href="/faq">FAQ</Link>
            </div>
            <div>
              <b>Klient</b>
              <a href="/zamow">Zamów bota</a>
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
