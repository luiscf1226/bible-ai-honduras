import type { StoryCatalogItem } from "../../../convex/stories";
import type { TextStoryTestament } from "../../../convex/textStoriesCatalog";
import { testamentForReference } from "../../lib/bibleBooks";
import { normalizeText } from "../../lib/normalizeText";

/**
 * Filtros puros del catálogo de Historias (#145).
 * Sin React Native: testeable en vitest.
 */

export type StoryModeFilter = "texto" | "ilustradas";
export type TestamentFilter = "todos" | TextStoryTestament;

/** Lo mínimo que necesita el filtro: sirve tanto para el detalle como para la proyección de la lista. */
export type TextStoryFilterable = {
  title: string;
  summary: string;
  reference: string;
  testament: TextStoryTestament;
};

export function matchesSearch(title: string, summary: string, reference: string, query: string): boolean {
  const term = normalizeText(query);
  if (term.length === 0) {
    return true;
  }
  return normalizeText(`${title} ${summary} ${reference}`).includes(term);
}

export function filterTextStories<T extends TextStoryFilterable>(
  stories: readonly T[],
  options: { testament: TestamentFilter; query: string },
): T[] {
  return stories.filter((story) => {
    if (options.testament !== "todos" && story.testament !== options.testament) {
      return false;
    }
    return matchesSearch(story.title, story.summary, story.reference, options.query);
  });
}

/**
 * Las ilustradas no traen `testament` en el catálogo; se infiere del libro de
 * la referencia contra `BIBLE_BOOKS`, que es quien ya es dueño de ese dato.
 * Devuelve null si la referencia no nombra un libro del canon: una historia
 * mal referenciada no se etiqueta con un testamento inventado.
 */
export function testamentFromReference(reference: string): TextStoryTestament | null {
  return testamentForReference(reference);
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
