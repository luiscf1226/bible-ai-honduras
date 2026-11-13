// Las respuestas de Preguntar y Voces salen de la app de verdad: el mismo
// backend (neighborly-kudu-508) y el mismo pipeline RAG que usa el teléfono
// (regla dura #4). Nada de textos de ejemplo.
//
//   - Preguntar: `rag/answer:ask`, lo que responde `qa.ask` sin guardar la
//     conversación ni gastar cuota.
//   - Voces: `voices:sendMessage` como la cuenta de prueba de App Review, que
//     es lo mismo que escribirle al personaje desde el teléfono.
//
// En la laptop usa tu sesión del CLI de Convex (~/.convex/config.json); en
// GitHub Actions, la deploy key de neighborly-kudu-508 (CONVEX_DEPLOY_KEY),
// que ya dice a qué deployment apunta.
import { execFileSync } from "node:child_process";

import { BIBLE_BOOKS } from "../../src/lib/bibleBooks.ts";

const DEPLOYMENT = process.env.CONVEX_VIDEOS_DEPLOYMENT ?? "neighborly-kudu-508";
/** La cuenta de prueba de App Review (appreview-bible+clerk_test@example.com). */
const TEST_USER = process.env.CONVEX_VIDEOS_USER ?? "user_3LIPpNQ0Q4llsCU5LURaYYcqKVR";

function run(repo, fn, args, identity) {
  const target = process.env.CONVEX_DEPLOY_KEY ? [] : ["--deployment", DEPLOYMENT];
  const command = ["convex", "run", ...target, ...(fn ? [fn, JSON.stringify(args)] : ["--inline-query", args])];
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
 * El versículo del recuadro: el primero que la respuesta nombra o cita textual.
 *
 * Es la misma regla que `boxVerse` de convex/rag/answer.ts (PR «Preguntar: la
 * caja muestra el versículo que usa la respuesta»). Hasta que ese cambio esté
 * desplegado, `rag/answer:ask` devuelve como cita el versículo más cercano por
 * búsqueda vectorial, que a veces queda fuera de tema (Jeremías 42:11, «el
 * rey de Babilonia», ante una pregunta sobre la ansiedad), aunque la
 * respuesta abre con Isaías 41:10, nombrándolo o solo citando sus palabras.
 *
 * Candidatos: los versículos que la respuesta nombra, los que cita entre
 * comillas (buscados por texto en RV1909) y el de la app. Gana el que aparece
 * primero; si ninguno aparece, queda el de la app (`fallback`).
 */
export function boxVerse(repo, answer, fallback) {
  const candidates = [];
  for (const [, book, chapter, verse] of answer.matchAll(REFERENCE)) {
    const found = run(
      repo,
      null,
      `return await ctx.db.query("verses").withIndex("by_ref", (q) => q.eq("version", "RV1909").eq("book", ${JSON.stringify(book)}).eq("chapter", ${chapter}).eq("verse", ${verse})).first()`,
    );
    if (found) candidates.push(found);
  }
  for (const [, quote] of answer.matchAll(QUOTE)) {
    const words = plainText(quote).split(" ").slice(0, 12).join(" ");
    if (words.split(" ").length < QUOTE_WORDS) continue;
    const found = run(repo, null, `return await ctx.db.query("verses").withSearchIndex("by_text", (q) => q.search("text", ${JSON.stringify(words)}).eq("version", "RV1909")).take(3)`);
    candidates.push(...(found ?? []));
  }
  if (fallback) candidates.push(fallback);
  const plainAnswer = plainText(answer);
  const best =
    candidates
      .map((verse) => ({ verse, at: firstMention(plainAnswer, verse) }))
      .filter((item) => item.at >= 0)
      .sort((a, b) => a.at - b.at)[0]?.verse ?? fallback;
  return best ? { Cita: `${best.book} ${best.chapter}:${best.verse}`, "Texto de la cita": best.text } : {};
}

/** Texto entre comillas de cualquier tipo, de al menos 20 caracteres. */
const QUOTE = /['"«“‘]([^'"«»“”‘’]{20,})['"»”’]/g;
/** Cuántas palabras seguidas del versículo cuentan como cita textual. */
const QUOTE_WORDS = 5;

/** Sin tildes, en minúscula y sin puntuación: así se comparan la respuesta y un versículo. */
function plainText(text) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Dónde usa `answer` (en plainText) ese versículo: nombrado o con QUOTE_WORDS palabras seguidas suyas. -1 si no lo usa. */
function firstMention(answer, verse) {
  const reference = plainText(`${verse.book} ${verse.chapter} ${verse.verse}`);
  const named = answer.search(new RegExp(`(?<![\\p{L}\\p{N}])(?<!\\p{N} )${reference}(?!\\p{N})`, "u"));
  const words = plainText(verse.text).split(" ");
  const size = Math.min(QUOTE_WORDS, words.length);
  const padded = ` ${answer} `;
  let quoted = -1;
  for (let i = 0; i + size <= words.length; i++) {
    const at = padded.indexOf(` ${words.slice(i, i + size).join(" ")} `);
    if (at >= 0 && (quoted < 0 || at < quoted)) quoted = at;
  }
  const found = [named, quoted].filter((at) => at >= 0);
  return found.length > 0 ? Math.min(...found) : -1;
}

/** Lo que el personaje `slug` le contesta a `question` en Voces: `{ Respuesta }`, o null. */
export function askCharacter(repo, slug, question) {
  const result = run(repo, "voices:sendMessage", { slug, text: question }, TEST_USER);
  if (result.status !== "ok" || !result.citation) return null;
  return { Respuesta: result.answer };
}
