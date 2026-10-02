/**
 * Partes puras del diagnóstico (`telemetry.ts`), sin React Native para poder
 * testearlas en vitest.
 */

/**
 * Id anónimo de esta instalación: 32 hex con guiones, con forma de UUID. No
 * necesita ser criptográfico; solo distinguir un teléfono de otro en el
 * embudo, sin decir de quién es.
 */
export function makeInstallId(random: () => number = Math.random): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16)).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Mensaje y stack de cualquier cosa que se haya lanzado (no siempre es un Error). */
export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: `${error.name}: ${error.message}`, stack: error.stack };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  try {
    return { message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { message: String(error) };
  }
}
