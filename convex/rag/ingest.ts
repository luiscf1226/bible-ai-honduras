import { DEFAULT_BIBLE_VERSION } from "../bibleVersions";
import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { embedDocuments } from "./embed";
import rvr1960Sample from "./fixtures/rvr1960.sample.json";

// El corpus completo de RVR1960 se carga desde un archivo local con licencia;
// no se guarda en git (la RVR1960 está protegida por copyright). Esta muestra
// es solo para tests y desarrollo.

export type SampleVerse = {
  book: string;
  chapter: number;
  verse: number;
  text: string;
};

export function loadRvr1960Sample(): SampleVerse[] {
  return rvr1960Sample as SampleVerse[];
}

const verseInput = v.object({
  book: v.string(),
  chapter: v.number(),
  verse: v.number(),
  text: v.string(),
  version: v.optional(v.string()),
  embedding: v.optional(v.array(v.float64())),
});

// Action interna: embebe cada versículo como documento (o usa el embedding
// inyectado en tests) y hace upsert. Version por defecto: RVR1960.
export const ingestVerses = internalAction({
  args: {
    verses: v.array(verseInput),
    version: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const defaultVersion = args.version ?? DEFAULT_BIBLE_VERSION;
    const startedAt = Date.now();
    const pendingTexts = args.verses
      .filter((item) => item.embedding === undefined)
      .map((item) => item.text);
    const embedded = await embedDocuments(pendingTexts);
    let generatedIndex = 0;
    let upserted = 0;

    for (const item of args.verses) {
      const version = item.version ?? defaultVersion;
      const embedding = item.embedding ?? embedded.embeddings[generatedIndex++];
      await ctx.runMutation(internal.rag.verses.upsertVerse, {
        book: item.book,
        chapter: item.chapter,
        verse: item.verse,
        version,
        text: item.text,
        embedding,
      });
      upserted += 1;
    }

    return { upserted, embeddingTokens: embedded.totalTokens, elapsedMs: Date.now() - startedAt };
  },
});
