import { describe, expect, it, vi } from "vitest";

import { HOME_ROUTE, goBackOrHomeWith, type BackNavigator } from "./navigation";

function navStub(canGoBack: boolean): BackNavigator {
  return { back: vi.fn(), canGoBack: () => canGoBack, replace: vi.fn() };
}

describe("goBackOrHomeWith", () => {
  it("desapila cuando hay historial", () => {
    const nav = navStub(true);
    goBackOrHomeWith(nav);
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("aterriza en Home cuando no hay historial (sin callejón sin salida)", () => {
    const nav = navStub(false);
    goBackOrHomeWith(nav);
    expect(nav.replace).toHaveBeenCalledWith(HOME_ROUTE);
    expect(nav.back).not.toHaveBeenCalled();
  });
});
