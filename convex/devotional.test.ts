import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import { devotionalCatalog } from "./devotionalCatalog";
import { devotionalForDate, hondurasDateKey } from "./devotional";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./devotional.ts": () => import("./devotional"),
};

describe("devotionalForDate", () => {
  it("ofrece cuatro semanas completas de contenido curado", () => {
    expect(devotionalCatalog).toHaveLength(28);
    expect(devotionalCatalog.every((item) => item.verseRef && item.reflection && item.imageUrl)).toBe(true);
  });

  it("elige un devocional estable para una fecha y recorre todo el ciclo de cuatro semanas", () => {
    expect(devotionalForDate("2026-01-01")).toMatchObject({
      catalogId: devotionalCatalog[0].catalogId,
      verseRef: devotionalCatalog[0].verseRef,
    });
    expect(devotionalForDate("2026-01-29").catalogId).toBe(devotionalCatalog[0].catalogId);
  });

  it("calcula el día editorial en la zona horaria de Honduras", () => {
    expect(hondurasDateKey(Date.UTC(2026, 0, 1, 5, 59))).toBe("2025-12-31");
    expect(hondurasDateKey(Date.UTC(2026, 0, 1, 6, 5))).toBe("2026-01-01");
  });

  it("rechaza fechas imposibles", () => {
    expect(() => devotionalForDate("2026-02-30")).toThrow("date");
    expect(() => devotionalForDate("19-08-2026")).toThrow("date");
  });
});

describe("devotional.byDate", () => {
  it("sirve el catálogo aun antes de que el cron haya persistido el día", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(api.devotional.byDate, { date: "2026-01-01" })).resolves.toMatchObject({
      date: "2026-01-01",
      verseRef: "Lamentaciones 3:22-23",
    });
  });

  it("valida la fecha entregada por el cliente", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(api.devotional.byDate, { date: "2026-13-01" })).rejects.toThrow("date");
  });
});

describe("devotional.ensureWindow", () => {
  it("siembra 28 días y es idempotente", async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation(internal.devotional.ensureWindow, {});
    const second = await t.mutation(internal.devotional.ensureWindow, {});
    const rows = await t.run((ctx) => ctx.db.query("dailyDevotionals").collect());

    expect(first.inserted).toBe(28);
    expect(second.inserted).toBe(0);
    expect(rows).toHaveLength(28);
    expect(rows.every((row) => row.imageUrl && row.imageAlt && row.verseRef && row.reflection)).toBe(true);
  });
});
