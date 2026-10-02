import { tokens } from "../../theme/tokens";

/**
 * Widget del versículo del día (#170). Lógica compartida entre el widget de
 * iOS (expo-widgets) y el de Android (react-native-android-widget).
 *
 * La app le deja al widget una línea de tiempo de varios días
 * (`devotional.widgetDays`): cada día empieza a la medianoche de Honduras y el
 * widget avanza solo, sin conexión. Si la app no se abre por más días de los
 * que bajó, se queda en el último.
 */

export type WidgetVerseDay = {
  date: string; // YYYY-MM-DD, calendario de Honduras
  verseRef: string;
  text: string | null;
  version: string;
};

/** Al tocar el widget se abre el devocional del día, ya desplegado. */
export const WIDGET_DEEP_LINK = "bibleai://home?devocional=1";

export const WIDGET_BRAND = "Bible AI Honduras";
export const WIDGET_FALLBACK_TEXT = "Abrí la app para leer el versículo de hoy.";

// Honduras no tiene horario de verano: la medianoche local siempre es 06:00 UTC.
const HONDURAS_MIDNIGHT_UTC_HOUR = 6;

export function hondurasMidnight(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, HONDURAS_MIDNIGHT_UTC_HOUR));
}

export function hondurasToday(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date(now));
}

/** El día de hoy; si ya pasaron todos los que bajó, el último; si no hay ninguno, null. */
export function pickDay(days: readonly WidgetVerseDay[], today: string): WidgetVerseDay | null {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let picked: WidgetVerseDay | null = null;
  for (const day of sorted) {
    if (day.date <= today) picked = day;
  }
  return picked ?? sorted[0] ?? null;
}

/** ¿Queda al menos un día por delante en lo que bajó? Si no, conviene refrescar. */
export function coversToday(days: readonly WidgetVerseDay[], today: string): boolean {
  return days.some((day) => day.date === today);
}

export type WidgetSize = "small" | "medium";

const MAX_CHARS: Record<WidgetSize, number> = { small: 90, medium: 180 };

/** Recorta en una palabra completa y agrega "…". El sistema recorta también por líneas. */
export function truncateVerse(text: string, size: WidgetSize): string {
  return truncateAtWord(text, MAX_CHARS[size]);
}

/** Recorta `text` a `max` caracteres (más el "…") sin partir una palabra. */
export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/**
 * Paleta del widget, sacada de los tokens (regla dura #1). El widget de iOS se
 * serializa aparte del bundle de la app y no puede importar `tokens.ts`, así
 * que viaja en las props.
 */
export type WidgetPalette = { bg: string; ink: string; inkMuted: string; accent: string };

export const WIDGET_PALETTE: { light: WidgetPalette; dark: WidgetPalette } = {
  light: {
    bg: tokens.color.surface,
    ink: tokens.color.ink,
    inkMuted: tokens.color.inkMuted,
    accent: tokens.color.accent,
  },
  dark: {
    bg: tokens.night.color.surface,
    ink: tokens.night.color.ink,
    inkMuted: tokens.night.color.inkMuted,
    accent: tokens.night.color.accent,
  },
};

export const WIDGET_TYPE = {
  verse: tokens.type.bodySm.size,
  verseMedium: tokens.type.body.size,
  reference: tokens.type.caption.size,
  brand: tokens.type.overline.size,
  padding: tokens.space.lg,
  gap: tokens.space.xs,
};

export type VerseWidgetProps = {
  verseRef: string;
  version: string;
  textSmall: string;
  textMedium: string;
  brand: string;
  url: string;
  palette: typeof WIDGET_PALETTE;
  type: typeof WIDGET_TYPE;
};

export function widgetProps(day: WidgetVerseDay): VerseWidgetProps {
  const text = day.text ?? WIDGET_FALLBACK_TEXT;
  return {
    verseRef: day.verseRef,
    version: day.version,
    textSmall: truncateVerse(text, "small"),
    textMedium: truncateVerse(text, "medium"),
    brand: WIDGET_BRAND,
    url: WIDGET_DEEP_LINK,
    palette: WIDGET_PALETTE,
    type: WIDGET_TYPE,
  };
}

/** Línea de tiempo para iOS: una entrada por día, desde la medianoche de Honduras. */
export function widgetTimeline(days: readonly WidgetVerseDay[], now = Date.now()) {
  const today = hondurasToday(now);
  const current = pickDay(days, today);
  const upcoming = days.filter((day) => day.date > today).sort((a, b) => a.date.localeCompare(b.date));
  return [
    ...(current ? [{ date: new Date(now), props: widgetProps(current) }] : []),
    ...upcoming.map((day) => ({ date: hondurasMidnight(day.date), props: widgetProps(day) })),
  ];
}
