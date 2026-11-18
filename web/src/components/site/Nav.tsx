'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useState } from 'react';
import { Icon } from '../Icon';

export const NAV_LINKS = [
  { href: '/', label: 'Start' },
  { href: '/realizacje', label: 'Realizacje' },
  { href: '/opinie', label: 'Opinie' },
  { href: '/cennik', label: 'Cennik' },
  { href: '/faq', label: 'FAQ' },
];

export function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 16);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const current = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href)) ? 'page' : undefined;

  return (
    <>
      <header className={`snav${scrolled || open ? ' scrolled' : ''}`}>
        <Link href="/" className="brand" aria-label="zxCode – strona główna">
          <Icon name="logo_round" size={30} />
          <span>
            zx<b>Code</b>
          </span>
        </Link>
        <nav className="snav-links" aria-label="Główna">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={current(l.href)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="spacer" />
        <Link href="/panel" className="btn btn-ghost btn-sm snav-login" prefetch={false}>
          Panel klienta
        </Link>
        <a href="/zamow" className="btn btn-primary btn-sm">
          Zamów bota
        </a>
        <button
          className="snav-burger"
          aria-label={open ? 'Zamknij menu' : 'Otwórz menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span style={open ? { transform: 'translateY(2.75px) rotate(45deg)' } : undefined} />
          <span style={open ? { transform: 'translateY(-2.75px) rotate(-45deg)' } : undefined} />
        </button>
      </header>
      <AnimatePresence>
        {open && (
          <m.nav
            className="snav-mobile"
            aria-label="Menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} aria-current={current(l.href)}>
                {l.label}
              </Link>
            ))}
            <hr />
            <Link href="/panel" prefetch={false}>
              Panel klienta <span className="muted">→</span>
            </Link>
          </m.nav>
        )}
      </AnimatePresence>
    </>
  );
}
