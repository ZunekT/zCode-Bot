export type CmsFieldType = 'text' | 'textarea' | 'richtext' | 'number' | 'boolean' | 'select' | 'color' | 'url' | 'image' | 'list';

export interface CmsField {
  key: string;
  type: CmsFieldType;
  label: string;
  description?: string;
  default?: unknown;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  options?: { value: string; label: string }[];
  fields?: CmsField[];
  maxItems?: number;
}

export interface CmsSection {
  key: string;
  label: string;
  description?: string;
  fields: CmsField[];
}

export type CmsContent = Record<string, Record<string, unknown>>;
export type CmsImageRef = { id: string; alt: string } | null;

export interface CmsAsset {
  id: string;
  name: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface CmsVersion {
  revision: number;
  authorId: string;
  createdAt: string;
  content: CmsContent;
}

export interface CmsSiteSummary {
  id: number;
  name: string;
  url: string | null;
  shared: boolean;
  isSelf: boolean;
  revision: number;
  updatedAt: string;
  connected: boolean;
  sections: number;
  hasDraft: boolean;
  maintenance: boolean;
  assets: number;
}

export type CmsPerm = 'content' | 'publish' | 'announcement' | 'maintenance' | 'redirects' | 'stats' | 'access';
export type Tone = 'info' | 'success' | 'warning' | 'promo';

export interface Announcement {
  enabled: boolean;
  text: string;
  link: string;
  linkLabel: string;
  tone: Tone;
  startsAt: string | null;
  endsAt: string | null;
  dismissible: boolean;
  version: number;
}

export interface Maintenance {
  enabled: boolean;
  title: string;
  message: string;
  until: string | null;
}

export interface Redirect {
  from: string;
  to: string;
  permanent: boolean;
}

export interface CmsMember {
  userId: string;
  permissions: CmsPerm[];
  sections: string[];
  addedBy: string;
  createdAt: string;
}

export interface Person {
  id: string;
  name: string;
  avatar: string | null;
}

export interface CmsEditorData {
  site: {
    id: number;
    name: string;
    url: string | null;
    ownerId: string;
    isSelf: boolean;
    revision: number;
    updatedAt: string;
    connected: boolean;
    webhook: boolean;
    trackId: string | null;
    previewToken: string | null;
  };
  me: { owner: boolean; perms: CmsPerm[]; sections: string[] | null };
  schema: { sections: CmsSection[] };
  content: CmsContent;
  draft: CmsContent | null;
  draftAt: string | null;
  scheduledAt: string | null;
  announcement: Announcement;
  maintenance: Maintenance;
  redirects: Redirect[];
  members: CmsMember[] | null;
  assets: CmsAsset[];
  versions: CmsVersion[];
  people: Record<string, Person>;
}

export interface CmsStats {
  days: number;
  series: { day: string; views: number; visitors: number }[];
  views: number;
  visitors: number;
  pages: { path: string; views: number }[];
  sources: { source: string; views: number }[];
}

export interface PricingPackageRow {
  id: number;
  kind: 'BOT' | 'WEBSITE';
  name: string;
  description: string;
  price: number;
  features: string[];
  position: number;
}

export interface PricingAddonRow {
  id: number;
  kind: 'BOT' | 'WEBSITE';
  label: string;
  description: string | null;
  price: number;
  active: boolean;
}

export interface PortfolioRow {
  id: number;
  kind: 'BOT' | 'WEBSITE';
  title: string;
  description: string;
  technologies: string[];
  url: string | null;
  position: number;
  images: number[];
}

export interface ReviewRow {
  id: number;
  userId: string;
  rating: number;
  content: string;
  approved: boolean;
  createdAt: string;
  order: { id: number; title: string } | null;
}

export const PERM_INFO: { key: CmsPerm; label: string; hint: string }[] = [
  { key: 'content', label: 'Edycja treści i zdjęć', hint: 'Zmiany zapisują się jako wersja robocza' },
  { key: 'publish', label: 'Publikowanie', hint: 'Publikacja i planowanie zmian na stronie' },
  { key: 'announcement', label: 'Ogłoszenia', hint: 'Pasek z komunikatem na stronie' },
  { key: 'maintenance', label: 'Przerwa techniczna', hint: 'Włączanie strony „Przerwa techniczna”' },
  { key: 'redirects', label: 'Przekierowania', hint: 'Stare adresy na nowe' },
  { key: 'stats', label: 'Statystyki', hint: 'Podgląd odwiedzin' },
  { key: 'access', label: 'Zarządzanie dostępem', hint: 'Nadawanie uprawnień innym (w granicach własnych)' },
];

export const assetSrc = (siteId: number, assetId: string) => `/api/strony/${siteId}/obrazy/${assetId}`;

export function previewUrl(site: CmsEditorData['site'], path = '/') {
  if (!site.previewToken) return null;
  const q = `token=${site.previewToken}&path=${encodeURIComponent(path)}`;
  if (site.isSelf) return `/api/podglad?${q}`;
  return site.url ? `${site.url.replace(/\/$/, '')}/api/zxcode/preview?${q}` : null;
}

