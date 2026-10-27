import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { feedVoiceAction } from "./feedLogic";

// Silencio para toda la sesión: si la persona lo apagó (o lo prendió), sigue así al volver a entrar.
// `null` = todavía no eligió: arranca en silencio solo si usa VoiceOver/TalkBack, para no hablarle encima.
let sessionMuted: boolean | null = null;

/**
 * Voz del feed de versículos: lee el versículo que está en pantalla, como el
 * sonido de un video de TikTok. Un solo reproductor para todo el feed: al
 * deslizar cambia la pista; al salir de la pantalla (o abrir "Leer") se
 * pausa. Respeta el interruptor de silencio del iPhone, no corta la música
 * que la persona tenga sonando y no suena en segundo plano.
 */
export function useFeedVoice(audioUrl: string | null, focused: boolean) {
  const player = useAudioPlayer(null);
  const [muted, setMuted] = useState(sessionMuted ?? false);
  const loaded = useRef<string | null>(null);

  useEffect(() => {
    // iOS no acepta "respetar el silencio" junto con "bajar el volumen de lo demás": se mezcla.
    setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      interruptionMode: "mixWithOthers",
    }).catch((error: unknown) => console.warn("No se pudo configurar el audio del feed", error));
    if (sessionMuted !== null) return;
    let current = true;
    AccessibilityInfo.isScreenReaderEnabled().then(
      (enabled) => {
        if (current && enabled && sessionMuted === null) setMuted(true);
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
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
        void player.seekTo(0).then(
          () => player.play(),
          () => player.play(),
        );
        return;
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
