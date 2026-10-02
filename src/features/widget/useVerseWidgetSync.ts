import { useConvexAuth, useQuery } from "convex/react";
import { useEffect } from "react";

import { api } from "../../../convex/_generated/api";
import { updateVerseWidget } from "./updateVerseWidget";
import { useReadingWidgetSync } from "./useReadingWidgetSync";

/**
 * Cada vez que la app abre con sesión, le deja al widget (#170) las próximas
 * dos semanas de versículos en la versión de la persona. Sin widget puesto es
 * barato: una query y una escritura local.
 *
 * También sincroniza el widget "Tu lectura de hoy" (#184), para que la app
 * tenga una sola entrada de widgets en `app/_layout.tsx`.
 */
export function useVerseWidgetSync() {
  useReadingWidgetSync();
  const { isAuthenticated } = useConvexAuth();
  const days = useQuery(api.devotional.widgetDays, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (!days) return;
    void updateVerseWidget(days).catch(() => undefined);
  }, [days]);
}
