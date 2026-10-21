// @vitest-environment node
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("../../scripts/submit-app-review.mjs", import.meta.url), "utf8")
  .replace('new URL("../app.json", import.meta.url)', JSON.stringify(new URL("../../app.json", import.meta.url).pathname));
const key = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey
  .export({ type: "pkcs8", format: "pem" }).toString();

function run(state: string, otherItem = false, dryRun = false, missingLink = false, paginated = false, versionState = "REJECTED", assignedBuild = "new-build") {
  const code = `
    const calls = [];
    process.on('exit', () => console.log('CALLS:' + JSON.stringify(calls)));
    globalThis.fetch = async (url, options) => {
      const path = new URL(url).pathname;
      const method = options.method;
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ method, path, body, search: new URL(url).search });
      let data;
      if (path === '/v1/builds') data = [{ id: 'new-build', attributes: { version: '28', processingState: 'VALID' } }];
      else if (path.endsWith('/appStoreVersions')) data = [{ id: 'version', attributes: { versionString: '1.0.1', appStoreState: ${JSON.stringify(versionState)} } }];
      else if (path === '/v1/appStoreVersions/version/build') data = { id: ${JSON.stringify(assignedBuild)} };
      else if (path.endsWith('/relationships/build')) data = null;
      else if (path === '/v1/appStoreVersions/version' && method === 'PATCH') data = { id: 'version' };
      else if (path.endsWith('/appStoreReviewDetail')) data = { id: 'details' };
      else if (path === '/v1/reviewSubmissions') data = [{ id: 'submission', attributes: { state: ${JSON.stringify(state)} } }];
      else if (path.endsWith('/items')) data = [
        { id: 'item', attributes: { state: 'REJECTED' },
          // Apple solo incluye el vínculo cuando se solicita explícitamente.
          ...(!${missingLink} && new URL(url).searchParams.get('include') === 'appStoreVersion'
            ? { relationships: { appStoreVersion: { data: { id: 'version' } } } } : {}) },
        ...(${otherItem} ? [{ id: 'other', attributes: { state: 'REJECTED' } }] : [])
      ];
      else if (path === '/v1/reviewSubmissionItems/item' && method === 'PATCH') data = { id: 'item' };
      else if (path === '/v1/reviewSubmissions/submission') data = { id: 'submission', attributes: { state: 'WAITING_FOR_REVIEW' } };
      else throw new Error('Unexpected request: ' + method + ' ' + path);
      return { ok: true, text: async () => JSON.stringify({ data,
        ...(path.endsWith('/items') && ${paginated} ? { links: { next: 'https://api.appstoreconnect.apple.com/next' } } : {}) }) };
    };
    try { await import('data:text/javascript;base64,' + ${JSON.stringify(Buffer.from(script).toString("base64"))}); }
    catch (error) { console.log('ERROR:' + error.message); process.exitCode = 1; }
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-"], {
    input: code,
    encoding: "utf8",
    env: { ...process.env, ASC_KEY_P8: key, ASC_KEY_ID: "test", ASC_ISSUER_ID: "test", BUILD_NUMBER: "28", DRY_RUN: dryRun ? "1" : "0" },
  });
  const calls = JSON.parse(result.stdout.split("CALLS:")[1]) as Array<{ method: string; path: string; body: any; search: string }>;
  return { status: result.status, stdout: result.stdout, calls };
}

describe("reenvío de App Review con un build corregido", () => {
  it("asigna el build exacto, resuelve solo el elemento corregido y confirma la cola", () => {
    const result = run("UNRESOLVED_ISSUES");
    expect(result.status, result.stdout).toBe(0);
    expect(result.calls[0].search).toContain("filter[version]=28");
    const itemQuery = new URLSearchParams(result.calls.find((call) => call.path.endsWith("/items"))?.search);
    expect(itemQuery.get("include")).toBe("appStoreVersion");
    const mutations = result.calls.filter((call) => call.method !== "GET");
    expect(mutations.map((call) => call.path)).toEqual([
      "/v1/appStoreVersions/version",
      "/v1/appStoreVersions/version/relationships/build",
      "/v1/reviewSubmissionItems/item",
      "/v1/reviewSubmissions/submission",
    ]);
    expect(mutations[0].body.data.attributes).toEqual({ releaseType: "MANUAL" });
    expect(mutations[1].body.data.id).toBe("new-build");
    expect(mutations[2].body.data.attributes).toEqual({ resolved: true });
    expect(mutations[3].body.data.attributes).toEqual({ submitted: true });
    expect(result.stdout).toContain("Estado confirmado: WAITING_FOR_REVIEW");
  });

  it("no resuelve rechazos ajenos a la versión corregida", () => {
    const result = run("UNRESOLVED_ISSUES", true);
    expect(result.status).toBe(1);
    expect(result.calls.some((call) => call.path.startsWith("/v1/reviewSubmissionItems/"))).toBe(false);
    expect(result.stdout).toContain("otros elementos pendientes");
  });

  it("no duplica un envío que ya está en revisión", () => {
    const result = run("IN_REVIEW");
    expect(result.status).toBe(1);
    expect(result.calls.some((call) => call.path === "/v1/reviewSubmissions/submission")).toBe(false);
  });

  it("distingue un vínculo ausente de un rechazo ajeno", () => {
    const result = run("UNRESOLVED_ISSUES", false, false, true);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("No se encontró el vínculo");
    expect(result.calls.some((call) => call.path.startsWith("/v1/reviewSubmissionItems/"))).toBe(false);
  });

  it("no envía una lista incompleta de elementos", () => {
    const result = run("UNRESOLVED_ISSUES", false, false, false, true);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("lista de elementos está incompleta");
    expect(result.calls.some((call) => call.path.startsWith("/v1/reviewSubmissionItems/"))).toBe(false);
  });

  it("DRY_RUN no cambia datos ni marca el rechazo como resuelto", () => {
    const result = run("UNRESOLVED_ISSUES", false, true);
    expect(result.status, result.stdout).toBe(0);
    expect(result.calls.every((call) => call.method === "GET")).toBe(true);
  });

  it.each(["WAITING_FOR_REVIEW", "IN_REVIEW"])("confirma %s sin modificar un envío existente del mismo build", (versionState) => {
    const result = run(versionState, false, false, false, false, versionState);
    expect(result.status, result.stdout).toBe(0);
    expect(result.stdout).toContain(`Estado confirmado: ${versionState}`);
    expect(result.calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("no confunde otro build en revisión con el solicitado", () => {
    const result = run("WAITING_FOR_REVIEW", false, false, false, false, "WAITING_FOR_REVIEW", "older-build");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("otro build");
    expect(result.calls.every((call) => call.method === "GET")).toBe(true);
  });
});
