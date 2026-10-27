import { describe, expect, it } from "vitest";

import { FEED_RECENT_GUARD, FEED_SEEN_MAX } from "../../../convex/verseFeedLimits";
import {
  buildFeedShareText,
  createDoubleTapDetector,
  feedItemKey,
  feedVerseText,
  feedVerseType,
  formatLikes,
  newFeedSeed,
  nextSeenRefs,
  setLikeLocally,
  settleLike,
  type FeedItem,
} from "./feedLogic";

function item(ref: string, extra: Partial<FeedItem> = {}): FeedItem {
  return {
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
    expect(buildFeedShareText(item("Hebreos 11:1", { text: "ES pues la fe" }))).toBe(
      '"Es pues la fe"\n— Hebreos 11:1 (RV1909)',
    );
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
    expect(buildFeedShareText(item("Filipenses 4:6-7", { text: "Por nada estéis afanosos…" }))).toBe(
      '"Por nada estéis afanosos…"\n— Filipenses 4:6-7 (RV1909)',
    );
  });
});

describe("semilla", () => {
  it("es un entero sin signo y cambia entre aperturas", () => {
    const first = newFeedSeed(1000, () => 0.25);
    expect(Number.isInteger(first) && first >= 0).toBe(true);
    expect(newFeedSeed(1000, () => 0.75)).not.toBe(first);
  });
});
