import { voiceCharacters } from "../../../convex/voicesCatalog";

/**
 * Qué personaje de Voces vivió (o escribió) el capítulo que se está leyendo,
 * para ofrecer "Hablar con Moisés" desde el lector. Es un índice fijo, no IA:
 * dónde aparece cada personaje en el texto es un dato, no una opinión.
 *
 * Solo personajes del catálogo de Voces, que son todos humanos (regla dura #2).
 * Un capítulo sin personaje no ofrece nada: mejor ninguna sugerencia que una
 * forzada.
 */

/** "vivio" para la narración; "escribio" para salmos y cartas. */
type VoiceRole = "vivio" | "escribio";

type ChapterRange = { book: string; from: number; to: number; role: VoiceRole };

const whole = (book: string, chapters: number, role: VoiceRole): ChapterRange => ({ book, from: 1, to: chapters, role });
const range = (book: string, from: number, to: number, role: VoiceRole = "vivio"): ChapterRange => ({ book, from, to, role });

/**
 * Salmos con "Salmo de David" en el encabezado (RV1909). No todos los salmos
 * son suyos: los demás no sugieren a nadie.
 */
const DAVID_PSALMS = [
  [3, 9],
  [11, 32],
  [34, 41],
  [51, 65],
  [68, 70],
  [86, 86],
  [101, 101],
  [103, 103],
  [108, 110],
  [122, 122],
  [124, 124],
  [131, 131],
  [133, 133],
  [138, 145],
] as const;

const PAUL_LETTERS: ReadonlyArray<[string, number]> = [
  ["Romanos", 16],
  ["1 Corintios", 16],
  ["2 Corintios", 13],
  ["Gálatas", 6],
  ["Efesios", 6],
  ["Filipenses", 4],
  ["Colosenses", 4],
  ["1 Tesalonicenses", 5],
  ["2 Tesalonicenses", 3],
  ["1 Timoteo", 6],
  ["2 Timoteo", 4],
  ["Tito", 3],
  ["Filemón", 1],
];

export const CHAPTER_VOICES: Readonly<Record<string, readonly ChapterRange[]>> = {
  // Desde su nacimiento (Éx 2) hasta su muerte (Dt 34).
  moises: [range("Éxodo", 2, 40), whole("Levítico", 27, "vivio"), whole("Números", 36, "vivio"), whole("Deuteronomio", 34, "vivio")],
  // Desde que Samuel lo unge (1 S 16) hasta su muerte (1 R 2), más sus salmos.
  david: [
    range("1 Samuel", 16, 31),
    whole("2 Samuel", 24, "vivio"),
    range("1 Reyes", 1, 2),
    ...DAVID_PSALMS.map(([from, to]) => range("Salmos", from, to, "escribio")),
  ],
  ester: [whole("Ester", 10, "vivio")],
  // Saulo en Hechos (conversión y viajes) y sus cartas.
  pablo: [range("Hechos", 9, 9), range("Hechos", 13, 28), ...PAUL_LETTERS.map(([book, chapters]) => whole(book, chapters, "escribio"))],
  rut: [whole("Rut", 4, "vivio")],
  // Del anuncio de la sequía (1 R 17) a su partida en el torbellino (2 R 2).
  elias: [range("1 Reyes", 17, 19), range("1 Reyes", 21, 21), range("2 Reyes", 1, 2)],
};

export type ChapterVoice = { slug: string; name: string; role: VoiceRole };

export function voiceForChapter(book: string, chapter: number): ChapterVoice | null {
  for (const [slug, ranges] of Object.entries(CHAPTER_VOICES)) {
    const match = ranges.find((item) => item.book === book && chapter >= item.from && chapter <= item.to);
    if (!match) continue;
    const character = voiceCharacters.find((item) => item.slug === slug);
    if (!character) continue;
    return { slug, name: character.name, role: match.role };
  }
  return null;
}

/**
 * Primer mensaje sugerido al llegar desde el lector. Queda en el campo para
 * que la persona lo edite o lo borre: nunca se manda solo.
 */
export function voiceDraftFor(reference: string, role: VoiceRole): string {
  return role === "escribio"
    ? `Estoy leyendo ${reference}. ¿Qué te pasaba cuando escribiste esto?`
    : `Estoy leyendo ${reference}. ¿Cómo viviste este momento?`;
}
