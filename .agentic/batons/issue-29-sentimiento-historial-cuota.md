# Baton — Issue #29: Historial y cuota de Sentimiento

## Estado

Listo para revisión.

## Progreso

- `feelings.generate` consume `quotas.checkAndConsume({ module: "feelings" })` antes de invocar RAG.
- Pro queda sin límite según `entitlements`; gratis recibe el contrato `limit_reached` del servicio compartido.
- La generación se persiste en las tablas compartidas `conversations` y `messages`; el mensaje asistente retiene el devocional estructurado.
- `history.getById` verifica propiedad y permite abrir “Los de antes” sin un historial paralelo.

## Evidencia

- `npx vitest run convex/feelings.test.ts convex/history.test.ts` — 9 pruebas verdes.
- `npm run typecheck`.

## Siguiente

Abrir PR #29. Luego evaluar el alcance de #25/#26 antes de arrancar Historias.
