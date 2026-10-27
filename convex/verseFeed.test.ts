import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";
import { FEED_PAGE_SIZE, FEED_POOL } from "./verseFeedCore";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./verseFeed.ts": () => import("./verseFeed"),
  "./users.ts": () => import("./users"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

/** Carga en la Biblia de prueba el texto de todas las citas del catálogo (rangos incluidos). */
async function seedPool(t: ReturnType<typeof convexTest>, except: readonly string[] = []) {
  await t.run(async (ctx) => {
    const inserted = new Set<string>();
    for (const passage of FEED_POOL) {
      if (except.includes(passage.ref)) continue;
      for (let verse = passage.verse; verse <= (passage.endVerse ?? passage.verse); verse += 1) {
        const key = `${passage.book} ${passage.chapter}:${verse}`;
        if (inserted.has(key)) continue;
        inserted.add(key);
        await ctx.db.insert("verses", {
          version: "RV1909",
          book: passage.book,
          chapter: passage.chapter,
          verse,
          text: `${passage.book} ${passage.chapter}:${verse} texto`,
          embedding: [],
        });
      }
    }
  });
}

describe("verseFeed.page", () => {
  it("devuelve una página con el texto de la Biblia cargada, la cita y su foto", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);

    const page = await t.query(api.verseFeed.page, { seen: [], seed: 1 });

    expect(page).toHaveLength(FEED_PAGE_SIZE);
    for (const item of page) {
      expect(item.text).toContain(`${item.book} ${item.chapter}:${item.verse} texto`);
      expect(item.version).toBe("RV1909");
      expect(item.imageUrl).toMatch(/^https:\/\//);
      expect(item).toMatchObject({ liked: false, likes: 0 });
    }
  });

  it("un rango junta el texto de todos sus versículos", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);

    let range = null;
    for (let seed = 0; seed < 50 && !range; seed += 1) {
      const page = await t.query(api.verseFeed.page, { seen: [], seed });
      range = page.find((item) => item.endVerse !== null) ?? null;
    }

    expect(range).not.toBeNull();
    const { book, chapter, endVerse, verse } = range!;
    expect(range!.text).toBe(
      Array.from({ length: endVerse! - verse + 1 }, (_, index) => `${book} ${chapter}:${verse + index} texto`).join(" "),
    );
  });

  it("no muestra citas que no están en la Biblia cargada (nunca texto inventado)", async () => {
    const t = convexTest(schema, modules);
    // Citas que no comparten ningún versículo con las que sí se cargan (un rango puede cubrir a otra).
    const kept = FEED_POOL.slice(300);
    const covers = (a: (typeof FEED_POOL)[number], b: (typeof FEED_POOL)[number]) =>
      a.book === b.book && a.chapter === b.chapter && a.verse <= (b.endVerse ?? b.verse) && b.verse <= (a.endVerse ?? a.verse);
    const missing = FEED_POOL.slice(0, 300)
      .filter((passage) => !kept.some((other) => covers(other, passage)))
      .map((passage) => passage.ref);
    expect(missing.length).toBeGreaterThan(100);
    await seedPool(t, FEED_POOL.slice(0, 300).map((passage) => passage.ref));

    for (let seed = 0; seed < 5; seed += 1) {
      const page = await t.query(api.verseFeed.page, { seen: [], seed });
      expect(page.some((item) => missing.includes(item.ref))).toBe(false);
    }
  });

  it("no repite lo que ya se vio", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);
    const first = await t.query(api.verseFeed.page, { seen: [], seed: 9 });
    const second = await t.query(api.verseFeed.page, { seen: first.map((item) => item.ref), seed: 9 });
    expect(second.some((item) => first.some((seen) => seen.ref === item.ref))).toBe(false);
  });
});

describe("verseFeed.toggleLike", () => {
  it("da y quita ♥, y lleva la cuenta de la comunidad", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);
    const ana = asUser(t, "user_ana_feed");
    const beto = asUser(t, "user_beto_feed");
    await ana.mutation(api.users.upsert, {});
    await beto.mutation(api.users.upsert, {});
    const ref = FEED_POOL[0].ref;

    expect(await ana.mutation(api.verseFeed.toggleLike, { ref })).toEqual({ liked: true, likes: 1 });
    expect(await beto.mutation(api.verseFeed.toggleLike, { ref })).toEqual({ liked: true, likes: 2 });
    expect(await ana.mutation(api.verseFeed.toggleLike, { ref })).toEqual({ liked: false, likes: 1 });

    const stats = await t.run((ctx) => ctx.db.query("verseFeedStats").collect());
    expect(stats).toMatchObject([{ ref, likes: 1 }]);

    // Sin ♥, la cita no deja fila.
    await beto.mutation(api.verseFeed.toggleLike, { ref });
    expect(await t.run((ctx) => ctx.db.query("verseFeedStats").collect())).toHaveLength(0);
  });

  it("la página marca lo que la persona ya quiere", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);
    const ana = asUser(t, "user_ana_liked");
    await ana.mutation(api.users.upsert, {});
    const page = await ana.query(api.verseFeed.page, { seen: [], seed: 2 });
    await ana.mutation(api.verseFeed.toggleLike, { ref: page[0].ref });

    const again = await ana.query(api.verseFeed.page, { seen: [], seed: 2 });
    const liked = again.find((item) => item.ref === page[0].ref);
    // Lo ya marcado baja en el orden; si vuelve a salir, sale marcado.
    if (liked) expect(liked).toMatchObject({ liked: true, likes: 1 });
    expect(again.filter((item) => item.liked).every((item) => item.ref === page[0].ref)).toBe(true);
  });

  it("rechaza citas fuera del catálogo y pide sesión", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_ana_reject");
    await ana.mutation(api.users.upsert, {});
    await expect(ana.mutation(api.verseFeed.toggleLike, { ref: "Inventado 1:1" })).rejects.toThrow("Versículo desconocido");
    await expect(t.mutation(api.verseFeed.toggleLike, { ref: FEED_POOL[0].ref })).rejects.toThrow("No autenticado");
  });
});
