// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const nodeRequire = createRequire(import.meta.url);
const { transformSync } = nodeRequire("@babel/core") as {
  transformSync(source: string, options: Record<string, unknown>): { code: string };
};

/** Runtime real de Metro en modo release; los módulos nativos se simulan. */
function runtime() {
  const reportFatalError = vi.fn();
  const share = vi.fn().mockResolvedValue({ action: "dismissedAction" });
  const setString = vi.fn();
  const clipboardLoaded = vi.fn();
  const context = createContext({
    __DEV__: false,
    __METRO_GLOBAL_PREFIX__: "",
    ErrorUtils: { reportFatalError },
    share,
    setString,
    clipboardLoaded,
  });
  runInContext("globalThis.global = globalThis", context);
  runInContext(readFileSync(nodeRequire.resolve("metro-runtime/src/polyfills/require.js"), "utf8"), context);
  runInContext(`
    __d((global, require, importDefault, importAll, module) => {
      module.exports = {
        get Platform() { return { OS: 'ios' }; },
        get Share() { return { share, dismissedAction: 'dismissedAction' }; },
        get Clipboard() { clipboardLoaded(); return { setString }; },
        // Simula un export exclusivo de otra plataforma en react-native.
        get unrelatedNativeModule() { return require(1); },
      };
    }, 0);
    __d(() => { throw new Error('Native module unavailable on iOS'); }, 1);
  `, context);
  return { context, reportFatalError, share, setString, clipboardLoaded };
}

function loadSource(context: ReturnType<typeof createContext>, name: string) {
  const code = transformSync(readFileSync(new URL(name, import.meta.url), "utf8"), {
    filename: name,
    configFile: false,
    babelrc: false,
    presets: [nodeRequire.resolve("@babel/preset-typescript")],
    plugins: [nodeRequire.resolve("@babel/plugin-transform-modules-commonjs")],
  })!.code!;
  runInContext(`
    __d((global, metroRequire, importDefault, importAll, module, exports) => {
      const require = (name) => {
        if (name === 'react-native') return metroRequire(0);
        throw new Error('Unexpected dependency: ' + name);
      };
      ${code}
    }, 2);
  `, context);
  return runInContext("__r(2)", context);
}

describe("carga nativa selectiva en Metro release", () => {
  it("reproduce el fatal de importAll aunque el llamador tenga try/catch", () => {
    const { context, reportFatalError } = runtime();
    runInContext("try { __r.importAll(0); } catch {}", context);
    expect(reportFatalError).toHaveBeenCalledOnce();
    expect(reportFatalError.mock.calls[0][0].message).toBe("Native module unavailable on iOS");
  });

  it.each(["shareContent", "shareImage", "sharePlainText"])("%s no evalúa módulos ajenos ni el portapapeles en iOS", async (method) => {
    const { context, reportFatalError, share, clipboardLoaded } = runtime();
    const service = loadSource(context, "./share.ts");
    const params = { text: "Salmos 46:1", referralCode: "BAH-TEST", fileUri: "file:///tmp/verse.png" };
    expect(await service[method](method === "sharePlainText" ? params.text : params)).toEqual({ status: "dismissed" });
    expect(share).toHaveBeenCalledOnce();
    if (method === "shareImage") expect(share.mock.calls[0][0].url).toBe(params.fileUri);
    expect(reportFatalError).not.toHaveBeenCalled();
    expect(clipboardLoaded).not.toHaveBeenCalled();
  });

  it("captura rechazos del share sheet con el cargador real", async () => {
    const { context, share, reportFatalError } = runtime();
    const failure = new Error("Share unavailable");
    share.mockRejectedValue(failure);
    const service = loadSource(context, "./share.ts");
    expect(await service.shareImage({ text: "x", referralCode: "BAH-TEST", fileUri: "file:///tmp/x.png" })).toEqual({ status: "error", error: failure });
    expect(reportFatalError).not.toHaveBeenCalled();
  });

  it("copiar carga solo Clipboard", async () => {
    const { context, reportFatalError, setString, share } = runtime();
    const service = loadSource(context, "./clipboard.ts");
    expect(await service.copyToClipboard("versículo")).toEqual({ status: "copied" });
    expect(setString).toHaveBeenCalledWith("versículo");
    expect(share).not.toHaveBeenCalled();
    expect(reportFatalError).not.toHaveBeenCalled();
  });
});
