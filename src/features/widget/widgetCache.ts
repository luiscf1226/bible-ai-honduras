import AsyncStorage from "@react-native-async-storage/async-storage";

import type { WidgetVerseDay } from "./verseWidget";

// Lo último que bajó la app: el widget de Android lo lee sin conexión.
const CACHE_KEY = "widget:versiculo-del-dia";

export async function readWidgetDays(): Promise<WidgetVerseDay[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as WidgetVerseDay[]) : [];
  } catch {
    return [];
  }
}

export async function writeWidgetDays(days: readonly WidgetVerseDay[]): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(days));
}
