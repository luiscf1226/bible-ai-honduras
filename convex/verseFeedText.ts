import { feedVerseText } from "../src/features/feed/feedLogic";
import type { QueryCtx } from "./_generated/server";
import { fitPassageText, type FeedPassage } from "./verseFeedCore";

/**
 * El texto de una cita tal como lo muestra (y lo lee la voz de) el feed: los
 * versículos de la Biblia cargada que entran en la pantalla. Una sola función
 * para la página y para la generación de la voz, así nunca se separan.
 */
export async function feedPassageText(ctx: QueryCtx, passage: FeedPassage, version: string) {
  const rows = await ctx.db
    .query("verses")
    .withIndex("by_ref", (q) =>
      q
        .eq("version", version)
        .eq("book", passage.book)
        .eq("chapter", passage.chapter)
        .gte("verse", passage.verse)
        .lte("verse", passage.endVerse ?? passage.verse),
    )
    .collect();
  return fitPassageText(rows);
}

/** Lo que dice la voz: el texto que se ve en pantalla (primera palabra de RV1909 ya sin mayúsculas). */
export function spokenText(text: string): string {
  return feedVerseText(text);
}

/**
 * Huella del texto que leyó la voz. Si el texto de la cita cambia (otra
 * Biblia cargada, otro largo máximo), la voz guardada deja de coincidir: el
 * feed no la usa y la generación la rehace (regla dura #4: la voz lee lo que
 * se ve, nunca otra cosa).
 */
export function textHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  return `${text.length}-${(hash >>> 0).toString(36)}`;
}
