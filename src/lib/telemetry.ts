import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { api } from "../../convex/_generated/api";
import type { ShareOrigin, TelemetryEvent } from "../../convex/telemetry";
import type { QuotaModule } from "../../convex/quotas";
import { convexClient } from "./convexClient";
import { describeError, makeInstallId } from "./telemetryCore";

/**
 * Diagnóstico: errores y embudo, **sin contenido y sin cuenta** (ver
 * `convex/telemetry.ts`). Todo es "dispará y olvidate": nada de esto puede
 * romper ni frenar la app, así que cada fallo se traga en silencio.
 *
 * En desarrollo no se manda nada: los errores de Metro y los eventos de quien
 * programa ensuciarían el embudo real.
 */

const INSTALL_ID_KEY = "telemetry-install-id";
const platform = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web";
const build = Application.nativeBuildVersion ?? undefined;
const enabled = !__DEV__;

let installIdPromise: Promise<string> | null = null;

/**
 * Un id por instalación, guardado en SecureStore. Si SecureStore falla (o en
 * web, donde no existe) se usa uno por sesión: peor para el embudo, pero
 * nunca un error.
 */
function installId(): Promise<string> {
  if (!installIdPromise) {
    installIdPromise = (async () => {
      if (Platform.OS === "web") return makeInstallId();
      try {
        const saved = await SecureStore.getItemAsync(INSTALL_ID_KEY);
        if (saved) return saved;
        const fresh = makeInstallId();
        await SecureStore.setItemAsync(INSTALL_ID_KEY, fresh);
        return fresh;
      } catch {
        return makeInstallId();
      }
    })();
  }
  return installIdPromise;
}

/** Un paso del embudo. Nunca lleva texto de la persona: solo el nombre y el módulo. */
export function track(name: TelemetryEvent, module?: QuotaModule, extra?: { origin?: ShareOrigin }) {
  if (!enabled) return;
  void installId()
    .then((id) =>
      convexClient.mutation(api.telemetry.track, { installId: id, name, module, origin: extra?.origin, platform, build }),
    )
    .catch(() => undefined);
}

export function reportError(error: unknown, fatal: boolean) {
  if (!enabled) return;
  const { message, stack } = describeError(error);
  void installId()
    .then((id) => convexClient.mutation(api.telemetry.reportError, { installId: id, message, stack, fatal, platform, build }))
    .catch(() => undefined);
}

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler: () => GlobalErrorHandler; setGlobalHandler: (handler: GlobalErrorHandler) => void };

let installed = false;

/**
 * Engancha el manejador global de React Native: cualquier error de JS que
 * nadie atrapó (incluidas las promesas rechazadas que terminan en un cierre,
 * como #103) se reporta antes de seguir al manejador original. No reemplaza
 * el comportamiento de RN, solo lo observa.
 */
export function installGlobalErrorReporting() {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (installed || !enabled || !errorUtils) return;
  installed = true;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, isFatal ?? false);
    previous(error, isFatal);
  });
}
