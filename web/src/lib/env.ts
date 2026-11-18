import 'server-only';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Brak zmiennej środowiskowej ${name} (zobacz web/.env.example)`);
  return v;
}

/** Konfiguracja strony – czytana leniwie, żeby build działał bez sekretów. */
export const env = {
  get siteUrl() {
    return (process.env.SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  },
  get discordClientId() {
    return required('DISCORD_CLIENT_ID');
  },
  get discordClientSecret() {
    return required('DISCORD_CLIENT_SECRET');
  },
  get sessionSecret() {
    const s = required('SESSION_SECRET');
    if (s.length < 32) throw new Error('SESSION_SECRET musi mieć min. 32 znaki');
    return s;
  },
  get internalUrl() {
    return (process.env.INTERNAL_API_URL ?? 'http://localhost:3100').replace(/\/$/, '');
  },
  get internalSecret() {
    return required('INTERNAL_API_SECRET');
  },
  get discordInvite() {
    return process.env.DISCORD_INVITE_URL || null;
  },
  get secureCookies() {
    return this.siteUrl.startsWith('https://');
  },
};
