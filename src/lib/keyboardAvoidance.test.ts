import { describe, expect, it } from "vitest";

import {
  ZERO_INSETS,
  focusedInputScrollOffsetFor,
  keyboardBehaviorFor,
  keyboardVerticalOffsetFor,
} from "./keyboardAvoidance";
import { tokens } from "../theme/tokens";

// iPhone 16 Pro (Dynamic Island) y un Android con barra de gestos: los dos
// casos que pide el criterio de aceptación del issue #105.
const NOTCH = { bottom: 34, left: 0, right: 0, top: 59 };
const GESTURE_BAR = { bottom: 24, left: 0, right: 0, top: 44 };

describe("keyboardBehaviorFor", () => {
  it("usa padding en iOS para no apagar el flex del contenedor", () => {
    expect(keyboardBehaviorFor("ios")).toBe("padding");
  });

  it("usa height en Android porque con edge-to-edge la ventana no se encoge sola", () => {
    expect(keyboardBehaviorFor("android")).toBe("height");
  });

  it("no compensa nada en web: el navegador ya reacomoda", () => {
    expect(keyboardBehaviorFor("web")).toBeUndefined();
  });
});

describe("keyboardVerticalOffsetFor", () => {
  it("no suma el inset de arriba: Yoga ya lo mete en el frame.y del hijo", () => {
    expect(keyboardVerticalOffsetFor({ insets: NOTCH, platform: "ios" })).toBe(0);
    expect(keyboardVerticalOffsetFor({ insets: GESTURE_BAR, platform: "android" })).toBe(0);
  });

  it("tampoco suma el inset de abajo, que el SafeAreaView ya reservó", () => {
    expect(keyboardVerticalOffsetFor({ insets: NOTCH, platform: "ios" })).toBe(
      keyboardVerticalOffsetFor({ insets: ZERO_INSETS, platform: "ios" }),
    );
  });

  it("sí suma el chrome de navegación, que el onLayout del KAV no puede medir", () => {
    expect(
      keyboardVerticalOffsetFor({ insets: NOTCH, platform: "ios", topChromeHeight: 96 }),
    ).toBe(96);
  });
});

describe("focusedInputScrollOffsetFor", () => {
  it("corrige el inset de arriba, que es lo que dejaba el input debajo del teclado", () => {
    expect(focusedInputScrollOffsetFor({ insets: NOTCH, platform: "ios" })).toBe(
      NOTCH.top + tokens.space.xxl,
    );
  });

  it("es mayor con Dynamic Island que con una barra de estado normal", () => {
    expect(focusedInputScrollOffsetFor({ insets: NOTCH, platform: "ios" })).toBeGreaterThan(
      focusedInputScrollOffsetFor({ insets: GESTURE_BAR, platform: "android" }),
    );
  });

  it("suma el chrome de navegación al inset de arriba", () => {
    expect(
      focusedInputScrollOffsetFor({ insets: GESTURE_BAR, platform: "android", topChromeHeight: 56 }),
    ).toBe(GESTURE_BAR.top + 56 + tokens.space.xxl);
  });

  it("sin insets queda solo el respiro del token, nunca un valor negativo", () => {
    expect(focusedInputScrollOffsetFor({ insets: ZERO_INSETS, platform: "web" })).toBe(
      tokens.space.xxl,
    );
  });
});
