import { describe, expect, it } from "vitest";

import { nextSeenRefs } from "../src/features/feed/feedLogic";
import { BIBLE_BOOKS } from "../src/lib/bibleBooks";
import {
  buildFeedPool,
  FEED_PAGE_SIZE,
  FEED_POOL,
  FEED_RECENT_GUARD,
  FEED_SEEN_MAX,
  fitPassageText,
  parseFeedRef,
  rankFeedPage,
  topicAffinity,
  type FeedPassage,
} from "./verseFeedCore";

// La página que se muestra; `newRound` se prueba aparte.
const rank = (input: Parameters<typeof rankFeedPage>[0]) => rankFeedPage(input).passages;

const NO_LIKES = new Map<string, number>();

describe("catálogo del feed", () => {
  it("junta los versículos por tema y los pasajes de los devocionales, sin repetir citas", () => {
    const refs = FEED_POOL.map((passage) => passage.ref);
    expect(new Set(refs).size).toBe(refs.length);
    expect(FEED_POOL.length).toBeGreaterThan(400);
  });

  it("cada cita es de un libro real del canon y trae su foto", () => {
    for (const passage of FEED_POOL) {
      const book = BIBLE_BOOKS.find((item) => item.name === passage.book);
      expect(book, passage.ref).toBeDefined();
      expect(passage.chapter).toBeLessThanOrEqual(book?.chapters ?? 0);
      expect(passage.imageUrl).toMatch(/^https:\/\//);
      expect(passage.imageAlt.length).toBeGreaterThan(0);
    }
  });

  it("una cita que aparece en dos temas los lleva a los dos", () => {
    const pool = buildFeedPool(
      [
        { id: "paz", name: "Paz", verses: ["Juan 14:27"] },
        {
          id: "ansiedad",
          name: "Ansiedad",
          verses: ["Juan 14:27", "1 Pedro 5:7"],
        },
      ],
      [],
    );
    expect(pool.find((passage) => passage.ref === "Juan 14:27")?.topics).toEqual(["paz", "ansiedad"]);
  });

  it("entiende versículos sueltos y rangos dentro del capítulo", () => {
    expect(parseFeedRef("Salmos 23:1")).toEqual({
      book: "Salmos",
      chapter: 23,
      verse: 1,
      endVerse: null,
    });
    expect(parseFeedRef("2 Corintios 1:3-4")).toEqual({
      book: "2 Corintios",
      chapter: 1,
      verse: 3,
      endVerse: 4,
    });
    expect(parseFeedRef("Juan 3:16-15")).toBeNull();
    expect(parseFeedRef("Juan tres")).toBeNull();
  });
});

function passage(ref: string, topics: string[]): FeedPassage {
  return {
    ref,
    book: "Salmos",
    chapter: 1,
    verse: 1,
    endVerse: null,
    topics,
    imageUrl: "https://x",
    imageAlt: "x",
  };
}

const MINI_POOL: FeedPassage[] = [
  ...Array.from({ length: 10 }, (_, index) => passage(`paz ${index}`, ["paz"])),
  ...Array.from({ length: 10 }, (_, index) => passage(`fe ${index}`, ["fe"])),
  ...Array.from({ length: 10 }, (_, index) => passage(`gozo ${index}`, ["gozo"])),
  ...Array.from({ length: 10 }, (_, index) => passage(`devocional ${index}`, [])),
];

describe("orden del feed", () => {
  it("devuelve una página llena y sin repetidos", () => {
    const page = rank({
      communityLikes: NO_LIKES,
      likedRefs: [],
      pool: FEED_POOL,
      seed: 7,
      seenRefs: [],
    });
    expect(page).toHaveLength(FEED_PAGE_SIZE);
    expect(new Set(page.map((item) => item.ref)).size).toBe(FEED_PAGE_SIZE);
  });

  it("es determinístico por semilla y cambia con otra", () => {
    const input = {
      communityLikes: NO_LIKES,
      likedRefs: [],
      pool: FEED_POOL,
      seenRefs: [],
    };
    const first = rank({ ...input, seed: 1 }).map((item) => item.ref);
    expect(rank({ ...input, seed: 1 }).map((item) => item.ref)).toEqual(first);
    expect(rank({ ...input, seed: 2 }).map((item) => item.ref)).not.toEqual(first);
  });

  it("no repite lo ya visto", () => {
    const seen = MINI_POOL.slice(0, 20).map((item) => item.ref);
    const page = rank({
      communityLikes: NO_LIKES,
      likedRefs: [],
      pool: MINI_POOL,
      seed: 3,
      seenRefs: seen,
    });
    expect(page.some((item) => seen.includes(item.ref))).toBe(false);
  });

  it("cuando ya se vio todo, empieza otra vuelta sin las últimas vistas", () => {
    const seen = MINI_POOL.map((item) => item.ref);
    const page = rank({
      communityLikes: NO_LIKES,
      likedRefs: [],
      pool: MINI_POOL,
      seed: 3,
      seenRefs: seen,
    });
    expect(page).toHaveLength(FEED_PAGE_SIZE);
    const recent = seen.slice(-FEED_RECENT_GUARD);
    expect(page.some((item) => recent.includes(item.ref))).toBe(false);
  });

  it("sube los temas que te gustan", () => {
    const liked = ["paz 0", "paz 1", "paz 2"];
    let pazCount = 0;
    for (let seed = 0; seed < 20; seed += 1) {
      const page = rank({
        communityLikes: NO_LIKES,
        likedRefs: liked,
        pool: MINI_POOL,
        seed,
        seenRefs: [],
      });
      pazCount += page.filter((item) => item.topics[0] === "paz").length;
    }
    // Sin afinidad, paz sería ~1/4 de cada página (2 de 8); con afinidad llega al tope de 2 casi siempre.
    expect(pazCount / 20).toBeGreaterThan(1.8);
  });

  it("no junta más de dos del mismo tema en una página", () => {
    const liked = MINI_POOL.filter((item) => item.topics[0] === "paz").map((item) => item.ref);
    for (let seed = 0; seed < 10; seed += 1) {
      const page = rank({
        communityLikes: NO_LIKES,
        likedRefs: liked,
        pool: MINI_POOL,
        seed,
        seenRefs: [],
      });
      expect(page.filter((item) => item.topics[0] === "paz").length).toBeLessThanOrEqual(2);
    }
  });

  it("sube lo que más le gusta a la comunidad", () => {
    const community = new Map([["gozo 4", 500]]);
    let hits = 0;
    for (let seed = 0; seed < 20; seed += 1) {
      const page = rank({
        communityLikes: community,
        likedRefs: [],
        pool: MINI_POOL,
        seed,
        seenRefs: [],
      });
      if (page.some((item) => item.ref === "gozo 4")) hits += 1;
    }
    expect(hits).toBeGreaterThanOrEqual(18);
  });

  it("avisa cuándo empieza otra vuelta", () => {
    const all = MINI_POOL.map((item) => item.ref);
    expect(
      rankFeedPage({ communityLikes: NO_LIKES, likedRefs: [], pool: MINI_POOL, seed: 1, seenRefs: [] }).newRound,
    ).toBe(false);
    expect(
      rankFeedPage({ communityLikes: NO_LIKES, likedRefs: [], pool: MINI_POOL, seed: 1, seenRefs: all }).newRound,
    ).toBe(true);
  });

  it("un solo ♥ de la comunidad no tapa el azar de todos", () => {
    const community = new Map([["gozo 4", 1]]);
    let hits = 0;
    for (let seed = 0; seed < 40; seed += 1) {
      if (
        rank({ communityLikes: community, likedRefs: [], pool: MINI_POOL, seed, seenRefs: [] }).some(
          (item) => item.ref === "gozo 4",
        )
      ) {
        hits += 1;
      }
    }
    expect(hits).toBeLessThan(30);
  });

  it("no junta más de la mitad de la página sin tema", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const page = rank({ communityLikes: NO_LIKES, likedRefs: [], pool: MINI_POOL, seed, seenRefs: [] });
      expect(page.filter((item) => item.topics.length === 0).length).toBeLessThanOrEqual(FEED_PAGE_SIZE / 2);
    }
  });

  it("ordenando de más (como el servidor), las primeras 8 cumplen los mismos topes", () => {
    const liked = ["paz 0", "paz 1", "paz 2"];
    for (let seed = 0; seed < 30; seed += 1) {
      const page = rank({
        communityLikes: NO_LIKES,
        likedRefs: liked,
        pool: MINI_POOL,
        seed,
        seenRefs: [],
        size: FEED_PAGE_SIZE * 2,
      });
      const shown = page.slice(0, FEED_PAGE_SIZE);
      expect(shown.filter((item) => item.topics[0] === "paz").length).toBeLessThanOrEqual(2);
      expect(shown.filter((item) => item.topics.length === 0).length).toBeLessThanOrEqual(FEED_PAGE_SIZE / 2);
    }
  });

  it("la vuelta nueva se decide por una página que se muestra, no por las de reserva", () => {
    const seen = MINI_POOL.slice(0, MINI_POOL.length - 10).map((item) => item.ref);
    // Quedan 10 sin ver: alcanza para una página de 8 aunque se pidan 16.
    expect(
      rankFeedPage({ communityLikes: NO_LIKES, likedRefs: [], pool: MINI_POOL, seed: 1, seenRefs: seen, size: 16 })
        .newRound,
    ).toBe(false);
  });

  it("lo visto que recuerda el cliente alcanza para el catálogo entero", () => {
    expect(FEED_SEEN_MAX).toBeGreaterThan(FEED_POOL.length);
  });

  it("el scroll no se acaba: 200 páginas seguidas, todas llenas y sin repetir dentro de una vuelta", () => {
    let seen: string[] = [];
    let round = new Set<string>();
    for (let index = 0; index < 200; index += 1) {
      const { newRound, passages } = rankFeedPage({
        communityLikes: NO_LIKES,
        likedRefs: [],
        pool: FEED_POOL,
        seed: 12345,
        seenRefs: seen,
      });
      expect(passages).toHaveLength(FEED_PAGE_SIZE);
      if (newRound) round = new Set(seen.slice(-FEED_RECENT_GUARD));
      for (const passage of passages) {
        expect(round.has(passage.ref)).toBe(false);
        round.add(passage.ref);
      }
      seen = nextSeenRefs(
        seen,
        passages.map((passage) => passage.ref),
        newRound,
      );
    }
  });

  it("la afinidad cuenta un punto por cada ♥ en cada tema de la cita", () => {
    const byRef = new Map(MINI_POOL.map((item) => [item.ref, item]));
    expect(topicAffinity(["paz 0", "paz 1", "fe 3", "no existe"], byRef)).toEqual(
      new Map([
        ["paz", 2],
        ["fe", 1],
      ]),
    );
  });
});

describe("lo que entra en una pantalla", () => {
  const rows = [
    { verse: 10, text: "b".repeat(100) },
    { verse: 9, text: "a".repeat(150) },
  ];

  it("un rango que entra va completo, en orden", () => {
    expect(fitPassageText(rows, 300)).toEqual({ text: `${"a".repeat(150)} ${"b".repeat(100)}`, endVerse: 10 });
  });

  it("un rango largo se acorta a los versículos que entran, sin cortar ninguno", () => {
    expect(fitPassageText(rows, 200)).toEqual({ text: "a".repeat(150), endVerse: null });
  });

  it("si ni el primer versículo entra, no se muestra", () => {
    expect(fitPassageText(rows, 100)).toBeNull();
    expect(fitPassageText([], 300)).toBeNull();
  });
});
