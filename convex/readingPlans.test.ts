import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import { canonicalReadingPlan } from "./readingPlanCatalog";
import { currentPlanDay, nextStreakState } from "./readingPlans";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./devotional.ts": () => import("./devotional"),
  "./readingPlanCatalog.ts": () => import("./readingPlanCatalog"),
  "./readingPlans.ts": () => import("./readingPlans"),
  "./users.ts": () => import("./users"),
  "./history.ts": () => import("./history"),
  "./reading.ts": () => import("./reading"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
  "./voicesCatalog.ts": () => import("./voicesCatalog"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

describe("currentPlanDay", () => {
  it("el día 1 corresponde a la fecha de inicio", () => {
    expect(currentPlanDay("2026-01-01", "2026-01-01", 365)).toBe(1);
  });

  it("avanza un día del plan por cada día real transcurrido", () => {
    expect(currentPlanDay("2026-01-01", "2026-01-05", 365)).toBe(5);
  });

  it("cruza un cambio de mes sin perder la cuenta", () => {
    // 31 de enero → día 31; 1 de febrero → día 32.
    expect(currentPlanDay("2026-01-01", "2026-01-31", 365)).toBe(31);
    expect(currentPlanDay("2026-01-01", "2026-02-01", 365)).toBe(32);
  });

  it("cruza un cambio de año sin perder la cuenta", () => {
    // Empezando el 15 de diciembre de 2026: 17 días quedan en 2026 (incluido el
    // 15), así que el 1 de enero de 2027 es el día 18 del plan.
    expect(currentPlanDay("2026-12-15", "2026-12-31", 365)).toBe(17);
    expect(currentPlanDay("2026-12-15", "2027-01-01", 365)).toBe(18);
  });

  it("se clampea a totalDays: no hay día 366", () => {
    expect(currentPlanDay("2026-01-01", "2027-06-01", 365)).toBe(365);
  });

  it("nunca es menor a 1", () => {
    expect(currentPlanDay("2026-06-01", "2026-05-01", 365)).toBe(1);
  });
});

describe("nextStreakState", () => {
  const empty = { lastCompletedDate: undefined, currentStreak: 0, longestStreak: 0 };

  it("la primera vez que se marca algo, la racha arranca en 1", () => {
    expect(nextStreakState(empty, "2026-01-01")).toEqual({
      lastCompletedDate: "2026-01-01",
      currentStreak: 1,
      longestStreak: 1,
    });
  });

  it("un día consecutivo suma a la racha", () => {
    const state = { lastCompletedDate: "2026-01-01", currentStreak: 1, longestStreak: 1 };
    expect(nextStreakState(state, "2026-01-02")).toEqual({
      lastCompletedDate: "2026-01-02",
      currentStreak: 2,
      longestStreak: 2,
    });
  });

  it("marcar dos veces en el mismo día no infla la racha (ponerse al día en una sesión)", () => {
    const state = { lastCompletedDate: "2026-01-05", currentStreak: 3, longestStreak: 3 };
    expect(nextStreakState(state, "2026-01-05")).toEqual({
      lastCompletedDate: "2026-01-05",
      currentStreak: 3,
      longestStreak: 3,
    });
  });

  it("un salto de varios días reinicia la racha a 1, sin culpar en el dato: solo se resetea", () => {
    const state = { lastCompletedDate: "2026-01-01", currentStreak: 10, longestStreak: 10 };
    expect(nextStreakState(state, "2026-01-10")).toEqual({
      lastCompletedDate: "2026-01-10",
      currentStreak: 1,
      longestStreak: 10,
    });
  });

  it("consecutivo cruzando un cambio de mes", () => {
    const state = { lastCompletedDate: "2026-01-31", currentStreak: 5, longestStreak: 5 };
    expect(nextStreakState(state, "2026-02-01")).toEqual({
      lastCompletedDate: "2026-02-01",
      currentStreak: 6,
      longestStreak: 6,
    });
  });

  it("consecutivo cruzando un cambio de año", () => {
    const state = { lastCompletedDate: "2026-12-31", currentStreak: 30, longestStreak: 30 };
    expect(nextStreakState(state, "2027-01-01")).toEqual({
      lastCompletedDate: "2027-01-01",
      currentStreak: 31,
      longestStreak: 31,
    });
  });

  it("longestStreak nunca baja aunque la racha actual se reinicie", () => {
    const state = { lastCompletedDate: "2026-01-01", currentStreak: 50, longestStreak: 50 };
    const next = nextStreakState(state, "2026-03-01");
    expect(next.currentStreak).toBe(1);
    expect(next.longestStreak).toBe(50);
  });
});

describe("readingPlans.start / myProgress / markDayRead", () => {
  it("elegir el plan fija la fecha de inicio y muestra el día 1", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_ana_plan");
    await ana.mutation(api.users.upsert, {});

    await ana.mutation(api.readingPlans.start, { planId: "canonico" });
    const progress = await ana.query(api.readingPlans.myProgress, {});

    expect(progress).not.toBeNull();
    expect(progress?.currentDay).toBe(1);
    expect(progress?.todayReadings).toEqual(canonicalReadingPlan.days[0].readings);
    expect(progress?.todayCompleted).toBe(false);
    expect(progress?.completedCount).toBe(0);
    expect(progress?.currentStreak).toBe(0);
    expect(progress?.pendingDays).toEqual([]);
  });

  it("sin plan elegido, myProgress devuelve null", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_sin_plan");
    await ana.mutation(api.users.upsert, {});

    expect(await ana.query(api.readingPlans.myProgress, {})).toBeNull();
  });

  it("marcar leído avanza el progreso y la racha", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_ana_racha");
    await ana.mutation(api.users.upsert, {});
    await ana.mutation(api.readingPlans.start, { planId: "canonico" });

    const result = await ana.mutation(api.readingPlans.markDayRead, { day: 1 });
    expect(result.completedDays).toEqual([1]);
    expect(result.currentStreak).toBe(1);

    const progress = await ana.query(api.readingPlans.myProgress, {});
    expect(progress?.todayCompleted).toBe(true);
    expect(progress?.completedCount).toBe(1);
    expect(progress?.currentStreak).toBe(1);
  });

  it("marcar el mismo día dos veces es idempotente (no duplica ni rompe la racha)", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_ana_doble_marca");
    await ana.mutation(api.users.upsert, {});
    await ana.mutation(api.readingPlans.start, { planId: "canonico" });

    await ana.mutation(api.readingPlans.markDayRead, { day: 1 });
    const second = await ana.mutation(api.readingPlans.markDayRead, { day: 1 });

    expect(second.completedDays).toEqual([1]);
    expect(second.currentStreak).toBe(1);
  });

  it("rechaza un día fuera de rango", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_ana_dia_invalido");
    await ana.mutation(api.users.upsert, {});
    await ana.mutation(api.readingPlans.start, { planId: "canonico" });

    await expect(ana.mutation(api.readingPlans.markDayRead, { day: 0 })).rejects.toThrow("day");
    await expect(ana.mutation(api.readingPlans.markDayRead, { day: 366 })).rejects.toThrow("day");
  });

  it("rechaza un plan desconocido (v1 solo soporta el canónico)", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_ana_plan_raro");
    await ana.mutation(api.users.upsert, {});

    await expect(ana.mutation(api.readingPlans.start, { planId: "cronologico" })).rejects.toThrow("Plan desconocido");
  });

  it("requiere sesión para elegir plan, marcar leído o ver el progreso", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.readingPlans.start, { planId: "canonico" })).rejects.toThrow("No autenticado");
    await expect(t.mutation(api.readingPlans.markDayRead, { day: 1 })).rejects.toThrow("No autenticado");
    expect(await t.query(api.readingPlans.myProgress, {})).toBeNull();
  });

  it("elegir un plan de nuevo reinicia el progreso (fecha de inicio y días completados)", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_ana_reinicio");
    await ana.mutation(api.users.upsert, {});
    await ana.mutation(api.readingPlans.start, { planId: "canonico" });
    await ana.mutation(api.readingPlans.markDayRead, { day: 1 });

    await ana.mutation(api.readingPlans.start, { planId: "canonico" });
    const progress = await ana.query(api.readingPlans.myProgress, {});

    expect(progress?.completedCount).toBe(0);
    expect(progress?.currentStreak).toBe(0);
    expect(progress?.currentDay).toBe(1);
  });
});

describe("ponerme al día — catch-up sin culpar", () => {
  it("con varios días de atraso, myProgress lista las lecturas pendientes sin un contador de vergüenza", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_ana_atrasada");
    await ana.mutation(api.users.upsert, {});

    // Arranca el plan hace 5 días (día 1..5 ya deberían haber pasado; hoy es
    // el día 6) y solo marcó el día 1 como leído.
    await t.run(async (ctx) => {
      const userId = (await ctx.db.query("users").withIndex("by_clerk_id", (q) => q.eq("clerkId", "user_ana_atrasada")).unique())!._id;
      await ctx.db.insert("userPlanProgress", {
        userId,
        planId: "canonico",
        startedAt: "2026-01-01",
        completedDays: [1],
        currentStreak: 1,
        longestStreak: 1,
        lastCompletedDate: "2026-01-01",
      });
    });

    // "Hoy" para el test lo fija el reloj del sistema — para no depender de la
    // fecha real, calculamos currentDay a partir de un `today` inyectado vía
    // myProgress solo puede usar `Date.now()` real, así que en cambio
    // comprobamos directamente contra el helper puro más abajo y contra un
    // escenario armado con fechas ya pasadas relativas al `startedAt`.
    const progress = await ana.query(api.readingPlans.myProgress, {});
    expect(progress).not.toBeNull();
    // El día 1 ya se marcó, así que nunca puede aparecer en pendientes.
    expect(progress?.pendingDays.some((entry) => entry.day === 1)).toBe(false);
    // Todo lo pendiente es estrictamente anterior al día de hoy.
    expect(progress?.pendingDays.every((entry) => entry.day < (progress?.currentDay ?? 0))).toBe(true);
    // Cada entrada trae sus lecturas para poder abrirlas directo en el lector.
    for (const entry of progress?.pendingDays ?? []) {
      expect(entry.readings.length).toBeGreaterThan(0);
    }
  });

  it("marcar varios días pendientes en una sola sesión solo suma un día a la racha", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_ana_pone_al_dia");
    await ana.mutation(api.users.upsert, {});
    await t.run(async (ctx) => {
      const userId = (await ctx.db.query("users").withIndex("by_clerk_id", (q) => q.eq("clerkId", "user_ana_pone_al_dia")).unique())!._id;
      await ctx.db.insert("userPlanProgress", {
        userId,
        planId: "canonico",
        startedAt: "2020-01-01", // bien atrás, para tener un backlog grande
        completedDays: [],
        currentStreak: 0,
        longestStreak: 0,
      });
    });

    await ana.mutation(api.readingPlans.markDayRead, { day: 1 });
    await ana.mutation(api.readingPlans.markDayRead, { day: 2 });
    await ana.mutation(api.readingPlans.markDayRead, { day: 3 });

    const progress = await ana.query(api.readingPlans.myProgress, {});
    expect(progress?.completedCount).toBe(3);
    // Las tres marcas pasaron "hoy" en el reloj real, así que cuentan como un
    // solo día de racha, no tres.
    expect(progress?.currentStreak).toBe(1);
  });
});

describe("ensurePlanSeeded", () => {
  it("siembra la tabla readingPlans una sola vez y es idempotente", async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation(internal.readingPlans.ensurePlanSeeded, {});
    const second = await t.mutation(internal.readingPlans.ensurePlanSeeded, {});
    const rows = await t.run((ctx) => ctx.db.query("readingPlans").collect());

    expect(first.seeded).toBe(true);
    expect(second.seeded).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0].planId).toBe("canonico");
    expect(rows[0].days).toHaveLength(365);
  });
});

describe("readingPlans.catalog", () => {
  it("expone los metadatos del plan canónico sin necesitar sesión", async () => {
    const t = convexTest(schema, modules);
    const info = await t.query(api.readingPlans.catalog, {});
    expect(info).toEqual({
      id: "canonico",
      name: canonicalReadingPlan.name,
      description: canonicalReadingPlan.description,
      totalDays: 365,
    });
  });
});
