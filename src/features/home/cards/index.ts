import type { ComponentType } from "react";

import { HOME_CARD_ORDER, HOME_TILE_IDS, type HomeCardId } from "../homeCards";
import { AskCard } from "./AskCard";
import { CharactersCard } from "./CharactersCard";
import { ContextCard } from "./ContextCard";
import { FeedCard } from "./FeedCard";
import { FeelingCard } from "./FeelingCard";
import { ReadCard } from "./ReadCard";
import { StoriesCard } from "./StoriesCard";
import { VerseCard } from "./VerseCard";

/** Lo que una tarjeta puede mirar para decidir si se muestra. */
export type HomeCardContext = {
  dateKey: string;
  /** Temporada activa (#199), o null fuera de temporada. */
  season: { slug: string } | null;
};

export type HomeCardEntry = {
  id: HomeCardId;
  Component: ComponentType;
  visible?: (context: HomeCardContext) => boolean;
};

const COMPONENTS: Record<HomeCardId, Omit<HomeCardEntry, "id">> = {
  context: { Component: ContextCard },
  verse: { Component: VerseCard },
  feed: { Component: FeedCard },
  read: { Component: ReadCard },
  feeling: { Component: FeelingCard },
  ask: { Component: AskCard },
  characters: { Component: CharactersCard },
  stories: { Component: StoriesCard },
};

/**
 * Registro de tarjetas del inicio (#193). Para sumar una: un archivo nuevo en
 * esta carpeta, su id en `HOME_CARD_ORDER` (homeCards.ts, con test del orden)
 * y una línea acá. Lo que solo aparece algunos días no es una tarjeta más:
 * entra en `ContextCard` con su lugar en `HOME_CONTEXT_PRIORITY` (#232).
 * `home.tsx` no cambia.
 */
export const HOME_CARDS: readonly HomeCardEntry[] = HOME_CARD_ORDER.map((id) => ({ id, ...COMPONENTS[id] }));

const TILE_IDS: readonly HomeCardId[] = HOME_TILE_IDS;

/** Un renglón del inicio: una tarjeta sola o dos mosaicos de la cuadrícula 2×2 (U1b). */
export type HomeRow = { key: string; cards: readonly HomeCardEntry[]; tiles: boolean };

/**
 * Agrupa las tarjetas visibles en renglones: cada tarjeta va sola, salvo los
 * mosaicos (`HOME_TILE_IDS`) consecutivos, que van de a dos.
 */
export function homeRows(cards: readonly HomeCardEntry[]): HomeRow[] {
  const rows: HomeRow[] = [];
  for (const card of cards) {
    const last = rows[rows.length - 1];
    const isTile = TILE_IDS.includes(card.id);
    if (isTile && last?.tiles && last.cards.length === 1) {
      rows[rows.length - 1] = { ...last, key: `${last.key}+${card.id}`, cards: [...last.cards, card] };
      continue;
    }
    rows.push({ key: card.id, cards: [card], tiles: isTile });
  }
  return rows;
}

export function visibleHomeCards(context: HomeCardContext): readonly HomeCardEntry[] {
  return HOME_CARDS.filter((card) => card.visible?.(context) ?? true);
}
