import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";

const RETRY_DELAY_MS = 2000;

// Convex ya validó el JWT de Clerk en cuanto isAuthenticated pasa a true; acá
// solo falta espejar el perfil en la tabla `users` la primera vez que se ve
// ese clerkId. Es seguro llamarlo en cada sign-in: users.upsert es idempotente.
// Si el upsert falla (red, deploy caído), reintenta una vez cada 2s hasta que
// isAuthenticated cambie — `retryTick` es lo que fuerza ese re-run.
export function useSyncConvexUser() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const upsert = useMutation(api.users.upsert);
  const syncedRef = useRef(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!isAuthenticated) {
      syncedRef.current = false;
      return;
    }
    if (syncedRef.current) {
      return;
    }
    syncedRef.current = true;

    let cancelled = false;
    upsert({}).catch((error) => {
      if (cancelled) {
        return;
      }
      syncedRef.current = false;
      console.error("No se pudo sincronizar el usuario con Convex", error);
      setTimeout(() => {
        if (!cancelled) {
          setRetryTick((tick) => tick + 1);
        }
      }, RETRY_DELAY_MS);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, retryTick, upsert]);
}
