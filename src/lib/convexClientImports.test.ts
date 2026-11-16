import { describe, expect, it } from "vitest";

// La app importa constantes y lógica pura de convex/ (límites, catálogos,
// fechas). Si uno de esos módulos importa `_generated/server`, Metro mete al
// bundle del celular todo lo que cuelga de él: en la 1.0.2 eran 52 módulos del
// backend (los 12 meses de devocionales incluidos) por `AI_CONSENT_VERSION` y
// `QUOTA_LIMITS`. Los imports de tipo no cuentan: TypeScript los borra.
const sources = import.meta.glob(
  ["../../app/**/*.{ts,tsx}", "../**/*.{ts,tsx}", "../../convex/**/*.{ts,js}", "!**/*.test.ts", "!**/*.d.ts"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const files = new Map(Object.entries(sources).map(([path, source]) => [normalize(`src/lib/${path}`), source]));

function normalize(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== "." && part !== "") parts.push(part);
  }
  return parts.join("/");
}

function resolve(from: string, specifier: string): string | null {
  const base = normalize(`${from.slice(0, from.lastIndexOf("/"))}/${specifier}`);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`]) {
    if (files.has(candidate)) return candidate;
  }
  return null;
}

/** Specifiers de los imports de valor (estáticos, dinámicos y require). */
function valueImports(source: string): string[] {
  const found: string[] = [];
  const patterns = [
    /^\s*(?:import|export)\s+(?!type\b)[^;]*?\bfrom\s+["']([^"']+)["']/gms,
    /\b(?:import|require)\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

describe("lo que la app importa de convex/ no arrastra el backend", () => {
  it("ningún módulo de convex/ alcanzable desde app/ o src/ importa _generated/server", () => {
    const clients = [...files.keys()].filter((path) => path.startsWith("app/") || path.startsWith("src/"));
    const via = new Map<string, string>();
    const pending: string[] = [];
    for (const client of clients) {
      for (const specifier of valueImports(files.get(client)!)) {
        const target = specifier.startsWith(".") ? resolve(client, specifier) : null;
        if (target?.startsWith("convex/") && !target.startsWith("convex/_generated/") && !via.has(target)) {
          via.set(target, client);
          pending.push(target);
        }
      }
    }
    while (pending.length > 0) {
      const current = pending.pop()!;
      for (const specifier of valueImports(files.get(current)!)) {
        const target = specifier.startsWith(".") ? resolve(current, specifier) : null;
        if (target && !target.startsWith("convex/_generated/") && !via.has(target)) {
          via.set(target, current);
          pending.push(target);
        }
      }
    }

    const chain = (path: string): string => (via.has(path) ? `${chain(via.get(path)!)} → ${path}` : path);
    const leaks = [...via.keys()]
      .filter((path) =>
        valueImports(files.get(path)!).some((specifier) => specifier === "convex/server" || /_generated\/server$/.test(specifier)),
      )
      .map(chain)
      .sort();

    expect(clients.length).toBeGreaterThan(100);
    expect(via.size).toBeGreaterThan(10);
    expect(leaks).toEqual([]);
  });
});
