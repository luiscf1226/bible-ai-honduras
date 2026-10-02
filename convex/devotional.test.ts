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
  it("elige el devocional por mes-día: el mismo cada año y distinto cada día", () => {
    expect(devotionalForDate("2026-01-01")).toMatchObject({
      catalogId: "01-01",
      date: "2026-01-01",
      verseRef: devotionalCatalog[0].verseRef,
    });
    expect(devotionalForDate("2027-10-31").catalogId).toBe("10-31");
    expect(devotionalForDate("2026-10-31").verseRef).toBe(devotionalForDate("2027-10-31").verseRef);
    expect(devotionalForDate("2026-10-30").verseRef).not.toBe(devotionalForDate("2026-10-31").verseRef);
  });

  it("cubre el 29 de febrero de los bisiestos y el 31 de diciembre", () => {
    expect(devotionalForDate("2028-02-29")).toMatchObject({ catalogId: "02-29", date: "2028-02-29" });
    expect(devotionalForDate("2026-12-31")).toMatchObject({ catalogId: "12-31", date: "2026-12-31" });
    expect(() => devotionalForDate("2027-02-29")).toThrow("date");
  });

  it("trae los cinco bloques de /hoy", () => {
    const devotional = devotionalForDate("2026-10-02");
    for (const field of ["openingPrayer", "intro", "verseRef", "reflection", "closingPrayer"] as const) {
      expect(devotional[field]).toBeTruthy();
    }
  });

  it("calcula el día editorial en la zona horaria de Honduras", () => {
    expect(hondurasDateKey(Date.UTC(2026, 0, 1, 5, 59))).toBe("2025-12-31");
    expect(hondurasDateKey(Date.UTC(2026, 0, 1, 6, 5))).toBe("2026-01-01");
  });

  it("es estable durante el día de Honduras y cambia a la medianoche de Tegucigalpa", () => {
    const at = (utc: number) => devotionalForDate(hondurasDateKey(utc)).catalogId;
    // 00:00–23:59 en Honduras = 06:00 UTC del día hasta 05:59 UTC del siguiente.
    expect(at(Date.UTC(2026, 0, 1, 6, 0))).toBe("01-01");
    expect(at(Date.UTC(2026, 0, 2, 5, 59))).toBe("01-01");
    expect(at(Date.UTC(2026, 0, 2, 6, 0))).toBe("01-02");
    expect(at(Date.UTC(2027, 0, 1, 5, 59))).toBe("12-31");
    expect(at(Date.UTC(2028, 2, 1, 5, 59))).toBe("02-29");
  });

  it("rechaza fechas imposibles", () => {
    expect(() => devotionalForDate("2026-02-30")).toThrow("date");
    expect(() => devotionalForDate("19-08-2026")).toThrow("date");
  });
});

// Fila sembrada por el ciclo de cuatro semanas anterior: sin oraciones ni
// introducción.
const legacyRow = {
  catalogId: "esperanza",
  date: "2026-01-01",
  imageAlt: "Amanecer cálido entre montañas",
  imageAttributionUrl: "https://unsplash.com/photos/1500534623283-312aade485b7",
  imageUrl: "https://images.unsplash.com/photo-1500534623283-312aade485b7",
  reflection: "Reflexión del ciclo anterior.",
  verseRef: "Lamentaciones 3:22-23",
};

describe("devotional.byDate", () => {
  it("sirve el catálogo aun antes de que el cron haya persistido el día, con los campos de /hoy", async () => {
    const t = convexTest(schema, modules);
    const expected = devotionalForDate("2026-01-01");

    await expect(t.query(api.devotional.byDate, { date: "2026-01-01" })).resolves.toEqual({
      catalogId: "01-01",
      closingPrayer: expected.closingPrayer,
      date: "2026-01-01",
      imageAlt: expected.imageAlt,
      imageAttributionUrl: expected.imageAttributionUrl,
      imageUrl: expected.imageUrl,
      intro: expected.intro,
      openingPrayer: expected.openingPrayer,
      reflection: expected.reflection,
      verseRef: expected.verseRef,
    });
  });

  it("ignora filas del ciclo anterior que no traen oraciones", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) => ctx.db.insert("dailyDevotionals", legacyRow));

    await expect(t.query(api.devotional.byDate, { date: "2026-01-01" })).resolves.toMatchObject({
      catalogId: "01-01",
      verseRef: devotionalForDate("2026-01-01").verseRef,
    });
  });

  it("valida la fecha entregada por el cliente", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(api.devotional.byDate, { date: "2026-13-01" })).rejects.toThrow("date");
  });
});

describe("devotional.today", () => {
  it("sirve el devocional del día de Honduras", async () => {
    const t = convexTest(schema, modules);
    const today = hondurasDateKey();

    await expect(t.query(api.devotional.today, {})).resolves.toMatchObject({
      catalogId: today.slice(5),
      date: today,
      openingPrayer: devotionalForDate(today).openingPrayer,
    });
  });
});

describe("devotional.ensureWindow", () => {
  it("siembra 28 días completos y es idempotente", async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation(internal.devotional.ensureWindow, {});
    const second = await t.mutation(internal.devotional.ensureWindow, {});
    const rows = await t.run((ctx) => ctx.db.query("dailyDevotionals").collect());

    expect(first).toMatchObject({ inserted: 28, updated: 0 });
    expect(second).toMatchObject({ inserted: 0, updated: 0 });
    expect(rows).toHaveLength(28);
    expect(
      rows.every(
        (row) => row.imageUrl && row.imageAlt && row.verseRef && row.reflection && row.openingPrayer && row.intro && row.closingPrayer,
      ),
    ).toBe(true);
    expect(new Set(rows.map((row) => row.verseRef)).size).toBe(28);
  });

  it("reemplaza las filas del ciclo anterior con el devocional del calendario", async () => {
    const t = convexTest(schema, modules);
    const today = hondurasDateKey();
    await t.run((ctx) => ctx.db.insert("dailyDevotionals", { ...legacyRow, date: today }));

    const result = await t.mutation(internal.devotional.ensureWindow, {});
    const row = await t.run((ctx) =>
      ctx.db
        .query("dailyDevotionals")
        .withIndex("by_date", (q) => q.eq("date", today))
        .unique(),
    );

    expect(result).toMatchObject({ inserted: 27, updated: 1 });
    expect(row).toMatchObject(devotionalForDate(today));
  });
});

describe("devotional.widgetDays (#170)", () => {
  it("deja dos semanas de versículos desde hoy en Honduras, con el texto cuando está en el corpus", async () => {
    const t = convexTest(schema, {
      ...modules,
      "./rag/verses.ts": () => import("./rag/verses"),
      "./bibleVersions.ts": () => import("./bibleVersions"),
    });
    const today = hondurasDateKey();
    const ref = devotionalForDate(today).verseRef;
    const [, book, chapter, verse] = ref.match(/^(.+?)\s+(\d+):(\d+)/) ?? [];
    await t.run((ctx) =>
      ctx.db.insert("verses", {
        book,
        chapter: Number(chapter),
        verse: Number(verse),
        version: "RV1909",
        text: "Texto de prueba",
        embedding: [],
      }),
    );

    const days = await t.query(api.devotional.widgetDays, {});
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ date: today, verseRef: ref, text: "Texto de prueba", version: "RV1909" });
    expect(new Set(days.map((day) => day.date)).size).toBe(14);
  });
});
