import { requestWidgetUpdate } from "react-native-android-widget";

import { hondurasToday } from "./verseWidget";
import { readingDayFor, readingWidgetProps, type ReadingWidgetDay } from "./readingWidget";
import { writeReadingWidgetDays } from "./readingWidgetCache";
import { READING_WIDGET_NAME, renderReadingWidget } from "./ReadingTodayWidget.android";

/**
 * Android: guarda los días para el task handler (que los lee sin conexión al
 * cambiar de día) y repinta el widget si está puesto. Con el bloqueo de #171
 * no se guarda nada personal.
 */
export async function updateReadingWidget(days: readonly ReadingWidgetDay[], options: { locked: boolean }): Promise<void> {
  await writeReadingWidgetDays(days, options.locked);
  const props = readingWidgetProps(readingDayFor(days, hondurasToday()), options);
  await requestWidgetUpdate({ widgetName: READING_WIDGET_NAME, renderWidget: () => renderReadingWidget(props) });
}
