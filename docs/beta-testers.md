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

# Versión de la Biblia en la beta — solo RVR1960

Contexto: #93 §4b. La beta sale **solo con RVR1960**. NVI sigue en el schema
(`bibleVersion: "RVR1960" | "NVI"`) para no romper filas viejas, pero no hay
corpus NVI ingerido y la licencia sigue sin resolver (`PRD.md` §6).

`convex/bibleVersions.ts` es la única fuente de verdad. Para reactivar NVI
cuando exista corpus, agregarla a `AVAILABLE_BIBLE_VERSIONS` — eso reactiva la
píldora de Ajustes y la recuperación de una sola vez.

## Qué pasa hoy con un usuario en NVI

- **Ajustes** muestra la píldora NVI deshabilitada, con «NVI todavía no está
  disponible. Estamos resolviendo la licencia.»
- **Guardar** NVI se coerce a RVR1960 (`users.updatePreferences`). Se coerce en
  vez de lanzar para no romper builds ya instaladas en la beta.
- **Leer** una preferencia NVI vieja degrada a RVR1960 antes de tocar el índice
  (`resolveBibleVersion`), en Preguntar, Voces, Sentir y `verses.citedForUser`.

Sin esa degradación, un usuario en NVI recibía cero citas en los tres módulos —
sin error, solo «no encontré contenido relevante» para siempre.

## Migrar filas viejas

```bash
npx convex run users:migrateUnavailableBibleVersions '{}'
```

Devuelve `{ scanned, migrated }`. Es idempotente: correrlo dos veces da
`migrated: 0` la segunda vez. Correlo una vez sobre el deployment de la beta.
