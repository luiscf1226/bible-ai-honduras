#!/usr/bin/env bash
# Lo corre systemd: 3c-videos.timer los domingos a las 7:00 y 3c-videos.path
# cada vez que se guarda un archivo en ~/Work/personal/3c-videos/respuestas/.
set -euo pipefail

repo="$(cd "$(dirname "$0")/../.." && pwd)"

# Si el disparo fue por guardar respuestas, esperar a que el editor termine.
sleep 15

cd "$repo"
[ -d node_modules ] || npm ci --no-audit --no-fund
cd marketing
[ -d node_modules ] || npm ci --no-audit --no-fund
exec npm run --silent semana
