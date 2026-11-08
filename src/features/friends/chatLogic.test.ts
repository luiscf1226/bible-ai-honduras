import { describe, expect, it } from "vitest";

import { buildChatItems, dayLabel, listTimeLabel } from "./chatLogic";

// Domingo 8 de noviembre de 2026, 10:00 en Honduras (UTC-6).
const NOW = Date.parse("2026-11-08T10:00:00-06:00");
const at = (iso: string) => Date.parse(`${iso}-06:00`);

describe("chatLogic", () => {
  it("días con el calendario de Honduras", () => {
    expect(dayLabel(at("2026-11-08T00:30:00"), NOW)).toBe("Hoy");
    // 23:30 del sábado en Honduras ya es domingo en UTC: sigue siendo "Ayer".
    expect(dayLabel(at("2026-11-07T23:30:00"), NOW)).toBe("Ayer");
    expect(dayLabel(at("2026-11-02T12:00:00"), NOW)).toMatch(/lunes.*2.*noviembre/);
  });

  it("separador por día y Visto solo en mi último mensaje leído", () => {
    const messages = [
      { id: "a", fromMe: false, createdAt: at("2026-11-07T20:00:00") },
      { id: "b", fromMe: true, createdAt: at("2026-11-08T09:00:00") },
      { id: "c", fromMe: true, createdAt: at("2026-11-08T09:05:00") },
    ];
    const items = buildChatItems(messages, at("2026-11-08T09:06:00"), NOW);
    expect(items.map((item) => (item.kind === "day" ? item.label : `${item.key}${item.seen ? "✓" : ""}`))).toEqual([
      "Ayer",
      "a",
      "Hoy",
      "b",
      "c✓",
    ]);
    const unseen = buildChatItems(messages, at("2026-11-08T09:01:00"), NOW);
    expect(unseen.some((item) => item.kind === "message" && item.seen)).toBe(false);
    expect(buildChatItems(messages, null, NOW).some((item) => item.kind === "message" && item.seen)).toBe(false);
  });

  it("hora corta de la lista", () => {
    expect(listTimeLabel(null, NOW)).toBeNull();
    expect(listTimeLabel(at("2026-11-07T20:00:00"), NOW)).toBe("Ayer");
    expect(listTimeLabel(at("2026-11-08T09:05:00"), NOW)).toMatch(/9:05/);
  });
});
