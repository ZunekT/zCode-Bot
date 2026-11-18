# Strona zxcode.pl i panel klienta

Strona (`web/`, Next.js) działa jako osobny kontener `web`. Z botem rozmawia przez wewnętrzne API
(`bot:3100`, tylko sieć Dockera, nagłówek `x-internal-secret`). Logowanie przez Discord (OAuth2,
zakres `identify`), sesja w podpisanym ciasteczku – strona nie ma własnej bazy.

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

## Bezpieczeństwo

- Zapis tylko z nagłówkiem `Origin` strony (CSRF), sesja HMAC-SHA256, ciasteczko `HttpOnly`, `Secure`, `SameSite=Lax`.
- Bot sprawdza właściciela przy każdym żądaniu; cudzy bot = 404.
- Token Discorda z logowania jest od razu unieważniany – strona zna tylko ID, nazwę i avatar.

## Lokalnie

```bash
cd web && cp .env.example .env.local   # uzupełnij
npm install && npm run dev             # http://localhost:3001
```
