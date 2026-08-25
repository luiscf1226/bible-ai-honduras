# Baton — Issue #28: Devocional por sentimiento

## Estado

Listo para revisión.

## Progreso

- `convex/feelings.generate` reutiliza `rag.answer.ask`; no llama directamente a Anthropic ni Voyage.
- Rechaza un resultado sin cita recuperada, para no presentar una opinión libre como devocional bíblico.
- La pantalla Sentimiento presenta el estado de generación y un resultado con versículo, reflexión y oración corta.
- La cuota y la persistencia se agregan en #29, según el orden acordado.

## Evidencia

- `npx vitest run convex/feelings.test.ts`
- `npm run typecheck`

## Siguiente

Abrir PR #28; después, #29 conecta cuota e historial compartido.
