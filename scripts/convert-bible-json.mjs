#!/usr/bin/env node
/**
 * Convierte una Biblia en JSON anidado (libro → capítulos → versículos) al
 * formato plano que espera `scripts/ingest-rag-corpus.mjs`:
 *
 *   [{ book, chapter, verse, text }, ...]
 *
 * Por qué existe: las fuentes públicas de texto bíblico vienen anidadas y con
 * los libros en inglés. El índice vectorial de Convex filtra por `book` exacto
 * contra los nombres de `src/lib/bibleBooks.ts`, así que un corpus con
 * "Genesis" en vez de "Génesis" se ingiere sin error y después el selector de
 * pasajes no encuentra nada.
 *
 * El mapeo es por **posición**, no por nombre: las dos listas son el canon
 * protestante de 66 libros en orden estándar. Se valida el conteo de capítulos
 * de cada libro contra bibleBooks.ts, así que un archivo con otro orden o con
 * libros faltantes falla acá y no en producción.
 *
 * Uso:
 *   node scripts/convert-bible-json.mjs --in <origen.json> --out <destino.json>
 */
import { readFileSync, writeFileSync } from "node:fs";

function usage(message) {
  console.error(`${message}\n\nUso: node scripts/convert-bible-json.mjs --in <origen.json> --out <destino.json>`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { in: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--in") out.in = argv[++i];
    else if (argv[i] === "--out") out.out = argv[++i];
    else if (argv[i] === "--help") usage("");
    else usage(`argumento desconocido: ${argv[i]}`);
  }
  if (!out.in || !out.out) usage("faltan --in y/o --out");
  return out;
}

// Leído de src/lib/bibleBooks.ts para no duplicar la fuente de verdad.
function readCanon() {
  const src = readFileSync(new URL("../src/lib/bibleBooks.ts", import.meta.url), "utf8");
  const books = [...src.matchAll(/name:\s*"([^"]+)",\s*chapters:\s*(\d+)/g)].map((m) => ({
    name: m[1],
    chapters: Number(m[2]),
  }));
  if (books.length !== 66) throw new Error(`bibleBooks.ts tiene ${books.length} libros, se esperaban 66`);
  return books;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const canon = readCanon();

  // Muchas fuentes traen BOM; JSON.parse lo rechaza.
  const raw = readFileSync(args.in, "utf8").replace(/^﻿/, "");
  const source = JSON.parse(raw);
  if (!Array.isArray(source)) throw new Error("el JSON de origen debe ser un arreglo de libros");
  if (source.length !== canon.length) {
    throw new Error(`el origen tiene ${source.length} libros y el canon ${canon.length}; no se puede mapear por posición`);
  }

  const rows = [];
  source.forEach((book, index) => {
    const target = canon[index];
    const chapters = book?.chapters;
    if (!Array.isArray(chapters)) throw new Error(`libro ${index} (${target.name}) sin arreglo 'chapters'`);
    if (chapters.length !== target.chapters) {
      throw new Error(
        `${target.name}: el origen trae ${chapters.length} capítulos y bibleBooks.ts espera ${target.chapters}. ` +
          `Probablemente el orden de los libros no coincide.`,
      );
    }
    chapters.forEach((verses, chapterIndex) => {
      if (!Array.isArray(verses)) throw new Error(`${target.name} ${chapterIndex + 1}: capítulo no es un arreglo`);
      verses.forEach((text, verseIndex) => {
        if (typeof text !== "string" || text.trim().length === 0) {
          throw new Error(`${target.name} ${chapterIndex + 1}:${verseIndex + 1} sin texto`);
        }
        rows.push({
          book: target.name,
          chapter: chapterIndex + 1,
          verse: verseIndex + 1,
          text: text.trim(),
        });
      });
    });
  });

  writeFileSync(args.out, JSON.stringify(rows));
  console.log(`${rows.length} versículos escritos en ${args.out}`);
  console.log(`primero: ${rows[0].book} ${rows[0].chapter}:${rows[0].verse} — ${rows[0].text.slice(0, 60)}`);
  const last = rows[rows.length - 1];
  console.log(`último:  ${last.book} ${last.chapter}:${last.verse} — ${last.text.slice(0, 60)}`);
}

main();
