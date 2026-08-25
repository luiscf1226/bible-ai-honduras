# Sub-plan #20 — Cuota gratis/Pro — Voces

**Oleada:** O3 · **Ejecutable ahora:** NO — bloqueado por #18.

## Goal
Mismo patrón de límite diario que Q&A (#15, Track B), aplicado a Voces, con pantalla de límite al
agotarse. Reusa el servicio único `convex/quotas.ts` (Track B, regla dura #3) — **no** se crea una
variante local de cuota para Voces.

## Files in scope
- `app/(tabs)/voces/*` — wiring de UI que consulta el estado de cuota y muestra la pantalla de
  límite
- Llamadas a `convex/quotas.ts` (Track B) desde `convex/voices.ts` — solo consumo, no
  modificación del servicio (si falta una capacidad en `quotas.ts`, se pide a Track B, no se
  parchea localmente)

## Out of scope
- Cualquier cambio a `convex/quotas.ts` en sí — issue #32 (Track B) es quien conecta los 4 límites
  al paywall.

## Approach
1. Confirmar la interfaz real de `convex/quotas.ts` una vez exista (Track B, O2) — este sub-plan
   no puede fijar la firma exacta hasta entonces.
2. `voices.ts`: antes de procesar un mensaje de chat, consulta cuota vía el servicio único; si está
   agotada, la acción no se ejecuta y la UI muestra la pantalla de límite (mismo componente que Q&A
   si ya existe — pedir a Track B antes de crear una pantalla de límite local).

## Depends-on
- #18 (este track) — necesita el chat para tener qué limitar.
- `convex/quotas.ts` (Track B, servicio único, adelantado en su O2).

## Test plan
- Test de integración: N mensajes permitidos por día, el N+1 muestra pantalla de límite, no llama
  al pipeline RAG.

## Evidence
- Test en verde + screenshot de la pantalla de límite.
