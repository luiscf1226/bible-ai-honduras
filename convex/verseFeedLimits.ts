// Límites del feed de versículos que comparten servidor y app. Viven aparte
// para que la app no cargue el catálogo (`verseFeedCore.ts`) solo por un número.

export const FEED_PAGE_SIZE = 8;
/** Cuántas citas vistas recuerda el cliente para no repetirlas. */
export const FEED_SEEN_MAX = 400;
