import type { HomeRoute } from "../homeCards";

/**
 * Lo que la tarjeta "Hace un año guardaste…" (#172) necesita del guardado de
 * la semana. Lo elige el servidor (`api.savedMemory.thisWeek`): acá solo se
 * arma la ruta al lector y las líneas de texto, para testearlas sin renderizar.
 */
export type SavedMemoryLike = {
  book: string;
  chapter: number;
  verse: number;
  createdAt: number;
  version: string;
  text: string | null;
  note: string | null;
};

/** "Isaías 41:10". */
export function savedMemoryReference(memory: Pick<SavedMemoryLike, "book" | "chapter" | "verse">): string {
  return `${memory.book} ${memory.chapter}:${memory.verse}`;
}

/** Abre el lector en el capítulo, con la hoja de acciones del versículo (`openPassage`). */
export function savedMemoryRoute(memory: Pick<SavedMemoryLike, "book" | "chapter" | "verse">): HomeRoute {
  return {
    pathname: "/leer/[book]/[chapter]",
    params: { book: memory.book, chapter: String(memory.chapter), verse: String(memory.verse) },
  };
}

/** "1 de octubre de 2025", en el calendario de Honduras (la misma fecha que usa el selector). */
export function savedMemoryDate(createdAt: number): string {
  return new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "long",
    timeZone: "America/Tegucigalpa",
    year: "numeric",
  }).format(new Date(createdAt));
}

/**
 * Línea de abajo: referencia, versión y cuándo se guardó. Si el versículo no
 * está en el corpus la referencia ya va arriba en grande, así que no se repite.
 */
export function savedMemoryMeta(memory: SavedMemoryLike): string {
  const saved = `guardado el ${savedMemoryDate(memory.createdAt)}`;
  return memory.text === null
    ? `${memory.version} · ${saved}`
    : `${savedMemoryReference(memory)} · ${memory.version} · ${saved}`;
}

/** Nota sin espacios sobrantes; vacía cuenta como sin nota. */
export function savedMemoryNote(note: string | null): string | null {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
}
