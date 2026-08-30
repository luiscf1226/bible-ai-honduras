# Builds de la beta — TestFlight y Google Play

Contexto: #93. Perfiles en `eas.json`. La app es managed (no hay `android/` ni
`ios/` en el repo); EAS hace el prebuild en la nube.

## Dos entornos de Convex

Proyecto `luiscf1226/bible-ai-honduras`.

| Entorno | Deployment | URL | Lo usa |
|---|---|---|---|
| Test | `neighborly-kudu-508` | `https://neighborly-kudu-508.convex.cloud` | `apk`, `play`, `testflight` |
| Producción | `optimistic-labrador-439` | `https://optimistic-labrador-439.convex.cloud` | `production` |

La beta corre contra **test**: los testers pueden romper datos, agotar cuotas y
recibir Pro de cortesía sin tocar producción.

## Antes de la primera build

Las URLs de Convex ya están en `eas.json`. **Falta la key de Clerk** —
reemplazar `pk_REEMPLAZAR` en los perfiles de beta y `pk_live_REEMPLAZAR` en
`production`.

| Variable | De dónde sale |
|---|---|
| `EXPO_PUBLIC_CONVEX_URL` | Ya configurada (tabla de arriba) |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API Keys |

> **Estas dos van dentro del perfil, no en `.env.local`.** `.env.local` no viaja
> a los servidores de EAS. Si faltan, la build compila pero la app abre en
> pantalla blanca, sin mensaje de error.

Las claves privadas (Anthropic, OpenAI, Clerk issuer) no van acá: viven en el
deployment de Convex.

En el deployment de **test** (el que usa la beta):

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://tu-instancia.clerk.accounts.dev
npx convex env set ANTHROPIC_API_KEY sk-ant-...
npx convex env set OPENAI_API_KEY sk-...
```

Y en **producción**, cuando llegue el momento:

```bash
npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN https://...
npx convex env set --prod ANTHROPIC_API_KEY sk-ant-...
npx convex env set --prod OPENAI_API_KEY sk-...
```

> Ningún deployment tiene funciones desplegadas todavía: el push falla con
> `CLERK_JWT_ISSUER_DOMAIN is used in auth config file but its value was not
> set`. Es lo primero que hay que resolver.

## Perfiles

| Perfil | Sale | Convex | Para qué |
|---|---|---|---|
| `apk` | APK | test | Instalación directa por link. La ronda más rápida |
| `play` | AAB | test | Google Play → Internal testing |
| `testflight` | IPA | test | App Store Connect → TestFlight |
| `production` | AAB / IPA | **prod** | Lanzamiento real (#39). No usar para la beta |

`autoIncrement` + `appVersionSource: remote` hacen que EAS lleve el número de
build. No hay que tocar `version` en `app.json` a mano entre builds.

## Android — APK directo

```bash
eas build -p android --profile apk
```

La primera vez pide keystore: **dejá que EAS lo genere**. Guardalo — sin ese
keystore no se puede actualizar la app en Play más adelante.

## Android — Google Play Internal testing

```bash
eas build -p android --profile play
```

La **primera** subida hay que hacerla a mano en Play Console (Google no acepta
el primer AAB por API). Las siguientes:

```bash
eas submit -p android --latest
```

Eso necesita `play-service-account.json` en la raíz — está en `.gitignore`,
nunca se commitea. Se crea en Google Cloud Console y se le da acceso desde
Play Console → *Users and permissions*.

## iOS — TestFlight

Completar antes en `eas.json`:

- `appleId` — el email de la cuenta de desarrollador
- `ascAppId` — el número en la URL de la app en App Store Connect
- `appleTeamId` — developer.apple.com → Membership

```bash
eas build -p ios --profile testflight
eas submit -p ios --latest
```

EAS crea certificado y provisioning solo. El bundle id
(`com.bibleaihonduras.app`) ya está en `app.json` y **no se puede cambiar** una
vez publicada la primera build.

## Qué revisar si algo falla

| Síntoma | Causa casi siempre |
|---|---|
| App abre en blanco | Faltan las `EXPO_PUBLIC_*` en el perfil de `eas.json` |
| Todas las respuestas dicen "no encontré contenido relevante" | El corpus no está ingerido (`npm run rag:ingest`) |
| `eas submit -p ios` rechaza | Falta el ícono 1024 o el cuestionario App Privacy |
| Play rechaza el AAB | Falta completar *App content* (política, clasificación, data safety) |
