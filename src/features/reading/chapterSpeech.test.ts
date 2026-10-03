import { describe, expect, it } from "vitest";

import {
  ChapterSpeechController,
  chooseSpanishVoice,
  startIndex,
  utteranceFor,
  type ChapterSpeechState,
  type SpeechEngine,
} from "./chapterSpeech";

type Spoken = { text: string; language: string; voice?: string; onDone: () => void; onStopped: () => void; onError: () => void };

function fakeEngine(voices = [{ identifier: "es-mx-1", language: "es-MX" }]) {
  const spoken: Spoken[] = [];
  let stops = 0;
  const engine: SpeechEngine = {
    speak: (text, options) => spoken.push({ text, ...options }),
    stop: () => {
      stops += 1;
      // Como la voz del sistema: cortar avisa `onStopped` del que sonaba.
      spoken.at(-1)?.onStopped();
    },
    getVoices: async () => voices,
  };
  return { engine, spoken, stops: () => stops };
}

const VERSES = [
  { verse: 1, text: "Dios es nuestro amparo y fortaleza," },
  { verse: 2, text: "Por tanto no temeremos," },
  { verse: 3, text: "Bramarán, turbaránse sus aguas;" },
];
const CHAPTER = { book: "Salmos", chapter: 46 };

function setup(voices?: { identifier: string; language: string }[]) {
  const fake = fakeEngine(voices);
  const states: ChapterSpeechState[] = [];
  const controller = new ChapterSpeechController(fake.engine, CHAPTER, (state) => states.push(state));
  return { ...fake, controller, states };
}

describe("voz en español (#157)", () => {
  it("prefiere es-MX, después es-US, y entre iguales la Enhanced", () => {
    const voices = [
      { identifier: "en", language: "en-US" },
      { identifier: "es-es", language: "es-ES" },
      { identifier: "es-us", language: "es-US" },
      { identifier: "es-mx", language: "es-MX" },
      { identifier: "es-mx-hd", language: "es_MX", quality: "Enhanced" },
    ];
    expect(chooseSpanishVoice(voices)?.identifier).toBe("es-mx-hd");
    expect(chooseSpanishVoice(voices.slice(0, 3))?.identifier).toBe("es-us");
    expect(chooseSpanishVoice(voices.slice(0, 2))?.identifier).toBe("es-es");
  });

  it("sin voces en español devuelve null (se pide es-MX y decide el sistema)", () => {
    expect(chooseSpanishVoice([{ identifier: "en", language: "en-US" }])).toBeNull();
  });
});

describe("cola del capítulo", () => {
  it("empieza en el versículo pedido o, si no existe, en el primero", () => {
    expect(startIndex(VERSES, 2)).toBe(1);
    expect(startIndex(VERSES, 99)).toBe(0);
    expect(startIndex(VERSES, null)).toBe(0);
  });

  it("anuncia libro y capítulo solo al empezar desde el versículo 1, y no toca el texto", () => {
    expect(utteranceFor({ ...CHAPTER, verse: VERSES[0], announce: true })).toBe(
      "Salmos, capítulo 46. Dios es nuestro amparo y fortaleza,",
    );
    expect(utteranceFor({ ...CHAPTER, verse: VERSES[1], announce: false })).toBe(VERSES[1].text);
  });

  it("lee versículo por versículo con la voz elegida hasta el final", async () => {
    const { controller, spoken, states } = setup();
    await controller.play(VERSES);
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toMatchObject({ language: "es-MX", voice: "es-mx-1" });
    expect(spoken[0].text).toContain("Salmos, capítulo 46.");
    spoken[0].onDone();
    spoken[1].onDone();
    expect(spoken.map((item) => item.text).slice(1)).toEqual([VERSES[1].text, VERSES[2].text]);
    spoken[2].onDone();
    expect(states.at(-1)).toEqual({ status: "idle" });
  });

  it("desde el versículo seleccionado no anuncia y arranca ahí", async () => {
    const { controller, spoken } = setup();
    await controller.play(VERSES, 2);
    expect(spoken[0].text).toBe(VERSES[1].text);
    expect(controller.current).toEqual({ status: "playing", verse: 2, index: 1, total: 3 });
  });

  it("pausar corta la voz y reanudar repite el versículo donde quedó", async () => {
    const { controller, spoken } = setup();
    await controller.play(VERSES);
    spoken[0].onDone();
    controller.pause();
    expect(controller.current).toMatchObject({ status: "paused", verse: 2 });
    // El onDone tardío del versículo cortado no avanza la cola.
    spoken[1].onDone();
    expect(spoken).toHaveLength(2);
    controller.resume();
    expect(spoken).toHaveLength(3);
    expect(spoken[2].text).toBe(VERSES[1].text);
    expect(controller.current).toMatchObject({ status: "playing", verse: 2 });
  });

  it("parar deja todo en idle y los avisos viejos no reviven la lectura", async () => {
    const { controller, spoken, stops } = setup();
    await controller.play(VERSES);
    controller.stop();
    expect(stops()).toBe(1);
    expect(controller.current).toEqual({ status: "idle" });
    spoken[0].onDone();
    expect(spoken).toHaveLength(1);
    // Parar sin nada sonando no llama a la voz del sistema.
    controller.stop();
    expect(stops()).toBe(1);
  });

  it("un corte que no pidió la persona deja la lectura en pausa", async () => {
    const { controller, spoken } = setup();
    await controller.play(VERSES);
    spoken[0].onStopped();
    expect(controller.current).toMatchObject({ status: "paused", verse: 1 });
  });

  it("un versículo que la voz no puede leer no frena el capítulo", async () => {
    const { controller, spoken } = setup();
    await controller.play(VERSES);
    spoken[0].onError();
    expect(controller.current).toMatchObject({ status: "playing", verse: 2 });
  });

  it("sin versículos con texto no arranca", async () => {
    const { controller, spoken } = setup();
    await controller.play([{ verse: 1, text: "  " }]);
    expect(spoken).toHaveLength(0);
    expect(controller.current).toEqual({ status: "idle" });
  });

  it("si la persona para mientras se buscan las voces, no empieza a sonar", async () => {
    const { controller, spoken } = setup();
    const playing = controller.play(VERSES);
    controller.stop();
    await playing;
    expect(spoken).toHaveLength(0);
  });
});
