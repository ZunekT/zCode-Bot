# zxcode-sdk

Ustawienia bota Discord edytowane w panelu **zxcode.pl**. Deklarujesz w kodzie moduły i pola, a właściciel bota zmienia je na stronie: kanały, role, teksty, przełączniki. Bot dostaje zmiany na żywo, bez restartu.

Dodatkowo:
- **uprawnienia komend według ról** ustawiane w panelu (`zx.guard`),
- **profil bota** z panelu: status, aktywność, nazwa, avatar,
- **monitoring**: bot sam zgłasza, że działa, a przy awarii zxCode dostaje alert,
- **tryb offline**: ostatnie ustawienia są zapisane lokalnie, więc bot działa, nawet gdy panel jest niedostępny.

Zero zależności, Node.js 18+ i discord.js v14.

## Instalacja

```bash
npm install zxcode-sdk
```

W `.env` bota (klucz dostajesz od zxCode, komenda `/sdk dodaj`):

```ini
ZXCODE_KEY=zxk_12_...
ZXCODE_URL=https://bot.zxcode.pl
```

## Użycie

```js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { zxcode, field } = require('zxcode-sdk');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const zx = zxcode(client, {
  modules: {
    powitania: {
      label: 'Powitania',
      description: 'Wiadomość dla nowych osób na serwerze',
      toggle: true, // przełącznik włącz/wyłącz w panelu
      fields: {
        kanal: field.channel({ label: 'Kanał powitań', types: ['text'] }),
        tresc: field.textarea({ label: 'Treść', default: 'Witaj {user}!' }),
        rola: field.role({ label: 'Rola na start' }),
      },
    },
    ekonomia: {
      label: 'Ekonomia',
      fields: {
        waluta: field.text({ label: 'Nazwa waluty', default: 'monety', maxLength: 20 }),
        dzienna: field.number({ label: 'Nagroda dzienna', default: 100, min: 0, max: 100000, integer: true }),
        kolor: field.color({ label: 'Kolor embedów', default: '#1a9fff' }),
      },
    },
  },
});

client.on('guildMemberAdd', async (member) => {
  const cfg = zx.module(member.guild.id, 'powitania');
  if (!cfg.enabled || !cfg.kanal) return;
  const channel = member.guild.channels.cache.get(cfg.kanal);
  await channel?.send(cfg.tresc.replace('{user}', `<@${member.id}>`));
  if (cfg.rola) await member.roles.add(cfg.rola).catch(() => {});
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!(await zx.guard(interaction))) return; // uprawnienia z panelu
  // … obsługa komendy
});

client.login(process.env.DISCORD_TOKEN);
```

## Typy pól

| Pole | Wartość | Opcje |
|---|---|---|
| `field.toggle()` | `true` / `false` | – |
| `field.text()` | tekst | `maxLength` (domyślnie 2000) |
| `field.textarea()` | długi tekst | `maxLength` (domyślnie 6000) |
| `field.number()` | liczba | `min`, `max`, `integer` |
| `field.select()` | wartość z listy | `options`, `multiple` |
| `field.channel()` | ID kanału | `types` (`text`, `voice`, `category`, `announcement`, `forum`, `stage`), `multiple` |
| `field.role()` | ID roli | `multiple` |
| `field.color()` | `#rrggbb` | – |

Każde pole przyjmuje też `label`, `description`, `default` i `required`. Pole z `multiple: true` zwraca tablicę.

## API

```js
zx.get(guildId, 'ekonomia.waluta'); // wartość albo domyślna
zx.module(guildId, 'powitania'); // { enabled, kanal, tresc, rola }
zx.enabled(guildId, 'powitania'); // true / false
zx.can(member, 'ban'); // czy członek może użyć komendy
await zx.guard(interaction); // sprawdza i odpowiada przy braku uprawnień
await zx.set(guildId, { ekonomia: { waluta: 'zł' } }); // zgłoś zmianę od strony bota
zx.connected; // czy połączony z panelem
zx.stop();
```

Zdarzenia:

```js
zx.on('change', ({ guildId, module, values, previous }) => {
  // ktoś zmienił ustawienia modułu w panelu
});
zx.on('connected', () => {});
zx.on('disconnected', () => {}); // bot działa dalej na ostatnich ustawieniach
zx.on('revoked', () => {}); // klucz unieważniony (nowy klucz w panelu) – SDK zatrzymane
zx.on('error', (err) => {});
```

## Opcje

```js
zxcode(client, {
  key: process.env.ZXCODE_KEY,
  url: process.env.ZXCODE_URL, // domyślnie https://bot.zxcode.pl
  version: '2.1.0', // domyślnie z package.json
  modules: {},
  commands: ['komenda-bez-rejestracji'], // dodatkowe komendy do uprawnień
  presence: true, // stosuj status ustawiony w panelu
  denyMessage: 'Nie masz uprawnień do tej komendy.',
  cacheFile: '.zxcode-cache.json', // false = bez pliku offline
  debug: false,
});
```

## Uprawnienia komend

Właściciel bota w panelu wybiera, które role mogą używać danej komendy. Komenda bez reguły jest dostępna dla wszystkich. Administrator serwera ma dostęp zawsze. Wystarczy `if (!(await zx.guard(interaction))) return;` na początku obsługi komend.

Dodaj plik `.zxcode-cache.json` do `.gitignore`.
