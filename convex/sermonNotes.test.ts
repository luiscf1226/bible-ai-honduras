/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { cleanSermonNote, SERMON_NOTE_LIMITS, type SermonNoteInput } from "./sermonNotes";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./sermonNotes.ts": () => import("./sermonNotes"),
  "./history.ts": () => import("./history"),
  "./users.ts": () => import("./users"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

async function setup() {
  const t = convexTest(schema, modules);
  const ana = asUser(t, "user_sermon_ana");
  const beto = asUser(t, "user_sermon_beto");
  await ana.mutation(api.users.upsert, {});
  await beto.mutation(api.users.upsert, {});
  return { t, ana, beto };
}

const note = (overrides: Partial<SermonNoteInput> = {}): SermonNoteInput => ({
  clientId: "sn-test-0001",
  date: "2026-10-11",
  church: "  Iglesia Bethel ",
  preacher: "Pastor Daniel",
  title: "  Dios es nuestro amparo ",
  passages: [
    { book: "Salmos", chapter: 46, verse: 1 },
    { book: "Isaías", chapter: 41 },
  ],
  notes: "Refugio, fuerza, ayuda.",
  takeaway: "No tengo que esperar a que pase la tormenta.",
  ...overrides,
});

describe("notas de prédica (#232)", () => {
  it("guarda limpio y la lista devuelve lo mismo", async () => {
    const { ana } = await setup();
    const result = await ana.mutation(api.sermonNotes.save, note());
    expect(result.created).toBe(true);
    const list = await ana.query(api.sermonNotes.list, {});
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      clientId: "sn-test-0001",
      date: "2026-10-11",
      church: "Iglesia Bethel",
      preacher: "Pastor Daniel",
      title: "Dios es nuestro amparo",
      passages: [
        { book: "Salmos", chapter: 46, verse: 1 },
        { book: "Isaías", chapter: 41 },
      ],
    });
  });

  it("reenviar la misma nota (cola sin conexión) la actualiza, no la duplica", async () => {
    const { ana } = await setup();
    await ana.mutation(api.sermonNotes.save, note());
    const again = await ana.mutation(api.sermonNotes.save, note({ takeaway: "Otra cosa" }));
    expect(again.created).toBe(false);
    await ana.mutation(api.sermonNotes.save, note({ takeaway: "Otra cosa" }));
    const list = await ana.query(api.sermonNotes.list, {});
    expect(list).toHaveLength(1);
    expect(list[0]?.takeaway).toBe("Otra cosa");
  });

  it("la más reciente arriba, por fecha del culto", async () => {
    const { ana } = await setup();
    await ana.mutation(api.sermonNotes.save, note({ clientId: "sn-vieja-0001", date: "2026-09-27", title: "vieja" }));
    await ana.mutation(api.sermonNotes.save, note({ clientId: "sn-nueva-0001", date: "2026-10-11", title: "nueva" }));
    await ana.mutation(api.sermonNotes.save, note({ clientId: "sn-media-0001", date: "2026-10-04", title: "media" }));
    expect((await ana.query(api.sermonNotes.list, {})).map((item) => item.title)).toEqual(["nueva", "media", "vieja"]);
  });

  it("valida en el servidor el largo de cada campo, la fecha y los pasajes", async () => {
    const { ana } = await setup();
    await expect(ana.mutation(api.sermonNotes.save, note({ title: "a".repeat(SERMON_NOTE_LIMITS.title + 1) }))).rejects.toThrow(
      String(SERMON_NOTE_LIMITS.title),
    );
    await expect(ana.mutation(api.sermonNotes.save, note({ notes: "a".repeat(SERMON_NOTE_LIMITS.notes + 1) }))).rejects.toThrow(
      String(SERMON_NOTE_LIMITS.notes),
    );
    await expect(ana.mutation(api.sermonNotes.save, note({ takeaway: "a".repeat(SERMON_NOTE_LIMITS.takeaway + 1) }))).rejects.toThrow(
      String(SERMON_NOTE_LIMITS.takeaway),
    );
    await expect(ana.mutation(api.sermonNotes.save, note({ date: "11/10/2026" }))).rejects.toThrow("AAAA-MM-DD");
    await expect(ana.mutation(api.sermonNotes.save, note({ clientId: "x" }))).rejects.toThrow("identificador");
    await expect(ana.mutation(api.sermonNotes.save, note({ passages: [{ book: "Juan", chapter: 0 }] }))).rejects.toThrow("Pasaje");
    const many = Array.from({ length: SERMON_NOTE_LIMITS.passages + 1 }, (_, index) => ({ book: "Salmos", chapter: index + 1 }));
    await expect(ana.mutation(api.sermonNotes.save, note({ passages: many }))).rejects.toThrow(String(SERMON_NOTE_LIMITS.passages));
    await expect(
      ana.mutation(api.sermonNotes.save, note({ title: " ", passages: [], notes: "", takeaway: "" })),
    ).rejects.toThrow("vacía");
  });

  it("nadie ve ni borra las notas de otra persona; sin sesión no hay nada", async () => {
    const { t, ana, beto } = await setup();
    await ana.mutation(api.sermonNotes.save, note());
    expect(await beto.query(api.sermonNotes.list, {})).toEqual([]);
    // Mismo clientId desde otra cuenta: es otra nota, no pisa la de Ana.
    await beto.mutation(api.sermonNotes.save, note({ title: "De Beto" }));
    await beto.mutation(api.sermonNotes.remove, { clientId: "sn-test-0001" });
    expect((await ana.query(api.sermonNotes.list, {}))[0]?.title).toBe("Dios es nuestro amparo");
    await expect(t.query(api.sermonNotes.list, {})).resolves.toEqual([]);
    await expect(t.mutation(api.sermonNotes.save, note())).rejects.toThrow("No autenticado");
  });

  it("borrar es idempotente (se puede reenviar desde la cola)", async () => {
    const { ana } = await setup();
    await ana.mutation(api.sermonNotes.save, note());
    await ana.mutation(api.sermonNotes.remove, { clientId: "sn-test-0001" });
    await ana.mutation(api.sermonNotes.remove, { clientId: "sn-test-0001" });
    expect(await ana.query(api.sermonNotes.list, {})).toEqual([]);
  });

  it("«Borrar mi historial» se las lleva, solo las de esa persona", async () => {
    const { ana, beto } = await setup();
    await ana.mutation(api.sermonNotes.save, note());
    await ana.mutation(api.sermonNotes.save, note({ clientId: "sn-test-0002" }));
    await beto.mutation(api.sermonNotes.save, note({ title: "De Beto" }));
    const result = await ana.mutation(api.history.deleteAll, {});
    expect(result.deletedSermonNotes).toBe(2);
    expect(await ana.query(api.sermonNotes.list, {})).toEqual([]);
    expect(await beto.query(api.sermonNotes.list, {})).toHaveLength(1);
  });

  it("cleanSermonNote deja los pasajes sin versículo como capítulo entero", () => {
    expect(cleanSermonNote(note({ passages: [{ book: " Juan ", chapter: 3 }] })).passages).toEqual([{ book: "Juan", chapter: 3 }]);
  });
});

describe("las notas de prédica nunca van a la IA (#232, regla dura #4)", () => {
  // Código fuente de todo el backend, sin tests ni generados. Si un prompt
  // (qa, voces, sentir, historias, rag) empezara a leer la tabla, aparecería
  // acá y el test lo frena.
  const sources = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./_generated/**"], {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  it("solo convex/sermonNotes.ts consulta la tabla sermonNotes", () => {
    const readers = Object.entries(sources)
      .filter(([, source]) => /["'`]sermonNotes["'`]/.test(source))
      .map(([path]) => path)
      .sort();
    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(readers).toEqual(["./sermonNotes.ts"]);
  });
});
