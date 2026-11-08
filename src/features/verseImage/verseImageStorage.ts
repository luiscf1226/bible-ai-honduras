import AsyncStorage from "@react-native-async-storage/async-storage";

import { parseSavedStyle, VERSE_IMAGE_STYLE_KEY, type VerseImageStyle } from "./verseImageLogic";

/** Último estilo de "Crear imagen": vive en el teléfono, no en el servidor. */
export async function readSavedStyle(): Promise<VerseImageStyle> {
  try {
    return parseSavedStyle(await AsyncStorage.getItem(VERSE_IMAGE_STYLE_KEY));
  } catch {
    return parseSavedStyle(null);
  }
}

export async function writeSavedStyle(style: VerseImageStyle): Promise<void> {
  try {
    await AsyncStorage.setItem(VERSE_IMAGE_STYLE_KEY, JSON.stringify(style));
  } catch {
    // Sin almacenamiento la próxima vez abre con el estilo de siempre; no es grave.
  }
}
