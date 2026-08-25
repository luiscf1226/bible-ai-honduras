import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ANTHROPIC_MODEL, generateStructuredAnswer } from "./llm";

const SCHEMA = z.object({ answer: z.string(), citations: z.array(z.object({ book: z.string() })) });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function anthropicPayload(structured: unknown) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: ANTHROPIC_MODEL,
    content: [{ type: "text", text: JSON.stringify(structured) }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("generateStructuredAnswer", () => {
  it("envía el system prompt y el mensaje del usuario, y devuelve la salida parseada", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(anthropicPayload({ answer: "Respuesta citada.", citations: [{ book: "Salmos" }] })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructuredAnswer({
      system: "system prompt",
      userPrompt: "user prompt",
      schema: SCHEMA,
    });

    expect(result).toEqual({ answer: "Respuesta citada.", citations: [{ book: "Salmos" }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      model: string;
      system: string;
      messages: Array<{ role: string; content: string }>;
      output_config?: { format?: { type?: string } };
    };
    expect(body.model).toBe(ANTHROPIC_MODEL);
    expect(body.system).toBe("system prompt");
    expect(body.messages).toEqual([{ role: "user", content: "user prompt" }]);
    expect(body.output_config?.format?.type).toBe("json_schema");
  });

  it("falla si no hay ANTHROPIC_API_KEY — no llama a la red", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateStructuredAnswer({ system: "s", userPrompt: "u", schema: SCHEMA })).rejects.toThrow(
      "ANTHROPIC_API_KEY",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falla si la salida no cumple el schema", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(anthropicPayload({ answer: 123 }))));

    await expect(generateStructuredAnswer({ system: "s", userPrompt: "u", schema: SCHEMA })).rejects.toThrow();
  });
});
