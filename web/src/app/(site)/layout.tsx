import { Footer } from '@/components/site/Footer';
import { RevealObserver } from '@/components/site/islands';
import { Nav } from '@/components/site/Nav';
import '@/components/site/site.css';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <noscript>
        <style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style>
      </noscript>
      <a href="#tresc" className="skip-link">
        Przejdź do treści
      </a>
      <Nav />
      <main id="tresc">{children}</main>
      <Footer />
      <RevealObserver />
    </div>
  );
}
