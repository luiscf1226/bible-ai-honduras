import { ConvexError, v } from "convex/values";

import { query } from "./_generated/server";
import { resolveBibleVersion } from "./bibleVersions";
import { addDays, hondurasDateKey } from "./devotional";
import { countYearInWord, isValidYearInWordYear, yearInWordYear } from "./yearInWordCore";

/**
 * "Tu año en la Palabra" (#183): un resumen tranquilo de lo que la persona
 * leyó, cumplió del plan, guardó y subrayó en un año. Solo lectura, sin
 * premios ni comparaciones con nadie.
 *
 * No lee notas (#167) ni Sentir: no hay nada de eso en el resumen, ni en la
 * pantalla ni al compartir. No crea tablas: agrega las que ya existen, así que
 * el borrado de cuenta y "Borrar mi historial" ya lo cubren.
 *
 * - Capítulos leídos: capítulos de `readingRecents` cuya última apertura cae
 *   en el año. Recientes guarda una fila por capítulo con la última vez que se
 *   abrió, así que un capítulo leído en marzo y vuelto a abrir en enero del
 *   año siguiente cuenta para el año siguiente.
 * - Días del plan: cada día marcado de cualquier plan (anual o recorrido),
 *   ubicado en el calendario según su fecha en el plan (inicio + día − 1). El
 *   plan no guarda cuándo se marcó cada día.
 * - Versículos guardados: `readingBookmarks` creados en el año.
 * - Más subrayado: ver `countYearInWord`.
 */
export const summary = query({
  args: { year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) {
      return null;
    }
    const year = args.year ?? yearInWordYear(hondurasDateKey());
    if (!isValidYearInWordYear(year)) {
      throw new ConvexError("year fuera de rango");
    }

    const [recents, plans, bookmarks, highlights] = await Promise.all([
      ctx.db.query("readingRecents").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("userPlanProgress").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("readingBookmarks").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("readingHighlights").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
    ]);

    const counts = countYearInWord(
      {
        recents: recents.map((row) => ({ book: row.book, chapter: row.chapter, day: hondurasDateKey(row.openedAt) })),
        planDays: plans.flatMap((row) => row.completedDays.map((day) => addDays(row.startedAt, day - 1))),
        bookmarks: bookmarks.map((row) => hondurasDateKey(row.createdAt)),
        highlights: highlights.map((row) => ({
          book: row.book,
          chapter: row.chapter,
          verse: row.verse,
          day: hondurasDateKey(row.updatedAt),
          updatedAt: row.updatedAt,
        })),
      },
      year,
    );

    const version = resolveBibleVersion(user.bibleVersion);
    const top = counts.topHighlight;
    const verse = top
      ? await ctx.db
          .query("verses")
          .withIndex("by_ref", (q) =>
            q.eq("version", version).eq("book", top.book).eq("chapter", top.chapter).eq("verse", top.verse),
          )
          .unique()
      : null;

    return {
      ...counts,
      // Sin el versículo en el corpus no se inventa texto (regla dura #4).
      topHighlight: top ? { ...top, version, text: verse?.text ?? null } : null,
    };
  },
});
