import Link from 'next/link';
import { NewOrderForm } from '@/components/NewOrderForm';
import { api } from '@/lib/api';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Nowe zlecenie' };

export default async function NewOrderPage() {
  const session = await requireSession();
  const { people } = await api.people(session.id);
  return (
    <div className="app-page">
      <div className="crumbs">
        <Link href="/admin/zlecenia">Zlecenia</Link>
        <span className="sep">/</span>
        <span>Nowe</span>
      </div>
      <div className="app-head">
        <div>
          <h1>Nowe zlecenie</h1>
          <p>Klient dostanie powiadomienie i zobaczy zlecenie w swoim panelu.</p>
        </div>
      </div>
      <NewOrderForm people={people} />
    </div>
  );
}
