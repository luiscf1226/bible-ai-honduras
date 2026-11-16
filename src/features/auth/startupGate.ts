/**
 * Topes del arranque (`app/_layout.tsx`) — rechazo 2.1(a) de la 1.0.2: "la app
 * muestra una pantalla en blanco indefinidamente al abrir".
 *
 * La regla: **el arranque nunca espera algo para siempre y nunca se queda sin
 * nada en pantalla.** Cada espera tiene un tope, y mientras dura se ve el logo,
 * no una pantalla vacía.
 *
 * Sin dependencias de React Native, igual que `startupRoute.ts`, para poder
 * probarlo en vitest.
 */

/** Las fuentes vienen en el binario: si no cargaron en este tiempo, se sigue con las del sistema. */
export const FONTS_TIMEOUT_MS = 4_000;

/** Si Clerk no terminó de cargar en este tiempo, se ofrece reintentar (recarga la app). */
export const CLERK_LOAD_RETRY_MS = 12_000;

export type FontsState = {
  /** `useFonts()[0]` de cada familia. */
  loaded: boolean[];
  /** `useFonts()[1]` de cada familia: con error se sigue igual, con la fuente del sistema. */
  errors: (Error | null)[];
  /** Pasó `FONTS_TIMEOUT_MS`. */
  timedOut: boolean;
};

/** ¿Se puede pintar la app? Fuentes listas, con error o vencido el tope: nunca "todavía no" para siempre. */
export function fontsReady({ errors, loaded, timedOut }: FontsState): boolean {
  if (timedOut) return true;
  return loaded.every((isLoaded, index) => isLoaded || errors[index] != null);
}
