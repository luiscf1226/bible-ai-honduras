import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { AVAILABLE_BIBLE_VERSIONS } from "../bibleVersions";

/**
 * Chequeo de corpus completo — #174, prepara #151.
 *
 * #93 §4b nació de una versión seleccionable sin texto: quien la elegía
 * recibía cero citas en Preguntar, Voces y Sentir sin ningún error visible.
 * Antes de habilitar otra versión (RVR1960), `rag:evaluate` y el cron diario
 * confirman que cada versión de `AVAILABLE_BIBLE_VERSIONS` tiene el canon
 * protestante completo cargado en el deployment.
 */

export const EXPECTED_CANON_VERSES = 31_102;

// Cada fila trae su embedding de 1024 floats (~8 KB): 1.000 filas quedan
// holgadas bajo el límite de lectura de una query.
const PAGE_SIZE = 1_000;

export type VersionCorpusStatus = {
  version: string;
  count: number;
  missing: number;
};

export function corpusStatus(version: string, count: number): VersionCorpusStatus {
  return { version, count, missing: Math.max(0, EXPECTED_CANON_VERSES - count) };
}

export function describeIncomplete(statuses: VersionCorpusStatus[]): string[] {
  return statuses
    .filter((status) => status.count !== EXPECTED_CANON_VERSES)
    .map((status) =>
      status.missing > 0
        ? `${status.version}: tiene ${status.count} de ${EXPECTED_CANON_VERSES} versículos (faltan ${status.missing})`
        : `${status.version}: tiene ${status.count} versículos, más de los ${EXPECTED_CANON_VERSES} esperados`,
    );
}

/**
 * Devuelve un estado por versión habilitada. No lanza: el caller decide.
 * `rag:evaluate` sale con código 1 y el cron deja un log de error.
 */
export const checkAvailableVersions = internalAction({
  args: {},
  handler: async (ctx): Promise<VersionCorpusStatus[]> => {
    const statuses: VersionCorpusStatus[] = [];
    for (const version of AVAILABLE_BIBLE_VERSIONS) {
      let count = 0;
      let cursor: string | null = null;
      for (;;) {
        const page: { count: number; isDone: boolean; continueCursor: string } = await ctx.runQuery(
          internal.rag.verses.countByVersion,
          { version, paginationOpts: { numItems: PAGE_SIZE, cursor } },
        );
        count += page.count;
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
      statuses.push(corpusStatus(version, count));
    }

    const problems = describeIncomplete(statuses);
    if (problems.length > 0) {
      console.error(`Corpus incompleto en una versión habilitada (#174): ${problems.join("; ")}`);
    }
    return statuses;
  },
});
