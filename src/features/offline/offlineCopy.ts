import { formatBytes } from "../../../convex/offlineBiblePackage";
import type { BibleDownloadState, DownloadProgress } from "./bibleDownload";

/**
 * Textos de la Biblia sin conexión (#160) y de la cola (#182). Puros, para
 * probar cada estado sin levantar pantallas.
 */

/**
 * Sin conexión de verdad: solo cuando NetInfo lo afirma. `null` (todavía no
 * sabe, pasa al abrir la app) cuenta como con conexión, para no mostrar
 * "sin señal" de más.
 */
export function isOfflineNetState(state: { isConnected: boolean | null; isInternetReachable?: boolean | null }): boolean {
  return state.isConnected === false || state.isInternetReachable === false;
}

export type BibleRowCopy = { hint: string; glyph: string; actionable: boolean };

/** Fila "Leer sin conexión" de Ajustes. */
export function bibleRowCopy(input: {
  state: BibleDownloadState;
  downloading: DownloadProgress | null;
  failed: boolean;
  online: boolean;
  version: string;
  /** undefined = cargando; 0 = el servidor todavía no armó los paquetes. */
  totalBytes: number | undefined;
}): BibleRowCopy {
  const { state, downloading, failed, online, version, totalBytes } = input;
  if (downloading) {
    return { hint: `Descargando… ${downloading.done} de ${downloading.total} libros`, glyph: "…", actionable: false };
  }
  if (state.kind === "ready") {
    return {
      hint: `Descargada · ${formatBytes(state.bytes)}. El lector y los planes funcionan sin señal.`,
      glyph: "✓",
      actionable: true,
    };
  }
  if (state.kind === "update") {
    return online
      ? { hint: `Hay correcciones del texto en ${state.pending} ${state.pending === 1 ? "libro" : "libros"}. Tocá para bajarlas.`, glyph: "↓", actionable: true }
      : { hint: `Descargada · ${formatBytes(state.bytes)}. El lector y los planes funcionan sin señal.`, glyph: "✓", actionable: true };
  }
  if (!online) {
    return state.kind === "partial"
      ? { hint: `Se quedó en ${state.done} de ${state.total} libros. Sigue cuando vuelva la señal.`, glyph: "↓", actionable: false }
      : { hint: "Necesitás conexión para descargarla. Mejor con wifi.", glyph: "↓", actionable: false };
  }
  if (state.kind === "partial" || failed) {
    const progress = state.kind === "partial" ? ` (${state.done} de ${state.total} libros)` : "";
    return { hint: `Se cortó la descarga${progress}. Tocá para seguir donde quedó.`, glyph: "↓", actionable: true };
  }
  if (totalBytes === undefined) return { hint: "Calculando el tamaño…", glyph: "↓", actionable: false };
  if (totalBytes === 0) return { hint: "La descarga todavía no está lista. Probá más tarde.", glyph: "↓", actionable: false };
  return {
    hint: `Descargá la ${version} (${formatBytes(totalBytes)}) para leer sin datos. Mejor con wifi.`,
    glyph: "↓",
    actionable: true,
  };
}

export const REMOVE_BIBLE_TITLE = "¿Quitar la Biblia descargada?";
export const REMOVE_BIBLE_BODY =
  "Libera espacio en tu teléfono. Vas a poder leer igual con conexión, y descargarla de nuevo cuando querás.";

export type OnlineOnlyModule = "qa" | "voices" | "feelings" | "stories";

const MODULE_NEED: Record<OnlineOnlyModule, string> = {
  qa: "Preguntar necesita internet para buscar en la Biblia y responderte.",
  voices: "Voces necesita internet para que el personaje te responda desde la Biblia.",
  feelings: "Sentir necesita internet para buscarte un pasaje y una oración.",
  stories: "Historias necesita internet para traer las historias y sus ilustraciones.",
};

/** Pantalla de Preguntar, Voces, Sentir e Historias cuando no hay señal. */
export function offlineModuleCopy(module: OnlineOnlyModule, bibleDownloaded: boolean) {
  return {
    title: "Sin conexión",
    body:
      `${MODULE_NEED[module]} Cuando vuelva la señal, probá de nuevo. ` +
      (bibleDownloaded
        ? "Mientras tanto, la Biblia que descargaste se lee sin datos."
        : "Mientras tanto, podés descargar la Biblia en Ajustes para leer sin datos la próxima vez."),
    cta: "Ir a leer",
  };
}

/** Aviso del lector sin señal: lo personal se guarda igual. */
export const READER_OFFLINE_NOTE = "Sin conexión. Lo que guardés, subrayés o anotés se envía cuando vuelva la señal.";

/** El capítulo no está en el teléfono y no hay señal para pedirlo. */
export const READER_CHAPTER_UNAVAILABLE =
  "Sin conexión y este capítulo no está en tu teléfono. Descargá la Biblia en Ajustes para leer sin datos.";

/** El plan nunca se abrió con señal en este teléfono. */
export const PLAN_UNAVAILABLE_OFFLINE = "Sin conexión. Abrí tu plan una vez con señal y después vas a poder marcarlo sin datos.";
