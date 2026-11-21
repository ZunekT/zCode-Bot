import { AnnouncementBar } from '@/components/site/Announcement';
import { Footer } from '@/components/site/Footer';
import { RevealObserver } from '@/components/site/islands';
import { Nav } from '@/components/site/Nav';
import { Track } from '@/components/site/Track';
import { getContent, getSiteState } from '@/lib/content';
import '@/components/site/site.css';

export const revalidate = 60;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [content, state] = await Promise.all([getContent(), getSiteState()]);
  return (
    <div className={`site${state.announcement ? ' has-ann' : ''}`} style={state.announcement ? ({ '--ann-h': '40px' } as React.CSSProperties) : undefined}>
      <noscript>
        <style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style>
      </noscript>
      <a href="#tresc" className="skip-link">
        Przejdź do treści
      </a>
      {state.announcement && <AnnouncementBar a={state.announcement} />}
      <Nav />
      <main id="tresc">{children}</main>
      <Footer about={content.stopka.opis} />
      <RevealObserver />
      <Track />
    </div>
  );
}
