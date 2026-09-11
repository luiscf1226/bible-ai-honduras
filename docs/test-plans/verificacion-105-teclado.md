# Verificación manual: el teclado no tapa el campo de texto (#105)

| Field | Value |
|-------|-------|
| Version | 0.1.0 |
| Last updated | 2026-09-10 |
| Owner | Agente D implementó; **la verificación en device la corre un humano** |
| Rama | `fix/105-teclado-appscreen` |
| Environment | **development build** (`npx expo run:ios` / `npx expo run:android`). Expo Go **no sirve**: la app usa `react-native-purchases` y `expo-notifications` |
| Prototipo | `design/Bible AI Honduras.dc.html` (`cd design && python3 -m http.server 8899`) |

## 0. Estado de la verificación — leer primero

> **NO VERIFICADO EN DEVICE.** Nada de este guion se corrió todavía en un
> iPhone ni en un Android. Lo único que se corrió es lo automatizable:
> `npx vitest run` (34 archivos / 215 tests en verde) y `npx tsc --noEmit`
> (0 errores). El criterio *"Probado en iPhone con notch y en Android con barra
> de gestos"* del issue **sigue abierto**.
>
> Por qué no se corrió:
>
> - `adb devices` devuelve la lista vacía: no hay Android conectado ni emulador
>   corriendo.
> - Los simuladores de iOS están apagados y el repo **no tiene** `ios/` ni
>   `android/` (workflow managed, sin prebuild). Verificar en simulador exige
>   `expo prebuild` + build nativo completo (CocoaPods + compilación Xcode),
>   que además ensuciaría el worktree con los dos directorios nativos.
>
> El cierre del issue lo decide el humano después de correr §3 y §4 y anotar los
> resultados en §5.

## 1. Qué cambió (para saber qué estás probando)

| Archivo | Cambio |
|---|---|
| `src/components/AppScreen.tsx` | `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"` + auto-scroll al input enfocado, para las 14 pantallas de una sola vez |
| `src/lib/keyboardAvoidance.ts` | Los números (behavior por plataforma, `keyboardVerticalOffset`, offset del auto-scroll). Es el módulo con tests |
| `src/hooks/useKeyboardAvoidance.ts` | `useScreenInsets()` y `useScrollToEndOnKeyboard()` |
| `app/(tabs)/sentir.tsx` | El campo multilínea topa en el doble de su alto inicial y scrollea adentro |
| `app/(tabs)/preguntar/chat.tsx`, `app/(tabs)/voces/[slug].tsx` | Su `KeyboardAvoidingView` local ahora usa el mismo módulo; `keyboardShouldPersistTaps` en el hilo y en los chips |
| `app.json` | `expo.android.softwareKeyboardLayoutMode: "resize"` → `android:windowSoftInputMode="adjustResize"` en el `MainActivity` del manifest |

`app/(auth)/email.tsx` **no se tocó** (es del issue #104): se cubre solo, vía
`AppScreen`.

## 2. Prerequisites

- [ ] Rama `fix/105-teclado-appscreen`
- [ ] `npx expo prebuild --clean` y después `npx expo run:ios` / `npx expo run:android`.
      El cambio de `app.json` **solo entra con un prebuild/build nativo nuevo**:
      recargar el bundle de JS no reescribe el `AndroidManifest.xml`.
- [ ] `.env.local` con `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`,
      `EXPO_PUBLIC_REVENUECAT_API_KEY`
- [ ] Cuenta Clerk de prueba con cuota libre en `qa`, `voices` y `feelings`
- [ ] **iPhone con notch o Dynamic Island** (iPhone 14 Pro en adelante, o el
      simulador iPhone 16 Pro). El fix del auto-scroll depende de
      `insets.top`; en un iPhone SE el bug original casi no se ve.
- [ ] **Android con barra de gestos** (navegación por gestos activada en
      Ajustes → Sistema → Gestos, no los 3 botones). Android 13+.
- [ ] Teclado del sistema en español, con la barra de sugerencias **activada**
      (suma ~45 px de alto y es el caso peor)

Después de cada build, verificar una sola vez que el manifest quedó bien:

```
grep windowSoftInputMode android/app/src/main/AndroidManifest.xml
# esperado: android:windowSoftInputMode="adjustResize" en la <activity> MainActivity
```

## 3. Guion por pantalla × plataforma

Correr las 4 pantallas en **iPhone con notch** y después las 4 en **Android con
barra de gestos**. Anotar OK / FALLA en §5.

### 3.1 Sentir (`app/(tabs)/sentir.tsx`) — era el caso sin ninguna protección

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Home → «Sentir» | Se ve el chip grid, el campo multilínea y el CTA «Prepárame un devocional» |
| 2 | Tocar el campo «Cuéntame en una o dos líneas…» | El teclado sube y **el campo queda completo arriba del teclado**, con un respiro de ~22 px. No queda pegado al borde del teclado ni cortado por abajo |
| 3 | Escribir 2 líneas | El texto se ve mientras se escribe; el cursor nunca cae debajo del teclado |
| 4 | Seguir escribiendo hasta ~10 líneas | El campo crece **hasta el doble de su alto inicial y ahí para**; de ahí en adelante scrollea adentro del campo. El CTA **no** se va fuera de pantalla: sigue alcanzable scrolleando la pantalla |
| 5 | Con el teclado abierto, tocar el chip «Ansiedad» | El chip **queda seleccionado en el primer tap** (fondo oscuro, texto claro). Ni un tap perdido. Esto es lo que arregla `keyboardShouldPersistTaps="handled"` |
| 6 | Tocar un área vacía de la pantalla (entre el título y los chips) | El teclado se cierra y **no** se dispara ninguna acción |
| 7 | iOS: arrastrar hacia abajo desde arriba del teclado | El teclado baja siguiendo el dedo (`keyboardDismissMode="interactive"`) |
| 8 | Android: scrollear la pantalla | El teclado se cierra al arrastrar (`on-drag`) y el layout no salta |
| 9 | Con el teclado abierto, tocar el CTA | Genera el devocional en el primer tap |
| 10 | Volver, abrir un devocional de «LOS DE ANTES» | Se abre; el teclado no interviene. **Nada del layout de resultado cambió** respecto de master |

### 3.2 Q&A / chat (`app/(tabs)/preguntar/chat.tsx`)

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Preguntar → elegir un pasaje → chat | Header con el pasaje, hilo, chips de sugerencia e input abajo |
| 2 | Tocar «Escribe tu pregunta…» | **El input y el botón ↑ quedan los dos visibles** arriba del teclado. El header sigue arriba, sin saltar |
| 3 | Mirar el hilo al subir el teclado | El hilo se va **al último mensaje** solo (`useScrollToEndOnKeyboard`), no queda mostrando la mitad de arriba |
| 4 | Con el teclado abierto, tocar el chip «¿Cómo lo aplico hoy?» | Manda la pregunta **en el primer tap** |
| 5 | Escribir una pregunta y mandar | El hilo baja al mensaje nuevo (`onContentSizeChange`); el input queda visible |
| 6 | Llegada la respuesta, con el teclado abierto tocar «Compartir» | Abre el share sheet **en el primer tap** |
| 7 | Android: revisar el borde de abajo | El input **no** queda tapado por la barra de gestos ni por el teclado; no hay un hueco del alto de la barra de estado entre el input y el teclado |
| 8 | iPhone con notch: revisar el borde de arriba | El header no se mete debajo del Dynamic Island y no se corre al abrir el teclado |

### 3.3 Voces (`app/(tabs)/voces/[slug].tsx`)

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Voces → cualquier personaje (Moisés, David, Pablo…) | Header con avatar, primer mensaje del personaje, chips e input |
| 2 | Tocar «Pregúntale algo…» | Input + botón ↑ visibles arriba del teclado |
| 3 | Mirar el hilo | Salta al último mensaje solo |
| 4 | Con el teclado abierto, tocar un chip de sugerencia | Manda el mensaje en el primer tap |
| 5 | Con el teclado abierto, tocar «Compartir esta respuesta» | Abre el share sheet en el primer tap |
| 6 | Android con barra de gestos | El input no queda debajo de la barra ni del teclado |
| 7 | Regresión de contenido (regla dura #2) | El personaje sigue hablando en 1ra persona y **no** hay ningún cambio de copy: este fix no toca prompts |

### 3.4 Login por correo (`app/(auth)/email.tsx`) — cubierto sin editar el archivo

El archivo es del issue #104 y **no se modificó**. Lo que se prueba acá es que
el fix de `AppScreen` alcanza para su layout (`contentStyle: justifyContent:
"flex-end"`, input con `autoFocus`, `scroll` en `false` → rama sin ScrollView,
`behavior="padding"` en iOS / `"height"` en Android).

El respiro contra el borde del teclado sale gratis: el `paddingVertical:
tokens.space.xxl` del `content` de `AppScreen` queda **adentro** de lo que el
`KeyboardAvoidingView` encoge, así que el último hijo nunca queda pegado al
teclado.

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Cerrar sesión → «Continuar con correo» | El teclado sube solo por el `autoFocus` |
| 2 | Con el teclado ya arriba, mirar la pantalla | **El campo de correo y el botón «Enviar código» quedan los dos visibles** arriba del teclado. El bloque anclado abajo se sube completo, no se corta |
| 3 | iPhone con notch | El título «Tu correo» no se mete debajo del Dynamic Island |
| 4 | Escribir el correo y mandar | Pasa al paso del código |
| 5 | Paso del código (`autoFocus`, `number-pad`) | El campo de 6 dígitos, «Confirmar» y «Usar otro correo» quedan los tres visibles arriba del teclado numérico |
| 6 | Android con barra de gestos | Igual: los dos botones visibles, sin hueco raro abajo |

> Si el paso 2 o el 5 fallan, **no editar `email.tsx`**: reportarlo en #105 y
> coordinar con quien tenga #104. El arreglo iría en `AppScreen`, no en la
> pantalla. El riesgo conocido es el paso 5 en un teléfono chico: el paso del
> código tiene título + descripción + campo + dos botones, y si con el teclado
> numérico arriba no cabe todo, `behavior="padding"` no tiene de dónde sacar
> espacio (no hay ScrollView en esa rama). La salida sería que `email.tsx` pase
> `scroll` — decisión de #104, no de este issue.

## 4. Regresión de las pantallas sin input

El fix es en el contenedor, así que **las 14 pantallas que usan `AppScreen`**
cambian de árbol de componentes. De esas 14, solo dos tienen `TextInput`
(`sentir.tsx` y `email.tsx`, ya cubiertas en §3.1 y §3.4). Las otras 12 no
deberían cambiar **nada** de comportamiento: abrir cada una y confirmar «se ve
igual que en master».

| Pantalla | Qué mirar |
|---|---|
| `app/splash.tsx` | Logo centrado, sin saltos |
| `app/(auth)/login.tsx` | Botones abajo, en el mismo lugar |
| `app/(auth)/onboarding.tsx` | Paginación y dots iguales |
| `app/(auth)/notifications.tsx` | Igual |
| `app/consentimiento-ia.tsx` | Igual |
| `app/(tabs)/home.tsx` | Devocional del día, modo noche incluido |
| `app/(tabs)/preguntar.tsx` | Selector de libro/capítulo, grid de 5 columnas |
| `app/(tabs)/voces.tsx` | Lista de personajes |
| `app/(tabs)/historias.tsx` | Lista |
| `app/(tabs)/historias/[storyId].tsx` | Paneles de la historia |
| `app/historial.tsx` | Lista |
| `app/ajustes.tsx` | Switches en su lugar |

Chequeo transversal: **modo noche** en al menos dos de ellas (el
`backgroundColor` de `AppScreen` sigue saliendo de `color.surface`), y el
scroll de las que usan `scroll` (`home`, `historial`, `ajustes`, resultado de
`sentir`) — con `keyboardShouldPersistTaps="handled"` un tap sigue activando el
botón a la primera cuando **no** hay teclado abierto.

## 5. Resultados (llenar al correrlo)

| Sección | iPhone con notch (modelo / iOS) | Android con barra de gestos (modelo / Android) |
|---|---|---|
| 3.1 Sentir | | |
| 3.2 Q&A / chat | | |
| 3.3 Voces | | |
| 3.4 Login por correo | | |
| 4 Regresión sin input | | |

Firma de quien lo corrió: ______________  Fecha: ____________
Build / commit probado: ______________

## 6. Casos borde y negativos

- **Teclado con barra de sugerencias / emoji picker abierto**: en Android RN
  reemite `keyboardDidShow` cuando cambia el alto
  (`ReactRootView.java`, `height != mKeyboardHeight`). Abrir el picker de emojis
  con el campo enfocado: el layout tiene que reacomodarse otra vez, no quedarse
  con el alto viejo.
- **Teclado externo / Bluetooth en iPad**: el teclado en pantalla no aparece;
  el layout no debería moverse nada.
- **Rotar el device con el teclado abierto**: `orientation` está en `portrait`
  en `app.json`, así que no debería pasar nada; si aparece un layout raro en
  iPad, anotarlo (en Android `behavior="height"` guarda el alto inicial del
  frame y podría quedar viejo).
- **Teclado de contraseñas / autofill de iOS** en el paso del código: la barra
  de autofill suma alto; el campo tiene que seguir visible.
- **Modo noche**: repetir 3.1 paso 2 con `darkMode` prendido en Ajustes. Solo
  cambian colores, el layout no.
- **Texto grande del sistema** (Ajustes → Pantalla → Tamaño de texto al máximo):
  el campo multilínea de Sentir topa en el mismo `maxHeight`, así que va a
  mostrar menos líneas y scrollear antes. Aceptable; lo que no se acepta es que
  el CTA desaparezca.
- **Límite de cuota alcanzado**: con cuota en 0 las tres pantallas devuelven
  `LimitReached` antes de renderizar el input. Confirmar que no explota nada al
  entrar con el teclado abierto desde la pantalla anterior.
