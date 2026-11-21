import { ChannelType, SlashCommandBuilder, type AutocompleteInteraction, type GuildMember } from 'discord.js';
import type { GuildConfig, Poll } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import { prisma } from '../../db/prisma.js';
import { getSendableChannel } from '../../core/channels.js';
import { UserError } from '../../core/errors.js';
import { isStaff } from '../../core/permissions.js';
import { defineCommand, defineComponent, defineJob, defineModule } from '../../core/types.js';
import { button } from '../../ui/builders/buttons.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card, quote } from '../../ui/components/card.js';
import { e } from '../../ui/emojis.js';
import { discordTime, truncate } from '../../utils/format.js';
import { createLogger } from '../../utils/logger.js';
import { cancelRefresh, scheduleRefresh } from '../../utils/refresh.js';
import { DURATION_HINT, parseDuration } from '../../utils/time.js';

const log = createLogger('polls');
const MAX_OPTIONS = 10;
const MAX_LENGTH_MS = 30 * 86_400_000;
const NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

function bar(ratio: number, size = 14): string {
  const filled = Math.round(ratio * size);
  return `${'█'.repeat(filled)}${'░'.repeat(size - filled)}`;
}

async function tally(poll: Poll) {
  const [grouped, voters] = await Promise.all([
    prisma.pollVote.groupBy({ by: ['option'], where: { pollId: poll.id }, _count: { _all: true } }),
    prisma.pollVote.findMany({ where: { pollId: poll.id }, distinct: ['userId'], select: { userId: true } }),
  ]);
  const counts = poll.options.map((_, idx) => grouped.find((g) => g.option === idx)?._count._all ?? 0);
  return { counts, voters: voters.length, votes: counts.reduce((a, b) => a + b, 0) };
}

export async function pollPanel(poll: Poll) {
  const { counts, voters, votes } = await tally(poll);
  const showResults = poll.ended || !poll.hideResults;
  const max = Math.max(0, ...counts);
  const lines = poll.options.map((opt, idx) => {
    const head = `**${NUMBERS[idx]}.** ${truncate(opt, 100)}`;
    if (!showResults) return head;
    const ratio = votes ? counts[idx]! / votes : 0;
    const lead = poll.ended && max > 0 && counts[idx] === max ? ` ${e('crown')}` : '';
    return `${head}${lead}\n\`${bar(ratio)}\` ${Math.round(ratio * 100)}% · ${counts[idx]}`;
  });
  const meta = [
    poll.multi ? 'można wybrać kilka odpowiedzi' : 'jedna odpowiedź',
    poll.hideResults && !poll.ended ? 'wyniki po zakończeniu' : null,
    poll.endsAt ? (poll.ended ? `zakończona ${discordTime(poll.endsAt, 'f')}` : `koniec ${discordTime(poll.endsAt, 'R')}`) : poll.ended ? 'zakończona' : null,
  ].filter(Boolean);
  const panel = card({
    tone: poll.ended ? 'neutral' : 'brand',
    emoji: 'checklist',
    title: truncate(poll.question, 250),
    description: meta.join(' · '),
    body: lines.join('\n'),
    footer: `Ankieta #${poll.id} · głosujących: ${voters} · autor <@${poll.authorId}>`,
    timestamp: false,
  });
  if (!poll.ended) {
    const buttons = poll.options.map((opt, idx) => button(`poll:vote:${poll.id}:${idx}`, truncate(`${NUMBERS[idx]}. ${opt}`, 80)));
    for (let k = 0; k < buttons.length; k += 5) panel.buttons(...buttons.slice(k, k + 5));
    panel.buttons(button(`poll:mine:${poll.id}`, 'Mój głos', { emoji: 'user' }));
  }
  return panel;
}

async function refresh(client: ZxClient, id: number): Promise<void> {
  const poll = await prisma.poll.findUnique({ where: { id } });
  if (!poll?.messageId) return;
  const channel = await getSendableChannel(client, poll.channelId);
  if (!channel || !('messages' in channel)) return;
  const message = await channel.messages.fetch(poll.messageId).catch(() => null);
  await message?.edit(v2Message(await pollPanel(poll)));
}

async function close(client: ZxClient, id: number): Promise<boolean> {
  const { count } = await prisma.poll.updateMany({ where: { id, ended: false }, data: { ended: true } });
  if (!count) return false;
  cancelRefresh(`poll:${id}`);
  await prisma.poll.updateMany({ where: { id, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, data: { endsAt: new Date() } });
  await refresh(client, id).catch((err) => log.warn(`Nie odświeżono ankiety #${id}`, err));
  return true;
}

const canCreate = (i: { member: GuildMember }, config: GuildConfig) =>
  config.pollsForEveryone || isStaff(i.member, config);

async function complete(i: AutocompleteInteraction<'cached'>) {
  const list = await prisma.poll.findMany({ where: { ended: false }, orderBy: { id: 'desc' }, take: 25 });
  const q = String(i.options.getFocused()).toLowerCase();
  return i.respond(
    list
      .filter((p) => !q || String(p.id).includes(q) || p.question.toLowerCase().includes(q))
      .map((p) => ({ name: truncate(`#${p.id} · ${p.question}`, 100), value: p.id })),
  );
}

const pollCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('ankieta')
    .setDescription('Ankiety z głosowaniem przyciskami')
    .addSubcommand((s) =>
      s
        .setName('utworz')
        .setDescription('Utwórz ankietę')
        .addStringOption((o) => o.setName('pytanie').setDescription('Pytanie').setRequired(true).setMaxLength(250))
        .addStringOption((o) =>
          o.setName('odpowiedzi').setDescription('Od 2 do 10 odpowiedzi oddzielonych średnikiem, np. Tak; Nie; Nie wiem').setRequired(true).setMaxLength(1000),
        )
        .addStringOption((o) => o.setName('czas').setDescription(`Jak długo, np. ${DURATION_HINT} (puste = do ręcznego zamknięcia)`).setMaxLength(20))
        .addBooleanOption((o) => o.setName('wielokrotny').setDescription('Można zaznaczyć kilka odpowiedzi'))
        .addBooleanOption((o) => o.setName('ukryj_wyniki').setDescription('Wyniki widoczne dopiero po zakończeniu'))
        .addChannelOption((o) =>
          o.setName('kanal').setDescription('Gdzie opublikować (domyślnie ten kanał)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('zakoncz')
        .setDescription('Zakończ ankietę')
        .addIntegerOption((o) => o.setName('id').setDescription('Która ankieta').setRequired(true).setAutocomplete(true)),
    ),
  cooldown: 5,
  autocomplete: complete,

  async run(i, { client, config }) {
    const sub = i.options.getSubcommand();
    if (sub === 'zakoncz') {
      const poll = await prisma.poll.findUnique({ where: { id: i.options.getInteger('id', true) } });
      if (!poll) throw new UserError('Nie ma takiej ankiety.');
      if (poll.authorId !== i.user.id && !isStaff(i.member, config)) throw new UserError('Ankietę może zakończyć autor albo obsługa.');
      if (!(await close(client, poll.id))) throw new UserError('Ta ankieta jest już zakończona.');
      return i.reply(v2(card({ tone: 'success', emoji: 'checklist', title: `Ankieta #${poll.id} zakończona`, timestamp: false }), { ephemeral: true }));
    }

    if (!canCreate(i, config)) throw new UserError('Ankiety tworzy obsługa serwera.');
    const options = [
      ...new Set(
        i.options
          .getString('odpowiedzi', true)
          .split(/[;|\n]/)
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ];
    if (options.length < 2 || options.length > MAX_OPTIONS) throw new UserError('Podaj od 2 do 10 różnych odpowiedzi oddzielonych średnikiem.');
    if (options.some((o) => o.length > 100)) throw new UserError('Odpowiedź może mieć maksymalnie 100 znaków.');

    const rawTime = i.options.getString('czas');
    const ms = rawTime ? parseDuration(rawTime) : null;
    if (rawTime && !ms) throw new UserError(`Nie rozumiem czasu. Przykłady: ${DURATION_HINT}`);
    if (ms && (ms < 60_000 || ms > MAX_LENGTH_MS)) throw new UserError('Ankieta może trwać od 1 minuty do 30 dni.');

    const target = i.options.getChannel('kanal') ?? i.channel;
    const channel = target ? await getSendableChannel(client, target.id) : null;
    if (!channel || !('messages' in channel)) throw new UserError('Nie mogę pisać na tym kanale.');
    if (target && target.id !== i.channelId && !isStaff(i.member, config)) throw new UserError('Na inny kanał może publikować tylko obsługa.');

    const poll = await prisma.poll.create({
      data: {
        channelId: channel.id,
        authorId: i.user.id,
        question: i.options.getString('pytanie', true),
        options,
        multi: i.options.getBoolean('wielokrotny') ?? false,
        hideResults: i.options.getBoolean('ukryj_wyniki') ?? false,
        endsAt: ms ? new Date(Date.now() + ms) : null,
      },
    });
    const message = await channel.send(v2Message(await pollPanel(poll))).catch(async () => {
      await prisma.poll.delete({ where: { id: poll.id } });
      throw new UserError('Nie udało się opublikować ankiety na tym kanale.');
    });
    await prisma.poll.update({ where: { id: poll.id }, data: { messageId: message.id } });
    return i.reply(v2(card({ tone: 'success', emoji: 'checklist', title: `Ankieta #${poll.id} opublikowana`, description: message.url, timestamp: false }), { ephemeral: true }));
  },
});

const vote = defineComponent({
  id: 'poll:vote',
  type: 'button',
  async run(i, [rawId, rawOpt], { client }) {
    const id = Number(rawId);
    const option = Number(rawOpt);
    const poll = await prisma.poll.findUnique({ where: { id } });
    if (!poll || poll.ended || (poll.endsAt && poll.endsAt <= new Date())) throw new UserError('Ta ankieta jest już zakończona.');
    if (!Number.isInteger(option) || option < 0 || option >= poll.options.length) throw new UserError('Nieznana odpowiedź.');

    const key = { pollId_userId_option: { pollId: id, userId: i.user.id, option } };
    const existing = await prisma.pollVote.findUnique({ where: key });
    let text: string;
    if (existing) {
      await prisma.pollVote.delete({ where: key });
      text = `Cofnięto głos na **${truncate(poll.options[option]!, 100)}**.`;
    } else {
      await prisma.$transaction([
        ...(poll.multi ? [] : [prisma.pollVote.deleteMany({ where: { pollId: id, userId: i.user.id } })]),
        prisma.pollVote.create({ data: { pollId: id, userId: i.user.id, option } }),
      ]);
      text = `Głos oddany na **${truncate(poll.options[option]!, 100)}**.${poll.multi ? '' : ' Kliknij inną odpowiedź, żeby zmienić zdanie.'}`;
    }
    scheduleRefresh(`poll:${id}`, () => refresh(client, id));
    return i.reply(v2(card({ tone: existing ? 'neutral' : 'success', emoji: 'checklist', title: truncate(poll.question, 200), description: quote(text), timestamp: false }), { ephemeral: true }));
  },
});

const mine = defineComponent({
  id: 'poll:mine',
  type: 'button',
  async run(i, [rawId]) {
    const id = Number(rawId);
    const poll = await prisma.poll.findUnique({ where: { id } });
    if (!poll) throw new UserError('Nie ma takiej ankiety.');
    const votes = await prisma.pollVote.findMany({ where: { pollId: id, userId: i.user.id }, orderBy: { option: 'asc' } });
    return i.reply(
      v2(
        card({
          tone: 'info',
          emoji: 'user',
          title: 'Twój głos',
          description: votes.length ? votes.map((v) => `**${NUMBERS[v.option]}.** ${truncate(poll.options[v.option] ?? '?', 100)}`).join('\n') : 'Nie oddano jeszcze głosu.',
          timestamp: false,
        }),
        { ephemeral: true },
      ),
    );
  },
});

async function closeDue(client: ZxClient): Promise<void> {
  const due = await prisma.poll.findMany({ where: { ended: false, endsAt: { lte: new Date() } }, select: { id: true }, take: 20 });
  for (const { id } of due) await close(client, id).catch((err) => log.error(`Ankieta #${id}`, err));
}

export const pollsModule = defineModule({
  name: 'polls',
  description: 'Ankiety z głosowaniem przyciskami, wynikami na żywo lub po zakończeniu i automatycznym zamykaniem',
  commands: [pollCommand],
  components: [vote, mine],
  jobs: [defineJob({ name: 'poll-close', intervalMs: 30_000, runOnStart: true, run: closeDue })],
});
