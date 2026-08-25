# Sub-plan #21 — Compartir cita de un personaje por WhatsApp

**Oleada:** O3 · **Ejecutable ahora:** NO — bloqueado por #18.

## Goal
Tarjeta con la cita del personaje (respuesta del chat de #18) + link con código de referido,
compartible por WhatsApp. Consume `src/lib/share.ts` (#36, este track) — no reimplementa el share.

## Files in scope
- `app/(tabs)/voces/*` — botón/acción de compartir en el chat
- Import de `src/lib/share.ts` (#36) — sin lógica de share propia

## Out of scope
- Cualquier lógica de generación de link o referido — vive en `src/lib/share.ts` (#36).

## Approach
1. UI: componente de tarjeta con la cita (texto de la respuesta del personaje) siguiendo tokens de
   diseño (regla dura #1).
2. Al tocar "compartir", llama a `shareContent(...)` de `src/lib/share.ts` con el texto de la cita
   + link de referido del usuario actual.
3. Una vez integrado, este es uno de los 4 consumidores que #36 necesita para poder cerrarse —
   avisar en el PR que #21 ya integra el componente único.

## Depends-on
- #18 (este track) — necesita una cita real que compartir.
- #36 (este track, O2) — `src/lib/share.ts` debe existir.

## Test plan
- Test de que el botón de compartir invoca `shareContent` con el texto correcto y el
  `referralCode` del usuario actual (mock del share sheet nativo).

## Evidence
- Test en verde + screenshot de la tarjeta de cita.
