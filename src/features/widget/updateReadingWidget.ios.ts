import { readingWidgetTimeline, type ReadingWidgetDay } from "./readingWidget";
import { ReadingTodayWidget } from "./ReadingTodayWidget.ios";

/**
 * iOS: un día por entrada; WidgetKit avanza solo a medianoche. Con el bloqueo
 * de #171 la línea de tiempo lleva una sola entrada sin datos personales.
 */
export async function updateReadingWidget(days: readonly ReadingWidgetDay[], options: { locked: boolean }): Promise<void> {
  ReadingTodayWidget.updateTimeline(readingWidgetTimeline(days, options));
}
