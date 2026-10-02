import AsyncStorage from "@react-native-async-storage/async-storage";

import { READER_HINT_STORAGE_KEY } from "./readerHint";

/** Pista del lector sin sesión (#196): vive en el teléfono. */
export async function readLocalHintSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(READER_HINT_STORAGE_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function writeLocalHintSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(READER_HINT_STORAGE_KEY, "1");
  } catch {
    // Sin almacenamiento la pista vuelve a salir la próxima vez; no es grave.
  }
}
