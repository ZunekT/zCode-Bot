import type { CmsEditorData, CmsPerm } from './cms';

export type TabKey = 'tresc' | 'cennik' | 'realizacje' | 'opinie' | 'ogloszenie' | 'przerwa' | 'przekierowania' | 'statystyki' | 'dostep' | 'eksport';

const TABS: { key: TabKey; label: string; perm: CmsPerm | null; self?: boolean }[] = [
  { key: 'tresc', label: 'Treść', perm: null },
  { key: 'cennik', label: 'Cennik', perm: 'content', self: true },
  { key: 'realizacje', label: 'Realizacje', perm: 'content', self: true },
  { key: 'opinie', label: 'Opinie', perm: 'content', self: true },
  { key: 'ogloszenie', label: 'Ogłoszenie', perm: 'announcement' },
  { key: 'przerwa', label: 'Przerwa techniczna', perm: 'maintenance' },
  { key: 'przekierowania', label: 'Przekierowania', perm: 'redirects' },
  { key: 'statystyki', label: 'Statystyki', perm: 'stats' },
  { key: 'dostep', label: 'Dostęp', perm: 'access' },
  { key: 'eksport', label: 'Eksport', perm: 'content' },
];

export function siteTabs(data: CmsEditorData) {
  return TABS.filter((t) => (!t.self || data.site.isSelf) && (!t.perm || data.me.perms.includes(t.perm)));
}
