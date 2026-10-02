import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { DEFAULT_BIBLE_VERSION, resolveBibleVersion } from "./bibleVersions";
import {
  buildBookPackage,
  serializeBookPackage,
  utf8ByteLength,
  type OfflineVerseRow,
} from "./offlineBiblePackage";

/**
 * Biblia sin conexión (#160).
 *
 * El teléfono no lee la tabla `verses` para descargar: cada fila arrastra su
 * embedding (~8 KB), así que bajar los 31.102 versículos por query leería
 * ~250 MB de base de datos por descarga. En cambio, `buildPackages` arma una
 * vez un JSON por libro (solo texto, ~4-5 MB en total) y lo deja en el storage;
 * `manifest` da las URLs y el tamaño real, y la app baja libro por libro.
 *
 * Leer es gratis: nada de esto pasa por `convex/quotas.ts`. El texto es el
 * mismo de `verses` (RV1909, dominio público); no se genera nada.
 *
 * Después de ingerir o corregir el corpus:
 *   npx convex run offlineBible:buildPackages '{}'
 */

/**
 * Libros listos para bajar, con su URL y su tamaño. La app los ordena en el
 * orden canónico y suma `totalBytes` para mostrar el tamaño en Ajustes.
 * Lista vacía = todavía no se armaron los paquetes de esa versión.
 */
export const manifest = query({
  args: { version: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const version = resolveBibleVersion(args.version);
    const rows = await ctx.db
      .query("bibleOfflinePackages")
      .withIndex("by_version_book", (q) => q.eq("version", version))
      .collect();
    const books = [];
    for (const row of rows) {
      const url = await ctx.storage.getUrl(row.storageId);
      if (url) {
        books.push({ book: row.book, bytes: row.bytes, verses: row.verses, url, builtAt: row.builtAt });
      }
    }
    return {
      version,
      totalBytes: books.reduce((total, book) => total + book.bytes, 0),
      totalVerses: books.reduce((total, book) => total + book.verses, 0),
      books,
    };
  },
});

/** Una página de versículos de una versión, sin embedding. Solo para armar paquetes. */
export const versesPage = internalQuery({
  args: { version: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("verses")
      .withIndex("by_ref", (q) => q.eq("version", args.version))
      .paginate(args.paginationOpts);
    return {
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      page: result.page.map((row) => ({ book: row.book, chapter: row.chapter, verse: row.verse, text: row.text })),
    };
  },
});

/** Guarda (o reemplaza) el paquete de un libro y borra el archivo viejo. */
export const savePackage = internalMutation({
  args: {
    version: v.string(),
    book: v.string(),
    storageId: v.id("_storage"),
    bytes: v.number(),
    verses: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bibleOfflinePackages")
      .withIndex("by_version_book", (q) => q.eq("version", args.version).eq("book", args.book))
      .unique();
    const row = { ...args, builtAt: Date.now() };
    if (existing) {
      if (existing.storageId !== args.storageId) {
        await ctx.storage.delete(existing.storageId);
      }
      await ctx.db.patch(existing._id, row);
      return existing._id;
    }
    return await ctx.db.insert("bibleOfflinePackages", row);
  },
});

/** Filas por página: ~250 × 8 KB queda lejos del límite de lectura de una query. */
const BUILD_PAGE_SIZE = 250;

/**
 * Arma un paquete por libro recorriendo `verses` una sola vez. El índice
 * `by_ref` agrupa por libro, así que en memoria hay un libro a la vez.
 */
export const buildPackages = internalAction({
  args: { version: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ version: string; books: number; verses: number; bytes: number }> => {
    const version = args.version ?? DEFAULT_BIBLE_VERSION;
    let cursor: string | null = null;
    let currentBook: string | null = null;
    let rows: OfflineVerseRow[] = [];
    const totals = { books: 0, verses: 0, bytes: 0 };

    const flush = async () => {
      if (currentBook === null || rows.length === 0) return;
      const json = serializeBookPackage(buildBookPackage(version, currentBook, rows));
      const bytes = utf8ByteLength(json);
      const storageId = await ctx.storage.store(new Blob([json], { type: "application/json" }));
      await ctx.runMutation(internal.offlineBible.savePackage, {
        version,
        book: currentBook,
        storageId,
        bytes,
        verses: rows.length,
      });
      totals.books += 1;
      totals.verses += rows.length;
      totals.bytes += bytes;
    };

    for (;;) {
      const result: {
        isDone: boolean;
        continueCursor: string;
        page: Array<{ book: string; chapter: number; verse: number; text: string }>;
      } = await ctx.runQuery(internal.offlineBible.versesPage, {
        version,
        paginationOpts: { numItems: BUILD_PAGE_SIZE, cursor },
      });
      for (const row of result.page) {
        if (row.book !== currentBook) {
          await flush();
          currentBook = row.book;
          rows = [];
        }
        rows.push({ chapter: row.chapter, verse: row.verse, text: row.text });
      }
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    await flush();
    return { version, ...totals };
  },
});
