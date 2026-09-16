import historiasTextoJson from "../docs/content/historias-texto.json";

/**
 * Catálogo curado de historias bíblicas en texto (#145).
 * Mismo patrón que `readingPlanCatalog.ts` / `devotionalCatalog.ts`:
 * JSON versionado en el repo — no generado en runtime (regla dura #4).
 *
 * Cada historia ofrece 2–3 páginas tipográficas gratis. Las ilustradas
 * siguen en `convex/stories.ts` y consumen cuota.
 */

export type TextStoryTestament = "antiguo" | "nuevo";

export type TextStoryCatalogItem = {
  id: string;
  title: string;
  summary: string;
  reference: string;
  testament: TextStoryTestament;
  book: string;
  chapter: number;
  verse?: number;
  /** Personaje humano de Voces, si la historia lo invita (regla dura #2). */
  voiceSlug?: string;
  pages: readonly string[];
};

type TextStoriesFile = {
  version: number;
  stories: TextStoryCatalogItem[];
};

function assertValidStory(story: unknown, index: number): asserts story is TextStoryCatalogItem {
  if (typeof story !== "object" || story === null) {
    throw new Error(`historias-texto[${index}] debe ser un objeto`);
  }
  const candidate = story as Partial<TextStoryCatalogItem>;
  if (typeof candidate.id !== "string" || !/^[a-z0-9-]+$/.test(candidate.id)) {
    throw new Error(`historias-texto[${index}] id inválido`);
  }
  if (typeof candidate.title !== "string" || candidate.title.length === 0) {
    throw new Error(`historias-texto[${index}] necesita title`);
  }
  if (typeof candidate.summary !== "string" || candidate.summary.length === 0) {
    throw new Error(`historias-texto[${index}] necesita summary`);
  }
  if (typeof candidate.reference !== "string" || candidate.reference.length === 0) {
    throw new Error(`historias-texto[${index}] necesita reference`);
  }
  if (candidate.testament !== "antiguo" && candidate.testament !== "nuevo") {
    throw new Error(`historias-texto[${index}] testament inválido`);
  }
  if (typeof candidate.book !== "string" || candidate.book.length === 0) {
    throw new Error(`historias-texto[${index}] necesita book`);
  }
  if (typeof candidate.chapter !== "number" || candidate.chapter < 1) {
    throw new Error(`historias-texto[${index}] chapter inválido`);
  }
  if (candidate.verse !== undefined && (typeof candidate.verse !== "number" || candidate.verse < 1)) {
    throw new Error(`historias-texto[${index}] verse inválido`);
  }
  if (candidate.voiceSlug !== undefined && typeof candidate.voiceSlug !== "string") {
    throw new Error(`historias-texto[${index}] voiceSlug inválido`);
  }
  if (!Array.isArray(candidate.pages) || candidate.pages.length < 2 || candidate.pages.length > 3) {
    throw new Error(`historias-texto[${index}] debe tener 2 o 3 páginas`);
  }
  for (const [pageIndex, page] of candidate.pages.entries()) {
    if (typeof page !== "string" || page.trim().length === 0) {
      throw new Error(`historias-texto[${index}] página ${pageIndex + 1} vacía`);
    }
  }
}

function loadCatalog(raw: unknown): readonly TextStoryCatalogItem[] {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("historias-texto.json debe ser un objeto");
  }
  const file = raw as Partial<TextStoriesFile>;
  if (!Array.isArray(file.stories) || file.stories.length === 0) {
    throw new Error("historias-texto.json necesita stories[]");
  }
  const seen = new Set<string>();
  for (const [index, story] of file.stories.entries()) {
    assertValidStory(story, index);
    if (seen.has(story.id)) {
      throw new Error(`historias-texto id duplicado: ${story.id}`);
    }
    seen.add(story.id);
  }
  return file.stories;
}

export const TEXT_STORY_CATALOG: readonly TextStoryCatalogItem[] = loadCatalog(historiasTextoJson);

export function findTextStoryById(storyId: string): TextStoryCatalogItem | null {
  return TEXT_STORY_CATALOG.find((story) => story.id === storyId) ?? null;
}
