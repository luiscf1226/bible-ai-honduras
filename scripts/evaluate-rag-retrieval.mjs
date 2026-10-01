#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  console.log("Uso: npm run rag:evaluate -- [--file preguntas.json] [--version RV1909] [--prod]");
  process.exit(0);
}
const fileIndex = argv.indexOf("--file");
const file = resolve(fileIndex >= 0 ? argv[fileIndex + 1] : "docs/rag-evaluation-questions.json");
const versionIndex = argv.indexOf("--version");
const version = versionIndex >= 0 ? argv[versionIndex + 1] : "RV1909";
if (!["RV1909", "RVR1960", "NVI"].includes(version)) {
  console.error("--version debe ser RV1909, RVR1960 o NVI");
  process.exit(1);
}
const prod = argv.includes("--prod");
const cases = JSON.parse(readFileSync(file, "utf8"));
const binary = resolve("node_modules/.bin/convex");
let hits = 0;

for (const testCase of cases) {
  const args = ["run", "rag/retrieve:topVerses", JSON.stringify({ query: testCase.question, version, limit: 3 })];
  if (prod) args.push("--prod");
  const result = spawnSync(binary, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `fallo evaluando ${testCase.question}`);
  const jsonStart = result.stdout.indexOf("[");
  const rows = JSON.parse(result.stdout.slice(jsonStart));
  const hit = rows.some((row) => row.book === testCase.expected.book && row.chapter === testCase.expected.chapter);
  if (hit) hits += 1;
  console.log(`${hit ? "PASS" : "FAIL"} ${testCase.question} -> ${testCase.expected.book} ${testCase.expected.chapter}`);
}

console.log(`Recall@3 (${version}): ${hits}/${cases.length} (${Math.round(hits / cases.length * 100)}%)`);
process.exit(hits === cases.length ? 0 : 1);
