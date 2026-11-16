import type { RefObject } from "react";
import { PixelRatio, Platform, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { asFileUri } from "../../lib/share";
import { storyCaptureSize, type StoryFormat } from "./verseStoryLayout";

// Si la foto tarda, la imagen se captura igual (con el fondo liso de abajo)
// antes que dejar a la persona esperando.
const STORY_IMAGE_WAIT_MS = 4000;
const STORY_IMAGE_POLL_MS = 100;

/**
 * Captura la `VerseStoryCard` fuera de pantalla a 1080×1920 (o 1080×1080) y
 * devuelve el archivo listo para `shareImage`. Única captura de la app: la
 * usan `/hoy`, "Dedicar" y "Crear imagen". `imageReady` dice si la foto de
 * fondo ya cargó (o falló); sin foto, no se espera.
 */
export async function captureStoryImage(
  view: RefObject<View | null>,
  options: { format?: StoryFormat; imageReady?: () => boolean } = {},
): Promise<string> {
  const { format = "story", imageReady } = options;
  for (let waited = 0; imageReady && !imageReady() && waited < STORY_IMAGE_WAIT_MS; waited += STORY_IMAGE_POLL_MS) {
    await new Promise((resolve) => setTimeout(resolve, STORY_IMAGE_POLL_MS));
  }
  const uri = await captureRef(view, {
    format: "png",
    quality: 1,
    result: Platform.OS === "web" ? "data-uri" : "tmpfile",
    ...storyCaptureSize(Platform.OS, PixelRatio.get(), undefined, format),
  });
  return asFileUri(uri);
}
