import { describe, expect, it } from "vitest";

import { tokens } from "../../theme/tokens";
import {
  coversToday,
  hondurasMidnight,
  hondurasToday,
  pickDay,
  truncateVerse,
  WIDGET_DEEP_LINK,
  WIDGET_FALLBACK_TEXT,
  WIDGET_PALETTE,
  widgetProps,
  widgetTimeline,
  type WidgetVerseDay,
} from "./verseWidget";

const day = (date: string, text: string | null = `Texto ${date}`): WidgetVerseDay => ({
  date,
  verseRef: `Salmos 23:${date.slice(-1)}`,
  text,
  version: "RV1909",
});

describe("widget del versículo del día (#170)", () => {
  it("cambia de día a la medianoche de Honduras, no del teléfono", () => {
    expect(hondurasMidnight("2026-09-30").toISOString()).toBe("2026-09-30T06:00:00.000Z");
    expect(hondurasToday(Date.UTC(2026, 8, 30, 5, 59))).toBe("2026-09-29");
    expect(hondurasToday(Date.UTC(2026, 8, 30, 6, 0))).toBe("2026-09-30");
  });

  it("muestra el de hoy, y sin conexión se queda con el último que bajó", () => {
    const days = [day("2026-09-29"), day("2026-09-30"), day("2026-10-01")];
    expect(pickDay(days, "2026-09-30")?.date).toBe("2026-09-30");
    expect(pickDay(days, "2026-10-15")?.date).toBe("2026-10-01");
    expect(pickDay([], "2026-09-30")).toBeNull();
    expect(coversToday(days, "2026-10-15")).toBe(false);
  });

  it("recorta en palabra completa según el tamaño", () => {
    const long = "Jehová es mi pastor; nada me faltará. ".repeat(10).trim();
    const small = truncateVerse(long, "small");
    expect(small.length).toBeLessThanOrEqual(91);
    expect(small.endsWith("…")).toBe(true);
    expect(truncateVerse(long, "medium").length).toBeGreaterThan(small.length);
    expect(truncateVerse("Corto.", "small")).toBe("Corto.");
  });

  it("abre el devocional del día y usa los colores de los tokens en claro y oscuro", () => {
    const props = widgetProps(day("2026-09-30", null));
    expect(props.url).toBe(WIDGET_DEEP_LINK);
    expect(props.textSmall).toBe(WIDGET_FALLBACK_TEXT);
    expect(WIDGET_PALETTE.light.bg).toBe(tokens.color.surface);
    expect(WIDGET_PALETTE.dark.bg).toBe(tokens.night.color.surface);
  });

  it("arma una línea de tiempo: hoy ya, y cada día siguiente a su medianoche", () => {
    const now = Date.UTC(2026, 8, 30, 15);
    const entries = widgetTimeline([day("2026-09-29"), day("2026-09-30"), day("2026-10-01"), day("2026-10-02")], now);
    expect(entries.map((entry) => entry.props.verseRef)).toEqual(["Salmos 23:0", "Salmos 23:1", "Salmos 23:2"]);
    expect(entries[0].date.getTime()).toBe(now);
    expect(entries[1].date.toISOString()).toBe("2026-10-01T06:00:00.000Z");
  });
});
