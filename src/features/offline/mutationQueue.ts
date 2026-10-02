import type { HighlightColor } from "../reading/highlightColors";

/**
 * Cola sin conexión de lo personal del lector (#182): guardar / quitar,
 * subrayar / quitar, separador, nota y marcar el día del plan.
 *
 * Lógica pura, sin React: la usa `OfflineSyncProvider` y se prueba sola.
 *
 * Reglas:
 * - **Toda** acción entra a la cola, con o sin señal. La pantalla se pinta con
 *   lo del servidor + lo que está en la cola (`overlay*`), así se ve al
 *   instante y no hay dos caminos distintos para "con red" y "sin red".
 * - Cada acción dice el estado final ("guardado", "subrayado en ámbar"), no
 *   "alternar": mandarla dos veces da lo mismo, y si se reenvía después de un
 *   cierre de la app no deshace nada.
 * - Dos acciones sobre lo mismo (el mismo versículo, el separador, el mismo
 *   día del plan) se juntan en una: **gana la última**. La que queda se mueve
 *   al final, así la cola se manda en el orden en que la persona terminó de
 *   decidir.
 * - Nada de esto pasa por `convex/quotas.ts`: leer y anotar es gratis.
 */

export type VerseRef = { book: string; chapter: number; verse: number };

export type OfflineAction =
  /** `note` ausente = no tocar la nota; null = borrarla; texto = reemplazarla. */
  | { kind: "bookmark"; ref: VerseRef; saved: boolean; note?: string | null }
  | { kind: "highlight"; ref: VerseRef; color: HighlightColor | null }
  | { kind: "separator"; ref: VerseRef | null }
  | { kind: "planDay"; planId: string; day: number };

export type QueuedAction = OfflineAction & { seq: number; queuedAt: number; attempts: number };

export type OfflineQueue = {
  /** Dueño de la cola: si cambia la sesión, la cola de otra cuenta no se manda. */
  userId: string | null;
  nextSeq: number;
  items: QueuedAction[];
};

export const EMPTY_QUEUE: OfflineQueue = { userId: null, nextSeq: 1, items: [] };

/** Intentos antes de descartar una acción que el servidor rechaza siempre. */
export const MAX_SYNC_ATTEMPTS = 5;

const refKey = (ref: VerseRef) => `${ref.book}|${ref.chapter}|${ref.verse}`;

export function actionKey(action: OfflineAction): string {
  switch (action.kind) {
    case "bookmark":
      return `bookmark:${refKey(action.ref)}`;
    case "highlight":
      return `highlight:${refKey(action.ref)}`;
    case "separator":
      return "separator";
    case "planDay":
      return `planDay:${action.planId}|${action.day}`;
  }
}

/**
 * Junta dos acciones sobre lo mismo. Solo el guardado necesita cuidado: quitar
 * borra la nota en el servidor, así que "quitar y volver a guardar" tiene que
 * terminar sin nota aunque la segunda acción no la mencione.
 */
export function mergeActions(previous: OfflineAction, next: OfflineAction): OfflineAction {
  if (previous.kind !== "bookmark" || next.kind !== "bookmark") return next;
  if (!next.saved) return { kind: "bookmark", ref: next.ref, saved: false };
  if (next.note !== undefined) return next;
  if (!previous.saved) return { kind: "bookmark", ref: next.ref, saved: true, note: null };
  return previous.note === undefined
    ? { kind: "bookmark", ref: next.ref, saved: true }
    : { kind: "bookmark", ref: next.ref, saved: true, note: previous.note };
}

function stripMeta(item: QueuedAction): OfflineAction {
  const { seq: _seq, queuedAt: _queuedAt, attempts: _attempts, ...action } = item;
  return action as OfflineAction;
}

export function enqueue(queue: OfflineQueue, action: OfflineAction, now: number): OfflineQueue {
  const key = actionKey(action);
  const existing = queue.items.find((item) => actionKey(item) === key);
  const merged = existing ? mergeActions(stripMeta(existing), action) : action;
  return {
    ...queue,
    nextSeq: queue.nextSeq + 1,
    items: [
      ...queue.items.filter((item) => item !== existing),
      { ...merged, seq: queue.nextSeq, queuedAt: now, attempts: 0 },
    ],
  };
}

/**
 * Saca de la cola la acción que el servidor ya confirmó. Si mientras viajaba
 * la persona la cambió (otro `seq` con la misma llave), la nueva se queda.
 */
export function acknowledge(queue: OfflineQueue, seq: number): OfflineQueue {
  return { ...queue, items: queue.items.filter((item) => item.seq !== seq) };
}

/** Errores que no se arreglan reintentando (validación, plan sin empezar). */
export function isPermanentSyncError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const named = error as { name?: unknown; data?: unknown; message?: unknown };
  if (named.name !== "ConvexError" && !("data" in named)) return false;
  // Sin sesión todavía (la red volvió antes que el token): se reintenta.
  const text = typeof named.data === "string" ? named.data : String(named.message ?? "");
  return !text.includes("No autenticado");
}

/**
 * Después de un fallo: lo permanente se descarta; lo demás suma un intento y
 * se descarta al llegar a `MAX_SYNC_ATTEMPTS` para no trabar la cola entera.
 */
export function afterFailure(queue: OfflineQueue, seq: number, error: unknown): OfflineQueue {
  if (isPermanentSyncError(error)) return acknowledge(queue, seq);
  return {
    ...queue,
    items: queue.items.flatMap((item) => {
      if (item.seq !== seq) return [item];
      const attempts = item.attempts + 1;
      return attempts >= MAX_SYNC_ATTEMPTS ? [] : [{ ...item, attempts }];
    }),
  };
}

/**
 * "Borrar mi historial" borra las notas en el servidor (#167). Una nota que
 * todavía estaba en la cola no puede reaparecer después: se olvida, y el
 * guardado (que no es historial) sigue en la cola.
 */
export function forgetPendingNotes(queue: OfflineQueue): OfflineQueue {
  return {
    ...queue,
    items: queue.items.map((item) =>
      item.kind === "bookmark" && typeof item.note === "string" ? { ...item, note: undefined } : item,
    ),
  };
}

/** La cola guardada en el teléfono, validada: un archivo raro es una cola vacía. */
export function restoreQueue(raw: unknown): OfflineQueue {
  if (typeof raw !== "object" || raw === null) return EMPTY_QUEUE;
  const value = raw as Partial<OfflineQueue>;
  if (!Array.isArray(value.items) || typeof value.nextSeq !== "number") return EMPTY_QUEUE;
  const items = value.items.filter(
    (item): item is QueuedAction =>
      typeof item === "object" &&
      item !== null &&
      typeof item.seq === "number" &&
      ["bookmark", "highlight", "separator", "planDay"].includes(item.kind),
  );
  return { userId: typeof value.userId === "string" ? value.userId : null, nextSeq: value.nextSeq, items };
}

/** Qué mutación de Convex manda cada acción (nombre dentro de su módulo + args). */
export type SyncCall =
  | { fn: "reading.saveBookmark"; args: VerseRef & { note?: string } }
  | { fn: "reading.removeBookmark"; args: VerseRef }
  | { fn: "reading.setHighlight"; args: VerseRef & { color: HighlightColor } }
  | { fn: "reading.clearHighlight"; args: VerseRef }
  | { fn: "reading.setSeparator"; args: VerseRef }
  | { fn: "reading.clearSeparator"; args: Record<string, never> }
  | { fn: "readingPlans.markDayRead"; args: { planId: string; day: number } };

export function syncCallFor(action: OfflineAction): SyncCall {
  switch (action.kind) {
    case "bookmark": {
      const ref = { book: action.ref.book, chapter: action.ref.chapter, verse: action.ref.verse };
      if (!action.saved) return { fn: "reading.removeBookmark", args: ref };
      return action.note === undefined
        ? { fn: "reading.saveBookmark", args: ref }
        : { fn: "reading.saveBookmark", args: { ...ref, note: action.note ?? "" } };
    }
    case "highlight": {
      const ref = { book: action.ref.book, chapter: action.ref.chapter, verse: action.ref.verse };
      return action.color === null
        ? { fn: "reading.clearHighlight", args: ref }
        : { fn: "reading.setHighlight", args: { ...ref, color: action.color } };
    }
    case "separator":
      return action.ref === null
        ? { fn: "reading.clearSeparator", args: {} }
        : { fn: "reading.setSeparator", args: { book: action.ref.book, chapter: action.ref.chapter, verse: action.ref.verse } };
    case "planDay":
      return { fn: "readingPlans.markDayRead", args: { planId: action.planId, day: action.day } };
  }
}

// ── Lo que se ve: servidor + cola ─────────────────────────────────────────

const sameRef = (a: VerseRef, b: VerseRef) => a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;

/** Guardados de un capítulo, como `reading:chapterBookmarks`. */
export function overlayChapterBookmarks(
  server: ReadonlyArray<{ verse: number; note: string | null }> | undefined,
  items: readonly OfflineAction[],
  book: string,
  chapter: number,
): Array<{ verse: number; note: string | null }> | undefined {
  const relevant = items.filter(
    (item): item is Extract<OfflineAction, { kind: "bookmark" }> =>
      item.kind === "bookmark" && item.ref.book === book && item.ref.chapter === chapter,
  );
  if (server === undefined && relevant.length === 0) return undefined;
  const byVerse = new Map((server ?? []).map((row) => [row.verse, row]));
  for (const action of relevant) {
    if (!action.saved) {
      byVerse.delete(action.ref.verse);
    } else {
      const previous = byVerse.get(action.ref.verse);
      byVerse.set(action.ref.verse, {
        verse: action.ref.verse,
        note: action.note === undefined ? (previous?.note ?? null) : action.note,
      });
    }
  }
  return [...byVerse.values()].sort((a, b) => a.verse - b.verse);
}

/** Subrayados de un capítulo, como `reading:highlightsForChapter`. */
export function overlayChapterHighlights(
  server: ReadonlyArray<{ verse: number; color: HighlightColor }> | undefined,
  items: readonly OfflineAction[],
  book: string,
  chapter: number,
): Array<{ verse: number; color: HighlightColor }> | undefined {
  const relevant = items.filter(
    (item): item is Extract<OfflineAction, { kind: "highlight" }> =>
      item.kind === "highlight" && item.ref.book === book && item.ref.chapter === chapter,
  );
  if (server === undefined && relevant.length === 0) return undefined;
  const byVerse = new Map((server ?? []).map((row) => [row.verse, row]));
  for (const action of relevant) {
    if (action.color === null) byVerse.delete(action.ref.verse);
    else byVerse.set(action.ref.verse, { verse: action.ref.verse, color: action.color });
  }
  return [...byVerse.values()].sort((a, b) => a.verse - b.verse);
}

/** El separador, como `reading:separator`. */
export function overlaySeparator(
  server: (VerseRef & { updatedAt?: number }) | null | undefined,
  items: readonly OfflineAction[],
): (VerseRef & { updatedAt?: number }) | null | undefined {
  const last = [...items].reverse().find((item) => item.kind === "separator");
  if (!last || last.kind !== "separator") return server;
  return last.ref;
}

type ListPage<T> = { total: number; items: T[] };

/**
 * Listas con texto (Guardados, Subrayados, vista previa de Leer): lo quitado
 * desaparece y la nota o el color cambian al instante. Lo recién guardado sin
 * conexión aparece cuando vuelve la red, porque el texto viene del servidor.
 */
export function overlayBookmarkPage<T extends VerseRef & { note: string | null }>(
  page: ListPage<T> | undefined,
  items: readonly OfflineAction[],
): ListPage<T> | undefined {
  if (!page) return page;
  let removed = 0;
  const next = page.items.flatMap((row) => {
    const action = [...items]
      .reverse()
      .find((item): item is Extract<OfflineAction, { kind: "bookmark" }> => item.kind === "bookmark" && sameRef(item.ref, row));
    if (!action) return [row];
    if (!action.saved) {
      removed += 1;
      return [];
    }
    return action.note === undefined ? [row] : [{ ...row, note: action.note }];
  });
  return { total: Math.max(0, page.total - removed), items: next };
}

export function overlayHighlightPage<T extends VerseRef & { color: HighlightColor }>(
  page: ListPage<T> | undefined,
  items: readonly OfflineAction[],
): ListPage<T> | undefined {
  if (!page) return page;
  let removed = 0;
  const next = page.items.flatMap((row) => {
    const action = [...items]
      .reverse()
      .find((item): item is Extract<OfflineAction, { kind: "highlight" }> => item.kind === "highlight" && sameRef(item.ref, row));
    if (!action) return [row];
    if (action.color === null) {
      removed += 1;
      return [];
    }
    return [{ ...row, color: action.color }];
  });
  return { total: Math.max(0, page.total - removed), items: next };
}

type PlanProgressLike = {
  plan: { id: string };
  currentDay: number;
  todayCompleted: boolean;
  completedCount: number;
  pendingDays: Array<{ day: number }>;
};

/** Progreso de un plan con los días marcados sin conexión ya tachados. */
export function overlayPlanProgress<T extends PlanProgressLike>(
  progress: T | null | undefined,
  items: readonly OfflineAction[],
): T | null | undefined {
  if (!progress) return progress;
  const marked = new Set(
    items
      .filter((item): item is Extract<OfflineAction, { kind: "planDay" }> => item.kind === "planDay" && item.planId === progress.plan.id)
      .map((item) => item.day),
  );
  if (marked.size === 0) return progress;
  const todayNewlyDone = !progress.todayCompleted && marked.has(progress.currentDay);
  const pendingDays = progress.pendingDays.filter((entry) => !marked.has(entry.day));
  const caughtUp = progress.pendingDays.length - pendingDays.length;
  return {
    ...progress,
    todayCompleted: progress.todayCompleted || todayNewlyDone,
    pendingDays,
    completedCount: progress.completedCount + caughtUp + (todayNewlyDone ? 1 : 0),
  };
}
