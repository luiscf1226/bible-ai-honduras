import { describe, expect, it } from "vitest";

import {
  AVAILABLE_BIBLE_VERSIONS,
  DEFAULT_BIBLE_VERSION,
  bibleVersionIsAvailable,
  resolveBibleVersion,
} from "./bibleVersions";

describe("bibleVersions (#93)", () => {
  it("la única versión con corpus ingerido es RV1909", () => {
    expect(AVAILABLE_BIBLE_VERSIONS).toEqual(["RV1909"]);
    expect(DEFAULT_BIBLE_VERSION).toBe("RV1909");
    expect(bibleVersionIsAvailable("RV1909")).toBe(true);
    expect(resolveBibleVersion("RV1909")).toBe("RV1909");
  });

  it("RVR1960 y NVI no están disponibles: son de licencia comercial", () => {
    expect(bibleVersionIsAvailable("RVR1960")).toBe(false);
    expect(bibleVersionIsAvailable("NVI")).toBe(false);
  });

  it("una versión sin corpus degrada a RV1909 en vez de devolver cero citas", () => {
    expect(resolveBibleVersion("RVR1960")).toBe(DEFAULT_BIBLE_VERSION);
    expect(resolveBibleVersion("NVI")).toBe(DEFAULT_BIBLE_VERSION);
    expect(resolveBibleVersion(undefined)).toBe(DEFAULT_BIBLE_VERSION);
    expect(resolveBibleVersion(null)).toBe(DEFAULT_BIBLE_VERSION);
    expect(resolveBibleVersion("")).toBe(DEFAULT_BIBLE_VERSION);
    expect(resolveBibleVersion("RV1602")).toBe(DEFAULT_BIBLE_VERSION);
  });
});
