/**
 * Formato del paquete de la Biblia sin conexión (#160). Lógica pura, sin
 * funciones de Convex: la comparten el backend (que arma un paquete por libro),
 * la app (que lo guarda en el teléfono y lo lee) y los tests.
 *
 * Un paquete es un libro completo de una versión, en JSON compacto: solo el
 * texto de cada versículo, sin embeddings ni ids. El texto es el mismo de la
 * tabla `verses` (RV1909, dominio público): no se genera nada.
 */

export const OFFLINE_PACKAGE_FORMAT = 1;

/** `chapters["3"] = [[16, "Porque de tal manera…"], …]`, ordenado por versículo. */
export type OfflineBookPackage = {
  format: typeof OFFLINE_PACKAGE_FORMAT;
  version: string;
  book: string;
  chapters: Record<string, Array<[number, string]>>;
};

export type OfflineVerseRow = { chapter: number; verse: number; text: string };

export type OfflineChapterVerse = {
  book: string;
  chapter: number;
  verse: number;
  version: string;
  text: string;
};

/** Arma el paquete de un libro a partir de sus filas, en cualquier orden. */
export function buildBookPackage(version: string, book: string, rows: readonly OfflineVerseRow[]): OfflineBookPackage {
  const chapters: Record<string, Array<[number, string]>> = {};
  const sorted = [...rows].sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
  for (const row of sorted) {
    const key = String(row.chapter);
    (chapters[key] ??= []).push([row.verse, row.text]);
  }
  return { format: OFFLINE_PACKAGE_FORMAT, version, book, chapters };
}

export function serializeBookPackage(pkg: OfflineBookPackage): string {
  return JSON.stringify(pkg);
}

/** Bytes UTF-8 de un texto: lo que ocupa el paquete en el teléfono. */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function isVerseTuple(value: unknown): value is [number, string] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    (value[0] as number) >= 1 &&
    typeof value[1] === "string"
  );
}

/**
 * Lee un paquete guardado. Devuelve null si el archivo está cortado, es de
 * otro formato o no es del libro esperado: antes de mostrar texto bíblico se
 * confirma que es el que corresponde, nunca se muestra a medias.
 */
export function parseBookPackage(
  raw: string,
  expected?: { version: string; book: string },
): OfflineBookPackage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const pkg = data as Partial<OfflineBookPackage>;
  if (pkg.format !== OFFLINE_PACKAGE_FORMAT) return null;
  if (typeof pkg.version !== "string" || typeof pkg.book !== "string") return null;
  if (expected && (pkg.version !== expected.version || pkg.book !== expected.book)) return null;
  if (typeof pkg.chapters !== "object" || pkg.chapters === null || Array.isArray(pkg.chapters)) return null;
  const entries = Object.entries(pkg.chapters);
  if (entries.length === 0) return null;
  for (const [chapter, verses] of entries) {
    if (!/^[1-9]\d*$/.test(chapter) || !Array.isArray(verses) || !verses.every(isVerseTuple)) return null;
  }
  return pkg as OfflineBookPackage;
}

/** Versículos de un capítulo del paquete, o [] si el capítulo no está. */
export function chapterFromPackage(pkg: OfflineBookPackage, chapter: number): OfflineChapterVerse[] {
  return (pkg.chapters[String(chapter)] ?? []).map(([verse, text]) => ({
    book: pkg.book,
    chapter,
    verse,
    version: pkg.version,
    text,
  }));
}

export function countPackageVerses(pkg: OfflineBookPackage): number {
  return Object.values(pkg.chapters).reduce((total, verses) => total + verses.length, 0);
}

/**
 * Nombre de archivo de un libro: sin tildes ni espacios ("1 Pedro" →
 * "1-pedro.json", "Éxodo" → "exodo.json"). Un URI con espacios o "%" se
 * decodifica distinto en iOS y Android.
 */
export function bookFileName(book: string): string {
  const slug = book
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "libro"}.json`;
}

/** "4,6 MB", "820 KB": como se lee en Honduras (coma decimal). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}
