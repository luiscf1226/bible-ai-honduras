import { describe, expect, it } from "vitest";

import {
  emptyPrayersCopy,
  PRAYER_MAX_LENGTH,
  prayerDateLabel,
  prayerDraft,
  prayerFilterOptions,
  splitPrayers,
} from "./prayerJournal";

/** Mediodía en Honduras (UTC-6). */
const hn = (date: string) => Date.parse(`${date}T12:00:00-06:00`);

describe("diario de oración (#159)", () => {
  it("el borrador sale de lo que escribió, o de los sentimientos elegidos", () => {
    expect(prayerDraft(["Ansiedad"], "  Me siento solo desde que me mudé  ")).toBe("Me siento solo desde que me mudé");
    expect(prayerDraft(["Ansiedad", "Sin trabajo"], "  ")).toBe("Ansiedad · Sin trabajo");
    expect(prayerDraft([], "")).toBe("");
    expect(prayerDraft([], "a".repeat(PRAYER_MAX_LENGTH + 20))).toHaveLength(PRAYER_MAX_LENGTH);
  });

  it("separa abiertas y respondidas y las cuenta en los filtros", () => {
    const items = [{ answeredAt: null }, { answeredAt: 5 }, { answeredAt: null }];
    expect(splitPrayers(items).open).toHaveLength(2);
    expect(splitPrayers(items).answered).toHaveLength(1);
    expect(prayerFilterOptions(items)).toEqual([
      { id: "abiertas", label: "Abiertas (2)" },
      { id: "respondidas", label: "Respondidas (1)" },
    ]);
  });

  it("fecha de pedida y de respondida, en hora de Honduras", () => {
    const now = hn("2026-10-02");
    expect(prayerDateLabel({ createdAt: hn("2026-10-02"), answeredAt: null }, now)).toBe("Pedida hoy");
    expect(prayerDateLabel({ createdAt: hn("2026-10-01"), answeredAt: null }, now)).toBe("Pedida ayer");
    expect(prayerDateLabel({ createdAt: hn("2026-09-14"), answeredAt: hn("2026-10-01") }, now)).toMatch(
      /^Respondida ayer · pedida el 14 sept?\.?$/,
    );
  });

  it("cada pestaña vacía explica qué hacer, con voseo", () => {
    expect(emptyPrayersCopy("abiertas")).toContain("Escribí");
    expect(emptyPrayersCopy("respondidas")).toContain("marcala");
  });
});
