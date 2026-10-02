import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import { hondurasWeekKey, pickSavedMemory, type MemoryCandidate } from "./savedMemory";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./savedMemory.ts": () => import("./savedMemory"),
  "./users.ts": () => import("./users"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
  "./devotional.ts": () => import("./devotional"),
};

/** Mediodía en Honduras (UTC-6) del día dado, para no pelear con medianoches. */
function hn(date: string): number {
  return Date.parse(`${date}T12:00:00-06:00`);
}

function saved(date: string, book = "Salmos", chapter = 23, verse = 1): MemoryCandidate {
  return { book, chapter, verse, createdAt: hn(date) };
}

const OLD = [saved("2026-02-10", "Juan", 3, 16), saved("2026-03-05", "Romanos", 8, 28), saved("2026-04-20", "Filipenses", 4, 13)];

describe("hondurasWeekKey", () => {
  it("es el lunes de la semana, en hora de Honduras", () => {
    // Miércoles 30 sep 2026 → lunes 28.
    expect(hondurasWeekKey(hn("2026-09-30"))).toBe("2026-09-28");
    expect(hondurasWeekKey(hn("2026-09-28"))).toBe("2026-09-28");
    // El domingo todavía es la misma semana.
    expect(hondurasWeekKey(hn("2026-10-04"))).toBe("2026-09-28");
    // Lunes 5 oct 01:00 UTC = domingo 4 oct 19:00 en Honduras.
    expect(hondurasWeekKey(Date.parse("2026-10-05T01:00:00Z"))).toBe("2026-09-28");
  });
});

describe("pickSavedMemory", () => {
  it("mismo usuario y semana → mismo versículo, en cualquier día de la semana", () => {
    const monday = pickSavedMemory(OLD, "user_a", hn("2026-09-28"));
    expect(monday).not.toBeNull();
    for (const day of ["2026-09-29", "2026-09-30", "2026-10-02", "2026-10-04"]) {
      expect(pickSavedMemory(OLD, "user_a", hn(day))?.bookmark).toEqual(monday?.bookmark);
    }
    // El orden en que llegan las filas no cambia la elección.
    expect(pickSavedMemory([...OLD].reverse(), "user_a", hn("2026-09-30"))?.bookmark).toEqual(monday?.bookmark);
  });

  it("cambia entre semanas y entre personas (no siempre el mismo)", () => {
    const many = Array.from({ length: 12 }, (_, i) => saved(`2026-0${(i % 6) + 1}-1${i % 9}`, "Salmos", i + 1, 1));
    const weeks = Array.from({ length: 10 }, (_, i) => hn("2026-09-28") + i * 7 * 24 * 60 * 60 * 1000);
    const picks = new Set(weeks.map((now) => pickSavedMemory(many, "user_a", now)?.bookmark.chapter));
    expect(picks.size).toBeGreaterThan(1);
    const people = new Set(["a", "b", "c", "d", "e", "f"].map((id) => pickSavedMemory(many, id, hn("2026-09-30"))?.bookmark.chapter));
    expect(people.size).toBeGreaterThan(1);
  });

  it("sin guardados viejos → no hay tarjeta", () => {
    const recent = [saved("2026-09-01"), saved("2026-09-15"), saved("2026-09-29")];
    expect(pickSavedMemory(recent, "user_a", hn("2026-09-30"))).toBeNull();
  });

  it("con menos de 3 guardados → no hay tarjeta, aunque sean viejos", () => {
    expect(pickSavedMemory(OLD.slice(0, 2), "user_a", hn("2026-09-30"))).toBeNull();
  });

  it("un guardado de hace exactamente 30 días ya cuenta; uno de 29, no", () => {
    const now = hn("2026-09-30");
    expect(pickSavedMemory([saved("2026-08-31"), saved("2026-09-20"), saved("2026-09-25")], "u", now)?.bookmark.createdAt).toBe(hn("2026-08-31"));
    expect(pickSavedMemory([saved("2026-09-01"), saved("2026-09-20"), saved("2026-09-25")], "u", now)).toBeNull();
  });

  it("prioriza la misma semana de otro año: 'Hace un año…'", () => {
    // La semana del 28 sep – 4 oct 2026; el 1 oct 2025 cae en ella.
    const bookmarks = [...OLD, saved("2025-10-01", "Isaías", 41, 10)];
    for (const seed of ["a", "b", "c", "d"]) {
      const pick = pickSavedMemory(bookmarks, seed, hn("2026-09-30"));
      expect(pick?.bookmark.book).toBe("Isaías");
      expect(pick?.yearsAgo).toBe(1);
      expect(pick?.headline).toBe("Hace un año guardaste…");
    }
  });

  it("cuenta los años en una semana que cruza el 31 de diciembre", () => {
    // Semana del lunes 28 dic 2026 al domingo 3 ene 2027.
    const bookmarks = [...OLD, saved("2024-01-02", "Josué", 1, 9)];
    const pick = pickSavedMemory(bookmarks, "u", hn("2026-12-30"));
    expect(pick?.bookmark.book).toBe("Josué");
    expect(pick?.yearsAgo).toBe(3);
    expect(pick?.headline).toBe("Hace 3 años guardaste…");
  });

  it("sin coincidencia de semana el titular dice cuánto hace", () => {
    const pick = pickSavedMemory([saved("2026-07-20"), saved("2026-09-20"), saved("2026-09-25")], "u", hn("2026-09-30"));
    expect(pick?.yearsAgo).toBeNull();
    expect(pick?.headline).toBe("Hace 2 meses guardaste…");
    const older = pickSavedMemory([saved("2025-06-01"), saved("2026-09-20"), saved("2026-09-25")], "u", hn("2026-09-30"));
    expect(older?.headline).toBe("Hace más de un año guardaste…");
  });
});

describe("savedMemory.thisWeek / dismiss", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function seed(clerkId: string) {
    const t = convexTest(schema, modules);
    const ana = t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
    await ana.mutation(api.users.upsert, {});
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .unique();
      for (const [i, row] of [...OLD, saved("2025-10-01", "Isaías", 41, 10)].entries()) {
        await ctx.db.insert("readingBookmarks", {
          userId: user!._id,
          ...row,
          ...(i === 3 ? { note: "Lo leí antes de la entrevista." } : {}),
        });
      }
      await ctx.db.insert("verses", {
        book: "Isaías",
        chapter: 41,
        verse: 10,
        version: "RV1909",
        text: "No temas, que yo soy contigo;",
        embedding: [],
      });
    });
    return { t, ana };
  }

  it("devuelve referencia, texto y nota; 'Ahora no' la esconde hasta la semana siguiente", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(hn("2026-09-30"));
    const { ana } = await seed("memory_ana");

    await expect(ana.query(api.savedMemory.thisWeek, {})).resolves.toMatchObject({
      week: "2026-09-28",
      headline: "Hace un año guardaste…",
      book: "Isaías",
      chapter: 41,
      verse: 10,
      text: "No temas, que yo soy contigo;",
      note: "Lo leí antes de la entrevista.",
    });

    await ana.mutation(api.savedMemory.dismiss, {});
    await expect(ana.query(api.savedMemory.thisWeek, {})).resolves.toBeNull();

    vi.setSystemTime(hn("2026-10-05"));
    await expect(ana.query(api.savedMemory.thisWeek, {})).resolves.not.toBeNull();
  });

  it("apagada en Ajustes no aparece; encendida de nuevo, vuelve", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(hn("2026-09-30"));
    const { ana } = await seed("memory_off");

    await ana.mutation(api.users.updatePreferences, { savedMemoryEnabled: false });
    await expect(ana.query(api.savedMemory.thisWeek, {})).resolves.toBeNull();
    await ana.mutation(api.users.updatePreferences, { savedMemoryEnabled: true });
    await expect(ana.query(api.savedMemory.thisWeek, {})).resolves.not.toBeNull();
  });

  it("no expone guardados ajenos ni responde sin sesión", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(hn("2026-09-30"));
    const { t } = await seed("memory_owner");
    const beto = t.withIdentity({ subject: "memory_beto", issuer: "https://example-dev.clerk.accounts.dev" });
    await beto.mutation(api.users.upsert, {});

    await expect(beto.query(api.savedMemory.thisWeek, {})).resolves.toBeNull();
    await expect(t.query(api.savedMemory.thisWeek, {})).resolves.toBeNull();
    await expect(t.mutation(api.savedMemory.dismiss, {})).rejects.toThrow("No autenticado");
  });
});
