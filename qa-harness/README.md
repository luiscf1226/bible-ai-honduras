# QA harness — correr la app en el navegador sin credenciales

Herramienta de QA. **No es parte del producto**: nada de `app/` ni `src/` la
importa, y sin `QA_HARNESS=1` no toca ningún build.

La app real no arranca sin `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` y
`EXPO_PUBLIC_CONVEX_URL` (`app/_layout.tsx` y `src/lib/convexClient.ts` tiran
error en el import). Este harness sustituye los SDK externos por mocks locales
para poder ver y fotografiar **todas las pantallas** en un navegador.

## Cómo correrlo

```bash
QA_HARNESS=1 npx expo start --web --port 8081
```

No hace falta `.env.local`: con `QA_HARNESS=1`, `metro.config.js` completa
`EXPO_PUBLIC_CONVEX_URL` y `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` con valores
ficticios si no están definidas. Sin `QA_HARNESS=1` no cambia nada del build
normal.

## Qué está mockeado

| Módulo real | Mock |
|---|---|
| `@clerk/expo`, `@clerk/expo/experimental` | sesión siempre iniciada, SSO y email-code que siempre pasan |
| `convex/react`, `convex/react-clerk` | fixtures deterministas por nombre de función (`users:current`, `qa:thread`, …) |
| `react-native-purchases` | no-op |
| `expo-notifications` | permisos siempre concedidos |

Los catálogos que se ven en pantalla **son los reales del repo**:
`convex/voicesCatalog.ts` (Voces), `convex/stories.ts` (Historias ilustradas,
extraído a `mocks/story-catalog.json`) y `convex/textStoriesCatalog.ts`
(Historias en texto, con su narrativa completa). El texto bíblico del lector y
las ilustraciones de historias son placeholders del harness.

## Generar el reporte

Cada pase de QA vive en `docs/qa/<fecha>/` con sus `shots/` y su
`report-data.json` (los hallazgos y los pasos de cada flujo se editan ahí).

```bash
python3 qa-harness/build-report.py              # docs/qa/<último>/index.html (61 KB, enlaza shots/)
python3 qa-harness/build-report.py 2026-08-25   # un pase concreto
python3 qa-harness/build-report.py --embed      # QA-REPORT.html portable (~12 MB, gitignored)
```

## Escenarios (query string)

| URL | Qué muestra |
|---|---|
| `?qa=free` (default) | usuario gratis con cuota disponible |
| `?qa=pro` | entitlement Pro activo |
| `?qa=limit` | cuota agotada en los 4 módulos |
| `?qa=empty` | hilos e historial vacíos, capítulo sin versículos indexados |
| `?qa=error` | `devotional:today` falla |
| `?qa=loading` | todas las `useQuery` en `undefined` |
| `?qa=dark` | `users.darkMode = true` |
| `?ver=NVI` | versión de la Biblia = NVI (sin corpus, igual que en producción) |

## Limitaciones conocidas

- Las páginas legales de GitHub Pages viven en `site/`, no en `public/`: Expo
  web usa `public/index.html` como plantilla y, si existiera, taparía la app
  (#156). No crees `public/index.html`.
- Lectura: `reading:*` y `readingPlans:*` tienen fixtures (separador en
  Salmos 46:1, "seguí leyendo" en Juan 3). Cualquier capítulo muestra los mismos
  4 versículos de Salmos 46 como placeholder.
- Las cuotas no decrementan al consumir: `quotas:remaining` es un fixture fijo,
  no una query reactiva. Usá `?qa=limit` para ver el estado agotado.
- `Alert.alert` no existe en react-native-web → el diálogo de "Borrar mi
  historial" no aparece en el navegador. En iOS/Android sí.
- Los recordatorios devuelven `unsupported` en web (comportamiento real de
  `src/lib/dailyReminder.ts`).
