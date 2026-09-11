# Verificación manual: login por correo (#104)

| Field | Value |
|-------|-------|
| Version | 0.1.0 |
| Last updated | 2026-09-10 |
| Owner | quien tenga acceso al dashboard de Clerk de la instancia de beta |
| Environment | development build en dispositivo real (Expo Go sirve para este flujo, pero usá el dev build para que sea igual al de los testers) |
| Build / commit | rama `fix/104-clerk-email-code` |
| Cubierto por tests | `src/features/auth/emailCodeFlow.test.ts` (lógica pura: ramas, mapeo de errores, cooldown) |

## 1. Por qué existe este documento

El fix de #104 corrige la lógica de la app, pero **dos criterios de aceptación del issue
no se pueden verificar desde el repo**: que el código llegue al buzón en menos de 60 s y
que `email_code` esté activo en la instancia de Clerk. Las dos cosas dependen de
credenciales del dashboard de Clerk y de un dispositivo. Nadie las probó todavía.

## 2. Prerequisites

- [ ] Acceso de admin al dashboard de Clerk de la instancia que usan los testers de beta
  (la que corresponde a la `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` del perfil de beta en
  `eas.json`). Confirmá que es la misma instancia, no la de development.
- [ ] Dev build instalado en un iPhone y un Android reales.
- [ ] Dos buzones de correo a mano:
  - **A** — correo nunca usado en la app (para el registro).
  - **B** — correo que ya entró con Google (para el caso "otro método").
- [ ] Un correo con dominio de Honduras o Gmail; anotá cuál usaste (los filtros de spam
  cambian por proveedor).

## 3. Configuración de Clerk (hacer esto primero)

Si algo de acá está mal, el código nunca llega y la app no puede hacer nada.

1. **User & Authentication → Email, Phone, Username**
   - [ ] `Email address` está **habilitado** como identificador y marcado como
     *required* (o al menos *used for sign-in*).
   - [ ] En las opciones de verificación del email, **`Email verification code`
     está activo**. Si solo está `Email verification link`, el flujo de la app
     (estrategia `email_code`) falla con `factor_not_found` y el tester ve
     *"Ese correo ya entra con Google o Apple"*, que es un mensaje engañoso para
     ese caso. **Este es el primer sospechoso del reporte de beta.**
   - [ ] Anotá si `Password` está activo. Si lo está, Clerk puede preferir password
     como primer factor; el flujo igual pide `email_code` explícitamente, pero
     conviene saberlo.
2. **User & Authentication → Social Connections**
   - [ ] Google y Apple siguen activos (no rompemos #101).
3. **Customization → Emails** (o *Messaging*, según la versión del dashboard)
   - [ ] La plantilla *Verification code* existe y no está deshabilitada.
   - [ ] **Dominio de envío**: si está en el dominio compartido de Clerk
     (`@clerk...`), anotalo — es la causa típica de que el correo caiga en spam
     en Honduras. Si hay dominio propio, verificá que SPF/DKIM estén en verde.
4. **Configure → Restrictions**
   - [ ] No hay allowlist/blocklist que bloquee el dominio del correo de prueba.
   - [ ] Anotá el límite de rate limiting, si lo ves: el cooldown de 30 s de la app
     es de UX, no reemplaza el del servidor.

Dejá el resultado de esta sección escrito en el issue #104 (captura o lista), porque
es la parte que el equipo no puede reproducir.

## 4. Guion de prueba en la app

Pantalla: `Bienvenido a Bible AI` → **Usar mi correo**.

| # | Acción | Esperado |
|---|--------|----------|
| 1 | En el paso "Tu correo", tocá **Volver** | Vuelve a la pantalla de login con Google/Apple. Antes del fix no había salida. |
| 2 | Entrá de nuevo, escribí el correo **A** (nuevo) y tocá **Enviar código** | El botón pasa a "Enviando…", después aparece el paso "Revisá tu correo" con el correo A en el texto |
| 3 | Cronometrá el buzón de **A** | **El código de 6 dígitos llega en menos de 60 s.** Si tarda más o no llega, revisá spam y volvé a §3.3 |
| 4 | Escribí el código y tocá **Confirmar** | Entra a onboarding. En Clerk aparece un usuario nuevo con ese correo |
| 5 | Cerrá sesión (Ajustes) y repetí con el mismo correo **A** | Ahora es sign-in, no registro: el código llega igual |
| 6 | En el paso del código, mirá el botón de reenviar | Dice **"Reenviar en 30 s"** y está deshabilitado; el número baja 1 por segundo |
| 7 | Tocá el botón deshabilitado varias veces | No pasa nada, no llega un segundo código |
| 8 | Cuando llegue a 0, el botón dice **"Reenviar código"**. Tocalo **dos veces rápido** | Llega **un solo** código nuevo, y el contador vuelve a 30 s |
| 9 | Usá el código nuevo | Entra bien (el código viejo puede quedar invalidado por Clerk; eso es esperado) |
| 10 | Volvé al paso de correo con **Usar otro correo**, escribí el correo **B** (registrado con Google) y enviá | Mensaje **"Ese correo ya entra con Google o Apple. Volvé y entrá con ese botón."** — NO el genérico |
| 11 | Poné el avión en modo vuelo y tocá **Enviar código** | Mensaje **"Parece que no tenés conexión. Revisá tu internet e intentá de nuevo."** |
| 12 | Con red, escribí un código incorrecto (`000000`) y confirmá | Mensaje **"Código incorrecto o vencido. Pedí uno nuevo."** y se queda en el paso del código |

## 5. Casos negativos / bordes

- [ ] Correo con espacios al inicio o al final: se recorta, el envío funciona.
- [ ] Correo mal formado (`luis@@x`): mensaje *"No pudimos enviarte el código…"*,
  y **no** se crea usuario en Clerk.
- [ ] Matar la app en el paso del código y volver a abrirla: se vuelve a empezar
  desde el correo (no queda a medias sin salida).
- [ ] Teclado tapando el input en Android: **no es de este ticket**, lo cubre #105
  (`AppScreen`). Si pasa, anotalo ahí, no acá.

## 6. Sign-off

| Criterio de aceptación del issue | Estado | Quién / cuándo |
|---|---|---|
| Registro con correo nuevo → código en <60 s | ⬜ | |
| Sign-in con correo existente → llega el código | ⬜ | |
| Reenviar con cooldown, sin doble envío | ⬜ (lógica con tests; falta el envío real) | |
| Correo de Google muestra el mensaje correcto | ⬜ | |
| Se puede volver desde el paso de correo | ⬜ | |
| `email_code` activo en la instancia de beta | ⬜ | |

Con los 6 en verde, cerrar #104 y desbloquear #101.
