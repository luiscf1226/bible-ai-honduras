# Verificación manual — #107 Cuenta: cerrar sesión y eliminar cuenta

**Estado de lo automatizado:** `convex/deleteAccount.test.ts` verifica tabla por
tabla el borrado en cascada (incluido el blob de `_storage`) y que otro usuario
sobrevive intacto; `src/lib/revenuecat.test.ts` cubre `logOut()`.
`npx vitest run` y `npx tsc --noEmit` están en verde.

**Lo que NO se pudo verificar en este worktree** (no hay device ni dev-build, y
no hay deployment de Convex ni instancia de Clerk conectados): todo lo de este
documento. Nada de acá se afirmó como probado en el PR.

## Prerrequisitos

- Development build de Expo (no Expo Go) en iOS y en Android — RevenueCat y las
  notificaciones locales no funcionan en Expo Go.
- Convex con `CLERK_JWT_ISSUER_DOMAIN` y **`CLERK_SECRET_KEY`** configuradas:
  `npx convex env set CLERK_SECRET_KEY sk_live_...`.
  Sin esa key el borrado de datos ocurre igual, pero la identidad de Clerk
  sobrevive y la app muestra el aviso "Tus datos ya se borraron" (estado
  `clerk_pendiente`). Ese camino también hay que probarlo (caso C).
- Acceso al dashboard de Clerk (para ver si el usuario desaparece) y al
  dashboard de Convex (para ver las tablas y `_storage`).
- Una cuenta de prueba desechable con correo real al que se pueda volver a
  entrar.

## Caso A — Cerrar sesión

| # | Acción | Esperado |
|---|--------|----------|
| 1 | Entrar con la cuenta de prueba y llegar al Home | Se ve el devocional del día |
| 2 | Ajustes → Recordatorio → elegir la hora 6 | Queda la píldora 6 activa y el aviso diario queda agendado |
| 3 | Ajustes → bajar a la sección **Cuenta** | Se ve el correo de la cuenta, **Cerrar sesión** y **Eliminar mi cuenta** (en rojo) |
| 4 | Tocar **Cerrar sesión** | Diálogo "¿Cerrar sesión?" con Cancelar / Cerrar sesión |
| 5 | Tocar **Cancelar** | No pasa nada, la sesión sigue viva |
| 6 | Tocar **Cerrar sesión** → confirmar | La app vuelve a `/splash` (pantalla "Toca para entrar") |
| 7 | Matar la app y volver a abrirla | Arranca en `/splash` y pide login; no entra sola al Home |
| 8 | Esperar hasta pasada la hora del recordatorio (o adelantar el reloj del device) | **No llega** la notificación "Devocional de hoy" |
| 9 | (Android) Volver a entrar con la misma cuenta y revisar el plan | Si la cuenta era Pro, sigue siendo Pro (cerrar sesión no toca la suscripción) |

Verificación técnica del paso 6-8: con el device conectado, en logs no debe
quedar ninguna notificación agendada (`getAllScheduledNotificationsAsync` vacío
para `kind: "daily-devotional"`).

## Caso B — Eliminar mi cuenta con `CLERK_SECRET_KEY` configurada

Antes de empezar, dejar la cuenta "sucia" a propósito:

1. Hacer 2 preguntas en **Preguntar**.
2. Hablar con un personaje en **Voces**.
3. Generar un devocional en **Sentir**.
4. Generar **una historia completa** en Historias y esperar a que las imágenes
   queden listas (esto es lo que crea blobs en `_storage`).
5. En el dashboard de Convex, anotar: filas en `users`, `conversations`,
   `messages`, `usage`, `entitlements`, `stories` y la cantidad de archivos en
   **Files** (`_storage`).

| # | Acción | Esperado |
|---|--------|----------|
| 1 | Ajustes → Cuenta → **Eliminar mi cuenta** | Diálogo paso 1: enumera qué se borra, dice que es irreversible y **avisa que eliminar la cuenta no cancela la suscripción de la tienda** |
| 2 | Tocar **Cancelar** | Vuelve a Ajustes sin borrar nada |
| 3 | Repetir y tocar **Continuar** | Aparece el paso 2 dentro de la tarjeta: texto, campo de texto y botón **Eliminar mi cuenta para siempre** deshabilitado |
| 4 | Escribir `ELIMIN` | El botón sigue deshabilitado |
| 5 | Escribir `ELIMINAR` | El botón se habilita |
| 6 | Tocar **Cancelar** (botón quieto) | El paso 2 se cierra y el campo se limpia |
| 7 | Rehacer 1-5 y tocar **Eliminar mi cuenta para siempre** | El botón pasa a "Eliminando…", después la app vuelve a `/splash` |
| 8 | Convex → Data | `users`, `conversations`, `messages`, `usage`, `entitlements` y `stories` no tienen ninguna fila de esa cuenta |
| 9 | Convex → Files (`_storage`) | Los archivos de las escenas de la historia **ya no están** (contar contra lo anotado antes) |
| 10 | Dashboard de Clerk → Users | El usuario ya no existe |
| 11 | Matar y reabrir la app | Arranca en `/splash` y pide login |
| 12 | Registrarse **con el mismo correo** | Entra como cuenta nueva: pide consentimiento de IA, historial vacío, plan gratis, cuotas en cero |
| 13 | Esperar la hora del recordatorio | No llega ninguna notificación de la cuenta borrada |

## Caso C — Eliminar cuenta con Clerk caído o sin secret

Simular: `npx convex env unset CLERK_SECRET_KEY` (o poner una key inválida) y
volver a hacer el flujo con otra cuenta de prueba sembrada igual que en el caso B.

| # | Acción | Esperado |
|---|--------|----------|
| 1 | Completar el flujo de dos pasos | Aparece el aviso "Tus datos ya se borraron… la baja del correo puede tardar unos minutos" |
| 2 | Tocar **Entendido** | La app cierra sesión y vuelve a `/splash` |
| 3 | Convex → Data y Files | No queda ninguna fila ni ningún blob de esa cuenta |
| 4 | Dashboard de Clerk | El usuario **todavía existe** (esperado: es el estado `clerk_pendiente`) |
| 5 | Volver a entrar con ese mismo correo | Entra como cuenta limpia (se recrea el espejo local vacío vía `users.upsert`) |
| 6 | Logs de Convex | Hay un `console.error` explicando que `CLERK_SECRET_KEY` no está configurada o que el `DELETE /v1/users` falló |

Después del caso C, **volver a poner la secret key** y borrar a mano el usuario
que quedó en Clerk.

## Caso D — Cuenta con mucho historial (borrado por lotes)

| # | Acción | Esperado |
|---|--------|----------|
| 1 | En una cuenta de prueba, generar más de 300 mensajes (bucle de preguntas o insertando filas desde `npx convex run`) | — |
| 2 | Eliminar la cuenta desde la app | Termina sin error (el backend hace varias pasadas de 256 filas) y las tablas quedan vacías |

## Caso E — Sin conexión

| # | Acción | Esperado |
|---|--------|----------|
| 1 | Poner el device en modo avión y completar el flujo de dos pasos | Aparece "No pudimos eliminar tu cuenta. Revisá tu conexión e intentá de nuevo." y la sesión **sigue viva** |
| 2 | Volver a tener conexión y reintentar | Borra normalmente |

## Firma

- [ ] Caso A (iOS) — quién / fecha:
- [ ] Caso A (Android) — quién / fecha:
- [ ] Caso B (iOS) — quién / fecha:
- [ ] Caso B (Android) — quién / fecha:
- [ ] Caso C — quién / fecha:
- [ ] Caso D — quién / fecha:
- [ ] Caso E — quién / fecha:
