import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildReferralLink,
  buildShareMessage,
  resetShareNativeForTests,
  setShareNativeForTests,
  shareContent,
  type ShareNative,
} from "./share";

function mockNative(overrides: Partial<ShareNative> = {}): ShareNative {
  return {
    dismissedAction: "dismissedAction",
    share: vi.fn().mockResolvedValue({ action: "sharedAction" }),
    ...overrides,
  };
}

describe("buildReferralLink", () => {
  it("incluye el código de referido en el link", () => {
    expect(buildReferralLink("BAH-0000ABC")).toContain("BAH-0000ABC");
  });

  it("produce links distintos y rastreables para códigos distintos", () => {
    expect(buildReferralLink("BAH-AAA")).not.toBe(buildReferralLink("BAH-BBB"));
  });

  it("apunta a la landing real de GitHub Pages, no al dominio muerto bibleaihonduras.app (#103)", () => {
    expect(buildReferralLink("BAH-XYZ")).toContain("https://luiscf1226.github.io/bible-ai-honduras/");
    expect(buildReferralLink("BAH-XYZ")).not.toContain("bibleaihonduras.app");
  });
});

describe("buildShareMessage", () => {
  it("incluye el texto y el link de referido", () => {
    const message = buildShareMessage("Moisés te responde: ...", "BAH-XYZ");
    expect(message).toContain("Moisés te responde: ...");
    expect(message).toContain(buildReferralLink("BAH-XYZ"));
  });
});

describe("shareContent (#103 — dueño único del share sheet)", () => {
  afterEach(() => {
    resetShareNativeForTests();
  });

  it("éxito: comparte y devuelve status shared", async () => {
    const native = mockNative({ share: vi.fn().mockResolvedValue({ action: "sharedAction" }) });
    setShareNativeForTests(native);

    const result = await shareContent({ referralCode: "BAH-TEST01", text: "Hola" });

    expect(result).toEqual({ status: "shared" });
    expect(native.share).toHaveBeenCalledWith({ message: buildShareMessage("Hola", "BAH-TEST01") });
  });

  it("cancelación en iOS: dismissedAction no es un error", async () => {
    const native = mockNative({ share: vi.fn().mockResolvedValue({ action: "dismissedAction" }) });
    setShareNativeForTests(native);

    const result = await shareContent({ referralCode: "BAH-TEST01", text: "Hola" });

    expect(result).toEqual({ status: "dismissed" });
  });

  it("cancelación en Android: Share.share nunca devuelve dismissedAction, así que se cuenta como shared", async () => {
    // Android jamás reporta cancelación (ver Share.d.ts de react-native): siempre
    // resuelve con action sharedAction, incluso si el usuario cerró el sheet.
    const native = mockNative({ share: vi.fn().mockResolvedValue({ action: "sharedAction" }) });
    setShareNativeForTests(native);

    const result = await shareContent({ referralCode: "BAH-TEST01", text: "Hola" });

    expect(result).toEqual({ status: "shared" });
  });

  it("rechazo de Share.share: se captura y devuelve status error, no se propaga (repro #103)", async () => {
    const failure = new Error("Share sheet no disponible");
    const native = mockNative({ share: vi.fn().mockRejectedValue(failure) });
    setShareNativeForTests(native);

    const result = await shareContent({ referralCode: "BAH-TEST01", text: "Hola" });

    expect(result).toEqual({ status: "error", error: failure });
  });

  it("fallo del propio await import('react-native'): también se captura y devuelve status error", async () => {
    // Caso real del crash (#103): el import dinámico de react-native rechaza (módulo
    // roto / no disponible), no solo Share.share(). Sin override, loadNative() hace
    // `await import("react-native")` de verdad — mockeamos esa resolución de módulo
    // para que rechace, con módulos reseteados para no arrastrar el mock a otros tests.
    vi.resetModules();
    vi.doMock("react-native", () => {
      throw new Error("No se pudo cargar el módulo nativo react-native");
    });

    const freshShare = await import("./share");
    const result = await freshShare.shareContent({ referralCode: "BAH-TEST01", text: "Hola" });

    // No nos importa el mensaje literal (vitest envuelve el error de "vi.doMock" con
    // su propio texto) — lo que prueba el caso es que el rechazo del import se
    // capturó y NO se propagó como unhandled rejection.
    expect(result.status).toBe("error");

    vi.doUnmock("react-native");
    vi.resetModules();
  });
});
