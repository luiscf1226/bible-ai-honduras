# Sub-plan #36 — Componente reusable de compartir con código de referido

**Oleada:** O2 (adelantado como infra — ver `master-plan.md` §1a) · **Ejecutable ahora:** parcial

## Goal
Un único componente/servicio de compartir (`src/lib/share.ts`) que genera un link con el
`referralCode` del usuario (ya existe en `convex/schema.ts` → `users.referralCode`) y lo comparte
por WhatsApp. Es infraestructura para #11, #16, #21, #26 — **el issue de GitHub #36 no se cierra
en esta oleada** porque sus criterios de aceptación exigen que los 4 consumidores ya lo usen, y
ninguno existe todavía. Se construye ahora, se cierra al final cuando el último consumidor (#26,
Track A) lo integre.

## Files in scope
- `src/lib/share.ts` (nuevo) — único dueño: Track C, ningún otro track crea una variante local
  (regla dura #3)
- `convex/users.ts` — si hace falta un query/mutation para leer `referralCode` del usuario actual
  (verificar si ya existe antes de agregar uno nuevo)

## Out of scope
- Cualquier pantalla que lo consuma (#11, #16, #21, #26) — eso es trabajo de cada track dueño de
  esa pantalla, incluido #21 en O3 de este mismo track.
- UI propia — este es un módulo de lógica (genera texto/link + invoca el share sheet nativo), no
  una pantalla.

## Approach
1. Confirmar la forma del link de referido: `https://<dominio>/r/<referralCode>` o el esquema que
   defina el PRD/ARCHITECTURE — revisar `PRD.md` y `ARCHITECTURE.md` antes de inventar un formato.
2. `src/lib/share.ts` expone una función única, ej. `shareContent({ text, url })`, que arma el
   mensaje (texto + link con referido) y llama al share sheet de Expo (`expo-sharing` o
   `Share.share` de React Native) apuntado a WhatsApp cuando esté disponible, con fallback al share
   sheet genérico del OS.
3. Sin UI propia — se documenta la firma de la función para que #11/#16/#21/#26 la importen
   directamente, no la reimplementen.

## Depends-on
- `users.referralCode` (ya existe en schema, verificar que se genera al crear el usuario en #3 —
  confirmar en `convex/users.ts`).

## Test plan
- `src/lib/share.test.ts`: dado un `referralCode` y contenido, el link generado incluye el código;
  dos llamadas con distinto `referralCode` producen links distintos y rastreables.
- No hay test de UI en este sub-plan (no hay pantalla).

## Evidence
- `npm run test -- share` en verde.
- Nota en el PR: "infra para #11/#16/#21/#26 — no cierra #36, referencia la issue sin cerrarla."
