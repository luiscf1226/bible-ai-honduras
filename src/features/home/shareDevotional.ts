type ShareableDevotional = {
  reflection: string;
  verseRef: string;
  // Oración final del devocional del día. Opcional para que un cliente que
  // todavía recibe el formato anterior (sin oraciones) siga compartiendo.
  closingPrayer?: string;
  // La versión viene del contenido citado, no hardcodeada: el corpus de la
  // beta es RV1909 y decir "RVR1960" sería citar un texto por otro (#93 §4a).
  version: string;
};

export function buildDevotionalShareText({ closingPrayer, reflection, verseRef, version }: ShareableDevotional): string {
  const prayer = closingPrayer ? `\n\n${closingPrayer}` : "";
  return `Devocional de hoy · ${verseRef} (${version})\n\n${reflection}${prayer}\n\nQue esta Palabra te acompañe hoy.`;
}

/**
 * Texto que acompaña la imagen 9:16 (#161). Corto: en un estado de WhatsApp
 * la imagen ya lleva el versículo, el texto solo dice de dónde viene.
 * `shareImage` le agrega el link de referido.
 */
export function buildVerseImageShareText({ verseRef, version }: Pick<ShareableDevotional, "verseRef" | "version">): string {
  return `Versículo de hoy · ${verseRef} (${version})`;
}
