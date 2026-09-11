#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const EXPECTED_CANON_VERSES = 31_102;
const DEFAULT_VERSION = "RV1909";
const DEFAULT_BATCH_SIZE = 64;
const OPENAI_USD_PER_MILLION_TOKENS = 0.02;

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error("Uso: npm run rag:ingest -- --kind verses|commentaries --file /ruta/corpus.json [--batch-size 64] [--start-batch 0] [--prod] [--dry-run] [--allow-partial]");
  process.exit(message ? 1 : 0);
}

function parseArgs(argv) {
  const result = { batchSize: DEFAULT_BATCH_SIZE, startBatch: 0, prod: false, dryRun: false, allowPartial: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--kind") result.kind = argv[++index];
    else if (arg === "--file") result.file = argv[++index];
    else if (arg === "--batch-size") result.batchSize = Number(argv[++index]);
    else if (arg === "--start-batch") result.startBatch = Number(argv[++index]);
    else if (arg === "--prod") result.prod = true;
    else if (arg === "--dry-run") result.dryRun = true;
    else if (arg === "--allow-partial") result.allowPartial = true;
    else if (arg === "--help" || arg === "-h") usage();
    else usage(`argumento desconocido: ${arg}`);
  }
  if (!result.file || !["verses", "commentaries"].includes(result.kind)) usage("faltan --kind y/o --file");
  if (!Number.isInteger(result.batchSize) || result.batchSize < 1 || result.batchSize > 256) usage("--batch-size debe ser 1..256");
  if (!Number.isInteger(result.startBatch) || result.startBatch < 0) usage("--start-batch debe ser un entero >= 0");
  return result;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateRows(kind, parsed, allowPartial) {
  const rows = Array.isArray(parsed) ? parsed : parsed?.[kind];
  if (!Array.isArray(rows)) throw new Error(`el JSON debe ser un arreglo o contener la llave ${kind}`);
  const invalid = rows.findIndex((row) => kind === "verses"
    ? !nonEmptyString(row?.book) || !Number.isInteger(row?.chapter) || row.chapter < 1 || !Number.isInteger(row?.verse) || row.verse < 1 || !nonEmptyString(row?.text)
    : !nonEmptyString(row?.source) || !nonEmptyString(row?.book) || !Number.isInteger(row?.chapter) || row.chapter < 1 || !nonEmptyString(row?.text));
  if (invalid >= 0) throw new Error(`fila invalida en indice ${invalid}`);
  const keys = rows.map((row) => kind === "verses"
    ? `${row.book}|${row.chapter}|${row.verse}`
    : `${row.source}|${row.book}|${row.chapter}`);
  const uniqueKeys = new Set(keys);
  if (uniqueKeys.size !== rows.length) {
    const seen = new Set();
    const duplicateIndex = keys.findIndex((key) => seen.has(key) || !seen.add(key));
    throw new Error(`referencia duplicada en indice ${duplicateIndex}: ${keys[duplicateIndex]}`);
  }
  if (kind === "verses" && rows.length !== EXPECTED_CANON_VERSES && !allowPartial) {
    throw new Error(`se esperaban ${EXPECTED_CANON_VERSES} versiculos y llegaron ${rows.length}; usa --allow-partial solo para pruebas`);
  }
  return rows;
}

function runBatch(options, rows) {
  const functionName = options.kind === "verses" ? "rag/ingest:ingestVerses" : "rag/commentary:ingestCommentary";
  const payload = options.kind === "verses" ? { verses: rows, version: DEFAULT_VERSION } : { commentaries: rows };
  const binary = resolve("node_modules/.bin/convex");
  const args = ["run", functionName, JSON.stringify(payload)];
  if (options.prod) args.push("--prod");
  const result = spawnSync(binary, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || `convex run termino con ${result.status}`);
  process.stdout.write(result.stdout);
  const tokens = Number(result.stdout.match(/"embeddingTokens"\s*:\s*(\d+)/)?.[1] ?? 0);
  return tokens;
}

const options = parseArgs(process.argv.slice(2));
const path = resolve(options.file);
const rows = validateRows(options.kind, JSON.parse(readFileSync(path, "utf8")), options.allowPartial);
const totalBatches = Math.ceil(rows.length / options.batchSize);
console.log(`Corpus validado: ${rows.length} ${options.kind}; ${totalBatches} lotes de hasta ${options.batchSize}.`);
if (options.dryRun) process.exit(0);

const startedAt = Date.now();
let totalTokens = 0;
for (let batchIndex = options.startBatch; batchIndex < totalBatches; batchIndex += 1) {
  const batch = rows.slice(batchIndex * options.batchSize, (batchIndex + 1) * options.batchSize);
  console.log(`[${batchIndex + 1}/${totalBatches}] indexando ${batch.length} filas...`);
  totalTokens += runBatch(options, batch);
}

const elapsedSeconds = (Date.now() - startedAt) / 1000;
const estimatedUsd = totalTokens * OPENAI_USD_PER_MILLION_TOKENS / 1_000_000;
console.log(JSON.stringify({ rows: rows.length - options.startBatch * options.batchSize, embeddingTokens: totalTokens, elapsedSeconds, estimatedUsd }, null, 2));
