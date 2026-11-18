<p align="center">
  <img src="assets/branding/banner.png" alt="zxCode" width="720">
</p>

# zxCode Bot

Bot Discord dla serwera **zxCode** (studio programowania botów): tickety, zlecenia, ręczne płatności, ogłoszenia, changelog, portfolio, opinie, moderacja i więcej.
Interfejs zbudowany na **Components v2**, z emotkami z paczki zxCode wgranymi jako **Application Emojis**.

> Status: etapy 1–3 – tickety, FAQ, logi, weryfikacja, zlecenia, płatności, cennik, portfolio, opinie, role klienta, **ogłoszenia, changelog z GitHubem, roadmapa, monitoring botów, przypomnienia, statystyki**. Plan: [Plan](#plan).

## Stack

| Warstwa                     | Technologia                              |
| --------------------------- | ---------------------------------------- |
| Bot                         | Node.js 22, TypeScript, discord.js 14.28 |
| Baza                        | PostgreSQL 16 + Prisma 7 (adapter `pg`)  |
| Cache / blokady / cooldowny | Redis 7 (ioredis)                        |
| Webhooki (GitHub)           | Fastify 5                                |
| Deploy                      | Docker + docker compose                  |

## Uruchomienie lokalne

1. **Aplikacja na Discordzie** ([Developer Portal](https://discord.com/developers/applications)):
   - Bot → włącz intenty **Server Members** i **Message Content**.
   - Zaproś bota z zakresami `bot` i `applications.commands` oraz uprawnieniami:
     _Zarządzanie kanałami, Zarządzanie rolami, Moderowanie członków, Wyrzucanie, Banowanie, Zarządzanie wiadomościami, Wyświetlanie kanałów, Wysyłanie wiadomości, Załączanie plików, Czytanie historii, Używanie zewnętrznych emoji_.
   - Rola bota musi być **wyżej** niż role, które ma nadawać (Klient, Stały klient, Zweryfikowany).
2. **Konfiguracja:**
   ```bash
   cp .env.example .env      # uzupełnij DISCORD_TOKEN, DISCORD_CLIENT_ID, GUILD_ID
   npm install
   docker compose -f docker/docker-compose.dev.yml up -d   # PostgreSQL + Redis
   npm run db:migrate        # tworzy tabele (na Termuxie: npm run db:apply)
   npm run emojis:sync       # wgrywa 56 emotek jako Application Emojis (jednorazowo)
   npm run dev               # start z automatycznym przeładowaniem
   ```
3. Na serwerze: `/config pokaz`, a następnie ustaw kategorie, kanały i role (`/config kategoria`, `/config kanal`, `/config rola`).

Komendy rejestrują się automatycznie na serwerze z `GUILD_ID` przy każdym starcie (komendy serwerowe są widoczne od razu). Ręcznie: `npm run commands:deploy`.

## Tickety

**Konfiguracja (raz):**

```
/config kategoria typ:Kategoria ticketów   kategoria:🎫 TICKETY
/config kategoria typ:Archiwum ticketów    kategoria:📁 ARCHIWUM
/config rola      typ:Obsługa              rola:@Support
/config kanal     typ:Logi                 kanal:#logi
/config kanal     typ:Transkrypty ticketów kanal:#transkrypty
/config kanal     typ:Alerty dla obsługi   kanal:#alerty
/config tickety   auto_zamkniecie:48 sla:12
/ticket panel     kanal:#pomoc
```

**Jak to działa:**

- Panel ma select menu z 5 kategoriami (zamówienie, wsparcie, współpraca, pytanie, reklamacja). Każda otwiera własny formularz (modal v2 z selectami i uploadem plików).
- Ticket to kanał w kategorii ticketów z panelem sterowania i menu **⚙️ Zarządzaj ticketem**: przejmij/zwolnij, priorytet, dodaj/usuń osobę, notatka, przypomnij klientowi, zamknij. Akcje obsługi są zablokowane dla klienta.
- Po każdym wyborze bot odświeża panel, więc tę samą opcję można wybrać ponownie.
- Wszystkie komunikaty (przejęcie, zmiana priorytetu, opinie, alerty, logi) to jednolite karty z avatarem i zmianą „przed ➜ po”.
- Limity: 1 ticket na kategorię, 3 naraz na osobę, 30 s cooldownu. Discord pozwala na 50 kanałów w kategorii.
- Bot podpowiada artykuły FAQ, jeśli słowa kluczowe pasują do treści formularza.
- **SLA:** gdy klient czeka dłużej niż `sla` godzin, bot pinguje obsługę na kanale alertów (raz, do następnej odpowiedzi).
- **Auto-zamykanie:** gdy obsługa odpisała, a klient milczy `auto_zamkniecie` godzin, bot ostrzega z przyciskiem „Zostaw otwarty”. Po kolejnych maks. 24 h zamyka ticket.
- **Zamknięcie:** transkrypt HTML trafia na kanał transkryptów, klient dostaje DM z podsumowaniem i oceną 1–5 ⭐ (select menu i opcjonalny komentarz) oraz osobną wiadomość z transkryptem. Kanał idzie do archiwum (widoczny tylko dla obsługi) albo zostaje usunięty, jeśli archiwum nie ma lub jest pełne. Z archiwum można go ponownie otworzyć albo usunąć.
- Oceny ≤ 2 ⭐ trafiają też na kanał alertów.

**Komendy:**

| Komenda                            | Kto            | Opis                                                             |
| ---------------------------------- | -------------- | ---------------------------------------------------------------- |
| `/ticket panel`                    | admin          | wysyła panel z banerem                                           |
| `/ticket zamknij [powod]`          | autor, obsługa | zamyka ticket                                                    |
| `/ticket dodaj` / `usun`           | obsługa        | dostęp dodatkowych osób                                          |
| `/ticket priorytet`                | obsługa        | 🟢 niski, 🔵 normalny, 🟠 wysoki, 🔴 pilny                       |
| `/ticket lista`                    | obsługa        | otwarte tickety według priorytetu, z czasem oczekiwania          |
| `/ticket statystyki [okres]`       | obsługa        | liczby, czas 1. odpowiedzi i rozwiązania, oceny, ranking obsługi |
| `/odpowiedz <szablon>`             | obsługa        | gotowa odpowiedź (`{klient}`, `{obsluga}`, `{ticket}`)           |
| `/szablon dodaj/edytuj/usun/lista` | obsługa        | szablony odpowiedzi                                              |
| `/notatka dodaj/lista`             | obsługa        | notatki wewnętrzne (klient ich nie widzi)                        |
| `/faq pokaz/lista`                 | wszyscy        | baza pytań (obsługa może wysłać publicznie)                      |
| `/faq dodaj/edytuj/usun`           | obsługa        | artykuły ze słowami kluczowymi                                   |

## Logi

`/logi konfiguracja` otwiera panel. W select menu wybierasz typ logów (albo „Wszystkie typy naraz”), a potem kanał. Drugie menu ustawia kanały i kategorie pomijane w logach. Typ bez kanału jest wyłączony. `/logi test` wysyła testowy wpis na każdy ustawiony kanał.

| Typ            | Co trafia                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| Wiadomości     | usunięte (z treścią i załącznikami), edytowane (przed ➜ po), masowe czyszczenie (plik .txt), przypięcia      |
| Członkowie     | wejścia (⚠️ nowe konta < 7 dni), wyjścia (role, staż), pseudonimy, nadane/odebrane role, boosty, weryfikacja |
| Moderacja      | bany, odbany, kicki, wyciszenia (timeout), czystki, AutoMod, alerty rajdu                                    |
| Kanały głosowe | dołączenia, wyjścia, przeniesienia, rozłączenia przez moderację                                              |
| Kanały         | tworzenie, usuwanie, zmiany (nazwa, temat, tryb powolny…), uprawnienia, wątki                                |
| Role           | tworzenie, usuwanie, zmiany (uprawnienia po polsku jako ➕/➖, kolor, nazwa)                                 |
| Serwer         | ustawienia, zaproszenia, webhooki, emotki, naklejki, dodane boty                                             |

Wykonawcę i powód akcji bot bierze z dziennika zdarzeń Discorda. Własne akcje bota (kanały ticketów, rola po weryfikacji) są pomijane, bo bot loguje je sam.
Wiadomości wysłane przed uruchomieniem bota nie są w pamięci, więc przy ich usunięciu log pokaże „treść niedostępna”.

## Weryfikacja

**Konfiguracja:**

1. Utwórz rolę **Zweryfikowany** i ustaw ją: `/config rola typ:Zweryfikowany`. Opcjonalnie dodaj rolę **Niezweryfikowany**, nadawaną automatycznie przy wejściu.
2. Uprawnienia kanałów: `@everyone` widzi tylko kanał weryfikacji, a rola Zweryfikowany widzi resztę serwera.
3. `/weryfikacja ustawienia tryb:Captcha min_wiek_konta:3 antyrajd:true antyrajd_limit:10 antyrajd_sekundy:30`
4. `/weryfikacja panel kanal:#weryfikacja regulamin:#regulamin`

**Jak to działa:**

- **Captcha:** obrazek z 5-znakowym kodem (generowany w czystym JS, działa też na Termuxie) i okienko do wpisania kodu. Masz 3 próby i każda błędna daje nowy obrazek. Po 3 błędach następuje 10 min przerwy. Kod jest ważny 5 min.
- **Jedno kliknięcie:** alternatywny tryb bez captchy.
- **Wiek konta:** zbyt nowe konta dostają informację, kiedy będą mogły się zweryfikować. Próba trafia do logów.
- **Ochrona przed rajdem:** gdy w krótkim czasie wejdzie dużo osób (np. 10 w 30 s), weryfikacja zostaje wstrzymana. Obsługa dostaje alert z przyciskiem **Odblokuj weryfikację**. Ręcznie: `/weryfikacja blokada`.
- `/weryfikacja zweryfikuj @osoba` to ręczna weryfikacja przez obsługę. `/weryfikacja statystyki` pokazuje dziś, 7 i 30 dni.

## Zlecenia i płatności

**Tworzenie:** w tickecie wybierz w menu ⚙️ **Utwórz zlecenie**. Formularz wypełni się danymi z ticketu (projekt, opis, budżet klienta). Można też użyć `/zlecenie utworz`. Panel zlecenia zostaje przypięty w kanale ticketu.

**Panel zlecenia:** oś statusów (Wycena › Akceptacja › Płatność › Realizacja › Testy › Dostarczone › Koniec), cena z rabatem, wpłacono / do zapłaty, termin, repozytorium, proformy i checklista zadań. Menu **Zarządzaj zleceniem** (dla obsługi):

- **Zmień status:** klient dostaje kartę w DM, panel się odświeża, a wpis trafia do logów.
- **Edytuj szczegóły:** tytuł, opis, cena, termin (`dd.mm.rrrr`, `dd.mm`, `+14`), repozytorium.
- **Dodaj zadania / Odhacz zadania:** checklista z paskiem postępu.
- **Zapisz wpłatę:** saldo liczy się samo. Po pełnej spłacie proformy są oznaczane jako opłacone, a status przechodzi z „Płatność” na „Realizacja”.
- **Wystaw proformę:** dokument HTML (do druku lub zapisu jako PDF) z danymi z `/config platnosci` i tytułem przelewu `ZX-0042 PF/2026/11/0001`. Trafia do ticketu i w DM, a status zmienia się na „Płatność”.
- **Kod rabatowy:** procentowy (przeliczany przy zmianie ceny) albo kwotowy, z limitem użyć.

Klient akceptuje wycenę przyciskiem w panelu. Dzień przed terminem płatności dostaje przypomnienie, a po terminie proforma jest oznaczana jako zaległa i obsługa dostaje alert.

**Zakończenie zlecenia:** rola **Klient** (1+ zleceń) i **Stały klient** (3+), odznaki w `/profil` i prośba o opinię w DM.

| Komenda                                                 | Kto     | Opis                                                               |
| ------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| `/zlecenie moje` / `info [numer]`                       | klient  | lista i szczegóły swoich zleceń                                    |
| `/zlecenie lista [status]`                              | obsługa | aktywne lub wybrane zlecenia                                       |
| `/zlecenie utworz / status / wplata / proforma / panel` | obsługa | to samo, co w menu panelu, plus przeniesienie panelu               |
| `/profil [osoba]`                                       | wszyscy | odznaki, zlecenia, opinie (kwoty widzi tylko właściciel i obsługa) |

## Cennik, portfolio, opinie

- `/cennik domyslne` dodaje przykładowe pakiety i pozycje kalkulatora do edycji. `/cennik panel` wysyła panel z banerem. Przycisk **Zamów** przy pakiecie otwiera ticket z wypełnionym formularzem.
- **Kalkulator wyceny:** klient zaznacza funkcje w select menu, wpisuje kod rabatowy i klika **Zamów ten zestaw**. Otwiera się ticket z listą funkcji i ceną.
- `/cennik pakiet|pozycja dodaj/usun` (ta sama nazwa = edycja), `/cennik rabat dodaj/lista/usun`.
- `/portfolio dodaj` przyjmuje do 4 zrzutów ekranu, zapisanych w bazie, więc linki nie wygasają. `/portfolio przegladaj` to przeglądarka ◀ ▶, a `/portfolio panel` to publiczny panel.
- **Opinie:** prośba w DM po zakończeniu zlecenia (lub `/opinia`), akceptacja przez obsługę na kanale alertów, publikacja na kanale **Opinie**. `/opinie` pokazuje średnią i najnowsze. Średnia trafia też do panelu cennika.

## Ogłoszenia

`/ogloszenie nowe [kanal]` otwiera formularz: tytuł, treść (markdown), obrazek, przyciski z linkami (`Nazwa | https://…`) i ping. Po wysłaniu formularza dostajesz **edytor**: podgląd 1:1, a pod nim wybór pingu (brak / @everyone / @here / dowolna rola), kanału i przyciski **Opublikuj teraz**, **Zaplanuj** (np. `jutro 18:00`, `24.12 12:00`, czas polski), **Edytuj**, **Usuń**.

- Na kanale typu „Ogłoszenia” bot sam robi crosspost do serwerów obserwujących.
- Opublikowane ogłoszenie można edytować (wiadomość zmienia się w miejscu, bez ponownego pingu) albo usunąć.
- `/ogloszenie lista` pokazuje szkice, zaplanowane i opublikowane, z menu otwierającym edytor.

## Changelog i roadmapa

- `/changelog projekt dodaj nazwa [repo] [rola] [kanal]` tworzy projekt. Z **rolą** subskrypcja = nadanie roli i ping przy nowej wersji. Bez roli subskrybenci dostają DM.
- `/changelog nowy projekt wersja` otwiera formularz z sekcjami ✨ Dodano / 🔧 Zmieniono / 🐛 Naprawiono / 🗑️ Usunięto (każda zmiana w nowej linii). Dostajesz szkic z podglądem i przyciskami Opublikuj / Edytuj / Odrzuć.
- Pod każdym wpisem jest przycisk **🔔 Powiadamiaj mnie**. `/changelog historia` pozwala przeglądać wersje strzałkami ◀ ▶. `/changelog szkice` pokazuje nieopublikowane.
- **GitHub:** w repozytorium ustaw webhook `https://TWÓJ-SERWER/webhooks/github` (typ `application/json`, sekret = `GITHUB_WEBHOOK_SECRET`, zdarzenie **Releases**). Opublikowany release tworzy szkic na kanale alertów. Parser rozpoznaje nagłówki PL/EN i prefiksy `feat:` / `fix:` / `refactor:`.
- `/roadmapa pokaz [projekt]` (wszyscy), `/roadmapa dodaj / status / usun` (obsługa): 🗓️ W planach, 🛠️ W trakcie, ✅ Gotowe.

## Monitoring botów klientów

`/monitoring dodaj nazwa tryb [adres] [bot] [wlasciciel]`:

| Tryb         | Jak działa                                                                                      | Kiedy używać                                                |
| ------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 🌐 HTTP      | bot co minutę odpytuje adres health-check (200 = działa, JSON `{"version": "…"}` pokaże wersję) | bot klienta ma publiczny adres                              |
| 💓 Heartbeat | bot klienta co minutę wywołuje `GET/POST /heartbeat/<token>` (gotowy kod w odpowiedzi komendy)  | bot na hostingu bez publicznego adresu; wymaga `PUBLIC_URL` |
| 🟢 Presence  | status online konta bota na serwerze zxCode                                                     | wymaga Presence Intent i `ENABLE_PRESENCE_INTENT=true`      |

Dwa nieudane sprawdzenia z rzędu dają alert 🔴 na kanale alertów (z pingiem obsługi) i DM do klienta. Po powrocie przychodzi 🟢 z czasem przerwy. `/monitoring panel` wysyła **tablicę statusu**, która aktualizuje się sama. `/status` pokazuje ją każdemu, `/monitoring lista | sprawdz | heartbeat | usun` służą obsłudze.

## Przypomnienia i statystyki

- `/przypomnij kiedy:… tresc:… [zlecenie]` przyjmuje `30m`, `2h`, `1h30m`, `3d`, `18:00`, `jutro 10:00`, `24.12 18:00` (czas polski). Przypomnienie przychodzi w DM z przyciskami **Odłóż 1h**, **Jutro 9:00**, **Gotowe**. Przy zablokowanym DM trafia na kanał, na którym je ustawiono. `/przypomnienia` pokazuje listę z możliwością usuwania.
- `/statystyki [okres]` (obsługa): członkowie (wejścia/wyjścia), wiadomości dziennie z mini-wykresem i wykresem PNG, weryfikacje, tickety (czas 1. odpowiedzi, oceny), zlecenia, opinie. Wpłaty i należności widzi tylko administracja.

## Produkcja (VPS)

```bash
cp .env.example .env    # uzupełnij; DATABASE_URL/REDIS_URL ustawia compose
docker compose -f docker/docker-compose.yml up -d --build
```

Kontener przy starcie wykonuje `prisma migrate deploy`. Healthcheck: `GET /health`.
Webhook GitHuba: `POST /webhooks/github` (content type `application/json`, sekret = `GITHUB_WEBHOOK_SECRET`).

## Skrypty

| Skrypt                                  | Opis                                        |
| --------------------------------------- | ------------------------------------------- |
| `npm run dev`                           | bot w trybie watch (tsx)                    |
| `npm run build` / `npm start`           | kompilacja do `dist/` i start               |
| `npm run typecheck` / `lint` / `format` | jakość kodu                                 |
| `npm run db:migrate`                    | nowa migracja (dev)                         |
| `npm run db:deploy`                     | migracje na produkcji                       |
| `npm run emojis:sync [-- --force]`      | wgranie / podmiana emotek z `assets/emojis` |
| `npm run commands:deploy`               | ręczna rejestracja komend                   |

## Struktura

```
src/
├─ index.ts              start: env → db → moduły → HTTP → login
├─ client.ts             ZxClient (moduły, komendy, handlery)
├─ config/               env (walidacja zod), stałe, kolory
├─ core/
│  ├─ types.ts           kontrakt BotModule, komend, handlerów, zadań
│  ├─ loader.ts          rejestracja modułów
│  ├─ interactions.ts    router: komendy + customId "modul:akcja:args"
│  ├─ registry.ts        rejestracja komend (guild)
│  ├─ scheduler.ts       zadania cykliczne
│  ├─ config-service.ts  GuildConfig z cache w Redis
│  ├─ permissions.ts     everyone / staff / admin
│  ├─ audit.ts           dziennik akcji admina (baza + kanał)
│  └─ errors.ts          UserError, bezpieczne odpowiedzi
├─ ui/
│  ├─ emojis.ts          e('ticket'), emojiComponent('lock') + zapasowe unicode
│  ├─ theme.ts           tony: info / success / client / warning / error / brand
│  ├─ assets.ts          baner i logo jako załączniki
│  ├─ builders/          Panel (Container v2), Form (modal v2), przyciski, paginacja, payload
│  └─ components/        gotowe komunikaty (success/failure/info/warning)
├─ modules/              każdy moduł w osobnym katalogu + wpis w modules/index.ts
├─ db/                   klient Prisma i Redis
├─ http/                 Fastify, webhook GitHuba (weryfikacja HMAC)
└─ utils/                formatowanie (ZX-0042, kwoty, czas), blokady, logger
```

## Jak dodać moduł

```ts
// src/modules/przyklad/index.ts
import { SlashCommandBuilder } from 'discord.js';
import { defineCommand, defineComponent, defineModule } from '../../core/types.js';
import { Panel } from '../../ui/builders/container.js';
import { button } from '../../ui/builders/buttons.js';
import { v2, v2Message } from '../../ui/builders/payload.js';

export const przykladModule = defineModule({
  name: 'przyklad',
  description: 'Moduł przykładowy',
  commands: [
    defineCommand({
      data: new SlashCommandBuilder().setName('hej').setDescription('Przywitaj się'),
      access: 'everyone', // 'staff' | 'admin'
      cooldown: 5,
      run: (i) =>
        i.reply(
          v2(
            new Panel({ tone: 'brand' })
              .title('rocket', 'Cześć!')
              .text('To jest panel Components v2.')
              .buttons(button('przyklad:klik:42', 'Kliknij', { style: 'primary', emoji: 'star' })),
            { ephemeral: true },
          ),
        ),
    }),
  ],
  components: [
    defineComponent({
      id: 'przyklad:klik', // customId "przyklad:klik:42" → args = ['42']
      type: 'button',
      run: (i, [id]) => i.update(v2Message(new Panel({ tone: 'success' }).text(`Kliknięto #${id}`))),
    }),
  ],
});
```

Na koniec dopisz moduł do `src/modules/index.ts`. Router sam sprawdzi, czy moduł jest włączony, czy trwa tryb serwisowy, czy użytkownik ma uprawnienia i czy minął cooldown.

### Zasady

- **Components v2:** wiadomość z flagą `IsComponentsV2` nie może mieć `content` ani `embeds`, cały tekst idzie przez `Panel.text()`. Odpowiedzi buduj przez `v2()`, wiadomości na kanał i edycje przez `v2Message()`.
- **Wygląd:** wszystkie komunikaty buduj przez `card()` (ikona z paczki tylko w nagłówku, pola `**Etykieta:** wartość`, kolor paska = charakter zdarzenia). **Bez standardowych emotek Discorda.** Statusy jako znaczniki `badge('W obsłudze')`, listy zmian w `diffBlock()` (`+` zielone, `-` czerwone), kwoty i liczby w `tableBlock()`, treści użytkowników w `codeBlock()`.
- **Emotki** tylko przez `e('nazwa')` / `emojiComponent('nazwa')`, nigdy przez ID wpisane na sztywno.
- **customId:** `modul:akcja:arg1:arg2` (limit 100 znaków).
- **Błędy dla użytkownika:** `throw new UserError('…')` pokaże czytelny komunikat ephemeral.
- **Podwójne kliknięcia:** operacje zmieniające stan opakowuj w `withLock()`.
- **Akcje administracyjne** zapisuj przez `audit()`.
- ID kanałów i ról **nie** trafiają do `.env`. Ustawia się je w `/config` i trzyma w tabeli `GuildConfig`.

## Plan

1. **MVP:** gotowe – rdzeń, UI, baza, `/config`, `/serwis`, tickety, FAQ, logi, weryfikacja
2. **Biznes:** gotowe – zlecenia `ZX-xxxx`, płatności ręczne i proforma, cennik z kalkulatorem, portfolio, opinie, role klienta
3. **Automatyzacja:** gotowe – ogłoszenia (planowane), changelog z GitHuba, roadmapa, monitoring botów klientów, statystyki, przypomnienia
4. **Do zrobienia:** giveaway, partnerstwa
5. **Później (opcjonalnie):** user-install (`/portfolio`, `/cennik` w DM i na innych serwerach)

Świadomie poza zakresem: moderacja (warny, wyciszenia, bany – kary nadawane w Discordzie i tak trafiają do logów), dashboard WWW, kopie zapasowe w bocie, Scheduled Events, snippety, propozycje, powitania, self-role.
