import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMBEDDING_DIMENSIONS,
  VOYAGE_EMBEDDINGS_URL,
  VOYAGE_MODEL,
  embedDocument,
  embedQuery,
  zeroEmbedding,
} from "./embed";

const SAMPLE_VECTOR = zeroEmbedding();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("zeroEmbedding", () => {
  it("devuelve un vector de 1024 ceros para tests y desarrollo sin clave", () => {
    const vector = zeroEmbedding();
    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(vector.every((value) => value === 0)).toBe(true);
  });
});

describe("embedDocument / embedQuery", () => {
  it("envía input_type document al indexar", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: [{ embedding: SAMPLE_VECTOR }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await embedDocument("En el principio");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(VOYAGE_EMBEDDINGS_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(init.body)) as {
      input: string;
      model: string;
      input_type: string;
    };
    expect(body.model).toBe(VOYAGE_MODEL);
    expect(body.input).toBe("En el principio");
    expect(body.input_type).toBe("document");
  });

  it("envía input_type query al buscar", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: [{ embedding: SAMPLE_VECTOR }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await embedQuery("¿quién creó los cielos?");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as {
      input_type: string;
    };
    expect(body.input_type).toBe("query");
  });

  it("document y query no mezclan input_type", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse({ data: [{ embedding: SAMPLE_VECTOR }] })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await embedDocument("texto para indexar");
    await embedQuery("texto para buscar");

    const types = fetchMock.mock.calls.map((call) => {
      const init = call[1] as RequestInit;
      return (JSON.parse(String(init.body)) as { input_type: string }).input_type;
    });
    expect(types).toEqual(["document", "query"]);
  });

  it("falla si no hay VOYAGE_API_KEY — no llama a la red", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(embedDocument("hola")).rejects.toThrow("VOYAGE_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
