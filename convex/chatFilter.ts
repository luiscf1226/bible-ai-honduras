/**
 * Filtro de contenido del chat entre amigos (1.0.3). Corre en el servidor
 * antes de guardar un mensaje: lo que no pasa no se guarda ni le llega a nadie,
 * y quien lo escribió ve un aviso para reformularlo (Apple 1.2 pide filtrar
 * contenido objetable). Reglas locales, sin IA y sin costo
 * (docs/spikes/moderacion-contenido-usuarios.md §5).
 *
 * Normaliza lo que se usa para esquivar una lista: mayúsculas, tildes,
 * números en lugar de letras ("put4", "m13rda"), letras repetidas
 * ("puuuuta") y letras sueltas separadas ("p.u.t.a", "p u t a").
 *
 * Quedan afuera a propósito palabras que en la Biblia o en la vida de iglesia
 * son normales ("zorras" de Mateo 8:20, "ramera", "prostituta") y modismos
 * catrachos que no ofenden ("maje", "cipote", "pisado").
 */

/** Palabras que se rechazan tal cual (ya normalizadas). */
const BLOCKED_WORDS = new Set([
  // Español, con lo de Honduras.
  "puta", "putas", "puto", "putos", "putita", "putitas", "putazo", "putamadre", "hdp",
  "verga", "vergas", "vergon", "vergona", "vergazo", "vergazos", "vergueo",
  "pija", "pijas", "pijudo", "pijuda", "pijazo",
  "culo", "culos", "culero", "culera", "culeros", "culeras",
  "cerote", "cerotes", "cerota",
  "perra", "perras",
  "marica", "maricas", "playo", "playos",
  "puneta", "punetas", "punetero",
  "mamaguevo", "mamahuevo", "mamaguevos", "mamahuevos",
  "chinga", "chingar", "chingada", "chingado", "chingadera", "chingue",
  "imbecil", "imbeciles",
  // Inglés.
  "shit", "shitty", "bullshit", "asshole", "assholes", "cunt", "cunts", "whore", "whores", "slut", "sluts",
  "nigger", "niggers", "nigga", "niggas", "faggot", "faggots", "fag", "fags",
]);

/** Raíces: cualquier palabra que empiece así ("pendejos", "malparida"). */
const BLOCKED_STEMS = [
  "hijueput", "hijoeput", "hijodeput", "malparid", "pendej", "mierd", "cabron", "maricon", "chupapij",
  "estupid", "idiot", "fuck", "motherfuck", "bitch",
];

// Números y símbolos que se usan como letras.
const LOOKALIKES: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[0134578@$]/g, (char) => LOOKALIKES[char] ?? char);
}

/** Palabras del texto, con las letras sueltas seguidas unidas ("p u t a" → "puta"). */
function tokensOf(text: string): string[] {
  const raw = normalize(text).split(/[^a-z]+/).filter(Boolean);
  const tokens: string[] = [];
  let letters = "";
  for (const token of raw) {
    if (token.length === 1) {
      letters += token;
      continue;
    }
    if (letters.length > 1) tokens.push(letters);
    letters = "";
    tokens.push(token);
  }
  if (letters.length > 1) tokens.push(letters);
  return tokens;
}

const hasDoubleLetter = (word: string) => /(.)\1/.test(word);

// Las palabras de la lista sin letras dobles: contra estas se compara una
// palabra con todas sus repeticiones aplastadas ("puuta" → "puta"). Las que
// tienen doble ("perra") no entran, porque aplastadas chocan con palabras
// normales ("pera").
const SINGLE_LETTER_WORDS = new Set([...BLOCKED_WORDS].filter((word) => !hasDoubleLetter(word)));

/** Las formas de una palabra que se comparan contra la lista. */
function variantsOf(token: string): { exact: string[]; squashed: string } {
  return {
    exact: [token, token.replace(/(.)\1{2,}/g, "$1"), token.replace(/(.)\1{2,}/g, "$1$1")],
    squashed: token.replace(/(.)\1+/g, "$1"),
  };
}

function isBlocked(token: string): boolean {
  const { exact, squashed } = variantsOf(token);
  if (exact.some((word) => BLOCKED_WORDS.has(word))) return true;
  if (SINGLE_LETTER_WORDS.has(squashed)) return true;
  return [...exact, squashed].some((word) => BLOCKED_STEMS.some((stem) => word.startsWith(stem)));
}

export type FilterResult = { ok: true } | { ok: false; reason: "offensive" };

export function checkMessageContent(text: string): FilterResult {
  return tokensOf(text).some(isBlocked) ? { ok: false, reason: "offensive" } : { ok: true };
}
