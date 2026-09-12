import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./reading.ts": () => import("./reading"),
  "./users.ts": () => import("./users"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

describe("reading — progreso, recientes y guardados", () => {
  it("persiste un único marcador por usuario y lo expone al reabrir", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "reading_ana");
    await ana.mutation(api.users.upsert, {});

    await ana.mutation(api.reading.saveProgress, { book: "Juan", chapter: 3 });
    await ana.mutation(api.reading.saveProgress, { book: "Juan", chapter: 4 });

    await expect(ana.query(api.reading.progress, {})).resolves.toMatchObject({ book: "Juan", chapter: 4 });
    expect(await t.run((ctx) => ctx.db.query("readingProgress").collect())).toHaveLength(1);
  });

  it("guarda recientes sin duplicar y alterna un versículo guardado", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "reading_lists");
    await ana.mutation(api.users.upsert, {});

    await ana.mutation(api.reading.recordRecent, { book: "Juan", chapter: 3 });
    await ana.mutation(api.reading.recordRecent, { book: "Juan", chapter: 3 });
    await expect(ana.query(api.reading.recents, {})).resolves.toHaveLength(1);

    await expect(ana.mutation(api.reading.toggleBookmark, { book: "Juan", chapter: 3, verse: 16 })).resolves.toEqual({ saved: true });
    await expect(ana.query(api.reading.bookmarks, {})).resolves.toMatchObject([{ book: "Juan", chapter: 3, verse: 16 }]);
    await expect(ana.mutation(api.reading.toggleBookmark, { book: "Juan", chapter: 3, verse: 16 })).resolves.toEqual({ saved: false });
    await expect(ana.query(api.reading.bookmarks, {})).resolves.toEqual([]);
  });

  it("no permite escribir progreso sin una cuenta autenticada", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.reading.saveProgress, { book: "Juan", chapter: 3 })).rejects.toThrow("No autenticado");
  });
});
