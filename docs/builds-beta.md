# Builds de la beta — TestFlight y Google Play

Contexto: #93. Perfiles en `eas.json`. La app es managed (no hay `android/` ni
`ios/` en el repo); EAS hace el prebuild en la nube.

## Antes de la primera build

**Reemplazá los `REEMPLAZAR` de `eas.json`.** Los tres perfiles llevan las
mismas dos variables:

| Variable | De dónde sale |
|---|---|
| `EXPO_PUBLIC_CONVEX_URL` | `npx convex deploy` (usar la URL de **producción**) |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API Keys |

> **Estas dos van dentro del perfil, no en `.env.local`.** `.env.local` no viaja
> a los servidores de EAS. Si faltan, la build compila pero la app abre en
> pantalla blanca, sin mensaje de error.

Las claves privadas (Anthropic, OpenAI, Clerk issuer) no van acá: viven en el
deployment de Convex.

```bash
npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN https://tu-instancia.clerk.accounts.dev
npx convex env set --prod ANTHROPIC_API_KEY sk-ant-...
npx convex env set --prod OPENAI_API_KEY sk-...
```

## Perfiles

| Perfil | Sale | Para qué |
|---|---|---|
| `apk` | APK | Instalación directa por link. La ronda más rápida |
| `play` | AAB | Google Play → Internal testing |
| `testflight` | IPA | App Store Connect → TestFlight |

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
