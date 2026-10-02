import type { IconName } from "../../components/Icon";
import type { PassageQuery } from "../reading/bookSearch";
import type { Feeling } from "../feelings/feelings";

/**
 * Contenido y rutas del inicio en tarjetas (#193, design/oleada-ux.md §U1).
 * Todo lo que no es dibujo vive acá para poder testearlo sin renderizar:
 * el orden de las tarjetas, a dónde lleva cada chip y atajo, la pregunta de
 * ejemplo del día y las líneas de estado.
 */

/**
 * Orden exacto de las tarjetas del inicio (#193). Una tarjeta nueva entra acá y en `cards/index.ts`.
 * `season` es la franja de temporada (#199): solo se ve con temporada activa.
 */
export const HOME_CARD_ORDER = ["season", "verse", "read", "feeling", "ask", "characters", "stories"] as const;
export type HomeCardId = (typeof HOME_CARD_ORDER)[number];

/** Ruta en la forma que acepta `router.push`. */
export type HomeRoute = { pathname: string; params?: Record<string, string> };

export const HOME_ROUTES = {
  today: { pathname: "/hoy" },
  read: { pathname: "/leer" },
  feeling: { pathname: "/sentir" },
  ask: { pathname: "/preguntar" },
  characters: { pathname: "/voces" },
  stories: { pathname: "/historias" },
} as const satisfies Record<string, HomeRoute>;

// ── Leer la Biblia ───────────────────────────────────────────────────────────

export const READ_CARD_CAPTION = "Génesis a Apocalipsis, con tu separador y tus notas";

export type ReadChip = { id: string; label: string; icon: IconName; route: HomeRoute };

/** Lo que Leer ofrece además del lector, visible sin entrar (#193). */
export const READ_CHIPS: readonly ReadChip[] = [
  { id: "subrayados", label: "Subrayados", icon: "highlight", route: { pathname: "/leer/subrayados" } },
  { id: "guardados", label: "Guardados", icon: "bookmark", route: { pathname: "/leer/guardados" } },
  { id: "notas", label: "Notas", icon: "note", route: { pathname: "/leer/guardados", params: { filtro: "con-nota" } } },
  { id: "planes", label: "Planes", icon: "calendar", route: { pathname: "/leer/plan" } },
];

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

export const ASK_CARD_CAPTION = "Respuestas con cita, siempre desde el texto";

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
  return { pathname: "/preguntar/chat", params: { pregunta: question } };
}

type QuotaLike = { remaining: number; isPro: boolean } | null | undefined;

/** Línea de cuota de Preguntar. Solo lee `api.quotas.remaining` (regla dura #3). */
export function askQuotaLine(quota: QuotaLike): string | null {
  if (!quota) return null;
  if (quota.isPro) return "Pro · sin límite";
  if (quota.remaining <= 0) return "Ya usaste tus preguntas gratis de hoy";
  return quota.remaining === 1 ? "1 pregunta gratis hoy" : `${quota.remaining} preguntas gratis hoy`;
}

// ── Personajes ───────────────────────────────────────────────────────────────

export const CHARACTERS_CARD_CAPTION = "Conversá con Moisés, Ester, David…";
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

const HONDURAS_TIME_ZONE = "America/Tegucigalpa";

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
