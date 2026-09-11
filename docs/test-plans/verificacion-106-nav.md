# Verificación: navegación atrás en Voces e Historias (#106)

| Field | Value |
|-------|-------|
| Version | 0.2.0 |
| Last updated | 2026-09-11 |
| Owner | Worker W2 (parche mínimo, lectura b) |
| Rama | `fix/106-nav-back` (rebasada sobre `master` tras #107 y #108) |
| Prototipo | `design/Bible AI Honduras.dc.html` — back 34px circular en Sentir / Preguntar / Voces chat / Historias detalle |

## 0. Estado

> Automatizable: `npx vitest run` + `npx tsc --noEmit` (ver §5).
> En device: pendiente de humano (mismo razonamiento que #105 — sin prebuild en el worktree).

## 1. Alcance (decisión de líder)

Se aplica la **lectura (b), parche mínimo**. **No** se crea `app/(tabs)/_layout.tsx`:
la tab bar no existe en el prototipo de Claude Design y la regla dura #1 la bloquea
hasta que se re-exporte. La variante (a) queda para el issue de la épica #111.

## 2. Before / after

| Flujo | Antes | Después |
|---|---|---|
| Home → Voces | Sin ‹; callejón sin salida visual | `ScreenHeader` con `testID=voces-back` → `goBackOrHome()` |
| Home → Historias | Sin ‹; callejón sin salida visual | `testID=historias-back` → `goBackOrHome()` |
| Preguntar / Ajustes / Historial | ‹ duplicado con tamaños distintos (`backButton` vs `dotActive + space.md`) | Mismo `ScreenHeader` (`tokens.size.backButton`) |
| Preguntar, primer paso | `router.replace("/home")` — apilaba un Home encima de otro | `goBackOrHome()` desapila si hay historial |
| Tab bar | N/A | **No se creó** (fuera de alcance, ver §1) |

## 3. Salidas de cada pantalla alcanzable desde Home

| Pantalla | Cómo se sale |
|---|---|
| `/ajustes` | `ScreenHeader` |
| `/historial` (desde Ajustes) | `ScreenHeader` |
| `/preguntar` | `ScreenHeader` (paso a paso → Home) |
| `/preguntar/chat` | ‹ propio |
| `/voces` | `ScreenHeader` **(nuevo)** |
| `/voces/[slug]` | ‹ propio |
| `/historias` | `ScreenHeader` **(nuevo)** |
| `/historias/[storyId]` | ‹ propio |
| `/sentir` | ‹ propio (dos estados) |
| `/paywall` | × de cerrar |

Ninguna queda sin salida.

## 4. Android hardware / gesto

El root `app/_layout.tsx` usa `<Stack screenOptions={{ headerShown: false }}>`. Las rutas
`(tabs)/*` son pantallas de ese stack, no de un `Tabs` navigator: el botón/gesto atrás
del sistema sigue despachando `POP`. El ‹ de UI llama `goBackOrHome()`, que hace
`router.back()` si hay historial y `router.replace("/home")` si no (arranque en frío o
deep link).

## 5. Guion manual (humano)

1. Desde Home, abrir **Voces** → tocar ‹ → vuelve a Home.
2. Desde Home, abrir **Historias** → tocar ‹ → vuelve a Home.
3. En Android: en Voces y en Historias, botón/gesto atrás del sistema → vuelve a Home.
4. Preguntar / Ajustes / Historial: ‹ sigue funcionando; tamaño visual 34px como en el prototipo.
5. Ajustes: la sección **Cuenta** (#107) y las **3 píldoras de versión** con NVI deshabilitada (#108) siguen intactas.

## 6. Evidencia automatizada

```
npx vitest run
# Test Files  38 passed (38)
# Tests       266 passed (266)     # baseline master 264 + 2 de goBackOrHomeWith

npx tsc --noEmit
# exit 0
```

## 7. Deuda conocida (fuera de este PR)

Siguen con su propio ‹ y no migraron a `ScreenHeader`, porque hay trabajo en paralelo
sobre esos archivos: `app/(tabs)/sentir.tsx` (usa `tokens.size.logoSmall`, 38px, en vez
de `backButton`, 34px), `app/(tabs)/preguntar/chat.tsx`, `app/(tabs)/voces/[slug].tsx` y
`app/(tabs)/historias/[storyId].tsx`. `app/paywall.tsx` duplica la lógica de
`goBackOrHome`. Ninguno es un callejón sin salida; es drift visual a cerrar en un
PR de seguimiento.
