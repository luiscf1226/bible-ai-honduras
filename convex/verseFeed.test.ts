import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";
import type { FeedEntry, FeedItem, FeedReelItem } from "./verseFeed";
import { textHash } from "./verseFeedText";
import { REEL_POOL } from "./feedReelsCore";
import { FEED_PAGE_SIZE, FEED_POOL, FEED_RECENT_GUARD } from "./verseFeedCore";
import { FEED_REEL_SLOTS } from "./verseFeedLimits";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./verseFeed.ts": () => import("./verseFeed"),
  "./users.ts": () => import("./users"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({
    subject: clerkId,
    issuer: "https://example-dev.clerk.accounts.dev",
  });
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

/** Sin `withReels` la página es solo de versículos (las versiones de la app que ya están en la tienda). */
function verses(items: FeedEntry[]): FeedItem[] {
  if (items.some((item) => item.kind !== "verse")) throw new Error("La página trajo reels sin pedirlos");
  return items as FeedItem[];
}

async function versePage(t: { query: ReturnType<typeof convexTest>["query"] }, args: { seen: string[]; seed: number }) {
  const result = await t.query(api.verseFeed.page, args);
  return { ...result, items: verses(result.items) };
}

async function pageItems(t: { query: ReturnType<typeof convexTest>["query"] }, seen: string[], seed: number) {
  return (await versePage(t, { seen, seed })).items;
}

describe("verseFeed.page", () => {
  it("devuelve una página con el texto de la Biblia cargada, la cita y su foto", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);

    const { items, newRound } = await versePage(t, { seen: [], seed: 1 });

    expect(newRound).toBe(false);
    expect(items).toHaveLength(FEED_PAGE_SIZE);
    for (const item of items) {
      expect(item.text).toContain(`${item.book} ${item.chapter}:${item.verse} texto`);
      expect(item.version).toBe("RV1909");
      expect(item.imageUrl).toMatch(/^https:\/\//);
      expect(item).toMatchObject({ liked: false, likes: 0 });
    }
  });

  it("un rango corto junta el texto de todos sus versículos", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);

    let range = null;
    for (let seed = 0; seed < 50 && !range; seed += 1) {
      range = (await pageItems(t, [], seed)).find((item) => item.endVerse !== null) ?? null;
    }

    expect(range).not.toBeNull();
    const { book, chapter, endVerse, verse } = range!;
    const expected = Array.from(
      { length: endVerse! - verse + 1 },
      (_, index) => `${book} ${chapter}:${verse + index} texto`,
    );
    expect(range!.text).toBe(expected.join(" "));
  });

  it("no muestra citas que no están en la Biblia cargada, y la página igual sale llena", async () => {
    const t = convexTest(schema, modules);
    // Citas que no comparten ningún versículo con las que sí se cargan (un rango puede cubrir a otra).
    const kept = FEED_POOL.slice(60);
    const covers = (a: (typeof FEED_POOL)[number], b: (typeof FEED_POOL)[number]) =>
      a.book === b.book &&
      a.chapter === b.chapter &&
      a.verse <= (b.endVerse ?? b.verse) &&
      b.verse <= (a.endVerse ?? a.verse);
    const missing = FEED_POOL.slice(0, 60)
      .filter((passage) => !kept.some((other) => covers(other, passage)))
      .map((passage) => passage.ref);
    expect(missing.length).toBeGreaterThan(20);
    await seedPool(
      t,
      FEED_POOL.slice(0, 60).map((passage) => passage.ref),
    );

    for (let seed = 0; seed < 10; seed += 1) {
      const items = await pageItems(t, [], seed);
      expect(items.some((item) => missing.includes(item.ref))).toBe(false);
      expect(items).toHaveLength(FEED_PAGE_SIZE);
    }
  });

  it("devuelve las citas que tocaban pero no tienen texto, para que el cliente no las vuelva a pedir", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);
    const { items } = await versePage(t, { seen: [], seed: 6 });
    const [dropped] = items;
    // Se borra el texto de la primera cita: con la misma semilla, ahora sale como `skipped`.
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("verses").collect()) {
        if (
          row.book === dropped.book &&
          row.chapter === dropped.chapter &&
          row.verse >= dropped.verse &&
          row.verse <= (dropped.endVerse ?? dropped.verse)
        ) {
          await ctx.db.delete(row._id);
        }
      }
    });
    const again = await versePage(t, { seen: [], seed: 6 });
    expect(again.skipped).toContain(dropped.ref);
    expect(again.items.some((item) => item.ref === dropped.ref)).toBe(false);
  });

  it("no repite lo que ya se vio", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);
    const first = await pageItems(t, [], 9);
    const second = await pageItems(
      t,
      first.map((item) => item.ref),
      9,
    );
    expect(second.some((item) => first.some((seen) => seen.ref === item.ref))).toBe(false);
  });

  it("cuando ya se vio todo, avisa que empieza otra vuelta y no repite lo último", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);
    const seen = FEED_POOL.map((passage) => passage.ref);

    const { items, newRound } = await versePage(t, { seen, seed: 4 });

    expect(newRound).toBe(true);
    expect(items).toHaveLength(FEED_PAGE_SIZE);
    const recent = seen.slice(-FEED_RECENT_GUARD);
    expect(items.some((item) => recent.includes(item.ref))).toBe(false);
  });
});

describe("verseFeed.page con reels", () => {
  it("dos de cada ocho lugares son historias o personajes; la primera pantalla siempre es un versículo", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);

    const { items } = await t.query(api.verseFeed.page, { seen: [], seed: 1, withReels: true });

    expect(items).toHaveLength(FEED_PAGE_SIZE);
    expect(items[0].kind).toBe("verse");
    for (const slot of FEED_REEL_SLOTS) expect(items[slot].kind).not.toBe("verse");
    const reels = items.filter((item): item is FeedReelItem => item.kind !== "verse");
    expect(reels).toHaveLength(FEED_REEL_SLOTS.length);
    for (const reel of reels) {
      const catalog = REEL_POOL.find((entry) => entry.ref === reel.ref)!;
      expect(reel.scenes).toHaveLength(catalog.scenes.length);
      expect(reel).toMatchObject({ liked: false, likes: 0, title: catalog.title });
      for (const scene of reel.scenes) {
        // Sin medios generados: la foto de un devocional y sin voz (la escena avanza por tiempo).
        expect(scene).toMatchObject({ imageUrl: catalog.fallbackImageUrl, audioUrl: null });
      }
    }
  });

  it("no repite reels ya vistos", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);
    const seen: string[] = [];
    for (let page = 0; page < 5; page += 1) {
      const { items } = await t.query(api.verseFeed.page, { seen, seed: 9, withReels: true });
      for (const item of items) expect(seen).not.toContain(item.ref);
      seen.push(...items.map((item) => item.ref));
    }
  });

  it("con la voz y la imagen de una escena guardadas, la escena las trae", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);
    const { items } = await t.query(api.verseFeed.page, { seen: [], seed: 3, withReels: true });
    const reel = items.find((item): item is FeedReelItem => item.kind !== "verse")!;
    const scene = REEL_POOL.find((entry) => entry.ref === reel.ref)!.scenes[0];
    await t.run(async (ctx) => {
      const image = await ctx.storage.store(new Blob(["img"], { type: "image/webp" }));
      const audio = await ctx.storage.store(new Blob(["mp3"], { type: "audio/mpeg" }));
      await ctx.db.insert("verseFeedMedia", {
        ref: scene.mediaRef,
        kind: "image",
        version: "",
        storageId: image,
        attempts: 0,
        updatedAt: 0,
      });
      await ctx.db.insert("verseFeedMedia", {
        ref: scene.mediaRef,
        kind: "audio",
        version: "",
        storageId: audio,
        textHash: textHash(scene.text),
        attempts: 0,
        updatedAt: 0,
      });
    });

    const again = await t.query(api.verseFeed.page, { seen: [], seed: 3, withReels: true });
    const same = again.items.find((item): item is FeedReelItem => item.ref === reel.ref)!;
    expect(same.scenes[0].imageUrl).not.toBe(reel.scenes[0].imageUrl);
    expect(same.scenes[0].audioUrl).toMatch(/^https?:\/\//);
    expect(same.scenes[0].imageAlt).toBe(`Ilustración de ${reel.title}, parte 1`);
  });
});

describe("verseFeed.setLike", () => {
  it("da y quita ♥, y lleva la cuenta de la comunidad", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);
    const ana = asUser(t, "user_ana_feed");
    const beto = asUser(t, "user_beto_feed");
    await ana.mutation(api.users.upsert, {});
    await beto.mutation(api.users.upsert, {});
    const ref = FEED_POOL[0].ref;

    expect(await ana.mutation(api.verseFeed.setLike, { ref, liked: true })).toEqual({ liked: true, likes: 1 });
    expect(await beto.mutation(api.verseFeed.setLike, { ref, liked: true })).toEqual({ liked: true, likes: 2 });
    expect(await ana.mutation(api.verseFeed.setLike, { ref, liked: false })).toEqual({ liked: false, likes: 1 });

    const stats = await t.run((ctx) => ctx.db.query("verseFeedStats").collect());
    expect(stats).toMatchObject([{ ref, likes: 1 }]);

    // Sin ♥, la cita no deja fila.
    await beto.mutation(api.verseFeed.setLike, { ref, liked: false });
    expect(await t.run((ctx) => ctx.db.query("verseFeedStats").collect())).toHaveLength(0);
  });

  it("es idempotente: repetir el mismo pedido no cambia la cuenta ni invierte el ♥", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_ana_idem");
    await ana.mutation(api.users.upsert, {});
    const ref = FEED_POOL[1].ref;

    await ana.mutation(api.verseFeed.setLike, { ref, liked: true });
    expect(await ana.mutation(api.verseFeed.setLike, { ref, liked: true })).toEqual({ liked: true, likes: 1 });
    expect(await ana.mutation(api.verseFeed.setLike, { ref, liked: false })).toEqual({ liked: false, likes: 0 });
    expect(await ana.mutation(api.verseFeed.setLike, { ref, liked: false })).toEqual({ liked: false, likes: 0 });
    expect(await t.run((ctx) => ctx.db.query("verseFeedLikes").collect())).toHaveLength(0);
  });

  it("la página marca lo que la persona ya quiere", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);
    const ana = asUser(t, "user_ana_liked");
    await ana.mutation(api.users.upsert, {});
    const [first] = await pageItems(ana, [], 2);
    await ana.mutation(api.verseFeed.setLike, { ref: first.ref, liked: true });

    const again = await pageItems(ana, [], 2);
    const liked = again.find((item) => item.ref === first.ref);
    // Lo ya marcado baja en el orden; si vuelve a salir, sale marcado.
    if (liked) expect(liked).toMatchObject({ liked: true, likes: 1 });
    expect(again.filter((item) => item.liked).every((item) => item.ref === first.ref)).toBe(true);
  });

  it("el corazón sale bien aunque la persona tenga más ♥ de los que mira la afinidad", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);
    const ana = asUser(t, "user_ana_many");
    const userId = await ana.mutation(api.users.upsert, {});
    // Todo el catálogo marcado, el primero hace mucho: queda fuera de los últimos 200.
    await t.run(async (ctx) => {
      for (const [index, passage] of FEED_POOL.entries()) {
        await ctx.db.insert("verseFeedLikes", { userId, ref: passage.ref, createdAt: index });
      }
    });
    const items = await pageItems(ana, [], 3);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.liked)).toBe(true);
  });

  it("los reels también llevan ♥ y la página los marca", async () => {
    const t = convexTest(schema, modules);
    await seedPool(t);
    const ana = asUser(t, "user_ana_reel");
    await ana.mutation(api.users.upsert, {});
    const ref = REEL_POOL[0].ref;

    expect(await ana.mutation(api.verseFeed.setLike, { ref, liked: true })).toEqual({ liked: true, likes: 1 });
    expect(
      await ana
        .mutation(api.verseFeed.setLike, { ref: "historia:inventada", liked: true })
        .catch((e: Error) => e.message),
    ).toContain("Versículo desconocido");
    const seen = REEL_POOL.slice(2).map((reel) => reel.ref);
    const { items } = await ana.query(api.verseFeed.page, { seen, seed: 1, withReels: true });
    // Con todos los demás vistos, quedan justo dos reels para los dos lugares: uno es el marcado.
    expect(items.find((item) => item.ref === ref)).toMatchObject({ liked: true, likes: 1 });
  });

  it("rechaza citas fuera del catálogo y pide sesión", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_ana_reject");
    await ana.mutation(api.users.upsert, {});
    await expect(ana.mutation(api.verseFeed.setLike, { ref: "Inventado 1:1", liked: true })).rejects.toThrow(
      "Versículo desconocido",
    );
    await expect(t.mutation(api.verseFeed.setLike, { ref: FEED_POOL[0].ref, liked: true })).rejects.toThrow(
      "No autenticado",
    );
  });
});
