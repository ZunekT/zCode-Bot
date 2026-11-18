# Strona zxcode.pl i panel klienta

Strona (`web/`, Next.js) działa jako osobny kontener `web`. Z botem rozmawia przez wewnętrzne API
(`bot:3100`, tylko sieć Dockera, nagłówek `x-internal-secret`). Logowanie przez Discord (OAuth2,
zakres `identify`), sesja w podpisanym ciasteczku – strona nie ma własnej bazy.

## Strona główna (wizytówka)

`web/src/app/page.tsx` + `web/src/components/site/*` (animacje: biblioteka `motion`, font Geist).
Sekcje: hero z podglądem wiadomości bota, technologie, statystyki, usługi, proces, realizacje, cennik,
opinie, pokaz panelu, FAQ, wezwanie do działania. Treści z bazy bota (`/internal/public/site`, cache 5 min):

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

## Co jest w panelu

- **Moje boty** – boty, których jesteś właścicielem (`/sdk dodaj … wlasciciel`), plus sam bot zxCode
  (właściciel serwera albo `OWNER_ID`).
- **Bot** – serwery, monitoring (uptime, awarie), profil: status, aktywność, nazwa, avatar.
- **Serwer → Ustawienia** – wszystkie moduły i pola zadeklarowane przez bota. Walidacja po stronie bota,
  zmiany trafiają na żywo.
- **Serwer → Uprawnienia komend** – role, które mogą używać danej komendy.

## Administracja (tylko właściciel)

Zakładka **Administracja** widoczna tylko dla właściciela (`OWNER_ID` albo właściciel serwera zxCode);
dla innych `/admin` zwraca 404. Wymaga `MATHOST_API_KEY`.

- stan VPS: CPU, RAM, dysk, czas działania, sieć, wykresy (godzina / doba / tydzień / miesiąc),
- ważność, cena, auto-odnawianie, transfer, kopie zapasowe,
- **Kopia zapasowa** i **Restart VPS** (z potwierdzeniem, wpis w audycie).

To samo na Discordzie: `/vps status | restart | kopia` (status – administracja, restart i kopia – właściciel).
Co 5 min bot sprawdza VPS i ostrzega na kanale alertów obsługi: dysk ≥ 85%, RAM ≥ 90%, CPU ≥ 90% przez
10 min, wygaśnięcie w ciągu 7 dni bez auto-odnawiania, zawieszenie (każdy alert najwyżej raz na 12 h).

## Bezpieczeństwo

- Zapis tylko z nagłówkiem `Origin` strony (CSRF), sesja HMAC-SHA256, ciasteczko `HttpOnly`, `Secure`, `SameSite=Lax`.
- Bot sprawdza właściciela przy każdym żądaniu; cudzy bot = 404.
- Token Discorda z logowania jest od razu unieważniany – strona zna tylko ID, nazwę i avatar.

## Lokalnie

```bash
cd web && cp .env.example .env.local   # uzupełnij
npm install && npm run dev             # http://localhost:3001
```
