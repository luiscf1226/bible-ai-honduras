import { ConvexHttpClient } from "convex/browser";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import { api } from "../../../convex/_generated/api";
import { readingDayFor, readingWidgetProps } from "./readingWidget";
import { readReadingWidgetDays, readReadingWidgetLocked } from "./readingWidgetCache";
import { READING_WIDGET_NAME, renderReadingWidget } from "./ReadingTodayWidget.android";
import { ANDROID_WIDGET_SIZES, renderVerseWidget } from "./VerseOfTheDayWidget.android";
import { coversToday, hondurasToday, pickDay, widgetProps } from "./verseWidget";
import { readWidgetDays, writeWidgetDays } from "./widgetCache";

/**
 * Corre en segundo plano cuando Android agrega, actualiza o redimensiona el
 * widget. Usa lo que dejó la app; si ya no alcanza para hoy, intenta bajar
 * días nuevos (sin sesión: versión por defecto). Sin conexión, queda el último.
 */
export async function verseWidgetTaskHandler({ widgetAction, widgetInfo, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === "WIDGET_DELETED" || widgetAction === "WIDGET_CLICK") return;

  if (widgetInfo.widgetName === READING_WIDGET_NAME) {
    // "Tu lectura de hoy" (#184): necesita sesión, así que no se baja nada
    // acá. Usa lo que dejó la app; si no llega a hoy, el aviso de abrirla.
    const [days, locked] = await Promise.all([readReadingWidgetDays(), readReadingWidgetLocked()]);
    renderWidget(renderReadingWidget(readingWidgetProps(readingDayFor(days, hondurasToday()), { locked })));
    return;
  }

  const size = ANDROID_WIDGET_SIZES[widgetInfo.widgetName] ?? "small";
  const today = hondurasToday();

  let days = await readWidgetDays();
  if (!coversToday(days, today) && process.env.EXPO_PUBLIC_CONVEX_URL) {
    try {
      days = await new ConvexHttpClient(process.env.EXPO_PUBLIC_CONVEX_URL).query(api.devotional.widgetDays, {});
      await writeWidgetDays(days);
    } catch {
      // Sin conexión: se queda con lo que había.
    }
  }

  const day = pickDay(days, today);
  if (day) renderWidget(renderVerseWidget(widgetProps(day), size));
}
