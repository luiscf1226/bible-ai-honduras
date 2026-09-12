import { shareContent, type ShareResult } from "../../lib/share";

export type ReadingVerse = {
  book: string;
  chapter: number;
  verse: number;
  version: string;
  text: string;
};

export function formatVerseReference(verse: ReadingVerse): string {
  return `${verse.book} ${verse.chapter}:${verse.verse} (${verse.version})`;
}

export function buildVerseShareText(verse: ReadingVerse): string {
  return `"${verse.text}"\n— ${formatVerseReference(verse)}`;
}

/** Texto que va al portapapeles: el mismo cuerpo, sin el link de referido. */
export function buildVerseCopyText(verse: ReadingVerse): string {
  return buildVerseShareText(verse);
}

/**
 * Compartir un versículo del lector. Regla dura #3: el share sheet tiene un
 * solo dueño (`src/lib/share.ts`); acá solo se arma el texto.
 */
export function shareVerse(params: { verse: ReadingVerse; referralCode: string }): Promise<ShareResult> {
  return shareContent({
    referralCode: params.referralCode,
    text: buildVerseShareText(params.verse),
  });
}
