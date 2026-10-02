import { describe, expect, it } from "vitest";

import { bibleRowCopy, isOfflineNetState, offlineModuleCopy } from "./offlineCopy";

const MB = 1024 * 1024;
const base = { downloading: null, failed: false, online: true, version: "RV1909", totalBytes: 4.6 * MB };

describe("detección de red", () => {
  it("solo cuenta como sin conexión cuando NetInfo lo confirma", () => {
    expect(isOfflineNetState({ isConnected: false, isInternetReachable: null })).toBe(true);
    expect(isOfflineNetState({ isConnected: true, isInternetReachable: false })).toBe(true);
    expect(isOfflineNetState({ isConnected: true, isInternetReachable: true })).toBe(false);
    // Al abrir la app NetInfo todavía no sabe: no se muestra "sin señal" de más.
    expect(isOfflineNetState({ isConnected: null, isInternetReachable: null })).toBe(false);
  });
});

describe("fila 'Leer sin conexión' de Ajustes (#160)", () => {
  it("sin descargar: tamaño estimado y se puede tocar", () => {
    expect(bibleRowCopy({ ...base, state: { kind: "none" } })).toEqual({
      hint: "Descargá la RV1909 (4,6 MB) para leer sin datos. Mejor con wifi.",
      glyph: "↓",
      actionable: true,
    });
  });

  it("mientras se calcula o si el servidor todavía no armó los paquetes, no se puede tocar", () => {
    expect(bibleRowCopy({ ...base, state: { kind: "none" }, totalBytes: undefined })).toMatchObject({
      hint: "Calculando el tamaño…",
      actionable: false,
    });
    expect(bibleRowCopy({ ...base, state: { kind: "none" }, totalBytes: 0 }).actionable).toBe(false);
  });

  it("descargando muestra el avance por libros", () => {
    expect(
      bibleRowCopy({ ...base, state: { kind: "none" }, downloading: { done: 23, total: 66, book: "Salmos" } }),
    ).toMatchObject({ hint: "Descargando… 23 de 66 libros", actionable: false });
  });

  it("cortada: se ofrece seguir donde quedó; sin señal, se avisa que sigue después", () => {
    const state = { kind: "partial" as const, done: 40, total: 66 };
    expect(bibleRowCopy({ ...base, state }).hint).toBe("Se cortó la descarga (40 de 66 libros). Tocá para seguir donde quedó.");
    expect(bibleRowCopy({ ...base, state, online: false })).toMatchObject({
      hint: "Se quedó en 40 de 66 libros. Sigue cuando vuelva la señal.",
      actionable: false,
    });
  });

  it("descargada: muestra lo que ocupa y se puede quitar", () => {
    expect(bibleRowCopy({ ...base, state: { kind: "ready", bytes: 4.6 * MB } })).toEqual({
      hint: "Descargada · 4,6 MB. El lector y los planes funcionan sin señal.",
      glyph: "✓",
      actionable: true,
    });
  });

  it("con correcciones nuevas en el servidor, ofrece bajarlas", () => {
    expect(bibleRowCopy({ ...base, state: { kind: "update", bytes: MB, pending: 1 } }).hint).toBe(
      "Hay correcciones del texto en 1 libro. Tocá para bajarlas.",
    );
    expect(bibleRowCopy({ ...base, online: false, state: { kind: "update", bytes: MB, pending: 2 } }).glyph).toBe("✓");
  });

  it("sin señal y sin descargar, no se puede empezar", () => {
    expect(bibleRowCopy({ ...base, online: false, state: { kind: "none" } })).toMatchObject({
      hint: "Necesitás conexión para descargarla. Mejor con wifi.",
      actionable: false,
    });
  });
});

describe("Preguntar, Voces, Sentir e Historias sin señal", () => {
  it("dice por qué no funciona y qué sí se puede hacer", () => {
    const qa = offlineModuleCopy("qa", true);
    expect(qa.title).toBe("Sin conexión");
    expect(qa.body).toContain("Preguntar necesita internet");
    expect(qa.body).toContain("la Biblia que descargaste se lee sin datos");
    expect(qa.cta).toBe("Ir a leer");
    expect(offlineModuleCopy("voices", false).body).toContain("descargar la Biblia en Ajustes");
    for (const module of ["qa", "voices", "feelings", "stories"] as const) {
      expect(offlineModuleCopy(module, false).body.length).toBeGreaterThan(40);
    }
  });
});
