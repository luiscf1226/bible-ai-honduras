import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ReadingWidgetDay } from "./readingWidget";

// Lo último que bajó la app: el widget de Android lo lee sin conexión.
const DAYS_KEY = "widget:lectura-de-hoy";
// Bloqueo de #171: si está activo, el widget no muestra nada personal.
const LOCKED_KEY = "widget:lectura-de-hoy:bloqueado";

export async function readReadingWidgetDays(): Promise<ReadingWidgetDay[]> {
  try {
    const raw = await AsyncStorage.getItem(DAYS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ReadingWidgetDay[]) : [];
  } catch {
    return [];
  }
}

/** Con el bloqueo activo se borra lo guardado: los datos personales no quedan guardados para el widget. */
export async function writeReadingWidgetDays(days: readonly ReadingWidgetDay[], locked: boolean): Promise<void> {
  if (locked) await AsyncStorage.removeItem(DAYS_KEY);
  else await AsyncStorage.setItem(DAYS_KEY, JSON.stringify(days));
}

export async function readReadingWidgetLocked(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(LOCKED_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function writeReadingWidgetLocked(locked: boolean): Promise<void> {
  if (locked) await AsyncStorage.setItem(LOCKED_KEY, "1");
  else await AsyncStorage.removeItem(LOCKED_KEY);
}
