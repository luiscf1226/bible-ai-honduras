import { requestWidgetUpdate } from "react-native-android-widget";

import { ANDROID_WIDGET_SIZES, renderVerseWidget } from "./VerseOfTheDayWidget.android";
import { hondurasToday, pickDay, widgetProps, type WidgetVerseDay } from "./verseWidget";
import { writeWidgetDays } from "./widgetCache";

/**
 * Android: guarda los días para el task handler (que los lee sin conexión al
 * cambiar de día) y repinta los widgets que estén puestos.
 */
export async function updateVerseWidget(days: readonly WidgetVerseDay[]): Promise<void> {
  await writeWidgetDays(days);
  const day = pickDay(days, hondurasToday());
  if (!day) return;
  for (const [widgetName, size] of Object.entries(ANDROID_WIDGET_SIZES)) {
    await requestWidgetUpdate({ widgetName, renderWidget: () => renderVerseWidget(widgetProps(day), size) });
  }
}
