import { describe, expect, it } from "vitest";

import { CONVERSATION_OPTIONS, TABS, isConversationRoute, tabForRoute, tabHref } from "./tabs";

describe("barra de pestañas (#232)", () => {
  it("tiene Inicio, Biblia, Conversar, Historias y Mi espacio, en ese orden", () => {
    expect(TABS.map((tab) => tab.label)).toEqual(["Inicio", "Biblia", "Conversar", "Historias", "Mi espacio"]);
  });

  it("Preguntar, Sentir y Voces encienden Conversar", () => {
    expect(tabForRoute("preguntar")).toBe("conversar");
    expect(tabForRoute("sentir")).toBe("conversar");
    expect(tabForRoute("voces")).toBe("conversar");
    expect(tabForRoute("leer/index")).toBe("biblia");
    expect(tabForRoute("mi-espacio")).toBe("mi-espacio");
    expect(tabForRoute("cualquier-otra")).toBe("inicio");
  });

  it("Conversar vuelve a la última de las tres que se usó", () => {
    const conversar = TABS.find((tab) => tab.id === "conversar")!;
    expect(tabHref(conversar, null)).toBe("/preguntar");
    expect(tabHref(conversar, "sentir")).toBe("/sentir");
    const inicio = TABS.find((tab) => tab.id === "inicio")!;
    expect(tabHref(inicio, "sentir")).toBe("/home");
  });

  it("el selector de Conversar cubre las tres rutas", () => {
    expect(CONVERSATION_OPTIONS.map((option) => option.id)).toEqual(["preguntar", "sentir", "voces"]);
    expect(isConversationRoute("voces")).toBe(true);
    expect(isConversationRoute("home")).toBe(false);
  });

  it("cada pestaña tiene una ruta distinta", () => {
    expect(new Set(TABS.map((tab) => tab.href)).size).toBe(TABS.length);
  });
});
