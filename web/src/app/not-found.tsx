import Link from 'next/link';
import { Icon } from '@/components/Icon';

export default function NotFound() {
  return (
    <main className="container page">
      <div className="card empty" style={{ marginTop: 48 }}>
        <Icon name="shield_x" size={56} />
        <h2>Nie znaleziono</h2>
        <p>Ta strona nie istnieje albo nie masz do niej dostępu.</p>
        <Link href="/panel" className="btn btn-primary">
          Wróć do panelu
        </Link>
      </div>
    </main>
  );
}
