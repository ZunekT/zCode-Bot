import { notFound } from 'next/navigation';
import { AdminsEditor } from '@/components/AdminsEditor';
import { api } from '@/lib/api';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Administratorzy' };

export default async function AdminsPage() {
  const session = await requireSession();
  if (!(await api.me(session.id)).owner) notFound();
  const [data, people] = await Promise.all([api.admins(session.id), api.people(session.id)]);
  return (
    <div className="app-page">
      <div className="app-head">
        <div>
          <h1>Administratorzy</h1>
          <p>Kto ma uprawnienia administracyjne na stronie i w bocie.</p>
        </div>
      </div>
      <AdminsEditor initial={data} people={people.people} />
    </div>
  );
}
