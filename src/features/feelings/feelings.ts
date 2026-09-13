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
