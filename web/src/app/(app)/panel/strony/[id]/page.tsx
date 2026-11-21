import Link from 'next/link';
import { ContentEditor, RefreshButton } from '@/components/ContentEditor';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Edycja treści' };

const host = (url: string | null) => (url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : '');

export default async function SiteContentPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireSession()]);
  const data = await api.cmsSite(session.id, id);
  return (
    <div className="app-page">
      <div className="crumbs">
        <Link href="/panel/strony">Moje strony</Link>
        <span className="sep">/</span>
        <span>{data.site.name}</span>
      </div>
      <div className="app-head">
        <div>
          <h1>{data.site.name}</h1>
          <p>
            {data.site.url ? (
              <a href={data.site.url} target="_blank" rel="noreferrer noopener">
                {host(data.site.url)}
              </a>
            ) : (
              'Edycja treści strony'
            )}
            {' · '}ostatnia zmiana {timeAgo(data.site.updatedAt)}
          </p>
        </div>
        <div className="actions">
          {data.site.url && (
            <a href={data.site.url} target="_blank" rel="noreferrer noopener" className="btn btn-sm">
              <Icon name="laptop" size={16} /> Zobacz stronę
            </a>
          )}
          {data.site.webhook && <RefreshButton siteId={data.site.id} />}
        </div>
      </div>
      <ContentEditor data={data} viewerId={session.id} />
    </div>
  );
}
