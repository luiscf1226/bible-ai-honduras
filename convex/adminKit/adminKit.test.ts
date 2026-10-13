import { describe, expect, it, vi } from "vitest";

import { summarizeAiCalls } from "./aiCalls";
import type { Manifest } from "./contract";
import { handleAdminRequest, safeEqual } from "./httpHandler";
import { AiCallError, metered } from "./meter";
import { estimateCostUsd } from "./pricing";
import { aiRows, errorRows, eventRows } from "./rollup";

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

describe("rollup estándar", () => {
  const day = { startMs: Date.parse("2026-10-01T06:00:00Z"), endMs: Date.parse("2026-10-02T06:00:00Z") };
  const at = (hoursIntoDay: number) => day.startMs + hoursIntoDay * 3_600_000;

  it("activos por ventana y embudo del día", () => {
    const rows = eventRows(
      [
        { installId: "a", name: "app_opened", at: at(1) },
        { installId: "a", name: "app_opened", at: at(2) },
        { installId: "b", name: "paywall_viewed", at: at(3) },
        { installId: "c", name: "app_opened", at: at(-48) },
        { installId: "d", name: "app_opened", at: at(-24 * 20) },
        { installId: "e", name: "app_opened", at: at(30) },
      ],
      day,
    );
    expect(rows).toEqual([
      { key: "std.active_1d", value: 2 },
      { key: "std.active_7d", value: 3 },
      { key: "std.active_30d", value: 4 },
      { key: "std.funnel", dim: "app_opened", value: 1 },
      { key: "std.funnel", dim: "paywall_viewed", value: 1 },
    ]);
  });

  it("IA por función con total del día", () => {
    const rows = aiRows([
      { feature: "qa", inputTokens: 100, outputTokens: 20, costUsd: 0.01, latencyMs: 100, ok: true },
      { feature: "qa", inputTokens: 50, outputTokens: 0, latencyMs: 300, ok: false },
      { feature: "voices", inputTokens: 10, outputTokens: 10, costUsd: 0.02, latencyMs: 200, ok: true },
    ]);
    const get = (key: string, dim?: string) => rows.find((row) => row.key === key && row.dim === dim)?.value;
    expect(get("std.ai_calls")).toBe(3);
    expect(get("std.ai_calls", "qa")).toBe(2);
    expect(get("std.ai_tokens", "qa")).toBe(170);
    expect(get("std.ai_cost_usd")).toBeCloseTo(0.03);
    expect(get("std.ai_errors", "qa")).toBe(1);
    expect(get("std.ai_latency_p50_ms")).toBe(200);
  });

  it("errores por plataforma y fatales", () => {
    expect(
      errorRows([
        { platform: "ios", fatal: true },
        { platform: "ios", fatal: false },
        { platform: "android", fatal: false },
      ]),
    ).toEqual([
      { key: "std.errors", value: 3 },
      { key: "std.errors", dim: "ios", value: 2 },
      { key: "std.errors", dim: "android", value: 1 },
      { key: "std.errors_fatal", value: 1 },
    ]);
  });
});

describe("handleAdminRequest (contrato v1)", () => {
  const manifest: Manifest = { contractVersion: 1, app: { id: "x", name: "X" }, sections: [], metrics: {} };
  const deps = {
    token: "secreto-largo",
    manifest,
    readMetrics: vi.fn().mockResolvedValue([{ day: "2026-10-01", key: "std.ai_calls", value: 3 }]),
    readErrors: vi.fn().mockResolvedValue([]),
  };
  const call = (path: string, token: string | null = "secreto-largo") =>
    handleAdminRequest(
      new Request(`https://app.convex.site${path}`, token ? { headers: { authorization: `Bearer ${token}` } } : {}),
      deps,
    );

  it("sin token configurado no abre nada", async () => {
    const response = await handleAdminRequest(new Request("https://app.convex.site/admin/manifest"), { ...deps, token: undefined });
    expect(response.status).toBe(503);
  });

  it("sin token o con uno incorrecto responde 401 sin datos", async () => {
    for (const token of [null, "otro", "secreto-largo-mas"]) {
      const response = await call("/admin/manifest", token);
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain('"app"');
    }
  });

  it("devuelve el manifiesto", async () => {
    expect(await (await call("/admin/manifest")).json()).toEqual(manifest);
  });

  it("métricas: valida el rango y pasa las keys", async () => {
    expect((await call("/admin/metrics?from=2026-10-05&to=2026-10-01")).status).toBe(400);
    expect((await call("/admin/metrics?from=ayer&to=2026-10-01")).status).toBe(400);
    expect((await call("/admin/metrics?from=2025-01-01&to=2026-10-01")).status).toBe(400);
    const response = await call("/admin/metrics?from=2026-10-01&to=2026-10-07&keys=std.ai_calls,%20users.total");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ contractVersion: 1, rows: [{ day: "2026-10-01", key: "std.ai_calls", value: 3 }] });
    expect(deps.readMetrics).toHaveBeenCalledWith({ from: "2026-10-01", to: "2026-10-07", keys: ["std.ai_calls", "users.total"] });
  });

  it("errores: acota el límite", async () => {
    await call("/admin/errors?limit=5000");
    expect(deps.readErrors).toHaveBeenCalledWith(200);
  });

  it("ruta desconocida: 404 (y users solo si la app lo implementa)", async () => {
    expect((await call("/admin/usuarios")).status).toBe(404);
    expect((await call("/admin/users")).status).toBe(404);
  });

  it("users: acota límite y búsqueda", async () => {
    const readUsers = vi.fn().mockResolvedValue({ users: [] });
    const response = await handleAdminRequest(
      new Request(`https://app.convex.site/admin/users?limit=999&q=${"x".repeat(300)}`, { headers: { authorization: "Bearer secreto-largo" } }),
      { ...deps, readUsers },
    );
    expect(await response.json()).toEqual({ contractVersion: 1, users: [] });
    expect(readUsers).toHaveBeenCalledWith({ q: "x".repeat(100), cursor: undefined, limit: 100 });
  });

  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
