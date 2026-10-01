import { describe, expect, it } from "vitest";

import { makeReferralCode } from "./users";
import { parseReferralCode, referralFromQuery } from "./referralCode";

describe("parseReferralCode", () => {
  it("acepta el código tal como lo genera la app", () => {
    const code = makeReferralCode("user_2abcXYZ");
    expect(parseReferralCode(code)).toBe(code);
  });

  it("tolera minúsculas, espacios y el guion faltante", () => {
    expect(parseReferralCode(" bah-12ab34c ")).toBe("BAH-12AB34C");
    expect(parseReferralCode("BAH12AB34C")).toBe("BAH-12AB34C");
    expect(parseReferralCode("bah 12ab 34c")).toBe("BAH-12AB34C");
  });

  it("rechaza lo que no es un código", () => {
    expect(parseReferralCode("")).toBeNull();
    expect(parseReferralCode("BAH-123")).toBeNull();
    expect(parseReferralCode("XYZ-12AB34C")).toBeNull();
    expect(parseReferralCode("BAH-12AB34C<script>")).toBeNull();
    expect(parseReferralCode(undefined)).toBeNull();
  });
});

describe("referralFromQuery", () => {
  it("lee el ref de un link de la app o del sitio", () => {
    expect(referralFromQuery("bibleai://home?ref=BAH-12AB34C")).toBe("BAH-12AB34C");
    expect(referralFromQuery("https://luiscf1226.github.io/bible-ai-honduras/?ref=BAH-12AB34C")).toBe("BAH-12AB34C");
  });

  it("lee el install referrer de Google Play (query string sin ?)", () => {
    expect(referralFromQuery("utm_source=google-play&ref=BAH-12AB34C")).toBe("BAH-12AB34C");
    expect(referralFromQuery("ref%3DBAH-12AB34C")).toBeNull(); // Play lo entrega ya decodificado
    expect(referralFromQuery("utm_source=google-play&utm_medium=organic")).toBeNull();
  });

  it("sin ref o con basura devuelve null", () => {
    expect(referralFromQuery(null)).toBeNull();
    expect(referralFromQuery("")).toBeNull();
    expect(referralFromQuery("ref=%E0%A4%A")).toBeNull();
    expect(referralFromQuery("ref=hola")).toBeNull();
  });
});
