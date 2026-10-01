import * as Application from "expo-application";
import { useConvex } from "convex/react";
import { useEffect, useState } from "react";
import { Linking, Platform } from "react-native";

import { api } from "../../convex/_generated/api";
import {
  isUpdateAvailable,
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
  const installedBuild = Application.nativeBuildVersion;

  // Consulta única y sin `useQuery`: el deploy de Convex es manual, y un build
  // que llega antes que `appVersion.latest` haría tirar a `useQuery` y voltear
  // home. Si falla, simplemente no hay aviso.
  useEffect(() => {
    if (!platform) return;
    let isCurrent = true;
    convex.query(api.appVersion.latest, { platform }).then(
      (result) => {
        if (isCurrent) setLatestBuild(result.latestBuild);
      },
      () => {},
    );
    return () => {
      isCurrent = false;
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
  };
}
