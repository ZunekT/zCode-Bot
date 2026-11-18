import { ChannelType, SlashCommandBuilder, type AutocompleteInteraction } from 'discord.js';
import { prisma } from '../../db/prisma.js';
import { redis } from '../../db/redis.js';
import { audit } from '../../core/audit.js';
import { UserError } from '../../core/errors.js';
import { isAdmin } from '../../core/permissions.js';
import { defineCommand, defineComponent, defineModule } from '../../core/types.js';
import { bannerFile } from '../../ui/assets.js';
import { Form } from '../../ui/builders/modal.js';
import { v2, v2Message } from '../../ui/builders/payload.js';
import { card } from '../../ui/components/card.js';
import { discordTime, formatMoney, parseMoney, slugify, truncate } from '../../utils/format.js';
import { reviewStats } from '../reviews/service.js';
import { ticketForm } from '../tickets/forms.js';
import { assertCanOpen } from '../tickets/services/create.js';
import { discountLabel, findValidDiscount, normalizeCode } from './discounts.js';
import { calcOrderDescription, calculatorPanel, pricingPanel, type CalcState } from './panels.js';

const calcKey = (userId: string) => `zx:calc:${userId}`;

async function loadState(userId: string): Promise<CalcState> {
  const raw = await redis.get(calcKey(userId));
  return raw ? (JSON.parse(raw) as CalcState) : { items: [] };
}
const saveState = (userId: string, state: CalcState) =>
  redis.set(calcKey(userId), JSON.stringify(state), 'EX', 3600);

async function calcData(state: CalcState) {
  const items = await prisma.pricingItem.findMany({ where: { active: true }, orderBy: { price: 'asc' } });
  const dc = state.code ? await findValidDiscount(state.code).catch(() => null) : null;
  return { items, dc };
}

const packages = () => prisma.pricingPackage.findMany({ orderBy: [{ position: 'asc' }, { price: 'asc' }] });

async function nameAutocomplete(interaction: AutocompleteInteraction) {
  const group = interaction.options.getSubcommandGroup();
  const q = interaction.options.getFocused().toLowerCase();
  if (group === 'pakiet') {
    const rows = await prisma.pricingPackage.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      take: 25,
    });
    return interaction.respond(
      rows.map((r) => ({ name: `${r.name} – ${formatMoney(Number(r.price))}`, value: String(r.id) })),
    );
  }
  if (group === 'pozycja') {
    const rows = await prisma.pricingItem.findMany({
      where: { label: { contains: q, mode: 'insensitive' } },
      take: 25,
    });
    return interaction.respond(
      rows.map((r) => ({
        name: truncate(`${r.label} – ${formatMoney(Number(r.price))}`, 100),
        value: r.key,
      })),
    );
  }
  const rows = await prisma.discountCode.findMany({
    where: { code: { contains: q.toUpperCase() } },
    take: 25,
  });
  return interaction.respond(rows.map((r) => ({ name: `${r.code} (${discountLabel(r)})`, value: r.code })));
}

async function seedDefaults(): Promise<{ packages: number; items: number }> {
  const pkgs = [
    {
      name: 'Start',
      price: 99,
      description: 'Prosty bot z kilkoma komendami – idealny na początek.',
      features: ['Do 5 komend slash', 'Embedy i Components v2', 'Hosting – instrukcja', '7 dni poprawek'],
    },
    {
      name: 'Pro',
      price: 299,
      description: 'Najczęściej wybierany: bot z systemami dla Twojego serwera.',
      features: [
        'Tickety lub weryfikacja',
        'Baza danych',
        'Panel konfiguracji',
        'Logi serwera',
        '30 dni wsparcia',
      ],
    },
    {
      name: 'Premium',
      price: 699,
      description: 'Rozbudowany bot szyty na miarę + integracje.',
      features: [
        'Dowolne moduły',
        'Integracje (API, płatności, WWW)',
        'Dashboard',
        'Priorytetowe wsparcie 90 dni',
      ],
    },
  ];
  const items = [
    {
      key: 'tickety',
      label: 'System ticketów',
      price: 80,
      description: 'Panel, kategorie, transkrypty',
    },
    {
      key: 'weryfikacja',
      label: 'Weryfikacja + captcha',
      price: 50,
      description: 'Ochrona przed botami i rajdami',
    },
    {
      key: 'logi',
      label: 'Logi serwera',
      price: 60,
      description: 'Wiadomości, członkowie, moderacja',
    },
    {
      key: 'ekonomia',
      label: 'Ekonomia i sklep',
      price: 120,
      description: 'Waluta, sklep, ranking',
    },
    {
      key: 'poziomy',
      label: 'Poziomy i XP',
      price: 70,
      description: 'Levele, role za poziomy, karty',
    },
    {
      key: 'moderacja',
      label: 'Moderacja',
      price: 60,
      description: 'Warny, wyciszenia, automod',
    },
    {
      key: 'muzyka',
      label: 'Muzyka',
      price: 90,
      description: 'Odtwarzanie, kolejka, playlisty',
    },
    {
      key: 'dashboard',
      label: 'Panel WWW (dashboard)',
      price: 250,
      description: 'Konfiguracja bota przez stronę',
    },
  ];
  let p = 0;
  let i = 0;
  for (const [idx, pkg] of pkgs.entries()) {
    const r = await prisma.pricingPackage.upsert({
      where: { name: pkg.name },
      create: { ...pkg, position: idx },
      update: {},
    });
    if (r) p++;
  }
  for (const item of items) {
    await prisma.pricingItem.upsert({ where: { key: item.key }, create: item, update: {} });
    i++;
  }
  return { packages: p, items: i };
}

const pricingCommand = defineCommand({
  data: new SlashCommandBuilder()
    .setName('cennik')
    .setDescription('Cennik i wycena botów')
    .addSubcommand((s) => s.setName('pokaz').setDescription('Pokaż cennik'))
    .addSubcommand((s) => s.setName('kalkulator').setDescription('Oblicz szacunkową cenę bota'))
    .addSubcommand((s) =>
      s
        .setName('panel')
        .setDescription('[Admin] Wyślij panel cennika')
        .addChannelOption((o) =>
          o
            .setName('kanal')
            .setDescription('Gdzie wysłać (domyślnie tutaj)')
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((s) =>
      s.setName('domyslne').setDescription('[Admin] Dodaj przykładowe pakiety i pozycje (do edycji)'),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('pakiet')
        .setDescription('[Admin] Pakiety')
        .addSubcommand((s) =>
          s.setName('dodaj').setDescription('Dodaj lub edytuj pakiet (ta sama nazwa = edycja)'),
        )
        .addSubcommand((s) =>
          s
            .setName('usun')
            .setDescription('Usuń pakiet')
            .addStringOption((o) =>
              o.setName('nazwa').setDescription('Pakiet').setRequired(true).setAutocomplete(true),
            ),
        ),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('pozycja')
        .setDescription('[Admin] Pozycje kalkulatora')
        .addSubcommand((s) =>
          s.setName('dodaj').setDescription('Dodaj lub edytuj pozycję (ta sama nazwa = edycja)'),
        )
        .addSubcommand((s) =>
          s
            .setName('usun')
            .setDescription('Usuń pozycję')
            .addStringOption((o) =>
              o.setName('nazwa').setDescription('Pozycja').setRequired(true).setAutocomplete(true),
            ),
        ),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('rabat')
        .setDescription('[Admin] Kody rabatowe')
        .addSubcommand((s) =>
          s
            .setName('dodaj')
            .setDescription('Nowy kod rabatowy')
            .addStringOption((o) =>
              o.setName('kod').setDescription('np. START10').setRequired(true).setMaxLength(30),
            )
            .addIntegerOption((o) =>
              o.setName('procent').setDescription('Rabat w %').setMinValue(1).setMaxValue(100),
            )
            .addStringOption((o) => o.setName('kwota').setDescription('Rabat kwotowy w zł'))
            .addIntegerOption((o) => o.setName('limit').setDescription('Ile razy można użyć').setMinValue(1))
            .addIntegerOption((o) =>
              o.setName('dni').setDescription('Ważny przez tyle dni').setMinValue(1).setMaxValue(365),
            ),
        )
        .addSubcommand((s) => s.setName('lista').setDescription('Lista kodów'))
        .addSubcommand((s) =>
          s
            .setName('usun')
            .setDescription('Usuń kod')
            .addStringOption((o) =>
              o.setName('nazwa').setDescription('Kod').setRequired(true).setAutocomplete(true),
            ),
        ),
    ),
  autocomplete: nameAutocomplete,

  async run(interaction, { client, config }) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();

    if (!group && sub === 'pokaz') {
      return interaction.reply(
        v2(pricingPanel(await packages(), await reviewStats(), false), { ephemeral: true }),
      );
    }
    if (!group && sub === 'kalkulator') {
      const state = await loadState(interaction.user.id);
      const { items, dc } = await calcData(state);
      return interaction.reply(v2(calculatorPanel(items, state, dc), { ephemeral: true }));
    }

    if (!isAdmin(interaction.member, config))
      throw new UserError('Zarządzanie cennikiem jest dostępne tylko dla administracji.', 'Brak uprawnień');
    const actorId = interaction.user.id;

    if (!group) {
      if (sub === 'panel') {
        const target =
          interaction.options.getChannel('kanal', false, [ChannelType.GuildText]) ?? interaction.channel;
        if (!target?.isSendable()) throw new UserError('Nie mogę pisać na tym kanale.');
        const msg = await target.send(
          v2Message(pricingPanel(await packages(), await reviewStats(), true), { files: [bannerFile()] }),
        );
        await audit(client, {
          action: 'pricing.panel',
          actorId,
          targetId: msg.channelId,
          summary: `Panel cennika wysłany na <#${msg.channelId}>`,
        });
        return interaction.reply(
          v2(
            card({
              tone: 'success',
              title: 'Panel cennika wysłany',
              description: `<#${msg.channelId}>`,
              timestamp: false,
            }),
            { ephemeral: true },
          ),
        );
      }
      const r = await seedDefaults();
      await audit(client, { action: 'pricing.seed', actorId, summary: 'Dodano przykładowy cennik' });
      return interaction.reply(
        v2(
          card({
            tone: 'success',
            title: 'Dodano przykładowy cennik',
            description: `Pakiety: **${r.packages}**, pozycje kalkulatora: **${r.items}**.\nIstniejące wpisy nie zostały zmienione. Edytuj je: \`/cennik pakiet dodaj\`, \`/cennik pozycja dodaj\`.`,
            timestamp: false,
          }),
          { ephemeral: true },
        ),
      );
    }

    if (group === 'pakiet') {
      if (sub === 'dodaj') {
        return interaction.showModal(
          new Form('pricing:packageSave', 'Pakiet cennika')
            .info('Podaj nazwę istniejącego pakietu, żeby go edytować.')
            .text({ id: 'name', label: 'Nazwa', max: 40, placeholder: 'np. Pro' })
            .text({ id: 'price', label: 'Cena „od” (zł)', max: 12 })
            .text({ id: 'description', label: 'Krótki opis', max: 200 })
            .text({
              id: 'features',
              label: 'Co zawiera (każda pozycja w nowej linii)',
              paragraph: true,
              required: false,
              max: 1000,
            })
            .build(),
        );
      }
      const id = Number(interaction.options.getString('nazwa', true));
      const pkg = await prisma.pricingPackage.delete({ where: { id } }).catch(() => null);
      if (!pkg) throw new UserError('Nie ma takiego pakietu.');
      await audit(client, {
        action: 'pricing.package.delete',
        actorId,
        summary: `Usunięto pakiet **${pkg.name}**`,
      });
      return interaction.reply(
        v2(card({ tone: 'success', title: `Usunięto pakiet ${pkg.name}`, timestamp: false }), {
          ephemeral: true,
        }),
      );
    }

    if (group === 'pozycja') {
      if (sub === 'dodaj') {
        return interaction.showModal(
          new Form('pricing:itemSave', 'Pozycja kalkulatora')
            .info('Podaj nazwę istniejącej pozycji, żeby ją edytować.')
            .text({ id: 'label', label: 'Nazwa funkcji', max: 60, placeholder: 'np. System ticketów' })
            .text({ id: 'price', label: 'Cena (zł)', max: 12 })
            .text({ id: 'description', label: 'Opis', required: false, max: 100 })
            .build(),
        );
      }
      const key = interaction.options.getString('nazwa', true);
      const item = await prisma.pricingItem.delete({ where: { key } }).catch(() => null);
      if (!item) throw new UserError('Nie ma takiej pozycji.');
      await audit(client, {
        action: 'pricing.item.delete',
        actorId,
        summary: `Usunięto pozycję **${item.label}**`,
      });
      return interaction.reply(
        v2(card({ tone: 'success', title: `Usunięto pozycję ${item.label}`, timestamp: false }), {
          ephemeral: true,
        }),
      );
    }

    // group === 'rabat'
    if (sub === 'lista') {
      const codes = await prisma.discountCode.findMany({ orderBy: { createdAt: 'desc' }, take: 25 });
      return interaction.reply(
        v2(
          card({
            tone: 'client',
            title: `Kody rabatowe (${codes.length})`,
            description:
              codes
                .map(
                  (c) =>
                    `\`${c.code}\` ${discountLabel(c)} • użyto ${c.uses}${c.maxUses ? `/${c.maxUses}` : ''}` +
                    (c.expiresAt
                      ? ` • ${c.expiresAt.getTime() < Date.now() ? '**wygasł**' : `do ${discordTime(c.expiresAt, 'D')}`}`
                      : ''),
                )
                .join('\n') || 'Brak kodów.',
            timestamp: false,
          }),
          { ephemeral: true },
        ),
      );
    }
    if (sub === 'usun') {
      const code = interaction.options.getString('nazwa', true);
      const dc = await prisma.discountCode.delete({ where: { code } }).catch(() => null);
      if (!dc) throw new UserError('Nie ma takiego kodu.');
      await audit(client, {
        action: 'pricing.discount.delete',
        actorId,
        summary: `Usunięto kod \`${code}\``,
      });
      return interaction.reply(
        v2(card({ tone: 'success', title: `Usunięto kod ${code}`, timestamp: false }), { ephemeral: true }),
      );
    }

    const code = normalizeCode(interaction.options.getString('kod', true));
    const percent = interaction.options.getInteger('procent');
    const amountRaw = interaction.options.getString('kwota');
    const amount = amountRaw ? parseMoney(amountRaw) : null;
    if (amountRaw && amount === null) throw new UserError('Nieprawidłowa kwota rabatu.');
    if ((percent === null) === (amount === null))
      throw new UserError('Podaj **albo** procent, **albo** kwotę rabatu.');
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new UserError('Kod: 3–30 znaków (litery, cyfry, - i _).');
    const days = interaction.options.getInteger('dni');
    const dc = await prisma.discountCode
      .create({
        data: {
          code,
          percent,
          amount,
          maxUses: interaction.options.getInteger('limit'),
          expiresAt: days ? new Date(Date.now() + days * 86_400_000) : null,
        },
      })
      .catch(() => null);
    if (!dc) throw new UserError(`Kod \`${code}\` już istnieje.`);
    await audit(client, {
      action: 'pricing.discount.add',
      actorId,
      summary: `Nowy kod \`${code}\` (${discountLabel(dc)})`,
    });
    return interaction.reply(
      v2(
        card({
          tone: 'client',
          title: `Kod ${code} utworzony`,
          fields: [
            { emoji: 'coins', label: 'Rabat', value: discountLabel(dc) },
            { emoji: 'users', label: 'Limit użyć', value: dc.maxUses ? String(dc.maxUses) : 'bez limitu' },
            {
              label: 'Ważny do',
              value: dc.expiresAt ? discordTime(dc.expiresAt, 'D') : 'bezterminowo',
            },
          ],
          timestamp: false,
        }),
        { ephemeral: true },
      ),
    );
  },
});

export const pricingModule = defineModule({
  name: 'pricing',
  description: 'Cennik, kalkulator wyceny i kody rabatowe',
  commands: [pricingCommand],
  components: [
    defineComponent({
      id: 'pricing:calc',
      type: 'button',
      async run(interaction) {
        const state = await loadState(interaction.user.id);
        const { items, dc } = await calcData(state);
        await interaction.reply(v2(calculatorPanel(items, state, dc), { ephemeral: true }));
      },
    }),
    defineComponent({
      id: 'pricing:calcSelect',
      type: 'select',
      async run(interaction) {
        const state = { ...(await loadState(interaction.user.id)), items: [...interaction.values] };
        await saveState(interaction.user.id, state);
        const { items, dc } = await calcData(state);
        await interaction.update(v2Message(calculatorPanel(items, state, dc)));
      },
    }),
    defineComponent({
      id: 'pricing:code',
      type: 'button',
      async run(interaction) {
        await interaction.showModal(
          new Form('pricing:codeSubmit', 'Kod rabatowy').text({ id: 'code', label: 'Kod', max: 30 }).build(),
        );
      },
    }),
    defineComponent({
      id: 'pricing:codeSubmit',
      type: 'modal',
      async run(interaction) {
        const dc = await findValidDiscount(interaction.fields.getTextInputValue('code'));
        const state = { ...(await loadState(interaction.user.id)), code: dc.code };
        await saveState(interaction.user.id, state);
        const { items } = await calcData(state);
        const payload = calculatorPanel(
          items,
          state,
          dc,
          `Kod \`${dc.code}\` aktywny: **${discountLabel(dc)}**`,
        );
        if (interaction.isFromMessage()) await interaction.update(v2Message(payload));
        else await interaction.reply(v2(payload, { ephemeral: true }));
      },
    }),
    defineComponent({
      id: 'pricing:orderCalc',
      type: 'button',
      async run(interaction, _args, { config }) {
        await assertCanOpen(interaction.member, 'ORDER', config);
        const state = await loadState(interaction.user.id);
        const { items, dc } = await calcData(state);
        if (!state.items.length) throw new UserError('Najpierw wybierz funkcje w kalkulatorze.');
        await interaction.showModal(
          ticketForm('ORDER', {
            name: 'Bot z kalkulatora',
            description: calcOrderDescription(items, state, dc),
          }),
        );
      },
    }),
    defineComponent({
      id: 'pricing:order',
      type: 'button',
      async run(interaction, args, { config }) {
        const pkg = await prisma.pricingPackage.findUnique({ where: { id: Number(args[0]) } });
        if (!pkg) throw new UserError('Ten pakiet już nie istnieje – odśwież cennik.');
        await assertCanOpen(interaction.member, 'ORDER', config);
        await interaction.showModal(
          ticketForm('ORDER', {
            name: `Pakiet ${pkg.name}`,
            description: `Interesuje mnie pakiet ${pkg.name} (od ${formatMoney(Number(pkg.price))}):\n${pkg.features.map((f) => `- ${f}`).join('\n')}\n\nMój pomysł na bota: `,
          }),
        );
      },
    }),
    defineComponent({
      id: 'pricing:custom',
      type: 'button',
      async run(interaction, _args, { config }) {
        await assertCanOpen(interaction.member, 'ORDER', config);
        await interaction.showModal(ticketForm('ORDER'));
      },
    }),
    defineComponent({
      id: 'pricing:packageSave',
      type: 'modal',
      access: 'admin',
      async run(interaction, _args, { client }) {
        const f = interaction.fields;
        const name = f.getTextInputValue('name').trim();
        const price = parseMoney(f.getTextInputValue('price'));
        if (price === null) throw new UserError('Nieprawidłowa cena.');
        const data = {
          price,
          description: f.getTextInputValue('description').trim(),
          features: f
            .getTextInputValue('features')
            .split('\n')
            .map((x) => x.replace(/^[-*•]\s*/, '').trim())
            .filter(Boolean)
            .slice(0, 10),
        };
        const count = await prisma.pricingPackage.count();
        await prisma.pricingPackage.upsert({
          where: { name },
          create: { name, ...data, position: count },
          update: data,
        });
        await audit(client, {
          action: 'pricing.package.save',
          actorId: interaction.user.id,
          summary: `Zapisano pakiet **${name}** (${formatMoney(price)})`,
        });
        await interaction.reply(
          v2(
            card({
              tone: 'success',
              title: `Zapisano pakiet ${name}`,
              description: 'Wyślij panel ponownie (`/cennik panel`), żeby zobaczyć zmiany.',
              timestamp: false,
            }),
            { ephemeral: true },
          ),
        );
      },
    }),
    defineComponent({
      id: 'pricing:itemSave',
      type: 'modal',
      access: 'admin',
      async run(interaction, _args, { client }) {
        const f = interaction.fields;
        const label = f.getTextInputValue('label').trim();
        const price = parseMoney(f.getTextInputValue('price'));
        if (price === null) throw new UserError('Nieprawidłowa cena.');
        const key = slugify(label, 30);
        const data = {
          label,
          price,
          description: f.getTextInputValue('description').trim() || null,

          active: true,
        };
        await prisma.pricingItem.upsert({ where: { key }, create: { key, ...data }, update: data });
        await audit(client, {
          action: 'pricing.item.save',
          actorId: interaction.user.id,
          summary: `Zapisano pozycję **${label}** (${formatMoney(price)})`,
        });
        await interaction.reply(
          v2(card({ tone: 'success', title: `Zapisano pozycję ${label}`, timestamp: false }), {
            ephemeral: true,
          }),
        );
      },
    }),
  ],
});
