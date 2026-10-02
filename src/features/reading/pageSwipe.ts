/**
 * Pasar página deslizando (#195, U3). Se arma con `PanResponder` + `Animated`
 * de React Native: no hace falta `react-native-gesture-handler` ni
 * `react-native-pager-view` (no están instaladas) para un gesto horizontal
 * sobre un `ScrollView` vertical. Las reglas viven acá, puras, para testearlas.
 *
 * Son umbrales del gesto, no medidas visuales: no salen de `tokens.ts`.
 */

/** Movimiento mínimo antes de reclamar el gesto (no le roba el toque al versículo). */
export const SWIPE_CLAIM_DISTANCE = 12;
/** Fracción del ancho que hay que arrastrar para pasar de página. */
export const SWIPE_COMMIT_FRACTION = 0.22;
/** Velocidad (px/ms) que pasa de página aunque el arrastre sea corto. */
export const SWIPE_COMMIT_VELOCITY = 0.45;
/** En el borde del canon (Gn 1, Ap 22) la página se resiste. */
export const SWIPE_EDGE_RESISTANCE = 0.25;
/** Duración de la salida y la entrada de página, en ms. */
export const PAGE_TURN_MS = 200;
/** La página nueva entra desde esta fracción del ancho. */
export const PAGE_ENTER_FRACTION = 0.3;

export type SwipeDirection = "next" | "previous";

/** ¿Es un gesto horizontal claro? Si no, el scroll vertical sigue mandando. */
export function shouldClaimSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) > SWIPE_CLAIM_DISTANCE && Math.abs(dx) > Math.abs(dy) * 2;
}

/** Hacia la izquierda = siguiente capítulo, como al pasar la hoja de un libro. */
export function swipeDirection(dx: number): SwipeDirection {
  return dx < 0 ? "next" : "previous";
}

export function shouldTurnPage(dx: number, vx: number, width: number): boolean {
  return Math.abs(dx) > width * SWIPE_COMMIT_FRACTION || Math.abs(vx) > SWIPE_COMMIT_VELOCITY;
}

/** Desplazamiento que se pinta mientras se arrastra. */
export function dragOffset(dx: number, canTurn: boolean): number {
  return canTurn ? dx : dx * SWIPE_EDGE_RESISTANCE;
}

/**
 * La página nueva entra desde el lado contrario al que salió la vieja. La
 * pantalla nueva se monta con `router.replace`, así que la dirección se deja
 * acá un instante y la consume el primer render.
 */
let pendingEnter: SwipeDirection | null = null;

export function markPageEnter(direction: SwipeDirection) {
  pendingEnter = direction;
}

export function takePageEnter(): SwipeDirection | null {
  const direction = pendingEnter;
  pendingEnter = null;
  return direction;
}

/** Desde dónde entra (signo × fracción del ancho). */
export function enterOffset(direction: SwipeDirection | null, width: number): number {
  if (!direction) return 0;
  return (direction === "next" ? 1 : -1) * width * PAGE_ENTER_FRACTION;
}
