# Builds de la beta — TestFlight y Google Play

Contexto: #93. Perfiles en `eas.json`. La app es managed (no hay `android/` ni
`ios/` en el repo); EAS hace el prebuild en la nube.

## Un solo entorno compartido (#142)

Proyecto `luiscf1226/bible-ai-honduras`. Decisión temporal y consciente: hasta
nuevo aviso, **los cuatro perfiles** (`apk`, `play`, `testflight`,
`production`) usan el mismo backend y la misma autenticación:

| | Deployment / instancia | Lo usa |
|---|---|---|
| Convex | `neighborly-kudu-508` (`https://neighborly-kudu-508.convex.cloud`) | `apk`, `play`, `testflight`, `production` |
| Clerk | instancia test `moved-ram-3630` (`pk_test_…`) | `apk`, `play`, `testflight`, `production` |

Esto significa que TestFlight, producción y testers **comparten usuarios,
datos, cuotas y entitlements**. No es un descuido: no se creará Clerk live ni
se migrará a otro deployment de Convex mientras esta decisión siga vigente.

El deployment `optimistic-labrador-439` **no se usa** — se documenta acá para
no borrarlo por error, no porque siga sirviendo producción.

## Antes de la primera build

Las URLs de Convex y la key de Clerk ya están en `eas.json`, iguales en los
cuatro perfiles. No debería quedar ningún placeholder `REEMPLAZAR`.

| Variable | De dónde sale |
|---|---|
| `EXPO_PUBLIC_CONVEX_URL` | Ya configurada (tabla de arriba) |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API Keys (instancia test) |

> **Estas dos van dentro del perfil, no en `.env.local`.** `.env.local` no viaja
> a los servidores de EAS. Si faltan, la build compila pero la app abre en
> pantalla blanca, sin mensaje de error.

Las claves privadas (Anthropic, OpenAI, Clerk issuer) no van acá: viven en el
deployment de Convex.

### `CLERK_JWT_ISSUER_DOMAIN` — vía GitHub Actions, no a mano

`.github/workflows/sync-clerk-env.yml` (workflow_dispatch) corre
`npx convex env set CLERK_JWT_ISSUER_DOMAIN ...` en el deployment de test, en
el de producción, o en los dos. Actions → *Sync Clerk env a Convex* → *Run
workflow* → elegir "test", "produccion" o "ambos".

Necesita, por única vez, dos **GitHub Environments** (Settings → Environments)
con estos secrets — mismo nombre en los dos, valor distinto:

| Environment | `CONVEX_DEPLOY_KEY` | `CLERK_JWT_ISSUER_DOMAIN` |
|---|---|---|
| `convex-test` | Deploy key de `neighborly-kudu-508` (dashboard de Convex → ese deployment → Settings) | Issuer de la instancia de Clerk de desarrollo |
| `convex-production` | Deploy key de `optimistic-labrador-439` | Issuer de la instancia de Clerk **live** |

Ponerle "Required reviewers" al environment `convex-production` obliga a que
alguien apruebe antes de tocar el deployment real — es la manera de no
mandar el issuer equivocado a producción sin querer.

> Mientras dure la decisión temporal de #142, el target "producción" de este
> workflow apunta a un deployment (`optimistic-labrador-439`) que **ningún**
> perfil de `eas.json` usa. No hace falta correrlo hasta que se retome la
> migración a un Clerk live y un Convex de producción real.

`ANTHROPIC_API_KEY` y `OPENAI_API_KEY` siguen siendo manuales (`npx convex env
set [--prod] NOMBRE valor`): son secretos de proveedor, no de Clerk, y no
entran en el alcance de este workflow.

## Estado del deployment canónico — 2026-09-15

| | `neighborly-kudu-508` (usado por los 4 perfiles) |
|---|---|
| Funciones e índices de `master` | ✅ publicadas |
| Variables (`CLERK_JWT_ISSUER_DOMAIN`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) | ✅ |
| `CLERK_SECRET_KEY` (borra la identidad de Clerk al eliminar cuenta, #142) | ⚠️ pendiente |
| Corpus RV1909 (`verses`, 31.102) | ✅ ingerido |
| Migraciones `migrateUnavailableBibleVersions` y `migrateOnboardedFromConsent` | ✅ corridas |
| Planes de lectura sembrados (anual + 6 recorridos) | ✅ |
| Key de Clerk en `eas.json` | ✅ `pk_test_…` en los 4 perfiles |

Migrar a un Clerk live y a un Convex de producción separado (`optimistic-labrador-439`,
hoy sin usar) queda fuera de alcance mientras la decisión de #142 siga vigente.

> Nombres de cron: **solo ASCII**. Un identificador con tildes hace fallar el push
> completo con `InvalidModules` (PR #135) y los tests no lo detectan.

## Perfiles

| Perfil | Sale | Convex | Para qué |
|---|---|---|---|
| `apk` | APK | test | Instalación directa por link. La ronda más rápida |
| `play` | AAB | test | Google Play → Internal testing |
| `testflight` | IPA | test | App Store Connect → TestFlight |
| `production` | AAB / IPA | **prod** | Lanzamiento real (#39). No usar para la beta |

`autoIncrement` + `appVersionSource: remote` hacen que EAS lleve el número de
build. No hay que tocar `version` en `app.json` a mano entre builds.

## Build local — `scripts/build-local.sh`

```bash
npm run build:local -- android apk          # APK instalable por link
npm run build:local -- android play         # AAB para Play Internal testing
npm run build:local -- ios testflight       # IPA para TestFlight
npm run build:local -- <android|ios> production
```

Compila en esta máquina con `eas build --local` en vez de encolarse en la nube
de EAS. El script valida la combinación plataforma/perfil contra `eas.json`,
chequea las herramientas nativas necesarias (Xcode + CocoaPods para iOS;
`ANDROID_HOME` + JDK para Android) y la sesión de `eas-cli`, y falla rápido con
un mensaje claro si falta algo — antes de una compilación que puede tardar
varios minutos.

Requiere macOS para iOS (Xcode no corre en Linux/CI). Android sí puede
compilarse local en cualquier SO con el SDK instalado.

El artefacto queda en el directorio actual. Para subirlo:

```bash
npx eas-cli submit -p android --profile play --path build.aab       # Play
npx eas-cli submit -p ios --profile testflight --path build.ipa     # TestFlight
```

- **Android — primer APK**: la primera vez pide keystore, **dejá que EAS lo
  genere** y guardalo — sin él no se puede actualizar la app en Play después.
- **Android — Play Internal testing**: la **primera** subida hay que hacerla a
  mano en Play Console (Google no acepta el primer AAB por API). El submit
  necesita `play-service-account.json` en la raíz (gitignored) — se crea en
  Google Cloud Console y se le da acceso desde Play Console → *Users and
  permissions*.
- **iOS — TestFlight**: `appleId`, `ascAppId`, `appleTeamId` y la API key de
  App Store Connect ya están en `eas.json` (PR #125); el `.p8` va en
  `.secrets/`, que está ignorado. EAS crea certificado y provisioning solo. El
  bundle id (`com.bibleaihonduras.app`) ya está en `app.json` y **no se puede
  cambiar** una vez publicada la primera build.

## Build en la nube (alternativa)

Sin instalar nada nativo, a costa de la cola de EAS:

```bash
eas build -p android --profile apk
eas build -p ios --profile testflight
```

## Qué revisar si algo falla

| Síntoma | Causa casi siempre |
|---|---|
| App abre en blanco | Faltan las `EXPO_PUBLIC_*` en el perfil de `eas.json` |
| Todas las respuestas dicen "no encontré contenido relevante" | El corpus no está ingerido (`npm run rag:ingest`) |
| `eas submit -p ios` rechaza | Falta el cuestionario App Privacy (el ícono 1024 ya está, PR #136) |
| Play rechaza el AAB | Falta completar *App content* (política, clasificación, data safety) |
