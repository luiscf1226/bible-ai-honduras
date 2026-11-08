/**
 * Filtro de contenido del chat entre amigos (1.0.3). Corre en el servidor
 * antes de guardar un mensaje: lo que no pasa no se guarda ni le llega a nadie,
 * y quien lo escribió ve un aviso para reformularlo (Apple 1.2 pide filtrar
 * contenido objetable). Reglas locales, sin IA y sin costo
 * (docs/spikes/moderacion-contenido-usuarios.md §5).
 *
 * Normaliza lo que se usa para esquivar una lista: mayúsculas, tildes,
 * letras de ancho completo o "de adorno" (NFKC), caracteres invisibles
 * (zero-width, selectores de variante, marcas de formato), letras cirílicas o
 * griegas que se ven igual, números en lugar de letras ("put4", "m13rda"),
 * letras repetidas ("puuuuta") y palabras partidas ("p.u.t.a", "p u t a",
 * "pu.ta", "pu ta").
 *
 * Partes que se juntan: las separadas sin espacio ("pu.ta", "pu-ta") y las de
 * una o dos letras separadas por espacio ("pu ta"). Dos palabras normales
 * separadas por espacio no se juntan ("ver gas" no es "vergas"). El mensaje
 * entero aplastado (sin separadores ni repeticiones) también se compara.
 * Nunca se busca una palabra *adentro* de otra: "computadora", "disputa" y
 * "reputación" pasan.
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

// Letras cirílicas y griegas que se ven como latinas (ya en minúscula).
const CONFUSABLES: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", і: "i", ј: "j", ѕ: "s",
  α: "a", β: "b", ε: "e", η: "n", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x",
};

// Invisibles: formato (Cf: zero-width, joiners, marcas de dirección, guion
// blando, BOM), selectores de variante y rellenos que se ven como espacio vacío.
const INVISIBLE = /[\p{Cf}\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}\u{180B}-\u{180F}\u{115F}\u{1160}\u{3164}\u{FFA0}\u{2800}]/gu;

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .toLowerCase()
    .replace(/[\u0400-\u04ff\u0370-\u03ff]/g, (char) => CONFUSABLES[char] ?? char)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[0134578@$]/g, (char) => LOOKALIKES[char] ?? char);
}

type Piece = { word: string; joinsPrevious: boolean };

/**
 * Las partes con letras del texto, cada una marcando si se puede juntar con la
 * anterior: separadas sin espacio, o las dos de una o dos letras.
 */
function piecesOf(text: string): Piece[] {
  const normalized = normalize(text);
  const pieces: Piece[] = [];
  let lastEnd = 0;
  let previous = "";
  for (const match of normalized.matchAll(/[a-z]+/g)) {
    const word = match[0];
    const gap = normalized.slice(lastEnd, match.index);
    const joinsPrevious = previous !== "" && (!/\s/.test(gap) || (previous.length <= 2 && word.length <= 2));
    pieces.push({ word, joinsPrevious });
    lastEnd = match.index + word.length;
    previous = word;
  }
  return pieces;
}

// Largo máximo de una palabra armada juntando partes: la más larga de la
// lista con margen para letras repetidas.
const MAX_JOINED = 24;

/** Cada parte sola y cada tramo de partes que se pueden juntar ("pu"+"ta"). */
function candidatesOf(pieces: Piece[]): { words: string[]; joined: string[] } {
  const words = pieces.map((piece) => piece.word);
  const joined: string[] = [];
  for (let start = 0; start < pieces.length; start += 1) {
    let word = pieces[start]!.word;
    for (let next = start + 1; next < pieces.length && pieces[next]!.joinsPrevious; next += 1) {
      word += pieces[next]!.word;
      if (word.length > MAX_JOINED) break;
      joined.push(word);
    }
  }
  return { words, joined };
}

const hasDoubleLetter = (word: string) => /(.)\1/.test(word);
const squash = (word: string) => word.replace(/(.)\1+/g, "$1");

// Las palabras de la lista sin letras dobles: contra estas se compara una
// palabra con todas sus repeticiones aplastadas ("puuta" → "puta"). Las que
// tienen doble ("perra") no entran, porque aplastadas chocan con palabras
// normales ("pera").
const SINGLE_LETTER_WORDS = new Set([...BLOCKED_WORDS].filter((word) => !hasDoubleLetter(word)));

// Para lo que se arma juntando partes no alcanza con "empieza con la raíz"
// ("cabro" + "necesito" empieza con "cabron"): la raíz tiene que llevar una
// de estas terminaciones y nada más.
const STEM_ENDINGS = ["", "a", "o", "e", "s", "as", "os", "es", "ada", "ado", "adas", "ados", "azo", "ing", "er", "ers", "ez"];
const STEM_FORMS = new Set(BLOCKED_STEMS.flatMap((stem) => STEM_ENDINGS.map((ending) => stem + ending)));

/** Las formas de una palabra que se comparan contra la lista. */
function variantsOf(token: string): { exact: string[]; squashed: string } {
  return {
    exact: [token, token.replace(/(.)\1{2,}/g, "$1"), token.replace(/(.)\1{2,}/g, "$1$1")],
    squashed: squash(token),
  };
}

function matchesList(token: string, stems: (word: string) => boolean): boolean {
  const { exact, squashed } = variantsOf(token);
  if (exact.some((word) => BLOCKED_WORDS.has(word))) return true;
  if (SINGLE_LETTER_WORDS.has(squashed)) return true;
  return [...exact, squashed].some(stems);
}

/** Una palabra suelta: puede empezar con una raíz ("pendejos"). */
const isBlockedWord = (token: string) => matchesList(token, (word) => BLOCKED_STEMS.some((stem) => word.startsWith(stem)));

/** Una palabra armada juntando partes: raíz solo con terminación conocida. */
const isBlockedJoin = (token: string) => matchesList(token, (word) => STEM_FORMS.has(word));

export type FilterResult = { ok: true } | { ok: false; reason: "offensive" };

export function checkMessageContent(text: string): FilterResult {
  const pieces = piecesOf(text);
  const { words, joined } = candidatesOf(pieces);
  // El mensaje entero sin separadores ("p - u - u . t a", "put a"); las
  // repeticiones las aplasta `matchesList`.
  const whole = words.join("");
  const blocked = words.some(isBlockedWord) || joined.some(isBlockedJoin) || (whole.length <= MAX_JOINED && isBlockedJoin(whole));
  return blocked ? { ok: false, reason: "offensive" } : { ok: true };
}
