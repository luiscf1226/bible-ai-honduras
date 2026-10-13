import type { PassageQuery } from "../reading/bookSearch";
import type { Feeling } from "../feelings/feelings";

const HONDURAS_TIME_ZONE = "America/Tegucigalpa";

/**
 * Contenido y rutas del inicio en tarjetas (#193, design/oleada-ux.md §U1).
 * Todo lo que no es dibujo vive acá para poder testearlo sin renderizar:
 * el orden de las tarjetas, a dónde lleva cada chip y atajo, la pregunta de
 * ejemplo del día y las líneas de estado.
 */

/**
 * Orden exacto de las tarjetas del inicio (#193). Una tarjeta nueva entra acá y en `cards/index.ts`.
 *
 * `context` es **una sola** tarjeta de contexto (#232, Fase 2): de todo lo
 * que solo aparece algunos días (aviso de actualización, nota de prédica del
 * domingo, Tus fechas, temporada, recuerdo de un guardado) se muestra lo más
 * importante y nada más (`pickHomeContext`). Antes el peor día sumaba cuatro
 * tarjetas y el inicio dejaba de entrar en una pantalla (U1b).
 *
 * Inicio compacto (U1b): los cuatro módulos van al final como mosaicos de una
 * cuadrícula 2×2 (`HOME_TILE_IDS`). "Un minuto de pausa" (#203) se mudó a
 * Sentir en #232.
 */
export const HOME_CARD_ORDER = ["context", "verse", "feeling", "read", "ask", "characters", "stories"] as const;
export type HomeCardId = (typeof HOME_CARD_ORDER)[number];

/** Los módulos que se dibujan como mosaico en la cuadrícula 2×2 (U1b). */
export const HOME_TILE_IDS = ["read", "ask", "characters", "stories"] as const satisfies readonly HomeCardId[];

// ── Tarjeta de contexto (#232) ───────────────────────────────────────────────

/**
 * Prioridad de la tarjeta de contexto, de mayor a menor (#232): actualización
 * > nota de prédica (domingos) > fecha personal > temporada > recuerdo
 * guardado. La guirnalda de temporada sigue colgando de la foto del versículo
 * aunque la franja no salga: es decoración, no una tarjeta.
 */
export const HOME_CONTEXT_PRIORITY = ["update", "sermon", "dates", "season", "savedMemory"] as const;
export type HomeContextKind = (typeof HOME_CONTEXT_PRIORITY)[number];

/** La única tarjeta de contexto de hoy, o null si no hay ninguna. */
export function pickHomeContext(available: Partial<Record<HomeContextKind, boolean>>): HomeContextKind | null {
  return HOME_CONTEXT_PRIORITY.find((kind) => available[kind] === true) ?? null;
}

/** Domingo en Honduras: el día de la prédica. */
export function isSundayInHonduras(now = Date.now()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: HONDURAS_TIME_ZONE, weekday: "short" }).format(new Date(now));
  return weekday === "Sun";
}

/** Ruta en la forma que acepta `router.push`. */
export type HomeRoute = { pathname: string; params?: Record<string, string> };

export const HOME_ROUTES = {
  today: { pathname: "/hoy" },
  read: { pathname: "/leer" },
  feeling: { pathname: "/sentir" },
  ask: { pathname: "/preguntar" },
  characters: { pathname: "/voces" },
  stories: { pathname: "/historias" },
  newSermonNote: { pathname: "/notas/[noteId]", params: { noteId: "nueva" } },
} as const satisfies Record<string, HomeRoute>;

// ── Leer la Biblia ───────────────────────────────────────────────────────────

type SeparatorLike = { book: string; chapter: number; verse: number } | null | undefined;
type ProgressLike = { book: string; chapter: number } | null | undefined;

export type ReadStatus = { label: string; passage: PassageQuery };

/** Separador > "seguí leyendo" > empezar por Génesis 1. */
export function readStatusLine(separator: SeparatorLike, progress: ProgressLike): ReadStatus {
  if (separator) {
    return {
      label: `Tu separador · ${separator.book} ${separator.chapter}:${separator.verse}`,
      passage: { book: separator.book, chapter: separator.chapter, verse: separator.verse },
    };
  }
  if (progress) {
    return {
      label: `Seguí leyendo · ${progress.book} ${progress.chapter}`,
      passage: { book: progress.book, chapter: progress.chapter },
    };
  }
  return { label: "Empezá por Génesis 1", passage: { book: "Génesis", chapter: 1 } };
}

// ── ¿Cómo estás hoy? ─────────────────────────────────────────────────────────

/** Tres sentimientos frecuentes de la lista real (`FEELINGS`). */
export const FEELING_SHORTCUTS = ["Ansiedad", "Cansancio", "Gratitud"] as const satisfies readonly Feeling[];

export function feelingRoute(feeling: string): HomeRoute {
  return { pathname: "/sentir", params: { feeling } };
}

export const FEELING_WRITE_ROUTE: HomeRoute = { pathname: "/sentir", params: { escribir: "1" } };

// ── Preguntar sobre la Biblia ────────────────────────────────────────────────

/**
 * Preguntas de ejemplo, una por día. Son preguntas sobre el texto: la
 * respuesta sale del RAG con su cita (regla dura #4), igual que si la persona
 * la escribiera.
 */
export const ASK_EXAMPLES = [
  "¿Qué quiere decir que Dios es nuestro amparo?",
  "¿Por qué Jesús enseñaba con parábolas?",
  "¿Qué dice la Biblia sobre la ansiedad?",
  "¿Qué significa nacer de nuevo en Juan 3?",
  "¿Cómo perdonó José a sus hermanos?",
  "¿Qué es la gracia según Efesios 2?",
  "¿Por qué Elías se escondió en una cueva?",
  "¿Qué enseña la Biblia sobre el descanso?",
  "¿Quién fue Rut y por qué es importante?",
  "¿Qué quiso decir Pablo con “todo lo puedo”?",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días desde 1970 de una fecha `YYYY-MM-DD`; sirve para rotar contenido por día. */
export function dayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  const timestamp = Date.UTC(year, (month || 1) - 1, day || 1);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / DAY_MS) : 0;
}

/** Elemento del día de una lista: cambia cada día y da la vuelta al final. */
export function pickForDay<T>(items: readonly T[], dateKey: string): T | undefined {
  if (items.length === 0) return undefined;
  const index = ((dayNumber(dateKey) % items.length) + items.length) % items.length;
  return items[index];
}

export function askExampleForDay(dateKey: string): string {
  return pickForDay(ASK_EXAMPLES, dateKey) ?? ASK_EXAMPLES[0];
}

/** Abre Preguntar con la pregunta escrita en el campo; no se envía sola. */
export function askExampleRoute(question: string): HomeRoute {
  return { pathname: "/preguntar", params: { pregunta: question } };
}

// ── Personajes ───────────────────────────────────────────────────────────────

export const HOME_CHARACTER_COUNT = 4;
const PREFERRED_CHARACTERS = ["moises", "ester", "david", "pablo"];

/**
 * Los 4 avatares del inicio: el personaje del mes primero (#200), después los
 * que nombra la línea, y si faltan, los primeros del catálogo.
 */
export function pickHomeCharacters<T extends { slug: string }>(characters: readonly T[], featuredSlug?: string | null): T[] {
  const order = featuredSlug ? [featuredSlug, ...PREFERRED_CHARACTERS.filter((slug) => slug !== featuredSlug)] : PREFERRED_CHARACTERS;
  const preferred = order.map((slug) => characters.find((character) => character.slug === slug)).filter(
    (character): character is T => character !== undefined,
  );
  const rest = characters.filter((character) => !order.includes(character.slug));
  return [...preferred, ...rest].slice(0, HOME_CHARACTER_COUNT);
}

// ── Historias ────────────────────────────────────────────────────────────────

export const STORIES_CARD_CAPTION = "Historias bíblicas en texto e imágenes";

// ── Encabezado ───────────────────────────────────────────────────────────────

/** Hora (0–23) en Honduras. */
export function hondurasHour(now = Date.now()): number {
  const hour = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: HONDURAS_TIME_ZONE }).format(
    new Date(now),
  );
  return Number(hour) % 24;
}

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** "viernes, 2 de octubre", en hora de Honduras. */
export function hondurasDate(now = Date.now()): string {
  return new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "long",
    timeZone: HONDURAS_TIME_ZONE,
    weekday: "long",
  }).format(new Date(now));
}
