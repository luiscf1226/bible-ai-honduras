export type ParsedVerseRef = {
  book: string;
  chapter: number;
  verse: number;
};

// Accepts catalog refs like "Salmos 23:1", "2 Corintios 1:3-4", "Mateo 11:28".
// Ranges resolve to the first verse so lookup can hit `verses.by_ref`.
export function parseVerseRef(ref: string): ParsedVerseRef | null {
  const match = ref.trim().match(/^(.+?)\s+(\d+):(\d+)(?:-\d+)?$/);
  if (!match) {
    return null;
  }

  const book = match[1].trim();
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (!book || !Number.isInteger(chapter) || !Number.isInteger(verse)) {
    return null;
  }

  return { book, chapter, verse };
}
