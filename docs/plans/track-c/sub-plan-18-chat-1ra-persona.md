# Sub-plan #18 — Chat en 1ra persona con prompt condicionado por personaje

**Oleada:** O3 · **Ejecutable ahora:** NO — bloqueado por #7 (función RAG, Track B, no arrancada).
No tomar este issue hasta confirmar que #7 está mergeado en `master`. Este sub-plan queda aprobado
y listo para que `execute-plan` lo tome apenas se desbloquee.

## Goal
Chat donde el usuario conversa con un personaje bíblico humano (de la lista de #17) que responde
en 1ra persona, con respuestas ancladas al RAG y coherentes con lo que el texto bíblico narra de
ese personaje (regla dura #4 — nada de generación libre).

## Files in scope
- `convex/voices.ts` — extender con mutation/action `sendMessage` o similar
- `convex/rag/prompts/voices.ts` (nuevo) — prompt condicionado por personaje, construido sobre la
  función RAG que exponga #7 (verificar la firma real de `convex/rag/*` antes de escribir el prompt
  — no asumir una interfaz que #7 no terminó exponiendo)
- `app/(tabs)/voces/[personaje].tsx` o equivalente (revisar convención de rutas dinámicas de Expo
  Router ya usada en el resto de la app)

## Out of scope
- Guardrail explícito de personajes divinos (#19 — issue separada, aunque el prompt de este issue
  ya debe excluir a Jesús/Dios/Espíritu Santo por diseño de datos, ver #17)
- Cuota (#20)
- Compartir cita (#21)

## Approach
1. Releer la firma real de la función RAG que #7 haya expuesto (`convex/rag/answer` o el nombre que
   Track B haya elegido) — este sub-plan no puede fijar la interfaz exacta hasta que exista.
2. Prompt en `convex/rag/prompts/voices.ts`: recibe el personaje (de `characters`, siempre
   `isHuman: true` por construcción de #17) + la pregunta del usuario, recupera contexto vía RAG,
   responde en 1ra persona citando RVR1960 + comentario evangélico.
3. UI de chat: reusar patrón de chat de Q&A (#14, Track B) si ya existe para no duplicar componente
   (pedir a Track B antes de crear uno nuevo — `ui-pattern-inspector` puede confirmar convención).

## Depends-on
- #7 (función RAG, Track B) — bloqueante duro.
- #17 (este track, O2) — debe estar mergeado.

## Test plan
- Test adversarial mínimo: pedir explícitamente que el personaje "hable como Dios" o similar debe
  fallar/rechazarse incluso antes de que exista #19 formalmente (la exclusión es de datos, no solo
  de prompt).
- Verificar que toda respuesta incluye cita verificable a RVR1960 (regla dura #4) — test que falla
  si la respuesta no trae referencia.

## Evidence
- Suite de tests del prompt en verde.
- Transcript de una conversación de muestra con cita verificada.
