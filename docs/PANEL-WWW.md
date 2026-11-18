# Strona zxcode.pl i panel klienta

Strona (`web/`, Next.js) działa jako osobny kontener `web`. Z botem rozmawia przez wewnętrzne API
(`bot:3100`, tylko sieć Dockera, nagłówek `x-internal-secret`). Logowanie przez Discord (OAuth2,
zakres `identify`), sesja w podpisanym ciasteczku – strona nie ma własnej bazy.

## Tryb „Start wkrótce”

Domyślnie strona jest **ukryta**: każdy widzi tylko „Start wkrótce” (`web/src/proxy.ts`). Pełną stronę widzi
właściciel i osoby z listy podglądu – po zalogowaniu przez Discord na `zxcode.pl/zaloguj`.

- Panel → **Administracja → Strona publiczna**: „Uruchom stronę”, „Włącz Start wkrótce”, lista podglądu (ID Discord).
- Discord: `/strona status | uruchom | wkrotce | dodaj @osoba | usun @osoba` (tylko właściciel).
- Zmiana działa w ciągu ~15 s. Gdy bot nie odpowiada, strona zostaje w ostatnim znanym stanie (bez niego – ukryta).

## Dokumenty prawne

`/regulamin`, `/polityka-prywatnosci` (RODO), `/cookies`. Dane usługodawcy w **`web/src/lib/company.ts`** – pola
z `[…]` są wyróżnione na żółto, dopóki ich nie uzupełnisz. To szablony – przed startem warto, żeby przejrzał je prawnik.

## Strona główna (wizytówka)

`web/src/app/page.tsx` + `web/src/components/site/*` (animacje: biblioteka `motion`, font Geist).
Strona główna: hero, technologie, statystyki, usługi, proces, 3 realizacje, pokaz panelu, opinie, wezwanie do działania.
Podstrony: `/realizacje`, `/opinie`, `/cennik`, `/faq`. „Zamów bota” prowadzi przez `/zamow` do `DISCORD_INVITE_URL`. Treści z bazy bota (`/internal/public/site`, cache 5 min):

| Sekcja     | Skąd dane                                                                                 | Gdy pusto                                    |
| ---------- | ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| Statystyki | zakończone zlecenia, klienci, średnia opinii, uptime monitoringu, liczba osób na serwerze | ukryta (pokazuje tylko wartości > 0, min. 2) |
| Realizacje | `/portfolio` (ze zdjęciami)                                                               | ukryta                                       |
| Cennik     | pakiety i dodatki z `/cennik`                                                             | przycisk „bezpłatna wycena”                  |
| Opinie     | zatwierdzone opinie (nick i avatar z Discorda)                                            | ukryta                                       |
| FAQ        | baza FAQ (min. 3 pytania)                                                                 | domyślne pytania                             |

Przycisk „Zamów bota” prowadzi do `DISCORD_INVITE_URL` (bez niego – do logowania).

## Pierwsze uruchomienie (VPS)

1. **DNS** – rekordy A `zxcode.pl` i `www.zxcode.pl` → IP serwera.
2. **Discord Developer Portal** → aplikacja bota → **OAuth2**:
   - _Redirects_ → dodaj `https://zxcode.pl/api/auth/callback`, zapisz,
   - _Client Secret_ → **Reset Secret** i skopiuj (wkleisz go w kroku 3).
3. Na VPS w katalogu repo:

   ```bash
   git pull && bash docker/setup-panel.sh
   ```

   Skrypt dopisze sekrety do `.env`, zapyta o Client Secret (wpisywany niewidocznie), doda domeny do Caddy
   i uruchomi bota oraz stronę.

## Panel (zxcode.pl/panel)

Wspólny układ: menu boczne (komputer) i wysuwane menu (telefon). Grupa **Administracja** jest widoczna
tylko dla właściciela (`OWNER_ID` albo właściciel serwera zxCode).

**Panel klienta**

- **Pulpit** – boty, zlecenia w toku, kwota do zapłaty, stan monitoringu.
- **Moje boty** (`/panel/boty`) – ustawienia na serwerach, uprawnienia komend, profil, monitoring.
- **Zlecenia** (`/panel/zlecenia`) – postęp etapami, zadania, wpłaty, proformy (HTML do druku/PDF),
  dane do przelewu z tytułem do skopiowania, link do ticketu.

**Administracja**

- **Przegląd** – przychód (miesiąc, wykres 12 mies.), należności, tickety, klienci, zaległe proformy.
- **Zlecenia** – filtry, wyszukiwanie, nowe zlecenie, edycja, status, wpłaty, zadania, proforma.
- **Tickety** – lista z czasem oczekiwania klienta, rozmowa z kanału, odpowiedź z panelu (bot wysyła
  ją na kanał), zamknięcie (transkrypt, archiwum, prośba o ocenę).
- **Klienci** – zlecenia, wpłaty, należności.
- **Ewidencja** – uproszczona ewidencja sprzedaży z wpłat (kwartał, dzienne sumy, eksport CSV) i limit
  przychodu działalności nierejestrowanej (domyślnie 225% płacy minimalnej, edytowalny).
- **Dziennik** – kto co zmienił (Discord i panel).
- **Strona i serwer** – tryb „Start wkrótce”, podgląd przed startem, VPS w Mathost.

## Wydajność

- Strona publiczna bez bibliotek animacji: CSS (transform/opacity) i jeden IntersectionObserver;
  sekcje renderowane na serwerze, JS tylko w małych „wyspach”. Zdjęcia portfolio przez `next/image`
  (AVIF/WebP). Emotki i grafiki z cache przeglądarki na tydzień.
- Panel: szkło (`backdrop-filter`) tylko na komputerach, pełne tła na telefonach; szkielety ładowania
  i pasek postępu przy nawigacji.
- Pomiar przy CPU ×4 (Pixel 7): menu, przewijanie, lista wyboru – 0 długich klatek; LCP stron 0,16–0,56 s.

## Bezpieczeństwo

- Zapis tylko z nagłówkiem `Origin` strony (CSRF), sesja HMAC-SHA256, ciasteczko `HttpOnly`, `Secure`, `SameSite=Lax`.
- Bot sprawdza właściciela przy każdym żądaniu; cudzy bot = 404.
- Token Discorda z logowania jest od razu unieważniany – strona zna tylko ID, nazwę i avatar.

## Lokalnie

```bash
cd web && cp .env.example .env.local   # uzupełnij
npm install && npm run dev             # http://localhost:3001
```
