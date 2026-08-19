#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const DEFAULT_RUNS = 3;
const DEFAULT_PROVIDERS = ["openai", "gemini"];
const DEFAULT_OUTPUT = "docs/spikes/results/image-provider-benchmark.json";

const prompts = [
  {
    id: "exodo-mar-rojo",
    prompt:
      "Ilustración para un libro bíblico infantil, sin texto ni letras. Moisés, un hombre adulto de aspecto semita con túnica sencilla color arena, guía a familias hebreas por un sendero seco entre dos paredes de agua del Mar Rojo. Amanecer cálido, composición cinematográfica, acuarela editorial suave, expresiones serenas, anatomía natural, sin símbolos modernos.",
  },
  {
    id: "ester-palacio",
    prompt:
      "Ilustración para un libro bíblico infantil, sin texto ni letras. Ester, una mujer adulta judía con vestido real modesto, entra con respeto a un salón del palacio persa y el rey extiende su cetro dorado. Luz suave que entra por ventanas altas, arquitectura persa antigua, acuarela editorial cálida, anatomía natural, sin objetos modernos.",
  },
  {
    id: "david-ovejas",
    prompt:
      "Ilustración para un libro bíblico infantil, sin texto ni letras. David adolescente cuida ovejas en las colinas de Belén al atardecer, con una honda de cuero a su lado y una pequeña arpa colgada en su espalda. Paisaje del antiguo Israel, luz dorada, acuarela editorial suave, anatomía natural, sin objetos modernos.",
  },
];

const providers = {
  openai: {
    envVar: "OPENAI_API_KEY",
    model: "gpt-image-1.5",
    /** Precio de lista: 1024×1024, calidad medium, sin contar tokens de prompt. */
    estimatedCostUsd: 0.034,
    async generate(prompt, apiKey) {
      return requestJson("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1.5",
          prompt,
          size: "1024x1024",
          quality: "medium",
          output_format: "png",
        }),
      });
    },
    imageBase64(response) {
      return response.data?.[0]?.b64_json ?? null;
    },
  },
  gemini: {
    envVar: "GEMINI_API_KEY",
    model: "gemini-3.1-flash-lite-image",
    /** Precio de lista: salida 1K; el prompt de este spike añade una fracción de centavo. */
    estimatedCostUsd: 0.0336,
    async generate(prompt, apiKey) {
      return requestJson("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-3.1-flash-lite-image",
          input: [{ type: "text", text: prompt }],
          response_format: {
            type: "image",
            aspect_ratio: "1:1",
            image_size: "1K",
          },
        }),
      });
    },
    imageBase64(response) {
      return response.output_image?.data ?? null;
    },
  },
};

function parseArgs(args) {
  const options = {
    dryRun: false,
    providers: DEFAULT_PROVIDERS,
    runs: DEFAULT_RUNS,
    output: DEFAULT_OUTPUT,
  };

  for (const arg of args) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg.startsWith("--providers=")) options.providers = arg.slice(12).split(",");
    else if (arg.startsWith("--runs=")) options.runs = Number(arg.slice(7));
    else if (arg.startsWith("--output=")) options.output = arg.slice(9);
    else throw new Error(`Argumento desconocido: ${arg}`);
  }

  if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 10) {
    throw new Error("--runs debe ser un entero entre 1 y 10.");
  }
  if (!options.providers.length || options.providers.some((provider) => !providers[provider])) {
    throw new Error(`--providers debe usar: ${Object.keys(providers).join(", ")}.`);
  }
  return options;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${payload.error?.message ?? response.statusText}`);
  }
  return payload;
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function summarize(providerName, rows) {
  const successful = rows.filter((row) => row.status === "success");
  const latencies = successful.map((row) => row.latencyMs);
  const provider = providers[providerName];
  return {
    attempted: rows.length,
    successful: successful.length,
    failed: rows.length - successful.length,
    successRate: rows.length ? successful.length / rows.length : 0,
    latencyMs: {
      min: latencies.length ? Math.min(...latencies) : null,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      max: latencies.length ? Math.max(...latencies) : null,
    },
    estimatedImageCostUsd: provider.estimatedCostUsd,
    estimatedSuccessfulCostUsd: successful.length * provider.estimatedCostUsd,
  };
}

async function writeSample(imageBase64, outputPath) {
  if (!imageBase64) return null;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(imageBase64, "base64"));
  return outputPath;
}

async function benchmarkProvider(providerName, options, baseOutputDir) {
  const provider = providers[providerName];
  const apiKey = process.env[provider.envVar];
  if (!apiKey) throw new Error(`Falta ${provider.envVar} para ejecutar ${providerName}.`);

  const rows = [];
  for (let run = 1; run <= options.runs; run += 1) {
    for (const scenario of prompts) {
      const startedAt = new Date().toISOString();
      const started = performance.now();
      try {
        const response = await provider.generate(scenario.prompt, apiKey);
        const latencyMs = Math.round(performance.now() - started);
        const imagePath = await writeSample(
          provider.imageBase64(response),
          resolve(baseOutputDir, "images", `${providerName}-${scenario.id}-${run}.png`),
        );
        rows.push({
          provider: providerName,
          model: provider.model,
          scenarioId: scenario.id,
          run,
          startedAt,
          status: "success",
          latencyMs,
          estimatedCostUsd: provider.estimatedCostUsd,
          imagePath,
        });
        console.log(`${providerName} ${scenario.id} #${run}: ${latencyMs} ms`);
      } catch (error) {
        rows.push({
          provider: providerName,
          model: provider.model,
          scenarioId: scenario.id,
          run,
          startedAt,
          status: "failed",
          latencyMs: Math.round(performance.now() - started),
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`${providerName} ${scenario.id} #${run}: falló`);
      }
    }
  }
  return rows;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const missingKeys = options.providers
    .filter((providerName) => !process.env[providers[providerName].envVar])
    .map((providerName) => providers[providerName].envVar);

  if (options.dryRun) {
    console.log(JSON.stringify({
      ready: missingKeys.length === 0,
      missingKeys,
      providers: options.providers.map((providerName) => ({
        provider: providerName,
        model: providers[providerName].model,
        estimatedImageCostUsd: providers[providerName].estimatedCostUsd,
      })),
      requestsPlanned: options.providers.length * prompts.length * options.runs,
    }, null, 2));
    process.exitCode = missingKeys.length ? 1 : 0;
    return;
  }

  if (missingKeys.length) {
    throw new Error(`Faltan credenciales: ${missingKeys.join(", ")}. Ejecutá primero con --dry-run para verificar la configuración.`);
  }

  const outputPath = resolve(options.output);
  const baseOutputDir = dirname(outputPath);
  const rows = [];
  for (const providerName of options.providers) {
    rows.push(...await benchmarkProvider(providerName, options, baseOutputDir));
  }
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    methodology: {
      scenarios: prompts.map(({ id, prompt }) => ({ id, prompt })),
      runsPerScenario: options.runs,
      execution: "secuencial por proveedor; latencia de pared desde antes de fetch hasta la respuesta",
      qualityRubric: "docs/spikes/issue-22-image-generation-provider.md#rúbrica-de-calidad",
    },
    results: rows,
    summary: Object.fromEntries(options.providers.map((providerName) => [
      providerName,
      summarize(providerName, rows.filter((row) => row.provider === providerName)),
    ])),
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Reporte guardado en ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
