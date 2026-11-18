'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin', label: 'Przegląd' },
  { href: '/admin/zlecenia', label: 'Zlecenia' },
  { href: '/admin/klienci', label: 'Klienci' },
  { href: '/admin/serwer', label: 'Strona i serwer' },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="tabs admin-tabs" aria-label="Administracja">
      {TABS.map((t) => {
        const active = t.href === '/admin' ? path === '/admin' : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
