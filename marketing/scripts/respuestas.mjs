// Las respuestas de Preguntar y Voces salen de la app de verdad: el mismo
// backend (neighborly-kudu-508) y el mismo pipeline RAG que usa el teléfono
// (regla dura #4). Nada de textos de ejemplo.
//
//   - Preguntar: `rag/answer:ask`, lo que responde `qa.ask` sin guardar la
//     conversación ni gastar cuota.
//   - Voces: `voices:sendMessage` como la cuenta de prueba de App Review, que
//     es lo mismo que escribirle al personaje desde el teléfono.
//
// Usa tu sesión del CLI de Convex (~/.convex/config.json).
import { execFileSync } from "node:child_process";

import { BIBLE_BOOKS } from "../../src/lib/bibleBooks.ts";

const DEPLOYMENT = process.env.CONVEX_VIDEOS_DEPLOYMENT ?? "neighborly-kudu-508";
/** La cuenta de prueba de App Review (appreview-bible+clerk_test@example.com). */
const TEST_USER = process.env.CONVEX_VIDEOS_USER ?? "user_3LIPpNQ0Q4llsCU5LURaYYcqKVR";

function run(repo, fn, args, identity) {
  const command = ["convex", "run", "--deployment", DEPLOYMENT, ...(fn ? [fn, JSON.stringify(args)] : ["--inline-query", args])];
  if (identity) command.push("--identity", JSON.stringify({ subject: identity, tokenIdentifier: `videos|${identity}` }));
  const output = execFileSync("npx", command, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 });
  const start = output.search(/[{\[]|^null$/m);
  return start < 0 ? null : JSON.parse(output.slice(start));
}

/**
 * Lo que la app responde a `question` en Preguntar:
 * `{ Respuesta, Cita, "Texto de la cita" }`, o null si no encontró nada para citar.
 */
export function askApp(repo, question) {
  const result = run(repo, "rag/answer:ask", { question, feature: "qa" });
  if (!result.citation) return null;
  return { Respuesta: result.answer, ...boxVerse(repo, result.answer, result.citation) };
}

const BOOKS = [...BIBLE_BOOKS].map((book) => book.name).sort((a, b) => b.length - a.length);
const REFERENCE = new RegExp(`(${BOOKS.join("|")})\\s+(\\d+):(\\d+)`, "g");

/**
 * El versículo del recuadro: el primero que cita la propia respuesta.
 *
 * `rag/answer:ask` devuelve como cita el versículo más cercano por búsqueda
 * vectorial, y a veces es uno fuera de tema que la respuesta solo menciona de
 * pasada (Jeremías 42:11, «el rey de Babilonia», ante una pregunta sobre la
 * ansiedad). La respuesta, en cambio, abre con el versículo que mejor
 * responde, y todos los que cita son de los que recuperó el RAG (si cita
 * otro, `isGrounded` la descarta). Si no cita ninguno que exista en RV1909,
 * queda el de la app (`fallback`).
 */
export function boxVerse(repo, answer, fallback) {
  for (const [, book, chapter, verse] of answer.matchAll(REFERENCE)) {
    const text = run(
      repo,
      null,
      `const v = await ctx.db.query("verses").withIndex("by_ref", (q) => q.eq("version", "RV1909").eq("book", ${JSON.stringify(book)}).eq("chapter", ${chapter}).eq("verse", ${verse})).first(); return v ? { text: v.text } : null`,
    )?.text;
    if (text) return { Cita: `${book} ${chapter}:${verse}`, "Texto de la cita": text };
  }
  return fallback ? { Cita: `${fallback.book} ${fallback.chapter}:${fallback.verse}`, "Texto de la cita": fallback.text } : {};
}

/** Lo que el personaje `slug` le contesta a `question` en Voces: `{ Respuesta }`, o null. */
export function askCharacter(repo, slug, question) {
  const result = run(repo, "voices:sendMessage", { slug, text: question }, TEST_USER);
  if (result.status !== "ok" || !result.citation) return null;
  return { Respuesta: result.answer };
}
