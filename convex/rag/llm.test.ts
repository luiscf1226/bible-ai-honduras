import { afterEach, describe, expect, it, vi } from "vitest";

import { ANTHROPIC_MESSAGES_URL, ANTHROPIC_MODEL, generateAnswer } from "./llm";

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

describe("generateAnswer", () => {
  it("envía el system prompt y el mensaje del usuario a Anthropic", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ content: [{ type: "text", text: "  Respuesta citada.  " }] }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await generateAnswer("system prompt", "user prompt");

    expect(answer).toBe("Respuesta citada.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ANTHROPIC_MESSAGES_URL);
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
    const body = JSON.parse(String(init.body)) as {
      model: string;
      system: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe(ANTHROPIC_MODEL);
    expect(body.system).toBe("system prompt");
    expect(body.messages).toEqual([{ role: "user", content: "user prompt" }]);
  });

  it("falla si no hay ANTHROPIC_API_KEY — no llama a la red", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateAnswer("s", "u")).rejects.toThrow("ANTHROPIC_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falla si Anthropic no devuelve texto", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ content: [] })));

    await expect(generateAnswer("s", "u")).rejects.toThrow("no devolvió texto");
  });

  it("falla si la respuesta HTTP no es exitosa", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));

    await expect(generateAnswer("s", "u")).rejects.toThrow("500");
  });
});
