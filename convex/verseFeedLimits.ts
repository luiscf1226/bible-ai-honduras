// Límites del feed de versículos que comparten servidor y app. Viven aparte
// para que la app no cargue el catálogo (`verseFeedCore.ts`) solo por un número.

export const FEED_PAGE_SIZE = 8;
/**
 * Cuántas citas vistas en la vuelta actual manda el cliente para no repetirlas.
 * Tiene que ser más que el catálogo entero (test en verseFeedCore.test.ts):
 * si no, el servidor volvería a ofrecer lo que la persona ya vio.
 */
export const FEED_SEEN_MAX = 1000;
/** Cuando ya se vio todo, la vuelta nueva no repite las últimas que se vieron. */
export const FEED_RECENT_GUARD = 24;
