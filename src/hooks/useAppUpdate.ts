import * as Application from "expo-application";
import { useConvex } from "convex/react";
import { useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

import { api } from "../../convex/_generated/api";
import {
  isUpdateAvailable,
  isUpdateRequired,
  updateStoreName,
  updateUrls,
  versionLabel,
  type UpdatePlatform,
} from "../lib/appVersion";

const platform: UpdatePlatform | null =
  Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;

/**
 * Versión instalada + si hay un build más nuevo publicado. En web no hay build
 * nativo ni tienda, así que nunca hay aviso.
 */
export function useAppUpdate() {
  const convex = useConvex();
  const [latestBuild, setLatestBuild] = useState<number | null>(null);
  const [minBuild, setMinBuild] = useState<number | null>(null);
  const installedBuild = Application.nativeBuildVersion;

  // Consulta imperativa y sin `useQuery`: el deploy de Convex es manual, y un build
  // que llega antes que `appVersion.latest` haría tirar a `useQuery` y voltear
  // home. Si falla, simplemente no hay aviso.
  //
  // Se vuelve a consultar cada vez que la app pasa a primer plano: así un piso
  // nuevo (`MIN_*_BUILD`) llega también a quien deja la app abierta días.
  useEffect(() => {
    if (!platform) return;
    let isCurrent = true;
    const check = () =>
      convex.query(api.appVersion.latest, { platform }).then(
        (result) => {
          if (!isCurrent) return;
          setLatestBuild(result.latestBuild);
          // Un backend sin `minBuild` (deploy anterior) es lo mismo que sin piso.
          setMinBuild(result.minBuild ?? null);
        },
        () => {},
      );
    void check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => {
      isCurrent = false;
      subscription.remove();
    };
  }, [convex]);

  async function openStore() {
    if (!platform) return;
    for (const url of updateUrls(platform)) {
      try {
        await Linking.openURL(url);
        return;
      } catch {
        // Sin la app de TestFlight / Play instalada falla el esquema nativo:
        // probamos con el link web.
      }
    }
  }

  return {
    label: versionLabel(Application.nativeApplicationVersion, installedBuild),
    openStore,
    storeName: platform ? updateStoreName(platform) : null,
    updateAvailable: isUpdateAvailable(installedBuild, latestBuild),
    updateRequired: isUpdateRequired(installedBuild, minBuild),
  };
}
