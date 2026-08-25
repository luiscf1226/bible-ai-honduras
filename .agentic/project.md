# Mapa del proyecto — Bible AI Honduras

Actualizado: 2026-08-24.

## Stack y convenciones

- Expo Router + React Native + TypeScript; `npm` (lockfile `package-lock.json`).
- Convex es el backend y Clerk provee autenticación.
- La interfaz se implementa exclusivamente desde `design/Bible AI Honduras.dc.html` y `design/tokens.json`; no se añaden valores visuales literales.
- El copy del producto está en español de Honduras.
- Roles conocidos: no hay roles de aplicación; la identidad se obtiene de Clerk y se persiste en `users`.

## Comandos verificados

| Propósito | Comando | Estado |
| --- | --- | --- |
| Instalar dependencias | `npm ci` | Correcto (2026-08-24) |
| Comprobación de tipos | `npm run typecheck` | Pendiente de volver a ejecutar tras `npm ci` |
| Tests | `npm test` | Pendiente de volver a ejecutar tras `npm ci` |
| Export de Expo | `npm run export` | Sin verificar |
| Convex local | `npm run convex:dev` | Sin verificar; necesita proyecto/configuración de Convex |

## Estructura

- `app/`: rutas Expo Router; tabs actuales: Home, Preguntar, Voces, Sentir e Historias.
- `src/components/`: componentes base (`AppScreen`, `AppButton`, `Brand`, `ModulePlaceholder`).
- `src/theme/tokens.ts`: tokens nativos derivados del contrato visual. Congelado salvo re-export desde diseño.
- `src/lib/convexClient.ts`: cliente Convex; `src/hooks/useSyncConvexUser.ts`: sincronización de usuario.
- `convex/`: esquema, auth y usuarios. Aún faltan servicios de devocional, RAG, cuotas, sentimientos e historias en esta rama.
- `convex/_generated/`: generado; no se edita manualmente.
- `design/`: contrato visual y tokens fuente.

## Datos y riesgos al editar en paralelo

- `convex/schema.ts` es compartido: cambios append-only, en un paso aislado antes de funcionalidades que consumen sus tablas.
- `app/(tabs)/home.tsx` es compartido por #8, #10 y #11: se ejecutan secuencialmente.
- `app/(tabs)/sentir.tsx` y `convex/feelings.ts` son compartidos por #27–#29: secuencialmente.
- `app/(tabs)/historias.tsx` y `convex/stories.ts` son compartidos por #23–#26: secuencialmente.
- `convex/quotas.ts` es el único servicio de cuota y pertenece al track B; #24 y #29 solo lo consumen cuando exista.
- `src/lib/share.ts` es el único componente de compartir y pertenece al track C; #11 y #26 solo lo consumen cuando exista.
- `master-plan.md` ya tenía cambios locales; no se modifica dentro de features.

## Dependencias de Track A

- #8 requiere una fuente de devocional (#9). Esta rama no contiene el archivo que el plan maestro marca como entregado.
- #10 depende de Expo Notifications y de la configuración de hora del usuario (propiedad de #34, Track C).
- #11 y #26 dependen de #36 (`src/lib/share.ts`, Track C).
- #28 y #29 requieren #7 (RAG) y #29 además `convex/quotas.ts`.
- #24 requiere `convex/quotas.ts`; #25 y #26 dependen del catálogo #23.
- #38 depende de #37; no se puede cerrar de forma honesta antes de pruebas en dispositivos y una política publicada.

