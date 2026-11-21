import Link from 'next/link';
import { ContentEditor, RefreshButton } from '@/components/ContentEditor';
import { Icon } from '@/components/Icon';
import { PortfolioEditor, PricingEditor, ReviewsEditor } from '@/components/cms/Business';
import { CmsAccessEditor } from '@/components/cms/CmsAccessEditor';
import { AnnouncementForm, ExportCard, MaintenanceForm, RedirectsEditor, TrackerSnippet } from '@/components/cms/SiteForms';
import { StatsView } from '@/components/cms/StatsView';
import { Segmented } from '@/components/ui/Segmented';
import { api } from '@/lib/api';
import { siteTabs, type TabKey } from '@/lib/cms-tabs';
import { previewUrl, type CmsStats, type Person, type PortfolioRow, type PricingAddonRow, type PricingPackageRow, type ReviewRow } from '@/lib/cms';
import { env } from '@/lib/env';
import { timeAgo } from '@/lib/format';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Edycja strony' };

const host = (url: string | null) => (url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : '');

export default async function SiteEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab }, session] = await Promise.all([params, searchParams, requireSession()]);
  const data = await api.cmsSite(session.id, id);
  const tabs = siteTabs(data);
  const active: TabKey = tabs.some((t) => t.key === tab) ? (tab as TabKey) : 'tresc';
  const call = <T,>(path: string) => api.cmsCall<T>(session.id, 'GET', data.site.id, path);
  const scriptUrl = data.site.isSelf ? null : `${(env.cmsPublicUrl ?? 'https://bot.zxcode.pl').replace(/\/$/, '')}/cms/v1/t.js`;

  let body: React.ReactNode;
  if (active === 'statystyki') {
    const stats = await call<CmsStats>('stats?days=30');
    body = (
      <>
        {scriptUrl && data.site.trackId && (
          <section className="card" style={{ padding: 18, marginBottom: 16 }}>
            <TrackerSnippet trackId={data.site.trackId} scriptUrl={scriptUrl} />
          </section>
        )}
        <StatsView siteId={data.site.id} initial={stats} />
      </>
    );
  } else if (active === 'cennik') {
    body = <PricingEditor siteId={data.site.id} initial={await call<{ packages: PricingPackageRow[]; addons: PricingAddonRow[] }>('pricing')} />;
  } else if (active === 'realizacje') {
    body = <PortfolioEditor siteId={data.site.id} initial={await call<PortfolioRow[]>('portfolio')} />;
  } else if (active === 'opinie') {
    body = <ReviewsEditor siteId={data.site.id} initial={await call<{ reviews: ReviewRow[]; people: Record<string, Person> }>('reviews')} />;
  } else if (active === 'ogloszenie') {
    body = <AnnouncementForm siteId={data.site.id} initial={data.announcement} />;
  } else if (active === 'przerwa') {
    body = <MaintenanceForm siteId={data.site.id} initial={data.maintenance} previewUrl={previewUrl(data.site)} />;
  } else if (active === 'przekierowania') {
    body = <RedirectsEditor siteId={data.site.id} initial={data.redirects} />;
  } else if (active === 'dostep') {
    body = <CmsAccessEditor siteId={data.site.id} ownerId={data.site.ownerId} me={data.me} initial={data.members ?? []} people={data.people} sections={data.schema.sections} />;
  } else if (active === 'eksport') {
    body = <ExportCard siteId={data.site.id} isSelf={data.site.isSelf} />;
  } else {
    body = <ContentEditor key={`${data.site.id}-${data.site.revision}`} data={data} viewerId={session.id} />;
  }

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
              'Edycja strony'
            )}
            {' · '}ostatnia zmiana {timeAgo(data.site.updatedAt)}
            {data.maintenance.enabled && <span className="pill pill-warn" style={{ marginLeft: 8 }}>przerwa techniczna</span>}
          </p>
        </div>
        <div className="actions">
          {data.site.url && (
            <a href={data.site.isSelf ? '/' : data.site.url} target="_blank" rel="noreferrer noopener" className="btn btn-sm">
              <Icon name="laptop" size={16} /> Zobacz stronę
            </a>
          )}
          {data.site.webhook && data.me.perms.includes('publish') && <RefreshButton siteId={data.site.id} />}
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <Segmented variant="tabs" value={active} items={tabs.map((t) => ({ value: t.key, label: t.label, href: t.key === 'tresc' ? `?` : `?tab=${t.key}` }))} />
      </div>
      <div key={active} className="tab-in">
        {body}
      </div>
    </div>
  );
}
