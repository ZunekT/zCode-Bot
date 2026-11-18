import { PermissionsBitField, type PermissionResolvable } from 'discord.js';

/** Polskie nazwy uprawnień Discorda (nieznane zostają w oryginale). */
const PL: Record<string, string> = {
  CreateInstantInvite: 'Tworzenie zaproszeń',
  KickMembers: 'Wyrzucanie członków',
  BanMembers: 'Banowanie członków',
  Administrator: 'Administrator',
  ManageChannels: 'Zarządzanie kanałami',
  ManageGuild: 'Zarządzanie serwerem',
  AddReactions: 'Dodawanie reakcji',
  ViewAuditLog: 'Dziennik zdarzeń',
  PrioritySpeaker: 'Priorytetowy mówca',
  Stream: 'Wideo / stream',
  ViewChannel: 'Wyświetlanie kanału',
  SendMessages: 'Wysyłanie wiadomości',
  SendTTSMessages: 'Wiadomości TTS',
  ManageMessages: 'Zarządzanie wiadomościami',
  EmbedLinks: 'Osadzanie linków',
  AttachFiles: 'Załączanie plików',
  ReadMessageHistory: 'Historia wiadomości',
  MentionEveryone: 'Wzmianka @everyone',
  UseExternalEmojis: 'Zewnętrzne emotki',
  ViewGuildInsights: 'Statystyki serwera',
  Connect: 'Łączenie (głos)',
  Speak: 'Mówienie',
  MuteMembers: 'Wyciszanie członków',
  DeafenMembers: 'Ogłuszanie członków',
  MoveMembers: 'Przenoszenie członków',
  UseVAD: 'Aktywacja głosem',
  ChangeNickname: 'Zmiana pseudonimu',
  ManageNicknames: 'Zarządzanie pseudonimami',
  ManageRoles: 'Zarządzanie rolami',
  ManageWebhooks: 'Zarządzanie webhookami',
  ManageGuildExpressions: 'Zarządzanie emotkami',
  UseApplicationCommands: 'Komendy aplikacji',
  RequestToSpeak: 'Prośba o głos',
  ManageEvents: 'Zarządzanie wydarzeniami',
  ManageThreads: 'Zarządzanie wątkami',
  CreatePublicThreads: 'Tworzenie wątków publicznych',
  CreatePrivateThreads: 'Tworzenie wątków prywatnych',
  UseExternalStickers: 'Zewnętrzne naklejki',
  SendMessagesInThreads: 'Pisanie w wątkach',
  UseEmbeddedActivities: 'Aktywności',
  ModerateMembers: 'Wyciszanie (timeout)',
  ViewCreatorMonetizationAnalytics: 'Statystyki monetyzacji',
  UseSoundboard: 'Soundboard',
  CreateGuildExpressions: 'Tworzenie emotek',
  CreateEvents: 'Tworzenie wydarzeń',
  UseExternalSounds: 'Zewnętrzne dźwięki',
  SendVoiceMessages: 'Wiadomości głosowe',
  SendPolls: 'Ankiety',
  UseExternalApps: 'Zewnętrzne aplikacje',
  PinMessages: 'Przypinanie wiadomości',
  BypassSlowmode: 'Pomijanie trybu powolnego',
};

export const permissionName = (flag: string) => PL[flag] ?? flag;

export function permissionList(bits: PermissionResolvable | null | undefined): string[] {
  if (bits === null || bits === undefined) return [];
  return new PermissionsBitField(bits).toArray().map(permissionName);
}

/** Różnica uprawnień: dodane i odebrane (po polsku). */
export function permissionDiff(
  oldBits: PermissionResolvable | null | undefined,
  newBits: PermissionResolvable | null | undefined,
): { added: string[]; removed: string[] } {
  const before = new PermissionsBitField(oldBits ?? 0n);
  const after = new PermissionsBitField(newBits ?? 0n);
  return {
    added: after
      .toArray()
      .filter((p) => !before.has(p))
      .map(permissionName),
    removed: before
      .toArray()
      .filter((p) => !after.has(p))
      .map(permissionName),
  };
}
