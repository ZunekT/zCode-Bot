import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js';
import type { ModAction } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { UserError } from '../../core/errors.js';
import { defineComponent, defineEvent, defineJob, defineModule, type UserContextCommand } from '../../core/types.js';
import { button } from '../../ui/builders/buttons.js';
import { Form } from '../../ui/builders/modal.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { discordTime, truncate } from '../../utils/format.js';
import { DURATION_HINT, parseDuration } from '../../utils/time.js';
import { historyPanel, punishCommands } from './commands.js';
import { ACTIONS, activeWarns, canBan, expireTempbans, punish, resultText } from './service.js';
import { toolCommands } from './tools.js';

const QUICK: ModAction[] = ['WARN', 'TIMEOUT', 'KICK', 'BAN'];

const moderate: UserContextCommand = {
  kind: 'user',
  data: new ContextMenuCommandBuilder().setName('Moderuj').setType(ApplicationCommandType.User),
  access: 'staff',
  async run(i, { config }) {
    const user = i.targetUser;
    const member = i.targetMember;
    const [warns, last] = await Promise.all([
      activeWarns(user.id, config),
      prisma.modCase.findMany({ where: { userId: user.id }, orderBy: { id: 'desc' }, take: 3 }),
    ]);
    const ban = canBan(i.member, config);
    const panel = card({
      tone: 'brand',
      emoji: 'shield_check',
      title: `Moderacja · ${user.username}`,
      thumbnail: user.displayAvatarURL({ size: 128 }),
      description: `<@${user.id}> · \`${user.id}\``,
      fields: [
        { emoji: 'calendar', label: 'Konto', value: discordTime(user.createdAt, 'R') },
        { emoji: 'user_add', label: 'Na serwerze od', value: member?.joinedAt ? discordTime(member.joinedAt, 'R') : 'nie ma na serwerze' },
        { emoji: 'notification', label: 'Aktywne ostrzeżenia', value: String(warns) },
        {
          emoji: 'lock',
          label: 'Wyciszony(-a) do',
          value: member?.isCommunicationDisabled() ? discordTime(member.communicationDisabledUntil, 'R') : null,
        },
        {
          emoji: 'documentation',
          label: 'Ostatnie sprawy',
          value: last.length
            ? last.map((c) => `#${c.id} ${ACTIONS[c.action].label} ${discordTime(c.createdAt, 'R')}`).join(' · ')
            : 'brak',
        },
      ],
      timestamp: false,
    }).buttons(
      ...QUICK.map((a) =>
        button(`mod:act:${a}:${user.id}`, ACTIONS[a].label, {
          emoji: ACTIONS[a].emoji,
          style: a === 'BAN' || a === 'KICK' ? 'danger' : 'secondary',
          disabled: (a === 'BAN' && !ban) || (a !== 'BAN' && !member),
        }),
      ),
      button(`mod:history:${user.id}`, 'Historia', { emoji: 'documentation' }),
    );
    if (member?.isCommunicationDisabled())
      panel.buttons(button(`mod:act:UNTIMEOUT:${user.id}`, 'Zdejmij wyciszenie', { emoji: 'unlock', style: 'success' }));
    return i.reply(v2(panel, { ephemeral: true }));
  },
};

const actButton = defineComponent({
  id: 'mod:act',
  type: 'button',
  access: 'staff',
  async run(i, [action, userId]) {
    if (!action || !(action in ACTIONS) || !userId) throw new UserError('Nieznana akcja.');
    const a = action as ModAction;
    const form = new Form(`mod:modal:${a}:${userId}`, `${ACTIONS[a].label}`);
    if (a === 'TIMEOUT' || a === 'BAN')
      form.text({
        id: 'czas',
        label: a === 'BAN' ? 'Czas bana (puste = na stałe)' : 'Czas wyciszenia',
        placeholder: DURATION_HINT,
        required: a === 'TIMEOUT',
        max: 20,
      });
    form.text({ id: 'powod', label: 'Powód', paragraph: true, required: false, max: 1000, placeholder: 'Zobaczy go ukarana osoba' });
    return i.showModal(form.build());
  },
});

const actModal = defineComponent({
  id: 'mod:modal',
  type: 'modal',
  access: 'staff',
  async run(i, [action, userId], ctx) {
    if (!i.inCachedGuild() || !action || !(action in ACTIONS) || !userId) throw new UserError('Nieznana akcja.');
    const a = action as ModAction;
    const rawTime = a === 'TIMEOUT' || a === 'BAN' ? i.fields.getTextInputValue('czas').trim() : '';
    const durationMs = rawTime ? parseDuration(rawTime) : null;
    if (rawTime && !durationMs) throw new UserError(`Nie rozumiem czasu „${truncate(rawTime, 30)}”. Przykłady: ${DURATION_HINT}`);
    const user = await ctx.client.users.fetch(userId).catch(() => null);
    if (!user) throw new UserError('Nie znaleziono użytkownika.');
    await i.deferReply({ flags: ['Ephemeral'] });
    const result = await punish({
      client: ctx.client,
      config: ctx.config,
      guild: i.guild,
      actor: i.member,
      user,
      action: a,
      reason: i.fields.getTextInputValue('powod'),
      durationMs,
    });
    return i.editReply(
      v2Message(card({ tone: ACTIONS[a].tone, emoji: ACTIONS[a].emoji, title: ACTIONS[a].label, description: resultText(result, user), timestamp: false })),
    );
  },
});

const historyButton = defineComponent({
  id: 'mod:history',
  type: 'button',
  access: 'staff',
  async run(i, [userId], ctx) {
    if (!userId) throw new UserError('Brak użytkownika.');
    return i.reply(v2(await historyPanel(userId, ctx), { ephemeral: true }));
  },
});

export const moderationModule = defineModule({
  name: 'moderation',
  description: 'Bany, kicki, wyciszenia, ostrzeżenia z automatycznymi karami, historia spraw i narzędzia kanałów',
  commands: [...punishCommands, ...toolCommands, moderate],
  components: [actButton, actModal, historyButton],
  events: [
    defineEvent({
      event: 'guildBanRemove',
      async run(_client, ban) {
        if (ban.guild.id !== env.GUILD_ID) return;
        await prisma.modCase.updateMany({ where: { userId: ban.user.id, action: 'BAN', active: true }, data: { active: false } });
      },
    }),
  ],
  jobs: [defineJob({ name: 'tempban-expiry', intervalMs: 60_000, runOnStart: true, run: expireTempbans })],
});
