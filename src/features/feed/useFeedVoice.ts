import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

import { feedVoiceAction } from "./feedLogic";

// Silencio para toda la sesión: si la persona lo apagó, sigue apagado al volver a entrar.
let sessionMuted = false;

/**
 * Voz del feed de versículos: lee el versículo que está en pantalla, como el
 * sonido de un video de TikTok. Un solo reproductor para todo el feed: al
 * deslizar cambia la pista; al salir de la pantalla (o abrir "Leer") se
 * pausa. Respeta el interruptor de silencio del iPhone y no suena en segundo
 * plano.
 */
export function useFeedVoice(audioUrl: string | null, focused: boolean) {
  const player = useAudioPlayer(null);
  const [muted, setMuted] = useState(sessionMuted);
  const loaded = useRef<string | null>(null);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      interruptionMode: "duckOthers",
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      if (feedVoiceAction({ audioUrl, focused, muted }) === "pause") {
        player.pause();
        return;
      }
      if (audioUrl && loaded.current !== audioUrl) {
        player.replace({ uri: audioUrl });
        loaded.current = audioUrl;
      } else {
        // La misma pista otra vez (volvió al foco o quitó el silencio): desde el principio.
        void player.seekTo(0).catch(() => undefined);
      }
      player.play();
    } catch {
      // Sin audio el feed sigue igual: la voz es un extra.
    }
  }, [audioUrl, focused, muted, player]);

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      sessionMuted = !current;
      return !current;
    });
  }, []);

  return { muted, toggleMuted };
}
