import { ConvexHttpClient } from "convex/browser";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import { api } from "../../../convex/_generated/api";
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
