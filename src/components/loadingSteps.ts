/** Tiempo antes de ofrecer reintentar (issue #110). */
export const LOADING_RETRY_AFTER_MS = 20_000;

/** Intervalo entre líneas de paso cuando no hay progreso real del backend. */
export const LOADING_STEP_INTERVAL_MS = 2_800;

/**
 * Pasos de Sentir · generando — copy exacto del prototipo (`feelGenLine`).
 *
 * El backend (`feelings:generate`) aún no expone un campo de progreso; estas
 * líneas rotan por temporizador para dar señal de vida. Sustituir por progreso
 * real cuando exista.
 */
export const FEELING_GEN_STEPS = [
  "Leyendo lo que escribiste…",
  "Buscando un pasaje que hable de eso…",
  "Preparando tu devocional…",
] as const;

/**
 * Pasos de Q&A · respondiendo. La primera línea es la del prototipo
 * ("Buscando en el texto…"); las siguientes son informativas para esperas
 * largas. Sin campo de progreso en `qa.ask` — rotación por temporizador.
 */
export const QA_ANSWER_STEPS = [
  "Buscando en el texto…",
  "Leyendo el comentario…",
  "Escribiendo la respuesta…",
] as const;

export function loadingStepAt(
  steps: readonly string[],
  elapsedMs: number,
  intervalMs = LOADING_STEP_INTERVAL_MS,
): string {
  if (steps.length === 0) {
    return "";
  }
  const index = Math.floor(elapsedMs / intervalMs) % steps.length;
  return steps[index] ?? steps[0] ?? "";
}
