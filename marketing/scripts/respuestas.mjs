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

const DEPLOYMENT = process.env.CONVEX_VIDEOS_DEPLOYMENT ?? "neighborly-kudu-508";
/** La cuenta de prueba de App Review (appreview-bible+clerk_test@example.com). */
const TEST_USER = process.env.CONVEX_VIDEOS_USER ?? "user_3LIPpNQ0Q4llsCU5LURaYYcqKVR";

function run(repo, fn, args, identity) {
  const command = ["convex", "run", "--deployment", DEPLOYMENT, fn, JSON.stringify(args)];
  if (identity) command.push("--identity", JSON.stringify({ subject: identity, tokenIdentifier: `videos|${identity}` }));
  const output = execFileSync("npx", command, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 });
  return JSON.parse(output.slice(output.indexOf("{")));
}

/**
 * Lo que la app responde a `question` en Preguntar:
 * `{ Respuesta, Cita, "Texto de la cita" }`, o null si no encontró nada para citar.
 */
export function askApp(repo, question) {
  const result = run(repo, "rag/answer:ask", { question, feature: "qa" });
  if (!result.citation) return null;
  const { book, chapter, verse, text } = result.citation;
  return { Respuesta: result.answer, Cita: `${book} ${chapter}:${verse}`, "Texto de la cita": text };
}

/** Lo que el personaje `slug` le contesta a `question` en Voces: `{ Respuesta }`, o null. */
export function askCharacter(repo, slug, question) {
  const result = run(repo, "voices:sendMessage", { slug, text: question }, TEST_USER);
  if (result.status !== "ok" || !result.citation) return null;
  return { Respuesta: result.answer };
}
