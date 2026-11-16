/**
 * Voz del feed de versículos — apagada en la 1.0.2.
 *
 * La voz usaba `expo-audio`, el único módulo nativo nuevo entre el build 30
 * (que abrió bien en el iPad de App Review) y los builds 33 y 35, rechazados por
 * pantalla blanca al abrir (2.1(a), iPadOS 27). Hasta probarlo en iOS, el feed
 * va sin voz: no se muestra el botón de sonido y los reels avanzan con el tiempo
 * de lectura. La firma se mantiene para devolver la voz sin tocar la pantalla.
 */
export function useFeedVoice(_audioUrl: string | null, _focused: boolean, _onFinish?: () => void) {
  return { available: false, muted: true, speaking: false, toggleMuted: () => undefined };
}
