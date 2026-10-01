import { describe, expect, it } from "vitest";

import { isValidInstallId } from "../../convex/telemetry";
import { describeError, makeInstallId } from "./telemetryCore";

describe("makeInstallId", () => {
  it("tiene forma de UUID y la acepta el backend", () => {
    const id = makeInstallId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(isValidInstallId(id)).toBe(true);
  });

  it("dos instalaciones no comparten id", () => {
    expect(makeInstallId()).not.toBe(makeInstallId());
  });
});

describe("describeError", () => {
  it("usa nombre, mensaje y stack de un Error", () => {
    const error = new TypeError("x is undefined");
    const described = describeError(error);
    expect(described.message).toBe("TypeError: x is undefined");
    expect(described.stack).toContain("x is undefined");
  });

  it("acepta strings y objetos lanzados a mano", () => {
    expect(describeError("falló")).toEqual({ message: "falló" });
    expect(describeError({ code: 3 })).toEqual({ message: '{"code":3}' });
    expect(describeError(undefined)).toEqual({ message: "undefined" });
  });
});
