import * as Speech from "expo-speech";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { ChapterSpeechController, type ChapterSpeechState, type SpeakableVerse, type SpeechEngine } from "./chapterSpeech";

const engine: SpeechEngine = {
  speak: (text, options) =>
    Speech.speak(text, {
      language: options.language,
      voice: options.voice,
      onDone: options.onDone,
      onStopped: options.onStopped,
      onError: options.onError,
    }),
  stop: () => void Speech.stop().catch(() => undefined),
  getVoices: () => Speech.getAvailableVoicesAsync(),
};

/**
 * Escuchar el capítulo en el lector (#157). Una cola por capítulo: cambiar de
 * capítulo, salir del lector o abrir otra pantalla encima corta el audio
 * (criterio de aceptación del issue).
 */
export function useChapterSpeech(chapter: { book: string; chapter: number } | null, verses: readonly SpeakableVerse[] | undefined) {
  const [state, setState] = useState<ChapterSpeechState>({ status: "idle" });
  const controller = useRef<ChapterSpeechController | null>(null);
  const book = chapter?.book ?? null;
  const chapterNumber = chapter?.chapter ?? null;

  useEffect(() => {
    if (book === null || chapterNumber === null) return;
    const current = new ChapterSpeechController(engine, { book, chapter: chapterNumber }, setState);
    controller.current = current;
    return () => {
      current.stop();
      if (controller.current === current) controller.current = null;
      setState({ status: "idle" });
    };
  }, [book, chapterNumber]);

  // Otra pantalla encima del lector (Preguntar, Voces, la línea del tiempo): se corta.
  useFocusEffect(
    useCallback(
      () => () => {
        controller.current?.stop();
      },
      [],
    ),
  );

  // La app pasa a segundo plano: se pausa (la voz del sistema no sigue sola en Android).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") controller.current?.pause();
    });
    return () => subscription.remove();
  }, []);

  const versesRef = useRef(verses);
  versesRef.current = verses;

  const play = useCallback((fromVerse?: number | null) => {
    const list = versesRef.current;
    if (!list || list.length === 0) return;
    void controller.current?.play(list, fromVerse);
  }, []);
  const pause = useCallback(() => controller.current?.pause(), []);
  const resume = useCallback(() => controller.current?.resume(), []);
  const stop = useCallback(() => controller.current?.stop(), []);

  return { state, play, pause, resume, stop };
}
