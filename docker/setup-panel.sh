#!/usr/bin/env bash
# Jednorazowa konfiguracja strony zxcode.pl z panelem (uruchom na VPS w katalogu repo):
#   bash docker/setup-panel.sh
# Co robi:
#   1. dopisuje do .env brakujące sekrety (generowane automatycznie) i adres strony,
#   2. pyta o Client Secret aplikacji Discord (wpisywany niewidocznie, nie trafia do historii),
#   3. dodaje zxcode.pl i www.zxcode.pl do Caddy (HTTPS) i przeładowuje Caddy,
#   4. buduje i uruchamia bota oraz stronę.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Brak pliku .env w $(pwd)"; exit 1; }
SUDO=$([ "$(id -u)" = 0 ] || echo sudo)

has() { grep -qE "^$1=.+" .env; }
put() { sed -i "/^#\? *$1=/d" .env; printf '%s=%s\n' "$1" "$2" >> .env; }

has INTERNAL_API_SECRET || { put INTERNAL_API_SECRET "$(openssl rand -hex 32)"; echo "+ INTERNAL_API_SECRET"; }
has SESSION_SECRET || { put SESSION_SECRET "$(openssl rand -hex 32)"; echo "+ SESSION_SECRET"; }
has SITE_URL || { put SITE_URL "https://zxcode.pl"; echo "+ SITE_URL=https://zxcode.pl"; }

if ! has DISCORD_CLIENT_SECRET; then
  echo
  echo "Discord Developer Portal → Twoja aplikacja → OAuth2 → Client Secret (Reset Secret, skopiuj)."
  read -rsp "Wklej Client Secret i naciśnij Enter: " secret
  echo
  secret="$(printf '%s' "$secret" | tr -cd 'A-Za-z0-9_-')"
  [ ${#secret} -ge 20 ] || { echo "To nie wygląda na Client Secret – uruchom skrypt ponownie."; exit 1; }
  put DISCORD_CLIENT_SECRET "$secret"
  echo "+ DISCORD_CLIENT_SECRET"
fi

CADDY=/etc/caddy/Caddyfile
if [ -f "$CADDY" ] && ! grep -q '^zxcode.pl' "$CADDY"; then
  $SUDO tee -a "$CADDY" >/dev/null <<'EOF'

www.zxcode.pl {
	redir https://zxcode.pl{uri} permanent
}

zxcode.pl {
	encode gzip
	reverse_proxy 127.0.0.1:3001
}
EOF
  $SUDO systemctl reload caddy
  echo "+ Caddy: zxcode.pl i www.zxcode.pl"
fi

docker compose --env-file .env -f docker/docker-compose.yml up -d --build
echo
echo "Gotowe. Strona: https://zxcode.pl  (panel: https://zxcode.pl/panel)"
