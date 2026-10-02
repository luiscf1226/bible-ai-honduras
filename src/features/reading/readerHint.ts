/**
 * Pista de primera vez del lector (#196, U4): "Tocá un versículo para…".
 *
 * Con sesión se guarda en el usuario (`users.readerHintSeen`) para que no
 * reaparezca en otro teléfono; sin sesión, en el almacenamiento local. Una
 * cuenta nueva en el mismo teléfono la vuelve a ver: es una vez por cuenta.
 */
export const READER_HINT_STORAGE_KEY = "lector:pista-vista";

export type ReaderHintState = {
  /** `undefined` mientras carga `users.current`; `null` sin sesión. */
  user: { _id: string; readerHintSeen?: boolean } | null | undefined;
  /** `undefined` mientras se lee el almacenamiento local. */
  localSeen: boolean | undefined;
  /** La persona la cerró en esta pantalla (antes de que vuelva la mutación). */
  dismissed: boolean;
};

export function shouldShowReaderHint({ user, localSeen, dismissed }: ReaderHintState): boolean {
  if (dismissed || user === undefined) return false;
  if (user) return user.readerHintSeen !== true;
  // Sin sesión: no se muestra hasta saber qué hay guardado (evita un parpadeo).
  return localSeen === false;
}
