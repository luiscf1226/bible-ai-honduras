import { describe, expect, it } from "vitest";

import { profileInitial, profileStats } from "./profile";

describe("profileInitial", () => {
  it("usa el nombre, en mayúscula", () => {
    expect(profileInitial("ana maría", "x@y.com")).toBe("A");
  });

  it("sin nombre usa el correo", () => {
    expect(profileInitial("  ", "luis@example.com")).toBe("L");
    expect(profileInitial(undefined, "élida@example.com")).toBe("É");
  });

  it("sin nombre ni correo no queda vacío", () => {
    expect(profileInitial(null, null)).toBe("·");
  });
});

describe("profileStats", () => {
  it("devuelve guardados, subrayados y notas en ese orden", () => {
    expect(profileStats({ bookmarks: 3, highlights: 12, sermonNotes: 0 })).toEqual([
      { id: "guardados", label: "Guardados", count: 3 },
      { id: "subrayados", label: "Subrayados", count: 12 },
      { id: "notas", label: "Notas", count: 0 },
    ]);
  });
});
