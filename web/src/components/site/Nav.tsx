'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '../Icon';
import { useScrolled } from './islands';

export const NAV_LINKS = [
  { href: '/', label: 'Start' },
  { href: '/realizacje', label: 'Realizacje' },
  { href: '/opinie', label: 'Opinie' },
  { href: '/cennik', label: 'Cennik' },
  { href: '/faq', label: 'FAQ' },
];

export function Nav() {
  const pathname = usePathname();
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const current = (href: string) => ((href === '/' ? pathname === '/' : pathname.startsWith(href)) ? 'page' : undefined);

  return (
    <>
      <header className={`snav${scrolled || open ? ' scrolled' : ''}`}>
        <Link href="/" className="brand" aria-label="zxCode – strona główna">
          <Icon name="logo_round" size={32} />
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
          className={`snav-burger${open ? ' open' : ''}`}
          aria-label={open ? 'Zamknij menu' : 'Otwórz menu'}
          aria-expanded={open}
          aria-controls="menu-mobile"
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
        </button>
      </header>
      <nav id="menu-mobile" className={`snav-mobile${open ? ' open' : ''}`} aria-label="Menu" aria-hidden={!open} inert={!open}>
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={current(l.href)}>
            {l.label}
          </Link>
        ))}
        <hr />
        <Link href="/panel" prefetch={false}>
          Panel klienta <span className="muted">→</span>
        </Link>
      </nav>
    </>
  );
}
