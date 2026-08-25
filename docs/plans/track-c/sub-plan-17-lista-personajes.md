# Sub-plan #17 — Lista de personajes bíblicos con avatar

**Oleada:** O2 · **Ejecutable ahora:** sí (bloqueos #1, #2 mergeados)

## Goal
Pantalla `Voces` muestra una lista de personajes bíblicos **humanos**, cada uno con
avatar/ilustración propio, que el usuario puede tocar para entrar al chat (#18, aún no
construido — el tap puede navegar a un placeholder o quedar deshabilitado hasta que #18 exista).

## Files in scope
- `convex/voices.ts` (nuevo) — tabla `characters` + query `list`
- `convex/schema.ts` — agrega el bloque de tabla `characters` (append-only, PR propio si el resto
  del track no está en el mismo PR)
- `app/(tabs)/voces.tsx` → convertir en `app/(tabs)/voces/index.tsx` + `app/(tabs)/voces/_layout.tsx`
  si el prototipo de diseño define una carpeta (verificar en `design/`)
- `src/components/` — solo si falta un componente de card/avatar que no existe ya (pedir a Track A
  antes de crear uno local)

## Out of scope
- Chat en sí (#18)
- Guardrail (#19)
- Cuota (#20)
- Compartir cita (#21)

## Approach
1. Abrir `design/Bible AI Honduras.dc.html` (`cd design && python3 -m http.server 8899`) y localizar
   la pantalla de Voces / lista de personajes. Confirmar tokens de color/tipografía/espaciado contra
   `design/tokens.json` — no literales.
2. Definir la tabla `characters` en `convex/schema.ts`: campos mínimos `name`, `slug`, `era`/contexto,
   `avatarUrl`, `isHuman: v.literal(true)` (constraint explícita en el dato, no solo en el query) para
   que la regla dura #2 sea verificable en la data, no solo en el prompt de #18.
3. Seed inicial: Moisés, David, Pablo, Ester, Rut, Elías, Daniel (los 7 nombrados en CLAUDE.md regla
   dura #2). Ningún registro para Jesús/Dios/Espíritu Santo — ausencia por diseño, no por filtro en
   runtime.
4. `convex/voices.ts`: query `list` que devuelve los personajes activos.
5. UI: grid o lista de cards con avatar, usando componentes base de `src/components/` si existen;
   si falta el componente de card, pedirlo a Track A antes de crear uno local (ver `master-plan.md`
   §1a — Track A es dueño de la librería base).

## Depends-on
- Ninguno pendiente. #1 (scaffold) y #2 (design tokens) ya mergeados.

## Test plan
- `convex/voices.test.ts`: query `list` devuelve solo personajes con `isHuman: true`; el seed no
  contiene a Jesús/Dios/Espíritu Santo (assert explícito sobre los nombres del seed).
- Verificación visual: captura de la pantalla de Voces contra el prototipo (mismo layout, mismos
  tokens).

## Evidence
- `npm run test -- voices` en verde.
- Screenshot de `app/(tabs)/voces` en simulador/Expo Go junto al prototipo correspondiente.
