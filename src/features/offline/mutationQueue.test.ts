import { describe, expect, it } from "vitest";

import {
  acknowledge,
  actionKey,
  afterFailure,
  EMPTY_QUEUE,
  enqueue,
  forgetPendingNotes,
  MAX_SYNC_ATTEMPTS,
  mergeActions,
  overlayBookmarkPage,
  overlayChapterBookmarks,
  overlayChapterHighlights,
  overlayHighlightPage,
  overlayPlanProgress,
  overlaySeparator,
  restoreQueue,
  syncCallFor,
  type OfflineAction,
  type OfflineQueue,
} from "./mutationQueue";

const JUAN = { book: "Juan", chapter: 3, verse: 16 };
const SALMO = { book: "Salmos", chapter: 46, verse: 1 };

function queueOf(...actions: OfflineAction[]): OfflineQueue {
  return actions.reduce((queue, action, i) => enqueue(queue, action, 1000 + i), EMPTY_QUEUE);
}

describe("cola sin conexión — orden y última gana (#182)", () => {
  it("encola en orden y numera cada acción", () => {
    const queue = queueOf(
      { kind: "highlight", ref: JUAN, color: "amber" },
      { kind: "separator", ref: SALMO },
      { kind: "planDay", planId: "canonico", day: 3 },
    );
    expect(queue.items.map((item) => item.kind)).toEqual(["highlight", "separator", "planDay"]);
    expect(queue.items.map((item) => item.seq)).toEqual([1, 2, 3]);
  });

  it("dos acciones sobre lo mismo se juntan: gana la última y pasa al final", () => {
    const queue = queueOf(
      { kind: "highlight", ref: JUAN, color: "amber" },
      { kind: "separator", ref: SALMO },
      { kind: "highlight", ref: JUAN, color: "sage" },
    );
    expect(queue.items).toHaveLength(2);
    expect(queue.items[0].kind).toBe("separator");
    expect(queue.items[1]).toMatchObject({ kind: "highlight", color: "sage", seq: 3 });
  });

  it("subrayar y quitar el subrayado deja solo 'quitar'", () => {
    const queue = queueOf({ kind: "highlight", ref: JUAN, color: "amber" }, { kind: "highlight", ref: JUAN, color: null });
    expect(queue.items).toHaveLength(1);
    expect(syncCallFor(queue.items[0])).toEqual({ fn: "reading.clearHighlight", args: JUAN });
  });

  it("el separador es uno solo: moverlo dos veces manda solo el último lugar", () => {
    const queue = queueOf({ kind: "separator", ref: JUAN }, { kind: "separator", ref: SALMO });
    expect(queue.items).toHaveLength(1);
    expect(syncCallFor(queue.items[0])).toEqual({ fn: "reading.setSeparator", args: SALMO });
  });

  it("las llaves separan versículos, planes y días", () => {
    expect(actionKey({ kind: "bookmark", ref: JUAN, saved: true })).not.toBe(
      actionKey({ kind: "bookmark", ref: SALMO, saved: true }),
    );
    expect(actionKey({ kind: "planDay", planId: "a", day: 1 })).not.toBe(actionKey({ kind: "planDay", planId: "b", day: 1 }));
    expect(actionKey({ kind: "bookmark", ref: JUAN, saved: true })).not.toBe(
      actionKey({ kind: "highlight", ref: JUAN, color: null }),
    );
  });
});

describe("guardado y nota — juntar sin perder el sentido", () => {
  const save = (note?: string | null): OfflineAction =>
    note === undefined ? { kind: "bookmark", ref: JUAN, saved: true } : { kind: "bookmark", ref: JUAN, saved: true, note };
  const remove: OfflineAction = { kind: "bookmark", ref: JUAN, saved: false };

  it("guardar y después anotar = guardar con nota", () => {
    expect(mergeActions(save(), save("Lo predicó el pastor"))).toEqual(save("Lo predicó el pastor"));
  });

  it("anotar y después tocar 'Guardar' de nuevo no borra la nota", () => {
    expect(mergeActions(save("Mi nota"), save())).toEqual(save("Mi nota"));
  });

  it("quitar siempre gana y se lleva la nota", () => {
    expect(mergeActions(save("Mi nota"), remove)).toEqual(remove);
  });

  it("quitar y volver a guardar termina sin nota (el servidor la habría borrado)", () => {
    expect(mergeActions(remove, save())).toEqual(save(null));
  });

  it("cada estado manda la mutación repetible que corresponde", () => {
    expect(syncCallFor(save())).toEqual({ fn: "reading.saveBookmark", args: JUAN });
    expect(syncCallFor(save("x"))).toEqual({ fn: "reading.saveBookmark", args: { ...JUAN, note: "x" } });
    expect(syncCallFor(save(null))).toEqual({ fn: "reading.saveBookmark", args: { ...JUAN, note: "" } });
    expect(syncCallFor(remove)).toEqual({ fn: "reading.removeBookmark", args: JUAN });
    expect(syncCallFor({ kind: "separator", ref: null })).toEqual({ fn: "reading.clearSeparator", args: {} });
    expect(syncCallFor({ kind: "planDay", planId: "canonico", day: 4 })).toEqual({
      fn: "readingPlans.markDayRead",
      args: { planId: "canonico", day: 4 },
    });
  });

  it("'Borrar mi historial' olvida las notas en cola pero deja el guardado", () => {
    const queue = forgetPendingNotes(queueOf(save("privada"), { kind: "bookmark", ref: SALMO, saved: true, note: null }));
    expect(syncCallFor(queue.items[0])).toEqual({ fn: "reading.saveBookmark", args: JUAN });
    expect(syncCallFor(queue.items[1])).toEqual({ fn: "reading.saveBookmark", args: { ...SALMO, note: "" } });
  });
});

describe("envío y fallos", () => {
  it("confirmar saca solo esa acción; si cambió mientras viajaba, la nueva se queda", () => {
    let queue = queueOf({ kind: "highlight", ref: JUAN, color: "amber" });
    const inFlight = queue.items[0].seq;
    queue = enqueue(queue, { kind: "highlight", ref: JUAN, color: "clay" }, 2000);
    queue = acknowledge(queue, inFlight);
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({ color: "clay" });
  });

  it("un error de validación del servidor se descarta: no traba la cola", () => {
    const queue = queueOf({ kind: "planDay", planId: "canonico", day: 1 }, { kind: "separator", ref: JUAN });
    const error = Object.assign(new Error("Ese plan no está empezado"), { name: "ConvexError", data: "Ese plan no está empezado" });
    const next = afterFailure(queue, queue.items[0].seq, error);
    expect(next.items.map((item) => item.kind)).toEqual(["separator"]);
  });

  it("sin sesión todavía se reintenta, y cualquier otro error también, hasta un tope", () => {
    let queue = queueOf({ kind: "separator", ref: JUAN });
    const seq = queue.items[0].seq;
    const noAuth = Object.assign(new Error("No autenticado"), { name: "ConvexError", data: "No autenticado" });
    queue = afterFailure(queue, seq, noAuth);
    expect(queue.items[0].attempts).toBe(1);
    for (let i = 1; i < MAX_SYNC_ATTEMPTS; i += 1) queue = afterFailure(queue, seq, new Error("Server Error"));
    expect(queue.items).toHaveLength(0);
  });

  it("una cola guardada rota o vieja se lee como vacía, sin reventar", () => {
    expect(restoreQueue(null)).toEqual(EMPTY_QUEUE);
    expect(restoreQueue({ items: "x" })).toEqual(EMPTY_QUEUE);
    const saved = queueOf({ kind: "separator", ref: JUAN });
    expect(restoreQueue(JSON.parse(JSON.stringify({ ...saved, userId: "u1" })))).toEqual({ ...saved, userId: "u1" });
    expect(restoreQueue({ nextSeq: 3, items: [{ kind: "otra", seq: 1 }] }).items).toEqual([]);
  });
});

describe("lo que se ve: servidor + cola", () => {
  it("guardados del capítulo: guardar, anotar y quitar se ven al instante", () => {
    const server = [{ verse: 16, note: null }, { verse: 17, note: "vieja" }];
    const items = [
      { kind: "bookmark", ref: { ...JUAN, verse: 18 }, saved: true },
      { kind: "bookmark", ref: { ...JUAN, verse: 16 }, saved: true, note: "nueva" },
      { kind: "bookmark", ref: { ...JUAN, verse: 17 }, saved: false },
      { kind: "bookmark", ref: SALMO, saved: false },
    ] satisfies OfflineAction[];
    expect(overlayChapterBookmarks(server, items, "Juan", 3)).toEqual([
      { verse: 16, note: "nueva" },
      { verse: 18, note: null },
    ]);
    expect(overlayChapterBookmarks(undefined, [], "Juan", 3)).toBeUndefined();
    // Sin datos del servidor (sin señal, nunca abierto) igual se ve lo de la cola.
    expect(overlayChapterBookmarks(undefined, items, "Juan", 3)).toEqual([
      { verse: 16, note: "nueva" },
      { verse: 18, note: null },
    ]);
  });

  it("subrayados del capítulo", () => {
    const server = [{ verse: 16, color: "amber" as const }];
    const items: OfflineAction[] = [
      { kind: "highlight", ref: JUAN, color: "sage" },
      { kind: "highlight", ref: { ...JUAN, verse: 1 }, color: "clay" },
    ];
    expect(overlayChapterHighlights(server, items, "Juan", 3)).toEqual([
      { verse: 1, color: "clay" },
      { verse: 16, color: "sage" },
    ]);
    expect(overlayChapterHighlights(server, [{ kind: "highlight", ref: JUAN, color: null }], "Juan", 3)).toEqual([]);
  });

  it("separador: la cola manda sobre el servidor, también para quitarlo", () => {
    const server = { ...JUAN, updatedAt: 1 };
    expect(overlaySeparator(server, [])).toBe(server);
    expect(overlaySeparator(server, [{ kind: "separator", ref: SALMO }])).toEqual(SALMO);
    expect(overlaySeparator(server, [{ kind: "separator", ref: null }])).toBeNull();
  });

  it("listas con texto: lo quitado desaparece y baja el total; la nota y el color cambian", () => {
    const bookmarks = { total: 5, items: [{ ...JUAN, note: null }, { ...SALMO, note: "x" }] };
    expect(
      overlayBookmarkPage(bookmarks, [
        { kind: "bookmark", ref: JUAN, saved: false },
        { kind: "bookmark", ref: SALMO, saved: true, note: "y" },
      ]),
    ).toEqual({ total: 4, items: [{ ...SALMO, note: "y" }] });

    const highlights = { total: 2, items: [{ ...JUAN, color: "amber" as const }, { ...SALMO, color: "sage" as const }] };
    expect(
      overlayHighlightPage(highlights, [
        { kind: "highlight", ref: JUAN, color: "clay" },
        { kind: "highlight", ref: SALMO, color: null },
      ]),
    ).toEqual({ total: 1, items: [{ ...JUAN, color: "clay" }] });
    expect(overlayBookmarkPage(undefined, [])).toBeUndefined();
  });

  it("plan: marcar hoy y un día atrasado se ve tachado al instante", () => {
    const progress = {
      plan: { id: "canonico" },
      currentDay: 5,
      todayCompleted: false,
      completedCount: 2,
      pendingDays: [{ day: 3 }, { day: 4 }],
    };
    const result = overlayPlanProgress(progress, [
      { kind: "planDay", planId: "canonico", day: 5 },
      { kind: "planDay", planId: "canonico", day: 3 },
      { kind: "planDay", planId: "otro", day: 4 },
    ]);
    expect(result).toEqual({ ...progress, todayCompleted: true, completedCount: 4, pendingDays: [{ day: 4 }] });
    // Marcar algo ya marcado no suma dos veces.
    expect(overlayPlanProgress({ ...progress, todayCompleted: true }, [{ kind: "planDay", planId: "canonico", day: 5 }])).toMatchObject({
      completedCount: 2,
    });
    expect(overlayPlanProgress(null, [])).toBeNull();
  });
});
