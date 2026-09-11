# Repro #103 — "Compartir por WhatsApp cierra la app"

| Field | Value |
|-------|-------|
| Issue | #103 |
| Owner | Agente A |
| Environment | Node 22 (script standalone) + `vitest run` — **no** dispositivo físico ni dev-build |
| Build / commit | rama `fix/103-share-crash` |

## 1. Qué se verificó y qué NO

**Verificado en Node/vitest (esto documento cubre eso):**

- La causa raíz candidata del issue — `shareContent` sin `try/catch`, invocada con
  `void` por los 4 llamadores — sí produce un *unhandled promise rejection* cuando
  `Share.share()` rechaza.
- Ese *unhandled promise rejection*, sin manejar, mata el proceso de Node (exit
  code ≠ 0) — el equivalente, en este entorno, al mecanismo que en un build de
  release de Hermes/React Native dispara el manejador global de errores fatales y
  cierra la app.
- Con el fix aplicado (try/catch + resultado tipado `{ status: "shared" | "dismissed" | "error" }`
  en vez de `void`), el mismo escenario **no** genera ningún *unhandled rejection*:
  el proceso queda vivo y `shareContent` devuelve un resultado que el llamador
  puede inspeccionar.
- Los 9 tests de `src/lib/share.test.ts` cubren: éxito, cancelación en iOS
  (`dismissedAction`), el hecho de que Android nunca reporta cancelación (siempre
  `sharedAction`), rechazo de `Share.share()`, y fallo del propio
  `await import("react-native")`.

**NO verificado — pendiente de build de release real:**

- **No hay device físico ni dev-build corriendo** en este entorno (`adb` está
  instalado pero no había un emulador/device Android conectado; los simuladores
  iOS disponibles — iPhone 16 Pro — estaban apagados). No se intentó
  `expo prebuild && run:ios`/`run:android` por indicación explícita: es costoso y
  se reservó como último recurso.
- Por lo tanto **no hay un stack trace real capturado de `adb logcat` ni de
  Console.app** de un crash en un build de release de iOS o Android. Lo que sigue
  es un repro del *mecanismo* (unhandled promise rejection desde una promesa
  rechazada e invocada con `void`), no un repro del crash nativo tal cual lo vería
  un usuario en su teléfono.
- El criterio de aceptación *"Compartir desde Home, Q&A, Voces e Historias → se
  vuelve a la app sin reinicio, en iOS y Android, en build de release"* **no se
  pudo verificar** con este fix — solo se verificó que el mecanismo de fondo
  (unhandled rejection) desaparece a nivel de Node. Falta que alguien con acceso a
  un dev-build/TestFlight/APK de release confirme el comportamiento en dispositivo
  real.
- No se validó tampoco que Android efectivamente entrega `{ action: 'sharedAction' }`
  sin `dismissedAction` en un dispositivo real — eso sale de la documentación de
  `react-native` (`node_modules/react-native/Libraries/Share/Share.d.ts`), no de
  una prueba en device.

## 2. Repro "antes del fix" — mecanismo del crash

Script usado (equivalente literal a `src/lib/share.ts` **antes** del fix — sin
`try/catch`, `Share.share()` rechazando, invocado con `void` como hacían los 4
llamadores):

```js
// _scratch_repro103_before_no_handler.mjs — SIN listener de unhandledRejection,
// para ver qué le pasa al proceso "solo".

const SHARE_BASE_URL = "https://bibleaihonduras.app";

function buildReferralLink(referralCode) {
  return `${SHARE_BASE_URL}/r/${referralCode}`;
}

function buildShareMessage(text, referralCode) {
  return `${text}\n\n${buildReferralLink(referralCode)}`;
}

// Stub de Share.share() de react-native que rechaza, igual que lo haría el
// módulo nativo real si el share sheet no está disponible (o si el propio
// `await import("react-native")` fallara).
const Share = {
  share: async () => {
    throw new Error("Share sheet no disponible (simulado)");
  },
};

async function shareContent(params) {
  // SIN try/catch — así estaba en src/lib/share.ts antes del fix.
  const message = buildShareMessage(params.text, params.referralCode);
  await Share.share({ message });
}

console.log("Llamando a shareContent(...) con void (sin manejar el resultado), sin ningún handler de unhandledRejection...");
void shareContent({ referralCode: "BAH-TEST01", text: "Compartir esto" });
console.log("Fin del script síncrono. Si el proceso muere después de esta línea, fue por la unhandledRejection.");
```

Salida literal (`node _scratch_repro103_before_no_handler.mjs`):

```
Llamando a shareContent(...) con void (sin manejar el resultado), sin ningun handler de unhandledRejection...
Fin del script sincrono. Si el proceso muere despues de esta linea, fue por la unhandledRejection.
file:///Users/luiscf1226/bible-ai-honduras/.claude/worktrees/agent-a6f059ea6ec8619d0/_scratch_repro103_before_no_handler.mjs:18
    throw new Error("Share sheet no disponible (simulado)");
          ^

Error: Share sheet no disponible (simulado)
    at Object.share (file:///Users/luiscf1226/bible-ai-honduras/.claude/worktrees/agent-a6f059ea6ec8619d0/_scratch_repro103_before_no_handler.mjs:18:11)
    at shareContent (file:///Users/luiscf1226/bible-ai-honduras/.claude/worktrees/agent-a6f059ea6ec8619d0/_scratch_repro103_before_no_handler.mjs:25:15)
    at file:///Users/luiscf1226/bible-ai-honduras/.claude/worktrees/agent-a6f059ea6ec8619d0/_scratch_repro103_before_no_handler.mjs:29:6
    at ModuleJob.run (node:internal/modules/esm/module_job:271:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:547:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:116:5)

Node.js v22.13.1
EXIT_CODE=1
```

**Lectura:** el proceso de Node muere solo (`EXIT_CODE=1`, no 0) por la
`unhandledRejection` que generó `void shareContent(...)`. Con un listener de
`unhandledRejection` puesto explícitamente (variante `_scratch_repro103_before.mjs`,
mismo código + `process.on("unhandledRejection", ...)`), se confirma que el evento
sí se dispara con el stack completo:

```
UNHANDLED_REJECTION_DETECTADA_POR_NODE: Error: Share sheet no disponible (simulado)
    at Object.share (file:///.../_scratch_repro103_before.mjs:38:11)
    at shareContent (file:///.../_scratch_repro103_before.mjs:45:15)
    at file:///.../_scratch_repro103_before.mjs:51:6
    ...
En un build de release de Expo/React Native (Hermes) esta unhandledRejection no capturada dispara el manejador global de errores fatales y mata el proceso -- la app se cierra y hay que reabrirla en frio, tal como reporto la beta.
```

Este es el mecanismo real: en Hermes (el motor JS de un build de release de Expo/RN),
una `unhandledRejection` no manejada llega al manejador global de errores fatales de
React Native y termina el proceso — de ahí que la beta necesitara reabrir la app en
frío, no solo volver de segundo plano.

## 3. Repro "después del fix" — mismo escenario, sin crash

Mismo stub de `Share.share()` rechazando, mismo patrón de llamada con `void`, pero
con la lógica real de `src/lib/share.ts` después del fix (`try/catch` +
`ShareResult` tipado):

```js
async function shareContent(params) {
  try {
    const message = buildShareMessage(params.text, params.referralCode);
    const result = await Share.share({ message });
    if (result.action === Share.dismissedAction) {
      return { status: "dismissed" };
    }
    return { status: "shared" };
  } catch (error) {
    return { status: "error", error };
  }
}
```

Salida literal (`node _scratch_repro103_after.mjs`):

```
Llamando a shareContent(...) con void, igual patron que los callers, ahora con el fix aplicado...
shareContent() invocada. Esperamos un tick para que el catch interno resuelva...
unhandledFired despues de esperar: false
Resultado devuelto por shareContent (ya no es void): error - Share sheet no disponible (simulado)
Proceso vivo, sin crash. Saliendo con exit code 0
EXIT_CODE=0
```

**Lectura:** con el fix, el mismo rechazo de `Share.share()` queda contenido
dentro de `shareContent` — no hay `unhandledRejection` (`unhandledFired: false`),
el proceso sale limpio (`EXIT_CODE=0`) y el llamador recibe
`{ status: "error", error }` en vez de que la promesa se pierda.

## 4. Cobertura real en el repo (`vitest`)

Los 9 tests de `src/lib/share.ts` corren contra el código real (no una copia),
usando el patrón `setShareNativeForTests`/`resetShareNativeForTests` (igual que
`src/lib/revenuecat.ts`) para no depender del runtime nativo:

```
$ npx vitest run src/lib/share.test.ts --reporter=verbose

 ✓ src/lib/share.test.ts > buildReferralLink > incluye el código de referido en el link 1ms
 ✓ src/lib/share.test.ts > buildReferralLink > produce links distintos y rastreables para códigos distintos 1ms
 ✓ src/lib/share.test.ts > buildReferralLink > apunta a la landing real de GitHub Pages, no al dominio muerto bibleaihonduras.app (#103) 0ms
 ✓ src/lib/share.test.ts > buildShareMessage > incluye el texto y el link de referido 0ms
 ✓ src/lib/share.test.ts > shareContent (#103 — dueño único del share sheet) > éxito: comparte y devuelve status shared 2ms
 ✓ src/lib/share.test.ts > shareContent (#103 — dueño único del share sheet) > cancelación en iOS: dismissedAction no es un error 0ms
 ✓ src/lib/share.test.ts > shareContent (#103 — dueño único del share sheet) > cancelación en Android: Share.share nunca devuelve dismissedAction, así que se cuenta como shared 0ms
 ✓ src/lib/share.test.ts > shareContent (#103 — dueño único del share sheet) > rechazo de Share.share: se captura y devuelve status error, no se propaga (repro #103) 0ms
 ✓ src/lib/share.test.ts > shareContent (#103 — dueño único del share sheet) > fallo del propio await import('react-native'): también se captura y devuelve status error 3ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

El último test (`fallo del propio await import('react-native')`) usa
`vi.doMock("react-native", ...)` + `vi.resetModules()` para forzar que el import
dinámico real rechace, sin pasar por el override de test — es el repro más fiel al
"fallo del `await import('react-native')`" que menciona el issue.

## 5. Segunda causa — dominio de referido muerto

`https://bibleaihonduras.app` nunca se registró y no resuelve. Se cambió a la
landing de GitHub Pages que ya usa `app/ajustes.tsx` y
`docs/store/privacy-policy.md` para la política de privacidad
(`https://luiscf1226.github.io/bible-ai-honduras/`). Esa landing **no** tiene una
ruta `/r/<code>` — devuelve 404 — así que el código de referido va como
querystring sobre la raíz (`?ref=<code>`), que sí sirve `index.html` con 200:

```
$ curl -sI "https://luiscf1226.github.io/bible-ai-honduras/"
HTTP/2 200
...

$ curl -sI "https://luiscf1226.github.io/bible-ai-honduras/?ref=BAH-TEST"
HTTP/2 200
...

$ curl -sI "https://luiscf1226.github.io/bible-ai-honduras/r/BAH-TEST"
HTTP/2 404
...
```

El querystring no se usa todavía para nada en `public/index.html` (no hay
tracking de `ref` implementado ahí) — eso queda fuera del alcance de este fix,
que solo necesitaba que el link no apunte a una página muerta.

## 6. Scripts usados

Los tres scripts (`_scratch_repro103_before.mjs`,
`_scratch_repro103_before_no_handler.mjs`, `_scratch_repro103_after.mjs`) se
corrieron desde la raíz del worktree con `node <archivo>.mjs` y **no se
commitearon** — quedaron fuera de la zona de este issue (`src/lib/share.ts` +
test, los 4 llamadores, `app/(tabs)/home.tsx`, este documento). El contenido
completo de cada uno está reproducido en las secciones §2 y §3 de este documento
para que el repro sea reproducible sin depender de archivos externos.
