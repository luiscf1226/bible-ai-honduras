import { describe, expect, it } from "vitest";

import topicVersesJson from "../../../docs/content/versiculos-por-tema.json";
import { FEELINGS } from "../feelings/feelings";
import {
  VERSE_TOPICS,
  parseTopicVerse,
  searchTopics,
  topicById,
  topicCountLabel,
  topicForFeeling,
} from "./topicVerses";

describe("parseTopicVerse", () => {
  it("lee un versículo y un rango dentro del capítulo", () => {
    expect(parseTopicVerse("1 Pedro 5:7")).toEqual({ book: "1 Pedro", chapter: 5, verse: 7 });
    expect(parseTopicVerse("Filipenses 4:6-7")).toEqual({
      book: "Filipenses",
      chapter: 4,
      verse: 6,
      end: { chapter: 4, verse: 7 },
    });
  });

  it("rechaza libros fuera del canon, capítulos que no existen y rangos al revés", () => {
    expect(parseTopicVerse("Filipenses 4")).toBeNull();
    expect(parseTopicVerse("Philippians 4:6")).toBeNull();
    expect(parseTopicVerse("Judas 2:1")).toBeNull();
    expect(parseTopicVerse("Salmos 23:4-2")).toBeNull();
  });
});

describe("catálogo de versículos por tema", () => {
  it("toda cita del archivo es válida: nada se descarta en silencio", () => {
    for (const topic of topicVersesJson.topics) {
      for (const ref of topic.verses) {
        expect(parseTopicVerse(ref), `${topic.id}: ${ref}`).not.toBeNull();
      }
    }
  });

  it("los ids son únicos y cada tema trae al menos 6 versículos sin repetir", () => {
    const ids = VERSE_TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of VERSE_TOPICS) {
      expect(topic.verses.length, topic.id).toBeGreaterThanOrEqual(6);
      const refs = topic.verses.map((ref) => `${ref.book} ${ref.chapter}:${ref.verse}`);
      expect(new Set(refs).size, topic.id).toBe(refs.length);
    }
  });

  it("cada chip de Sentir tiene su lista", () => {
    for (const feeling of FEELINGS) {
      expect(topicForFeeling(feeling)?.kind, feeling).toBe("sentimiento");
    }
  });

  it("las palabras clave ya vienen sin tildes ni mayúsculas, como las compara la búsqueda", () => {
    for (const topic of VERSE_TOPICS) {
      for (const keyword of topic.keywords) {
        expect(keyword).toBe(keyword.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
      }
    }
  });
});

describe("topicById", () => {
  it("encuentra por id y no inventa uno que no existe", () => {
    expect(topicById("ansiedad")?.name).toBe("Ansiedad");
    expect(topicById("no-existe")).toBeNull();
    expect(topicById(undefined)).toBeNull();
  });
});

describe("searchTopics", () => {
  const ids = (query: string) => searchTopics(query).map((topic) => topic.id);

  it("sin texto devuelve todos, en el orden del catálogo", () => {
    expect(ids("")).toEqual(VERSE_TOPICS.map((topic) => topic.id));
  });

  it("no le importan las tildes ni las mayúsculas", () => {
    expect(ids("DECISION")[0]).toBe("decision-dificil");
    expect(ids("oracion")).toEqual(["oracion"]);
  });

  it("encuentra por palabra clave y por frases como las escribe la gente", () => {
    expect(ids("preocupado")).toContain("ansiedad");
    expect(ids("tengo miedo")).toContain("miedo");
    expect(ids("me quedé sin empleo")).toContain("sin-trabajo");
  });

  it("primero lo que coincide por nombre, después por palabra clave", () => {
    const results = ids("paz");
    expect(results[0]).toBe("paz");
  });

  it("vacío si nada coincide", () => {
    expect(ids("xyzzy")).toEqual([]);
  });
});

describe("topicCountLabel", () => {
  it("singular y plural", () => {
    expect(topicCountLabel(1)).toBe("1 VERSÍCULO");
    expect(topicCountLabel(8)).toBe("8 VERSÍCULOS");
  });
});
