import { describe, expect, it } from "vitest";

import { resolveSceneImage } from "../src/features/stories/storyViewer";

describe("resolveSceneImage", () => {
  it("sólo marca una escena como lista cuando recibe una URI generada", () => {
    expect(
      resolveSceneImage("escena-1", {
        "escena-1": { status: "ready", uri: "https://images.example/escena-1.png" },
      }),
    ).toEqual({ status: "ready", uri: "https://images.example/escena-1.png" });

    expect(resolveSceneImage("escena-2", { "escena-2": { status: "ready" } })).toEqual({
      status: "unavailable",
    });
  });

  it("conserva progreso explícito y no inventa una ilustración cuando no hay imagen", () => {
    expect(resolveSceneImage("escena-1", { "escena-1": { status: "generating" } })).toEqual({
      status: "generating",
    });
    expect(resolveSceneImage("escena-2", {})).toEqual({ status: "unavailable" });
  });
});
