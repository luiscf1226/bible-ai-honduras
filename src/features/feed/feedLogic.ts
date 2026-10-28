import type { FeedEntry, FeedItem, FeedReelItem, FeedReelSceneItem } from "../../../convex/verseFeed";
import { FEED_RECENT_GUARD, FEED_SEEN_MAX } from "../../../convex/verseFeedLimits";

/**
 * Feed de versículos (design/oleada-ux.md §Feed de versículos). Todo lo que no
 * es dibujo vive acá para poder testearlo sin renderizar: el tamaño de letra
 * según el largo, cómo se suman páginas, el ♥ optimista, el doble toque y el
 * texto para compartir.
 */
export type { FeedEntry, FeedItem, FeedReelItem, FeedReelSceneItem };

/** Historia contada o personaje (no un versículo). */
export function isReel(entry: FeedEntry): entry is FeedReelItem {
  return entry.kind !== "verse";
}

/** Lo que tienen en común un versículo y un reel para el ♥. */
type Likeable = { ref: string; liked: boolean; likes: number };

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
export function setLikeLocally<T extends Likeable>(items: readonly T[], ref: string, liked: boolean): T[] {
  return items.map((item) =>
    item.ref === ref && item.liked !== liked
      ? { ...item, liked, likes: Math.max(0, item.likes + (liked ? 1 : -1)) }
      : item,
  );
}

/** Deja el ♥ y la cuenta como los dejó el servidor (o como estaban, si falló). */
export function settleLike<T extends Likeable>(
  items: readonly T[],
  ref: string,
  result: { liked: boolean; likes: number },
): T[] {
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

/**
 * Cita para mostrar y compartir: "Filipenses 4:6-7 (RV1909)". Sale de los
 * versículos que de verdad se muestran (un rango largo puede venir acortado),
 * no del id del catálogo.
 */
export function feedReference(item: Pick<FeedItem, "book" | "chapter" | "verse" | "endVerse" | "version">): string {
  const verses = item.endVerse === null ? `${item.verse}` : `${item.verse}-${item.endVerse}`;
  return `${item.book} ${item.chapter}:${verses} (${item.version})`;
}

/** Mismo formato que compartir un versículo del lector (`shareVerse.ts`), con rangos. */
export function buildFeedShareText(
  item: Pick<FeedItem, "book" | "chapter" | "verse" | "endVerse" | "text" | "version">,
): string {
  return `"${feedVerseText(item.text)}"\n— ${feedReference(item)}`;
}

/** La voz suena solo con el feed a la vista, sin silencio y con una lectura ya generada. */
export function feedVoiceAction(state: {
  audioUrl: string | null;
  focused: boolean;
  muted: boolean;
}): "play" | "pause" {
  return state.audioUrl && state.focused && !state.muted ? "play" : "pause";
}

/** Cuántas pantallas antes del final se pide la próxima página. */
export const FEED_PREFETCH_AHEAD = 3;

/** Semilla nueva por cada vez que se abre el feed: nunca el mismo orden. */
export function newFeedSeed(now = Date.now(), random = Math.random): number {
  return (Math.floor(random() * 0x7fffffff) ^ now) >>> 0;
}

/**
 * Ritmo de lectura (el mismo con el que se estima la voz): cuánto queda una
 * parte de un reel en pantalla cuando no suena la voz (en silencio o sin voz
 * generada), para que alcance a leerse con calma.
 */
const READING_CHARS_PER_SECOND = 14;
const READING_PAD_MS = 1500;
const READING_MIN_MS = 4000;

export function reelReadingMs(text: string): number {
  return Math.max(READING_MIN_MS, Math.round((text.length / READING_CHARS_PER_SECOND) * 1000) + READING_PAD_MS);
}

/**
 * Con voz, la parte avanza cuando la voz termina. Si la voz no termina nunca
 * (no cargó, se cortó la red), este tope —holgado: una lectura muy lenta—
 * evita que el reel se quede trabado.
 */
export function reelVoiceTimeoutMs(text: string): number {
  return Math.round((text.length / 8) * 1000) + 5000;
}

/** La parte siguiente, o null si ya es la última (el reel se queda en ella, como un video que terminó). */
export function nextScene(reel: Pick<FeedReelItem, "scenes">, index: number): number | null {
  return index + 1 < reel.scenes.length ? index + 1 : null;
}

/** "HISTORIA · PARTE 2 DE 3" (una sola parte: "HISTORIA"). */
export function reelOverline(reel: Pick<FeedReelItem, "scenes">, index: number): string {
  return reel.scenes.length > 1 ? `HISTORIA · PARTE ${index + 1} DE ${reel.scenes.length}` : "HISTORIA";
}

/**
 * La cita debajo del texto. Las historias cuentan el pasaje con sus palabras
 * y los personajes hablan desde él: ninguno es el texto de RV1909 tal cual,
 * así que no llevan versión, y el personaje dice "Basado en".
 */
export function reelReference(reel: Pick<FeedReelItem, "kind">, scene: Pick<FeedReelSceneItem, "reference">): string {
  return reel.kind === "character" ? `Basado en ${scene.reference}` : scene.reference;
}

/** Texto para compartir la parte que se ve, con el mismo formato que un versículo. */
export function buildReelShareText(reel: Pick<FeedReelItem, "kind" | "title" | "scenes">, index: number): string {
  const scene = reel.scenes[Math.min(index, reel.scenes.length - 1)];
  const source =
    reel.kind === "character" ? `${reel.title}, basado en ${scene.reference}` : `${reel.title} (${scene.reference})`;
  return `"${scene.text}"\n— ${source}`;
}

/** La voz que suena: la del versículo, o la de la parte del reel que se ve. */
export function entryAudioUrl(entry: FeedEntry | undefined, sceneIndex: number): string | null {
  if (!entry) return null;
  if (!isReel(entry)) return entry.audioUrl;
  return entry.scenes[Math.min(sceneIndex, entry.scenes.length - 1)]?.audioUrl ?? null;
}

/** Todas las imágenes de una entrada, para precargarlas antes de que lleguen a la pantalla. */
export function entryImageUrls(entry: FeedEntry): string[] {
  return isReel(entry) ? entry.scenes.map((scene) => scene.imageUrl) : [entry.imageUrl];
}
