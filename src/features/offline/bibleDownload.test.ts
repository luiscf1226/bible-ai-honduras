import { describe, expect, it } from "vitest";

import { buildBookPackage, serializeBookPackage } from "../../../convex/offlineBiblePackage";
import {
  BIBLE_INDEX_PATH,
  bibleDownloadState,
  bookPath,
  booksToDownload,
  downloadBible,
  InvalidPackageError,
  isBibleComplete,
  orderManifestBooks,
  readBibleIndex,
  readLocalChapter,
  removeLocalBible,
  type OfflineManifest,
  type PackageCache,
} from "./bibleDownload";
import { createMemoryFileStore } from "./fileStore";

const PACKAGES: Record<string, string> = {
  "url:juan": serializeBookPackage(
    buildBookPackage("RV1909", "Juan", [{ chapter: 3, verse: 16, text: "Porque de tal manera amó Dios al mundo…" }]),
  ),
  "url:genesis": serializeBookPackage(
    buildBookPackage("RV1909", "Génesis", [{ chapter: 1, verse: 1, text: "En el principio crió Dios los cielos y la tierra." }]),
  ),
  "url:salmos": serializeBookPackage(
    buildBookPackage("RV1909", "Salmos", [{ chapter: 46, verse: 1, text: "Dios es nuestro amparo y fortaleza…" }]),
  ),
};

function manifest(builtAt = 1): OfflineManifest {
  // Alfabético, como lo devuelve Convex: la app lo ordena.
  const books = [
    { book: "Génesis", url: "url:genesis" },
    { book: "Juan", url: "url:juan" },
    { book: "Salmos", url: "url:salmos" },
  ].map((entry) => ({ ...entry, bytes: PACKAGES[entry.url].length, verses: 1, builtAt }));
  return { version: "RV1909", totalBytes: books.reduce((t, b) => t + b.bytes, 0), totalVerses: 3, books };
}

function fetcher(log: string[] = [], failOn?: string) {
  return async (url: string) => {
    log.push(url);
    if (url === failOn) throw new Error("sin señal");
    return PACKAGES[url];
  };
}

describe("descargar la Biblia (#160)", () => {
  it("baja libro por libro en el orden de la Biblia y deja todo listo", async () => {
    const store = createMemoryFileStore();
    const log: string[] = [];
    const progress: number[] = [];
    const index = await downloadBible({
      store,
      manifest: manifest(),
      fetchText: fetcher(log),
      onProgress: (p) => progress.push(p.done),
      now: () => 42,
    });
    expect(log).toEqual(["url:genesis", "url:salmos", "url:juan"]);
    expect(progress).toEqual([0, 1, 2, 3]);
    expect(isBibleComplete(index)).toBe(true);
    expect(index.completedAt).toBe(42);
    expect(store.files.get(bookPath("RV1909", "Juan"))).toBe(PACKAGES["url:juan"]);
    await expect(readBibleIndex(store)).resolves.toEqual(index);
    expect(bibleDownloadState(index, manifest())).toEqual({ kind: "ready", bytes: manifest().totalBytes });
  });

  it("si se corta la señal, la próxima vez sigue donde quedó sin volver a bajar lo que ya está", async () => {
    const store = createMemoryFileStore();
    await expect(
      downloadBible({ store, manifest: manifest(), fetchText: fetcher([], "url:juan") }),
    ).rejects.toThrow("sin señal");
    const partial = await readBibleIndex(store);
    expect(Object.keys(partial!.books)).toEqual(["Génesis", "Salmos"]);
    expect(isBibleComplete(partial)).toBe(false);
    expect(bibleDownloadState(partial, manifest())).toEqual({ kind: "partial", done: 2, total: 3 });

    const log: string[] = [];
    await downloadBible({ store, manifest: manifest(), fetchText: fetcher(log) });
    expect(log).toEqual(["url:juan"]);
  });

  it("un archivo cortado no se guarda como texto bíblico", async () => {
    const store = createMemoryFileStore();
    const broken = async (url: string) => (url === "url:salmos" ? PACKAGES[url].slice(0, 20) : PACKAGES[url]);
    await expect(downloadBible({ store, manifest: manifest(), fetchText: broken })).rejects.toBeInstanceOf(InvalidPackageError);
    expect(store.files.has(bookPath("RV1909", "Salmos"))).toBe(false);
  });

  it("si el servidor rearma un libro (corrección del corpus), ofrece bajar solo ese", async () => {
    const store = createMemoryFileStore();
    const index = await downloadBible({ store, manifest: manifest(1), fetchText: fetcher() });
    const updated = manifest(1);
    updated.books[1] = { ...updated.books[1], builtAt: 2 };
    expect(booksToDownload(index, updated).map((book) => book.book)).toEqual(["Juan"]);
    expect(bibleDownloadState(index, updated)).toMatchObject({ kind: "update", pending: 1 });
  });

  it("lee un capítulo del teléfono, y null si el libro o el capítulo no están", async () => {
    const store = createMemoryFileStore();
    const index = await downloadBible({ store, manifest: manifest(), fetchText: fetcher() });
    const cache: { current: PackageCache } = { current: null };
    await expect(readLocalChapter(store, index, { version: "RV1909", book: "Juan", chapter: 3 }, cache)).resolves.toEqual([
      { book: "Juan", chapter: 3, verse: 16, version: "RV1909", text: "Porque de tal manera amó Dios al mundo…" },
    ]);
    expect(cache.current?.key).toBe("RV1909|Juan");
    await expect(readLocalChapter(store, index, { version: "RV1909", book: "Juan", chapter: 4 })).resolves.toBeNull();
    await expect(readLocalChapter(store, index, { version: "RV1909", book: "Romanos", chapter: 8 })).resolves.toBeNull();
    await expect(readLocalChapter(store, index, { version: "NVI", book: "Juan", chapter: 3 })).resolves.toBeNull();
    await expect(readLocalChapter(store, null, { version: "RV1909", book: "Juan", chapter: 3 })).resolves.toBeNull();
  });

  it("quitar la Biblia borra los libros y el índice", async () => {
    const store = createMemoryFileStore({ "queue.json": "[]" });
    await downloadBible({ store, manifest: manifest(), fetchText: fetcher() });
    await removeLocalBible(store);
    expect([...store.files.keys()]).toEqual(["queue.json"]);
    await expect(readBibleIndex(store)).resolves.toBeNull();
    expect(bibleDownloadState(null, manifest())).toEqual({ kind: "none" });
  });

  it("un índice roto cuenta como no descargada", async () => {
    const store = createMemoryFileStore({ [BIBLE_INDEX_PATH]: "{roto" });
    await expect(readBibleIndex(store)).resolves.toBeNull();
  });

  it("ordena los libros como en la Biblia, no alfabético", () => {
    expect(orderManifestBooks(manifest().books).map((book) => book.book)).toEqual(["Génesis", "Salmos", "Juan"]);
  });
});
