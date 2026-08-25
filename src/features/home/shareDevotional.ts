type ShareableDevotional = {
  reflection: string;
  verseRef: string;
};

export function buildDevotionalShareText({ reflection, verseRef }: ShareableDevotional): string {
  return `Devocional de hoy · ${verseRef} (RVR1960)\n\n${reflection}\n\nQue esta Palabra te acompañe hoy.`;
}
