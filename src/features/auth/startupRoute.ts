/**
 * Árbol de decisión del arranque (`app/index.tsx`) — issue #124.
 *
 * Vive acá y no dentro del componente por dos razones:
 *
 * 1. El entorno de vitest es `edge-runtime` y no puede resolver `react-native`
 *    ni `expo-router`; este módulo no importa nada de eso a propósito (misma
 *    convención que `src/lib/keyboardAvoidance.ts`).
 * 2. El bug de #124 era precisamente que **nadie** decidía el enrutado: cada
 *    pantalla de login hacía `router.replace("/onboarding")` a ciegas. Ahora hay
 *    un solo lugar que decide, y ese lugar se puede probar.
 *
 * ## Por qué la sesión la manda Clerk y no Convex
 *
 * Antes la primera pregunta era `useConvexAuth().isAuthenticated`. Eso mezcla
 * dos cosas distintas: "¿hay sesión?" (Clerk) y "¿Convex pudo validar el JWT?"
 * (template `convex`, issuer de `convex/auth.config.ts`, reloj del dispositivo).
 * Si lo segundo falla, lo primero sigue siendo verdad, pero la app mandaba al
 * splash — el usuario con sesión viva veía la pantalla de "Toca para entrar" y
 * concluía, con razón, que el login no se había guardado. Clerk es la autoridad
 * de identidad (lo dice `convex/users.ts`), así que la pregunta "¿hay sesión?"
 * se la hacemos a Clerk.
 *
 * Con sesión de Clerk pero sin Convex todavía, la respuesta correcta es
 * **esperar**, no expulsar. `stalled` es la válvula de escape: después de unos
 * segundos sin poder decidir, mejor el splash (que al menos ofrece una acción)
 * que una pantalla en blanco permanente.
 */

/** Perfil de `users.current`: `undefined` = query cargando, `null` = todavía sin fila. */
export type StartupUser = {
  onboardedAt?: number;
  aiConsentAt?: number;
  aiConsentVersion?: string;
} | null | undefined;

export type StartupInput = {
  /** `useAuth().isLoaded` de Clerk. */
  clerkLoaded: boolean;
  /** `useAuth().isSignedIn` de Clerk — la única fuente de "¿hay sesión?". */
  clerkSignedIn: boolean;
  /** `useConvexAuth().isLoading`. */
  convexAuthLoading: boolean;
  /** `useConvexAuth().isAuthenticated` — "¿Convex validó el JWT?", no "¿hay sesión?". */
  convexAuthenticated: boolean;
  /** Resultado de `useQuery(api.users.current)`. */
  user: StartupUser;
  /** `AI_CONSENT_VERSION` vigente. */
  consentVersion: string;
  /**
   * Pasaron `STARTUP_STALL_MS` con sesión de Clerk y sin poder decidir. Solo
   * entra en juego si Convex nunca autentica o `users.upsert` nunca escribe.
   */
  stalled: boolean;
};

export type StartupRoute = "/splash" | "/onboarding" | "/consentimiento-ia" | "/home";

export type StartupDecision =
  /** No hay nada que decidir todavía: no navegues, no renderices chrome. */
  | { kind: "esperar" }
  | { kind: "ir"; route: StartupRoute }
  /** Sesión de Clerk viva pero Convex nunca autenticó: caso degradado, se loguea. */
  | { kind: "ir"; route: "/splash"; sesionSinConvex: true };

/** Cuánto esperamos antes de dar por colgado el arranque. */
export const STARTUP_STALL_MS = 12_000;

export function hasCurrentConsent(user: NonNullable<StartupUser>, consentVersion: string): boolean {
  return user.aiConsentAt !== undefined && user.aiConsentVersion === consentVersion;
}

export function decideStartupRoute(input: StartupInput): StartupDecision {
  if (!input.clerkLoaded) {
    return { kind: "esperar" };
  }

  // Sin sesión de Clerk no hay nada más que preguntar.
  if (!input.clerkSignedIn) {
    return { kind: "ir", route: "/splash" };
  }

  // Hay sesión. Para leer el perfil hace falta que Convex haya validado el JWT.
  const puedeLeerPerfil = input.convexAuthenticated && !input.convexAuthLoading;
  if (!puedeLeerPerfil || input.user === undefined || input.user === null) {
    return input.stalled ? { kind: "ir", route: "/splash", sesionSinConvex: true } : { kind: "esperar" };
  }

  // La cascada del issue, en este orden y no en otro.
  if (input.user.onboardedAt === undefined) {
    return { kind: "ir", route: "/onboarding" };
  }
  if (!hasCurrentConsent(input.user, input.consentVersion)) {
    return { kind: "ir", route: "/consentimiento-ia" };
  }
  return { kind: "ir", route: "/home" };
}
