import { describe, expect, it } from "vitest";

import { shouldOpenPendingInvite } from "./pendingInvite";

describe("shouldOpenPendingInvite", () => {
  const token = "abcdefghijkmnpqr";

  it("abre la invitación cuando ya hay sesión y la persona está en la app", () => {
    expect(shouldOpenPendingInvite({ pendingToken: token, signedIn: true, pathname: "/home" })).toBe(true);
    expect(shouldOpenPendingInvite({ pendingToken: token, signedIn: true, pathname: "/leer" })).toBe(true);
  });

  it("espera durante el arranque, el login, el onboarding y el consentimiento", () => {
    for (const pathname of ["/", "/splash", "/login", "/email", "/onboarding", "/notifications", "/consentimiento-ia"]) {
      expect(shouldOpenPendingInvite({ pendingToken: token, signedIn: true, pathname })).toBe(false);
    }
  });

  it("no hace nada sin pendiente, sin sesión o si ya está en la invitación", () => {
    expect(shouldOpenPendingInvite({ pendingToken: null, signedIn: true, pathname: "/home" })).toBe(false);
    expect(shouldOpenPendingInvite({ pendingToken: token, signedIn: false, pathname: "/home" })).toBe(false);
    expect(shouldOpenPendingInvite({ pendingToken: token, signedIn: true, pathname: "/grupo" })).toBe(false);
  });
});
