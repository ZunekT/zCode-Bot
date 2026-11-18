'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Icon } from '../Icon';

const LINKS = [
  { href: '#uslugi', label: 'Usługi' },
  { href: '#proces', label: 'Jak pracujemy' },
  { href: '#realizacje', label: 'Realizacje' },
  { href: '#cennik', label: 'Cennik' },
  { href: '#panel', label: 'Panel' },
  { href: '#faq', label: 'FAQ' },
];

export function Nav({ loggedIn, orderUrl, sections }: { loggedIn: boolean; orderUrl: string; sections: string[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const links = LINKS.filter((l) => sections.includes(l.href.slice(1)));

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <>
      <motion.header
        className={`snav${scrolled || open ? ' scrolled' : ''}`}
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.21, 0.8, 0.3, 1] }}
      >
        <Link href="/" className="brand">
          <Icon name="logo_round" size={30} />
          <span>
            zx<b>Code</b>
          </span>
        </Link>
        <nav className="snav-links" aria-label="Sekcje">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="spacer" />
        <Link href={loggedIn ? '/panel' : '/api/auth/login'} className="btn btn-ghost btn-sm" prefetch={false}>
          {loggedIn ? 'Panel' : 'Zaloguj'}
        </Link>
        <a href={orderUrl} className="btn btn-primary btn-sm" target={orderUrl.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
          Zamów bota
        </a>
        <button className="snav-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span style={open ? { transform: 'translateY(2.75px) rotate(45deg)' } : undefined} />
          <span style={open ? { transform: 'translateY(-2.75px) rotate(-45deg)' } : undefined} />
        </button>
      </motion.header>
      <AnimatePresence>
        {open && (
          <motion.nav
            className="snav-mobile"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
            <Link href={loggedIn ? '/panel' : '/api/auth/login'} prefetch={false} onClick={() => setOpen(false)}>
              {loggedIn ? 'Panel klienta' : 'Zaloguj się'}
            </Link>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
