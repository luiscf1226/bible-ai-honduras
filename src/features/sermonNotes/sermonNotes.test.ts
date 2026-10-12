import { describe, expect, it } from "vitest";

import {
  addSermonPassage,
  buildSermonShareText,
  emptySermonNote,
  filterSermonNotes,
  isEmptySermonNote,
  lastUsedChurchAndPreacher,
  newSermonClientId,
  removeSermonPassage,
  sermonDateLabel,
  sermonDisplayTitle,
  sermonToday,
  shiftDateKey,
  toSermonInput,
  type SermonNote,
} from "./sermonNotes";

const base: SermonNote = {
  clientId: "sn-test-0001",
  date: "2026-10-11",
  church: "Iglesia Bethel",
  preacher: "Pastor Daniel Mejía",
  title: "Dios es nuestro amparo",
  passages: [
    { book: "Salmos", chapter: 46, verse: 1 },
    { book: "Juan", chapter: 3 },
  ],
  notes: "Refugio, fuerza, ayuda.",
  takeaway: "No tengo que esperar a que pase la tormenta.",
};

describe("notas de prédica: lógica pura (#232)", () => {
  it("el texto para WhatsApp no lleva las notas libres salvo que se marque", () => {
    const sin = buildSermonShareText(base, { includeNotes: false });
    expect(sin).toContain("Dios es nuestro amparo");
    expect(sin).toContain("domingo 11 de octubre de 2026");
    expect(sin).toContain("Pastor Daniel Mejía · Iglesia Bethel");
    expect(sin).toContain("Pasajes: Salmos 46:1, Juan 3");
    expect(sin).toContain("Me llevo: No tengo que esperar a que pase la tormenta.");
    expect(sin).not.toContain("Refugio, fuerza, ayuda.");
    expect(buildSermonShareText(base, { includeNotes: true })).toContain("Refugio, fuerza, ayuda.");
  });

  it("busca por título, predicador o pasaje, sin tildes", () => {
    const otra: SermonNote = { ...base, clientId: "sn-2", title: "Nacer de nuevo", preacher: "Hna. Karla", passages: [{ book: "Rut", chapter: 1 }] };
    const notes = [base, otra];
    expect(filterSermonNotes(notes, "amparo").map((n) => n.clientId)).toEqual(["sn-test-0001"]);
    expect(filterSermonNotes(notes, "mejia").map((n) => n.clientId)).toEqual(["sn-test-0001"]);
    expect(filterSermonNotes(notes, "rut 1").map((n) => n.clientId)).toEqual(["sn-2"]);
    expect(filterSermonNotes(notes, "salmos 46:1").map((n) => n.clientId)).toEqual(["sn-test-0001"]);
    expect(filterSermonNotes(notes, "  ")).toHaveLength(2);
  });

  it("recuerda la última iglesia y el último predicador", () => {
    const vieja: SermonNote = { ...base, clientId: "a", church: "Iglesia Vieja", preacher: "", updatedAt: 1 };
    const nueva: SermonNote = { ...base, clientId: "b", church: "", preacher: "Pastor Nuevo", updatedAt: 2 };
    expect(lastUsedChurchAndPreacher([vieja, nueva])).toEqual({ church: "Iglesia Vieja", preacher: "Pastor Nuevo" });
    expect(lastUsedChurchAndPreacher([])).toEqual({ church: "", preacher: "" });
    const fresh = emptySermonNote({ clientId: "c", today: "2026-10-11", lastUsed: { church: "Bethel", preacher: "Daniel" } });
    expect(fresh).toMatchObject({ date: "2026-10-11", church: "Bethel", preacher: "Daniel", title: "", passages: [] });
    expect(isEmptySermonNote(fresh)).toBe(true);
  });

  it("los pasajes no se repiten y respetan el máximo", () => {
    const one = addSermonPassage([], { book: "Juan", chapter: 3, verse: 16 }, 2);
    expect(addSermonPassage(one, { book: "Juan", chapter: 3, verse: 16 }, 2)).toHaveLength(1);
    const two = addSermonPassage(one, { book: "Juan", chapter: 3 }, 2);
    expect(two).toHaveLength(2);
    expect(addSermonPassage(two, { book: "Rut", chapter: 1 }, 2)).toHaveLength(2);
    expect(removeSermonPassage(two, { book: "Juan", chapter: 3 })).toEqual([{ book: "Juan", chapter: 3, verse: 16 }]);
  });

  it("título para la lista: el escrito, o el primer pasaje, o la fecha", () => {
    expect(sermonDisplayTitle(base)).toBe("Dios es nuestro amparo");
    expect(sermonDisplayTitle({ ...base, title: " " })).toBe("Salmos 46:1");
    expect(sermonDisplayTitle({ ...base, title: "", passages: [] })).toBe("Prédica del domingo 11 de octubre de 2026");
  });

  it("fechas: hoy en Honduras, ‹ › sin pasarse de hoy, y etiqueta sin corrimiento de zona", () => {
    // 12 de octubre 03:00 UTC = 11 de octubre 21:00 en Honduras.
    expect(sermonToday(Date.UTC(2026, 9, 12, 3))).toBe("2026-10-11");
    expect(shiftDateKey("2026-10-11", -7)).toBe("2026-10-04");
    expect(shiftDateKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDateKey("2026-10-11", 1, "2026-10-11")).toBe("2026-10-11");
    expect(sermonDateLabel("2026-10-11")).toBe("domingo 11 de octubre de 2026");
  });

  it("el identificador es único y válido para el servidor", () => {
    const a = newSermonClientId(1, () => 0.1);
    const b = newSermonClientId(2, () => 0.9);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it("al servidor van solo los campos del contrato", () => {
    const withMeta = { ...base, pending: true, createdAt: 1, updatedAt: 2 };
    expect(Object.keys(toSermonInput(withMeta)).sort()).toEqual(
      ["church", "clientId", "date", "notes", "passages", "preacher", "takeaway", "title"].sort(),
    );
  });
});
