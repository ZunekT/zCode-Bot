'use strict';

const crypto = require('node:crypto');

const CMS_VERSION = '1.0.0';
const DEFAULT_URL = 'https://bot.zxcode.pl';
const KEY_RE = /^zxs_\d+_[a-f0-9]{48}$/;
const KEY_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
const SCHEMA_RETRY_MS = 60_000;
const MAX_SKEW_S = 300;

function makeField(type, opts = {}) {
  if (!opts || typeof opts.label !== 'string' || !opts.label) throw new TypeError(`zxcode-cms: pole typu ${type} wymaga „label”`);
  return { __zxCmsField: true, type, ...opts };
}

const field = {
  text: (o) => makeField('text', o),
  textarea: (o) => makeField('textarea', o),
  number: (o) => makeField('number', o),
  toggle: (o) => makeField('boolean', o),
  select: (o) =>
    makeField('select', {
      ...o,
      options: (o && o.options ? o.options : []).map((x) => (typeof x === 'string' ? { value: x, label: x } : x)),
    }),
  color: (o) => makeField('color', o),
  url: (o) => makeField('url', o),
  image: (o) => makeField('image', o),
  list: (o) => makeField('list', o),
};

function toFields(fields, where, nested) {
  return Object.entries(fields || {}).map(([key, f]) => {
    if (!KEY_NAME_RE.test(key)) throw new TypeError(`zxcode-cms: nieprawidłowy klucz pola „${where}.${key}” (litery, cyfry, _; zaczyna się od litery)`);
    if (!f || !f.__zxCmsField) throw new TypeError(`zxcode-cms: „${where}.${key}” musi być utworzone przez field.*()`);
    const { __zxCmsField, fields: sub, max, ...rest } = f;
    const out = { key, ...rest };
    if (f.type === 'list') {
      if (nested) throw new TypeError(`zxcode-cms: lista w liście nie jest obsługiwana („${where}.${key}”)`);
      out.fields = toFields(sub, `${where}.${key}`, true);
      if (max !== undefined) out.maxItems = max;
    }
    return out;
  });
}

function buildSchema(sections) {
  return {
    sections: Object.entries(sections || {}).map(([key, s]) => {
      if (!KEY_NAME_RE.test(key)) throw new TypeError(`zxcode-cms: nieprawidłowy klucz sekcji „${key}”`);
      if (!s || typeof s.label !== 'string') throw new TypeError(`zxcode-cms: sekcja „${key}” wymaga „label”`);
      const out = { key, label: s.label, fields: toFields(s.fields, key, false) };
      if (s.description) out.description = s.description;
      return out;
    }),
  };
}

function emptyOf(f) {
  if (f.default !== undefined && f.type !== 'image') return f.default;
  switch (f.type) {
    case 'boolean':
      return false;
    case 'number':
    case 'image':
      return null;
    case 'list':
      return [];
    case 'select':
      return f.options && f.options[0] ? f.options[0].value : '';
    default:
      return '';
  }
}

function defaultsOf(schema) {
  const out = {};
  for (const s of schema.sections) {
    out[s.key] = {};
    for (const f of s.fields) out[s.key][f.key] = emptyOf(f);
  }
  return out;
}

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

function verifySignature(key, timestamp, signature, body, now = Date.now()) {
  if (!KEY_RE.test(String(key)) || typeof timestamp !== 'string' || typeof signature !== 'string') return false;
  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(now / 1000 - ts) > MAX_SKEW_S) return false;
  const expected = `sha256=${crypto.createHmac('sha256', sha256(key)).update(`${timestamp}.${body}`).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSite(options = {}) {
  const key = options.key !== undefined ? options.key : process.env.ZXCODE_SITE_KEY;
  const url = String(options.url || process.env.ZXCODE_URL || DEFAULT_URL).replace(/\/$/, '');
  const schema = buildSchema(options.sections);
  const defaults = defaultsOf(schema);
  const tag = options.tag || 'zxcode-cms';
  const revalidate = options.revalidate === undefined ? 300 : options.revalidate;
  const ttl = (options.ttl === undefined ? 15 : options.ttl) * 1000;
  const timeout = options.timeout || 5000;
  const log = options.debug ? (...a) => console.log('[zxcode-cms]', ...a) : () => {};
  const warn = (...a) => console.warn('[zxcode-cms]', ...a);
  const enabled = KEY_RE.test(String(key || ''));
  if (!enabled) warn('Brak poprawnego klucza ZXCODE_SITE_KEY – strona użyje treści domyślnych.');

  let lastGood = null;
  let cachedAt = 0;
  let schemaSent = null;
  let schemaFailedAt = 0;

  const headers = () => ({ authorization: `Bearer ${key}`, 'user-agent': `zxcode-cms/${CMS_VERSION}` });

  async function sendSchema() {
    if (schemaSent) return schemaSent;
    if (Date.now() - schemaFailedAt < SCHEMA_RETRY_MS) return null;
    schemaSent = (async () => {
      const res = await fetch(`${url}/cms/v1/schema`, {
        method: 'PUT',
        headers: { ...headers(), 'content-type': 'application/json' },
        body: JSON.stringify({ schema, webhookUrl: options.webhookUrl || null }),
        signal: AbortSignal.timeout(timeout),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      for (const w of data.warnings || []) warn(w);
      log('schemat zarejestrowany', data.hash);
      return data;
    })().catch((err) => {
      schemaSent = null;
      schemaFailedAt = Date.now();
      warn('Nie udało się wysłać schematu:', err.message);
      return null;
    });
    return schemaSent;
  }

  async function content() {
    if (!enabled) return defaults;
    if (ttl > 0 && lastGood && Date.now() - cachedAt < ttl) return lastGood;
    await sendSchema();
    try {
      const init = { headers: headers(), signal: AbortSignal.timeout(timeout) };
      if (revalidate === false) init.cache = 'no-store';
      else init.next = { revalidate, tags: [tag] };
      const res = await fetch(`${url}/cms/v1/content`, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      lastGood = data.content;
      cachedAt = Date.now();
      return lastGood;
    } catch (err) {
      warn('Nie udało się pobrać treści, używam ostatniej znanej:', err.message);
      return lastGood || defaults;
    }
  }

  async function section(name) {
    const c = await content();
    return c[name] || defaults[name] || {};
  }

  function webhook(onUpdate) {
    return async function handler(request) {
      const body = await request.text();
      const ok = verifySignature(key, request.headers.get('x-zxcode-timestamp'), request.headers.get('x-zxcode-signature'), body);
      if (!ok) return new Response(JSON.stringify({ error: 'invalid signature' }), { status: 401, headers: { 'content-type': 'application/json' } });
      let payload = {};
      try {
        payload = JSON.parse(body);
      } catch {}
      lastGood = null;
      cachedAt = 0;
      if (onUpdate) await onUpdate(payload);
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
    };
  }

  function invalidate() {
    lastGood = null;
    cachedAt = 0;
  }

  return { schema, defaults, tag, content, section, webhook, invalidate, sendSchema };
}

module.exports = { createSite, field, verifySignature, CMS_VERSION };
module.exports.default = module.exports;
