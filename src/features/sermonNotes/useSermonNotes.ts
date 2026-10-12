import { useCallback, useMemo } from "react";

import { api } from "../../../convex/_generated/api";
import { track } from "../../lib/telemetry";
import { overlaySermonNotes } from "../offline/mutationQueue";
import { useOfflineSync } from "../offline/OfflineSyncProvider";
import { usePersistedQuery } from "../offline/usePersistedQuery";
import { isEmptySermonNote, toSermonInput, type SermonNote } from "./sermonNotes";

/**
 * Notas de prédica con la cola sin conexión (#232): la lista es lo último que
 * vino del servidor (guardado en el teléfono) más lo que todavía no subió.
 * Guardar y borrar **siempre** pasan por la cola: con o sin señal es el mismo
 * camino, y el servidor hace upsert por `clientId`, así que no se duplica.
 */
export function useSermonNotes() {
  const server = usePersistedQuery(api.sermonNotes.list, {}, "sermonNotes.list");
  const { online, pending, run } = useOfflineSync();
  const notes = useMemo(() => overlaySermonNotes(server, pending) as SermonNote[] | undefined, [pending, server]);

  const save = useCallback(
    (note: SermonNote, options: { isNew: boolean }) => {
      if (isEmptySermonNote(note)) return false;
      const input = toSermonInput(note);
      run({ kind: "sermonNote", clientId: input.clientId, note: input });
      // Solo que se creó una: nunca el título, los pasajes ni lo escrito.
      if (options.isNew) track("sermon_note_created");
      return true;
    },
    [run],
  );

  const remove = useCallback((clientId: string) => run({ kind: "sermonNote", clientId, note: null }), [run]);

  return { notes, loading: notes === undefined, online, save, remove };
}
