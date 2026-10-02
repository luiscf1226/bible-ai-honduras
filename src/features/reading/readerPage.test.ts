import { describe, expect, it } from "vitest";

import {
  dragOffset,
  enterOffset,
  markPageEnter,
  shouldClaimSwipe,
  shouldTurnPage,
  swipeDirection,
  takePageEnter,
} from "./pageSwipe";
import { shouldShowReaderHint } from "./readerHint";
import {
  charsInLines,
  chunkVerses,
  dropCapLines,
  estimateCharsForLines,
  runText,
  segmentOffsets,
  splitRunAt,
  superscriptNumber,
  verseLineTops,
  VERSE_NUMBER_GAP,
} from "./readerPage";

const psalm119 = Array.from({ length: 176 }, (_, index) => ({ verse: index + 1, text: `Texto del versículo ${index + 1}.` }));

describe("página del lector (#195)", () => {
  it("parte Salmos 119 en bloques de 20 versículos sin perder ninguno", () => {
    const runs = chunkVerses(psalm119);
    expect(runs).toHaveLength(9);
    expect(runs.flatMap((run) => run.segments.map((segment) => segment.verse))).toEqual(psalm119.map((v) => v.verse));
    expect(runs[8].segments).toHaveLength(16);
    expect(new Set(runs.map((run) => run.key)).size).toBe(9);
  });

  it("escribe el número voladito con cifras superíndice", () => {
    expect(superscriptNumber(119)).toBe("¹¹⁹");
    expect(superscriptNumber(40)).toBe("⁴⁰");
  });

  it("arma prosa continua: número, espacio fino, texto y un espacio entre versículos", () => {
    const [run] = chunkVerses([
      { verse: 1, text: "Dios es nuestro amparo." },
      { verse: 2, text: "Por tanto, no temeremos." },
    ]);
    expect(runText(run)).toBe(`¹${VERSE_NUMBER_GAP}Dios es nuestro amparo. ²${VERSE_NUMBER_GAP}Por tanto, no temeremos. `);
    expect(segmentOffsets(run)).toEqual([0, 3 + "Dios es nuestro amparo. ".length]);
  });

  it("parte el primer bloque para la capitular sin cortar palabras ni repetir el número", () => {
    const [run] = chunkVerses([
      { verse: 1, text: "Dios es nuestro amparo." },
      { verse: 2, text: "Por tanto, no temeremos." },
    ]);
    // Cae a mitad de "amparo": retrocede al espacio anterior.
    const split = splitRunAt(run, runText(run).indexOf("amparo") + 3);
    expect(split).not.toBeNull();
    const [lead, rest] = split!;
    expect(runText(lead) + runText(rest)).toBe(runText(run));
    expect(lead.segments).toEqual([{ verse: 1, text: "Dios es nuestro ", showNumber: true, endsVerse: false }]);
    expect(rest.segments[0]).toEqual({ verse: 1, text: "amparo.", showNumber: false, endsVerse: true });
    expect(rest.key).toBe(run.key);
    expect(lead.key).not.toBe(run.key);
  });

  it("parte justo entre versículos cuando el renglón termina ahí", () => {
    const [run] = chunkVerses([
      { verse: 1, text: "Uno." },
      { verse: 2, text: "Dos." },
    ]);
    const [lead, rest] = splitRunAt(run, runText(run).indexOf("²"))!;
    expect(lead.segments.map((s) => s.verse)).toEqual([1]);
    expect(rest.segments).toEqual([{ verse: 2, text: "Dos.", showNumber: true, endsVerse: true }]);
    expect(splitRunAt(run, 0)).toBeNull();
    expect(splitRunAt(run, runText(run).length)).toBeNull();
  });

  it("ubica el renglón donde empieza cada versículo a partir de onTextLayout", () => {
    const [run] = chunkVerses([
      { verse: 1, text: "Dios es nuestro amparo y fortaleza," },
      { verse: 2, text: "Por tanto." },
    ]);
    const text = runText(run);
    const firstBreak = text.indexOf("fortaleza");
    const lines = [
      { text: text.slice(0, firstBreak), y: 0 },
      { text: text.slice(firstBreak, firstBreak + 12), y: 31 },
      { text: text.slice(firstBreak + 12), y: 62 },
    ];
    expect(verseLineTops(run, lines)).toEqual({ 1: 0, 2: 31 });
    expect(verseLineTops(run, [])).toEqual({});
    expect(charsInLines(lines, 2)).toBe(firstBreak + 12);
  });

  it("calcula los renglones de la capitular y estima el corte", () => {
    expect(dropCapLines(52, 31)).toBe(2);
    expect(dropCapLines(52, 60)).toBe(1);
    expect(estimateCharsForLines(300, 19, 2)).toBeGreaterThan(60);
    expect(estimateCharsForLines(0, 19, 2)).toBe(0);
  });
});

describe("pasar página deslizando (#195)", () => {
  it("solo reclama gestos claramente horizontales", () => {
    expect(shouldClaimSwipe(40, 5)).toBe(true);
    expect(shouldClaimSwipe(40, 30)).toBe(false);
    expect(shouldClaimSwipe(5, 0)).toBe(false);
  });

  it("izquierda es el capítulo siguiente y pasa por distancia o velocidad", () => {
    expect(swipeDirection(-80)).toBe("next");
    expect(swipeDirection(80)).toBe("previous");
    expect(shouldTurnPage(-120, 0, 390)).toBe(true);
    expect(shouldTurnPage(-30, -1, 390)).toBe(true);
    expect(shouldTurnPage(-30, 0, 390)).toBe(false);
  });

  it("se resiste en los bordes del canon y entra desde el lado contrario", () => {
    expect(dragOffset(100, false)).toBeLessThan(100);
    expect(dragOffset(100, true)).toBe(100);
    markPageEnter("next");
    expect(takePageEnter()).toBe("next");
    expect(takePageEnter()).toBeNull();
    expect(enterOffset("next", 100)).toBeGreaterThan(0);
    expect(enterOffset("previous", 100)).toBeLessThan(0);
    expect(enterOffset(null, 100)).toBe(0);
  });
});

describe("pista de primera vez (#196)", () => {
  it("con sesión depende de users.readerHintSeen", () => {
    expect(shouldShowReaderHint({ user: { _id: "u" }, localSeen: undefined, dismissed: false })).toBe(true);
    expect(shouldShowReaderHint({ user: { _id: "u", readerHintSeen: true }, localSeen: false, dismissed: false })).toBe(false);
    expect(shouldShowReaderHint({ user: { _id: "u" }, localSeen: undefined, dismissed: true })).toBe(false);
  });

  it("sin sesión usa lo local y no parpadea mientras carga", () => {
    expect(shouldShowReaderHint({ user: undefined, localSeen: false, dismissed: false })).toBe(false);
    expect(shouldShowReaderHint({ user: null, localSeen: undefined, dismissed: false })).toBe(false);
    expect(shouldShowReaderHint({ user: null, localSeen: false, dismissed: false })).toBe(true);
    expect(shouldShowReaderHint({ user: null, localSeen: true, dismissed: false })).toBe(false);
  });
});
