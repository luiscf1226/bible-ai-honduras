#!/usr/bin/env bash
#
# Build local con EAS (`eas build --local`): compila en esta máquina en vez de
# encolarse en la nube de EAS. Necesita las herramientas nativas instaladas:
#   iOS      → Xcode + CocoaPods, en macOS
#   Android  → Android SDK + JDK (ANDROID_HOME apuntando al SDK)
#
# Uso:
#   scripts/build-local.sh android apk          # APK instalable por link
#   scripts/build-local.sh android play         # AAB para Play Internal testing
#   scripts/build-local.sh android production   # AAB de producción
#   scripts/build-local.sh ios testflight       # IPA para TestFlight
#   scripts/build-local.sh ios production       # IPA de producción
#
# Los perfiles salen de eas.json — agregar uno ahí antes que acá.
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Uso: scripts/build-local.sh <android|ios> <apk|play|testflight|production>

Combinaciones válidas (ver eas.json):
  android  apk | play | production
  ios      testflight | production
EOF
  exit 1
}

PLATFORM="${1:-}"
PROFILE="${2:-}"
[[ -z "$PLATFORM" || -z "$PROFILE" ]] && usage

case "$PLATFORM" in
  android|ios) ;;
  *) echo "Plataforma inválida: '$PLATFORM' (android|ios)" >&2; exit 1 ;;
esac

case "$PLATFORM:$PROFILE" in
  android:apk|android:play|android:production) ;;
  ios:testflight|ios:production) ;;
  *)
    echo "Combinación inválida: '$PLATFORM $PROFILE'." >&2
    usage
    ;;
esac

# Preflight — falla rápido con un mensaje claro en vez del error críptico de
# EAS a mitad de una compilación que puede tardar varios minutos.
if [[ "$PLATFORM" == "ios" ]]; then
  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "Un build local de iOS necesita macOS." >&2
    exit 1
  fi
  command -v xcodebuild >/dev/null 2>&1 || {
    echo "No se encontró xcodebuild. Instalá Xcode y sus command line tools." >&2
    exit 1
  }
  command -v pod >/dev/null 2>&1 || {
    echo "No se encontró CocoaPods (\`pod\`). Instalalo con \`sudo gem install cocoapods\`." >&2
    exit 1
  }
elif [[ "$PLATFORM" == "android" ]]; then
  # Android Studio instala el SDK acá por defecto, pero no siempre exporta
  # ANDROID_HOME en el shell (típico si se instaló desde la GUI, no con
  # brew). Antes de fallar, probamos la ruta por defecto de cada SO.
  DEFAULT_SDK_PATH=""
  case "$(uname -s)" in
    Darwin) DEFAULT_SDK_PATH="$HOME/Library/Android/sdk" ;;
    Linux) DEFAULT_SDK_PATH="$HOME/Android/Sdk" ;;
  esac

  if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
    if [[ -n "$DEFAULT_SDK_PATH" && -d "$DEFAULT_SDK_PATH" ]]; then
      echo "ANDROID_HOME no estaba seteada — encontré el SDK en $DEFAULT_SDK_PATH y lo uso para este build." >&2
      export ANDROID_HOME="$DEFAULT_SDK_PATH"
      export ANDROID_SDK_ROOT="$DEFAULT_SDK_PATH"
    else
      echo "ANDROID_HOME (o ANDROID_SDK_ROOT) no está seteado y no encontré el SDK en $DEFAULT_SDK_PATH. Instalá el Android SDK." >&2
      exit 1
    fi
  fi
  command -v java >/dev/null 2>&1 || {
    echo "No se encontró \`java\`. Un build local de Android necesita el JDK." >&2
    exit 1
  }
fi

npx eas-cli whoami >/dev/null 2>&1 || {
  echo "No hay sesión de EAS. Corré \`npx eas-cli login\` primero." >&2
  exit 1
}

echo "▶ eas build --local -p $PLATFORM --profile $PROFILE"
npx eas-cli build --local --non-interactive -p "$PLATFORM" --profile "$PROFILE"

echo
echo "Listo. El artefacto (.apk/.aab/.ipa) quedó en este directorio."
echo "Para subirlo a la tienda: npx eas-cli submit -p $PLATFORM --profile $PROFILE --path <archivo>"
