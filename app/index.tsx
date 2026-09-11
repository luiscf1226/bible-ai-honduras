import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useConvexAuth, useQuery } from "convex/react";

import { api } from "../convex/_generated/api";
import { AI_CONSENT_VERSION } from "../convex/users";
import { STARTUP_STALL_MS, decideStartupRoute } from "../src/features/auth/startupRoute";

/**
 * El único punto que decide a dónde entra el usuario (#124).
 *
 * Las pantallas de login ya no enrutan: hacen `router.replace("/")` y esta
 * cascada resuelve. El árbol de decisión vive en
 * `src/features/auth/startupRoute.ts` porque tiene tests; acá solo se conectan
 * las fuentes de verdad.
 */
export default function Index() {
  const { getToken, isLoaded: clerkLoaded, isSignedIn, sessionId } = useAuth();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(api.users.current);

  // Si hay sesión de Clerk pero Convex nunca autentica, el arranque se quedaría
  // en blanco para siempre. A los STARTUP_STALL_MS damos el brazo a torcer y
  // caemos al splash, que al menos ofrece una acción.
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!clerkLoaded || !isSignedIn) {
      setStalled(false);
      return;
    }
    const timer = setTimeout(() => setStalled(true), STARTUP_STALL_MS);
    return () => clearTimeout(timer);
  }, [clerkLoaded, isSignedIn]);

  const decision = decideStartupRoute({
    clerkLoaded,
    clerkSignedIn: isSignedIn === true,
    convexAuthLoading: isLoading,
    convexAuthenticated: isAuthenticated,
    user: currentUser,
    consentVersion: AI_CONSENT_VERSION,
    stalled,
  });

  // Diagnóstico de #124 síntoma B: sin estos datos no se puede saber por qué un
  // usuario con sesión viva termina en el splash. Se loguea solo en el caso
  // degradado, no en cada render.
  const sesionSinConvex = decision.kind === "ir" && "sesionSinConvex" in decision;
  useEffect(() => {
    if (!sesionSinConvex) {
      return;
    }
    console.error(
      "[auth #124] Clerk tiene sesión pero Convex no autenticó en " +
        `${STARTUP_STALL_MS} ms. Revisá el JWT template "convex" y que su issuer ` +
        "coincida con CLERK_JWT_ISSUER_DOMAIN (convex/auth.config.ts).",
      { clerkLoaded, isSignedIn, sessionId, convexIsAuthenticated: isAuthenticated, convexIsLoading: isLoading },
    );
    // El cuarto dato que pide el issue: ¿el template "convex" emite token o
    // tira? Nunca se loguea el token, solo si lo hubo. Best-effort: si esto
    // falla también, el error es justamente la respuesta.
    void getToken({ template: "convex" })
      .then((token) => console.error("[auth #124] getToken({template:'convex'}) →", token ? "token emitido" : "null"))
      .catch((error) => console.error("[auth #124] getToken({template:'convex'}) lanzó", error));
  }, [clerkLoaded, getToken, isAuthenticated, isLoading, isSignedIn, sesionSinConvex, sessionId]);

  if (decision.kind === "esperar") {
    return null;
  }
  return <Redirect href={decision.route} />;
}
