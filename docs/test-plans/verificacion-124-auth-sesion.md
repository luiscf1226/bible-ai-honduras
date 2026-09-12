# Verificación manual: sesión y onboarding (#124)

| Field | Value |
|-------|-------|
| Version | 0.1.0 |
| Last updated | 2026-09-11 |
| Owner | quien tenga el dev build en un dispositivo real y acceso al dashboard de Clerk/Convex de la beta |
| Environment | **development build o build de beta en dispositivo real.** Expo Go NO sirve: el bug vive en `expo-secure-store` + el módulo nativo de Clerk, que Expo Go no ejecuta igual |
| Build / commit | rama `fix/124-auth-onboarding-sesion` |
| Cubierto por tests | `src/features/auth/startupRoute.test.ts` (las 3 ramas + sesión), `src/lib/secureTokenCache.test.ts`, `src/features/auth/emailCodeFlow.test.ts` (reenvío), `convex/users.test.ts` (onboardedAt + migración) |

## 1. Por qué existe este documento

El fix del **síntoma A** (onboarding repetido) es determinístico y está cubierto por
tests. El **síntoma B** ("el login no se guarda") no: sus cuatro hipótesis solo se
distinguen con datos de runtime en un build nativo, matando y reabriendo la app.

**Nadie corrió esto en un dispositivo todavía.** Lo que se hizo en el PR fue:

- descartar por lectura de código las hipótesis 2 y 3 y **arreglar los dos defectos
  reales** que encontró esa lectura (ver §5);
- dejar de mandar al splash a quien tiene sesión viva de Clerk (hipótesis 1), que es
  el síntoma que el usuario reportó;
- instrumentar el caso degradado para que este documento se pueda completar con datos
  en vez de con suposiciones.

La hipótesis 1 y la 4 quedan **sin confirmar ni descartar** hasta que alguien corra §4.

## 2. Prerequisites

- [ ] Dev build (o build interno de beta) instalado en un iPhone **y** un Android reales.
- [ ] Acceso al dashboard de Clerk de la instancia que usa ese build (la de la
      `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` del perfil correspondiente en `eas.json`).
- [ ] Acceso al deployment de Convex de ese build.
- [ ] Una cuenta de Google, una de Apple y un correo a mano.
- [ ] Consola de logs abierta (`npx expo start --dev-client` y leer la terminal, o
      Console.app / `adb logcat`). **Los cuatro datos del §4 se imprimen ahí.**

## 3. Antes de publicar el build: la migración

`onboardedAt` es un campo nuevo. Sin migrar, **todos** los usuarios existentes ven el
onboarding una vez más al actualizar.

```bash
npx convex run users:migrateOnboardedFromConsent '{}'
```

- [ ] Corrida contra el deployment de la beta. Anotá el resultado: `{ scanned: N, migrated: M }`.
- [ ] `M` coincide con la cantidad de usuarios que tienen `aiConsentAt` en el dashboard.

> Red de seguridad: `users.upsert` también rellena `onboardedAt` desde `aiConsentAt` en
> el primer arranque de cada usuario. Aun así, corré la migración: el backfill perezoso
> compite con la primera lectura de `users.current` y puede llegar un frame tarde.

## 4. Captura de runtime del síntoma B

Esto es lo que falta para cerrar el issue de verdad. Hacelo **una vez por plataforma**.

### 4.1 Sesión que sobrevive a matar la app

1. [ ] Instalar limpio (borrar la app primero, para vaciar el keychain).
2. [ ] Entrar con **Google**. Anotar que llegaste al onboarding.
3. [ ] Completar el onboarding y el consentimiento hasta ver `/home`.
4. [ ] **Matar la app** (swipe desde el multitarea, no solo mandarla al fondo).
5. [ ] Reabrir.
   - [ ] **Esperado:** cae en `/home` sin pasar por `/splash` ni por el onboarding.
   - [ ] Si aparece `/splash`: **el síntoma B es real**, seguí en §4.2.
6. [ ] Repetir 4–5 después de **reiniciar el teléfono** sin desbloquearlo primero
       (abrir la app desde la pantalla de bloqueo, con Face ID). Esto es lo que ejercita
       `keychainAccessible` (hipótesis 4).
7. [ ] Repetir todo con **Apple** y con **correo**.

### 4.2 Los cuatro datos

Si §4.1 falla, la app ahora espera hasta 12 s antes de caer al splash, y en ese momento
imprime el diagnóstico. Buscá en la consola las líneas `[auth #124]` y copiá acá:

| Dato | Dónde sale | Valor observado |
|------|-----------|-----------------|
| `Clerk.isSignedIn` | `isSignedIn` en el objeto del log | |
| `Clerk.sessionId` | `sessionId` en el objeto del log | |
| `useConvexAuth().isAuthenticated` | `convexIsAuthenticated` | |
| `useConvexAuth().isLoading` | `convexIsLoading` | |
| `getToken({template:"convex"})` | línea `getToken({template:'convex'}) → …` | |

Lectura del resultado:

- `isSignedIn: true` + `convexIsAuthenticated: false` + `getToken → null` o `lanzó`
  → **hipótesis 1 confirmada.** Es configuración de Clerk/Convex, no código de la app:
  revisá en Clerk que exista el JWT template llamado exactamente `convex`, y que su
  issuer sea el mismo valor que `CLERK_JWT_ISSUER_DOMAIN` en las env vars de Convex
  (`convex/auth.config.ts`). Revisá también que el reloj del dispositivo esté en hora.
- `isSignedIn: false` y `sessionId: null` tras matar la app
  → **hipótesis 4.** El token no sobrevivió a SecureStore. Anotá si el teléfono estaba
  bloqueado al abrir.
- El diagnóstico **no aparece** y la app entra bien → el síntoma B era percepción del
  síntoma A (ver el onboarding otra vez se siente como "no me reconoció").

- [ ] Tabla completada en iOS.
- [ ] Tabla completada en Android.
- [ ] Hipótesis confirmada: ______________

## 5. Lo que sí quedó verificado sin dispositivo

Por lectura del `@clerk/expo@4.5.0` instalado, y cubierto con tests:

- **Hipótesis 2 — confirmada como defecto y arreglada.** El `getToken` viejo borraba la
  key en el `catch`. Un fallo transitorio de SecureStore destruía el token. Ahora
  devuelve `null` y deja el dato donde está (`src/lib/secureTokenCache.ts`).
- **Hipótesis 3 — confirmada como hueco y arreglada.** `clearToken` es *opcional* en
  la interfaz `TokenCache` (`@clerk/expo/dist/cache/types.d.ts`), así que no era un
  error de tipos, pero Clerk sí lo llama:
  `dist/provider/nativeClientSync.js` hace `tokenCache?.clearToken?.(CLERK_CLIENT_JWT_KEY)`.
  Sin implementarlo, el JWT del cliente quedaba en el keychain tras cerrar sesión.
- **Bonus de la misma lectura:** el `tokenCache` oficial de Clerk usa
  `keychainAccessible: AFTER_FIRST_UNLOCK` y el nuestro usaba el default
  (`WHEN_UNLOCKED`), que no se puede leer si el proceso arranca con el teléfono
  bloqueado. Ahora usa el mismo que Clerk. **Esto solo se puede comprobar con §4.1 paso 6.**

## 6. Síntoma A — regresión del onboarding

Cubierto por tests, pero el recorrido completo conviene verlo una vez:

1. [ ] **Usuario nuevo:** login → ve el onboarding → lo completa → consentimiento → home.
2. [ ] Cerrar sesión y volver a entrar con la misma cuenta → **cae en home, sin onboarding.**
3. [ ] **Usuario que salta:** cuenta nueva → login → "Saltar" → consentimiento.
       Cerrar sesión y entrar → **no vuelve a ver el onboarding.**
4. [ ] **Usuario existente (migrado):** cuenta que ya tenía `aiConsentAt` antes de este
       build → actualizar la app → entrar → **no ve el onboarding.**
5. [ ] Repetir 1–2 con Apple y con correo.
6. [ ] Sin red al tocar "Empezar": la app avanza igual al consentimiento (la marca se
       reintenta después). Anotá si al volver la red el onboarding no reaparece.

## 7. Reenvío del código por correo

El botón que agregó #104. El reporte dice que "no funciona o loopea".

1. [ ] Entrar con correo, pedir el código y quedarse en la pantalla de 6 dígitos.
2. [ ] Esperar los 30 s del cooldown. El botón pasa de "Reenviar en N s" a "Reenviar código".
3. [ ] Tocarlo.
   - [ ] Llega un **segundo** correo.
   - [ ] El contador vuelve a 30 s.
   - [ ] Si falla, **ahora aparece un mensaje de error en pantalla**. Antes la excepción
         se perdía como unhandled rejection y el botón quedaba mudo — ese era el bug.
         Copiá el mensaje y la línea de consola.
4. [ ] Probar con un correo **nuevo** (camino sign-up) y con uno **existente** (sign-in):
       son dos APIs distintas de Clerk.
5. [ ] Mandar la app al fondo 2 minutos, volver, y recién ahí tocar "Reenviar".
       Es el caso en que el intento de sign-in se pierde del cliente y el código viejo
       lanzaba. **Esperado: reenvía igual** (se re-crea el intento con el correo).

## 8. Sign-off

| Quién | Plataforma | Fecha | Resultado |
|-------|-----------|-------|-----------|
| | iOS | | |
| | Android | | |
