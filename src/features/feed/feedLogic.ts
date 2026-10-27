import type { FeedItem } from "../../../convex/verseFeed";
import { FEED_RECENT_GUARD, FEED_SEEN_MAX } from "../../../convex/verseFeedLimits";

/**
 * Feed de versículos (design/oleada-ux.md §Feed de versículos). Todo lo que no
 * es dibujo vive acá para poder testearlo sin renderizar: el tamaño de letra
 * según el largo, cómo se suman páginas, el ♥ optimista, el doble toque y el
 * texto para compartir.
 */
export type { FeedItem };

/** Tamaño del versículo: corto llena la pantalla, largo baja para entrar sin scroll. */
export type FeedVerseType = "verseFeed" | "verseHero" | "readerBody";

const SHORT_VERSE = 120;
const MEDIUM_VERSE = 240;

export function feedVerseType(text: string): FeedVerseType {
  if (text.length <= SHORT_VERSE) return "verseFeed";
  if (text.length <= MEDIUM_VERSE) return "verseHero";
  return "readerBody";
}

/**
 * RV1909 escribe en mayúsculas la primera palabra de cada capítulo ("ES pues
 * la fe…"): en el lector va con la letra capital, pero suelta en el feed se lee
 * como un grito. Solo se baja esa primera palabra; el resto queda tal cual.
 */
export function feedVerseText(text: string): string {
  return text.replace(
    /^([A-ZÁÉÍÓÚÑÜ])([A-ZÁÉÍÓÚÑÜ]+)(?=[\s,;:.!?]|$)/u,
    (_, first: string, rest: string) => first + rest.toLowerCase(),
  );
}

/**
 * Lo que se le manda al servidor como "ya visto en esta vuelta". Cuando el
 * servidor avisa que la página empieza otra vuelta (`newRound`), la lista
 * arranca de nuevo, pero con las últimas vistas adelante para que no vuelvan
 * enseguida.
 */
export function nextSeenRefs(seen: readonly string[], pageRefs: readonly string[], newRound: boolean): string[] {
  const base = newRound ? seen.slice(-FEED_RECENT_GUARD) : seen;
  return [...base, ...pageRefs].slice(-FEED_SEEN_MAX);
}

/** Clave de una pantalla: la misma cita puede volver en otra vuelta, así que va con su posición. */
export function feedItemKey(item: Pick<FeedItem, "ref">, index: number): string {
  return `${index}:${item.ref}`;
}

/** Deja el ♥ de una cita como se pidió; la cuenta cambia solo si el estado cambia. */
export function setLikeLocally(items: readonly FeedItem[], ref: string, liked: boolean): FeedItem[] {
  return items.map((item) =>
    item.ref === ref && item.liked !== liked
      ? { ...item, liked, likes: Math.max(0, item.likes + (liked ? 1 : -1)) }
      : item,
  );
}

/** Deja el ♥ y la cuenta como los dejó el servidor (o como estaban, si falló). */
export function settleLike(
  items: readonly FeedItem[],
  ref: string,
  result: { liked: boolean; likes: number },
): FeedItem[] {
  return items.map((item) => (item.ref === ref ? { ...item, ...result } : item));
}

/** "1.2 mil" a partir de mil (punto decimal, como en Honduras); antes, el número tal cual. Sin ♥ todavía, nada. */
export function formatLikes(likes: number): string {
  if (likes <= 0) return "";
  if (likes < 1000) return String(likes);
  return `${Math.floor(likes / 100) / 10} mil`;
}

/**
 * Doble toque: devuelve una función que se llama en cada toque con la hora y
 * responde `true` cuando ese toque completa un doble toque.
 */
export function createDoubleTapDetector(windowMs: number) {
  let last = -Infinity;
  return (now: number): boolean => {
    if (now - last <= windowMs) {
      last = -Infinity;
      return true;
    }
    last = now;
    return false;
  };
}

/** Cita para mostrar y compartir: "Filipenses 4:6-7 (RV1909)". */
export function feedReference(item: Pick<FeedItem, "ref" | "version">): string {
  return `${item.ref} (${item.version})`;
}

/** Mismo formato que compartir un versículo del lector (`shareVerse.ts`), con rangos. */
export function buildFeedShareText(item: Pick<FeedItem, "ref" | "text" | "version">): string {
  return `"${feedVerseText(item.text)}"\n— ${feedReference(item)}`;
}

/** Cuántas pantallas antes del final se pide la próxima página. */
export const FEED_PREFETCH_AHEAD = 3;

/** Semilla nueva por cada vez que se abre el feed: nunca el mismo orden. */
export function newFeedSeed(now = Date.now(), random = Math.random): number {
  return (Math.floor(random() * 0x7fffffff) ^ now) >>> 0;
}
