# Instalacja zxCode Bot na VPS

Poradnik dla Ubuntu 24.04 LTS, minimum 4 GB RAM i 25 GB dysku. Bot działa w Dockerze razem z PostgreSQL i Redis, a HTTPS zapewnia Caddy.

Wszystkie komendy wykonujesz na serwerze, zalogowany jako zwykły użytkownik z `sudo` (nie jako `root`).

---

## 0. Czego potrzebujesz przed startem

- VPS z publicznym IPv4 i Ubuntu 24.04 LTS.
- Domenę lub subdomenę, np. `bot.twojadomena.pl`, z rekordem **A** wskazującym na IP serwera. Ten rekord ustaw przed krokiem 6, bo Caddy pobiera certyfikat dopiero, gdy domena już wskazuje na serwer.
- Aplikację bota w Discord Developer Portal (patrz krok 1).
- Token bota Discord, ID aplikacji i ID serwera zxCode.

---

## 1. Aplikacja Discord

1. Wejdź na https://discord.com/developers/applications i utwórz aplikację (lub wybierz istniejącą).
2. **Bot → Reset Token** i skopiuj token. Zapisz go od razu, bo Discord pokaże go tylko raz.
3. W sekcji **Bot → Privileged Gateway Intents** włącz:
   - **Server Members Intent**,
   - **Message Content Intent**.
   - **Presence Intent** włączaj tylko, jeśli chcesz monitoring typu „presence” (domyślnie nie).
4. **General Information** → skopiuj **Application ID** (to jest `DISCORD_CLIENT_ID`).
5. **OAuth2 → URL Generator**:
   - zaznacz zakresy: `bot` i `applications.commands`,
   - w uprawnieniach bota zaznacz: Wyświetlanie kanałów, Wysyłanie wiadomości, Osadzanie linków, Załączanie plików, Historia wiadomości, Dodawanie reakcji, Używanie zewnętrznych emoji, Zarządzanie kanałami, Zarządzanie rolami, Zarządzanie wiadomościami, Wyświetlanie dziennika zdarzeń.
   - skopiuj wygenerowany link i otwórz go, żeby dodać bota na serwer zxCode.
6. Na serwerze zxCode skopiuj ID serwera (Ustawienia → Zaawansowane → Tryb dewelopera, potem prawy klik na nazwę serwera → Kopiuj ID). To jest `GUILD_ID`.

Rola bota musi być na liście ról **wyżej** niż role, które ma nadawać (Zweryfikowany, Klient, Stały klient).

---

## 2. Przygotowanie serwera

Zaloguj się na serwer przez SSH i zaktualizuj system:

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.1 Docker i Docker Compose

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Wyloguj się i zaloguj ponownie (albo wykonaj `newgrp docker`), potem sprawdź:

```bash
docker run --rm hello-world
docker compose version
```

### 2.2 Node.js 22 LTS

Node na serwerze jest potrzebny tylko do jednorazowego wgrania emotek i do skryptów pomocniczych. Sam bot działa w kontenerze.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
node -v    # v22.x
```

### 2.3 Swap 2 GB

Zabezpiecza przed zabiciem procesów przy szczytach zużycia RAM:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h    # w wierszu Swap powinny być 2,0G
```

### 2.4 Rotacja logów Dockera

Domyślnie Docker zapisuje logi kontenerów bez limitu i potrafi zapchać dysk. Ustaw limit globalnie:

```bash
sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
sudo systemctl restart docker
```

### 2.5 Firewall

Najpierw SSH, potem HTTP i HTTPS, dopiero na końcu włączenie:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Port bota (3000) celowo nie jest otwarty. Działa tylko lokalnie i jest dostępny z internetu przez Caddy.

---

## 3. Pobranie kodu

```bash
cd ~
git clone -b ccr-e9e12a0c-2zd80u https://github.com/ZunekT/zCode-Bot.git
cd zCode-Bot
```

Jeśli repozytorium jest prywatne, GitHub zapyta o login i **Personal Access Token** (nie hasło). Token tworzysz w Settings → Developer settings → Personal access tokens.

Aktualizacja w przyszłości: `cd ~/zCode-Bot && git pull` i krok 7.

---

## 4. Plik `.env`

```bash
cp .env.example .env
nano .env
```

Uzupełnij wartości (reszta może zostać domyślna):

```ini
# Discord (z kroku 1)
DISCORD_TOKEN=wklej_token_bota
DISCORD_CLIENT_ID=id_aplikacji
GUILD_ID=id_serwera_zxcode

# Hasło do PostgreSQL – USTAW własne, nie zostawiaj domyślnego
POSTGRES_PASSWORD=dlugie_losowe_haslo

# GitHub (opcjonalnie – changelog z release'ów)
GITHUB_WEBHOOK_SECRET=losowy_sekret_dla_webhooka
GITHUB_TOKEN=

# Publiczny adres bota (ten sam, który wpiszesz w Caddy w kroku 6)
PUBLIC_URL=https://bot.twojadomena.pl
HTTP_PORT=3000

ENABLE_PRESENCE_INTENT=false
LOG_LEVEL=info
```

Losowe hasła wygenerujesz poleceniem: `openssl rand -hex 24`.

Zabezpiecz plik:

```bash
chmod 600 .env
```

Uwaga: `DATABASE_URL` i `REDIS_URL` nie trzeba ustawiać. Compose wstawia je sam, wskazując kontenery `postgres` i `redis`.

---

## 5. Pierwsze uruchomienie bota

Compose musi widzieć `.env` z katalogu głównego, dlatego zawsze używaj `--env-file .env`:

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d --build
```

Pierwsze budowanie trwa kilka minut. Sprawdź stan i logi:

```bash
docker compose --env-file .env -f docker/docker-compose.yml ps
docker compose --env-file .env -f docker/docker-compose.yml logs -f bot
```

W logach powinno pojawić się:

- `Połączono z PostgreSQL i Redis`,
- lista modułów (`Moduł tickets: …`, `Moduł logs: …` itd.),
- `Zarejestrowano … komend na serwerze`,
- `Bot gotowy`.

Jeśli zobaczysz `Baza nie jest aktualna`, to znaczy, że migracje się nie wykonały. Sprawdź logi kontenera `bot`.

Wyjście z podglądu logów: `Ctrl+C` (kontenery dalej działają).

Health check lokalnie:

```bash
curl -s http://127.0.0.1:3000/health
```

Powinna wrócić odpowiedź z `"status":"ok"`.

Dla skrótu możesz zrobić alias w `~/.bashrc`:

```bash
echo "alias zx='docker compose --env-file ~/zCode-Bot/.env -f ~/zCode-Bot/docker/docker-compose.yml'" >> ~/.bashrc
source ~/.bashrc
zx ps
```

Dalej w tym poradniku używam `zx`, czyli skrótu do tej komendy.

---

## 6. HTTPS przez Caddy

Caddy sam pobiera i odnawia certyfikat Let's Encrypt.

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Edytuj konfigurację:

```bash
sudo nano /etc/caddy/Caddyfile
```

Wklej (zamień domenę):

```
bot.twojadomena.pl {
    encode gzip
    reverse_proxy 127.0.0.1:3000
}
```

Przeładuj Caddy:

```bash
sudo systemctl reload caddy
```

Sprawdź z zewnątrz (z własnego komputera albo telefonu):

```
https://bot.twojadomena.pl/health
```

Jeśli nie działa, sprawdź: czy rekord A wskazuje na IP serwera, czy porty 80 i 443 są otwarte w firewallu i w panelu VPS-a, oraz logi `sudo journalctl -u caddy -n 50`.

---

## 7. Aktualizacja bota

Przy każdej nowej wersji z GitHuba:

```bash
cd ~/zCode-Bot
git pull
zx up -d --build
```

Migracje bazy wykonują się same przy starcie kontenera. Dane (PostgreSQL, Redis) zostają w wolumenach Dockera.

---

## 8. Emotki z paczki zxCode (raz)

Emotki wgrywa się jako Application Emojis przez skrypt działający na hoście:

```bash
cd ~/zCode-Bot
npm ci
npm run emojis:sync
```

Skrypt pomija emotki, które już istnieją. Po wgraniu bot wczyta je przy następnym restarcie:

```bash
zx restart bot
```

Zamiana istniejących emotek: `npm run emojis:sync -- --force`.

---

## 9. Konfiguracja na serwerze Discord

Po pierwszym starcie na serwerze zxCode wykonaj:

1. Utwórz kategorie `🎫 TICKETY` i `📁 ARCHIWUM`.
2. Utwórz role **Obsługa**, **Zweryfikowany**, **Klient**, **Stały klient** (opcjonalnie **Niezweryfikowany**) i ustaw je w rolach bota wyżej niż role do nadawania.
3. Ustaw konfigurację:
   - `/config kategoria typ:Kategoria ticketów kategoria:🎫 TICKETY`
   - `/config kategoria typ:Archiwum ticketów kategoria:📁 ARCHIWUM`
   - `/config rola typ:Obsługa rola:@Obsługa`
   - `/config rola typ:Zweryfikowany rola:@Zweryfikowany`
   - `/config kanal typ:Logi kanal:#logi` (i pozostałe kanały, które chcesz)
   - `/config platnosci` (dane do przelewu na proformy)
4. Wyślij panele:
   - `/ticket panel kanal:#pomoc`
   - `/weryfikacja panel kanal:#weryfikacja`
   - `/cennik domyslne`, potem `/cennik panel` (po edycji pakietów)
   - `/monitoring panel`, jeśli używasz monitoringu
5. Ustaw uprawnienia kanałów: `@everyone` widzi tylko kanał weryfikacji, rola Zweryfikowany widzi resztę.

Szczegóły poszczególnych modułów są w `README.md`.

---

## 10. Kopie zapasowe bazy

Baza zawiera zlecenia i płatności, więc backup jest obowiązkowy.

```bash
mkdir -p ~/backups
cat > ~/backup-zxcode.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
DIR=~/backups
FILE="$DIR/zxcode-$(date +%F-%H%M).sql.gz"
docker compose --env-file ~/zCode-Bot/.env -f ~/zCode-Bot/docker/docker-compose.yml \
  exec -T postgres pg_dump -U zxcode zxcode | gzip > "$FILE"
# zostaw 14 ostatnich kopii
ls -1t "$DIR"/zxcode-*.sql.gz | tail -n +15 | xargs -r rm --
echo "Backup: $FILE"
EOF
chmod +x ~/backup-zxcode.sh
~/backup-zxcode.sh
```

Automatyczny backup codziennie o 3:30:

```bash
(crontab -l 2>/dev/null; echo "30 3 * * * $HOME/backup-zxcode.sh >> $HOME/backups/backup.log 2>&1") | crontab -
```

Kopie są na tym samym serwerze. Raz w tygodniu skopiuj jedną na inny dysk albo do chmury, bo awaria VPS-a zabierze wszystko.

Przywracanie (w razie potrzeby):

```bash
gunzip -c ~/backups/zxcode-DATA.sql.gz | zx exec -T postgres psql -U zxcode zxcode
```

---

## 11. Utrzymanie

Czyszczenie nieużywanych obrazów Dockera (raz w tygodniu):

```bash
(crontab -l 2>/dev/null; echo "0 4 * * 0 docker image prune -f >/dev/null 2>&1") | crontab -
```

Sprawdzenie dysku i RAM-u:

```bash
df -h /
free -h
docker stats --no-stream
```

Restart bota: `zx restart bot`. Logi: `zx logs -f bot`.

---

## 12. Rozwiązywanie problemów

| Objaw                                 | Co sprawdzić                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `TokenInvalid` w logach               | błędny `DISCORD_TOKEN` w `.env`, po zmianie `zx up -d`                           |
| Komendy nie pojawiają się na serwerze | `GUILD_ID` i `DISCORD_CLIENT_ID` w `.env`, bot dodany linkiem z kroku 1          |
| `Baza nie jest aktualna`              | `zx logs bot`, zwykle błąd połączenia z `postgres`                               |
| `Nie mogę nadać roli`                 | rola bota musi być wyżej na liście ról serwera                                   |
| Webhook GitHuba zwraca 401            | `GITHUB_WEBHOOK_SECRET` w `.env` musi być identyczny jak w ustawieniach webhooka |
| Brak HTTPS                            | rekord A, porty 80/443, `sudo journalctl -u caddy -n 50`                         |
| Brak miejsca na dysku                 | `docker system df`, potem `docker image prune -f` i sprawdź `~/backups`          |
| Mało pamięci                          | `docker stats`, sprawdź swap (`free -h`)                                         |

Po zmianie `.env` zawsze odśwież kontenery: `zx up -d` (zwykły `restart` nie wczyta nowych zmiennych).

---

## Checklista

- [ ] Aplikacja Discord, intenty, bot na serwerze
- [ ] Ubuntu zaktualizowane, Docker, Node 22, swap, firewall
- [ ] Rekord A dla domeny
- [ ] `.env` uzupełniony, `POSTGRES_PASSWORD` ustawione
- [ ] `zx up -d --build`, w logach „Bot gotowy”
- [ ] Caddy działa, `https://…/health` zwraca OK
- [ ] `npm run emojis:sync`
- [ ] Konfiguracja `/config` i panele na serwerze
- [ ] Backup działa i jest w cronie
