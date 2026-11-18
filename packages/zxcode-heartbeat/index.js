'use strict';

/**
 * zxcode-heartbeat
 * Bot klienta co minutę zgłasza się do monitoringu zxCode.
 * Brak zgłoszenia przez 3 minuty = alert dla obsługi i DM do klienta.
 */

const URL_RE = /^https?:\/\/[^\s/]+(?:\/[^\s]*)?\/heartbeat\/[a-f0-9]{48}$/i;
const MIN_INTERVAL = 15_000;
const DEFAULT_INTERVAL = 60_000;
const REQUEST_TIMEOUT = 10_000;
const WS_READY = 0; // discord.js: Status.Ready

function readVersion() {
  if (process.env.npm_package_version) return process.env.npm_package_version;
  try {
    // package.json bota (katalog, z którego go uruchomiono)
    return require(require('node:path').join(process.cwd(), 'package.json')).version;
  } catch {
    return undefined;
  }
}

/**
 * Podłącza heartbeat do klienta discord.js.
 *
 * @param {import('discord.js').Client} client
 * @param {{ url?: string, version?: string, interval?: number, debug?: boolean, onError?: (err: Error) => void }} [options]
 * @returns {{ beat: () => Promise<boolean>, stop: () => void, readonly running: boolean }}
 */
function heartbeat(client, options = {}) {
  if (!client || typeof client.once !== 'function') {
    throw new TypeError('zxcode-heartbeat: pierwszym argumentem musi być klient discord.js');
  }

  const url = (options.url ?? process.env.ZXCODE_HEARTBEAT_URL ?? '').trim();
  if (!URL_RE.test(url)) {
    throw new Error(
      'zxcode-heartbeat: brak albo nieprawidłowy adres heartbeat. ' +
        'Ustaw ZXCODE_HEARTBEAT_URL (adres z /monitoring na serwerze zxCode) albo podaj { url }.',
    );
  }

  const interval = Math.max(MIN_INTERVAL, Number(options.interval) || DEFAULT_INTERVAL);
  const version = options.version ?? readVersion();
  const target = version ? `${url}?version=${encodeURIComponent(String(version).slice(0, 40))}` : url;
  const log = (...args) => options.debug && console.log('[zxcode-heartbeat]', ...args);

  let timer = null;
  let failing = false;

  const isConnected = () =>
    typeof client.isReady === 'function' ? client.isReady() && client.ws?.status === WS_READY : false;

  /** Jedno zgłoszenie. Zwraca true, gdy serwer je przyjął. */
  async function beat() {
    // Zgłaszamy się tylko, gdy bot jest naprawdę połączony z Discordem – sam działający proces to za mało.
    if (!isConnected()) {
      log('pomijam – bot nie jest połączony z Discordem');
      return false;
    }
    try {
      const res = await fetch(target, {
        method: 'POST',
        headers: { 'user-agent': 'zxcode-heartbeat/1.0' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });
      if (!res.ok)
        throw new Error(
          `serwer odpowiedział HTTP ${res.status}${res.status === 404 ? ' (nieznany token)' : ''}`,
        );
      if (failing) log('połączenie z monitoringiem przywrócone');
      failing = false;
      log('ok');
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      // Błąd zgłaszamy raz na serię, żeby nie zaśmiecać logów bota co minutę.
      if (!failing) {
        failing = true;
        if (options.onError) options.onError(error);
        else console.warn(`[zxcode-heartbeat] nie udało się wysłać heartbeatu: ${error.message}`);
      }
      return false;
    }
  }

  function start() {
    if (timer) return;
    log(`start – co ${interval / 1000}s`);
    void beat();
    timer = setInterval(() => void beat(), interval);
    // Heartbeat nie powinien trzymać procesu przy życiu po wyłączeniu bota.
    if (typeof timer.unref === 'function') timer.unref();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    log('stop');
  }

  if (typeof client.isReady === 'function' && client.isReady()) start();
  else {
    // discord.js 14.22+ używa „clientReady”, starsze wersje „ready”.
    client.once('clientReady', start);
    client.once('ready', start);
  }

  return {
    beat,
    stop,
    get running() {
      return timer !== null;
    },
  };
}

module.exports = heartbeat;
module.exports.heartbeat = heartbeat;
module.exports.default = heartbeat;
