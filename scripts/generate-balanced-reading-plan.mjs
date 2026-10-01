#!/usr/bin/env node
/**
 * Genera docs/content/planes/anual-para-empezar.json: la Biblia completa en un
 * año para quien nunca la leyó entera. En vez de arrancar con Génesis y llegar
 * a los evangelios recién en octubre (como el canónico), cada día trae un poco
 * de tres partes que avanzan a la par:
 *
 *   1. Antiguo Testamento (sin Salmos ni Proverbios), en orden del canon.
 *   2. Nuevo Testamento, de Mateo a Apocalipsis.
 *   3. Salmos y después Proverbios.
 *
 * Igual que `generate-reading-plan.mjs`, no es contenido generado por IA (regla
 * dura #4): es aritmética determinística sobre la cantidad de capítulos por
 * libro. El resultado se versiona en el repo y NO se regenera en cada build.
 *
 *   node scripts/generate-balanced-reading-plan.mjs
 *
 * `convex/readingPlanCatalog.test.ts` cruza el JSON con src/lib/bibleBooks.ts:
 * cada capítulo del canon tiene que aparecer exactamente una vez.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Cánon protestante (RV1909). Misma lista que generate-reading-plan.mjs.
const OLD_TESTAMENT = [
  ["Génesis", 50], ["Éxodo", 40], ["Levítico", 27], ["Números", 36], ["Deuteronomio", 34],
  ["Josué", 24], ["Jueces", 21], ["Rut", 4], ["1 Samuel", 31], ["2 Samuel", 24],
  ["1 Reyes", 22], ["2 Reyes", 25], ["1 Crónicas", 29], ["2 Crónicas", 36], ["Esdras", 10],
  ["Nehemías", 13], ["Ester", 10], ["Job", 42], ["Salmos", 150], ["Proverbios", 31],
  ["Eclesiastés", 12], ["Cantares", 8], ["Isaías", 66], ["Jeremías", 52], ["Lamentaciones", 5],
  ["Ezequiel", 48], ["Daniel", 12], ["Oseas", 14], ["Joel", 3], ["Amós", 9],
  ["Abdías", 1], ["Jonás", 4], ["Miqueas", 7], ["Nahúm", 3], ["Habacuc", 3],
  ["Sofonías", 3], ["Hageo", 2], ["Zacarías", 14], ["Malaquías", 4],
];
const NEW_TESTAMENT = [
  ["Mateo", 28], ["Marcos", 16], ["Lucas", 24], ["Juan", 21], ["Hechos", 28], ["Romanos", 16],
  ["1 Corintios", 16], ["2 Corintios", 13], ["Gálatas", 6], ["Efesios", 6], ["Filipenses", 4],
  ["Colosenses", 4], ["1 Tesalonicenses", 5], ["2 Tesalonicenses", 3], ["1 Timoteo", 6], ["2 Timoteo", 4],
  ["Tito", 3], ["Filemón", 1], ["Hebreos", 13], ["Santiago", 5], ["1 Pedro", 5],
  ["2 Pedro", 3], ["1 Juan", 5], ["2 Juan", 1], ["3 Juan", 1], ["Judas", 1],
  ["Apocalipsis", 22],
];
const WISDOM = new Set(["Salmos", "Proverbios"]);

const TOTAL_DAYS = 365;

function chaptersOf(books) {
  return books.flatMap(([book, count]) => Array.from({ length: count }, (_, i) => ({ book, chapter: i + 1 })));
}

// Reparto proporcional con techo: el día d recibe ceil(d·n/365) − ceil((d−1)·n/365)
// capítulos de esa parte. Así la carga queda pareja todo el año y el día 1
// arranca con las tres partes (Génesis 1, Mateo 1, Salmos 1).
function spread(chapters) {
  const perDay = [];
  for (let day = 1; day <= TOTAL_DAYS; day += 1) {
    const from = Math.ceil(((day - 1) * chapters.length) / TOTAL_DAYS);
    const to = Math.ceil((day * chapters.length) / TOTAL_DAYS);
    perDay.push(chapters.slice(from, to));
  }
  return perDay;
}

function buildPlan() {
  const oldTestament = spread(chaptersOf(OLD_TESTAMENT.filter(([book]) => !WISDOM.has(book))));
  const newTestament = spread(chaptersOf(NEW_TESTAMENT));
  const wisdom = spread(chaptersOf(OLD_TESTAMENT.filter(([book]) => WISDOM.has(book))));

  const days = Array.from({ length: TOTAL_DAYS }, (_, index) => ({
    day: index + 1,
    readings: [...oldTestament[index], ...newTestament[index], ...wisdom[index]],
  }));

  return {
    id: "anual-para-empezar",
    name: "La Biblia en un año · para empezar",
    description: "Cada día un poco del Antiguo Testamento, del Nuevo y de Salmos o Proverbios.",
    totalDays: TOTAL_DAYS,
    days,
  };
}

const plan = buildPlan();
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "content", "planes");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "anual-para-empezar.json");
writeFileSync(outPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

const counts = plan.days.map((d) => d.readings.length);
console.log(`Escrito ${outPath}`);
console.log(`Total de capítulos: ${counts.reduce((a, b) => a + b, 0)}`);
console.log(`Capítulos por día: mínimo ${Math.min(...counts)}, máximo ${Math.max(...counts)}`);
