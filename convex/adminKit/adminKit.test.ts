import { describe, expect, it, vi } from "vitest";

import { summarizeAiCalls } from "./aiCalls";
import { AiCallError, metered } from "./meter";
import { estimateCostUsd } from "./pricing";

describe("estimateCostUsd", () => {
  it("cobra entrada y salida por millón de tokens", () => {
    expect(
      estimateCostUsd({ provider: "anthropic", model: "claude-sonnet-5", inputTokens: 1_000_000, outputTokens: 100_000 }),
    ).toBeCloseTo(2 + 1);
  });

  it("un modelo sin precio no inventa un costo", () => {
    expect(estimateCostUsd({ provider: "x", model: "y", inputTokens: 10, outputTokens: 10 })).toBeUndefined();
  });
});

describe("metered", () => {
  it("registra tokens, latencia y éxito", async () => {
    const meter = vi.fn().mockResolvedValue(undefined);
    let clock = 1_000;
    const value = await metered(
      meter,
      { provider: "p", model: "m" },
      async (note) => {
        note({ inputTokens: 12, outputTokens: 3 });
        clock += 250;
        return "listo";
      },
      () => clock,
    );
    expect(value).toBe("listo");
    expect(meter).toHaveBeenCalledWith({ provider: "p", model: "m", inputTokens: 12, outputTokens: 3, latencyMs: 250, ok: true });
  });

  it("registra el fallo con su tipo, con los tokens ya pagados, y vuelve a lanzar", async () => {
    const meter = vi.fn().mockResolvedValue(undefined);
    await expect(
      metered(meter, { provider: "p", model: "m" }, async (note) => {
        note({ inputTokens: 50, outputTokens: 20 });
        throw new AiCallError("schema", "no valida");
      }),
    ).rejects.toThrow("no valida");
    expect(meter).toHaveBeenCalledWith(expect.objectContaining({ ok: false, errorKind: "schema", inputTokens: 50, outputTokens: 20 }));
  });

  it("un error que no es del adaptador cuenta como exception", async () => {
    const meter = vi.fn().mockResolvedValue(undefined);
    await expect(metered(meter, { provider: "p", model: "m" }, () => Promise.reject(new TypeError("red")))).rejects.toThrow("red");
    expect(meter).toHaveBeenCalledWith(expect.objectContaining({ ok: false, errorKind: "exception" }));
  });

  it("si medir falla, el pedido sigue igual", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const meter = vi.fn().mockRejectedValue(new Error("db caída"));
    await expect(metered(meter, { provider: "p", model: "m" }, async () => 42)).resolves.toBe(42);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("sin meter no registra nada", async () => {
    await expect(metered(undefined, { provider: "p", model: "m" }, async () => "ok")).resolves.toBe("ok");
  });
});

describe("summarizeAiCalls", () => {
  const base = { provider: "anthropic", model: "claude-sonnet-5", inputTokens: 100, outputTokens: 10 };

  it("agrupa por feature y modelo con costo, errores y percentiles", () => {
    const rows = [
      ...Array.from({ length: 19 }, (_, i) => ({ ...base, feature: "qa", costUsd: 0.001, latencyMs: (i + 1) * 100, ok: true })),
      { ...base, feature: "qa", costUsd: 0.001, latencyMs: 9_000, ok: false, errorKind: "http_529" },
      { ...base, feature: "voices", costUsd: 0.5, latencyMs: 300, ok: true },
      { ...base, feature: "voices", model: "nuevo", latencyMs: 300, ok: true },
    ];
    const [voices, qa, unpriced] = summarizeAiCalls(rows);
    expect(voices).toMatchObject({ feature: "voices", model: "claude-sonnet-5", calls: 1, costUsd: 0.5 });
    expect(qa).toMatchObject({ feature: "qa", calls: 20, errors: 1, inputTokens: 2_000, errorKinds: { http_529: 1 } });
    expect(qa.costUsd).toBeCloseTo(0.02);
    expect(qa.latencyP50Ms).toBe(1_000);
    expect(qa.latencyP95Ms).toBe(1_900);
    expect(unpriced).toMatchObject({ model: "nuevo", unpricedCalls: 1, costUsd: 0 });
  });
});
