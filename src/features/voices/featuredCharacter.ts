import { voiceCharacters } from "../../../convex/voicesCatalog";
import type { PassageQuery } from "../reading/bookSearch";

/**
 * Personaje del mes (#200, design/oleada-ux.md §Temporadas). Contenido curado,
 * sin IA: una línea de quién fue y a dónde llevan los atajos de la tarjeta.
 *
 * Solo personajes del catálogo de Voces, que es solo de humanos (regla dura
 * #2): Jesús, Dios y el Espíritu Santo nunca son personaje del mes. El test
 * cruza este archivo con `voicesCatalog`, `textStoriesCatalog` y
 * `readingPlanCatalog` para que un error de dedo no llegue a la app.
 */
export type FeaturedCharacterContent = {
  /** Una línea de quién fue, en 3ra persona. */
  line: string;
  /** Historia en texto del catálogo (`textStoriesCatalog`) donde aparece. */
  storyId?: string;
  /** Capítulo donde empieza su historia: "Capítulos" abre el lector ahí. */
  chapter: PassageQuery;
  /** Recorrido de lectura de su vida, si existe (como `vida-de-jose`). */
  planId?: string;
};

export const FEATURED_CHARACTERS: Readonly<Record<string, FeaturedCharacterContent>> = {
  moises: {
    line: "Lo sacaron del Nilo de bebé, y Dios lo usó para sacar a su pueblo de Egipto.",
    storyId: "zarza-ardiente",
    chapter: { book: "Éxodo", chapter: 2 },
  },
  david: {
    line: "Pastor de ovejas y rey de Israel. Escribió muchos salmos, cayó y se arrepintió.",
    storyId: "david-y-goliat",
    chapter: { book: "1 Samuel", chapter: 16 },
  },
  ester: {
    line: "Una joven judía que llegó a reina de Persia y arriesgó su vida por su pueblo.",
    storyId: "ester-ante-el-rey",
    chapter: { book: "Ester", chapter: 2 },
  },
  pablo: {
    line: "Perseguía a la iglesia hasta que Jesús lo encontró en el camino a Damasco.",
    storyId: "saulo-en-el-camino",
    chapter: { book: "Hechos", chapter: 9 },
  },
  rut: {
    line: "Moabita y viuda, se quedó con su suegra Noemí y entró en la historia de Israel.",
    storyId: "rut-y-booz",
    chapter: { book: "Rut", chapter: 1 },
  },
  elias: {
    line: "Profeta de Israel que enfrentó a los profetas de Baal en el monte Carmelo.",
    storyId: "elias-en-el-carmelo",
    chapter: { book: "1 Reyes", chapter: 17 },
  },
};

/** Rotación fuera de temporada: el orden del catálogo de Voces, solo los que tienen contenido curado. */
export const MONTHLY_ROTATION: readonly string[] = voiceCharacters
  .map((character) => character.slug)
  .filter((slug) => Object.prototype.hasOwnProperty.call(FEATURED_CHARACTERS, slug));

function monthIndex(dateKey: string): number {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(dateKey);
  if (!match) return 0;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

export type FeaturedCharacter = { slug: string; content: FeaturedCharacterContent };

/**
 * El personaje del mes: el de la temporada activa si está en la rotación; si
 * no, uno por mes sobre `MONTHLY_ROTATION` (cambia el día 1, calendario de
 * Honduras). Un slug de temporada que no conocemos cae a la rotación.
 */
export function pickFeaturedCharacter(
  season: { characterSlug: string | null } | null | undefined,
  dateKey: string,
): FeaturedCharacter | null {
  const seasonSlug = season?.characterSlug;
  if (seasonSlug && MONTHLY_ROTATION.includes(seasonSlug)) {
    return { slug: seasonSlug, content: FEATURED_CHARACTERS[seasonSlug] };
  }
  if (MONTHLY_ROTATION.length === 0) return null;
  const slug = MONTHLY_ROTATION[monthIndex(dateKey) % MONTHLY_ROTATION.length];
  return { slug, content: FEATURED_CHARACTERS[slug] };
}

export type FeaturedShortcutId = "historia" | "capitulos" | "recorrido" | "conversar";
export type FeaturedShortcut = { id: FeaturedShortcutId; label: string };

/** Atajos de la tarjeta, en el orden del spec. Sin historia o sin recorrido, ese atajo no aparece. */
export function featuredShortcuts(content: FeaturedCharacterContent): FeaturedShortcut[] {
  return [
    ...(content.storyId ? [{ id: "historia" as const, label: "Su historia" }] : []),
    { id: "capitulos", label: "Capítulos" },
    ...(content.planId ? [{ id: "recorrido" as const, label: "Recorrido" }] : []),
    { id: "conversar", label: "Conversar" },
  ];
}
