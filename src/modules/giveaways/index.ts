import { ChannelType, SlashCommandBuilder, type AutocompleteInteraction, type SlashCommandSubcommandBuilder } from 'discord.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { UserError } from '../../core/errors.js';
import { defineCommand, defineComponent, defineJob, defineModule } from '../../core/types.js';
import { button } from '../../ui/builders/buttons.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { discordTime, truncate } from '../../utils/format.js';
import { DURATION_HINT, parseDuration } from '../../utils/time.js';
import { canManage, finish, finishDue, giveawayPanel, queueRefresh, refreshMessage, reroll } from './service.js';

const MAX_ACTIVE = 15;
const MAX_LENGTH_MS = 60 * 86_400_000;

async function complete(i: AutocompleteInteraction<'cached'>) {
  const sub = i.options.getSubcommand();
  const ended = sub === 'reroll';
  const list = await prisma.giveaway.findMany({
    where: ended ? { ended: true, cancelled: false } : { ended: false, cancelled: false },
    orderBy: { id: 'desc' },
    take: 25,
  });
  const q = String(i.options.getFocused()).toLowerCase();
  return i.respond(
    list
      .filter((g) => !q || String(g.id).includes(q) || g.prize.toLowerCase().includes(q))
      .map((g) => ({ name: truncate(`#${g.id} · ${g.prize}`, 100), value: g.id })),
  );
}

const idOpt = (s: SlashCommandSubcommandBuilder) =>
  s.addIntegerOption((o) => o.setName('id').setDescription('Który giveaway').setRequired(true).setAutocomplete(true));

const giveawayCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Giveawaye: losowania nagród')
    .addSubcommand((s) =>
      s
        .setName('start')
        .setDescription('Rozpocznij giveaway')
        .addStringOption((o) => o.setName('nagroda').setDescription('Co jest do wygrania').setRequired(true).setMaxLength(200))
        .addStringOption((o) => o.setName('czas').setDescription(`Jak długo, np. ${DURATION_HINT}`).setRequired(true).setMaxLength(20))
        .addIntegerOption((o) => o.setName('zwyciezcy').setDescription('Ilu zwycięzców (domyślnie 1)').setMinValue(1).setMaxValue(20))
        .addStringOption((o) => o.setName('opis').setDescription('Dodatkowy opis').setMaxLength(1000))
        .addChannelOption((o) =>
          o.setName('kanal').setDescription('Gdzie opublikować (domyślnie ten kanał)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        )
        .addRoleOption((o) => o.setName('wymagana_rola').setDescription('Tylko osoby z tą rolą mogą wygrać'))
        .addIntegerOption((o) => o.setName('wiek_konta').setDescription('Minimalny wiek konta w dniach').setMinValue(0).setMaxValue(365)),
    )
    .addSubcommand((s) => idOpt(s.setName('zakoncz').setDescription('Zakończ teraz i wylosuj zwycięzców')))
    .addSubcommand((s) =>
      idOpt(s.setName('reroll').setDescription('Wylosuj dodatkowych zwycięzców')).addIntegerOption((o) =>
        o.setName('ile').setDescription('Ilu (domyślnie 1)').setMinValue(1).setMaxValue(20),
      ),
    )
    .addSubcommand((s) => idOpt(s.setName('anuluj').setDescription('Anuluj bez losowania')))
    .addSubcommand((s) => s.setName('lista').setDescription('Aktywne giveawaye')),
  cooldown: 3,
  autocomplete: complete,

  async run(i, { client, config }) {
    const sub = i.options.getSubcommand();
    if (!canManage(i.member, config)) throw new UserError('Giveawayami zarządza obsługa i rola organizatorów.');

    if (sub === 'lista') {
      const list = await prisma.giveaway.findMany({
        where: { ended: false, cancelled: false },
        orderBy: { endsAt: 'asc' },
        include: { _count: { select: { entries: true } } },
      });
      return i.reply(
        v2(
          card({
            tone: 'brand',
            emoji: 'gift',
            title: `Aktywne giveawaye (${list.length})`,
            description:
              list
                .map(
                  (g) =>
                    `**#${g.id}** ${truncate(g.prize, 80)} · <#${g.channelId}>\n-# koniec ${discordTime(g.endsAt, 'R')} · uczestnicy: ${g._count.entries} · zwycięzcy: ${g.winners}`,
                )
                .join('\n') || 'Brak aktywnych giveawayów. Utwórz: `/giveaway start`.',
            timestamp: false,
          }),
          { ephemeral: true },
        ),
      );
    }

    if (sub === 'start') {
      const ms = parseDuration(i.options.getString('czas', true));
      if (!ms) throw new UserError(`Nie rozumiem czasu. Przykłady: ${DURATION_HINT}`);
      if (ms < 60_000 || ms > MAX_LENGTH_MS) throw new UserError('Giveaway może trwać od 1 minuty do 60 dni.');
      const active = await prisma.giveaway.count({ where: { ended: false, cancelled: false } });
      if (active >= MAX_ACTIVE) throw new UserError(`Może trwać naraz maksymalnie ${MAX_ACTIVE} giveawayów.`);
      const target = i.options.getChannel('kanal') ?? i.channel;
      const channel = target ? await getSendableChannel(client, target.id) : null;
      if (!channel || !('messages' in channel)) throw new UserError('Nie mogę pisać na tym kanale.');

      const role = i.options.getRole('wymagana_rola');
      const g = await prisma.giveaway.create({
        data: {
          channelId: channel.id,
          hostId: i.user.id,
          prize: i.options.getString('nagroda', true),
          description: i.options.getString('opis'),
          winners: i.options.getInteger('zwyciezcy') ?? 1,
          endsAt: new Date(Date.now() + ms),
          requiredRoleId: role && role.id !== i.guild.id ? role.id : null,
          minAccountDays: i.options.getInteger('wiek_konta') ?? 0,
        },
      });
      const ping = config.giveawayPingRoleId;
      const message = await channel
        .send(v2Message(giveawayPanel(g, 0, ping), { allowedMentions: { roles: ping ? [ping] : [] } }))
        .catch(async () => {
          await prisma.giveaway.delete({ where: { id: g.id } });
          throw new UserError('Nie udało się opublikować giveawaya na tym kanale.');
        });
      await prisma.giveaway.update({ where: { id: g.id }, data: { messageId: message.id } });
      return i.reply(
        v2(
          card({
            tone: 'success',
            emoji: 'gift',
            title: `Giveaway #${g.id} wystartował`,
            description: `${message.url}\nKoniec ${discordTime(g.endsAt, 'R')}.`,
            timestamp: false,
          }),
          { ephemeral: true },
        ),
      );
    }

    const g = await prisma.giveaway.findUnique({ where: { id: i.options.getInteger('id', true) } });
    if (!g) throw new UserError('Nie ma takiego giveawaya.');

    if (sub === 'zakoncz') {
      if (g.ended || g.cancelled) throw new UserError('Ten giveaway już się zakończył.');
      await i.deferReply({ flags: ['Ephemeral'] });
      const done = await finish(client, g.id);
      return i.editReply(
        v2Message(
          card({
            tone: 'success',
            emoji: 'gift',
            title: `Giveaway #${g.id} zakończony`,
            description: done?.winnerIds.length ? `Wygrywa: ${done.winnerIds.map((id) => `<@${id}>`).join(', ')}` : 'Brak ważnych uczestników.',
            timestamp: false,
          }),
        ),
      );
    }

    if (sub === 'reroll') {
      if (!g.ended || g.cancelled) throw new UserError('Ponowne losowanie działa tylko dla zakończonych giveawayów.');
      await i.deferReply({ flags: ['Ephemeral'] });
      const winners = await reroll(client, g, i.options.getInteger('ile') ?? 1);
      return i.editReply(
        v2Message(
          card({
            tone: winners.length ? 'success' : 'warning',
            emoji: 'gift',
            title: 'Ponowne losowanie',
            description: winners.length ? `Nowi zwycięzcy: ${winners.map((id) => `<@${id}>`).join(', ')}` : 'Nie ma już innych uczestników spełniających warunki.',
            timestamp: false,
          }),
        ),
      );
    }

    if (g.ended || g.cancelled) throw new UserError('Ten giveaway już się zakończył.');
    await prisma.giveaway.update({ where: { id: g.id }, data: { cancelled: true } });
    await refreshMessage(client, g.id).catch(() => undefined);
    return i.reply(v2(card({ tone: 'success', emoji: 'gift', title: `Giveaway #${g.id} anulowany`, timestamp: false }), { ephemeral: true }));
  },
});

const join = defineComponent({
  id: 'giveaway:join',
  type: 'button',
  async run(i, [rawId], { client }) {
    const id = Number(rawId);
    const g = await prisma.giveaway.findUnique({ where: { id } });
    if (!g || g.ended || g.cancelled || g.endsAt <= new Date()) throw new UserError('Ten giveaway już się zakończył.');
    if (i.user.bot) throw new UserError('Boty nie biorą udziału.');
    if (g.requiredRoleId && !i.member.roles.cache.has(g.requiredRoleId))
      throw new UserError(`Udział wymaga roli <@&${g.requiredRoleId}>.`);
    if (g.minAccountDays > 0 && Date.now() - i.user.createdTimestamp < g.minAccountDays * 86_400_000)
      throw new UserError(`Udział wymaga konta starszego niż ${g.minAccountDays} dni.`);

    const created = await prisma.giveawayEntry
      .create({ data: { giveawayId: id, userId: i.user.id } })
      .then(() => true)
      .catch(() => false);
    if (!created) {
      return i.reply(
        v2(
          card({ tone: 'info', emoji: 'gift', title: 'Już bierzesz udział', description: `Losowanie ${discordTime(g.endsAt, 'R')}.`, timestamp: false }).buttons(
            button(`giveaway:leave:${id}`, 'Wypisz mnie', { style: 'danger', emoji: 'user_remove' }),
          ),
          { ephemeral: true },
        ),
      );
    }
    queueRefresh(client, id);
    return i.reply(
      v2(
        card({
          tone: 'success',
          emoji: 'gift',
          title: 'Zapisano do losowania',
          description: `**${truncate(g.prize, 200)}** · wyniki ${discordTime(g.endsAt, 'R')}. Powodzenia!`,
          timestamp: false,
        }),
        { ephemeral: true },
      ),
    );
  },
});

const leave = defineComponent({
  id: 'giveaway:leave',
  type: 'button',
  async run(i, [rawId], { client }) {
    const id = Number(rawId);
    const g = await prisma.giveaway.findUnique({ where: { id } });
    if (!g || g.ended || g.cancelled) throw new UserError('Ten giveaway już się zakończył.');
    await prisma.giveawayEntry.deleteMany({ where: { giveawayId: id, userId: i.user.id } });
    queueRefresh(client, id);
    return i.update(v2Message(card({ tone: 'neutral', emoji: 'user_remove', title: 'Wypisano z losowania', timestamp: false })));
  },
});

const info = defineComponent({
  id: 'giveaway:info',
  type: 'button',
  async run(i, [rawId]) {
    const id = Number(rawId);
    const g = await prisma.giveaway.findUnique({ where: { id } });
    if (!g) throw new UserError('Nie ma takiego giveawaya.');
    const [entries, mine] = await Promise.all([
      prisma.giveawayEntry.count({ where: { giveawayId: id } }),
      prisma.giveawayEntry.findUnique({ where: { giveawayId_userId: { giveawayId: id, userId: i.user.id } } }),
    ]);
    const chance = entries ? Math.min(100, (g.winners / entries) * 100) : 0;
    return i.reply(
      v2(
        card({
          tone: 'info',
          emoji: 'star',
          title: truncate(g.prize, 200),
          description: mine
            ? `Bierzesz udział. Uczestników: **${entries}**, szansa na wygraną ok. **${chance.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%**.`
            : `Uczestników: **${entries}**. Kliknij **Dołącz**, żeby wziąć udział.`,
          timestamp: false,
        }),
        { ephemeral: true },
      ),
    );
  },
});

export const giveawaysModule = defineModule({
  name: 'giveaways',
  description: 'Giveawaye z przyciskiem udziału, wymaganiami, automatycznym losowaniem i ponownym losowaniem',
  commands: [giveawayCommand],
  components: [join, leave, info],
  jobs: [defineJob({ name: 'giveaway-draw', intervalMs: 15_000, runOnStart: true, run: finishDue })],
});
