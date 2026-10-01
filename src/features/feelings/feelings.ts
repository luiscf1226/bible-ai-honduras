/**
 * Los 14 sentimientos que ofrece Sentir. Viven fuera de `sentir.tsx` para que
 * los módulos puros que dependen de esta taxonomía (p. ej. el puente a los
 * recorridos de lectura, #115) se puedan testear contra la lista real.
 */
export const FEELINGS = [
  "Ansiedad",
  "Duelo",
  "Gratitud",
  "Decisión difícil",
  "Cansancio",
  "Miedo",
  "Soledad",
  "Necesito perdonar",
  "Deudas",
  "Enojo",
  "Mi familia",
  "Enfermedad",
  "Sin trabajo",
  "Lejos de casa",
] as const;

export type Feeling = (typeof FEELINGS)[number];

/** Chip que lleva al campo libre: "mi sentimiento no está en la lista". */
export const OWN_WORDS_CHIP = "Otro · lo escribo yo";

/**
 * Sentimiento que llega por la ruta (`/sentir?feeling=Ansiedad`, desde los
 * atajos del inicio). Solo se acepta uno de la lista: un valor inventado en la
 * URL no se convierte en chip.
 */
export function feelingFromParam(param: string | string[] | undefined): Feeling | null {
  const value = Array.isArray(param) ? param[0] : param;
  return (FEELINGS as readonly string[]).includes(value ?? "") ? (value as Feeling) : null;
}
