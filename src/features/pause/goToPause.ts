import { router } from "expo-router";

import { PAUSE_ROUTE, pauseRouteParams, type PauseVerse } from "./pause";

/**
 * Entrada única al minuto de pausa (#203). Sin versículo usa el del día (para
 * el inicio); con versículo, el del devocional de Sentir del que se viene.
 */
export function goToPause(verse?: PauseVerse | null) {
  router.push({ pathname: PAUSE_ROUTE, params: pauseRouteParams(verse) });
}
