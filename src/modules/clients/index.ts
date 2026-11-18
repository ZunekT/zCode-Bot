import { SlashCommandBuilder } from 'discord.js';
import { prisma } from '../../db/prisma.js';
import { isStaff } from '../../core/permissions.js';
import { defineCommand, defineModule } from '../../core/types.js';
import { v2 } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { e } from '../../ui/emojis.js';
import { discordTime, formatMoney, formatOrderId, truncate } from '../../utils/format.js';
import { ACTIVE_ORDER_STATUSES, LOYAL_CLIENT_ORDERS, ORDER_STATUSES } from '../orders/constants.js';
import { totalsOf } from '../orders/panels.js';
import { BADGES, type BadgeKey } from './service.js';

const profileCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Profil klienta zxCode')
    .addUserOption((o) => o.setName('uzytkownik').setDescription('Czyj profil (domyślnie Twój)')),
  cooldown: 5,

  async run(interaction, { config }) {
    const user = interaction.options.getUser('uzytkownik') ?? interaction.user;
    const self = user.id === interaction.user.id;
    const staff = isStaff(interaction.member, config);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const [orders, profile, reviews] = await Promise.all([
      prisma.order.findMany({
        where: { userId: user.id },
        include: { payments: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.clientProfile.findUnique({ where: { userId: user.id } }),
      prisma.review.findMany({ where: { userId: user.id, approved: true } }),
    ]);
    const completed = orders.filter((o) => o.status === 'COMPLETED');
    const active = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
    const spent = orders.reduce((s, o) => s + totalsOf(o).paid, 0);
    const badges = ((profile?.badges ?? []) as BadgeKey[]).filter((b) => b in BADGES);
    const toLoyal = Math.max(0, LOYAL_CLIENT_ORDERS - completed.length);

    const panel = card({
      tone: badges.includes('loyal') ? 'client' : 'brand',
      emoji: badges.includes('loyal') ? 'client_crown' : 'user',
      title: `Profil: ${member?.displayName ?? user.username}`,
      description: badges.length
        ? badges.map((b) => `${e(BADGES[b].emoji)} **${BADGES[b].label}**`).join('   ')
        : '-# Brak odznak – pierwsze zlecenie odblokuje odznakę Klienta',
      thumbnail: user.displayAvatarURL({ size: 256 }),
      fields: [
        { emoji: 'order_complete', label: 'Zakończone zlecenia', value: String(completed.length) },
        { emoji: 'code', label: 'W trakcie', value: String(active.length) },
        {
          emoji: 'star',
          label: 'Opinie',
          value: reviews.length
            ? `${reviews.length} (śr. ${(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)} / 5)`
            : null,
        },
        { emoji: 'money', label: 'Łącznie wpłacono', value: self || staff ? formatMoney(spent) : null },
        {
          emoji: 'calendar',
          label: 'Na serwerze od',
          value: member?.joinedAt ? discordTime(member.joinedAt, 'D') : null,
        },
        {
          emoji: 'client_crown',
          label: 'Do Stałego klienta',
          value:
            completed.length && toLoyal
              ? `jeszcze ${toLoyal} ${toLoyal === 1 ? 'zlecenie' : 'zlecenia'}`
              : null,
        },
      ],
      timestamp: false,
    });

    const visible = self || staff ? orders.slice(0, 5) : completed.slice(0, 5);
    if (visible.length) {
      panel
        .separator()
        .text(
          `### ${e('package')} ${self || staff ? 'Ostatnie zlecenia' : 'Zrealizowane projekty'}\n` +
            visible
              .map(
                (o) =>
                  `**${formatOrderId(o.id)}** \`${ORDER_STATUSES[o.status].label}\` ${truncate(o.title, 60)}`,
              )
              .join('\n'),
        );
    }
    return interaction.reply(v2(panel, { ephemeral: true }));
  },
});

export const clientsModule = defineModule({
  name: 'clients',
  description: 'Profile i role klientów',
  commands: [profileCommand],
});
