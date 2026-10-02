import {
  bookFileName,
  chapterFromPackage,
  parseBookPackage,
  type OfflineBookPackage,
  type OfflineChapterVerse,
} from "../../../convex/offlineBiblePackage";
import { indexOfBook } from "../../lib/bibleBooks";
import { readJson, writeJson, type TextFileStore } from "./fileStore";

/**
 * Descarga de la Biblia para leer sin conexión (#160). Sin React ni
 * dependencias nativas: el almacenamiento y la red entran por parámetro.
 *
 * Se baja un archivo por libro (`offlineBible:manifest`) y se anota cada libro
 * terminado en `bible/index.json`. Si la señal se cae a mitad, la próxima vez
 * se sigue desde el libro que faltaba: no se vuelve a bajar lo que ya está.
 */

export type ManifestBook = { book: string; bytes: number; verses: number; url: string; builtAt: number };
export type OfflineManifest = { version: string; totalBytes: number; totalVerses: number; books: ManifestBook[] };

export type LocalBibleIndex = {
  version: string;
  books: Record<string, { bytes: number; verses: number; builtAt: number }>;
  /** Cuántos libros tenía el manifiesto al empezar: con todos, está completa. */
  expectedBooks: number;
  completedAt: number | null;
};

export type DownloadProgress = { done: number; total: number; book: string | null };

export const BIBLE_INDEX_PATH = "bible/index.json";

export function bookPath(version: string, book: string): string {
  return `bible/${version}/${bookFileName(book)}`;
}

/** Libros en el orden de la Biblia (Génesis primero), no alfabético. */
export function orderManifestBooks(books: readonly ManifestBook[]): ManifestBook[] {
  const position = (book: string) => {
    const index = indexOfBook(book);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...books].sort((a, b) => position(a.book) - position(b.book) || a.book.localeCompare(b.book));
}

export async function readBibleIndex(store: TextFileStore): Promise<LocalBibleIndex | null> {
  const index = await readJson<LocalBibleIndex>(store, BIBLE_INDEX_PATH);
  if (!index || typeof index.version !== "string" || typeof index.books !== "object" || index.books === null) {
    return null;
  }
  return index;
}

export function isBibleComplete(index: LocalBibleIndex | null): boolean {
  return index !== null && index.completedAt !== null && Object.keys(index.books).length >= index.expectedBooks;
}

export function downloadedBytes(index: LocalBibleIndex | null): number {
  if (!index) return 0;
  return Object.values(index.books).reduce((total, book) => total + book.bytes, 0);
}

/** Libros del manifiesto que faltan o cambiaron desde la última descarga. */
export function booksToDownload(index: LocalBibleIndex | null, manifest: OfflineManifest): ManifestBook[] {
  const sameVersion = index !== null && index.version === manifest.version;
  return orderManifestBooks(manifest.books).filter((book) => {
    const local = sameVersion ? index.books[book.book] : undefined;
    return !local || local.builtAt !== book.builtAt;
  });
}

/**
 * Estado para Ajustes. `update` = está descargada pero el servidor armó
 * paquetes nuevos (se corrigió el corpus): se ofrece bajar solo lo que cambió.
 */
export type BibleDownloadState =
  | { kind: "none" }
  | { kind: "partial"; done: number; total: number }
  | { kind: "ready"; bytes: number }
  | { kind: "update"; bytes: number; pending: number };

export function bibleDownloadState(index: LocalBibleIndex | null, manifest: OfflineManifest | null | undefined): BibleDownloadState {
  if (!index || Object.keys(index.books).length === 0) return { kind: "none" };
  const done = Object.keys(index.books).length;
  if (!isBibleComplete(index)) {
    return { kind: "partial", done, total: Math.max(index.expectedBooks, manifest?.books.length ?? 0, done) };
  }
  const bytes = downloadedBytes(index);
  if (manifest && manifest.books.length > 0) {
    const pending = booksToDownload(index, manifest).length;
    if (pending > 0) return { kind: "update", bytes, pending };
  }
  return { kind: "ready", bytes };
}

export class InvalidPackageError extends Error {
  constructor(readonly book: string) {
    super(`El paquete de ${book} llegó incompleto`);
  }
}

export class DownloadCancelledError extends Error {
  constructor() {
    super("Descarga cancelada");
  }
}

/**
 * Baja lo que falta, libro por libro y en orden. Cada libro se valida antes de
 * escribirlo: un archivo cortado nunca queda como si fuera texto bíblico.
 */
export async function downloadBible(options: {
  store: TextFileStore;
  manifest: OfflineManifest;
  fetchText: (url: string) => Promise<string>;
  onProgress?: (progress: DownloadProgress) => void;
  shouldStop?: () => boolean;
  now?: () => number;
}): Promise<LocalBibleIndex> {
  const { store, manifest, fetchText, onProgress, shouldStop, now = Date.now } = options;
  const previous = await readBibleIndex(store);
  if (previous && previous.version !== manifest.version) {
    await store.removeTree("bible");
  }
  const index: LocalBibleIndex =
    previous && previous.version === manifest.version
      ? { ...previous, books: { ...previous.books }, expectedBooks: manifest.books.length, completedAt: null }
      : { version: manifest.version, books: {}, expectedBooks: manifest.books.length, completedAt: null };

  const pending = booksToDownload(index, manifest);
  const total = manifest.books.length;
  let done = total - pending.length;
  onProgress?.({ done, total, book: pending[0]?.book ?? null });

  for (const entry of pending) {
    if (shouldStop?.()) throw new DownloadCancelledError();
    const raw = await fetchText(entry.url);
    const pkg = parseBookPackage(raw, { version: manifest.version, book: entry.book });
    if (!pkg) throw new InvalidPackageError(entry.book);
    await store.write(bookPath(manifest.version, entry.book), raw);
    index.books[entry.book] = { bytes: entry.bytes, verses: entry.verses, builtAt: entry.builtAt };
    await writeJson(store, BIBLE_INDEX_PATH, index);
    done += 1;
    onProgress?.({ done, total, book: entry.book });
  }

  // Un libro que el servidor ya no arma (no debería pasar) se saca del índice.
  const current = new Set(manifest.books.map((book) => book.book));
  for (const book of Object.keys(index.books)) {
    if (!current.has(book)) {
      delete index.books[book];
      await store.remove(bookPath(manifest.version, book));
    }
  }
  index.completedAt = now();
  await writeJson(store, BIBLE_INDEX_PATH, index);
  return index;
}

export async function removeLocalBible(store: TextFileStore): Promise<void> {
  await store.removeTree("bible");
}

/**
 * Último libro abierto, en memoria: pasar de capítulo en capítulo no vuelve a
 * leer y parsear el archivo (Salmos pesa ~250 KB).
 */
export type PackageCache = { key: string; pkg: OfflineBookPackage } | null;

/**
 * Versículos de un capítulo desde el teléfono, o null si ese libro no está
 * descargado (entonces el lector lo pide al servidor, como siempre).
 */
export async function readLocalChapter(
  store: TextFileStore,
  index: LocalBibleIndex | null,
  ref: { version: string; book: string; chapter: number },
  cache: { current: PackageCache } = { current: null },
): Promise<OfflineChapterVerse[] | null> {
  if (!index || index.version !== ref.version || !index.books[ref.book]) return null;
  const key = `${ref.version}|${ref.book}`;
  let pkg = cache.current?.key === key ? cache.current.pkg : null;
  if (!pkg) {
    const raw = await store.read(bookPath(ref.version, ref.book)).catch(() => null);
    pkg = raw === null ? null : parseBookPackage(raw, { version: ref.version, book: ref.book });
    if (!pkg) return null;
    cache.current = { key, pkg };
  }
  const verses = chapterFromPackage(pkg, ref.chapter);
  return verses.length > 0 ? verses : null;
}
