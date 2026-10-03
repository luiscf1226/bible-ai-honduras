#!/usr/bin/env node
/**
 * Genera docs/content/referencias-cruzadas.json (#187, N4): los pasajes
 * relacionados que muestra la hoja del versículo en el lector.
 *
 * Fuente: OpenBible.info, "Cross References"
 * (https://www.openbible.info/labs/cross-references/), licencia CC-BY. Es el
 * Treasury of Scripture Knowledge (dominio público) más referencias votadas por
 * usuarios; los votos ordenan cuáles se muestran primero. No es contenido
 * generado por IA (regla dura #4 no aplica): es un índice fijo. El texto de cada
 * pasaje NO viene de acá: la app lo lee de RV1909.
 *
 * Uso (el archivo de origen no se versiona, pesa ~8 MB):
 *
 *   curl -sSLO https://a.openbible.info/data/cross-references.zip
 *   unzip cross-references.zip
 *   node scripts/generate-cross-references.mjs --in cross_references.txt
 *
 * Opciones: --top N (por versículo, 5 por defecto), --min-votes N (5 por
 * defecto), --out <ruta>.
 *
 * Formato de salida (compacto, para no inflar el bundle):
 *
 *   { "source": …, "license": …, "books": [ libro ][ capítulo-1 ][ versículo-1 ] }
 *
 * Cada versículo es un string con las referencias separadas por espacio, de
 * más a menos votada. Cada referencia es `libro.capítulo.versículo` con el
 * libro como índice 0–65 del canon de `src/lib/bibleBooks.ts`, y un final
 * opcional: `-v` (mismo capítulo) o `-c.v` (otro capítulo del mismo libro).
 * La decodificación vive en `src/features/reading/crossReferences.ts`.
 *
 * Versificación: OpenBible usa la de la ESV, que coincide con la KJV salvo
 * 3 Juan 1:15 y Apocalipsis 12:18, que en RV1909 (31.102 versículos, la misma
 * cuenta que la KJV) son parte del versículo anterior. Esas dos se remapean.
 * Se valida cada capítulo contra la cantidad de capítulos de bibleBooks.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Abreviaturas OSIS de OpenBible, en el orden del canon protestante: la
// posición es el índice del libro en src/lib/bibleBooks.ts.
const OSIS_BOOKS = [
  "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam", "2Sam",
  "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job", "Ps", "Prov",
  "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos",
  "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal",
  "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor", "2Cor", "Gal", "Eph",
  "Phil", "Col", "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb", "Jas",
  "1Pet", "2Pet", "1John", "2John", "3John", "Jude", "Rev",
];

// Capítulos por libro, mismo orden (copia de src/lib/bibleBooks.ts).
const CHAPTERS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31,
  12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4,
  28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5,
  5, 3, 5, 1, 1, 1, 22,
];

// Versículos de la ESV que en RV1909 son parte del anterior.
const VERSE_REMAP = new Map([
  ["3John.1.15", "3John.1.14"],
  ["Rev.12.18", "Rev.12.17"],
]);

function parseArgs(argv) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const out = { in: null, out: join(root, "docs/content/referencias-cruzadas.json"), top: 5, minVotes: 5 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--in") out.in = argv[++i];
    else if (argv[i] === "--out") out.out = argv[++i];
    else if (argv[i] === "--top") out.top = Number(argv[++i]);
    else if (argv[i] === "--min-votes") out.minVotes = Number(argv[++i]);
    else throw new Error(`argumento desconocido: ${argv[i]}`);
  }
  if (!out.in) throw new Error("falta --in <cross_references.txt>");
  return out;
}

const bookIndex = new Map(OSIS_BOOKS.map((name, index) => [name, index]));

function parsePoint(raw) {
  const [book, chapter, verse] = (VERSE_REMAP.get(raw) ?? raw).split(".");
  const index = bookIndex.get(book);
  const c = Number(chapter);
  const v = Number(verse);
  if (index === undefined) throw new Error(`libro desconocido: ${raw}`);
  if (!Number.isInteger(c) || c < 1 || c > CHAPTERS[index]) throw new Error(`capítulo fuera de rango: ${raw}`);
  if (!Number.isInteger(v) || v < 1) throw new Error(`versículo inválido: ${raw}`);
  return { book: index, chapter: c, verse: v };
}

function encodeRef(raw) {
  const [startRaw, endRaw] = raw.split("-");
  const start = parsePoint(startRaw);
  let code = `${start.book}.${start.chapter}.${start.verse}`;
  if (endRaw) {
    const end = parsePoint(endRaw);
    // Un rango que cruza de libro se corta al versículo inicial.
    if (end.book === start.book) {
      if (end.chapter === start.chapter && end.verse > start.verse) code += `-${end.verse}`;
      else if (end.chapter > start.chapter) code += `-${end.chapter}.${end.verse}`;
    }
  }
  return { start, code };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const lines = readFileSync(args.in, "utf8").split("\n");
  const byVerse = new Map();
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [from, to, votesRaw] = line.split("\t");
    const votes = Number(votesRaw);
    if (votes < args.minVotes) continue;
    const source = parsePoint(from);
    const target = encodeRef(to);
    // Un pasaje que apunta a sí mismo no ayuda.
    if (target.start.book === source.book && target.start.chapter === source.chapter && target.start.verse === source.verse) continue;
    const key = `${source.book}.${source.chapter}.${source.verse}`;
    const list = byVerse.get(key) ?? [];
    list.push({ votes, code: target.code });
    byVerse.set(key, list);
  }

  const books = OSIS_BOOKS.map(() => []);
  let total = 0;
  for (const [key, list] of byVerse) {
    const [b, c, v] = key.split(".").map(Number);
    const seen = new Set();
    const codes = list
      .sort((a, z) => z.votes - a.votes || a.code.localeCompare(z.code))
      .filter((item) => (seen.has(item.code) ? false : (seen.add(item.code), true)))
      .slice(0, args.top)
      .map((item) => item.code);
    total += codes.length;
    const chapters = books[b];
    while (chapters.length < c) chapters.push([]);
    const verses = chapters[c - 1];
    while (verses.length < v) verses.push("");
    verses[v - 1] = verses[v - 1] ? `${verses[v - 1]} ${codes.join(" ")}` : codes.join(" ");
  }

  const output = {
    source: "OpenBible.info Cross References (https://www.openbible.info/labs/cross-references/)",
    license: "CC-BY",
    generatedWith: `scripts/generate-cross-references.mjs --top ${args.top} --min-votes ${args.minVotes}`,
    books,
  };
  writeFileSync(args.out, `${JSON.stringify(output)}\n`);
  console.log(`${byVerse.size} versículos con referencias, ${total} referencias → ${args.out}`);
}

main();
