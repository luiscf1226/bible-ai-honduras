# Verificación: navegación atrás en Voces e Historias (#106)

| Field | Value |
|-------|-------|
| Version | 0.1.0 |
| Last updated | 2026-09-10 |
| Owner | Worker W2 (parche mínimo lectura b) |
| Rama | `fix/106-nav-back` |
| Prototipo | `design/Bible AI Honduras.dc.html` — back 34px circular en Sentir / Preguntar / Voces chat / Historias detalle |

## 0. Estado

> Automatizable: `npm test` + `npm run typecheck` (ver §4).
> En device: pendiente de humano (mismo razonamiento que #105 — sin `ios/`/`android/` prebuild en el worktree).

## 1. Before / after

| Flujo | Antes | Después |
|---|---|---|
| Home → Voces | Sin ‹; solo se podía salir con gesto/hardware si el Stack lo permitía, y no había affordance visible | `ScreenHeader` con `testID=voces-back` → `goBackOrHome()` |
| Home → Historias | Igual, callejón sin salida visual | `testID=historias-back` → `goBackOrHome()` |
| Preguntar / Ajustes / Historial | ‹ duplicado con tamaños distintos (`backButton` vs `dotActive+md`) | Mismo `ScreenHeader` (`tokens.size.backButton`) |
| Tab bar | N/A | **No se creó** `app/(tabs)/_layout.tsx` (fuera de alcance) |

## 2. Android hardware / gesto

El root `app/_layout.tsx` usa `<Stack headerShown: false>`. Las rutas `(tabs)/*` son pantallas del stack, no un Tabs navigator. El botón/hardware de Android sigue despachando `POP` del stack; el ‹ de UI llama `router.back()` (o `replace("/home")` si no hay historial).

## 3. Guion manual (humano)

1. Desde Home, abrir **Voces** → tocar ‹ → vuelve a Home.
2. Desde Home, abrir **Historias** → tocar ‹ → vuelve a Home.
3. En Android: en Voces, botón/gesto atrás del sistema → vuelve a Home.
4. Preguntar / Ajustes: ‹ sigue funcionando; tamaño visual ~34px como en el prototipo.

## 4. Evidencia automatizada

```
npm test
# Test Files  36 passed (36)
# Tests       259 passed (259)

npm run typecheck
# tsc --noEmit — exit 0
```

Corrido en worktree `106-nav-back` el 2026-09-10.
