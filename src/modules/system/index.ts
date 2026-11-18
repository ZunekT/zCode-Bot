import { SlashCommandBuilder, version as djsVersion } from 'discord.js';
import { BOT_VERSION, BRAND_NAME } from '../../config/constants.js';
import { prisma } from '../../db/prisma.js';
import { redis } from '../../db/redis.js';
import { defineCommand, defineEvent, defineModule } from '../../core/types.js';
import { Panel } from '../../ui/builders/container.js';
import { v2 } from '../../ui/builders/payload.js';
import { discordTime, formatDuration } from '../../utils/format.js';

async function measure(fn: () => Promise<unknown>): Promise<string> {
  const start = performance.now();
  try {
    await fn();
    return `${Math.round(performance.now() - start)} ms`;
  } catch {
    return '❌ niedostępna';
  }
}

const ping = defineCommand({
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Stan bota: opóźnienie, baza, cache, uptime'),
  allowInMaintenance: true,
  cooldown: 5,
  async run(interaction, { client }) {
    const [db, cache] = await Promise.all([
      measure(() => prisma.$queryRaw`SELECT 1`),
      measure(() => redis.ping()),
    ]);
    const memory = Math.round(process.memoryUsage().rss / 1024 / 1024);

    const panel = new Panel({ tone: 'brand' })
      .title('bot', `${BRAND_NAME} Bot • Status`)
      .separator()
      .list([
        { emoji: 'lightning', label: 'Gateway:', value: `${client.ws.ping} ms` },
        { emoji: 'database', label: 'Baza danych:', value: db },
        { emoji: 'server', label: 'Redis:', value: cache },
        {
          emoji: 'calendar',
          label: 'Uptime:',
          value: formatDuration(Date.now() - client.startedAt.getTime()),
        },
        { emoji: 'desktop', label: 'Pamięć:', value: `${memory} MB` },
      ])
      .separator()
      .footer(`v${BOT_VERSION} • discord.js ${djsVersion} • start ${discordTime(client.startedAt, 'R')}`);

    return interaction.reply(v2(panel, { ephemeral: true }));
  },
});

export const systemModule = defineModule({
  name: 'system',
  description: 'Podstawowe komendy i stan bota',
  toggleable: false,
  commands: [ping],
  events: [
    defineEvent({
      event: 'clientReady',
      once: true,
      run(client) {
        client.log.info(`Zalogowano jako ${client.user?.tag}`);
      },
    }),
  ],
});
