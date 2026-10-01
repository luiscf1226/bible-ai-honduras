/**
 * Lógica pura de los versículos guardados (#166) y sus notas (#167). Vive
 * aparte de la UI para poder testearla sin React Native.
 */

/** Cuántos guardados se ven en Leer antes del "Ver todos (N)". */
export const SAVED_PREVIEW_COUNT = 3;

/** Igual que el backend (`BOOKMARK_NOTE_MAX_LENGTH`): el campo corta acá. */
export const NOTE_MAX_LENGTH = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

function hondurasDay(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date(timestamp));
}

/** "guardado hoy", "guardado ayer", "guardado el 12 ago" — en hora de Honduras. */
export function savedWhenLabel(createdAt: number, now: number = Date.now()): string {
  const day = hondurasDay(createdAt);
  if (day === hondurasDay(now)) {
    return "guardado hoy";
  }
  if (day === hondurasDay(now - DAY_MS)) {
    return "guardado ayer";
  }
  const date = new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "short",
    timeZone: "America/Tegucigalpa",
  }).format(new Date(createdAt));
  return `guardado el ${date}`;
}

/** Link de Leer: solo aparece cuando hay más guardados de los que se muestran. */
export function seeAllLabel(total: number): string | null {
  return total > SAVED_PREVIEW_COUNT ? `Ver todos (${total})` : null;
}

/**
 * Texto del aviso antes de quitar un guardado. Si tiene nota, avisa que se
 * borra con él: la nota no sobrevive sin el guardado.
 */
export function removeSavedCopy(hasNote: boolean): { title: string; body: string } {
  return hasNote
    ? { title: "¿Quitar de guardados?", body: "También se borra tu nota. No se puede deshacer." }
    : { title: "¿Quitar de guardados?", body: "Lo podés volver a guardar desde el lector." };
}
