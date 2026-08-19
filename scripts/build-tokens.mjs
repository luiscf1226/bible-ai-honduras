import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath = resolve("design/tokens.json");
const targetPath = resolve("src/theme/tokens.generated.ts");
const tokens = JSON.parse(readFileSync(sourcePath, "utf8"));
const generated = `// Este archivo se genera con \`npm run tokens:build\`. No lo edites a mano.\n// Fuente: design/tokens.json\n\nexport const designTokens = ${JSON.stringify(tokens, null, 2)} as const;\n\nexport type DesignTokens = typeof designTokens;\n`;

if (process.argv.includes("--check")) {
  const existing = readFileSync(targetPath, "utf8");

  if (existing !== generated) {
    console.error("src/theme/tokens.generated.ts está desincronizado. Ejecuta npm run tokens:build.");
    process.exitCode = 1;
  }
} else {
  writeFileSync(targetPath, generated);
}
