import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import { pickActiveSeason, validateSeason, type SeasonInput } from "./seasons";
import { easterSunday, holyWeekRange, proposedSeasonCalendar } from "./seasonsDraftCatalog";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./seasons.ts": () => import("./seasons"),
};

function season(overrides: Partial<SeasonInput> = {}): SeasonInput {
  return {
    slug: "gratitud-2026",
    name: "Mes de gratitud",
    startDate: "2026-11-01",
    endDate: "2026-11-30",
    enabled: true,
    ...overrides,
  };
}

describe("pickActiveSeason", () => {
  it("toma inicio y fin como días incluidos", () => {
    const seasons = [season()];
    expect(pickActiveSeason(seasons, "2026-10-31")).toBeNull();
    expect(pickActiveSeason(seasons, "2026-11-01")?.slug).toBe("gratitud-2026");
    expect(pickActiveSeason(seasons, "2026-11-30")?.slug).toBe("gratitud-2026");
    expect(pickActiveSeason(seasons, "2026-12-01")).toBeNull();
  });

  it("ignora las temporadas apagadas", () => {
    expect(pickActiveSeason([season({ enabled: false })], "2026-11-15")).toBeNull();
  });

  it("si dos se pisan gana la de mayor prioridad", () => {
    const seasons = [
      season({ slug: "corta", startDate: "2026-11-10", endDate: "2026-11-12" }),
      season({ slug: "mes", priority: 2 }),
    ];
    expect(pickActiveSeason(seasons, "2026-11-11")?.slug).toBe("mes");
  });

  it("con la misma prioridad gana la más corta, y después la que empezó más tarde", () => {
    const month = season({ slug: "mes" });
    const week = season({ slug: "semana", startDate: "2026-11-20", endDate: "2026-11-26" });
    expect(pickActiveSeason([month, week], "2026-11-21")?.slug).toBe("semana");
    expect(pickActiveSeason([week, month], "2026-11-21")?.slug).toBe("semana");
    expect(pickActiveSeason([month, week], "2026-11-27")?.slug).toBe("mes");

    const early = season({ slug: "temprana", startDate: "2026-11-01", endDate: "2026-11-10" });
    const late = season({ slug: "tardia", startDate: "2026-11-05", endDate: "2026-11-14" });
    expect(pickActiveSeason([early, late], "2026-11-07")?.slug).toBe("tardia");
  });

  it("rechaza fechas inválidas", () => {
    expect(() => pickActiveSeason([season()], "2026-02-30")).toThrow("date");
  });
});

describe("validateSeason", () => {
  it("acepta referencias que existen en los catálogos", () => {
    expect(() =>
      validateSeason(season({ characterSlug: "pablo", readingPlanId: "semana-santa", paletteKey: "gratitud" })),
    ).not.toThrow();
  });

  it("rechaza fin antes del inicio y fechas imposibles", () => {
    expect(() => validateSeason(season({ startDate: "2026-12-01" }))).toThrow("startDate");
    expect(() => validateSeason(season({ endDate: "2026-11-31" }))).toThrow("date");
  });

  it("rechaza personajes fuera del catálogo de Voces (regla dura #2)", () => {
    expect(() => validateSeason(season({ characterSlug: "jesus" }))).toThrow("characterSlug");
  });

  it("rechaza recorridos e historias que no existen", () => {
    expect(() => validateSeason(season({ readingPlanId: "romanos-31" }))).toThrow("readingPlanId");
    expect(() => validateSeason(season({ storyId: "no-existe" }))).toThrow("storyId");
  });

  it("no acepta un color como paleta: solo la llave de un token", () => {
    expect(() => validateSeason(season({ paletteKey: "#C08A3E" }))).toThrow("paletteKey");
  });

  it("pide texto alternativo si hay imagen y limita las preguntas de ejemplo", () => {
    expect(() => validateSeason(season({ imageUrl: "https://example.com/a.jpg" }))).toThrow("imageAlt");
    expect(() => validateSeason(season({ sampleQuestions: Array(7).fill("¿Qué es la gracia?") }))).toThrow(
      "sampleQuestions",
    );
    expect(() => validateSeason(season({ sampleQuestions: ["  "] }))).toThrow("pregunta");
  });
});

describe("Semana Santa móvil (borrador)", () => {
  it("calcula el Domingo de Resurrección", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2028)).toBe("2028-04-16");
    expect(easterSunday(2038)).toBe("2038-04-25");
  });

  it("va del Domingo de Ramos al de Resurrección", () => {
    expect(holyWeekRange(2027)).toEqual({ startDate: "2027-03-21", endDate: "2027-03-28" });
  });

  it("el calendario propuesto sale apagado y sin destacados", () => {
    const calendar = proposedSeasonCalendar(2026);
    expect(calendar).toHaveLength(7);
    expect(calendar.every((item) => item.enabled === false)).toBe(true);
    expect(calendar.every((item) => !item.paletteKey && !item.imageUrl && !item.characterSlug)).toBe(true);
    expect(calendar.map((item) => validateSeason(item).slug)).toContain("semana-santa-2027");
    // Encendido solo en un test: Semana Santa le gana a un mes temático que la pise.
    const enabled = calendar.map((item) => ({ ...item, enabled: true }));
    const overlapping = [...enabled, season({ slug: "marzo", startDate: "2027-03-01", endDate: "2027-03-31" })];
    expect(pickActiveSeason(overlapping, "2027-03-25")?.slug).toBe("semana-santa-2027");
    expect(pickActiveSeason(enabled, "2026-11-15")?.slug).toBe("gratitud-2026");
    expect(pickActiveSeason(enabled, "2027-02-15")).toBeNull();
  });
});

describe("seasons.current", () => {
  it("devuelve null cuando no hay temporadas cargadas", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.seasons.current, { date: "2026-11-15" })).resolves.toBeNull();
    await expect(t.query(api.seasons.current, {})).resolves.toBeNull();
  });

  it("resuelve la temporada activa por fecha de Honduras y null fuera de ella", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seasons.upsert, season({ characterSlug: "david", sampleQuestions: ["¿Por qué dar gracias?"] }));

    await expect(t.query(api.seasons.current, { date: "2026-11-30" })).resolves.toEqual({
      slug: "gratitud-2026",
      name: "Mes de gratitud",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      paletteKey: null,
      imageUrl: null,
      imageAlt: null,
      imageAttributionUrl: null,
      devotionalCycleId: null,
      readingPlanId: null,
      characterSlug: "david",
      storyId: null,
      sampleQuestions: ["¿Por qué dar gracias?"],
    });
    await expect(t.query(api.seasons.current, { date: "2026-12-01" })).resolves.toBeNull();
    await expect(t.query(api.seasons.current, { date: "2026-10-31" })).resolves.toBeNull();
  });

  it("valida la fecha del cliente", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.seasons.current, { date: "2026-13-01" })).rejects.toThrow("date");
  });
});

describe("seasons.upsert / remove", () => {
  it("reemplaza por slug sin duplicar y permite apagar sin borrar", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(internal.seasons.upsert, season({ characterSlug: "david" }))).resolves.toEqual({
      slug: "gratitud-2026",
      created: true,
    });
    await expect(
      t.mutation(internal.seasons.upsert, season({ endDate: "2026-11-15", enabled: false })),
    ).resolves.toEqual({ slug: "gratitud-2026", created: false });

    const rows = await t.query(internal.seasons.list, {});
    expect(rows).toHaveLength(1);
    // Reemplazo completo: lo que no se mandó queda vacío.
    expect(rows[0]).toMatchObject({ endDate: "2026-11-15", enabled: false });
    expect(rows[0].characterSlug).toBeUndefined();
    await expect(t.query(api.seasons.current, { date: "2026-11-10" })).resolves.toBeNull();
  });

  it("no guarda una temporada inválida", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(internal.seasons.upsert, season({ slug: "Gratitud 2026" }))).rejects.toThrow("slug");
    await expect(t.query(internal.seasons.list, {})).resolves.toHaveLength(0);
  });

  it("borra por slug", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seasons.upsert, season());
    await expect(t.mutation(internal.seasons.remove, { slug: "gratitud-2026" })).resolves.toEqual({ removed: true });
    await expect(t.mutation(internal.seasons.remove, { slug: "gratitud-2026" })).resolves.toEqual({ removed: false });
    await expect(t.query(api.seasons.current, { date: "2026-11-10" })).resolves.toBeNull();
  });
});
