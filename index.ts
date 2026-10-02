// Entrada de la app. Además de expo-router, registra en Android la tarea en
// segundo plano del widget del versículo del día (#170): Android la despierta
// para pintar el widget aunque la app esté cerrada.
import "expo-router/entry";

import { Platform } from "react-native";
import { registerWidgetTaskHandler } from "react-native-android-widget";

if (Platform.OS === "android") {
  // require para que iOS y web no carguen el handler ni sus widgets nativos.
  const { verseWidgetTaskHandler } = require("./src/features/widget/androidWidgetTaskHandler.android");
  registerWidgetTaskHandler(verseWidgetTaskHandler);
}
