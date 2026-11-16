/**
 * Filtro de contenido del chat entre amigos (1.0.3). Corre en el servidor
 * antes de guardar un mensaje: lo que no pasa no se guarda ni le llega a nadie,
 * y quien lo escribió ve un aviso para reformularlo (Apple 1.2 pide filtrar
 * contenido objetable). Reglas locales, sin IA y sin costo
 * (docs/spikes/moderacion-contenido-usuarios.md §5).
 *
 * Normaliza lo que se usa para esquivar una lista: mayúsculas, tildes,
 * letras de ancho completo o "de adorno" (NFKC), caracteres invisibles
 * (zero-width, selectores de variante, marcas de formato), letras de otros
 * alfabetos que se ven igual (cirílico, griego, armenio, latín con trazos o
 * versalitas), números y símbolos en lugar de letras ("put4", "pvt4", "m13rda")
 * y letras repetidas, también al final ("puuuuta", "perraa").
 *
 * Palabras partidas: además de cada palabra sola, se juntan tramos cortos de
 * palabras seguidas ("sos una put a", "la mier da", "p.u.t.a") y se comparan
 * contra la lista con sus terminaciones conocidas. Las combinaciones normales
 * del español que juntas forman una grosería ("mar icono", "ver gas",
 * "es tupido") están en `BENIGN_JOINS`. Nunca se busca una palabra *adentro*
 * de otra: "computadora", "disputa" y "reputación" pasan.
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

// Para lo que se arma juntando palabras no alcanza con "empieza con la raíz"
// ("cabro" + "necesito" empieza con "cabron"): la raíz tiene que llevar una
// de estas terminaciones y nada más.
const STEM_ENDINGS = ["", "a", "o", "e", "s", "as", "os", "es", "ada", "ado", "adas", "ados", "azo", "ing", "er", "ers", "ez"];
const STEM_FORMS = new Set(BLOCKED_STEMS.flatMap((stem) => STEM_ENDINGS.map((ending) => stem + ending)));

/**
 * Palabras seguidas del español que, juntas, forman algo de la lista. Cada una
 * es la primera palabra y el comienzo de la segunda: "mar" + "icono…",
 * "ver" + "gas". Si un tramo empieza así, no se junta.
 */
const BENIGN_JOINS: ReadonlyArray<readonly [string, string]> = [
  ["mar", "icon"], // el mar icono de
  ["mari", "con"], // salí con Mari con los niños
  ["ver", "gas"], // ver gas natural
  ["es", "tupid"], // el monte es tupido
  ["cabro", "n"], // el cabro no vino, el cabro nada
  ["cero", "t"], // saqué cero te digo
  ["cerro", "t"], // el cerro te espera, me cerró te digo
  ["play", "o"], // la play o el cine
];

// Números y símbolos que se usan como letras. El "1" puede ser "i" o "l" y la
// "v" puede ser "u" ("pvta"): se prueban las dos lecturas.
const LOOKALIKES: Record<string, string> = { "0": "o", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };

// Letras que se ven como latinas (ya en minúscula y sin marcas combinadas).
const CONFUSABLES: Record<string, string> = {
  // Cirílico.
  а: "a", в: "b", г: "r", е: "e", ё: "e", и: "u", к: "k", м: "m", н: "h", о: "o", п: "n", р: "p", с: "c", т: "t", у: "y", х: "x",
  ц: "u", ь: "b", і: "i", ї: "i", ј: "j", ѕ: "s", ԁ: "d", ԛ: "q", ԝ: "w", ѵ: "v", ү: "y", һ: "h", ӏ: "l", ӧ: "o", ԍ: "g",
  // Griego.
  α: "a", β: "b", γ: "y", ε: "e", η: "n", ι: "i", κ: "k", μ: "u", ν: "v", ο: "o", ρ: "p", ϱ: "p", σ: "o", ς: "c", ϲ: "c",
  τ: "t", υ: "u", χ: "x", ω: "w", ϳ: "j",
  // Armenio.
  ա: "w", գ: "q", զ: "q", հ: "h", ո: "n", ռ: "n", ս: "u", ց: "g", ւ: "l", օ: "o", ք: "p",
  // Latín con trazos (NFD no los separa), IPA y versalitas.
  ı: "i", ȷ: "j", ł: "l", ƚ: "l", ɫ: "l", ø: "o", ɵ: "o", đ: "d", ɗ: "d", ħ: "h", ɦ: "h", ŧ: "t", ƫ: "t", ƀ: "b", ɓ: "b",
  ɑ: "a", ɐ: "a", ɡ: "g", ɠ: "g", ɨ: "i", ɩ: "i", ɱ: "m", ɲ: "n", ŋ: "n", ɽ: "r", ʂ: "s", ʉ: "u", ʋ: "v", ƴ: "y", ʐ: "z",
  ᴀ: "a", ʙ: "b", ᴄ: "c", ᴅ: "d", ᴇ: "e", ꜰ: "f", ɢ: "g", ʜ: "h", ɪ: "i", ᴊ: "j", ᴋ: "k", ʟ: "l", ᴍ: "m", ɴ: "n",
  ᴏ: "o", ᴘ: "p", ʀ: "r", ꜱ: "s", ᴛ: "t", ᴜ: "u", ᴠ: "v", ᴡ: "w", ʏ: "y", ᴢ: "z",
};
const CONFUSABLE = new RegExp(`[${Object.keys(CONFUSABLES).join("")}]`, "gu");

// Invisibles: formato (Cf: zero-width, joiners, marcas de dirección, guion
// blando, BOM), selectores de variante y rellenos que se ven como espacio vacío.
const INVISIBLE = /[\p{Cf}\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}\u{180B}-\u{180F}\u{115F}\u{1160}\u{3164}\u{FFA0}\u{2800}]/gu;

/** El texto en minúsculas latinas sin tildes; "1" y "v" quedan para `readings`. */
function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(CONFUSABLE, (char) => CONFUSABLES[char] ?? char)
    .replace(/[03457@$]/g, (char) => LOOKALIKES[char] ?? char);
}

const SYMBOL_LETTER = /(?<=[a-z1])[!|](?=[a-z1])/;

/**
 * Las lecturas del texto: "!" e "|" entre letras como letra ("p!ja", "cu|o") o
 * como separador ("pu!ta"); "1" como "i" o como "l"; "v" como "v" o como "u".
 */
function readings(normalized: string): string[] {
  const symbols = SYMBOL_LETTER.test(normalized)
    ? [normalized, normalized.replace(new RegExp(SYMBOL_LETTER, "g"), (char) => (char === "!" ? "i" : "l"))]
    : [normalized];
  const ones = symbols.flatMap((text) => (text.includes("1") ? [text.replace(/1/g, "i"), text.replace(/1/g, "l")] : [text]));
  return ones.flatMap((text) => (text.includes("v") ? [text, text.replace(/v/g, "u")] : [text]));
}

type Piece = { word: string; spaced: boolean };

/** Las palabras del texto, cada una marcando si había un espacio antes. */
function piecesOf(text: string): Piece[] {
  const pieces: Piece[] = [];
  let lastEnd = 0;
  for (const match of text.matchAll(/[a-z]+/g)) {
    pieces.push({ word: match[0], spaced: /\s/.test(text.slice(lastEnd, match.index)) });
    lastEnd = match.index + match[0].length;
  }
  return pieces;
}

// Largo máximo de una palabra armada juntando partes: la más larga de la
// lista con margen para letras repetidas.
const MAX_JOINED = 24;
// Más tramos de letras repetidas que esto y solo se prueban "todas simples" y "todas dobles".
const MAX_RUNS = 6;

/**
 * Las formas de una palabra con cada tramo de letras repetidas leído como una
 * letra o como dos: "perrraa" → "pera", "perra", "peraa"…, "puuuta" → "puta".
 */
function runForms(word: string): string[] {
  const runs = [...word.matchAll(/(.)\1+/g)];
  if (runs.length === 0) return [word];
  const build = (pick: (index: number) => number) => {
    let out = "";
    let cursor = 0;
    runs.forEach((run, index) => {
      out += word.slice(cursor, run.index) + run[1]!.repeat(pick(index));
      cursor = run.index + run[0].length;
    });
    return out + word.slice(cursor);
  };
  if (runs.length > MAX_RUNS) return [build(() => 1), build(() => 2)];
  return Array.from({ length: 2 ** runs.length }, (_, mask) => build((index) => ((mask >> index) & 1) + 1));
}

/** Una palabra suelta: puede empezar con una raíz ("pendejos"). */
const isBlockedWord = (token: string) =>
  runForms(token).some((form) => BLOCKED_WORDS.has(form) || BLOCKED_STEMS.some((stem) => form.startsWith(stem)));

/** Una palabra armada juntando partes: raíz solo con terminación conocida. */
const isBlockedJoin = (token: string) => runForms(token).some((form) => BLOCKED_WORDS.has(form) || STEM_FORMS.has(form));

const isBenignJoin = (words: string[]) =>
  BENIGN_JOINS.some(([first, second]) => words[0] === first && words[1]!.startsWith(second));

/**
 * Los tramos de palabras seguidas que se juntan: de 2 y 3 palabras siempre, de
 * 4 si son todas de hasta 3 letras ("p ut a s"), y cualquier tramo de partes
 * pegadas sin espacio o de una o dos letras ("p.u.u.t.a", "p u u t a a").
 */
function joinsOf(pieces: Piece[]): string[][] {
  const joins: string[][] = [];
  for (let start = 0; start < pieces.length; start += 1) {
    const words = [pieces[start]!.word];
    let length = words[0]!.length;
    let chained = true;
    let shortOnly = length <= 3;
    for (let end = start + 1; end < pieces.length; end += 1) {
      const piece = pieces[end]!;
      chained &&= !piece.spaced || (pieces[end - 1]!.word.length <= 2 && piece.word.length <= 2);
      shortOnly &&= piece.word.length <= 3;
      words.push(piece.word);
      length += piece.word.length;
      if (length > MAX_JOINED || (words.length > 3 && !chained && !(words.length === 4 && shortOnly))) break;
      joins.push([...words]);
    }
  }
  return joins;
}

function isBlockedText(text: string): boolean {
  const pieces = piecesOf(text);
  if (pieces.some((piece) => isBlockedWord(piece.word))) return true;
  return joinsOf(pieces).some((words) => !isBenignJoin(words) && isBlockedJoin(words.join("")));
}

export type FilterResult = { ok: true } | { ok: false; reason: "offensive" };

export function checkMessageContent(text: string): FilterResult {
  const blocked = readings(normalize(text)).some(isBlockedText);
  return blocked ? { ok: false, reason: "offensive" } : { ok: true };
}
