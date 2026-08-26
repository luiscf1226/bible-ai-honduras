import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMBEDDING_DIMENSIONS,
  OPENAI_EMBEDDINGS_URL,
  OPENAI_EMBEDDING_MODEL,
  embedDocument,
  embedDocuments,
  embedQuery,
  zeroEmbedding,
} from "./embed";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("zeroEmbedding", () => {
  it("devuelve un vector de 1024 ceros para tests", () => {
    const vector = zeroEmbedding();
    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(vector.every((value) => value === 0)).toBe(true);
  });
});

describe("embedDocument / embedQuery", () => {
  it("usa OpenAI con 1024 dimensiones sin input_type", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: [{ index: 0, embedding: zeroEmbedding() }], usage: { total_tokens: 4 } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await embedDocument("En el principio");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(OPENAI_EMBEDDINGS_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      input: ["En el principio"],
      model: OPENAI_EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      encoding_format: "float",
    });
    expect(body).not.toHaveProperty("input_type");
  });

  it("documento y consulta usan el mismo contrato", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(
      jsonResponse({ data: [{ index: 0, embedding: zeroEmbedding() }] }),
    ));
    vi.stubGlobal("fetch", fetchMock);

    await embedDocument("texto para indexar");
    await embedQuery("texto para buscar");

    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body)));
    expect(bodies[0]).toMatchObject({ model: OPENAI_EMBEDDING_MODEL, dimensions: 1024 });
    expect(bodies[1]).toMatchObject({ model: OPENAI_EMBEDDING_MODEL, dimensions: 1024 });
    expect(bodies.every((body) => !("input_type" in body))).toBe(true);
  });

  it("embebe lotes y conserva el orden por index", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const first = zeroEmbedding();
    const second = zeroEmbedding();
    second[0] = 1;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      data: [{ index: 1, embedding: second }, { index: 0, embedding: first }],
      usage: { total_tokens: 9 },
    })));

    expect(await embedDocuments(["uno", "dos"])).toEqual({ embeddings: [first, second], totalTokens: 9 });
  });

  it("falla si no hay OPENAI_API_KEY y no llama a la red", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(embedDocument("hola")).rejects.toThrow("OPENAI_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza vectores con dimension incorrecta", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: [{ index: 0, embedding: [1] }] })));
    await expect(embedQuery("hola")).rejects.toThrow("embeddings invalidos");
  });
});
