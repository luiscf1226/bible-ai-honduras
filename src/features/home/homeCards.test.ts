import { describe, expect, it } from "vitest";

import { FEELINGS } from "../feelings/feelings";
import {
  ASK_EXAMPLES,
  askExampleForDay,
  askExampleRoute,
  FEELING_SHORTCUTS,
  FEELING_WRITE_ROUTE,
  feelingRoute,
  greetingFor,
  HOME_CARD_ORDER,
  HOME_CONTEXT_PRIORITY,
  HOME_ROUTES,
  HOME_TILE_IDS,
  hondurasHour,
  isSundayInHonduras,
  pickForDay,
  pickHomeContext,
  pickHomeCharacters,
  readStatusLine,
} from "./homeCards";

describe("orden de las tarjetas (#193, #232)", () => {
  it("una sola tarjeta de contexto arriba del versículo; la pausa se mudó a Sentir", () => {
    expect(HOME_CARD_ORDER).toEqual(["context", "verse", "feeling", "read", "ask", "characters", "stories"]);
  });

  it("los cuatro módulos cierran el inicio como mosaicos de la cuadrícula 2×2 (U1b)", () => {
    expect(HOME_TILE_IDS).toEqual(["read", "ask", "characters", "stories"]);
    expect(HOME_CARD_ORDER.slice(-HOME_TILE_IDS.length)).toEqual([...HOME_TILE_IDS]);
  });

  it("cada tarjeta abre su módulo", () => {
    expect(HOME_ROUTES.today).toEqual({ pathname: "/hoy" });
    expect(HOME_ROUTES.read).toEqual({ pathname: "/leer" });
    expect(HOME_ROUTES.ask).toEqual({ pathname: "/preguntar" });
    expect(HOME_ROUTES.characters).toEqual({ pathname: "/voces" });
    expect(HOME_ROUTES.stories).toEqual({ pathname: "/historias" });
    expect(HOME_ROUTES.newSermonNote).toEqual({ pathname: "/notas/[noteId]", params: { noteId: "nueva" } });
  });
});

describe("tarjeta de contexto (#232)", () => {
  it("el peor día muestra una sola, con la prioridad del issue", () => {
    expect(pickHomeContext({ update: true, sermon: true, dates: true, season: true, savedMemory: true })).toBe("update");
    expect(pickHomeContext({ sermon: true, dates: true, season: true, savedMemory: true })).toBe("sermon");
    expect(pickHomeContext({ dates: true, season: true, savedMemory: true })).toBe("dates");
    expect(pickHomeContext({ season: true, savedMemory: true })).toBe("season");
    expect(pickHomeContext({ savedMemory: true })).toBe("savedMemory");
    expect(pickHomeContext({})).toBeNull();
  });

  it("el orden es actualización > nota de prédica > fecha personal > temporada > recuerdo", () => {
    expect(HOME_CONTEXT_PRIORITY).toEqual(["update", "sermon", "dates", "season", "savedMemory"]);
  });

  it("domingo se decide con la hora de Honduras", () => {
    // Domingo 11 de octubre de 2026, 23:30 en Honduras = lunes 05:30 UTC.
    expect(isSundayInHonduras(Date.UTC(2026, 9, 12, 5, 30))).toBe(true);
    // Lunes 12 de octubre de 2026, 08:00 en Honduras.
    expect(isSundayInHonduras(Date.UTC(2026, 9, 12, 14, 0))).toBe(false);
  });
});

describe("Leer la Biblia", () => {
  it("con separador, la línea de estado lo nombra y abre ese versículo", () => {
    const status = readStatusLine({ book: "Salmos", chapter: 46, verse: 1 }, { book: "Juan", chapter: 3 });
    expect(status).toEqual({
      label: "Tu separador · Salmos 46:1",
      passage: { book: "Salmos", chapter: 46, verse: 1 },
    });
  });

  it("sin separador, sigue donde quedó", () => {
    expect(readStatusLine(null, { book: "Juan", chapter: 3 })).toEqual({
      label: "Seguí leyendo · Juan 3",
      passage: { book: "Juan", chapter: 3 },
    });
  });

  it("sin nada, invita a empezar por Génesis 1", () => {
    expect(readStatusLine(null, null)).toEqual({ label: "Empezá por Génesis 1", passage: { book: "Génesis", chapter: 1 } });
    expect(readStatusLine(undefined, undefined).passage).toEqual({ book: "Génesis", chapter: 1 });
  });
});

describe("¿Cómo estás hoy?", () => {
  it("los atajos son sentimientos reales y abren Sentir con el chip elegido", () => {
    expect(FEELING_SHORTCUTS).toHaveLength(3);
    for (const feeling of FEELING_SHORTCUTS) {
      expect(FEELINGS).toContain(feeling);
      expect(feelingRoute(feeling)).toEqual({ pathname: "/sentir", params: { feeling } });
    }
  });

  it("escribir abre Sentir con el campo libre", () => {
    expect(FEELING_WRITE_ROUTE).toEqual({ pathname: "/sentir", params: { escribir: "1" } });
  });
});

describe("Preguntar sobre la Biblia", () => {
  it("la pregunta de ejemplo cambia de un día al otro y da la vuelta", () => {
    expect(askExampleForDay("2026-10-02")).not.toBe(askExampleForDay("2026-10-03"));
    expect(askExampleForDay("2026-10-02")).toBe(askExampleForDay("2026-10-02"));
    const days = Array.from({ length: ASK_EXAMPLES.length }, (_, index) => `2026-11-${String(index + 1).padStart(2, "0")}`);
    expect(new Set(days.map(askExampleForDay)).size).toBe(ASK_EXAMPLES.length);
  });

  it("todas las preguntas son preguntas", () => {
    for (const question of ASK_EXAMPLES) {
      expect(question.startsWith("¿")).toBe(true);
      expect(question.endsWith("?")).toBe(true);
    }
  });

  it("el ejemplo abre el chat con la pregunta escrita", () => {
    expect(askExampleRoute("¿Quién fue Rut?")).toEqual({ pathname: "/preguntar", params: { pregunta: "¿Quién fue Rut?" } });
  });
});

describe("pickForDay", () => {
  it("devuelve undefined con una lista vacía", () => {
    expect(pickForDay([], "2026-10-02")).toBeUndefined();
  });

  it("una fecha inválida no revienta", () => {
    expect(pickForDay(["a", "b"], "no-es-fecha")).toBeDefined();
  });
});

describe("Personajes", () => {
  const catalog = ["moises", "david", "ester", "pablo", "rut", "elias"].map((slug) => ({ slug }));

  it("muestra 4: los que nombra la línea primero", () => {
    expect(pickHomeCharacters(catalog).map((c) => c.slug)).toEqual(["moises", "ester", "david", "pablo"]);
  });

  it("si faltan, completa con el catálogo", () => {
    expect(pickHomeCharacters([{ slug: "rut" }, { slug: "moises" }]).map((c) => c.slug)).toEqual(["moises", "rut"]);
    expect(pickHomeCharacters([])).toEqual([]);
  });

  it("el personaje del mes va primero y no se repite (#200)", () => {
    const catalog = ["moises", "david", "ester", "pablo", "rut", "elias"].map((slug) => ({ slug }));
    expect(pickHomeCharacters(catalog, "elias").map((c) => c.slug)).toEqual(["elias", "moises", "ester", "david"]);
    expect(pickHomeCharacters(catalog, "david").map((c) => c.slug)).toEqual(["david", "moises", "ester", "pablo"]);
    expect(pickHomeCharacters(catalog, "noexiste").map((c) => c.slug)).toEqual(["moises", "ester", "david", "pablo"]);
  });
});

describe("encabezado", () => {
  it("saluda según la hora", () => {
    expect(greetingFor(5)).toBe("Buenos días");
    expect(greetingFor(11)).toBe("Buenos días");
    expect(greetingFor(12)).toBe("Buenas tardes");
    expect(greetingFor(18)).toBe("Buenas tardes");
    expect(greetingFor(19)).toBe("Buenas noches");
    expect(greetingFor(0)).toBe("Buenas noches");
    expect(greetingFor(4)).toBe("Buenas noches");
  });

  it("usa la hora de Honduras (UTC−6), no la del teléfono", () => {
    expect(hondurasHour(Date.UTC(2026, 9, 2, 12, 30))).toBe(6);
    expect(hondurasHour(Date.UTC(2026, 9, 2, 5, 59))).toBe(23);
  });
});
