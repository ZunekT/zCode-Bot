import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { ChannelType, type Guild } from 'discord.js';
import type { GuildConfig, Prisma, SdkBot } from '../../generated/prisma/client.js';
import type { ZxClient } from '../../client.js';
import type { BotModule } from '../../core/types.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { getConfig, onConfigUpdated, updateConfig } from '../../core/config-service.js';
import { createLogger } from '../../utils/logger.js';
import { LOG_TYPES, LOG_TYPE_KEYS } from '../logs/types.js';
import { MODE_LABELS } from '../verification/panels.js';
import { sdkHub, type SdkEvent } from './hub.js';
import { hashKey } from './keys.js';
import {
  validateValues,
  type BotSchema,
  type ChannelKind,
  type ConfigValues,
  type SchemaField,
  type SchemaModule,
} from './schema.js';
import { guildData, hello, profileResult, setConfig, syncGuilds, type Profile } from './service.js';

/**
 * Sam bot zxCode jako bot SDK: wszystkie jego ustawienia (GuildConfig) są widoczne i edytowalne
 * w panelu zxcode.pl tak samo jak ustawienia botów klientów. Połączenie w procesie – bez klucza,
 * bez HTTP. Synchronizacja w obie strony:
 *   panel → hub → updateConfig()     (zmiana działa od razu w bocie)
 *   /config na Discordzie → updateConfig() → setConfig()  (panel pokazuje aktualny stan)
 */

const log = createLogger('sdk:self');
const pkg = createRequire(import.meta.url)('../../../package.json') as { version: string };

type Column = keyof GuildConfig;
interface Binding {
  module: string;
  field: SchemaField;
  /** Kolumna GuildConfig albo typ logu (logChannels[typ]). */
  column?: Column;
  logType?: string;
}

const TEXT: ChannelKind[] = ['text', 'announcement'];
const ch = (key: string, label: string, types: ChannelKind[] = TEXT, description?: string): SchemaField => ({
  key,
  type: 'channel',
  label,
  channelTypes: types,
  ...(description && { description }),
});
const role = (key: string, label: string, description?: string): SchemaField => ({
  key,
  type: 'role',
  label,
  ...(description && { description }),
});
const num = (
  key: string,
  label: string,
  min: number,
  max: number,
  def: number,
  description?: string,
): SchemaField => ({
  key,
  type: 'number',
  label,
  min,
  max,
  integer: true,
  default: def,
  required: true,
  ...(description && { description }),
});
const bool = (key: string, label: string, def: boolean, description?: string): SchemaField => ({
  key,
  type: 'boolean',
  label,
  default: def,
  required: true,
  ...(description && { description }),
});

interface ModuleDef {
  key: string;
  label: string;
  description?: string;
  /** Nazwa modułu bota, którego przełącznik (config.modules) steruje „enabled”. */
  toggle?: string;
  fields: [SchemaField, Column | { log: string }][];
}

const MODULES: ModuleDef[] = [
  {
    key: 'ogolne',
    label: 'Ogólne',
    description: 'Role obsługi, audyt i tryb serwisowy',
    fields: [
      [role('obsluga', 'Rola obsługi', 'Dostęp do ticketów i komend dla obsługi'), 'staffRoleId'],
      [role('admin', 'Rola administracji', 'Pełny dostęp do konfiguracji bota'), 'adminRoleId'],
      [ch('audyt', 'Kanał audytu', TEXT, 'Akcje administracji i zmiany z panelu'), 'auditChannelId'],
      [ch('logi', 'Logi ticketów i zleceń'), 'logChannelId'],
      [bool('serwis', 'Tryb serwisowy', false, 'Bot odpowiada tylko administracji'), 'maintenance'],
      [
        { key: 'serwis_tresc', type: 'textarea', label: 'Komunikat trybu serwisowego', maxLength: 1000 },
        'maintenanceMessage',
      ],
    ],
  },
  {
    key: 'tickets',
    label: 'Tickety',
    toggle: 'tickets',
    fields: [
      [ch('kategoria', 'Kategoria ticketów', ['category']), 'ticketCategoryId'],
      [ch('archiwum', 'Archiwum ticketów', ['category']), 'archiveCategoryId'],
      [ch('transkrypty', 'Kanał transkryptów'), 'transcriptChannelId'],
      [
        num(
          'auto_zamkniecie',
          'Auto-zamknięcie (godziny)',
          1,
          720,
          48,
          'Po ilu godzinach bez odpowiedzi zamknąć ticket',
        ),
        'ticketAutoCloseHours',
      ],
      [
        num('sla', 'SLA (godziny)', 1, 168, 12, 'Po ilu godzinach oczekiwania klienta pingować obsługę'),
        'ticketSlaHours',
      ],
    ],
  },
  {
    key: 'verification',
    label: 'Weryfikacja',
    toggle: 'verification',
    fields: [
      [role('zweryfikowany', 'Rola po weryfikacji'), 'verifiedRoleId'],
      [role('niezweryfikowany', 'Rola przed weryfikacją', 'Opcjonalna'), 'unverifiedRoleId'],
      [
        {
          key: 'tryb',
          type: 'select',
          label: 'Tryb weryfikacji',
          required: true,
          default: 'captcha',
          options: Object.entries(MODE_LABELS).map(([value, label]) => ({ value, label })),
        },
        'verificationMode',
      ],
      [num('wiek_konta', 'Minimalny wiek konta (dni)', 0, 365, 0), 'verificationMinAccountAgeDays'],
      [bool('blokada', 'Blokada wejść', false, 'Wstrzymuje weryfikację nowych osób'), 'verificationLockdown'],
      [bool('antyrajd', 'Ochrona przed rajdem', true), 'antiRaidEnabled'],
      [num('antyrajd_wejscia', 'Rajd: liczba wejść', 3, 100, 10), 'antiRaidJoins'],
      [num('antyrajd_sekundy', 'Rajd: w ciągu sekund', 5, 600, 30), 'antiRaidSeconds'],
    ],
  },
  {
    key: 'logs',
    label: 'Logi serwera',
    toggle: 'logs',
    fields: [
      ...LOG_TYPE_KEYS.map((t): [SchemaField, { log: string }] => [
        ch(`kanal_${t}`, `Logi: ${LOG_TYPES[t].label}`, TEXT, LOG_TYPES[t].description),
        { log: t },
      ]),
      [
        {
          ...ch('pomijane', 'Pomijane kanały i kategorie', [
            'text',
            'voice',
            'category',
            'announcement',
            'forum',
            'stage',
          ]),
          multiple: true,
        },
        'logIgnoredChannels',
      ],
    ],
  },
  {
    key: 'orders',
    label: 'Zlecenia i płatności',
    toggle: 'orders',
    fields: [
      [
        { key: 'dane_przelewu', type: 'textarea', label: 'Dane do przelewu (proforma)', maxLength: 1000 },
        'paymentDetails',
      ],
    ],
  },
  {
    key: 'clients',
    label: 'Klienci',
    toggle: 'clients',
    fields: [
      [role('klient', 'Rola klienta'), 'clientRoleId'],
      [role('staly_klient', 'Rola stałego klienta'), 'loyalClientRoleId'],
    ],
  },
  {
    key: 'announcements',
    label: 'Ogłoszenia',
    toggle: 'announcements',
    fields: [[ch('kanal', 'Kanał ogłoszeń'), 'announcementChannelId']],
  },
  {
    key: 'changelog',
    label: 'Changelog',
    toggle: 'changelog',
    fields: [[ch('kanal', 'Kanał changeloga'), 'changelogChannelId']],
  },
  {
    key: 'reviews',
    label: 'Opinie',
    toggle: 'reviews',
    fields: [[ch('kanal', 'Kanał opinii'), 'reviewChannelId']],
  },
  {
    key: 'monitoring',
    label: 'Monitoring botów',
    toggle: 'monitoring',
    fields: [
      [
        ch('alerty', 'Alerty dla obsługi', TEXT, 'Powiadomienia o awariach botów klientów'),
        'staffAlertChannelId',
      ],
    ],
  },
];

/** Moduły bota bez ustawień – w panelu tylko przełącznik. */
const SIMPLE_TOGGLES: Record<string, string> = {
  faq: 'FAQ',
  pricing: 'Cennik i kalkulator',
  portfolio: 'Portfolio',
  reminders: 'Przypomnienia',
  stats: 'Statystyki',
};

const BINDINGS: Binding[] = MODULES.flatMap((m) =>
  m.fields.map(([field, target]) =>
    typeof target === 'string'
      ? { module: m.key, field, column: target }
      : { module: m.key, field, logType: target.log },
  ),
);

export function selfSchema(botModules: BotModule[]): BotSchema {
  const descriptions = new Map(botModules.map((m) => [m.name, m.description]));
  const mods: SchemaModule[] = MODULES.map((m) => ({
    key: m.key,
    label: m.label,
    description: m.description ?? (m.toggle ? descriptions.get(m.toggle) : undefined),
    toggle: !!m.toggle,
    defaultEnabled: true,
    fields: m.fields.map(([f]) => f),
  }));
  for (const [key, label] of Object.entries(SIMPLE_TOGGLES)) {
    if (!descriptions.has(key)) continue;
    mods.push({
      key,
      label,
      description: descriptions.get(key),
      toggle: true,
      defaultEnabled: true,
      fields: [],
    });
  }
  return { modules: mods };
}

const toggleOf = (moduleKey: string) =>
  MODULES.find((m) => m.key === moduleKey)?.toggle ?? (moduleKey in SIMPLE_TOGGLES ? moduleKey : undefined);

/** GuildConfig → wartości w formacie panelu. */
export function configToValues(config: GuildConfig, schema: BotSchema): ConfigValues {
  const modules = (config.modules ?? {}) as Record<string, boolean>;
  const logChannels = (config.logChannels ?? {}) as Record<string, string>;
  const values: ConfigValues = {};
  for (const mod of schema.modules) {
    values[mod.key] = {};
    const t = toggleOf(mod.key);
    if (mod.toggle && t) values[mod.key]!.enabled = modules[t] !== false;
  }
  for (const b of BINDINGS) {
    const v = b.logType ? (logChannels[b.logType] ?? null) : config[b.column!];
    values[b.module]![b.field.key] = (v ?? null) as never;
  }
  return values;
}

/** Wartości z panelu (już zwalidowane) → zmiana GuildConfig. */
export function valuesToUpdate(values: ConfigValues, config: GuildConfig): Prisma.GuildConfigUpdateInput {
  const data: Record<string, unknown> = {};
  const modules = { ...((config.modules ?? {}) as Record<string, boolean>) };
  const logChannels = { ...((config.logChannels ?? {}) as Record<string, string>) };
  let modulesChanged = false;
  let logsChanged = false;

  for (const [modKey, mv] of Object.entries(values)) {
    const t = toggleOf(modKey);
    if (t && typeof mv.enabled === 'boolean' && (modules[t] !== false) !== mv.enabled) {
      modules[t] = mv.enabled;
      modulesChanged = true;
    }
    for (const b of BINDINGS.filter((x) => x.module === modKey)) {
      if (!(b.field.key in mv)) continue;
      let v = mv[b.field.key];
      if (b.logType) {
        if (logChannels[b.logType] === (v ?? undefined)) continue;
        if (v) logChannels[b.logType] = v as string;
        else delete logChannels[b.logType];
        logsChanged = true;
        continue;
      }
      if (v === null && b.field.multiple) v = [];
      if (v === null && b.field.default !== undefined && b.field.required) v = b.field.default as never;
      if (JSON.stringify(config[b.column!] ?? null) !== JSON.stringify(v ?? null)) data[b.column!] = v;
    }
  }
  if (modulesChanged) data.modules = modules;
  if (logsChanged) data.logChannels = logChannels;
  return data as Prisma.GuildConfigUpdateInput;
}

// ───────────────────────────── Uprawnienia komend z panelu ─────────────────────────────

let permissions: Record<string, { roles: string[] }> = {};

/** Role, którym panel dał dostęp do komendy (null = brak reguły, działają domyślne uprawnienia). */
export function panelCommandRoles(commandName: string): string[] | null {
  return permissions[commandName]?.roles?.length ? permissions[commandName]!.roles : null;
}

// ───────────────────────────── Połączenie ─────────────────────────────

const KINDS: Partial<Record<ChannelType, ChannelKind>> = {
  [ChannelType.GuildText]: 'text',
  [ChannelType.GuildVoice]: 'voice',
  [ChannelType.GuildCategory]: 'category',
  [ChannelType.GuildAnnouncement]: 'announcement',
  [ChannelType.GuildForum]: 'forum',
  [ChannelType.GuildStageVoice]: 'stage',
};

function snapshot(guild: Guild) {
  return {
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL({ size: 128 }),
    channels: [...guild.channels.cache.values()]
      .filter((c) => !c.isThread())
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: KINDS[c.type] ?? 'other',
        parentId: c.parentId,
        position: c.rawPosition,
      })),
    roles: [...guild.roles.cache.values()]
      .filter((r) => r.id !== guild.id)
      .map((r) => ({ id: r.id, name: r.name, color: r.color, position: r.position, managed: r.managed })),
  };
}

let selfBot: SdkBot | null = null;
let applyingFromPanel = false;
let schema: BotSchema = { modules: [] };

export const selfBotId = () => selfBot?.id ?? null;

async function ensureSelfBot(client: ZxClient, guild: Guild): Promise<SdkBot> {
  const appId = client.user!.id;
  const ownerId = env.OWNER_ID ?? guild.ownerId;
  const existing = await prisma.sdkBot.findFirst({ where: { appId } });
  if (existing) {
    return existing.ownerId === ownerId
      ? existing
      : prisma.sdkBot.update({ where: { id: existing.id }, data: { ownerId } });
  }
  // Klucz losowy i nigdzie niezapisany – bot zxCode łączy się w procesie, nie przez HTTP.
  return prisma.sdkBot.create({
    data: {
      name: 'zxCode',
      ownerId,
      appId,
      keyHash: hashKey(randomBytes(32).toString('hex')),
      keyPrefix: 'wbudowany',
    },
  });
}

/** Zapisuje aktualny GuildConfig jako ustawienia w panelu (pola z usuniętymi kanałami/rolami pomija). */
async function pushConfig(config: GuildConfig) {
  if (!selfBot) return;
  const guild = await guildData(selfBot.id, config.guildId);
  const raw = configToValues(config, schema);
  const { errors } = validateValues(schema, raw, guild);
  for (const err of errors) {
    const [mod, key] = err.path.split('.');
    if (mod && key) raw[mod]![key] = null as never;
  }
  const { values, errors: left } = validateValues(schema, raw, guild);
  if (left.length) log.warn('Nie wszystkie ustawienia pasują do schematu panelu', left.slice(0, 5));
  await setConfig(selfBot.id, config.guildId, { values }, `bot:${selfBot.id}`, { notify: false });
}

async function onPanelEvent(client: ZxClient, event: SdkEvent) {
  if (event.type === 'config' && event.guildId === env.GUILD_ID) {
    permissions = (event.permissions ?? {}) as typeof permissions;
    const config = await getConfig(env.GUILD_ID);
    const data = valuesToUpdate(event.values as ConfigValues, config);
    if (!Object.keys(data).length) return;
    applyingFromPanel = true;
    try {
      await updateConfig(data, env.GUILD_ID);
      log.info(`Panel WWW: zmieniono ustawienia (${Object.keys(data).join(', ')})`);
    } finally {
      applyingFromPanel = false;
    }
  } else if (event.type === 'profile') {
    await applyProfile(client, event.profile as Profile, event.revision);
  }
}

async function applyProfile(client: ZxClient, profile: Profile, revision: number, initial = false) {
  const user = client.user;
  if (!user || !selfBot) return;
  if (profile.presence?.status) {
    const a = profile.presence.activity;
    const types = { playing: 0, listening: 2, watching: 3, custom: 4, competing: 5 } as const;
    user.setPresence({
      status: profile.presence.status,
      activities: a?.text
        ? [
            a.type === 'custom'
              ? { name: 'Custom Status', state: a.text, type: 4 }
              : { name: a.text, type: types[a.type] },
          ]
        : [],
    });
  }
  if (initial || !profile.request || (!profile.request.username && !profile.request.avatar)) return;
  let error: string | undefined;
  try {
    if (profile.request.username && profile.request.username !== user.username)
      await user.setUsername(profile.request.username);
    if (profile.request.avatar)
      await user.setAvatar(Buffer.from(profile.request.avatar.split(',')[1] ?? '', 'base64'));
  } catch (err) {
    error = (err as Error).message;
    log.warn('Nie udało się zmienić profilu bota', err);
  }
  const fresh = await prisma.sdkBot.findUnique({ where: { id: selfBot.id } });
  if (fresh) await profileResult(fresh, { revision, ok: !error, error });
}

let started = false;

/** Wywoływane po zalogowaniu: rejestruje bota zxCode w panelu i włącza synchronizację. */
export async function startSelfSdk(client: ZxClient, botModules: BotModule[]): Promise<void> {
  const guild = client.guilds.cache.get(env.GUILD_ID);
  if (!guild || !client.user) {
    log.warn('Bot nie widzi serwera zxCode – panel ustawień nieaktywny');
    return;
  }
  schema = selfSchema(botModules);
  selfBot = await ensureSelfBot(client, guild);

  const commands = botModules
    .flatMap((m) => m.commands ?? [])
    .map((c) => c.data.toJSON())
    .map((d) => ({ name: d.name, description: 'description' in d ? (d.description ?? '') : '' }));

  const res = await hello(selfBot, {
    sdk: { version: 'wbudowany' },
    bot: { version: pkg.version },
    app: {
      id: client.user.id,
      username: client.user.username,
      avatar: client.user.displayAvatarURL({ size: 256 }),
    },
    schema,
    commands,
    guilds: [snapshot(guild)],
  });
  selfBot = await prisma.sdkBot.findUniqueOrThrow({ where: { id: selfBot.id } });
  permissions = (res.configs.find((c) => c.guildId === guild.id)?.permissions ?? {}) as typeof permissions;
  await pushConfig(await getConfig(guild.id));
  await applyProfile(client, res.profile as Profile, res.profileRevision, true);

  if (started) return;
  started = true;
  const botId = selfBot.id;
  sdkHub.subscribe(botId, (event) => {
    onPanelEvent(client, event).catch((err) => log.error('Zmiana z panelu nie została zastosowana', err));
  });
  onConfigUpdated((config) => {
    if (applyingFromPanel || config.guildId !== env.GUILD_ID) return;
    pushConfig(config).catch((err) => log.warn('Nie udało się zsynchronizować ustawień z panelem', err));
  });

  // Kanały i role do wyboru w panelu – aktualizowane po zmianach na serwerze (zbiorczo co 3 s).
  let timer: NodeJS.Timeout | null = null;
  const queue = (g: Guild | null | undefined) => {
    if (g?.id !== env.GUILD_ID || timer) return;
    timer = setTimeout(() => {
      timer = null;
      const current = client.guilds.cache.get(env.GUILD_ID);
      if (current && selfBot) {
        syncGuilds(selfBot, { guilds: [snapshot(current)] }).catch((err) =>
          log.warn('Synchronizacja kanałów/ról', err),
        );
      }
    }, 3_000);
  };
  client.on('channelCreate', (c) => queue(c.guild));
  client.on('channelUpdate', (_o, c) => queue('guild' in c ? c.guild : null));
  client.on('channelDelete', (c) => queue('guild' in c ? c.guild : null));
  client.on('roleCreate', (r) => queue(r.guild));
  client.on('roleUpdate', (_o, r) => queue(r.guild));
  client.on('roleDelete', (r) => queue(r.guild));
  client.on('guildUpdate', (_o, g) => queue(g));

  log.info(`Ustawienia bota dostępne w panelu (bot SDK #${botId}, właściciel ${selfBot.ownerId})`);
}
