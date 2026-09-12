import { describe, expect, it } from "vitest";

import { decideStartupRoute, type StartupInput, type StartupUser } from "./startupRoute";

const CONSENT = "2026-08-25";

/** Estado feliz: Clerk cargado y con sesión, Convex autenticado, perfil leído. */
function estado(overrides: Partial<StartupInput> = {}): StartupInput {
  return {
    clerkLoaded: true,
    clerkSignedIn: true,
    convexAuthLoading: false,
    convexAuthenticated: true,
    user: { onboardedAt: 1, aiConsentAt: 2, aiConsentVersion: CONSENT },
    consentVersion: CONSENT,
    stalled: false,
    ...overrides,
  };
}

describe("decideStartupRoute — las tres ramas de la cascada", () => {
  it("sin onboardedAt manda al onboarding, aunque ya tenga consentimiento", () => {
    const user: StartupUser = { aiConsentAt: 2, aiConsentVersion: CONSENT };
    expect(decideStartupRoute(estado({ user }))).toEqual({ kind: "ir", route: "/onboarding" });
  });

  it("con onboardedAt pero sin consentimiento vigente manda al consentimiento", () => {
    const sinConsentimiento: StartupUser = { onboardedAt: 1 };
    expect(decideStartupRoute(estado({ user: sinConsentimiento }))).toEqual({
      kind: "ir",
      route: "/consentimiento-ia",
    });

    // Consentimiento de una versión vieja: hay que volver a pedirlo.
    const versionVieja: StartupUser = { onboardedAt: 1, aiConsentAt: 2, aiConsentVersion: "2020-01-01" };
    expect(decideStartupRoute(estado({ user: versionVieja }))).toEqual({
      kind: "ir",
      route: "/consentimiento-ia",
    });
  });

  it("con onboarding y consentimiento vigente cae en home", () => {
    expect(decideStartupRoute(estado())).toEqual({ kind: "ir", route: "/home" });
  });
});

describe("decideStartupRoute — el onboarding no se repite (#124 síntoma A)", () => {
  it("el usuario migrado (tenía aiConsentAt, quedó con onboardedAt) va directo a home", () => {
    const migrado: StartupUser = { onboardedAt: 1700000000000, aiConsentAt: 1700000000000, aiConsentVersion: CONSENT };
    expect(decideStartupRoute(estado({ user: migrado }))).toEqual({ kind: "ir", route: "/home" });
  });

  it("el usuario que saltó el onboarding tampoco lo vuelve a ver", () => {
    // "Saltar" marca onboardedAt pero no acepta el consentimiento.
    const salto: StartupUser = { onboardedAt: 1700000000000 };
    expect(decideStartupRoute(estado({ user: salto }))).toEqual({ kind: "ir", route: "/consentimiento-ia" });
  });

  it("el usuario nuevo sí lo ve", () => {
    expect(decideStartupRoute(estado({ user: {} }))).toEqual({ kind: "ir", route: "/onboarding" });
  });
});

describe("decideStartupRoute — sesión (#124 síntoma B)", () => {
  it("sin sesión de Clerk va al splash", () => {
    expect(decideStartupRoute(estado({ clerkSignedIn: false, convexAuthenticated: false }))).toEqual({
      kind: "ir",
      route: "/splash",
    });
  });

  it("espera mientras Clerk todavía no cargó", () => {
    expect(decideStartupRoute(estado({ clerkLoaded: false, clerkSignedIn: false }))).toEqual({ kind: "esperar" });
  });

  it("con sesión de Clerk y Convex todavía cargando, espera — no expulsa al splash", () => {
    expect(
      decideStartupRoute(estado({ convexAuthLoading: true, convexAuthenticated: false, user: undefined })),
    ).toEqual({ kind: "esperar" });
  });

  it("con sesión de Clerk y Convex que no autentica, espera en vez de mandar al splash", () => {
    // Ésta es la regresión de #124: antes acá se hacía Redirect a /splash y el
    // usuario con sesión viva creía que el login no se había guardado.
    expect(decideStartupRoute(estado({ convexAuthenticated: false, user: undefined }))).toEqual({
      kind: "esperar",
    });
  });

  it("espera mientras users.current todavía no devolvió fila (upsert en vuelo)", () => {
    expect(decideStartupRoute(estado({ user: null }))).toEqual({ kind: "esperar" });
  });

  it("si el arranque se cuelga, cae al splash marcando que la sesión de Clerk sigue viva", () => {
    expect(decideStartupRoute(estado({ convexAuthenticated: false, user: undefined, stalled: true }))).toEqual({
      kind: "ir",
      route: "/splash",
      sesionSinConvex: true,
    });
  });

  it("el colgado no afecta a quien sí pudo leer su perfil", () => {
    expect(decideStartupRoute(estado({ stalled: true }))).toEqual({ kind: "ir", route: "/home" });
  });
});
