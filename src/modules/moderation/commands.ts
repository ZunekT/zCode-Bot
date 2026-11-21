import { SlashCommandBuilder, type ChatInputCommandInteraction, type SlashCommandOptionsOnlyBuilder, type User } from 'discord.js';
import type { ModAction } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { UserError } from '../../core/errors.js';
import { defineCommand, type Context } from '../../core/types.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { discordTime, truncate } from '../../utils/format.js';
import { DURATION_HINT, parseDuration } from '../../utils/time.js';
import { ACTIONS, activeWarns, caseCard, caseLine, logCase, punish, resultText } from './service.js';

const DELETE_CHOICES = [
  { name: 'Nie usuwaj', value: 0 },
  { name: 'Ostatnia godzina', value: 3_600 },
  { name: 'Ostatnie 24 godziny', value: 86_400 },
  { name: 'Ostatnie 3 dni', value: 259_200 },
  { name: 'Ostatnie 7 dni', value: 604_800 },
];

type Builder = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
const userOpt = (b: Builder, description = 'Kogo dotyczy') =>
  b.addUserOption((o) => o.setName('uzytkownik').setDescription(description).setRequired(true));
const reasonOpt = (b: Builder) =>
  b.addStringOption((o) => o.setName('powod').setDescription('Powód (zobaczy go ukarana osoba)').setMaxLength(1000));

function durationFrom(i: ChatInputCommandInteraction<'cached'>, required: boolean): number | null {
  const raw = i.options.getString('czas', required);
  if (!raw) return null;
  const ms = parseDuration(raw);
  if (!ms) throw new UserError(`Nie rozumiem czasu „${truncate(raw, 30)}”. Przykłady: ${DURATION_HINT}`);
  return ms;
}

async function run(
  i: ChatInputCommandInteraction<'cached'>,
  ctx: Context,
  action: ModAction,
  opts: { user?: User; durationMs?: number | null; deleteSeconds?: number } = {},
) {
  const user = opts.user ?? i.options.getUser('uzytkownik', true);
  await i.deferReply();
  const result = await punish({
    client: ctx.client,
    config: ctx.config,
    guild: i.guild,
    actor: i.member,
    user,
    action,
    reason: i.options.getString('powod'),
    durationMs: opts.durationMs,
    deleteSeconds: opts.deleteSeconds,
  });
  return i.editReply(
    v2Message(
      card({
        tone: ACTIONS[action].tone,
        emoji: ACTIONS[action].emoji,
        title: ACTIONS[action].label,
        description: resultText(result, user),
        timestamp: false,
      }),
    ),
  );
}

const ban = defineCommand({
  data: reasonOpt(
    userOpt(new SlashCommandBuilder().setName('ban').setDescription('Zbanuj (na stałe albo na czas)'), 'Kogo zbanować (możesz wkleić ID)'),
  )
    .addStringOption((o) => o.setName('czas').setDescription(`Ban czasowy, np. ${DURATION_HINT} (puste = na stałe)`).setMaxLength(20))
    .addIntegerOption((o) =>
      o.setName('usun_wiadomosci').setDescription('Usunąć wiadomości tej osoby z ostatniego…').addChoices(...DELETE_CHOICES),
    ),
  access: 'staff',
  run: (i, ctx) =>
    run(i, ctx, 'BAN', { durationMs: durationFrom(i, false), deleteSeconds: i.options.getInteger('usun_wiadomosci') ?? 0 }),
});

const softban = defineCommand({
  data: reasonOpt(
    userOpt(new SlashCommandBuilder().setName('softban').setDescription('Wyrzuć i usuń wiadomości (ban + natychmiastowe odbanowanie)')),
  ).addIntegerOption((o) =>
    o.setName('usun_wiadomosci').setDescription('Z jakiego okresu usunąć wiadomości (domyślnie 24 h)').addChoices(...DELETE_CHOICES.slice(1)),
  ),
  access: 'staff',
  run: (i, ctx) => run(i, ctx, 'SOFTBAN', { deleteSeconds: i.options.getInteger('usun_wiadomosci') ?? 86_400 }),
});

const unban = defineCommand({
  data: reasonOpt(userOpt(new SlashCommandBuilder().setName('unban').setDescription('Zdejmij bana'), 'Kogo odbanować (wklej ID)')),
  access: 'staff',
  run: (i, ctx) => run(i, ctx, 'UNBAN'),
});

const kick = defineCommand({
  data: reasonOpt(userOpt(new SlashCommandBuilder().setName('kick').setDescription('Wyrzuć z serwera'))),
  access: 'staff',
  run: (i, ctx) => run(i, ctx, 'KICK'),
});

const timeout = defineCommand({
  data: reasonOpt(
    userOpt(new SlashCommandBuilder().setName('timeout').setDescription('Wycisz (maks. 28 dni)')).addStringOption((o) =>
      o.setName('czas').setDescription(`Na ile, np. ${DURATION_HINT}`).setRequired(true).setMaxLength(20),
    ),
  ),
  access: 'staff',
  run: (i, ctx) => run(i, ctx, 'TIMEOUT', { durationMs: durationFrom(i, true) }),
});

const untimeout = defineCommand({
  data: reasonOpt(userOpt(new SlashCommandBuilder().setName('untimeout').setDescription('Zdejmij wyciszenie'))),
  access: 'staff',
  run: (i, ctx) => run(i, ctx, 'UNTIMEOUT'),
});

const warn = defineCommand({
  data: reasonOpt(userOpt(new SlashCommandBuilder().setName('warn').setDescription('Daj ostrzeżenie'))),
  access: 'staff',
  run: (i, ctx) => run(i, ctx, 'WARN'),
});

export async function historyPanel(userId: string, ctx: Context) {
  const [cases, warns, user] = await Promise.all([
    prisma.modCase.findMany({ where: { userId }, orderBy: { id: 'desc' }, take: 15 }),
    activeWarns(userId, ctx.config),
    ctx.client.users.fetch(userId).catch(() => null),
  ]);
  const total = await prisma.modCase.count({ where: { userId } });
  const limits = [
    ctx.config.warnTimeoutAt > 0 && `wyciszenie przy ${ctx.config.warnTimeoutAt}`,
    ctx.config.warnKickAt > 0 && `kick przy ${ctx.config.warnKickAt}`,
    ctx.config.warnBanAt > 0 && `ban przy ${ctx.config.warnBanAt}`,
  ].filter(Boolean);
  return card({
    tone: 'brand',
    emoji: 'documentation',
    title: `Historia · ${user?.username ?? userId}`,
    thumbnail: user?.displayAvatarURL({ size: 128 }),
    description: [
      `<@${userId}> · \`${userId}\``,
      user && `Konto założone ${discordTime(user.createdAt, 'R')}`,
      `Aktywne ostrzeżenia: **${warns}**${ctx.config.warnExpireDays > 0 ? ` (z ${ctx.config.warnExpireDays} dni)` : ''}${limits.length ? ` · ${limits.join(', ')}` : ''}`,
    ]
      .filter(Boolean)
      .join('\n'),
    body: cases.length
      ? `${cases.map(caseLine).join('\n')}${total > cases.length ? `\n-# Pokazano ${cases.length} z ${total} spraw.` : ''}`
      : 'Czysta karta – brak spraw.',
    timestamp: false,
  });
}

const history = defineCommand({
  data: userOpt(new SlashCommandBuilder().setName('historia').setDescription('Historia moderacji użytkownika'), 'Czyja historia (możesz wkleić ID)'),
  access: 'staff',
  async run(i, ctx) {
    const user = i.options.getUser('uzytkownik', true);
    return i.reply(v2(await historyPanel(user.id, ctx), { ephemeral: true }));
  },
});

async function findCase(id: number) {
  const c = await prisma.modCase.findUnique({ where: { id } });
  if (!c) throw new UserError(`Nie ma sprawy #${id}.`);
  return c;
}

const caseCmd = defineCommand({
  data: new SlashCommandBuilder()
    .setName('sprawa')
    .setDescription('Sprawy moderacyjne')
    .addSubcommand((s) =>
      s.setName('pokaz').setDescription('Pokaż sprawę').addIntegerOption((o) => o.setName('numer').setDescription('Numer sprawy').setRequired(true).setMinValue(1)),
    )
    .addSubcommand((s) =>
      s
        .setName('powod')
        .setDescription('Zmień powód w sprawie')
        .addIntegerOption((o) => o.setName('numer').setDescription('Numer sprawy').setRequired(true).setMinValue(1))
        .addStringOption((o) => o.setName('powod').setDescription('Nowy powód').setRequired(true).setMaxLength(1000)),
    )
    .addSubcommand((s) =>
      s
        .setName('cofnij')
        .setDescription('Cofnij ostrzeżenie lub notatkę (nie liczy się do automatycznych kar)')
        .addIntegerOption((o) => o.setName('numer').setDescription('Numer sprawy').setRequired(true).setMinValue(1))
        .addStringOption((o) => o.setName('powod').setDescription('Dlaczego cofasz').setMaxLength(500)),
    )
    .addSubcommand((s) =>
      s
        .setName('notatka')
        .setDescription('Dodaj notatkę o użytkowniku (widzi ją tylko obsługa)')
        .addUserOption((o) => o.setName('uzytkownik').setDescription('Kogo dotyczy').setRequired(true))
        .addStringOption((o) => o.setName('tresc').setDescription('Treść notatki').setRequired(true).setMaxLength(1000)),
    ),
  access: 'staff',
  async run(i, ctx) {
    const sub = i.options.getSubcommand();
    if (sub === 'notatka') {
      const user = i.options.getUser('uzytkownik', true);
      const r = await punish({
        client: ctx.client,
        config: ctx.config,
        guild: i.guild,
        actor: i.member,
        user,
        action: 'NOTE',
        reason: i.options.getString('tresc', true),
      });
      return i.reply(v2(caseCard(r.case, { title: `Notatka dodana · sprawa #${r.case.id}` }), { ephemeral: true }));
    }

    const c = await findCase(i.options.getInteger('numer', true));
    if (sub === 'pokaz') return i.reply(v2(caseCard(c), { ephemeral: true }));

    if (sub === 'powod') {
      if (c.revokedAt) throw new UserError('Ta sprawa jest cofnięta.');
      const updated = await prisma.modCase.update({ where: { id: c.id }, data: { reason: i.options.getString('powod', true) } });
      if (updated.action !== 'NOTE') await logCase(ctx.client, updated, `Sprawa #${c.id} · zmieniony powód`);
      return i.reply(v2(caseCard(updated, { title: `Zmieniono powód · sprawa #${c.id}` }), { ephemeral: true }));
    }

    if (c.action !== 'WARN' && c.action !== 'NOTE')
      throw new UserError(
        c.action === 'BAN'
          ? 'Bana nie da się cofnąć tą komendą – użyj `/unban`.'
          : c.action === 'TIMEOUT'
            ? 'Wyciszenie zdejmiesz komendą `/untimeout`.'
            : 'Cofnąć można tylko ostrzeżenia i notatki.',
      );
    if (c.revokedAt) throw new UserError('Ta sprawa jest już cofnięta.');
    const updated = await prisma.modCase.update({
      where: { id: c.id },
      data: { active: false, revokedAt: new Date(), revokedById: i.user.id, revokeReason: i.options.getString('powod') },
    });
    if (updated.action === 'WARN') await logCase(ctx.client, updated, `Sprawa #${c.id} · cofnięte ostrzeżenie`);
    return i.reply(v2(caseCard(updated), { ephemeral: true }));
  },
});

export const punishCommands = [ban, softban, unban, kick, timeout, untimeout, warn, history, caseCmd];
