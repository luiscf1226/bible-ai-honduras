type ShareableDevotional = {
  reflection: string;
  verseRef: string;
  // La versión viene del contenido citado, no hardcodeada: el corpus de la
  // beta es RV1909 y decir "RVR1960" sería citar un texto por otro (#93 §4a).
  version: string;
};

export function buildDevotionalShareText({ reflection, verseRef, version }: ShareableDevotional): string {
  return `Devocional de hoy · ${verseRef} (${version})\n\n${reflection}\n\nQue esta Palabra te acompañe hoy.`;
}
