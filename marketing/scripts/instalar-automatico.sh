#!/usr/bin/env bash
# Instala (o actualiza) el proceso automático de videos para tu usuario:
#   - 3c-videos.timer: los domingos a las 7:00 hace los videos de la semana que viene.
#   - 3c-videos.path: al guardar respuestas/semana-NN.md, rehace esa semana.
# Corré esto desde el checkout desde el que querés que se hagan los videos.
set -euo pipefail

repo="$(cd "$(dirname "$0")/../.." && pwd)"
videos="${VIDEOS_DIR:-$HOME/Work/personal/3c-videos}"
node_bin="$(dirname "$(command -v node)")"
units="$HOME/.config/systemd/user"

mkdir -p "$units" "$videos/respuestas"
for unit in 3c-videos.service 3c-videos.timer 3c-videos.path; do
  sed -e "s|@REPO@|$repo|g" -e "s|@NODE_BIN@|$node_bin|g" -e "s|@VIDEOS_DIR@|$videos|g" \
    "$repo/marketing/systemd/$unit" > "$units/$unit"
done
systemctl --user daemon-reload
systemctl --user enable --now 3c-videos.timer 3c-videos.path
systemctl --user list-timers 3c-videos.timer --no-pager
echo "Listo: los videos salen en $videos (repo: $repo)."
