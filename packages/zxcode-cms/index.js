'use strict';

const crypto = require('node:crypto');

const CMS_VERSION = '1.1.0';
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
  richtext: (o) => makeField('richtext', o),
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


const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);

function safeHref(url) {
  const u = String(url).trim();
  if (u.startsWith('/') && !u.startsWith('//')) return u;
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  return null;
}

function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]{1,200})\]\(([^)\s]{1,500})\)/g, (m, label, url) => {
    const href = safeHref(url.replace(/&amp;/g, '&'));
    if (!href) return label;
    const ext = /^https?:/i.test(href);
    return `<a href="${escapeHtml(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  return out;
}

function renderRichText(src) {
  if (typeof src !== 'string' || !src.trim()) return '';
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) html.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{2,3})\s+(.+)$/.exec(line);
    const ul = /^[-*]\s+(.+)$/.exec(line);
    const ol = /^\d{1,3}[.)]\s+(.+)$/.exec(line);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (h) {
      flushPara();
      flushList();
      html.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`);
    } else if (ul || ol) {
      flushPara();
      const tag = ul ? 'ul' : 'ol';
      if (!list || list.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push((ul || ol)[1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return html.join('');
}

function maintenanceHtml(m) {
  const title = escapeHtml((m && m.title) || 'Przerwa techniczna');
  const message = escapeHtml((m && m.message) || 'Wprowadzamy ulepszenia. Wróć za chwilę.');
  const until = m && m.until ? new Date(m.until) : null;
  const when = until && !Number.isNaN(until.getTime()) ? `<p class="u">Planowany powrót: ${escapeHtml(until.toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Warsaw' }))}</p>` : '';
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0e13;color:#e9eef5}main{max-width:520px;text-align:center}.i{width:64px;height:64px;margin:0 auto 24px;border-radius:18px;display:grid;place-items:center;background:rgba(26,159,255,.12);border:1px solid rgba(26,159,255,.3)}.i:after{content:"";width:26px;height:26px;border:3px solid #1a9fff;border-top-color:transparent;border-radius:50%;animation:s 1.2s linear infinite}h1{font-size:clamp(26px,6vw,34px);margin:0 0 12px;letter-spacing:-.02em}p{color:#9aa6b6;line-height:1.6;margin:0 0 10px;white-space:pre-line}.u{color:#e9eef5;font-weight:600}@keyframes s{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.i:after{animation:none}}</style></head><body><main><div class="i"></div><h1>${title}</h1><p>${message}</p>${when}</main></body></html>`;
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
  let lastState = null;
  let stateAt = 0;
  const stateTtl = (options.stateTtl === undefined ? 15 : options.stateTtl) * 1000;
  const EMPTY_STATE = { stateRev: 0, announcement: null, maintenance: null, redirects: [], bypass: '' };
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

  async function content(opts = {}) {
    if (!enabled) return defaults;
    const draft = opts.draft === true;
    if (!draft && ttl > 0 && lastGood && Date.now() - cachedAt < ttl) return lastGood;
    await sendSchema();
    try {
      const init = { headers: headers(), signal: AbortSignal.timeout(timeout) };
      if (draft || revalidate === false) init.cache = 'no-store';
      else init.next = { revalidate, tags: [tag] };
      const res = await fetch(`${url}/cms/v1/content${draft ? '?draft=1' : ''}`, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.state) {
        lastState = data.state;
        stateAt = Date.now();
      }
      if (draft) return data.content;
      lastGood = data.content;
      cachedAt = Date.now();
      return lastGood;
    } catch (err) {
      warn('Nie udało się pobrać treści, używam ostatniej znanej:', err.message);
      return lastGood || defaults;
    }
  }

  async function state() {
    if (!enabled) return EMPTY_STATE;
    if (lastState && Date.now() - stateAt < stateTtl) return lastState;
    try {
      const res = await fetch(`${url}/cms/v1/state`, { headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(timeout) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      lastState = data;
      stateAt = Date.now();
      return data;
    } catch (err) {
      warn('Nie udało się pobrać stanu strony:', err.message);
      if (lastState) stateAt = Date.now() - stateTtl + 5000;
      return lastState || EMPTY_STATE;
    }
  }

  const COOKIE = 'zxcode_bypass';
  const readCookie = (request, name) => {
    const raw = request.headers.get('cookie') || '';
    const m = raw.split(/;\s*/).find((c) => c.startsWith(`${name}=`));
    return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
  };
  const validBypass = (st, token) => !!token && !!st.bypass && sha256(token) === st.bypass;

  async function proxy(request) {
    const reqUrl = new URL(request.url);
    const path = reqUrl.pathname;
    if (path.startsWith('/_next/') || path.startsWith('/api/zxcode')) return undefined;
    const st = await state();
    const token = reqUrl.searchParams.get('zxcode-preview');
    if (token !== null) {
      reqUrl.searchParams.delete('zxcode-preview');
      const res = new Response(null, { status: 307, headers: { location: reqUrl.toString(), 'cache-control': 'no-store' } });
      if (validBypass(st, token))
        res.headers.append('set-cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`);
      return res;
    }
    const clean = path.replace(/\/+$/, '') || '/';
    const redirect = (st.redirects || []).find((r) => r.from === clean);
    if (redirect) {
      const target = new URL(redirect.to, reqUrl);
      if (redirect.to.startsWith('/')) target.search = reqUrl.search;
      return new Response(null, { status: redirect.permanent ? 308 : 307, headers: { location: target.toString() } });
    }
    if (st.maintenance && !validBypass(st, readCookie(request, COOKIE))) {
      if (/\.(png|jpe?g|gif|webp|svg|ico|css|js|woff2?|txt|xml)$/i.test(path)) return undefined;
      const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
      const until = st.maintenance.until ? Math.max(60, Math.round((new Date(st.maintenance.until).getTime() - Date.now()) / 1000)) : 3600;
      headers['retry-after'] = String(until);
      return new Response(maintenanceHtml(st.maintenance), { status: 503, headers });
    }
    return undefined;
  }

  function preview(enableDraft) {
    return async function handler(request) {
      const reqUrl = new URL(request.url);
      const token = reqUrl.searchParams.get('token') || '';
      const target = reqUrl.searchParams.get('path') || '/';
      const st = await state();
      if (!validBypass(st, token)) return new Response('Nieprawidłowy link podglądu', { status: 401 });
      if (enableDraft) await enableDraft();
      const safe = target.startsWith('/') && !target.startsWith('//') ? target : '/';
      const res = new Response(null, { status: 307, headers: { location: new URL(safe, reqUrl).toString(), 'cache-control': 'no-store' } });
      res.headers.append('set-cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`);
      return res;
    };
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
      lastState = null;
      stateAt = 0;
      if (onUpdate) await onUpdate(payload);
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
    };
  }

  function invalidate() {
    lastGood = null;
    cachedAt = 0;
    lastState = null;
    stateAt = 0;
  }

  return { schema, defaults, tag, content, section, state, proxy, preview, webhook, invalidate, sendSchema, trackerUrl: `${url}/cms/v1/t.js` };
}

module.exports = { createSite, field, verifySignature, renderRichText, maintenanceHtml, CMS_VERSION };
module.exports.default = module.exports;
