import { useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";

import { api } from "../../../convex/_generated/api";
import { DEFAULT_BIBLE_VERSION } from "../../../convex/bibleVersions";
import { parseVerseRef } from "../../lib/parseVerseRef";

/**
 * Devocional del día. Las secciones `openingPrayer`, `intro` y `closingPrayer`
 * llegan con el devocional por secciones (PR aparte): se tipan opcionales para
 * que `/hoy` las muestre solo si vienen, antes y después de ese cambio.
 */
export type TodayDevotional = FunctionReturnType<typeof api.devotional.today> & {
  openingPrayer?: string;
  intro?: string;
  reflection?: string;
  closingPrayer?: string;
};

export type DevotionalState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; devotional: TodayDevotional };

/**
 * Una sola lectura (no reactiva) del devocional de hoy, con reintento. La usan
 * la tarjeta del inicio y `/hoy` (#194).
 */
export function useTodayDevotional() {
  const convex = useConvex();
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<DevotionalState>({ status: "loading" });

  useEffect(() => {
    let isCurrent = true;
    setState({ status: "loading" });

    void convex.query(api.devotional.today, {}).then(
      (devotional) => {
        if (isCurrent) setState({ devotional, status: "ready" });
      },
      () => {
        if (isCurrent) setState({ status: "error" });
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [convex, request]);

  return { retry: () => setRequest((value) => value + 1), state };
}

/**
 * Texto del versículo del día en la versión de la persona. Sin corpus para esa
 * versión (`verse: null`) se muestra solo la referencia.
 */
export function useTodayVerse(verseRef: string | undefined) {
  const passage = parseVerseRef(verseRef ?? "");
  const cited = useQuery(api.rag.verses.citedForUser, passage ?? "skip");
  return {
    passage,
    text: cited?.verse?.text ?? null,
    version: cited?.version ?? DEFAULT_BIBLE_VERSION,
  };
}
