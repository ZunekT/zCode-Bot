'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { ToastProvider } from '../Toast';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  ownerOnly?: boolean;
}

const CLIENT: NavItem[] = [
  { href: '/panel', label: 'Pulpit', icon: 'desktop', exact: true },
  { href: '/panel/boty', label: 'Moje boty', icon: 'bot' },
  { href: '/panel/zlecenia', label: 'Zlecenia', icon: 'package' },
];
const ADMIN: NavItem[] = [
  { href: '/admin', label: 'Przegląd', icon: 'checklist', exact: true },
  { href: '/admin/zlecenia', label: 'Zlecenia', icon: 'cart' },
  { href: '/admin/tickety', label: 'Tickety', icon: 'ticket' },
  { href: '/admin/klienci', label: 'Klienci', icon: 'users' },
  { href: '/admin/ewidencja', label: 'Ewidencja', icon: 'invoice', ownerOnly: true },
  { href: '/admin/dziennik', label: 'Dziennik', icon: 'documentation' },
  { href: '/admin/administratorzy', label: 'Administratorzy', icon: 'user_crown', ownerOnly: true },
  { href: '/admin/serwer', label: 'Strona i serwer', icon: 'server', ownerOnly: true },
];

const isActive = (path: string, it: NavItem) => (it.exact ? path === it.href : path === it.href || path.startsWith(`${it.href}/`));

function RouteProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setState('loading');
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, []);

  useEffect(() => {
    setState((s) => (s === 'loading' ? 'done' : s));
    const t = setTimeout(() => setState('idle'), 450);
    return () => clearTimeout(t);
  }, [pathname, search]);

  return <div className={`route-bar ${state}`} aria-hidden />;
}

function NavGroup({ title, items, path }: { title: string; items: NavItem[]; path: string }) {
  return (
    <div className="nav-group">
      <div className="nav-title">{title}</div>
      {items.map((it) => {
        const on = isActive(path, it);
        return (
          <Link key={it.href} href={it.href} className="nav-item" data-on={on} aria-current={on ? 'page' : undefined}>
            <Icon name={it.icon} size={18} />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function AppShell({
  user,
  owner,
  admin,
  children,
}: {
  user: { name: string; avatar: string };
  owner: boolean;
  admin: boolean;
  children: ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const [ind, setInd] = useState<{ y: number; h: number } | null>(null);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.documentElement.classList.toggle('lock', open);
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  // Wskaźnik aktywnej pozycji – przesuwa się (transform) do aktywnego linku.
  useLayoutEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>('.nav-item[data-on="true"]');
    setInd(el ? { y: el.offsetTop, h: el.offsetHeight } : null);
  }, [path, owner, admin]);

  // Poświata kart za kursorem: jeden nasłuch na cały panel, bez re-renderów.
  useEffect(() => {
    if (!matchMedia('(hover: hover)').matches) return;
    let last: HTMLElement | null = null;
    const move = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.glow');
      if (last && last !== el) last.classList.remove('lit');
      last = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
      el.classList.add('lit');
    };
    document.addEventListener('pointermove', move, { passive: true });
    return () => document.removeEventListener('pointermove', move);
  }, []);

  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>
      <div className="app-bg" aria-hidden>
        <i />
        <i />
      </div>

      <header className="app-top glass">
        <button className="app-burger" aria-label={open ? 'Zamknij menu' : 'Menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span />
          <span />
          <span />
        </button>
        <Link href="/panel" className="brand">
          <Icon name="logo_round" size={28} />
          <span>
            zx<b>Code</b>
          </span>
        </Link>
        <img src={user.avatar} alt="" width={30} height={30} className="app-top-avatar" />
      </header>

      <div className={`app-scrim${open ? ' on' : ''}`} onClick={() => setOpen(false)} aria-hidden />

      <aside className={`app-side glass${open ? ' open' : ''}`} aria-label="Menu panelu">
        <Link href="/" className="brand app-brand">
          <Icon name="logo_round" size={30} />
          <span>
            zx<b>Code</b>
          </span>
        </Link>
        <nav ref={nav} className="app-nav">
          {ind && <span className="nav-ind" style={{ transform: `translateY(${ind.y}px)`, height: ind.h }} aria-hidden />}
          <NavGroup title="Panel klienta" items={CLIENT} path={path} />
          {admin && <NavGroup title="Administracja" items={ADMIN.filter((i) => owner || !i.ownerOnly)} path={path} />}
        </nav>
        <div className="app-user">
          <img src={user.avatar} alt="" width={36} height={36} />
          <div>
            <div className="app-user-name">{user.name}</div>
            <Link href="/" className="faint small">
              Strona główna ↗
            </Link>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="icon-btn" type="submit" aria-label="Wyloguj" title="Wyloguj">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M8 4H5a1 1 0 00-1 1v10a1 1 0 001 1h3M13 14l4-4-4-4M17 10H8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      </aside>

      <div className="app-main">{children}</div>
    </ToastProvider>
  );
}
