import AsyncStorage from "@react-native-async-storage/async-storage";

const FEED_HINT_STORAGE_KEY = "feed.swipeHintSeen";

/** La pista "Deslizá hacia arriba" sale una sola vez por teléfono. Sin almacenamiento, cuenta como no vista. */
export async function readFeedHintSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FEED_HINT_STORAGE_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function writeFeedHintSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(FEED_HINT_STORAGE_KEY, "1");
  } catch {
    // Sin almacenamiento la pista vuelve a salir la próxima vez; no es grave.
  }
}
