import { describe, expect, it } from "vitest";

// Convex rechaza el push completo si un archivo de convex/ tiene un nombre
// fuera de [A-Za-z0-9_.] ("InvalidConfig: … is not a valid path to a Convex
// module"). typecheck y el resto de los tests no lo ven: solo falla el
// deploy. Pasó con convex/devotionals/01-enero.ts (#215).
const VALID_COMPONENT = /^[A-Za-z0-9_.]+$/;

describe("rutas de módulos de Convex", () => {
  // Solo las rutas: sin `eager` no se carga ningún módulo.
  const paths = Object.keys(import.meta.glob(["./**/*.ts", "./**/*.js", "!./_generated/**"]));

  it("cada archivo de convex/ tiene un nombre que Convex acepta", () => {
    const invalid = paths.filter((path) =>
      path
        .replace(/^\.\//, "")
        .split("/")
        .some((part) => !VALID_COMPONENT.test(part)),
    );
    expect(paths.length).toBeGreaterThan(20);
    expect(invalid).toEqual([]);
  });
});
