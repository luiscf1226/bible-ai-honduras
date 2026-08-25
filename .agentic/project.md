# Mapa del proyecto — Bible AI Honduras

## Stack

- Expo 57 + Expo Router, React Native 0.86 y TypeScript; `expo-notifications` 57.0.14 para recordatorios locales.
- Convex para datos y Clerk para autenticación.
- Gestor de paquetes: npm (`package-lock.json`).

## Comandos verificados

- Instalar dependencias: `npm ci` (verificado; npm muestra advertencias de engines porque la sesión usa Node 23.10.0 y React Native requiere una versión LTS compatible).
- Tests: `npm test` — verificado el 2026-08-24, 20 pruebas Convex correctas.
- Tipos: `npm run typecheck` — verificado el 2026-08-24.
- Export: `npm run export` — no verificado.
- Servidor Expo: `npm start`; web: `npm run web` — no verificados.
- Configuración Expo: `npx expo config --type public` — verificado el 2026-08-24; resuelve los plugins `expo-router`, `expo-font` y `expo-notifications`.

## Estructura

- Rutas Expo: `app/`; Home: `app/(tabs)/home.tsx`.
- UI común: `src/components/`; tokens nativos: `src/theme/tokens.ts`.
- Convex: `convex/`; prueba de devocionales: `convex/devotional.test.ts`.
- Contrato visual: `design/Bible AI Honduras.dc.html` y `design/tokens.json`.

## Convenciones verificadas

- Todo copy de producto está en español hondureño.
- La UI usa `tokens` de `src/theme/tokens.ts`; no se agregan valores visuales literales.
- Los títulos y versículos usan EB Garamond; la UI usa DM Sans.
- `convex/devotional.today` da el contenido editorial del día y hace fallback de catálogo cuando aún no existe una fila persistida.
- Los recordatorios son notificaciones locales fechadas, con canal propio en Android. Se programan 28 días del ciclo editorial para que cada aviso lleve la referencia bíblica correcta, en vez de repetir contenido vencido después de medianoche.

## Riesgos de coordinación

- `src/theme/tokens.ts` y los archivos Convex generados son superficies compartidas: no tocarlos para una pantalla aislada.
- La fuente editorial de #9 solo contiene referencia, reflexión e imagen; no contiene el texto de los versículos por licencia, por lo que Home no debe mostrar una cita bíblica fija incompatible con la referencia del día.
- Compartir, cuotas y notificaciones son issues transversales separados.
