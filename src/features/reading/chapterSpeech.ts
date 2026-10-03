/**
 * Escuchar el capítulo (#157): texto a voz del sistema, versículo por
 * versículo. Leer es gratis: no pasa por cuotas.
 *
 * Se habla un versículo por vez (y no el capítulo entero de un tirón) por tres
 * razones: el lector puede marcar y seguir el versículo que suena, pausar y
 * reanudar funciona igual en iOS y Android (`Speech.pause` no existe en
 * Android: pausar acá es cortar y recordar el versículo), y ningún texto pasa
 * el tope de largo de la voz del sistema.
 *
 * El texto es el del corpus en la versión de la persona, tal cual: no se
 * resume ni se reescribe (regla dura #4).
 */

export type SpeechVoice = { identifier: string; language: string; name?: string; quality?: string };

export type SpeechEngine = {
  speak: (
    text: string,
    options: { language: string; voice?: string; onDone: () => void; onStopped: () => void; onError: () => void },
  ) => void;
  stop: () => void;
  getVoices: () => Promise<SpeechVoice[]>;
};

export type SpeakableVerse = { verse: number; text: string };

export type ChapterSpeechState =
  | { status: "idle" }
  | { status: "playing" | "paused"; verse: number; index: number; total: number };

/** Idioma que se le pide a la voz si no hay una en español instalada. */
export const SPEECH_LANGUAGE = "es-MX";

// Orden de preferencia: español de México y de EE. UU. (los más cercanos al
// de Honduras que traen iOS y Android), después cualquier español
// latinoamericano y, al final, cualquier español.
const PREFERRED_LANGUAGES = ["es-mx", "es-us", "es-419", "es-hn"];

function normalizeLanguage(language: string): string {
  return language.replace("_", "-").toLowerCase();
}

/** La voz en español más cercana a Honduras; `null` si el teléfono no tiene ninguna. */
export function chooseSpanishVoice(voices: readonly SpeechVoice[]): SpeechVoice | null {
  const spanish = voices.filter((voice) => normalizeLanguage(voice.language).startsWith("es"));
  if (spanish.length === 0) return null;
  const rank = (voice: SpeechVoice) => {
    const language = normalizeLanguage(voice.language);
    const preferred = PREFERRED_LANGUAGES.indexOf(language);
    const languageRank = preferred === -1 ? PREFERRED_LANGUAGES.length : preferred;
    // Entre voces del mismo idioma, la "Enhanced" suena mucho mejor.
    return languageRank * 2 + (voice.quality === "Enhanced" ? 0 : 1);
  };
  return [...spanish].sort((a, b) => rank(a) - rank(b))[0];
}

/** Desde dónde se empieza: el versículo pedido si existe en el capítulo, si no el primero. */
export function startIndex(verses: readonly SpeakableVerse[], fromVerse?: number | null): number {
  if (fromVerse == null) return 0;
  const index = verses.findIndex((item) => item.verse === fromVerse);
  return index === -1 ? 0 : index;
}

/** Lo que se dice de un versículo. Al empezar el capítulo se anuncia "Salmos, capítulo 46". */
export function utteranceFor(params: { book: string; chapter: number; verse: SpeakableVerse; announce: boolean }): string {
  const text = params.verse.text.trim();
  return params.announce ? `${params.book}, capítulo ${params.chapter}. ${text}` : text;
}

/**
 * Cola de lectura. No sabe de React: el hook `useChapterSpeech` la envuelve y
 * los tests la manejan con un motor falso.
 *
 * Cada `speak` lleva un número de turno. `Speech.stop()` dispara `onStopped`
 * (y en algunas plataformas `onDone`) del versículo que sonaba: si el turno ya
 * no es el actual, el aviso se ignora y no avanza la cola.
 */
export class ChapterSpeechController {
  private state: ChapterSpeechState = { status: "idle" };
  private turn = 0;
  private verses: readonly SpeakableVerse[] = [];
  private voice: SpeechVoice | null | undefined;

  constructor(
    private readonly engine: SpeechEngine,
    private readonly chapter: { book: string; chapter: number },
    private readonly onChange: (state: ChapterSpeechState) => void,
  ) {}

  get current(): ChapterSpeechState {
    return this.state;
  }

  async play(verses: readonly SpeakableVerse[], fromVerse?: number | null): Promise<void> {
    const playable = verses.filter((item) => item.text.trim().length > 0);
    if (playable.length === 0) return;
    this.verses = playable;
    const turn = this.nextTurn();
    if (this.voice === undefined) {
      try {
        this.voice = chooseSpanishVoice(await this.engine.getVoices());
      } catch {
        this.voice = null;
      }
      // Si mientras se buscaba la voz la persona paró o cambió de versículo, no se arranca.
      if (turn !== this.turn) return;
    }
    this.speakAt(startIndex(playable, fromVerse), turn);
  }

  pause(): void {
    if (this.state.status !== "playing") return;
    this.nextTurn();
    this.engine.stop();
    this.setState({ ...this.state, status: "paused" });
  }

  /** Reanuda desde el principio del versículo en el que se pausó. */
  resume(): void {
    if (this.state.status !== "paused") return;
    this.speakAt(this.state.index, this.nextTurn());
  }

  stop(): void {
    const wasActive = this.state.status !== "idle";
    this.nextTurn();
    if (wasActive) this.engine.stop();
    this.setState({ status: "idle" });
  }

  private nextTurn(): number {
    this.turn += 1;
    return this.turn;
  }

  private speakAt(index: number, turn: number): void {
    const verse = this.verses[index];
    if (!verse) {
      this.setState({ status: "idle" });
      return;
    }
    this.setState({ status: "playing", verse: verse.verse, index, total: this.verses.length });
    const advance = () => {
      if (turn !== this.turn) return;
      this.speakAt(index + 1, this.nextTurn());
    };
    this.engine.speak(utteranceFor({ ...this.chapter, verse, announce: index === 0 && verse.verse === 1 }), {
      language: this.voice?.language ?? SPEECH_LANGUAGE,
      voice: this.voice?.identifier,
      onDone: advance,
      // Un corte que no pidió la persona (otra app tomó el audio) deja la lectura en pausa.
      onStopped: () => {
        if (turn !== this.turn || this.state.status !== "playing") return;
        this.nextTurn();
        this.setState({ ...this.state, status: "paused" });
      },
      // Un versículo que la voz no pudo leer no frena el capítulo.
      onError: advance,
    });
  }

  private setState(state: ChapterSpeechState): void {
    this.state = state;
    this.onChange(state);
  }
}
