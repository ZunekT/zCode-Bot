# zxCode – pamięć projektu

Studio zxCode: **strony internetowe i boty Discord** na zamówienie. W repo jest bot Discord (serce systemu),
strona zxcode.pl z panelem klienta i administracją (`web/`) oraz pakiety npm dla klientów (`packages/`).

## Właściciel i biznes
- Dorian Kaczyński, **działalność nierejestrowana**, kontakt@zxcode.pl. Adresu **nie publikujemy** (klienci to głównie
  osoby 18–20 lat z Discorda) – `web/src/lib/company.ts` ma pusty adres, komponent go nie renderuje.
- Limit przychodu działalności nierejestrowanej: domyślnie 10 813,50 zł / kwartał (zmienialny w Ewidencji). Strony są
  droższe niż boty – limit łatwo przekroczyć, warto go pilnować.
- Na stronie: tryb „Start wkrótce” (bramka) – właściciel, administratorzy i osoby z podglądem widzą pełną stronę.
  Przełącznik: `/strona uruchom | wkrotce | dodaj | usun | status` albo panel admina → Strona i serwer.

## Zasady współpracy (preferencje właściciela)
- Pisz po **polsku**. Właściciel pisze potocznie i bez polskich znaków – odpowiadaj normalnie, zwięźle.
- **Zero komentarzy w kodzie** (`//`, `/* */`, `/** */`, `#` w configach). Wyjątki: dyrektywy narzędzi
  (`eslint-disable`, `@ts-expect-error`). Pusty `catch {}` jest dozwolony (ESLint `allowEmptyCatch`).
- W wiadomościach bota **bez emoji unicode** – tylko paczka emotek zxCode (`src/ui/emojis.ts`, na stronie
  `web/public/emojis/*.png` przez komponent `Icon`).
- Wygląd: nowoczesny, „wow”, ale **wydajny** (płynność na telefonach). Animacje głównie CSS, jeden globalny skrypt
  efektów (`web/src/components/Fx.tsx`), wszystko wyłączane przy `prefers-reduced-motion`. Glassmorphism oszczędnie.
- **Bez duplikatów treści**: każda treść w jednym miejscu, inne strony tylko linkują (cennik tylko `/cennik`,
  realizacje tylko `/realizacje`, FAQ tylko `/faq`, opinie tylko `/opinie`). Strona główna to krótki hub z kafelkami.
- Nigdy nie proś o wklejenie sekretów na czacie. Sekrety wpisuje się w ukrytych promptach `docker/setup-panel.sh`.
  Nie commituj `.env`, nie wypisuj sekretów.
- Testuj **lokalnie**, nie na produkcji. Bez PR, chyba że właściciel poprosi.
- Commity po polsku; nie wpisuj identyfikatorów modeli do commitów ani kodu.
- Przy decyzjach biznesowych (ceny, obietnice dla klientów typu „odpowiedź w 24 h”) nie wymyślaj – zaproponuj, niech
  zdecyduje właściciel.

## Wdrożenie (produkcja)
- VPS na Mathost (Docker Compose), Caddy na hoście jako reverse proxy z HTTPS.
- Aktualizacja: `cd ~/zCode-Bot && git pull && bash docker/setup-panel.sh`
- Migracje Prisma uruchamiają się same przy starcie bota (`prisma migrate deploy` w `docker/Dockerfile`).
- Porty w compose tylko na 127.0.0.1: bot publiczny HTTP 3000, strona 3001. Postgres, Redis i wewnętrzne API (3100)
  nie są wystawione na zewnątrz.

## Architektura
- **Bot** (`src/`): discord.js v14, TypeScript, Components v2, Prisma 7 + PostgreSQL, Redis, Fastify.
  - Moduły w `src/modules/*` (`defineModule` z komendami, komponentami, eventami i jobami), lista w `src/modules/index.ts`.
  - Publiczne HTTP (`src/http/server.ts`, port 3000): `/health`, `/webhooks/github` (HMAC), `/heartbeat/:token`,
    `/sdk/v1/*` (Bearer `zxk_<id>_<48hex>`, SSE). Limit 30 nieudanych uwierzytelnień / 10 min na IP i grupę,
    max 5 strumieni SSE na bota, `trustProxy` tylko dla adresów prywatnych.
  - Wewnętrzne API (`src/http/internal.ts`, port 3100, nagłówek `x-internal-secret`) – używa go tylko strona.
    Pliki: `admin.ts`, `admin-more.ts`, `client-orders.ts`, `public-site.ts`, `leads.ts`.
- **Strona** (`web/`): Next.js 16 App Router, standalone, Geist, czysty CSS (`globals.css`, `(app)/app.css`,
  `components/site/site.css`).
  - `src/proxy.ts` – bramka „Start wkrótce” (cache 15 s), zakotwiczone wyjątki ścieżek.
  - Sesja: podpisane HMAC ciasteczko `zx_session`, logowanie Discord OAuth (tylko `identify`).
  - `src/lib/route.ts` `guarded()` – sprawdza Origin (CSRF), sesję, JSON; wszystkie mutacje idą przez to.
  - `src/lib/api.ts` – klient wewnętrznego API bota. `src/lib/client.ts` – `put/post/del` po stronie przeglądarki
    (emituje zdarzenie `zx:result` dla efektów zapisu).
  - Nagłówki: CSP, HSTS, Permissions-Policy, COOP, nosniff (w `next.config.ts`).
  - Next nie pozwala na dodatkowe eksporty z `page.tsx` – pomocnicze funkcje trzymaj w `lib/`.
- **Pakiety** (`packages/`): `zxcode-sdk` (boty klientów łączą się z panelem) i `zxcode-heartbeat` (monitoring).

## Model uprawnień
- Właściciel = `OWNER_ID` z `.env` (albo właściciel serwera). Administratorzy = SiteSetting `admins` (`{users, roles}`),
  role sprawdzane przez członkostwo na serwerze (cache 60 s). Komenda `/administratorzy`, strona Administracja → Administratorzy.
- Tylko właściciel: Ewidencja, Strona i serwer (VPS, dostęp do strony), Administratorzy. Admin: reszta administracji.
- Brak dostępu = 404 (nie zdradzamy, że coś istnieje).
- **Współdzielenie bota klienta** (`src/modules/sdk/members.ts`, tabela `SdkBotMember`): właściciel bota nadaje innym
  uprawnienia `settings` / `commands` / `profile` / `access`, z zakresem modułów i serwerów (pusto = wszystko).
  Zarządzający przydziela tylko w granicach własnych uprawnień. Egzekwowane w API bota (403).

## Usługi: strony i boty
- `enum ServiceKind { BOT, WEBSITE }` w Order, PricingPackage, PricingItem, PortfolioItem.
- Ticket „Zamówienie strony” (`TicketCategory.WEBSITE`, formularz 5 pól – limit Discorda). Zlecenie z takiego ticketu
  ma `kind = WEBSITE` i własne komunikaty statusów (`statusText` w `orders/constants.ts`).
- Formularz wyceny strony bez Discorda: `/zamow/strona` → `web/src/app/api/wycena` → bot `POST /internal/public/leads`.
  Ochrona: Origin, honeypot, min. 2,5 s wypełniania, limit 3/h na hash IP, deduplikacja, walidacja w bocie.
  Zapytania (`Lead`) → powiadomienie na `staffAlertChannelId` + panel admina „Zapytania”; usuwane po 12 mies.
  (job `leads-retention`, obiecane w polityce prywatności).
- Monitoring trybu `site`: HTTP co minutę + data ważności SSL (cache 6 h), alert 14 dni przed wygaśnięciem
  (kanał obsługi + DM klienta). Klient widzi to w panelu „Moje strony”.
- Cennik: `/cennik domyslne` dodaje przykładowe pakiety botów i stron (ceny stron są przykładowe – do ustalenia
  przez właściciela). Panel cennika na Discordzie: max 3 pakiety na rodzaj (limit 40 komponentów wiadomości).

## Mapa strony
- Publiczne: `/` (hub), `/strony-internetowe`, `/boty-discord`, `/realizacje?typ=strony|boty`, `/cennik#strony|#boty`,
  `/opinie`, `/faq#zamowienie|#strony|#boty|#hosting`, `/zamow`, `/zamow/strona`, `/regulamin`,
  `/polityka-prywatnosci`, `/cookies`, `/wkrotce`.
- Panel klienta: Pulpit, Moje boty (ustawienia serwerów w zakładkach modułów, uprawnienia komend, profil, dostęp,
  monitoring), Moje strony, Zlecenia (proformy).
- Administracja: Przegląd, Zlecenia (filtr bot/strona), Zapytania (licznik nowych), Tickety, Klienci, Ewidencja (CSV),
  Dziennik, Administratorzy, Strona i serwer (VPS Mathost).

## Lokalne środowisko testowe (kontener Claude Code)
- Postgres: `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/zxpg/data -o '-p 5432 -k /var/tmp/zxpg' -l /var/tmp/zxpg/log.txt start"`
  (proces potrafi zniknąć między turami – sprawdzaj `pg_isready -h 127.0.0.1`). Redis: `redis-server --daemonize yes --save ""`.
- Baza `postgresql://zxcode@localhost:5432/zxcode`. Testowy użytkownik nie może tworzyć shadow DB, więc migracje
  generuj przez `npx prisma migrate diff --from-schema <stary> --to-schema prisma/schema.prisma --script`.
- **Nie edytuj zastosowanych migracji** (zmienia się suma kontrolna).
- Bot testowo uruchamiany z fałszywym klientem Discorda (seed danych), strona przez `next build` + `next start -p 3001`.
  Ciasteczko sesji podpisuje się HMAC-SHA256 tym samym `SESSION_SECRET`.
- Przed commitem: `npx tsc --noEmit -p .`, `cd web && npx tsc --noEmit`, `npx eslint src web/src`, `next build`.

## Pomysły na dalszy rozwój (niezrobione)
- Automatyczne maile (potwierdzenie zapytania, wysyłka wyceny) – potrzebny SMTP dla kontakt@zxcode.pl.
- Akceptacja wyceny online przez klienta; zamiana zapytania w zlecenie jednym kliknięciem.
- Statystyki bez cookies (np. Umami na VPS).
- Podstrony pojedynczych realizacji (SEO), więcej realizacji stron w portfolio.
- Google Search Console (`/sitemap.xml`) i profil firmy w Google.

## Animacja reklamowa
- Zbudowana w konektorze Animki (LottieFiles Creator), dokument `zxcode-promo`, kompozycja „zxCode promo”,
  1920×1080, 60 kl./s, 20 s, 5 scen (logo, hasło z pisaniem, strona + Discord, karty, finał z CTA). Opis i prompt:
  `docs/MARKA.md`.
- Eksport MP4: `creator.export('zxcode-promo.mp4', 'mp4', { fps: 60 })`, potem `creator_download_file`.
  Wymaga podłączonego konta i obszaru roboczego LottieFiles w konektorze (claude.ai/customize/connectors).
- Przy budowie w Animki: media podawaj jako stałe ścieżki (`{ file: 'media/x.png' }`), dzieci dodawaj do grupy
  przed animowaniem grupy (inaczej `setParentInPlace` dokłada klatki kompensujące), gradient na tekście rób
  animatorem `TextFillColor` z selektorem RampUp (matte na tekście nie renderuje się).
