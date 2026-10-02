import { formatPassage, type PassageQuery } from "../reading/bookSearch";

/**
 * Ejemplos y sugerencias de Preguntar (U6, #198). Todo lo que se toca acá se
 * manda como pregunta a `api.qa.ask` → RAG (regla dura #4): son atajos para
 * escribir, no respuestas.
 */

export type SuggestionGroup = {
  /** Se muestra en `overline` (mayúsculas por estilo, no por dato). */
  label: string;
  questions: readonly string[];
};

/** Estado vacío sin pasaje: tres intenciones, dos preguntas cada una. */
export const FREE_QUESTION_GROUPS: readonly SuggestionGroup[] = [
  {
    label: "Para entender",
    questions: ["¿Qué es la gracia según la Biblia?", "¿Qué significa nacer de nuevo?"],
  },
  {
    label: "Para mi vida",
    questions: ["¿Qué dice la Biblia sobre la ansiedad?", "¿Cómo perdono a alguien que me hirió?"],
  },
  {
    label: "Sobre personajes",
    questions: ["¿Quién fue el rey David?", "¿Por qué Pedro negó a Jesús?"],
  },
];

export const APPLY_TODAY = "¿Cómo lo aplico hoy?";
export const WHO_WROTE_IT = "¿Quién lo escribió y para quién?";
export const EXPLAIN_SIMPLER = "Explícalo más simple";
export const WHERE_ELSE = "¿Dónde más lo dice la Biblia?";

/** Primera pregunta sobre un pasaje: el versículo si vino, si no el capítulo. */
function meaningQuestion(passage: PassageQuery): string {
  return passage.verse === undefined
    ? `¿Cuál es la idea central de ${formatPassage(passage)}?`
    : `¿Qué quiere decir el versículo ${passage.verse}?`;
}

/** Preguntas por grupo en el estado vacío (U6). */
const QUESTIONS_PER_GROUP = 2;

type SeasonLike = { name: string; sampleQuestions: readonly string[] } | null | undefined;

/**
 * Grupos del estado vacío. Con pasaje hay un solo grupo, "Sobre {pasaje}",
 * con preguntas que solo tienen sentido sobre un texto concreto.
 *
 * Con temporada que trae preguntas de ejemplo (#199), el primer grupo lleva el
 * nombre de la temporada y sus dos primeras preguntas, en lugar de "Para
 * entender": siguen siendo tres grupos. Sin temporada, lo de siempre.
 */
export function emptyStateGroups(passage: PassageQuery | null, season?: SeasonLike): readonly SuggestionGroup[] {
  if (!passage) {
    const seasonal = season?.sampleQuestions.filter((question) => question.trim()).slice(0, QUESTIONS_PER_GROUP) ?? [];
    if (!season || seasonal.length === 0) return FREE_QUESTION_GROUPS;
    return [{ label: season.name, questions: seasonal }, ...FREE_QUESTION_GROUPS.slice(1)];
  }
  return [
    {
      label: `Sobre ${formatPassage(passage)}`,
      questions: [meaningQuestion(passage), APPLY_TODAY, WHO_WROTE_IT],
    },
  ];
}

/**
 * Chips del composer. Antes de la primera respuesta no hay: el estado vacío ya
 * muestra los ejemplos y repetirlos abajo solo ocupa lugar. Después de una
 * respuesta, "Explícalo más simple" primero; "¿Quién lo escribió…?" solo con
 * pasaje (sin pasaje no hay "lo").
 */
export function composerSuggestions({
  passage,
  hasAnswer,
}: {
  passage: PassageQuery | null;
  hasAnswer: boolean;
}): readonly string[] {
  if (!hasAnswer) return [];
  return passage ? [EXPLAIN_SIMPLER, APPLY_TODAY, WHO_WROTE_IT] : [EXPLAIN_SIMPLER, APPLY_TODAY, WHERE_ELSE];
}

/** Texto del chip de pasaje. */
export function passageChipLabel(passage: PassageQuery | null): string {
  return passage ? formatPassage(passage) : "Elegir pasaje (opcional)";
}

/** ¿Dos pasajes son el mismo? Elegir el mismo no abre un hilo nuevo. */
export function samePassage(a: PassageQuery | null, b: PassageQuery | null): boolean {
  if (!a || !b) return a === b;
  return a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;
}
