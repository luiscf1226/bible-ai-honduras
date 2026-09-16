# Beta cerrada — otorgar Pro a un tester

Contexto: #93. La beta corre **sin RevenueCat**, así que no hay compra real.
La autoridad de `isPro` no es el SDK sino la tabla `entitlements` de Convex,
así que se puede escribir esa fila a mano y los 4 módulos se desbloquean igual (#32).

## Requisito previo

El tester tiene que **haber entrado al menos una vez** a la app. El primer login
corre `users.upsert` y crea su fila en `users`. Sin eso el comando devuelve
`{ ignored: true }` y no hace nada — igual que el webhook, no creamos usuarios
desde afuera.

## Sacar el `clerkId`

Es el `identity.subject` de Clerk (`user_2abc...`). Dos formas:

- **Clerk dashboard** → *Users* → abrir el tester → copiar el *User ID*.
- **Convex dashboard** → tabla `users` → columna `clerkId`.

## Otorgar Pro

```bash
npx convex run entitlements:grantProForBeta '{"clerkId":"user_2abc..."}'
```

Con vencimiento (epoch en milisegundos):

```bash
npx convex run entitlements:grantProForBeta \
  '{"clerkId":"user_2abc...","expiresAt":1788000000000}'
```

## Revocar

```bash
npx convex run entitlements:grantProForBeta '{"clerkId":"user_2abc...","isPro":false}'
```

## Verificar

En el Convex dashboard, tabla `entitlements`: la fila del tester debe tener
`isPro: true` y `source: "beta_manual"`.

En la app, el tester **cierra sesión y vuelve a entrar** (o espera a que
`entitlements.mine` se refresque) y los 4 módulos dejan de contar cuota.

## Por qué `source: "beta_manual"`

Distingue un Pro de cortesía de uno comprado. Cuando #39 conecte RevenueCat de
verdad, estas filas se pueden auditar o limpiar sin tocar las compras reales.

## Seguridad

`grantProForBeta` es un `internalMutation`: **no se puede llamar desde la app**,
solo desde el dashboard de Convex o `npx convex run` con las credenciales del
deployment. Un tester no puede auto-otorgarse Pro.

---

# Versión de la Biblia en la beta — una sola

Contexto: #93 §4a/§4b. Qué versiones están vivas lo manda
`convex/bibleVersions.ts` (`AVAILABLE_BIBLE_VERSIONS`) — hoy, una sola. Las
demás siguen en el schema para no romper filas viejas, pero no tienen corpus
ingerido y su licencia sigue sin resolver (`PRD.md` §6). Para habilitar otra
cuando exista corpus, agregarla a esa constante: eso reactiva la píldora de
Ajustes y la recuperación de una sola vez.

## Qué pasa hoy con un usuario en una versión sin corpus

- **Ajustes** muestra la píldora deshabilitada, con «RVR1960 y NVI todavía no
  están disponibles: son de licencia comercial.»
- **Guardar** se coerce a la versión disponible (`users.updatePreferences`). Se
  coerce en vez de lanzar para no romper builds ya instaladas en la beta.
- **Leer** una preferencia vieja degrada antes de tocar el índice
  (`resolveBibleVersion`), en Preguntar, Voces, Sentir y `verses.citedForUser`.

Sin esa degradación, ese usuario recibía cero citas en los tres módulos —
sin error, solo «no encontré contenido relevante» para siempre.

## Migrar filas viejas

```bash
npx convex run users:migrateUnavailableBibleVersions '{}'
```

Devuelve `{ scanned, migrated }`. Es idempotente: correrlo dos veces da
`migrated: 0` la segunda vez. Correlo una vez sobre el deployment de la beta.

## Después de cada deploy — migraciones y siembra

Idempotentes; correrlas de nuevo no rompe nada. En test sin flag, en producción con `--prod`.

```bash
# #124: quien ya aceptó el consentimiento no vuelve a ver el onboarding
npx convex run users:migrateOnboardedFromConsent '{}'

# #114/#115: siembra el plan anual y los recorridos que falten
# (también lo hace el cron diario `sembrar-planes-lectura`)
npx convex run readingPlans:ensurePlanSeeded '{}'
```

Estado al 2026-09-12: corridas en test y en producción.
