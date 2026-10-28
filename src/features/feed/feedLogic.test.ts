import { describe, expect, it } from "vitest";

import { FEED_RECENT_GUARD, FEED_SEEN_MAX } from "../../../convex/verseFeedLimits";
import {
  buildFeedShareText,
  createDoubleTapDetector,
  feedItemKey,
  feedReference,
  feedVoiceAction,
  feedVerseText,
  feedVerseType,
  formatLikes,
  newFeedSeed,
  nextSeenRefs,
  buildReelShareText,
  entryAudioUrl,
  entryImageUrls,
  isReel,
  nextScene,
  reelOverline,
  reelReadingMs,
  reelReference,
  reelVoiceTimeoutMs,
  setLikeLocally,
  settleLike,
  type FeedItem,
  type FeedReelItem,
} from "./feedLogic";

function reel(extra: Partial<FeedReelItem> = {}): FeedReelItem {
  const scene = (n: number) => ({
    text: `Parte ${n} de la historia.`,
    reference: `Génesis 1:${n}`,
    book: "Génesis",
    chapter: 1,
    verse: n,
    imageUrl: `https://example.com/${n}.webp`,
    imageAlt: "ilustración",
    audioUrl: n === 2 ? null : `https://example.com/${n}.mp3`,
  });
  return {
    kind: "story",
    ref: "historia:creacion",
    title: "La creación",
    subtitle: "Génesis 1–2",
    voiceSlug: null,
    scenes: [scene(1), scene(2), scene(3)],
    likes: 0,
    liked: false,
    ...extra,
  };
}

function item(ref: string, extra: Partial<FeedItem> = {}): FeedItem {
  return {
    kind: "verse",
    ref,
    book: "Salmos",
    chapter: 23,
    verse: 1,
    endVerse: null,
    text: "Jehová es mi pastor; nada me faltará.",
    version: "RV1909",
    topic: "Paz",
    imageUrl: "https://example.com/a.jpg",
    imageAlt: "foto",
    audioUrl: null,
    likes: 0,
    liked: false,
    ...extra,
  };
}

describe("tamaño del versículo", () => {
  it("corto llena la pantalla, largo baja para entrar sin scroll", () => {
    expect(feedVerseType("Jehová es mi pastor; nada me faltará.")).toBe("verseFeed");
    expect(feedVerseType("a".repeat(200))).toBe("verseHero");
    expect(feedVerseType("a".repeat(400))).toBe("readerBody");
  });
});

describe("texto del versículo", () => {
  it("baja la primera palabra en mayúsculas de RV1909 y no toca el resto", () => {
    expect(feedVerseText("ES pues la fe la sustancia")).toBe("Es pues la fe la sustancia");
    expect(feedVerseText("EN el principio crió Dios")).toBe("En el principio crió Dios");
    expect(feedVerseText("Jehová es mi pastor")).toBe("Jehová es mi pastor");
    expect(feedVerseText("Y dijo DIOS")).toBe("Y dijo DIOS");
  });

  it("compartir usa el mismo texto que se ve", () => {
    expect(
      buildFeedShareText(item("Hebreos 11:1", { book: "Hebreos", chapter: 11, verse: 1, text: "ES pues la fe" })),
    ).toBe('"Es pues la fe"\n— Hebreos 11:1 (RV1909)');
  });
});

describe("vistos por vuelta", () => {
  it("suma lo nuevo y tiene tope", () => {
    expect(nextSeenRefs(["A"], ["B", "C"], false)).toEqual(["A", "B", "C"]);
    const many = Array.from({ length: FEED_SEEN_MAX + 10 }, (_, index) => `R${index}`);
    const seen = nextSeenRefs([], many, false);
    expect(seen).toHaveLength(FEED_SEEN_MAX);
    expect(seen.at(-1)).toBe(`R${FEED_SEEN_MAX + 9}`);
  });

  it("en una vuelta nueva arranca de cero, con las últimas vistas adelante", () => {
    const previous = Array.from({ length: 100 }, (_, index) => `R${index}`);
    expect(nextSeenRefs(previous, ["X"], true)).toEqual([...previous.slice(-FEED_RECENT_GUARD), "X"]);
  });

  it("la clave de una pantalla distingue la misma cita en otra vuelta", () => {
    expect(feedItemKey(item("A"), 0)).not.toBe(feedItemKey(item("A"), 480));
  });
});

describe("♥", () => {
  it("deja el ♥ como se pidió y la cuenta solo cambia si cambia el estado", () => {
    const liked = setLikeLocally([item("A", { likes: 4 }), item("B")], "A", true);
    expect(liked[0]).toMatchObject({ liked: true, likes: 5 });
    expect(liked[1]).toMatchObject({ liked: false, likes: 0 });
    expect(setLikeLocally(liked, "A", true)[0]).toMatchObject({ liked: true, likes: 5 });
    expect(setLikeLocally(liked, "A", false)[0]).toMatchObject({ liked: false, likes: 4 });
    expect(settleLike(liked, "A", { liked: true, likes: 9 })[0]).toMatchObject({ liked: true, likes: 9 });
  });

  it("marca todas las pantallas de la misma cita", () => {
    const items = setLikeLocally([item("A"), item("B"), item("A")], "A", true);
    expect(items.map((entry) => entry.liked)).toEqual([true, false, true]);
  });

  it("la cuenta nunca baja de cero", () => {
    expect(setLikeLocally([item("A", { liked: true, likes: 0 })], "A", false)[0].likes).toBe(0);
  });

  it("muestra la cuenta corta", () => {
    expect(formatLikes(0)).toBe("");
    expect(formatLikes(37)).toBe("37");
    expect(formatLikes(1250)).toBe("1.2 mil");
    expect(formatLikes(5000)).toBe("5 mil");
  });
});

describe("doble toque", () => {
  it("dos toques dentro de la ventana son doble toque; uno solo, no", () => {
    const isDouble = createDoubleTapDetector(280);
    expect(isDouble(1000)).toBe(false);
    expect(isDouble(1200)).toBe(true);
    // El tercero empieza de nuevo: no cuenta como otro doble toque.
    expect(isDouble(1300)).toBe(false);
    expect(isDouble(2000)).toBe(false);
  });
});

describe("compartir", () => {
  it("lleva el versículo y la cita con el rango completo", () => {
    const passage = { book: "Filipenses", chapter: 4, verse: 6, endVerse: 7, text: "Por nada estéis afanosos…" };
    expect(buildFeedShareText(item("Filipenses 4:6-7", passage))).toBe(
      '"Por nada estéis afanosos…"\n— Filipenses 4:6-7 (RV1909)',
    );
  });
});

describe("cita", () => {
  it("sale de los versículos que se muestran, no del id del catálogo", () => {
    const shortened = item("2 Corintios 12:9-10", { book: "2 Corintios", chapter: 12, verse: 9, endVerse: null });
    expect(feedReference(shortened)).toBe("2 Corintios 12:9 (RV1909)");
  });
});

describe("voz", () => {
  it("suena solo con el feed a la vista, sin silencio y con lectura generada", () => {
    const base = { audioUrl: "https://x/a.mp3", focused: true, muted: false };
    expect(feedVoiceAction(base)).toBe("play");
    expect(feedVoiceAction({ ...base, muted: true })).toBe("pause");
    expect(feedVoiceAction({ ...base, focused: false })).toBe("pause");
    expect(feedVoiceAction({ ...base, audioUrl: null })).toBe("pause");
  });
});

describe("semilla", () => {
  it("es un entero sin signo y cambia entre aperturas", () => {
    const first = newFeedSeed(1000, () => 0.25);
    expect(Number.isInteger(first) && first >= 0).toBe(true);
    expect(newFeedSeed(1000, () => 0.75)).not.toBe(first);
  });
});

describe("reels", () => {
  it("distingue un reel de un versículo", () => {
    expect(isReel(reel())).toBe(true);
    expect(isReel(item("Salmos 23:1"))).toBe(false);
  });

  it("avanza de parte en parte y se queda en la última", () => {
    expect(nextScene(reel(), 0)).toBe(1);
    expect(nextScene(reel(), 1)).toBe(2);
    expect(nextScene(reel(), 2)).toBeNull();
  });

  it("sin voz, cada parte dura lo que tarda en leerse con calma (y nunca menos de 4 s)", () => {
    expect(reelReadingMs("Corto.")).toBe(4000);
    const long = "a".repeat(280);
    expect(reelReadingMs(long)).toBe(21500);
    // Con voz, el tope por si la voz no termina es más largo que la lectura.
    expect(reelVoiceTimeoutMs(long)).toBeGreaterThan(reelReadingMs(long));
  });

  it("la voz que suena es la de la parte que se ve", () => {
    const story = reel();
    expect(entryAudioUrl(story, 0)).toBe("https://example.com/1.mp3");
    expect(entryAudioUrl(story, 1)).toBeNull();
    expect(entryAudioUrl(story, 9)).toBe("https://example.com/3.mp3");
    expect(entryAudioUrl(item("Salmos 23:1", { audioUrl: "https://example.com/v.mp3" }), 4)).toBe(
      "https://example.com/v.mp3",
    );
    expect(entryAudioUrl(undefined, 0)).toBeNull();
  });

  it("precarga las imágenes de todas las partes", () => {
    expect(entryImageUrls(reel())).toEqual([
      "https://example.com/1.webp",
      "https://example.com/2.webp",
      "https://example.com/3.webp",
    ]);
    expect(entryImageUrls(item("Salmos 23:1"))).toEqual(["https://example.com/a.jpg"]);
  });

  it("muestra la parte de la historia y la cita; el personaje dice en qué pasaje se basa", () => {
    expect(reelOverline(reel(), 1)).toBe("HISTORIA · PARTE 2 DE 3");
    expect(reelOverline(reel({ scenes: reel().scenes.slice(0, 1) }), 0)).toBe("HISTORIA");
    expect(reelReference(reel(), reel().scenes[0])).toBe("Génesis 1:1");
    expect(reelReference({ kind: "character" }, { reference: "Éxodo 3:1-12" })).toBe("Basado en Éxodo 3:1-12");
  });

  it("comparte la parte que se ve, con su origen", () => {
    expect(buildReelShareText(reel(), 1)).toBe('"Parte 2 de la historia."\n— La creación (Génesis 1:2)');
    const moises = reel({
      kind: "character",
      title: "Moisés",
      scenes: [{ ...reel().scenes[0], reference: "Éxodo 3:1-12" }],
    });
    expect(buildReelShareText(moises, 0)).toBe('"Parte 1 de la historia."\n— Moisés, basado en Éxodo 3:1-12');
  });

  it("el ♥ funciona igual en un reel", () => {
    const [liked] = setLikeLocally([reel()], "historia:creacion", true);
    expect(liked).toMatchObject({ liked: true, likes: 1 });
    expect(settleLike([liked], "historia:creacion", { liked: false, likes: 0 })[0]).toMatchObject({ liked: false });
  });
});
