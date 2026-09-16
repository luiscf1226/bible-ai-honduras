import type { StoryCatalogItem } from "../../../convex/stories";
import type { TextStoryCatalogItem, TextStoryTestament } from "../../../convex/textStoriesCatalog";

/**
 * Filtros puros del catálogo de Historias (#145).
 * Sin React Native: testeable en vitest.
 */

export type StoryModeFilter = "texto" | "ilustradas";
export type TestamentFilter = "todos" | TextStoryTestament;

/** Quita diacríticos para que “noe” encuentre “Noé” (filtro de producción). */
function foldSpanish(value: string): string {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function matchesSearch(title: string, summary: string, reference: string, query: string): boolean {
  const term = foldSpanish(query.trim());
  if (term.length === 0) {
    return true;
  }
  const haystack = foldSpanish(`${title} ${summary} ${reference}`);
  return haystack.includes(term);
}

export function filterTextStories(
  stories: readonly TextStoryCatalogItem[],
  options: { testament: TestamentFilter; query: string },
): TextStoryCatalogItem[] {
  return stories.filter((story) => {
    if (options.testament !== "todos" && story.testament !== options.testament) {
      return false;
    }
    return matchesSearch(story.title, story.summary, story.reference, options.query);
  });
}

/** Las ilustradas no traen `testament` en el catálogo; se infiere del libro en la referencia. */
const OT_BOOK_PREFIXES = [
  "génesis",
  "éxodo",
  "levítico",
  "números",
  "deuteronomio",
  "josué",
  "jueces",
  "rut",
  "1 samuel",
  "2 samuel",
  "1 reyes",
  "2 reyes",
  "1 crónicas",
  "2 crónicas",
  "esdras",
  "nehemías",
  "ester",
  "job",
  "salmos",
  "salmo",
  "proverbios",
  "eclesiastés",
  "cantares",
  "isaías",
  "jeremías",
  "lamentaciones",
  "ezequiel",
  "daniel",
  "oseas",
  "joel",
  "amós",
  "abdías",
  "jonás",
  "miqueas",
  "nahúm",
  "habacuc",
  "sofonías",
  "hageo",
  "zacarías",
  "malaquías",
] as const;

export function testamentFromReference(reference: string): TextStoryTestament {
  const normalized = reference.trim().toLocaleLowerCase("es");
  for (const book of OT_BOOK_PREFIXES) {
    if (normalized === book || normalized.startsWith(`${book} `) || normalized.startsWith(`${book}–`) || normalized.startsWith(`${book}-`)) {
      return "antiguo";
    }
  }
  return "nuevo";
}

export function filterIllustratedStories(
  stories: readonly StoryCatalogItem[],
  options: { testament: TestamentFilter; query: string },
): StoryCatalogItem[] {
  return stories.filter((story) => {
    if (options.testament !== "todos" && testamentFromReference(story.reference) !== options.testament) {
      return false;
    }
    return matchesSearch(story.title, story.summary, story.reference, options.query);
  });
}
