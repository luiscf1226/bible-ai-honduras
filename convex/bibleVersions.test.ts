import { describe, expect, it } from "vitest";

import {
  AVAILABLE_BIBLE_VERSIONS,
  DEFAULT_BIBLE_VERSION,
  bibleVersionIsAvailable,
  resolveBibleVersion,
} from "./bibleVersions";

describe("bibleVersions (#93 §4b)", () => {
  it("NVI no está disponible: no hay corpus ingerido", () => {
    expect(bibleVersionIsAvailable("NVI")).toBe(false);
    expect(AVAILABLE_BIBLE_VERSIONS).toEqual(["RVR1960"]);
  });

  it("RVR1960 sí está disponible", () => {
    expect(bibleVersionIsAvailable("RVR1960")).toBe(true);
    expect(resolveBibleVersion("RVR1960")).toBe("RVR1960");
  });

  it("una versión sin corpus degrada a RVR1960 en vez de devolver cero citas", () => {
    expect(resolveBibleVersion("NVI")).toBe(DEFAULT_BIBLE_VERSION);
    expect(resolveBibleVersion(undefined)).toBe(DEFAULT_BIBLE_VERSION);
    expect(resolveBibleVersion(null)).toBe(DEFAULT_BIBLE_VERSION);
    expect(resolveBibleVersion("")).toBe(DEFAULT_BIBLE_VERSION);
    expect(resolveBibleVersion("RV1909")).toBe(DEFAULT_BIBLE_VERSION);
  });
});
