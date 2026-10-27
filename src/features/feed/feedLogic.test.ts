import { describe, expect, it } from "vitest";

import { FEED_SEEN_MAX } from "../../../convex/verseFeedLimits";
import {
  appendFeedPage,
  buildFeedShareText,
  createDoubleTapDetector,
  feedVerseText,
  feedVerseType,
  formatLikes,
  newFeedSeed,
  seenRefs,
  settleLike,
  toggleLikeLocally,
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
    expect(buildFeedShareText(item("Hebreos 11:1", { text: "ES pues la fe" }))).toBe('"Es pues la fe"\n— Hebreos 11:1 (RV1909)');
  });
});

describe("páginas", () => {
  it("suma una página sin repetir citas", () => {
    expect(appendFeedPage([item("A"), item("B")], [item("B"), item("C")]).map((entry) => entry.ref)).toEqual(["A", "B", "C"]);
  });

  it("lo visto que se manda al servidor tiene tope", () => {
    const many = Array.from({ length: FEED_SEEN_MAX + 10 }, (_, index) => item(`R${index}`));
    const seen = seenRefs(many);
    expect(seen).toHaveLength(FEED_SEEN_MAX);
    expect(seen.at(-1)).toBe(`R${FEED_SEEN_MAX + 9}`);
  });
});

describe("♥", () => {
  it("marca y desmarca al toque, y el servidor deja la cuenta final", () => {
    const liked = toggleLikeLocally([item("A", { likes: 4 }), item("B")], "A");
    expect(liked[0]).toMatchObject({ liked: true, likes: 5 });
    expect(liked[1]).toMatchObject({ liked: false, likes: 0 });
    expect(toggleLikeLocally(liked, "A")[0]).toMatchObject({ liked: false, likes: 4 });
    expect(settleLike(liked, "A", { liked: true, likes: 9 })[0]).toMatchObject({ liked: true, likes: 9 });
  });

  it("la cuenta nunca baja de cero", () => {
    expect(toggleLikeLocally([item("A", { liked: true, likes: 0 })], "A")[0].likes).toBe(0);
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
