import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("expo-router", () => ({ router: { push: (...args: unknown[]) => push(...args) } }));

import { goToPause } from "./goToPause";
import {
  PAUSE_DURATION_MS,
  PAUSE_ROUTE,
  choosePauseVerse,
  pausePhase,
  pauseProgress,
  pauseRemaining,
  pauseRouteParams,
  readPauseParams,
} from "./pause";

beforeEach(() => push.mockReset());

describe("goToPause", () => {
  it("desde el inicio: abre la pausa sin versículo (usa el del día)", () => {
    goToPause();
    expect(push).toHaveBeenCalledWith({ pathname: PAUSE_ROUTE, params: {} });
  });

  it("desde Sentir: el versículo del devocional viaja a la pausa", () => {
    goToPause({ book: "Mateo", chapter: 11, verse: 28 });
    const [{ params }] = push.mock.calls[0];
    expect(readPauseParams(params)).toEqual({ book: "Mateo", chapter: 11, verse: 28 });
  });

  it("la ruta es /pausa", () => {
    expect(PAUSE_ROUTE).toBe("/pausa");
  });
});

describe("pauseRouteParams / readPauseParams", () => {
  it("son inversos", () => {
    const verse = { book: "Salmos", chapter: 46, verse: 10 };
    expect(readPauseParams(pauseRouteParams(verse))).toEqual(verse);
  });

  it("sin versículo no manda params", () => {
    expect(pauseRouteParams(null)).toEqual({});
    expect(readPauseParams({})).toBeNull();
  });

  it("un deep link roto cae al versículo del día", () => {
    expect(readPauseParams({ book: "Jaun", chapter: "3", verse: "16" })).toBeNull();
    expect(readPauseParams({ book: "Juan", chapter: "NaN", verse: "16" })).toBeNull();
    expect(readPauseParams({ book: "Juan", chapter: "99", verse: "1" })).toBeNull();
    expect(readPauseParams({ book: "Juan", chapter: "3" })).toBeNull();
    expect(readPauseParams({ book: "Juan", chapter: "0", verse: "1" })).toBeNull();
  });

  it("normaliza el nombre del libro", () => {
    expect(readPauseParams({ book: "salmos", chapter: "23", verse: "1" })).toEqual({ book: "Salmos", chapter: 23, verse: 1 });
  });

  it("toma el primer valor si llega repetido", () => {
    expect(readPauseParams({ book: ["Juan", "Mateo"], chapter: ["3"], verse: ["16"] })).toEqual({
      book: "Juan",
      chapter: 3,
      verse: 16,
    });
  });
});

describe("choosePauseVerse", () => {
  it("prefiere el versículo de Sentir", () => {
    expect(choosePauseVerse({ book: "Isaías", chapter: 41, verse: 10 }, "Salmos 23:1")).toEqual({
      book: "Isaías",
      chapter: 41,
      verse: 10,
    });
  });

  it("si no viene, usa el del día", () => {
    expect(choosePauseVerse(null, "Salmos 23:1")).toEqual({ book: "Salmos", chapter: 23, verse: 1 });
  });

  it("un rango del día se ancla a su primer versículo", () => {
    expect(choosePauseVerse(null, "2 Corintios 1:3-4")).toEqual({ book: "2 Corintios", chapter: 1, verse: 3 });
  });

  it("sin devocional todavía, no hay versículo", () => {
    expect(choosePauseVerse(null, undefined)).toBeNull();
    expect(choosePauseVerse(null, "texto suelto")).toBeNull();
  });
});

describe("el minuto", () => {
  it("dura un minuto", () => {
    expect(PAUSE_DURATION_MS).toBe(60_000);
  });

  it("progreso: 0 sin empezar, crece lineal y se queda en 1", () => {
    expect(pauseProgress(null, 5_000)).toBe(0);
    expect(pauseProgress(1_000, 1_000)).toBe(0);
    expect(pauseProgress(1_000, 31_000)).toBe(0.5);
    expect(pauseProgress(1_000, 61_000)).toBe(1);
    expect(pauseProgress(1_000, 500_000)).toBe(1);
  });

  it("un reloj que va para atrás no da progreso negativo", () => {
    expect(pauseProgress(10_000, 5_000)).toBe(0);
  });

  it("lo que falta nunca es negativo", () => {
    expect(pauseRemaining(0, 20_000)).toBe(40_000);
    expect(pauseRemaining(0, 90_000)).toBe(0);
  });

  it("fases: esperando el versículo, corriendo, amén", () => {
    expect(pausePhase(null, 0)).toBe("waiting");
    expect(pausePhase(0, 59_999)).toBe("running");
    expect(pausePhase(0, 60_000)).toBe("done");
  });

  it("acepta otra duración", () => {
    expect(pauseProgress(0, 500, 1_000)).toBe(0.5);
    expect(pausePhase(0, 1_000, 1_000)).toBe("done");
    expect(pauseProgress(0, 0, 0)).toBe(1);
  });
});
