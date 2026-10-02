import { VerseOfTheDayWidget } from "./VerseOfTheDayWidget.ios";
import { widgetTimeline, type WidgetVerseDay } from "./verseWidget";

/** iOS: le deja al widget un día por entrada; WidgetKit avanza solo a medianoche. */
export async function updateVerseWidget(days: readonly WidgetVerseDay[]): Promise<void> {
  const entries = widgetTimeline(days);
  if (entries.length > 0) VerseOfTheDayWidget.updateTimeline(entries);
}
