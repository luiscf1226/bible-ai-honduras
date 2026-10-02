import { FEELINGS } from "./feelings";

/**
 * Lógica pura del hilo de Sentir (#197, U5). Sin react-native, para que se
 * pueda testear con vitest. La pantalla (`app/(tabs)/sentir.tsx`) solo pinta
 * lo que sale de acá.
 *
 * Decisión de producto: **no hay chat libre** después del devocional. El hilo
 * es siempre "lo que llevás encima" → un devocional de `feelings:generate`
 * (regla dura #4). Para seguir, "Otro devocional" vuelve a abrir el composer y
 * "Tengo una pregunta sobre esto" lleva a Preguntar con la cita.
 */

export type FeelingDevotional = {
  citation: { book: string; chapter: number; verse: number; version: string; text: string };
  prayer: string;
  reflection: string;
  title: string;
};

export type UserTurn = { kind: "user"; id: string; feelings: string[]; note: string };
/** `feelings` = los que pidió la persona: deciden el recorrido sugerido (#115). */
export type DevotionalTurn = { kind: "devotional"; id: string; devotional: FeelingDevotional; feelings: string[] };
export type Turn = UserTurn | DevotionalTurn;

export type ThreadState = {
  turns: Turn[];
  /** Lo que se mandó y todavía no volvió (para el estado de carga y reintentar). */
  pending: { feelings: string[]; note: string } | null;
  /** Después de un devocional el composer se esconde hasta tocar "Otro devocional". */
  composerOpen: boolean;
  error: string | null;
};

export const INITIAL_THREAD: ThreadState = { turns: [], pending: null, composerOpen: true, error: null };

export type ThreadAction =
  | { type: "sent"; id: string; feelings: string[]; note: string }
  | { type: "generated"; id: string; devotional: FeelingDevotional }
  | { type: "failed"; message: string }
  | { type: "limitReached" }
  | { type: "anotherRequested" }
  | { type: "historyOpened"; turns: Turn[] }
  | { type: "reset" };

/** Saca el turno del usuario que quedó sin respuesta (error o límite). */
function dropUnanswered(turns: Turn[]): Turn[] {
  return turns.at(-1)?.kind === "user" ? turns.slice(0, -1) : turns;
}

export function threadReducer(state: ThreadState, action: ThreadAction): ThreadState {
  switch (action.type) {
    case "sent":
      return {
        turns: [...state.turns, { kind: "user", id: action.id, feelings: action.feelings, note: action.note.trim() }],
        pending: { feelings: action.feelings, note: action.note },
        composerOpen: false,
        error: null,
      };
    case "generated": {
      if (!state.pending) return state;
      return {
        turns: [
          ...state.turns,
          { kind: "devotional", id: action.id, devotional: action.devotional, feelings: state.pending.feelings },
        ],
        pending: null,
        composerOpen: false,
        error: null,
      };
    }
    case "failed":
      return { turns: dropUnanswered(state.turns), pending: null, composerOpen: true, error: action.message };
    case "limitReached":
      return { turns: dropUnanswered(state.turns), pending: null, composerOpen: true, error: null };
    case "anotherRequested":
      return { ...state, composerOpen: true, error: null };
    case "historyOpened":
      return { turns: action.turns, pending: null, composerOpen: false, error: null };
    case "reset":
      return INITIAL_THREAD;
  }
}

/** Qué va abajo, en el lugar fijo del composer. */
export type BottomSlot = "composer" | "limit" | "none";

export function bottomSlotFor(state: ThreadState, atLimit: boolean): BottomSlot {
  if (state.pending) return "none";
  // Límite (regla dura #3): el componente de siempre, en el lugar del composer y
  // con el hilo a la vista.
  if (atLimit) return "limit";
  return state.composerOpen || state.turns.length === 0 ? "composer" : "none";
}

/** Los chips de seguimiento van debajo del último devocional, nunca con el composer abierto. */
export function showFollowUps(state: ThreadState, turnIndex: number): boolean {
  return (
    !state.pending &&
    !state.composerOpen &&
    turnIndex === state.turns.length - 1 &&
    state.turns[turnIndex]?.kind === "devotional"
  );
}

export function canSend(feelings: readonly string[], note: string): boolean {
  return feelings.length > 0 || note.trim().length > 0;
}

export function toggleFeeling(selected: readonly string[], feeling: string): string[] {
  return selected.includes(feeling) ? selected.filter((item) => item !== feeling) : [...selected, feeling];
}

export function withFeeling(selected: readonly string[], feeling: string): string[] {
  return selected.includes(feeling) ? [...selected] : [...selected, feeling];
}

/** "Ansiedad · Cansancio": cómo se ven los chips dentro de la burbuja del usuario. */
export function feelingsLabel(feelings: readonly string[]): string {
  return feelings.join(" · ");
}

export function quotaLabel(quota: { isPro: boolean; remaining: number; limit: number } | null | undefined): string | null {
  if (!quota) return null;
  if (quota.isPro) return "Pro · sin límite";
  return `${quota.remaining} de ${quota.limit} ${quota.limit === 1 ? "devocional gratis" : "devocionales gratis"} hoy`;
}

const IDENTIFIES = /La persona identifica: ([^.]*)\./;
const TELLS = /También cuenta: ([\s\S]*?)(?: Respondé con un devocional|$)/;

/**
 * El servidor guarda como mensaje del usuario el prompt que arma
 * `buildFeelingQuestion` (convex/feelings.ts), no lo que se ve en pantalla.
 * Para reabrir uno de "Los de antes" se recuperan de ahí los chips y la nota.
 * Si el texto no tiene esa forma, se muestra tal cual como nota.
 */
export function userTurnFromStored(id: string, text: string): UserTurn {
  const identifies = IDENTIFIES.exec(text);
  const tells = TELLS.exec(text);
  if (!identifies && !tells) {
    return { kind: "user", id, feelings: [], note: text.trim() };
  }
  const known = FEELINGS as readonly string[];
  const feelings = (identifies?.[1] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => known.includes(item));
  return { kind: "user", id, feelings, note: (tells?.[1] ?? "").trim() };
}

export type StoredMessage = { role: "user" | "assistant"; text: string; devotional?: FeelingDevotional };

/** Uno de "Los de antes" como hilo: se muestra sin volver a generar. */
export function turnsFromHistory(conversationId: string, messages: readonly StoredMessage[]): Turn[] {
  const turns: Turn[] = [];
  let lastFeelings: string[] = [];
  messages.forEach((message, index) => {
    const id = `${conversationId}-${index}`;
    if (message.role === "user") {
      const turn = userTurnFromStored(id, message.text);
      lastFeelings = turn.feelings;
      turns.push(turn);
    } else if (message.devotional) {
      turns.push({ kind: "devotional", id, devotional: message.devotional, feelings: lastFeelings });
    }
  });
  return turns;
}
