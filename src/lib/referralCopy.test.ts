import { describe, expect, it } from "vitest";

import { canEnterReferral, claimMessage } from "./referralCopy";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-10-01T12:00:00Z");

describe("canEnterReferral", () => {
  it("solo con cuenta nueva y sin invitación", () => {
    expect(canEnterReferral({ _creationTime: now - 2 * DAY_MS }, now)).toBe(true);
    expect(canEnterReferral({ _creationTime: now - 30 * DAY_MS }, now)).toBe(true);
    expect(canEnterReferral({ _creationTime: now - 31 * DAY_MS }, now)).toBe(false);
    expect(canEnterReferral({ _creationTime: now, referredBy: "BAH-12AB34C" }, now)).toBe(false);
    expect(canEnterReferral(null, now)).toBe(false);
  });
});

describe("claimMessage", () => {
  it("tiene un mensaje para cada respuesta del backend", () => {
    for (const status of ["ok", "already", "self", "too_late", "not_found", "invalid"] as const) {
      expect(claimMessage(status).length).toBeGreaterThan(0);
    }
  });
});
