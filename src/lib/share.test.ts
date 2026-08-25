import { describe, expect, it } from "vitest";

import { buildReferralLink, buildShareMessage } from "./share";

describe("buildReferralLink", () => {
  it("incluye el código de referido en el link", () => {
    expect(buildReferralLink("BAH-0000ABC")).toContain("BAH-0000ABC");
  });

  it("produce links distintos y rastreables para códigos distintos", () => {
    expect(buildReferralLink("BAH-AAA")).not.toBe(buildReferralLink("BAH-BBB"));
  });
});

describe("buildShareMessage", () => {
  it("incluye el texto y el link de referido", () => {
    const message = buildShareMessage("Moisés te responde: ...", "BAH-XYZ");
    expect(message).toContain("Moisés te responde: ...");
    expect(message).toContain(buildReferralLink("BAH-XYZ"));
  });
});
