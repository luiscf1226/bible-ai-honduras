import type { WidgetVerseDay } from "./verseWidget";

/** Web y cualquier plataforma sin widget: no hay nada que actualizar. */
export async function updateVerseWidget(_days: readonly WidgetVerseDay[]): Promise<void> {}
