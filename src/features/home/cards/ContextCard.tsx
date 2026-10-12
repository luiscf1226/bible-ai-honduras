import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { localDateKey, occasionsOn } from "../../../../convex/personalDates";
import { useAppUpdate } from "../../../hooks/useAppUpdate";
import { useTheme } from "../../../theme/ThemeProvider";
import { isSundayInHonduras, pickHomeContext } from "../homeCards";
import { PersonalDateCard } from "./PersonalDateCard";
import { SavedMemoryCard } from "./SavedMemoryCard";
import { SeasonStrip } from "./SeasonStrip";
import { SermonSundayCard } from "./SermonSundayCard";
import { UpdateCard } from "./UpdateCard";

/**
 * La única tarjeta de contexto del inicio (#232, Fase 2). Mira qué hay hoy y
 * dibuja solo la de mayor prioridad (`pickHomeContext`): el peor día
 * (actualización + cumpleaños + temporada + recuerdo) se ve igual de tranquilo
 * que un día normal.
 */
export function ContextCard() {
  const { season } = useTheme();
  const appUpdate = useAppUpdate();
  const user = useQuery(api.users.current, {});
  const memory = useQuery(api.savedMemory.thisWeek, {});

  const kind = pickHomeContext({
    update: appUpdate.updateAvailable && appUpdate.storeName !== null && appUpdate.storeName !== undefined,
    sermon: isSundayInHonduras(),
    dates: occasionsOn(user, localDateKey(new Date())).length > 0,
    season: season !== null,
    savedMemory: Boolean(memory),
  });

  switch (kind) {
    case "update":
      return <UpdateCard onPress={() => void appUpdate.openStore()} storeName={appUpdate.storeName ?? ""} />;
    case "sermon":
      return <SermonSundayCard />;
    case "dates":
      return <PersonalDateCard />;
    case "season":
      return <SeasonStrip />;
    case "savedMemory":
      return <SavedMemoryCard />;
    default:
      return null;
  }
}
