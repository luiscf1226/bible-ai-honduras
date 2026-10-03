import type { ReadingWidgetDay } from "./readingWidget";

/** Web y cualquier plataforma sin widget: no hay nada que actualizar. */
export async function updateReadingWidget(_days: readonly ReadingWidgetDay[], _options: { locked: boolean }): Promise<void> {}
