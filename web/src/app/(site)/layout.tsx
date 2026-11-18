import { Footer } from '@/components/site/Footer';
import { Nav } from '@/components/site/Nav';
import { MotionProvider } from '@/components/site/primitives';
import '@/components/site/site.css';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <div className="site">
        <a href="#tresc" className="skip-link">
          Przejdź do treści
        </a>
        <Nav />
        <main id="tresc">{children}</main>
        <Footer />
      </div>
    </MotionProvider>
  );
}
