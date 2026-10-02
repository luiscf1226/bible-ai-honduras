/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { PRAYER_TEXT_MAX_LENGTH } from "./prayers";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./prayers.ts": () => import("./prayers"),
  "./users.ts": () => import("./users"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

async function setup() {
  const t = convexTest(schema, modules);
  const ana = asUser(t, "user_ora_ana");
  const beto = asUser(t, "user_ora_beto");
  await ana.mutation(api.users.upsert, {});
  await beto.mutation(api.users.upsert, {});
  return { t, ana, beto };
}

describe("prayers (#159)", () => {
  it("crea, marca respondida con nota y borra", async () => {
    const { ana } = await setup();
    const id = await ana.mutation(api.prayers.create, {
      text: "  Por la salud de mi abuela  ",
      verse: { book: "Mateo", chapter: 11, verse: 28 },
    });
    let list = await ana.query(api.prayers.list, {});
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      text: "Por la salud de mi abuela",
      answeredAt: null,
      answerNote: null,
      verse: { book: "Mateo", chapter: 11, verse: 28 },
    });

    await ana.mutation(api.prayers.markAnswered, { id, note: "Salió bien de la operación" });
    list = await ana.query(api.prayers.list, {});
    expect(list[0]?.answeredAt).toEqual(expect.any(Number));
    expect(list[0]?.answerNote).toBe("Salió bien de la operación");

    await ana.mutation(api.prayers.remove, { id });
    expect(await ana.query(api.prayers.list, {})).toEqual([]);
  });

  it("la nota de respuesta es opcional, y reabrir la borra", async () => {
    const { ana } = await setup();
    const id = await ana.mutation(api.prayers.create, { text: "Por trabajo" });
    await ana.mutation(api.prayers.markAnswered, { id, note: "   " });
    expect((await ana.query(api.prayers.list, {}))[0]).toMatchObject({ answerNote: null, answeredAt: expect.any(Number) });

    await ana.mutation(api.prayers.markAnswered, { id, note: "Me llamaron" });
    await ana.mutation(api.prayers.reopen, { id });
    expect((await ana.query(api.prayers.list, {}))[0]).toMatchObject({ answeredAt: null, answerNote: null });
  });

  it("abiertas primero (la más nueva arriba) y después las respondidas", async () => {
    const { ana } = await setup();
    const vieja = await ana.mutation(api.prayers.create, { text: "vieja" });
    await ana.mutation(api.prayers.create, { text: "abierta" });
    await ana.mutation(api.prayers.markAnswered, { id: vieja });
    await ana.mutation(api.prayers.create, { text: "nueva" });
    const texts = (await ana.query(api.prayers.list, {})).map((item) => item.text);
    expect(texts).toEqual(["nueva", "abierta", "vieja"]);
  });

  it("valida el texto", async () => {
    const { ana } = await setup();
    await expect(ana.mutation(api.prayers.create, { text: "   " })).rejects.toThrow("vacía");
    await expect(ana.mutation(api.prayers.create, { text: "a".repeat(PRAYER_TEXT_MAX_LENGTH + 1) })).rejects.toThrow(
      String(PRAYER_TEXT_MAX_LENGTH),
    );
  });

  it("nadie ve, responde ni borra las peticiones de otra persona", async () => {
    const { t, ana, beto } = await setup();
    const id = await ana.mutation(api.prayers.create, { text: "De Ana" });
    expect(await beto.query(api.prayers.list, {})).toEqual([]);
    await expect(beto.mutation(api.prayers.markAnswered, { id })).rejects.toThrow("Petición no encontrada");
    await expect(beto.mutation(api.prayers.remove, { id })).rejects.toThrow("Petición no encontrada");
    expect(await ana.query(api.prayers.list, {})).toHaveLength(1);
    await expect(t.query(api.prayers.list, {})).resolves.toEqual([]);
    await expect(t.mutation(api.prayers.create, { text: "x" })).rejects.toThrow("No autenticado");
  });
});

describe("las peticiones nunca van a la IA (#159)", () => {
  // Código fuente de todo el backend, sin tests ni generados. Si un prompt
  // (qa, voces, sentir, historias, rag) empezara a leer la tabla, aparecería
  // acá y el test lo frena.
  const sources = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./_generated/**"], {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  it("solo convex/prayers.ts consulta la tabla prayerRequests", () => {
    // `ctx.db.query("prayerRequests")` y compañía: el nombre de la tabla entre comillas.
    const readers = Object.entries(sources)
      .filter(([, source]) => /["'`]prayerRequests["'`]/.test(source))
      .map(([path]) => path)
      .sort();
    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(readers).toEqual(["./prayers.ts"]);
  });
});
