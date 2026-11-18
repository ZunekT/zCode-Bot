'use strict';

/**
 * zxcode-sdk
 *
 * Bot Discord deklaruje swoje moduły i ustawienia, a klient edytuje je w panelu zxcode.pl.
 * Zmiany trafiają do bota na żywo (bez restartu). Do tego: uprawnienia komend według ról,
 * profil i status bota z panelu oraz monitoring (heartbeat).
 *
 * Zero zależności – Node.js 18+ (wbudowany fetch), discord.js v14.
 */

const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');

const SDK_VERSION = '1.0.0';
const DEFAULT_URL = 'https://bot.zxcode.pl';
const KEY_RE = /^zxk_\d+_[a-f0-9]{48}$/;
const HEARTBEAT_MS = 60_000;
const REQUEST_TIMEOUT = 15_000;
const GUILD_SYNC_DEBOUNCE = 3_000;
const WS_READY = 0;

// discord.js ChannelType -> nazwy używane w panelu
const CHANNEL_KINDS = { 0: 'text', 2: 'voice', 4: 'category', 5: 'announcement', 13: 'stage', 15: 'forum' };
// discord.js ActivityType
const ACTIVITY = { playing: 0, listening: 2, watching: 3, custom: 4, competing: 5 };

// ───────────────────────────── Pola ustawień ─────────────────────────────

function makeField(type, opts = {}) {
  if (!opts.label) throw new TypeError(`zxcode-sdk: pole typu ${type} wymaga „label”`);
  return { __zxField: true, type, ...opts };
}

/**
 * Konstruktory pól. Każde przyjmuje { label, description?, default?, required? } i opcje swojego typu.
 */
const field = {
  /** Przełącznik tak/nie. */
  toggle: (o) => makeField('boolean', o),
  /** Krótki tekst (domyślnie do 2000 znaków). */
  text: (o) => makeField('text', o),
  /** Długi tekst, np. treść wiadomości. */
  textarea: (o) => makeField('textarea', o),
  /** Liczba: { min?, max?, integer? }. */
  number: (o) => makeField('number', o),
  /** Wybór z listy: { options: [{ value, label }] lub ['a', 'b'], multiple? }. */
  select: (o) =>
    makeField('select', {
      ...o,
      options: (o?.options ?? []).map((x) => (typeof x === 'string' ? { value: x, label: x } : x)),
    }),
  /** Kanał serwera: { types?: ['text', 'voice', 'category', 'announcement', 'forum', 'stage'], multiple? }. */
  channel: (o) => makeField('channel', { ...o, channelTypes: o?.types ?? o?.channelTypes }),
  /** Rola serwera: { multiple? }. */
  role: (o) => makeField('role', o),
  /** Kolor w formacie #rrggbb. */
  color: (o) => makeField('color', o),
};

/** { klucz: { label, fields: { pole: field.x() } } } -> format schematu wysyłany do serwera. */
function buildSchema(modules) {
  const out = [];
  for (const [key, mod] of Object.entries(modules ?? {})) {
    if (!/^[a-zA-Z0-9_]{1,32}$/.test(key)) throw new TypeError(`zxcode-sdk: nieprawidłowy klucz modułu „${key}” (a-z, 0-9, _)`);
    const fields = [];
    for (const [fkey, f] of Object.entries(mod.fields ?? {})) {
      if (!f || !f.__zxField) throw new TypeError(`zxcode-sdk: ${key}.${fkey} – użyj field.text(), field.channel() itd.`);
      if (fkey === 'enabled') throw new TypeError(`zxcode-sdk: ${key}.enabled jest zarezerwowane (użyj toggle: true w module)`);
      const { __zxField, types, ...rest } = f;
      void __zxField;
      void types;
      fields.push({ key: fkey, ...rest });
    }
    out.push({
      key,
      label: mod.label ?? key,
      description: mod.description,
      toggle: mod.toggle === true,
      defaultEnabled: mod.defaultEnabled !== false,
      fields,
    });
  }
  return { modules: out };
}

function readVersion() {
  if (process.env.npm_package_version) return process.env.npm_package_version;
  try {
    return require(path.join(process.cwd(), 'package.json')).version;
  } catch {
    return undefined;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// ───────────────────────────── Klient SDK ─────────────────────────────

class ZxCode extends EventEmitter {
  constructor(client, options = {}) {
    super();
    if (!client || typeof client.once !== 'function') throw new TypeError('zxcode-sdk: pierwszym argumentem musi być klient discord.js');

    this.client = client;
    this.key = (options.key ?? process.env.ZXCODE_KEY ?? '').trim();
    if (!KEY_RE.test(this.key)) {
      throw new Error('zxcode-sdk: brak albo nieprawidłowy klucz. Ustaw ZXCODE_KEY (klucz z /sdk dodaj na serwerze zxCode) albo podaj { key }.');
    }
    this.url = (options.url ?? process.env.ZXCODE_URL ?? DEFAULT_URL).replace(/\/$/, '');
    this.version = options.version ?? readVersion();
    this.schema = buildSchema(options.modules);
    this.extraCommands = options.commands ?? [];
    this.applyPresence = options.presence !== false;
    this.denyMessage = options.denyMessage ?? 'Nie masz uprawnień do tej komendy.';
    this.debug = options.debug === true;
    this.cacheFile = options.cacheFile === false ? null : (options.cacheFile ?? path.join(process.cwd(), '.zxcode-cache.json'));

    /** @type {Map<string, { values: object, permissions: object, revision: number }>} */
    this.configs = new Map();
    this.profile = {};
    this.profileRevision = 0;
    this.connected = false;
    this.stopped = false;
    this._abort = null;
    this._timers = new Set();
    this._pendingGuilds = new Set();
    this._guildTimer = null;

    this._modulesByKey = new Map(this.schema.modules.map((m) => [m.key, m]));
    this._loadCache();
    this._bindEvents();

    if (typeof client.isReady === 'function' && client.isReady()) void this._start();
    else {
      const go = () => void this._start();
      client.once('clientReady', go);
      client.once('ready', go);
    }
  }

  // ───────────── Publiczne API ─────────────

  /**
   * Wartość ustawienia: zx.get(guildId, 'tickety.kanal').
   * Gdy w panelu nic nie ustawiono – wartość domyślna z definicji pola.
   */
  get(guildId, pathStr) {
    const [mod, key] = String(pathStr).split('.');
    const def = this._modulesByKey.get(mod);
    if (!def) throw new Error(`zxcode-sdk: nieznany moduł „${mod}”`);
    const values = this.configs.get(guildId)?.values?.[mod] ?? {};
    if (key === 'enabled') return def.toggle ? (values.enabled ?? def.defaultEnabled) : true;
    const fieldDef = def.fields.find((f) => f.key === key);
    if (!fieldDef) throw new Error(`zxcode-sdk: nieznane pole „${pathStr}”`);
    return values[key] === undefined ? (fieldDef.default ?? (fieldDef.multiple ? [] : null)) : values[key];
  }

  /** Wszystkie ustawienia modułu z wartościami domyślnymi: zx.module(guildId, 'tickety'). */
  module(guildId, mod) {
    const def = this._modulesByKey.get(mod);
    if (!def) throw new Error(`zxcode-sdk: nieznany moduł „${mod}”`);
    const out = {};
    if (def.toggle) out.enabled = this.get(guildId, `${mod}.enabled`);
    for (const f of def.fields) out[f.key] = this.get(guildId, `${mod}.${f.key}`);
    return out;
  }

  /** Czy moduł jest włączony na serwerze (moduły bez przełącznika zawsze true). */
  enabled(guildId, mod) {
    return this.get(guildId, `${mod}.enabled`);
  }

  /**
   * Czy członek serwera może użyć komendy (uprawnienia ustawione w panelu).
   * Brak reguły = komenda dostępna. Administrator serwera zawsze ma dostęp.
   */
  can(member, commandName) {
    if (!member?.guild) return true;
    const rule = this.configs.get(member.guild.id)?.permissions?.[commandName];
    if (!rule?.roles?.length) return true;
    if (member.permissions?.has?.('Administrator')) return true;
    const roles = member.roles?.cache;
    return rule.roles.some((id) => (roles?.has ? roles.has(id) : Array.isArray(member.roles) && member.roles.includes(id)));
  }

  /**
   * Strażnik komendy: zwraca true, gdy można ją wykonać. W przeciwnym razie odpowiada
   * prywatną wiadomością i zwraca false.
   *   if (!(await zx.guard(interaction))) return;
   */
  async guard(interaction, message = this.denyMessage) {
    if (!interaction?.inGuild?.() || !interaction.commandName) return true;
    if (this.can(interaction.member, interaction.commandName)) return true;
    try {
      const payload = { content: message, flags: 64 };
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
      else await interaction.reply(payload);
    } catch {
      /* interakcja wygasła */
    }
    return false;
  }

  /**
   * Zgłasza ustawienia od strony bota (np. zmienione komendą na Discordzie), żeby panel je pokazał.
   * values: { moduł: { pole: wartość } } – zmieniane tylko podane pola, null czyści pole.
   */
  async set(guildId, values) {
    const res = await this._request('PUT', `/sdk/v1/config/${guildId}`, { values });
    return res;
  }

  /** Zatrzymuje SDK (rozłącza się z panelem). */
  stop() {
    this.stopped = true;
    this._abort?.abort();
    for (const t of this._timers) clearInterval(t);
    this._timers.clear();
    if (this._guildTimer) clearTimeout(this._guildTimer);
    this.connected = false;
  }

  // ───────────── Wewnętrzne ─────────────

  _log(...args) {
    if (this.debug) console.log('[zxcode-sdk]', ...args);
  }

  _warn(msg, err) {
    console.warn(`[zxcode-sdk] ${msg}${err ? `: ${err.message ?? err}` : ''}`);
    if (err) this.emit('error', err instanceof Error ? err : new Error(String(err)));
  }

  async _request(method, route, body) {
    const res = await fetch(`${this.url}${route}`, {
      method,
      headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json', 'user-agent': `zxcode-sdk/${SDK_VERSION}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      const err = new Error('Nieprawidłowy klucz zxCode (ZXCODE_KEY) – sprawdź .env albo wygeneruj nowy: /sdk klucz');
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    if (!res.ok) {
      const err = new Error(data.error === 'validation' ? data.errors.map((e) => `${e.path}: ${e.message}`).join('; ') : (data.error ?? `HTTP ${res.status}`));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  _guildSnapshot(guild) {
    return {
      id: guild.id,
      name: guild.name,
      icon: typeof guild.iconURL === 'function' ? guild.iconURL({ size: 128 }) : null,
      channels: [...(guild.channels?.cache?.values() ?? [])]
        .filter((c) => !c.isThread?.())
        .map((c) => ({ id: c.id, name: c.name, type: CHANNEL_KINDS[c.type] ?? 'other', parentId: c.parentId ?? null, position: c.rawPosition ?? c.position ?? 0 })),
      roles: [...(guild.roles?.cache?.values() ?? [])]
        .filter((r) => r.id !== guild.id)
        .map((r) => ({ id: r.id, name: r.name, color: r.color, position: r.position, managed: r.managed })),
    };
  }

  async _commandList() {
    const list = new Map();
    try {
      const cmds = await this.client.application?.commands?.fetch();
      for (const c of cmds?.values() ?? []) list.set(c.name, { name: c.name, description: c.description ?? '' });
    } catch (err) {
      this._log('nie udało się pobrać komend', err.message);
    }
    for (const c of this.extraCommands) {
      const name = typeof c === 'string' ? c : c.name;
      if (name && !list.has(name)) list.set(name, { name, description: typeof c === 'string' ? '' : (c.description ?? '') });
    }
    return [...list.values()];
  }

  async _hello() {
    const app = this.client.user;
    const res = await this._request('POST', '/sdk/v1/hello', {
      sdk: { version: SDK_VERSION },
      bot: { version: this.version },
      app: { id: app?.id, username: app?.username, avatar: app?.displayAvatarURL?.({ size: 256 }) ?? null },
      schema: this.schema,
      commands: await this._commandList(),
      guilds: [...(this.client.guilds?.cache?.values() ?? [])].map((g) => this._guildSnapshot(g)),
    });
    if (res.warnings?.length) this._warn(`ostrzeżenia schematu: ${res.warnings.join('; ')}`);
    for (const c of res.configs ?? []) this._applyConfig(c);
    this._applyProfile(res.profile ?? {}, res.profileRevision ?? 0);
    this._saveCache();
  }

  _applyConfig({ guildId, values, permissions, revision }) {
    const prev = this.configs.get(guildId);
    if (prev && prev.revision > revision) return;
    this.configs.set(guildId, { values: values ?? {}, permissions: permissions ?? {}, revision: revision ?? 0 });
    // Zdarzenie „change” dla każdego zmienionego modułu.
    for (const mod of this.schema.modules) {
      const before = prev?.values?.[mod.key];
      const after = values?.[mod.key];
      if (!same(before, after)) {
        this.emit('change', { guildId, module: mod.key, values: this.module(guildId, mod.key), previous: before ?? {} });
      }
    }
    if (prev && !same(prev.permissions, permissions)) this.emit('permissions', { guildId, permissions: permissions ?? {} });
  }

  async _applyProfile(profile, revision) {
    this.profile = profile;
    const isNew = revision > this.profileRevision;
    this.profileRevision = revision;
    const user = this.client.user;
    if (!user) return;

    if (this.applyPresence && profile.presence?.status) {
      const a = profile.presence.activity;
      const activities = a?.text
        ? [a.type === 'custom' ? { name: 'Custom Status', state: a.text, type: ACTIVITY.custom } : { name: a.text, type: ACTIVITY[a.type] ?? 0 }]
        : [];
      try {
        user.setPresence({ status: profile.presence.status, activities });
      } catch (err) {
        this._warn('nie udało się ustawić statusu', err);
      }
    }

    if (isNew && profile.request && (profile.request.username || profile.request.avatar)) {
      let error;
      try {
        if (profile.request.username && profile.request.username !== user.username) await user.setUsername(profile.request.username);
        if (profile.request.avatar) {
          const b64 = profile.request.avatar.split(',')[1] ?? '';
          await user.setAvatar(Buffer.from(b64, 'base64'));
        }
      } catch (err) {
        error = err.message ?? String(err);
        this._warn('nie udało się zmienić profilu bota', err);
      }
      await this._request('POST', '/sdk/v1/profile/result', { revision, ok: !error, error }).catch(() => undefined);
    }
    this.emit('profile', profile);
  }

  async _start() {
    if (this._started) return;
    this._started = true;

    // Heartbeat dla monitoringu – tylko gdy bot jest naprawdę połączony z Discordem.
    const hb = setInterval(() => {
      if (!this.client.isReady?.() || this.client.ws?.status !== WS_READY) return;
      this._request('POST', '/sdk/v1/heartbeat', { version: this.version }).catch((err) => this._log('heartbeat', err.message));
    }, HEARTBEAT_MS);
    hb.unref?.();
    this._timers.add(hb);

    let delay = 1_000;
    while (!this.stopped) {
      try {
        await this._hello();
        if (!this.connected) {
          this.connected = true;
          this.emit('connected');
          this._log(`połączono z ${this.url}`);
        }
        this.emit('ready');
        delay = 1_000;
        await this._listen(); // wraca po zerwaniu połączenia
      } catch (err) {
        if (this.stopped) break;
        if (err.code === 'UNAUTHORIZED') {
          this._warn(err.message);
          this.emit('error', err);
          this.stop();
          break;
        }
        this._log('błąd połączenia', err.message);
      }
      if (this.connected) {
        this.connected = false;
        this.emit('disconnected');
        this._warn('rozłączono z panelem zxCode – używam ostatnich ustawień, ponawiam połączenie');
      }
      await sleep(delay);
      delay = Math.min(delay * 2, 30_000);
    }
  }

  /** Strumień SSE ze zmianami na żywo. */
  async _listen() {
    this._abort = new AbortController();
    const res = await fetch(`${this.url}/sdk/v1/events`, {
      headers: { authorization: `Bearer ${this.key}`, accept: 'text/event-stream', 'user-agent': `zxcode-sdk/${SDK_VERSION}` },
      signal: this._abort.signal,
    });
    if (res.status === 401) {
      const err = new Error('Nieprawidłowy klucz zxCode (ZXCODE_KEY)');
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    if (!res.ok || !res.body) throw new Error(`strumień zdarzeń: HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event = 'message';
        const data = [];
        for (const line of chunk.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).trim());
        }
        if (data.length) this._onEvent(event, data.join('\n'));
      }
    }
  }

  _onEvent(event, raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (event === 'config') {
      this._applyConfig(data);
      this._saveCache();
    } else if (event === 'profile') {
      void this._applyProfile(data.profile ?? {}, data.revision ?? 0).then(() => this._saveCache());
    } else if (event === 'revoked') {
      this._warn('klucz został unieważniony w panelu zxCode – SDK zatrzymane');
      this.stop();
      this.emit('revoked');
    }
  }

  _bindEvents() {
    const c = this.client;
    const queue = (guild) => guild?.id && this._queueGuild(guild.id);
    c.on('guildCreate', queue);
    c.on('guildUpdate', (_o, g) => queue(g));
    c.on('channelCreate', (ch) => queue(ch.guild));
    c.on('channelUpdate', (_o, ch) => queue(ch.guild));
    c.on('channelDelete', (ch) => queue(ch.guild));
    c.on('roleCreate', (r) => queue(r.guild));
    c.on('roleUpdate', (_o, r) => queue(r.guild));
    c.on('roleDelete', (r) => queue(r.guild));
    c.on('guildDelete', (g) => {
      if (!this.connected) return;
      this._request('POST', '/sdk/v1/guilds', { removed: [g.id] }).catch(() => undefined);
    });
  }

  /** Zmiany kanałów/ról zbieramy przez kilka sekund i wysyłamy razem. */
  _queueGuild(guildId) {
    this._pendingGuilds.add(guildId);
    if (this._guildTimer) return;
    this._guildTimer = setTimeout(() => {
      this._guildTimer = null;
      const ids = [...this._pendingGuilds];
      this._pendingGuilds.clear();
      if (!this.connected) return;
      const guilds = ids.map((id) => this.client.guilds.cache.get(id)).filter(Boolean).map((g) => this._guildSnapshot(g));
      if (guilds.length) this._request('POST', '/sdk/v1/guilds', { guilds }).catch((err) => this._log('sync serwerów', err.message));
    }, GUILD_SYNC_DEBOUNCE);
    this._guildTimer.unref?.();
  }

  /** Ostatnie ustawienia zapisane lokalnie – bot działa z nimi, gdy panel jest niedostępny. */
  _loadCache() {
    if (!this.cacheFile) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
      if (data.key !== this.key.slice(0, 12)) return;
      for (const c of data.configs ?? []) this.configs.set(c.guildId, { values: c.values, permissions: c.permissions, revision: c.revision });
      this.profile = data.profile ?? {};
    } catch {
      /* brak pliku przy pierwszym starcie */
    }
  }

  _saveCache() {
    if (!this.cacheFile) return;
    const configs = [...this.configs.entries()].map(([guildId, c]) => ({ guildId, ...c }));
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify({ key: this.key.slice(0, 12), configs, profile: this.profile }), 'utf8');
    } catch (err) {
      this._log('zapis cache', err.message);
    }
  }
}

/**
 * Podłącza bota do panelu zxCode.
 *   const zx = zxcode(client, { modules: { … } });
 */
function zxcode(client, options) {
  return new ZxCode(client, options);
}

module.exports = zxcode;
module.exports.zxcode = zxcode;
module.exports.ZxCode = ZxCode;
module.exports.field = field;
module.exports.SDK_VERSION = SDK_VERSION;
module.exports.default = zxcode;
