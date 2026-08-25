# Mapa del proyecto — Bible AI Honduras

Actualizado: 2026-08-24 (orientación local verificada)

## Stack y ejecución

- Expo Router / React Native 0.86 / React 19, TypeScript estricto.
- Backend: Convex; autenticación: Clerk.
- Gestor de paquetes: npm (`package-lock.json`).
- Runtime observado: Node 23.10.0. La instalación funciona, pero React Native y Vitest
  advierten que Node 23 no está entre sus rangos soportados; usar Node 24+ o 22.13+ en CI.

## Comandos verificados

| Propósito | Comando | Estado |
| --- | --- | --- |
| Instalar | `npm ci` | Pasa, con advertencias de engine en Node 23.10.0 |
| Tests | `npm test` | Pasa: 13 tests de Convex |
| Tipos | `npm run typecheck` | Pasa |
| Bundle/export | `npm run export` | Pasa |
| Desarrollo Expo | `npm start` | No ejecutado (servidor interactivo) |
| Backend Convex | `npm run convex:dev` | UNVERIFIED: requiere configuración de deployment |

## Estructura

- `app/`: rutas Expo Router; pantallas de módulos en `app/(tabs)/`.
- `src/components/`: componentes compartidos; `src/theme/tokens.ts` es el puente de tokens.
- `convex/`: esquema, funciones y pruebas. Los tests usan Vitest + `convex-test` y viven junto a la función (`convex/*.test.ts`).
- `convex/_generated/`: generado por Convex; nunca editar a mano.
- `design/`: contrato visual de Claude Design y `tokens.json`; no inventar valores de UI.
- `docs/spikes/`: decisiones e investigación técnica, incluido el proveedor de imágenes (#22).

## Datos, identidad y convenciones

- El esquema actual sólo tiene `users`; mantener cambios al esquema append-only.
- Las funciones de usuario resuelven identidad desde `ctx.auth`; nunca aceptan un `userId` del cliente.
- La app no llama proveedores externos: las claves viven en Convex.
- Copia de producto e issues en español hondureño.
- Convención observada: funciones Convex y sus pruebas co-localizadas; tests describen el contrato público y los casos de autorización.
- La UI debe derivarse de `design/Bible AI Honduras.dc.html` y `design/tokens.json`; se cargan primero las instrucciones de `.claude/skills/frontend-claude-design/SKILL.md`.

## Entorno por nombre

- App: `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- Convex: `CLERK_JWT_ISSUER_DOMAIN`.
- Próximos módulos documentan además `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY` y `REVENUECAT_WEBHOOK_SECRET`.

## Riesgos y coordinación

- `convex/schema.ts` y `convex/_generated/*` son superficies compartidas: evitar cambios simultáneos; regenerar archivos sólo mediante Convex.
- `design/` y `src/theme/tokens.ts` son contratos transversales de UI.
- Cuotas, entitlements y compartir tienen dueños transversales; los módulos no deben crear duplicados locales.
- El catálogo de historias es contenido estático sin estado de usuario; generación, cuota, visor y compartir se implementan en issues separados.
