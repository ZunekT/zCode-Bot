import type { SdkBot } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { UserError } from '../../core/errors.js';
import { prisma } from '../../db/prisma.js';
import { v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { createLogger } from '../../utils/logger.js';

// Współdzielenie bota w panelu: właściciel (klient, który go kupił) ma wszystko i nadaje dostęp innym.
// Osoba z uprawnieniem „access” też może zarządzać dostępem, ale tylko w granicach własnych uprawnień.

const log = createLogger('sdk:members');

export const BOT_PERMS = ['settings', 'commands', 'profile', 'access'] as const;
export type BotPerm = (typeof BOT_PERMS)[number];

export const PERM_LABELS: Record<BotPerm, string> = {
  settings: 'ustawienia serwerów',
  commands: 'uprawnienia komend',
  profile: 'profil bota',
  access: 'zarządzanie dostępem',
};

const MAX_MEMBERS = 25;
const SNOWFLAKE = /^\d{17,20}$/;

export class Forbidden extends UserError {}

export interface BotAccess {
  bot: SdkBot;
  owner: boolean;
  perms: BotPerm[];
}

const clean = (list: readonly string[]): BotPerm[] => BOT_PERMS.filter((p) => list.includes(p));

export async function botAccess(botId: number, userId: string): Promise<BotAccess> {
  const bot = Number.isSafeInteger(botId) ? await prisma.sdkBot.findUnique({ where: { id: botId } }) : null;
  // Brak bota i brak dostępu zwracają ten sam komunikat – nie zdradzamy, że bot istnieje.
  if (!bot) throw new UserError('Nie znaleziono bota.');
  if (bot.ownerId === userId) return { bot, owner: true, perms: [...BOT_PERMS] };
  const member = await prisma.sdkBotMember.findUnique({ where: { botId_userId: { botId, userId } } });
  if (!member) throw new UserError('Nie znaleziono bota.');
  return { bot, owner: false, perms: clean(member.permissions) };
}

export function requirePerm(a: BotAccess, perm: BotPerm): void {
  if (!a.perms.includes(perm)) throw new Forbidden(`Nie masz uprawnienia: ${PERM_LABELS[perm]}.`);
}

function parsePerms(input: unknown): BotPerm[] {
  if (!Array.isArray(input) || input.some((p) => typeof p !== 'string' || !BOT_PERMS.includes(p as BotPerm))) {
    throw new UserError('Nieprawidłowe uprawnienia.');
  }
  return clean(input as string[]);
}

// Zarządzający bez pełnych uprawnień nie może nadać ani odebrać czegoś, czego sam nie ma.
function assertWithin(a: BotAccess, perms: readonly BotPerm[]): void {
  const extra = perms.filter((p) => !a.perms.includes(p));
  if (extra.length) throw new Forbidden(`Nie możesz zarządzać uprawnieniem, którego sam nie masz: ${extra.map((p) => PERM_LABELS[p]).join(', ')}.`);
}

export async function listMembers(client: ZxClient, a: BotAccess) {
  const rows = await prisma.sdkBotMember.findMany({ where: { botId: a.bot.id }, orderBy: { createdAt: 'asc' } });
  const person = async (id: string) => {
    const u = await client.users.fetch(id).catch(() => null);
    return { id, name: u?.globalName ?? u?.username ?? id, avatar: u?.displayAvatarURL({ size: 64, extension: 'png' }) ?? null };
  };
  const [owner, members] = await Promise.all([
    person(a.bot.ownerId),
    Promise.all(
      rows.map(async (m) => ({ ...(await person(m.userId)), permissions: clean(m.permissions), addedBy: m.addedBy, createdAt: m.createdAt })),
    ),
  ]);
  return { owner, members, me: { owner: a.owner, perms: a.perms } };
}

export async function setMember(
  client: ZxClient,
  a: BotAccess,
  actorId: string,
  targetId: string,
  input: unknown,
): Promise<{ added: boolean; permissions: BotPerm[] }> {
  requirePerm(a, 'access');
  if (!SNOWFLAKE.test(targetId)) throw new UserError('Podaj poprawne ID Discord.');
  if (targetId === a.bot.ownerId) throw new UserError('To właściciel bota – ma pełny dostęp.');
  if (targetId === actorId) throw new UserError('Nie możesz zmieniać własnych uprawnień.');
  const permissions = parsePerms(input);
  assertWithin(a, permissions);

  const existing = await prisma.sdkBotMember.findUnique({ where: { botId_userId: { botId: a.bot.id, userId: targetId } } });
  if (existing) {
    assertWithin(a, clean(existing.permissions));
    await prisma.sdkBotMember.update({ where: { botId_userId: { botId: a.bot.id, userId: targetId } }, data: { permissions } });
    return { added: false, permissions };
  }

  const count = await prisma.sdkBotMember.count({ where: { botId: a.bot.id } });
  if (count >= MAX_MEMBERS) throw new UserError(`Bot może mieć maksymalnie ${MAX_MEMBERS} osób z dostępem.`);
  const user = await client.users.fetch(targetId).catch(() => null);
  if (!user) throw new UserError('Nie ma użytkownika Discord o takim ID.');
  if (user.bot) throw new UserError('Dostęp można dać tylko osobie, nie botowi.');
  await prisma.sdkBotMember.create({ data: { botId: a.bot.id, userId: targetId, permissions, addedBy: actorId } });

  const what = permissions.length ? permissions.map((p) => PERM_LABELS[p]).join(', ') : 'tylko podgląd';
  await user
    .send(
      v2Message(
        card({
          tone: 'success',
          emoji: 'bot',
          title: `Masz dostęp do bota ${a.bot.name}`,
          description: `Dostęp nadany przez <@${actorId}> w panelu zxcode.pl.\n-# Uprawnienia: ${what}. Bot jest w zakładce **Moje boty**.`,
        }),
      ),
    )
    .catch((err) => log.debug(`Nie wysłano DM do ${targetId}`, err));
  return { added: true, permissions };
}

export async function removeMember(a: BotAccess, actorId: string, targetId: string): Promise<void> {
  const existing = await prisma.sdkBotMember.findUnique({ where: { botId_userId: { botId: a.bot.id, userId: targetId } } });
  if (!existing) throw new UserError('Ta osoba nie ma dostępu do bota.');
  // Każdy może sam zrezygnować z dostępu; usuwanie innych wymaga „access” w granicach własnych uprawnień.
  if (targetId !== actorId) {
    requirePerm(a, 'access');
    assertWithin(a, clean(existing.permissions));
  }
  await prisma.sdkBotMember.delete({ where: { botId_userId: { botId: a.bot.id, userId: targetId } } });
}
