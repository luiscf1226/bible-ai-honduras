#!/usr/bin/env node
/**
 * Genera docs/content/planes/canonico.json: el plan de lectura anual canónico
 * (Génesis → Apocalipsis), 1189 capítulos repartidos en 365 días lo más parejo
 * posible.
 *
 * No es contenido generado por IA (regla dura #4) — es aritmética determinística
 * sobre un dato de dominio público (la cantidad de capítulos por libro). El
 * resultado se versiona en el repo y NO se regenera en cada build; correr este
 * script a mano y commitear el JSON si algún día cambia el algoritmo de reparto.
 *
 *   node scripts/generate-reading-plan.mjs
 *
 * La cantidad de capítulos por libro tiene que coincidir con
 * src/lib/bibleBooks.ts — convex/readingPlanCatalog.test.ts lo verifica
 * cruzando ambas fuentes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Cánon protestante completo (RV1909), 66 libros en orden estándar. Copiado de
// src/lib/bibleBooks.ts — ver el comentario de arriba sobre el test cruzado.
const BOOKS = [
  ["Génesis", 50], ["Éxodo", 40], ["Levítico", 27], ["Números", 36], ["Deuteronomio", 34],
  ["Josué", 24], ["Jueces", 21], ["Rut", 4], ["1 Samuel", 31], ["2 Samuel", 24],
  ["1 Reyes", 22], ["2 Reyes", 25], ["1 Crónicas", 29], ["2 Crónicas", 36], ["Esdras", 10],
  ["Nehemías", 13], ["Ester", 10], ["Job", 42], ["Salmos", 150], ["Proverbios", 31],
  ["Eclesiastés", 12], ["Cantares", 8], ["Isaías", 66], ["Jeremías", 52], ["Lamentaciones", 5],
  ["Ezequiel", 48], ["Daniel", 12], ["Oseas", 14], ["Joel", 3], ["Amós", 9],
  ["Abdías", 1], ["Jonás", 4], ["Miqueas", 7], ["Nahúm", 3], ["Habacuc", 3],
  ["Sofonías", 3], ["Hageo", 2], ["Zacarías", 14], ["Malaquías", 4], ["Mateo", 28],
  ["Marcos", 16], ["Lucas", 24], ["Juan", 21], ["Hechos", 28], ["Romanos", 16],
  ["1 Corintios", 16], ["2 Corintios", 13], ["Gálatas", 6], ["Efesios", 6], ["Filipenses", 4],
  ["Colosenses", 4], ["1 Tesalonicenses", 5], ["2 Tesalonicenses", 3], ["1 Timoteo", 6], ["2 Timoteo", 4],
  ["Tito", 3], ["Filemón", 1], ["Hebreos", 13], ["Santiago", 5], ["1 Pedro", 5],
  ["2 Pedro", 3], ["1 Juan", 5], ["2 Juan", 1], ["3 Juan", 1], ["Judas", 1],
  ["Apocalipsis", 22],
];

const TOTAL_DAYS = 365;

function flattenChapters() {
  const chapters = [];
  for (const [book, count] of BOOKS) {
    for (let chapter = 1; chapter <= count; chapter += 1) {
      chapters.push({ book, chapter });
    }
  }
  return chapters;
}

// Reparto parejo tipo Bresenham: en vez de darle 4 capítulos a los primeros
// `remainder` días (que amontonaría la carga extra al arranque del año), se
// distribuye la carga a lo largo de los 365 días.
function chaptersPerDay(totalChapters, totalDays) {
  const base = Math.floor(totalChapters / totalDays);
  const remainder = totalChapters - base * totalDays;
  const perDay = [];
  let carried = 0;
  for (let day = 1; day <= totalDays; day += 1) {
    carried += remainder;
    const extra = carried >= totalDays ? 1 : 0;
    if (extra) carried -= totalDays;
    perDay.push(base + extra);
  }
  return perDay;
}

function buildPlan() {
  const chapters = flattenChapters();
  const perDay = chaptersPerDay(chapters.length, TOTAL_DAYS);
  const assigned = perDay.reduce((sum, n) => sum + n, 0);
  if (assigned !== chapters.length) {
    throw new Error(`El reparto no cuadra: ${assigned} asignados vs ${chapters.length} capítulos totales`);
  }

  const days = [];
  let cursor = 0;
  for (let day = 1; day <= TOTAL_DAYS; day += 1) {
    const count = perDay[day - 1];
    const readings = chapters.slice(cursor, cursor + count);
    cursor += count;
    days.push({ day, readings });
  }
  if (cursor !== chapters.length) {
    throw new Error(`Quedaron capítulos sin asignar: ${chapters.length - cursor}`);
  }

  return {
    id: "canonico",
    name: "Plan canónico",
    description: "Génesis a Apocalipsis en 365 días, en el orden del canon.",
    totalDays: TOTAL_DAYS,
    days,
  };
}

const plan = buildPlan();
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "content", "planes");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "canonico.json");
writeFileSync(outPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

console.log(`Escrito ${outPath}`);
console.log(`Total de capítulos: ${plan.days.reduce((sum, d) => sum + d.readings.length, 0)}`);
console.log(`Días con 4 capítulos: ${plan.days.filter((d) => d.readings.length === 4).length}`);
console.log(`Días con 3 capítulos: ${plan.days.filter((d) => d.readings.length === 3).length}`);
