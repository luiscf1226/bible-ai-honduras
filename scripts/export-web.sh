#!/usr/bin/env bash
# Build de la versión web para Vercel (vercel.json → outputDirectory "dist").
#
# Vercel no tiene las variables de EAS, así que acá van las mismas claves
# públicas que usa el perfil `production` de eas.json (EXPO_PUBLIC_* termina
# dentro del bundle de todos modos). Si el proyecto de Vercel define alguna,
# esa tiene prioridad.
set -euo pipefail

export EXPO_PUBLIC_CONVEX_URL="${EXPO_PUBLIC_CONVEX_URL:-https://neighborly-kudu-508.convex.cloud}"
export EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="${EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:-pk_live_Y2xlcmsubGNmYXBwcy5jb20k}"

rm -rf dist
npx expo export --platform web --output-dir dist
