# Mapa del proyecto

## Stack y ejecución

- Expo Router con React Native, TypeScript estricto y React 19.
- Gestor de paquetes: npm (`package-lock.json`).
- Comandos verificados en esta ejecución: `npm run typecheck` y `npm test`.
- `npm run export` verificado para web, iOS y Android.

## Estructura

- Rutas Expo: `app/`; tabs de producto: `app/(tabs)/`.
- Componentes reutilizables: `src/components/`; tokens nativos: `src/theme/tokens.ts`.
- Contrato visual: `design/Bible AI Honduras.dc.html` y `design/tokens.json`.
- Backend y pruebas Convex: `convex/`; Vitest solo incluye `convex/**/*.test.ts`.

## Convenciones verificadas

- Todo frontend deriva del prototipo y usa `tokens`; no se permiten valores visuales literales.
- Fuente de títulos: EB Garamond; UI: DM Sans.
- Clerk provee autenticación y Convex la consume mediante `ConvexProviderWithClerk`.

## Riesgos de trabajo paralelo

- `src/theme/tokens.ts` y `design/` son compartidos: no modificarlos para cambios aislados de una pantalla.
- La generación RAG, cuotas e historial del módulo Sentir pertenecen a issues separados.

## Estado de verificación

- `npm run typecheck` pasó.
- `npm test` pasó: 13 pruebas.
- `npm run export` pasó: web, iOS y Android.
