import { addDays } from "./devotional";
import type { SeasonInput } from "./seasons";

/**
 * BORRADOR — calendario de temporadas propuesto en el issue #199.
 *
 * **No está activado y nada lo siembra.** Ninguna mutation importa este
 * archivo: solo lo usan los tests y sirve de plantilla para cargar cada
 * temporada a mano con `npx convex run seasons:upsert '{...}'` cuando el
 * fundador ratifique el calendario y el tema de octubre. Todas salen con
 * `enabled: false` y sin imagen ni destacados (revisión pastoral). Octubre a
 * enero ya traen paleta: cada una tiene colores y guirnalda en
 * `tokens.season` / `tokens.seasonDecor` (design/oleada-ux.md §Decoración de
 * temporada).
 *
 * Ojo: octubre 2026 ya empezó. El plan de olas del issue recomienda que la
 * primera temporada real sea noviembre (Gratitud) o un octubre recortado.
 */
export const SEASON_CALENDAR_STATUS = "borrador-sin-ratificar" as const;

/**
 * Domingo de Resurrección (calendario gregoriano, algoritmo anónimo de
 * Meeus/Jones/Butcher). Devuelve YYYY-MM-DD.
 */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Semana Santa: del Domingo de Ramos al Domingo de Resurrección, inclusive. */
export function holyWeekRange(year: number): { startDate: string; endDate: string } {
  const easter = easterSunday(year);
  return { startDate: addDays(easter, -7), endDate: easter };
}

function month(year: number, monthNumber: number): { startDate: string; endDate: string } {
  const mm = String(monthNumber).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { startDate: `${year}-${mm}-01`, endDate: `${year}-${mm}-${lastDay}` };
}

/**
 * Calendario propuesto de octubre de `year` a septiembre de `year + 1`.
 * Semana Santa lleva `priority: 1` para ganarle a cualquier mes temático con
 * el que llegue a pisarse.
 */
export function proposedSeasonCalendar(year: number): SeasonInput[] {
  const next = year + 1;
  return [
    { slug: `reforma-${year}`, name: "Mes de la Reforma", ...month(year, 10), enabled: false, paletteKey: "reforma" },
    { slug: `gratitud-${year}`, name: "Mes de gratitud", ...month(year, 11), enabled: false, paletteKey: "gratitud" },
    { slug: `adviento-navidad-${year}`, name: "Adviento y Navidad", ...month(year, 12), enabled: false, paletteKey: "adviento" },
    { slug: `versiculo-del-anio-${next}`, name: "Tu versículo del año", ...month(next, 1), enabled: false, paletteKey: "anio-nuevo" },
    { slug: `semana-santa-${next}`, name: "Semana Santa", ...holyWeekRange(next), enabled: false, priority: 1 },
    { slug: `dia-de-la-madre-${next}`, name: "Día de la Madre", ...month(next, 5), enabled: false },
    { slug: `patria-y-biblia-${next}`, name: "Mes de la Patria y de la Biblia", ...month(next, 9), enabled: false },
  ];
}
