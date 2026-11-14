import dmSansLight from "@expo-google-fonts/dm-sans/300Light/DMSans_300Light.ttf";
import dmSansRegular from "@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf";
import dmSansMedium from "@expo-google-fonts/dm-sans/500Medium/DMSans_500Medium.ttf";
import ebGaramondRegular from "@expo-google-fonts/eb-garamond/400Regular/EBGaramond_400Regular.ttf";
import ebGaramondItalic from "@expo-google-fonts/eb-garamond/400Regular_Italic/EBGaramond_400Regular_Italic.ttf";
import { loadFont } from "@remotion/fonts";

import tokens from "../../design/tokens.json";

/**
 * El mismo contrato visual que la app (regla dura #1): todo color, letra,
 * radio y espacio sale de design/tokens.json. Este archivo solo lo adapta a
 * píxeles de video.
 */
export { tokens };
export const color = tokens.color;

// Los mismos archivos de fuente que carga la app (paquetes @expo-google-fonts),
// así el render no depende de internet.
export const font = { serif: tokens.font.serif, sans: tokens.font.sans };
const { light, regular, medium } = tokens.font.weight;
for (const [family, url, weight, style] of [
  [font.serif, ebGaramondRegular, regular, "normal"],
  [font.serif, ebGaramondItalic, regular, "italic"],
  [font.sans, dmSansLight, light, "normal"],
  [font.sans, dmSansRegular, regular, "normal"],
  [font.sans, dmSansMedium, medium, "normal"],
] as const) {
  void loadFont({ family, url, weight: String(weight), style });
}

/** Lienzo del video: 1080×1920, el mismo de la imagen para el estado de WhatsApp. */
export const story = tokens.storyImage;

export const FPS = 30;
export const seconds = (s: number) => Math.round(s * FPS);

/**
 * Ancho del teléfono del prototipo (`dw:402` en design/Bible AI Honduras.dc.html):
 * un punto de la app mide `appScale` píxeles en el video, igual que en las capturas.
 */
export const appWidth = 402;
export const appScale = story.width / appWidth;

/**
 * Zona que TikTok e Instagram no tapan con su interfaz, en píxeles del video:
 * pestañas arriba, descripción y música abajo, botones a la derecha. Son
 * medidas de esas apps, no del diseño de 3C. Lo importante queda adentro.
 */
export const safe = { top: 150, bottom: 420, left: story.paddingX, right: 150 };
/** Alto del video entre esas dos franjas, en píxeles. */
export const screenHeight = story.height - safe.top - safe.bottom;

/** Ritmo lento de la app (#203): fundidos sin rebote. En cuadros. */
export const motion = {
  fade: Math.round((tokens.motion.verseRise / 1000) * FPS),
  rise: tokens.motion.verseRiseDistance,
  crossfade: Math.round((tokens.motion.reelCrossfade / 1000) * FPS),
};
