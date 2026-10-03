import { router } from "expo-router";

import type { VerseRef } from "./crossReferences";

/** Pantalla de pasajes relacionados de un versículo (#187). */
export function openRelatedPassages(ref: VerseRef) {
  router.push({
    pathname: "/leer/relacionados",
    params: { book: ref.book, chapter: String(ref.chapter), verse: String(ref.verse) },
  });
}
