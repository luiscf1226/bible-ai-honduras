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
| `react-native-purchases` | oferta mensual con precio localizado; ver `?rc=` abajo |
| `expo-notifications` | permisos siempre concedidos |
| `expo-local-authentication` | Face ID que siempre pasa (ver `?auth=` abajo) |

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
| `?temporada=reforma` / `gratitud` / `adviento` | `seasons.current` con esa temporada de muestra (#199); se combina con `?qa=dark`. Sin el parámetro, fuera de temporada |
| `?lock=on` | "Proteger lo personal" encendido (Mi espacio, Tu año en la Palabra, Sentir y Exportar piden autenticar) |
| `?auth=none` | el teléfono no tiene biometría ni bloqueo: la opción sale deshabilitada |
| `?auth=pending` | el diálogo del sistema no contesta: se ve la pantalla de candado |
| `?auth=cancel` | la persona cancela la autenticación: vuelve atrás |
| `?ver=NVI` | versión de la Biblia = NVI (sin corpus, igual que en producción) |
| `?net=off` | modo avión (#160, #182): NetInfo sin red, las `useQuery` quedan en `undefined` y las mutaciones no vuelven, como el cliente real de Convex sin conexión |
| `?fechas=hoy` / `?fechas=1` | Tus fechas (#204): cumpleaños y bautismo que caen hoy (tarjeta arriba del inicio) o en otra fecha (solo se ven en Mi espacio). Sin el parámetro, sin fechas |
| `?rc=none` / `?rc=error` / `?rc=cancel` · `?precio=L 124.00` | Paywall (#144). Solo si arrancaste con `EXPO_PUBLIC_REVENUECAT_API_KEY=qa_harness`: sin `?rc=` hay oferta mensual a `US$4.99` (o el `?precio=` que pases); `none` sin offering, `error` la tienda sin red, `cancel` la persona cancela la compra. Sin la key se ve "Pro todavía no está a la venta" |
| `?plan=1` | plan anual empezado, en el día 5 con los días 3 y 4 pendientes |

La Biblia sin conexión se descarga de verdad desde Ajustes: el manifiesto del
harness trae los 66 libros (con los versículos placeholder) como `data:` URLs y
queda en `localStorage` (`offline/…`), igual que en el teléfono queda en
archivos. La cola sin conexión también vive ahí (`offline/queue.json`). Para
empezar de cero, borrá el `localStorage` del sitio.

## Limitaciones conocidas

- Las páginas legales de GitHub Pages viven en `site/`, no en `public/`: Expo
  web usa `public/index.html` como plantilla y, si existiera, taparía la app
  (#156). No crees `public/index.html`.
- Lectura: `reading:*` y `readingPlans:*` tienen fixtures (separador en
  Salmos 46:1, "seguí leyendo" en Juan 3). Cualquier capítulo muestra los mismos
  4 versículos de Salmos 46 como placeholder.
- Grupos (#185): `readingGroups:*` tiene una célula (`/grupos/g1`) con 5
  personas. `/grupo?token=QAgrupe2345678ab` es una invitación válida (familia
  en Duelo); cualquier otro token muestra la invitación vencida. `?qa=empty`
  deja "mis grupos" vacío. "Preparar para mi grupo" (`/leer/guia?book=Salmos&chapter=46`)
  muestra el aviso de Pro salvo con `?qa=pro`.
- Las cuotas no decrementan al consumir: `quotas:remaining` es un fixture fijo,
  no una query reactiva. Usá `?qa=limit` para ver el estado agotado.
- "Tu año en la Palabra" (#183): `/tu-ano` abre siempre; `yearInWord:summary`
  es un fixture fijo (`?qa=empty` lo deja en cero). La entrada en Mi espacio
  solo aparece del 1 de diciembre al 31 de enero: para verla, fijá el reloj
  del navegador (Playwright `page.clock.setFixedTime("2026-12-05T12:00:00-06:00")`).
- `Alert.alert` no existe en react-native-web → el diálogo de "Borrar mi
  historial" no aparece en el navegador. En iOS/Android sí.
- "Proteger lo personal" guarda la preferencia en `localStorage` en web
  (SecureStore en el teléfono): usá un perfil limpio del navegador entre
  escenarios. Crear el PDF (`expo-print`) no funciona en web.
- Los recordatorios devuelven `unsupported` en web (comportamiento real de
  `src/lib/dailyReminder.ts`).
