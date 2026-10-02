import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { internal } from "../_generated/api";
import schema from "../schema";
import { EXPECTED_CANON_VERSES, corpusStatus, describeIncomplete } from "./corpusCheck";
import { zeroEmbedding } from "./embed";

const modules = {
  "./_generated/api.js": () => import("../_generated/api"),
  "./rag/corpusCheck.ts": () => import("./corpusCheck"),
  "./rag/embed.ts": () => import("./embed"),
  "./rag/verses.ts": () => import("./verses"),
};

async function seedVerses(t: ReturnType<typeof convexTest>, version: string, total: number) {
  const embedding = zeroEmbedding();
  await t.run(async (ctx) => {
    for (let verse = 1; verse <= total; verse += 1) {
      await ctx.db.insert("verses", { version, book: "Salmos", chapter: 119, verse, text: `v${verse}`, embedding });
    }
  });
}

describe("verses.countByVersion (#174)", () => {
  it("pagina y cuenta solo la versión pedida", async () => {
    const t = convexTest(schema, modules);
    await seedVerses(t, "RV1909", 5);
    await seedVerses(t, "RVR1960", 2);

    const first = await t.query(internal.rag.verses.countByVersion, {
      version: "RV1909",
      paginationOpts: { numItems: 3, cursor: null },
    });
    expect(first).toMatchObject({ count: 3, isDone: false });

    const second = await t.query(internal.rag.verses.countByVersion, {
      version: "RV1909",
      paginationOpts: { numItems: 3, cursor: first.continueCursor },
    });
    expect(second.count).toBe(2);
  });
});

describe("corpusCheck (#174)", () => {
  it("una versión habilitada sin texto se reporta con lo que falta", async () => {
    const t = convexTest(schema, modules);
    const statuses = await t.action(internal.rag.corpusCheck.checkAvailableVersions, {});
    expect(statuses).toEqual([{ version: "RV1909", count: 0, missing: EXPECTED_CANON_VERSES }]);
    expect(describeIncomplete(statuses)).toEqual([
      `RV1909: tiene 0 de ${EXPECTED_CANON_VERSES} versículos (faltan ${EXPECTED_CANON_VERSES})`,
    ]);
  });

  it("suma todas las páginas de la versión", async () => {
    const t = convexTest(schema, modules);
    await seedVerses(t, "RV1909", 1_203);
    const statuses = await t.action(internal.rag.corpusCheck.checkAvailableVersions, {});
    expect(statuses).toEqual([corpusStatus("RV1909", 1_203)]);
  });

  it("con el canon completo no hay nada que reportar", () => {
    expect(describeIncomplete([corpusStatus("RV1909", EXPECTED_CANON_VERSES)])).toEqual([]);
  });

  it("también avisa si sobran versículos (ingesta duplicada)", () => {
    expect(describeIncomplete([corpusStatus("RV1909", EXPECTED_CANON_VERSES + 4)])).toEqual([
      `RV1909: tiene ${EXPECTED_CANON_VERSES + 4} versículos, más de los ${EXPECTED_CANON_VERSES} esperados`,
    ]);
  });
});
