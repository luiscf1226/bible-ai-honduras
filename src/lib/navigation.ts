/** Ruta de aterrizaje cuando no hay historial que desapilar (#106). */
export const HOME_ROUTE = "/home";

/** Lo mínimo que se necesita del router de expo; inyectable para tests. */
export type BackNavigator = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: string) => void;
};

/**
 * Vuelve en el stack si se puede; si no (arranque en frío, deep link), aterriza
 * en Home. Evita que una pantalla quede sin salida — la causa del issue #106.
 *
 * Este módulo no importa `expo-router` a propósito: así la lógica queda pura y
 * testeable en vitest. Quien la usa inyecta el router real (ver `ScreenHeader`).
 */
export function goBackOrHomeWith(nav: BackNavigator) {
  if (nav.canGoBack()) {
    nav.back();
    return;
  }
  nav.replace(HOME_ROUTE);
}
