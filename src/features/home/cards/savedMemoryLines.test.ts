import { describe, expect, it } from "vitest";

import { pickSavedMemory, type MemoryCandidate } from "../../../../convex/savedMemory";
import {
  savedMemoryDate,
  savedMemoryMeta,
  savedMemoryNote,
  savedMemoryReference,
  savedMemoryRoute,
  type SavedMemoryLike,
} from "./savedMemoryLines";

/** Mediodía en Honduras (UTC-6) del día dado. */
function hn(date: string): number {
  return Date.parse(`${date}T12:00:00-06:00`);
}

function saved(date: string, book = "Salmos", chapter = 23, verse = 1): MemoryCandidate {
  return { book, chapter, verse, createdAt: hn(date) };
}

const MEMORY: SavedMemoryLike = {
  book: "Isaías",
  chapter: 41,
  verse: 10,
  createdAt: hn("2025-10-01"),
  version: "RV1909",
  text: "No temas, que yo soy contigo;",
  note: "Lo leí antes de la entrevista.",
};

describe("tarjeta 'Hace un año guardaste…' (#172)", () => {
  it("abre el lector en el versículo guardado", () => {
    expect(savedMemoryRoute(MEMORY)).toEqual({
      pathname: "/leer/[book]/[chapter]",
      params: { book: "Isaías", chapter: "41", verse: "10" },
    });
    expect(savedMemoryReference(MEMORY)).toBe("Isaías 41:10");
  });

  it("la fecha es la de Honduras, aunque en UTC ya sea otro día", () => {
    // 31 dic 2025 22:00 en Honduras = 1 ene 2026 04:00 UTC.
    expect(savedMemoryDate(Date.parse("2026-01-01T04:00:00Z"))).toBe("31 de diciembre de 2025");
    expect(savedMemoryDate(hn("2024-02-29"))).toBe("29 de febrero de 2024");
  });

  it("la línea de abajo lleva referencia, versión y fecha; sin texto no repite la referencia", () => {
    expect(savedMemoryMeta(MEMORY)).toBe("Isaías 41:10 · RV1909 · guardado el 1 de octubre de 2025");
    expect(savedMemoryMeta({ ...MEMORY, text: null })).toBe("RV1909 · guardado el 1 de octubre de 2025");
  });

  it("una nota vacía o de puros espacios cuenta como sin nota", () => {
    expect(savedMemoryNote("  Lo leí antes de la entrevista. ")).toBe("Lo leí antes de la entrevista.");
    expect(savedMemoryNote("   ")).toBeNull();
    expect(savedMemoryNote(null)).toBeNull();
  });
});

describe("selector del servidor: ventana de fechas, bisiestos y vacío", () => {
  const FILLER = [saved("2026-01-10", "Juan", 3, 16), saved("2026-01-20", "Romanos", 8, 28)];

  it("sin guardados no hay tarjeta", () => {
    expect(pickSavedMemory([], "u", hn("2026-10-02"))).toBeNull();
  });

  it("la ventana de 30 días cruza bien un febrero bisiesto", () => {
    // 30 mar 2028 − 30 días = 29 feb 2028 (bisiesto): ese día ya cuenta, el 1 mar no.
    const now = hn("2028-03-30");
    const recent = [saved("2028-03-10"), saved("2028-03-20")];
    expect(pickSavedMemory([...recent, saved("2028-02-29", "Isaías", 41, 10)], "u", now)?.bookmark.book).toBe("Isaías");
    expect(pickSavedMemory([...recent, saved("2028-03-01", "Isaías", 41, 10)], "u", now)).toBeNull();
  });

  it("un guardado del 29 de febrero vuelve como 'Hace N años' en la semana del 29 de otro bisiesto", () => {
    const pick = pickSavedMemory([...FILLER, saved("2024-02-29", "Josué", 1, 9)], "u", hn("2028-03-01"));
    expect(pick?.bookmark.book).toBe("Josué");
    expect(pick?.yearsAgo).toBe(4);
    expect(pick?.headline).toBe("Hace 4 años guardaste…");
  });

  it("en un año no bisiesto el guardado del 29 de febrero sigue siendo elegible", () => {
    const bookmarks = [saved("2024-02-29", "Josué", 1, 9), saved("2024-05-01"), saved("2024-06-01")];
    const pick = pickSavedMemory(bookmarks, "u", hn("2025-02-26"));
    expect(pick).not.toBeNull();
    // No hay 29 de febrero en esa semana: no es "Hace un año", es uno al azar.
    expect(pick?.yearsAgo).toBeNull();
  });

  it("mismo usuario y semana → mismo versículo", () => {
    const bookmarks = [...FILLER, saved("2025-03-01"), saved("2025-07-15", "Rut", 1, 16)];
    const first = pickSavedMemory(bookmarks, "user_a", hn("2026-09-28"));
    expect(pickSavedMemory(bookmarks, "user_a", hn("2026-10-04"))?.bookmark).toEqual(first?.bookmark);
  });
});
