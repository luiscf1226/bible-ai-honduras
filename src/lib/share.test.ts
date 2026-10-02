import { afterEach, describe, expect, it, vi } from "vitest";

import {
  asFileUri,
  buildReferralLink,
  buildShareMessage,
  resetShareNativeForTests,
  setShareNativeForTests,
  shareContent,
  shareImage,
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

describe("shareImage (#161 — imagen 9:16 por el mismo share sheet)", () => {
  const params = { fileUri: "file:///tmp/versiculo.png", referralCode: "BAH-TEST01", text: "Salmos 46:1" };

  afterEach(() => {
    resetShareNativeForTests();
  });

  it("iOS: manda la imagen y el mensaje con el link de referido en un solo Share.share", async () => {
    const native = mockNative({ os: "ios" });
    setShareNativeForTests(native);

    const result = await shareImage(params);

    expect(result).toEqual({ status: "shared", textCopied: false });
    expect(native.share).toHaveBeenCalledWith({
      message: buildShareMessage("Salmos 46:1", "BAH-TEST01"),
      url: "file:///tmp/versiculo.png",
    });
    expect(vi.mocked(native.share).mock.calls[0][0].message).toContain("?ref=BAH-TEST01");
  });

  it("iOS: cancelar el share sheet no es un error", async () => {
    setShareNativeForTests(mockNative({ os: "ios", share: vi.fn().mockResolvedValue({ action: "dismissedAction" }) }));

    await expect(shareImage(params)).resolves.toEqual({ status: "dismissed" });
  });

  it("sin plataforma conocida usa el camino de iOS (Share.share con url)", async () => {
    const native = mockNative();
    setShareNativeForTests(native);

    await shareImage(params);

    expect(native.share).toHaveBeenCalledTimes(1);
  });

  it("Android: comparte el PNG por el share sheet de archivos y copia el mensaje con el ?ref=", async () => {
    const shareFile = vi.fn().mockResolvedValue(undefined);
    const copyText = vi.fn();
    const native = mockNative({ copyText, os: "android", shareFile });
    setShareNativeForTests(native);

    const result = await shareImage(params);

    expect(result).toEqual({ status: "shared", textCopied: true });
    expect(shareFile).toHaveBeenCalledWith("file:///tmp/versiculo.png", expect.objectContaining({ mimeType: "image/png" }));
    expect(copyText).toHaveBeenCalledWith(buildShareMessage("Salmos 46:1", "BAH-TEST01"));
    // Share.share de react-native no acepta archivos en Android: no se usa.
    expect(native.share).not.toHaveBeenCalled();
  });

  it("Android: si el portapapeles falla, la imagen igual se comparte", async () => {
    const shareFile = vi.fn().mockResolvedValue(undefined);
    const copyText = vi.fn(() => {
      throw new Error("sin portapapeles");
    });
    setShareNativeForTests(mockNative({ copyText, os: "android", shareFile }));

    await expect(shareImage(params)).resolves.toEqual({ status: "shared", textCopied: false });
    expect(shareFile).toHaveBeenCalledTimes(1);
  });

  it("Android sin share sheet de archivos: devuelve error, no revienta", async () => {
    setShareNativeForTests(mockNative({ os: "android" }));

    const result = await shareImage(params);

    expect(result.status).toBe("error");
  });

  it("un rechazo del share sheet se captura y devuelve status error (mismo contrato que #103)", async () => {
    const failure = new Error("Share sheet no disponible");
    setShareNativeForTests(mockNative({ os: "android", shareFile: vi.fn().mockRejectedValue(failure) }));

    await expect(shareImage(params)).resolves.toEqual({ status: "error", error: failure });
  });
});

describe("asFileUri", () => {
  it("le pone file:// a una ruta suelta", () => {
    expect(asFileUri("/var/mobile/tmp/x.png")).toBe("file:///var/mobile/tmp/x.png");
  });

  it("no toca lo que ya trae esquema", () => {
    expect(asFileUri("file:///tmp/x.png")).toBe("file:///tmp/x.png");
    expect(asFileUri("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
  });
});
