import Link from 'next/link';
import { Icon } from './Icon';
import { avatarUrl, type Session } from '@/lib/session';

export function Topbar({ session, active }: { session: Session | null; active?: 'panel' }) {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="brand">
          <Icon name="logo_round" size={30} />
          <span>
            zx<b>Code</b>
          </span>
        </Link>
        {session && (
          <nav className="nav">
            <Link href="/panel" aria-current={active === 'panel' ? 'page' : undefined}>
              Moje boty
            </Link>
          </nav>
        )}
        <div className="spacer" />
        {session ? (
          <>
            <div className="user-chip">
              <img src={avatarUrl(session)} alt="" />
              <span>{session.globalName ?? session.username}</span>
            </div>
            <form action="/api/auth/logout" method="post">
              <button className="btn btn-ghost btn-sm" type="submit">
                Wyloguj
              </button>
            </form>
          </>
        ) : (
          <a href="/api/auth/login" className="btn btn-sm">
            <Icon name="discord" size={16} /> Zaloguj
          </a>
        )}
      </div>
    </header>
  );
}
