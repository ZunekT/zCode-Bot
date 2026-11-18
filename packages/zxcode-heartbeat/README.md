# zxcode-heartbeat

Monitoring bota Discord przez **zxCode**. Bot sam co minutę zgłasza, że działa. Jeśli przestanie (awaria, restart hostingu, zawieszenie), zxCode dostaje alert, a Ty wiadomość prywatną. Po powrocie przychodzi informacja, ile trwała przerwa.

- jedna linijka kodu,
- zero zależności, Node.js 18+ i discord.js v14,
- działa na każdym hostingu: bot niczego nie wystawia, tylko wysyła zgłoszenie,
- zgłasza się tylko wtedy, gdy bot jest naprawdę połączony z Discordem, a nie tylko gdy działa proces.

## Instalacja

```bash
npm install zxcode-heartbeat
```

## Użycie

1. Adres heartbeat dostajesz od zxCode (komenda `/monitoring dodaj … tryb:Heartbeat`). Wpisz go do `.env` bota:

   ```ini
   ZXCODE_HEARTBEAT_URL=https://bot.zxcode.pl/heartbeat/twoj-token
   ```

2. Dodaj jedną linijkę po utworzeniu klienta:

   ```js
   // CommonJS
   const heartbeat = require('zxcode-heartbeat');

   heartbeat(client);
   ```

   ```js
   // ESM / TypeScript
   import heartbeat from 'zxcode-heartbeat';

   heartbeat(client);
   ```

Gotowe. Heartbeat startuje sam, gdy bot się zaloguje. Wersję bota bierze z `package.json`, więc pokaże się na tablicy statusu zxCode.

## Opcje

```js
heartbeat(client, {
  url: process.env.ZXCODE_HEARTBEAT_URL, // domyślnie ze zmiennej środowiskowej
  version: '2.1.0', // domyślnie z package.json
  interval: 60_000, // ms, minimum 15000
  debug: true, // wypisuje każde zgłoszenie
  onError: (err) => console.error(err), // zamiast domyślnego ostrzeżenia
});
```

Funkcja zwraca kontroler:

```js
const hb = heartbeat(client);
await hb.beat(); // zgłoszenie od razu (true = przyjęte)
hb.stop(); // zatrzymanie
hb.running; // czy działa
```

## Pełny przykład

```js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const heartbeat = require('zxcode-heartbeat');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

heartbeat(client);

client.once('clientReady', () => console.log(`Zalogowano jako ${client.user.tag}`));
client.login(process.env.DISCORD_TOKEN);
```

## Błędy

Problem z wysłaniem zgłoszenia (np. brak internetu, zły adres) nie wyłącza bota. Pakiet wypisze jedno ostrzeżenie na serię błędów i będzie próbował dalej. `HTTP 404 (nieznany token)` oznacza, że adres jest niepełny albo bot został usunięty z monitoringu.
