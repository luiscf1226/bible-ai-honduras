import { readReadingWidgetLocked, writeReadingWidgetLocked } from "./readingWidgetCache";

/**
 * Punto de enganche para el bloqueo con Face ID / huella / PIN (#171). Cuando
 * se active o desactive, el módulo de #171 llama a `setReadingWidgetLocked`:
 * queda guardado (Android lo lee en segundo plano) y la app vuelve a pintar el
 * widget sin plan, lecturas ni racha.
 */
type Listener = (locked: boolean) => void;
const listeners = new Set<Listener>();

export async function setReadingWidgetLocked(locked: boolean): Promise<void> {
  await writeReadingWidgetLocked(locked);
  for (const listener of listeners) listener(locked);
}

export function getReadingWidgetLocked(): Promise<boolean> {
  return readReadingWidgetLocked();
}

export function subscribeReadingWidgetLocked(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
